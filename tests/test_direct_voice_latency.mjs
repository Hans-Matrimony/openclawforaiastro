import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { directAnswer } from '../extensions/reviewed-reading/direct/agent.mjs';
import { validateDirectInput, createDirectHandler } from '../extensions/reviewed-reading/direct-route.mjs';
import { createReadingHandler } from '../extensions/reviewed-reading/direct-http.mjs';
import { spokenReply } from '../extensions/reviewed-reading/direct/voice-presentation.mjs';

const value = {user_id:'synthetic-voice',query:'How is my career?',language:'english',history:[],birth:{date:'1991-04-11',time:'08:00',location_name:'Pune'}};
const env = {OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'1'};
function response() {
  return Object.assign(new EventEmitter(), {writableEnded:false, destroyed:false,
    setHeader(){},writeHead(){},end(){this.writableEnded=true;}});
}

test('voice delivery is explicit; existing chat requests and invalid surfaces retain their boundary', () => {
  for (const reply_surface of [undefined,'whatsapp','voice']) assert.doesNotThrow(()=>validateDirectInput({...value,reply_surface}));
  for (const reply_surface of ['pwa','audio','Voice',null,{}]) assert.throws(()=>validateDirectInput({...value,reply_surface}));
});

test('captured voice wording is localized without dropping the dates or cautions', () => {
  const text='The separate house strength indicator for house 10 is supportive. current dasha lords is area se directly linked nahi external push kam.\n\nThe calculated Mars sub period runs 2027-09-15 to 2028-11-14.';
  assert.equal(spokenReply(text,{reply_surface:'voice',language:'english'}), 'House 10 shows support. The current planetary period offers limited direct support. Your Mars sub period runs 15 September 2027 to 14 November 2028.');
  for (const reply_surface of [undefined,'whatsapp']) assert.equal(spokenReply(text,{reply_surface,language:'english'}),text);
  for (const text of ['{"date":"2027-09-15"}', '```2027-09-15```', 'https://example.invalid/2027-09-15']) assert.equal(spokenReply(text,{reply_surface:'voice',language:'english'}),text);
  assert.equal(spokenReply('Not guaranteed: 2028-02-29 to 2028-11-14. Invalid: 2027-02-29.',{reply_surface:'voice',language:'english'}), 'Not guaranteed: 29 February 2028 to 14 November 2028. Invalid: 2027-02-29.');
});

test('spoken reading retains checked evidence without a separate companion model call', async () => {
  let calls=0;
  const result=await directAnswer({...value,reply_surface:'voice'}, {env,
    makeMemory:()=>({read:async()=>[]}),
    makeTools:()=>async()=>JSON.stringify({engine:'fixture',verdict_signals:[{area:'career',positive:['career factors are supportive'],negative:[]}]}),
    fetchImpl:async (_url, options)=>{
      const body=JSON.parse(options.body);
      assert.match(body.messages[0].content, /# Spoken delivery/);
      assert.doesNotMatch(body.messages[0].content, /# Companion ownership|# Friendly closing/);
      assert.ok(++calls<=2, 'No extra companion request before audio');
      const message=calls===1?{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}:{content:'Your chart has supportive career factors.'};
      return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));
    },
  });
  assert.equal(calls,2);
  assert.deepEqual(result.answer_reading_tools,['get_horoscope_predictions']);
  assert.equal(result.reply,'Your chart has supportive career factors.');
});

test('disconnect cancels a running upstream generation and releases its admission slot', async () => {
  const slots={active:0};
  let started, cancelled=false;
  const ready=new Promise(resolve=>{started=resolve;});
  const handler=createReadingHandler((input,options)=>directAnswer({...input,reply_surface:'voice'}, {
    ...options,env,makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>assert.fail('No tool should run'),
    fetchImpl:async (_url,options)=>{
      started();
      return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>{cancelled=true;reject(options.signal.reason);},{once:true}));
    },
  }),{validate:v=>v,concurrency:slots});
  const req=Readable.from([JSON.stringify(value)]);req.method='POST';req.headers={};
  const res=response();
  const running=handler(req,res);
  await ready;
  assert.equal(slots.active,1);
  res.destroyed=true;res.emit('close');
  await Promise.race([running,new Promise((_r,reject)=>setTimeout(()=>reject(new Error('Cancellation stalled')),1000).unref())]);
  assert.equal(cancelled,true);
  assert.equal(slots.active,0);
  assert.equal(res.writableEnded,false,'No obsolete answer is delivered');
  assert.equal(res.listenerCount('close'),0);
});

test('authenticated direct HTTP adapter forwards its cancellation signal', async () => {
  const input={...value,reply_surface:'voice'};
  let signal;
  const handler=createDirectHandler(async (_value, options)=>{signal=options.signal;return {reply:'Hello'};}, {env:{ASTROFRIEND_DIRECT_MODE:'pilot',ASTROFRIEND_DIRECT_ENVIRONMENT:'production',ASTROFRIEND_DIRECT_TEST_USERS:value.user_id}});
  const req=Readable.from([JSON.stringify(input)]);req.method='POST';req.headers={};
  await handler(req,response());
  assert.ok(signal instanceof AbortSignal);
  assert.equal(signal.aborted,false);
});
