import test from "node:test";
import assert from "node:assert/strict";
import { createBudgetRuntime } from "../extensions/inference-budget/runtime.mjs";
import { registerBudgetProviders } from "../extensions/inference-budget/provider-bridge.mjs";
import { configureRuntimeBudget } from "../extensions/inference-budget/config.mjs";

test("migration retains unrelated agents, model settings and explicit empty fallback lists", () => {
  const config = { models:{providers:{deepseek:{api:"openai-completions",models:[{id:"test"}]}}},
    agents:{defaults:{model:{primary:"deepseek/test",fallbacks:["deepseek/test"]}},list:[
      {id:"main"},{id:"astrologer"},{id:"reply_repair",model:{primary:"deepseek/test",fallbacks:[]}}
    ]}};
  const result=configureRuntimeBudget(config);
  assert.equal(result.agents.entries.astrologer.model.primary,"astro-budget-deepseek/test");
  assert.deepEqual(result.agents.entries.reply_repair.model.fallbacks,[]);
  assert.deepEqual(result.agents.entries.main,{});
  assert.deepEqual(result.agents.defaults,config.agents.defaults);
  assert.equal(config.agents.list[1].model,undefined);
  assert.deepEqual(configureRuntimeBudget(result),result);
});

test("runtime configuration cannot silently discard an active heartbeat schedule", () => {
  const config = { agents: { defaults: { heartbeat: { every: "4h", target: "last" } }, list: [{ id: "main" }] } };
  const original = structuredClone(config);
  assert.throws(() => configureRuntimeBudget(config), /explicit automation migration/);
  assert.deepEqual(config, original);
});

test("provider bridge shares the allowance across providers and fails closed without a session", async () => {
  const requests=[];
  const runtime=createBudgetRuntime({limits:{attempts:2},fetchImpl:async(_url,options)=>{
    requests.push(JSON.parse(options.body)); return new Response("{}");
  }});
  runtime.setDiagnosticReporter(()=>{});
  runtime.bind({agentId:"astrologer",sessionId:"synthetic",runId:"test"});
  const registered=[];
  registerBudgetProviders({registerProvider:p=>registered.push(p)},runtime);
  const native=(model,context,options)=>{
    const result=runtime.transport.fetch("https://example.test/chat/completions",{
      method:"POST",body:JSON.stringify({messages:[],max_tokens:9999})
    }).then(response=>{if(!response.ok)throw new Error("budget exhausted");return {role:"assistant",content:[],stopReason:"stop"};});
    return {result:()=>result,async *[Symbol.asyncIterator](){await result;}};
  };
  for (const p of registered.slice(0,2)) {
    await p.wrapStreamFn({streamFn:native})({api:"openai-completions"},{},{sessionId:"synthetic"}).result();
  }
  await assert.rejects(registered[2].wrapStreamFn({streamFn:native})({api:"openai-completions"},{},{sessionId:"synthetic"}).result(),/budget exhausted/);
  await assert.rejects(registered[0].wrapSimpleCompletionStreamFn({streamFn:native})({api:"openai-completions"},{},{}).result(),/budget exhausted/);
  assert.equal(requests.length,2);assert.equal(requests[0].max_tokens,2048);
});

test("strict provider streams isolate sessions and count anonymous compaction against its owner", async () => {
  const sent=[];
  const runtime=createBudgetRuntime({limits:{attempts:2},fetchImpl:async(_url,options)=>{
    sent.push(JSON.parse(options.body).messages[0].content);return new Response("{}");
  }});
  runtime.setDiagnosticReporter(()=>{});
  for(const sessionId of ["a","b"])runtime.bind({agentId:"astrologer",sessionId,runId:sessionId});
  const native=async (_model,context)=>{
    const result=runtime.transport.fetch("https://example.test",{method:"POST",body:JSON.stringify({messages:context.messages})})
      .then(response=>{if(!response.ok)throw new Error("budget exhausted");return {role:"assistant",content:[],stopReason:"stop"};});
    return {result:()=>result,async *[Symbol.asyncIterator](){await result;}};
  };
  const wrap=runtime.wrapStream(native,true);
  const models={a:{api:"openai-completions"},b:{api:"openai-completions"}};
  const context=id=>({messages:[{role:"user",content:id}]});
  await Promise.all(["a","b"].map(id=>wrap(models[id],context(id),{sessionId:id}).result()));
  await wrap(models.a,context("a-compact"),{}).result();
  await assert.rejects(wrap(models.a,context("a-blocked"),{sessionId:"a"}).result(),/budget exhausted/);
  await wrap(models.b,context("b-second"),{sessionId:"b"}).result();
  assert.deepEqual(sent,["a","b","a-compact","b-second"]);
  runtime.bind({agentId:"astrologer",sessionId:"a",runId:"a-new"});
  await wrap(models.a,context("a-new-compact"),{}).result();
  assert.equal(runtime.forSession("a").attempts,1);
});
