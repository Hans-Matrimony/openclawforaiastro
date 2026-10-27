import assert from "node:assert/strict";
import test from "node:test";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";

const reading =
  "Guru ka 7ve ghar mein hona sahyog ka sanket hai.\n\nNovember 2031 se July 2034: shaadi ki sambhavna hai.";
const value = { query: "shaadi kb hogi", language: "hinglish", history: [] };
const observed =
  "Aap jo bhi soch rahe hain, woh sab kuchh sahi hai... abhi aap kis baat ko lekar sabse zyada dhire dhire soch rahe hain?";

async function close(generated, input = value, facts = []) {
  let calls = 0;
  const result = await contextualClosing(reading, input, {
    facts,
    generate: async () => {
      calls++;
      return generated;
    },
  });
  assert.equal(calls, 1, "No extra model request for a rejected closing");
  assert.equal(result.split("\n\n").slice(0, 2).join("\n\n"), reading);
  assert.equal(result.split("\n\n").length, 3);
  return result.split("\n\n")[2];
}

test("captured awkward reassurance becomes a relevant marriage follow-up", async () => {
  const result = await close(observed);
  assert.match(result, /shaadi|rishte/i);
  assert.match(result, /\?$/);
  assert.doesNotMatch(result, /sab kuchh sahi|dhire|crush/i);
});

test("blanket approval is rejected across reply languages", async () => {
  for (const [language, query, generated] of [
    [
      "hinglish",
      "shaadi kb hogi",
      "Aap jo bhi soch rahe hain, sab sahi hai. Shaadi ko lekar kya chahte hain?",
    ],
    [
      "english",
      "When will I marry?",
      "Everything you think is right. What do you want in a marriage?",
    ],
    ["hindi", "मेरी शादी कब होगी?", "आप जो भी सोचते हैं, सब कुछ सही है। शादी से आपकी क्या उम्मीद है?"],
  ]) {
    const result = await close(generated, { ...value, language, query });
    assert.notEqual(result, generated);
    assert.match(result, /[?？]$/);
  }
});

test("rejected closing still uses family history and fee memory without reasking known details", async () => {
  const family = await close(observed, {
    ...value,
    history: [
      { role: "user", text: "Gharwale shaadi ke khilaaf hain. Mummy se baat kar sakta hoon." },
    ],
  });
  assert.match(family, /ghar|family/i);
  assert.doesNotMatch(family, /kis se|kisse/i);
  const fees = await close(
    observed,
    {
      ...value,
      query: "Padhai aur fees ki tension hai",
    },
    ["Agle hafte fees bharni hai"],
  );
  assert.match(fees, /fees/i);
  assert.doesNotMatch(fees, /kareeb|kab|coming up/i);
});

test("bad prior companion is excluded without deleting user history or valid companion context", async () => {
  const good = "Shaadi ko lekar aapki apni kya soch hai?";
  const disclosure = "Mummy kehti hain jo bhi soch rahe ho sab sahi hai";
  let payload;
  await contextualClosing(
    reading,
    {
      ...value,
      history: [
        { role: "user", text: disclosure },
        { role: "assistant", text: reading + "\n\n" + observed },
        { role: "assistant", text: reading + "\n\n" + good },
      ],
    },
    {
      generate: async (_prompt, body) => {
        payload = JSON.parse(body);
        return "Shaadi ki baat ghar par chal rahi hai?";
      },
    },
  );
  assert.ok(payload.history.some((turn) => turn.text === disclosure));
  assert.ok(payload.history.some((turn) => turn.text === good));
  assert.ok(!payload.history.some((turn) => turn.text === observed));
});

test("natural empathy and concrete questions remain verbatim", async () => {
  const good = "Shaadi ko lekar aapki apni kya soch hai?";
  assert.equal(await close(good), good);
  const empathetic = "That sounds stressful. Would talking through the fees help?";
  assert.equal(
    await close(empathetic, {
      query: "The fees are stressing me out. What can I do?",
      language: "english",
      history: [],
    }),
    empathetic,
  );
});
