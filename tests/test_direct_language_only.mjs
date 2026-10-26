import assert from "node:assert/strict";
import test from "node:test";
import { readingContext } from "../extensions/reviewed-reading/direct/context.mjs";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";
import { formatDisplayReply } from "../extensions/reviewed-reading/direct/format-reply.mjs";

const value = {
  user_id: "synthetic-language",
  user_gender: "male",
  language: "hinglish",
  query: "Meri shaadi kab hogi aur mera life partner kaisa hoga?",
  history: [],
};

void test("orphaned display score cleanup preserves the house, dates, polarity and bubbles", () => {
  for (const conclusion of ["sambhavit hai", "sahyog nahi hai", "sahyog aur rukawat dono hain"]) {
    const rest = `Saturn aur Jupiter yahan hain. Mars antardasha 15 September 2027 se 14 November 2028 tak hai.\n\nIs daur mein ${conclusion}.\n\nUnke saath abhi baatcheet kaisi chal rahi hai?`;
    const reply = "7ve ghar ka sirf 20 hai " + rest;
    assert.equal(formatDisplayReply(reply), "7ve ghar: " + rest);
    assert.equal(reply.split("\n\n").length, formatDisplayReply(reply).split("\n\n").length);
  }
});

void test("display cleanup never removes ages, years, money, other counts or raw data", () => {
  const raw = "7ve ghar ka sirf 20 hai Saturn aur Jupiter yahan hain.";
  for (const text of [
    "Umar sirf 20 hai. 2027 mein 26 saal honge. Fees 20,000 hai.",
    "7ve ghar ka kiraya 20 hai. Saturn ka zikr baad mein hai.",
    "7ve ghar ka sirf 200 hai Saturn ka record.",
    "17ve ghar ka sirf 20 hai Saturn ka record.",
    "`" + raw + "`",
    "```text\n" + raw + "\n```",
    JSON.stringify({ text: raw }),
  ]) {
    assert.equal(formatDisplayReply(text), text);
  }
});

void test("plain wording and both partner grammars preserve profile and memory in both flows", async () => {
  for (const sourceFlow of [false, true]) {
    for (const user_gender of ["male", "female"]) {
      const birth = { date: "2001-01-03", time: "05:00", location_name: "Delhi" };
      const facts = ["User has a boyfriend and asks about him."];
      const ctx = await readingContext(
        { ...value, birth, user_gender },
        { read: async () => facts },
        (t) => t,
        new Date("2026-10-25"),
        { sourceFlow },
      );
      assert.doesNotMatch(ctx.prompt, /# Everyday wording/);
      assert.match(ctx.prompt, /Hinglish means conversational Hindi in Latin letters/);
      assert.match(ctx.prompt, /not personality traits to add/);
      assert.match(
        ctx.prompt,
        user_gender === "male" ? /wali, karti, hui, hogi/ : /wala, karta, hua, hoga/,
      );
      assert.match(
        ctx.prompt,
        /current question, user-authored history or saved user facts takes priority/,
      );
      assert.deepEqual(ctx.memoryFacts, facts);
      assert.deepEqual(ctx.profile.fields, birth);
    }
  }
});

void test("a broad marriage follow-up retains the latest user crush topic without changing the reading", async () => {
  const base = "Original negative reading.\n\nOriginal exact dates and verdict.";
  const input = {
    ...value,
    history: [
      { role: "user", text: "Meri crush se shaadi hogi?" },
      {
        role: "assistant",
        text: "Reading.\n\nVerdict.\n\nKya aapne unse apni feelings share ki hain?",
      },
      { role: "user", text: "Maine unse apni feelings share kar di hain." },
    ],
  };
  const result = await contextualClosing(base, input, { generate: async () => "NONE" });
  assert.equal(result, base + "\n\nUnke saath abhi baatcheet kaisi chal rahi hai?");
});

void test("companion does not borrow an assistant crush assumption or revive a rejected crush", async () => {
  const base = "Original reading.\n\nOriginal verdict.";
  for (const history of [
    [{ role: "assistant", text: "Meri crush se shaadi hogi?" }],
    [{ role: "user", text: "Meri crush nahi hai." }],
    [
      { role: "user", text: "Meri crush se shaadi hogi?" },
      { role: "user", text: "Ab kisi aur se shaadi ki baat hai." },
    ],
  ]) {
    const result = await contextualClosing(
      base,
      { ...value, history },
      { generate: async () => "NONE" },
    );
    assert.ok(result.startsWith(base + "\n\n"));
    assert.doesNotMatch(result.slice(base.length), /unse|unke saath|crush/i);
  }
  const result = await contextualClosing(
    base,
    {
      ...value,
      query: "Ab meri nayi girlfriend kab banegi?",
      history: [{ role: "user", text: "Meri crush se shaadi hogi?" }],
    },
    { generate: async () => "NONE" },
  );
  assert.doesNotMatch(result.slice(base.length), /unse|unke saath|crush/i);
});
