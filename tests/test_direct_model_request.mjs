import assert from 'node:assert/strict';
import test from 'node:test';
import {createModelRequest} from '../extensions/reviewed-reading/direct/model-request.mjs';
import {generationSettings} from '../extensions/reviewed-reading/direct/generation.mjs';
const pilot = {ASTROFRIEND_DIRECT_MODE:'pilot',ASTROFRIEND_DIRECT_ENVIRONMENT:'production',ASTROFRIEND_DIRECT_TEST_USERS:'synthetic'};
function fixture(responses, extra={}) {
  let calls=0; const waits=[], requests=[];
  const request=createModelRequest({enabled:true,canCall:()=>calls<8,takeCall:()=>{assert(calls<8);calls++;},
    sleep:async ms=>{waits.push(ms)},fetchImpl:async (...args)=>{requests.push(args);const r=responses.shift();if(r instanceof Error)throw r;return r;},...extra});
  return {request,waits,requests,count:()=>calls};
}
test('pilot routes same Qwen through capped Parasail and DeepInfra only for both stages',()=>{
  for(const mode of ['source','stable']) {
    const config=generationSettings({...pilot,VEDASTRO_DIRECT_GENERATION_MODE:mode});
    assert.deepEqual(config.provider.only,['parasail','deepinfra']);
    assert.deepEqual(config.provider.order,['parasail/fp8','deepinfra/fp8']);
    assert.deepEqual(config.provider.max_price,{prompt:.15,completion:1.5});
    assert.equal(config.temperature,mode==='source'?.7:0);
  }
  assert.equal(generationSettings({VEDASTRO_DIRECT_GENERATION_MODE:'source'}).provider.only,undefined);
  assert.deepEqual(generationSettings({...pilot,VEDASTRO_DIRECT_SOURCE_PROVIDER:'custom',VEDASTRO_DIRECT_GENERATION_MODE:'source'}).provider.only,['custom']);
  assert.equal(generationSettings({...pilot,VEDASTRO_DIRECT_MODEL:'other',VEDASTRO_DIRECT_GENERATION_MODE:'source'}).provider.only,undefined);
});
test('one explicit rejection retry shares the budget across reading and companion',async()=>{
  const f=fixture([new Response('',{status:429,headers:{'retry-after':'2'}}),new Response('ok'),new Response('',{status:503})]);
  const options={body:'unchanged prompt',signal:new AbortController().signal};
  assert.equal((await f.request('model',options)).status,200);
  assert.deepEqual(f.waits,[2000]);assert.equal(f.count(),2);
  assert.equal(f.requests[0][1],f.requests[1][1]);
  assert.equal((await f.request('model',options)).status,503);assert.equal(f.count(),3);
});
test('no retry for network ambiguity, other errors, successful partial response or disabled mode',async()=>{
  for(const status of [400,401,402,403,404,500,200]){const f=fixture([new Response('',{status})]);await f.request('model',{});assert.equal(f.count(),1);}
  const f=fixture([new Error('socket lost')]);await assert.rejects(f.request('model',{}),/socket lost/);assert.equal(f.count(),1);
  const off=fixture([new Response('',{status:429})],{enabled:false});await off.request('model',{});assert.equal(off.count(),1);
});
test('retry respects date and seconds headers and refuses long or malformed waits',async()=>{
  for(const header of ['60','bad','-1']) {const f=fixture([new Response('',{status:429,headers:{'retry-after':header}})]);await f.request('model',{});assert.equal(f.count(),1);}
  const f=fixture([new Response('',{status:503,headers:{'retry-after':'Thu, 01 Jan 1970 00:00:02 GMT'}}),new Response('ok')],{now:()=>0});await f.request('model',{});assert.deepEqual(f.waits,[2000]);
});
test('exhausted request budget and abort never trigger an extra fetch',async()=>{
  const f=fixture([new Response('',{status:429})],{canCall:()=>false});await f.request('model',{});assert.equal(f.count(),1);
  const c=new AbortController();const g=fixture([new Response('',{status:503})],{sleep:async()=>c.abort()});await assert.rejects(g.request('model',{signal:c.signal}));assert.equal(g.count(),1);
});
test('agent retries only the rejected model request and does not replay a completed tool',async()=>{
  const {directAnswer}=await import('../extensions/reviewed-reading/direct/agent.mjs');let calls=0,tools=0;
  const result=await directAnswer({user_id:'synthetic',query:'Hello',history:[],birth:null,language:'english'}, {
    env:{...pilot,OPENROUTER_API_KEY:'test',VEDASTRO_DIRECT_REPLY_CACHE:'0'},
    makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{tools++;return 'saved';},
    fetchImpl:async()=>{calls++;if(calls===2)return new Response('',{status:429,headers:{'retry-after':'0'}});
      return new Response(JSON.stringify({choices:[calls===1?{finish_reason:'tool_calls',message:{role:'assistant',content:null,tool_calls:[{id:'one',type:'function',function:{name:'write_memory',arguments:'{}'}}]}}:{finish_reason:'stop',message:{role:'assistant',content:'Hello, how are you?'}}]}));}
  });
  assert.equal(calls,3);assert.equal(tools,1);assert.equal(result.answer_model_calls,3);
});
