import assert from 'node:assert/strict';
import test from 'node:test';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {evidenceFallback} from '../extensions/reviewed-reading/direct/evidence-fallback.mjs';
import {fallbackFactor} from '../extensions/reviewed-reading/direct/fallback-factors.mjs';
import {hasPredictionGuarantee} from '../extensions/reviewed-reading/direct/prediction-certainty.mjs';
import {careerAnswerEvidence,careerEventTimingUnavailable,careerAnswerMessages,unsupportedCareerDeadline,careerAnswerWordingIssue} from '../extensions/reviewed-reading/direct/career-answer.mjs';

const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'};
const chart={engine:'local-sweph-v2',birth_chart:{planets:['Sun: Taurus | house 2','Saturn: Virgo | house 6'],ashtakavarga_house_bindus:{house_10:{sign:'Leo',bindus:31}}},
 dasha:{upcoming_antardashas:[{lord:'Jupiter',from:'2030-01-01',to:'2033-01-01'}],next_mahadasha:{lord:'Sun',from:'2040-01-01',to:'2046-01-01'}},
 verdict_signals:[{area:'career',trend:'MIXED',positive:['house 10 (Leo) bindus 31/48 => strong support'],negative:['Saturn retrograde => results me Atkaav']}],
 evidence_scope:{timing:'This tool does not calculate event-specific windows'}};
const rows=[JSON.stringify(chart)],now=()=>new Date('2026-11-13T00:00:00Z');
const base={user_id:'synthetic-native-career',birth:{date:'1991-04-11',time:'08:00',location_name:'Pune'},language:'english',history:[]};
const call={id:'fixture-chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}};

test('a negated guarantee is not a promise, but a separate guaranteed outcome still is',()=>{
 for(const text of ['This is not a guaranteed settlement date.','There is no guaranteed result.','This is not an guaranteed outcome.'])
  assert.equal(hasPredictionGuarantee(text),false,text);
 for(const text of ['This is a guaranteed settlement date.','Not a guaranteed date, but success is guaranteed.','No delay: guaranteed success.'])
  assert.equal(hasPredictionGuarantee(text),true,text);
});

test('a rejected career draft is corrected without stale assistant history or another calculation',async()=>{
 let requests=0,calculations=0;
 const good='Your career house is supportive, while Saturn may bring delays.\n\nThese factors do not establish a reliable career settlement date.';
 const result=await directAnswer({...base,query:'When will my career settle?',history:[{role:'assistant',text:'STALE_FORECAST: Career settles in 2040.'}]},{env,now,
  makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{calculations++;return rows[0];},
  fetchImpl:async(_url,options)=>{
   requests++;const body=JSON.parse(options.body);
   if(requests===3){assert.equal(body.messages.length,2);assert.doesNotMatch(JSON.stringify(body.messages),/STALE_FORECAST/);assert.match(body.messages[1].content,/Checked chart results/);}
   const message=requests===1?{tool_calls:[call]}:{content:requests===2?'2040 ke baad career set hoga.':good};
   return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));
  }});
 assert.equal(calculations,1);assert.equal(requests,3);assert.ok(result.reply.startsWith(good));
 assert.ok(!result.answer_validation.some(v=>/fallback|topic_timing_repaired/.test(v)));
});

test('shortening a dated career answer preserves its checked period on both reply surfaces',async()=>{
 for(const reply_surface of [undefined,'whatsapp'])for(const kind of ['antardasha','mahadasha']){
  const period={lord:'Jupiter',from:'2030-01-01',to:'2033-01-01'};
  const supported={...chart,birth_chart:{...chart.birth_chart,planets:[...chart.birth_chart.planets,'Jupiter: Capricorn | house 10']},
   dasha:kind==='antardasha'?{upcoming_antardashas:[period]}:{next_mahadasha:period},
   verdict_signals:[{area:'career',positive:['benefic Jupiter house 10 mein'],negative:['Saturn retrograde => results me Atkaav']}]};
  const long=`Jupiter in house 10 supports your career, while Saturn may bring some delays in work. These are mixed indications rather than a guarantee, so the support and the caution both matter when interpreting this period.\n\nJupiter ${kind}, January 2030 to January 2033, may support career progress; this is a possible period, not a guaranteed settlement date.`;
  const short=`Jupiter in house 10 supports career, while Saturn may bring delays.\n\nJupiter ${kind}, January 2030 to January 2033, may support career progress.`;
  let requests=0,calculations=0;
  const result=await directAnswer({...base,reply_surface,query:'When will my career settle?'},{env,now,
   makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{calculations++;return JSON.stringify(supported);},
   fetchImpl:async(_url,options)=>{
    requests++;const body=JSON.parse(options.body);
    if(requests===3){
     assert.match(body.messages[1].content,/Preserve the existing checked period lord/,JSON.stringify(body.messages.at(-1)));
     assert.doesNotMatch(body.messages[1].content,/Do not add advice, a date/);
    }
    const message=requests===1?{tool_calls:[call]}:{content:requests===2?long:short};
    return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));
   }});
  assert.equal(requests,3);assert.equal(calculations,1);
  assert.match(result.reply,/January 2030 to January 2033/);
  assert.ok(result.reply.includes(kind));assert.ok(result.reply.includes('may'));
  assert.ok(!result.answer_validation.some(v=>/fallback|timing_claim_rejected|topic_timing_repaired/.test(v)),JSON.stringify(result));
 }
});

test('rejected career dates recover through baseline checked period selection on both surfaces',async()=>{
 const supported={...chart,birth_chart:{...chart.birth_chart,planets:[...chart.birth_chart.planets,'Jupiter: Capricorn | house 10']},verdict_signals:[{area:'career',trend:'MIXED',positive:['benefic Jupiter house 10 mein'],negative:['Saturn retrograde => results me Atkaav']}]};
 for(const reply_surface of [undefined,'whatsapp'])for(const query of ['When will my career settle?',
  'Shaadi nahi, main career ke baare mein pooch raha hoon. Career kab set hoga?']){
  let requests=0,calculations=0;
  const result=await directAnswer({...base,reply_surface,query},{env,now,
   makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{calculations++;return JSON.stringify(supported);},
   fetchImpl:async(_url,options)=>{requests++;const body=JSON.parse(options.body);
    const repair=body.tool_choice?.function?.name==='submit_timing_reading';
    const message=requests===1?{tool_calls:[call]}:repair?{tool_calls:[{id:'repair',type:'function',function:{name:'submit_timing_reading',arguments:JSON.stringify({period_id:'p0',outlook:'mixed',factor_ids:['f0','f1']})}}]}:{content:'Your career will settle in 2034.'};
    return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));}
  });
  assert.equal(calculations,1);assert.equal(requests,4,JSON.stringify(result));
  assert.ok(result.answer_validation.includes('topic_timing_repaired'));
  assert.match(result.reply,/2030/);assert.match(result.reply,/2033/);assert.doesNotMatch(result.reply,/2034|exact waqt|clear career-settling/);
 }
});

test('ordinary career timing retains a supported dated period after marriage on both surfaces',async()=>{
 const supported={...chart,birth_chart:{...chart.birth_chart,planets:[...chart.birth_chart.planets,'Jupiter: Capricorn | house 10']},
  verdict_signals:[{area:'career',trend:'MIXED',positive:['benefic Jupiter house 10 mein'],negative:['Saturn retrograde => results me Atkaav']}]};
 const reply='Jupiter in house 10 supports career, while Saturn may bring delays.\n\nJanuary 2030 to January 2033, Jupiter antardasha: career progress may be possible.';
 for(const reply_surface of [undefined,'whatsapp']){
  let requests=0;
  const result=await directAnswer({...base,reply_surface,query:'When will my career settle?',history:[{role:'user',text:'When will I marry?'},{role:'assistant',text:'Marriage in 2028.'}]},{env,now,
   makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>JSON.stringify(supported),
   fetchImpl:async(_url,options)=>{requests++;const body=JSON.parse(options.body);
    if(requests===2){assert.match(body.messages.at(-1).content,/Compare these candidates/);assert.match(body.messages.find(m=>m.role==='tool').content,/2030-01-01/);assert.match(body.messages[0].content,/Answer only this current question/);}
    const message=requests===1?{tool_calls:[call]}:{content:reply};return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));}
  });
  assert.equal(requests,2);assert.match(result.reply,/January 2030/);assert.match(result.reply,/January 2033/);
  assert.doesNotMatch(result.reply,/2028|marriage/i);assert.ok(!result.answer_validation.some(v=>/fallback|rejected/.test(v)),JSON.stringify(result.answer_validation));
 }
 assert.equal(unsupportedCareerDeadline(reply,'When will my career settle?',[JSON.stringify(supported)]),false);
 assert.equal(unsupportedCareerDeadline(reply.replaceAll('2033','2034'),'When will my career settle?',[JSON.stringify(supported)]),true);
});

test('a generic career event question gets relevant evidence, while explicit period questions retain the full schedule',()=>{
 const original=JSON.stringify(chart);
 const generic=careerAnswerEvidence('When will my career settle?',rows);
 assert.deepEqual(generic[0].dasha,chart.dasha);assert.deepEqual(generic[0].verdict_signals,chart.verdict_signals);
 assert.deepEqual(generic[0].birth_chart,chart.birth_chart);
 for(const query of ['Which career period is relevant?','Explain Sun mahadasha for my career','My career in 2040?'])
  assert.deepEqual(careerAnswerEvidence(query,rows)[0].dasha,chart.dasha);
 const event={...chart,event_windows:[{from:'2031-01-01',to:'2031-06-01'}]};
 assert.deepEqual(careerAnswerEvidence('When will my career settle?',[JSON.stringify(event)])[0].event_windows,event.event_windows);
 assert.equal(JSON.stringify(chart),original);
});

test('career correction cannot reintroduce rejected dates or other-topic chart factors',()=>{
 const expanded={...chart,verdict_signals:[...chart.verdict_signals,{area:'marriage',positive:['unrelated marriage factor']}]};
 const input=[JSON.stringify(expanded)],value={...base,query:'When will my career settle?'};
 assert.equal(careerEventTimingUnavailable(value.query,input),true);
 const messages=careerAnswerMessages(value,{profile:{status:'READY'},memoryFacts:[]},input,'Career will settle after 2025.');
 assert.doesNotMatch(messages[1].content,/2025|unrelated marriage factor/);
 assert.match(messages[1].content,/NO_CALCULATED_CAREER_EVENT_WINDOW/);
 assert.equal(careerEventTimingUnavailable('How is my career in 2040?',input),false);
});

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

test('an undated career answer reviews returned adverse periods once without forcing a positive date',async()=>{
 const futureSaturn={...chart,dasha:{...chart.dasha,upcoming_antardashas:[{lord:'Saturn',from:'2033-01-01',to:'2036-01-01'}]}};
 const good='Your career house is supportive, while Saturn may bring delays.\n\nThese factors do not establish a reliable career settlement date.';
 let requests=0;
 const result=await directAnswer({...base,query:'When will my career settle?',history:[{role:'assistant',text:'OLD_FORECAST: Career will settle after 2040.'}]},{env,now,
  makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>JSON.stringify(futureSaturn),
  fetchImpl:async(_url,options)=>{requests++;const body=JSON.parse(options.body);
   if(requests===1)assert.equal(body.tool_choice.function.name,'mcp__VedAstro__get_horoscope_predictions');
   else if(requests>=3){assert.equal(body.messages.length,2);assert.doesNotMatch(JSON.stringify(body.messages),/OLD_FORECAST/);}
   const message=requests===1?{tool_calls:[call]}:requests===4?{tool_calls:[{id:'repair',type:'function',function:{name:'submit_timing_reading',arguments:JSON.stringify({period_id:'p0',outlook:'unfavorable',factor_ids:['f1']})}}]}:{content:good};
   return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));}
 });
 assert.equal(requests,4,JSON.stringify(result));assert.match(result.reply,/2033/);assert.match(result.reply,/2036/);
 assert.doesNotMatch(result.reply,/2040|exact waqt/);assert.ok(result.answer_validation.includes('undated_timing_review'));
});

test('a career forecast cannot replace an unknown date with a promise of improvement soon',()=>{
 for(const reply of ['Career will improve soon.','Jald hi koi shift aayega.','Jaldi hi career set hoga.',
  'Abhi koi fixed date nahi bata sakti, lekin next 1 to 2 saal mein progress shuru hoga.',
  'Your career may take two years to settle.','Progress is likely in the coming months.','Career will improve within 6 months.'])
  assert.equal(unsupportedCareerDeadline(reply,'When will my career settle?',rows),true,reply);
 for(const reply of ['I cannot say your career will settle soon.','Jald career set hoga, yeh kehna sahi nahi hai.','There may be delays, and no reliable date is established.',
  'You said you have worked for two years.','These factors cannot establish progress within two years.'])
  assert.equal(unsupportedCareerDeadline(reply,'When will my career settle?',rows),false,reply);
 assert.equal(unsupportedCareerDeadline('Sun mahadasha begins in 2040.','Explain Sun mahadasha for my career',rows),false);
});

test('career delivery rejects process jargon and an unqualified claim that progress is already blocked',()=>{
 for(const reply of ['Timing abhi clear nahi hai, kyun ki koi calculated event window nahi hai.',
  'Saturn aur dasha lord ka direct link na hona results ko rok raha hai.',
  'Career ka foundation strong hai lekin Saturn se delay ho raha hai.',
  'Saturn aur dasha link ki kami se abhi progress thoda rukaa hua hai.',
  'Progress thoda rukta hai.', 'Your progress is blocked. Support may improve.'])
  assert.ok(careerAnswerWordingIssue(reply,'When will my career settle?',rows));
 assert.equal(careerAnswerWordingIssue('Career ke liye sahyog hai, lekin deri ho sakti hai.\n\nAbhi bharosemand samay batana mumkin nahi.','When will my career settle?',rows),null);
});

test('both reply surfaces repair categorical career delays without replacing the checked answer',async()=>{
 const good='Your career house is supportive, while Saturn may bring delays.\n\nThese factors do not establish a reliable career settlement date.';
 for(const reply_surface of [undefined,'whatsapp']){
  let requests=0;
  const result=await directAnswer({...base,reply_surface,query:'When will my career settle?'},{env,now,
   makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>rows[0],
   fetchImpl:async()=>{requests++;const message=requests===1?{tool_calls:[call]}:{content:requests===2?'Your career house is supportive, but your progress is blocked.\n\nThese factors do not establish a reliable career settlement date.':good};return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));}
  });
  assert.equal(requests,3);assert.ok(result.reply.startsWith(good));
  assert.ok(!result.answer_validation.some(v=>/fallback/.test(v)));
 }
});

test('a relative deadline is corrected through the normal writer without publishing it or selecting another date',async()=>{
 const good='Your career house is supportive, while Saturn may bring delays.\n\nThese factors do not establish a reliable career settlement date.';
 let requests=0;
 const result=await directAnswer({...base,reply_surface:'whatsapp',query:'When will my career settle?'},{env,now,
  makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>rows[0],
  fetchImpl:async()=>{requests++;const message=requests===1?{tool_calls:[call]}:{content:requests===2?'Your career house is supportive.\n\nYour career will improve within 1 to 2 years.':good};return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));}
 });
 assert.equal(requests,3);assert.ok(result.reply.startsWith(good));assert.ok(result.answer_validation.includes('timing_claim_rejected'));
 assert.ok(!result.answer_validation.some(v=>/fallback/.test(v)));assert.doesNotMatch(result.reply,/1 to 2 years|20\d{2}/);
});

test('a complete two-line WhatsApp career answer is measured after whitespace formatting',async()=>{
 const draft='Your career house is supportive, although Saturn may bring some delays in your work; these are mixed indications, rather than a guarantee of a particular outcome.\nThese factors do not establish a reliable career settlement date.';
 let requests=0;
 const result=await directAnswer({...base,reply_surface:'whatsapp',query:'When will my career settle?'},{env,now,
  makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>rows[0],
  fetchImpl:async()=>{requests++;const message=requests===1?{tool_calls:[call]}:{content:draft};return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));}
 });
 assert.equal(requests,2);assert.deepEqual(result.answer_validation,[]);
 assert.ok(result.reply.startsWith(draft.replace('\n','\n\n')));
});

test('long career answers on either surface are edited from the actual checked draft before delivery limits',async()=>{
 const long='Your career house is supportive, while Saturn may bring delays in work. These indications are mixed, with support from the career house alongside the caution about delays. Neither indication establishes that a particular outcome is certain.\n\nThese factors do not establish a reliable career settlement date, so an exact time cannot be concluded from them.';
 const good='Your career house is supportive, while Saturn may bring delays.\n\nThese factors do not establish a reliable career settlement date.';
 for(const reply_surface of [undefined,'whatsapp']){
  let requests=0;
  const result=await directAnswer({...base,reply_surface,query:'When will my career settle?'},{env,now,
   makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>rows[0],
   fetchImpl:async(_url,options)=>{requests++;
    if(requests===3){const body=JSON.parse(options.body);
     assert.ok(body.messages[1].content.includes(JSON.stringify(long)));assert.ok(body.messages[1].content.includes('2040-01-01'));
     assert.match(body.messages[0].content,/Edit only the wording/);
    }
    const message=requests===1?{tool_calls:[call]}:{content:requests===2?long:good};return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));}
  });
  assert.equal(requests,3);assert.ok(result.reply.startsWith(good));assert.ok(!result.answer_validation.some(v=>/fallback/.test(v)));
  assert.doesNotMatch(result.reply,/…/);
 }
});

test('captured obstacle assertions and eventual improvement promises are repaired on both surfaces',async()=>{
 const drafts=[
  'Career ka base strong hai, lekin Saturn ki wajah se thoda rukavat hai.\n\nKoi clear date abhi nahi dikhti.',
  'Career ke liye sahyog hai, lekin deri ho sakti hai.\n\nAbhi koi clear timing nahi dikh rahi, lekin yeh sab time ke saath sudhar jayega.',
 ];
 const good='Career ke liye sahyog hai, lekin deri ho sakti hai.\n\nAbhi bharosemand samay batana mumkin nahi.';
 for(const reply_surface of [undefined,'whatsapp'])for(const draft of drafts){
  let requests=0;
  const result=await directAnswer({...base,language:'hinglish',reply_surface,query:'Mera career kab set hoga?'},{env,now,
   makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>rows[0],
   fetchImpl:async()=>{requests++;const message=requests===1?{tool_calls:[call]}:{content:requests===2?draft:good};return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));}
  });
  assert.equal(requests,3);assert.ok(result.reply.startsWith(good));
  assert.ok(!result.answer_validation.some(v=>/fallback/.test(v)));
 }
 for(const text of ['Your career will improve eventually.','Things will improve with time.','Samay ke saath career sudhar jayega.'])
  assert.equal(unsupportedCareerDeadline(text,'When will my career settle?',rows),true);
 assert.equal(unsupportedCareerDeadline('I cannot promise things will improve with time.','When will my career settle?',rows),false);
 assert.equal(careerAnswerWordingIssue(good,'When will my career settle?',rows),null);
 assert.equal(careerAnswerWordingIssue(drafts[0],'Explain my career dasha in detail',rows),null);
});
