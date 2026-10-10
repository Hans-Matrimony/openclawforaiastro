import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  period_interpretation_available: false,
  factors: [{ fact: { planet: "Mars", house: 2 }, source: "vedastro_classical" }],
});
function request(body, method = "POST") {
  return Object.assign(Readable.from([typeof body === "string" ? body : JSON.stringify(body)]), {
    method,
  });
}
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
test("input rejects unknown fields, control characters and unsupported topics", () => {
  assert.deepEqual(validateReadingInput(valid), valid);
  for (const value of [
    null,
    [],
    { ...valid, topic: "health" },
    { ...valid, model: "expensive" },
    { ...valid, language: "unsupported" },
    { ...valid, intent: "timing" },
    { ...valid, place: "x".repeat(161) },
    { ...valid, tob: "08:19\n--full" },
  ]) {
    assert.throws(() => validateReadingInput(value));
  }
});
test("bad bodies and methods never execute the chart process", async () => {
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
test("success preserves result; process failure is sanitized and does not retry", async () => {
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
test("concurrency is bounded and released after completion", async () => {
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

test("subprocess contract binds language, intent and topic and rejects invalid output", async () => {
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

test("partial evidence, whitespace and invalid counters cannot be displayed", () => {
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
  ]) {
    assert.ok(!validReadingResult({ ...result, ...change }, valid));
  }
});

test("separation rendering binds birth request including unicode and refuses event deadlines", () => {
  const rows = JSON.parse(
    readFileSync(new URL("./fixtures/separation_readings.json", import.meta.url), "utf8"),
  );
  for (const { request, result } of rows) {
    assert.deepEqual(validateReadingInput(request), request);
    assert.equal(validReadingResult(result, request), true);
    for (const field of ["dob", "tob", "place", "language", "intent"]) {
      assert.equal(Boolean(validReadingResult(result, { ...request, [field]: "wrong" })), false);
    }
    for (const change of [
      { model_calls: false },
      { schema: "reviewed-reading-v1" },
      {
        evidence: {
          ...result.evidence,
          assessment: { ...result.evidence.assessment, windows: [{ end: "2027-08-27" }] },
        },
      },
      {
        evidence: {
          ...result.evidence,
          assessment: { ...result.evidence.assessment, status: "divorce_guaranteed" },
        },
      },
    ]) {
      assert.equal(Boolean(validReadingResult({ ...result, ...change }, request)), false);
    }
  }
});
