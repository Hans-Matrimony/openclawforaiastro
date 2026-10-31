import assert from "node:assert/strict";
import test from "node:test";
import { companionFocus, closingDrifts } from "../extensions/reviewed-reading/direct/companion-context.mjs";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";

const query = "Job change ke liye CV mein ek practical sudhar batao. Abhi koi naya course shuru nahi kiya hai.";
const value = { query, language: "hinglish", history: [{ role: "user", text: "I considered taking a course last year." }] };
const bad = "Padhai mein abhi kis cheez par dhyaan dena chahte ho?";
test("negative course disclosure does not move career focus to education", () => {
  const focus = companionFocus(value);
  assert.deepEqual(focus.topics, ["career"]);
  assert.equal(closingDrifts(bad, focus, value, ["Previously discussed a course."]), true);
  assert.equal(closingDrifts("Aap kis job role ke liye apply karna chahte hain?", focus, value, []), false);
  assert.deepEqual(companionFocus({ ...value, query: "Help with my job search. I have not started a course." }).topics, ["career"]);
});
test("explicit education questions and genuine mixed work-study requests remain", () => {
  for (const query of ["Job ke saath MBA padhai kaise manage karun?", "Job change chahiye. Course shuru nahi kiya, kaunsa course choose karun?", "Job change karna hai. I have started a course."]) {
    assert.ok(companionFocus({ ...value, query }).topics.includes("education"), query);
  }
});
for (const generated of [bad, "NONE"]) {
  test(`career companion stays relevant with generated=${generated}`, async () => {
    const base = "CV mein apne pichhle kaam ke measurable results likhiye.";
    const result = await contextualClosing(base, value, { facts: [], generate: async () => generated });
    assert.ok(result.startsWith(base));
    assert.doesNotMatch(result, /padhai|course|study/i);
  });
}
test("combined English prohibition skips the companion call", async () => {
  let calls = 0;
  const result = await directAnswer({ user_id: "combined-test", language: "english", history: [], birth: {},
    query: "Please answer briefly in English: give one practical interview-preparation step. No prediction or follow-up question." }, {
    env: { OPENROUTER_API_KEY: "test", VEDASTRO_DIRECT_FLOW: "source", VEDASTRO_DIRECT_ENVIRONMENT: "development", VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "1" },
    makeMemory: () => ({ read: async () => [] }), makeTools: () => async () => { throw new Error("Unexpected tool"); },
    fetchImpl: async () => { calls++; return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: "Practice answering three common interview questions out loud in your own words." } }] })); },
  });
  assert.equal(calls, 1);
  assert.doesNotMatch(result.reply, /\?/);
});
