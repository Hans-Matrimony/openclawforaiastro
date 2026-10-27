import assert from "node:assert/strict";
import test from "node:test";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { companionConcern } from "../extensions/reviewed-reading/direct/companion-concern.mjs";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";
import { ordinaryReply } from "../extensions/reviewed-reading/direct/ordinary-reply.mjs";

const value = {
  user_id: "synthetic-release",
  query: "Padhai aur night shift ke beech bahut tension hai.",
  birth: { date: "2001-01-03", time: "05:00", location_name: "Delhi" },
  language: "hinglish",
  user_gender: "female",
  history: [
    {
      role: "user",
      text: "Main night shift mein kaam karti hoon aur MBA ki taiyari kar rahi hoon.",
    },
    { role: "assistant", text: "Abhi sabse mushkil kya lag raha hai?" },
    { role: "user", text: "Neend poori nahi hoti aur fees ki bhi chinta hai." },
  ],
};

void test("source ordinary concern cannot invent a period or re-ask the stated problem", async () => {
  let calls = 0;
  const result = await directAnswer(value, {
    env: {
      OPENROUTER_API_KEY: "synthetic",
      ASTROFRIEND_DIRECT_MODE: "pilot",
      ASTROFRIEND_DIRECT_ENVIRONMENT: "staging",
      ASTROFRIEND_DIRECT_TEST_USERS: value.user_id,
      VEDASTRO_DIRECT_FLOW: "source",
      VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "1",
      VEDASTRO_DIRECT_REPLY_CACHE: "0",
    },
    makeMemory: () => ({ read: async () => [] }),
    makeTools: () => async () => {
      throw new Error("No calculation for ordinary concern");
    },
    fetchImpl: async (_url, options) => {
      const request = JSON.parse(options.body);
      calls++;
      if (calls === 1) {
        assert.match(request.messages[0].content, /everyday concern/);
        assert.match(request.messages[0].content, /respectful aap wording/);
        assert.match(request.messages[0].content, /Do not add an unrequested plan/);
        assert.ok(request.tools.every((tool) => !tool.function.name.startsWith("mcp__VedAstro__")));
      } else {
        assert.equal(JSON.parse(request.messages[1].content).known_concern.kind, "fees");
      }
      return new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: {
                content:
                  calls === 1
                    ? "Neend ka issue Saturn aur Moon ka effect hai. 2027 ke baad Jupiter ki dasha shuru hogi.\n\n2027 ke baad tension kam hogi."
                    : "Abhi sabse zyada tension kis baat ki ho rahi hai?",
              },
            },
          ],
          usage: { cost: 0 },
        }),
      );
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.answer_model_calls, 2);
  assert.deepEqual(result.answer_reading_tools, []);
  assert.doesNotMatch(result.reply, /2027|Jupiter|Saturn|dasha|kis baat/);
  assert.match(result.reply, /Night shift ke saath padhai/);
  assert.doesNotMatch(result.reply, /\b(?:beta|beti|tu|tumhe)\b/);
  assert.match(result.reply, /Fees.*payment/);
});

void test("ordinary fallback acknowledges only the current study and shift concern", () => {
  for (const [language, query, expected] of [
    ["en", "Night shifts and studies are stressful", /night shifts and studying/],
    ["hi", "नाइट शिफ्ट और पढ़ाई से तनाव है", /नाइट शिफ्ट के साथ पढ़ाई/],
  ]) {
    assert.match(ordinaryReply("2027 Jupiter dasha", { language, query }), expected);
  }
  const unrelated = ordinaryReply("2027", { ...value, query: "Fees ki tension hai" });
  assert.match(unrelated, /fees/);
  assert.doesNotMatch(unrelated, /Night shift/);
  const alreadyGrounded = "Night shifts aur padhai dono ka pressure kaafi hai.";
  assert.equal(ordinaryReply(alreadyGrounded, value), alreadyGrounded);
});

void test("fees history follows education but not an unrelated relationship question", () => {
  assert.equal(companionConcern(value).kind, "fees");
  assert.equal(companionConcern({ ...value, query: "Meri shaadi kab hogi?" }), null);
  assert.equal(
    companionConcern({ ...value, query: "MBA ki fees bhar di, ab fees ki tension nahi hai." }),
    null,
  );
});

void test("companion correction preserves the reading and its negative verdict exactly", async () => {
  const base = "This period does not support the requested opportunity.\n\nThe answer is no.";
  const result = await contextualClosing(base, value, { generate: async () => "NONE" });
  assert.ok(result.startsWith(base + "\n\n"));
  assert.equal(result.split("\n\n").length, 3);
  assert.match(result.split("\n\n")[2], /Fees/);
});

void test("ordinary Hindi fallback has readable language and English alias works", () => {
  const hindi = ordinaryReply("Jupiter dasha", { query: "Fees ki tension hai", language: "hi" });
  assert.match(hindi, /फीस/);
  assert.doesNotMatch(hindi, /\?{2}|dasha|Jupiter/);
  assert.match(
    ordinaryReply("2027", { query: "I am worried", language: "en" }),
    /That sounds difficult/,
  );
});
