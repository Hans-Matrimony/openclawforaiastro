import test from 'node:test';
import assert from 'node:assert/strict';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {createTools} from '../extensions/reviewed-reading/direct/tools.mjs';
import {focusedReadingFallback} from '../extensions/reviewed-reading/direct/focused-reading-delivery.mjs';

const now=new Date('2026-11-27T06:00:00Z');
const value={user_id:'919000000001',reply_surface:'whatsapp',language:'hinglish',user_gender:'male',
 birth:{date:'1991-04-11',time:'08:00',location_name:'Pune'},history:[]};
const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',
 VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'1',ASTROFRIEND_PILOT_TOPIC_PROMPTS:'1',
 ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_USERS:value.user_id,
 ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1',ASTROFRIEND_PILOT_COHERENT_REPLIES:'1',
 ASTROFRIEND_PILOT_EVENT_TIMING_ENABLED:'1',ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'1',
 ASTROFRIEND_CONVERSATION_MODEL:'synthetic-conversation'};
const response=data=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(data)}}]});
const tool=()=>Response.json({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{
 id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}}]});
const memory=()=>({read:async()=>[],write:async()=>assert.fail('No memory writes')});

test('transient chart-selector failures still deliver checked self readings when the writer is also unavailable',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 for(const status of [429,502,503,504])for(const query of ['Mera career kab set hoga?',
  'Meri shaadi kab hogi?','Meri love life kaisi rahegi?','Mai apna ghar kab kharidunga?']) {
  let requests=0,calculations=0;
  const result=await directAnswer({...value,query},{env,now:()=>now,makeMemory:memory,
   makeTools:options=>{const execute=createTools(options);return async(name,args)=>{
    calculations++;assert.equal(name,'mcp__VedAstro__get_horoscope_predictions');return execute(name,args);};},
   fetchImpl:async(_,options)=>{requests++;const instruction=JSON.parse(options.body).messages[0].content;
    if(instruction.startsWith('Collect checked evidence'))return new Response('',{status});
    return new Response('',{status:503});
   }});
  assert.equal(calculations,1,query+' '+status);assert.equal(result.answer_model_calls,requests);
  assert.ok(result.answer_validation.includes('pilot_confirmed_chart_after_http_'+status));
  assert.ok(result.answer_validation.includes('pilot_coherent_fallback'));
  assert.deepEqual(result.answer_reading_tools,['get_horoscope_predictions']);
  assert.doesNotMatch(result.reply,/busy|try again|verify this answer|Things are/iu);
  assert.ok(result.reply.length>30);assert.ok(requests<=8);
 }
});

test('recovery never substitutes the selected profile for another person or uses a failed chart as evidence',async()=>{
 let calculations=0;
 const missingPerson=await directAnswer({...value,query:'When will my brother get a job?'},{env,now:()=>now,makeMemory:memory,
  makeTools:()=>async()=>{calculations++;assert.fail('No selected-self chart for brother');},
  fetchImpl:async(_,options)=>JSON.parse(options.body).messages[0].content.startsWith('You interpret the latest utterance')?
   response({route:'checked_reading',reply:''}):new Response('',{status:503})});
 assert.equal(missingPerson.answer_conversation_route,'clarification');
 assert.deepEqual(missingPerson.answer_reading_tools,[]);
 assert.equal(calculations,0);
 await assert.rejects(directAnswer({...value,query:'Mera career kab set hoga?'},{env,now:()=>now,makeMemory:memory,
  makeTools:()=>async()=>JSON.stringify({isError:true,error:'No verified chart'}),
  fetchImpl:async()=>new Response('',{status:503})}),/Direct answer unavailable/);
});

test('aborted and explicit profile-correction requests cannot start local failure recovery',async()=>{
 for(const query of ['Mera career kab set hoga?','Correct my birth time before checking my career.']) {
  const controller=new AbortController();let calculations=0;
  await assert.rejects(directAnswer({...value,query},{env,now:()=>now,signal:controller.signal,makeMemory:memory,
   makeTools:()=>async()=>{calculations++;assert.fail('No chart after cancellation');},
   fetchImpl:async()=>{controller.abort();return new Response('',{status:503});}}));
  assert.equal(calculations,0);
 }
});

test('one bounded companion retry recovers a transient writer or reviewer rejection without unreviewed delivery',async()=>{
 for(const stage of ['writer','reviewer']) {
  const query='Aaj din achha gaya, bas aapse share karna tha.';
  const reply='Yeh sunkar achha laga. Aaj ki kaunsi baat aapke liye sabse achhi rahi?';
  let calls=0,failed=false,reviews=0;
  const result=await directAnswer({...value,query},{env,now:()=>now,makeMemory:memory,
   makeTools:()=>async()=>assert.fail('No chart for companionship'),fetchImpl:async(_,options)=>{
    calls++;const instruction=JSON.parse(options.body).messages[0].content;
    const reviewing=instruction.startsWith('Review a conversational draft');
    if(!failed&&((stage==='reviewer'&&reviewing)||(stage==='writer'&&!reviewing))) {
     failed=true;return new Response('',{status:503,headers:{'retry-after':'0'}});
    }
    if(reviewing){reviews++;return response({status:'accept',issues:[]});}
    return response({route:'conversation',reply});
   }});
  assert.equal(result.reply,reply);assert.equal(calls,3);assert.equal(reviews,1);
  assert.equal(result.answer_model_calls,calls);assert.deepEqual(result.answer_reading_tools,[]);
 }
});

test('a long interpretation and style repair shares the eight-call WhatsApp transport budget',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 let calls=0,interpretation=0,tools=0;
 const history=[{role:'user',text:'Mera career kaisa rahega?'},{role:'assistant',text:'A current career answer.'}];
 const result=await directAnswer({...value,query:'Why?',history},{env,now:()=>now,makeMemory:memory,
  makeTools:options=>{const execute=createTools(options);return async(name,args)=>{tools++;return execute(name,args);};},
  fetchImpl:async(_,options)=>{
   calls++;assert.ok(calls<=8,'A valid answer must not exceed the WhatsApp adapter contract');
   const body=JSON.parse(options.body),instruction=body.messages[0].content;
   if(instruction.startsWith('You interpret the latest utterance')) {
    interpretation++;
    if(interpretation===1)return new Response('',{status:503,headers:{'retry-after':'0'}});
    return response(interpretation===2?{route:'conversation',reply:'A vague response.'}:{route:'checked_reading',reply:''});
   }
   if(instruction.startsWith('Review a conversational draft'))return response({status:'reject',issues:['The question requests checked chart reasons.']});
   if(instruction.startsWith('Collect checked evidence'))return tool();
   if(instruction.startsWith('Review this astrology reply'))return response({evidence_ok:true,reason:'',presentation_issue:'Use slightly clearer everyday wording.'});
   const data=JSON.parse(body.messages.at(-1).content);
   const [answer,...reason]=focusedReadingFallback(data.reading_plan,value).split('\n\n');
   return response({answer,reason:reason.join(' '),remedy:''});
  }});
 assert.equal(calls,8);assert.equal(result.answer_model_calls,8);assert.equal(tools,1);
 assert.match(result.reply,/career/iu);assert.doesNotMatch(result.reply,/busy|try again/iu);
 assert.ok(result.answer_validation.includes('pilot_coherent_verified_with_style_issue'));
});

test('sustained total provider outage remains an explicit failure rather than an invented companion answer',async()=>{
 let calls=0;
 await assert.rejects(directAnswer({...value,query:'Aaj mera din achha gaya.'},{env,now:()=>now,makeMemory:memory,
  makeTools:()=>async()=>assert.fail('No chart for ordinary conversation'),
  fetchImpl:async()=>{calls++;return new Response('',{status:503,headers:{'retry-after':'0'}});}}),/Direct answer unavailable/);
 assert.ok(calls<=3,'No unbounded outage retries');
});
