import test from "node:test";
import assert from "node:assert/strict";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";
import { companionFallback } from "../extensions/reviewed-reading/direct/companion-fallback.mjs";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";

const reading =
  "Original astrology wording, signs and dates stay unchanged.\n\nOriginal short verdict.";
const value = {
  query: "Meri shaadi kab hogi?",
  language: "hinglish",
  user_gender: "male",
  history: [],
};

void test("companion-only changes preserve both original astrology bubbles exactly", async () => {
  for (const base of [
    reading,
    reading.replaceAll("\n", "\r\n"),
    "Explanation asks why?\n\nShort verdict?",
  ]) {
    const result = await contextualClosing(base, value, {
      generate: async () => "Is rishte ko lekar aap khud kya chahte ho?",
    });
    if (base.endsWith("?")) {
      assert.equal(result, base); // Existing clarifications stay untouched.
    } else {
      assert.equal(result.slice(0, base.length), base);
      assert.equal(result.slice(base.length), "\n\nIs rishte ko lekar aap khud kya chahte ho?");
      assert.equal(result.split(/\r?\n\s*\r?\n/).length, 3);
    }
  }
});

void test("stock listening and presence phrases never become the new third bubble", async () => {
  for (const closing of [
    "Aapki baat sun rahi hoon. Agar aap kuch aur kehna chahte hain, toh main yahan hoon.",
    "Main sun raha hoon. Aur kya chal raha hai?",
    "Main yahi hoon.",
    "Main yahaan hoon.",
    "I'm listening. What else?",
    "I am here for you.",
    "मैं आपकी बात सुन रही हूँ।",
    "मैं यहीं हूँ।",
  ]) {
    const result = await contextualClosing(reading, value, { generate: async () => closing });
    assert.equal(result.slice(0, reading.length), reading);
    assert.equal(result.split("\n\n").length, 3);
    assert.doesNotMatch(
      result.slice(reading.length),
      /sun rah|ya(?:ha|hi)|listening|here for|सुन रही|यहीं/i,
    );
  }
  // No forced invitation is appended to this death question if the only
  // generated closing is the reported stock text; its answer is left intact.
  assert.equal(
    await contextualClosing(
      reading,
      { ...value, query: "Or shaheeed Ka Kya scene hai Death Kab hogi woh batao" },
      {
        generate: async () => "Aapki baat sun rahi hoon. Main yahan hoon.",
      },
    ),
    reading,
  );
});

void test("fallback uses related user history and saved facts, never assistant predictions", async () => {
  const cases = [
    [
      { ...value, history: [{ role: "user", text: "Mere ghar wale rishte ke khilaaf hain." }] },
      [],
      /Ghar\s*walon.*baat/,
    ],
    [{ ...value, query: "Career ke baare mein batao" }, ["User wants to pursue an MBA"], /MBA/],
    [
      {
        ...value,
        query: "Paise ki pareshani kab door hogi?",
        history: [{ role: "user", text: "MBA karna hai" }],
      },
      [],
      /Paise/,
    ],
    [
      { ...value, history: [{ role: "assistant", text: "Family aapke khilaaf hai" }] },
      [],
      /Shaadi ya rishte/,
    ],
  ];
  for (const [input, facts, expected] of cases) {
    const result = await contextualClosing(reading, input, { facts, generate: async () => "NONE" });
    assert.equal(result.split("\n\n").length, 3);
    assert.match(result.split("\n\n")[2], expected);
    assert.equal(result.slice(0, reading.length), reading);
  }
  assert.doesNotMatch(
    companionFallback({ ...value, query: "Ab job nahi, padhai ki baat karo" }, [
      "User wants an MBA",
    ]),
    /MBA|job/i,
  );
});

void test("recent conversation, saved memory and persona reach only the closing writer", async () => {
  for (const [gender, name] of [
    ["male", "Meera"],
    ["female", "Aarav"],
  ]) {
    const input = {
      ...value,
      user_gender: gender,
      query: "Padhai ke baare mein batao",
      history: [{ role: "user", text: "Main MBA karna chahta hoon" }],
    };
    const result = await contextualClosing(reading, input, {
      facts: ["[birth] excluded from companion", "User works night shifts"],
      generate: async (prompt, data) => {
        const context = JSON.parse(data);
        assert.ok(prompt.includes(name));
        assert.match(prompt, /Do not announce your presence/);
        assert.match(prompt, /Current corrections override older facts/);
        assert.equal(context.answer, undefined);
        assert.equal(context.reading_completed, true);
        assert.equal(context.history[0].text, input.history[0].text);
        assert.deepEqual(context.saved_user_facts, ["User works night shifts"]);
        return "Night shift aur MBA ko saath rakhne mein abhi kya mushkil aa rahi hai?";
      },
    });
    assert.equal(
      result,
      reading + "\n\nNight shift aur MBA ko saath rakhne mein abhi kya mushkil aa rahi hai?",
    );
  }
});

void test("a repeated follow-up uses another closing without adding a fourth bubble", async () => {
  const old = "Is rishte ko lekar aap khud kya chahte ho?";
  const result = await contextualClosing(
    reading + "\n\n" + old,
    { ...value, history: [{ role: "assistant", text: old }] },
    { generate: async () => old },
  );
  assert.equal(result.slice(0, reading.length), reading);
  assert.equal(result.split("\n\n").length, 3);
  assert.ok(!result.endsWith(old));
});

void test("agent preserves its generated reading and appends a third bubble using the existing memory read", async () => {
  let calls = 0,
    reads = 0;
  const reply = await directAnswer(
    {
      ...value,
      user_id: "synthetic-companion-only",
      birth: {},
      history: [{ role: "user", text: "Ghar wale rishte ke khilaaf hain" }],
    },
    {
      env: {
        OPENROUTER_API_KEY: "test",
        VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "1",
        VEDASTRO_DIRECT_REPLY_CACHE: "0",
      },
      makeMemory: () => ({
        read: async () => {
          reads++;
          return ["User wants to discuss the relationship with family"];
        },
      }),
      makeTools: () => async () => {
        assert.fail("No additional calculation is requested by the companion");
      },
      fetchImpl: async (_url, options) => {
        calls++;
        if (calls === 2) {
          const body = JSON.parse(options.body);
          assert.equal(body.tools, undefined);
          assert.equal(JSON.parse(body.messages[1].content).saved_user_facts.length, 1);
        }
        return new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content:
                    calls === 1
                      ? reading
                      : "Ghar walon se baat karte waqt sabse mushkil kya lagta hai?",
                },
              },
            ],
          }),
        );
      },
    },
  );
  assert.equal(
    reply.reply,
    reading + "\n\nGhar walon se baat karte waqt sabse mushkil kya lagta hai?",
  );
  assert.equal(reads, 1);
  assert.equal(calls, 2);
});
