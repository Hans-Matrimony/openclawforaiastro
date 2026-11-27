import test from 'node:test';
import assert from 'node:assert/strict';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {createTools} from '../extensions/reviewed-reading/direct/tools.mjs';
import {readingPersonBoundary,otherReadingPerson} from '../extensions/reviewed-reading/direct/reading-person.mjs';
import {pairedPropertyTimingRequest} from '../extensions/reviewed-reading/direct/paired-property-timing.mjs';
import {activeReadingQuestion} from '../extensions/reviewed-reading/direct/followup-scope.mjs';
import {futureAsPast} from '../extensions/reviewed-reading/direct/past-prediction.mjs';
import {companionBoundaryIssue} from '../extensions/reviewed-reading/direct/companion-boundaries.mjs';
import {continuationPolicy} from '../extensions/reviewed-reading/direct/conversation-continuation.mjs';
import {coherentEvidencePacket} from '../extensions/reviewed-reading/direct/pilot-coherent-reading.mjs';
import {buildReadingPlan} from '../extensions/reviewed-reading/direct/pilot-reading-plan.mjs';
import {focusedReplyIssue,focusedReadingFallback} from '../extensions/reviewed-reading/direct/focused-reading-delivery.mjs';
import {get_horoscope_predictions} from '../extensions/reviewed-reading/direct/assets/dev-v2/engine.mjs';
import {correctedReadingSubject} from '../extensions/reviewed-reading/direct/personal-query.mjs';
import {currentResponseLanguage} from '../extensions/reviewed-reading/direct/response-language.mjs';
import {normalizeCompanionLanguage} from '../extensions/reviewed-reading/direct/companion-language.mjs';

const asOf=new Date('2026-11-27T06:00:00Z');
const birth={date:'1998-06-15',time:'10:30',location_name:'Mumbai'};
const value={user_id:'919000000001',reply_surface:'whatsapp',language:'hinglish',user_gender:'male',birth,history:[]};
const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',
 VEDASTRO_DIRECT_REPLY_CACHE:'0',ASTROFRIEND_PILOT_TOPIC_PROMPTS:'1',
 ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_USERS:value.user_id,
 ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1',ASTROFRIEND_PILOT_COHERENT_REPLIES:'1',
 ASTROFRIEND_PILOT_EVENT_TIMING_ENABLED:'1',ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'1',
 ASTROFRIEND_PILOT_NATURAL_CONTINUATION_ENABLED:'1'};
const memory=()=>({read:async()=>[],write:async()=>assert.fail('No memory writes')});
const response=content=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}]});
const chart=()=>JSON.parse(get_horoscope_predictions({birth_date:'15/06/1998',birth_time:birth.time,location_name:birth.location_name}).content[0].text);

test('explicit dismissed topics select the whole new request in natural self and translated forms',()=>{
 for(const [query,wanted] of [
  ['Career ki baat chhodo. Main apna pehla ghar kab kharid paunga?','Main apna pehla ghar kab kharid paunga?'],
  ['Leave my career aside. When can I buy my first house?','When can I buy my first house?'],
  ['करियर की बात छोड़ो। मेरा घर खरीदने का समय कब है?','मेरा घर खरीदने का समय कब है?'],
  ['Ghar ki baat chhodo, meri love life kaisi rahegi?','meri love life kaisi rahegi?']]) {
  assert.equal(correctedReadingSubject(query,{allowDismissal:true}),wanted);
  assert.equal(correctedReadingSubject(query),query,'non-pilot behavior stays unchanged');
 }
 for(const query of ['Job nahi mili, kya career mein delay hai?','Shaadi nahi hui, ab kab hogi?',
  'Career aur ghar dono ki timing batao.'])assert.equal(correctedReadingSubject(query,{allowDismissal:true}),query);
});

test('Roman Hindi overrides English for this turn without treating quoted or negated requests as instructions',()=>{
 const query='Ab Roman Hindi mein sirf do chhoti lines mein manager ko bolne layak message likh do. End mein sawal mat jodna.';
 assert.equal(currentResponseLanguage({language:'english',query}),'hinglish');
 for(const query of ['Roman Hindi mein mat likhna.','"Ab Roman Hindi mein likho."','I study Roman Hindi.'])
  assert.equal(currentResponseLanguage({language:'english',query}),'english');
});

test('two-line copyable drafts preserve recipient register and get a final reviewed repair, not an unreviewed fallback',async()=>{
 const query='Ab Roman Hindi mein sirf do chhoti lines mein manager ko bolne layak message likh do. End mein sawal mat jodna.';
 let calls=0;
 const reply='Family ke liye waqt nikalna meri priority hai.\nMain fixed hours wale role par baat karna chahta hoon.';
 const result=await directAnswer({...value,language:'english',query,history:[
  {role:'user',text:'Reply in English. Family time is more important than a salary jump.'},
  {role:'assistant',text:'Prioritize the fixed-hours role if its pay covers your needs.'}]},
 {env,now:()=>asOf,makeMemory:memory,makeTools:()=>assert.fail('No chart for a draft'),fetchImpl:async(_,options)=>{
  calls++;const body=JSON.parse(options.body);
  if(calls%2===0)return response({status:calls===6?'accept':'reject',issues:calls===6?[]:['Keep the exact requested two-line artifact and recipient.']});
  assert.match(body.messages[0].content,/Hinglish|hinglish/);
  return response({route:'conversation',reply});
 }});
 assert.equal(calls,6);assert.equal(result.reply,reply);
 const informal='Yaar, main tumhari baat sun raha tha.\nMeri baat bhi poori sun lena.';
 assert.equal(normalizeCompanionLanguage(informal,{...value,query:'Message likh do.',preserve_requested_draft:true}),informal);
 assert.match(normalizeCompanionLanguage('Tum kya chahte ho?',value),/Aap kya chahte hain/);
});

test('WHY fallback explains checked period/transit support even when no new date was requested',()=>{
 const packet=coherentEvidencePacket([JSON.stringify(chart())],'career',{question:'Mera career kab set hoga?',focused:true});
 packet.timing_estimate={selected:{basis:{major:{lord:'Venus',relevant:true},minor:{lord:'Mars',relevant:true},transit:{activated_houses:[10],saturn_pressure_houses:[10]}}}};
 const plan=buildReadingPlan({...value,query:'Us time ko strong kyun bol rahe ho?'},'Mera career kab set hoga?',packet);
 assert.equal(plan.timing.status,'not_requested');
 const reply=focusedReadingFallback(plan,value);
 assert.match(reply,/Shukra ki mahadasha/);assert.match(reply,/Mangal ki antardasha/);
 assert.match(reply,/Guru ka gochar/);assert.match(reply,/Shani ka dabav/);assert.doesNotMatch(reply,/20\d\d/);
});

test('another person with missing birth details gets clarification, never the selected self chart',async()=>{
 for(const query of ['Mere dost ki shaadi kab hogi? Uski birth details mere paas nahi hain.',
  "When will my friend's marriage happen?",'Meri behen ka career kab set hoga?']) {
  assert.equal(readingPersonBoundary({...value,query}).kind,'person_profile');
  const result=await directAnswer({...value,query,history:[{role:'assistant',text:'Their wedding is November 2027.'}]},
   {env,now:()=>asOf,makeMemory:memory,makeTools:()=>assert.fail('No tools for missing person'),
    fetchImpl:async()=>response({route:'checked_reading',reply:''})});
  assert.equal(result.answer_conversation_route,'clarification');
  assert.deepEqual(result.answer_reading_tools,[]);assert.doesNotMatch(result.reply,/2027|1998/);
  const execute=createTools({birth,query,propertyReading:true,memory:memory(),
   reading:async()=>assert.fail('No selected profile for this person')});
  await assert.rejects(execute('get_horoscope_predictions',{birth_date:birth.date,birth_time:birth.time,location_name:birth.location_name}),{code:'birth_details_required'});
 }
 for(const query of ['Meri shaadi kab hogi? Dost ki baat nahi kar raha.',
  'Dost se behas hui. Bas baat karni hai.','What does marriage mean in astrology?'])
  assert.equal(readingPersonBoundary({...value,query}),null,query);
});

test('complete other-person inputs bind their own chart without mutating the selected profile',async()=>{
 const query='Mere dost ki shaadi kab hogi?\nBirth date: 1994-02-03\nBirth time: 08:15\nPlace: Delhi';
 assert.equal(readingPersonBoundary({...value,query}),null);
 let actual;
 const execute=createTools({birth,query,propertyReading:true,memory:memory(),reading:async(name,args)=>{
  actual=args;return {content:[{type:'text',text:'{}'}]};
 }});
 await execute('get_horoscope_predictions',{birth_date:birth.date,birth_time:birth.time,location_name:birth.location_name});
 assert.equal(actual.birth_date,'1994-02-03');assert.equal(actual.birth_time,'08:15');assert.equal(actual.location_name,'Delhi');
 assert.equal(birth.location_name,'Mumbai');assert.equal(otherReadingPerson('Mera career kab set hoga?'),false);
});

test('captured shorthand property/career comparison computes two independent windows',async t=>{
 t.mock.timers.enable({apis:['Date'],now:asOf});
 const query='Agar ghar aur career ke time milte hain toh kya dono alag calculate kiye hain?';
 assert.equal(pairedPropertyTimingRequest(query),true);
 let collections=0;
 const result=await directAnswer({...value,query},{env,now:()=>asOf,makeMemory:memory,
  makeTools:()=>async()=>JSON.stringify(chart()),fetchImpl:async(_,options)=>{
   assert.match(JSON.parse(options.body).messages[0].content,/Collect checked evidence/);collections++;
   return Response.json({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{
    id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}}]});
  }});
 assert.equal(result.answer_response_flow,'pilot_paired_timing');assert.equal(collections,1);
 assert.match(result.reply,/career/iu);assert.match(result.reply,/ghar kharidne/iu);assert.match(result.reply,/ganana alag/iu);
 assert.doesNotMatch(result.reply,/career field|ghar ya naya job/iu);
 for(const query of ['Career nahi, ghar ke loan ka time kya hai?','Dost ki property aur mera career dono ka time batao'])
  assert.equal(pairedPropertyTimingRequest(query),false,query);
});

test('short reason follow-up retains the latest self subject and stops at another person or topic',()=>{
 const query='Us time ko strong kyun bol rahe ho? Seedhe words mein samjhao.';
 const history=[{role:'user',text:'Mera career kab stable hoga? Abhi job switch ki soch raha hoon.'},
  {role:'assistant',text:'September 2027 se November 2027.'}];
 assert.match(activeReadingQuestion({...value,query,history},{focused:true}),/^Mera career.*\nFollow-up:/u);
 for(const text of ['Mere dost ki shaadi kab hogi?','Meri love life kaisi rahegi?','Dost se behas hui.']) {
  const result=activeReadingQuestion({...value,query,history:[...history,{role:'user',text}]},{focused:true});
  assert.doesNotMatch(result,/^Mera career/u,text);
 }
});

test('a future year cannot be narrated as a completed event',()=>{
 assert.equal(futureAsPast('Job 2027 tak stable rahi, 2028 ke baad naye challenges shuru ho sakte hain.',asOf),true);
 for(const reply of ['Job 2027 mein stable ho sakti hai.','Job 2027 tak stable reh sakti hai.',
  'Career 2025 tak stable raha.','Job 2027 mein stable ho rahi hogi.',
  'Pehle diya hua "Job 2027 tak stable rahi" galat tha.'])assert.equal(futureAsPast(reply,asOf),false,reply);
});

test('contact advice rejects return promises, preserves quoted drafts, and never leaks twice-rejected promises',async()=>{
 const query='Ex ne block kar diya hai. Kya main doosre number se message karun ya uske office chala jaun?';
 const bad='Thoda space dijiye. Woh jab taiyaar honge, tab khud aayenge.';
 assert.match(companionBoundaryIssue(bad,value),/unsupported promise/);
 assert.equal(companionBoundaryIssue('Unke lautne ka faisla hum nahi jaan sakte.',value),null);
 assert.equal(companionBoundaryIssue('"Tu jab free ho, baat karte hain."',value),null);
 assert.match(companionBoundaryIssue('Aur agar tu chahen toh baad mein baat kar lena.',value),/aap/);
 let requests=0;
 const result=await directAnswer({...value,query},{env,now:()=>asOf,makeMemory:memory,
  makeTools:()=>assert.fail('No chart for contact advice'),fetchImpl:async()=>{
   requests++;return response({route:'advice',reply:bad});
  }});
 assert.equal(requests,2);assert.equal(result.answer_conversation_route,'advice');
 assert.match(result.reply,/Doosre number/);assert.doesNotMatch(result.reply,/aayenge|busy|try again/iu);
});

test('just sharing, no advice, drafts and goodnight keep their natural exceptions',()=>{
 for(const query of ['Office chhodo, ghar wale har cousin ki shaadi se meri comparison karte hain. Bas yeh bata raha tha.',
  'Message bhej diya. Ab koi aur advice mat dena.','Good night.'])assert.equal(continuationPolicy({...value,query}).mode,'quiet',query);
 assert.equal(continuationPolicy({...value,query:'Usko calmly kya message bheju? Ek message likh do jo main copy kar sakun.'}).mode,'format');
});

test('requested informal draft is delivered intact while assistant address stays respectful',async()=>{
 const query='Ek normal message draft kijiye jo main dost ko copy kar sakun.';
 const reply='"Jab tum free ho, araam se baat karte hain."';let calls=0;
 const result=await directAnswer({...value,query},{env,now:()=>asOf,makeMemory:memory,
  makeTools:()=>assert.fail('No chart for a message draft'),fetchImpl:async()=>response(++calls===1?
   {route:'conversation',reply}:{status:'accept',issues:[]})});
 assert.equal(result.reply,reply);assert.equal(calls,2);assert.deepEqual(result.answer_reading_tools,[]);
});

test('study abroad versus current job carries both sets of evidence and rejects one-sided answers',()=>{
 const query='Masters ke liye abroad jaana aur yahin job continue karna, kundli mein kis taraf zyada support hai?';
 const packet=coherentEvidencePacket([JSON.stringify(chart())],'abroad',{question:query,focused:true});
 assert.deepEqual(packet.comparison_outlooks.map(row=>row.topic),['education','abroad','career']);
 const plan=buildReadingPlan({...value,query},query,packet);
 assert.match(focusedReplyIssue('Kundli mein videsh jaane ke yog hain.',plan),/both sides/);
 const fallback=focusedReadingFallback(plan,value);
 assert.match(fallback,/Abroad masters/);assert.match(fallback,/Job continue/);
 assert.equal(focusedReplyIssue(fallback,plan),null);
 assert.equal(coherentEvidencePacket([JSON.stringify(chart())],'abroad',{question:'Can I go abroad?',focused:true}).comparison_outlooks,undefined);
});

test('study/job comparison still answers both options after an unavailable wording pass',async()=>{
 const query='Masters ke liye abroad jaana aur yahin job continue karna, kundli mein kis taraf zyada support hai?';
 const result=await directAnswer({...value,query},{env,now:()=>asOf,makeMemory:memory,
  makeTools:()=>async()=>JSON.stringify(chart()),fetchImpl:async(_,options)=>{
   const body=JSON.parse(options.body);
   if(body.messages[0].content.startsWith('You interpret the latest utterance'))return response({route:'checked_reading',reply:''});
   if(body.messages[0].content.startsWith('Collect checked evidence'))return Response.json({choices:[{
    finish_reason:'tool_calls',message:{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}}]});
   return new Response('',{status:503});
  }});
 assert.match(result.reply,/Abroad masters/);assert.match(result.reply,/Job continue/);
 assert.deepEqual(result.answer_reading_tools,['get_horoscope_predictions']);
 assert.doesNotMatch(result.reply,/busy|try again|2027/iu);
});

test('pilot fixes do not change legacy subject binding or ordinary event detection',async()=>{
 const {selectedSelfBirth}=await import('../extensions/reviewed-reading/direct/selected-self-birth.mjs');
 const {isPropertyQuestion}=await import('../extensions/reviewed-reading/direct/property-intent.mjs');
 const query='Mera career kab stable hoga? Abhi job switch ki soch raha hoon.';
 assert.equal(selectedSelfBirth(query,birth),null);
 assert.deepEqual(selectedSelfBirth(query,birth,{propertyReading:true}),birth);
 assert.equal(isPropertyQuestion('Ghar ke liye bank loan kab approve hoga?'),false);
 assert.equal(isPropertyQuestion('Ghar ke liye bank loan kab approve hoga?',{lenderDecision:true}),true);
 assert.equal(activeReadingQuestion({...value,query:'Us time ko strong kyun bol rahe ho?',history:[{role:'user',text:'Mera career kab set hoga?'}]}),'Us time ko strong kyun bol rahe ho?');
});

test('bare home-loan approval cannot fall into a career prediction',async()=>{
 const query='Career ki timing nahi pooch raha. Ghar ke liye bank loan kab approve hoga?';
 const result=await directAnswer({...value,query},{env,now:()=>asOf,makeMemory:memory,
  makeTools:()=>assert.fail('No chart for lender decision'),fetchImpl:async()=>response({route:'checked_reading',reply:''})});
 assert.match(result.reply,/bank.*loan/iu);assert.doesNotMatch(result.reply,/career|2027|evidence|checked timing/iu);
});
