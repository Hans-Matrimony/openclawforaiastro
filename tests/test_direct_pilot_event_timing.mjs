import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY_MS,timingPeriods,monthHorizon} from '../extensions/reviewed-reading/direct/timing-periods.mjs';
import {calculateEventTiming} from '../extensions/reviewed-reading/direct/assets/dev-v2/event-timing.mjs';
import {get_horoscope_predictions,get_current_transits} from '../extensions/reviewed-reading/direct/assets/dev-v2/engine.mjs';
import {projectedTiming,eventWindowReplyIssue,removeTimingBoilerplate} from '../extensions/reviewed-reading/direct/event-window-evidence.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {coherentEvidencePacket,writeCoherentReading} from '../extensions/reviewed-reading/direct/pilot-coherent-reading.mjs';

const asOf=new Date('2026-11-26T13:00:00Z');
const birth={date:'2001-01-03',time:'05:00',location_name:'Delhi'};
const args={birth_date:'3/1/2001',birth_time:'05:00',location_name:'Delhi'};
const natal=()=>JSON.parse(get_horoscope_predictions(args).content[0].text);
const calculate=(row,topic='career',extra={})=>calculateEventTiming(row,{topic,asOf,...extra});

test('first partial mahadasha is subdivided from its full pre-birth start',()=>{
 const born=new Date('2000-01-01T00:00:00Z');
 const year=365.25*DAY_MS;
 const periods=timingPeriods((360/27)/2,born,new Date(+born+3*year),new Date(+born+4*year));
 assert.equal(periods[0].major,'Ketu');assert.equal(periods[0].minor,'Mercury');
 assert.equal(periods[0].major_start,+born-3.5*year);
 const next=periods.find(p=>p.major==='Venus');
 assert.equal(next.start,+born+3.5*year);assert.equal(next.minor,'Venus');
 assert.equal(periods[0].end,next.start);
 const boundary=timingPeriods((360/27)/2,born,new Date(next.start),new Date(next.start+DAY_MS));
 assert.equal(boundary[0].major,'Venus');
});

test('calendar range validates bounds and clamps month-end/leap-year horizons',()=>{
 assert.equal(monthHorizon('2027-01-31',1).toISOString().slice(0,10),'2027-02-28');
 assert.equal(monthHorizon('2028-01-31',1).toISOString().slice(0,10),'2028-02-29');
 for(const months of [0,61,1.5,NaN])assert.throws(()=>monthHorizon(asOf,months));
 assert.throws(()=>timingPeriods(360,'2000-01-01',asOf,'2027-01-01'));
 assert.throws(()=>timingPeriods(10,'2000-01-01','1999-01-01','2027-01-01'));
});

test('forecast horizon starts on the current India calendar date across UTC midnight differences',t=>{
 t.mock.timers.enable({apis:['Date'],now:asOf});
 const result=calculate(natal(),'career',{asOf:new Date('2026-11-26T20:00:00Z')});
 assert.equal(result.as_of,'2026-11-27');assert.equal(result.horizon.from,'2026-11-27');
 assert.ok(result.windows.every(window=>window.from>=result.as_of));
});

test('real ephemeris produces topic-specific windows with explicit support and pressure',t=>{
 t.mock.timers.enable({apis:['Date'],now:asOf});
 const row=natal();const marriage=calculate(row,'marriage'),career=calculate(row,'career');
 assert.equal(marriage.status,'estimated_windows');assert.equal(career.status,'estimated_windows');
 assert.notEqual(marriage.windows[0].from,career.windows[0].from);
 assert.equal(career.windows[0].from,'2027-09-16');assert.equal(career.windows[0].to,'2027-11-26');
 assert.equal(marriage.windows[0].from,'2027-11-27');
 assert.ok(marriage.windows[0].basis.transit.saturn_pressure_houses.includes(7));
 assert.equal(marriage.windows[0].basis.minor.aspect_nature,'pressure');
 for(const window of [...marriage.windows,...career.windows]) {
  assert.ok(window.estimated);assert.equal(window.precision,'month');
  assert.ok(window.from>=career.as_of&&window.to>=window.from&&window.to<=career.horizon.to);
 }
});

test('future Jupiter placement independently agrees with the existing transit tool',t=>{
 t.mock.timers.enable({apis:['Date'],now:asOf});
 const result=calculate(natal());const window=result.windows[0];
 t.mock.timers.setTime(+new Date(window.from+'T12:00:00Z')+10*DAY_MS);
 const transit=JSON.parse(get_current_transits(args).content[0].text);
 assert.equal(transit.gochara.find(p=>p.planet==='Jupiter').over_natal_house,window.basis.transit.jupiter_house);
});

test('no future transit activation yields no window, never a default antardasha date',t=>{
 t.mock.timers.enable({apis:['Date'],now:asOf});
 const result=calculate(natal(),'career',{transits:()=>({activated_houses:[]})});
 assert.equal(result.status,'no_qualifying_window');assert.deepEqual(result.windows,[]);
});

test('invalid or conflicting birth/timezone/period evidence cannot produce a date',t=>{
 t.mock.timers.enable({apis:['Date'],now:asOf});
 for(const mutate of [
  row=>{row.birth_chart.utc_time='invalid';},
  row=>{row.birth_chart.location_used.tzOffset='-05:00';},
  row=>{row.birth_chart.location_used.name='Colombo';},
  row=>{row.dasha.current_antardasha.lord='Ketu';},
  row=>{row.birth_chart.utc_time='2001-02-02T23:30:00.000Z';},
  row=>{row.horary_number=123;},
 ]) {
  const row=natal();mutate(row);const result=calculate(row);
  assert.equal(result.status,'unavailable');assert.deepEqual(result.windows,[]);
 }
 assert.equal(calculate(natal(),'health').status,'unsupported_topic');
 assert.equal(calculate(natal(),'career',{asOf:new Date('invalid')}).status,'unavailable');
});

test('estimated window boundary and precision checks cover English, Hindi and numeric dates',t=>{
 t.mock.timers.enable({apis:['Date'],now:asOf});
 const row=natal();row.event_timing=calculate(row);const timing=projectedTiming(row,'career');
 for(const answer of [
  'Career progress is possible; September 2027 to November 2027 is an estimated supportive period.',
  'Career growth ki sambhavana hai; September 2027 se November 2027 zyada sahayak ho sakta hai.',
  'प्रगति की संभावना है; सितंबर २०२७ से नवंबर २०२७ का समय सहायक हो सकता है।',
  'A supportive period may be 2027-09 through 2027-11.',
  'A supportive period may be September–November 2027.',
  'सितंबर से नवंबर २०२७ का समय सहायक हो सकता है।',
 ])assert.equal(eventWindowReplyIssue(answer,timing),null,answer);
 for(const answer of [
  'September 2028 to November 2028 will be good.',
  '16 September 2027 to 26 November 2027.',
  '2027-09-16 through 2027-11-26.',
  'September 16, 2027 to November 26, 2027.',
  '16/09/2027 through 26/11/2027.',
  'You may progress in 2027.',
  'September 2027 only.',
 ])assert.ok(eventWindowReplyIssue(answer,timing),answer);
 assert.ok(eventWindowReplyIssue('September 2027 to November 2027.',timing,{requested:false}));
});

const config={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',
 VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'1',ASTROFRIEND_PILOT_TOPIC_PROMPTS:'1',
 ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_USERS:'919000000001',
 ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1',ASTROFRIEND_PILOT_COHERENT_REPLIES:'1',ASTROFRIEND_PILOT_EVENT_TIMING_ENABLED:'1'};
const input={user_id:'919000000001',reply_surface:'whatsapp',language:'english',user_gender:'male',birth,history:[],query:'When will my career settle?'};
const candidate='Career progress is possible; September 2027 to November 2027 is an estimated supportive period.\n\nThe strong tenth house offers support, while retrograde Saturn remains an obstacle. The major period provides aspect support; the future Mars sub-period and Jupiter transit add topic-specific timing support.';
async function run({value=input,env=config,draft=candidate}={}) {
 const requests=[];
 const result=await directAnswer(value,{env,now:()=>asOf,makeMemory:()=>({read:async()=>[],write:async()=>assert.fail('No writes')}),
  makeTools:()=>async()=>JSON.stringify(natal()),fetchImpl:async(_url,options)=>{
   const body=JSON.parse(options.body);requests.push(body);const system=body.messages[0].content;
   let message;
   if(system.startsWith('Collect checked evidence'))message={tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]};
   else if(system.startsWith('Write the complete astrology reply')) {const [answer,reason='Checked explanation.']=draft.split('\n\n');message={content:JSON.stringify({answer,reason,remedy:''})};}
   else if(system.startsWith('Review this astrology reply'))message={content:'{"evidence_ok":true,"reason":"","presentation_issue":""}'};
   else if(value.user_id!==input.user_id)message={content:'Please share your birth date, exact birth time and birthplace?'};
   else assert.fail('Unexpected stage: '+system.slice(0,60));
   return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));
  }});
 return {result,requests};
}

test('pilot flow supplies computed month windows to writer/reviewer and preserves separate bubbles',async t=>{
 t.mock.timers.enable({apis:['Date'],now:asOf});
 const {result,requests}=await run();
 assert.equal(result.reply,candidate);assert.ok(result.answer_validation.includes('pilot_event_timing_estimated_windows'));
 for(const body of requests.slice(1)) {
  const packet=JSON.parse(body.messages.at(-1).content).checked_evidence;
  assert.equal(packet.event_windows[0].from,'2027-09');assert.equal(packet.event_windows[0].to,'2027-11');
  assert.equal(packet.event_windows[0].estimated,true);
  assert.equal(packet.timing_estimate.classification,'experimental_astrological_estimate');
  assert.equal(packet.event_windows[0].basis.major.relevant,true);
  assert.equal(packet.event_windows[0].basis.minor.relevant,true);
  assert.equal(packet.timing_estimate.current_period_basis,undefined);
  assert.equal(packet.active_period,undefined);
  assert.ok(![...packet.assessment.favorable,...packet.assessment.adverse].some(factor=>factor.kind==='active_period_link'));
  assert.match(body.messages[0].content,/major\.relevant=false means that major period has no checked topic link/u);
  assert.match(body.messages[0].content,/reviewer must reject a supportive claim about a period with relevant=false/u);
 }
});

test('wrong or exact event dates fail before delivery even if a model reviewer would approve',async t=>{
 t.mock.timers.enable({apis:['Date'],now:asOf});
 for(const draft of [candidate.replaceAll('2027','2029'),candidate.replace('September 2027','16 September 2027')]) {
  const {result}=await run({draft});assert.notEqual(result.reply,draft);
  assert.ok(result.answer_validation.some(v=>v.startsWith('pilot_coherent_rejected:')));
 }
});

test('switch-off, another account and particular-person return do not acquire forecasts',async t=>{
 t.mock.timers.enable({apis:['Date'],now:asOf});
 const baseline=await run({env:{...config,ASTROFRIEND_PILOT_EVENT_TIMING_ENABLED:'0'},draft:'Career progress is possible.\n\nThe tenth house is strong, but Saturn indicates obstacles and the current period has no direct career link.'});
 assert.ok(!baseline.result.answer_validation.some(v=>v.startsWith('pilot_event_timing_')));
 async function other(flag) {
  return run({env:{...config,ASTROFRIEND_PILOT_EVENT_TIMING_ENABLED:flag},value:{...input,user_id:'919000000002',birth:{}}});
 }
 const off=await other('0'),on=await other('1');
 assert.deepEqual(on.requests,off.requests);assert.deepEqual(on.result,off.result);
 const returning=await run({value:{...input,query:'When will my girlfriend return?'},draft:'The chart cannot determine whether or when she will return.\n\nHer decision is her own.'});
 assert.ok(!returning.result.answer_validation.some(v=>v.startsWith('pilot_event_timing_')));
 for(const body of returning.requests.slice(1))assert.deepEqual(JSON.parse(body.messages.at(-1).content).checked_evidence.event_windows,[]);
});

test('captured mechanical wording gets a bounded style repair even when review misses it',async t=>{
 t.mock.timers.enable({apis:['Date'],now:asOf});
 const row=natal();row.event_timing=calculate(row);const packet=coherentEvidencePacket([JSON.stringify(row)],'career');
 const captured={answer:'Career ke liye September se November 2027 ki estimated window zyada supportive dikh rahi hai.',reason:'Career ka ghar mazboot hai, lekin vakri Shani rukawat dikhata hai. Mangal ki antardasha aur Guru ka gochar sahayak hain.',remedy:''};
 const repaired={...captured,answer:'Career mein aage badhne ke liye September se November 2027 ka samay zyada sahayak ho sakta hai.'};
 for(const editAvailable of [true,false]) {
  const events=[];let drafts=0,reviews=0;
  const reply=await writeCoherentReading({value:{...input,language:'hinglish'},subject:input.query,packet,
   validate:text=>eventWindowReplyIssue(text,packet.timing_estimate),fallback:'Must not replace checked evidence',onEvent:event=>events.push(event),
   generate:async(system,payload)=>{
    if(system.startsWith('Review this astrology reply')){reviews++;return '{"evidence_ok":true,"reason":"","presentation_issue":""}';}
    if(++drafts===1)return JSON.stringify(captured);
    const edit=JSON.parse(payload);assert.equal(edit.edit_mode,'presentation_only');
    assert.match(edit.edit_feedback,/both checked month\/year boundaries/u);
    if(!editAvailable)throw Error('Synthetic writer unavailable');
    return JSON.stringify(repaired);
   }});
  assert.equal(drafts,2);assert.equal(reviews,editAvailable?2:1);
  assert.equal(reply,[editAvailable?repaired.answer:captured.answer,captured.reason].join('\n\n'));
  assert.equal(eventWindowReplyIssue(reply,packet.timing_estimate),null);
  assert.ok(events.includes(editAvailable?'verified':'verified_with_style_issue'));
 }
});

test('rejected disclaimer suffixes are removed before validation and review without another model call',async t=>{
 t.mock.timers.enable({apis:['Date'],now:asOf});
 const row=natal();row.event_timing=calculate(row);const timing=projectedTiming(row,'career');
 for(const suffix of ['; yeh andazati samay hai, pakki tareekh nahi.','. Yeh estimated window hai, pakki event date nahi.','; ise sambhavana samjhein, pakki tareekh nahi.',', pakki tareekh nahi.']) {
  const answer='September se November 2027 tak career ke liye zyada sahayak samay dikh raha hai';
  const draft=answer+suffix+'\n\n'+candidate.split('\n\n')[1];
  const {result,requests}=await run({value:{...input,language:'hinglish'},draft});
  assert.equal(result.reply,answer+'.\n\n'+candidate.split('\n\n')[1]);
  assert.equal(requests.length,3);
  const reviewed=JSON.parse(requests.at(-1).messages.at(-1).content).proposed;
  assert.equal(reviewed,result.reply);assert.equal(eventWindowReplyIssue(reviewed,timing),null);
 }
 for(const text of ['Shaadi November 2027 mein hogi; yeh andazati samay hai, pakki tareekh nahi.',
  'Yeh estimated window hai, pakki event date nahi.',
  'September 2027 se November 2027 tak samay sahayak ho sakta hai.',
  'Pehle aapne kaha tha "yeh andazati samay hai, pakki tareekh nahi."'])
  assert.equal(removeTimingBoilerplate(text,timing),text);
 const text='Samay sahayak dikh raha hai; yeh andazati samay hai, pakki tareekh nahi.';
 assert.equal(removeTimingBoilerplate(text,null),text);
});

test('captured reviewer-induced disclaimer prefix is cleaned in the same bounded reading flow',async t=>{
 t.mock.timers.enable({apis:['Date'],now:asOf});
 const row=natal();row.event_timing=calculate(row);const packet=coherentEvidencePacket([JSON.stringify(row)],'career');
 const reason='Career ka ghar mazboot hai, jabki vakri Shani rukawat dikha raha hai. Shukra mahadasha career ko support karti hai, Mangal antardasha kaam se judi hai, aur us dauran Guru ka gochar bhi career ke kshetra ko sahara deta hai.';
 const captured='Career set hone ki pakki tareekh nahi, lekin September se November 2027 progress ke liye zyada supportive daur ho sakta hai.';
 let calls=0;const proposed=[];
 const reply=await writeCoherentReading({value:{...input,language:'hinglish'},subject:input.query,packet,
  validate:text=>eventWindowReplyIssue(text,packet.timing_estimate),fallback:'Must not fall back',generate:async(system,payload)=>{
   calls++;
   if(calls===1)return JSON.stringify({answer:'Career mein progress ki sambhavana September se November 2027 ke dauran zyada supportive dikh rahi hai.',reason,remedy:''});
   if(calls===2){proposed.push(JSON.parse(payload).proposed);return '{"evidence_ok":false,"reason":"Selected window aur chart factors sahi diye hain, lekin exact date establish nahi hoti.","presentation_issue":""}';}
   if(calls===3)return JSON.stringify({answer:captured,reason,remedy:''});
   proposed.push(JSON.parse(payload).proposed);return '{"evidence_ok":true,"reason":"","presentation_issue":""}';
  }});
 assert.equal(calls,4);assert.equal(proposed.at(-1),reply);
 assert.equal(reply,'Career set hone ke liye September se November 2027 progress ke liye zyada supportive daur ho sakta hai.\n\n'+reason);
 assert.doesNotMatch(reply,/pakki tareekh|estimated window|andazati samay/iu);
 assert.equal(eventWindowReplyIssue(reply,packet.timing_estimate),null);
 assert.equal(removeTimingBoilerplate('Career ki pakki tareekh nahi, lekin September 2027 mein job lagegi.',packet.timing_estimate),
  'Career ki pakki tareekh nahi, lekin September 2027 mein job lagegi.');
});
