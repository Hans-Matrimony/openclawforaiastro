import assert from 'node:assert/strict';
import test from 'node:test';
import {activeReadingQuestion} from '../extensions/reviewed-reading/direct/followup-scope.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {selectedSelfBirth} from '../extensions/reviewed-reading/direct/selected-self-birth.mjs';

const birth={date:'1991-04-11',time:'08:00',location_name:'Pune'};
const quote={role:'assistant',text:'Haan, tumhari gf se shadi hogi. December 2026 se February 2027.'};
const value={user_id:'synthetic-quoted-reading',query:'Kab hogi',birth,reply_to:quote,
  language:'hinglish',reply_surface:'whatsapp',history:[{role:'user',text:'Mera career kab improve hoga?'}]};

test('a quoted marriage timing follow-up requires a fresh self reading without copying its date',()=>{
  const result=activeReadingQuestion(value);
  assert.equal(result,'Meri shaadi ke baare mein batao\nFollow-up: Kab hogi');
  assert.deepEqual(selectedSelfBirth(result,birth),birth);
  assert.doesNotMatch(result,/career|2026|2027/u);
});

test('quoted user questions and assistant subjects stay distinct from latest history',()=>{
  for(const [reply_to,subject] of [
    [{role:'user',text:'Meri shaadi kab hogi?'},'Meri shaadi kab hogi?'],
    [{role:'assistant',text:'Your career has mixed indications.'},'Mera career ke baare mein batao'],
    [{role:'assistant',text:'Aapki padhai mein sahyog hai.'},'Meri padhai ke baare mein batao'],
    [{role:'assistant',text:'Your finances have mixed indications.'},'Meri finances ke baare mein batao'],
  ]) assert.equal(activeReadingQuestion({...value,query:'Why?',reply_to}),subject+'\nFollow-up: Why?');
});

test('new questions, other profiles, mixed subjects and unresolved quotes never borrow a profile',()=>{
  for(const text of ['Your sister marriage is next year.','Your career and marriage improve.',
    'Her marriage will happen soon.','Your birth date is wrong. Your marriage is next year.',
    'Marriage is likely next year.','A selected question about a different topic.']) {
    assert.equal(activeReadingQuestion({...value,reply_to:{role:'assistant',text}}),value.query,text);
  }
  for(const query of ['How are you?','Mera career batao','How do I send a palm photo?',
    'Kab hogi?\nMeri behen ki shaadi batao']) assert.equal(activeReadingQuestion({...value,query}),query);
  assert.equal(activeReadingQuestion({...value,birth:{...birth,time:''}}),value.query);
  assert.equal(activeReadingQuestion({...value,reply_to:{role:'user',text:'My sister marriage reading'}}),value.query);
});

test('actual engine rejects a repeated old quote date without a successful current chart call',async()=>{
  const requests=[];
  await assert.rejects(directAnswer(value,{
    env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0'},
    makeMemory:()=>({read:async()=>[]}),
    makeTools:options=>{
      assert.equal(options.selectedSelfQuery,'Meri shaadi ke baare mein batao');
      return async()=>assert.fail('No fabricated chart call');
    },
    fetchImpl:async(_url,options)=>{
      const body=JSON.parse(options.body);requests.push(body);
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'December 2026 se February 2027 shaadi hogi.'}}]}));
    },
  }),/Personal reading requires a successful chart tool/);
  assert.ok(requests.some(request=>request.tool_choice==='required'));
  assert.match(requests[0].messages.at(-1).content,/Meri shaadi/);
});
