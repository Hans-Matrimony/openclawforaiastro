import test from 'node:test';
import assert from 'node:assert/strict';
import {pilotTopicPrompt,TOPIC_PROMPTS} from '../extensions/reviewed-reading/direct/pilot-topic-prompts.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
const env={VEDASTRO_DIRECT_ENVIRONMENT:'development',ASTROFRIEND_PILOT_TOPIC_PROMPTS:'1',ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_USERS:'919000000001',VEDASTRO_DIRECT_FLOW:'source',OPENROUTER_API_KEY:'test',VEDASTRO_DIRECT_REPLY_CACHE:'0'};
const value={user_id:'919000000001',reply_surface:'whatsapp',query:'When will I get married?',history:[],birth:{},language:'english'};
test('guide requires opt-in, exact pilot, WhatsApp and reading',()=>{
 assert.equal(Object.keys(TOPIC_PROMPTS).length,17);
 assert.match(pilotTopicPrompt(env,value,true),/Pilot use-case guides/);
 for(const [e,v,r] of [
  [{...env,ASTROFRIEND_PILOT_TOPIC_PROMPTS:'0'},value,true],
  [{...env,ASTROFRIEND_PILOT_TOPIC_PROMPTS:undefined},value,true],
  [{...env,ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'0'},value,true],
  [{...env,ASTROFRIEND_CONVERSATION_PROGRESS_USERS:'*'},value,true],
  [{...env,VEDASTRO_DIRECT_FLOW:'other'},value,true],
  [env,{...value,user_id:'919000000002'},true],
  [env,{...value,reply_surface:'pwa'},true], [env,value,false]]) assert.equal(pilotTopicPrompt(e,v,r),'');
});
async function capture(e,v){
 let payload;
 await directAnswer(v,{env:e,makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{throw Error('no tool expected');},fetchImpl:async(_url,options)=>{payload=JSON.parse(options.body);throw Error('capture only');}}).catch(error=>{if(error.message!=='capture only') throw error;});
 assert.ok(payload,'model input captured'); return payload;
}
test('non-pilot model input remains identical with switch on/off',async()=>{
 const v={...value,user_id:'919000000002'};
 assert.deepEqual(await capture(env,v),await capture({...env,ASTROFRIEND_PILOT_TOPIC_PROMPTS:'0'},v));
});
test('pilot reading receives guide while existing tools and history remain intact',async()=>{
 const on=await capture(env,value);const off=await capture({...env,ASTROFRIEND_PILOT_TOPIC_PROMPTS:'0'},value);
 assert.match(on.messages[0].content,/# Pilot use-case guides/);
 assert.doesNotMatch(off.messages[0].content,/# Pilot use-case guides/);
 assert.deepEqual(on.tools,off.tools);
 assert.deepEqual(on.messages.slice(1),off.messages.slice(1));
});


