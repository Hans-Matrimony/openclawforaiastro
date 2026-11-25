import test from "node:test";
import assert from "node:assert/strict";
import { directModelOptions } from "../extensions/reviewed-reading/direct/model-provider.mjs";
import { generationSettings } from "../extensions/reviewed-reading/direct/generation.mjs";
import { Readable } from "node:stream";
import { createDirectHandler } from "../extensions/reviewed-reading/direct-route.mjs";

test("legacy provider preserves environment and transport", () => {
  const env = { OPENROUTER_API_KEY: "legacy" }, transport = () => {};
  assert.deepEqual(directModelOptions(env, transport), { env, fetchImpl: transport });
});

test("DeepSeek covers reading, conversation and repair without OpenRouter credits", async () => {
  const env = { ASTROFRIEND_DIRECT_MODEL_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "test-only",
    ASTROFRIEND_CONVERSATION_MODEL: "old-companion", VEDASTRO_DIRECT_PROVIDER: "parasail/fp8" };
  const before = structuredClone(env), calls = [];
  const response = new Response(JSON.stringify({choices:[{message:{content:'ok'},finish_reason:'stop'}]}));
  const options = directModelOptions(env, async (url, init) => { calls.push({url,init}); return response; });
  assert.equal(options.env.VEDASTRO_DIRECT_MODEL, "deepseek-v4-flash");
  assert.equal(options.env.ASTROFRIEND_CONVERSATION_MODEL, "deepseek-v4-flash");
  assert.doesNotThrow(() => generationSettings(options.env));
  const signal = new AbortController().signal;
  const messages = [{role:"assistant",content:null,tool_calls:[{id:"call_1",type:"function",function:{name:"chart",arguments:"{}"}}]},
    {role:"tool",tool_call_id:"call_1",content:'{"verified":true}'}];
  for (const model of ["old-reading", "old-companion", "old-repair"]) {
    const result = await options.fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
      method:"POST", signal, headers:{Authorization:"Bearer old", "Content-Type":"application/json"},
      body:JSON.stringify({model,messages,tools:[{type:"function",function:{name:"chart"}}],
        response_format:{type:"json_object"},max_tokens:100,stream:false,provider:{only:["parasail"]},reasoning:{effort:"low"},seed:42,top_k:1}),
    });
    assert.equal(result,response);
  }
  for (const {url,init} of calls) {
    assert.equal(url,"https://api.deepseek.com/chat/completions");
    assert.equal(init.headers.get("authorization"),"Bearer test-only");
    assert.equal(init.redirect,"error");
    assert.equal(init.signal,signal);
    const body=JSON.parse(init.body);
    assert.deepEqual(body.messages,messages);
    assert.equal(body.tools[0].function.name,"chart");
    assert.equal(body.response_format.type,"json_object");
    assert.equal(body.max_tokens,100);
    assert.equal(body.model,"deepseek-v4-flash");
    assert.deepEqual(body.thinking,{type:"disabled"});
    for(const key of ["provider","reasoning","seed","top_k"]) assert.equal(key in body,false);
  }
  assert.deepEqual(env,before);
});

test("chart and memory requests are never redirected or reauthenticated", async () => {
  const env={ASTROFRIEND_DIRECT_MODEL_PROVIDER:"deepseek",DEEPSEEK_API_KEY:"test-only"};
  const init={headers:{Authorization:"Bearer memory"},body:"unchanged"};
  const adapter=directModelOptions(env,async(url,actual)=>{assert.equal(actual,init);return url;});
  for(const url of ["https://memory.example/search","https://mcp-subagent.vedastro.org/api/mcp/public"]) {
    assert.equal(await adapter.fetchImpl(url,init),url);
  }
});

test("missing credentials and unsupported provider fail closed", () => {
  assert.throws(()=>directModelOptions({ASTROFRIEND_DIRECT_MODEL_PROVIDER:"deepseek"}),/not configured/);
  assert.throws(()=>directModelOptions({ASTROFRIEND_DIRECT_MODEL_PROVIDER:"other"}),/Unknown/);
  assert.throws(()=>directModelOptions({ASTROFRIEND_DIRECT_MODEL_PROVIDER:"deepseek",DEEPSEEK_API_KEY:"test",
    ASTROFRIEND_DEEPSEEK_MODEL:"other"}),/Unsupported/);
});

test("HTTP failures and cancellation do not fall back to OpenRouter", async () => {
  let calls=0;
  const adapter=directModelOptions({ASTROFRIEND_DIRECT_MODEL_PROVIDER:"deepseek",DEEPSEEK_API_KEY:"test"},
    async()=>{calls++;return new Response("",{status:402});});
  assert.equal((await adapter.fetchImpl("https://openrouter.ai/api/v1/chat/completions",{body:"{}"})).status,402);
  assert.equal(calls,1);
  const failure = new DOMException("Cancelled", "AbortError");
  const cancelled = directModelOptions({ASTROFRIEND_DIRECT_MODEL_PROVIDER:"deepseek",DEEPSEEK_API_KEY:"test"},
    async()=>{throw failure;});
  await assert.rejects(cancelled.fetchImpl("https://openrouter.ai/api/v1/chat/completions",{body:"{}"}), error=>error===failure);
});

test("shared HTTP route selects DeepSeek for app, WhatsApp and checked voice readings", async () => {
  for (const surface of [undefined, "whatsapp", "voice"]) {
    const env = {ASTROFRIEND_DIRECT_MODE:"production", ASTROFRIEND_DIRECT_ENVIRONMENT:"production",
      ASTROFRIEND_DIRECT_MODEL_PROVIDER:"deepseek",DEEPSEEK_API_KEY:"test-only"};
    let calls=0;
    const handler=createDirectHandler(async(value,options)=>{
      calls++;
      assert.equal(value.reply_surface,surface);
      assert.equal(options.env.VEDASTRO_DIRECT_MODEL,"deepseek-v4-flash");
      assert.equal(options.env.ASTROFRIEND_CONVERSATION_MODEL,"deepseek-v4-flash");
      assert.equal(typeof options.fetchImpl,"function");
      return {reply:"Hello",answer_usage:[]};
    },{env});
    const req=Readable.from([JSON.stringify({user_id:"synthetic",query:"Hi",history:[],language:"english",reply_surface:surface})]);
    req.method="POST";req.headers={};
    const res={writableEnded:false,setHeader(){},writeHead(status){this.status=status;},end(text){this.body=JSON.parse(text);this.writableEnded=true;}};
    await handler(req,res);
    assert.equal(res.status,200);
    assert.equal(calls,1);
    assert.equal(res.body.reply,"Hello");
  }
});
