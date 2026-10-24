import test from "node:test";
import assert from "node:assert/strict";
import { evidenceFallback } from "../extensions/reviewed-reading/direct/evidence-fallback.mjs";
import { unsupportedClosingDetail } from "../extensions/reviewed-reading/direct/companion-context.mjs";
import { formatDisplayReply } from "../extensions/reviewed-reading/direct/format-reply.mjs";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";
import { fallbackFactor } from "../extensions/reviewed-reading/direct/fallback-factors.mjs";

void test("observed source factors become complete sentences without scores or raw labels", () => {
  const row = {
    engine: "local-sweph-v2",
    verdict_signals: [
      {
        area: "money",
        trend: "MIXED",
        positive: ["house 2 (Sagittarius) bindus 29/48 — strong support"],
        negative: ["malefic Ketu house 2 mein baitha hai"],
      },
    ],
  };
  const answer = evidenceFallback([JSON.stringify(row)], "hinglish", "Paise kab behtar honge?");
  assert.match(answer, /2ve ghar se achha sahyog milta hai/);
  assert.match(answer, /Ketu ka 2ve ghar mein hona rukawat ka sanket hai/);
  assert.doesNotMatch(answer, /strong support|malefic|bindus|29|2027|event ki date/);
  assert.equal(answer.split("\n\n").length, 2);
  row.verdict_signals[0] = {
    area: "marriage",
    trend: "MIXED",
    positive: ["benefic Jupiter house 7 mein"],
    negative: ["house 7 (Taurus) bindus sirf 20/48 — weak support"],
  };
  const marriage = evidenceFallback([JSON.stringify(row)], "hinglish", "Shaadi kab hogi?");
  assert.match(marriage, /Guru ka 7ve ghar/);
  assert.match(marriage, /7ve ghar se kam sahyog/);
  assert.doesNotMatch(marriage, /specific mahina|saal nahi mila/);
  assert.match(marriage, /Shaadi ka samay/);
  assert.match(marriage, /period data nahi aaya/);
  assert.doesNotMatch(marriage, /saaf nahi dikh raha|Finance|20\/48|benefic|weak support/);
});

void test("unrecognized factors are omitted rather than assigned an invented meaning", () => {
  assert.equal(fallbackFactor("unverified Jupiter implies a lottery win", false), null);
  assert.equal(fallbackFactor(null, false), null);
  assert.equal(fallbackFactor("benefic Unknown house 7 mein", false), null);
});

void test("observed companion chart claim cannot extend the reading", async () => {
  const base = "Original reading.\n\nOriginal verdict.";
  const result = await contextualClosing(
    base,
    { query: "Meri shaadi kab hogi?", language: "hinglish", history: [] },
    {
      generate: async () =>
        "Tere chart mein shaadi ka signal slow hai, lekin emotional readiness badh rahi hai. Kya tum kisi se connect kar rahe ho?",
    },
  );
  assert.ok(result.startsWith(base + "\n\n"));
  assert.doesNotMatch(result, /chart|emotional readiness/);
  assert.equal(result.split("\n\n").length, 3);
});

void test("observed technical score is removed only from displayed prose", () => {
  const text = "House 7 ka ashtakavarga sirf 20 hai, jo bahut kam hai.\n\nMars 2027 mein hai.";
  const shown = formatDisplayReply(text);
  assert.doesNotMatch(shown, /ashtakavarga|20 hai/);
  assert.match(shown, /House 7|2027/);
  assert.equal(shown.split("\n\n").length, 2);
});

void test("career question is not evidence of current employment", () => {
  const value = { query: "Which career fields suit me?", history: [] };
  const closing = "Abhi jo bhi kaam kar rahe ho, usme kya pasand hai?";
  assert.equal(unsupportedClosingDetail(closing, value, []), true);
  assert.equal(unsupportedClosingDetail(closing, value, ["I am working nights"]), false);
});

void test("finance fallback preserves mixed factors without another generic event disclaimer", () => {
  const row = {
    engine: "local-sweph-v2",
    verdict_signals: [
      {
        area: "money",
        trend: "MIXED",
        positive: ["Strong second house"],
        negative: ["Ketu in house 2"],
      },
    ],
  };
  const reply = evidenceFallback([JSON.stringify(row)], "hinglish", "Paise kab behtar honge?");
  assert.match(reply, /sahyog bhi hai aur rukawatein bhi/);
  assert.match(reply, /Paise ki sthiti/);
  assert.doesNotMatch(reply, /2027|event ki date/);
});
void test("unrepaired reading provides only supported period facts", () => {
  const evidence = JSON.stringify({
    engine: "local-sweph-v2",
    dasha: { current_antardasha: { lord: "Moon", to: "2027-09-15" } },
  });
  assert.match(evidenceFallback([evidence], "english"), /Moon.*2027-09-15/);
  assert.doesNotMatch(evidenceFallback([evidence], "english"), /will improve|will marry/);
  assert.doesNotMatch(
    evidenceFallback([evidence, evidence.replace("Moon", "Mars")], "english"),
    /Moon|Mars/,
  );
  assert.doesNotMatch(evidenceFallback(["bad JSON"], "hinglish"), /2027/);
});

void test("career fields fallback preserves topic factors without an unrelated timing disclaimer", () => {
  const evidence = JSON.stringify({
    engine: "local-sweph-v2",
    verdict_signals: [
      {
        area: "career",
        trend: "MIXED",
        positive: ["Strong tenth house"],
        negative: ["Current support is limited"],
      },
    ],
  });
  const answer = evidenceFallback([evidence], "english", "Which career fields suit me?");
  assert.match(answer, /Career.*mixed/);
  assert.match(answer, /Strong tenth house/);
  assert.doesNotMatch(answer, /event date|2027/);
});
