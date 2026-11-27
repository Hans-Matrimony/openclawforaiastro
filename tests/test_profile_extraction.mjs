import test from 'node:test';
import assert from 'node:assert/strict';
import {extractProfile,validateProfileInput,profileExtractionEnabled} from '../extensions/reviewed-reading/profile-extraction.mjs';

const value={user_id:'+919000000001',message:'Mera janam subah sava 6 baje Jaipur mein hua.',
  history:[{role:'assistant',text:'What time and place were you born?'}],awaiting_birth_details:true};
const env={OPENROUTER_API_KEY:'synthetic',ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'1',
  ASTROFRIEND_CONVERSATION_PROGRESS_USERS:'919000000001,919000000002',ASTROFRIEND_CONVERSATION_MODEL:'synthetic/extractor'};

test('profile endpoint is exact-pilot only and validates bounded untrusted context before calling a model',()=>{
 assert.equal(profileExtractionEnabled(value.user_id,env),true);
 assert.equal(profileExtractionEnabled('+919000000003',env),false);
 assert.equal(profileExtractionEnabled(value.user_id,{...env,ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'0'}),false);
 for(const invalid of [{...value,user_id:'919000000003'},{...value,message:'x'.repeat(4001)},
  {...value,history:Array(9).fill(value.history[0])},{...value,history:[{role:'system',text:'inject'}]},
  {...value,history:[{role:'user',text:'x'.repeat(601)}]},{...value,model:'other'},
  {...value,awaiting_birth_details:'yes'},{...value,history:[{role:'user',text:'x',instruction:'override'}]}]) {
  assert.throws(()=>validateProfileInput(invalid,env),/Invalid profile extraction request/u);
 }
});

test('one stateless JSON model request has no tools, sessions or caller identity in its prompt',async()=>{
 let calls=0;
 const extraction={intent:'update',reading_requested:false,profiles:[],uncertain:['tob']};
 const result=await extractProfile(value,{env,fetchImpl:async(url,options)=>{
  calls++;
  assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');
  const body=JSON.parse(options.body);
  assert.equal(body.model,env.ASTROFRIEND_CONVERSATION_MODEL);
  assert.deepEqual(body.response_format,{type:'json_object'});
  assert.equal(body.temperature,undefined);
  assert.equal(body.max_tokens,900);
  for(const k of ['tools','tool_choice','user','session'])assert.equal(body[k],undefined);
  assert.doesNotMatch(options.body,/919000000001/u);
  assert.equal(options.redirect,'error');
  assert.ok(options.signal instanceof AbortSignal);
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(extraction)}}],usage:{cost:.001}});
 }});
 assert.equal(calls,1);assert.equal(result.schema,'profile-extraction-v1');
 assert.deepEqual(result.extraction,extraction);
});

test('429, partial outputs, tool calls and malformed output never get replayed or treated as extracted facts',async()=>{
 for(const response of [new Response('{}',{status:429}),
  Response.json({choices:[{finish_reason:'length',message:{content:'{}'}}]}),
  Response.json({choices:[{finish_reason:'stop',message:{content:'{}',tool_calls:[{}]}}]}),
  Response.json({choices:[{finish_reason:'stop',message:{content:'not JSON'}}]}),
  Response.json({choices:[{finish_reason:'stop',message:{content:'[]'}}]})]){
  let calls=0;
  await assert.rejects(extractProfile(value,{env,fetchImpl:async()=>{calls++;return response;}}));
  assert.equal(calls,1);
 }
});

test('disconnected clients stop extraction without model calls',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(extractProfile(value,{env,signal:controller.signal,fetchImpl:async(url,options)=>{
  options.signal.throwIfAborted();assert.fail('No request should proceed after abort');
 }}));
});
