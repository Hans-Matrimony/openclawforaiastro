import assert from "node:assert/strict";
import test from "node:test";
import { createBudgetRuntime } from "../extensions/inference-budget/runtime.mjs";

function fixture(message, agentId = "provider_selector", sink) {
  const reports = [];
  const runtime = createBudgetRuntime();
  runtime.setDiagnosticReporter(sink ?? ((event) => reports.push(event)));
  runtime.bind({ agentId, runId: "private-run", sessionId: "private-session" });
  const stream = () => ({
    result: async () => message,
    async *[Symbol.asyncIterator]() {
      yield message.stopReason === "error"
        ? { type: "error", error: message }
        : { type: "done", message };
    },
  });
  let provider = { api: "openai-completions", stream, streamSimple: stream };
  const sdk = {
    getApiProviders: () => [provider],
    getApiProvider: () => provider,
    registerApiProvider: (value) => {
      provider = value;
    },
  };
  runtime.installSdk(sdk);
  return {
    reports,
    response: provider.stream({ api: provider.api }, {}, { sessionId: "private-session" }),
  };
}

void test("length-limited stage records one content-free completion across stream and result", async () => {
  const message = {
    stopReason: "length",
    content: [{ text: "private incomplete JSON" }],
    usage: { input: 120, output: 2048, totalTokens: 2168 },
  };
  const { reports, response } = fixture(message);
  for await (const event of response) {
    assert.equal(event.message, message);
  }
  assert.equal(await response.result(), message);
  assert.equal(await response.result(), message);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].kind, "provider_completion");
  assert.equal(reports[0].stop_reason, "length");
  assert.equal(reports[0].output_tokens, 2048);
  assert.equal(reports[0].total_tokens, 2168);
  assert.ok(!JSON.stringify(reports).includes("private"));
});

void test("unknown provider reasons and malformed usage cannot leak strings", async () => {
  const message = {
    stopReason: "private exception",
    usage: { input: "secret", output: Infinity, totalTokens: -3 },
  };
  const { reports, response } = fixture(message, "provider_renderer");
  assert.equal(await response.result(), message);
  assert.equal(reports[0].stop_reason, "unknown");
  for (const key of ["input_tokens", "output_tokens", "total_tokens"]) {
    assert.equal(reports[0][key], -1);
  }
  assert.ok(!JSON.stringify(reports).includes("private"));
  assert.ok(!JSON.stringify(reports).includes("secret"));
});

void test("ordinary agents do not emit provider telemetry", async () => {
  const { reports, response } = fixture({ stopReason: "stop" }, "astrologer_pwa");
  await response.result();
  assert.deepEqual(reports, []);
});

void test("diagnostic sink failures preserve original error and completed messages", async () => {
  for (const stopReason of ["stop", "error"]) {
    const message = { stopReason };
    const { response } = fixture(message, "provider_renderer", () => {
      throw Error("sink unavailable");
    });
    for await (const event of response) {
      assert.equal(event.message ?? event.error, message);
    }
    assert.equal(await response.result(), message);
  }
});
