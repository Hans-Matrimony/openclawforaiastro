import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  calculateTiming,
  validTimingResult,
  validateTimingInput,
} from "../extensions/reviewed-reading/timing-route.mjs";

const rows = JSON.parse(
  fs.readFileSync(new URL("./fixtures/timing_wire.json", import.meta.url), "utf8"),
);
test("timing route binds topics, languages, request and counter schema", () => {
  for (const row of rows) {
    assert.equal(validateTimingInput(row.request), row.request);
    assert.equal(validTimingResult(row.result, row.request), true);
    assert.equal(validTimingResult(row.result, { ...row.request, tob: "23:59" }), false);
    assert.equal(validTimingResult({ ...row.result, model_calls: false }, row.request), false);
  }
  assert.throws(() => validateTimingInput({ ...rows[0].request, topic: "health" }));
  assert.throws(() => validateTimingInput({ ...rows[0].request, extra: "injection" }));
  assert.throws(() =>
    validateTimingInput({ ...rows[0].request, topic: "separation", intent: "contact" }),
  );
});
test("fixed no-shell timing argv with bounded process and body", async () => {
  const row = rows[0];
  const result = await calculateTiming(row.request, (binary, argv, options, callback) => {
    assert.equal(binary, "python3");
    assert.equal(argv[argv.indexOf("--timing-topic") + 1], row.request.topic);
    assert.equal(argv.includes("--full"), false);
    assert.equal(options.timeout, 30000);
    assert.equal(options.maxBuffer, 128 * 1024);
    assert.equal(options.shell, undefined);
    callback(null, JSON.stringify(row.result));
  });
  assert.equal(result.schema, "reviewed-timing-v1");
  await assert.rejects(calculateTiming(row.request, (_bin, _args, _opts, cb) => cb(null, "{}")));
});
