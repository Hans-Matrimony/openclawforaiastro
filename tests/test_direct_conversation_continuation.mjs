import test from 'node:test';
import assert from 'node:assert/strict';
import {continuationPolicy,continuationIssue} from '../extensions/reviewed-reading/direct/conversation-continuation.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {get_horoscope_predictions} from '../extensions/reviewed-reading/direct/assets/dev-v2/engine.mjs';

const value={user_id:'919000000001',reply_surface:'whatsapp',language:'hinglish',user_gender:'female',history:[],birth:{date:'2001-01-03',time:'05:00',location_name:'Delhi'}};
const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',
 ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_USERS:value.user_id,
 ASTROFRIEND_PILOT_TOPIC_PROMPTS:'1',ASTROFRIEND_PILOT_COHERENT_REPLIES:'1',ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'1',
 ASTROFRIEND_PILOT_NATURAL_CONTINUATION_ENABLED:'1',ASTROFRIEND_CONVERSATION_REVIEW_ENABLED:'1'};
const response=content=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}]});
const deps=fetchImpl=>({env,fetchImpl,now:()=>new Date('2026-11-27T06:00:00Z'),
 makeMemory:()=>({read:async()=>[],write:async()=>assert.fail('No writes')}),makeTools:()=>async()=>assert.fail('No tool for conversation')});

test('continuation respects quiet requests, finished artifacts, exact formats and user goodbyes',()=>{
 for(const query of ['No follow-up questions.','Bas meri baat suniye, advice mat dijiye.','बस मेरी बात सुनिए।','Thanks!','Good night.'])
  assert.equal(continuationPolicy({...value,query}).mode,'quiet',query);
 for(const query of ['Give exactly three short lines.','Bas format teen chhoti lines mein bataiye.','Translate "What happened?" into Hindi.','Draft a message for my brother.'])
  assert.equal(continuationPolicy({...value,query}).mode,'format',query);
 for(const query of ['Meeting mein meri baat kaat di gayi.','Kal interview hai. Kaise taiyari karun?','Meri shaadi kab hogi?'])
  assert.equal(continuationPolicy({...value,query}).mode,'continue',query);
});

test('captured missing follow-ups and question-form no-question templates are rejected without stripping facts',()=>{
 const input={...value,query:'Main kaise shuru karun?'};
 assert.ok(continuationIssue('Pehle job description dekhiye. Phir practice kijiye.',input));
 assert.ok(continuationIssue('Pehle practice kijiye. Anything else?',input));
 assert.ok(continuationIssue('Role kya hai? Interview kab hai?',input));
 assert.ok(continuationIssue('Role kya hai? Hope that helps.',input));
 assert.equal(continuationIssue('Pehle project ka example taiyar kijiye. Interview kis role ka hai?',input),null);
 const quiet={...input,query:'Teen lines mein format bataiye, koi sawal mat poochiye.'};
 assert.ok(continuationIssue('Problem: app kis zaroorat ko solve karta tha, aur aapka role kya tha?',quiet));
 assert.equal(continuationIssue('Problem: app ki zaroorat aur apna role batayiye.',quiet),null);
 assert.ok(continuationIssue('Interview kis role ka hai?',{...input,history:[{role:'assistant',text:'Interview kis role ka hai?'}]}));
});

test('missing companion follow-up gets one contextual repair and the full repaired reply is reviewed',async()=>{
 const input={...value,query:'Meeting mein meri baat do baar kaat di gayi. Uske baad main chup ho gayi.',
  history:[{role:'assistant',text:'Office mein kya hua?'}]};
 const original='Meeting mein baat kaatna chubh sakta hai. Main sun raha hoon.';
 const revised='Meeting mein do baar baat kaatna chubh sakta hai. Us waqt aap kya kehna chahti thi?';
 let calls=0;
 const result=await directAnswer(input,deps(async(_,options)=>{
  const body=JSON.parse(options.body);calls++;
  if(calls===1){assert.equal(JSON.parse(body.messages[1].content).continuation_policy.mode,'continue');return response({route:'conversation',reply:original});}
  if(calls===2){assert.match(body.messages.at(-1).content,/stops without continuing/);return response({route:'conversation',reply:revised});}
  assert.equal(JSON.parse(body.messages[1].content).candidate.reply,revised);return response({status:'accept',issues:[]});
 }));
 assert.equal(calls,3);assert.equal(result.reply,revised);assert.deepEqual(result.answer_reading_tools,[]);
});

test('no-question template is repaired as statements instead of a compliance footer',async()=>{
 const input={...value,query:'Bas project ka format teen chhoti lines mein bataiye, koi sawal mat poochiye.'};
 const bad='Problem: app kis zaroorat ko solve karta tha?\nApproach: apna kaam batayiye.\nOutcome: result batayiye.';
 const good='Problem: app ki zaroorat batayiye.\nApproach: apna kaam batayiye.\nOutcome: result batayiye.';
 let calls=0;
 const result=await directAnswer(input,deps(async()=>response(++calls===1?{route:'advice',reply:bad}:calls===2?{route:'advice',reply:good}:{status:'accept',issues:[]})));
 assert.equal(result.reply,good);assert.equal(calls,3);
});

test('linked follow-up review preserves the actor of a reported workplace complaint',async()=>{
 const input={...value,query:'Main apne project ka update dena chahti thi. Mujhe laga meri baat sun hi nahi rahe hain.',
  history:[{role:'user',text:'Meeting mein meri baat do baar kaat di gayi.'},
   {role:'assistant',text:'Abhi sabse zyada kya chubh raha hai?'}]};
 const bad='Meri baat se laga ki main sun nahi raha. Sorry. Project mein kya update hai?';
 const good='Project ka update rakhte waqt baat na suni jaana chubh sakta hai. Aapko us waqt kya kehna reh gaya?';
 let calls=0;
 const result=await directAnswer(input,deps(async(_,options)=>{
  const body=JSON.parse(options.body);calls++;
  if(calls===1)return response({route:'conversation',reply:bad});
  if(calls===2){
   assert.match(body.messages[0].content,/A changed actor is an unsupported fact/);
   assert.deepEqual(JSON.parse(body.messages[1].content).conversation.dialogue,input.history);
   return response({status:'reject',issues:['The complaint refers to colleagues in the meeting, not the assistant. Preserve the actor and the present concern.']});
  }
  return response(calls===3?{route:'conversation',reply:good}:{status:'accept',issues:[]});
 }));
 assert.equal(result.reply,good);assert.equal(calls,4);assert.deepEqual(result.answer_reading_tools,[]);
});

test('continuation opt-out keeps the old conversation inputs and does not demand a question',async()=>{
 let calls=0;const input={...value,query:'Aaj office mein bura laga.'};
 const d=deps(async(_,options)=>{
  const body=JSON.parse(options.body);assert.equal(JSON.parse(body.messages[1].content).continuation_policy,undefined);
  return response(++calls===1?{route:'conversation',reply:'Aaj office mein bura laga, main sun raha hoon.'}:{status:'accept',issues:[]});
 });
 d.env={...env,ASTROFRIEND_PILOT_NATURAL_CONTINUATION_ENABLED:'0'};
 assert.equal((await directAnswer(input,d)).answer_model_calls,2);
});

test('checked astrology carries a reviewed final follow-up without changing evidence or adding a model stage',async()=>{
 const input={...value,query:'Mera career kaisa rahega?'};
 const answer='Career mein pragati ke sanket hain, lekin rukawatein bhi hain.';
 const reason='Dasva ghar mazboot hai, jabki vakri Shani rukawat dikhate hain.';
 const follow_up='Abhi career mein aapki sabse badi chinta kya hai?';
 const requests=[];const d=deps(async(_,options)=>{
  const body=JSON.parse(options.body);requests.push(body);const instruction=body.messages[0].content;
  if(instruction.startsWith('Collect checked evidence'))return Response.json({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}}]});
  if(instruction.startsWith('Write the complete astrology reply'))return response({answer,reason,remedy:'',follow_up});
  assert.equal(JSON.parse(body.messages.at(-1).content).proposed,[answer,reason,follow_up].join('\n\n'));
  return response({evidence_ok:true,reason:'',presentation_issue:''});
 });
 d.makeTools=()=>async()=>get_horoscope_predictions({birth_date:'3/1/2001',birth_time:'05:00',location_name:'Delhi'}).content[0].text;
 const result=await directAnswer(input,d);
 assert.equal(requests.length,3);assert.equal(result.reply,[answer,reason,follow_up].join('\n\n'));
 assert.deepEqual(result.answer_reading_tools,['get_horoscope_predictions']);assert.ok(result.answer_validation.includes('pilot_coherent_verified'));
 for(const request of requests.slice(1))assert.equal(JSON.parse(request.messages.at(-1).content).continuation_policy.mode,'continue');
});

test('checked reading also rejects a follow-up when the current user requests no questions',async()=>{
 const input={...value,query:'Mera career kaisa rahega? Koi sawal mat poochiye.'};
 let drafts=0;
 const d=deps(async(_,options)=>{
  const body=JSON.parse(options.body);const instruction=body.messages[0].content;
  if(instruction.startsWith('Collect checked evidence'))return Response.json({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}}]});
  if(instruction.startsWith('Write the complete astrology reply'))return response({answer:'Career mein pragati ke sanket hain, lekin rukawatein bhi hain.',
   reason:'Dasva ghar mazboot hai, jabki vakri Shani rukawat dikhate hain.',remedy:'',follow_up:++drafts===1?'Abhi kis role mein kaam kar rahi hain?':''});
  assert.doesNotMatch(JSON.parse(body.messages.at(-1).content).proposed,/\?/u);
  return response({evidence_ok:true,reason:'',presentation_issue:''});
 });
 d.makeTools=()=>async()=>get_horoscope_predictions({birth_date:'3/1/2001',birth_time:'05:00',location_name:'Delhi'}).content[0].text;
 const result=await directAnswer(input,d);
 assert.equal(drafts,2);assert.doesNotMatch(result.reply,/\?/u);assert.ok(result.answer_validation.includes('pilot_coherent_verified'));
});

test('new continuation flag cannot activate on a different account or another surface',async()=>{
 for(const patch of [{user_id:'919000000002'},{reply_surface:'pwa'},{reply_surface:'voice'}]) {
  let calls=0;
  const d=deps(async(_,options)=>{
   calls++;const body=JSON.parse(options.body);
   assert.doesNotMatch(body.messages.map(message=>String(message.content)).join(' '),/Use continuation_policy/);
   return Response.json({choices:[{finish_reason:'stop',message:{content:'Aaj office mein bura laga, main sun raha hoon.'}}]});
  });
  await directAnswer({...value,query:'Aaj office mein bura laga.',...patch},d);assert.ok(calls>0);
 }
});
