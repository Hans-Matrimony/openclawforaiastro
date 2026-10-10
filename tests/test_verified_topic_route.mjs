import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  validateTopicInput,
  validTopicResult,
  calculateTopic,
} from "../extensions/reviewed-reading/topic-route.mjs";
import { mergeReadingContract } from "../scripts/bootstrap-astrology-assets.mjs";

const rows = JSON.parse(
  fs.readFileSync(new URL("./fixtures/topic_wire.json", import.meta.url), "utf8"),
);

test("topic wire accepts calculated fixtures and rejects foreign birth or topic", () => {
  for (const { request, result } of rows) {
    assert.equal(validateTopicInput(request), request);
    assert.ok(validTopicResult(result, request));
    assert.equal(validTopicResult(result, { ...request, dob: "2002-02-17" }), false);
    assert.equal(validTopicResult(result, { ...request, topic: "unknown" }), false);
  }
});

test("topic input cannot inject flags, control characters, new keys or invalid contact intent", () => {
  const q = rows[0].request;
  for (const bad of [
    { ...q, extra: true },
    { ...q, place: "Delhi\n--full" },
    { ...q, intent: "contact", topic: "career" },
    { ...q, topic: "separation" },
    { ...q, language: "tamil" },
    { ...q, dob: null },
  ]) {
    assert.throws(() => validateTopicInput(bad));
  }
});

test("topic calculation runs bounded argv without shell and fails closed", async () => {
  const { request, result } = rows[0];
  const value = await calculateTopic(request, (command, args, options, callback) => {
    assert.equal(command, "python3");
    assert.ok(args.includes("--verified-topic"));
    assert.ok(!args.includes("--full"));
    assert.equal(options.shell, undefined);
    assert.equal(options.timeout, 30000);
    callback(null, JSON.stringify(result));
  });
  assert.deepEqual(value, result);
  await assert.rejects(calculateTopic(request, (_cmd, _args, _opts, done) => done(null, "{}")));
  await assert.rejects(
    calculateTopic(request, (_cmd, _args, _opts, done) => done(new Error("private"))),
  );
});

test("astrology note preserves all custom persona text and is idempotent", () => {
  const persona = "Custom friend persona\nPrivate user-owned text";
  const merged = mergeReadingContract(persona);
  assert.ok(merged.startsWith(persona + "\n\n"));
  assert.equal(mergeReadingContract(merged), merged);
  assert.throws(() => mergeReadingContract("<!-- astrofriend-reading-contract:start -->"));
  assert.throws(() => mergeReadingContract(merged + merged));
});
