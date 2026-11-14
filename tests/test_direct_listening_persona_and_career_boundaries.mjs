import test from 'node:test';
import assert from 'node:assert/strict';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {emotionalReplyIssue,emotionalReplyFallback} from '../extensions/reviewed-reading/direct/emotional-friendship.mjs';
import {friendshipGroundingIssues} from '../extensions/reviewed-reading/direct/friendship-grounding.mjs';
import {chartGroundingConflicts} from '../extensions/reviewed-reading/direct/chart-grounding.mjs';
import {readingPresentationIssue} from '../extensions/reviewed-reading/direct/reading-presentation.mjs';

const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'};
const listening='Aaj mujhe akela lag raha hai. Abhi advice nahi chahiye, bas meri baat suniye. Hinglish mein bolo aur koi sawal mat poochiye.';
const advice='Aaj mujhe akela lag raha hai. Ek chhota practical step bataiye jo aaj apna sakun. Hinglish mein bolo.';
const badListening='Aaj aapko akela lag raha hai, main yeh samajh rahi hoon.\nBas yahan hoon aap jaisa bhi feel kar rahe hain, usse koi pressure nahi.';
const badAdvice='Aaj akela lag raha hai, samajh sakta hoon. Ek chhota step bas 5 minute ke liye kisi bhi ek cheez ko dhyaan se karo: chai peete waqt uski garami, ya phir kisi ek cheez ki awaaz sunna. Bas yehi. Koi pressure nahi, bas apne saath thoda sa waqt bana lo.';
const query='Using my saved birth details, what career directions suit me? Please answer in English without adding a date prediction.';
const chart={engine:'local-sweph-v2',birth_chart:{planets:['Saturn: Taurus | house 7'],ashtakavarga_house_bindus:{house_10:{bindus:31,verdict:'very strong'}}},
  verdict_signals:[{area:'career',trend:'MIXED',positive:['house 10 strong support'],negative:['Saturn retrograde results me Atkaav']}]};
const badCareer='Your natal chart shows strong support for career in house 10. Saturn in the 7th adds internal caution, not delay.\n\nCareer paths involving strategy, analysis, or leadership suit you best.';
const goodCareer='Your 10th house gives a supportive career indication. Saturn is a possible obstacle in the returned factors.\n\nLeadership or analysis may be options to explore, without a guaranteed outcome.';

test('implicit first-person grammar respects both personas without changing user draft grammar',()=>{
  for(const [gender,wrong,right] of [['male','samajh sakta hoon','samajh sakti hoon'],['female','samajh sakti hoon','samajh sakta hoon']]) {
    const value={query:advice,language:'hinglish',user_gender:gender,history:[]};
    assert.ok(friendshipGroundingIssues(wrong+'.',value).some(issue=>issue.includes('grammatical gender')));
    assert.equal(friendshipGroundingIssues(right+'.',value).length,0);
    for(const text of [`Aap keh sakte hain: “${wrong}.”`,`Aap keh sakte hain: '${wrong}.'`,`Aap keh sakte hain: ‘${wrong}.’`])
      assert.equal(friendshipGroundingIssues(text,value).length,0);
  }
  assert.equal(friendshipGroundingIssues('Samajh sakta hoon.',{query:advice,user_gender:'unknown',history:[]}).length,0);
});

test('informal instructions are rejected while respectful, quoted and code forms remain intact',()=>{
  const value={query:advice,language:'hinglish',user_gender:'male',history:[]};
  for(const text of ['Ek kaam dhyaan se karo.','Apne liye waqt bana lo.'])assert.ok(friendshipGroundingIssues(text,value).some(issue=>issue.includes('respectful aap')));
  for(const text of ['Aap chahein toh ek kaam dhyaan se kar sakte hain.','Apne liye waqt nikaal sakte hain.',
    'Unhone kaha: “Karo.”','Unhone kaha: ‘Waqt bana lo.’','```text\nkaro\n```'])assert.equal(friendshipGroundingIssues(text,value).length,0);
});

test('listening repair removes only the captured vague reassurance, preserving ordinary no-pressure language',()=>{
  const value={query:listening,language:'hinglish',user_gender:'male',history:[]};
  assert.match(emotionalReplyIssue(badListening,value),/malformed everyday language/);
  assert.equal(emotionalReplyIssue('Aaj aapko akela lag raha hai. Aap jitna chahein keh sakte hain; share karne ka koi pressure nahi.',value),null);
  assert.equal(emotionalReplyIssue(emotionalReplyFallback(value),value),null);
});

for(const kind of ['listening','advice'])test(`captured ${kind} failure gets one rewrite then a valid fallback`,async()=>{
  const value={user_id:'synthetic-persona-boundary',query:kind==='listening'?listening:advice,language:'hinglish',user_gender:'male',history:[]};
  const bad=kind==='listening'?badListening:badAdvice;let calls=0;
  const result=await directAnswer(value,{env,makeMemory:()=>({read:async()=>[]}),makeTools:()=>()=>assert.fail('No chart work in friendship'),
    fetchImpl:async()=>{calls++;return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:bad}}]}));}});
  assert.equal(calls,2);assert.ok(result.answer_validation.includes('emotional_quality_fallback'));
  assert.equal(emotionalReplyIssue(result.reply,value),null);
  assert.doesNotMatch(result.reply,/samajh sakta hoon|\bkaro\b|bana lo|usse koi pressure/);
  if(kind==='listening')assert.doesNotMatch(result.reply,/message|\?/);
});

test('career facts cannot be replaced by an invented internal trait or a denial of the returned caution',()=>{
  const results=[JSON.stringify(chart)];
  const types=chartGroundingConflicts(badCareer,results,{query}).map(c=>c.type);
  assert.ok(types.includes('unsupported_career_consequence'));assert.ok(types.includes('denied_career_caution'));
  for(const text of [goodCareer,'Saturn does not add internal caution.','Earlier I said Saturn adds internal caution.',
    'The old quote was “Saturn adds internal caution, not delay”.','Saturn may indicate an obstacle, not a guaranteed delay.'])
    assert.equal(chartGroundingConflicts(text,results,{query}).length,0);
  const supported=structuredClone(chart);supported.verdict_signals[0].negative=['Saturn adds internal caution'];
  assert.equal(chartGroundingConflicts('Saturn adds internal caution.',[JSON.stringify(supported)],{query}).length,0);
  assert.equal(chartGroundingConflicts(badCareer,results,{query:'When will I marry?'}).length,0);
});

test('career rankings are qualified without rejecting questions, disclaimers or timing prose',()=>{
  assert.match(readingPresentationIssue(badCareer),/Do not invent a ranking/);
  for(const text of [goodCareer,'I cannot establish which career fits you best.','Which career fits you best?',
    'The career that suits you best remains unknown.','This month fits you best.',
    'You said this career fits you best.','Your earlier words were “This career fits you best”.'])assert.equal(readingPresentationIssue(text),null);
});

for(const persistent of [false,true])test(`career correction preserves valid fields and calculation count; persistent=${persistent}`,async()=>{
  let calls=0,calculations=0;
  const result=await directAnswer({user_id:'synthetic-career-meaning',query,language:'english',history:[],birth:{date:'2000-01-01',time:'12:00',location_name:'Delhi'}},{
    env,makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{calculations++;return JSON.stringify(chart);},
    fetchImpl:async(_url,options)=>{
      calls++;const body=JSON.parse(options.body);if(calls===3)assert.match(body.messages.at(-1).content,/unsupported_career_consequence/);
      const message=calls===1?{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}:{content:calls===2||persistent?badCareer:goodCareer};
      return new Response(JSON.stringify({choices:[{finish_reason:calls===1?'tool_calls':'stop',message}]}));
    },
  });
  assert.equal(calculations,1);assert.equal(calls,3);
  assert.equal(result.answer_validation.includes('chart_fallback'),persistent);
  assert.doesNotMatch(result.reply,/internal caution|not delay|suit you best/);
  if(!persistent)assert.ok(result.reply.startsWith(goodCareer));
});

test('a career draft rejected for both facts and wording closes with checked factors, without another model call',async()=>{
  let calls=0,calculations=0;
  const drafts=[
    'Saturn in the 7th adds internal caution, not delay.\n\nCareer options may include analysis.',
    'Saturn means career progress will be delayed.\n\nCareer options may include analysis.',
    'The 10th house is strong. Saturn affects relationships, not your inner drive.\n\nManagement roles suit you.',
  ];
  const result=await directAnswer({user_id:'synthetic-closed-career-repair',query,language:'english',history:[],birth:{date:'2000-01-01',time:'12:00',location_name:'Delhi'}},{
    env,makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{calculations++;return JSON.stringify(chart);},
    fetchImpl:async()=>{
      calls++;
      const message=calls===1?{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}:{content:drafts[calls-2]};
      return new Response(JSON.stringify({choices:[{finish_reason:calls===1?'tool_calls':'stop',message}]}));
    },
  });
  assert.equal(calls,4);assert.equal(calculations,1);
  assert.ok(result.answer_validation.includes('chart_fallback'));
  assert.match(result.reply,/mixed/);assert.doesNotMatch(result.reply,/relationships|inner drive|Management/);
});

test('an English career wording repair cannot silently introduce a new interpretation',async()=>{
  let calls=0,calculations=0;
  const result=await directAnswer({user_id:'synthetic-career-wording-only',query,language:'english',history:[],birth:{date:'2000-01-01',time:'12:00',location_name:'Delhi'}},{
    env,makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{calculations++;return JSON.stringify(chart);},
    fetchImpl:async()=>{
      calls++;
      const message=calls===1?{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}:{content:calls===2
        ? 'Career progress will be delayed.\n\nManagement may be an option.'
        : 'The 10th house is strong. Saturn affects relationships, not your inner drive.\n\nManagement roles suit you.'};
      return new Response(JSON.stringify({choices:[{finish_reason:calls===1?'tool_calls':'stop',message}]}));
    },
  });
  assert.equal(calls,3);assert.equal(calculations,1);
  assert.ok(result.answer_validation.includes('chart_fallback'));
  assert.doesNotMatch(result.reply,/relationships|inner drive|Management/);assert.match(result.reply,/mixed/);
});

test('a valid English career rewrite retains its qualified options instead of generic facts',async()=>{
  let calls=0,calculations=0;
  const result=await directAnswer({user_id:'synthetic-valid-career-rewrite',query,language:'english',history:[],birth:{date:'2000-01-01',time:'12:00',location_name:'Delhi'}},{
    env,makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{calculations++;return JSON.stringify(chart);},
    fetchImpl:async()=>{
      calls++;
      const message=calls===1?{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}:{content:calls===2
        ? 'Career progress will be delayed.\n\nManagement may be an option.' : goodCareer};
      return new Response(JSON.stringify({choices:[{finish_reason:calls===1?'tool_calls':'stop',message}]}));
    },
  });
  assert.equal(calls,3);assert.equal(calculations,1);
  assert.match(result.reply,/Leadership or analysis may be options/);
  assert.ok(!result.answer_validation.includes('career_checked_fallback'));
  assert.doesNotMatch(result.reply,/does not identify one career field/);
});
