import test from "node:test";
import assert from "node:assert/strict";
import { stressFollowup } from "../extensions/reviewed-reading/direct/stress-followup.mjs";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";

const value = {
  query: "life main bahut tension hai kab khatam hogi",
  language: "hinglish",
  history: [],
};
void test("actual stress query retains a useful follow-up on NONE, invalid output and failure", async () => {
  for (const generate of [
    async () => "NONE",
    async () => "2027 ke baad kya badlega?",
    async () => {
      throw Error("budget exhausted");
    },
  ]) {
    assert.equal(
      await contextualClosing("The original answer.", value, { generate }),
      "The original answer. Abhi sabse zyada tension kis baat ki ho rahi hai?",
    );
  }
});
void test("fallback uses user context, not an assistant's astrological explanation", () => {
  assert.match(
    stressFollowup({ ...value, history: [{ role: "assistant", text: "Your work causes stress" }] }),
    /kis baat/,
  );
  assert.match(stressFollowup(value, ["User is stressed about work"]), /Kaam ke is pressure/);
  assert.match(
    stressFollowup({ ...value, query: "Meri family ki tension hai" }, [
      "User is stressed about work",
    ]),
    /Ghar ya rishte/,
  );
  assert.match(
    stressFollowup({ ...value, query: "Meri job ki tension nahi hai, family ki tension hai" }, [
      "User is stressed about work",
    ]),
    /Ghar ya rishte/,
  );
  const first = stressFollowup(value);
  assert.notEqual(
    stressFollowup({ ...value, history: [{ role: "assistant", text: first }] }),
    first,
  );
  assert.equal(stressFollowup({ ...value, query: "What is stress?" }), null);
});
void test("stress conversation can receive a follow-up without calling chart tools", async () => {
  let calls = 0;
  const result = await directAnswer(
    { ...value, user_id: "synthetic-stress-test", birth: {} },
    {
      env: {
        OPENROUTER_API_KEY: "test",
        VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "1",
        VEDASTRO_DIRECT_REPLY_CACHE: "0",
      },
      makeMemory: () => ({ read: async () => [] }),
      makeTools: () => async () => {
        throw Error("No chart expected");
      },
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: { content: ++calls === 1 ? "Main sun raha hoon." : "NONE" },
              },
            ],
            usage: { cost: 0 },
          }),
        ),
    },
  );
  assert.equal(
    result.reply,
    "Main sun raha hoon. Abhi sabse zyada tension kis baat ki ho rahi hai?",
  );
  assert.equal(result.answer_model_calls, 2);
  assert.deepEqual(result.answer_reading_tools, []);
});
