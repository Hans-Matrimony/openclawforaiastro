// Runs a second, isolated gateway with synthetic credentials and an in-process model.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { configureReadingGuard } from "./configure-reading-guard.mjs";

const plugin = process.argv[2];
if (!plugin) {
  throw new Error("Expected built reading plugin path");
}
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "reading-guard-smoke-"));
const reading =
  "Career progress looks gradual rather than sudden. Saturn supports steady effort and patience as you take on responsibility, while Mercury supports analytical work and clear communication with colleagues. These factors suggest focusing on work that rewards consistency and careful thinking.";
const calls = [];
const fakeModel = http.createServer(async (request, response) => {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
  }
  const payload = JSON.parse(body);
  const rewrite = payload.messages.some(
    (message) =>
      typeof message.content === "string" &&
      message.content.includes("Edit the supplied astrology draft"),
  );
  calls.push({ rewrite, toolCount: payload.tools?.length ?? 0, model: payload.model });
  const text = rewrite ? reading : reading + " Would you like more?";
  if (payload.stream) {
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    response.write(
      `data: ${JSON.stringify({ id: "synthetic", object: "chat.completion.chunk", model: "style-test", choices: [{ index: 0, delta: { role: "assistant", content: text }, finish_reason: null }] })}\n\n`,
    );
    response.write(
      `data: ${JSON.stringify({ id: "synthetic", object: "chat.completion.chunk", model: "style-test", choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } })}\n\n`,
    );
    response.end("data: [DONE]\n\n");
  } else {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        id: "synthetic",
        object: "chat.completion",
        model: "style-test",
        choices: [
          { index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      }),
    );
  }
});
await new Promise((resolve) => fakeModel.listen(0, "127.0.0.1", resolve));
const probe = net.createServer();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const state = path.join(directory, "state");
const workspace = path.join(directory, "workspace-astrologer");
fs.mkdirSync(state);
fs.mkdirSync(workspace);
fs.writeFileSync(
  path.join(workspace, "AGENTS.md"),
  "Answer the user's career question from the supplied synthetic model.\n",
);
let cfg = {
  gateway: {
    mode: "local",
    bind: "loopback",
    port,
    controlUi: { enabled: false },
    auth: { mode: "token", token: "synthetic-reading-test" },
    http: { endpoints: { chatCompletions: { enabled: true } } },
  },
  models: {
    providers: {
      deepseek: {
        baseUrl: `http://127.0.0.1:${fakeModel.address().port}/v1`,
        api: "openai-completions",
        apiKey: "synthetic-only",
        models: [
          {
            id: "style-test",
            name: "Synthetic",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 32000,
            maxTokens: 4096,
          },
        ],
      },
    },
  },
  agents: {
    defaults: { heartbeat: { every: "0m" } },
    list: [
      {
        id: "astrologer",
        default: true,
        workspace,
        model: { primary: "deepseek/style-test" },
        tools: { deny: ["*"] },
      },
      {
        id: "tarot_reader",
        workspace: path.join(directory, "workspace-tarot-reader"),
        model: { primary: "deepseek/style-test" },
        tools: { deny: ["*"] },
      },
    ],
  },
  plugins: { allow: ["astrologer-reading"], slots: { memory: "none" }, load: { paths: [] } },
  update: { checkOnStart: false },
  discovery: { mdns: { mode: "off" } },
  browser: { enabled: false },
  canvasHost: { enabled: false },
  cron: { enabled: false },
};
cfg = configureReadingGuard(cfg, { env: {} });
cfg.plugins.load.paths = [path.resolve(plugin)];
const configPath = path.join(directory, "config.json");
fs.writeFileSync(configPath, JSON.stringify(cfg), { mode: 0o600 });
const env = Object.fromEntries(
  Object.entries(process.env).filter(([name]) =>
    ["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP"].includes(name),
  ),
);
Object.assign(env, {
  HOME: directory,
  OPENCLAW_HOME: directory,
  OPENCLAW_STATE_DIR: state,
  OPENCLAW_CONFIG_PATH: configPath,
  OPENCLAW_NO_RESPAWN: "1",
  OPENCLAW_NODE_OPTIONS_READY: "1",
});
const entry =
  process.env.OPENCLAW_READING_VERIFY_ENTRY || "/usr/local/lib/node_modules/openclaw/dist/entry.js";
let logs = "";
const child = spawn(
  process.execPath,
  [entry, "gateway", "--port", String(port), "--bind", "loopback"],
  { env, cwd: directory, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
child.stdout.on("data", (chunk) => {
  logs += chunk;
});
child.stderr.on("data", (chunk) => {
  logs += chunk;
});
try {
  const deadline = Date.now() + 90000;
  let ready = false;
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      ready = (
        await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1000) })
      ).ok;
    } catch {}
    if (ready) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(ready, "Isolated gateway did not start: " + logs.slice(-6000));
  const response = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(60000),
    headers: {
      Authorization: "Bearer synthetic-reading-test",
      "Content-Type": "application/json",
      "x-openclaw-agent-id": "astrologer",
      "x-openclaw-scopes": "operator.write",
    },
    body: JSON.stringify({
      model: "openclaw",
      messages: [{ role: "user", content: "Career kaisa rahega?" }],
    }),
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(
    result.choices?.[0]?.message?.content,
    reading,
    JSON.stringify({ result, calls, logs: logs.slice(-3000) }),
  );
  assert.equal(calls.length, 2);
  assert.deepEqual(
    calls.map((call) => call.rewrite),
    [false, true],
  );
  assert.equal(calls[1].toolCount, 0);
  const sessionDir = path.join(state, "agents/astrologer/sessions");
  const transcripts = fs
    .readdirSync(sessionDir)
    .filter((name) => name.endsWith(".jsonl"))
    .flatMap((name) =>
      fs.readFileSync(path.join(sessionDir, name), "utf8").trim().split("\n").map(JSON.parse),
    );
  const last = transcripts.filter((row) => row.message?.role === "assistant").at(-1)?.message;
  assert.equal(
    last?.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n"),
    reading,
  );
  const streaming = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(60000),
    headers: {
      Authorization: "Bearer synthetic-reading-test",
      "Content-Type": "application/json",
      "x-openclaw-agent-id": "astrologer",
      "x-openclaw-scopes": "operator.write",
    },
    body: JSON.stringify({
      model: "openclaw",
      stream: true,
      messages: [{ role: "user", content: "Career kaisa rahega?" }],
    }),
  });
  assert.equal(streaming.status, 200);
  const events = await streaming.text();
  assert.ok(!events.includes("Would you like more?"), "Unreviewed draft reached the HTTP stream");
  const streamed = events
    .split("\n")
    .filter((line) => line.startsWith("data: {"))
    .map((line) => JSON.parse(line.slice(6)).choices?.[0]?.delta?.content ?? "")
    .join("");
  assert.equal(streamed, reading);
  const tarot = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(60000),
    headers: {
      Authorization: "Bearer synthetic-reading-test",
      "Content-Type": "application/json",
      "x-openclaw-agent-id": "tarot_reader",
      "x-openclaw-scopes": "operator.write",
    },
    body: JSON.stringify({
      model: "openclaw",
      messages: [{ role: "user", content: "Career kaisa rahega?" }],
    }),
  });
  assert.equal(tarot.status, 200);
  assert.equal(
    (await tarot.json()).choices?.[0]?.message?.content,
    reading + " Would you like more?",
  );
  assert.deepEqual(
    calls.map((call) => call.rewrite),
    [false, true, false, true, false],
  );
  console.log(
    JSON.stringify({
      status: "passed",
      pinnedGateway: true,
      modelCalls: calls.length,
      rewriteTools: 0,
      deliveredAndPersistedReviewedText: true,
      streamingDraftSuppressed: true,
      tarotUnchanged: true,
    }),
  );
} finally {
  child.kill("SIGTERM");
  const timer = setTimeout(() => child.kill("SIGKILL"), 3000);
  timer.unref();
  fakeModel.closeAllConnections();
  fakeModel.close();
  fs.writeFileSync(path.join(directory, "gateway.log"), logs);
}
