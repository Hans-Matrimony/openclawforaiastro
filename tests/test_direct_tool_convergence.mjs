import assert from 'node:assert/strict';
import test from 'node:test';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';

const value={user_id:'synthetic-tool-convergence',query:'Meri shadi kab hogi',language:'hinglish',
  history:[],birth:{date:'2001-01-03',time:'05:00',location_name:'Delhi'}};
const env={OPENROUTER_API_KEY:'test',VEDASTRO_DIRECT_FLOW:'source',
  VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',
  VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'};
const chart=JSON.stringify({engine:'local-sweph-v2',
  dasha:{upcoming_antardashas:[{lord:'Mars',from:'2027-09-15',to:'2028-11-14'}]},
  verdict_signals:[{area:'marriage',trend:'MIXED',positive:['benefic Jupiter house 7 mein'],negative:[]}]});
const reading='Jupiter 7ve ghar mein hai.\n\nMars antardasha September 2027 se November 2028 mein shaadi sambhavit hai.';
const tool=()=>({finish_reason:'tool_calls',message:{role:'assistant',content:null,tool_calls:[{
  id:'synthetic-call',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'},
}]}});
const completion=choice=>new Response(JSON.stringify({choices:[choice]}));

for (const flow of ['source','reviewed']) {
  test(`${flow}: repeated tool requests finish with a checked answer within the original budget`,async()=>{
    let calls=0,executions=0;
    const max=flow==='source'?7:5;
    const result=await directAnswer(value,{env:{...env,VEDASTRO_DIRECT_FLOW:flow},
      makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{executions++;return chart;},
      fetchImpl:async(_url,options)=>{
        const body=JSON.parse(options.body);calls++;
        if (body.tool_choice==='none') {
          assert.equal(calls,max);
          assert.ok(body.messages.some(m=>m.role==='tool'&&m.content===chart));
          return completion({finish_reason:'stop',message:{role:'assistant',content:reading}});
        }
        return completion(tool());
      }});
    assert.equal(calls,max);assert.equal(executions,max-1);
    assert.equal(result.answer_model_calls,max);
    assert.ok(result.answer_reading_tools.includes('get_horoscope_predictions'));
    assert.match(result.reply,/September 2027 se November 2028/);
    assert.doesNotMatch(result.reply,/busy|Bina jaanch/);
  });
}

test('a provider ignoring the final answer boundary cannot execute another tool',async()=>{
  let calls=0,executions=0;
  await assert.rejects(directAnswer(value,{env,makeMemory:()=>({read:async()=>[]}),
    makeTools:()=>async()=>{executions++;return chart;},
    fetchImpl:async()=>{calls++;return completion(tool());}}),/tool loop did not converge/);
  assert.equal(calls,7);assert.equal(executions,6);
});

test('failed chart calculations cannot turn final prose into an unverified prediction',async()=>{
  let calls=0;
  await assert.rejects(directAnswer(value,{env,makeMemory:()=>({read:async()=>[]}),
    makeTools:()=>async()=>{throw new Error('Calculation unavailable');},
    fetchImpl:async(_url,options)=>{
      calls++;
      return completion(JSON.parse(options.body).tool_choice==='none'
        ? {finish_reason:'stop',message:{content:reading}} : tool());
    }}),/requires a successful chart tool/);
  assert.equal(calls,7);
});

test('normal one-tool answers retain their original path and call count',async()=>{
  let calls=0;
  const result=await directAnswer(value,{env,makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>chart,
    fetchImpl:async(_url,options)=>{
      assert.equal(JSON.parse(options.body).tool_choice,'auto');
      return completion(++calls===1?tool():{finish_reason:'stop',message:{content:reading}});
    }});
  assert.equal(calls,2);assert.match(result.reply,/September 2027 se November 2028/);
});
