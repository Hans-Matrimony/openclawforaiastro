import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import plugin from "../extensions/astrology-response/index.ts";
import {
  calculateEvidence,
  createEvidenceHandler,
  reservedSubjects,
  validateEvidenceRequest,
} from "../extensions/astrology-response/route.mjs";

const request = {
  dob: "1995-01-01",
  tob: "06:00",
  place: "Delhi",
  topic: "career",
  language: "english",
  subject_key: "a".repeat(64),
  profile_revision: "b".repeat(64),
  time_precision: "exact",
};

void test("new route authenticates without registering hooks or touching current agents", () => {
  const routes = [];
  plugin.register({
    config: {},
    registerHttpRoute: (r) => routes.push(r),
    on: () => assert.fail("Global hook"),
  });
  assert.equal(routes.length, 1);
  assert.equal(routes[0].auth, "gateway");
  assert.equal(routes[0].path, "/astrofriend/response-evidence");
  const config = JSON.parse(readFileSync(new URL("../openclaw.json", import.meta.url)));
  assert.equal(config.plugins.entries["astrology-response"].enabled, false);
  assert.deepEqual(config.agents.list.find((a) => a.id === "astrology_response_writer").tools, {
    deny: ["*"],
  });
  assert.equal(
    config.agents.list.find((a) => a.id === "astrologer").model.primary,
    config.agents.list.find((a) => a.id === "astrology_response_writer").model.primary,
  );
});

void test("reserved Tarot identities come from gateway bindings", () => {
  const id = "999999999999";
  const reserved = reservedSubjects({
    bindings: [{ agentId: "tarot_reader", match: { peer: { id: "+" + id } } }],
  });
  assert.throws(() =>
    validateEvidenceRequest(
      { ...request, subject_key: createHash("sha256").update(id).digest("hex") },
      reserved,
    ),
  );
  assert.deepEqual(validateEvidenceRequest(request), request);
  for (const bad of [
    { ...request, language: "hindi" },
    { ...request, topic: "health" },
    { ...request, scope: "event_prediction" },
    { ...request, command: "extra" },
    { ...request, time_precision: "unknown" },
  ]) {
    assert.throws(() => validateEvidenceRequest(bad));
  }
});

void test("calculator gets structured stdin and no shell-interpolated birth data", async () => {
  let received;
  const run = (file, args, options, callback) => {
    assert.equal(args.length, 1);
    assert.equal(options.shell, undefined);
    assert.equal(options.timeout, 8000);
    assert.equal(options.env.SE_EPHE_PATH, "");
    return {
      stdin: {
        on() {},
        end(value) {
          received = JSON.parse(value);
          callback(
            null,
            JSON.stringify({
              schema: "astrology-evidence-v1",
              model_calls: 0,
              model_tokens: 0,
              subject_key: request.subject_key,
              profile_revision: request.profile_revision,
            }),
          );
        },
      },
    };
  };
  await calculateEvidence(request, run);
  assert.deepEqual(received, request);
});

void test("HTTP handler bounds request size and rejects unsupported fields", async () => {
  let calls = 0;
  const server = http.createServer(
    createEvidenceHandler(async (value) => {
      calls++;
      return { topic: value.topic };
    }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  try {
    assert.equal((await fetch(url)).status, 405);
    assert.equal(
      (await fetch(url, { method: "POST", body: JSON.stringify({ ...request, topic: "health" }) }))
        .status,
      400,
    );
    assert.equal((await fetch(url, { method: "POST", body: "x".repeat(5000) })).status, 413);
    const response = await fetch(url, { method: "POST", body: JSON.stringify(request) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { topic: "career" });
    assert.equal(calls, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

void test("PWA copy of the contract and its rule dependencies retain parity", () => {
  for (const name of [
    "response_contract.py",
    "response_calculations.py",
    "topic_rules.py",
    "separation_rules.py",
  ]) {
    const read = (url) => readFileSync(url, "utf8").replace(/\r\n/g, "\n");
    assert.equal(
      read(new URL(`../skills/kundli/${name}`, import.meta.url)),
      read(new URL(`../../AstroFriend_pwa/backend/app/services/${name}`, import.meta.url)),
    );
  }
});

void test("tracked legacy agent, channel, model and gateway configuration retains baseline parity", () => {
  const directory = fileURLToPath(new URL("../", import.meta.url));
  const original = JSON.parse(
    // Pin the deployed baseline so this regression also runs after committing.
    execFileSync("git", ["show", "30effb5d99704a2ffa6acd57cfc007875b448d01:openclaw.json"], {
      cwd: directory,
      encoding: "utf8",
      windowsHide: true,
    }),
  );
  const current = JSON.parse(readFileSync(new URL("../openclaw.json", import.meta.url)));
  assert.deepEqual(current.agents.defaults, original.agents.defaults);
  const legacyAgents = structuredClone(
    current.agents.list.filter((a) => a.id !== "astrology_response_writer"),
  );
  const astrologer = legacyAgents.find((a) => a.id === "astrologer");
  const guard = astrologer.tools.loopDetection;
  assert.equal(guard.enabled, true);
  assert.ok(guard.warningThreshold < guard.criticalThreshold);
  assert.ok(guard.criticalThreshold < guard.globalCircuitBreakerThreshold);
  assert.ok(guard.globalCircuitBreakerThreshold <= guard.historySize);
  delete astrologer.tools.loopDetection;
  assert.deepEqual(legacyAgents, original.agents.list);
  for (const key of [
    "bindings",
    "models",
    "channels",
    "tools",
    "gateway",
    "session",
    "skills",
    "env",
    "cron",
    "auth",
  ]) {
    assert.deepEqual(current[key], original[key]);
  }
  for (const [id, entry] of Object.entries(original.plugins.entries)) {
    assert.deepEqual(current.plugins.entries[id], entry);
  }
});

void test("startup toggles the route on and off while retaining existing agent scheduling", () => {
  const config = JSON.parse(readFileSync(new URL("../openclaw.json", import.meta.url)));
  const originalAgents = structuredClone(config.agents);
  const writer = config.agents.list.find((a) => a.id === "astrology_response_writer");
  // With no per-agent heartbeat overrides, the scheduler runs only the default
  // first agent. Adding a writer heartbeat would change legacy scheduling.
  assert.equal(
    config.agents.list.some((a) => a.heartbeat),
    false,
  );
  assert.notEqual(config.agents.list[0].id, writer.id);
  const source = readFileSync(
    new URL("../scripts/start-openclaw-gateway.sh", import.meta.url),
    "utf8",
  );
  const block = source.match(/<<'NODE'\r?\n([\s\S]*?)\r?\nNODE/)[1];
  const directory = mkdtempSync(path.join(os.tmpdir(), "astrology-response-test-"));
  const file = path.join(directory, "config.json");
  try {
    writeFileSync(file, JSON.stringify(config));
    for (const value of ["true", "false", "true", ""]) {
      execFileSync(process.execPath, ["-", file], {
        input: block,
        env: { ...process.env, ASTROFRIEND_ASTROLOGY_RESPONSE_ROUTES_ENABLED: value },
        windowsHide: true,
      });
      const current = JSON.parse(readFileSync(file));
      assert.equal(current.plugins.entries["astrology-response"].enabled, value === "true");
      assert.deepEqual(current.agents, originalAgents);
      assert.deepEqual(current.bindings, config.bindings);
    }
  } finally {
    unlinkSync(file);
    rmdirSync(directory);
  }
});

void test(
  "real child-process JSON evidence contract",
  { skip: !process.env.ASTROFRIEND_RESPONSE_PYTHON },
  async () => {
    const result = await calculateEvidence(request);
    assert.equal(result.topic, request.topic);
    assert.equal(result.language, request.language);
    assert.equal(Object.keys(result.chart.positions).length, 9);
    assert.equal(result.birth.timezone, "Asia/Kolkata");
    assert.equal(result.model_calls, 0);
    assert.equal(result.allowed_claims.length, 3);
    assert.equal(result.calculations.divisional_charts.D10.division, 10);
    assert.equal(result.calculations.periods.event_timing, "not_evaluated");
  },
);
