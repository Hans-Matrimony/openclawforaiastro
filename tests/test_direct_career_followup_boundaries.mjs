import test from 'node:test';
import assert from 'node:assert/strict';
import {futureAsPast} from '../extensions/reviewed-reading/direct/past-prediction.mjs';
import {unrelatedReadingTopic} from '../extensions/reviewed-reading/direct/reading-topic-guard.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {get_horoscope_predictions} from '../extensions/reviewed-reading/direct/assets/dev-v2/engine.mjs';
const now=new Date('2026-11-28T10:00:00Z');

test('captured future timing limitations without a present auxiliary are not completed events',()=>{
 for(const text of [
  'Agle saal, 2027 mein stable job lagne ka koi saaf samay nahi dikh raha.',
  '2027 mein naukri ke liye koi saaf daur nahi dikh rahi.',
  '2027 mein career ke liye samay achha lag raha.',
  'Job 2027 mein mil rahi hai.',
 ])assert.equal(futureAsPast(text,now),false,text);
 for(const text of [
  'Job 2027 tak stable rahi.',
  '2027 mein job ka achha samay dikh raha tha.',
  '2027 mein naukri ka samay achha lag raha tha.',
  'Your job was stable in 2027.',
  'Job 2027 mein hui, lekin ab saaf samay nahi dikh raha.',
 ])assert.equal(futureAsPast(text,now),true,text);
});

test('career definitions may mention regular income without accepting a finance forecast',()=>{
 for(const closing of [
  'Aapke liye stable job ka matlab permanent role hai ya regular income?',
  'Aapke liye stable job mein sabse zaroori kya hai—regular income ya long-term security?',
  'Aapke liye stable job ka sabse zaroori matlab kya hai—regular income, permanent role, ya kaam ki security?',
  'Does a stable job mean regular income or a permanent role to you?',
  'नौकरी में आपकी प्राथमिकता नियमित आय है या स्थायी भूमिका?',
 ])assert.equal(unrelatedReadingTopic('Dasva ghar career ko sahara deta hai.\n\n'+closing,{topic:'career'}),null,closing);
 for(const text of [
  'Your regular income will double in 2027.',
  'Aapke liye job ke saath regular income kab badhegi?',
  'Aapke liye stable job ka matlab regular income ya savings improve hona hai?',
  'Do you prefer regular income or a loan for your job?',
  'What is more important for your regular income and savings?',
 ])assert.ok(unrelatedReadingTopic(text,{topic:'career'}),text);
 assert.ok(unrelatedReadingTopic('Aapke liye stable job ka matlab regular income?',{topic:'relationship'}));
 assert.ok(unrelatedReadingTopic('Aapke liye stable job ka matlab regular income?',{topic:'property'}));
});

test('captured career drafts reach factual review without whole-reading retries or a dropped closing',async()=>{
 const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',
  VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'1',ASTROFRIEND_PILOT_TOPIC_PROMPTS:'1',
  ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_USERS:'919000000001',
  ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1',ASTROFRIEND_PILOT_COHERENT_REPLIES:'1',
  ASTROFRIEND_PILOT_EVENT_TIMING_ENABLED:'1',ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'1',
  ASTROFRIEND_PILOT_NATURAL_CONTINUATION_ENABLED:'1',ASTROFRIEND_PILOT_SEMANTIC_ROUTING_ENABLED:'1'};
 const firstQuestion='Agle saal meri stable job lagne ke yog kaise hain? Saaf batao.';
 const draft={answer:'Agle saal, 2027 mein stable job lagne ka koi saaf samay nahi dikh raha. Kundli ka naukri outlook filhaal kathin hai.',
  reason:'10ve ghar ki mazboot sthiti career ko sahara deti hai. Lekin Shani ki neech aur vakri sthiti rukawat dikhati hai, aur Surya ki neech sthiti bhi chunauti ka sanket deti hai.',
  remedy:'',follow_up:'Aap abhi job dhoondh rahe hain, ya apni current job mein stability chahte hain?'};
 const fixtures=[{query:firstQuestion,timing:true,history:[],draft},
  {query:'Aisa kyun keh rahe ho? Sahara aur rukawat dono samjhao.',timing:false,
   history:[{role:'user',text:firstQuestion},{role:'assistant',text:[draft.answer,draft.reason,draft.follow_up].join('\n\n')}],
   draft:{answer:'Shani ki neech aur vakri sthiti naukri ke mamle mein rukawat ka sanket deti hai.',
    reason:'10va ghar mazboot hai, jo career ko sahara deta hai. Neech Surya bhi chunauti ka sanket hai.',remedy:'',
    follow_up:'Aapke liye stable job ka sabse zaroori matlab kya hai—regular income, permanent role, ya kaam ki security?'}}];
 for(const fixture of fixtures){
  const requests=[];
  const result=await directAnswer({user_id:'919000000001',reply_surface:'whatsapp',language:'hinglish',user_gender:'male',
   birth:{date:'1998-10-18',time:'07:20 AM',location_name:'Delhi, India'},query:fixture.query,history:fixture.history},
   {env,now:()=>now,makeMemory:()=>({read:async()=>[],write:async()=>assert.fail('No memory writes')}),
    makeTools:()=>async()=>get_horoscope_predictions({birth_date:'18/10/1998',birth_time:'07:20',location_name:'Delhi, India'}).content[0].text,
    fetchImpl:async(_,options)=>{
     const body=JSON.parse(options.body);requests.push(body);const system=body.messages[0].content;
     const content=value=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]});
     if(system.startsWith('You interpret the latest utterance'))return content({route:'checked_reading',reply:'',intent:{topic:'career',subject:'self',scope:'natal',timing:fixture.timing,history_index:fixture.history.length?0:-1,property_event:'none',profile_fields:[]}});
     if(system.startsWith('Collect checked evidence'))return Response.json({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}}]});
     if(system.startsWith('Write the complete astrology reply'))return content(fixture.draft);
     // This is an offline fixture verdict, not a new live factual review.
     if(system.startsWith('Review this astrology reply'))return content({evidence_ok:true,reason:'',presentation_issue:''});
     assert.fail('Unexpected recovery call: '+system.slice(0,80));
    }});
  assert.equal(result.reply,[fixture.draft.answer,fixture.draft.reason,fixture.draft.follow_up].join('\n\n'));
  assert.equal(result.answer_model_calls,4);
  assert.ok(result.answer_validation.includes('pilot_coherent_verified'));
  assert.ok(!result.answer_validation.some(v=>v.includes('rejected')||v.includes('fallback')));
  assert.equal(requests.filter(r=>r.messages[0].content.startsWith('Review this astrology reply')).length,1);
 }
});
