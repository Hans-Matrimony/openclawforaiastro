import test from 'node:test';
import assert from 'node:assert/strict';
import {asksForTiming} from '../extensions/reviewed-reading/direct/reading-intent.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {get_horoscope_predictions} from '../extensions/reviewed-reading/direct/assets/dev-v2/engine.mjs';

test('focused event-time directives preserve concept, quote and non-pilot boundaries',()=>{
 for(const text of ['Ab meri shaadi ka samay batao.','Mere ghar kharidne ka waqt bataiye.', 'मेरी शादी का समय बताओ।']) {
  assert.equal(asksForTiming(text,{exactDateRequests:true}),true,text);
  assert.equal(asksForTiming(text),false,text);
 }
 for(const text of ['Shaadi ka samay ka matlab kya hai?', 'शादी के समय का अर्थ क्या है?',
  'Meeting ka samay batao.', 'Translate "shaadi ka samay batao".', 'Meri shaadi ka samay achha tha.'])
  assert.equal(asksForTiming(text,{exactDateRequests:true}),false,text);
});

test('the captured marriage phrasing reaches the calculator and supplies its real window',async()=>{
 const user='919000000001',requests=[];
 const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',
  ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_USERS:user,
  ASTROFRIEND_PILOT_TOPIC_PROMPTS:'1',ASTROFRIEND_PILOT_COHERENT_REPLIES:'1',ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'1',ASTROFRIEND_PILOT_EVENT_TIMING_ENABLED:'1'};
 const row=get_horoscope_predictions({birth_date:'18/10/1998',birth_time:'06:35',location_name:'Jaipur, Rajasthan, India'}).content[0].text;
 const result=await directAnswer({user_id:user,reply_surface:'whatsapp',language:'hinglish',user_gender:'male',query:'Ab meri shaadi ka samay batao.',
  birth:{date:'18 October 1998',time:'06:35 AM',location_name:'Jaipur, Rajasthan, India'},history:[]},
  {env,now:()=>new Date('2026-11-27T11:50:00Z'),makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>row,
   fetchImpl:async(_url,options)=>{const body=JSON.parse(options.body);requests.push(body);const system=body.messages[0].content;
    let message;
    if(system.startsWith('Collect checked evidence'))message={tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]};
    else if(system.startsWith('Write the complete astrology reply')) {
     const payload=JSON.parse(body.messages.at(-1).content);
     assert.equal(payload.timing_requested,true);
     assert.equal(payload.checked_evidence.timing_estimate.selected.from,'2026-11');
     message={content:JSON.stringify({answer:'Shaadi ke yog November 2026 se January 2027 ke beech dikhte hain.',
      reason:'Rahu aur Budh ke daur ka sambandh shaadi se hai aur Guru ka gochar sahara deta hai; kamzor Shukra aur Shani rukawat dikhate hain.',remedy:''})};
    }else if(system.startsWith('Review this astrology reply'))message={content:'{"evidence_ok":true,"reason":"","presentation_issue":""}'};
    else assert.fail(system.slice(0,70));
    return Response.json({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]});
   }});
 assert.ok(result.answer_validation.includes('pilot_event_timing_estimated_windows'));
 assert.match(result.reply,/November 2026 se January 2027/);
 assert.equal(requests.length,3);
});
