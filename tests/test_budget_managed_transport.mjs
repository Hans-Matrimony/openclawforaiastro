import test from "node:test";
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { createManagedBudgetScope } from "../extensions/inference-budget/managed-transport.mjs";
import { ModelBudget } from "../extensions/inference-budget/transport.mjs";

test("managed fetch retains policy and captured budgets after the stream scope ends", async () => {
  const context = new AsyncLocalStorage();
  const sent = [];
  const native = async (_url, init) => {
    sent.push(JSON.parse(init.body));
    return new Response("{}");
  };
  const owner = {
    policy: "preserved",
    buildModelFetch: () => native,
    inheritManagedTransport() { throw new Error("Model metadata must not wrap fetch functions"); },
  };
  const sdk = {
    supportsScopedAiTransportHosts: () => true,
    getAiTransportHost: () => context.getStore() ?? owner,
    createAiTransportHost: value => value,
    runWithAiTransportHost: (host, run) => context.run(host, run),
  };
  const withBudget = createManagedBudgetScope(sdk);
  const a = new ModelBudget({ attempts: 1 });
  const b = new ModelBudget({ attempts: 1 });
  const capture = budget => withBudget({budget, api:"openai-completions"}, () => {
    assert.equal(sdk.getAiTransportHost().policy, "preserved");
    return sdk.getAiTransportHost().buildModelFetch({});
  });
  const request = {method:"POST",body:JSON.stringify({messages:[],max_tokens:8192})};
  const fetchA = capture(a), fetchB = capture(b);
  assert.equal((await fetchA("https://example.test",request)).status,200);
  assert.equal((await fetchA("https://example.test",request)).status,400);
  assert.equal((await fetchB("https://example.test",request)).status,200);
  assert.equal(sent.length,2);
  assert.ok(sent.every(body=>body.max_tokens===2048));
  assert.equal(sdk.getAiTransportHost(),owner);
});

test("managed budget adapter rejects missing scoped hosts", () => {
  assert.throws(()=>createManagedBudgetScope({supportsScopedAiTransportHosts:()=>false}), /scoped/);
});

test("managed Request bodies retain headers and share the output and attempt caps", async () => {
  const calls = [];
  const sdk = {
    supportsScopedAiTransportHosts: () => true,
    getAiTransportHost: () => ({buildModelFetch: () => async (url, init) => {
      calls.push({url, init});
      return new Response("{}");
    }}),
    createAiTransportHost: value => value,
    runWithAiTransportHost: (host, run) => run(host),
  };
  const budget = new ModelBudget({attempts: 1});
  const fetch = createManagedBudgetScope(sdk)({budget, api:"openai-completions"}, host => host.buildModelFetch({}));
  const request = () => new Request("https://example.test/v1/chat/completions", {
    method: "POST", headers: {authorization:"Bearer synthetic"},
    body: JSON.stringify({messages:[], max_tokens:8192}),
  });
  assert.equal((await fetch(request())).status,200);
  assert.equal((await fetch(request())).status,400);
  assert.equal(calls.length,1);
  assert.equal(calls[0].init.headers.get("authorization"),"Bearer synthetic");
  assert.equal(JSON.parse(calls[0].init.body).max_tokens,2048);
  const small = new ModelBudget({requestBytes:8});
  const bounded = createManagedBudgetScope(sdk)({budget:small,api:"openai-completions"},host=>host.buildModelFetch({}));
  await assert.rejects(bounded(request()), /budget exhausted/);
  assert.equal(small.reason,"input_bytes");
  assert.equal(calls.length,1);
  const binaryBudget = new ModelBudget({attempts:1});
  const binaryFetch = createManagedBudgetScope(sdk)({budget:binaryBudget,api:"openai-completions"},host=>host.buildModelFetch({}));
  const binary = {method:"POST",body:new TextEncoder().encode(JSON.stringify({messages:[],max_tokens:8192}))};
  assert.equal((await binaryFetch("https://example.test",binary)).status,200);
  assert.equal((await binaryFetch("https://example.test",binary)).status,400);
  assert.equal(JSON.parse(calls[1].init.body).max_tokens,2048);
  assert.equal(calls.length,2);
});

test("managed budget adapter never replaces a missing managed transport with raw fetch", () => {
  const sdk = {
    supportsScopedAiTransportHosts: () => true,
    getAiTransportHost: () => ({buildModelFetch:()=>undefined}),
    createAiTransportHost: value=>value,
    runWithAiTransportHost: (host, run)=>run(host),
  };
  assert.throws(()=>createManagedBudgetScope(sdk)({}, host=>host.buildModelFetch({})), /managed provider fetch/);
});

test("managed request reads stop on deadline or caller cancellation without sending", async () => {
  let sends = 0;
  const sdk = {
    supportsScopedAiTransportHosts: () => true,
    getAiTransportHost: () => ({buildModelFetch: () => async () => { sends++; return new Response("{}"); }}),
    createAiTransportHost: value => value,
    runWithAiTransportHost: (host, run) => run(host),
  };
  for (const cancel of [false,true]) {
    let cancelled = false;
    const controller = new AbortController();
    const budget = new ModelBudget({durationMs:cancel ? 10000 : 15});
    const fetch = createManagedBudgetScope(sdk)({budget,api:"openai-completions"},host=>host.buildModelFetch({}));
    const pending = fetch(new Request("https://example.test", {
      method:"POST", duplex:"half", signal:controller.signal,
      body:new ReadableStream({cancel(){cancelled=true;}}),
    }));
    if(cancel) controller.abort(new Error("Caller cancelled"));
    await assert.rejects(pending,cancel ? /Caller cancelled/ : /budget exhausted/);
    assert.equal(cancelled,true);
    if(!cancel) assert.equal(budget.reason,"deadline");
  }
  assert.equal(sends,0);
});
