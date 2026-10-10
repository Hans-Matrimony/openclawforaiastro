import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { periodStatus, validWindowRule } from "../extensions/reviewed-reading/period-rules.mjs";
import { validReadingResult } from "../extensions/reviewed-reading/route.mjs";

const rows = JSON.parse(
  fs.readFileSync(new URL("./fixtures/extended_outcome_wire.json", import.meta.url), "utf8"),
);
void test("extended renderings preserve all topic contracts across major periods", () => {
  for (const row of rows) {
    assert.equal(validReadingResult(row.result, row.request), true, JSON.stringify(row.request));
  }
});
void test("expanded rules cannot escape revision, subject or reviewed event scope", () => {
  const row = rows.find((r) =>
    r.result.evidence.prediction_assessment.event.windows.some((w) => w.mahadasha === "Sun"),
  );
  for (const mutate of [
    (e) => {
      e.rules_revision = "reviewed-outcomes-v2";
    },
    (e) => {
      e.prediction_assessment.current_period.status = "unsupported";
      e.prediction_assessment.current_period.rule_id = null;
      e.prediction_assessment.current_period.source = null;
    },
    (e) => {
      Object.assign(e.prediction_assessment.event.windows[0], {
        mahadasha: "Rahu",
        antardasha: "Jupiter",
        rule_id: "RahuJupiterPD2",
      });
    },
    (e) => {
      Object.assign(e.prediction_assessment.event.windows[0], {
        mahadasha: "Mercury",
        antardasha: "Venus",
        rule_id: "MercuryVenusPD2",
      });
    },
  ]) {
    const broken = structuredClone(row.result);
    mutate(broken.evidence);
    assert.equal(validReadingResult(broken, row.request), false);
  }
});
void test("packaged period manifest equals the calculator source and excludes household marriages", () => {
  const file = new URL("../skills/kundli/period_rules.json", import.meta.url);
  const packaged = new URL("../extensions/reviewed-reading/period_rules.json", import.meta.url);
  assert.equal(fs.readFileSync(file, "utf8"), fs.readFileSync(packaged, "utf8"));
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(file)).rules).length, 81);
  assert.equal(
    validWindowRule({ mahadasha: "Rahu", antardasha: "Jupiter", rule_id: "RahuJupiterPD2" }, true),
    false,
  );
  assert.equal(periodStatus("Mercury", "Jupiter", "career", true), "limited");
  assert.equal(periodStatus("Mercury", "Jupiter", "marriage"), undefined);
});
