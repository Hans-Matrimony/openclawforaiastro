import assert from 'node:assert/strict';
import test from 'node:test';
import {activeReadingQuestion} from '../extensions/reviewed-reading/direct/followup-scope.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';

const birth={date:'1991-04-11',time:'08:00',location_name:'Pune'};
const marriage=[{role:'user',text:'Meri shaadi kab hogi?'},{role:'assistant',text:'An earlier marriage reading.'}];
const value={user_id:'synthetic-topic-switch',query:'Why?',birth,history:marriage,language:'hinglish',reply_surface:'whatsapp'};
const changedQuestions=[
  'How are you?','Kaise ho?','Kaisi ho?','How is it going?',
  'Why is the sky blue?','How do I reset my password?','When will it rain?',
  'How much does the subscription cost?','When can I cancel my subscription?',
  'How do I pay?','Kab payment karna hai?','How can I send a palm photo?',
  'Why does Saturn have rings?','How does antardasha work?',
  'Mera career ke baare mein batao','Meri padhai kaisi rahegi?',
];

for(const query of changedQuestions)test(`a new question never borrows the marriage subject: ${query}`,()=>{
  assert.equal(activeReadingQuestion({...value,query}),query);
  assert.equal(activeReadingQuestion({...value,query:'Why?',history:[...marriage,{role:'user',text:query}]}),
    /^(?:Mera career|Meri padhai)/u.test(query)?`${query}\nFollow-up: Why?`:'Why?');
});

test('genuine short follow-ups retain the latest self topic in English, Hinglish and Hindi',()=>{
  const current=[...marriage,{role:'user',text:'Mera career kab improve hoga?'},{role:'assistant',text:'The current career reading.'}];
  for(const query of ['Why?','How?','How did you calculate that?','Kis basis par?',
    'Kab tk hoga?','Kab hoga?','When will it happen?','How soon?','Which year?',
    'Why 2031?','2031 kyun?','कब तक होगा?','क्यों?',
    '7ve ghar ki strength 32/100 kaise calculate hui?',
    'Kab hoga?\nResponse toh do naa','Why?\nPlease answer']) {
    assert.equal(activeReadingQuestion({...value,query,history:current}),`Mera career kab improve hoga?\nFollow-up: ${query}`,query);
  }
});

test('mixed bursts, explicit quotes, profile changes and other-person questions keep their subject',()=>{
  for(const query of ['How are you?\nKab hoga?','Why?\nHow do I pay?',
    'Kab hoga?\nMy sister needs a reading','When will my sister marry?',
    'How do I change my birth time?','When should I upload the photo?']) {
    assert.equal(activeReadingQuestion({...value,query}),query,query);
  }
  for(const role of ['user','assistant'])for(const query of ['Why?','Kab hoga?','Response toh do naa']) {
    assert.equal(activeReadingQuestion({...value,query,reply_to:{role,text:'A selected question about a different topic.'}}),query);
  }
  for(const previous of ['How are you?','DOB: 1990-02-02','Meri behen ki shaadi kab hogi?',
    'Meri GF chali gayi','Mera haath padh kr batao','Cancel my subscription']) {
    assert.equal(activeReadingQuestion({...value,query:'Kab hoga?',history:[...marriage,{role:'user',text:previous}]}),'Kab hoga?',previous);
  }
});

test('current dispatch keeps a wellbeing greeting brief after an old marriage reading',async()=>{
  for(const query of ['How are you?','Kaise ho?']) {
    let calls=0;
    const result=await directAnswer({...value,query},{
      env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'1'},
      makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>assert.fail('A greeting must not read a chart'),
      fetchImpl:async(_url,options)=>{
        calls++;const body=JSON.parse(options.body);
        assert.equal(body.messages.at(-1).content,query);
        assert.match(body.messages[0].content,/at most 20 words TOTAL/);
        assert.notEqual(body.max_tokens,160,'A greeting needs no extra companion request');
        return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'Namaste, aap kaise hain?'}}]}));
      },
    });
    assert.equal(calls,1);assert.deepEqual(result.answer_reading_tools,[]);
    assert.doesNotMatch(result.reply,/shaadi|marriage|20\d{2}/iu);
    assert.ok(result.reply.split(/\s+/u).length<=20);
  }
});

test('a quote remains explicit context and never selects birth from a different latest topic',async()=>{
  const reply_to={role:'assistant',text:'The selected earlier message.'};
  const result=await directAnswer({...value,query:'Why?',reply_to},{
    env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'},
    makeMemory:()=>({read:async()=>[]}),makeTools:options=>{assert.equal(options.query,'Why?');assert.equal(options.selectedSelfQuery,undefined);return async()=>assert.fail('No fabricated calculation');},
    fetchImpl:async(_url,options)=>{
      const body=JSON.parse(options.body);assert.equal(body.messages.at(-1).content,'Why?');
      assert.ok(body.messages[0].content.includes(reply_to.text));
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'Which part of the selected message would you like to discuss?'}}]}));
    },
  });
  assert.deepEqual(result.answer_reading_tools,[]);
});
