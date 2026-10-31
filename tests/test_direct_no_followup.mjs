import assert from "node:assert/strict";
import test from "node:test";
import { canAskFollowup, appendFriendlyClosing } from "../extensions/reviewed-reading/direct/friendly-closing.mjs";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";

for (const query of [
  "Koi prediction ya follow-up sawaal nahi.", "Sawal nahi chahiye.",
  "Sawaal mat poochna.", "Abhi mat puchna.", "Follow-up nahin.",
  "सवाल नहीं चाहिए।", "प्रश्न मत पूछो।", "No follow-up question.",
]) {
  test(`no-question preference: ${query}`, () => {
    const value = { query, language: "hinglish" };
    assert.equal(canAskFollowup("Apne words mein practice kijiye.", value, true), false);
    assert.equal(appendFriendlyClosing("Apne words mein practice kijiye.", value, true), "Apne words mein practice kijiye.");
  });
}
test("ordinary uncertainty and questions remain eligible", () => {
  for (const query of ["Mujhe nahi pata interview mein kya poochhenge.", "Follow-up sawaal poochho.", "Interview ke sawal batao."]) {
    assert.equal(canAskFollowup("Apne experience ke examples taiyar kijiye.", { query, language: "hinglish" }, true), true);
  }
});
test("observed Hinglish no-follow-up skips companion generation entirely", async () => {
  let calls = 0;
  const result = await directAnswer({
    user_id: "no-question-test", language: "hinglish", birth: {}, history: [],
    query: "Ab Hinglish mein batao: interview ki taiyari ke liye ek practical kadam kya ho? Koi prediction ya follow-up sawaal nahi.",
  }, {
    env: { OPENROUTER_API_KEY: "test", VEDASTRO_DIRECT_FLOW: "source", VEDASTRO_DIRECT_ENVIRONMENT: "development", VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "1" },
    makeMemory: () => ({ read: async () => [] }),
    makeTools: () => async () => { throw new Error("Unexpected tool"); },
    fetchImpl: async () => {
      calls++;
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: "Interview se pehle common questions ke answers apne words mein practice kijiye." } }] }));
    },
  });
  assert.equal(calls, 1);
  assert.doesNotMatch(result.reply, /\?/);
});
