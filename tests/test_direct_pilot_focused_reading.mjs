import test from 'node:test';
import assert from 'node:assert/strict';
import {pilotTopicPrompt,selectedTopicGuides,TOPIC_PROMPTS} from '../extensions/reviewed-reading/direct/pilot-topic-prompts.mjs';
import {buildReadingPlan} from '../extensions/reviewed-reading/direct/pilot-reading-plan.mjs';
import {focusedReadingEnabled,coherentEvidencePacket,writeCoherentReading} from '../extensions/reviewed-reading/direct/pilot-coherent-reading.mjs';
import {get_horoscope_predictions} from '../extensions/reviewed-reading/direct/assets/dev-v2/engine.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {removeTimingBoilerplate} from '../extensions/reviewed-reading/direct/event-window-evidence.mjs';
import {focusedReplyIssue,focusedReadingFallback,normalizeFocusedReadingLanguage,removeRepeatedChoiceLimit} from '../extensions/reviewed-reading/direct/focused-reading-delivery.mjs';
import {specificReturnSubject} from '../extensions/reviewed-reading/direct/pilot-bubbles.mjs';

const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',
 VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'1',ASTROFRIEND_PILOT_TOPIC_PROMPTS:'1',
 ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_USERS:'919000000001',
 ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1',ASTROFRIEND_PILOT_COHERENT_REPLIES:'1',
 ASTROFRIEND_PILOT_EVENT_TIMING_ENABLED:'1',ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'1'};
const value={user_id:'919000000001',reply_surface:'whatsapp',language:'english',user_gender:'male',
 birth:{date:'2001-01-03',time:'05:00',location_name:'Delhi'},history:[],query:'When will my career settle?'};
const now=new Date('2026-11-26T06:00:00Z');
const chart=()=>get_horoscope_predictions({birth_date:'3/1/2001',birth_time:'05:00',location_name:'Delhi'}).content[0].text;
const candidate='Career progress is possible; September to November 2027 may be a more supportive period.\n\nThe tenth house is strong, but retrograde Saturn indicates obstacles. The Venus major period supports career through its aspect; the Mars sub-period and Jupiter transit add support during that time.';
const response=message=>new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));

test('focused flow needs explicit opt-in and every existing pilot gate',()=>{
 assert.equal(focusedReadingEnabled(env,value),true);
 for(const key of ['ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED','ASTROFRIEND_PILOT_TOPIC_PROMPTS','ASTROFRIEND_PILOT_COHERENT_REPLIES','ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED','ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED'])
  assert.equal(focusedReadingEnabled({...env,[key]:'0'},value),false,key);
 for(const patch of [{user_id:'919000000002'},{user_id:'0001'},{reply_surface:'pwa'},{reply_surface:'voice'}])
  assert.equal(focusedReadingEnabled(env,{...value,...patch}),false);
 assert.equal(focusedReadingEnabled({...env,ASTROFRIEND_CONVERSATION_PROGRESS_USERS:'*'},value),false);
});

test('guide selection covers the use cases without injecting unrelated guides',()=>{
 const cases=[
  ['When will I get married?','marriage','marriage_timing'],['Meri wife kaisi hogi?','marriage','marriage_partner'],
  ['Meri shaadi mein deri kyun hai?','marriage','marriage_obstacles'],['Guna Milan score?',null,'compatibility'],
  ['Meri job kab lagegi?','career','career_job'],['मेरी पदोन्नति कब होगी?',null,'career_growth'],
  ['Should I switch my career?','career','career_change'],['Mera business kab chalega?',null,'business'],
  ['Meri financial situation kab improve hogi?','money','money'],['Should I buy a house?',null,'property'],
  ['Mere abroad jaane ke chances?',null,'abroad'],['Meri crush se baat kab hogi?','relationship','love_new'],
  ['Meri girlfriend kab wapas aayegi?','relationship','partner_return'],['My relationship has trust problems','relationship','relationship_conflict'],
  ['Meri padhai kaisi rahegi?',null,'education'],['My family relationships',null,'family'],['My health worries',null,'wellbeing'],
 ];
 for(const [question,topic,key] of cases) {
  const selected=selectedTopicGuides(question,topic??undefined);assert.ok(selected.includes(key),question);
  assert.ok(selected.length<=2,question);
 }
 assert.deepEqual(selectedTopicGuides('Shaadi nahi, main career ke baare mein pooch raha hoon. Job kab milegi?'),['career_job']);
 assert.deepEqual(selectedTopicGuides('Tell me something completely unrelated'),[]);
 const focused=pilotTopicPrompt(env,value,true,{subject:value.query,topic:'career'});
 const previous=pilotTopicPrompt({...env,ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'0'},value,true);
 assert.match(focused,/Getting a job or establishing a career/);
 assert.doesNotMatch(focused,/Whether and when marriage|Foreign travel|Compatibility or matching/);
 assert.ok(focused.length<previous.length/3);
 assert.equal(Object.keys(TOPIC_PROMPTS).length,17);
});

test('shared answer position distinguishes possibility, difficulty, unknown and another person choice',()=>{
 for(const [trend,favorable,expected]of [['POSITIVE',['support'],'affirm_possibility'],['MIXED',['support'],'affirm_possibility'],
  ['MIXED',[],'unclear'],['POSITIVE',[],'unclear'],['NEGATIVE',['support'],'unfavorable_now'],['UNKNOWN',[],'unclear']]) {
  const packet={topic:'career',assessment:{trend,favorable,adverse:['obstacle']},event_windows:[]};
  const plan=buildReadingPlan(value,value.query,packet);assert.equal(plan.outcome,expected);
  assert.deepEqual(plan.reasons.opposing,['obstacle']);assert.equal(plan.timing.status,'unavailable');
 }
 const person=buildReadingPlan(value,'When will my girlfriend return?',{topic:'relationship',scope:'person_choice',assessment:null,event_windows:[]});
 assert.equal(person.outcome,'person_choice_unknown');assert.equal(person.timing.status,'person_choice_unknown');
 assert.deepEqual(person.reasons,{supporting:[],opposing:[]});
});

test('short follow-ups retain the subject without reintroducing dates or a repeated verdict',()=>{
 const packet={topic:'career',assessment:{trend:'MIXED',favorable:['career support'],adverse:['obstacle']},event_windows:[{from:'2027-09',to:'2027-11'}]};
 const yesNo=buildReadingPlan({...value,query:'Matlab haan ya naa?'},value.query,packet);
 assert.equal(yesNo.topic,'career');assert.equal(yesNo.answer_intent,'assessment');assert.equal(yesNo.timing.status,'not_requested');
 assert.equal(yesNo.guides[0].key,'career_job');
 const why=buildReadingPlan({...value,query:'Aisa kyun keh rahe ho?'},value.query,packet);
 assert.equal(why.answer_intent,'explain_previous_assessment');assert.equal(why.delivery.answer_first,false);
 const timed=buildReadingPlan(value,value.query,packet,[{text:'Synthetic optional prayer'}]);
 assert.deepEqual(timed.timing.windows,packet.event_windows);assert.equal(timed.remedy,'optional_from_supplied_references');
 assert.equal(yesNo.remedy,'omit');
});

test('a rejected why writer falls back to checked reasons rather than repeating the verdict',()=>{
 const packet=coherentEvidencePacket([chart()],'career',{focused:true});
 const input={...value,query:'Aisa kyun?',language:'hinglish'};
 const plan=buildReadingPlan(input,'Mera career kaisa rahega?',packet);
 plan.outcome='unfavorable_now';
 const reply=focusedReadingFallback(plan,input);
 assert.equal(plan.answer_intent,'explain_previous_assessment');
 assert.doesNotMatch(reply,/Kundli mein abhi|career mein pragati ke raaste|20\d{2}/u);
 assert.match(reply,/Shani|Surya/u);
 assert.equal(focusedReplyIssue(reply,plan),null);
});

test('missing timing fallback addresses the asked period without calculation jargon or a present-day forecast',()=>{
 const packet={topic:'career',assessment:{trend:'NEGATIVE',favorable:[{kind:'house_strength',house:10,strength:'strong'}],
  adverse:['Saturn Debilitated','Saturn retrograde','Sun Debilitated']},event_windows:[]};
 for(const [language,query,scope] of [
  ['hinglish','Agle saal stable job ke chances kaise hain?',/Aapke poochhe samay/u],
  ['english','Will my job be stable next year?',/period you asked about/u],
  ['hindi','अगले साल नौकरी कैसी रहेगी?',/जिस समय के बारे में पूछा/u],
 ]) {
  const input={...value,language,query},plan=buildReadingPlan(input,query,packet,[],{timingRequested:true});
  const reply=focusedReadingFallback(plan,input);
  assert.match(reply,scope);
  assert.match(reply,/naukri milne|getting a job|नौकरी मिलने/u);
  assert.doesNotMatch(reply,/ganana|calculation|गणना|currently|\babhi\b|अभी|20\d{2}/iu);
  assert.equal(focusedReplyIssue(reply,plan),null);
  assert.equal(reply.split('\n\n').length,2);
  assert.equal((reply.match(/Shani|Saturn|शनि/gu)??[]).length,1);
  assert.match(reply,/neech.*vakri|debilitated and retrograde|नीच.*वक्री/u);
 }
});

test('captured why repetition uses checked reasons after review without another generation round',async()=>{
 const input={...value,language:'hinglish',query:'Aapne aisa kyun bola? Kaunsi cheez support kar rahi hai aur rukawat kya hai?'};
 const packet={topic:'career',assessment:{trend:'NEGATIVE',favorable:[{kind:'house_strength',house:10,strength:'strong'}],
  adverse:['Saturn Debilitated','Saturn retrograde','Sun Debilitated']},event_windows:[]};
 const draft={answer:'Career mein stable job ke chances abhi challenging dikhte hain, halanki 10ve ghar ki mazboot sthiti career ko support karti hai.',
  reason:'Shani ki neech sthiti aur vakri hona career ke natijon mein atkaav dikhata hai. Neech Surya bhi ek kamzor pehlu hai.',remedy:'',follow_up:'Aap kis field mein stable job dhoondh rahe hain?'};
 const events=[],requests=[];
 const reply=await writeCoherentReading({value:input,subject:value.query,packet,focused:true,continueConversation:true,
  generate:async(system,data)=>{
   requests.push({system,data:JSON.parse(data)});
   if(requests.length===1)return JSON.stringify(draft);
   assert.equal(requests.length,2,'No repeat generation for a checked explanation');
   return JSON.stringify({evidence_ok:true,reason:'',presentation_issue:'WHY answer repeats the verdict before the explanation.'});
  },validate:()=>null,fallback:'safe',onEvent:event=>events.push(event)});
 assert.equal(requests.length,2);assert.match(reply,/^Shani/u);assert.match(reply,/Surya|10ve/u);
 assert.doesNotMatch(reply,/stable job ke chances|challenging|abhi|20\d{2}/u);
 assert.ok(reply.endsWith(draft.follow_up));
 assert.ok(events.includes('checked_explanation'));assert.ok(!events.includes('verified_with_style_issue'));
 assert.match(requests[0].system,/answer field starts with the checked reason/u);
});

test('a valid why answer keeps its contextual follow-up and avoids the checked explanation fallback',async()=>{
 const input={...value,language:'english',query:'Why did you say that?'};
 const packet={topic:'career',assessment:{trend:'MIXED',favorable:['Saturn house 10 drishti'],adverse:[]},event_windows:[]};
 const draft={answer:'Saturn aspects the tenth house, supporting career progress.',reason:'That is the checked basis for the earlier assessment.',remedy:'',follow_up:'Which role are you considering?'};
 const outputs=[JSON.stringify(draft),JSON.stringify({evidence_ok:true,reason:'',presentation_issue:''})];
 const reply=await writeCoherentReading({value:input,subject:value.query,packet,focused:true,continueConversation:true,
  generate:async()=>outputs.shift(),validate:()=>null,fallback:'safe'});
 assert.equal(reply,[draft.answer,draft.reason,draft.follow_up].join('\n\n'));
});

test('a style fallback cannot drop a checked factor it cannot express',async()=>{
 const input={...value,language:'english',query:'Why did you say that?'};
 const packet={topic:'career',assessment:{trend:'MIXED',favorable:[{kind:'house_strength',house:10,strength:'strong'}],
  adverse:['A checked condition not supported by the fallback renderer']},event_windows:[]};
 const draft={answer:'The tenth house supports progress.',reason:packet.assessment.adverse[0]+'.',remedy:''};
 const outputs=[JSON.stringify(draft),JSON.stringify({evidence_ok:true,reason:'',presentation_issue:'Use simpler wording.'})];
 const events=[];
 const reply=await writeCoherentReading({value:input,subject:value.query,packet,focused:true,
  generate:async()=>{if(!outputs.length)throw Error('Synthetic style editor unavailable');return outputs.shift();},
  validate:()=>null,fallback:'safe',onEvent:event=>events.push(event)});
 assert.equal(reply,[draft.answer,draft.reason].join('\n\n'));
 assert.ok(!events.includes('checked_explanation'));assert.ok(events.includes('verified_with_style_issue'));
});

test('missing timing with a reviewed certainty caveat uses natural checked wording and retains its question',async()=>{
 const input={...value,query:'Agle saal stable job ke yog?',language:'hinglish'};
 const packet={topic:'career',assessment:{trend:'NEGATIVE',favorable:[{kind:'house_strength',house:10,strength:'strong'}],
  adverse:['Saturn Debilitated','Saturn retrograde','Sun Debilitated',{kind:'active_period_link',linked:false}]},event_windows:[]};
 const draft={answer:'Agle saal pakka haan nahi keh sakti. Kul career sanket kamzor hain.',
  reason:'Dasva ghar mazboot hai. Shani neech aur vakri hain. Surya bhi neech hain.',remedy:'',follow_up:'Aap kis tarah ka kaam dhoondh rahe hain?'};
 const outputs=[JSON.stringify(draft),JSON.stringify({evidence_ok:true,reason:'',presentation_issue:'Remove the certainty-focused caveat.'})];
 const events=[];
 const reply=await writeCoherentReading({value:input,subject:input.query,packet,focused:true,continueConversation:true,timingRequested:true,
  generate:async()=>{assert.ok(outputs.length,'No further edit round');return outputs.shift();},
  validate:()=>null,fallback:'safe',onEvent:event=>events.push(event)});
 assert.doesNotMatch(reply,/pakka haan|ganana|calculation/u);
 assert.match(reply,/Aapke poochhe samay/u);assert.ok(reply.endsWith(draft.follow_up));
 assert.ok(events.includes('checked_presentation'));
});

test('why fallback repairs only the closing question and reviews the final displayed explanation',async()=>{
 for(const invalidClosing of [false,true]) {
  const input={...value,query:'Why did you say that?',language:'english'};
  const packet={topic:'career',assessment:{trend:'NEGATIVE',favorable:[{kind:'house_strength',house:10,strength:'strong'}],adverse:['Saturn retrograde']},event_windows:[]};
  const draft={answer:'Saturn is retrograde.',reason:'The tenth house offers support.',remedy:'',follow_up:'When will your financial savings improve?'};
  const closing=invalidClosing?'When will your financial savings improve?':'What change would you most like in your work?';
  const outputs=[JSON.stringify(draft),JSON.stringify(draft),JSON.stringify({follow_up:closing}),JSON.stringify({evidence_ok:true,reason:'',presentation_issue:''})];
  const requests=[],events=[];
  const reply=await writeCoherentReading({value:input,subject:value.query,packet,focused:true,continueConversation:true,
   generate:async(system,data)=>{requests.push({system,data:JSON.parse(data)});return outputs.shift();},
   validate:()=>null,fallback:'safe',onEvent:event=>events.push(event)});
  assert.match(reply,/^Saturn is retrograde/u);assert.doesNotMatch(reply,/savings/u);
  assert.match(requests[2].system,/Write only one contextual closing question/u);
  assert.equal(requests[2].data.completed_explanation,focusedReadingFallback(buildReadingPlan(input,value.query,packet),input));
  if(invalidClosing) {assert.equal(requests.length,3);assert.doesNotMatch(reply,/\?/u);}
  else {assert.equal(requests.length,4);assert.ok(reply.endsWith(closing));assert.equal(requests[3].data.proposed,reply);assert.ok(events.includes('fallback_followup_verified'));
   assert.match(requests[3].system,/Review only the added conversational closing question/u);
   assert.match(requests[3].system,/Do not demand a new prediction/u);
   assert.ok(!Object.hasOwn(requests[3].data,'checked_evidence'));
   assert.equal(requests[3].data.completed_explanation,requests[2].data.completed_explanation);
  }
 }
});

test('a timing fallback also repairs its missing closing without changing checked chart factors',async()=>{
 const input={...value,query:'Agle saal stable job ke yog?',language:'hinglish'};
 const packet={topic:'career',assessment:{trend:'NEGATIVE',favorable:[{kind:'house_strength',house:10,strength:'strong'}],adverse:['Saturn retrograde']},event_windows:[]};
 const outputs=['{}','{}',JSON.stringify({follow_up:'Aap abhi kis tarah ka kaam dhoondh rahe hain?'}),JSON.stringify({evidence_ok:true,reason:'',presentation_issue:''})];
 const events=[];
 const reply=await writeCoherentReading({value:input,subject:input.query,packet,focused:true,continueConversation:true,timingRequested:true,
  generate:async()=>{assert.ok(outputs.length,'Only one closing generation and one review');return outputs.shift();},
  validate:()=>null,fallback:'safe',onEvent:event=>events.push(event)});
 assert.match(reply,/Aapke poochhe samay/u);assert.match(reply,/Shani.*vakri|Vakri Shani/u);
 assert.ok(reply.endsWith('Aap abhi kis tarah ka kaam dhoondh rahe hain?'));
 assert.ok(events.includes('fallback_followup_verified'));
});

async function run({input=value,config=env,draft=candidate,review='{"evidence_ok":true,"reason":"","presentation_issue":""}'}={}) {
 const requests=[];
 const result=await directAnswer(input,{env:config,now:()=>now,makeMemory:()=>({read:async()=>[],write:async()=>assert.fail('No writes')}),
  makeTools:()=>async()=>chart(),fetchImpl:async(_url,options)=>{
   const body=JSON.parse(options.body);requests.push(body);const instruction=body.messages[0].content;
   if(instruction.startsWith('You interpret the latest utterance'))return response({content:'{"route":"checked_reading","reply":""}'});
   if(instruction.startsWith('Collect checked evidence'))return response({tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]});
   if(instruction.startsWith('Write the complete astrology reply')) {const [answer,reason='Checked explanation.']=draft.split('\n\n');return response({content:JSON.stringify({answer,reason,remedy:''})});}
   if(instruction.startsWith('Review this astrology reply'))return response({content:typeof review==='function'?review(body):review});
   return response({content:'Please share your birth date, exact time and birthplace.'});
  }});
 return {result,requests};
}

test('short misspelled career question after bereavement selects current career evidence instead of a repeated clarification',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const input={...value,language:'hinglish',query:'Aage ka carrer',history:[
  {role:'user',text:'My wife passed away last month.'},
  {role:'assistant',text:'I am sorry for your loss.'},
  {role:'user',text:'Dusra shaadi kub Tak'},
 ]};
 const draft='Career mein pragati ke yog hain, lekin rukawatein bhi dikh rahi hain.\n\nDasva ghar strong hai. Shukra sahara dete hain; vakri Shani se kaam mein atkaav aa sakta hai.';
 const {result,requests}=await run({input,draft});
 assert.equal(result.answer_response_flow,'pilot_coherent_reading');
 assert.doesNotMatch(result.reply,/Shayad|birth details|shaadi|wife|recover|2029|2032/iu);
 const writer=requests.find(body=>body.messages[0].content.startsWith('Write the complete astrology reply'));
 assert.ok(writer,'Current career must reach the checked reading writer');
 assert.equal(JSON.parse(writer.messages.at(-1).content).reading_plan.topic,'career');
});

test('focused end-to-end flow shares the same checked plan and guide with no additional model stage',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const {result,requests}=await run();assert.equal(result.reply,candidate);assert.equal(requests.length,3);
 assert.match(requests[0].messages[0].content,/Getting a job or establishing a career/);
 assert.doesNotMatch(requests[0].messages[0].content,/Whether and when marriage/);
 const writer=JSON.parse(requests[1].messages.at(-1).content),reviewer=JSON.parse(requests[2].messages.at(-1).content);
 assert.deepEqual(reviewer.reading_plan,writer.reading_plan);assert.deepEqual(reviewer.checked_evidence,writer.checked_evidence);
 assert.equal(writer.reading_plan.outcome,'affirm_possibility');
 assert.equal(writer.reading_plan.timing.windows[0].from,'2027-09');assert.equal(writer.reading_plan.timing.windows[0].to,'2027-11');
 assert.equal(writer.reading_plan.guides[0].key,'career_job');assert.equal(reviewer.proposed,result.reply);
 assert.match(requests[2].messages[0].content,/do not independently choose another verdict/iu);
 assert.equal(result.reply.split('\n\n').length,2);
});

test('a Devanagari career request reaches its focused checked dates rather than an unscoped legacy reading',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const draft='आपकी नौकरी लगने के योग सितंबर 2027 से नवंबर 2027 के बीच बनते हैं।\n\nकरियर का दसवाँ भाव मजबूत है। शुक्र और मंगल की अवधि तथा गुरु का गोचर सहारा देते हैं। वक्री शनि से नतीजों में अटकाव दिखता है।';
 const {result,requests}=await run({input:{...value,language:'hindi',query:'मेरी नौकरी कब लगेगी? कारण भी सरल हिंदी में बताइए।'},draft});
 assert.equal(result.answer_response_flow,'pilot_coherent_reading');
 const writer=requests.find(body=>body.messages[0].content.startsWith('Write the complete astrology reply'));
 const payload=JSON.parse(writer.messages.at(-1).content);
 assert.equal(payload.reading_plan.topic,'career');
 assert.equal(payload.reading_plan.timing.status,'supplied_window');
 assert.equal(payload.reading_plan.guides[0].key,'career_job');
 assert.equal(result.reply,draft);
 assert.doesNotMatch(result.reply,/शादी|marriage|birth details/iu);
});

test('a declined old topic cannot replace promotion and a failed writer still honors current English',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const input={...value,language:'hinglish',query:'Meri promotion ka agla samay kab dikh raha hai? Please answer in English this time, with the dates first and the reasons next. Do not discuss marriage.',
  history:[{role:'user',text:'Meri shaadi ke yog kaise hain?'}]};
 const before=structuredClone(input);
 const {result,requests}=await run({input,review:'{"evidence_ok":false,"reason":"Synthetic review rejection","presentation_issue":""}'});
 assert.match(result.reply,/September 2027 to November 2027/);
 assert.doesNotMatch(result.reply,/shaadi|marriage|2031|2034|\bhai\b|\bmein\b|[\u0900-\u097f]/iu);
 assert.ok(result.answer_validation.includes('pilot_coherent_fallback'));
 const payload=JSON.parse(requests.find(body=>body.messages[0].content.startsWith('Write the complete astrology reply')).messages.at(-1).content);
 assert.equal(payload.reading_plan.topic,'career');
 assert.deepEqual(input,before);
});

test('captured finance vocabulary is translated before review without losing condition, negation or quoted words',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const draft='Aapki income aur savings ke yog dikhte hain, lekin kuch atkaav bhi hain.\n\nDoosra aur gyarahva ghar mazboot hain. Ketu, combust Budh aur retrograde Guru rukawat dikhate hain.';
 const {result,requests}=await run({input:{...value,language:'hinglish',query:'Meri income aur savings ke yog samjhaiye.'},draft});
 assert.match(result.reply,/ast Budh aur vakri Guru/);
 assert.doesNotMatch(result.reply,/combust|retrograde/iu);
 const review=requests.find(body=>body.messages[0].content.startsWith('Review this astrology reply'));
 assert.equal(JSON.parse(review.messages.at(-1).content).proposed,result.reply);
 const text='Budh combust nahi hai. "combust" `retrograde` https://example.test/combust';
 assert.equal(normalizeFocusedReadingLanguage(text,{language:'hinglish'}),
  'Budh ast nahi hai. "combust" `retrograde` https://example.test/combust');
 assert.equal(normalizeFocusedReadingLanguage(text,{language:'english'}),text);
});

test('a live finance style repair cannot introduce uncalculated fluctuations even when a reviewer would accept it',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const draft='Aapki income aur savings ke yog dikhte hain, lekin utar-chadhav reh sakta hai.\n\nDoosra aur gyarahva ghar mazboot hain. Ketu, ast Budh aur vakri Guru rukawat dikhate hain.';
 const {result,requests}=await run({input:{...value,language:'hinglish',query:'Meri income aur savings ke yog samjhaiye.'},draft});
 assert.doesNotMatch(result.reply,/utar.chadhav|fluctuat/iu);
 assert.match(result.reply,/Budh|Guru/);
 assert.ok(result.answer_validation.includes('pilot_coherent_fallback'));
 assert.equal(requests.filter(body=>body.messages[0].content.startsWith('Review this astrology reply')).length,0);
 const plan={topic:'money',reasons:{supporting:['strong house'],opposing:['obstacles']}};
 for(const correction of ['These factors do not establish income fluctuations.',
  'This does not mean fluctuations.','Income ke utar-chadhav ka sanket nahi mila.',
  'The user asked about "income fluctuations"; the supplied factors indicate obstacles.'])
  assert.equal(focusedReplyIssue(correction,plan),null);
 assert.ok(focusedReplyIssue('There is no supplied evidence for fluctuations, but your income will fluctuate.',plan));
});

test('conflicting live reviewer feedback cannot discard the checked career dates after a topic correction',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 let reviews=0;
 const {result,requests}=await run({input:{...value,language:'hinglish',
  query:'Shaadi nahi, main career ke baare mein pooch raha hoon. Job kab milegi?',history:[{role:'user',text:'Meri shaadi kab hogi?'}]},
  review:body=>{
   const plan=JSON.parse(body.messages.at(-1).content).reading_plan;
   assert.equal(plan.reasons.period_roles.find(period=>period.planet==='Mars').supports_topic,true);
   assert.deepEqual(plan.reasons.period_roles.find(period=>period.planet==='Mars').owns_houses,[6]);
   return JSON.stringify({evidence_ok:false,reason:++reviews===1?'Mangal support is missing from evidence.':'Mars and its sixth-house link were omitted.',presentation_issue:''});
  }});
 assert.equal(reviews,2);assert.equal(requests.length,5);
 assert.match(result.reply,/September 2027 se November 2027/u);
 assert.doesNotMatch(result.reply,/samay tay nahi|pakki tareekh|shaadi|marriage/iu);
 assert.match(result.reply,/Mangal ki antardasha/u);
 assert.ok(result.answer_validation.includes('pilot_coherent_fallback'));
});

test('focused education and abroad readings use their own returned house evidence and no unrelated assessment',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 for(const [topic,query,houses,draft]of [
  ['education','What does my chart indicate for my studies and exams?',[4,5,9],
   'Your chart indicates potential for progress in studies.\n\nThe fourth, fifth and ninth houses have strong natal strength indicators.'],
  ['abroad','Does my chart indicate overseas travel?',[9,12],
   'Your chart indicates potential for overseas travel.\n\nHouse 9 is strong, while house 12 has mixed natal strength indicators.'],
 ]) {
  const {result,requests}=await run({input:{...value,query},draft});
  assert.equal(result.reply,draft);assert.equal(requests.length,3);
  const evidence=JSON.parse(requests[1].messages.at(-1).content).checked_evidence;
  assert.equal(evidence.topic,topic);assert.equal(evidence.assessment.method,'returned-natal-house-strength-summary-v1');
  assert.equal(evidence.active_period,undefined);
  assert.deepEqual([...evidence.assessment.favorable,...evidence.assessment.adverse,...evidence.assessment.neutral].map(f=>f.house).sort((a,b)=>a-b),houses);
  assert.deepEqual(evidence.event_windows,[]);
  assert.doesNotMatch(JSON.stringify(evidence),/career|marriage/u);
 }
 const raw=JSON.parse(chart());delete raw.birth_chart.ashtakavarga_house_bindus.house_5;
 assert.equal(coherentEvidencePacket([JSON.stringify(raw)],'education',{focused:true}),null);
 assert.equal(coherentEvidencePacket([chart()],'education'),null);
 assert.equal(coherentEvidencePacket([chart()],'abroad'),null);
});

test('captured education period inventory is rejected before review and cannot survive as a style-only issue',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const draft='Aapki padhai aur exams ke liye chart mein anukool sanket hain; academic progress ke yog dikhte hain.\n\nPadhai aur buniyadi learning se jude chauthe ghar, buddhi aur exams se jude paanchve ghar, aur uchch shiksha se jude nauve ghar ki sthiti mazboot hai. Venus ki mahadasha aur Moon ki antardasha chal rahi hai.';
 const {result,requests}=await run({input:{...value,language:'hinglish',query:'Meri padhai aur exam ke liye chart kya kehta hai?'},draft});
 assert.doesNotMatch(result.reply,/Venus|Moon|dasha|disclaimer/iu);
 assert.match(result.reply,/padhai ke yog/u);
 assert.ok(result.answer_validation.includes('pilot_coherent_fallback'));
 assert.equal(requests.filter(body=>body.messages[0].content.startsWith('Review this astrology reply')).length,0);
 const packet=coherentEvidencePacket([chart()],'education',{focused:true});
 const asked=buildReadingPlan({...value,query:'Meri padhai par current dasha ka kya asar hai?'},'Meri padhai',packet);
 assert.equal(asked.period_context_requested,true);assert.equal(focusedReplyIssue(draft,asked),null);
 const calls=[];
 const reply=await writeCoherentReading({value:{...value,query:'Meri padhai par current dasha ka kya asar hai?'},subject:'Meri padhai',packet,focused:true,
  generate:async(instruction,payload)=>{calls.push(JSON.parse(payload));return instruction.startsWith('Review')?'{"evidence_ok":true,"reason":"","presentation_issue":""}':JSON.stringify({answer:'Your chart indicates potential for studies.',reason:'The fourth house is strong. Venus major period and Moon sub-period are active.',remedy:''});},validate:()=>null,fallback:'unused'});
 assert.match(reply,/Venus major period/);assert.deepEqual(calls[0].checked_evidence.active_period,packet.active_period);
 assert.deepEqual(calls[0].checked_evidence,calls[1].checked_evidence);
});

test('fallback groups period and transit support while preserving dates and pressure in all languages',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const {requests}=await run();const plan=JSON.parse(requests[1].messages.at(-1).content).reading_plan;
 for(const lang of ['hinglish','english','hindi']) {
  const reply=focusedReadingFallback(plan,{language:lang});
  assert.equal(focusedReplyIssue(reply,plan),null);
  if(lang==='hinglish') {
   assert.match(reply,/September 2027 se November 2027/);
   assert.match(reply,/Shukra ki mahadasha, Mangal ki antardasha aur Guru ka gochar/);
   assert.equal((reply.match(/sahara/gu)??[]).length,1);
   assert.match(reply,/Vakri Shani rukawat/);
  } else if(lang==='english')assert.match(reply,/Venus's major period, Mars's sub-period and Jupiter's transit/);
  else assert.match(reply,/शुक्र की महादशा, मंगल की अंतर्दशा और गुरु का गोचर/);
  const pressured=structuredClone(plan);pressured.reasons.period_roles[1].pressure=true;
  pressured.reasons.window_basis.transit.saturn_pressure_houses=[10];
  const adverse=focusedReadingFallback(pressured,{language:lang});
  assert.match(adverse,lang==='english'?/Mars's sub-period indicates pressure/:lang==='hindi'?/मंगल की अंतर्दशा दबाव/:/Mangal ki antardasha dabav/);
  assert.match(adverse,lang==='english'?/Saturn's pressure continues/:lang==='hindi'?/शनि का दबाव भी जारी/:/Shani ka dabav bhi jaari/);
 }
});

test('model approval cannot publish overstated good chances, and the safe answer retains a direct conclusion',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const {result,requests}=await run({input:{...value,query:'Kya meri job lagne ke chances achhe hain? Seedha batao.',language:'hinglish'},
  draft:'Haan, job lagne ki sambhavana achhi hai.\n\nCareer ka ghar mazboot hai, lekin vakri Shani rukawat dikhata hai.'});
 assert.doesNotMatch(result.reply,/sambhavana achhi|good chances|high chance/iu);
 assert.match(result.reply,/naukri milne ke yog/u);
 assert.equal(requests.filter(body=>body.messages[0].content.startsWith('Review this astrology reply')).length,0);
 for(const text of ['High chances of a job.','Job lagne ki sambhavana achhi hai.','नौकरी मिलने की संभावना अच्छी है।'])
  assert.ok(focusedReplyIssue(text,{scope:'natal_outlook'}),text);
 assert.equal(focusedReplyIssue('The tenth house is strong; career progress is possible.',{scope:'natal_outlook'}),null);
});

test('limited house indicators cannot become a blanket obstacle-free claim even with model approval',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const {result,requests}=await run({input:{...value,language:'hinglish',query:'Meri padhai aur exam ke liye chart kya kehta hai?'},
  draft:'Aapki padhai aur exam ke liye chart ke sanket positive hain; academic progress ke yog dikhte hain.\n\nPadhai, samajh aur higher learning se jude chart ke ghar mazboot hain. Koi khaas rukawat chart mein nahi dikhayi gayi.'});
 const plan=JSON.parse(requests[1].messages.at(-1).content).reading_plan;
 assert.equal(plan.assessment_method,'returned-natal-house-strength-summary-v1');
 assert.doesNotMatch(result.reply,/koi khaas rukawat|no significant obstacles/iu);
 assert.match(result.reply,/padhai ke yog|ghar ki sthiti mazboot/u);
 assert.ok(result.answer_validation.includes('pilot_coherent_fallback'));
 for(const text of ['There are no significant obstacles in your chart.','Your chart is obstacle-free.','Only favorable factors appear.',
  'Koi khaas rukawat chart mein nahi dikhayi gayi.','कुंडली में कोई खास रुकावट नहीं दिखती।'])assert.ok(focusedReplyIssue(text,plan),text);
 for(const text of ['The fourth house is strong.','Padhai ke sanket achhe hain.','The twelfth house has mixed indicators.'])assert.equal(focusedReplyIssue(text,plan),null,text);
 assert.equal(focusedReplyIssue('No significant obstacles.',{...plan,assessment_method:null}),null);
});

test('captured mixed abroad indicator cannot acquire an unsupported difficulty even with model approval',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const input={...value,language:'hinglish',query:'Kya mere abroad jaane ke chances hain?'};
 const draft='Haan, kundli mein abroad jaane ke yog dikhte hain.\n\n9th house mazboot hai, jo door ke safar aur videsh se judey maukon ko sahara deta hai. 12th house mixed hai, isliye videsh se judi sthitiyan poori tarah seedhi nahi dikh rahi hain.';
 const {result,requests}=await run({input,draft});
 const plan=JSON.parse(requests[1].messages.at(-1).content).reading_plan;
 assert.deepEqual(plan.reasons.opposing,[]);assert.equal(plan.reasons.neutral[0].strength,'mixed');
 assert.ok(result.answer_validation.includes('pilot_coherent_fallback'));
 assert.doesNotMatch(result.reply,/seedhi nahi|rukawat|badha|difficult|delay/iu);
 assert.match(result.reply,/12ve ghar ki sthiti mili-juli hai/);
 assert.equal(requests.filter(body=>body.messages[0].content.startsWith('Review this astrology reply')).length,0);
 for(const text of [draft,'The twelfth house is mixed, so overseas circumstances will not be entirely straightforward.',
  'Mixed indicators mean delays abroad.','12ve ghar ke karan rukawat aa sakti hai.','बारहवें घर के मिले-जुले संकेत विदेश जाने में देरी दिखाते हैं।'])
  assert.ok(focusedReplyIssue(text,plan),text);
 for(const text of ['The ninth house is strong; the twelfth has mixed indicators.',
  'A mixed indicator does not by itself imply obstacles.','Mixed ka matlab rukawat nahi hai.',
  '12va ghar mixed hai—yeh apne aap mein rukawat ka sanket nahi hai.',
  'मिले-जुले संकेत का मतलब रुकावट नहीं है।','You asked about “delays”; the twelfth house has mixed indicators.'])
  assert.equal(focusedReplyIssue(text,plan),null,text);
 assert.ok(focusedReplyIssue('Mixed does not imply obstacles, but overseas circumstances will not be straightforward.',plan));
 assert.equal(focusedReplyIssue('A weak twelfth house indicates difficulty.',{...plan,reasons:{...plan.reasons,opposing:[{kind:'house_strength',house:12,strength:'weak'}]}}),null);
});

test('live neutral correction is translated naturally before review without changing its negation',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const draft='Haan, aapke videsh jaane ke yog dikhte hain.\n\n9va ghar mazboot hai. 12ve ghar ke sanket mixed hain; iska matlab apne aap mein rukawat nahi hai.';
 const {result,requests}=await run({input:{...value,language:'hinglish',query:'Kya mere abroad jaane ke yog hain?'},draft});
 assert.equal(result.reply,draft.replace('sanket mixed hain','sanket mile-jule hain'));
 assert.equal(JSON.parse(requests.at(-1).messages.at(-1).content).proposed,result.reply);
 assert.equal(normalizeFocusedReadingLanguage('"12th house mixed hai" 12th house mixed hai.',{language:'hinglish'}),'"12th house mixed hai" 12ve ghar ke sanket mile-jule hain.');
 assert.equal(normalizeFocusedReadingLanguage('12va ghar mixed hai.',{language:'hinglish'}),'12ve ghar ke sanket mile-jule hain.');
 assert.equal(normalizeFocusedReadingLanguage('12th house mixed hai.',{language:'english'}),'12th house mixed hai.');
});

test('hard dismissal and exact-date request use career evidence and its calculated range',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const input={...value,language:'hinglish',query:'Shaadi ki baat chhodiye. Job ki exact date batao aur yeh bhi samjhao ki Shani rukawat dikha raha hai toh career ke yog kaise hain.',
  history:[{role:'user',text:'Meri shaadi kab hogi?'},{role:'assistant',text:'November 2027 se February 2028.'}]};
 const {result,requests}=await run({input,draft:candidate});
 assert.equal(result.reply,candidate);
 for(const request of requests.slice(1)) {
  const payload=JSON.parse(request.messages.at(-1).content);
  assert.equal(payload.reading_plan.topic,'career');assert.equal(payload.checked_evidence.topic,'career');
  assert.equal(payload.reading_plan.timing.status,'supplied_window');assert.equal(payload.timing_requested,true);
  assert.equal(payload.reading_plan.timing.windows[0].from,'2027-09');
  assert.doesNotMatch(payload.question,/Shaadi/iu);
 }
 assert.doesNotMatch(requests[0].messages[0].content,/Whether and when marriage/);
});

test('pronoun return question inherits only the latest user relationship subject',()=>{
 const query='Kya woh wapas aayegi?';
 const history=[{role:'user',text:'Meri girlfriend se breakup hua.'}];
 assert.equal(specificReturnSubject(query,history),'girlfriend return: '+query);
 assert.equal(specificReturnSubject(query,[...history,{role:'user',text:'Mera career kab set hoga?'}]),query);
 assert.equal(specificReturnSubject(query,[{role:'assistant',text:'Your girlfriend will return.'}]),query);
 assert.equal(specificReturnSubject('Mera refund wapas kab aayega?',history),'Mera refund wapas kab aayega?');
});

test('focused Hindi return subjects preserve person-choice scope without borrowing across topics or refunds',()=>{
 const query='मेरी गर्लफ्रेंड लौटेगी या नहीं? कुंडली से स्पष्ट हाँ या ना बताइए।';
 assert.equal(specificReturnSubject(query),query);
 assert.equal(specificReturnSubject(query,[],{multilingual:true}),'relationship partner return: '+query);
 const pronoun='वह कब वापस आएगी?';
 const history=[{role:'user',text:'मेरी गर्लफ्रेंड से बात नहीं हो रही है।'}];
 assert.match(specificReturnSubject(pronoun,history,{multilingual:true}),/^relationship partner return:/);
 assert.equal(specificReturnSubject(pronoun,[...history,{role:'user',text:'मेरा करियर बताइए।'}],{multilingual:true}),pronoun);
 assert.equal(specificReturnSubject(pronoun,[{role:'assistant',text:'मेरी गर्लफ्रेंड लौटेगी।'}],{multilingual:true}),pronoun);
 for(const refund of ['मेरे पैसे कब वापस आएंगे?','वो पैसे वापस आएंगे?','Mera refund wapas kab aayega?'])
  assert.equal(specificReturnSubject(refund,history,{multilingual:true}),refund);
});

test('captured Hindi possibility claim cannot publish a return prediction from generic marriage factors',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const input={...value,language:'hindi',query:'मेरी गर्लफ्रेंड लौटेगी या नहीं? कुंडली से स्पष्ट हाँ या ना बताइए। अभी हम दोनों की बात नहीं हो रही है।'};
 const bad='कुंडली में आपकी गर्लफ्रेंड के लौटने की संभावना के संकेत हैं, लेकिन उनका लौटना उनकी अपनी पसंद है।\n\nसातवें भाव में शुभ गुरु और सक्रिय अवधि का संबंध रिश्ते को सहारा देता है।';
 const {result,requests}=await run({input,draft:bad});
 const writer=requests.find(body=>body.messages[0].content.startsWith('Write the complete astrology reply'));
 const evidence=JSON.parse(writer.messages.at(-1).content).checked_evidence;
 assert.equal(evidence.scope,'person_choice');assert.equal(evidence.assessment,null);assert.deepEqual(evidence.event_windows,[]);
 assert.deepEqual(requests.find(body=>body.messages[0].content.startsWith('Collect checked evidence')).tools.map(tool=>tool.function.name),['mcp__VedAstro__get_horoscope_predictions']);
 assert.doesNotMatch(result.reply,/लौटने की संभावना|सातवें|गुरु|दशा|20\d{2}/u);
 assert.match(result.reply,/फैसला|समय/u);assert.ok(result.answer_validation.includes('pilot_coherent_fallback'));
 for(const promise of ['हाँ, वह लौटेगी।','वो वापस नहीं आएगा।','उनके लौटने के योग हैं।','लौटने की संभावना है।'])
  assert.ok(focusedReplyIssue(promise,{scope:'person_choice'}),promise);
 const qualified='कुंडली से नहीं बता सकते कि वह लौटेगी या नहीं।';
 assert.equal(focusedReplyIssue(qualified,{scope:'person_choice'}),null);
 assert.ok(focusedReplyIssue(qualified+' लेकिन वह ज़रूर लौटेगी।',{scope:'person_choice'}));
 const accepted=await run({input,draft:qualified+'\n\nअभी आप दोनों की बात नहीं हो रही है।'});
 assert.equal(accepted.result.reply,qualified+'\n\nअभी आप दोनों की बात नहीं हो रही है।');
 const duplicated=await run({input,draft:qualified+'\n\nअभी आप दोनों की बात नहीं हो रही है, और कुंडली किसी खास व्यक्ति की भावनाओं की पुष्टि नहीं करती।'});
 assert.equal(duplicated.result.reply,qualified+'\n\nअभी आप दोनों की बात नहीं हो रही है।');
 const onlyLimit=await run({input,draft:qualified+'\n\nसामान्य संबंध-संकेत किसी खास व्यक्ति की भावनाओं, सहमति या आगे के कदम तय नहीं कर सकते।'});
 assert.equal(onlyLimit.result.reply,qualified);
});

test('Hindi return follow-up keeps person-choice scope when it explicitly rejects generic marriage discussion',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const input={...value,language:'hindi',
  query:'तो क्या कुंडली के हिसाब से वह अगले महीने लौट आएगी? साफ बताइए, और शादी की सामान्य बातें मत जोड़िए।',
  history:[{role:'user',text:'मेरी गर्लफ्रेंड से तीन हफ्ते से बात नहीं हुई है।'}]};
 const bad='कुंडली से यह नहीं कहा जा सकता कि वह अगले महीने लौट आएगी। दोबारा संपर्क बनने के संकेत हैं, लेकिन उसका फैसला और समय अनिश्चित है।\n\nसातवें भाव में बृहस्पति और सक्रिय अवधि का संबंध रिश्ते को सहारा देता है।';
 const {result,requests}=await run({input,draft:bad});
 const writers=requests.filter(body=>body.messages[0].content.startsWith('Write the complete astrology reply'));
 assert.ok(writers.length);
 for(const request of writers) {
  const payload=JSON.parse(request.messages.at(-1).content);
  assert.equal(payload.checked_evidence.scope,'person_choice');
  assert.equal(payload.checked_evidence.assessment,null);
  assert.deepEqual(payload.checked_evidence.event_windows,[]);
 }
 assert.doesNotMatch(result.reply,/संपर्क बनने के संकेत|सातवें|बृहस्पति|शनि|मंगल/u);
 assert.match(result.reply,/फैसला|समय/u);
 assert.ok(result.answer_validation.includes('pilot_coherent_fallback'));
 for(const claim of ['दोबारा संपर्क बनने के संकेत हैं।','वह अगले महीने लौट आएगी।','बृहस्पति रिश्ते को सहारा देता है।'])
  assert.ok(focusedReplyIssue(claim,{scope:'person_choice'}),claim);
 assert.equal(focusedReplyIssue('कुंडली से यह नहीं कहा जा सकता कि वह अगले महीने लौट आएगी।',{scope:'person_choice'}),null);
 const answer='साफ़ कहूँ तो कुंडली से यह नहीं बताया जा सकता कि वह अगले महीने लौट आएगी या नहीं।';
 const context='आपने बताया कि तीन हफ्ते से बात नहीं हुई है; यह परिस्थिति समझ में आती है';
 const repeated=await run({input,draft:answer+'\n\n'+context+', लेकिन इससे उसके लौटने का निर्णय तय नहीं होता।'});
 assert.equal(repeated.result.reply,answer+'\n\n'+context+'।');
 assert.equal(removeRepeatedChoiceLimit(answer,'आपने बताया कि तीन हफ्ते से बात नहीं हुई है।'),'आपने बताया कि तीन हफ्ते से बात नहीं हुई है।');
});

test('hard person-choice pressure cannot select horary or publish a return promise',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const input={...value,language:'hinglish',query:'Usne abhi baat karne se mana kiya hai. Kya kundli se pakka haan ya naa bata sakte ho ki woh wapas aayegi? Main baar-baar message karun?',
  history:[{role:'user',text:'Meri girlfriend se breakup hua tha aur abhi contact nahi hai.'}]};
 const {result,requests}=await run({input,draft:'Venus apne ghar mein strong hai aur Moon ka lord Rahu bhi beneficial hai iska matlab hai ki woh wapas aayegi, lekin jald hi nahi.\n\nHaan, woh wapas aayegi.'});
 assert.deepEqual(requests[0].tools.map(tool=>tool.function.name),['mcp__VedAstro__get_horoscope_predictions']);
 assert.equal(JSON.parse(requests[1].messages.at(-1).content).checked_evidence.scope,'person_choice');
 assert.doesNotMatch(result.reply,/Venus|Moon|Rahu|woh wapas aayegi|Haan/iu);
 assert.match(result.reply,/faisla ya samay nahi/);assert.match(result.reply,/baar-baar message mat bhejiye/);
 assert.deepEqual(result.answer_reading_tools,['get_horoscope_predictions']);
 for(const draft of ['Yes, she will return.','Woh wapas nahi aayegi.','They will not return.'])
  assert.ok(focusedReplyIssue(draft,{scope:'person_choice'}),draft);
 const contextualLimit='Pakka haan ya naa kundli se nahi bataya ja sakta ki woh wapas aayegi. Usne baat karne se mana kiya hai, isliye baar-baar message mat kijiye.';
 assert.equal(focusedReplyIssue(contextualLimit,{scope:'person_choice'}),null);
 assert.equal(focusedReplyIssue('A chart cannot tell us whether she will return.',{scope:'person_choice'}),null);
 assert.ok(focusedReplyIssue(contextualLimit+' Lekin woh zaroor wapas aayegi.',{scope:'person_choice'}));
 const contextual=await run({input,draft:contextualLimit+'\n\nUnki baat ka samman kijiye.'});
 assert.equal(contextual.result.reply,contextualLimit+'\n\nUnki baat ka samman kijiye.');
 const safe='Unke lautne ka faisla kundli se nahi bataya ja sakta.\n\nUnhone abhi baat karne se mana kiya hai; unki baat ka samman kijiye aur baar-baar message mat bhejiye.';
 const verified=await run({input,draft:safe});assert.equal(verified.result.reply,safe);
 const answer='Kundli se pakka haan ya naa nahi bataya ja sakta ki woh wapas aayegi; uska faisla usi ka hai. Usne baat karne se mana kiya hai, isliye baar-baar message mat kijiye.';
 const recap='Aapne bataya ki breakup ke baad abhi contact nahi hai.';
 const repeated=await run({input,draft:answer+'\n\n'+recap+' Diye gaye chart assessment se kisi khaas insaan ke lautne, unki feelings ya timing ka pata nahi chalta.'});
 assert.equal(repeated.result.reply,answer+'\n\n'+recap);
 assert.equal(JSON.parse(repeated.requests.at(-1).messages.at(-1).content).proposed,repeated.result.reply);
});

test('exact-day suffixes are removed only after a qualified checked month range',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const answer='Job milne ke yog September 2027 se November 2027 ke beech dikhte hain';
 for(const suffix of ['; exact din chart se nahi diya gaya hai.','; chart se exact din nahi diya gaya hai.']) {
  const {result,requests}=await run({input:{...value,language:'hinglish'},draft:answer+suffix+'\n\n'+candidate.split('\n\n')[1]});
  assert.equal(result.reply,answer+'.\n\n'+candidate.split('\n\n')[1]);
  assert.equal(JSON.parse(requests.at(-1).messages.at(-1).content).proposed,result.reply);
 }
});

test('topic corrections select the new guide and retain its checked dates',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const {result,requests}=await run({input:{...value,query:'Shaadi nahi, main career ke baare mein pooch raha hoon. Job kab milegi?',history:[{role:'user',text:'Meri shaadi kab hogi?'}]}});
 assert.equal(result.reply,candidate);
 for(const body of requests.slice(1))assert.deepEqual(JSON.parse(body.messages.at(-1).content).reading_plan.guides.map(g=>g.key),['career_job']);
 assert.doesNotMatch(requests[0].messages[0].content,/Whether and when marriage/);
});

test('new plan does not bypass existing checks for fabricated dates',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const {result,requests}=await run({draft:candidate.replaceAll('2027','2029')});
 assert.notEqual(result.reply,candidate.replaceAll('2027','2029'));
 assert.ok(result.answer_validation.includes('pilot_coherent_fallback'));
 assert.equal(requests.filter(body=>body.messages[0].content.startsWith('Review this astrology reply')).length,0);
});

test('switch-off and non-pilot surfaces keep their existing model inputs',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const off=await run({config:{...env,ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'0'}});
 assert.equal(JSON.parse(off.requests[1].messages.at(-1).content).reading_plan,undefined);
 assert.doesNotMatch(off.requests[0].messages[0].content,/# Pilot use-case guides/);
 for(const patch of [{user_id:'919000000002'},{reply_surface:'pwa'},{reply_surface:'voice'}]) {
  const input={...value,...patch,birth:{}};
  async function capture(flag) {
   let request;
   await assert.rejects(()=>directAnswer(input,{env:{...env,ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:flag},now:()=>now,
    makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>assert.fail('No tool before capture'),
    fetchImpl:async(_url,options)=>{request=JSON.parse(options.body);throw Error('synthetic capture only');}}),/synthetic capture only/u);
   assert.ok(request);return request;
  }
  assert.deepEqual(await capture('1'),await capture('0'));
 }
});

test('focused plan and confirmed memories stay unchanged through a failed style repair',async()=>{
 const packet=coherentEvidencePacket([chart()],'career');
 const first={answer:'Career progress is possible.',reason:'The tenth house offers support, but Saturn indicates obstacles.',remedy:''};
 const outputs=[JSON.stringify(first),'{"evidence_ok":true,"reason":"","presentation_issue":"Use less repetitive wording."}',JSON.stringify({answer:'A guaranteed job tomorrow.',reason:'Unsupported.'})];
 const calls=[];
 const reply=await writeCoherentReading({value,subject:value.query,packet,focused:true,facts:['[personal] Synthetic user has an interview.'],
  generate:async(instruction,payload)=>{calls.push({instruction,data:JSON.parse(payload)});return outputs.shift();},
  validate:text=>text.includes('tomorrow')?'Unsupported date':null,fallback:'Must not replace verified answer'});
 assert.equal(reply,first.answer+'\n\n'+first.reason);assert.equal(calls.length,3);
 for(const call of calls){assert.deepEqual(call.data.reading_plan,calls[0].data.reading_plan);assert.deepEqual(call.data.user_context,calls[0].data.user_context);}
 assert.equal(calls[2].data.edit_mode,'presentation_only');
});

test('history-based listening keeps its companion route and persona with the focused reading switch on or off',async()=>{
 const reply='Interview se pehle akele aur nervous feel karna thaka deta hai. Main sun raha hoon, aap aaram se bataiye.';
 async function conversation(flag) {
  const requests=[];
  const result=await directAnswer({...value,user_gender:'female',language:'hinglish',
   query:'Aaj bahut akela feel ho raha hai. Bas meri baat suno, advice mat dena.',
   history:[{role:'user',text:'Kal mera interview hai aur main nervous hoon.'}]},
   {env:{...env,ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:flag,ASTROFRIEND_CONVERSATION_MEMORY_ENABLED:'1'},now:()=>now,
    makeMemory:()=>({read:async()=>['[personal] User has an interview tomorrow and feels nervous.'],write:async()=>assert.fail('No write requested')}),
    makeTools:()=>async()=>assert.fail('No chart for listening'),fetchImpl:async(_url,options)=>{
     const body=JSON.parse(options.body);requests.push(body);
     if(body.messages[0].content.startsWith('Review a conversational draft'))return response({content:'{"status":"accept","issues":[]}'});
     const context=JSON.parse(body.messages.at(-1).content);assert.equal(context.assistant_context.name,'Aarav');
     assert.equal(context.saved_context.length,1);assert.equal(context.reading_plan,undefined);
     return response({content:JSON.stringify({route:'conversation',reply})});
    }});
  return {requests,result};
 }
 const on=await conversation('1'),off=await conversation('0');
 assert.deepEqual(on.result,off.result);assert.equal(on.result.reply,reply);assert.deepEqual(on.result.answer_reading_tools,[]);
 assert.deepEqual(on.requests.map(body=>body.messages[1]),off.requests.map(body=>body.messages[1]));
 for(const body of on.requests)assert.match(body.messages[0].content,/Follow requests for no advice or questions silently/);
 for(const body of off.requests)assert.doesNotMatch(body.messages[0].content,/Follow requests for no advice or questions silently/);
});

test('captured live timing suffixes are cleaned before review only in the focused trial',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const captures=[
  ['Career ke settle hone ke liye September 2027 se November 2027 tak ka samay zyada supportive dikh raha hai',
   '—yeh ek estimated opportunity window hai.',value.query],
  ['Meri reading mein shaadi ke liye November 2027 se February 2028 tak ka daur zyada sahara dene wala dikh raha hai',
   '; yeh ek mumkin mauka hai, pakki ghatna ya tareekh nahi.','When might I get married?'],
 ];
 for(const [answer,suffix,query] of captures) {
  const reason=query.includes('married')?'Saathve ghar mein Guru sahara dete hain, lekin Shani aur Mangal ka dabav bhi hai.':candidate.split('\n\n')[1];
  const conclusion='Kundli mein pragati ke yog dikhte hain. ';
  const {result,requests}=await run({input:{...value,query,language:'hinglish'},draft:conclusion+answer+suffix+'\n\n'+reason});
  assert.equal(result.reply,conclusion+answer+'.\n\n'+reason);
  assert.equal(requests.length,3);
  assert.equal(JSON.parse(requests.at(-1).messages.at(-1).content).proposed,result.reply);
  const timing=JSON.parse(requests[1].messages.at(-1).content).checked_evidence.timing_estimate;
  assert.equal(removeTimingBoilerplate(answer+suffix,timing,{focused:true}),answer+'.');
  assert.equal(removeTimingBoilerplate(answer+suffix,timing),answer+suffix);
  assert.equal(removeTimingBoilerplate(answer+suffix,null,{focused:true}),answer+suffix);
  for(const retained of ['Shaadi zaroor hogi aur November 2027 mein dikh rahi hai','Career November 2027 mein pakka set ho sakta hai','Shaadi November 2027 mein hogi'])
   assert.equal(removeTimingBoilerplate(retained+suffix,timing,{focused:true}),retained+suffix);
  const quote='Aapne kaha tha "'+answer+suffix+'"';
  assert.equal(removeTimingBoilerplate(quote,timing,{focused:true}),quote);
 }
});

test('a supportive-time label alone cannot replace the requested outcome, even with model approval',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const {result}=await run({input:{...value,language:'hinglish'},
  draft:'Career ke liye September 2027 se November 2027 tak ka samay sahayak ho sakta hai.\n\nCareer ka ghar mazboot hai, lekin vakri Shani rukawat dikhata hai.'});
 assert.match(result.reply,/career mein pragati ke yog/u);
 assert.match(result.reply,/September 2027 se November 2027/u);
 assert.doesNotMatch(result.reply,/samay tay nahi|pakki tareekh/iu);
});

test('captured exact-date caveat is removed before review without changing the attributed outlook',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const answer='Shaadi ke yog dikhte hain; chart ke hisaab se November 2027 se February 2028 ke beech shaadi ka avsar ban sakta hai';
 const reason='Saatve ghar mein Guru hai, lekin ghar kamzor hai aur Shani bhi wahan hai. Shukra ka daur shaadi se juda hai; Mangal aur Shani ka dabav is daur mein bhi hai.';
 const {result,requests}=await run({input:{...value,query:'Meri shaadi kab hogi?',language:'hinglish'},
  draft:answer+', lekin exact date tay nahi hai.\n\n'+reason});
 assert.equal(result.reply,answer+'.\n\n'+reason);assert.equal(requests.length,3);
 assert.equal(JSON.parse(requests.at(-1).messages.at(-1).content).proposed,result.reply);
});

test('unrequested travel and exam caveats are caught without blocking the same distinction when asked',()=>{
 const abroad='Abroad jaane ke yog hain.\n\nThe twelfth house is mixed, so permanent settlement cannot be confirmed.';
 assert.ok(focusedReplyIssue(abroad,{topic:'abroad',subject:'Kya mere abroad jaane ke chances hain?'}));
 assert.equal(focusedReplyIssue(abroad,{topic:'abroad',subject:'Can I settle abroad permanently?'}),null);
 const education='Padhai ke yog hain.\n\nExam ke natije aapki taiyari aur actual performance par nirbhar rahenge.';
 assert.ok(focusedReplyIssue(education,{topic:'education',subject:'Meri padhai ke liye chart kya kehta hai?'}));
 assert.equal(focusedReplyIssue(education,{topic:'education',subject:'Meri taiyari aur chart dono ka kya role hai?'}),null);
});
