import test from 'node:test';
import assert from 'node:assert/strict';
import {turnEnvelope,parseTurnDecision} from '../extensions/reviewed-reading/direct/conversation-turn.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
const value={user_id:'919000000001',reply_surface:'whatsapp',query:'Tum batao naa',language:'hinglish',birth:{},history:[{role:'user',text:'Ghar kaha kharidna chahiye?'},{role:'assistant',text:'Which city are you considering?'}]};
const env={ASTROFRIEND_CONVERSATION_REVIEW_ENABLED:'0',OPENROUTER_API_KEY:'test',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'1',ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_USERS:value.user_id};
const reply='Rehne ke liye ghar le rahe hain toh kaam ke paas aur budget mein aane wali jagah se shuru kijiye.';
test('saved conversation context is bounded and excludes non-text rows',()=>{
 const result=turnEnvelope(value,[null,{text:'not trusted'},'a'.repeat(2000),...Array(30).fill('fact')]);
 assert.equal(result.saved_context.length,20);assert.equal(result.saved_context[0].length,1000);
});
test('conversation model override does not inherit astrology provider pins',async()=>{
 const config={ASTROFRIEND_CONVERSATION_MODEL:'test/conversation',ASTROFRIEND_CONVERSATION_REASONING_EFFORT:'low',VEDASTRO_DIRECT_PROVIDER:'parasail/fp8'};
 await directAnswer(value,deps(async(_,options)=>{
  const body=JSON.parse(options.body);assert.equal(body.model,'test/conversation');
  assert.equal(body.provider.only,undefined);assert.equal(body.provider.max_price.completion,0.5);
  assert.equal(body.temperature,undefined);assert.equal(body.max_tokens,1200);assert.deepEqual(body.reasoning,{effort:'low',exclude:true});
  assert.match(body.messages[0].content,/Current explicit corrections take precedence/);
  return response(JSON.stringify({route:'advice',reply}));
 },config));
});
test('opt-in conversation memory reads only the current user and never writes',async()=>{
 let reads=0;
 const d=deps(async(_,options)=>{
  const envelope=JSON.parse(JSON.parse(options.body).messages[1].content);
  assert.deepEqual(envelope.saved_context,['User prefers a short commute.']);
  return response(JSON.stringify({route:'advice',reply}));
 },{ASTROFRIEND_CONVERSATION_MEMORY_ENABLED:'1'});
 d.makeMemory=id=>{assert.equal(id,value.user_id);return {read:async()=>{reads++;return ['User prefers a short commute.'];},write:()=>{throw Error('Unexpected write');}};};
 await directAnswer(value,d);assert.equal(reads,1);
});
test('unavailable conversation memory allows a context-limited reply',async()=>{
 const d=deps(async(_,options)=>{
  assert.deepEqual(JSON.parse(JSON.parse(options.body).messages[1].content).saved_context,[]);
  return response(JSON.stringify({route:'advice',reply}));
 },{ASTROFRIEND_CONVERSATION_MEMORY_ENABLED:'1'});
 d.makeMemory=()=>({read:async()=>{throw Error('Unavailable');}});
 assert.equal((await directAnswer(value,d)).reply,reply);
});
test('conversation pilot preserves the existing memory opt-out',async()=>{
 let memoryAccesses=0;
 const d=deps(async(_,options)=>{
  assert.deepEqual(JSON.parse(JSON.parse(options.body).messages[1].content).saved_context,[]);
  return response(JSON.stringify({route:'advice',reply}));
 },{ASTROFRIEND_CONVERSATION_MEMORY_ENABLED:'1'});
 d.makeMemory=()=>{memoryAccesses++;throw Error('Opted-out memory accessed');};
 assert.equal((await directAnswer({...value,query:'Please ignore my memory. How should I choose a home?'},d)).reply,reply);
 assert.equal(memoryAccesses,0);
});
test('aborting a conversation memory read cannot start model generation',async()=>{
 const controller=new AbortController();let calls=0;
 const d=deps(async()=>{calls++;throw Error('Unexpected model');},{ASTROFRIEND_CONVERSATION_MEMORY_ENABLED:'1'});
 d.makeMemory=()=>({read:async()=>{controller.abort();throw Error('Aborted memory');}});
 await assert.rejects(directAnswer(value,{...d,signal:controller.signal}));assert.equal(calls,0);
});
function deps(fetchImpl,overrides={}) {return {env:{...env,...overrides},fetchImpl,makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{throw Error('Unexpected tool');}};}
function response(content,finish_reason='stop'){return new Response(JSON.stringify({choices:[{finish_reason,message:{content}}],usage:{cost:0.001}}));}
test('envelope preserves quote and dialogue separately without account ID',()=>{
 const result=turnEnvelope({...value,reply_to:'old prediction in 2027'});
 assert.equal(result.quoted_message,'old prediction in 2027');assert.deepEqual(result.dialogue,value.history);
 assert.equal(JSON.stringify(result).includes(value.user_id),false);
});

test('review context has the established assistant identity without guessing unknown genders',()=>{
 assert.deepEqual(turnEnvelope({...value,user_gender:'male'}).assistant_context,{name:'Meera',gender:'female'});
 assert.deepEqual(turnEnvelope({...value,user_gender:'female'}).assistant_context,{name:'Aarav',gender:'male'});
 assert.deepEqual(turnEnvelope(value).assistant_context,{name:null,gender:null});
});

test('an exact repeated clarification reaches bounded repair instead of falling into the old writer',async()=>{
 let calls=0;
 const sequence=[{route:'clarification',reply:'Which city are you considering?'},{route:'advice',reply},{status:'accept',issues:[]}];
 const result=await directAnswer(value,deps(async(_,options)=>{
  const body=JSON.parse(options.body);assert.equal(body.response_format.type,'json_object');
  return response(JSON.stringify(sequence[calls++]));
 },{ASTROFRIEND_CONVERSATION_REVIEW_ENABLED:'1'}));
 assert.equal(result.reply,reply);assert.equal(result.answer_conversation_route,'advice');assert.equal(calls,3);
});

test('an unrepaired exact repetition cannot be published or sent to the legacy writer',async()=>{
 let calls=0;
 await assert.rejects(directAnswer(value,deps(async(_,options)=>{
  assert.equal(JSON.parse(options.body).response_format.type,'json_object');calls++;
  return response(JSON.stringify({route:'clarification',reply:'Which city are you considering?'}));
 },{ASTROFRIEND_CONVERSATION_REVIEW_ENABLED:'1'})),/review did not approve/);
 assert.equal(calls,2);
});

test('review and repair retain the original listening request and memory without mutating input',async()=>{
 const input={...value,query:'Bas suno, advice mat dena',history:[{role:'user',text:'Aaj ka din mushkil tha.'}]};
 const before=structuredClone(input);let calls=0;
 const d=deps(async(_,options)=>{
  const body=JSON.parse(options.body);calls++;
  if(calls===3){
   const envelope=JSON.parse(body.messages[1].content);
   assert.equal(envelope.current_message,input.query);assert.deepEqual(envelope.dialogue,input.history);
   assert.deepEqual(envelope.saved_context,['User is worried about work.']);
  }
  return response(JSON.stringify([
   {route:'conversation',reply:'Here is a list of advice.'},{status:'reject',issues:['User asked to be heard without advice.']},
   {route:'conversation',reply:'Main sun rahi hoon. Aap araam se apni baat kahiye.'},{status:'accept',issues:[]}
  ][calls-1]));
 },{ASTROFRIEND_CONVERSATION_REVIEW_ENABLED:'1',ASTROFRIEND_CONVERSATION_MEMORY_ENABLED:'1'});
 d.makeMemory=()=>({read:async()=>['User is worried about work.']});
 const result=await directAnswer(input,d);assert.match(result.reply,/sun rahi/);assert.equal(calls,4);assert.deepEqual(input,before);
});
test('schema rejects unknown, empty, oversized, and repeated clarification outputs',()=>{
 for(const output of ['oops','null',JSON.stringify({route:'unknown',reply}),JSON.stringify({route:'advice',reply:''}),JSON.stringify({route:'checked_reading',reply}),JSON.stringify({route:'clarification',reply:'Which city are you considering?'})])assert.equal(parseTurnDecision(output,value),null);
 assert.equal(parseTurnDecision(JSON.stringify({route:'checked_reading',reply:''}),value).route,'checked_reading');
});
test('pilot produces complete advice in one call without memory, tools or companion',async()=>{
 let calls=0;
 const d=deps(async(_,options)=>{calls++;const body=JSON.parse(options.body);assert.equal(body.tools,undefined);assert.equal(body.messages[0].content.includes('Generic advice or invented chart narration is a failure'),false);return response(JSON.stringify({route:'advice',reply}));});
 d.makeMemory=()=>{throw Error('Unnecessary memory access');};
 const result=await directAnswer(value,d);assert.equal(result.reply,reply);assert.equal(calls,1);assert.equal(result.answer_model_calls,1);
});
test('nonpilot and switch-off do not use structured conversation path',async()=>{
 for(const overrides of [{ASTROFRIEND_CONVERSATION_PROGRESS_USERS:'919000000002'},{ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'0'}]){
 await directAnswer(value,deps(async(_,options)=>{const body=JSON.parse(options.body);assert.equal(body.response_format,undefined);assert.notEqual(body.model,'test/conversation');return response(reply);},{...overrides,ASTROFRIEND_CONVERSATION_MODEL:'test/conversation',ASTROFRIEND_CONVERSATION_MEMORY_ENABLED:'1'}));
 }
});
test('malformed router output falls through and counts the attempt',async()=>{
 let calls=0;const result=await directAnswer(value,deps(async(_,options)=>{calls++;const body=JSON.parse(options.body);return response(body.response_format?'invalid':reply);}));
 assert.ok(calls>=2);assert.equal(result.answer_model_calls,calls);assert.equal(result.answer_conversation_route,undefined);
});
test('truncated structured output is not delivered',async()=>{
 let first=true;const result=await directAnswer(value,deps(async()=>{if(first){first=false;return response(JSON.stringify({route:'advice',reply:'Rejected truncated answer'}),'length');}return response(reply);}));
 assert.doesNotMatch(result.reply,/Rejected truncated/);
});
test('abort never falls through into another paid request',async()=>{
 const controller=new AbortController();let calls=0;
 await assert.rejects(directAnswer(value,{...deps(async()=>{calls++;controller.abort();throw new Error('aborted');}),signal:controller.signal}));assert.equal(calls,1);
});

test('explicit astrology bypasses the new writer entirely',async()=>{
 let calls=0;
 const result=await directAnswer({...value,query:'Meri shaadi kab hogi?'},deps(async(_,options)=>{
  calls++;const body=JSON.parse(options.body);
  assert.equal(body.response_format,undefined);
  assert.ok(body.tools?.length>0);
  return response('Kya aap apni janam tithi, exact samay aur janam sthan bata sakte hain?');
 }));
 assert.equal(result.answer_conversation_route,undefined);assert.equal(result.answer_model_calls,calls);
 assert.equal(result.answer_usage.length,1);
});

test('semantic reading handoff returns to the original model with no memory writes',async()=>{
 let router=0,reading=0,memoryReads=0;
 const d=deps(async(_,options)=>{
  const body=JSON.parse(options.body);
  if(body.response_format){router++;assert.equal(body.model,'test/conversation');return response(JSON.stringify({route:'checked_reading',reply:''}));}
  reading++;assert.notEqual(body.model,'test/conversation');assert.ok(body.tools?.length>0);
  return response('Kya aap apni janam tithi, exact samay aur janam sthan bata sakte hain?');
 },{ASTROFRIEND_CONVERSATION_MODEL:'test/conversation',ASTROFRIEND_CONVERSATION_MEMORY_ENABLED:'1'});
 d.makeMemory=()=>({read:async()=>{memoryReads++;return [];},write:async()=>{throw Error('Unexpected write');}});
 const result=await directAnswer(value,d);
 assert.equal(router,1);assert.ok(reading>0);assert.ok(memoryReads>0);
 assert.equal(result.answer_conversation_route,undefined);assert.equal(result.answer_model_calls,router+reading);
});

test('a semantic handoff preserves all seven reading rounds and the existing companion allowance',async()=>{
 let routing=0,reading=0;
 const chart=JSON.stringify({engine:'local-sweph-v2',dasha:{upcoming_antardashas:[{lord:'Mars',from:'2027-09-15',to:'2028-11-14'}]},verdict_signals:[{area:'marriage',trend:'MIXED',positive:['benefic Jupiter house 7 mein'],negative:[]}]});
 const input={...value,query:'Kab tak?',history:[{role:'user',text:'Meri shaadi kab hogi?'}],birth:{date:'2001-01-03',time:'05:00',location_name:'Example City'}};
 const d=deps(async(_,options)=>{
  const body=JSON.parse(options.body);
  if(body.response_format){routing++;return response(JSON.stringify({route:'checked_reading',reply:''}));}
  reading++;
  if(reading<=6){
   assert.notEqual(body.tool_choice,'none');
   return Response.json({choices:[{finish_reason:'tool_calls',message:{role:'assistant',content:null,tool_calls:[{id:'call-'+reading,type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}}]});
  }
  if(reading===7){assert.equal(body.tool_choice,'none');return response('Jupiter 7ve ghar mein hai.\n\nMars antardasha September 2027 se November 2028 mein shaadi sambhavit hai.');}
  return response('NONE');
 });
 d.makeTools=()=>async()=>chart;
 const result=await directAnswer(input,d);
 assert.equal(routing,1);assert.equal(reading,8);assert.equal(result.answer_model_calls,9);
 assert.ok(result.answer_reading_tools.includes('get_horoscope_predictions'));
});
test('HTTP rejection uses the established path without router retries',async()=>{
 let routerCalls=0;
 const result=await directAnswer(value,deps(async(_,options)=>{
  if(JSON.parse(options.body).response_format){routerCalls++;return new Response('unavailable',{status:503});}
  return response(reply);
 }));assert.equal(routerCalls,1);assert.equal(result.answer_conversation_route,undefined);
});
test('new flow remains excluded from PWA and voice',async()=>{
 for(const reply_surface of ['pwa','voice']){
 await directAnswer({...value,reply_surface},deps(async(_,options)=>{
  assert.equal(JSON.parse(options.body).response_format,undefined);return response(reply);
 }));
 }
});

test('paraphrased clarification gets one bounded repair with dialogue intact',async()=>{
 let calls=0;
 const result=await directAnswer(value,deps(async(_,options)=>{
  calls++;const body=JSON.parse(options.body);
  assert.equal(body.response_format.type,'json_object');
  if(calls===2)assert.ok(body.messages.at(-1).content.includes('Reconsider'));
  return response(JSON.stringify(calls===1?{route:'clarification',reply:'Aap city mein lena chahte hain ya country mein?'}:{route:'advice',reply}));
 }));
 assert.equal(calls,2);assert.equal(result.reply,reply);assert.equal(result.answer_model_calls,2);
});
test('astrology model inputs and delivered reply are identical with new switch off/on',async()=>{
 const runs=[];
 for(const enabled of ['0','1']){
  const bodies=[];
  const result=await directAnswer({...value,query:'Mera career kab set hoga?',history:[]}, {
   ...deps(async(_,options)=>{bodies.push(JSON.parse(options.body));return response('Kya aap apni janam tithi, exact samay aur janam sthan bata sakte hain?');},{ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:enabled,ASTROFRIEND_CONVERSATION_MODEL:'test/conversation',ASTROFRIEND_CONVERSATION_MEMORY_ENABLED:'1'}),
   now:()=>new Date('2026-11-24T10:00:00Z')});
  runs.push({bodies,result});
 }
 assert.deepEqual(runs[0],runs[1]);
});

test('semantic review rejects unsupported recommendation, repairs once and verifies repair',async()=>{
 let calls=0;
 const result=await directAnswer(value,deps(async()=>{
  const sequence=[{route:'advice',reply:'Pune has guaranteed growth.'},{status:'reject',issues:['Unsupported investment claim']},{route:'advice',reply},{status:'accept',issues:[]}];
  return response(JSON.stringify(sequence[calls++]));
 },{ASTROFRIEND_CONVERSATION_REVIEW_ENABLED:'1'}));
 assert.equal(result.reply,reply);assert.equal(calls,4);assert.equal(result.answer_model_calls,4);
});
test('failed semantic review cannot bypass into the legacy writer',async()=>{
 for(const verdict of [{status:'reject',issues:['Unsupported claim']},{status:'accept',issues:['Contradictory verdict']},null]){
  let calls=0;
  await assert.rejects(directAnswer(value,deps(async()=>{
   calls++;return response(JSON.stringify(calls%2?{route:'advice',reply}:verdict));
  },{ASTROFRIEND_CONVERSATION_REVIEW_ENABLED:'1'})),/review did not approve/);
  assert.ok(calls<=4);
 }
});
test('review transport error does not fall through to an unreviewed reply',async()=>{
 let calls=0;
 await assert.rejects(directAnswer(value,deps(async()=>{
  calls++;if(calls>1)throw Error('transport');return response(JSON.stringify({route:'advice',reply}));
 },{ASTROFRIEND_CONVERSATION_REVIEW_ENABLED:'1'})),/transport/);
 assert.equal(calls,2);
});

test('pilot review receives respectful address without another generation or new content',async()=>{
 let calls=0;
 const corrected='Aapne bahut mehnat ki thi; main sun rahi hoon.';
 const result=await directAnswer({...value,query:'Bas meri baat suno, advice mat dena.'},deps(async()=>{
  calls++;
  return response(JSON.stringify(calls===1 ? {route:'conversation',reply:'Tumne bahut mehnat ki thi; main sun rahi hoon.'} : {status:'accept',issues:[]}));
 },{ASTROFRIEND_CONVERSATION_REVIEW_ENABLED:'1'}));
 assert.equal(result.reply,corrected);
 assert.equal(calls,2);
});

test('captured listening reply cannot mix respectful aap with keh sakti ho',async()=>{
 let calls=0;
 const corrected='Main aapki baat dhyaan se sun raha hoon. Jo bhi mann mein hai, keh sakti hain.';
 const result=await directAnswer({...value,user_gender:'female',query:'Bas meri baat suno, advice mat dena.'},deps(async()=>{
  calls++;
  return response(JSON.stringify(calls===1?{route:'conversation',reply:'Main aapki baat dhyaan se sun raha hoon. Jo bhi mann mein hai, keh sakti ho.'}:
   {status:'accept',issues:[]}));
 },{ASTROFRIEND_CONVERSATION_REVIEW_ENABLED:'1'}));
 assert.equal(result.reply,corrected);assert.equal(calls,2);
});

test('listening repair also preserves respectful agreement for keh do',async()=>{
 let calls=0;
 const corrected='Main sun raha hoon; aaram se keh dijiye.';
 const result=await directAnswer({...value,user_gender:'female',query:'Bas meri baat suno, advice mat dena.'},deps(async()=>{
  calls++;
  return response(JSON.stringify(calls===1?{route:'conversation',reply:'Main sun raha hoon; aaram se keh do.'}:
   {status:'accept',issues:[]}));
 },{ASTROFRIEND_CONVERSATION_REVIEW_ENABLED:'1'}));
 assert.equal(result.reply,corrected);assert.equal(calls,2);
});

test('captured listening wording is normalized before review without advice or a chart',async()=>{
 for(const feeling of ['akela','akeli']) {
  let calls=0;
  const original=`Aaj bahut ${feeling} feel ho raha hai—yeh sach mein bhaari lag sakta hai. Main yahin tumhari baat sun raha hoon, bina advice diye. Jo bhi mann mein hai, aaram se keh do; tumhe abhi kuch explain ya fix karne ki zaroorat nahi.`;
  const expected='Aaj bahut akelapan mehsoos ho raha hai—yeh sach mein bhaari lag sakta hai. Main yahin aapki baat sun raha hoon, bina advice diye. Jo bhi mann mein hai, aaram se keh dijiye; aapko abhi kuch explain ya fix karne ki zaroorat nahi.';
  const result=await directAnswer({...value,user_gender:'female',query:'Bas meri baat suno, advice mat dena.'},deps(async(_,options)=>{
   calls++;if(calls===1)return response(JSON.stringify({route:'conversation',reply:original}));
   const candidate=JSON.parse(JSON.parse(options.body).messages.at(-1).content).candidate;
   assert.equal(candidate.reply,expected);
   return response('{"status":"accept","issues":[]}');
  },{ASTROFRIEND_CONVERSATION_REVIEW_ENABLED:'1'}));
  assert.equal(result.reply,expected);assert.equal(calls,2);assert.deepEqual(result.answer_reading_tools,[]);
 }
});

test('captured two-step advice keeps steps and numbers while using respectful verbs',async()=>{
 const original='1. Job description dekhkar apne 3 relevant examples yaad kar lo.\n2. Kapde aur zaroori cheezein abhi ready karke, 5 minute common questions bolkar practice karo.';
 const expected=original.replace('kar lo','kar lijiye').replace('karo','kijiye');let calls=0;
 const result=await directAnswer({...value,query:'Interview ke liye abhi kya karun? Sirf 2 chhote steps batao.'},deps(async(_,options)=>{
  if(calls===0)assert.match(JSON.parse(options.body).messages[0].content,/each numbered step gives one small action/);
  if(++calls===1)return response(JSON.stringify({route:'advice',reply:original}));
  assert.equal(JSON.parse(JSON.parse(options.body).messages.at(-1).content).candidate.reply,expected);
  return response('{"status":"accept","issues":[]}');
 },{ASTROFRIEND_CONVERSATION_REVIEW_ENABLED:'1'}));
 assert.equal(result.reply,expected);assert.equal(calls,2);
});

test('a semantic listening repair also receives grammar normalization before final review',async()=>{
 let calls=0;
 const result=await directAnswer({...value,user_gender:'female',query:'Bas meri baat suno, advice mat dena.'},deps(async(_,options)=>{
  calls++;
  if(calls===1)return response(JSON.stringify({route:'conversation',reply:'Aap walk kijiye.'}));
  if(calls===2)return response('{"status":"reject","issues":["Advice was not requested"]}');
  if(calls===3)return response(JSON.stringify({route:'conversation',reply:'Aaj bahut akeli feel ho raha hai. Main sun raha hoon, aaram se keh do.'}));
  assert.equal(JSON.parse(JSON.parse(options.body).messages.at(-1).content).candidate.reply,'Aaj bahut akelapan mehsoos ho raha hai. Main sun raha hoon, aaram se keh dijiye.');
  return response('{"status":"accept","issues":[]}');
 },{ASTROFRIEND_CONVERSATION_REVIEW_ENABLED:'1'}));
 assert.equal(calls,4);assert.match(result.reply,/akelapan mehsoos ho raha hai/);
});
