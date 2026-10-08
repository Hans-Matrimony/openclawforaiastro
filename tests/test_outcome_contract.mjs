import assert from "node:assert/strict";
import fs from "node:fs";
import { Readable } from "node:stream";
import test from "node:test";
import {
  validReadingResult,
  validateReadingInput,
  createReadingHandler,
} from "../extensions/reviewed-reading/route.mjs";

const rows = JSON.parse(
  fs.readFileSync(new URL("./fixtures/outcome_wire.json", import.meta.url), "utf8"),
);
test("real v2 readings preserve all topic and presentation contracts", () => {
  for (const row of rows) {
    assert.equal(validReadingResult(row.result, row.request), true, JSON.stringify(row.request));
  }
  const [brief, standard] = rows;
  assert.ok(brief.result.text.length < standard.result.text.length);
  assert.doesNotMatch(brief.result.text, /\?|everything will be fine|will definitely/u);
});
test("contradictory subjects, rules, scopes, dates and period packets cannot be delivered", () => {
  const row = rows[1];
  const mutations = [
    (evidence) => {
      evidence.prediction_assessment.conclusion.scope = "partner_feelings";
    },
    (evidence) => {
      evidence.prediction_assessment.event.scope = "guaranteed_wedding";
    },
    (evidence) => {
      evidence.prediction_assessment.natal.reasons[0].fact = [];
    },
    (evidence) => {
      evidence.prediction_assessment.natal.reasons[0].fact.sign = "Pisces";
    },
    (evidence) => {
      evidence.prediction_assessment.natal.reasons[0].id = "invented";
    },
    (evidence) => {
      evidence.prediction_assessment.current_period.rule_id = "VenusJupiterPD2";
    },
    (evidence) => {
      evidence.prediction_assessment.current_period.start = "2026-02-30T00:00:00Z";
    },
    (evidence) => {
      evidence.prediction_assessment.event.windows[0].start = "2032-02-30T00:00:00Z";
    },
    (evidence) => {
      evidence.prediction_assessment.event.windows[0].antardasha = "Mars";
    },
    (evidence) => {
      evidence.prediction_assessment.event.windows[0].source = "https://unreviewed.invalid";
    },
    (evidence) => {
      evidence.prediction_assessment.event.windows[1] = structuredClone(
        evidence.prediction_assessment.event.windows[0],
      );
    },
    (evidence) => {
      evidence.as_of_utc = evidence.prediction_assessment.current_period.end;
    },
  ];
  for (const mutate of mutations) {
    const broken = structuredClone(row.result);
    mutate(broken.evidence);
    assert.equal(validReadingResult(broken, row.request), false);
  }
});
test("microseconds before a dasha boundary remain inside the current period", () => {
  const row = structuredClone(rows[1]);
  const end = row.result.evidence.prediction_assessment.current_period.end;
  row.result.evidence.as_of_utc = end.replace("327695Z", "327694Z");
  assert.notEqual(row.result.evidence.as_of_utc, end);
  assert.equal(validReadingResult(row.result, row.request), true);
});
test("finance and education timing require explicit v2 negotiation", () => {
  for (const topic of ["finance", "education"]) {
    const value = { dob: "2001-01-03", tob: "05:00", place: "Delhi", topic, intent: "timing" };
    assert.throws(() => validateReadingInput(value));
    assert.equal(validateReadingInput(value, 2), value);
  }
});
test("HTTP version negotiation preserves old clients and rejects ambiguous headers", async () => {
  for (const [header, expected] of [
    [undefined, 1],
    ["1", 1],
    ["2", 2],
    ["3", null],
    [["1", "2"], null],
  ]) {
    let observed;
    const handler = createReadingHandler(async (value, run, version) => {
      observed = version;
      return { schema: `reviewed-reading-v${version}` };
    });
    const req = Object.assign(
      Readable.from([
        JSON.stringify({ dob: "2001-01-03", tob: "05:00", place: "Delhi", topic: "career" }),
      ]),
      {
        method: "POST",
        headers: header === undefined ? {} : { "x-astro-reading-contract": header },
      },
    );
    const res = {
      writeHead(status) {
        this.status = status;
      },
      end() {
        this.writableEnded = true;
      },
      setHeader() {},
    };
    await handler(req, res);
    assert.equal(res.status, expected === null ? 400 : 200);
    assert.equal(observed, expected === null ? undefined : expected);
  }
});
