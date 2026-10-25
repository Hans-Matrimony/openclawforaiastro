import assert from "node:assert/strict";
import test from "node:test";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { isPeriodInterpretation } from "../extensions/reviewed-reading/direct/period-interpretation.mjs";
import {
  personaInstruction,
  selfIntroduction,
} from "../extensions/reviewed-reading/direct/persona.mjs";
import { hasPredictionGuarantee } from "../extensions/reviewed-reading/direct/prediction-certainty.mjs";

const input = {
  user_id: "synthetic-pilot",
  user_gender: "male",
  language: "hinglish",
  query: "Meri shaadi kab hogi?",
  birth: null,
  history: [],
};
const env = {
  OPENROUTER_API_KEY: "test",
  VEDASTRO_DIRECT_REPLY_CACHE: "0",
  VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "0",
  VEDASTRO_DIRECT_FLOW: "source",
  VEDASTRO_DIRECT_ENVIRONMENT: "development",
};
const response = (content) =>
  new Response(
    JSON.stringify({
      choices: [{ finish_reason: "stop", message: { role: "assistant", content } }],
    }),
  );
const chart = () =>
  new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: "tool_calls",
          message: {
            role: "assistant",
            tool_calls: [
              {
                id: "chart",
                type: "function",
                function: { name: "mcp__VedAstro__get_horoscope_predictions", arguments: "{}" },
              },
            ],
          },
        },
      ],
    }),
  );

void test("character biography is stable for both personas and separate from human identity", () => {
  for (const [user_gender, name, grammar] of [
    ["male", "Meera", "ki"],
    ["female", "Aarav", "ka"],
  ]) {
    const value = { ...input, user_gender };
    const all = selfIntroduction({ ...value, query: "Apni backstory batao" });
    for (const fact of [name, "25", "Banaras", "ghats", "papa aur dadaji", "padhai", "kirdaar"]) {
      assert.ok(all.includes(fact), fact);
    }
    assert.ok(all.includes(`AstroFriend ${grammar} AI dost`));
    assert.match(selfIntroduction({ ...value, query: "Tumhari umar kitni hai?" }), /25/);
    assert.match(selfIntroduction({ ...value, query: "Tum kahan se ho?" }), /Banaras/);
    assert.match(selfIntroduction({ ...value, query: "Tumhare papa kya karte hain?" }), /jyotishi/);
    assert.match(
      selfIntroduction({ ...value, query: "Tumne astrology kaise seekhi?" }),
      /family se seekhkar/,
    );
    assert.match(
      selfIntroduction({ ...value, query: "Tell me your backstory", language: "english" }),
      /character backstory.*25.*AI companion/,
    );
    assert.match(
      selfIntroduction({ ...value, query: "अपने बारे में बताओ", language: "hindi" }),
      /किरदार.*25.*बनारस.*AI साथी/,
    );
    const prompt = personaInstruction(value);
    assert.match(prompt, /Never introduce this backstory into an ordinary reading/);
    assert.match(prompt, /save it as the user's memory/);
    assert.match(prompt, /Do not invent an exact birthday/);
  }
});

void test("biography does not replace the user's own or mixed astrology questions", () => {
  for (const query of [
    "Meri umar kya hai?",
    "Mere baare mein batao",
    "Mera janm Banaras mein hua hai",
    "Tumhari umar kya hai aur meri shaadi kab hogi?",
    "Tell me about my family",
    "When will my wife be 25?",
    "Tumhare papa jyotishi hain toh meri kundli batao",
  ]) {
    assert.equal(selfIntroduction({ ...input, query }), null, query);
  }
  assert.doesNotMatch(
    selfIntroduction({ ...input, user_gender: "unknown", query: "Apni backstory batao" }),
    /25|Banaras|Meera|Aarav/,
  );
  assert.doesNotMatch(personaInstruction({ user_gender: "unknown" }), /25|born and raised/);
});

void test("certainty detection preserves negation and positive, negative and mixed interpretations", () => {
  for (const reply of [
    "Dheere aayegi, lekin pakki.",
    "Shaadi pakka hogi.",
    "Results pakke hain.",
    "Marriage is guaranteed.",
    "It is 100% certain.",
    "शादी पक्की है।",
    "Not guaranteed now, but definitely next year.",
  ]) {
    assert.equal(hasPredictionGuarantee(reply), true, reply);
  }
  for (const reply of [
    "Shaadi pakki nahi hai.",
    "Pakka hoga nahi keh sakte.",
    "Marriage is not guaranteed.",
    "Is period mein shaadi ke sanket anukool hain.",
    "Abhi is rishte ke sanket anukool nahi hain.",
    "Support aur rukawat dono hain.",
    "शादी पक्की नहीं है।",
  ]) {
    assert.equal(hasPredictionGuarantee(reply), false, reply);
  }
  const data = [
    { dasha: { upcoming_antardashas: [{ lord: "Mars", from: "2027-09-15", to: "2028-11-14" }] } },
  ];
  assert.equal(
    isPeriodInterpretation(
      "Mars house support: September 2027 to November 2028 sambhavit, pakki nahi.",
      data,
    ),
    true,
  );
  assert.equal(
    isPeriodInterpretation(
      "Mars house support: September 2027 to November 2028 sambhavit, lekin pakki.",
      data,
    ),
    false,
  );
});

void test("missing fast-profile birth cannot authorize replaying an old reading", async () => {
  let calls = 0,
    tools = 0;
  const result = await directAnswer(
    { ...input, history: [{ role: "assistant", text: "Old marriage forecast: 2027 pakki." }] },
    {
      env,
      makeMemory: () => ({
        read: async () => ["User's birth details are available in saved memory."],
      }),
      makeTools: () => async () => {
        tools++;
        return JSON.stringify({ current_chart: true });
      },
      fetchImpl: async (_, options) => {
        const body = JSON.parse(options.body);
        calls++;
        if (calls === 1) {
          return response("Old marriage forecast: 2027 pakki.");
        }
        if (calls === 2) {
          assert.equal(body.tool_choice, "auto");
          assert.match(body.messages.at(-1).content, /missing or conflicting/);
          assert.ok(
            !body.messages.some(
              (m) =>
                m.role === "assistant" &&
                m.content === "Old marriage forecast: 2027 pakki." &&
                m !== body.messages[1],
            ),
          );
          return chart();
        }
        return response(
          "Current chart indications are mixed.\n\nThe relationship has both support and obstacles.",
        );
      },
    },
  );
  assert.equal(tools, 1);
  assert.equal(calls, 3);
  assert.doesNotMatch(result.reply, /2027|pakki/);
  assert.deepEqual(result.answer_reading_tools, ["get_horoscope_predictions"]);
});

void test("missing birth can be clarified without a forced chart call or fabricated data", async () => {
  let calls = 0;
  const result = await directAnswer(input, {
    env,
    makeMemory: () => ({ read: async () => [] }),
    makeTools: () => async () => {
      throw new Error("No birth profile");
    },
    fetchImpl: async () => {
      calls++;
      return response(
        calls === 1
          ? "Your old marriage prediction still applies."
          : "Please share your birth date, time and place?",
      );
    },
  });
  assert.equal(calls, 2);
  assert.match(result.reply, /birth date, time and place/);
  assert.deepEqual(result.answer_reading_tools, []);
});

void test("one bounded correction removes a guarantee without changing supported timing or negative factors", async () => {
  let calls = 0,
    tools = 0;
  const corrected =
    "Rukawat hai, lekin Mars period September 2027 to November 2028 mein shaadi sambhavit hai.\n\nSeptember 2027 to November 2028 sambhavit.";
  const result = await directAnswer(
    { ...input, birth: { date: "2001-01-03", time: "05:00", location_name: "Delhi" } },
    {
      env,
      makeMemory: () => ({ read: async () => [] }),
      makeTools: () => async () => {
        tools++;
        return '{"current_chart":true}';
      },
      fetchImpl: async (_, options) => {
        calls++;
        if (calls === 1) {
          return chart();
        }
        if (calls === 2) {
          return response("Rukawat hai, lekin September 2027 to November 2028 mein shaadi pakki.");
        }
        assert.match(
          JSON.parse(options.body).messages.at(-1).content,
          /preserving the supported positive, negative or mixed conclusion/,
        );
        return response(corrected);
      },
    },
  );
  assert.equal(calls, 3);
  assert.equal(tools, 1);
  assert.ok(result.reply.startsWith(corrected));
  assert.equal(hasPredictionGuarantee(result.reply), false);
});
