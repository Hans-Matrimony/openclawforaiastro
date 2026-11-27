import test from 'node:test';
import assert from 'node:assert/strict';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {partialBirthCollectionReply} from '../extensions/reviewed-reading/direct/birth-collection.mjs';

const value={user_id:'919000000001',reply_surface:'whatsapp',language:'hinglish',user_gender:'male',user_name:'Neel',
 query:'Meri date of birth 18 October 1998 hai.',birth:{date:'18 October 1998'},history:[
  {role:'user',text:'Meri shaadi kab hogi?'},
  {role:'assistant',text:'Kundli dekhne ke liye janam tithi, exact samay aur janam sthan bata dijiye.'}]};
const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',
 ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_USERS:value.user_id,
 ASTROFRIEND_PILOT_TOPIC_PROMPTS:'1',ASTROFRIEND_PILOT_COHERENT_REPLIES:'1',ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'1',ASTROFRIEND_PILOT_NATURAL_CONTINUATION_ENABLED:'1'};

for(const [name,input,missing,present] of [
 ['date only',value,/samay.*sthan/u,/janam tithi/u],
 ['date and time',{...value,query:'Mera janam subah 6 bajkar 35 minute par hua tha.',birth:{date:'18 October 1998',time:'06:35'}},/janam sthan/u,/janam tithi|exact samay/u]
])test(`semantic reading handoff with ${name} asks only missing inputs without a chart failure`,async()=>{
 let calls=0;
 const result=await directAnswer(input,{env,makeMemory:()=>({read:async()=>[],write:async()=>assert.fail('No memory write')}),
  makeTools:()=>assert.fail('Missing input must not start chart tools'),fetchImpl:async()=>{
   calls++;assert.equal(calls,1);return Response.json({choices:[{finish_reason:'stop',message:{content:'{"route":"checked_reading","reply":""}'}}]});
  }});
 assert.equal(calls,1);assert.equal(result.answer_model_calls,1);assert.equal(result.answer_conversation_route,'clarification');
 assert.deepEqual(result.answer_reading_tools,[]);assert.match(result.reply,missing);assert.doesNotMatch(result.reply,present);
 assert.doesNotMatch(result.reply,/busy|2027|guarantee|shaadi hogi/iu);
});

test('complete or missing profiles and other-person requests cannot use partial collection',()=>{
 for(const input of [{...value,birth:{}},{...value,birth:{date:'1998-10-18',time:'06:35',location_name:'Jaipur'}},
  {...value,query:'Meri behen ki date of birth 18 October 1998 hai.'},
  {...value,query:'Mera janam kab hua tha?'}, {...value,query:'Meri shaadi kab hogi?'},
  {...value,reply_to:{role:'assistant',text:'Tell me about your brother.'}}])assert.equal(partialBirthCollectionReply(input),null);
});
