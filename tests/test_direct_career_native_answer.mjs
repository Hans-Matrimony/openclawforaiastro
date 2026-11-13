import assert from 'node:assert/strict';
import test from 'node:test';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {evidenceFallback} from '../extensions/reviewed-reading/direct/evidence-fallback.mjs';
import {fallbackFactor} from '../extensions/reviewed-reading/direct/fallback-factors.mjs';

const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'};
const chart={engine:'local-sweph-v2',birth_chart:{planets:['Sun: Taurus | house 2','Saturn: Virgo | house 6'],ashtakavarga_house_bindus:{house_10:{sign:'Leo',bindus:31}}},
 dasha:{upcoming_antardashas:[{lord:'Jupiter',from:'2030-01-01',to:'2033-01-01'}],next_mahadasha:{lord:'Sun',from:'2040-01-01',to:'2046-01-01'}},
 verdict_signals:[{area:'career',trend:'MIXED',positive:['house 10 (Leo) bindus 31/48 => strong support'],negative:['Saturn retrograde => results me Atkaav']}],
 evidence_scope:{timing:'This tool does not calculate event-specific windows'}};
const rows=[JSON.stringify(chart)],now=()=>new Date('2026-11-13T00:00:00Z');
const base={user_id:'synthetic-native-career',birth:{date:'1991-04-11',time:'08:00',location_name:'Pune'},language:'english',history:[]};
const call={id:'fixture-chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}};

test('career error recovery never chooses a date from ownership or a positive factor',()=>{
 for(const language of ['english','hinglish'])for(const query of ['Mera career kab set hoga?','Mera promotion kab hoga?','मेरा करियर कब सेट होगा?'])for(const evidence of [chart,{...chart,verdict_signals:[{...chart.verdict_signals[0],positive:['benefic Jupiter house 10 mein']}]}]){
  const reply=evidenceFallback([JSON.stringify(evidence)],language,query,now());
  assert.doesNotMatch(reply,/20\d{2}|mahadasha|antardasha/iu);
  assert.match(reply,/career/i);
 }
});

test('a valid English career wording repair retains the actual answer instead of a canned fallback',async()=>{
 const good='Your career house is supportive, though Saturn may bring delays.\n\nAnalysis or leadership may be options to explore; neither is a guaranteed best fit.';
 let requests=0,calculations=0;
 const result=await directAnswer({...base,query:'Using my chart, what career directions suit me? Please answer in English.'},{env,now,
  makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{calculations++;return rows[0];},
  fetchImpl:async()=>{requests++;const message=requests===1?{tool_calls:[call]}:{content:requests===2?'Career progress will be delayed.\n\nAnalysis may be an option.':good};return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));}
 });
 assert.equal(requests,3);assert.equal(calculations,1);
 assert.ok(result.reply.startsWith(good));
 assert.ok(!result.answer_validation.some(v=>v.includes('fallback')));
});

test('career timing gets a direct prose repair without a forced date-selection tool',async()=>{
 const good='The career indications are mixed: your 10th house is supportive, while Saturn may bring delays.\n\nThese factors do not establish a reliable career-settlement date.';
 for(const surface of [undefined,'whatsapp']){
  let requests=0,calculations=0;
  const result=await directAnswer({...base,reply_surface:surface,query:'When will my career settle?'},{env,now,
   makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{calculations++;return rows[0];},
   fetchImpl:async(_url,options)=>{requests++;const body=JSON.parse(options.body);
    assert.notEqual(body.tool_choice?.function?.name,'submit_timing_reading');
    const message=requests===1?{tool_calls:[call]}:{content:requests===2?'Jupiter antardasha, January 2030 to January 2033: career improvement is possible.':good};
    return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));}
  });
  assert.equal(calculations,1);assert.equal(requests,3,JSON.stringify(result));assert.ok(result.reply.startsWith(good.replaceAll('-', ' ')));
  assert.doesNotMatch(result.reply,/20\d{2}/u);assert.ok(!result.answer_validation.some(v=>v.includes('fallback')));
 }
});

test('the English emergency renderer translates the current-period limitation instead of leaking source Hinglish',()=>{
 const factor='current dasha lords is area se directly linked nahi => support limited';
 assert.doesNotMatch(fallbackFactor(factor,true,'career'),/linked nahi|is area se|=>/u);
 assert.match(fallbackFactor(factor,true,'career'),/current|period/i);
});

test('an honest undated career answer is not forced back into a date-seeking review',async()=>{
 const futureSaturn={...chart,dasha:{...chart.dasha,upcoming_antardashas:[{lord:'Saturn',from:'2033-01-01',to:'2036-01-01'}]}};
 const good='Your career house is supportive, while Saturn may bring delays.\n\nThese factors do not establish a reliable career settlement date.';
 let requests=0;
 const result=await directAnswer({...base,query:'When will my career settle?',history:[{role:'assistant',text:'OLD_FORECAST: Career will settle after 2040.'}]},{env,now,
  makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>JSON.stringify(futureSaturn),
  fetchImpl:async(_url,options)=>{requests++;const body=JSON.parse(options.body);
   if(requests===1)assert.equal(body.tool_choice.function.name,'mcp__VedAstro__get_horoscope_predictions');
   else {assert.equal(body.messages.length,2);assert.doesNotMatch(JSON.stringify(body.messages),/OLD_FORECAST/);}
   const message=requests===1?{tool_calls:[call]}:{content:good};
   return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));}
 });
 assert.equal(requests,2);assert.ok(result.reply.startsWith(good));assert.deepEqual(result.answer_validation,[]);
});
