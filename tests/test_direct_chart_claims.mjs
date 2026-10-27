import assert from "node:assert/strict";
import test from "node:test";
import { chartClaimConflicts } from "../extensions/reviewed-reading/direct/chart-claims.mjs";
const chart = JSON.stringify({
  engine: "local-sweph-v2",
  dasha: {
    current_antardasha: { lord: "Moon" },
    upcoming_antardashas: [{ lord: "Mars" }, { lord: "Rahu" }, { lord: "Jupiter" }],
  },
});
const transit = JSON.stringify({
  engine: "local-sweph-v2",
  gochara: [
    { planet: "Saturn", over_natal_house: 5 },
    { planet: "Jupiter", over_natal_house: 9 },
  ],
});
void test("live Hinglish house labels receive the same placement checks as English", () => {
  const natal = JSON.stringify({
    engine: "local-sweph-v2",
    birth_chart: {
      planets: ["Saturn: Taurus | house 7", "Mercury: Sagittarius | house 2"],
    },
  });
  for (const text of [
    "10ve ghar mein Saturn hai.",
    "Saturn 10ve ghar mein hai.",
    "Mercury 5ve ghar mein hai.",
  ]) {
    assert.equal(chartClaimConflicts(text, [natal]).length, 1, text);
  }
  for (const text of [
    "Saturn 7ve ghar mein hai.",
    "7ve ghar mein Saturn hai.",
    "Saturn ki drishti 10ve ghar par hai.",
    "10ve ghar mein Saturn ki drishti hai.",
  ]) {
    assert.equal(chartClaimConflicts(text, [natal]).length, 0, text);
  }
});
void test("rejects observed natal planets relabelled as current transits", () => {
  assert.equal(
    chartClaimConflicts("Jupiter aur Saturn dono house 7 par transit kar rahe hain.", [
      chart,
      transit,
    ]).length,
    2,
  );
  assert.equal(chartClaimConflicts("Saturn house 5 mein transit hai.", [chart, transit]).length, 0);
  assert.equal(chartClaimConflicts("Saturn house 7 mein baitha hai.", [chart, transit]).length, 0);
  assert.equal(chartClaimConflicts("Saturn house 5 mein transit hai.", [chart]).length, 1);
  assert.equal(chartClaimConflicts("Saturn ki drishti house 7 par hai.", [chart]).length, 0);
});
void test("rejects skipping Rahu in the observed period sequence", () => {
  assert.equal(
    chartClaimConflicts("Mars antardasha ke baad Jupiter ka antardasha aayega.", [chart]).length,
    1,
  );
  assert.equal(
    chartClaimConflicts("Mars antardasha ke baad Rahu ka antardasha aayega.", [chart]).length,
    0,
  );
  assert.equal(
    chartClaimConflicts("Mars ka period hai. Jupiter supports relationships.", [chart]).length,
    0,
  );
  assert.equal(
    chartClaimConflicts("Mars antardasha ke baad Jupiter ka antardasha aayega.", ["not JSON"])
      .length,
    0,
  );
});

void test("plain combined placement claims are checked without treating aspects as placements", () => {
  const natal = JSON.stringify({
    engine: "local-sweph-v2",
    birth_chart: {
      planets: ["Jupiter: Taurus | house 7 | RETROGRADE", "Saturn: Taurus | house 7 | RETROGRADE"],
    },
  });
  assert.equal(
    chartClaimConflicts("Jupiter aur Saturn dono 9th house mein hain.", [natal, transit]).length,
    1,
  );
  assert.equal(
    chartClaimConflicts("Jupiter aur Saturn dono 7th house mein hain.", [natal]).length,
    0,
  );
  assert.equal(chartClaimConflicts("Saturn ki drishti house 9 par hai.", [natal]).length, 0);
  assert.equal(chartClaimConflicts("Saturn natal house 5 mein hai.", [natal, transit]).length, 1);
});

void test("reversed placement wording cannot move natal Jupiter into house four", () => {
  const natal = JSON.stringify({
    engine: "local-sweph-v2",
    birth_chart: { planets: ["Jupiter: Taurus | house 7 | RETROGRADE"] },
  });
  assert.equal(
    chartClaimConflicts("4th house ke strong Jupiter ka connection hai.", [natal]).length,
    1,
  );
  assert.equal(chartClaimConflicts("7th house mein Jupiter hai.", [natal]).length, 0);
  assert.equal(chartClaimConflicts("4th house mein Jupiter ki drishti hai.", [natal]).length, 0);
});
