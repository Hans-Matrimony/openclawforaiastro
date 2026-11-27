import test from 'node:test';
import assert from 'node:assert/strict';
import {chaturthamsaSign,propertyPeriodBasis,propertyDivisionalChart} from '../extensions/reviewed-reading/direct/assets/dev-v2/property-timing.mjs';
import {calculateEventTiming} from '../extensions/reviewed-reading/direct/assets/dev-v2/event-timing.mjs';
import {get_horoscope_predictions,get_current_transits} from '../extensions/reviewed-reading/direct/assets/dev-v2/engine.mjs';
import {projectedTiming} from '../extensions/reviewed-reading/direct/event-window-evidence.mjs';
import {pairedPropertyTimingReply,pairedPropertyTimingRequest} from '../extensions/reviewed-reading/direct/paired-property-timing.mjs';
import {propertyEventKind} from '../extensions/reviewed-reading/direct/property-intent.mjs';
import {propertyCapabilityBoundary} from '../extensions/reviewed-reading/direct/property-boundary.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {createTools} from '../extensions/reviewed-reading/direct/tools.mjs';
import {propertyOtherBirth} from '../extensions/reviewed-reading/direct/property-subject.mjs';
import {normalizeFocusedReadingLanguage,focusedReplyIssue} from '../extensions/reviewed-reading/direct/focused-reading-delivery.mjs';

const asOf=new Date('2026-11-27T06:00:00Z');
const birth={date:'2001-01-03',time:'05:00',location_name:'Delhi'};
const args={birth_date:'3/1/2001',birth_time:'05:00',location_name:'Delhi'};
const chart=()=>JSON.parse(get_horoscope_predictions(args).content[0].text);
const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',
 VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'1',ASTROFRIEND_PILOT_TOPIC_PROMPTS:'1',
 ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_USERS:'919000000001',
 ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1',ASTROFRIEND_PILOT_COHERENT_REPLIES:'1',
 ASTROFRIEND_PILOT_EVENT_TIMING_ENABLED:'1',ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'1'};
const value={user_id:'919000000001',reply_surface:'whatsapp',language:'hinglish',user_gender:'male',birth,history:[]};
const response=content=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}]});

test('D4 follows published quarter boundaries and independent Taurus examples',()=>{
 for(const [longitude,sign]of [[0,0],[7.49999,0],[7.5,3],[15,6],[22.5,9],[29.99999,9],[30,1],
  [33,1],[44,4],[53,10],[359.99999,8]])assert.equal(chaturthamsaSign(longitude),sign,String(longitude));
 for(const bad of [-1,360,NaN,Infinity])assert.throws(()=>chaturthamsaSign(bad));
});

test('a wealth link or pressure-only D4 aspect cannot replace the two required fourth-house links',()=>{
 const natal={ascendant:7,planets:new Map([['Saturn',{adverse:true}]])};
 const period=(owns=[],occupies=[],aspects=[],aspect_nature=null)=>({owns_houses:owns,occupies_houses:occupies,aspects_houses:aspects,aspect_nature});
 const divisional={ascendant:1};
 for(const [rasi,d4,expected]of [[period([2]),period([4]),false],
  [period([4]),period([],[],[4],'pressure'),false],[period([4]),period([],[],[4],'support'),true],
  [period([],[4]),period([4]),true]]) {
  const relevance=(_lord,chart)=>chart===natal?rasi:d4;
  assert.equal(propertyPeriodBasis(natal,divisional,'Venus','Mars',relevance,{}).eligible,expected);
 }
});

test('real property windows have independent Rasi, D4 and fourth-house transit evidence even when career months overlap',t=>{
 t.mock.timers.enable({apis:['Date'],now:asOf});
 const row=chart(),property=calculateEventTiming(row,{topic:'property',asOf}),career=calculateEventTiming(row,{topic:'career',asOf});
 assert.equal(property.status,'estimated_windows');assert.ok(property.windows.length);
 for(const window of property.windows) {
  assert.equal(window.topic,'property');assert.equal(window.basis.property.event,'property_purchase');
  assert.ok(window.basis.property.rasi_fourth_link.major||window.basis.property.rasi_fourth_link.minor);
  assert.ok(window.basis.property.d4.fourth_link.major||window.basis.property.d4.fourth_link.minor);
  assert.deepEqual(window.basis.transit.activated_houses,[4]);
  assert.ok(window.from>=property.as_of&&window.to<=property.horizon.to);
 }
 assert.equal(property.windows[0].from,career.windows[0].from,'Do not fabricate varied dates for the same chart');
 assert.deepEqual(career.windows[0].basis.transit.activated_houses,[10]);
 assert.notDeepEqual(property.windows[0].basis.major,career.windows[0].basis.major);
 assert.equal(property.windows[0].basis.property.rasi_fourth_lord.lord,'Saturn');
 assert.equal(property.windows[0].basis.property.d4.fourth_lord,'Sun');
 t.mock.timers.setTime(+new Date(property.windows[0].from+'T12:00:00Z')+864000000);
 const transit=JSON.parse(get_current_transits(args).content[0].text);
 assert.equal(transit.gochara.find(p=>p.planet==='Jupiter').over_natal_house,property.windows[0].basis.transit.jupiter_house);
});

test('missing property evidence, wrong historical timezone or no fourth-house transit cannot manufacture a date',t=>{
 t.mock.timers.enable({apis:['Date'],now:asOf});
 for(const mutate of [row=>{row.birth_chart.ascendant.longitude=undefined;},row=>{row.birth_chart.ascendant.longitude=225;},
  row=>{row.birth_chart.location_used.tzOffset='-05:00';},row=>{row.dasha.current_antardasha.lord='Ketu';}]) {
  const row=chart();mutate(row);const result=calculateEventTiming(row,{topic:'property',asOf});
  assert.equal(result.status,'unavailable');assert.deepEqual(result.windows,[]);
 }
 assert.throws(()=>propertyDivisionalChart({chart:{ascendant:{longitude:0}},ascendant:0,planets:new Map()},()=>0));
 const none=calculateEventTiming(chart(),{topic:'property',asOf,transits:()=>({activated_houses:[]})});
 assert.equal(none.status,'no_qualifying_window');
 for(const propertyEvent of ['sale','construction','lender_decision',null])
  assert.equal(calculateEventTiming(chart(),{topic:'property',propertyEvent,asOf}).status,'unsupported_event');
});

test('a relabeled career date cannot enter a property presentation packet',t=>{
 t.mock.timers.enable({apis:['Date'],now:asOf});
 const row=chart();const career=calculateEventTiming(row,{topic:'career',asOf});
 row.event_timing={...career,topic:'property',windows:career.windows.map(w=>({...w,topic:'property'}))};
 assert.equal(projectedTiming(row,'property').selected,undefined);
 const property=calculateEventTiming(row,{topic:'property',asOf});
 row.event_timing=property;assert.ok(projectedTiming(row,'property').selected);
 for(const mutate of [w=>{delete w.basis.property;},w=>{w.basis.property.event='sale';},
  w=>{w.basis.property.d4.fourth_link={major:false,minor:false};},w=>{w.basis.transit.activated_houses=[10];}]) {
  const copy=structuredClone(property);copy.windows=copy.windows.slice(0,1);mutate(copy.windows[0]);
  assert.equal(projectedTiming({...row,event_timing:copy},'property').selected,undefined);
 }
});

test('property sale, construction, lender decision and ambiguous timing cannot inherit purchase dates',()=>{
 for(const [query,kind]of [['When will I sell my house?','sale'],['Mera ghar kab banwa paunga?','construction'],
  ['Ghar kharidne ke liye bank loan kab approve hoga?','lender_decision'],['Meri property ka samay kab hai?',null]]) {
  assert.equal(propertyEventKind(query),kind,query);
  assert.ok(propertyCapabilityBoundary({...value,query}),query);
 }
 for(const query of ['When will I buy my house?','When is my property tax due?','When is property registration due?'])
  assert.equal(propertyCapabilityBoundary({...value,query}),null,query);
 for(const query of ['Ghar ki date nahi chahiye. Mera career kab set hoga?',
  'Property nahi, mera career kab set hoga?'])
  assert.equal(propertyCapabilityBoundary({...value,query}),null,'A declined property subject cannot override the current career request');
});

test('actual unsupported property dispatch stays conversational even if the model tries a chart handoff',async()=>{
 for(const query of ['When will I sell my house?','Ghar kharidne ke liye bank loan kab approve hoga?']) {
  let calls=0;
  const result=await directAnswer({...value,query},{env,now:()=>asOf,
   makeMemory:()=>({read:async()=>[],write:async()=>assert.fail('No writes')}),makeTools:()=>async()=>assert.fail('No wrong-event calculation'),
   fetchImpl:async(_,options)=>{calls++;assert.match(JSON.parse(options.body).messages[0].content,/calculation-capability boundary/u);return response({route:'checked_reading',reply:''});}});
  assert.equal(calls,1);assert.deepEqual(result.answer_reading_tools,[]);assert.doesNotMatch(result.reply,/20\d{2}/u);
  assert.equal(result.answer_conversation_route,'conversation');
 }
});

test('independent career/property comparison computes both windows once instead of accepting earlier dates',async t=>{
 t.mock.timers.enable({apis:['Date'],now:asOf});
 const query='Career aur ghar kharidne ki same dates kyun aa rahi hain?';
 assert.equal(pairedPropertyTimingRequest(query),true);
 assert.equal(pairedPropertyTimingRequest('Career nahi, meri sister ghar kab kharidegi?'),false);
 let collections=0;
 const result=await directAnswer({...value,query,history:[{role:'assistant',text:'Both will happen in January 2040.'}]},{env,now:()=>asOf,
  makeMemory:()=>({read:async()=>[],write:async()=>assert.fail('No writes')}),makeTools:()=>async()=>JSON.stringify(chart()),
  fetchImpl:async(_,options)=>{
   const body=JSON.parse(options.body);
   if(body.messages[0].content.startsWith('You interpret the latest utterance'))return response({route:'checked_reading',reply:''});
   assert.match(body.messages[0].content,/Collect checked evidence/u);collections++;
   return Response.json({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}}]});
  }});
 assert.equal(collections,1);assert.equal(result.answer_response_flow,'pilot_paired_timing');
 assert.match(result.reply,/career.*September 2027 se November 2027/iu);
 assert.match(result.reply,/ghar kharidne.*September 2027 se November 2027/iu);
 assert.match(result.reply,/chauthe.*Shani/u);assert.doesNotMatch(result.reply,/2040|January/u);
});

test('comparison preserves a missing property window rather than relabeling the available career window',t=>{
 t.mock.timers.enable({apis:['Date'],now:asOf});
 const row=chart(),career=calculateEventTiming(row,{topic:'career',asOf});
 const property=calculateEventTiming(row,{topic:'property',asOf,transits:()=>({activated_houses:[]})});
 const reply=pairedPropertyTimingReply(row,career,property,value);
 assert.match(reply,/career.*September 2027/iu);assert.match(reply,/ghar kharidne ke liye samay ki avadhi nahi/u);
 assert.doesNotMatch(reply,/dono ke liye ek hi/u);
});

test('another person cannot acquire the selected account chart or an old assistant birth form',async()=>{
 const query='Mere bhai ka apna ghar kab kharidne ka yog hai? Mere chart ki date uske liye use mat karna.';
 assert.equal(propertyCapabilityBoundary({...value,query}).kind,'person_profile');
 let calls=0;
 const result=await directAnswer({...value,query,history:[{role:'assistant',text:'Brother: 1995-03-12; 08:30; Place: Mumbai'}]},
  {env,now:()=>asOf,makeMemory:()=>({read:async()=>[],write:async()=>assert.fail('No writes')}),
   makeTools:()=>async()=>assert.fail('No chart without this person birth inputs'),
   fetchImpl:async()=>{calls++;return response({route:'checked_reading',reply:''});}});
 assert.equal(calls,1);assert.equal(result.answer_conversation_route,'clarification');
 assert.match(result.reply,/unki janam tareekh/iu);assert.doesNotMatch(result.reply,/2027|2001/);
 const execute=createTools({birth,query,propertyReading:true,memory:{read:async()=>[],write:async()=>assert.fail('No writes')},
  reading:async()=>assert.fail('Tool boundary must reject the wrong profile')});
 await assert.rejects(execute('get_horoscope_predictions',args),{code:'birth_details_required'});
});

test('a complete current relative form binds that chart without changing the account profile',async()=>{
 const query='When will my brother buy his house?\nBirth date: 1995-03-12\nBirth time: 08:30\nPlace: Mumbai';
 const other={date:'1995-03-12',time:'08:30',location_name:'Mumbai'};
 assert.deepEqual(propertyOtherBirth(query),other);assert.equal(propertyCapabilityBoundary({...value,query}),null);
 const selected=structuredClone(birth);let bound;
 const execute=createTools({birth:selected,query,propertyReading:true,memory:{read:async()=>[],write:async()=>assert.fail('No writes')},
  reading:async(name,input)=>{bound=input;return {content:[{type:'text',text:'{}'}]};}});
 await execute('get_horoscope_predictions',args);
 assert.equal(bound.birth_date,other.date);assert.equal(bound.birth_time,other.time);assert.equal(bound.location_name,other.location_name);
 assert.deepEqual(selected,birth);
 // A different relative without a current form cannot reuse this one.
 const later=createTools({birth,query:'When will my sister buy her house?',history:[{role:'user',text:query}],propertyReading:true,
  memory:{read:async()=>[],write:async()=>assert.fail('No writes')},reading:async()=>assert.fail('Wrong relative')});
 await assert.rejects(later('get_horoscope_predictions',args),{code:'birth_details_required'});
});

test('captured property caution becomes natural Hinglish without changing dates, quoted text or the obstacle',()=>{
 const capture='Aapke next ghar kharidne ke yog September 2027 se November 2027 ke beech dikhte hain. Shani ki janm-kundli wali sthiti ek material saavdhani hai.';
 const actual=normalizeFocusedReadingLanguage(capture,value);
 assert.equal(actual,capture.replace('material saavdhani','rukawat ka sanket'));
 const plan={topic:'property',scope:'natal_outlook',reasons:{property_basis:{rasi_fourth_lord:{adverse_natal_condition:true}}}};
 assert.equal(focusedReplyIssue(actual,plan),null);
 assert.equal(normalizeFocusedReadingLanguage('Aapne "material saavdhani" likha tha.',value),'Aapne "material saavdhani" likha tha.');
 assert.equal(normalizeFocusedReadingLanguage(capture,{...value,language:'english'}),capture);
});
