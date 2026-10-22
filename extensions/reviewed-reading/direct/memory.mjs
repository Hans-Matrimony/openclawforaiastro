import { uniqueMemory } from "./compact-prompt.mjs";

export function createMemory(userId, { env = process.env, fetchImpl = fetch, signal } = {}) {
  const url = new URL(env.MEM0_URL);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    !env.VEDASTRO_DIRECT_MEM0_DEV_HOST ||
    url.hostname !== env.VEDASTRO_DIRECT_MEM0_DEV_HOST
  ) {
    throw new Error("Development memory target required");
  }
  const headers = { "Content-Type": "application/json" };
  if (env.MEM0_API_KEY) {
    headers.Authorization = "Token " + env.MEM0_API_KEY;
  }
  let cached;
  let pending;
  let revision = 0;
  async function request(route, body) {
    const response = await fetchImpl(new URL(route, url), {
      method: body ? "POST" : "GET",
      headers,
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)].filter(Boolean)),
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      throw new Error("Memory unavailable");
    }
    const text = await response.text();
    if (Buffer.byteLength(text) > 65536) {
      throw new Error("Memory response too large");
    }
    return JSON.parse(text);
  }
  return {
    async read() {
      if (cached) {
        return cached;
      }
      if (pending) {
        return pending;
      }
      const version = revision;
      const read = (async () => {
        const body = await request("/memory/" + encodeURIComponent(userId) + "?limit=50");
        const rows = Array.isArray(body) ? body : (body.memories ?? body.results);
        if (!Array.isArray(rows)) {
          throw new Error("Invalid memory response");
        }
        const facts = uniqueMemory(
          rows
            .slice(0, 50)
            .map((row) =>
              typeof row === "string" ? row : (row?.memory ?? row?.content ?? row?.text),
            ),
        ).map((text) => text.slice(0, 2000));
        // A read started before a write must never repopulate the newer cache.
        if (revision === version) {
          cached = facts;
        }
        return facts;
      })();
      pending = read;
      try {
        return await read;
      } finally {
        if (pending === read) {
          pending = undefined;
        }
      }
    },
    async write(content) {
      if (typeof content !== "string" || !content.trim() || content.length > 12000) {
        throw new Error("Invalid memory content");
      }
      revision++;
      cached = undefined;
      pending = undefined;
      try {
        await request("/memory/add", {
          user_id: userId,
          content,
          metadata: { source: "vedastro_direct", environment: "development" },
        });
      } finally {
        revision++;
        cached = undefined;
        pending = undefined;
      }
      return { saved: true };
    },
  };
}
