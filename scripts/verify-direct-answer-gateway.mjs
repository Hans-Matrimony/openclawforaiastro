// Isolated packaged-runtime smoke test. Synthetic identities and no paid APIs.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { sourceReading } from "../extensions/reviewed-reading/direct/source-engine.mjs";
import { configureDirectAnswer } from "./configure-direct-answer.mjs";

const natal = JSON.parse(
  (
    await sourceReading(
      "get_horoscope_predictions",
      {},
      {
        date: "2001-01-03",
        time: "05:00",
        location_name: "Delhi",
      },
    )
  ).content[0].text,
);
assert.equal(natal.engine, "local-sweph-v2");
assert.equal(natal.ashtakavarga.grand_total, 337);
assert.equal(natal.birth_chart.utc_time, "2001-01-02T23:30:00.000Z");
assert.ok(fs.existsSync("/app/.openclaw/skills/qdrant/qdrant_client.py"));

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "direct-release-smoke-"));
const probe = net.createServer();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const env = {
  PATH: process.env.PATH,
  HOME: directory,
  OPENCLAW_HOME: directory,
  OPENCLAW_STATE_DIR: path.join(directory, "state"),
  OPENCLAW_CONFIG_PATH: path.join(directory, "config.json"),
  OPENCLAW_NO_RESPAWN: "1",
  OPENCLAW_NODE_OPTIONS_READY: "1",
  ASTROFRIEND_DIRECT_MODE: "pilot",
  ASTROFRIEND_DIRECT_ENVIRONMENT: "staging",
  ASTROFRIEND_DIRECT_TEST_USERS: "synthetic-release",
  ASTROFRIEND_DIRECT_MEM0_HOST: "memory.invalid",
  MEM0_URL: "https://memory.invalid",
  MEM0_API_KEY: "synthetic",
  OPENROUTER_API_KEY: "synthetic",
  VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "1",
  VEDASTRO_DIRECT_REPLY_CACHE: "0",
};
// Intercept only the two synthetic external dependencies inside the test child.
const fixture = path.join(directory, "fixture.mjs");
fs.writeFileSync(
  fixture,
  `globalThis.fetch = async (url, options = {}) => {
 const address = String(url);
 if (address.startsWith('https://memory.invalid/')) return new Response(JSON.stringify({memories:[]}));
 if (address === 'https://openrouter.ai/api/v1/chat/completions') {
  const body = JSON.parse(options.body);
  const content = body.tools ? 'Hello, tell me what is on your mind.' : 'Aaj ka din kaisa raha?';
  return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content}}]}));
 }
 throw new Error('Unexpected network target in isolated smoke test');
};`,
);
const config = configureDirectAnswer(
  {
    gateway: {
      mode: "local",
      bind: "loopback",
      port,
      controlUi: { enabled: false },
      auth: { mode: "token", token: "synthetic-release-token" },
    },
    agents: {
      defaults: { heartbeat: { every: "0m" } },
      list: [{ id: "astrologer", default: true, workspace: directory }],
    },
    plugins: { allow: [], slots: { memory: "none" }, load: { paths: [] } },
    update: { checkOnStart: false },
    discovery: { mdns: { mode: "off" } },
    browser: { enabled: false },
    canvasHost: { enabled: false },
    cron: { enabled: false },
  },
  env,
);
fs.writeFileSync(env.OPENCLAW_CONFIG_PATH, JSON.stringify(config), { mode: 0o600 });
const child = spawn(
  process.execPath,
  [
    "--import",
    pathToFileURL(fixture).href,
    "/usr/local/lib/node_modules/openclaw/dist/entry.js",
    "gateway",
    "--port",
    String(port),
    "--bind",
    "loopback",
  ],
  { env, cwd: directory, stdio: ["ignore", "pipe", "pipe"] },
);
let logs = "";
child.stdout.on("data", (chunk) => {
  logs += chunk;
});
child.stderr.on("data", (chunk) => {
  logs += chunk;
});
try {
  let ready = false;
  const deadline = Date.now() + 90000;
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
  assert.ok(ready, "Gateway failed to start: " + logs.slice(-4000));
  const payload = {
    user_id: "synthetic-release",
    query: "Hello",
    history: [],
    birth: null,
    language: "english",
    user_gender: "male",
  };
  const post = (body, token = "synthetic-release-token") =>
    fetch(`http://127.0.0.1:${port}/astrofriend/direct-answer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  assert.equal((await post(payload, "")).status, 401);
  assert.equal((await post({ ...payload, user_id: "not-in-pilot" })).status, 400);
  const response = await post(payload);
  assert.equal(response.status, 200, "Pilot response failed: " + logs.slice(-4000));
  const result = await response.json();
  assert.equal(result.schema, "vedastro-direct-reply-v1");
  assert.ok(result.reply.includes("Hello"));
  assert.ok(result.answer_model_calls >= 1);
  if (process.env.PWA_DIRECT_ADAPTER) {
    execFileSync(
      "python3",
      [
        "-c",
        `
import asyncio, importlib.util, sys
spec = importlib.util.spec_from_file_location('release_adapter', sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
async def check():
    diagnostics = {}
    reply = await module.fetch_answer(sys.argv[2], {'Authorization':'Bearer synthetic-release-token'},
        'synthetic-release', 'Hello', [], {'gender':'male'}, 'english', diagnostics,
        quota_context='Finish the allowed question without promising another free reading.')
    assert 'Hello' in reply
    assert diagnostics['response_source'] == 'vedastro_direct'
    assert diagnostics['status'] == 'completed'
asyncio.run(check())
print('Release PWA adapter to packaged gateway: passed.')
`,
        process.env.PWA_DIRECT_ADAPTER,
        `http://127.0.0.1:${port}`,
      ],
      { stdio: "inherit" },
    );
  }
  console.log("Packaged direct plugin: auth, pilot rejection and synthetic reply passed.");
} finally {
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
  }
  fs.rmSync(directory, { recursive: true, force: true });
}
