import test from 'node:test';
import assert from 'node:assert/strict';
import {foreignChartFacts,foreignChartContext,foreignChartSummary} from '../extensions/reviewed-reading/direct/foreign-reading.mjs';
import {evidenceFallback} from '../extensions/reviewed-reading/direct/evidence-fallback.mjs';
import {sourceReading} from '../extensions/reviewed-reading/direct/source-engine.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
const query='20 june 2014\n6:00 am\nDelhi\nTell me ki ye abroad jaane ke chances hai';
const chart={engine:'local-sweph-v2',birth_chart:{utc_time:'2000-01-01T00:00:00Z',ashtakavarga_house_bindus:{house_9:{verdict:'very strong (positive)'},house_12:{verdict:'weak (negative)'}}}};
const rows=[JSON.stringify(chart)];
test('foreign evidence reports actual separate strengths without inventing a travel score',()=>{
 const facts=foreignChartFacts(rows,query);
 assert.deepEqual(facts.houses,[{house:9,strength:'strong'},{house:12,strength:'weak'}]);
 assert.equal(facts.travel_probability_calculated,false);assert.equal(facts.travel_window_calculated,false);assert.equal(facts.visa_outcome_calculated,false);
 assert.match(foreignChartContext(rows,query),/not a failed natal calculation/);
 for(const language of ['english','hindi','hinglish']){
  const reply=foreignChartSummary(rows,language,query);assert.equal(reply.split(/\n\s*\n/u).length,2);assert.ok(reply.split(/\s+/u).length<=50);
  assert.doesNotMatch(reply,/20\d{2}|verify nahi|couldn't verify/iu);
 }
 assert.match(foreignChartSummary(rows,'hinglish',query),/mazboot.*12ve.*kamzor/);
});
test('unknown, conflicting, nonlocal or mixed-topic evidence keeps the existing path',()=>{
 assert.equal(foreignChartFacts([],query),null);
 assert.equal(foreignChartFacts(['bad json'],query),null);
 assert.equal(foreignChartFacts([JSON.stringify({...chart,engine:'other'})],query),null);
 assert.equal(foreignChartFacts([...rows,JSON.stringify({...chart,birth_chart:{...chart.birth_chart,utc_time:'2001-01-01'}})],query),null);
 assert.equal(foreignChartFacts([JSON.stringify({...chart,birth_chart:{ashtakavarga_house_bindus:{house_9:{verdict:'strong'}}}})],query),null);
 for(const question of ['Meri shaadi kab hogi?','Mera career abroad mein kaisa hoga?','Will I study abroad?','My finances overseas?'])assert.equal(foreignChartFacts(rows,question),null,question);
 assert.equal(foreignChartContext(rows,'Hi'),'');
});
test('the real supplied chart renders a checked summary after the captured drafting failure',async()=>{
 const result=await sourceReading('get_horoscope_predictions',{birth_date:'2014-06-20',birth_time:'06:00',location_name:'Delhi'},null);
 const evidence=[result.content[0].text],parsed=JSON.parse(evidence[0]);
 assert.equal(parsed.birth_chart.utc_time,'2014-06-20T00:30:00.000Z');
 assert.equal(parsed.verdict_signals.some(signal=>/foreign/.test(signal.area)),false,'Do not pretend another topic verdict establishes a travel outcome');
 const before=JSON.stringify(parsed);
 const reply=evidenceFallback(evidence,'hinglish',query);
 assert.match(reply,/9ve aur 12ve.*mazboot/);assert.doesNotMatch(reply,/verify nahi|2005|2027|chance kam|neecha|paperwork/);
 assert.equal(JSON.stringify(parsed),before);
});
test('the bounded agent retains a useful checked foreign answer when timing drafts keep failing',async()=>{
 let calls=0,calculations=0;
 const evidence={...chart,evidence_scope:{timing:'does not calculate event-specific windows'}};
 const result=await directAnswer({user_id:'synthetic-foreign-evidence',query,birth:{date:'2000-01-01',time:'06:00',location_name:'Delhi'},history:[],language:'hinglish',reply_surface:'whatsapp'},{
  env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'},
  makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{calculations++;return JSON.stringify(evidence);},
  fetchImpl:async(_url,options)=>{
   const body=JSON.parse(options.body);calls++;
   if(calls===2)assert.ok(body.messages.some(message=>message.content?.includes('travel_probability_calculated')));
   const message=calls===1?{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}:
    {content:'Abroad ke liye sanket hain.\n\n2027 ke baad abroad ka mauka clear hoga.'};
   return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));
  }});
 assert.equal(calculations,1);assert.equal(calls,3);assert.match(result.reply,/9ve.*mazboot.*12ve.*kamzor/);assert.doesNotMatch(result.reply,/2027|verify nahi/);
 assert.ok(result.answer_validation.includes('timing_fallback'));
});
