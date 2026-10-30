import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { createReadingHandler } from "../extensions/reviewed-reading/direct-http.mjs";

function exchange(body, method = "POST") {
  const request = Readable.from([body]);
  request.method = method;
  request.headers = {};
  const response = {
    status: null,
    headers: {},
    writableEnded: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    writeHead(status, headers) {
      this.status = status;
      Object.assign(this.headers, headers);
    },
    end(text) {
      this.body = JSON.parse(text);
      this.writableEnded = true;
    },
  };
  return { request, response };
}

void test("invalid and oversized bodies never reach generation and release their request slot", async () => {
  const concurrency = { active: 0 };
  const handler = createReadingHandler(() => assert.fail("Unexpected model request"), {
    maxBody: 8,
    concurrency,
    validate: () => {
      throw new Error("Invalid input");
    },
  });
  for (const [body, method, status] of [
    ["{}", "GET", 405],
    ["{", "POST", 400],
    ["{}", "POST", 400],
    ["x".repeat(9), "POST", 413],
  ]) {
    const { request, response } = exchange(body, method);
    await handler(request, response);
    assert.equal(response.status, status);
    assert.equal(concurrency.active, 0);
    assert.equal(response.headers["Cache-Control"], "no-store");
  }
});

void test("concurrency rejects an extra turn without generation; failures do not leak source data", async () => {
  const concurrency = { active: 0 };
  let finish;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  let calls = 0;
  const handler = createReadingHandler(
    async () => {
      calls++;
      await pending;
      throw new Error("private chart and credential details");
    },
    {
      concurrency,
      validate: (value) => value,
      failureStatus: 503,
      failureCode: "direct_answer_unavailable",
    },
  );
  const one = exchange("{}"),
    two = exchange("{}"),
    extra = exchange("{}");
  const active = [handler(one.request, one.response), handler(two.request, two.response)];
  await handler(extra.request, extra.response);
  assert.equal(extra.response.status, 503);
  assert.deepEqual(extra.response.body, { error: "reading_busy" });
  finish();
  await Promise.all(active);
  assert.equal(calls, 2);
  assert.equal(concurrency.active, 0);
  for (const result of [one, two]) {
    assert.equal(result.response.status, 503);
    assert.deepEqual(result.response.body, { error: "direct_answer_unavailable" });
  }
});

void test("pilot failure diagnostics never log private upstream data", async (t) => {
  const { createDirectHandler } = await import("../extensions/reviewed-reading/direct-route.mjs");
  const log = t.mock.method(console, "warn", () => {});
  for (const code of ["model_http_404", "private profile secret", undefined]) {
    const error = Object.assign(new Error("private upstream payload"), { code });
    const handler = createDirectHandler(async () => { throw error; }, { env: {
      ASTROFRIEND_DIRECT_MODE: "pilot", ASTROFRIEND_DIRECT_ENVIRONMENT: "production",
      ASTROFRIEND_DIRECT_TEST_USERS: "synthetic-a",
    }});
    const { request, response } = exchange(JSON.stringify({user_id:"synthetic-a", query:"Hello", history:[], language:"english"}));
    await handler(request, response);
    assert.equal(response.status, 503);
    assert.deepEqual(response.body, {error:"direct_answer_unavailable"});
  }
  assert.deepEqual(log.mock.calls.map(c => c.arguments[0]), ["[direct-answer] model_http_404", "[direct-answer] generation_failed", "[direct-answer] generation_failed"]);
});
