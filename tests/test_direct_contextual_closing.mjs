import assert from "node:assert/strict";
import test from "node:test";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";

void test("closing gets relevant conversation and memory without rewriting the answer", async () => {
  const value = {
    query: "Ab kya karun?",
    language: "hinglish",
    history: [{ role: "user", text: "Main job ke saath MBA karna chahta hoon." }],
  };
  const answer = "Padhai ke liye roz thoda waqt rakho.";
  const result = await contextualClosing(answer, value, {
    facts: ["[birth] private birth details", "User works night shifts"],
    generate: async (prompt, data) => {
      assert.match(prompt, /Do not ask for information already supplied/);
      const payload = JSON.parse(data);
      assert.equal(payload.history[0].text, value.history[0].text);
      assert.deepEqual(payload.saved_user_facts, ["User works night shifts"]);
      return "Night shift ke baad padhai ke liye kitna waqt mil pata hai?";
    },
  });
  assert.equal(result, answer + " Night shift ke baad padhai ke liye kitna waqt mil pata hai?");
});
void test("no generic, duplicated, malformed or failed closing is forced", async () => {
  const value = {
    query: "career?",
    language: "hinglish",
    history: [{ role: "assistant", text: "Kaunsi field mein jaana hai?" }],
  };
  for (const question of [
    "NONE",
    "Kaunsi field mein jaana hai?",
    "Would you like more detail?",
    "First? Second?",
    "Answer without question",
  ]) {
    assert.equal(
      await contextualClosing("Answer. Iske baare mein thoda aur bataun?", value, {
        generate: async () => question,
      }),
      "Answer.",
    );
  }
  assert.equal(
    await contextualClosing("Answer.", value, {
      generate: async () => {
        throw Error("offline");
      },
    }),
    "Answer.",
  );
  assert.equal(
    await contextualClosing("Answer. Which course interests you?", value, {
      generate: async () => {
        throw Error("should not run");
      },
    }),
    "Answer. Which course interests you?",
  );
});
void test("dev agent uses memory and history for a single bounded closing call", async () => {
  let calls = 0;
  const result = await directAnswer(
    {
      user_id: "synthetic-closing-test",
      query: "upay batao",
      language: "hinglish",
      birth: {},
      history: [{ role: "user", text: "Meri family relationship ke khilaaf hai." }],
    },
    {
      env: {
        OPENROUTER_API_KEY: "test",
        VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "1",
        VEDASTRO_DIRECT_REPLY_CACHE: "0",
      },
      makeMemory: () => ({ read: async () => ["User wants to discuss marriage with family"] }),
      makeTools: () => async () => ({}),
      remedyLookup: async () => ({
        status: "available",
        sources: [{ text: "Traditional remedy: pray quietly." }],
      }),
      fetchImpl: async (url, options) => {
        calls++;
        const body = JSON.parse(options.body);
        if (calls === 2) {
          const data = JSON.parse(body.messages[1].content);
          assert.equal(data.history[0].text, "Meri family relationship ke khilaaf hai.");
          assert.equal(data.saved_user_facts.length, 1);
          assert.equal(body.tools, undefined);
        }
        return new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content:
                    calls === 1
                      ? "Shaant mann se prarthana kar sakte ho."
                      : "Family ko is rishte mein sabse badi dikkat kis baat se hai?",
                },
              },
            ],
            usage: { cost: 0 },
          }),
        );
      },
    },
  );
  assert.equal(calls, 2);
  assert.equal(result.answer_model_calls, 2);
  assert.equal(result.answer_usage.length, 2);
  assert.equal(
    result.reply,
    "Shaant mann se prarthana kar sakte ho. Family ko is rishte mein sabse badi dikkat kis baat se hai?",
  );
});
