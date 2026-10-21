import test from "node:test";
import assert from "node:assert/strict";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";
import {
  formatDisplayReply,
  formatReadingReply,
} from "../extensions/reviewed-reading/direct/format-reply.mjs";

const base = "Existing chart explanation.\n\nExisting short answer.";
const value = {
  query: "Meri education ke baare mein batao",
  history: [],
  language: "hinglish",
  user_gender: "male",
};

void test("a reading writer's misplaced question becomes a third bubble without inventing a verdict", async () => {
  const raw = "Existing chart explanation. Existing short answer.\n\nWould you like more detail?";
  const formatted = formatReadingReply(raw, true, { separateCompanion: true });
  const output = await contextualClosing(formatted, value, {
    generate: async () => "Padhai ko lekar abhi sabse mushkil kya lag raha hai?",
  });
  assert.deepEqual(output.split("\n\n"), [
    "Existing chart explanation.",
    "Existing short answer.",
    "Padhai ko lekar abhi sabse mushkil kya lag raha hai?",
  ]);
  assert.equal(formatReadingReply(raw, false, { separateCompanion: true }), raw);
  const clarification = "I need your birth details.\n\nWhat is your birth time?";
  assert.equal(formatReadingReply(clarification, true, { separateCompanion: true }), clarification);
});

void test("topic drift and invented context are rejected only in the companion", async () => {
  for (const closing of [
    "Shaadi ko lekar family ki kya expectations hain?",
    "MBA ki fees ke liye kya plan hai?",
    "Night shift ke baad kitna padh paate ho?",
    Array(25).fill("word").join(" ") + "?",
  ]) {
    const result = await contextualClosing(base, value, { generate: async () => closing });
    assert.ok(result.startsWith(base + "\n\n"));
    assert.doesNotMatch(result.slice(base.length), /shaadi|MBA|night shift|word/i);
    assert.match(result.slice(base.length), /Padhai.*\?$/);
    assert.ok(result.split("\n\n")[2].split(/\s+/u).length <= 20);
  }
});

void test("full delivered history and relevant saved facts reach the bounded companion request", async () => {
  const history = [
    { role: "user", text: "Main night shift ke saath MBA ki padhai karta hoon." },
    ...Array.from({ length: 14 }, (_, i) => ({
      role: i % 2 ? "user" : "assistant",
      text: "Earlier turn " + i,
    })),
    { role: "user", text: "Education ke baare mein batao" },
  ];
  const facts = [...Array(20).fill("User has family relationship concerns"), "User wants an MBA"];
  const closing = "Night shift ke saath MBA ke liye roz kitna waqt nikal pata hai?";
  const result = await contextualClosing(
    base,
    { ...value, query: "Ab kya karun?", history },
    {
      facts,
      generate: async (prompt, data) => {
        const context = JSON.parse(data);
        assert.equal(context.history.length, history.filter((t) => t.role === "user").length);
        assert.deepEqual(context.saved_user_facts, ["User wants an MBA"]);
        assert.equal(context.conversation_focus.user_topic, "Education ke baare mein batao");
        assert.match(prompt, /At most 20 words/);
        return closing;
      },
    },
  );
  assert.equal(result, base + "\n\n" + closing);
});

void test("exhausting emergency questions never silently drops the third bubble", async () => {
  const history = [];
  let last;
  for (let turn = 0; turn < 14; turn++) {
    const result = await contextualClosing(
      base,
      { ...value, history: history.slice(-20) },
      {
        generate: async () => {
          throw Error("provider unavailable");
        },
      },
    );
    const parts = result.split("\n\n");
    assert.equal(parts.length, 3);
    assert.match(parts[2], /Padhai.*\?$/);
    assert.notEqual(parts[2], last);
    assert.ok(formatDisplayReply(result).split("\n\n")[2].endsWith("?"));
    last = parts[2];
    history.push({ role: "user", text: value.query }, { role: "assistant", text: result });
  }
});

void test("a new question beats old relationship context, but short follow-ups inherit the user topic", async () => {
  const history = [
    { role: "user", text: "Meri shaadi kab hogi?" },
    { role: "assistant", text: "MBA karna chahiye." },
    { role: "user", text: "Meri job kab lagegi?" },
  ];
  for (const query of ["Mera career kab set hoga?", "Ab kya karun?", "2030 tak?"]) {
    const result = await contextualClosing(
      base,
      { ...value, query, history },
      {
        facts: ["User discussed marriage"],
        generate: async () => "Aap apni shaadi mein kya chahte ho?",
      },
    );
    assert.match(result.split("\n\n")[2], /Kaam/);
    assert.doesNotMatch(result.split("\n\n")[2], /shaadi|MBA/i);
  }
});

void test("the companion avoids asking a known course and respects a later correction", async () => {
  const history = [{ role: "user", text: "Main MBA kar raha hoon." }];
  const repeated = await contextualClosing(
    base,
    { ...value, history },
    {
      generate: async () => "Kaunsa course kar rahe ho?",
    },
  );
  assert.doesNotMatch(repeated, /Kaunsa course/);
  history.push({ role: "user", text: "Ab MBA nahi, BTech kar raha hoon." });
  const corrected = await contextualClosing(
    base,
    { ...value, history, query: "Ab kya karun?" },
    {
      facts: ["User is doing an MBA"],
      generate: async (_prompt, data) => {
        assert.deepEqual(JSON.parse(data).saved_user_facts, []);
        return "MBA ko lekar abhi kya soch rahe ho?";
      },
    },
  );
  assert.doesNotMatch(corrected.slice(base.length), /MBA/);
  assert.equal(corrected.split("\n\n").length, 3);
});
