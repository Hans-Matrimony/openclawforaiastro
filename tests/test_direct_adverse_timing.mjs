import test from 'node:test';
import assert from 'node:assert/strict';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {omittedSupportedTiming} from '../extensions/reviewed-reading/direct/topic-period-context.mjs';

const row={
  engine:'local-sweph-v2',
  birth_chart:{planets:['Saturn: Taurus | house 7'],ashtakavarga_house_bindus:{house_7:{sign:'Taurus'}}},
  dasha:{upcoming_antardashas:[{lord:'Saturn',from:'2027-09-15',to:'2030-05-16'}]},
  verdict_signals:[{area:'marriage',trend:'MIXED',positive:['house 7 (marriage) bindus 31/48 => strong support'],negative:['Saturn ki drishti house 7 par pressure/delay']}],
};
const raw=JSON.stringify(row);
const undated='Saturn ki drishti pressure deti hai.\n\nShaadi ka koi clear timing nahi dikh raha.';

test('an undated adverse period gets evidence review without pretending it is favorable',()=>{
  assert.equal(omittedSupportedTiming(undated,[raw],'Meri shadi kab hogi'),true);
  assert.equal(omittedSupportedTiming('Saturn antardasha September 2027 se May 2030 tak rukawat ka sanket hai.',[raw],'Meri shadi kab hogi'),false);
  const unrelated=structuredClone(row);unrelated.birth_chart.planets=['Saturn: Taurus | house 12'];unrelated.verdict_signals[0].negative=[];
  assert.equal(omittedSupportedTiming(undated,[JSON.stringify(unrelated)],'Meri shadi kab hogi'),false);
  assert.equal(omittedSupportedTiming(undated,[raw,JSON.stringify({...row,birth_chart:{}})],'Meri shadi kab hogi'),false);
});

test('a negative timing answer includes checked boundaries without another chart calculation',async()=>{
  let calls=0,calculations=0;
  const result=await directAnswer({user_id:'synthetic-adverse-timing',query:'Meri shadi kab hogi',language:'hinglish',history:[],birth:{date:'2001-01-03',time:'05:00',location_name:'Delhi'}},{
    env:{OPENROUTER_API_KEY:'test',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'},
    now:()=>new Date('2026-11-02T00:00:00Z'),makeMemory:()=>({read:async()=>[],write:()=>assert.fail('No memory write')}),makeTools:()=>async()=>{calculations++;return raw;},
    fetchImpl:async(_url,options)=>{
      calls++;const body=JSON.parse(options.body);
      let message;
      if(calls===1)message={tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]};
      else if(calls===2)message={content:undated};
      else {assert.equal(calls,3);assert.equal(body.tool_choice.function.name,'submit_timing_reading');message={tool_calls:[{id:'review',type:'function',function:{name:'submit_timing_reading',arguments:JSON.stringify({period_id:'p0',outlook:'unfavorable',factor_ids:['f1']})}}]};}
      return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));
    },
  });
  assert.equal(calls,3);assert.equal(calculations,1);
  assert.match(result.reply,/September 2027 se May 2030/);
  assert.match(result.reply,/sambhavna kam hai/);
  assert.doesNotMatch(result.reply,/pakki|zaroor|hogi hi/);
  assert.ok(result.answer_validation.includes('undated_timing_review'));
  assert.ok(result.answer_validation.includes('topic_timing_repaired'));
  assert.equal(JSON.stringify(row),raw);
});

