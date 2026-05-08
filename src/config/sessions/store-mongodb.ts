/**
 * MongoDB Session Store Implementation
 * Replaces filesystem-based session storage with MongoDB
 */

import { MongoClient, Db, Collection } from "mongodb";
import type { MsgContext } from "../../auto-reply/templating.js";
import {
  deliveryContextFromSession,
  mergeDeliveryContext,
  normalizeDeliveryContext,
  normalizeSessionDeliveryFields,
  type DeliveryContext,
} from "../../utils/delivery-context.js";
import { deriveSessionMetaPatch } from "./metadata.js";
import { mergeSessionEntry, type SessionEntry } from "./types.js";

// ============================================================================
// Types
// ============================================================================

type MongoDBSessionEntry = SessionEntry & {
  _id?: string;
};

type SessionStoreCacheEntry = {
  store: Record<string, SessionEntry>;
  loadedAt: number;
};

// ============================================================================
// State
// ============================================================================

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;
let sessionsCollection: Collection<MongoDBSessionEntry> | null = null;

const SESSION_STORE_CACHE = new Map<string, SessionStoreCacheEntry>();
const DEFAULT_SESSION_STORE_TTL_MS = 45_000; // 45 seconds

// ============================================================================
// Configuration
// ============================================================================

interface MongoDBConfig {
  uri: string;
  dbName: string;
  collectionName: string;
  maxPoolSize: number;
  minPoolSize: number;
  serverSelectionTimeoutMs: number;
  socketTimeoutMs: number;
}

function getMongoDBConfig(): MongoDBConfig {
  // Try to load from config file first
  try {
    const { loadConfig } = require("../config.js");
    const cfg = loadConfig() as { session?: { mongoDb?: MongoDBConfig } };
    const mongoDbCfg = cfg.session?.mongoDb;

    if (mongoDbCfg) {
      return {
        uri: mongoDbCfg.uri || process.env.OPENCLAW_MONGODB_URI || process.env.MONGODB_URI || "mongodb://localhost:27017",
        dbName: mongoDbCfg.dbName || process.env.OPENCLAW_MONGODB_DB || "openclaw",
        collectionName: mongoDbCfg.collectionName || process.env.OPENCLAW_MONGODB_COLLECTION || "sessions",
        maxPoolSize: mongoDbCfg.maxPoolSize || 10,
        minPoolSize: mongoDbCfg.minPoolSize || 2,
        serverSelectionTimeoutMs: mongoDbCfg.serverSelectionTimeoutMs || 5000,
        socketTimeoutMs: mongoDbCfg.socketTimeoutMs || 30000,
      };
    }
  } catch {
    // Fallback to environment variables
  }

  return {
    uri: process.env.OPENCLAW_MONGODB_URI || process.env.MONGODB_URI || "mongodb://localhost:27017",
    dbName: process.env.OPENCLAW_MONGODB_DB || "openclaw",
    collectionName: process.env.OPENCLAW_MONGODB_COLLECTION || "sessions",
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMs: 5000,
    socketTimeoutMs: 30000,
  };
}

// ============================================================================
// Connection Management
// ============================================================================

// Log startup
const mongoConfig = getMongoDBConfig();
const sanitizedUri = mongoConfig.uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
console.log('[MongoDB Session Store] ENABLED');
console.log('[MongoDB Session Store] URI:', sanitizedUri);
console.log('[MongoDB Session Store] DB:', mongoConfig.dbName);
console.log('[MongoDB Session Store] Collection:', mongoConfig.collectionName);

async function ensureConnected(): Promise<void> {
  if (mongoClient && mongoDb && sessionsCollection) {
    return;
  }

  const config = getMongoDBConfig();
  console.log('[MongoDB Session Store] Connecting...');

  if (!mongoClient) {
    mongoClient = new MongoClient(config.uri, {
      maxPoolSize: config.maxPoolSize,
      minPoolSize: config.minPoolSize,
      serverSelectionTimeoutMS: config.serverSelectionTimeoutMs,
      socketTimeoutMS: config.socketTimeoutMs,
    });
  }

  if (!mongoClient) {
    throw new Error("Failed to create MongoDB client");
  }

  try {
    await mongoClient.connect();
    mongoDb = mongoClient.db(config.dbName);
    sessionsCollection = mongoDb.collection<MongoDBSessionEntry>(config.collectionName);

    // Create indexes for better query performance
    await sessionsCollection.createIndex({ sessionKey: 1 }, { unique: true });
    await sessionsCollection.createIndex({ createdAt: -1 });
    await sessionsCollection.createIndex({ updatedAt: -1 });
    await sessionsCollection.createIndex({ channel: 1 });

    // Count existing sessions
    const count = await sessionsCollection.countDocuments();
    console.log('[MongoDB Session Store] Connected! Existing sessions:', count);
  } catch (error) {
    console.error('[MongoDB Session Store] Connection failed:', error);
    mongoClient = null;
    mongoDb = null;
    sessionsCollection = null;
    throw new Error(`Failed to connect to MongoDB: ${error}`);
  }
}

export async function disconnectMongoDB(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    mongoDb = null;
    sessionsCollection = null;
  }
  SESSION_STORE_CACHE.clear();
}

// ============================================================================
// Cache Management
// ============================================================================

function getSessionStoreTtl(): number {
  const envValue = process.env.OPENCLAW_SESSION_CACHE_TTL_MS;
  if (envValue) {
    const parsed = Number.parseInt(envValue, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_SESSION_STORE_TTL_MS;
}

function isSessionStoreCacheEnabled(): boolean {
  return getSessionStoreTtl() > 0;
}

function isSessionStoreCacheValid(entry: SessionStoreCacheEntry): boolean {
  const now = Date.now();
  const ttl = getSessionStoreTtl();
  return now - entry.loadedAt <= ttl;
}

function invalidateSessionStoreCache(sessionKey?: string): void {
  if (sessionKey) {
    SESSION_STORE_CACHE.delete(sessionKey);
  } else {
    SESSION_STORE_CACHE.clear();
  }
}

// ============================================================================
// Session Store Operations
// ============================================================================

function normalizeSessionEntryDelivery(entry: SessionEntry): SessionEntry {
  const normalized = normalizeSessionDeliveryFields({
    channel: entry.channel,
    lastChannel: entry.lastChannel,
    lastTo: entry.lastTo,
    lastAccountId: entry.lastAccountId,
    lastThreadId: entry.lastThreadId ?? entry.deliveryContext?.threadId ?? entry.origin?.threadId,
    deliveryContext: entry.deliveryContext,
  });
  const nextDelivery = normalized.deliveryContext;
  const sameDelivery =
    (entry.deliveryContext?.channel ?? undefined) === nextDelivery?.channel &&
    (entry.deliveryContext?.to ?? undefined) === nextDelivery?.to &&
    (entry.deliveryContext?.accountId ?? undefined) === nextDelivery?.accountId &&
    (entry.deliveryContext?.threadId ?? undefined) === nextDelivery?.threadId;
  const sameLast =
    entry.lastChannel === normalized.lastChannel &&
    entry.lastTo === normalized.lastTo &&
    entry.lastAccountId === normalized.lastAccountId &&
    entry.lastThreadId === normalized.lastThreadId;
  if (sameDelivery && sameLast) {
    return entry;
  }
  return {
    ...entry,
    deliveryContext: nextDelivery,
    lastChannel: normalized.lastChannel,
    lastTo: normalized.lastTo,
    lastAccountId: normalized.lastAccountId,
    lastThreadId: normalized.lastThreadId,
  };
}

function mongoDocToSessionEntry(doc: MongoDBSessionEntry | null): SessionEntry | null {
  if (!doc) {
    return null;
  }
  const { _id, ...entry } = doc;
  return entry as SessionEntry;
}

function sessionEntryToMongoDoc(entry: SessionEntry): MongoDBSessionEntry {
  return { ...entry, _id: entry.sessionKey };
}

export async function loadSessionStore(
  storePath: string, // Kept for compatibility, but not used in MongoDB
  opts: { skipCache?: boolean } = {},
): Promise<Record<string, SessionEntry>> {
  await ensureConnected();

  if (!sessionsCollection) {
    throw new Error("MongoDB not connected");
  }

  const result: Record<string, SessionEntry> = {};

  try {
    const cursor = sessionsCollection.find({});
    const docs = await cursor.toArray();

    for (const doc of docs) {
      const entry = mongoDocToSessionEntry(doc);
      if (entry && entry.sessionKey) {
        result[entry.sessionKey] = entry;
      }
    }
    console.log('[MongoDB Session Store] Loaded all sessions:', Object.keys(result).length, 'entries');
  } catch (error) {
    console.error("[MongoDB Session Store] Failed to load sessions:", error);
  }

  return result;
}

export async function loadSessionEntry(sessionKey: string): Promise<SessionEntry | null> {
  await ensureConnected();

  if (!sessionsCollection) {
    throw new Error("MongoDB not connected");
  }

  // Check cache first
  if (isSessionStoreCacheEnabled()) {
    const cached = SESSION_STORE_CACHE.get(sessionKey);
    if (cached && isSessionStoreCacheValid(cached)) {
      console.log('[MongoDB Session Store] Cache HIT for:', sessionKey);
      return cached.store[sessionKey] || null;
    }
    console.log('[MongoDB Session Store] Cache MISS for:', sessionKey);
  }

  try {
    const doc = await sessionsCollection.findOne({ sessionKey });
    const entry = mongoDocToSessionEntry(doc);

    if (entry && isSessionStoreCacheEnabled()) {
      SESSION_STORE_CACHE.set(sessionKey, {
        store: { [sessionKey]: entry },
        loadedAt: Date.now(),
      });
    }

    console.log('[MongoDB Session Store] Loaded entry:', sessionKey, entry ? 'FOUND' : 'NOT FOUND');
    return entry;
  } catch (error) {
    console.error(`[MongoDB Session Store] Failed to load session entry for key ${sessionKey}:`, error);
    return null;
  }
}

export async function readSessionUpdatedAt(params: {
  storePath: string;
  sessionKey: string;
}): Promise<number | undefined> {
  try {
    const entry = await loadSessionEntry(params.sessionKey);
    return entry?.updatedAt;
  } catch {
    return undefined;
  }
}

async function saveSessionEntry(entry: SessionEntry): Promise<void> {
  await ensureConnected();

  if (!sessionsCollection) {
    throw new Error("MongoDB not connected");
  }

  const normalized = normalizeSessionEntryDelivery(entry);
  const doc = sessionEntryToMongoDoc(normalized);

  try {
    await sessionsCollection.updateOne(
      { sessionKey: entry.sessionKey },
      { $set: doc },
      { upsert: true },
    );

    // Invalidate cache for this session
    invalidateSessionStoreCache(entry.sessionKey);
    console.log('[MongoDB Session Store] Saved entry:', entry.sessionKey);
  } catch (error) {
    console.error(`[MongoDB Session Store] Failed to save session entry for key ${entry.sessionKey}:`, error);
    throw error;
  }
}

export async function saveSessionStore(
  storePath: string,
  store: Record<string, SessionEntry>,
): Promise<void> {
  await ensureConnected();

  if (!sessionsCollection) {
    throw new Error("MongoDB not connected");
  }

  // Clear all cache
  invalidateSessionStoreCache();

  const bulkOps = Object.values(store).map((entry) => {
    const normalized = normalizeSessionEntryDelivery(entry);
    const doc = sessionEntryToMongoDoc(normalized);
    return {
      updateOne: {
        filter: { sessionKey: entry.sessionKey },
        update: { $set: doc },
        upsert: true,
      },
    };
  });

  try {
    if (bulkOps.length > 0) {
      await sessionsCollection.bulkWrite(bulkOps, { ordered: false });
      console.log('[MongoDB Session Store] Bulk saved:', bulkOps.length, 'entries');
    }
  } catch (error) {
    console.error("[MongoDB Session Store] Failed to save session store:", error);
    throw error;
  }
}

export async function updateSessionStore<T>(
  storePath: string,
  mutator: (store: Record<string, SessionEntry>) => Promise<T> | T,
): Promise<T> {
  await ensureConnected();

  if (!sessionsCollection) {
    throw new Error("MongoDB not connected");
  }

  // Load current state
  const store = await loadSessionStore(storePath, { skipCache: true });

  // Apply mutation
  const result = await mutator(store);

  // Save back
  await saveSessionStore(storePath, store);

  return result;
}

export async function updateSessionStoreEntry(params: {
  storePath: string;
  sessionKey: string;
  update: (entry: SessionEntry) => Promise<Partial<SessionEntry> | null>;
}): Promise<SessionEntry | null> {
  const { storePath, sessionKey, update } = params;
  await ensureConnected();

  if (!sessionsCollection) {
    throw new Error("MongoDB not connected");
  }

  // Load existing entry
  const doc = await sessionsCollection.findOne({ sessionKey });
  const existing = mongoDocToSessionEntry(doc);

  if (!existing) {
    return null;
  }

  // Apply update
  const patch = await update(existing);
  if (!patch) {
    return existing;
  }

  const next = mergeSessionEntry(existing, patch);

  // Save
  await saveSessionEntry(next);

  return next;
}

export async function deleteSessionEntry(sessionKey: string): Promise<boolean> {
  await ensureConnected();

  if (!sessionsCollection) {
    throw new Error("MongoDB not connected");
  }

  invalidateSessionStoreCache(sessionKey);

  try {
    const result = await sessionsCollection.deleteOne({ sessionKey });
    return result.deletedCount > 0;
  } catch (error) {
    console.error(`Failed to delete session entry for key ${sessionKey}:`, error);
    return false;
  }
}

export async function recordSessionMetaFromInbound(params: {
  storePath: string;
  sessionKey: string;
  ctx: MsgContext;
  groupResolution?: import("./types.js").GroupKeyResolution | null;
  createIfMissing?: boolean;
}): Promise<SessionEntry | null> {
  const { storePath, sessionKey, ctx } = params;
  const createIfMissing = params.createIfMissing ?? true;

  return await updateSessionStore(storePath, async (store) => {
    const existing = store[sessionKey];
    const patch = deriveSessionMetaPatch({
      ctx,
      sessionKey,
      existing,
      groupResolution: params.groupResolution,
    });

    if (!patch) {
      return existing ?? null;
    }

    if (!existing && !createIfMissing) {
      return null;
    }

    const next = mergeSessionEntry(existing, patch);
    store[sessionKey] = next;
    return next;
  });
}

export async function updateLastRoute(params: {
  storePath: string;
  sessionKey: string;
  channel?: SessionEntry["lastChannel"];
  to?: string;
  accountId?: string;
  threadId?: string | number;
  deliveryContext?: DeliveryContext;
  ctx?: MsgContext;
  groupResolution?: import("./types.js").GroupKeyResolution | null;
}): Promise<SessionEntry | null> {
  const { storePath, sessionKey, channel, to, accountId, threadId, ctx } = params;

  await ensureConnected();
  if (!sessionsCollection) {
    throw new Error("MongoDB not connected");
  }

  // Load existing
  const doc = await sessionsCollection.findOne({ sessionKey });
  const existing = mongoDocToSessionEntry(doc);

  const now = Date.now();
  const explicitContext = normalizeDeliveryContext(params.deliveryContext);
  const inlineContext = normalizeDeliveryContext({
    channel,
    to,
    accountId,
    threadId,
  });
  const mergedInput = mergeDeliveryContext(explicitContext, inlineContext);
  const merged = mergeDeliveryContext(mergedInput, deliveryContextFromSession(existing));
  const normalized = normalizeSessionDeliveryFields({
    deliveryContext: {
      channel: merged?.channel,
      to: merged?.to,
      accountId: merged?.accountId,
      threadId: merged?.threadId,
    },
  });

  const metaPatch = ctx
    ? deriveSessionMetaPatch({
        ctx,
        sessionKey,
        existing,
        groupResolution: params.groupResolution,
      })
    : null;

  const basePatch: Partial<SessionEntry> = {
    updatedAt: Math.max(existing?.updatedAt ?? 0, now),
    deliveryContext: normalized.deliveryContext,
    lastChannel: normalized.lastChannel,
    lastTo: normalized.lastTo,
    lastAccountId: normalized.lastAccountId,
    lastThreadId: normalized.lastThreadId,
  };

  const next = mergeSessionEntry(
    existing,
    metaPatch ? { ...basePatch, ...metaPatch } : basePatch,
  );

  await saveSessionEntry(next);

  return next;
}

// ============================================================================
// Query Operations
// ============================================================================

export async function listSessions(params?: {
  channel?: string;
  limit?: number;
  activeSince?: number;
}): Promise<SessionEntry[]> {
  await ensureConnected();

  if (!sessionsCollection) {
    throw new Error("MongoDB not connected");
  }

  const filter: Record<string, unknown> = {};

  if (params?.channel) {
    filter.channel = params.channel;
  }

  if (params?.activeSince) {
    filter.updatedAt = { $gte: params.activeSince };
  }

  let cursor = sessionsCollection.find(filter).sort({ updatedAt: -1 });

  if (params?.limit) {
    cursor = cursor.limit(params.limit);
  }

  const docs = await cursor.toArray();
  return docs.map((doc) => mongoDocToSessionEntry(doc)).filter((e): e is SessionEntry => e !== null);
}

export async function getSessionCount(): Promise<number> {
  await ensureConnected();

  if (!sessionsCollection) {
    throw new Error("MongoDB not connected");
  }

  return await sessionsCollection.countDocuments();
}

// ============================================================================
// Test Utilities
// ============================================================================

export function clearSessionStoreCacheForTest(): void {
  SESSION_STORE_CACHE.clear();
}

export async function clearAllSessionsForTest(): Promise<void> {
  await ensureConnected();

  if (!sessionsCollection) {
    throw new Error("MongoDB not connected");
  }

  await sessionsCollection.deleteMany({});
  SESSION_STORE_CACHE.clear();
}

// ============================================================================
// Export getMongoDb for use by transcript module
// ============================================================================

export async function getMongoDb(): Promise<Db> {
  await ensureConnected();
  if (!mongoDb) {
    throw new Error("MongoDB not connected");
  }
  return mongoDb;
}
