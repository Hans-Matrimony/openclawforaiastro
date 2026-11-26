import test from 'node:test';
import assert from 'node:assert/strict';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {get_horoscope_predictions} from '../extensions/reviewed-reading/direct/assets/dev-v2/engine.mjs';
import {coherentReadingEnabled,coherentEvidencePacket,writeCoherentReading} from '../extensions/reviewed-reading/direct/pilot-coherent-reading.mjs';
import {personaInstruction} from '../extensions/reviewed-reading/direct/persona.mjs';

const chart=get_horoscope_predictions({birth_date:'3/1/2001',birth_time:'05:00',location_name:'Delhi'}).content[0].text;
const config={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',
  VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'1',ASTROFRIEND_PILOT_TOPIC_PROMPTS:'1',
  ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_USERS:'919000000001',
  ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1',ASTROFRIEND_PILOT_COHERENT_REPLIES:'1'};
const input={user_id:'919000000001',reply_surface:'whatsapp',user_gender:'male',language:'english',
  birth:{date:'2001-01-03',time:'05:00',location_name:'Delhi'},history:[],query:'When will my career settle?'};
const memory=()=>({read:async()=>[],write:async()=>assert.fail('No write requested')});
const respond=message=>new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));
const toolCall={tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]};
const answer='Yes, career progress is possible, although this chart does not establish when it will settle.\n\nThe tenth house offers support, while Saturn indicates obstacles and the current period provides limited direct career support.';

test('coherent rollout requires both switches, exact pilot identity and WhatsApp',()=>{
 assert.equal(coherentReadingEnabled(config,input),true);
 for(const [env,value] of [
  [{...config,ASTROFRIEND_PILOT_COHERENT_REPLIES:'0'},input],
  [{...config,ASTROFRIEND_PILOT_TOPIC_PROMPTS:'0'},input],
  [config,{...input,user_id:'919000000002'}],
  [config,{...input,reply_surface:'voice'}],
  [config,{...input,reply_surface:'pwa'}],
 ]) assert.equal(coherentReadingEnabled(env,value),false);
});

test('packet separates the locked assessment from tool instructions and unrelated schedules',()=>{
 const packet=coherentEvidencePacket([chart],'career');
 assert.equal(packet.topic,'career');assert.equal(packet.assessment.trend,'MIXED');
 assert.ok(packet.assessment.favorable.length);assert.ok(packet.assessment.adverse.length);
 assert.ok(packet.assessment.favorable.some(factor=>factor.kind==='house_strength' && factor.house===10 && factor.strength==='strong'));
 assert.doesNotMatch(JSON.stringify(packet),/bindu|31\/48|Venus\+Moon/);
 assert.deepEqual(packet.event_windows,[]);
 assert.doesNotMatch(JSON.stringify(packet),/EXACT window|timeline_note|current_mahadasha|2027|marriage/);
 for(const bad of [[],['broken JSON'],['{"isError":true}'],[JSON.stringify({...JSON.parse(chart),horary_number:123})]]) {
  assert.equal(coherentEvidencePacket(bad,'career'),null);
 }
 const conflict=JSON.parse(chart);conflict.birth_chart={different:'person'};
 assert.equal(coherentEvidencePacket([chart,JSON.stringify(conflict)],'career'),null);
 assert.equal(coherentEvidencePacket([chart],'education'),null);
});

async function reading({value=input,env=config,candidate=answer,reviewPass=true,remedyLookup,tools=async()=>chart,collection=toolCall}={}) {
 const captured=[];
 const result=await directAnswer(value,{env,now:()=>new Date('2026-11-26T06:00:00Z'),makeMemory:memory,
  makeTools:()=>tools,remedyLookup,
  fetchImpl:async(_url,options)=>{
   const body=JSON.parse(options.body);captured.push(body);
   const instruction=body.messages[0].content;
   if(instruction.startsWith('Collect checked evidence')) return respond(collection);
   if(instruction.startsWith('Write the complete astrology reply')) {
    const [answerPart,reasonPart='Checked reasons.',remedy='']=candidate.split('\n\n');
    return respond({content:JSON.stringify({answer:answerPart,reason:reasonPart,remedy})});
   }
   if(instruction.startsWith('Review this astrology reply')) return respond({content:JSON.stringify({evidence_ok:reviewPass,reason:reviewPass?'':'Missing adverse factor',presentation_issue:''})});
   assert.fail('Legacy draft, fallback rewrite or companion call reached: '+instruction.slice(0,80));
  }});
 return {result,captured};
}

test('one collection, one writer and one review deliver the reviewed text unchanged',async()=>{
 const {result,captured}=await reading();
 assert.equal(captured.length,3);assert.equal(result.answer_model_calls,3);
 assert.equal(result.reply,answer);assert.equal(result.answer_response_flow,'pilot_coherent_reading');
 assert.ok(result.answer_validation.includes('pilot_coherent_verified'));
 assert.doesNotMatch(result.reply,/2027|antardasha|event deadline|sahyog bhi/);
 assert.doesNotMatch(captured[0].messages[0].content,/EXACT window|# Timing answer|# Completed Reading Output Contract/);
 assert.deepEqual(captured[0].tool_choice,{type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions'}});
 for(const body of captured) assert.doesNotMatch(body.messages[0].content,/WHATSAPP SIZE OVERRIDE|35-50 words/);
 for(const body of captured.slice(1)) assert.equal(JSON.parse(body.messages.at(-1).content).max_words,150);
});

test('persona identity can be used with a dedicated delivery contract without changing default consumers',()=>{
 const ordinary=personaInstruction(input);
 assert.equal(ordinary,personaInstruction(input,{includeDeliveryPolicy:true}));
 assert.match(ordinary,/WHATSAPP SIZE OVERRIDE/);
 const dedicated=personaInstruction(input,{includeDeliveryPolicy:false});
 assert.doesNotMatch(dedicated,/WHATSAPP SIZE OVERRIDE|35-50 words/);
 assert.equal(ordinary.replace(/WHATSAPP SIZE OVERRIDE: .*?requirements\. /u,''),dedicated);
 assert.match(dedicated,/Meera/);
});

test('structured pilot preserves meaningful evidence terms and sentence punctuation through review and delivery',async()=>{
 const candidate='Career progress is possible, though obstacles remain.\n\nThe tenth house is strong; retrograde Saturn may obstruct progress—this does not establish an event date.';
 const {result,captured}=await reading({candidate});
 assert.equal(result.reply,candidate);
 assert.equal(JSON.parse(captured[2].messages.at(-1).content).proposed,candidate);
});

test('the corrected topic remains locked through collection, writer, review and final delivery',async()=>{
 const value={...input,query:'Shaadi nahi, main career ke baare mein pooch raha hoon. Job kab milegi?',
  history:[{role:'user',text:'Meri shaadi kab hogi?'},{role:'assistant',text:'Marriage in 2031.'}]};
 const {result,captured}=await reading({value});
 assert.equal(result.reply,answer);
 for(const body of captured.slice(1)) {
  const data=JSON.parse(body.messages.at(-1).content);
  assert.equal(data.checked_evidence.topic,'career');assert.doesNotMatch(data.question,/shaadi/iu);
  assert.deepEqual(data.checked_evidence.event_windows,[]);
 }
});

test('unavailable remedy references cannot replace the main astrology answer',async()=>{
 let lookups=0;
 const {result,captured}=await reading({value:{...input,query:'Will my career improve? Suggest a remedy too.'},
  remedyLookup:async()=>{lookups++;throw Error('reference service unavailable');}});
 assert.equal(lookups,1);assert.equal(result.reply,answer);assert.equal(result.answer_remedy_status,'unavailable');
 assert.deepEqual(JSON.parse(captured[1].messages.at(-1).content).remedy_references,[]);
});

test('available references reach the same answer and review without a separate remedy generation',async()=>{
 const remedyAnswer=answer+'\n\nIf you find it meaningful, a short voluntary prayer is an optional traditional practice.';
 const {result,captured}=await reading({value:{...input,query:'Will my career improve? Suggest a remedy too.'},candidate:remedyAnswer,
  remedyLookup:async()=>({status:'available',sources:[{text:'Traditional career remedy: a short voluntary prayer.',source:'synthetic reference'}]})});
 assert.equal(captured.length,3);assert.equal(result.reply,remedyAnswer);
 assert.equal(result.answer_remedy_sources,1);
 for(const body of captured.slice(1)) assert.equal(JSON.parse(body.messages.at(-1).content).remedy_references.length,1);
});

test('review repair is bounded and never publishes the rejected draft or re-enters the old loop',async()=>{
 const {result,captured}=await reading({reviewPass:false});
 assert.equal(captured.length,5);assert.ok(result.answer_validation.includes('pilot_coherent_fallback'));
 assert.doesNotMatch(result.reply,/Yes, career progress|2031|2027/);
});

test('a failed supplementary tool does not discard the available natal assessment',async()=>{
 const failed={id:'supplement',type:'function',function:{name:'mcp__VedAstro__get_current_transits',arguments:'{}'}};
 const {result,captured}=await reading({collection:{tool_calls:[...toolCall.tool_calls,failed]},
  tools:async(name)=>name.endsWith('get_current_transits')?JSON.stringify({isError:true,message:'synthetic supplementary failure'}):chart});
 assert.equal(captured.length,3);
 assert.ok(result.answer_validation.includes('pilot_coherent_verified'));
 assert.deepEqual(result.answer_reading_tools,['get_horoscope_predictions']);
});

test('an invented event date is rejected before review and never delivered',async()=>{
 const {result,captured}=await reading({candidate:'You will get a job in January 2027.'});
 assert.equal(captured.filter(body=>body.messages[0].content.startsWith('Review this astrology reply')).length,0);
 assert.ok(result.answer_validation.includes('pilot_coherent_fallback'));
 assert.doesNotMatch(result.reply,/January 2027|will get a job/);
});

test('missing birth details stay an intake rather than forcing a chart for a remedy request',async()=>{
 let calls=0;
 const result=await directAnswer({...input,birth:{},query:'When will my career settle?'},{env:config,makeMemory:memory,
  makeTools:()=>async()=>assert.fail('No confirmed profile'),fetchImpl:async()=>{calls++;return respond({content:'Please share your birth date, exact time and birthplace.'});}});
 assert.equal(calls,1);assert.match(result.reply,/birth date/);
 assert.ok(result.answer_validation.includes('pilot_birth_clarification'));
});

test('history-aware listening preserves Aarav persona and bypasses every reading stage',async()=>{
 const reply='Interview se pehle itna nervous feel karna thaka deta hai. Main sun raha hoon, aap aaram se bataiye.';
 let calls=0;
 const result=await directAnswer({...input,user_gender:'female',language:'hinglish',query:'Aaj bahut akela feel ho raha hai. Bas meri baat suno, advice mat dena.',
  history:[{role:'user',text:'Kal mera interview hai aur main nervous hoon.'}]},{env:{...config,ASTROFRIEND_CONVERSATION_MEMORY_ENABLED:'1'},
  makeMemory:()=>({read:async()=>['[personal] User has an interview tomorrow and feels nervous.'],write:async()=>assert.fail('No memory write')}),
  makeTools:()=>async()=>assert.fail('No astrology for listening'),
  fetchImpl:async(_url,options)=>{
   const body=JSON.parse(options.body);calls++;
   if(body.messages[0].content.startsWith('Review a conversational draft')) return respond({content:'{"status":"accept","issues":[]}'});
   const data=JSON.parse(body.messages.at(-1).content);
   assert.equal(data.assistant_context.name,'Aarav');assert.equal(data.saved_context.length,1);
   assert.match(body.messages[0].content,/gentle affection when welcomed/);
   return respond({content:JSON.stringify({route:'conversation',reply})});
  }});
 assert.equal(calls,2);assert.equal(result.reply,reply);assert.deepEqual(result.answer_reading_tools,[]);
 assert.equal(result.answer_conversation_route,'conversation');
});

test('negative outlook remains negative and language script failure gets one reviewed repair',async()=>{
 const packet={topic:'career',assessment:{trend:'NEGATIVE',favorable:[],adverse:['weak tenth house']},event_windows:[]};
 const outputs=[JSON.stringify({answer:'Career \u0939\u0948',reason:'Checked reason.'}),JSON.stringify({answer:'Abhi career ke sanket anukool nahi dikh rahe.',reason:'10ve ghar ki kamzori iski wajah hai.'}),'{"evidence_ok":true,"reason":"","presentation_issue":""}'];
 const events=[];let calls=0;
 const reply=await writeCoherentReading({value:{...input,language:'hinglish'},subject:input.query,packet,
  generate:async()=>{calls++;return outputs.shift();},validate:()=>null,fallback:'safe',onEvent:event=>events.push(event)});
 assert.equal(calls,3);assert.match(reply,/anukool nahi/);assert.ok(events.includes('verified'));
});

test('particular-person return packet omits unrelated marriage evidence and periods',()=>{
 const packet=coherentEvidencePacket([chart],'relationship',{question:'Meri girlfriend kab wapas aayegi?'});
 assert.equal(packet.scope,'person_choice');assert.equal(packet.assessment,null);assert.deepEqual(packet.event_windows,[]);
 assert.doesNotMatch(JSON.stringify(packet),/Jupiter|Venus|Saturn|2027|favorable|adverse/);
});

test('same mixed-assessment policy governs writing and review, with separate displayed bubbles',async()=>{
 const {captured,result}=await reading();
 for(const body of captured.slice(1)) {
  assert.match(body.messages[0].content,/Accept a qualified yes to possibility/);
  assert.match(body.messages[0].content,/do not demand the literal word mixed/);
  assert.match(body.messages[0].content,/# Current-turn response language/);
  assert.deepEqual(body.response_format,{type:'json_object'});
 }
 assert.equal(result.reply.split('\n\n').length,2);
});

test('a verified answer survives a failed style repair instead of becoming a generic fallback',async()=>{
 const first={answer:'Career progress is possible, with obstacles.',reason:'The tenth house supports progress, while Saturn indicates obstacles.'};
 const outputs=[JSON.stringify(first),JSON.stringify({evidence_ok:true,reason:'',presentation_issue:'Use less repetitive wording.'}),JSON.stringify({answer:'You will get a job tomorrow.',reason:'Invented outcome.'})];
 const events=[];
 const result=await writeCoherentReading({value:input,subject:input.query,packet:coherentEvidencePacket([chart],'career'),
  generate:async()=>outputs.shift(),validate:candidate=>candidate.includes('tomorrow')?'Unsupported event date.':null,
  fallback:'generic fallback',onEvent:event=>events.push(event)});
 assert.equal(result,first.answer+'\n\n'+first.reason);
 assert.ok(events.includes('verified_with_style_issue'));assert.ok(!events.includes('fallback'));
});

test('style repair receives the exact reviewed draft and issue instead of regenerating blindly',async()=>{
 const first={answer:'Career progress is possible, with no event date established. No event date was established.',reason:'The tenth house offers support; Saturn indicates obstacles.',remedy:''};
 const corrected={...first,answer:'Career progress is possible; these factors do not establish when.'};
 const outputs=[JSON.stringify(first),JSON.stringify({evidence_ok:true,reason:'',presentation_issue:'Timing limit repeated in answer.'}),JSON.stringify(corrected),JSON.stringify({evidence_ok:true,reason:'',presentation_issue:''})];
 const requests=[];
 const result=await writeCoherentReading({value:input,subject:input.query,packet:coherentEvidencePacket([chart],'career'),
  generate:async(instruction,data)=>{requests.push({instruction,data:JSON.parse(data)});return outputs.shift();},
  validate:()=>null,fallback:'safe'});
 assert.equal(requests.length,4);
 assert.deepEqual(requests[2].data.previous_reply,first);
 assert.equal(requests[2].data.edit_feedback,'Timing limit repeated in answer.');
 assert.equal(requests[2].data.edit_mode,'presentation_only');
 assert.match(requests[2].instruction,/minimally editing previous_reply/);
 assert.equal(result,corrected.answer+'\n\n'+corrected.reason);
 assert.equal(requests[1].data.presentation_measurements.contains_devanagari,false);
});

test('short yes/no follow-up does not inherit the earlier timing request for presentation',async()=>{
 const outputs=[JSON.stringify({answer:'Haan, career mein aage badhne ki sambhavana hai.',reason:'Dasve ghar ki mazbooti madad karti hai, par Shani rukawat dikhaata hai.'}),'{"evidence_ok":true,"reason":"","presentation_issue":""}'];
 await writeCoherentReading({value:{...input,query:'Matlab haan ya naa?',language:'hinglish'},subject:'Career kab set hoga?',packet:coherentEvidencePacket([chart],'career'),
  generate:async(_instruction,data)=>{assert.equal(JSON.parse(data).timing_requested,false);return outputs.shift();},validate:()=>null,fallback:'safe'});
});

test('numeric Hindi house suffix is normalized before factual review without changing the claim',async()=>{
 const outputs=[JSON.stringify({answer:'Shaadi ki sambhavana hai.',reason:'Guru 7वें ghar mein hai.'}),'{"evidence_ok":true,"reason":"","presentation_issue":""}'];
 const result=await writeCoherentReading({value:{...input,language:'hinglish'},subject:'Meri shaadi kab hogi?',packet:coherentEvidencePacket([chart],'marriage'),
  generate:async(instruction,data)=>{if(instruction.startsWith('Review')) assert.match(JSON.parse(data).proposed,/7ve ghar/);return outputs.shift();},
  validate:()=>null,fallback:'safe'});
 assert.equal(result,'Shaadi ki sambhavana hai.\n\nGuru 7ve ghar mein hai.');
});

test('coherent switch does not change non-pilot requests',async()=>{
 async function capture(enabled){let body;await directAnswer({...input,user_id:'919000000002'},{env:{...config,ASTROFRIEND_PILOT_COHERENT_REPLIES:enabled},makeMemory:memory,
   makeTools:()=>async()=>assert.fail('No tool before captured request'),fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);throw Error('capture');}}).catch(error=>assert.equal(error.message,'capture'));return body;}
 assert.deepEqual(await capture('1'),await capture('0'));
});
