// Isolated image middleware smoke test: synthetic credentials, no channels/models.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createWriteStream, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const app = process.env.OPENCLAW_RESPONSE_VERIFY_APP_DIR || "/app";
const entry =
  process.env.OPENCLAW_RESPONSE_VERIFY_ENTRY ||
  "/usr/local/lib/node_modules/openclaw/dist/entry.js";
const directory = mkdtempSync(
  path.join(process.env.OPENCLAW_RESPONSE_VERIFY_TMPDIR || os.tmpdir(), "response-image-check-"),
);
const state = path.join(directory, "state");
mkdirSync(state);
const listener = net.createServer();
await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const token = "synthetic-image-smoke-only";
const config = path.join(directory, "config.json");
writeFileSync(
  config,
  JSON.stringify({
    gateway: {
      mode: "local",
      bind: "loopback",
      port,
      controlUi: { enabled: false },
      auth: { mode: "token", token },
      http: { endpoints: { responses: { enabled: true } } },
    },
    agents: {
      defaults: { workspace: path.join(directory, "workspace"), heartbeat: { every: "0m" } },
    },
    plugins: {
      allow: ["astrology-response"],
      slots: { memory: "none" },
      load: { paths: [path.join(app, "extensions", "astrology-response")] },
      entries: { "astrology-response": { enabled: true } },
    },
    update: { checkOnStart: false },
    discovery: { mdns: { mode: "off" } },
    browser: { enabled: false },
    canvasHost: { enabled: false },
    cron: { enabled: false },
  }),
);
const environment = Object.fromEntries(
  Object.entries(process.env).filter(([name]) =>
    ["PATH", "PATHEXT", "SystemRoot", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP"].includes(
      name,
    ),
  ),
);
Object.assign(environment, {
  OPENCLAW_HOME: directory,
  USERPROFILE: directory,
  HOME: directory,
  APPDATA: path.join(directory, "appdata"),
  LOCALAPPDATA: path.join(directory, "appdata"),
  OPENCLAW_STATE_DIR: state,
  OPENCLAW_CONFIG_PATH: config,
  OPENCLAW_NO_RESPAWN: "1",
  OPENCLAW_NODE_OPTIONS_READY: "1",
  ASTROFRIEND_RESPONSE_PYTHON:
    process.env.ASTROFRIEND_RESPONSE_PYTHON || "/opt/astrology-response-python/bin/python",
  ASTROFRIEND_RESPONSE_SKILL_DIR:
    process.env.ASTROFRIEND_RESPONSE_SKILL_DIR || "/app/astrology-response/kundli",
});
const log = createWriteStream(path.join(directory, "gateway.log"));
const child = spawn(
  process.execPath,
  [entry, "gateway", "--port", String(port), "--bind", "loopback"],
  { cwd: directory, env: environment, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
child.stdout.pipe(log, { end: false });
child.stderr.pipe(log, { end: false });
const finished = once(child, "exit");
const url = `http://127.0.0.1:${port}/astrofriend/response-evidence`;
const request = {
  dob: "2000-01-01",
  tob: "08:00",
  place: "Delhi",
  topic: "career",
  language: "english",
  subject_key: "a".repeat(64),
  profile_revision: "b".repeat(64),
  time_precision: "exact",
};
const headers = { Authorization: `Bearer ${token}`, "x-openclaw-scopes": "operator.write" };
const post = (body, auth) =>
  fetch(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: auth,
    signal: AbortSignal.timeout(12000),
  });
try {
  const deadline = Date.now() + 90000;
  let ready = false;
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      const response = await fetch(url, {
        method: "POST",
        body: "{}",
        signal: AbortSignal.timeout(500),
      });
      if (response.status === 401) {
        ready = true;
        break;
      }
    } catch {
      /* Gateway is still starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.equal(ready, true, "Isolated gateway did not start");
  assert.equal((await post(request)).status, 401);
  assert.equal(
    (await post(request, { Authorization: "Bearer incorrect-synthetic-token" })).status,
    401,
  );
  const success = await post(request, headers);
  assert.equal(success.status, 200);
  const evidence = await success.json();
  assert.equal(Object.keys(evidence.chart.positions).length, 9);
  assert.equal(evidence.model_calls, 0);
  assert.equal((await post({ ...request, topic: "health" }, headers)).status, 400);
  assert.equal((await post({ ...request, place: "unknown-synthetic-place" }, headers)).status, 422);
  console.log(
    JSON.stringify({
      status: "passed",
      unauthenticated: 401,
      invalid_token: 401,
      evidence: 200,
      invalid_body: 400,
      unresolved_birthplace: 422,
      model_calls: 0,
    }),
  );
} finally {
  child.kill();
  await Promise.race([finished, new Promise((resolve) => setTimeout(resolve, 5000))]);
  log.end();
}
