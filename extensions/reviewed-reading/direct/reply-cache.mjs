import { createHash } from "node:crypto";

export function createReplyCache({ maxEntries = 100, ttlMs = 60000, now = Date.now } = {}) {
  const entries = new Map();
  function key(userId, body) {
    const ids = new Map();
    let next = 0;
    const messages = body.messages.map((message) => {
      if (message.tool_calls) {
        return {
          ...message,
          tool_calls: message.tool_calls.map((call) => {
            const id = `tool-${next++}`;
            ids.set(call.id, id);
            return { ...call, id };
          }),
        };
      }
      return message.tool_call_id
        ? { ...message, tool_call_id: ids.get(message.tool_call_id) ?? message.tool_call_id }
        : message;
    });
    return createHash("sha256")
      .update(JSON.stringify([userId, { ...body, messages }]))
      .digest("hex");
  }
  return {
    get(userId, body) {
      const id = key(userId, body);
      const entry = entries.get(id);
      if (!entry) {
        return null;
      }
      if (entry.expires <= now()) {
        entries.delete(id);
        return null;
      }
      entries.delete(id);
      entries.set(id, entry);
      return {
        id: null,
        usage: { prompt_tokens: 0, completion_tokens: 0, cost: 0 },
        choices: [{ finish_reason: "stop", message: { role: "assistant", content: entry.reply } }],
        cached: true,
      };
    },
    put(userId, body, completion) {
      const choice = completion.choices?.[0];
      if (
        !body.messages.some((message) => message.role === "tool") ||
        choice?.finish_reason !== "stop" ||
        typeof choice.message?.content !== "string" ||
        !choice.message.content.trim() ||
        choice.message.content.length > 32000
      ) {
        return;
      }
      const id = key(userId, body);
      if ((entries.get(id)?.expires ?? 0) > now()) {
        return;
      }
      entries.delete(id);
      for (const [oldId, entry] of entries) {
        if (entry.expires <= now()) {
          entries.delete(oldId);
        }
      }
      while (entries.size >= maxEntries) {
        entries.delete(entries.keys().next().value);
      }
      entries.set(id, { reply: choice.message.content, expires: now() + ttlMs });
    },
  };
}

export const directReplyCache = createReplyCache();
