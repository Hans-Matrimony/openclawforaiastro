import assert from "node:assert/strict";
import test from "node:test";
import { createMemory } from "../extensions/reviewed-reading/direct/memory.mjs";

const env = { MEM0_URL: "https://memory.test", VEDASTRO_DIRECT_MEM0_DEV_HOST: "memory.test" };
const response = (rows) => new Response(JSON.stringify({ memories: rows }));

void test("concurrent same-request memory reads share one fetch without losing distinct facts", async () => {
  let calls = 0;
  const rows = [
    "Works nights",
    "Works  nights",
    "[birth] subject=Self | time=08:00",
    "[birth] subject=Partner | time=08:00",
    "[birth] subject=Self | time=09:00",
    "No longer works nights",
  ];
  const memory = createMemory("synthetic", {
    env,
    fetchImpl: async () => {
      calls++;
      return response(rows);
    },
  });
  const [a, b] = await Promise.all([memory.read(), memory.read()]);
  assert.equal(calls, 1);
  assert.deepEqual(a, [rows[0], ...rows.slice(2)]);
  assert.deepEqual(a, b);
  assert.deepEqual(await memory.read(), a);
  assert.equal(calls, 1);
});

void test("writes invalidate cached and in-flight old memory", async () => {
  let release;
  let reads = 0;
  const memory = createMemory("synthetic", {
    env,
    fetchImpl: async (_url, options) => {
      if (options.method === "POST") {
        return response([]);
      }
      reads++;
      if (reads === 1) {
        return await new Promise((resolve) => {
          release = resolve;
        });
      }
      return response(["Updated fact"]);
    },
  });
  const old = memory.read();
  await memory.write("Updated fact");
  release(response(["Old fact"]));
  await old;
  assert.deepEqual(await memory.read(), ["Updated fact"]);
  assert.equal(reads, 2);
});

void test("failed reads are not cached and users never share memory requests", async () => {
  let calls = 0;
  const fetchImpl = async (url) => {
    calls++;
    if (calls === 1) {
      return new Response("Unavailable", { status: 503 });
    }
    return response([new URL(url).pathname]);
  };
  const a = createMemory("alice", { env, fetchImpl });
  const b = createMemory("bob", { env, fetchImpl });
  await assert.rejects(a.read());
  assert.deepEqual(await a.read(), ["/memory/alice"]);
  assert.deepEqual(await b.read(), ["/memory/bob"]);
  assert.equal(calls, 3);
});

void test("failed writes still invalidate cached memory", async () => {
  let reads = 0;
  const memory = createMemory("synthetic", {
    env,
    fetchImpl: async (_url, options) => {
      if (options.method === "POST") {
        return new Response("Unavailable", { status: 503 });
      }
      reads++;
      return response(["Fact"]);
    },
  });
  await memory.read();
  await assert.rejects(memory.write("Correction"));
  await memory.read();
  assert.equal(reads, 2);
});
