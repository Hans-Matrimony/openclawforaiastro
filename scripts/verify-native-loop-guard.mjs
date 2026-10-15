import assert from "node:assert/strict";
import fs from "node:fs";
const dist = "/usr/local/lib/node_modules/openclaw/dist";
const file = fs
  .readdirSync(dist)
  .find(
    (name) =>
      /^config-[\w-]+\.js$/.test(name) &&
      fs.readFileSync(dist + "/" + name, "utf8").includes("validateConfigObjectRawWithPlugins"),
  );
assert(file, "Pinned runtime configuration validator");
const { validateConfigObjectRaw } = await import(dist + "/" + file);
const config = JSON.parse(fs.readFileSync("/app/openclaw.json", "utf8"));
const result = validateConfigObjectRaw(config);
assert(result.ok, JSON.stringify(result.issues));
const guard = result.config.agents.list.find((a) => a.id === "astrologer").tools.loopDetection;
assert.equal(guard.enabled, true);
assert.equal(guard.warningThreshold, 10);
assert.equal(guard.criticalThreshold, 20);
assert.equal(guard.globalCircuitBreakerThreshold, 30);
console.log(
  JSON.stringify({
    status: "passed",
    pinned_runtime_config_schema: "passed",
    scoped_astrologer_loop_detection: guard,
  }),
);
const loopFile = fs
  .readdirSync(dist)
  .find((name) => name.startsWith("pi-tools.before-tool-call.runtime-"));
const { beforeToolCallRuntime: loop } = await import(dist + "/" + loopFile);
function record(state, toolName, params, n, text) {
  const id = "synthetic-" + n;
  loop.recordToolCall(state, toolName, params, id, guard);
  loop.recordToolCallOutcome(state, {
    toolName,
    toolParams: params,
    toolCallId: id,
    result: { content: [{ type: "text", text }] },
    config: guard,
  });
}
const params = { action: "poll", sessionId: "synthetic-only" };
const stuck = {};
for (let i = 0; i < 10; i++) {
  record(stuck, "process", params, i, "no new output");
}
assert.equal(loop.detectToolCallLoop(stuck, "process", params, guard).level, "warning");
for (let i = 10; i < 20; i++) {
  record(stuck, "process", params, i, "no new output");
}
assert.equal(loop.detectToolCallLoop(stuck, "process", params, guard).level, "critical");
const progress = {};
for (let i = 0; i < 35; i++) {
  record(progress, "process", params, i, "Completed step " + i);
  assert.equal(loop.detectToolCallLoop(progress, "process", params, guard).stuck, false);
}
const changed = {};
for (let i = 0; i < 35; i++) {
  record(changed, "exec", { command: "synthetic-step-" + i }, i, "checked " + i);
  assert.equal(
    loop.detectToolCallLoop(changed, "exec", { command: "synthetic-step-" + (i + 1) }, guard).stuck,
    false,
  );
}
const repeated = {};
for (let i = 0; i < 30; i++) {
  record(repeated, "exec", { command: "synthetic-static" }, i, "same failure");
}
assert.equal(
  loop.detectToolCallLoop(repeated, "exec", { command: "synthetic-static" }, guard).detector,
  "global_circuit_breaker",
);
assert.equal(
  loop.detectToolCallLoop(
    repeated,
    "exec",
    { command: "synthetic-static" },
    { ...guard, enabled: false },
  ).stuck,
  false,
);
const changingResults = {};
for (let i = 0; i < 35; i++) {
  record(changingResults, "exec", { command: "synthetic-progress" }, i, "new result " + i);
  // Native genericRepeat can warn on identical arguments even with progress;
  // it must never escalate these changing outcomes to a critical block.
  assert.notEqual(
    loop.detectToolCallLoop(changingResults, "exec", { command: "synthetic-progress" }, guard)
      .level,
    "critical",
  );
}
console.log(
  JSON.stringify({
    native_loop_detector: "passed",
    stuck_poll: "critical_after_20",
    progressing_polls: 35,
    distinct_exec_calls: 35,
    identical_progressing_exec: "warnings_only",
    identical_no_progress_exec: "circuit_breaker_after_30",
    disabled_mode: "inert",
  }),
);
