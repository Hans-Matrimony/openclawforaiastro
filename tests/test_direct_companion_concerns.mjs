import assert from "node:assert/strict";
import test from "node:test";
import { companionConcern } from "../extensions/reviewed-reading/direct/companion-concern.mjs";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";
import { formatDisplayReply } from "../extensions/reviewed-reading/direct/format-reply.mjs";

const base =
  "Original astrology explanation stays exactly the same.\n\nOriginal verdict stays exactly the same.";
const value = { language: "hinglish", user_gender: "male", history: [] };
const user = (text) => ({ role: "user", text });

void test("live fees and time-management failures recover without modifying the astrology bubbles", async () => {
  for (const [query, bad, expected] of [
    [
      "MBA ki fees ki wajah se paise ki tension hai. Meri financial condition kab better hogi?",
      "Abhi sabse zyada tension kis baat ki ho rahi hai?",
      /Fees.*payment/,
    ],
    [
      "Sabse mushkil time manage karna hai, course choose karna nahi. Ab kya karun?",
      "Apni zindagi ko lekar aaj kaisa lag raha hai?",
      /Time.*din/i,
    ],
  ]) {
    let calls = 0;
    const result = await contextualClosing(
      base,
      { ...value, query },
      {
        generate: async (_prompt, payload) => {
          calls++;
          assert.ok(JSON.parse(payload).known_concern);
          return bad;
        },
      },
    );
    assert.equal(calls, 1);
    assert.ok(result.startsWith(base + "\n\n"));
    assert.match(result.split("\n\n")[2], expected);
    assert.ok(result.split("\n\n")[2].split(/\s+/u).length <= 20);
    assert.equal(formatDisplayReply(result).split("\n\n").length, 3);
  }
});

void test("specific natural writer questions pass through unchanged", async () => {
  const query = "MBA ki fees ki wajah se paise ki tension hai.";
  const good = "Fees ka bojh lag raha hai. Is mahine payment hai ya abhi thoda waqt mil sakta hai?";
  assert.equal(
    await contextualClosing(base, { ...value, query }, { generate: async () => good }),
    base + "\n\n" + good,
  );
});

void test("short follow-ups use user concerns, never assistant predictions", () => {
  const history = [
    user("Meri financial condition kab better hogi?"),
    { role: "assistant", text: "Fees ki wajah se tension hai." },
  ];
  assert.equal(companionConcern({ ...value, query: "Ab kya karun?", history }), null);
  history.push(user("MBA ki fees ki wajah se tension hai."));
  assert.equal(companionConcern({ ...value, query: "Ab kya karun?", history }).kind, "fees");
  assert.equal(companionConcern({ ...value, query: "Meri shaadi kab hogi?", history }), null);
});

void test("family fallback advances the conversation instead of asking the known objection", async () => {
  const result = await contextualClosing(
    base,
    {
      ...value,
      query: "Unko meri partner ki family se dikkat hai. Main unse baat kaise shuru karun?",
    },
    { generate: async () => "NONE" },
  );
  assert.ok(result.startsWith(base + "\n\n"));
  assert.match(result.split("\n\n")[2], /kis se.*baat/);
  assert.doesNotMatch(result, /kya dikkat|main concern/);
});

void test("a stopped MBA is not revived by old memory or a failed writer", async () => {
  const result = await contextualClosing(
    base,
    {
      ...value,
      query:
        "Filhaal MBA chhod diya hai, ab sirf job par focus karna hai. Mere career ke baare mein batao.",
      history: [user("Main MBA kar raha hoon.")],
    },
    {
      facts: ["User is doing an MBA"],
      generate: async (_prompt, payload) => {
        assert.deepEqual(JSON.parse(payload).saved_user_facts, []);
        return "MBA ki padhai ke liye kitna waqt milta hai?";
      },
    },
  );
  assert.match(result.split("\n\n")[2], /job.*kaam/i);
  assert.doesNotMatch(result.split("\n\n")[2], /MBA/);
});

void test("a failed writer never repeats the last specific question, across languages", async () => {
  for (const language of ["hinglish", "english", "hindi"]) {
    const history = [];
    const query = "MBA fees ki tension hai";
    const first = await contextualClosing(
      base,
      { ...value, language, query, history },
      { generate: async () => "NONE" },
    );
    history.push(user(query), { role: "assistant", text: first }, user("Payment next week hai"));
    const second = await contextualClosing(
      base,
      { ...value, language, query, history },
      { generate: async () => "NONE" },
    );
    assert.notEqual(first.split("\n\n")[2], second.split("\n\n")[2]);
    assert.ok(second.startsWith(base + "\n\n"));
  }
});

void test("resolved concerns override older history and saved memory", () => {
  assert.equal(
    companionConcern(
      {
        ...value,
        query: "MBA fees ki tension nahi hai ab, financial condition batao",
        history: [user("MBA fees ki tension hai")],
      },
      ["User is worried about MBA fees"],
    ),
    null,
  );
  assert.equal(
    companionConcern({
      ...value,
      query: "Gharwale ab maan gaye, shaadi ke baare mein batao",
      history: [user("Gharwale rishte ke khilaaf hain")],
    }),
    null,
  );
  assert.equal(
    companionConcern({ ...value, query: "MBA fees unpaid hain, financial condition batao" }).kind,
    "fees",
  );
});

void test("already supplied payment timing is not asked again", async () => {
  const result = await contextualClosing(
    base,
    { ...value, query: "MBA fees payment next week hai, bahut tension hai" },
    { generate: async () => "NONE" },
  );
  assert.doesNotMatch(result.split("\n\n")[2], /kareeb|coming up/);
  assert.match(result.split("\n\n")[2], /Fees.*saath/);
});

void test("companion receives user history and earlier closings without prediction contamination", async () => {
  const history = [
    user("Fees ka pressure hai"),
    {
      role: "assistant",
      text: "Saturn will delay everything until 2027.\n\nWait until 2027.\n\nPayment kab hai?",
    },
    user("Payment next week hai"),
  ];
  const result = await contextualClosing(
    base,
    { ...value, query: "Ab kya karun?", history },
    {
      generate: async (_prompt, data) => {
        const payload = JSON.parse(data);
        assert.deepEqual(payload.history, [
          history[0],
          { role: "assistant", text: "Payment kab hai?" },
          history[2],
        ]);
        assert.doesNotMatch(data, /2027|Saturn|Original astrology/);
        assert.equal(payload.reading_completed, true);
        return "Payment kareeb hai. Abhi aap kis tarah ka saath chahte ho?";
      },
    },
  );
  assert.ok(result.startsWith(base + "\n\n"));
});

void test("keep the writer's complete contextual question instead of replacing an overlong preamble", async () => {
  const question = "Abhi konsi job ki taraf zyada khinchav hai?";
  const raw = Array(50).fill("preamble").join(" ") + ".\n" + question;
  const result = await contextualClosing(
    base,
    { ...value, query: "MBA chhod diya, job pe focus hai" },
    { generate: async () => raw },
  );
  assert.equal(result, base + "\n\n" + question);
});

void test("extracted questions still face topic and prediction validation", async () => {
  const result = await contextualClosing(
    base,
    { ...value, query: "MBA fees ki tension hai" },
    { generate: async () => "I am here for you.\n2027 ke baad kya badlega?" },
  );
  assert.doesNotMatch(result.slice(base.length), /2027|I am here/);
  assert.match(result.slice(base.length), /Fees/);
});
