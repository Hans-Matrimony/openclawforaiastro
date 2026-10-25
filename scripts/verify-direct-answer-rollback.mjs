import { configureDirectAnswer } from "/app/scripts/configure-direct-answer.mjs";
// Run inside the disposable release image with --network none and no credentials.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "response-off-check-"));
const port = 19839;
const config = {
  gateway: {
    mode: "local",
    bind: "loopback",
    port,
    controlUi: { enabled: false },
    auth: { mode: "token", token: "synthetic-off-token" },
  },
  agents: {
    defaults: { heartbeat: { every: "0m" } },
    list: [
      { id: "astrologer", default: true, workspace: directory },
      { id: "tarot_reader", workspace: directory },
    ],
  },
  plugins: {
    allow: ["direct-answer"],
    slots: { memory: "none" },
    load: { paths: ["/app/extensions/direct-answer"] },
    entries: { "direct-answer": { enabled: true } },
  },
  update: { checkOnStart: false },
  discovery: { mdns: { mode: "off" } },
  browser: { enabled: false },
  canvasHost: { enabled: false },
  cron: { enabled: false },
};
const env = {
  PATH: process.env.PATH,
  HOME: directory,
  OPENCLAW_HOME: directory,
  OPENCLAW_STATE_DIR: path.join(directory, "state"),
  OPENCLAW_CONFIG_PATH: path.join(directory, "config.json"),
  OPENCLAW_NO_RESPAWN: "1",
  OPENCLAW_NODE_OPTIONS_READY: "1",
  ASTROFRIEND_DIRECT_MODE: "off",
  ASTROFRIEND_DIRECT_ENVIRONMENT: "production",
  // Stale development flags must never defeat the production rollback switch.
  VEDASTRO_DIRECT_DEV_ENABLED: "1",
  VEDASTRO_DIRECT_ENVIRONMENT: "development",
};
const disabled = configureDirectAnswer(config, env);
assert.deepEqual(disabled.agents, config.agents);
assert.deepEqual(disabled.gateway, config.gateway);
assert.equal(disabled.plugins.entries["direct-answer"].enabled, false);
fs.writeFileSync(env.OPENCLAW_CONFIG_PATH, JSON.stringify(disabled), { mode: 0o600 });
const child = spawn(
  process.execPath,
  ["/usr/local/lib/node_modules/openclaw/dist/entry.js", "gateway", "--port", String(port)],
  { env, stdio: ["ignore", "pipe", "pipe"] },
);
let logs = "";
let spawnError;
child.on("error", (error) => {
  spawnError = error;
});
for (const stream of [child.stdout, child.stderr])
  stream.on("data", (chunk) => {
    logs = (logs + chunk).slice(-6000);
  });
try {
  let healthy = false;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline && child.exitCode === null && !spawnError) {
    try {
      healthy = (
        await fetch(`http://127.0.0.1:${port}/health`, {
          signal: AbortSignal.timeout(1000),
        })
      ).ok;
    } catch {
      /* Wait for startup within the bounded deadline. */
    }
    if (healthy) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(healthy, spawnError?.message || logs);
  const response = await fetch(`http://127.0.0.1:${port}/astrofriend/direct-answer`, {
    method: "POST",
    headers: { Authorization: "Bearer synthetic-off-token", "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: "synthetic-release",
      query: "Hello",
      history: [],
      language: "english",
    }),
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.status, 404);
  console.log(
    "Packaged rollback passed: healthy gateway, unchanged agents/auth, direct route absent, no model or memory credentials.",
  );
} finally {
  if (child.exitCode === null && !spawnError) {
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill("SIGTERM");
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}
