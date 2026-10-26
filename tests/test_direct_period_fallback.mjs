import assert from "node:assert/strict";
import test from "node:test";
import { evidenceFallback } from "../extensions/reviewed-reading/direct/evidence-fallback.mjs";
import { periodFallback } from "../extensions/reviewed-reading/direct/period-fallback.mjs";

const now = new Date("2026-10-25T12:00:00Z");
const period = { lord: "Mars", from: "2027-09-15", to: "2028-11-14" };
const row = (periods) => ({ engine: "local-sweph-v2", dasha: { upcoming_antardashas: periods } });

void test("upcoming-only evidence works in both languages without turning a schedule into an event", () => {
  for (const language of ["english", "hinglish"]) {
    const answer = evidenceFallback([JSON.stringify(row([period]))], language, "", now);
    assert.match(answer, /Mars.*2027-09-15.*2028-11-14/);
    assert.match(answer, /sub-period runs|antardasha/);
    assert.doesNotMatch(
      answer,
      /not an event prediction|event ki bhavishyavani nahi|shaadi hogi|will marry/,
    );
  }
});

void test("invalid, past, reversed, and unknown-planet windows do not enter displayed fallback", () => {
  for (const invalid of [
    { ...period, from: "2025-01-01", to: "2026-01-01" },
    { ...period, from: "2027-02-30" },
    { ...period, from: "2029-01-01" },
    { ...period, to: period.from },
    { ...period, lord: "Unknown" },
    { ...period, from: null },
  ]) {
    assert.equal(periodFallback([row([invalid])], "english", now), "");
  }
  assert.equal(periodFallback([row([period])], "english", new Date("bad")), "");
});

void test("different schedules or different birth subjects cannot supply a shared fallback date", () => {
  assert.equal(
    periodFallback([row([period]), row([{ ...period, lord: "Moon" }])], "english", now),
    "",
  );
  assert.equal(
    periodFallback(
      [
        { ...row([period]), birth_chart: { subject: "one" } },
        { ...row([period]), birth_chart: { subject: "two" } },
      ],
      "english",
      now,
    ),
    "",
  );
});

void test("fallback rejects malformed factors and avoids conclusions across different subjects", () => {
  for (const verdict_signals of [[null], {}, "invalid"]) {
    assert.match(
      evidenceFallback(
        [JSON.stringify({ ...row([period]), verdict_signals })],
        "english",
        "Marriage",
        now,
      ),
      /calculated Mars sub-period/,
    );
  }
  const verdict_signals = [{ area: "marriage", trend: "POSITIVE", positive: [], negative: [] }];
  const results = ["one", "two"].map((subject) =>
    JSON.stringify({ ...row([period]), birth_chart: { subject }, verdict_signals }),
  );
  assert.match(evidenceFallback(results, "english", "Marriage", now), /could not be reconciled/);
});

void test("earliest valid future period is sorted; current period must contain the current India date", () => {
  assert.match(
    periodFallback(
      [row([{ lord: "Moon", from: "2029-01-01", to: "2030-01-01" }, period])],
      "english",
      now,
    ),
    /Mars/,
  );
  const current = (from, to) => [{ dasha: { current_antardasha: { lord: "Moon", from, to } } }];
  assert.match(
    periodFallback(current("2026-01-01", "2027-01-01"), "english", now),
    /Moon.*2027-01-01/,
  );
  assert.equal(periodFallback(current("2027-01-01", "2028-01-01"), "english", now), "");
  assert.equal(
    periodFallback(
      current("2026-01-01", "2026-10-25"),
      "english",
      new Date("2026-10-25T20:00:00Z"),
    ),
    "",
  );
});
