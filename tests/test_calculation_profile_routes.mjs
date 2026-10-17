import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { validReadingResult } from "../extensions/reviewed-reading/route.mjs";
import { validDailyEvidence } from "../extensions/reviewed-reading/daily-route.mjs";

const daily = JSON.parse(
  fs.readFileSync(new URL("./fixtures/vedastro_daily_synthetic.json", import.meta.url)),
).evidence;
const value = { topic: "career" };
const dailyValue = { date: "2026-10-11" };
function reading(ayanamsa, days) {
  return {
    schema: "reviewed-reading-v1",
    text: "Synthetic contract example",
    model_calls: 0,
    model_tokens: 0,
    language: "english",
    intent: "overview",
    evidence: {
      schema: "topic-reading-v1",
      rules_revision: "reviewed-placements-v1",
      topic: "career",
      input_fingerprint: "a".repeat(64),
      settings: {
        ayanamsa,
        dasha_year_days: days,
        house_system: "whole_sign",
        node: "true",
        engine: "pyswisseph",
      },
      period_interpretation_available: false,
      factors: [{ fact: { planet: "Mars", house: 2 }, source: "vedastro_classical" }],
    },
  };
}
function profile(selected, environment, check) {
  const keys = ["VEDASTRO_NATIVE_PROFILE", "VEDASTRO_NATIVE_PROFILE_ENVIRONMENT"];
  const before = keys.map((key) => process.env[key]);
  try {
    process.env[keys[0]] = selected;
    process.env[keys[1]] = environment;
    check();
  } finally {
    keys.forEach((key, i) => {
      if (before[i] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = before[i];
      }
    });
  }
}

void test("reading delivery accepts exactly the configured profile", () => {
  profile("lahiri365_25", "", () => {
    assert.equal(validReadingResult(reading("LAHIRI", 365.25), value), true);
    assert.equal(validReadingResult(reading("RAMAN", 360), value), false);
  });
  profile("raman360", "development", () => {
    assert.equal(validReadingResult(reading("RAMAN", 360), value), true);
    assert.equal(validReadingResult(reading("LAHIRI", 365.25), value), false);
    assert.equal(validReadingResult(reading("RAMAN", 365.25), value), false);
  });
});

void test("non-development and unknown profiles cannot admit a reading", () => {
  for (const [name, environment] of [
    ["raman360", "production"],
    ["raman360", ""],
    ["unknown", "development"],
  ]) {
    profile(name, environment, () => {
      assert.equal(validReadingResult(reading("LAHIRI", 365.25), value), false);
      assert.equal(validReadingResult(reading("RAMAN", 360), value), false);
    });
  }
});

void test("daily contract binds its period convention to the configured settings", () => {
  // This is a schema/profile mutation check; real Raman geometry is tested separately.
  const raman = structuredClone(daily);
  raman.native_settings.ayanamsa = "RAMAN";
  raman.native_settings.dasha_year_days = 360;
  raman.current_period.year_days = 360;
  profile("lahiri365_25", "", () => {
    assert.equal(validDailyEvidence(daily, dailyValue), true);
    assert.equal(validDailyEvidence(raman, dailyValue), false);
  });
  profile("raman360", "development", () => {
    assert.equal(validDailyEvidence(raman, dailyValue), true);
    assert.equal(validDailyEvidence(daily, dailyValue), false);
    raman.current_period.year_days = 365.25;
    assert.equal(validDailyEvidence(raman, dailyValue), false);
  });
});
