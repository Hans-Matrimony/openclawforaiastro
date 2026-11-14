import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareVoiceChart} from '../extensions/reviewed-reading/direct/voice-chart.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {preparedVoiceTiming} from '../extensions/reviewed-reading/direct/voice-timing.mjs';
import {fallbackFactor} from '../extensions/reviewed-reading/direct/fallback-factors.mjs';
const value={user_id:'synthetic-voice-prefill',query:'When will my career improve?',reply_surface:'voice',birth:{date:'1991-04-11',time:'08:00',location_name:'Pune'},language:'english',history:[]};
const chart={engine:'local-sweph-v2',birth_chart:{date:'1991-04-11'},dasha:{upcoming_antardashas:[{lord:'Mars',from:'2027-09-15',to:'2028-11-14'}]}};

test('known delay factors survive English rendering without translating unknown claims',()=>{
  for(const text of ['Saturn retrograde — results me Atkaav','Saturn retrograde results me Atkaav'])
    assert.match(fallbackFactor(text,true),/Saturn.*possible delays/);
  assert.equal(fallbackFactor('Saturn retrograde guarantees job loss',true),null);
});

test('voice constrained timing declines incomplete factors and other surfaces',()=>{
  const evidence={...chart,verdict_signals:[{area:'career',positive:['benefic Mars house 10 mein'],negative:['Saturn retrograde — results me Atkaav']}]};
  const now=new Date('2026-11-14T00:00:00Z');
  assert.ok(preparedVoiceTiming([JSON.stringify(evidence)],value,now));
  for(const surface of [undefined,'whatsapp'])assert.equal(preparedVoiceTiming([JSON.stringify(evidence)],{...value,reply_surface:surface},now),null);
  for(const factor of ['unknown factor','karak Saturn DEBILITATED (Aries) — karak weak',null]){
    const other=structuredClone(evidence);other.verdict_signals[0].negative.push(factor);
    assert.equal(preparedVoiceTiming([JSON.stringify(other)],value,now),null);
  }
  assert.equal(preparedVoiceTiming(['broken'],value,now),null);
  assert.equal(preparedVoiceTiming([JSON.stringify(evidence)],{...value,query:'When will I marry?'},now),null);
});

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

test('voice timing selects checked factors and dates in one model pass',async()=>{
  const evidence={...chart,verdict_signals:[{area:'career',trend:'MIXED',positive:['benefic Mars house 10 mein'],negative:['Saturn retrograde results me Atkaav']}]};
  let calls=0;
  const result=await directAnswer(value,{
    now:()=>new Date('2026-11-14T00:00:00Z'),
    env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'1',VEDASTRO_DIRECT_REPLY_CACHE:'0'},
    makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>JSON.stringify(evidence),
    fetchImpl:async(_url,options)=>{
      assert.equal(++calls,1);
      const body=JSON.parse(options.body);
      assert.equal(body.tool_choice.function.name,'submit_timing_reading');
      return new Response(JSON.stringify({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{id:'selected',type:'function',function:{name:'submit_timing_reading',arguments:JSON.stringify({period_id:'p0',outlook:'mixed',factor_ids:['f0','f1']})}}]}}]}));
    },
  });
  assert.equal(calls,1);
  assert.ok(result.answer_validation.includes('voice_timing_prepared'));
  assert.match(result.reply,/September 2027/);
  assert.match(result.reply,/November 2028/);
  assert.match(result.reply,/Saturn|delay|obstacle/i);
  assert.doesNotMatch(result.reply,/guaranteed|definitely/);
});
