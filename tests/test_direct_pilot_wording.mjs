import assert from "node:assert/strict";
import test from "node:test";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";
import { formatDisplayReply } from "../extensions/reviewed-reading/direct/format-reply.mjs";

test("captured house-score variants preserve strength, dates and bubble boundaries", () => {
  for (const strength of ["bahut kam", "kamzor", "weak", "strong"]) {
    for (const score of ["sirf 20 hai", "bindus sirf 20 hain", "sirf 20 bindus hai"]) {
      const suffix =
        ", aur Saturn bhi yahan baitha hai.\n\nSeptember 2027 se November 2028 ke beech sambhavna hai.";
      const result = formatDisplayReply(`7ve ghar ka ${score} ${strength} sahyog${suffix}`);
      assert.equal(result, `7ve ghar mein ${strength} sahyog hai${suffix}`);
      assert.equal(formatDisplayReply(result), result);
    }
  }
  for (const unchanged of [
    "7ve ghar ka kharcha sirf 20 lakh hai.",
    "Meri age sirf 20 hai.",
    "2031 se 2034 ke beech.",
    "`7ve ghar ka sirf 20 hai bahut kam sahyog`",
    '{"score":20}',
  ]) {
    assert.equal(formatDisplayReply(unchanged), unchanged);
  }
});

test("captured companion grammar is repaired without rewriting the reading or copying bad history", async () => {
  const reading =
    "Guru aur Shani 7ve ghar mein hain.\n\nSeptember 2027 se November 2028 ke beech sambhavna hai.";
  const bad = "kya aapne kisi ko apni baat abhi tak khuli hai, ya phir abhi bhi soch rahe hain?";
  const value = {
    query: "Meri shaadi kab hogi?",
    language: "hinglish",
    user_gender: "male",
    history: [
      { role: "user", text: "Meri shaadi kab hogi?" },
      { role: "assistant", text: reading + "\n\n" + bad },
    ],
  };
  let payload;
  const result = await contextualClosing(reading, value, {
    generate: async (_prompt, data) => {
      payload = data;
      return bad;
    },
  });
  assert.equal(
    result,
    reading +
      "\n\n" +
      "kya aapne kisi se abhi tak apni baat kahi hai, ya phir abhi bhi soch rahe hain?",
  );
  assert.ok(!payload.includes("khuli hai"));
});
