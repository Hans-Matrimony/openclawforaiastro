import assert from "node:assert/strict";
import test from "node:test";
import { configureReadingGuard } from "../scripts/configure-reading-guard.mjs";

function fixture() {
  return {
    models: {
      providers: {
        deepseek: {
          api: "openai-completions",
          baseUrl: "https://example.invalid",
          apiKey: "${DEEPSEEK_API_KEY}",
          models: [{ id: "test" }],
        },
        zai: { api: "openai-completions", models: [{ id: "glm-5" }] },
      },
    },
    agents: {
      defaults: { models: { "deepseek/test": { params: { temperature: 0.3 } } } },
      list: [
        { id: "astrologer", model: { primary: "deepseek/test", fallbacks: ["zai/glm-5"] } },
        { id: "tarot_reader", model: { primary: "deepseek/test" } },
        { id: "astrology_response_writer", model: { primary: "deepseek/test" } },
      ],
    },
    plugins: { allow: ["existing"], load: { paths: ["/app/extensions/existing"] } },
  };
}
void test("scopes primary and fallback aliases, retaining credentials and model options", () => {
  const original = fixture();
  const cfg = configureReadingGuard(original, { env: { ZAI_API_KEY: "synthetic" } });
  assert.equal(cfg.agents.list[0].model.primary, "astrofriend-reading-deepseek/test");
  assert.deepEqual(cfg.agents.list[0].model.fallbacks, ["astrofriend-reading-zai/glm-5"]);
  assert.deepEqual(cfg.agents.list.slice(1), original.agents.list.slice(1));
  assert.equal(cfg.models.providers["astrofriend-reading-deepseek"].apiKey, "${DEEPSEEK_API_KEY}");
  assert.equal(cfg.models.providers["astrofriend-reading-zai"].apiKey, "${ZAI_API_KEY}");
  assert.deepEqual(
    cfg.agents.defaults.models["astrofriend-reading-deepseek/test"],
    original.agents.defaults.models["deepseek/test"],
  );
  assert.equal(original.agents.list[0].model.primary, "deepseek/test");
  assert.ok(!JSON.stringify(cfg).includes("synthetic"));
});
void test("repeated startup is idempotent and disabling restores original model routing", () => {
  const original = fixture();
  const options = { env: { ZAI_API_KEY: "synthetic" } };
  const once = configureReadingGuard(original, options);
  assert.deepEqual(configureReadingGuard(once, options), once);
  const disabled = configureReadingGuard(once, { enabled: false });
  assert.deepEqual(disabled.agents, original.agents);
  assert.deepEqual(disabled.models, original.models);
  assert.equal(disabled.plugins.entries["astrologer-reading"].enabled, false);
});
void test("missing auth mapping fails before mutating the supplied configuration", () => {
  const cfg = fixture();
  assert.throws(() => configureReadingGuard(cfg, { env: {} }), /configured API key/);
  assert.deepEqual(cfg, fixture());
});
