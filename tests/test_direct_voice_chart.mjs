import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareVoiceChart} from '../extensions/reviewed-reading/direct/voice-chart.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
const value={user_id:'synthetic-voice-prefill',query:'When will my career improve?',reply_surface:'voice',birth:{date:'1991-04-11',time:'08:00',location_name:'Pune'},language:'english',history:[]};
const chart={engine:'local-sweph-v2',birth_chart:{date:'1991-04-11'},dasha:{upcoming_antardashas:[{lord:'Mars',from:'2027-09-15',to:'2028-11-14'}]}};

test('voice prepares only the selected self career chart with the real query', async()=>{
  let calls=0;
  const result=await prepareVoiceChart(value,async(name,args)=>{
    calls++;assert.equal(name,'mcp__VedAstro__get_horoscope_predictions');
    assert.deepEqual(args,{birth_date:'1991-04-11',birth_time:'08:00',location_name:'Pune',query_text:value.query});
    return JSON.stringify(chart);
  });
  assert.equal(calls,1);assert.deepEqual(JSON.parse(result.content),chart);
});

test('other people, corrections, matching, incomplete profiles and text replies retain normal tool selection',async()=>{
  const cases=[{reply_surface:undefined},{reply_surface:'whatsapp'},{reply_to:{role:'assistant',text:'An older reading'}},{profile_update_status:'needs_confirmation'},{birth:{...value.birth,time:''}},
    ...['Hi','When will my sister get a job?','Change my career birth date to 2000-01-01','Compare my career and marriage','My career and guna matching','Use horary for my career','What is career astrology?'].map(query=>({query}))];
  for(const change of cases) assert.equal(await prepareVoiceChart({...value,...change},()=>assert.fail('No speculative preparation')),null,JSON.stringify(change));
});

test('failed, malformed or unreviewed tools never become prepared chart evidence',async()=>{
  for(const output of ['Tool failed: unavailable','{}',JSON.stringify({...chart,engine:'other'}),{isError:true},JSON.stringify({...chart,birth_chart:null})]) {
    assert.equal(await prepareVoiceChart(value,async()=>output),null);
  }
  const controller=new AbortController();controller.abort();
  await assert.rejects(prepareVoiceChart(value,async()=>JSON.stringify(chart),controller.signal),{name:'AbortError'});
});

test('prepared voice chart overlaps memory and removes selection round while retaining validation',{timeout:3000},async()=>{
  let calculations=0,calls=0;
  let chartReady;
  const calculated=new Promise(resolve=>{chartReady=resolve;});
  const result=await directAnswer(value,{
    env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'1',VEDASTRO_DIRECT_REPLY_CACHE:'0'},
    makeMemory:()=>({read:async()=>{await calculated;return [];}}),
    makeTools:()=>async()=>{calculations++;chartReady();return JSON.stringify(chart);},
    fetchImpl:async(_url,options)=>{
      assert.ok(++calls<=1,'No model round just to select a known required chart');
      const body=JSON.parse(options.body);
      assert.ok(body.messages.some(m=>m.role==='tool'&&JSON.parse(m.content).engine==='local-sweph-v2'));
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'Your calculated Mars sub period runs 2027-09-15 to 2028-11-14.'}}]}));
    },
  });
  assert.equal(calculations,1);assert.equal(calls,1);
  assert.deepEqual(result.answer_reading_tools,['get_horoscope_predictions']);
  assert.match(result.reply,/15 September 2027 to 14 November 2028/);
  assert.ok(result.answer_validation.includes('voice_chart_prepared'));
});
