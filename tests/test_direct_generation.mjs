import assert from "node:assert/strict";
import test from "node:test";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { generationSettings } from "../extensions/reviewed-reading/direct/generation.mjs";

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
void test("source provider pin retains source sampling and cannot affect stable companion routing", () => {
  const env = { VEDASTRO_DIRECT_SOURCE_PROVIDER: "parasail/fp8" };
  const settings = generationSettings({ ...env, VEDASTRO_DIRECT_GENERATION_MODE: "source" });
  assert.equal(settings.temperature, 0.7);
  assert.equal(settings.seed, undefined);
  assert.deepEqual(settings.provider.only, ["parasail/fp8"]);
  assert.equal(settings.provider.allow_fallbacks, false);
  assert.deepEqual(settings.provider.max_price, { prompt: 0.15, completion: 1.5 });
  assert.deepEqual(generationSettings(env), generationSettings({}));
  assert.throws(
    () =>
      generationSettings({
        VEDASTRO_DIRECT_GENERATION_MODE: "source",
        VEDASTRO_DIRECT_SOURCE_PROVIDER: "https://other.test",
      }),
    /Invalid source provider/,
  );
});
void test("explicit dev backup allows only two endpoints for the same model and caps their prices", () => {
  const settings = generationSettings({ VEDASTRO_DIRECT_FALLBACK_PROVIDER: "deepinfra/fp8" });
  assert.deepEqual(settings.provider, {
    require_parameters: true,
    order: ["parasail/fp8", "deepinfra/fp8"],
    only: ["parasail/fp8", "deepinfra/fp8"],
    allow_fallbacks: true,
    max_price: { prompt: 0.15, completion: 1.5 },
  });
  assert.equal(settings.temperature, 0);
  assert.equal(settings.seed, 42);
  assert.equal(settings.top_k, 1);
});
void test("invalid generation configuration fails instead of silently routing elsewhere", () => {
  for (const env of [
    { VEDASTRO_DIRECT_GENERATION_MODE: "other" },
    { VEDASTRO_DIRECT_SEED: "NaN" },
    { VEDASTRO_DIRECT_SEED: "-1" },
    { VEDASTRO_DIRECT_MODEL: "another/model" },
    { VEDASTRO_DIRECT_PROVIDER: "https://invalid.test" },
    { VEDASTRO_DIRECT_FALLBACK_PROVIDER: "https://invalid.test" },
    { VEDASTRO_DIRECT_FALLBACK_PROVIDER: "parasail/fp8" },
  ]) {
    assert.throws(() => generationSettings(env));
  }
});
void test("provider failures and ambiguous network errors never trigger an application-level resubmission", async () => {
  for (const status of [429, 503, null]) {
    let calls = 0;
    await assert.rejects(
      directAnswer(
        { user_id: "test:user", query: "Hello", history: [], birth: null, language: "hinglish" },
        {
          env: {
            OPENROUTER_API_KEY: "test-only",
            VEDASTRO_DIRECT_FALLBACK_PROVIDER: "deepinfra/fp8",
          },
          makeMemory: () => ({ read: async () => [] }),
          fetchImpl: async () => {
            calls++;
            if (status === null) {
              throw new Error("Connection lost");
            }
            return new Response("rejected", { status });
          },
        },
      ),
    );
    assert.equal(calls, 1);
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
