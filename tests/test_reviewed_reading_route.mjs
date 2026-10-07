import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import {
  calculateReading,
  createReadingHandler,
  validateReadingInput,
  validReadingResult,
} from "../extensions/reviewed-reading/route.mjs";

const valid = { dob: "2002-02-16", tob: "08:19", place: "Delhi", topic: "career" };
const evidence = (topic) => ({
  schema: "topic-reading-v1",
  rules_revision: "reviewed-placements-v1",
  topic,
  input_fingerprint: "a".repeat(64),
  settings: {
    ayanamsa: "LAHIRI",
    house_system: "whole_sign",
    node: "true",
    engine: "pyswisseph",
    dasha_year_days: 365.25,
  },
  period_interpretation_available: false,
  factors: [{ fact: { planet: "Mars", house: 2 }, source: "vedastro_classical" }],
});
function request(body, method = "POST") {
  return Object.assign(Readable.from([typeof body === "string" ? body : JSON.stringify(body)]), {
    method,
  });
}

void test("native provider requires pinned provenance, separate houses and checked strength", () => {
  const packet = evidence("career");
  const revision = "40763952742f76369a505d8db2e9e9fa67f75d78";
  packet.settings.engine = "VedAstro.Library";
  packet.settings.source_revision = revision;
  packet.advanced = { event_timing_available: false, topic_ruler: { planet: "Mars" } };
  packet.provider = {
    name: "vedastro-local",
    source_revision: revision,
    verified_against: "pyswisseph",
    topic: "career",
    topic_ruler: "Mars",
    native_settings: {
      ayanamsa: "LAHIRI",
      node: "true",
      dasha_year_days: 365.25,
      house_system: "vedastro_bhava",
      engine: "VedAstro.Library",
    },
    strength: {
      planet: "Mars",
      native_house_system: "vedastro_bhava",
      total_virupas: 360,
      total_rupas: 6,
      meets_engine_strength_test: true,
      components_virupas: Object.fromEntries(
        [
          "PlanetSthanaBala",
          "PlanetDigBala",
          "PlanetKalaBala",
          "PlanetChestaBala",
          "PlanetNaisargikaBala",
          "PlanetDrikBala",
        ].map((key) => [key, 60]),
      ),
    },
  };
  const result = {
    schema: "reviewed-reading-v1",
    text: "Native reading",
    model_calls: 0,
    model_tokens: 0,
    language: "english",
    intent: "overview",
    evidence: packet,
  };
  assert.ok(validReadingResult(result, valid));
  const timed = structuredClone(result);
  timed.evidence.as_of_utc = "2026-10-07T00:00:10+00:00";
  timed.evidence.chart_facts = { moon_sign: "Pisces" };
  timed.evidence.current_period = { mahadashas: { Venus: { antardashas: { Moon: {} } } } };
  timed.evidence.period_interpretation_available = true;
  const timing = {
    schema: "reviewed-timing-context-v1",
    as_of_utc: "2026-10-07T00:00:00+00:00",
    period_rule_source_revision: revision,
    period_rule_id: "VenusMoonPD2",
    verified_against: "pyswisseph",
    transit_reference: "natal_moon_sign",
    period_ratings: { family: "Good", relationship: "Bad", study: "Good" },
    transits: {
      Jupiter: { longitude: 100, sign: "Cancer", house_from_natal_moon: 5 },
      Saturn: { longitude: 340, sign: "Pisces", house_from_natal_moon: 1 },
    },
    obstruction_evaluated: false,
    event_prediction_available: false,
  };
  timed.evidence.timing_context = timing;
  timed.evidence.provider.timing_context = timing;
  assert.ok(validReadingResult(timed, valid));
  for (const mutate of [
    (value) => {
      value.evidence.timing_context.event_prediction_available = true;
    },
    (value) => {
      value.evidence.timing_context.as_of_utc = "2026-10-08T00:00:00+00:00";
    },
    (value) => {
      value.evidence.timing_context.period_ratings.family = "Predict a wedding";
    },
    (value) => {
      value.evidence.timing_context.transits.Jupiter.house_from_natal_moon = true;
    },
    (value) => {
      value.evidence.timing_context.transits.Saturn.longitude = Number.NaN;
    },
    (value) => {
      value.evidence.timing_context.period_rule_id = "SunMoonPD2";
    },
    (value) => {
      value.evidence.provider.timing_context = {};
    },
  ]) {
    const altered = structuredClone(timed);
    mutate(altered);
    assert.equal(validReadingResult(altered, valid), false);
  }
  for (const change of [
    (value) => {
      value.evidence.provider.source_revision = "unknown";
    },
    (value) => {
      delete value.evidence.provider;
    },
    (value) => {
      value.evidence.provider.strength.total_virupas = 361;
    },
    (value) => {
      value.evidence.provider.strength.total_virupas = true;
    },
    (value) => {
      value.evidence.provider.native_settings.house_system = "whole_sign";
    },
  ]) {
    const bad = structuredClone(result);
    change(bad);
    assert.equal(validReadingResult(bad, valid), false);
  }
});
function response() {
  return {
    status: null,
    body: null,
    setHeader() {},
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body) {
      this.body = JSON.parse(body);
      this.writableEnded = true;
    },
  };
}
void test("input rejects unknown fields, control characters and unsupported topics", () => {
  assert.deepEqual(validateReadingInput(valid), valid);
  for (const value of [
    null,
    [],
    { ...valid, topic: "health" },
    { ...valid, model: "expensive" },
    { ...valid, language: "unsupported" },
    { ...valid, intent: "timing" },
    { ...valid, style: "unbounded" },
    { ...valid, style: null },
    { ...valid, follow_up: "false" },
    { ...valid, follow_up: null },
    { ...valid, place: "x".repeat(161) },
    { ...valid, tob: "08:19\n--full" },
  ]) {
    assert.throws(() => validateReadingInput(value));
  }
});
void test("presentation preferences bind the subprocess and returned reply", async () => {
  const value = { ...valid, style: "detailed", follow_up: false };
  const result = {
    schema: "reviewed-reading-v1",
    text: "Specific supported reading.",
    model_calls: 0,
    model_tokens: 0,
    language: "english",
    intent: "overview",
    style: "detailed",
    follow_up: false,
    evidence: evidence("career"),
  };
  assert.deepEqual(validateReadingInput(value), value);
  const returned = await calculateReading(value, (_binary, args, _options, callback) => {
    assert.equal(args[args.indexOf("--reading-style") + 1], "detailed");
    assert.ok(args.includes("--no-reading-follow-up"));
    callback(null, JSON.stringify(result));
  });
  assert.equal(returned.follow_up, false);
  for (const change of [
    { style: "standard" },
    { style: null },
    { follow_up: true },
    { follow_up: null },
    { follow_up: "false" },
  ]) {
    assert.equal(validReadingResult({ ...result, ...change }, value), false);
  }
});
void test("bad bodies and methods never execute the chart process", async () => {
  let calls = 0;
  const handler = createReadingHandler(async () => {
    calls++;
  });
  for (const [body, method, status] of [
    ["{", "POST", 400],
    ["x".repeat(4097), "POST", 413],
    [valid, "GET", 405],
    [{ ...valid, topic: "health" }, "POST", 400],
  ]) {
    const res = response();
    await handler(request(body, method), res);
    assert.equal(res.status, status);
  }
  assert.equal(calls, 0);
});
void test("success preserves result; process failure is sanitized and does not retry", async () => {
  const reading = { schema: "reviewed-reading-v1", text: "Reviewed result", model_calls: 0 };
  const res = response();
  await createReadingHandler(async () => reading)(request(valid), res);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, reading);
  assert.equal(res.headers["Cache-Control"], "no-store");
  let calls = 0;
  const failure = response();
  await createReadingHandler(async () => {
    calls++;
    throw new Error("private birth data");
  })(request(valid), failure);
  assert.equal(failure.status, 422);
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(failure.body).includes("private"), false);
});
void test("concurrency is bounded and released after completion", async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const handler = createReadingHandler(async () => {
    await gate;
    return {};
  });
  const first = handler(request(valid), response());
  const second = handler(request(valid), response());
  const busy = response();
  await handler(request(valid), busy);
  assert.equal(busy.status, 503);
  release();
  await Promise.all([first, second]);
  const next = response();
  await handler(request(valid), next);
  assert.equal(next.status, 200);
});

void test("subprocess contract binds language, intent and topic and rejects invalid output", async () => {
  const value = { ...valid, topic: "marriage", language: "hinglish", intent: "timing" };
  const result = {
    schema: "reviewed-reading-v1",
    text: "Verified",
    model_calls: 0,
    model_tokens: 0,
    language: "hinglish",
    intent: "timing",
    evidence: evidence("marriage"),
  };
  const runner =
    (body, error = null) =>
    (command, args, options, callback) => {
      assert.equal(command, "python3");
      assert.equal(args[args.indexOf("--reading-language") + 1], "hinglish");
      assert.equal(args[args.indexOf("--reading-intent") + 1], "timing");
      assert.equal(options.timeout, 30000);
      assert.equal(options.maxBuffer, 128 * 1024);
      assert.equal(options.shell, undefined);
      callback(error, body);
    };
  assert.deepEqual(await calculateReading(value, runner(JSON.stringify(result))), result);
  for (const body of [
    "bad JSON",
    JSON.stringify({ ...result, language: "english" }),
    JSON.stringify({ ...result, intent: "overview" }),
    JSON.stringify({ ...result, model_calls: 1 }),
  ]) {
    await assert.rejects(calculateReading(value, runner(body)), /Chart calculation unavailable/);
  }
  await assert.rejects(
    calculateReading(value, runner("", new Error("private information"))),
    /Chart calculation unavailable/,
  );
});

void test("partial evidence, whitespace and invalid counters cannot be displayed", () => {
  const result = {
    schema: "reviewed-reading-v1",
    text: "Verified",
    model_calls: 0,
    model_tokens: 0,
    language: "english",
    intent: "overview",
    evidence: evidence("career"),
  };
  assert.equal(validReadingResult(result, valid), true);
  for (const change of [
    { text: "  " },
    { model_calls: false },
    { model_tokens: null },
    { evidence: { topic: "career" } },
    { evidence: { ...result.evidence, input_fingerprint: "bad" } },
    { evidence: { ...result.evidence, factors: [] } },
    { evidence: { ...result.evidence, period_interpretation_available: true } },
    ...[
      undefined,
      {},
      { ...result.evidence.settings, ayanamsa: "RAMAN" },
      { ...result.evidence.settings, dasha_year_days: 360 },
      { ...result.evidence.settings, house_system: "placidus" },
      { ...result.evidence.settings, engine: "unverified" },
      { ...result.evidence.settings, node: "mean" },
    ].map((settings) => ({ evidence: { ...result.evidence, settings } })),
  ]) {
    assert.ok(!validReadingResult({ ...result, ...change }, valid));
  }
});
