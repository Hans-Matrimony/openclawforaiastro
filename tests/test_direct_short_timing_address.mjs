import assert from "node:assert/strict";
import test from "node:test";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";
import { evidenceFallback } from "../extensions/reviewed-reading/direct/evidence-fallback.mjs";
import { personaInstruction } from "../extensions/reviewed-reading/direct/persona.mjs";
import { isPersonalChartQuestion } from "../extensions/reviewed-reading/direct/reading-intent.mjs";

void test("address corrections do not bypass personal reading checks; relatives still use their own profile", () => {
  assert.equal(
    isPersonalChartQuestion(
      "Meri shaadi ke timing ke baare mein batao, aur mujhe mere naam se bulao, bhai mat bolo.",
    ),
    true,
  );
  assert.equal(isPersonalChartQuestion("When will I marry? Don't call me brother."), true);
  assert.equal(isPersonalChartQuestion("Mere bhai ki shaadi kab hogi?"), false);
  assert.equal(isPersonalChartQuestion("When will my brother marry? Don't call me bro."), false);
});

void test("kb gets the same checked schedule as kab without inventing a marriage date", () => {
  const row = {
    engine: "local-sweph-v2",
    verdict_signals: [{ area: "marriage", trend: "MIXED" }],
    dasha: { upcoming_antardashas: [{ lord: "Mars", from: "2027-09-15", to: "2028-11-14" }] },
  };
  const render = (query, data = row) =>
    evidenceFallback([JSON.stringify(data)], "hinglish", query, new Date("2026-10-26T00:00:00Z"));
  assert.equal(render("Shaadi kb hogi"), render("Shaadi kab hogi"));
  assert.match(render("Shaadi kb hogi"), /2027-09-15/);
  assert.doesNotMatch(render("Shaadi kb hogi", { ...row, dasha: undefined }), /2027/);
});

void test("companion rejects bhai and backstory filler without touching reading", async () => {
  const base = "Calculated reading stays intact.\n\nOriginal verdict stays intact.";
  for (const text of [
    "Bhai, kya aapne unse baat ki hai?",
    "Tumhari backstory sun ke lagta hai kya aapne crush se baat ki hai?",
    "Pilot Test, abhi aapki zindagi mein koi naya rishta shuru hone wala hai?",
  ]) {
    const result = await contextualClosing(
      base,
      { query: "Shaadi kb hogi", language: "hinglish", history: [] },
      { generate: async () => text },
    );
    assert.ok(result.startsWith(base + "\n\n"));
    assert.ok(!result.includes(text));
  }
});

void test("known name passes and all personas prohibit invented names and bhai", async () => {
  for (const user_gender of ["male", "female", undefined]) {
    assert.match(personaInstruction({ user_gender }), /Do not address the user as bhai/);
  }
  const base = "Reading.\n\nVerdict.";
  const question = "Rohan, kya aap kisi khaas rishte ke baare mein soch rahe hain?";
  const output = await contextualClosing(
    base,
    {
      query: "Shaadi kb hogi",
      language: "hinglish",
      history: [{ role: "user", text: "Mera naam Rohan hai" }],
    },
    { generate: async () => question },
  );
  assert.equal(output, base + "\n\n" + question);
});
