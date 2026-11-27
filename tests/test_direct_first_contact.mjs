import test from 'node:test';
import assert from 'node:assert/strict';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {firstContactPolicy} from '../extensions/reviewed-reading/direct/first-contact.mjs';

const value={user_id:'919000000001',reply_surface:'whatsapp',language:'hinglish',user_gender:'unknown',birth:{},
 query:'Hum pehli baar baat kar rahe hain. Aap mera naam jaante ho?',history:[{role:'user',text:'Hi'},{role:'assistant',text:'Hi! How is your day going?'}]};
const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',
 ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_USERS:value.user_id,
 ASTROFRIEND_PILOT_TOPIC_PROMPTS:'1',ASTROFRIEND_PILOT_COHERENT_REPLIES:'1',ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'1',ASTROFRIEND_PILOT_NATURAL_CONTINUATION_ENABLED:'1'};
const awkward='Aapka naam abhi pata nahi hai. Koi bhi sawaal ho, shaadi, career ya kuch aur, mujhse baat kar sakti hoon. Aaj ka din kaisa hai?';
const corrected='Abhi aapka naam mere paas nahi hai. Aapko kis naam se bulaun?';
async function run(outputs,input=value,config=env){
 let calls=0;const instructions=[];
 const result=await directAnswer(input,{env:config,makeMemory:()=>({read:async()=>[],write:async()=>assert.fail('No name write from conversation path')}),makeTools:()=>assert.fail('No chart for introduction'),fetchImpl:async(_,options)=>{
  instructions.push(JSON.parse(options.body).messages[0].content);assert.ok(calls<outputs.length);
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(outputs[calls++])}}]});
 }});return {result,calls,instructions};
}

test('an explicit unknown-name introduction gets one bounded repair of generic repeated wellbeing',async()=>{
 const {result,calls,instructions}=await run([{route:'conversation',reply:awkward},{status:'accept',issues:[]},
  {route:'conversation',reply:corrected},{status:'accept',issues:[]}]);
 assert.equal(calls,4);assert.equal(result.reply,corrected);assert.deepEqual(result.answer_reading_tools,[]);
 assert.match(instructions[0],/name-recognition question/);assert.match(instructions[1],/name-recognition question/);
});

test('a failed optional introduction polish preserves an approved reply without a busy error',async()=>{
 const {result,calls}=await run([{route:'conversation',reply:awkward},{status:'accept',issues:[]},{invalid:true}]);
 assert.equal(calls,3);assert.equal(result.reply,awkward);assert.doesNotMatch(result.reply,/busy|try again/);
});

test('known identity, memory, quotes, greetings, listening and chart questions do not trigger a name form',()=>{
 assert.equal(firstContactPolicy({...value,user_name:'Neel'}),null);
 assert.equal(firstContactPolicy(value,['The user goes by Neel.']),null);
 assert.equal(firstContactPolicy({...value,history:[{role:'user',text:'Mera naam Neel hai.'}]}),null);
 assert.equal(firstContactPolicy({...value,reply_to:{role:'assistant',text:'Do you know my name?'}}),null);
 for(const query of ['Hi','Bas meri baat suno.','Meri shaadi kab hogi?','Translate "Do you know my name?" into Hindi.'])assert.equal(firstContactPolicy({...value,query}),null);
 assert.ok(firstContactPolicy({...value,language:'hindi',query:'क्या आपको मेरा नाम याद है?'}));
});

test('non-focused conversations do not receive the introduction policy or extra calls',async()=>{
 const {calls,instructions}=await run([{route:'conversation',reply:awkward},{status:'accept',issues:[]}],value,{...env,ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'0'});
 assert.equal(calls,2);assert.ok(instructions.every(s=>!s.includes('name-recognition question')));
});
