import test from "node:test";
import assert from "node:assert/strict";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";

const base = "Original astrology explanation.\n\nOriginal short verdict.";
const value = { language: "hinglish", user_gender: "male", history: [] };

async function closing(query, raw, extra = {}) {
  const result = await contextualClosing(
    base,
    { ...value, query, ...extra },
    {
      generate: async () => raw,
    },
  );
  assert.equal(result.slice(0, base.length), base);
  assert.equal(result.split("\n\n").length, 3);
  return result.slice(base.length + 2);
}

void test("grounded pronoun questions keep the personal writer reply", async () => {
  const query =
    "Gharwale rishte ke khilaaf hain. Mummy se baat kar sakta hoon, papa se baat karne mein darr lagta hai.";
  const raw =
    "Papa se baat karne mein darr lag raha hai. Unke kis reaction ki sabse zyada fikr hai?";
  assert.equal(await closing(query, raw), raw);
});

void test("family fallback follows the named fear instead of resetting the topic", async () => {
  const result = await closing(
    "Gharwale rishte ke khilaaf hain. Papa se baat karne mein darr lagta hai.",
    "NONE",
  );
  assert.match(result, /Papa.*reaction/);
  assert.doesNotMatch(result, /kis se|sabse mushkil/);
});

void test("a short answer about papa does not drift back to older study memories", async () => {
  const raw =
    "Papa se baat karna mushkil lag raha hai. Unse baat shuru karne mein kya cheez rok rahi hai?";
  assert.equal(
    await closing("Papa se baat karne mein darr lagta hai", raw, {
      history: [{ role: "user", text: "Main MBA karta hoon" }],
    }),
    raw,
  );
});

void test("unrelated wishes remain rejected despite a contextual opening", async () => {
  const raw = "Fees ki tension samajh aati hai. Kya aaj koi aarzoo poori hui?";
  assert.notEqual(await closing("MBA fees ki tension hai", raw), raw);
});

void test("writer outage while celebrating does not restart an interview", async () => {
  const result = await closing("Job mil gayi, bahut khush hoon!", "NONE");
  assert.match(result, /khushi/);
  assert.doesNotMatch(result, /\?|career|kaam.*badal/i);
});

void test("writer outage while venting stays supportive without a question", async () => {
  const result = await closing("Bahut udaas hoon, thak gaya hoon", "NONE");
  assert.doesNotMatch(result, /\?|sun rahi|yahan hoon|khushi/);
});

void test("a negated happy statement is not celebrated", async () => {
  const result = await closing("Job mili par happy nahi hoon", "NONE");
  assert.doesNotMatch(result, /khushi|achha laga/);
});

void test("new query does not revive a father's fear from older history", async () => {
  const result = await closing("Gharwale ab maan gaye, shaadi ke baare mein batao", "NONE", {
    history: [
      { role: "user", text: "Gharwale khilaaf hain, papa se baat karne mein darr lagta hai" },
    ],
  });
  assert.doesNotMatch(result, /reaction|darr/);
});

void test("acknowledging a stopped MBA is not mistaken for reviving study", async () => {
  const raw = "MBA chhod kar job pe focus karna ek bada step hai. Ab konsi job ki soch rahe ho?";
  assert.equal(await closing("MBA chhod diya, ab job pe focus hai", raw), raw);
  const stale = "MBA ki padhai ke liye kitna time milta hai?";
  assert.notEqual(await closing("MBA chhod diya, ab job pe focus hai", stale), stale);
});

void test("being able to talk to mummy does not mean that a conversation happened", async () => {
  const raw = "Mummy ke saath baat ho rahi hai, achha hai. Papa se baat mein kya dikkat hai?";
  const result = await closing(
    "Gharwale khilaaf hain. Mummy se baat kar sakta hoon, papa se darr lagta hai",
    raw,
  );
  assert.notEqual(result, raw);
  assert.doesNotMatch(result, /baat ho rahi/);
  assert.equal(await closing("Gharwale khilaaf hain. Mummy ke saath baat ho rahi hai", raw), raw);
});
