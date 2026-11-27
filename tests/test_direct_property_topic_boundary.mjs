import test from 'node:test';
import assert from 'node:assert/strict';
import {isPropertyQuestion} from '../extensions/reviewed-reading/direct/property-intent.mjs';
import {resolveReadingTopic} from '../extensions/reviewed-reading/direct/topic-period-context.mjs';
import {selectedTopicGuides} from '../extensions/reviewed-reading/direct/pilot-topic-prompts.mjs';
import {isPersonalChartQuestion} from '../extensions/reviewed-reading/direct/reading-intent.mjs';
import {selectedSelfBirth} from '../extensions/reviewed-reading/direct/selected-self-birth.mjs';
import {coherentEvidencePacket} from '../extensions/reviewed-reading/direct/pilot-coherent-reading.mjs';
import {get_horoscope_predictions} from '../extensions/reviewed-reading/direct/assets/dev-v2/engine.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {correctedReadingSubject} from '../extensions/reviewed-reading/direct/personal-query.mjs';
import {borrowsCompanionTopic} from '../extensions/reviewed-reading/direct/followup-scope.mjs';
import {focusedReplyIssue} from '../extensions/reviewed-reading/direct/focused-reading-delivery.mjs';

const birth={date:'2001-01-03',time:'05:00',location_name:'Delhi'};
const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',
 VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'1',ASTROFRIEND_PILOT_TOPIC_PROMPTS:'1',
 ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_USERS:'919000000001',
 ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1',ASTROFRIEND_PILOT_COHERENT_REPLIES:'1',
 ASTROFRIEND_PILOT_EVENT_TIMING_ENABLED:'1',ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'1'};
const history=[{role:'user',text:'Mera career kab set hogaa'},
 {role:'assistant',text:'Career ke liye September 2027 se November 2027 tak mauke hain.'}];
const value={user_id:'919000000001',reply_surface:'whatsapp',language:'hinglish',user_gender:'male',birth,history};
const queries=['Mai apna next ghar kab kharidunga','Mai apna next ghar kab khrid dungaa',
 'Mai ghar kab tk khrid paaunga','When will I buy my next house?',
 'When will I purchase a flat?','मैं अपना अगला घर कब खरीदूंगा?'];
const chart=()=>get_horoscope_predictions({birth_date:'3/1/2001',birth_time:'05:00',location_name:'Delhi'}).content[0].text;
const response=content=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}]});

test('property timing keeps its own subject and confirmed profile across the screenshot spellings',()=>{
 for(const query of queries) {
  assert.equal(isPropertyQuestion(query),true,query);
  assert.deepEqual(resolveReadingTopic(query,{multilingual:true}),{topic:'property',houses:[4]},query);
  assert.deepEqual(selectedTopicGuides(query),['property'],query);
  assert.equal(isPersonalChartQuestion(query,{respectDeclinedChart:true,exactDateRequests:true}),true,query);
  assert.deepEqual(selectedSelfBirth(query,birth,{propertyReading:true}),birth,query);
  assert.equal(selectedSelfBirth(query,birth),null,'Property profile binding is opt-in');
 }
 for(const query of ['7ve ghar ki strength kya hai?','Mera career kab set hoga?','I am going home.'])
  assert.equal(isPropertyQuestion(query),false,query);
 for(const query of ['How do I buy a house?','When is my property tax due?','Which documents do I need to buy a flat?'])
  assert.equal(isPersonalChartQuestion(query,{respectDeclinedChart:true,exactDateRequests:true}),false,query);
 assert.equal(selectedSelfBirth('When will my sister buy a house?',birth),null);
});

test('property packet contains only returned fourth-house evidence, without a borrowed career window',()=>{
 const packet=coherentEvidencePacket([chart()],'property',{focused:true});
 assert.equal(packet.topic,'property');assert.equal(packet.assessment.method,'returned-natal-house-strength-summary-v1');
 assert.deepEqual([...packet.assessment.favorable,...packet.assessment.adverse,...packet.assessment.neutral].map(f=>f.house),[4]);
 assert.deepEqual(packet.event_windows,[]);
 assert.doesNotMatch(JSON.stringify(packet),/career|September|2027-09|2027-11/u);
 assert.equal(coherentEvidencePacket([chart()],'property'),null);
 assert.equal(resolveReadingTopic(queries[0]),null);
});

test('an explicit correction from career to buying a home selects the property subject',()=>{
 for(const query of ['Career nahi, main ghar kab kharidunga?',
  'Career ki jagah ab mere ghar kharidne ka samay bataiye.']) {
  const subject=correctedReadingSubject(query,{allowDismissal:true});
  assert.doesNotMatch(subject,/career/iu);
  assert.deepEqual(resolveReadingTopic(subject,{multilingual:true}),{topic:'property',houses:[4]});
  assert.deepEqual(selectedTopicGuides(subject),['property']);
 }
});

test('a career comparison correcting the mistake is distinct from a career forecast',()=>{
 const plan={topic:'property',reasons:{supporting:[],opposing:[]},timing:{status:'unavailable'}};
 assert.equal(focusedReplyIssue('Pehle bataya gaya career ka samay ghar kharidne par lagu nahi hota.',plan),null);
 assert.ok(focusedReplyIssue('Career mein pragati ke yog hain.',plan));
 assert.ok(focusedReplyIssue('Career mein pragati ke yog nahi hain.',plan));
 assert.ok(focusedReplyIssue('Career does not apply. Your job will improve.',plan));
});

test('a discourse prefix preserves a genuine short follow-up without admitting a new subject',()=>{
 for(const query of ['Matlab kab tak?','Toh kab hoga?','So when will it happen?'])
  assert.equal(borrowsCompanionTopic(query,{allowDiscoursePrefix:true}),true,query);
 for(const query of ['Matlab ghar kab khrid paaunga?','So when will I buy my next car?'])
  assert.equal(borrowsCompanionTopic(query,{allowDiscoursePrefix:true}),false,query);
 assert.equal(borrowsCompanionTopic('Matlab kab tak?'),false,'Other consumers keep the existing default');
});

test('actual property dispatch after career rejects the captured career answer even if model review would accept it',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-27T06:00:00Z')});
 for(const query of queries) {
  const requests=[];
  const result=await directAnswer({...value,query},{env,now:()=>new Date(),
   makeMemory:()=>({read:async()=>[],write:async()=>assert.fail('No writes')}),
   makeTools:options=>{assert.equal(options.query,query);assert.equal(options.propertyReading,true);return async()=>chart();},
   fetchImpl:async(_,options)=>{
    const body=JSON.parse(options.body);requests.push(body);const instruction=body.messages[0].content;
    if(instruction.startsWith('You interpret the latest utterance'))return response({route:'checked_reading',reply:''});
    if(instruction.startsWith('Collect checked evidence')) {
     assert.match(instruction,/"topic":"property"/u);assert.doesNotMatch(instruction,/"topic":"career"/u);
     return Response.json({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}}]});
    }
    if(instruction.startsWith('Write the complete astrology reply')) {
     const payload=JSON.parse(body.messages.at(-1).content);
     assert.equal(payload.reading_plan.topic,'property');assert.equal(payload.reading_plan.subject,query);
     assert.equal(payload.reading_plan.timing.status,'supplied_window');
     assert.equal(payload.reading_plan.reasons.property_basis.event,'property_purchase');
     return response({answer:'Kundli mein career mein pragati ke yog dikhte hain. September 2027 se November 2027 tak mauke hain.',reason:'Dasva ghar mazboot hai.',remedy:''});
    }
    return response({evidence_ok:true,reason:'',presentation_issue:''});
   }});
  assert.equal(result.answer_response_flow,'pilot_coherent_reading');
  assert.match(result.reply,/ghar kharidne/u);assert.doesNotMatch(result.reply,/career|dasva|10ve/iu);
  assert.match(result.reply,/September 2027 se November 2027/u);
  assert.ok(result.answer_validation.includes('pilot_coherent_fallback'));
 }
});

test('an unrecognized new reading cannot silently inherit the preceding career topic',async()=>{
 let collected=false;
 await assert.rejects(directAnswer({...value,query:'Will my next car be electric?'},{env,now:()=>new Date('2026-11-27T06:00:00Z'),
  makeMemory:()=>({read:async()=>[],write:async()=>assert.fail('No writes')}),makeTools:()=>async()=>assert.fail('No invented calculation'),
  fetchImpl:async(_,options)=>{
   const body=JSON.parse(options.body),instruction=body.messages[0].content;
   assert.doesNotMatch(instruction,/Collect checked evidence[\s\S]*"topic":"career"/u);
   if(instruction.startsWith('You interpret the latest utterance'))return response({route:'checked_reading',reply:''});
   collected=true;return Response.json({choices:[{finish_reason:'stop',message:{content:'A chart cannot establish which car you will buy.'}}]});
  }}),/Personal reading requires a successful chart tool/u);
 assert.equal(collected,true);
});
