import assert from "node:assert/strict";
import test from "node:test";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { sourceReading } from "../extensions/reviewed-reading/direct/source-engine.mjs";
import { createTools } from "../extensions/reviewed-reading/direct/tools.mjs";
import { SOURCE_FLOW_PROMPT } from "../extensions/reviewed-reading/direct/source-contract.mjs";

const env = {
  OPENROUTER_API_KEY: "test",
  VEDASTRO_DIRECT_FLOW: "source",
  VEDASTRO_DIRECT_ENVIRONMENT: "development",
  VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "1",
};
const value = {
  user_id: "synthetic-source-flow",
  query: "Meri shaadi kab hogi?",
  language: "hinglish",
  user_gender: "male",
  birth: { date: "2001-01-03", time: "05:00", location_name: "Delhi" },
  history: [{ role: "user", text: "Gharwale agree nahi kar rahe." }],
};
const response = (message, finish_reason = "stop") =>
  new Response(
    JSON.stringify({
      choices: [{ finish_reason, message }],
      usage: { cost: 0 },
      provider: "SyntheticProvider",
      model: "synthetic-model",
    }),
  );

void test("source flow uses raw source prompt, tools and seven rounds with isolated companionship", async () => {
  let calls = 0;
  let reads = 0;
  const requests = [];
  const result = await directAnswer(value, {
    env,
    makeMemory: (id) => {
      assert.equal(id, value.user_id);
      return {
        read: async () => {
          reads++;
          return ["Mummy se baat kar sakta hoon."];
        },
      };
    },
    makeTools: () => async () => '{"source":"unchanged tool evidence"}',
    fetchImpl: async (_, options) => {
      const body = JSON.parse(options.body);
      requests.push(body);
      calls++;
      if (calls <= 6) {
        return response(
          {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: `call-${calls}`,
                type: "function",
                function: { name: "mcp__VedAstro__get_horoscope_predictions", arguments: "{}" },
              },
            ],
          },
          "tool_calls",
        );
      }
      return response({
        content:
          calls === 7
            ? "Source explanation.\n\nSource verdict."
            : "Gharwalon se baat karne mein sabse mushkil kya lagta hai?",
      });
    },
  });
  assert.equal(reads, 1);
  assert.equal(calls, 8);
  assert.equal(result.answer_model_calls, 8);
  assert.ok(
    result.answer_usage.every(
      (row) => row.provider === "SyntheticProvider" && row.model === "synthetic-model",
    ),
  );
  assert.ok(result.reply.startsWith("Source explanation.\n\nSource verdict.\n\n"));
  assert.equal(result.reply.split("\n\n").length, 3);
  assert.equal(requests[0].temperature, 0.7);
  assert.equal(requests[0].seed, undefined);
  assert.equal(requests[7].temperature, 0);
  assert.deepEqual(requests[0].messages.slice(1, 3), [
    { role: "user", content: value.history[0].text },
    { role: "user", content: value.query },
  ]);
  const prompt = requests[0].messages[0].content;
  assert.ok(prompt.startsWith(SOURCE_FLOW_PROMPT.split("# Environment")[0]));
  assert.match(prompt, /# Examples of correct behavior/);
  assert.match(prompt, /Mummy se baat/);
  assert.match(prompt, /Meera/);
  assert.doesNotMatch(prompt, /# Active question scope|# Repeated question comparison/);
  assert.ok(
    requests[6].messages.some(
      (m) => m.role === "tool" && m.content.includes("unchanged tool evidence"),
    ),
  );
});

void test("raw source instruction survives the source tool adapter", async () => {
  const expected = {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          dasha: { upcoming_antardashas: [] },
          instruction: "Original source instruction.",
        }),
      },
    ],
  };
  const reading = (name, args, birth, options) =>
    sourceReading(name, args, birth, {
      ...options,
      loadEngine: async () => ({ get_horoscope_predictions: () => expected }),
    });
  const execute = createTools({ env, memory: {}, birth: value.birth, reading });
  assert.equal(
    await execute("mcp__VedAstro__get_horoscope_predictions", {}),
    expected.content[0].text,
  );
});

void test("source flow never retries a failed paid submission and cannot run in production", async () => {
  let calls = 0;
  const options = {
    env,
    makeMemory: () => ({ read: async () => [] }),
    fetchImpl: async () => {
      calls++;
      return new Response("", { status: 429 });
    },
  };
  await assert.rejects(directAnswer(value, options), /unavailable/);
  assert.equal(calls, 1);
  await assert.rejects(
    directAnswer(value, {
      ...options,
      env: { ...env, VEDASTRO_DIRECT_ENVIRONMENT: "production" },
    }),
    /development-only/,
  );
  assert.equal(calls, 1);
});
