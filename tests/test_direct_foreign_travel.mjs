import assert from 'node:assert/strict';
import test from 'node:test';
import {isPersonalChartQuestion} from '../extensions/reviewed-reading/direct/reading-intent.mjs';
import {selectedSelfBirth} from '../extensions/reviewed-reading/direct/selected-self-birth.mjs';
import {activeReadingQuestion} from '../extensions/reviewed-reading/direct/followup-scope.mjs';
import {conversationGroundingFallback,conversationGroundingInstruction,isUnresolvedPredictionNotice} from '../extensions/reviewed-reading/direct/conversation-grounding.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {createTools} from '../extensions/reviewed-reading/direct/tools.mjs';
import {sourceReading} from '../extensions/reviewed-reading/direct/source-engine.mjs';

const birth={date:'2005-01-03',time:'05:00',location_name:'Delhi'};
const query='20 june 2014\n6:00 am\nDelhi\n\nTell me ki ye abroad jaane ke chances hai';
const notice=conversationGroundingFallback({query:'',history:[],language:'hinglish'},{status:'READY'});
const value={user_id:'synthetic-foreign-reading',query,birth,language:'hinglish',reply_surface:'whatsapp',history:[]};
const history=[{role:'user',text:'Meri shaadi kab hogi?'},{role:'assistant',text:'Old marriage reading.'},
  {role:'user',text:query},{role:'assistant',text:notice}];

test('foreign-travel prediction requests use chart evidence, including the exact multiline birth form',()=>{
  for(const text of [query,'Can I go abroad?','Will I settle overseas?','Mere abroad jaane ke chances batao','Mera videsh jaane ka yog hai?']){
    assert.equal(isPersonalChartQuestion(text),true,text);
    assert.equal(conversationGroundingInstruction({...value,query:text},{status:'READY'}),'');
  }
});

test('foreign-travel practical information and ordinary conversation do not force a personal chart',()=>{
  for(const text of ['What documents do I need to go abroad?','Tell me about passport requirements for overseas travel',
    'What is life abroad?','How do I apply for a visa to go abroad?','I am worried about moving abroad','Hi']){
    assert.equal(isPersonalChartQuestion(text),false,text);
  }
});

test('plain self travel questions bind saved birth, while explicit new dates and other people do not',()=>{
  for(const text of ['Can I go abroad?','Will I settle overseas?','Mere abroad jaane ke chances batao']){
    assert.deepEqual(selectedSelfBirth(text,birth),birth);
  }
  for(const text of [query,'Can my sister go abroad?','Mere friend ke abroad jaane ke chances batao',
    'Change my birth date to 2014-06-20, can I go abroad?'])assert.equal(selectedSelfBirth(text,birth),null,text);
});

test('a short reply to our exact generic notice recovers the latest foreign question and its original birth fields',()=>{
  for(const text of ['Kyu','Why?','Response toh do naa']){
    assert.equal(activeReadingQuestion({...value,query:text,history,reply_to:{role:'assistant',text:notice}}),`${query}\nFollow-up: ${text}`);
  }
  assert.equal(activeReadingQuestion({...value,query:'Kyu',history}),`${query}\nFollow-up: Kyu`);
  for(const language of ['english','hindi','hinglish']){
    assert.equal(isUnresolvedPredictionNotice(conversationGroundingFallback({query:'',history:[],language},{status:'READY'})),true);
  }
  assert.equal(isUnresolvedPredictionNotice('Your marriage will happen in 2031.'),false);
});

test('new topics, unrelated quotes, missing profiles and other people stop old-question recovery',()=>{
  for(const text of ['Hi','I feel lonely','Mera haath padh kr batao','Cancel my subscription','Meri behen ki shaadi kab hogi?']){
    assert.equal(activeReadingQuestion({...value,query:'Kyu',history:[...history,{role:'user',text}],reply_to:{role:'assistant',text:notice}}),'Kyu',text);
  }
  assert.equal(activeReadingQuestion({...value,query:'Kyu',history,birth:null,reply_to:{role:'assistant',text:notice}}),'Kyu');
  assert.equal(activeReadingQuestion({...value,query:'Kyu',history,reply_to:{role:'assistant',text:'Unrelated selected answer'}}),'Kyu');
  assert.equal(activeReadingQuestion({...value,query:'Hi',history,reply_to:{role:'assistant',text:notice}}),'Hi');
});

test('quoted foreign readings and explicit user questions retain their own subject',()=>{
  assert.equal(activeReadingQuestion({...value,query:'Kyu',history,reply_to:{role:'user',text:query}}),`${query}\nFollow-up: Kyu`);
  assert.equal(activeReadingQuestion({...value,query:'Kyu',history,reply_to:{role:'assistant',text:'Aapke abroad jaane ke mixed sanket hain.'}}),
    'Mere abroad jaane ke chances batao\nFollow-up: Kyu');
});

for(const followup of [false,true])test(`actual agent checks the supplied 2014 chart without restoring the saved 2005 profile (${followup?'quoted retry':'initial question'})`,async()=>{
  let calls=0,charts=0,calculatedDate;
  const result=await directAnswer({...value,query:followup?'Kyu':query,history:followup?history:[],
    ...(followup?{reply_to:{role:'assistant',text:notice}}:{})},{
    env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',
      VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'},
    makeMemory:()=>({read:async()=>['[birth] Prior saved year: 2005'],save:async()=>assert.fail('No profile writes')}),
    makeTools:options=>createTools({...options,reading:async(name,args,selected)=>{
      charts++;assert.equal(name,'get_horoscope_predictions');
      assert.equal(args.birth_date,'2014-06-20');assert.equal(args.birth_time,'06:00');assert.equal(args.location_name,'Delhi');
      const checked=await sourceReading(name,args,selected);calculatedDate=JSON.parse(checked.content[0].text).birth_chart.utc_time;
      return checked;
    }}),
    fetchImpl:async(_url,options)=>{
      const body=JSON.parse(options.body);calls++;
      if(calls===1){assert.equal(body.tool_choice,'auto');assert.match(JSON.stringify(body.messages),/2014/);}
      const message=calls===1?{tool_calls:[{id:'foreign-chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:JSON.stringify({birth_date:'2014-06-20',birth_time:'06:00',location_name:'Delhi',query_text:'foreign travel abroad'})}}]}:
        {content:'Videsh jaane ke mile-jule sanket hain; ise pakka nateeja nahi samajhna chahiye.\n\nSambhavana hai, guarantee nahi.'};
      return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));
    },
  });
  assert.equal(charts,1);assert.equal(calls,2);assert.equal(calculatedDate,'2014-06-20T00:30:00.000Z');
  assert.ok(result.answer_reading_tools.includes('get_horoscope_predictions'));
  assert.doesNotMatch(result.reply,/Bina jaanch|purani prediction|timeline|shaadi|marriage|2005/iu);
  assert.match(result.reply,/Videsh/);
  assert.equal(birth.date,'2005-01-03');
});

test('a model cannot skip checked chart work for the foreign question',async()=>{
  const requests=[];
  await assert.rejects(directAnswer(value,{
    env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0'},
    makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>assert.fail('No fabricated tool call'),
    fetchImpl:async(_url,options)=>{
      requests.push(JSON.parse(options.body));
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'Videsh jaane ke chances hain.'}}]}));
    },
  }),/Personal reading requires a successful chart tool/);
  assert.equal(requests[0].tool_choice,'auto');
  assert.ok(requests.some(request=>request.tool_choice==='required'));
});
