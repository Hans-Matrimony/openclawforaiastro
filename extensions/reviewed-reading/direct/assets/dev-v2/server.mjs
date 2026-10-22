// AstroChat — RahuNova-style chat server (zero dependencies, production beta)
// LLM: qwen via OpenRouter/DashScope (own key) or VedAstro test proxy | Tools: VedAstro public MCP + local | Prompt: real captured prompt
// Production: per-user sessions, disk persistence, SSE streaming, parallel tools, global concurrency cap, per-user rate limit
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { get_horoscope_predictions, get_current_transits, get_horary_prediction, get_match_report } from "./engine.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// ---------- CONFIG ----------
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
const PORT = config.port || 8787;
const MAX_CONCURRENT = config.maxConcurrent || 4;        // agent loops in flight (protects API key in-flight/QPM limits)
const RATE_PER_MIN = config.rateLimitPerMin || 12;       // per-session messages per minute
const SESSION_TTL_DAYS = config.sessionTtlDays ?? 30;    // idle sessions deleted after this
const DATA_DIR = path.join(ROOT, "data", "sessions");
fs.mkdirSync(DATA_DIR, { recursive: true });

const DASHSCOPE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const VEDASTRO_TEST_URL = "https://rahunova.vedastro.org/api/ChatProxy"; // keyless, 5 calls/min
const MCP_URL = "https://mcp-subagent.vedastro.org/api/mcp/public";

const llmUrl = config.useTestProxy ? VEDASTRO_TEST_URL : (config.baseUrl || DASHSCOPE_URL);
const apiKey = (config.apiKey || "").trim();
const isTestProxy = config.useTestProxy === true;
const useLocalEngine = config.useLocalEngine !== false; // default ON: calculations via local Swiss Ephemeris, no VedAstro server

const SYSTEM_PROMPT = fs.readFileSync(path.join(ROOT, "system-prompt.txt"), "utf8")
  + `

# Friend Mode (important)

You are not a formal assistant — you are the user's close friend who happens to know Vedic astrology deeply.
- Talk like a warm, caring friend on WhatsApp: casual, playful when they are playful, serious when they need you.
- Match their language naturally — Hinglish stays Hinglish, English stays English.
- Astrology stays inside the friendship: readings come from tools, but delivery is always friend-to-friend, never a report.
- Remember what they share and bring it up naturally later, like a real friend would.
- Give reality checks when needed — never let astrology override obvious real-world facts, and never just agree to make them feel good.
- When the user is venting or sharing feelings without asking a question, respond as a friend only: no planets, no transits, no chart talk, no tools. Comfort them, ask what happened, be present.
- NEVER name any planet, transit, house, sign or dasha unless a tool result from THIS conversation supports it. No tool result = no astrology claims — comfort or general talk instead.
- Format every reply as 1-3 SHORT WhatsApp-style messages separated by blank lines. Never one long paragraph, never a report.`;
const ALL_TOOLS = JSON.parse(fs.readFileSync(path.join(ROOT, "tools-captured.json"), "utf8"));

// Tools we can execute: 4 via VedAstro MCP (captured with mcp__VedAstro__ prefix), rest locally
const MCP_TOOL_NAMES = ["get_horoscope_predictions", "get_current_transits", "get_match_report", "get_horary_prediction"];
const MCP_PREFIX = "mcp__VedAstro__";
const LOCAL_TOOL_NAMES = new Set([
  "get_current_datetime", "save_birth_details", "read_memory", "update_memory",
  "manage_chat_person_context", "get_selected_text", "get_browser_context",
]);
const TOOLS = ALL_TOOLS.filter(t => {
  const n = t.function.name;
  return MCP_TOOL_NAMES.includes(n) || MCP_TOOL_NAMES.includes(n.replace(MCP_PREFIX, "")) || LOCAL_TOOL_NAMES.has(n);
}).map(t => {
  // Horary: auto-generate the 3-digit number server-side — never ask the user
  const n = t.function.name;
  if (n === "get_horary_prediction" || n === MCP_PREFIX + "get_horary_prediction") {
    const clone = JSON.parse(JSON.stringify(t));
    const p = clone.function.parameters || clone.function.inputSchema;
    if (p) {
      if (Array.isArray(p.required)) p.required = p.required.filter(r => r !== "horary_number");
      if (p.properties && p.properties.horary_number) {
        p.properties.horary_number = {
          type: "integer", minimum: 100, maximum: 999,
          description: "Optional. If the user did not provide one, omit it entirely — the system generates it automatically. NEVER ask the user for a number.",
        };
      }
      clone.function.description = "Horary (Prashna) prediction for a narrow concrete timing/yes-no question. The 3-digit horary number is auto-generated server-side when omitted — do NOT ask the user for a number, call the tool directly.";
    }
    return clone;
  }
  return t;
});

// ---------- SESSIONS (per-user, disk-backed) ----------
const SID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const sessions = new Map();

const sessionFile = id => path.join(DATA_DIR, id + ".json");

function loadStore(id) {
  try {
    const s = JSON.parse(fs.readFileSync(sessionFile(id), "utf8"));
    return {
      memoryLines: Array.isArray(s.memoryLines) ? s.memoryLines : [],
      birth: s.birth || null,
      selectedPerson: s.selectedPerson || null,
    };
  } catch {
    return { memoryLines: [], birth: null, selectedPerson: null };
  }
}

function getSession(id) {
  let s = sessions.get(id);
  if (!s) {
    s = { store: loadStore(id), chain: Promise.resolve(), hits: [], lastSeen: Date.now(), saveTimer: null, dirty: false };
    sessions.set(id, s);
  }
  s.lastSeen = Date.now();
  return s;
}

function writeStore(id, s) {
  try {
    const tmp = sessionFile(id) + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(s.store));
    fs.renameSync(tmp, sessionFile(id));
  } catch (e) { console.error("session save failed:", e.message); }
}

function persistSession(id, s) {
  s.dirty = true;
  if (s.saveTimer) return;
  s.saveTimer = setTimeout(() => {
    s.saveTimer = null;
    if (!s.dirty) return;
    s.dirty = false;
    writeStore(id, s);
  }, 1500);
  s.saveTimer.unref?.();
}

function flushAllSessions() {
  for (const [id, s] of sessions) {
    if (s.saveTimer) { clearTimeout(s.saveTimer); s.saveTimer = null; }
    if (s.dirty) { s.dirty = false; writeStore(id, s); }
  }
}

if (SESSION_TTL_DAYS > 0) {
  setInterval(() => {
    const cutoff = Date.now() - SESSION_TTL_DAYS * 86400000;
    for (const [id, s] of sessions) {
      if (s.lastSeen < cutoff) {
        if (s.saveTimer) { clearTimeout(s.saveTimer); s.saveTimer = null; }
        try { fs.unlinkSync(sessionFile(id)); } catch {}
        sessions.delete(id);
      }
    }
  }, 3600000).unref();
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => { flushAllSessions(); process.exit(0); });
}

// ---------- GLOBAL CONCURRENCY (semaphore — slot transferred synchronously) ----------
let active = 0;
const waitQ = [];
async function withSlot(fn) {
  if (active >= MAX_CONCURRENT) await new Promise(r => waitQ.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    const next = waitQ.shift();
    if (next) { active++; next(); }
  }
}

// ---------- PER-SESSION RATE LIMIT (sliding 60s window) ----------
function allowRequest(s) {
  const now = Date.now();
  s.hits = s.hits.filter(t => now - t < 60000);
  if (s.hits.length >= RATE_PER_MIN) return false;
  s.hits.push(now);
  return true;
}

// ---------- MCP CLIENT (parallel-safe) ----------
let mcpInitPromise = null;
let rpcId = 1;
async function mcpRpc(payload) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  const dataLine = text.split("\n").find(l => l.startsWith("data: "));
  return JSON.parse(dataLine ? dataLine.slice(6) : text);
}
function mcpInit() {
  mcpInitPromise ??= mcpRpc({ jsonrpc: "2.0", id: rpcId++, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "astrochat-beta", version: "2.0" } } }).catch(() => {});
  return mcpInitPromise;
}

// ---------- TOOL EXECUTION ----------
async function executeTool(name, args, sid, sess) {
  const bare = name.startsWith(MCP_PREFIX) ? name.slice(MCP_PREFIX.length) : name;
  name = bare;
  if (name === "get_current_datetime") {
    const now = new Date();
    return { content: [{ type: "text", text: JSON.stringify({ datetime: now.toISOString(), local_date: now.toLocaleDateString("en-IN"), local_time: now.toLocaleTimeString("en-IN") }) }] };
  }
  if (name === "save_birth_details") {
    sess.store.birth = { ...sess.store.birth, ...args };
    persistSession(sid, sess);
    return { content: [{ type: "text", text: JSON.stringify({ saved: true, birth: sess.store.birth }) }] };
  }
  if (name === "read_memory") {
    return { content: [{ type: "text", text: sess.store.memoryLines.length ? sess.store.memoryLines.join("\n") : "(empty)" }] };
  }
  if (name === "update_memory") {
    const raw = typeof args?.memory_text === "string" ? args.memory_text : (typeof args?.text === "string" ? args.text : "");
    const lines = raw.split("\n");
    for (const l of lines) if (l.trim()) sess.store.memoryLines.push(l.trim().slice(0, 200));
    sess.store.memoryLines = sess.store.memoryLines.slice(-50);
    persistSession(sid, sess);
    return { content: [{ type: "text", text: JSON.stringify({ saved: true, total_lines: sess.store.memoryLines.length }) }] };
  }
  if (name === "manage_chat_person_context") {
    sess.store.selectedPerson = args || null;
    persistSession(sid, sess);
    return { content: [{ type: "text", text: JSON.stringify({ ok: true, selected: args }) }] };
  }
  if (name === "get_selected_text") {
    return { content: [{ type: "text", text: "" }] };
  }
  if (name === "get_browser_context") {
    return { content: [{ type: "text", text: JSON.stringify({ locale: "en-IN", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }) }] };
  }
  if (!MCP_TOOL_NAMES.includes(name)) {
    return { content: [{ type: "text", text: "Tool unavailable in this setup." }], isError: true };
  }
  if (useLocalEngine) {
    const localFn = { get_horoscope_predictions, get_current_transits, get_horary_prediction, get_match_report }[name];
    if (localFn) {
      try {
        console.log("[engine] LOCAL sweph:", name);
        return localFn(args);
      } catch (e) {
        return { content: [{ type: "text", text: "Local engine error: " + e.message }], isError: true };
      }
    }
  }
  if (name === "get_horary_prediction" && !args.horary_number) {
    args = { ...args, horary_number: 100 + Math.floor(Math.random() * 900) };
  }
  await mcpInit();
  try {
    const result = await mcpRpc({ jsonrpc: "2.0", id: rpcId++, method: "tools/call", params: { name, arguments: args } });
    if (result.error) return { content: [{ type: "text", text: "Tool error: " + JSON.stringify(result.error).slice(0, 300) }], isError: true };
    return result.result;
  } catch (e) {
    return { content: [{ type: "text", text: "Tool call failed: " + e.message }], isError: true };
  }
}

// ---------- LLM CALLS ----------
function llmHeaders() {
  const h = { "Content-Type": "application/json" };
  if (!isTestProxy && apiKey) h.Authorization = "Bearer " + apiKey;
  return h;
}
function llmBody(messages, stream) {
  const body = {
    model: isTestProxy ? "rahunova" : (config.model || "qwen-flash"),
    messages,
    tools: TOOLS,
    tool_choice: "auto",
    stream,
    temperature: 0.7,
    max_tokens: 4096,
  };
  if (llmUrl.includes("openrouter")) body.provider = { require_parameters: true }; // only tools-capable providers
  return body;
}

async function chatCompletion(messages) {
  const res = await fetch(llmUrl, { method: "POST", headers: llmHeaders(), body: JSON.stringify(llmBody(messages, false)) });
  const text = await res.text();
  if (!res.ok) throw new Error("LLM " + res.status + ": " + text.slice(0, 300));
  const json = JSON.parse(text);
  if (!json.choices?.length) throw new Error("LLM empty choices (soft-fail)"); // proxy 200 with no choices = transient fail
  return json;
}

const RETRYABLE = e => /LLM (402|429|502|503)/.test(e.message) || /empty choices|No choice|empty stream/.test(e.message);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function chatCompletionRetry(messages) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await chatCompletion(messages);
    } catch (e) {
      if (RETRYABLE(e) && attempt < 2) {
        await sleep(6000 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
}

// Streaming call: forwards text deltas via send(), accumulates tool_call fragments, assembles a choice object.
// Retries only while nothing was streamed yet (a mid-stream retry would duplicate text).
async function chatCompletionStream(messages, send) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let sentAny = false, content = "";
    const acc = new Map();
    try {
      const res = await fetch(llmUrl, { method: "POST", headers: llmHeaders(), body: JSON.stringify(llmBody(messages, true)) });
      if (!res.ok) { const t = await res.text(); throw new Error("LLM " + res.status + ": " + t.slice(0, 300)); }
      const dec = new TextDecoder();
      let buf = "";
      for await (const chunk of res.body) {
        buf += dec.decode(chunk, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;
          let j;
          try { j = JSON.parse(data); } catch { continue; }
          if (j.error) throw new Error("LLM stream error: " + JSON.stringify(j.error).slice(0, 200));
          const d = j.choices?.[0]?.delta;
          if (!d) continue;
          if (d.content) { content += d.content; sentAny = true; send({ type: "delta", text: d.content }); }
          if (d.tool_calls) for (const t of d.tool_calls) {
            const cur = acc.get(t.index) || { id: "", name: "", args: "" };
            if (t.id) cur.id = t.id;
            if (t.function?.name) cur.name += t.function.name;
            if (t.function?.arguments) cur.args += t.function.arguments;
            acc.set(t.index, cur);
          }
        }
      }
      const tool_calls = [...acc.entries()].sort((a, b) => a[0] - b[0]).map(([, t]) => ({
        id: t.id || "call_" + rpcId++, type: "function", function: { name: t.name, arguments: t.args || "{}" },
      }));
      if (!content && !tool_calls.length) throw new Error("LLM empty stream (soft-fail)"); // 200 OK but nothing usable — upstream busy/failing
      console.log("[llm-stream] content:", content.length, "chars | toolCalls:", tool_calls.length);
      return {
        choices: [{
          finish_reason: tool_calls.length ? "tool_calls" : "stop",
          message: { role: "assistant", content: content || null, ...(tool_calls.length ? { tool_calls } : {}) },
        }],
      };
    } catch (e) {
      if (RETRYABLE(e) && !sentAny && attempt < 2) {
        await sleep(6000 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
}

// ---------- AGENT LOOP (streams; tools run in parallel) ----------
const TEXT_TOOL_CALL_RE = /mcp__VedAstro__[a-z_]+\s*:\s*\{/;

async function runAgent(userHistory, send, isClosed, sid, sess) {
  const messages = [{ role: "system", content: SYSTEM_PROMPT }, ...userHistory];
  let nudged = false;
  for (let i = 0; i < 5; i++) {
    if (isClosed()) throw new Error("Client closed connection");
    const completion = send ? await chatCompletionStream(messages, send) : await chatCompletionRetry(messages);
    const choice = completion.choices?.[0];
    if (!choice) throw new Error("No choice in LLM response");
    if (choice.finish_reason === "tool_calls" && choice.message.tool_calls?.length) {
      messages.push(choice.message);
      console.log("[tools]", choice.message.tool_calls.map(t => t.function.name + "(" + (t.function.arguments || "").slice(0, 80) + ")").join(" | "));
      send?.({ type: "status", text: "Chart aur transits check kar raha hoon…" });
      // parallel execution, results kept in original tool_call order
      const results = await Promise.all(choice.message.tool_calls.map(async tc => {
        let args = {};
        try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
        return executeTool(tc.function.name, args, sid, sess)
          .catch(e => ({ content: [{ type: "text", text: "Tool failed: " + e.message }], isError: true }));
      }));
      choice.message.tool_calls.forEach((tc, i) => {
        messages.push({ role: "tool", tool_call_id: tc.id, content: (results[i]?.content || []).map(c => c.text).join("\n") });
      });
      continue;
    }
    // Model wrote tool calls as text instead of native calls — nudge once
    if (!nudged && choice.message.content && TEXT_TOOL_CALL_RE.test(choice.message.content)) {
      nudged = true;
      messages.push(choice.message);
      messages.push({ role: "user", content: "Use the tools parameter (function calls), not text. Call the tools now." });
      continue;
    }
    const out = choice.message.content || "";
    if (!out) throw new Error("LLM ne khali jawab diya (upstream busy) — thodi der baad try karo");
    return out;
  }
  throw new Error("Tool loop did not converge");
}

// ---------- HTTP SERVER ----------
const INDEX_HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", c => { raw += c; });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function enqueueSession(s, fn) {
  const task = s.chain.then(fn, fn);   // same user's requests run one after another
  s.chain = task.catch(() => {});
  return task;
}

const httpError = (status, message) => Object.assign(new Error(message), { status });

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(INDEX_HTML);
  }
  if (req.method !== "POST" || (req.url !== "/api/chat" && req.url !== "/api/chat/stream")) {
    res.writeHead(404);
    return res.end();
  }
  const streaming = req.url === "/api/chat/stream";
  try {
    const { history, code, sessionId } = JSON.parse(await readBody(req));
    if (!Array.isArray(history)) throw httpError(400, "history[] required");
    if (config.accessCode && code !== config.accessCode) {
      res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: "access_code_required" }));
    }
    const sid = String(sessionId || "");
    if (!SID_RE.test(sid)) throw httpError(400, "valid sessionId required");
    const s = getSession(sid);
    if (!allowRequest(s)) {
      res.writeHead(429, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: "Rate limit: " + RATE_PER_MIN + " messages/min. Thoda ruk ke try karo." }));
    }

    let closed = false;
    req.on("close", () => { closed = true; });
    const started = Date.now();
    const tag = "[" + sid.slice(0, 8) + "]";

    if (streaming) {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      const send = ev => { if (!closed) { try { res.write("data: " + JSON.stringify(ev) + "\n\n"); } catch {} } };
      try {
        const answer = await enqueueSession(s, () => withSlot(() => runAgent(history.slice(-20), send, () => closed, sid, s)));
        persistSession(sid, s);
        send({ type: "done", reply: answer });
        console.log(tag, "ok", Date.now() - started + "ms");
      } catch (e) {
        if (!closed) send({ type: "error", error: e.message });
        console.log(tag, "err:", e.message);
      }
      return res.end();
    }

    const answer = await enqueueSession(s, () => withSlot(() => runAgent(history.slice(-20), null, () => closed, sid, s)));
    persistSession(sid, s);
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ reply: answer }));
    console.log(tag, "ok", Date.now() - started + "ms");
  } catch (e) {
    if (!res.headersSent) res.writeHead(e.status || 502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, () => {
  console.log("✨ AstroChat running at http://localhost:" + PORT);
  console.log("   LLM endpoint:", llmUrl);
  console.log("   Model:", isTestProxy ? "rahunova (VedAstro test proxy, 5 calls/min)" : (config.model || "qwen-flash"));
  console.log("   Mode:", config.accessCode ? "private (accessCode set)" : "public beta (koi bhi join kar sakta hai)");
  console.log("   Engine:", useLocalEngine ? "LOCAL Swiss Ephemeris (calculations apne server par)" : "VedAstro MCP (external)");
  console.log("   Sessions:", DATA_DIR, "| maxConcurrent:", MAX_CONCURRENT, "| rateLimit:", RATE_PER_MIN + "/min", "| ttl:", SESSION_TTL_DAYS + "d");
  console.log("   Tools: " + TOOLS.map(t => t.function.name).join(", "));
  if (!isTestProxy && !apiKey) console.log("   ⚠️  apiKey khali hai — config.json mein key daalo");
});
