import test from 'node:test';
import assert from 'node:assert/strict';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {get_horoscope_predictions} from '../extensions/reviewed-reading/direct/assets/dev-v2/engine.mjs';
import {pilotBirthClarification,pilotEducationBoundary} from '../extensions/reviewed-reading/direct/pilot-response-boundaries.mjs';

const chart=get_horoscope_predictions({birth_date:'3/1/2001',birth_time:'05:00',location_name:'Delhi'}).content[0].text;
const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',
  VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'1',ASTROFRIEND_PILOT_TOPIC_PROMPTS:'1',
  ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_USERS:'919000000001',
  ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1'};
const input={user_id:'919000000001',reply_surface:'whatsapp',user_gender:'male',language:'hinglish',
  birth:{date:'2001-01-03',time:'05:00',location_name:'Delhi'},history:[]};
const memory=()=>({read:async()=>[],write:async()=>{throw Error('unexpected write');}});
const response=message=>new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));
const callChart={tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]};

test('captured missing-birth statement returns intake, without a forced tool or transport error',async()=>{
 let calls=0;
 const result=await directAnswer({...input,birth:{},query:'Meri shaadi kab hogi?'},{env,makeMemory:memory,
   makeTools:()=>async()=>assert.fail('No chart without confirmed details'),
   fetchImpl:async()=>{calls++;return response({content:'I need your birth details to check this — date, exact time, and place of birth.'});},
 });
 assert.equal(calls,1);
 assert.match(result.reply,/janam tithi/);assert.match(result.reply,/janam ka exact samay/);assert.match(result.reply,/janam sthan/);
 assert.ok(result.answer_validation.includes('pilot_birth_clarification'));
 assert.deepEqual(result.answer_reading_tools,[]);
});

test('birth intake asks only for missing fields and does not override available memory',()=>{
 const partial={status:'PARTIAL',fields:{date:'2001-01-03'}};
 const text=pilotBirthClarification('Please share your birth details.',partial,'hinglish');
 assert.doesNotMatch(text,/janam tithi/);assert.match(text,/samay/);assert.match(text,/sthan/);
 assert.equal(pilotBirthClarification('Please share your birth details.',partial,'hinglish',['[birth] confirmed details']),null);
 assert.equal(pilotBirthClarification('Please share your birth details.',{status:'READY',fields:input.birth},'english'),null);
});

test('explicit marriage-to-career correction retains career evidence through final delivery',async()=>{
 let mainCalls=0,finalCalls=0;
 const checked='Job lagne ki sambhavana hai, lekin rukawatein bhi hain.\n\n10ve ghar ki majbooti sahyog deti hai, par vakri Shani atkaav la sakta hai aur maujooda dasha se career ko seedha sahyog kam hai.';
 const result=await directAnswer({...input,
   query:'Shaadi nahi, main career ke baare mein pooch raha hoon. Job kab milegi?',
   history:[{role:'user',text:'Meri shaadi kab hogi?'},{role:'assistant',text:'Shaadi ke liye 2031 se 2034 ka period bataya tha.'}],
 },{env,makeMemory:memory,makeTools:()=>async()=>chart,now:()=>new Date('2026-11-26T06:00:00Z'),
   fetchImpl:async(_url,options)=>{
     const body=JSON.parse(options.body),instruction=body.messages[0].content;
     if(instruction.startsWith('Write a natural astrology reply')){
       finalCalls++;
       const payload=JSON.parse(body.messages.at(-1).content);
       const evidence=payload.checked_evidence.map(JSON.parse);
       assert.ok(evidence.every(row=>row.verdict_signals.every(signal=>signal.area==='career')));
       return response({content:checked});
     }
     if(instruction.startsWith('Check the proposed answer'))return response({content:'{"pass":true,"reason":""}'});
     mainCalls++;return response(mainCalls===1?callChart:{content:checked});
   },
 });
 assert.ok(finalCalls>0);assert.match(result.reply,/^Job lagne/);
 assert.doesNotMatch(result.reply,/shaadi|2031|2034|meri galti/iu);
 assert.ok(result.answer_validation.includes('pilot_final_wording_verified'));
});

test('education uses a capability boundary instead of inventing an outcome from marriage signals',async()=>{
 let calls=0;
 const result=await directAnswer({...input,query:'Meri padhai aur exam ke liye chart kya kehta hai?'},{env,
   makeMemory:memory,makeTools:()=>async()=>chart,
   fetchImpl:async()=>{calls++;return response(callChart);},
 });
 assert.equal(calls,1);assert.ok(result.answer_validation.includes('pilot_topic_assessment_missing'));
 assert.match(result.reply,/padhai ya exam/);assert.doesNotMatch(result.reply,/20\d{2}|Moon|Jupiter/);
});

test('education boundary distinguishes missing capability from a failed or dedicated assessment',()=>{
 assert.equal(pilotEducationBoundary(['{"isError":true}'],'english'),null);
 assert.equal(pilotEducationBoundary([JSON.stringify({engine:'local-sweph-v2',verdict_signals:[{area:'education',trend:'MIXED'}]})],'english'),null);
 assert.match(pilotEducationBoundary([chart],'hindi'),/पढ़ाई या परीक्षा/);
});
