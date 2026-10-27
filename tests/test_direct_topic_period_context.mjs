import assert from "node:assert/strict";
import test from "node:test";
import { chartClaimConflicts } from "../extensions/reviewed-reading/direct/chart-claims.mjs";
import {
  topicPeriodContext,
  unsupportedTopicOpportunity,
} from "../extensions/reviewed-reading/direct/topic-period-context.mjs";
const row = {
  engine: "local-sweph-v2",
  birth_chart: {
    planets: ["Mars: Libra | house 12", "Jupiter: Taurus | house 7"],
    ashtakavarga_house_bindus: {
      house_7: { sign: "Taurus" },
      house_10: { sign: "Leo" },
      house_2: { sign: "Sagittarius" },
      house_11: { sign: "Virgo" },
    },
  },
  dasha: {
    upcoming_antardashas: [
      { lord: "Mars", from: "2027-09-15", to: "2028-11-14" },
      { lord: "Jupiter", from: "2031-11-15", to: "2034-07-16" },
    ],
  },
  verdict_signals: [
    {
      area: "marriage",
      positive: ["benefic Jupiter house 7 mein"],
      negative: ["Mars ki drishti house 7 par pressure/delay"],
    },
    { area: "money", positive: [], negative: [] },
  ],
};
const results = [JSON.stringify(row)];
function data(query) {
  const text = topicPeriodContext(results, query);
  return JSON.parse(text.split("): ")[1].split("\n")[0]);
}
test("marriage comparison preserves adverse first period and later supportive period", () => {
  const d = data("Meri shaadi kab hogi?");
  assert.equal(d.periods[0].supportive_factors.length, 0);
  assert.equal(d.periods[0].adverse_factors.length, 1);
  assert.equal(d.periods[1].supportive_factors.length, 1);
  assert.equal(d.periods[1].occupies_relevant_house, 7);
});
test("money and girlfriend evidence retain distinct subjects", () => {
  const money = data("Paise kab aayenge?");
  assert.deepEqual(money.periods[1].relevant_house_lord, [2]);
  assert.equal(money.periods[0].adverse_factors.length, 0);
  assert.equal(data("GF kab banegi?").topic, "relationship");
});
test("missing, conflicting and multiple-topic evidence is not combined", () => {
  assert.equal(topicPeriodContext([], "shaadi kab"), "");
  assert.equal(topicPeriodContext(results, "shaadi aur job kab"), "");
  assert.equal(
    topicPeriodContext([...results, JSON.stringify({ ...row, birth_chart: {} })], "shaadi kab"),
    "",
  );
  assert.equal(topicPeriodContext(["bad json"], "shaadi kab"), "");
});

test("live pressure-only Mars opportunity is rejected without suppressing supported Jupiter", () => {
  assert.equal(
    unsupportedTopicOpportunity(
      "Mars antardasha September 2027 se November 2028 shaadi sambhavna hai",
      results,
      "shaadi kab",
    ),
    true,
  );
  assert.equal(
    unsupportedTopicOpportunity(
      "Jupiter antardasha November 2031 se July 2034 shaadi sambhavna hai",
      results,
      "shaadi kab",
    ),
    false,
  );
  assert.equal(
    unsupportedTopicOpportunity(
      "Mars antardasha September 2027 se November 2028 hai",
      results,
      "shaadi kab",
    ),
    false,
  );
});

test("a known natal planet with no career relationship cannot justify a job window", () => {
  assert.equal(
    unsupportedTopicOpportunity(
      "Mars antardasha September 2027 se November 2028 job lagegi",
      results,
      "job kab",
    ),
    true,
  );
});

test("adverse interpretation is preserved rather than forced into positive timing", () => {
  assert.equal(
    unsupportedTopicOpportunity(
      "Mars antardasha September 2027 se November 2028 mein shaadi ki sambhavna kam hai.",
      results,
      "shaadi kab",
    ),
    false,
  );
});

test("live future-aspect and linked house-lord explanations are rejected", () => {
  assert.ok(
    chartClaimConflicts("jab Mars ki drishti 10ve ghar par aayegi", results).some(
      (c) => c.type === "unsupported_future_aspect",
    ),
  );
  assert.ok(
    chartClaimConflicts("Jupiter ek benefic hai aur 7ve ghar ka lord bhi hai", results).some(
      (c) => c.type === "linked_house_lord",
    ),
  );
  assert.equal(chartClaimConflicts("Jupiter 7ve ghar mein hai", results).length, 0);
});
