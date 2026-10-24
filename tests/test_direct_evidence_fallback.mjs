import test from "node:test";
import assert from "node:assert/strict";
import { evidenceFallback } from "../extensions/reviewed-reading/direct/evidence-fallback.mjs";
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
