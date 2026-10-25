import assert from "node:assert/strict";
import test from "node:test";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { readingContext } from "../extensions/reviewed-reading/direct/context.mjs";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";
import {
  personaInstruction,
  selfIntroduction,
} from "../extensions/reviewed-reading/direct/persona.mjs";
import { limitResponseLength } from "../extensions/reviewed-reading/direct/response-length.mjs";

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

void test("combined marriage questions retain both requested parts without changing chart or memory data", async () => {
  for (const sourceFlow of [true, false]) {
    const birth = { date: "2001-01-03", time: "05:00", location_name: "Delhi" };
    const facts = ["User has discussed a relationship with family."];
    const context = await readingContext(
      { ...value, birth, query: "Meri shaadi kab hogi aur mera life partner kaisa hoga?" },
      { read: async () => facts },
      (text) => text,
      new Date("2026-10-25"),
      { sourceFlow, separateCompanion: true },
    );
    assert.match(context.prompt, /Cover both; shortening must not drop either part/);
    assert.match(context.prompt, /Do not invent personality traits/);
    assert.match(context.prompt, /positive, negative or mixed indication/);
    assert.deepEqual(context.profile.fields, birth);
    assert.deepEqual(context.memoryFacts, facts);
  }
  const context = await readingContext(value, { read: async () => [] }, (text) => text);
  assert.doesNotMatch(context.prompt, /# Two requested reading parts/);
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

void test("standalone identity answers use the app persona without inventing a human identity", () => {
  for (const query of [
    "Apne baare mein batao, kaun ho tum?",
    "Apne Baare mai Kuch Batao Kon ho tum",
    "Tum kaun ho?",
    "Who are you?",
    "आप कौन हैं?",
  ]) {
    for (const [user_gender, name] of [
      ["male", "Meera"],
      ["female", "Aarav"],
      ["unknown", "AstroFriend"],
    ]) {
      const reply = selfIntroduction({ ...value, query, user_gender });
      assert.ok(reply.includes(name));
      assert.match(reply, /AI dost/);
      assert.ok(reply.split(/\s+/u).length <= 30);
      assert.doesNotMatch(reply, /robot nahi|samjhti|samajhti|dunga|karna chahti/);
    }
  }
  assert.match(
    selfIntroduction({ ...value, query: "Who are you?", language: "english" }),
    /AI companion/,
  );
  assert.match(
    selfIntroduction({ ...value, query: "आप कौन हैं?", language: "hindi", user_gender: "female" }),
    /आरव.*AI साथी/,
  );
});

void test("identity handling cannot replace readings or combined user questions", () => {
  for (const query of [
    "Mere baare mein kuch batao",
    "Who am I?",
    "Meri shaadi kab hogi?",
    "Who are you and when will I marry?",
    "Tum kaun ho aur meri job kab lagegi?",
    "Meri wife kaun hogi?",
    "आप कौन हैं और मेरी शादी कब होगी?",
  ]) {
    assert.equal(selfIntroduction({ ...value, query }), null);
  }
});

void test("agent displays trusted identity even when the writer repeats a misleading old introduction", async () => {
  for (const user_gender of ["male", "female"]) {
    const input = {
      ...value,
      user_gender,
      query: "Apne baare mein batao, kaun ho tum?",
      birth: {},
      history: [{ role: "assistant", text: "Main koi robot nahi, main insaan hoon." }],
    };
    const result = await directAnswer(input, {
      env: {
        OPENROUTER_API_KEY: "test",
        VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "0",
        VEDASTRO_DIRECT_REPLY_CACHE: "0",
      },
      makeMemory: () => ({ read: async () => [] }),
      makeTools: () => async () => {
        throw new Error("Identity needs no chart calculation");
      },
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content: "Main koi robot nahi, main tumhari dost hoon. Na tasalli dunga.",
                },
              },
            ],
            usage: { cost: 0 },
          }),
        ),
    });
    assert.equal(result.reply, selfIntroduction(input));
    assert.equal(result.answer_model_calls, 1);
    assert.deepEqual(result.answer_reading_tools, []);
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

void test("long partner follow-up keeps a complete question through final display formatting", async () => {
  const reading =
    "One relevant supporting reason. ".repeat(13).trim() +
    "\n\nSeptember 2027 to November 2028 is the indicated period.";
  const generated =
    "Tumhare liye woh ladki shayad ek aisi hogi jo baat karne mein sharmati hai, lekin dil se sachchi hai… Aap apne partner mein kin baaton ko ahmiyat dete hain?";
  const reply = await contextualClosing(reading, value, { generate: async () => generated });
  assert.equal(reply, reading + "\n\nAap apne partner mein kin baaton ko ahmiyat dete hain?");
  assert.equal(limitResponseLength(reply), reply);
});

void test("companion rejects partner predictions and overlong unbroken questions without changing reading", async () => {
  for (const generated of [
    "Aapki future wife sharmili hogi. Aapko kaisa lagta hai?",
    "Aapka partner imaandar hoga, kya aap bhi aisa hi chahte hain?",
    "Aap apne hone wale partner ke saath waqt bitane ke baare mein sochte hue apne rishte aur zindagi ki kin baaton ko sabse zyada ahmiyat dena chahenge?",
  ]) {
    const reply = await contextualClosing(base, value, { generate: async () => generated });
    assert.ok(reply.startsWith(base + "\n\n"));
    const closing = reply.split("\n\n")[2];
    assert.notEqual(closing, generated);
    assert.ok(closing.trim().split(/\s+/u).length <= 25);
    assert.match(closing, /\?$/);
  }
});
