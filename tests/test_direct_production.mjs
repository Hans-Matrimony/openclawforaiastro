import assert from "node:assert/strict";
import test from "node:test";
import { directReleaseEnabled } from "../extensions/reviewed-reading/direct/release.mjs";
import { generationSettings } from "../extensions/reviewed-reading/direct/generation.mjs";
import { configureDirectAnswer } from "../scripts/configure-direct-answer.mjs";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { createMemory } from "../extensions/reviewed-reading/direct/memory.mjs";

const production = {
  ASTROFRIEND_DIRECT_MODE: "production", ASTROFRIEND_DIRECT_ENVIRONMENT: "production",
  ASTROFRIEND_DIRECT_TEST_USERS: "pilot-only", ASTROFRIEND_DIRECT_MEM0_HOST: "memory.test",
  MEM0_URL: "https://memory.test", MEM0_API_KEY: "test", OPENROUTER_API_KEY: "test",
  VEDASTRO_DIRECT_FLOW: "source", VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "0", VEDASTRO_DIRECT_REPLY_CACHE: "0",
};

test("production promotion is explicit and reversible without an allowlist wildcard", () => {
  assert.equal(directReleaseEnabled(production), true);
  assert.equal(directReleaseEnabled(production, "ordinary-user"), true);
  assert.equal(directReleaseEnabled({ ...production, ASTROFRIEND_DIRECT_MODE: "pilot" }, "ordinary-user"), false);
  for (const mode of ["off", "all", "", "Production"]) {
    assert.equal(directReleaseEnabled({ ...production, ASTROFRIEND_DIRECT_MODE: mode }), false);
  }
  for (const environment of [undefined, "", "development", "staging"]) {
    assert.equal(directReleaseEnabled({ ...production, ASTROFRIEND_DIRECT_ENVIRONMENT: environment }), false);
  }
  for (const id of [null, "", "x/y", "x".repeat(129), 123]) {
    assert.equal(directReleaseEnabled(production, id), false);
  }
  const config = { agents: { list: [{ id: "astrologer" }, { id: "tarot_reader" }] } };
  const promoted = configureDirectAnswer(config, production);
  assert.deepEqual(promoted.agents, config.agents);
  assert.equal(promoted.plugins.entries["direct-answer"].enabled, true);
  assert.equal(configureDirectAnswer(promoted, { ASTROFRIEND_DIRECT_MODE: "off" }).plugins.entries["direct-answer"].enabled, false);
  assert.throws(() => configureDirectAnswer(config, { ...production, MEM0_URL: "http://memory.test" }));
});

test("production retains pilot sampling, provider failover and price ceiling", () => {
  for (const mode of ["source", "stable"]) {
    assert.deepEqual(generationSettings({ ...production, VEDASTRO_DIRECT_GENERATION_MODE: mode }),
      generationSettings({ ...production, ASTROFRIEND_DIRECT_MODE: "pilot", VEDASTRO_DIRECT_GENERATION_MODE: mode }));
  }
});

test("nonpilot production users reach the same Qwen model with their own memory identity", async () => {
  let memoryUrl;
  const memory = createMemory("ordinary-user", { env: production, fetchImpl: async (url) => {
    memoryUrl = String(url);
    return new Response(JSON.stringify({ memories: [] }));
  } });
  await memory.read();
  assert.equal(memoryUrl, "https://memory.test/memory/ordinary-user?limit=50");
  let request;
  const result = await directAnswer({ user_id: "ordinary-user", query: "Hello", history: [], language: "english", user_gender: "male" }, {
    env: production, makeMemory: () => ({ read: async () => [] }),
    makeTools: () => async () => assert.fail("No chart needed"),
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "Hello! How are you feeling today?" } }] }));
    },
  });
  assert.equal(request.model, "qwen/qwen3-next-80b-a3b-instruct");
  assert.equal(result.answer_model_calls, 1);
  assert.ok(result.reply.includes("Hello"));
});
