import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import {
  createSummaryHandler,
  validateSummaryInput,
} from "../extensions/reviewed-reading/summary-route.mjs";

const value = {
  location_name: "Delhi",
  birth_date: "03/01/2001",
  birth_time: "05:00",
  query_text: "Career?",
};
const env = { VEDASTRO_SUMMARY_DEV_ENABLED: "1", VEDASTRO_SUMMARY_ENVIRONMENT: "development" };
async function invoke(handler, input = value, method = "POST") {
  const req = Readable.from([JSON.stringify(input)]);
  req.method = method;
  req.headers = {};
  const res = {
    setHeader() {},
    writeHead(status) {
      this.status = status;
    },
    end(body) {
      this.body = JSON.parse(body);
    },
  };
  await handler(req, res);
  return res;
}
await test("disabled and production gates never call provider", async () => {
  for (const config of [{}, { ...env, VEDASTRO_SUMMARY_ENVIRONMENT: "production" }]) {
    const result = await invoke(
      createSummaryHandler(() => assert.fail("provider called"), { env: config }),
    );
    assert.equal(result.status, 404);
  }
});
await test("strict fields exclude unrelated account data", () => {
  assert.deepEqual(validateSummaryInput(value), value);
  for (const bad of [
    { ...value, phone: "private" },
    { ...value, query_text: "" },
    { ...value, birth_date: "2001-01-03" },
  ]) {
    assert.throws(() => validateSummaryInput(bad));
  }
});
await test("provider errors are sanitized and not retried", async () => {
  let calls = 0;
  const result = await invoke(
    createSummaryHandler(
      async () => {
        calls++;
        throw new Error("secret");
      },
      { env },
    ),
  );
  assert.equal(calls, 1);
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { error: "provider_summary_unavailable" });
});
await test("method, size and busy limits prevent provider calls", async () => {
  const fail = () => assert.fail("provider called");
  assert.equal((await invoke(createSummaryHandler(fail, { env }), value, "GET")).status, 405);
  assert.equal(
    (await invoke(createSummaryHandler(fail, { env }), { ...value, query_text: "x".repeat(9000) }))
      .status,
    413,
  );
  assert.equal(
    (await invoke(createSummaryHandler(fail, { env, concurrency: { active: 2 } }))).status,
    503,
  );
});
await test("successful request releases shared concurrency", async () => {
  const concurrency = { active: 0 };
  const result = await invoke(
    createSummaryHandler(
      async (input) => {
        assert.deepEqual(input, value);
        return { interpretation: "fixture" };
      },
      { env, concurrency },
    ),
  );
  assert.equal(result.status, 200);
  assert.equal(concurrency.active, 0);
});
