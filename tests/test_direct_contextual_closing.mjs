import assert from "node:assert/strict";
import test from "node:test";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import {
  concernFallback,
  companionConcern,
} from "../extensions/reviewed-reading/direct/companion-concern.mjs";

void test("exhausted fee follow-ups retain the known concern and preserve the reading", async () => {
  const value = {
    query: "Main night shift mein kaam karta hoon aur MBA ki fees ko lekar pareshan hoon.",
    language: "hinglish",
    history: [],
  };
  for (let i = 0; i < 2; i++) {
    value.history.push({
      role: "assistant",
      text: concernFallback(value, companionConcern(value)),
    });
  }
  for (const generate of [
    async () => "NONE",
    async () => {
      throw new Error("unavailable");
    },
  ]) {
    const base = "Existing astrology reading.\n\nExisting short answer.";
    const reply = await contextualClosing(base, value, { generate });
    assert.ok(reply.startsWith(base + "\n\n"));
    assert.match(reply.split("\n\n").at(-1), /Fees/);
    assert.doesNotMatch(reply, /sabse zyada tension kis baat/i);
  }
});

void test("companion cannot repeat astrology timing in the reported misspelled education query", async () => {
  assert.equal(
    await contextualClosing(
      "Original reading.",
      { query: "educaiotn ke baare main batao", language: "hinglish", history: [] },
      {
        generate: async () => "2027 ke baad sab clear ho jayega. Weekly do topics padho?",
      },
    ),
    "Original reading.\n\nPadhai mein abhi kis cheez par dhyaan dena chahte ho?",
  );
});

void test("reported ordinary questions reach companion writer without chart calls", async () => {
  for (const query of [
    "educaiotn ke baare main batao",
    "thodi pareshani hai paiso ko leke kab poori hogi",
  ]) {
    let calls = 0;
    const result = await directAnswer(
      {
        user_id: "synthetic-companion-routing",
        query,
        language: "hinglish",
        birth: {},
        history: [],
      },
      {
        env: {
          OPENROUTER_API_KEY: "test",
          VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "1",
          VEDASTRO_DIRECT_REPLY_CACHE: "0",
        },
        makeMemory: () => ({ read: async () => [] }),
        makeTools: () => async () => {
          assert.fail("No chart tool in this routing fixture");
        },
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              choices: [
                {
                  finish_reason: "stop",
                  message: {
                    content:
                      ++calls === 1 ? "Existing answer." : "Aaram se batao, jo mann mein hai.",
                  },
                },
              ],
              usage: { cost: 0 },
            }),
          ),
      },
    );
    assert.equal(calls, 2);
    assert.ok(result.reply.startsWith("Existing answer.\n\n"));
    assert.match(result.reply.split("\n\n")[1], /\?$/);
    assert.match(result.reply.split("\n\n")[1], query.startsWith("educ") ? /Padhai/ : /Paise/);
  }
});

void test("reported education and money questions retain companionship on writer failure", async () => {
  for (const [query, closing] of [
    ["educatoin ke baare main batao", "Padhai mein abhi kis cheez par dhyaan dena chahte ho?"],
    [
      "thodi pareshani hai paiso ko leke kab poori hogi",
      "Paise ki is pareshani mein abhi sabse zaroori kya sambhalna hai?",
    ],
  ]) {
    const value = { query, language: "hinglish", history: [] };
    const answer = "Original chart paragraph.\n\n2027 ke baad original verdict.";
    for (const generate of [
      async () => "NONE",
      async () => {
        throw Error("Closing call budget exhausted");
      },
    ]) {
      assert.equal(await contextualClosing(answer, value, { generate }), answer + "\n\n" + closing);
    }
    const repeated = await contextualClosing(
      answer,
      { ...value, history: [{ role: "assistant", text: closing }] },
      { generate: async () => "NONE" },
    );
    assert.ok(repeated.startsWith(answer));
    assert.ok(!repeated.includes(closing));
  }
});

void test("malformed companion output leaves the reading intact", async () => {
  const answer = "Original interpretation.\n\nOriginal timing.";
  const value = { query: "career?", language: "english", history: [] };
  for (const output of [
    null,
    undefined,
    {},
    "",
    "none",
    "None.",
    "x".repeat(281),
    "One\nTwo",
    "One? Two?",
  ]) {
    assert.equal(
      await contextualClosing(answer, value, { generate: async () => output }),
      answer + "\n\nWhat has been on your mind most about work lately?",
    );
  }
  assert.equal(
    await contextualClosing(
      answer,
      { ...value, query: "I am stressed, just listen" },
      {
        generate: async () => {
          throw Error("offline");
        },
      },
    ),
    answer + "\n\nOkay, no advice right now. Take your time; you can say what's on your mind.",
  );
});

void test("live listening regression adds support without a model call or invented scene", async () => {
  const answer = "Existing reading.\n2027 ke baad existing verdict.";
  const result = await contextualClosing(
    answer,
    {
      query:
        "Ab job ki tension nahi hai, ghar mein roz jhagda hota hai. Bas suno, abhi advice nahi chahiye.",
      language: "hinglish",
      history: [],
    },
    {
      generate: async () => {
        assert.fail("Listening must not generate another question");
      },
    },
  );
  assert.equal(
    result,
    answer + "\n\nTheek hai, abhi koi advice nahi. Aaram se apni baat keh sakte ho.",
  );
});

void test("memory is redacted and bounded and duplicates ignore case and whitespace", async () => {
  const answer = "Original reading.";
  const value = {
    query: "career?",
    language: "english",
    history: [{ role: "assistant", text: "Take your time.  What feels hardest?" }],
  };
  assert.equal(
    await contextualClosing(answer, value, {
      facts: [null, "[birth] excluded", "private-id", "x".repeat(2000)],
      redact: (text) => text.replaceAll("private-id", "[redacted]"),
      generate: async (_, data) => {
        assert.deepEqual(JSON.parse(data).saved_user_facts, ["[redacted]", "x".repeat(1000)]);
        return "take your time. what feels hardest?";
      },
    }),
    answer + "\n\nWhat has been on your mind most about work lately?",
  );
  assert.equal(
    await contextualClosing(answer, value, { generate: async () => answer }),
    answer + "\n\nWhat has been on your mind most about work lately?",
  );
});

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
  assert.equal(result, answer + "\n\nNight shift ke baad padhai ke liye kitna waqt mil pata hai?");
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
    "Family ka opposition kab tak rahega aur 2027 ke baad kya badlega?",
  ]) {
    assert.equal(
      await contextualClosing("Answer. Iske baare mein thoda aur bataun?", value, {
        generate: async () => question,
      }),
      "Answer.\n\nKaam ko lekar abhi aapke mann mein sabse zyada kya chal raha hai?",
    );
  }
  assert.equal(
    await contextualClosing("Answer.", value, {
      generate: async () => {
        throw Error("offline");
      },
    }),
    "Answer.\n\nKaam ko lekar abhi aapke mann mein sabse zyada kya chal raha hai?",
  );
  assert.equal(
    await contextualClosing("Answer.\n\nWhich course interests you?", value, {
      generate: async () => "Which course interests you?",
    }),
    "Answer.\n\nWhich course interests you?",
  );
});
void test("companion can acknowledge feelings without forcing another question", async () => {
  const answer = "The existing astrology paragraph.\n\nThe existing timing verdict.";
  const closing = "Aaram se batao, jaldi nahi hai. Jo mann mein hai keh sakte ho.";
  const result = await contextualClosing(
    answer,
    {
      query: "Aaj thoda udaas hoon",
      language: "hinglish",
      history: [{ role: "user", text: "Night shifts aur MBA saath manage kar raha hoon." }],
    },
    {
      facts: ["User works night shifts"],
      generate: async (prompt, data) => {
        assert.match(prompt, /do not rewrite, correct, extend or repeat it/);
        assert.match(prompt, /never assume a romantic relationship/);
        assert.match(prompt, /supportive statement alone/i);
        assert.equal(JSON.parse(data).answer, undefined);
        assert.equal(JSON.parse(data).reading_completed, true);
        return closing;
      },
    },
  );
  assert.equal(result, answer + "\n\n" + closing);
});
void test("existing future-prediction questions are reviewed without rewriting the answer", async () => {
  const answer = "The original reading.\n\nThe original verdict.";
  const result = await contextualClosing(
    answer + "\n\nFamily ka opposition kab tak rahega?",
    { query: "meri shaadi?", language: "hinglish", history: [] },
    {
      generate: async (prompt, data) => {
        assert.match(prompt, /Never ask the user to predict the future/);
        assert.equal(JSON.parse(data).answer, undefined);
        assert.equal(JSON.parse(data).reading_completed, true);
        assert.equal(JSON.parse(data).existing_closing_to_review, undefined);
        assert.ok(!data.includes("opposition kab tak"));
        return "Family ki sabse badi concern kya hai?";
      },
    },
  );
  assert.equal(result, answer + "\n\nFamily ki sabse badi concern kya hai?");
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
    "Shaant mann se prarthana kar sakte ho.\n\nFamily ko is rishte mein sabse badi dikkat kis baat se hai?",
  );
});
