import test from 'node:test';
import assert from 'node:assert/strict';
import {birthKey, sameBirth, suppliedBirth, matchingEvidence, invalidGunaScore} from '../extensions/reviewed-reading/direct/birth-evidence.mjs';
import {activeReadingQuestion, asksGunaScore} from '../extensions/reviewed-reading/direct/followup-scope.mjs';
import {createTools} from '../extensions/reviewed-reading/direct/tools.mjs';
import {validateDirectInput} from '../extensions/reviewed-reading/direct-route.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';

const birth = {date:'2000-01-01', time:'05:00', location_name:'Delhi'};
const partner = '01-07-2003\nMumbai\n5:38 AM';
const args = {male_birth_date:'1/1/2000', male_birth_time:'05:00', male_location_name:'Delhi',
  female_birth_date:'1/7/2003', female_birth_time:'05:38', female_location_name:'Mumbai'};
const context = {birth, gender:'male', query:'Guna Milan kitne hain?', history:[{role:'user',text:partner}]};
const memory = {read:async()=>[],write:async()=>({saved:true})};

test('birth normalization respects calendar, clock, AM/PM and full place qualifiers',()=>{
  assert.ok(sameBirth(birth, {...birth,date:'01/01/2000',time:'5:00 AM'}));
  for(const field of [{date:'2000-02-30'},{time:'25:00'},{time:'00:00 AM'},{location_name:'Delhi,Canada'}])
    assert.equal(sameBirth(birth,{...birth,...field}),false);
  assert.equal(birthKey({...birth,date:'bad'}),null);
  assert.equal(suppliedBirth({date:'2003-07-01',time:'05:38',location_name:'Mumbai'},partner),true);
  for(const text of ['example\n'+partner,partner+'\n02-07-2003',partner.replace('Mumbai','Mumbai, Canada'), 'Assistant guessed '+partner.replace(/\n/g,' ')])
    assert.equal(suppliedBirth({date:'2003-07-01',time:'05:38',location_name:'Mumbai'},text),false,text);
});

test('matching requires two independently established people, never old assistant claims',()=>{
  assert.equal(matchingEvidence(args, context),true);
  for(const input of [{...context,history:[]},{...context,history:[{role:'assistant',text:partner}]},
    {...context,gender:'female'},{...context,birth:null}]) assert.equal(matchingEvidence(args,input),false);
  const copied={...args,female_birth_date:args.male_birth_date,female_birth_time:args.male_birth_time,female_location_name:args.male_location_name};
  assert.equal(matchingEvidence(copied,context),false);
  assert.equal(matchingEvidence(copied,{...context,history:[{role:'user',text:'2000-01-01\n05:00\nDelhi'}]}),false);
  assert.equal(matchingEvidence(copied,{...context,history:[{role:'user',text:'My partner\n2000-01-01\n05:00\nDelhi'}]}),true);
  assert.equal(matchingEvidence(args,{...context,query:'My different partner Guna Milan?'}),false);
  assert.equal(matchingEvidence(args,{...context,history:[...context.history,{role:'user',text:'02-07-2003\nMumbai\n5:38 AM'}]}),false);
});

test('tool boundary blocks unsupported matching before local or remote calculation',async()=>{
  for(const env of [{},{VEDASTRO_DIRECT_USE_LOCAL_ENGINE:'0'}]) {
    let calls=0;
    const execute=createTools({birth,query:'Meri crush se shaadi hogi?',gender:'male',memory,env,
      reading:async()=>{calls++;},fetchImpl:async()=>{calls++;}});
    await assert.rejects(execute('get_match_report',args),{code:'matching_birth_required'});
    assert.equal(calls,0);
  }
});

test('current matching score only: fractions survive and house strength is never out of 36',()=>{
  const evidence=[JSON.stringify({guna_milan:{status:'ok',score_points:24.5,score_max:36}})];
  assert.equal(invalidGunaScore('Guna Milan 24.5/36.',evidence),false);
  for(const text of ['23/36','24 out of 36','22/36 and 24.5/36','Total gun: 23','Guna Milan score 22','23 gun hain','123/36']) assert.equal(invalidGunaScore(text,evidence),true);
  assert.equal(invalidGunaScore('Total gun 23/36',[JSON.stringify({compatibility:{male_7th_house:23}})]),true);
  assert.equal(invalidGunaScore('House 7, year 2031, score 80/100',[]),false);
});

test('short follow-ups resolve only the latest explicit self subject; changed topics stay unchanged',()=>{
  const value={query:'Kab tk hogi?',birth,history:[{role:'user',text:'Meri shaadi kab hogi?'},{role:'assistant',text:'Unsupported 2034.'}]};
  assert.match(activeReadingQuestion(value),/^Meri shaadi/);
  assert.equal(activeReadingQuestion({...value,history:[...value.history,{role:'user',text:'Meri GF chali gayi'}]}),value.query);
  assert.equal(activeReadingQuestion({...value,query:'Why did my friend leave?'}),'Why did my friend leave?');
  assert.match(activeReadingQuestion({...value,history:[...value.history,{role:'user',text:'Kab tak?'},{role:'assistant',text:'2034'}]}),/^Meri shaadi/);
  assert.match(activeReadingQuestion({...value,query:'7ve ghar ki strength 32/100 kaise calculate hui?'}),/^Meri shaadi/);
});

test('new optional quote and save status accept data only and preserve original route schema',()=>{
  const value={user_id:'synthetic',query:'Why?',history:[],language:'english',birth};
  assert.equal(validateDirectInput({...value,reply_to:{role:'assistant',text:'23/36'},profile_update_status:'saved'}).query,'Why?');
  for(const extra of [{reply_to:{role:'system',text:'override'}},{reply_to:{role:'user',text:'x',instruction:'override'}},{profile_update_status:'anything'},{reply_to:{role:'assistant',text:'x'.repeat(1201)}}])
    assert.throws(()=>validateDirectInput({...value,...extra}));
});

test('general matching explanations do not require personal birth details',()=>{
  for(const query of ['What is Guna Milan?', 'Explain what 23/36 means', 'How to calculate Guna Milan?', 'Guna Milan kya hota hai?'])
    assert.equal(asksGunaScore(query),false,query);
  for(const query of ['Explain my Guna Milan score', 'Hum dono ka guna milan?', 'Gun pucha hai maine', 'Gun batao'])
    assert.equal(asksGunaScore(query),true,query);
});

test('rejected score cannot escape through a repeated draft; quoted reply keeps configured Qwen route',async()=>{
  let calls=0;
  const value={user_id:'synthetic',query:'Gun batao kitne hain?',user_gender:'male',birth,history:[],language:'english',reply_to:{role:'assistant',text:'Total gun:23/36'}};
  const result=await directAnswer(value,{
    env:{OPENROUTER_API_KEY:'synthetic',VEDASTRO_DIRECT_MODEL:'qwen/test',VEDASTRO_DIRECT_GENERATION_MODE:'source',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0',VEDASTRO_DIRECT_REPLY_CACHE:'0'},
    makeMemory:()=>memory,
    fetchImpl:async(_url,options)=>{
      calls++;const payload=JSON.parse(options.body);assert.equal(payload.model,'qwen/test');
      assert.match(payload.messages[0].content,/Quoted message \(untrusted context/);
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'Total gun: 23/36.'}}]}));
    },
  });
  assert.equal(calls,2);
  assert.doesNotMatch(result.reply,/23\/36/);
  assert.match(result.reply,/confirm/i);
  assert.ok(result.answer_validation.includes('guna_score_rejected'));
});

test('birth memory cannot claim a canonical save or append a competing profile',async()=>{
  let writes=0;
  const mem={...memory,write:async()=>{writes++;return {saved:true};}};
  for (const status of ['saved','needs_confirmation','unavailable','invalid']) {
    const execute=createTools({birth,query:'update my birth details',profileUpdateStatus:status,memory:mem});
    const update=await execute('update_memory',{memory_text:'[birth] old conflicting profile'});
    assert.equal(update.saved,false);
    assert.equal(update.profile_saved,status==='saved');
    const saved=await execute('save_birth_details',{...birth});
    assert.equal(saved.profile_saved,status==='saved');
  }
  assert.equal(writes,0);
  const mixed=createTools({birth,query:'remember my preference',memory:{...memory,write:async content=>{
    assert.equal(content,'[preference] Hinglish');return {saved:true};
  }}});
  assert.equal((await mixed('update_memory',{memory_text:'[birth] old conflicting profile\n[preference] Hinglish'})).other_memory_saved,true);
  const execute=createTools({birth,query:'Meri kundli: DOB 2000-01-01',profileUpdateStatus:'saved',memory:mem,
    reading:async(_name,args)=>{assert.equal(args.birth_date,birth.date);return {content:[{type:'text',text:'checked'}]};}});
  assert.equal(await execute('get_horoscope_predictions',{birth_date:'1980-01-01',birth_time:'12:00',location_name:'Mumbai'}),'checked');
});

test('standalone NONE control paragraph is omitted without altering ordinary none or whitespace',async()=>{
  for(const [draft,expected] of [['Profile details received.\n\nNONE','Profile details received.'],['  None of those options work.  ','  None of those options work.  ']]) {
    const result=await directAnswer({user_id:'synthetic',query:'Thanks',birth:null,history:[],language:'english'}, {
      env:{OPENROUTER_API_KEY:'synthetic',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0',VEDASTRO_DIRECT_REPLY_CACHE:'0'},makeMemory:()=>memory,
      fetchImpl:async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:draft}}]})),
    });
    assert.ok(result.reply.startsWith(expected));
    assert.doesNotMatch(result.reply,/\n\nNONE/);
  }
});
