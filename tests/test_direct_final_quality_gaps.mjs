import test from 'node:test';
import assert from 'node:assert/strict';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {chartGroundingConflicts} from '../extensions/reviewed-reading/direct/chart-grounding.mjs';
import {emotionalReplyIssue,emotionalReplyFallback} from '../extensions/reviewed-reading/direct/emotional-friendship.mjs';
import {readingPresentationIssue} from '../extensions/reviewed-reading/direct/reading-presentation.mjs';

const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'};
const query='Using my saved birth details, what career directions suit me? Please answer in English without adding a date prediction.';
const chart={engine:'local-sweph-v2',birth_chart:{planets:['Saturn: Taurus | house 7','Rahu: Gemini | house 8'],ashtakavarga_house_bindus:{house_10:{bindus:31,verdict:'very strong'}}},
  dasha:{current_mahadasha:{lord:'Venus',from:'2021-09-15',to:'2041-09-15'},current_antardasha:{lord:'Moon',from:'2026-01-14',to:'2027-09-15'}},
  verdict_signals:[{area:'career',trend:'MIXED',positive:['house 10 (Leo) bindus 31/48 strong support'],negative:['Saturn retrograde results me Atkaav','current dasha lords is area se directly linked nahi external push kam']}]};
const results=[JSON.stringify(chart)];
const badCareer='Your 10th house is very strong, pointing to leadership, public roles, or strategic work but Saturn and Rahu are weakening the support, creating delays and the need for persistent effort.\n\nCareer paths like management, research, or authority driven fields suit you, but success comes through steady persistence, not quick wins.';
const goodCareer='Your strong 10th house may support leadership or management. Saturn is a caution in the returned career factors; progress is not guaranteed.\n\nLeadership and management may be options to explore.';
const advice='Aaj mujhe akela lag raha hai. Ek chhota practical step bataiye jo aaj apna sakun. Hinglish mein bolo.';
const badAdvice='Aaj aapko akela lag raha hai, main samajh rahi hoon. Ek chhota step: ek aadmi ya aurat ko, jo aapke dil mein hai, bas ek line bhej dijiye “Aaj thoda akela lag raha tha, so thought I would say hi.” Koi response aaye ya na aaye, aapne apne liye ek connection ki koshish ki hai.';

test('a career caution cannot borrow a negative cause from a natal placement or old answer',()=>{
  const conflicts=chartGroundingConflicts(badCareer,results,{query,history:[{role:'assistant',text:'Rahu weakens career support.'}]});
  assert.deepEqual(conflicts.map(c=>[c.type,c.planet]),[['unsupported_career_caution','Rahu']]);
  for(const text of ['Rahu weakens career support.','Rahu may be weakening the support.','Saturn and Rahu cause delays.'])
    assert.ok(chartGroundingConflicts(text,results,{query}).some(c=>c.planet==='Rahu'));
  assert.equal(chartGroundingConflicts(goodCareer,results,{query}).length,0);
  assert.equal(chartGroundingConflicts('Venus and Moon are weakening the support.',results,{query}).length,0,'a returned caution about current dasha lords may use the checked current lords');
  const supported=structuredClone(chart);supported.verdict_signals[0].negative.push('Rahu causes career obstacles');
  assert.equal(chartGroundingConflicts(badCareer,[JSON.stringify(supported)],{query}).length,0);
});

test('career caution check leaves other topics, quotations, negation and incomplete evidence intact',()=>{
  for(const text of ['Rahu is not weakening the support.','Earlier I said Rahu is weakening the support.','The earlier quote was “Rahu is weakening the support”.'])
    assert.equal(chartGroundingConflicts(text,results,{query}).length,0);
  assert.equal(chartGroundingConflicts(badCareer,results,{query:'When will I marry?'}).length,0);
  assert.equal(chartGroundingConflicts(badCareer,[JSON.stringify({...chart,verdict_signals:[]})],{query}).length,0);
  assert.equal(chartGroundingConflicts(badCareer,[...results,JSON.stringify({...chart,birth_chart:{subject:'another person'}})],{query}).length,0);
});

test('observed career certainty receives a qualification without rejecting a qualified caution',()=>{
  assert.match(readingPresentationIssue(badCareer),/Qualify the outcome/);
  assert.equal(readingPresentationIssue('Saturn may indicate delays; an outcome is not guaranteed.'),null);
  assert.equal(readingPresentationIssue('Saturn may weaken support, potentially creating delays.'),null);
});

for(const surface of [undefined, 'voice'])for(const persistent of [false,true])test(`unsupported career cause is corrected once without repeating chart calculations: ${surface} ${persistent}`,async()=>{
  let calls=0,calculations=0;
  const result=await directAnswer({user_id:'synthetic-final-career',reply_surface:surface,reply_to:surface?{role:'user',text:query}:undefined,query,language:'english',history:[],birth:{date:'2000-01-01',time:'12:00',location_name:'Delhi'}},{
    env,makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{calculations++;return JSON.stringify(chart);},
    fetchImpl:async(_url,options)=>{
      calls++;const body=JSON.parse(options.body);
      if(calls===3){
        assert.match(body.messages.at(-1).content,/unsupported_career_caution/);
        if(surface==='voice')assert.match(body.messages.at(-1).content,/Review the timing in this same correction/);
        else assert.doesNotMatch(body.messages.at(-1).content,/This is a spoken answer/);
      }
      const message=calls===1?{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}:{content:calls===2||persistent?badCareer:goodCareer};
      return new Response(JSON.stringify({choices:[{finish_reason:calls===1?'tool_calls':'stop',message}]}));
    },
  });
  assert.equal(calls,3);assert.equal(calculations,1);
  assert.ok(result.answer_validation.includes('chart_claim_conflict'));
  assert.equal(result.answer_validation.includes('chart_fallback'),persistent);
  assert.doesNotMatch(result.reply,/Rahu|creating delays/);
  if(!persistent && !surface)assert.ok(result.reply.startsWith(goodCareer));
});

test('fresh loneliness advice uses neutral contact wording and an optional trusted-person fallback',()=>{
  const value={query:advice,language:'hinglish',history:[]};
  assert.match(emotionalReplyIssue(badAdvice,value),/trusted person/);
  const fallback=emotionalReplyFallback(value);
  assert.match(fallback,/akelaapan.*Aap chahein.*bharosemand/);
  assert.doesNotMatch(fallback,/aadmi ya aurat|dil mein hai|partner|crush/);
  assert.equal(emotionalReplyIssue(fallback,value),null);
});

test('captured awkward contact advice has only one rewrite before the checked fallback',async()=>{
  let calls=0;
  const result=await directAnswer({user_id:'synthetic-final-advice',query:advice,language:'hinglish',history:[]},{
    env,makeMemory:()=>({read:async()=>[]}),makeTools:()=>()=>assert.fail('Friendship must not call a chart tool'),
    fetchImpl:async()=>{calls++;return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:badAdvice}}]}));},
  });
  assert.equal(calls,2);assert.ok(result.answer_validation.includes('emotional_quality_fallback'));
  assert.match(result.reply,/bharosemand/);assert.doesNotMatch(result.reply,/aadmi ya aurat|dil mein hai/);
});
