import assert from "node:assert/strict";
import { test } from "node:test";
import { validateDirectInput } from "../extensions/reviewed-reading/direct-route.mjs";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { readingContext } from "../extensions/reviewed-reading/direct/context.mjs";
import { createMemory } from "../extensions/reviewed-reading/direct/memory.mjs";
import { directReleaseEnabled } from "../extensions/reviewed-reading/direct/release.mjs";
import { configureDirectAnswer } from "../scripts/configure-direct-answer.mjs";

const pilot = {
  ASTROFRIEND_DIRECT_MODE: "pilot",
  ASTROFRIEND_DIRECT_ENVIRONMENT: "production",
  ASTROFRIEND_DIRECT_TEST_USERS: "synthetic-a,synthetic-b",
  ASTROFRIEND_DIRECT_MEM0_HOST: "memory.test",
  MEM0_URL: "https://memory.test",
  MEM0_API_KEY: "test",
  OPENROUTER_API_KEY: "test",
};
test("access guidance reaches both reading and companion requests without rewriting the reading", async () => {
  const guidance = "Finish this allowed reading without inviting another restricted reading.";
  const reading =
    "Original astrology explanation remains unchanged.\n\nOriginal short verdict remains unchanged.";
  const calls = [];
  const result = await directAnswer(
    {
      user_id: "synthetic-a",
      query: "Mere baare mein batao",
      birth: {},
      history: [],
      language: "hinglish",
      user_gender: "male",
      quota_context: guidance,
    },
    {
      env: { ...pilot, VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "1", VEDASTRO_DIRECT_REPLY_CACHE: "0" },
      makeMemory: () => ({ read: async () => [] }),
      makeTools: () => async () => assert.fail("Unexpected calculation"),
      fetchImpl: async (_url, options) => {
        const body = JSON.parse(options.body);
        calls.push(body);
        return new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content: body.tools ? reading : "Abhi kis baat ka pressure sabse zyada hai?",
                },
              },
            ],
          }),
        );
      },
    },
  );
  assert.equal(calls.length, 2);
  for (const call of calls)
    assert.ok(call.messages.some((m) => m.role === "system" && m.content.includes(guidance)));
  assert.equal(result.reply.split("\n\n").slice(0, 2).join("\n\n"), reading);
});
test("pilot is exact-user scoped; explicit off overrides old dev switches", () => {
  assert.equal(directReleaseEnabled(pilot, "synthetic-a"), true);
  for (const id of ["synthetic", "synthetic-ab", "", "other"])
    assert.equal(directReleaseEnabled(pilot, id), false);
  assert.equal(directReleaseEnabled({ ...pilot, ASTROFRIEND_DIRECT_TEST_USERS: "" }), false);
  assert.equal(directReleaseEnabled({ ...pilot, ASTROFRIEND_DIRECT_MODE: "all" }), false);
  assert.equal(
    directReleaseEnabled({
      ...pilot,
      ASTROFRIEND_DIRECT_MODE: "off",
      VEDASTRO_DIRECT_DEV_ENABLED: "1",
      VEDASTRO_DIRECT_ENVIRONMENT: "development",
    }),
    false,
  );
});
test("plugin startup preserves identities, legacy routes and defaults; off rolls back only new plugin", () => {
  const old = {
    agents: { list: [{ id: "astrologer" }, { id: "tarot_reader" }] },
    plugins: { load: { paths: ["/existing"] }, entries: { legacy: { enabled: true } } },
  };
  assert.deepEqual(configureDirectAnswer(old, {}), old);
  const next = configureDirectAnswer(old, pilot);
  assert.deepEqual(next.agents, old.agents);
  assert.deepEqual(next.plugins.entries.legacy, old.plugins.entries.legacy);
  assert.deepEqual(next.plugins.load.paths, ["/existing", "/app/extensions/direct-answer"]);
  const rolled = configureDirectAnswer(next, { ASTROFRIEND_DIRECT_MODE: "off" });
  assert.deepEqual(rolled.plugins.load.paths, ["/existing"]);
  assert.equal(rolled.plugins.entries["direct-answer"].enabled, false);
  assert.throws(() => configureDirectAnswer(old, { ...pilot, MEM0_URL: "http://memory.test" }));
  assert.throws(() =>
    configureDirectAnswer(old, { ...pilot, ASTROFRIEND_DIRECT_MEM0_HOST: "other.test" }),
  );
});
test("access guidance stays bounded and reaches reading prompt without changing chart data", async () => {
  const value = {
    user_id: "synthetic-a",
    query: "career",
    history: [],
    language: "english",
    birth: null,
    quota_context: "Do not promise free readings. Finish the allowed question.",
  };
  validateDirectInput(value);
  assert.throws(() => validateDirectInput({ ...value, quota_context: "x".repeat(2049) }));
  const context = await readingContext(value, { read: async () => [] }, (text) => text);
  assert.ok(context.prompt.includes(value.quota_context));
  assert.equal(context.profile.status, "VERIFIED_EMPTY");
});
test("production memory uses pinned host and retains canonical user identity", async () => {
  let captured;
  const memory = createMemory("synthetic-a", {
    env: pilot,
    fetchImpl: async (url, options) => {
      captured = { url: String(url), options };
      return new Response(JSON.stringify({ memories: [] }));
    },
  });
  await memory.read();
  assert.equal(captured.url, "https://memory.test/memory/synthetic-a?limit=50");
  assert.equal(captured.options.headers.Authorization, "Token test");
  assert.throws(() =>
    createMemory("synthetic-a", { env: { ...pilot, MEM0_URL: "http://memory.test" } }),
  );
});
