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
  description: "Persists sessions to MongoDB with full context lifecycle",
  kind: "context-engine",

  register(api) {
    const log = api.logger;
    const config = api.pluginConfig as unknown as PluginConfig;

    let mongo: MongoClient | null = null;
    let db: Db | null = null;
    let col: Collection<SessionDoc> | null = null;

    async function ensureConnected() {
      if (db && col) return { db, col };

      log.info("[mongo-ce] connecting to MongoDB…");
      mongo = new MongoClient(config.mongoUri, {
        appName: "openclaw-mongo-context-engine",
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
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

    api.registerContextEngine("mongo-context-engine", () => ({
      get info() {
        return {
          id: "mongo-context-engine",
          name: "MongoDB Context Engine",
          version: "1.0.0",
          ownsCompaction: config.ownsCompaction ?? false,
        };
      },

      async bootstrap({ sessionId, sessionKey, sessionFile }: any) {
        const { col: c } = await ensureConnected();
        registerShutdown();
        log.info(`[mongo-ce] bootstrap session=${sessionId}`);

        const existing = await c.findOne({ _id: sessionId });
        if (existing) {
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

        if (messages.length > 0 || imported === 0) {
          await c.insertOne({
            _id: sessionId,
            sessionKey,
            messages,
            meta: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        return { bootstrapped: true, importedMessages: imported };
      },

      async ingest({ sessionId, sessionKey, message }: any) {
        const { col: c } = await ensureConnected();
        log.info(`[mongo-ce] ingest called: sessionId=${sessionId}, sessionKey=${sessionKey}`);
        const result = await c.updateOne(
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
        log.info(`[mongo-ce] ingest result: matched=${result.matchedCount}, modified=${result.modifiedCount}, upserted=${result.upsertedCount}`);
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
        return { ingestedCount: messages.length };
      },

      async afterTurn({ sessionId, sessionKey }: any) {
        const { col: c } = await ensureConnected();
        await c.updateOne(
          { _id: sessionId },
          {
            $set: {
              updatedAt: new Date(),
              "meta.lastTurnAt": new Date().toISOString(),
              ...(sessionKey ? { sessionKey } : {}),
            },
          },
        );
      },

      async assemble({ sessionId, messages }: any) {
        const { col: c } = await ensureConnected();
        log.info(`[mongo-ce] assemble called: sessionId=${sessionId}, incoming messages=${messages?.length}`);
        const doc = await c.findOne({ _id: sessionId });
        log.info(`[mongo-ce] assemble: doc found=${!!doc}, doc.messages=${doc?.messages?.length}`);
        const sourceMessages: any =
          doc?.messages?.length ? doc.messages : messages;
        const estimatedTokens = estimateTokens(sourceMessages);
        log.info(`[mongo-ce] assemble: returning ${sourceMessages?.length} messages, ${estimatedTokens} tokens`);
        return { messages: sourceMessages, estimatedTokens };
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
        const { col: c } = await ensureConnected();
        const fileMessages: ChatMessage[] = [];
        try {
          const data = readFileSync(sessionFile, "utf-8").trim();
          if (data) {
            fileMessages.push(
              ...data.split("\n").filter(Boolean).map((l) => JSON.parse(l) as ChatMessage),
            );
          }
        } catch {}

        if (fileMessages.length > 0) {
          await c.updateOne(
            { _id: sessionId },
            {
              $set: {
                messages: fileMessages,
                updatedAt: new Date(),
                ...(sessionKey ? { sessionKey } : {}),
              },
            },
          );
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
      },
    }));
  },
});