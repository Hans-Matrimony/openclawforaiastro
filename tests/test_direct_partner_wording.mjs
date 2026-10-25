import assert from "node:assert/strict";
import test from "node:test";
import { readingContext } from "../extensions/reviewed-reading/direct/context.mjs";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";
import { personaInstruction } from "../extensions/reviewed-reading/direct/persona.mjs";

const value = {
  user_id: "synthetic",
  user_gender: "male",
  query: "Meri shaadi kab hogi?",
  language: "hinglish",
  history: [],
};
const base =
  "Guru ka sahyog hai, lekin rukawatein bhi hain.\n\nNovember 2031 se July 2034 sambhavit hai, pakka nahi.";

void test("both writer paths receive partner wording and concise style without altering user facts", async () => {
  for (const sourceFlow of [false, true]) {
    for (const [user_gender, partner] of [
      ["male", "future wife"],
      ["female", "future husband"],
    ]) {
      const facts = ["User has a boyfriend and asks about him."];
      const context = await readingContext(
        { ...value, user_gender, query: "Mere boyfriend se shaadi hogi?" },
        { read: async () => facts },
        (text) => text,
        new Date("2026-10-25"),
        { sourceFlow, separateCompanion: true },
      );
      assert.match(context.prompt, new RegExp(partner));
      assert.match(
        context.prompt,
        /current question, user-authored history or saved user facts takes priority/,
      );
      assert.match(context.prompt, /another person's reading/);
      assert.match(context.prompt, /60 to 80 words/);
      assert.match(context.prompt, /100 words/);
      assert.doesNotMatch(context.prompt, /140 words/);
      assert.deepEqual(context.memoryFacts, facts);
    }
  }
});

void test("unknown gender has no invented partner gender or Meera/Aarav assignment", () => {
  const instruction = personaInstruction({ user_gender: "unknown" });
  assert.match(instruction, /gender-neutral/);
  assert.match(instruction, /when unknown, say partner or saathi/);
  assert.doesNotMatch(instruction, /future wife|future husband|you are Meera|you are Aarav/);
});

void test("identity question has a brief warm AI identity without dismissing the user", () => {
  for (const [user_gender, name] of [
    ["male", "Meera"],
    ["female", "Aarav"],
  ]) {
    const instruction = personaInstruction({ user_gender });
    assert.match(instruction, new RegExp(`you are ${name}`));
    assert.match(instruction, /AstroFriend's AI companion/);
    assert.match(instruction, /one or two warm sentences/);
    assert.match(instruction, /Do not give an unsolicited reading/);
    assert.match(instruction, /or say you do not want a close conversation/);
  }
});

void test("companion cannot contradict timing or list both partner genders", async () => {
  for (const generated of [
    "Shaadi ka time nahi bata sakta, lekin agar koi aadmi ya aurat tumhare dil mein hai, toh uske saath kya soch rahe ho?",
    "Shaadi ka time nahi bata sakti, lekin aap kaisa rishta chaahte hain?",
    "If a man or woman is on your mind, what do you think about them?",
    "I cannot predict your marriage date. What kind of relationship would you like?",
    "शादी का समय नहीं बता सकता, लेकिन आप कैसा रिश्ता चाहते हैं?",
  ]) {
    const result = await contextualClosing(base, value, { generate: async () => generated });
    assert.ok(result.startsWith(base + "\n\n"));
    assert.equal(result.split("\n\n").length, 3);
    assert.notEqual(result.split("\n\n")[2], generated);
    assert.doesNotMatch(
      result.split("\n\n")[2],
      /aadmi ya aurat|man or woman|nahi bata|cannot predict|नहीं बता/,
    );
  }
});

void test("short contextual partner follow-up keeps negative reading untouched", async () => {
  const reading =
    "Is period mein rishte ka sahyog kamzor hai.\n\nAbhi is rishte ke liye sanket anukool nahi hain.";
  const closing = "Unse baat hui toh unhone kya kaha?";
  const result = await contextualClosing(
    reading,
    {
      ...value,
      query: "Meri crush se shaadi hogi?",
      history: [{ role: "user", text: "Maine apni crush ko apni feelings bata di hain." }],
    },
    {
      generate: async (prompt) => {
        assert.match(prompt, /future wife/);
        assert.match(prompt, /Aim for 10 to 20 words/);
        assert.match(prompt, /do not rewrite, correct, extend or repeat it/);
        return closing;
      },
    },
  );
  assert.equal(result, reading + "\n\n" + closing);
});
