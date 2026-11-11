import assert from 'node:assert/strict';
import test from 'node:test';
import {isBriefWhatsAppGreeting, boundWhatsAppGreeting} from '../extensions/reviewed-reading/direct/brief-greeting.mjs';
import {finishWhatsAppReply, whatsappStyleInstruction} from '../extensions/reviewed-reading/direct/whatsapp-presentation.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';

const value = {user_id:'synthetic-greeting', query:'Hi', history:[], birth:null,
  language:'hinglish', user_gender:'male', user_name:'Test Person', reply_surface:'whatsapp'};

test('only a complete WhatsApp greeting gets the small social budget', () => {
  for (const query of ['hi','HI!','Hiiii 😊','hello','hey Meera!','Hello ji','Namaste','नमस्ते',
    'Good morning!','Hi, how are you?','How are you?','Hello! Kaise ho?','Hi\nHello','नमस्ते! कैसे हैं?']) {
    assert.ok(isBriefWhatsAppGreeting({...value,query}), query);
    assert.match(whatsappStyleInstruction({...value,query}), /at most 20 words TOTAL/);
  }
  for (const query of ['Kab hoga?','Why?','Yes','No','ok','thanks','bye', 'Hi, career kab set hoga?',
    'Hello\nMeri shaadi kab hogi?', 'Hi, I am upset','Hi no questions','Hi Hindi mein bolo',
    'Hello my name is Test','Hi payment failed','Write a reply saying hello','Hello, send kundli PDF','']) {
    assert.equal(isBriefWhatsAppGreeting({...value,query}),false,query);
  }
  for (const changed of [{reply_surface:undefined}, {reply_to:{text:'earlier question'}}, {profile_update_status:'saved'}])
    assert.equal(isBriefWhatsAppGreeting({...value,...changed}),false);
});

test('final greeting is short even when the model ignores its word budget', () => {
  const long = 'This unrequested recap should not become several chat bubbles. '.repeat(10);
  const reply = finishWhatsAppReply(long,value);
  assert.equal(reply,'Test Person, Namaste!');
  assert.ok(reply.split(/\s+/u).length <= 20);
  assert.equal(finishWhatsAppReply('Namaste!\n\nAap kaise hain?',value),'Test Person, Namaste! Aap kaise hain?');
  assert.equal(boundWhatsAppGreeting('x'.repeat(181), {...value,language:'english'}),'Hello!');
  assert.equal(boundWhatsAppGreeting('one '.repeat(20), value),'one '.repeat(20).trim());
  assert.equal(boundWhatsAppGreeting('one '.repeat(21), value),'Namaste!');
});

test('greeting names obey saved opt-outs and recent name use', () => {
  const long = 'Unrequested recap. '.repeat(30);
  assert.equal(finishWhatsAppReply(long,value,{facts:['User prefers not to be addressed by name.']}),'Namaste!');
  assert.equal(finishWhatsAppReply(long,{...value,history:[{role:'user',text:'Mera naam mat lena'}]}),'Namaste!');
  assert.equal(finishWhatsAppReply(long,{...value,history:[{role:'assistant',text:'Test Person, hello.'}]}),'Namaste!');
  assert.equal(finishWhatsAppReply(long,{...value,user_name:'Please update'}),'Namaste!');
});

test('PWA, substantive short questions, quotes and protocols are not shortened', () => {
  const long = 'Preserve the complete factual explanation. '.repeat(20);
  for (const changed of [{reply_surface:undefined},{query:'Kab hoga?'},{query:'Hi\nWhen will I marry?'},
    {reply_to:{text:'A previous question'}}]) assert.equal(boundWhatsAppGreeting(long,{...value,...changed}),long);
  for (const raw of ['```'+long+'```','https://example.invalid/'+ 'x'.repeat(200),
    'PDF_REQUEST: '+long, JSON.stringify({text:long}), '| field | '+long])
    assert.equal(finishWhatsAppReply(raw,value),raw);
});

test('actual dispatch keeps a greeting brief without generating a separate companion', async () => {
  let calls=0;
  const result=await directAnswer(value, {
    env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',
      VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'1'},
    makeMemory:()=>({read:async()=>[]}), makeTools:()=>async()=>{throw new Error('Greeting must not call a chart tool');},
    fetchImpl:async(_,options)=>{
      calls++;
      const body=JSON.parse(options.body);
      assert.notEqual(body.max_tokens,160,'No extra companion request for a greeting');
      assert.match(body.messages[0].content,/at most 20 words TOTAL/);
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'Welcome back. '.repeat(35)}}]}));
    },
  });
  assert.ok(calls > 0);
  assert.ok(result.reply.split(/\s+/u).length <= 20,result.reply);
  assert.ok(!result.reply.includes('\n'));
  assert.deepEqual(result.answer_reading_tools,[]);
});
