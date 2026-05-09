import {
  definePluginEntry,
  delegateCompactionToRuntime,
} from "openclaw/plugin-sdk/core";
import { MongoClient, type Db, type Collection, type Document } from "mongodb";
import { readFileSync } from "node:fs";

interface PluginConfig {
  mongoUri: string;
  database?: string;
  collection?: string;
  ownsCompaction?: boolean;
  cacheSize?: number; // Max sessions to cache in memory
  maintainEveryNTurns?: number; // Only sync every N turns
}

interface ChatMessage {
  role?: string;
  type?: string;
  content?: string | unknown[];
  [key: string]: unknown;
}

interface SessionDoc extends Document {
  _id: string;
  sessionKey?: string;
  messages: ChatMessage[];
  meta: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  compactionState?: {
    summary?: string;
    firstKeptEntryId?: string;
    tokensBefore?: number;
    tokensAfter?: number;
  };
}

// Simple in-memory cache
interface CachedSession {
  messages: ChatMessage[];
  lastTurnAt: number;
  turnsSinceMaintain: number;
  messageCountAtLastMaintain: number;
}

function estimateTokens(msgs: ChatMessage[]): number {
  let chars = 0;
  for (const m of msgs) {
    if (typeof m.content === "string") {
      chars += m.content.length;
    } else if (Array.isArray(m.content)) {
      for (const part of m.content) {
        if (typeof part === "object" && part !== null && "text" in part) {
          chars += (part as { text: string }).text.length;
        }
      }
    }
  }
  return Math.ceil(chars / 4);
}

export default definePluginEntry({
  id: "mongo-context-engine",
  name: "MongoDB Context Engine",
  description: "Persists sessions to MongoDB with full context lifecycle (optimized)",
  kind: "context-engine",

  register(api) {
    const log = api.logger;
    const config = api.pluginConfig as unknown as PluginConfig;

    // Optimized config defaults
    const cacheSize = config.cacheSize ?? 50;
    const maintainEveryNTurns = config.maintainEveryNTurns ?? 3;

    let mongo: MongoClient | null = null;
    let db: Db | null = null;
    let col: Collection<SessionDoc> | null = null;

    // In-memory cache for sessions
    const sessionCache = new Map<string, CachedSession>();
    // Track which sessions are in MongoDB (bootstrapped)
    const sessionsInMongo = new Set<string>();
    // Queue for background writes
    const pendingWrites = new Map<string, ChatMessage[]>();

    async function ensureConnected() {
      if (db && col) return { db, col };

      log.info("[mongo-ce] connecting to MongoDB…");
      mongo = new MongoClient(config.mongoUri, {
        appName: "openclaw-mongo-context-engine",
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000,
        maxPoolSize: 10,
        minPoolSize: 2,
      });
      await mongo.connect();

      db = mongo.db(config.database ?? "openclaw_sessions");
      col = db.collection<SessionDoc>(config.collection ?? "sessions");

      await col.createIndex({ updatedAt: -1 });
      await col.createIndex({ createdAt: -1 });
      await col.createIndex({ sessionKey: 1 }, { sparse: true });

      log.info("[mongo-ce] connected");
      return { db, col };
    }

    function registerShutdown() {
      const cleanup = async () => {
        if (mongo) {
          await mongo.close().catch(() => {});
          mongo = null;
          db = null;
          col = null;
          log.info("[mongo-ce] disconnected");
        }
        process.off("SIGTERM", cleanup);
        process.off("SIGINT", cleanup);
      };
      process.on("SIGTERM", cleanup);
      process.on("SIGINT", cleanup);
    }

    // Evict oldest cache entries when size limit is reached
    function evictIfNeeded() {
      if (sessionCache.size <= cacheSize) return;
      const entries = Array.from(sessionCache.entries());
      // Sort by lastTurnAt (oldest first)
      entries.sort((a, b) => a[1].lastTurnAt - b[1].lastTurnAt);
      // Remove oldest 10% of entries
      const toRemove = Math.ceil(cacheSize * 0.1);
      for (let i = 0; i < toRemove; i++) {
        sessionCache.delete(entries[i][0]);
      }
    }

    // Background sync without blocking
    function backgroundSync(sessionId: string, messages: ChatMessage[], sessionKey?: string) {
      // Don't queue if already pending
      if (pendingWrites.has(sessionId)) {
        pendingWrites.set(sessionId, messages);
        return;
      }
      pendingWrites.set(sessionId, messages);

      // Schedule async write (don't await)
      ensureConnected().then(({ col: c }) => {
        const msgsToWrite = pendingWrites.get(sessionId);
        if (msgsToWrite && c) {
          c.updateOne(
            { _id: sessionId },
            {
              $set: {
                messages: msgsToWrite,
                updatedAt: new Date(),
                ...(sessionKey ? { sessionKey } : {}),
              },
            },
            { upsert: true },
          ).catch((err) => log.warn(`[mongo-ce] background sync error: ${err}`))
            .finally(() => pendingWrites.delete(sessionId));
        }
      }).catch(() => {});
    }

    api.registerContextEngine("mongo-context-engine", () => ({
      get info() {
        return {
          id: "mongo-context-engine",
          name: "MongoDB Context Engine (Optimized)",
          version: "1.1.0",
          ownsCompaction: config.ownsCompaction ?? false,
        };
      },

      async bootstrap({ sessionId, sessionKey, sessionFile }: any) {
        const { col: c } = await ensureConnected();
        registerShutdown();
        log.info(`[mongo-ce] bootstrap session=${sessionId}`);

        const existing = await c.findOne({ _id: sessionId });
        if (existing) {
          sessionsInMongo.add(sessionId);
          sessionCache.set(sessionId, {
            messages: existing.messages,
            lastTurnAt: Date.now(),
            turnsSinceMaintain: 0,
            messageCountAtLastMaintain: existing.messages.length,
          });
          log.info(`[mongo-ce] bootstrap: restored ${existing.messages.length} msgs from Mongo`);
          return { bootstrapped: false, reason: "already exists in Mongo" };
        }

        let imported = 0;
        let messages: ChatMessage[] = [];
        try {
          const data = readFileSync(sessionFile, "utf-8").trim();
          if (data) {
            messages = data
              .split("\n")
              .filter(Boolean)
              .map((line) => JSON.parse(line) as ChatMessage);
            imported = messages.length;
          }
        } catch (err: unknown) {
          if (
            err && typeof err === "object" && "code" in (err as any) &&
            (err as any).code !== "ENOENT"
          ) {
            log.warn(`[mongo-ce] bootstrap read error: ${err}`);
          }
        }

        if (messages.length > 0) {
          await c.insertOne({
            _id: sessionId,
            sessionKey,
            messages,
            meta: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          sessionsInMongo.add(sessionId);
        }

        sessionCache.set(sessionId, {
          messages,
          lastTurnAt: Date.now(),
          turnsSinceMaintain: 0,
          messageCountAtLastMaintain: messages.length,
        });

        if (imported > 0) {
          log.info(`[mongo-ce] bootstrapped ${imported} messages from file`);
        }
        return { bootstrapped: true, importedMessages: imported };
      },

      async ingest({ sessionId, sessionKey, message }: any) {
        const { col: c } = await ensureConnected();
        await c.updateOne(
          { _id: sessionId },
          {
            $push: { messages: message } as any,
            $set: {
              updatedAt: new Date(),
              ...(sessionKey ? { sessionKey } : {}),
            },
            $setOnInsert: { createdAt: new Date(), meta: {} },
          },
          { upsert: true },
        );
        // Invalidate cache
        sessionCache.delete(sessionId);
        return { ingested: true };
      },

      async ingestBatch({ sessionId, sessionKey, messages }: any) {
        const { col: c } = await ensureConnected();
        await c.updateOne(
          { _id: sessionId },
          {
            $push: { messages: { $each: messages } } as any,
            $set: {
              updatedAt: new Date(),
              ...(sessionKey ? { sessionKey } : {}),
            },
            $setOnInsert: { createdAt: new Date(), meta: {} },
          },
          { upsert: true },
        );
        sessionCache.delete(sessionId);
        return { ingestedCount: messages.length };
      },

      async afterTurn({ sessionId, sessionKey, messages }: any) {
        const startTime = Date.now();

        // OPTIMIZATION: Skip MongoDB write for new/unbootstrapped sessions
        // maintain() will handle them when they have data
        if (!sessionsInMongo.has(sessionId) && (!messages || messages.length <= 2)) {
          log.info(`[mongo-ce] afterTurn: skipping new session (not in Mongo yet)`);
          return;
        }

        // OPTIMIZATION: Update cache in memory, defer MongoDB write
        evictIfNeeded();
        sessionCache.set(sessionId, {
          messages: messages ?? [],
          lastTurnAt: Date.now(),
          turnsSinceMaintain: (sessionCache.get(sessionId)?.turnsSinceMaintain ?? 0) + 1,
          messageCountAtLastMaintain: sessionCache.get(sessionId)?.messageCountAtLastMaintain ?? 0,
        });

        // Mark session as being in MongoDB
        sessionsInMongo.add(sessionId);

        // OPTIMIZATION: Fire-and-forget timestamp update (non-blocking)
        ensureConnected().then(({ col: c }) => {
          c.updateOne(
            { _id: sessionId },
            {
              $set: {
                updatedAt: new Date(),
                "meta.lastTurnAt": new Date().toISOString(),
                ...(sessionKey ? { sessionKey } : {}),
              },
            },
          ).catch(() => {}); // Ignore errors in fire-and-forget
        }).catch(() => {});

        log.info(`[mongo-ce] afterTurn: ${messages?.length ?? 0} msgs in ${Date.now() - startTime}ms (cached)`);
      },

      async assemble({ sessionId, messages }: any) {
        const startTime = Date.now();

        // OPTIMIZATION: Check cache first
        const cached = sessionCache.get(sessionId);
        if (cached && cached.messages.length > 0) {
          log.info(`[mongo-ce] assemble: cache hit (${cached.messages.length} msgs) in ${Date.now() - startTime}ms`);
          return {
            messages: cached.messages,
            estimatedTokens: estimateTokens(cached.messages),
          };
        }

        // OPTIMIZATION: Only query MongoDB if we know the session exists there
        if (!sessionsInMongo.has(sessionId)) {
          log.info(`[mongo-ce] assemble: session not in Mongo, using file messages (${messages?.length ?? 0})`);
          return {
            messages: messages ?? [],
            estimatedTokens: estimateTokens(messages ?? []),
          };
        }

        // Fallback to MongoDB read
        const { col: c } = await ensureConnected();
        const doc = await c.findOne({ _id: sessionId });

        if (doc?.messages?.length) {
          // Cache the result
          evictIfNeeded();
          sessionCache.set(sessionId, {
            messages: doc.messages,
            lastTurnAt: Date.now(),
            turnsSinceMaintain: 0,
            messageCountAtLastMaintain: doc.messages.length,
          });
          log.info(`[mongo-ce] assemble: Mongo hit (${doc.messages.length} msgs) in ${Date.now() - startTime}ms`);
          return {
            messages: doc.messages,
            estimatedTokens: estimateTokens(doc.messages),
          };
        }

        log.info(`[mongo-ce] assemble: no data, using file messages (${messages?.length ?? 0})`);
        return {
          messages: messages ?? [],
          estimatedTokens: estimateTokens(messages ?? []),
        };
      },

      async compact(params: any) {
        if (config.ownsCompaction) {
          const { col: c } = await ensureConnected();
          const { sessionId, tokenBudget, force } = params;

          const doc = await c.findOne({ _id: sessionId });
          if (!doc) {
            return { ok: false, compacted: false, reason: "session not found" };
          }

          const tokens = estimateTokens(doc.messages);
          const threshold = tokenBudget ?? 128_000;

          if (!force && tokens <= threshold) {
            return {
              ok: true,
              compacted: false,
              reason: `within budget (${tokens} ≤ ${threshold})`,
              result: { tokensBefore: tokens },
            };
          }

          const kept: ChatMessage[] = [];
          let keptTokens = 0;
          const systemMsgs: ChatMessage[] = [];
          const otherMsgs: ChatMessage[] = [];

          for (const m of doc.messages) {
            if (m.role === "system") systemMsgs.push(m);
            else otherMsgs.push(m);
          }

          for (const m of [...otherMsgs].reverse()) {
            const t = estimateTokens([m]);
            if (keptTokens + t <= threshold) {
              kept.unshift(m);
              keptTokens += t;
            } else break;
          }

          const tokensBefore = tokens;
          const compactedMessages = [
            ...systemMsgs,
            {
              role: "user",
              content: `[Earlier messages compacted — ${tokensBefore} tokens → summary]`,
            },
            ...kept,
          ];
          const tokensAfter = estimateTokens(compactedMessages);

          await c.updateOne(
            { _id: sessionId },
            {
              $set: {
                messages: compactedMessages,
                updatedAt: new Date(),
                compactionState: {
                  tokensBefore,
                  tokensAfter,
                  summary: `compacted ${tokensBefore} → ${tokensAfter} tokens`,
                  firstKeptEntryId: (kept[0] as any)?.id,
                },
              },
            },
          );

          // Update cache
          sessionCache.set(sessionId, {
            messages: compactedMessages,
            lastTurnAt: Date.now(),
            turnsSinceMaintain: 0,
            messageCountAtLastMaintain: compactedMessages.length,
          });

          return {
            ok: true,
            compacted: true,
            reason: `compacted ${tokensBefore} → ${tokensAfter} tokens`,
            result: { tokensBefore, tokensAfter, summary: "tail-keep compaction" },
          };
        }

        return delegateCompactionToRuntime(params as any);
      },

      async maintain({ sessionId, sessionKey, sessionFile }: any) {
        const startTime = Date.now();

        // OPTIMIZATION: Check if we need to sync (throttling)
        const cached = sessionCache.get(sessionId);
        const shouldSync = !cached ||
          cached.turnsSinceMaintain >= maintainEveryNTurns ||
          cached.messageCountAtLastMaintain === 0;

        if (!shouldSync) {
          log.info(`[mongo-ce] maintain: throttled (turn ${cached?.turnsSinceMaintain}/${maintainEveryNTurns})`);
          return { changed: false, bytesFreed: 0, rewrittenEntries: 0 };
        }

        const { col: c } = await ensureConnected();
        const fileMessages: ChatMessage[] = [];
        try {
          const data = readFileSync(sessionFile, "utf-8").trim();
          if (data) {
            fileMessages.push(
              ...data.split("\n").filter(Boolean).map((l) => JSON.parse(l) as ChatMessage),
            );
          }
        } catch (err: unknown) {
          if (
            err && typeof err === "object" && "code" in (err as any) &&
            (err as any).code !== "ENOENT"
          ) {
            log.warn(`[mongo-ce] maintain read error: ${err}`);
          }
        }

        if (fileMessages.length > 0) {
          const result = await c.updateOne(
            { _id: sessionId },
            {
              $set: {
                messages: fileMessages,
                updatedAt: new Date(),
                ...(sessionKey ? { sessionKey } : {}),
              },
            },
            { upsert: true },
          );

          // Update cache and reset counter
          sessionsInMongo.add(sessionId);
          evictIfNeeded();
          sessionCache.set(sessionId, {
            messages: fileMessages,
            lastTurnAt: Date.now(),
            turnsSinceMaintain: 0,
            messageCountAtLastMaintain: fileMessages.length,
          });

          log.info(`[mongo-ce] maintain: synced ${fileMessages.length} msgs in ${Date.now() - startTime}ms`);
        } else {
          // Reset counter even if no new messages
          if (cached) {
            cached.turnsSinceMaintain = 0;
          }
        }

        return { changed: true, bytesFreed: 0, rewrittenEntries: 0 };
      },

      async dispose() {
        if (mongo) {
          await mongo.close().catch(() => {});
          mongo = null;
          db = null;
          col = null;
        }
        sessionCache.clear();
        sessionsInMongo.clear();
        pendingWrites.clear();
      },
    }));
  },
});
