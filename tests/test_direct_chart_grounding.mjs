import test from 'node:test';
import assert from 'node:assert/strict';
import {chartGroundingConflicts, chartClarificationFallback} from '../extensions/reviewed-reading/direct/chart-grounding.mjs';
import {evidenceFallback} from '../extensions/reviewed-reading/direct/evidence-fallback.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';

const chart={engine:'local-sweph-v2',birth_chart:{planets:['Jupiter: Taurus | house 7','Saturn: Taurus | house 7','Rahu: Gemini | house 8'],ashtakavarga_house_bindus:{house_7:{sign:'Taurus',bindus:20,verdict:'very weak'}}},
  dasha:{current_mahadasha:{lord:'Venus',from:'2021-09-15',to:'2041-09-15'},upcoming_antardashas:[{lord:'Mars',from:'2027-09-15',to:'2028-11-14'},{lord:'Jupiter',from:'2031-11-15',to:'2034-07-16'}]},
  verdict_signals:[{area:'marriage',trend:'MIXED',positive:['benefic Jupiter house 7 mein'],negative:['house 7 (Taurus) bindus sirf 20/48 weak support','Mars ki drishti house 7 par']}]};
const results=[JSON.stringify(chart)],query='Meri kundli badal gayi kya? Mere 7ve ghar ki natal sthiti, strength aur Jupiter antardasha verify karo.';
const now=()=>new Date('2026-11-04T00:00:00Z');

test('house point claims are checked against the returned house and scale without treating dates or Guna as house points',()=>{
  for(const text of ['7ve ghar mein sirf 23 points hain.','House 7 has 20/100 points.','7th house points 23 hain.'])
    assert.ok(chartGroundingConflicts(text,results,{query}).some(c=>c.type==='house_points'),text);
  for(const text of ['7ve ghar mein 20/48 points hain.','House 7 has 20 points.','House 7 mein Jupiter hai, period 2031 se 2034 hai.',
    '7ve ghar ke liye pehle 23 points kaha tha; actual 20 points hain.','Guna Milan 27/36 hai.'])
    assert.equal(chartGroundingConflicts(text,results,{query}).length,0,text);
  assert.deepEqual(chartGroundingConflicts('House 7 has 23 points.',[...results,JSON.stringify({...chart,birth_chart:{subject:'another'}})],{query}),[]);
});

test('clarification aspects require returned support and keep placement subjects distinct',()=>{
  const issue=chartGroundingConflicts('7ve ghar par Mars aur Rahu ki drishti hai.',results,{query});
  assert.deepEqual(issue.map(c=>[c.type,c.planet]),[['unverified_natal_aspect','Rahu']]);
  assert.deepEqual(chartGroundingConflicts('Jupiter house 7 mein hai, Mars ki drishti house 7 par hai.',results,{query}),[]);
  assert.deepEqual(chartGroundingConflicts('Saturn transit house 5 mein hai.',results,{query}),[]);
  assert.deepEqual(chartGroundingConflicts('7ve ghar par Rahu ki drishti nahi hai.',results,{query}),[]);
  assert.deepEqual(chartGroundingConflicts('7ve ghar par Rahu ki drishti hai.',results,{query:'What is an aspect?'}),[]);
});

test('a correction of a verifiable earlier placement remains allowed but an invented overestimation does not',()=>{
  const text='Pehle Jupiter ka role overestimated tha.';
  assert.ok(chartGroundingConflicts(text,results,{query,history:[]}).some(c=>c.type==='unsupported_reading_revision'));
  assert.deepEqual(chartGroundingConflicts(text,results,{query,history:[{role:'assistant',text:'Jupiter house 4 mein hai.'}]}),[]);
  assert.ok(chartGroundingConflicts(text,results,{query,history:[{role:'assistant',text:'Jupiter house 7 mein hai.'}]}).length);
});

test('chart clarification fallback preserves the natal facts and parent period without guessing a prior error',()=>{
  for(const language of ['english','hinglish']){
    const answer=chartClarificationFallback(results,language,query);
    assert.match(answer,/Jupiter.*Saturn/);assert.match(answer,/weak|kamzor/);
    assert.match(answer,/Venus mahadasha/);assert.match(answer,/November 2031.*July 2034/);
    assert.doesNotMatch(answer,/overestimated|23|2027|Rahu.*drishti/);
    assert.deepEqual(chartGroundingConflicts(answer,results,{query}),[]);
  }
  assert.equal(chartClarificationFallback(results,'english','When will I marry?'),null);
  assert.equal(chartClarificationFallback(results,'english','Verify house 7 and house 10'),null);
});

test('timing fallback retains the sole positively grounded interpretation, never the earliest adverse period',()=>{
  const answer=evidenceFallback(results,'hinglish','Meri shaadi kab hogi?',now());
  assert.match(answer,/November 2031.*July 2034/);assert.match(answer,/rukawatein/);assert.doesNotMatch(answer,/2027|2028/);
  const ambiguous=structuredClone(chart);ambiguous.verdict_signals[0].positive.push('benefic Mars house 7 mein');
  assert.match(evidenceFallback([JSON.stringify(ambiguous)],'hinglish','Meri shaadi kab hogi?',now()),/2027-09-15.*2028-11-14/);
  assert.match(evidenceFallback([JSON.stringify(ambiguous)],'hinglish','Meri shaadi kab hogi?',now()),/antardasha/);
  const negative=structuredClone(chart);negative.verdict_signals[0].trend='NEGATIVE';
  assert.match(evidenceFallback([JSON.stringify(negative)],'hinglish','Meri shaadi kab hogi?',now()),/sambhavna kam hai/);
});

for(const timing of [false,true])test(`persistent rejected drafts deliver grounded facts within existing rounds; timing=${timing}`,async()=>{
  let calls=0,calculations=0;
  const question=timing?'Meri shaadi kab hogi?':query;
  const bad=timing?'Jupiter house 7 mein hai, lekin emotional burden hai.\n\nNovember 2031 se July 2034 ke beech shaadi sambhav hai.':
    '7ve ghar ki natal sthiti weak hai Taurus mein sirf 23 points, Mars aur Rahu ki drishti se dabaav hai.\n\nKundli nahi badli, bas pehle ki reading mein Jupiter ka role overestimated tha.';
  const answer=await directAnswer({user_id:'synthetic-grounding',query:question,history:[],language:'hinglish',birth:{date:'2000-01-01',time:'05:00',location_name:'Delhi'}},{
    env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'},
    now,makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{calculations++;return results[0];},
    fetchImpl:async()=>{calls++;const message=calls===1?{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}:{content:bad};
      return new Response(JSON.stringify({choices:[{finish_reason:calls===1?'tool_calls':'stop',message}]}));},
  });
  assert.equal(calls,3);assert.equal(calculations,1);assert.match(answer.reply,/November 2031.*July 2034/);
  assert.doesNotMatch(answer.reply,/23 points|Rahu.*drishti|overestimated|emotional burden|2027|2028/);
  assert.equal(chartGroundingConflicts(answer.reply,results,{query:question}).length,0);
});

test('explicit natal verification renders source occupants even when a draft denies one through an anaphor',async()=>{
  let calls=0;
  const answer=await directAnswer({user_id:'synthetic-natal-verification',query,birth:{date:'2000-01-01',time:'05:00',location_name:'Delhi'},history:[],language:'hinglish'},{
    env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'},
    now,makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>results[0],
    fetchImpl:async()=>{
      calls++;
      const message=calls===1?{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}:
        {content:'7ve ghar mein Jupiter hai, lekin Saturn yahan nahi baitha.\n\nKundli nahi badli, bas pehle ki reading mein Saturn ka role galat tha.'};
      return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));
    },
  });
  assert.ok(calls<=3);
  assert.match(answer.reply,/Jupiter aur Saturn/);
  assert.match(answer.reply,/Venus mahadasha.*Jupiter antardasha November 2031 se July 2034/);
  assert.doesNotMatch(answer.reply,/nahi baitha|role galat|pehle ki reading/);
});
