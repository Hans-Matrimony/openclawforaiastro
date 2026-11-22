import test from 'node:test';
import assert from 'node:assert/strict';
import {voiceFactor} from '../extensions/reviewed-reading/direct/voice-factors.mjs';
import {preparedVoiceTiming} from '../extensions/reviewed-reading/direct/voice-timing.mjs';
import {prepareVoiceChart} from '../extensions/reviewed-reading/direct/voice-chart.mjs';
import {sourceReading} from '../extensions/reviewed-reading/direct/source-engine.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';

const phrases=[
 'house 10 lord Sun Own sign (strong), 10th house mein',
 'house 10 lord Mars Exalted (uccha), 2th house mein',
 'house 10 lord Saturn Own/Mooltrikona (strong), 4th house mein',
 'house 10 lord Saturn DEBILITATED, 4th house mein — real challenge signal',
 'house 10 lord Mercury combust (Sun ke paas) — power weak',
 'karak Sun Own sign (strong), 10th house mein',
 'karak Saturn DEBILITATED (Aries) — karak weak',
 'karak Sun combust — results delayed',
 'Jupiter ki drishti house 10 par — protection',
 'Saturn ki drishti house 10 par — pressure/delay',
 'current dasha/antardasha lord (Sun+Jupiter) is area se linked hai — period ACTIVE hai',
];
test('known source factors render without chart jargon or extra predictions',()=>{
 for(const source of phrases)for(const english of [true,false]) {
  const rendered=voiceFactor(source,english);assert.ok(rendered,source);assert.notEqual(rendered,source);
  assert.doesNotMatch(rendered,/DEBILITATED|combust|retrograde|bindus|guarantee|definitely|20\d{2}/i);
 }
 for(const source of ['house 13 lord Sun Own sign (strong), 10th house mein',
   phrases[0]+' guarantees a promotion', 'Jupiter ki drishti house 10 par — pressure/delay',
   'karak Sun combust — career ends forever', null]) assert.equal(voiceFactor(source,true),null);
 assert.equal(voiceFactor('benefic Venus house 10 mein guarantees promotion',true),null);
 assert.equal(voiceFactor('house 10 (Aries) bindus 90/48 — strong support',true),null);
});

const value={user_id:'synthetic-voice-factors',query:'When will my career improve?',reply_surface:'voice',language:'english',history:[],birth:{date:'2000-01-01',time:'05:00',location_name:'Delhi'}};
test('a real local chart uses the voice timing path with every supplied factor retained',async()=>{
 const result=await sourceReading('get_horoscope_predictions',{query_text:value.query},value.birth,{rawSource:true});
 const data=JSON.parse(result.content[0].text);
 const factors=data.verdict_signals.find(s=>s.area==='career');
 for(const source of [...factors.positive,...factors.negative]) assert.ok(voiceFactor(source,true),source);
 const timing=preparedVoiceTiming([JSON.stringify(data)],value,new Date());assert.ok(timing);
 for(const reply_surface of ['whatsapp',undefined])assert.equal(preparedVoiceTiming([JSON.stringify(data)],{...value,reply_surface},new Date()),null);
});

test('about my career keeps self preparation while another person or correction does not',async()=>{
 const chart={engine:'local-sweph-v2',birth_chart:{},dasha:{}};
 let calls=0;
 assert.ok(await prepareVoiceChart({...value,query:'Tell me about my career'},async()=>{calls++;return JSON.stringify(chart);}));
 assert.equal(calls,1);
 for(const query of ['Tell me about my sister career','Tell me about my career for Alice',
   'Tell me about my career, correct my birth time to 06:00']) {
  assert.equal(await prepareVoiceChart({...value,query},()=>assert.fail('Keep profile resolution')),null);
 }
});

test('active-period factors no longer force repeated prose drafting in voice timing',async()=>{
 const data={engine:'local-sweph-v2',birth_chart:{},dasha:{upcoming_antardashas:[{lord:'Sun',from:'2027-01-01',to:'2027-09-01'}]},
  verdict_signals:[{area:'career',trend:'MIXED',positive:[phrases[0],phrases[10]],negative:[phrases[4]]}]};
 let calls=0;
 const result=await directAnswer(value,{now:()=>new Date('2026-11-22T00:00:00Z'),
  env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0'},
  makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>JSON.stringify(data),
  fetchImpl:async(_url,options)=>{
   assert.equal(++calls,1);const body=JSON.parse(options.body);assert.equal(body.tool_choice.function.name,'submit_timing_reading');assert.equal(body.max_tokens,256);
   return new Response(JSON.stringify({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{function:{name:'submit_timing_reading',arguments:JSON.stringify({period_id:'p0',outlook:'mixed',factor_ids:['f0','f2']})}}]}}]}));
  }});
 assert.equal(calls,1);assert.ok(result.answer_validation.includes('voice_timing_prepared'));
 assert.match(result.reply,/January 2027.*September 2027/);
 assert.match(result.reply,/limiting|obstacle/);assert.doesNotMatch(result.reply,/guarantee|definitely/);
});
