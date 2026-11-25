import test from "node:test";
import assert from "node:assert/strict";
import { devModelFailover } from "../extensions/reviewed-reading/direct/model-failover.mjs";
import { ModelBudget } from "../extensions/inference-budget/transport.mjs";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";

const env = {ASTROFRIEND_DEV_MODEL_FAILOVER:"1",VEDASTRO_DIRECT_ENVIRONMENT:"development",
  DEEPSEEK_API_KEY:"fake-deepseek",GROQ_API_KEY:"fake-groq",OPENAI_API_KEY:"fake-openai"};
const url="https://openrouter.ai/api/v1/chat/completions";
const messages=[{role:"user",content:"Synthetic question"},{role:"assistant",content:null,
  tool_calls:[{id:"test-call",type:"function",function:{name:"chart",arguments:"{}"}}]},
  {role:"tool",tool_call_id:"test-call",content:'{"checked":true}'}];
const request=()=>({method:"POST",headers:{Authorization:"Bearer old"},body:JSON.stringify({model:"old",messages,max_tokens:100,stream:false})});
const ok=()=>new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:"Verified synthetic answer"}}]}));

test("disabled flow is unchanged and production cannot enable experimental failover",()=>{
  const transport=()=>{};assert.deepEqual(devModelFailover({},transport),{env:{},fetchImpl:transport});
  assert.throws(()=>devModelFailover({...env,VEDASTRO_DIRECT_ENVIRONMENT:"production"}),/development-only/);
});
for(const status of [401,402,404,408,429,500,502,503,504]) test(`provider ${status} switches once and keeps checked tool results`,async()=>{
  const attempts=[];const adapter=devModelFailover(env,async(endpoint,options)=>{
    attempts.push({endpoint,options});return attempts.length===1?new Response("",{status}):ok();});
  const r=await adapter.fetchImpl(url,request());assert.equal(r.status,200);
  assert.equal(attempts.length,2);assert.match(attempts[1].endpoint,/api.groq.com/);
  assert.deepEqual(JSON.parse(attempts[1].options.body).messages,messages);
  assert.equal(attempts[1].options.headers.get("Authorization"),"Bearer fake-groq");
  assert.equal(JSON.parse(attempts[1].options.body).thinking,undefined);
  await adapter.fetchImpl(url,request());assert.match(attempts[2].endpoint,/api.groq.com/);
});
test("all unavailable providers stop after three attempts",async()=>{
  let n=0;const a=devModelFailover(env,async()=>{n++;return new Response("",{status:503});});
  assert.equal((await a.fetchImpl(url,request())).status,503);assert.equal(n,3);
});
test("invalid, empty and truncated responses switch without executing tools",async()=>{
  for(const response of [()=>new Response("invalid"),()=>new Response('{"choices":[]}'),
    ()=>new Response('{"choices":[{"finish_reason":"length","message":{"content":"unfinished"}}]}')]) {
    let n=0;const a=devModelFailover(env,async()=>++n===1?response():ok());
    assert.equal((await a.fetchImpl(url,request())).status,200);assert.equal(n,2);
  }
});
test("refusals and invalid request errors do not trigger model shopping",async()=>{
  for(const response of [()=>new Response("",{status:400}),()=>new Response("",{status:403}),
    ()=>new Response('{"choices":[{"finish_reason":"content_filter","message":{"content":""}}]}'),
    ()=>new Response('{"choices":[{"finish_reason":"stop","message":{"refusal":"No"}}]}')]) {
    let n=0;const a=devModelFailover(env,async()=>{n++;return response();});await a.fetchImpl(url,request());assert.equal(n,1);
  }
});
test("attempt allowance includes failed providers and cannot reset between rounds",async()=>{
  let n=0;const a=devModelFailover(env,async()=>{n++;return new Response("",{status:503});},{budget:new ModelBudget({attempts:2})});
  await assert.rejects(a.fetchImpl(url,request()),/budget exhausted/);assert.equal(n,2);
  await assert.rejects(a.fetchImpl(url,request()),/budget exhausted/);assert.equal(n,2);
});
test("caller cancellation prevents fallback",async()=>{
  const c=new AbortController();let n=0;const a=devModelFailover(env,async()=>{n++;c.abort();throw new DOMException("Aborted","AbortError");});
  await assert.rejects(a.fetchImpl(url,{...request(),signal:c.signal}),{name:"AbortError"});assert.equal(n,1);
});
test("network failure switches",async()=>{
  let n=0;const a=devModelFailover(env,async()=>{if(++n===1)throw new TypeError("fetch failed");return ok();});
  assert.equal((await a.fetchImpl(url,request())).status,200);assert.equal(n,2);
});

test("malformed tool arguments and JSON-only replies fail over", async () => {
  for (const first of [
    {finish_reason:"tool_calls",message:{tool_calls:[{id:"x",type:"function",function:{name:"chart",arguments:"not-json"}}]}},
    {finish_reason:"stop",message:{content:"not-json"}},
  ]) {
    let n = 0;
    const a = devModelFailover(env, async () => new Response(JSON.stringify({choices:[++n === 1 ? first :
      {finish_reason:"stop",message:{content:'{"answer":"synthetic"}'}}]})));
    const input = request();
    input.body = JSON.stringify({...JSON.parse(input.body),response_format:{type:"json_object"}});
    await a.fetchImpl(url,input);
    assert.equal(n,2);
  }
});

test("oversized output is cancelled before a fallback",async()=>{
  let cancelled=false,n=0;
  const a=devModelFailover(env,async()=> ++n===1 ? new Response(new ReadableStream({
    pull(c){c.enqueue(new Uint8Array(70000));},cancel(){cancelled=true;}
  })) : ok());
  await a.fetchImpl(url,request());assert.equal(cancelled,true);assert.equal(n,2);
});

test("separate answers do not share provider selection or budget",async()=>{
  const endpoints=[];
  const fake=async(endpoint)=>{endpoints.push(endpoint);return endpoint.includes("deepseek")?new Response("",{status:503}):ok();};
  await devModelFailover(env,fake).fetchImpl(url,request());
  await devModelFailover(env,fake).fetchImpl(url,request());
  assert.match(endpoints[0],/deepseek/);assert.match(endpoints[2],/deepseek/);
});
test("missing optional keys are skipped and unrelated transports are untouched",async()=>{
  const other={body:"private-tool-input"};const a=devModelFailover({...env,DEEPSEEK_API_KEY:"",GROQ_API_KEY:""},async(endpoint,options)=>{
    if(endpoint!=="https://memory.test")assert.match(endpoint,/api.openai.com/);else assert.equal(options,other);return ok();});
  await a.fetchImpl(url,request());await a.fetchImpl("https://memory.test",other);
});

test("actual answer flow retains memory and completes after primary outage",async()=>{
  const attempts=[];
  const adapter=devModelFailover(env,async(endpoint,options)=>{
    attempts.push({endpoint,body:JSON.parse(options.body)});
    return attempts.length===1?new Response("",{status:503}):ok();
  });
  const result=await directAnswer({user_id:"dev:synthetic",query:"Hello",language:"english",history:[],birth:null},{
    ...adapter,makeMemory:()=>({read:async()=>["Prefers short replies"],write:async()=>({saved:true})}),
  });
  assert.equal(result.reply,"Verified synthetic answer");
  assert.equal(attempts.length,2);
  assert.deepEqual(attempts[0].body.messages,attempts[1].body.messages);
  assert.equal(adapter.env.VEDASTRO_DIRECT_GENERATION_MODE,"direct-failover");
});
