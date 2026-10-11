import assert from "node:assert/strict";
import fs from "node:fs";
import { Readable } from "node:stream";
import test from "node:test";
import {
  calculateDaily,
  createDailyHandler,
  validateDailyInput,
  validDailyEvidence,
} from "../extensions/reviewed-reading/daily-route.mjs";
import { createReadingHandler } from "../extensions/reviewed-reading/route.mjs";

const fixture = JSON.parse(
  fs.readFileSync(new URL("./fixtures/vedastro_daily_synthetic.json", import.meta.url)),
);
const vedhaFixture = JSON.parse(
  fs.readFileSync(new URL("./fixtures/vedastro_daily_vedha_synthetic.json", import.meta.url)),
);
const value = {
  dob: "1995-03-14",
  tob: "10:15",
  place: "Delhi",
  language: "english",
  date: "2026-10-11",
};
const result = {
  language: "english",
  prediction: "A mixed traditional reading.",
  evidence: fixture.evidence,
};

void test("real native fixture is accepted; date, source, frame and score corruption rejected", () => {
  assert.equal(validDailyEvidence(fixture.evidence, value), true);
  for (const [field, changed] of [
    ["source_revision", "unverified"],
    ["as_of_utc", "2026-10-11T00:00:00+00:00"],
    ["transit_house_reference", "ascendant"],
    ["event_prediction_available", true],
  ]) {
    const bad = structuredClone(fixture.evidence);
    bad[field] = changed;
    assert.equal(validDailyEvidence(bad, value), false);
  }
  const bad = structuredClone(fixture.evidence);
  bad.kakshas.Sun.kaksha_score = true;
  assert.equal(validDailyEvidence(bad, value), false);
});

void test("opt-in native Vedha requires corrected point occupancy and preserves pair exceptions", () => {
  assert.equal(validDailyEvidence(vedhaFixture.evidence, value), true);
  for (const [field, changed] of [
    ["occupancy_correction", "query_transit_house"],
    ["source_revision", "unknown"],
    ["house_reference", "ascendant"],
    ["planet_scope", "nine_planets"],
    ["event_prediction_available", true],
  ]) {
    const bad = structuredClone(vedhaFixture.evidence);
    bad.gochara_vedha[field] = changed;
    assert.equal(validDailyEvidence(bad, value), false);
  }
  for (const [field, changed] of [
    ["obstruction_house_from_natal_moon", true],
    ["obstructing_planets", ["Mercury"]],
    ["obstructing_planets", ["Rahu"]],
    ["obstructed", false],
    ["exempt_planets_at_point", ["Moon"]],
  ]) {
    const bad = structuredClone(vedhaFixture.evidence);
    bad.gochara_vedha.planets.Mercury[field] = changed;
    assert.equal(validDailyEvidence(bad, value), false);
  }
  const unrequested = structuredClone(vedhaFixture.evidence);
  unrequested.obstruction_evaluated = false;
  assert.equal(validDailyEvidence(unrequested, value), false);
  const missing = structuredClone(vedhaFixture.evidence);
  delete missing.gochara_vedha;
  assert.equal(validDailyEvidence(missing, value), false);
});

void test("daily request excludes shell options, extra fields, invalid dates and unsupported contract", () => {
  assert.deepEqual(validateDailyInput(value), value);
  for (const extra of [
    { script: "/arbitrary" },
    { topic: "marriage" },
    { date: "2026-02-30" },
    { language: "unknown" },
    { place: "Delhi\n--unsafe" },
  ]) {
    assert.throws(() => validateDailyInput({ ...value, ...extra }));
  }
  assert.throws(() => validateDailyInput(value, 2));
});

void test("daily child is a bounded fixed executable without a shell; failure has no retry", async () => {
  const before = process.env.VEDASTRO_DAILY_ENABLED;
  process.env.VEDASTRO_DAILY_ENABLED = "1";
  try {
    let calls = 0;
    const run = (binary, args, options, callback) => {
      calls += 1;
      assert.equal(binary, "python3");
      assert.ok(args[0].replaceAll("\\", "/").endsWith("skills/horoscope/calculate.py"));
      assert.equal(options.shell, undefined);
      assert.equal(options.timeout, 30000);
      assert.equal(options.maxBuffer, 128 * 1024);
      assert.equal(args.at(-1), "2026-10-11");
      callback(null, JSON.stringify(result));
    };
    const packet = await calculateDaily(value, run);
    assert.equal(packet.model_calls, 0);
    assert.equal(packet.schema, "reviewed-daily-reading-v1");
    assert.equal(calls, 1);
    await assert.rejects(calculateDaily(value, (_b, _a, _o, cb) => cb(Error("private path"))));
    process.env.VEDASTRO_DAILY_ENABLED = "0";
    await assert.rejects(
      calculateDaily(value, () => {
        throw Error("Must not run");
      }),
    );
  } finally {
    if (before === undefined) {
      delete process.env.VEDASTRO_DAILY_ENABLED;
    } else {
      process.env.VEDASTRO_DAILY_ENABLED = before;
    }
  }
});

void test("daily handler has same POST/body limits and does not calculate malformed requests", async () => {
  let calls = 0;
  const handler = createDailyHandler(async () => {
    calls += 1;
    return { schema: "reviewed-daily-reading-v1" };
  });
  const invoke = async (body, method = "POST") => {
    const req = Object.assign(Readable.from([body]), { method, headers: {} });
    let status;
    const res = {
      setHeader() {},
      writeHead(code) {
        status = code;
      },
      end() {
        this.writableEnded = true;
      },
    };
    await handler(req, res);
    return status;
  };
  assert.equal(await invoke(JSON.stringify(value)), 200);
  assert.equal(await invoke("{}"), 400);
  assert.equal(await invoke("x".repeat(4097)), 413);
  assert.equal(await invoke("", "GET"), 405);
  assert.equal(calls, 1);
});

void test("topic and daily routes share two calculation slots and release them", async () => {
  const concurrency = { active: 0 },
    finish = [];
  const calculate = () => new Promise((resolve) => finish.push(resolve));
  const daily = createDailyHandler(calculate, { concurrency });
  const topic = createReadingHandler(calculate, { concurrency });
  const invoke = async (handler, body) => {
    const req = Object.assign(Readable.from([JSON.stringify(body)]), {
      method: "POST",
      headers: {},
    });
    let status;
    const res = {
      setHeader() {},
      writeHead(code) {
        status = code;
      },
      end() {
        this.writableEnded = true;
      },
    };
    await handler(req, res);
    return status;
  };
  const first = invoke(daily, value);
  const second = invoke(topic, {
    dob: value.dob,
    tob: value.tob,
    place: value.place,
    topic: "career",
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(concurrency.active, 2);
  assert.equal(await invoke(daily, value), 503);
  assert.equal(finish.length, 2);
  for (const resolve of finish) {
    resolve({ status: "ok" });
  }
  assert.deepEqual(await Promise.all([first, second]), [200, 200]);
  assert.equal(concurrency.active, 0);
});
