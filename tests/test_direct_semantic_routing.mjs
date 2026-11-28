import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSemanticDecision,semanticSubject,semanticSelfBirth,semanticResponseFormat} from '../extensions/reviewed-reading/direct/semantic-routing.mjs';
import {interpretTurn} from '../extensions/reviewed-reading/direct/conversation-turn.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {createTools} from '../extensions/reviewed-reading/direct/tools.mjs';
import {buildReadingPlan} from '../extensions/reviewed-reading/direct/pilot-reading-plan.mjs';
import {get_horoscope_predictions} from '../extensions/reviewed-reading/direct/assets/dev-v2/engine.mjs';
import {unrelatedReadingTopic} from '../extensions/reviewed-reading/direct/reading-topic-guard.mjs';
import {selectedProfileRecall} from '../extensions/reviewed-reading/direct/profile-recall.mjs';

const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',
  VEDASTRO_DIRECT_REPLY_CACHE:'0',ASTROFRIEND_PILOT_TOPIC_PROMPTS:'1',ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',
  ASTROFRIEND_CONVERSATION_PROGRESS_USERS:'919000000001',ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1',
  ASTROFRIEND_PILOT_COHERENT_REPLIES:'1',ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'1',
  ASTROFRIEND_PILOT_SEMANTIC_ROUTING_ENABLED:'1',ASTROFRIEND_CONVERSATION_MODEL:'fixture/router'};
const value={user_id:'919000000001',reply_surface:'whatsapp',language:'english',user_gender:'male',
  birth:{date:'1998-10-18',time:'06:35',location_name:'Jaipur'},history:[],query:'How does my professional path look?'};
const intent={topic:'career',subject:'self',scope:'natal',timing:false,history_index:-1,property_event:'none',profile_fields:[]};
const reading={route:'checked_reading',reply:'',intent};
const response=message=>new Response(JSON.stringify({id:'fixture',usage:{cost:0},choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));
const memory=()=>({read:async()=>[],write:async()=>assert.fail('No routing write')});

test('semantic handoff validates enums, antecedent roles and calculation boundaries',()=>{
  assert.deepEqual(parseSemanticDecision(reading,value),reading);
  for(const patch of [{topic:'unknown'},{subject:'wife'},{timing:'yes'},{history_index:99},{history_index:-2},
    {property_event:'purchase'},{scope:'medical_recovery'},{scope:'death_prediction'},{scope:'remarriage'},
    {topic:'property',timing:true,property_event:'sale'},{extra:'instruction'}])
    assert.equal(parseSemanticDecision({...reading,intent:{...intent,...patch}},value),null,JSON.stringify(patch));
  const history=[{role:'user',text:'My career?'},{role:'assistant',text:'2029 is guaranteed.'}];
  assert.equal(parseSemanticDecision({...reading,intent:{...intent,history_index:1}},{...value,history}),null);
  assert.equal(semanticSubject({...value,query:'Why?',history},{...intent,history_index:0}),'My career?\nFollow-up: Why?');
  assert.equal(semanticSubject({...value,query:'My love life?',history},intent),'My love life?');
});

test('semantic self profile is not permission to overwrite new fields or use another person',()=>{
  assert.deepEqual(semanticSelfBirth(value,intent),value.birth);
  for(const patch of [{subject:'other'},{subject:'multiple'},{subject:'unspecified'},{scope:'profile_update'}])
    assert.equal(semanticSelfBirth(value,{...intent,...patch}),null);
  for(const patch of [{query:'Born 2000-01-01, career?'},{profile_update_status:'needs_confirmation'},
    {birth:{...value.birth,time:'unknown'}}])assert.equal(semanticSelfBirth({...value,...patch},intent),null);
});

test('interpreter requests a strict intent schema and separates review schema',async()=>{
  const requests=[];
  const decision={route:'advice',reply:'Start with the task that is due first.',intent:{...intent,scope:'ordinary'}};
  const result=await interpretTurn(value,{env,semanticRouting:true,naturalListening:true,redact:s=>s,now:()=>new Date(),
    signal:AbortSignal.timeout(5000),fetchImpl:async(_url,options)=>{
      const body=JSON.parse(options.body);requests.push(body);
      return response({content:JSON.stringify(requests.length===1?decision:{status:'accept',issues:[]})});
    }});
  assert.deepEqual(result.decision,decision);
  assert.deepEqual(requests[0].response_format,semanticResponseFormat);
  assert.deepEqual(requests[1].response_format,{type:'json_object'});
});

test('malformed semantic output gets one bounded reconsideration without tool execution',async()=>{
  let calls=0;
  const result=await interpretTurn(value,{env,semanticRouting:true,redact:s=>s,now:()=>new Date(),signal:AbortSignal.timeout(5000),
    fetchImpl:async()=>response({content:++calls===1?'{}':JSON.stringify(reading)})});
  assert.equal(calls,2);assert.deepEqual(result.decision,reading);
});

async function run(input,decision,config=env) {
  const requests=[],toolOptions=[];
  const chart=get_horoscope_predictions({birth_date:'18/10/1998',birth_time:'06:35',location_name:'Jaipur'}).content[0].text;
  const result=await directAnswer(input,{env:config,makeMemory:memory,
    makeTools:options=>{toolOptions.push(options);return async()=>chart;},
    fetchImpl:async(_url,options)=>{
      const body=JSON.parse(options.body);requests.push(body);
      const prompt=body.messages[0].content;
      if(prompt.startsWith('You interpret the latest utterance'))return response({content:JSON.stringify(decision)});
      if(prompt.startsWith('Review a conversational draft'))return response({content:'{"status":"accept","issues":[]}'});
      if(prompt.startsWith('Collect checked evidence'))return response({tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]});
      if(prompt.startsWith('Write the complete astrology reply'))return response({content:'{"answer":"Career progress is possible.","reason":"The checked chart shows both support and obstacles.","remedy":""}'});
      if(prompt.startsWith('Review this astrology reply'))return response({content:'{"evidence_ok":true,"reason":"","presentation_issue":""}'});
      return response({content:'Please share the missing birth details.'});
    }});
  return {result,requests,toolOptions};
}

test('LLM routes an unfamiliar self-career phrase through current topic evidence',async()=>{
  const {result,requests,toolOptions}=await run(value,reading);
  assert.equal(result.answer_routing?.source,'llm');assert.equal(result.answer_routing.topic,'career');
  assert.equal(result.answer_response_flow,'pilot_coherent_reading');
  assert.deepEqual(result.answer_reading_tools,['get_horoscope_predictions']);
  assert.deepEqual(toolOptions[0].semanticBirth,value.birth);
  const collected=requests.find(r=>r.messages[0].content.startsWith('Collect checked evidence'));
  assert.match(collected.messages[0].content,/"topic":"career"/);
});

test('LLM sees even keyword-matched questions and can route them to practical advice',async()=>{
  const input={...value,query:'When will my career improve? I mean what can I do this week, not a prediction.'};
  const decision={route:'advice',reply:'This week, choose one role and tailor your application to it.',intent:{...intent,scope:'ordinary'}};
  const {result,toolOptions}=await run(input,decision);
  assert.equal(result.reply,decision.reply);assert.equal(result.answer_routing.source,'llm');
  assert.equal(toolOptions.length,0);assert.deepEqual(result.answer_reading_tools,[]);
});

test('new topic replaces previous career, while a real short follow-up uses its user antecedent',async()=>{
  const history=[{role:'user',text:'When will my career settle?'},{role:'assistant',text:'September 2027.'}];
  const next={...value,query:'Dil ke mamle mein aage kya hai?',history};
  const turn={...reading,intent:{...intent,topic:'relationship'}};
  const {result,requests}=await run(next,turn);
  assert.equal(result.answer_routing.topic,'relationship');
  const collected=requests.find(r=>r.messages[0].content.startsWith('Collect checked evidence'));
  assert.match(collected.messages[0].content,/"topic":"relationship"/);
  assert.doesNotMatch(collected.messages[0].content,/"subject":"When will my career/);
  const follow=await run({...value,query:'And why?',history},{...reading,intent:{...intent,history_index:0}});
  assert.match(follow.toolOptions[0].query,/When will my career settle\?\nFollow-up: And why\?/);
  assert.equal(follow.result.answer_routing.timing,false);
});

test('semantic timing is used by the checked presentation plan without changing the query',()=>{
  const packet={topic:'career',assessment:{trend:'MIXED',favorable:['support'],adverse:[]},event_windows:[]};
  const original={...value,query:'Kitne arse mein professional stability aayegi?'};
  assert.equal(buildReadingPlan(original,original.query,packet,[],{timingRequested:true}).timing.status,'unavailable');
  assert.equal(buildReadingPlan({...original,query:'Why?'},original.query,packet,[],{timingRequested:false}).timing.status,'not_requested');
});

test('a bereavement disclosure with a new profession question reaches the LLM and career evidence',async()=>{
  const input={...value,query:'My wife passed away. What does my chart say about my professional prospects?'};
  const {result,requests}=await run(input,reading);
  assert.equal(result.answer_routing.topic,'career');
  assert.equal(result.answer_response_flow,'pilot_coherent_reading');
  assert.ok(requests[0].messages[0].content.startsWith('You interpret the latest utterance'));
});

test('a short explanation rechecks the old future window even without a new timing request',async()=>{
  const input={...value,query:'Why?',history:[{role:'user',text:'When will my career settle?'},{role:'assistant',text:'Perhaps 2027.'}]};
  const {result}=await run(input,{...reading,intent:{...intent,history_index:0}},
    {...env,ASTROFRIEND_PILOT_EVENT_TIMING_ENABLED:'1'});
  assert.ok(result.answer_validation.some(tag=>tag.startsWith('pilot_event_timing_')));
  assert.equal(result.answer_routing.timing,false);
});

test('another person cannot silently inherit the account profile at the actual tool boundary',async()=>{
  let executed=false;
  const execute=createTools({memory:memory(),birth:value.birth,query:'How does her professional path look?',
    semanticSubjectType:'other',reading:async()=>{executed=true;},env,signal:AbortSignal.timeout(5000)});
  await assert.rejects(execute('get_horoscope_predictions',{}),{code:'birth_details_required'});
  assert.equal(executed,false);
});

test('semantic routing remains disabled for non-pilots and other surfaces',async()=>{
  for(const patch of [{user_id:'919000000002'},{reply_surface:'pwa'},{reply_surface:'voice'}]) {
    let sawSemantic=false;
    await assert.rejects(directAnswer({...value,...patch},{env,makeMemory:()=>{throw Error('legacy');},fetchImpl:async(_url,opts)=>{
      sawSemantic=JSON.parse(opts.body).response_format?.type==='json_schema';throw Error('legacy');}}));
    assert.equal(sawSemantic,false);
  }
});

test('recorded live career explanations with chart-house labels do not become property advice',()=>{
  const reason='The strong tenth house supports your capacity to build a career. However, debilitated Saturn and Sun, along with retrograde Saturn, point to weaker career support and potential obstacles.';
  assert.equal(unrelatedReadingTopic(reason,{topic:'career'}),null);
  assert.equal(unrelatedReadingTopic('House 10 supports your ability to build a career.',{topic:'career'}),null);
  assert.equal(unrelatedReadingTopic('The 10th house supports building your professional future.',{topic:'career'}),null);
  for(const text of ['The tenth house supports buying a new home.',
    'You will build a house next year.','House 10 supports your career. You will buy a flat in 2028.'])
    assert.match(unrelatedReadingTopic(text,{topic:'career'}),/unrelated property/);
});

test('LLM-selected profile recall uses current app fields despite conflicting birth-format history',async()=>{
  const input={...value,user_name:'Neel',language:'hinglish',query:'Mera naam, DOB, birth time aur birth place kya yaad hai?',
    birth:{date:'18 October 1998',time:'07:20 AM',location_name:'Delhi'},
    history:[{role:'user',text:'My name is Example; DOB 1 January 2000; 06:35 AM; Jaipur.'},
      {role:'assistant',text:'I remember your old Jaipur details.'}]};
  const decision={route:'conversation',reply:'This old model draft must not supply the actual profile values.',
    intent:{...intent,topic:'general',scope:'profile_recall',profile_fields:['name','birth_date','birth_time','birth_place']}};
  const {result,requests,toolOptions}=await run(input,decision);
  assert.equal(requests.length,1,'Known profile facts do not need an astrology/conversation review loop');
  assert.equal(toolOptions.length,0);
  assert.match(result.reply,/Naam: Neel/u);assert.match(result.reply,/18 October 1998/u);
  assert.match(result.reply,/07:20 AM/u);assert.match(result.reply,/Delhi/u);
  assert.doesNotMatch(result.reply,/Example|2000|06:35|Jaipur|old model|verify/iu);
  assert.equal(result.answer_routing.scope,'profile_recall');
});

test('profile recall returns just requested fields and leaves absent fields missing',()=>{
  const nameOnly={...intent,topic:'general',scope:'profile_recall',profile_fields:['name']};
  const reply=selectedProfileRecall({...value,user_name:'Neel'},nameOnly);
  assert.match(reply,/Name: Neel/u);assert.doesNotMatch(reply,/1998|06:35|Jaipur/u);
  const missing=selectedProfileRecall({...value,birth:null}, {...nameOnly,profile_fields:['birth_time']});
  assert.match(missing,/not available/u);assert.doesNotMatch(missing,/06:35/u);
  assert.equal(parseSemanticDecision({route:'checked_reading',reply:'',intent:nameOnly},value),null);
  assert.equal(parseSemanticDecision({route:'conversation',reply:'Name',intent:{...nameOnly,subject:'other'}},value),null);
  assert.equal(parseSemanticDecision({route:'conversation',reply:'Name',intent:{...nameOnly,profile_fields:['name','name']}},value),null);
});
