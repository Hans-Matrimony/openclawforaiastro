import assert from 'node:assert/strict';
import test from 'node:test';
import {asksForTiming,isPersonalChartQuestion} from '../extensions/reviewed-reading/direct/reading-intent.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';

test('explicit samay follow-ups require a personal chart without a repeated pronoun',()=>{
  for(const query of ['Matlab kis samay shaadi ke yog hain?','mtlb kis waqt shadi ho sakti hai?',
    'Career ka expected timing window?','Shaadi ke liye kaunsa samay hai?']){
    assert.equal(asksForTiming(query),true,query);
    assert.equal(isPersonalChartQuestion(query),true,query);
  }
  for(const query of ['What is a time window for marriage?','Shaadi ke yog ka matlab kya hai?',
    'Matlab kis samay ka meaning kya hai?','Career ka time window kya hota hai?']){
    assert.equal(isPersonalChartQuestion(query),false,query);
  }
});

test('the observed timing follow-up cannot deliver an old marriage date without a fresh chart',async()=>{
  const query='Matlab kis samay shaadi ke yog hain?';
  const value={user_id:'synthetic-samay-followup',query,language:'hinglish',
    birth:{date:'14 September 2002',time:'6:00 am',location_name:'Delhi'},
    history:[{role:'user',text:'Meri shadi kab hogi'},{role:'assistant',text:'Purana shaadi jawab.'}]};
  const requests=[];
  await assert.rejects(directAnswer(value,{
    env:{OPENROUTER_API_KEY:'test',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',
      VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'},
    makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>assert.fail('No tool returned by mock'),
    fetchImpl:async(_url,options)=>{
      requests.push(JSON.parse(options.body));
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'August 2028 mein shaadi hogi.'}}]}));
    },
  }),/requires a successful chart tool/);
  assert.equal(requests.length,2);
  assert.equal(requests[1].tool_choice,'required');
  assert.ok(requests[1].tools.every(t=>/get_horoscope_predictions|get_current_transits|get_match_report|get_horary_prediction/u.test(t.function.name)));
});
