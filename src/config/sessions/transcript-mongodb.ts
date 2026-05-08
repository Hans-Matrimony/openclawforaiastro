/**
 * MongoDB Session Transcript Storage
 * Stores session message history in MongoDB
 */

import { Collection, Db } from "mongodb";
import { CURRENT_SESSION_VERSION, SessionManager } from "@mariozechner/pi-coding-agent";
import type { SessionEntry } from "./types.js";
import { emitSessionTranscriptUpdate } from "../../sessions/transcript-events.js";
import { getMongoDb as getSessionMongoDb } from "./store-mongodb.js";
import { loadSessionEntry } from "./store-mongodb.js";

// ============================================================================
// Types
// ============================================================================

interface MongoDBTranscriptEntry {
  _id?: string;
  sessionId: string;
  sessionKey: string;
  version: number;
  timestamp: string;
  cwd: string;
  messages: Array<{
    role: string;
    content: Array<{ type: string; text?: string; data?: string }>;
    api: string;
    provider: string;
    model: string;
    usage: {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
      totalTokens: number;
      cost: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
        total: number;
      };
    };
    stopReason: string;
    timestamp: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

let transcriptsCollection: Collection<MongoDBTranscriptEntry> | null = null;

// ============================================================================
// Collection Management
// ============================================================================

async function ensureTranscriptsCollection(): Promise<Collection<MongoDBTranscriptEntry>> {
  if (transcriptsCollection) {
    return transcriptsCollection;
  }

  const db = await getSessionMongoDb();
  const collectionName =
    process.env.OPENCLAW_MONGODB_TRANSCRIPTS_COLLECTION || "session_transcripts";

  transcriptsCollection = db.collection<MongoDBTranscriptEntry>(collectionName);

  // Create indexes
  await transcriptsCollection.createIndex({ sessionKey: 1 }, { unique: true });
  await transcriptsCollection.createIndex({ sessionId: 1 });
  await transcriptsCollection.createIndex({ updatedAt: -1 });

  return transcriptsCollection;
}

async function getSessionMongoDb(): Promise<Db> {
  const { getMongoDb } = await import("./store-mongodb.js");
  return getMongoDb();
}

// ============================================================================
// Export getMongoDb from store-mongodb
// ============================================================================

export async function getMongoDb(): Promise<Db> {
  const db = await getSessionMongoDb();

  // Initialize transcripts collection if not already done
  await ensureTranscriptsCollection();

  return db;
}

// ============================================================================
// Transcript Operations
// ============================================================================

function stripQuery(value: string): string {
  const noHash = value.split("#")[0] ?? value;
  return noHash.split("?")[0] ?? noHash;
}

function extractFileNameFromMediaUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const cleaned = stripQuery(trimmed);
  try {
    const parsed = new URL(cleaned);
    const base = (parsed as { pathname?: string }).pathname
      ? require("node:path").basename((parsed as { pathname: string }).pathname)
      : "";
    if (!base) {
      return null;
    }
    try {
      return decodeURIComponent(base);
    } catch {
      return base;
    }
  } catch {
    const path = await import("node:path");
    const base = path.basename(cleaned);
    if (!base || base === "/" || base === ".") {
      return null;
    }
    return base;
  }
}

export function resolveMirroredTranscriptText(params: {
  text?: string;
  mediaUrls?: string[];
}): string | null {
  const mediaUrls = params.mediaUrls?.filter((url) => url && url.trim()) ?? [];
  if (mediaUrls.length > 0) {
    const names = mediaUrls
      .map((url) => extractFileNameFromMediaUrl(url))
      .filter((name): name is string => Boolean(name && name.trim()));
    if (names.length > 0) {
      return names.join(", ");
    }
    return "media";
  }

  const text = params.text ?? "";
  const trimmed = text.trim();
  return trimmed ? trimmed : null;
}

async function loadTranscriptFromMongo(
  sessionId: string,
  sessionKey: string,
): Promise<MongoDBTranscriptEntry | null> {
  const collection = await ensureTranscriptsCollection();

  const doc = await collection.findOne({ sessionKey });
  return doc;
}

async function saveTranscriptToMongo(
  sessionId: string,
  sessionKey: string,
  messages: MongoDBTranscriptEntry["messages"],
): Promise<void> {
  const collection = await ensureTranscriptsCollection();

  const now = new Date();

  await collection.updateOne(
    { sessionKey },
    {
      $set: {
        sessionId,
        sessionKey,
        version: CURRENT_SESSION_VERSION,
        timestamp: new Date().toISOString(),
        cwd: process.cwd(),
        messages,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );

  // Emit update event
  emitSessionTranscriptUpdate(sessionKey);
}

export async function getSessionTranscript(sessionKey: string): Promise<string | null> {
  const collection = await ensureTranscriptsCollection();

  const doc = await collection.findOne({ sessionKey });

  if (!doc) {
    return null;
  }

  // Format as JSONL (similar to filesystem format)
  const lines: string[] = [];

  // Header
  const header = {
    type: "session",
    version: doc.version,
    id: doc.sessionId,
    timestamp: doc.timestamp,
    cwd: doc.cwd,
  };
  lines.push(JSON.stringify(header));

  // Messages
  for (const msg of doc.messages) {
    lines.push(JSON.stringify(msg));
  }

  return lines.join("\n");
}

export async function appendAssistantMessageToSessionTranscript(params: {
  agentId?: string;
  sessionKey: string;
  text?: string;
  mediaUrls?: string[];
  storePath?: string;
}): Promise<{ ok: true; sessionFile: string } | { ok: false; reason: string }> {
  const sessionKey = params.sessionKey.trim();
  if (!sessionKey) {
    return { ok: false, reason: "missing sessionKey" };
  }

  const mirrorText = resolveMirroredTranscriptText({
    text: params.text,
    mediaUrls: params.mediaUrls,
  });
  if (!mirrorText) {
    return { ok: false, reason: "empty text" };
  }

  const entry = await loadSessionEntry(sessionKey);
  if (!entry?.sessionId) {
    return { ok: false, reason: `unknown sessionKey: ${sessionKey}` };
  }

  // Load existing transcript
  const existing = await loadTranscriptFromMongo(entry.sessionId, sessionKey);

  const newMessage = {
    role: "assistant",
    content: [{ type: "text", text: mirrorText }],
    api: "openai-responses",
    provider: "openclaw",
    model: "delivery-mirror",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0,
      },
    },
    stopReason: "stop",
    timestamp: Date.now(),
  };

  const messages = existing?.messages ?? [];
  messages.push(newMessage);

  await saveTranscriptToMongo(entry.sessionId, sessionKey, messages);

  emitSessionTranscriptUpdate(sessionKey);

  return { ok: true, sessionFile: `mongodb:${sessionKey}` };
}

// ============================================================================
// Bulk Operations
// ============================================================================

export async function deleteSessionTranscript(sessionKey: string): Promise<boolean> {
  const collection = await ensureTranscriptsCollection();

  const result = await collection.deleteOne({ sessionKey });

  return result.deletedCount > 0;
}

export async function listTranscripts(params?: {
  limit?: number;
  before?: Date;
}): Promise<Array<{ sessionKey: string; sessionId: string; messageCount: number }>> {
  const collection = await ensureTranscriptsCollection();

  const filter: Record<string, unknown> = {};

  if (params?.before) {
    filter.updatedAt = { $lt: params.before };
  }

  let cursor = collection.find(filter, {
    projection: {
      sessionKey: 1,
      sessionId: 1,
      messages: 1,
    },
  }).sort({ updatedAt: -1 });

  if (params?.limit) {
    cursor = cursor.limit(params.limit);
  }

  const docs = await cursor.toArray();

  return docs.map((doc) => ({
    sessionKey: doc.sessionKey,
    sessionId: doc.sessionId,
    messageCount: doc.messages?.length ?? 0,
  }));
}

// ============================================================================
// Cleanup
// ============================================================================

export async function clearTranscriptsCollectionForTest(): Promise<void> {
  const collection = await ensureTranscriptsCollection();
  await collection.deleteMany({});
}
