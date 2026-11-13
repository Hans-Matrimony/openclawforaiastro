import assert from 'node:assert/strict';
import test from 'node:test';
import {activeReadingQuestion} from '../extensions/reviewed-reading/direct/followup-scope.mjs';
import {correctedReadingSubject} from '../extensions/reviewed-reading/direct/personal-query.mjs';
import {questionScope,mismatchedQuestionReply} from '../extensions/reviewed-reading/direct/question-scope.mjs';
import {selectedSelfBirth} from '../extensions/reviewed-reading/direct/selected-self-birth.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';

const birth={date:'1991-04-11',time:'08:00',location_name:'Pune'};
const value={user_id:'synthetic-explicit-topic-correction',query:'Meri shaadi nahi, mera career kab set hoga?',
 birth,language:'hinglish',reply_surface:'whatsapp',history:[{role:'user',text:'Meri shaadi kab hogi?'}]};

test('explicit topic corrections select the current question instead of the rejected topic',()=>{
 for(const query of [value.query,'Not marriage, mera career kab set hoga?','Shaadi nahi mera career kab set hoga?']) {
  const active=activeReadingQuestion({...value,query,reply_to:{role:'assistant',text:'Your marriage has mixed indications.'}});
  assert.equal(active,'mera career kab set hoga?');assert.equal(questionScope(active),'career');
  assert.deepEqual(selectedSelfBirth(active,birth),birth);
  assert.equal(mismatchedQuestionReply(active,'Shaadi mein sahyog hai.\n\nShaadi sambhavit hai.'),true);
 }
 const reverse=activeReadingQuestion({...value,query:'Career nahi, meri shaadi kab hogi?'});
 assert.equal(reverse,'meri shaadi kab hogi?');assert.equal(questionScope(reverse),'marriage');
});

test('negative outcomes, genuine multiple questions, birth changes and other people retain their meaning',()=>{
 for(const query of ['Meri shaadi nahi hui, mera career bhi batao','Meri shaadi nahi hogi kya? Career bhi batao',
  'Meri shaadi aur career kab set honge?','Not only marriage, my career too','Meri shaadi nahi, mera naam update karo']) {
  assert.equal(correctedReadingSubject(query),query);
 }
 const other=activeReadingQuestion({...value,query:'Shaadi nahi, meri behen ka career batao'});
 assert.equal(other,'meri behen ka career batao');assert.equal(selectedSelfBirth(other,birth),null);
 const edit=activeReadingQuestion({...value,query:'Shaadi nahi, mera career, DOB 1992-02-02 update karo'});
 assert.match(edit,/1992-02-02/);assert.equal(selectedSelfBirth(edit,birth),null);
});

test('actual dispatch requests career evidence after an explicit rejection of marriage',async()=>{
 const requests=[];
 await assert.rejects(directAnswer(value,{
  env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0'},
  makeMemory:()=>({read:async()=>[]}),makeTools:options=>{
   assert.equal(options.query,'mera career kab set hoga?');
   assert.equal(options.selectedSelfQuery,'mera career kab set hoga?');
   return async()=>assert.fail('No invented chart call');
  },
  fetchImpl:async(_url,options)=>{
   const body=JSON.parse(options.body);requests.push(body);
   if(requests.length===1)assert.equal(body.messages.at(-1).content,'mera career kab set hoga?');
   else assert.ok(body.messages.at(-1).content.includes('mera career kab set hoga?'));
   return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'Shaadi mein sahyog hai.'}}]}));
  },
 }),/Personal reading requires a successful chart tool/);
 assert.ok(requests.some(r=>r.tool_choice==='required'));
});
