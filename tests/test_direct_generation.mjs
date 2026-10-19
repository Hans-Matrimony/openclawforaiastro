import assert from "node:assert/strict";
import test from "node:test";
import { generationSettings } from "../extensions/reviewed-reading/direct/generation.mjs";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";

void test("stable Qwen generation pins a seed-capable endpoint, zero temperature and no provider fallback", () => {
  assert.deepEqual(generationSettings({}), {
    temperature: 0,
    top_k: 1,
    top_p: 1,
    seed: 42,
    provider: {
      require_parameters: true,
      order: ["parasail/fp8"],
      only: ["parasail/fp8"],
      allow_fallbacks: false,
    },
  });
  assert.equal(generationSettings({ VEDASTRO_DIRECT_SEED: "7" }).seed, 7);
});
void test("source comparison mode retains the original generation settings", () => {
  assert.deepEqual(generationSettings({ VEDASTRO_DIRECT_GENERATION_MODE: "source" }), {
    temperature: 0.7,
    provider: { require_parameters: true },
  });
});
void test("invalid generation configuration fails instead of silently routing elsewhere", () => {
  for (const env of [
    { VEDASTRO_DIRECT_GENERATION_MODE: "other" },
    { VEDASTRO_DIRECT_SEED: "NaN" },
    { VEDASTRO_DIRECT_SEED: "-1" },
    { VEDASTRO_DIRECT_MODEL: "another/model" },
    { VEDASTRO_DIRECT_PROVIDER: "https://invalid.test" },
  ]) {
    assert.throws(() => generationSettings(env));
  }
});
void test("source sampling mode retains one contextual system message and ordered parallel tool results", async () => {
  let calls = 0;
  let starts = 0;
  let release;
  const bothStarted = new Promise((resolve) => {
    release = resolve;
  });
  const result = await directAnswer(
    {
      user_id: "test:user",
      query: "test question",
      language: "hinglish",
      birth: null,
      history: [],
    },
    {
      env: { OPENROUTER_API_KEY: "test-only", VEDASTRO_DIRECT_GENERATION_MODE: "source" },
      makeMemory: () => ({
        read: async () => [],
      }),
      makeTools: () => async (name) => {
        starts++;
        if (starts === 2) {
          release();
        }
        await bothStarted;
        return name;
      },
      fetchImpl: async (_url, options) => {
        const body = JSON.parse(options.body);
        calls++;
        if (calls === 1) {
          assert.deepEqual(
            body.messages.map((message) => message.role),
            ["system", "user"],
          );
          assert.equal(body.temperature, 0.7);
          assert.ok(!Object.hasOwn(body, "seed"));
          return new Response(
            JSON.stringify({
              choices: [
                {
                  finish_reason: "tool_calls",
                  message: {
                    role: "assistant",
                    content: null,
                    tool_calls: ["first", "second"].map((name) => ({
                      id: name,
                      type: "function",
                      function: { name, arguments: "{}" },
                    })),
                  },
                },
              ],
            }),
          );
        }
        assert.deepEqual(
          body.messages.slice(-2).map((message) => message.content),
          ["first", "second"],
        );
        return new Response(
          JSON.stringify({
            choices: [{ finish_reason: "stop", message: { content: "Reply.\n\nVerdict." } }],
          }),
        );
      },
    },
  );
  assert.equal(result.reply, "Reply.\n\nVerdict.");
});
