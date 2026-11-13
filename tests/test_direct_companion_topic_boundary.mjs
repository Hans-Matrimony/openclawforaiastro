import assert from 'node:assert/strict';
import test from 'node:test';
import {companionFocus,closingDrifts} from '../extensions/reviewed-reading/direct/companion-context.mjs';
import {companionFallback} from '../extensions/reviewed-reading/direct/companion-fallback.mjs';
import {contextualClosing} from '../extensions/reviewed-reading/direct/contextual-closing.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';

const history=[{role:'user',text:'Meri shaadi kab hogi?'},{role:'assistant',text:'Old marriage answer.'},
 {role:'user',text:'Mera career batao'},{role:'assistant',text:'Old career answer.'}];
for(const query of ['Why is the sky blue?','How are you?','How do I reset my password?','When will it rain?']) {
 test(`the companion stays on the new subject: ${query}`,async()=>{
  const value={query,history,language:'hinglish'};
  assert.deepEqual(companionFocus(value),{topics:[],user_topic:query});
  assert.equal(companionFallback(value),null);
  assert.equal(closingDrifts('Career mein agla kadam kya hoga?',companionFocus(value),value,[]),true);
  const reply=await contextualClosing('The answer to the new question.',value,{
    generate:async()=> 'Career mein agla kadam lene se pehle kis baat par saath mein sochna chahenge?',
  });
  assert.doesNotMatch(reply,/career|shaadi|marriage/iu);
 });
}
test('genuine short follow-ups keep the latest topic but stop at a new general question',()=>{
 for(const query of ['Why?','Aur batao','Haan','Kab hoga?','Ab kya karun?','2030 tak?']) {
  assert.ok(companionFocus({query,history}).topics.includes('career'));
  assert.deepEqual(companionFocus({query,history:[...history,{role:'user',text:'Why is the sky blue?'}]}),{topics:[],user_topic:query});
 }
});

test('a captured-style stale third bubble is removed even when the main explanation ends in a question',async()=>{
 const base='The explanation of the new question.\n\nDoes that make sense?';
 const reply=await contextualClosing(base+'\n\nCareer mein agla kadam kya hai?',{
  query:'Why is the sky blue?',history,language:'english',
 },{generate:async()=>assert.fail('No extra writer call for a new general explanation')});
 assert.equal(reply,base);
});

test('actual dispatch on a new general question does not generate a stale personal follow-up',async()=>{
 let calls=0;
 const result=await directAnswer({user_id:'synthetic-new-general-question',query:'Why is the sky blue?',
  history,language:'english',reply_surface:'whatsapp'}, {
  env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'1',VEDASTRO_DIRECT_REPLY_CACHE:'0'},
  makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>assert.fail('No chart calculation on this general question'),
  fetchImpl:async()=>{
   calls++;assert.equal(calls,1);
   return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'The explanation of the new question.'}}]}));
  },
 });
 assert.equal(calls,1);assert.deepEqual(result.answer_reading_tools,[]);
 assert.doesNotMatch(result.reply,/career|shaadi|marriage/iu);
});
