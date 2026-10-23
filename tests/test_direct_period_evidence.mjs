import test from "node:test";
import assert from "node:assert/strict";
import { unsupportedPeriodClaim } from "../extensions/reviewed-reading/direct/period-evidence.mjs";
import { isOrdinaryConcern } from "../extensions/reviewed-reading/direct/reading-intent.mjs";
import { unsupportedClosingDetail } from "../extensions/reviewed-reading/direct/companion-context.mjs";

void test("upcoming source antardashas are accepted without confusing next mahadasha", () => {
  const evidence = [
    JSON.stringify({
      dasha: {
        current_antardasha: { lord: "Moon", from: "2025-01-01" },
        upcoming_antardashas: [{ lord: "Mars", from: "2027-06-01", to: "2028-08-01" }],
        next_mahadasha: { lord: "Sun", from: "2038-01-01" },
      },
    }),
  ];
  assert.equal(unsupportedPeriodClaim("Mars antardasha starts in 2027.", evidence), false);
  assert.equal(unsupportedPeriodClaim("Mars antardasha starts in 2026.", evidence), true);
  assert.equal(unsupportedPeriodClaim("Sun antardasha starts in 2038.", evidence), true);
});

void test("explicit period start years must match the supplied schedule", () => {
  const evidence = [
    JSON.stringify({ dasha: { antardashas: [{ lord: "Jupiter", from: "2031-11-15" }] } }),
  ];
  assert.equal(
    unsupportedPeriodClaim("2027 mein Jupiter ki antardasha shuru hogi.", evidence),
    true,
  );
  assert.equal(
    unsupportedPeriodClaim("2031 mein Jupiter ki antardasha shuru hogi.", evidence),
    false,
  );
});

void test("fee sharing is ordinary conversation while timing requests remain readings", () => {
  assert.equal(
    isOrdinaryConcern(
      "Main night shift mein kaam karta hoon aur MBA ki fees ko lekar pareshan hoon.",
    ),
    true,
  );
  assert.equal(isOrdinaryConcern("Abhi sabse zyada fees ki tension hai, time ki nahi."), true);
  assert.equal(isOrdinaryConcern("Fees ki tension kab kam hogi?"), false);
  assert.equal(isOrdinaryConcern("Kundli se batao meri tension kab kam hogi"), false);
});

void test("parent disagreement is not evidence of fear", () => {
  const value = {
    query: "Meri shaadi kab hogi?",
    history: [{ role: "user", text: "Papa agree nahi karte" }],
  };
  assert.equal(
    unsupportedClosingDetail("Papa se baat karne mein darr lag raha hai?", value, []),
    true,
  );
  assert.equal(
    unsupportedClosingDetail(
      "Papa se baat karne mein darr lag raha hai?",
      { ...value, query: "Mujhe papa se darr lagta hai" },
      [],
    ),
    false,
  );
});

void test("future period names require actual antardasha evidence, not a mahadasha name", () => {
  const evidence = [
    JSON.stringify({
      dasha: { current_mahadasha: { lord: "Venus" }, current_antardasha: { lord: "Moon" } },
    }),
  ];
  assert.equal(
    unsupportedPeriodClaim("2027 ke baad Jupiter ki antardasha shuru hogi.", evidence),
    true,
  );
  assert.equal(unsupportedPeriodClaim("Venus ki antardasha shuru hogi.", evidence), true);
  assert.equal(unsupportedPeriodClaim("Moon antardasha starts now.", evidence), false);
  assert.equal(unsupportedPeriodClaim("Jupiter supports work.", evidence), false);
  assert.equal(
    unsupportedPeriodClaim("Jupiter ki antardasha shuru hogi.", [
      JSON.stringify({ dasha: { antardashas: [{ lord: "Jupiter" }] } }),
    ]),
    false,
  );
});
