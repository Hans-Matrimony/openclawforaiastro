import assert from "node:assert/strict";
import test from "node:test";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { listeningConcern, stalePracticalReply } from "../extensions/reviewed-reading/direct/current-turn.mjs";

const listening = "Aaj kaam se thoda thak gaya hoon. Bas suno, abhi advice ya sawaal nahi chahiye.";
const practical = "Maine abhi koi skill practice shuru nahi ki hai. Job change ke liye ek practical kadam batao.";
const stale = "Samajh rahi hoon, thak gaye ho aaj bas so jao, kal phir baat karenge. Kya aaj raat ko kuch chhota sa shuru karna chahte ho?";
const env = { OPENROUTER_API_KEY: "test", VEDASTRO_DIRECT_FLOW: "source", VEDASTRO_DIRECT_ENVIRONMENT: "development", VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "1" };

async function answer(query, drafts, options = {}) {
  let calls = 0;
  const result = await directAnswer({
    user_id: "synthetic-current-turn", query, language: "hinglish",
    gender: options.gender || "male",
    birth: { date: "2001-01-03", time: "05:00", location_name: "Delhi" },
    history: [{ role: "user", text: listening }],
  }, {
    env: { ...env, ...options.env }, makeMemory: () => ({ read: async () => [] }),
    makeTools: () => async () => { throw new Error("Unexpected chart tool"); },
    fetchImpl: async (_, request) => {
      const body = JSON.parse(request.body);
      assert.match(body.messages[0].content, query === listening ? /Current listening request/ : /current explicit request/);
      const content = drafts[Math.min(calls++, drafts.length - 1)];
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { role: "assistant", content } }] }));
    },
  });
  return { result, calls };
}

for (const gender of ["male", "female"]) {
  test(`listening-only removes observed sleep advice without extra generation: ${gender}`, async () => {
    const { result, calls } = await answer(listening, [stale], { gender });
    assert.equal(calls, 1);
    assert.match(result.reply, /koi advice nahi/);
    assert.doesNotMatch(result.reply, /so jao|\?/);
    assert.ok(result.answer_validation.includes("listening_advice_rejected"));
  });
}
test("compliant listening acknowledgement is retained", async () => {
  const { result, calls } = await answer(listening, ["Aaj kaam se kaafi thakaan hui lagti hai."]);
  assert.equal(calls, 1);
  assert.match(result.reply, /kaafi thakaan/);
  assert.ok(!result.answer_validation.includes("listening_advice_rejected"));
});
for (const persistent of [false, true]) {
  test(`current career step overrides earlier listening request; persistent=${persistent}`, async () => {
    const { result, calls } = await answer(practical, [stale, persistent ? stale : "Apne CV mein ek relevant project ka result likhiye."], {
      env: { VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "0" },
    });
    assert.equal(calls, 2);
    assert.match(result.reply, /CV/);
    assert.doesNotMatch(result.reply, /so jao|kal phir/);
    assert.ok(result.answer_validation.includes("practical_stale_topic_rejected"));
  });
}
test("listening guard excludes sensitive, chart and practical turns", () => {
  for (const query of ["I am tired and want to die, just listen", "I am tired with chest pain, just listen", "Bas suno, thak gaya, meri kundli batao", practical]) {
    assert.equal(listeningConcern(query), false, query);
  }
  assert.equal(stalePracticalReply("I am tired, give a practical step for rest", "Get some sleep"), false);
  assert.equal(stalePracticalReply(practical, "Thak gaye hain. Kal CV mein relevant projects likhiye."), false);
});
