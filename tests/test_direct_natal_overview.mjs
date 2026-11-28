import test from 'node:test';
import assert from 'node:assert/strict';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {get_horoscope_predictions} from '../extensions/reviewed-reading/direct/assets/dev-v2/engine.mjs';
import {coherentEvidencePacket,writeCoherentReading} from '../extensions/reviewed-reading/direct/pilot-coherent-reading.mjs';
import {buildReadingPlan} from '../extensions/reviewed-reading/direct/pilot-reading-plan.mjs';
import {focusedReadingFallback,focusedReplyIssue} from '../extensions/reviewed-reading/direct/focused-reading-delivery.mjs';

const raw=get_horoscope_predictions({birth_date:'18/10/1998',birth_time:'06:35',location_name:'Jaipur, India'}).content[0].text;
const input={user_id:'919000000001',query:'Mere baare mai kuch batao',reply_surface:'whatsapp',language:'hinglish',
 user_gender:'male',birth:{date:'1998-10-18',time:'06:35',location_name:'Jaipur, India'},history:[]};
const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',
 VEDASTRO_DIRECT_REPLY_CACHE:'0',ASTROFRIEND_PILOT_TOPIC_PROMPTS:'1',ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',
 ASTROFRIEND_CONVERSATION_PROGRESS_USERS:input.user_id,ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1',
 ASTROFRIEND_PILOT_COHERENT_REPLIES:'1',ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'1',
 ASTROFRIEND_PILOT_SEMANTIC_ROUTING_ENABLED:'1',ASTROFRIEND_CONVERSATION_MODEL:'fixture/router'};
const intent={topic:'overview',subject:'self',scope:'natal',timing:false,history_index:-1,property_event:'none',profile_fields:[]};
const packet=()=>coherentEvidencePacket([raw],'overview',{focused:true});
const parts=()=>{
 const plan=buildReadingPlan(input,input.query,packet());
 const text=focusedReadingFallback(plan,input);
 assert.ok(text);return {plan,text};
};

test('overview uses independent returned areas, with no global verdict, health forecast or borrowed timing',()=>{
 const value=packet();assert.equal(value.scope,'natal_overview');
 assert.deepEqual(value.overview_outlooks.map(row=>row.topic),['career','marriage','money']);
 assert.equal(value.assessment,null);assert.deepEqual(value.event_windows,[]);
 assert.ok(value.overview_outlooks.every(row=>row.assessment.favorable.length||row.assessment.adverse.length));
 assert.equal(coherentEvidencePacket([raw],'overview'),null,'Keep non-focused consumers unchanged');
 assert.equal(coherentEvidencePacket([raw],'general',{focused:true}),null,'A specific general chart-factor question is not an overview');
 for(const area of ['career','marriage','money']){
  const data=JSON.parse(raw);data.verdict_signals=data.verdict_signals.filter(signal=>signal.area!==area);
  assert.equal(coherentEvidencePacket([JSON.stringify(data)],'overview',{focused:true}),null);
 }
 const conflict=JSON.parse(raw);conflict.birth_chart={different:'person'};
 assert.equal(coherentEvidencePacket([raw,JSON.stringify(conflict)],'overview',{focused:true}),null);
 const conflicting=JSON.parse(raw);conflicting.verdict_signals[0].trend=conflicting.verdict_signals[0].trend==='NEGATIVE'?'POSITIVE':'NEGATIVE';
 assert.equal(coherentEvidencePacket([raw,JSON.stringify(conflicting)],'overview',{focused:true}),null);
});

test('overview fallback makes bounded progress using complete area explanations and does not weaken single-topic isolation',()=>{
 const {plan,text}=parts();
 assert.equal(focusedReplyIssue(text,plan),null);
 assert.ok(text.split(/\s+/u).length<=150);
 assert.doesNotMatch(text,/verify nahi|try again|20\d{2}|dasha|health|death|personality|bindus/iu);
 assert.match(text,/career/iu);assert.match(text,/shaadi|risht/iu);
 assert.ok(focusedReplyIssue(text,{...plan,overview_outlooks:undefined,topic:'property'}));
});

test('overview presentation edits retain the same independent evidence and require a second factual review',async()=>{
 const {text}=parts(),bubbles=text.split('\n\n');
 const clean={answer:bubbles[0],reason:bubbles.slice(1).join(' '),remedy:''};
 const expected=[clean.answer,clean.reason].join('\n\n');
 const first={...clean,answer:'Career: '+clean.answer};
 const packets=[];let calls=0;
 const reply=await writeCoherentReading({value:input,subject:input.query,packet:packet(),focused:true,
  generate:async(_instruction,payload)=>{
   calls++;const context=JSON.parse(payload);packets.push(context.checked_evidence);
   if(calls===1)return JSON.stringify(first);
   if(calls===2)return JSON.stringify({evidence_ok:true,reason:'',presentation_issue:'Remove report headings while preserving all supplied meaning.'});
   if(calls===3){assert.equal(context.edit_mode,'presentation_only');assert.deepEqual(context.previous_reply,first);return JSON.stringify(clean);}
   assert.equal(calls,4);assert.equal(context.proposed,expected);
   return JSON.stringify({evidence_ok:true,reason:'',presentation_issue:''});
  },validate:()=>null,fallback:'No checked answer'});
 assert.equal(reply,expected);assert.equal(calls,4);
 assert.ok(packets.every(value=>JSON.stringify(value)===JSON.stringify(packet())));
 assert.doesNotMatch(reply,/Career:|No checked answer|20\d{2}/u);
});

test('broad questions and a short retry reach the structured overview; failed generation retains checked substance',async()=>{
 for(const query of [input.query,'Batao'])for(const outage of [false,true]){
  const {text}=parts();let charts=0,writers=0;
  const history=query==='Batao'?[{role:'user',text:input.query},
   {role:'assistant',text:'Abhi is jawab ko verify nahi kar paayi. Thodi der baad phir check karte hain.'}]:[];
  const result=await directAnswer({...input,query,history},{env,now:()=>new Date('2026-11-28T12:43:00Z'),
   makeMemory:()=>({read:async()=>[],write:async()=>assert.fail('No profile or memory writes')}),
   makeTools:()=>async name=>{assert.match(name,/get_horoscope_predictions/u);charts++;return raw;},
   fetchImpl:async(_url,options)=>{
    const body=JSON.parse(options.body),system=body.messages[0].content;
    let message;
    if(system.startsWith('You interpret the latest utterance'))message={content:JSON.stringify({route:'checked_reading',reply:'',intent:{...intent,history_index:query==='Batao'?0:-1}})};
    else if(system.startsWith('Collect checked evidence'))message={tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]};
    else if(system.startsWith('Write the complete astrology reply')){
     writers++;if(outage)throw Error('Synthetic writer outage');
     const bubbles=text.split('\n\n');message={content:JSON.stringify({answer:bubbles[0],reason:bubbles.slice(1).join(' '),remedy:''})};
    }else if(system.startsWith('Review this astrology reply'))message={content:JSON.stringify({evidence_ok:true,reason:'',presentation_issue:''})};
    else assert.fail('Unexpected route: '+system.slice(0,60));
    return Response.json({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]});
   }});
  assert.equal(charts,1);assert.equal(writers,1);assert.equal(result.answer_routing.topic,'overview');
  assert.equal(result.answer_response_flow,'pilot_coherent_reading');
  assert.doesNotMatch(result.reply,/verify nahi|busy|12:00|20\d{2}/iu);
  assert.match(result.reply,/career/iu);assert.match(result.reply,/shaadi|risht/iu);
  assert.ok(result.answer_model_calls<=4);
 }
});
