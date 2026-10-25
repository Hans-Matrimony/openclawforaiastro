import assert from "node:assert/strict";
import test from "node:test";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";

const reading = "Original explanation.\n\nOriginal verdict.";
const value = {
  query: "MBA fees ki tension hai",
  language: "hinglish",
  history: [],
  user_gender: "male",
};

void test("keep a contextual acknowledgment and question together instead of stripping warmth", async () => {
  const closing =
    "Night shift ke saath padhai aur fees sambhalna aasaan nahi lagta.\nAbhi fees ke liye koi scholarship ya ghar se support mil sakta hai?";
  const output = await contextualClosing(
    reading,
    { ...value, history: [{ role: "user", text: "Main night shift ke saath MBA karta hoon" }] },
    { generate: async () => closing },
  );
  assert.equal(output, reading + "\n\n" + closing.replace("\n", " "));
  assert.equal(output.split("\n\n").length, 3);
});

void test("prior companion question survives long astrology bubbles in delivered history", async () => {
  const previous =
    Array(500).fill("Astrology").join(" ") + "\n\nA long verdict.\n\nPayment kab hai?";
  await contextualClosing(
    reading,
    {
      ...value,
      query: "Payment agle hafte hai",
      history: [
        { role: "user", text: value.query },
        { role: "assistant", text: previous },
      ],
    },
    {
      generate: async (_prompt, data) => {
        const payload = JSON.parse(data);
        assert.equal(payload.history.at(-1).text, "Payment kab hai?");
        assert.doesNotMatch(data, /Astrology/);
        return "Agle hafte payment hai. Kya abhi kisi se support lene ki gunjaish hai?";
      },
    },
  );
});

void test("a known payment deadline is not asked again by the writer", async () => {
  const output = await contextualClosing(
    reading,
    { ...value, query: "MBA fees payment next week hai" },
    { generate: async () => "Fees kab deni hai?" },
  );
  assert.ok(output.startsWith(reading + "\n\n"));
  assert.doesNotMatch(output, /Fees kab deni/);
});

void test("a known family confidant is not asked again", async () => {
  const output = await contextualClosing(
    reading,
    { ...value, query: "Family rishte ke khilaaf hai. Mummy se baat kar sakta hoon." },
    { generate: async () => "Gharwalon mein kis se baat kar sakte ho?" },
  );
  assert.ok(output.startsWith(reading + "\n\n"));
  assert.doesNotMatch(output, /kis se baat/);
});

void test("celebrating does not require an interview question", async () => {
  const closing = "Yeh sunkar achha laga! Aaj is khushi ko thoda celebrate karna banta hai.";
  const output = await contextualClosing(
    reading,
    { ...value, query: "Job mil gayi, bahut khush hoon!" },
    { generate: async () => closing },
  );
  assert.equal(output, reading + "\n\n" + closing);
});

void test("friendship does not mean unearned approval of a major decision", async () => {
  const output = await contextualClosing(
    reading,
    { ...value, query: "MBA chhod diya, job pe focus hai" },
    { generate: async () => "MBA chhodne ka faisla bilkul sahi hai. Konsi job chahiye?" },
  );
  assert.ok(output.startsWith(reading + "\n\n"));
  assert.doesNotMatch(output, /bilkul sahi/);
});

void test("a warm opening cannot hide an unrelated final question", async () => {
  const output = await contextualClosing(reading, value, {
    generate: async () => "Fees ki tension samajh aati hai. Kya aaj koi aarzoo poori hui?",
  });
  assert.ok(output.startsWith(reading + "\n\n"));
  assert.doesNotMatch(output, /aarzoo/);
  assert.match(output, /Fees.*payment/);
});

void test("reject fanciful praise of a workload struggle", async () => {
  const output = await contextualClosing(
    reading,
    { ...value, query: "MBA ke saath time manage karna mushkil hai" },
    {
      generate: async () =>
        "Padhai ka jadu toh bas aapke liye hi hai. Din mein waqt kab milta hai?",
    },
  );
  assert.ok(output.startsWith(reading + "\n\n"));
  assert.doesNotMatch(output, /jadu/);
});
