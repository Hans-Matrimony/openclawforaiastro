import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationGroundingFallback, conversationGroundingIssue, conversationGroundingInstruction} from '../extensions/reviewed-reading/direct/conversation-grounding.mjs';
const profile={status:'READY'};
const value={query:'Nahi Abhi Nahi',language:'hinglish',history:[{role:'user',text:'Mera vivah kab hoga?'},{role:'assistant',text:'Aapke chart mein Mercury antardasha 2027 se 2029 tak hai. Kya aapne kisi se serious baat shuru ki hai?'}]};
test('negative status answers continue the immediately preceding question',()=>{
 for(const query of ['Nahi Abhi Nahi','nhi','No, not yet'.replace(',',''),'not yet','अभी नहीं']){
  const v={...value,query};
  assert.match(conversationGroundingInstruction(v,profile),/relationship-status/);
  assert.match(conversationGroundingFallback(v,profile),/serious baat shuru nahi/);
  assert.ok(conversationGroundingIssue('Your marriage will happen in 2028.',v,profile,true));
 }
});
test('positive answers and language matching',()=>{
 assert.match(conversationGroundingFallback({...value,query:'Yes',language:'english'},profile),/How do you feel/);
 assert.match(conversationGroundingFallback({...value,language:'hindi'},profile),/अभी किसी/);
});
test('new topics, timing requests, unrelated questions and user quotes do not use status recovery',()=>{
 for(const query of ['Nahi career kab set hoga','Nahi, shaadi kab hogi','Nahi abhi nahi lekin kab hoga','Meri girlfriend kab wapas aayegi'])assert.doesNotMatch(conversationGroundingInstruction({...value,query},profile),/relationship-status/);
 for(const extra of [{history:[{role:'assistant',text:'Have you applied for a job?'}]},{reply_to:{role:'user',text:'serious relationship?'}},{history:[]}])assert.doesNotMatch(conversationGroundingInstruction({...value,...extra},profile),/relationship-status/);
});

test('engine recovers repeated off-topic drafts without refusing the status answer',async()=>{
 const {directAnswer}=await import('../extensions/reviewed-reading/direct/agent.mjs');
 let calls=0;
 const result=await directAnswer({...value,user_id:'synthetic-status',reply_surface:'whatsapp',birth:{date:'1991-04-11',time:'08:00',location_name:'Pune'}},{
 env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0'},
 makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{throw Error('No reading requested');},
 fetchImpl:async()=>{calls++;return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'Your marriage will happen in 2028.'}}]}));}
 });
 assert.equal(calls,2);
 assert.match(result.reply,/serious baat shuru nahi/);
 assert.doesNotMatch(result.reply,/Bina jaanch|prediction|2028/);
 assert.deepEqual(result.answer_reading_tools,[]);
});
