import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { GUARDED_AGENTS, createBudgetRuntime } from "../extensions/inference-budget/runtime.mjs";
import { secureControlUi } from "../scripts/configure-control-ui.mjs";

const config = JSON.parse(fs.readFileSync(new URL("../openclaw.json", import.meta.url), "utf8"));
void test("control UI rejects wildcard, insecure and credential-bearing origins", () => {
  for (const origin of [
    "*",
    "https://*.example.com",
    "http://dev.example.com",
    "https://u:p@example.com",
    "https://example.com/path",
    "https://example.com/?token=x",
  ]) {
    assert.throws(() => secureControlUi(structuredClone(config), origin));
  }
  const ui = secureControlUi(
    structuredClone(config),
    "https://dev.example.com,https://dev.example.com/",
  ).gateway.controlUi;
  assert.equal(ui.allowInsecureAuth, false);
  assert.equal(ui.dangerouslyDisableDeviceAuth, false);
  assert.equal(ui.dangerouslyAllowHostHeaderOriginFallback, false);
  assert.deepEqual(ui.allowedOrigins, [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "https://dev.example.com",
  ]);
});
void test("PWA uses the same persona and capabilities without messaging tool schemas", () => {
  const regular = config.agents.list.find((a) => a.id === "astrologer");
  const pwa = config.agents.list.find((a) => a.id === "astrologer_pwa");
  assert.equal(pwa.workspace, regular.workspace);
  assert.deepEqual(pwa.skills, regular.skills);
  assert.deepEqual(pwa.model, regular.model);
  assert.equal(pwa.tools.profile, "minimal");
  assert.deepEqual(pwa.tools.alsoAllow, regular.tools.alsoAllow);
  assert.ok(GUARDED_AGENTS.has(pwa.id));
  const runtime = createBudgetRuntime();
  runtime.bind({ agentId: pwa.id, runId: "qa", sessionId: "qa" }, "[Language: english]");
  assert.ok(runtime.forSession("qa"));
  assert.ok(!config.bindings.some((b) => b.agentId === pwa.id));
});
void test("short tool index retains on-demand image and reference instructions", () => {
  const index = fs.readFileSync(
    new URL("../app/whatsapp-support/workspace-astrologer/TOOLS.md", import.meta.url),
    "utf8",
  );
  const full = fs.readFileSync(
    new URL("../app/whatsapp-support/workspace-astrologer/TOOL_REFERENCE.md", import.meta.url),
    "utf8",
  );
  assert.ok(index.length < full.length / 3);
  for (const marker of [
    "all nine",
    "IMAGE_URL:",
    "TOOL_REFERENCE.md",
    "--reading-topic",
    "mem0_client.py",
    "fetch_history.py",
  ]) {
    assert.ok(index.includes(marker));
  }
  assert.ok(full.includes("draw_kundli_traditional.py"));
});
