import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { configureProviderRender } from "./configure-provider-render.mjs";
import { validateBudgetConfig } from "./validate-inference-budget.mjs";
import { GUARDED_AGENTS } from "../extensions/inference-budget/runtime.mjs";

const base = JSON.parse(fs.readFileSync(new URL("../openclaw.json", import.meta.url), "utf8"));
const env = {
  VEDASTRO_GROUPED_RENDER_DEV_ENABLED: "1",
  VEDASTRO_SUMMARY_DEV_ENABLED: "1",
  VEDASTRO_SUMMARY_ENVIRONMENT: "development",
};

void test("disabled and production do not add agents", () => {
  assert.deepEqual(configureProviderRender(base), base);
  assert.deepEqual(
    configureProviderRender(base, { ...env, VEDASTRO_SUMMARY_ENVIRONMENT: "production" }),
    base,
  );
});
void test("dev adds isolated tool-denied agents without changing existing agents", () => {
  const configured = configureProviderRender(base, env);
  assert.deepEqual(configured.agents.list.slice(0, base.agents.list.length), base.agents.list);
  for (const agent of configured.agents.list.slice(-2)) {
    assert.deepEqual(agent.tools, { deny: ["*"] });
    assert.deepEqual(agent.skills, []);
    assert.deepEqual(agent.model.fallbacks, []);
  }
  assert.deepEqual(configureProviderRender(configured, env), configured);
  assert.equal(
    base.agents.list.some((agent) => agent.id === "provider_selector"),
    false,
  );
});
void test("disabling removes stale stage agents", () => {
  const disabled = configureProviderRender(configureProviderRender(base, env), {});
  assert.deepEqual(disabled.agents.list, base.agents.list);
});

void test("both stage models are covered by startup transport and runtime budget guards", () => {
  const configured = configureProviderRender(base, env);
  assert.doesNotThrow(() => validateBudgetConfig(configured));
  for (const id of ["provider_selector", "provider_renderer"]) {
    assert.ok(GUARDED_AGENTS.has(id));
  }
  configured.models.providers.openrouter.models.find(
    (model) => model.id === "google/gemini-3.8-flash",
  ).api = "unverified";
  assert.throws(() => validateBudgetConfig(configured), /transport/);
});
