import assert from "node:assert/strict";
import test from "node:test";
import { sessionFileId } from "../extensions/inference-budget/pi-extension.mjs";
import { budgetDiagnostic, createBudgetRuntime } from "../extensions/inference-budget/runtime.mjs";

function fixture(now) {
  const sends = [],
    reports = [];
  const runtime = createBudgetRuntime({
    now,
    limits: { attempts: 1 },
    fetchImpl: async () => {
      sends.push(true);
      return new Response("ok");
    },
  });
  runtime.setDiagnosticReporter((event) => reports.push(event));
  const stream = () => {
    const result = runtime.transport
      .fetch("http://127.0.0.1/synthetic", {
        body: JSON.stringify({
          messages: [{ role: "user", content: "private synthetic text" }],
          max_tokens: 99,
        }),
      })
      .then(async (response) => ({
        role: "assistant",
        content: [{ type: "text", text: response.ok ? "ok" : "failure" }],
        stopReason: response.ok ? "stop" : "error",
      }));
    return {
      result: () => result,
      async *[Symbol.asyncIterator]() {
        const message = await result;
        yield message.stopReason === "error"
          ? { type: "error", error: message }
          : { type: "done", message };
      },
    };
  };
  const providers = new Map([
    ["openai-completions", { api: "openai-completions", stream, streamSimple: stream }],
  ]);
  const sdk = {
    getApiProviders: () => [...providers.values()],
    getApiProvider: (api) => providers.get(api),
    registerApiProvider: (provider) => providers.set(provider.api, provider),
  };
  const model = { id: "synthetic", api: "openai-completions", provider: "synthetic" };
  runtime.installSdk(sdk);
  const invoke = (options) => sdk.getApiProvider(model.api).streamSimple(model, {}, options);
  return { runtime, reports, sends, model, invoke };
}

void test("stop diagnostics bind the selected/current budgets without keys, text or raw IDs", async () => {
  const { runtime, reports, sends, model, invoke } = fixture();
  runtime.bind({ agentId: "astrologer_pwa", sessionId: "private-session", runId: "private-run" });
  runtime.bindModel(model, "private-session");
  await invoke({ sessionId: "private-session" }).result();
  const failed = invoke({ sessionId: "private-session" });
  for await (const event of failed) {
    assert.equal(event.type, "done");
  }
  const reply = await failed.result();
  assert.match(reply.content[0].text, /couldn’t finish/);
  assert.equal(reports.length, 1);
  assert.equal(sends.length, 1);
  assert.equal(reports[0].reason, "attempts");
  assert.equal(reports[0].selected_budget_is_current, true);
  assert.equal(reports[0].run_tag, reports[0].current_run_tag);
  const serialized = JSON.stringify(reports);
  for (const privateValue of [
    "private-session",
    "private-run",
    "private synthetic text",
    "synthetic",
  ]) {
    assert.ok(!serialized.includes(privateValue));
  }
});

void test("a stale model association is observable without changing fail-closed behavior", async () => {
  const { runtime, reports, model, invoke } = fixture();
  runtime.bind({ agentId: "astrologer_pwa", sessionId: "session", runId: "old-run" });
  runtime.bindModel(model, "session");
  await invoke({}).result();
  const pending = invoke({});
  runtime.bind({ agentId: "astrologer_pwa", sessionId: "session", runId: "new-run" });
  const response = await pending.result();
  assert.equal(response.stopReason, "error", "A stop cannot become a saved compaction summary");
  assert.equal(reports.length, 1);
  assert.notEqual(reports[0].run_tag, reports[0].current_run_tag);
  assert.equal(reports[0].selected_budget_is_current, false);
  assert.equal(reports[0].compaction, true);
});

void test("a fresh turn's SDK compaction uses the current session allowance", async () => {
  const { runtime, reports, sends, model, invoke } = fixture();
  const previous = runtime.bind({
    agentId: "astrologer_pwa",
    sessionId: "session",
    runId: "old-run",
  });
  runtime.bindModel(model, "session");
  await invoke({ sessionId: "session" }).result();
  const current = runtime.bind({
    agentId: "astrologer_pwa",
    sessionId: "session",
    runId: "new-run",
  });
  const compacted = await invoke({}).result();
  assert.equal(
    compacted.stopReason,
    "stop",
    "Old allowance exhaustion must not prevent a new owned turn",
  );
  assert.equal(previous.attempts, 1);
  assert.equal(current.attempts, 1);
  assert.equal(sends.length, 2);
  const exhausted = await invoke({ sessionId: "session" }).result();
  assert.match(exhausted.content[0].text, /couldn’t finish/);
  assert.equal(
    sends.length,
    2,
    "Compaction and the answer still share the unchanged current-run limit",
  );
  assert.equal(reports.length, 1);
  assert.equal(reports[0].selected_budget_is_current, true);
});

void test("a model shared across sessions still rejects anonymous compaction", async () => {
  const { runtime, sends, model, invoke } = fixture();
  runtime.bind({ agentId: "astrologer_pwa", sessionId: "session-a", runId: "run-a" });
  runtime.bind({ agentId: "astrologer_pwa", sessionId: "session-b", runId: "run-b" });
  runtime.bindModel(model, "session-a");
  runtime.bindModel(model, "session-b");
  assert.equal((await invoke({}).result()).stopReason, "error");
  assert.equal(sends.length, 0);
  assert.equal((await invoke({ sessionId: "session-a" }).result()).stopReason, "stop");
  assert.equal((await invoke({ sessionId: "session-b" }).result()).stopReason, "stop");
  assert.equal(sends.length, 2);
  assert.equal(runtime.forSession("session-a").attempts, 1);
  assert.equal(runtime.forSession("session-b").attempts, 1);
});

void test("expired run ownership cannot spend a stale model allowance", async () => {
  let time = 0;
  const { runtime, sends, model, invoke } = fixture(() => time);
  const previous = runtime.bind({
    agentId: "astrologer_pwa",
    sessionId: "old-session",
    runId: "old-run",
  });
  runtime.bindModel(model, "old-session");
  time = 3600001;
  runtime.bind({ agentId: "astrologer_pwa", sessionId: "new-session", runId: "new-run" });
  assert.equal(runtime.forSession("old-session"), undefined);
  assert.equal((await invoke({}).result()).stopReason, "error");
  assert.match(
    (await invoke({ sessionId: "old-session" }).result()).content[0].text,
    /couldn’t finish/,
  );
  assert.equal(sends.length, 0);
  assert.equal(previous.attempts, 0);
});

void test("a failed diagnostic sink cannot permit extra requests or corrupt the failure reply", async () => {
  const { runtime, sends, model, invoke } = fixture();
  runtime.setDiagnosticReporter(() => {
    throw new Error("diagnostic unavailable");
  });
  runtime.bind({ agentId: "astrologer_pwa", sessionId: "session", runId: "run" });
  runtime.bindModel(model, "session");
  await invoke({ sessionId: "session" }).result();
  const response = await invoke({ sessionId: "session" }).result();
  assert.match(response.content[0].text, /couldn’t finish/);
  assert.equal(sends.length, 1);
});

void test("unrecognized reasons cannot expose arbitrary exception details", () => {
  const event = budgetDiagnostic(
    {
      runId: "run",
      attempts: 0,
      bytes: 0,
      outputTokens: 0,
      blocked: true,
      reason: "private provider exception",
    },
    "session",
  );
  assert.equal(event.reason, "none");
  assert.match(event.run_tag, /^[a-f0-9]{16}$/);
});

void test("mismatched SDK/file owners are observable without reading files or logging paths", () => {
  const { runtime, reports } = fixture();
  runtime.bind({ agentId: "astrologer_pwa", sessionId: "file-owner", runId: "file-run" });
  runtime.reportSessionBinding("old-sdk-header", "file-owner");
  assert.equal(reports.length, 1);
  assert.equal(reports[0].kind, "session_binding_mismatch");
  assert.equal(reports[0].sdk_has_run_owner, false);
  assert.equal(reports[0].file_has_run_owner, true);
  for (const privateValue of ["file-owner", "file-run", "old-sdk-header"]) {
    assert.ok(!JSON.stringify(reports).includes(privateValue));
  }
  runtime.reportSessionBinding("file-owner", "file-owner");
  runtime.reportSessionBinding("file-owner", undefined);
  assert.equal(
    reports.length,
    1,
    "Ordinary matching or in-memory sessions need no additional logging",
  );
});

void test("session filename diagnostics accept stock shapes without guessing arbitrary IDs", () => {
  const id = "01234567-89ab-cdef-0123-456789abcdef";
  assert.equal(sessionFileId(id + ".jsonl"), id);
  assert.equal(sessionFileId("2026-10-12T00-00-00-000Z_" + id + ".jsonl"), id);
  assert.equal(sessionFileId(null), undefined);
  assert.equal(sessionFileId("private-person.txt"), undefined);
  assert.equal(sessionFileId("other-prefix-" + id + ".jsonl"), undefined);
});

void test("SDK stops remain observable without a gateway reporter and use a distinct runtime tag", async () => {
  const { runtime, model, invoke } = fixture();
  runtime.setDiagnosticReporter(undefined);
  const events = [],
    original = console.info;
  console.info = (value) => events.push(value);
  try {
    runtime.bind({
      agentId: "astrologer_pwa",
      sessionId: "private-sdk-session",
      runId: "private-sdk-run",
    });
    runtime.bindModel(model, "private-sdk-session");
    await invoke({ sessionId: "private-sdk-session" }).result();
    await invoke({ sessionId: "private-sdk-session" }).result();
    assert.equal(events.length, 1);
    const event = JSON.parse(events[0].replace(/^\[inference-budget-stop\] /, ""));
    assert.equal(event.runtime_tag, runtime.runtimeTag);
    assert.match(event.runtime_tag, /^[a-f0-9]{16}$/);
    assert.equal(event.reason, "attempts");
    assert.ok(!events[0].includes("private-sdk"));
    assert.notEqual(createBudgetRuntime().runtimeTag, runtime.runtimeTag);
  } finally {
    console.info = original;
  }
});
