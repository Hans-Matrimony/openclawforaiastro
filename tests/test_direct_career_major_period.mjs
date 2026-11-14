import assert from 'node:assert/strict';
import test from 'node:test';
import {upcomingPeriods} from '../extensions/reviewed-reading/direct/returned-periods.mjs';
import {topicPeriodEvidence,unsupportedTopicOpportunity} from '../extensions/reviewed-reading/direct/topic-period-context.mjs';
import {isPeriodInterpretation} from '../extensions/reviewed-reading/direct/period-interpretation.mjs';
import {unsupportedEventTiming} from '../extensions/reviewed-reading/direct/event-timing.mjs';
import {timingRepairEvidence} from '../extensions/reviewed-reading/direct/timing-repair.mjs';
import {timingCorrection} from '../extensions/reviewed-reading/direct/timing-correction.mjs';
import {evidenceFallback} from '../extensions/reviewed-reading/direct/evidence-fallback.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {companionFallback} from '../extensions/reviewed-reading/direct/companion-fallback.mjs';

const chart={engine:'local-sweph-v2',birth_chart:{planets:['Sun: Taurus | house 2','Saturn: Virgo | house 6','Jupiter: Gemini | house 3'],
 ashtakavarga_house_bindus:{house_10:{sign:'Leo',bindus:31}}},
 dasha:{upcoming_antardashas:[{lord:'Jupiter',from:'2030-01-01',to:'2033-01-01'},
  {lord:'Saturn',from:'2033-01-01',to:'2036-01-01'}],next_mahadasha:{lord:'Sun',from:'2040-01-01',to:'2046-01-01'}},
 verdict_signals:[{area:'career',trend:'MIXED',positive:['house 10 (Leo) bindus 31/48 => strong support'],negative:['Saturn retrograde => results me Atkaav']}],
 evidence_scope:{timing:'This tool does not calculate event-specific windows'}};
const evidence=[JSON.stringify(chart)],query='Mera career kab set hogaa',now=()=>new Date('2026-11-13T00:00:00Z');
const call=(name,args)=>({id:'fixture-call',type:'function',function:{name,arguments:JSON.stringify(args)}});

test('all returned future period levels remain available without changing the underlying calculation',()=>{
 const before=JSON.stringify(chart);
 const periods=topicPeriodEvidence(evidence,query).periods;
 assert.equal(periods.length,3);
 assert.equal(periods[2].kind,'mahadasha');assert.deepEqual(periods[2].relevant_house_lord,[10]);
 assert.equal(periods[2].from,'2040-01-01');assert.equal(periods[2].to,'2046-01-01');
 assert.deepEqual(periods[0].relevant_house_lord,[]);
 assert.match(timingRepairEvidence(evidence),/January 2040/);
 assert.match(timingRepairEvidence(evidence),/mahadasha/);
 assert.equal(JSON.stringify(chart),before);
});

test('a qualified major-period interpretation is preserved; wrong labels, dates and unrelated career years are rejected',()=>{
 const reply='Sun rules house 10, so career support may be mixed.\n\nSun mahadasha from January 2040 to January 2046 may support career, with obstacles.';
 assert.equal(isPeriodInterpretation(reply,[chart]),true);
 assert.equal(unsupportedEventTiming(reply,evidence,query),false);
 assert.equal(unsupportedTopicOpportunity(reply,evidence,query),false);
 for(const wrong of [reply.replaceAll('2046','2047'),reply.replace('Sun mahadasha','Sun antardasha'),
   reply.replace('may support','will definitely settle')])assert.equal(isPeriodInterpretation(wrong,[chart]),false);
 assert.equal(unsupportedTopicOpportunity('Jupiter antardasha, January 2030 to January 2033: career improvement is possible.',evidence,query),true);
 const unrelated={...chart,dasha:{...chart.dasha,next_mahadasha:{...chart.dasha.next_mahadasha,lord:'Jupiter'}}};
 assert.equal(unsupportedTopicOpportunity('Jupiter mahadasha, January 2040 to January 2046: career improvement is possible.',[JSON.stringify(unrelated)],query),true);
});

test('career fallback asks a concrete unanswered question rather than the reported stock closing',()=>{
 const previous={role:'assistant',text:'Kaam mein apni kaunsi skill ko aur use karne ka mann hai?'};
 const value={query:'Mera career kab set hoga?',history:[previous],language:'hinglish'};
 const reply=companionFallback(value);
 assert.match(reply,/nayi job|growth/iu);assert.doesNotMatch(reply,/agla kadam|saath mein sochna/iu);
 assert.doesNotMatch(companionFallback({...value,history:[{role:'user',text:'I am working in my current job'},previous]}),/nayi job dhoondh|current kaam mein growth/iu);
});

test('structured repair can retain a relevant major period and adverse factors without saying to wait for employment',()=>{
 const supported={...chart,verdict_signals:[{...chart.verdict_signals[0],positive:[...chart.verdict_signals[0].positive,'benefic Sun house 10 mein']}]};
 const correction=timingCorrection([JSON.stringify(supported)],query,'hinglish',now());
 const reply=correction.render({tool_calls:[call('submit_timing_reading',{period_id:'p2',outlook:'mixed',factor_ids:['f1']})]});
 assert.match(reply,/January 2040 se January 2046/);assert.match(reply,/Sun mahadasha/);
 assert.match(reply,/Sun/);assert.match(reply,/Shani/);
 assert.match(reply,/rukna zaroori nahi/);assert.doesNotMatch(reply,/supported samay|alag sanket|2030/);
 assert.equal(unsupportedEventTiming(reply,evidence,query),false);
 assert.ok(reply.split(/\s+/u).length<=50);
});

test('repair cannot promote house ownership into a selectable career support factor',()=>{
 const correction=timingCorrection(evidence,query,'hinglish',now());
 assert.doesNotMatch(correction.instruction,/Sun is the natal lord of house 10/);
 for(const factor_ids of [['f0'],['f1'],['f2']])
  assert.equal(correction.render({tool_calls:[call('submit_timing_reading',{period_id:'p2',outlook:'mixed',factor_ids})]}),null);
 for(const outlook of ['possible','mixed'])
  assert.equal(correction.render({tool_calls:[call('submit_timing_reading',{period_id:'p1',outlook,factor_ids:['f0','f1']})]}),null);
 assert.match(correction.render({tool_calls:[call('submit_timing_reading',{period_id:'p1',outlook:'unfavorable',factor_ids:['f1']})]}),/2033 se January 2036/);
});

test('missing or ambiguous timing stays honest and natural without choosing a distant period automatically',()=>{
 const reply=evidenceFallback([JSON.stringify({...chart,birth_chart:undefined})],'hinglish',query,now());
 assert.match(reply,/exact waqt abhi saaf nahi/);
 assert.doesNotMatch(reply,/supported samay|alag sanket|2040|2046/);
 assert.match(reply,/Career ke ghar ki majbooti achhi/);assert.match(reply,/deri ho sakti/);
 assert.doesNotMatch(evidenceFallback(evidence,'hinglish','Mera career batao',now()),/career field|baaki se behtar/);
 assert.match(evidenceFallback(evidence,'hinglish','Mere liye best career field?',now()),/career field/);
 for(const invalid of [{lord:'Sun',from:'2040-01-01'}, {lord:'Sun',from:'2040-02-30',to:'2046-01-01'},
  {lord:'Sun',from:'2046-01-01',to:'2040-01-01'}, {lord:'Fake',from:'2040-01-01',to:'2046-01-01'}]) {
  assert.deepEqual(upcomingPeriods({next_mahadasha:invalid}),[]);
 }
 assert.deepEqual(upcomingPeriods({upcoming_antardashas:[null,{},'bad']}),[]);
});

test('a failed career draft retains checked factors without selecting a date from house ownership',()=>{
 const reply=evidenceFallback(evidence,'hinglish',query,now());
 assert.doesNotMatch(reply,/20\d{2}|mahadasha/);assert.match(reply,/exact waqt abhi saaf nahi/);
 assert.match(reply,/Career ke ghar/);assert.match(reply,/Shani/);assert.match(reply,/deri ho sakti/);
 assert.equal(unsupportedEventTiming(reply,evidence,query),false);
 const unsupported={...chart,birth_chart:{...chart.birth_chart,ashtakavarga_house_bindus:{}}};
 assert.doesNotMatch(evidenceFallback([JSON.stringify(unsupported)],'hinglish',query,now()),/2040|2046/);
});

test('captured PWA career assertion cannot deny all earlier change or hide an open-ended career year',()=>{
 for(const reply of [
  'Career ke liye current support kam hai. Sun mahadasha 2040 mein aayega, aur tab tak koi clear shift nahi hoga.\n\nCareer set hona 2040 ke baad sambhavna hai.',
  'There will be no career change before 2040.',
  'Career set hona 2040 ke baad sambhavna hai.',
 ])assert.equal(unsupportedEventTiming(reply,evidence,query),true,reply);
 assert.equal(unsupportedEventTiming('Career settle hone ka exact waqt abhi saaf nahi hai.',evidence,query),false);
});

test('PWA and WhatsApp dispatch preserve the same checked career interpretation after an unrelated marriage answer',async()=>{
 const replies=[];
 for(const surface of [undefined,'whatsapp']){
  let calls=0,chartCalls=0;
  const result=await directAnswer({user_id:'synthetic-career-major',query:'Mere career ke liye Sun mahadasha kab aayegi aur kaisi rahegi?',language:'hinglish',reply_surface:surface,
   birth:{date:'1991-04-11',time:'08:00',location_name:'Pune'},history:[{role:'user',text:'Meri shaadi kab hogi?'},{role:'assistant',text:'An old marriage answer.'}]},{
   env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0'},now,
   makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{chartCalls++;return evidence[0];},
   fetchImpl:async(_url,options)=>{
    calls++;const body=JSON.parse(options.body);
    const message=calls===1?{tool_calls:[call('mcp__VedAstro__get_horoscope_predictions',{})]}
     :calls===2?{content:'Jupiter antardasha, January 2030 to January 2033: career improvement is possible.'}
      :{content:'Sun rules house 10. Saturn may cause delays.\n\nSun mahadasha from January 2040 to January 2046 may support career, with obstacles.'};
    if(calls===3)assert.notEqual(body.tool_choice?.function?.name,'submit_timing_reading');
    assert.ok(calls<=3,'No endless repair loop or extra model call');
    return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));
   },
  });
  assert.equal(chartCalls,1);assert.equal(calls,3);
  assert.match(result.reply,/Sun mahadasha/);assert.match(result.reply,/2040/);
  assert.doesNotMatch(result.reply,/shaadi|marriage|supported samay|2030/iu);
  replies.push(result.reply);
 }
 assert.equal(replies[0].split(/\n\s*\n/u).slice(0,2).join('\n\n'),replies[1].split(/\n\s*\n/u).slice(0,2).join('\n\n'));
});
