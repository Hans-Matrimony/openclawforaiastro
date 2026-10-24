import test from "node:test";
import assert from "node:assert/strict";
import { evidenceFallback } from "../extensions/reviewed-reading/direct/evidence-fallback.mjs";
import { unsupportedClosingDetail } from "../extensions/reviewed-reading/direct/companion-context.mjs";
import { formatDisplayReply } from "../extensions/reviewed-reading/direct/format-reply.mjs";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";

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
