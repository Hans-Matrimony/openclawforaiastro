import test from 'node:test';
import assert from 'node:assert/strict';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {parseSemanticDecision} from '../extensions/reviewed-reading/direct/semantic-routing.mjs';
import {conversationGroundingIssue} from '../extensions/reviewed-reading/direct/conversation-grounding.mjs';
import {previousReply,explanationContext} from '../extensions/reviewed-reading/direct/reply-explanation.mjs';
import {savedBirthContext} from '../extensions/reviewed-reading/direct/context.mjs';

const prior='Shaadi ke liye November 2027 se February 2028 ke beech ek mauka dikhaya gaya hai. Yeh pakki shaadi ki tareekh nahi hai. Kya ghar mein baat shuru hui hai?';
const intent={topic:'marriage',subject:'self',scope:'explain_previous',timing:false,history_index:-1,property_event:'none',profile_fields:[]};
const base={user_id:'919000000001',reply_surface:'whatsapp',language:'hinglish',user_gender:'male',
 birth:{date:'1998-10-18',time:'05:00',location_name:'Delhi'},query:'Mtlv',
 history:[{role:'user',text:'Meri shaadi kab hogi?'},{role:'assistant',text:prior}],reply_to:{role:'assistant',text:prior}};
const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',
 VEDASTRO_DIRECT_REPLY_CACHE:'0',ASTROFRIEND_PILOT_TOPIC_PROMPTS:'1',ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',
 ASTROFRIEND_CONVERSATION_PROGRESS_USERS:'919000000001',ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1',
 ASTROFRIEND_PILOT_COHERENT_REPLIES:'1',ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'1',
 ASTROFRIEND_PILOT_NATURAL_CONTINUATION_ENABLED:'1',ASTROFRIEND_PILOT_SEMANTIC_ROUTING_ENABLED:'1',
 ASTROFRIEND_CONVERSATION_MODEL:'fixture/router'};
const wrong='Aapki kundli mein shaadi ka yog abhi clear nahi hai isliye ek naya check karna padega. Kya aap apna birth time 12:00 PM hi maan rahe hain ya kuch aur hai?';
const explained='Maine November 2027 se February 2028 ko shaadi ke liye ek sambhavit daur kaha tha, pakki tareekh nahi. Aap samay wali baat samajhna chahte hain ya rukawaton wali?';

test('an explanation scope requires an actual assistant referent and cannot become a new timing calculation',()=>{
 const decision={route:'conversation',reply:explained,intent};
 assert.deepEqual(parseSemanticDecision(decision,base),decision);
 assert.equal(parseSemanticDecision(decision,{...base,history:[],reply_to:undefined}),null);
 assert.equal(parseSemanticDecision(decision,{...base,reply_to:{role:'user',text:'Some text'}}),null);
 assert.equal(parseSemanticDecision({...decision,intent:{...intent,timing:true}},base),null);
 assert.equal(parseSemanticDecision({...decision,route:'checked_reading',reply:''},base),null);
 const latest={...base,history:[...base.history,{role:'assistant',text:'What kind of work do you prefer?'}]};
 assert.equal(previousReply(latest),prior,'An explicit assistant quote wins over the latest unrelated reply');
 assert.equal(explanationContext(base,intent).status,'previous_statement_not_new_evidence');
});

test('captured undated contradiction is rejected even without the new explanation scope',()=>{
 const profile=savedBirthContext(base.birth);
 assert.ok(conversationGroundingIssue(wrong,base,profile,false,{focused:true}));
 assert.ok(conversationGroundingIssue(wrong,base,profile,false,{focused:true,explanationIntent:intent}));
 assert.equal(conversationGroundingIssue(explained,base,profile,false,{focused:true,explanationIntent:intent}),null);
 for(const reply of [explained.replace('2028','2029'),explained.replace('November','January'),
  'November 2027 se February 2028 ke beech aapki shaadi hogi.',
  'Kya aap apna birth time 05:00 AM confirm kar sakte hain?',
  'Kya aap janam ki jagah bata sakte hain?',
  'Kundli mein shaadi ka yog abhi clear nahi hai; naya check chahiye.'])
  assert.ok(conversationGroundingIssue(reply,base,profile,false,{focused:true,explanationIntent:intent}),reply);
 assert.ok(conversationGroundingIssue('Kya aap apna birth time 12:00 PM hi maan rahe hain?',base,profile,false,
  {focused:true,explanationIntent:{...intent,scope:'ordinary'}}));
});

test('quoted meaning follow-ups are explained without chart calls, invented clocks or collection restarts',async()=>{
 for(const query of ['Mtlv','mtlb?','Iska matlab?','What did you mean?','इसका मतलब?']) {
  const hindi=query.includes('मतलब');
  const input={...base,query,language:hindi?'hindi':query.startsWith('What')?'english':'hinglish'};
  const reply=hindi?'मेरा मतलब था कि मैंने नवंबर 2027 से फरवरी 2028 को एक संभावित अवधि बताया था, शादी की पक्की तारीख नहीं। आप समय वाली बात समझना चाहते हैं या रुकावटों वाली?':
   query.startsWith('What')?'I meant that my earlier answer described November 2027 to February 2028 as a possible period, not a fixed wedding date. Which part would you like explained?':explained;
  const result=await directAnswer(input,{env,now:()=>new Date('2026-11-28T11:00:00Z'),
   makeMemory:()=>({read:async()=>[],write:async()=>assert.fail('No profile or memory writes')}),
   makeTools:()=>async()=>assert.fail('A meaning explanation must not calculate a new chart'),
   fetchImpl:async(_url,options)=>{
    const body=JSON.parse(options.body),system=body.messages[0].content;
    let output;
    if(system.startsWith('You interpret the latest utterance')) {
     assert.match(system,/explain_previous/u);
     assert.equal(JSON.parse(body.messages[1].content).previous_statement.text,prior);
     output={route:'conversation',reply,intent};
    }else{
     assert.match(system,/previous_statement/u);
     output={status:'accept',issues:[]};
    }
    return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(output)}}]});
   }});
  assert.equal(result.reply,reply);assert.equal(result.answer_model_calls,2);
  assert.deepEqual(result.answer_reading_tools,[]);
  assert.equal(result.answer_routing.scope,'explain_previous');
 }
});

test('an unsupported first draft is repaired before it can reach delivery even when model review would accept it',async()=>{
 let drafts=0,reviews=0;
 const result=await directAnswer(base,{env,now:()=>new Date('2026-11-28T11:00:00Z'),
  makeMemory:()=>({read:async()=>[],write:async()=>assert.fail('No writes')}),
  makeTools:()=>async()=>assert.fail('No chart handoff'),
  fetchImpl:async(_url,options)=>{
   const body=JSON.parse(options.body);let output;
   if(body.messages[0].content.startsWith('You interpret the latest utterance')) {
    drafts++;
    output={route:'conversation',reply:drafts===1?wrong:explained,intent:{...intent,scope:drafts===1?'ordinary':'explain_previous'}};
   }else{reviews++;output={status:'accept',issues:[]};}
   return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(output)}}]});
  }});
 assert.equal(result.reply,explained);assert.equal(drafts,2);assert.equal(reviews,1);
 assert.equal(result.answer_model_calls,3);assert.deepEqual(result.answer_reading_tools,[]);
});

test('a checked explanation repairs only a missing closing without changing its meaning or repeating the quoted question',async()=>{
 const original='Maine November 2027 se February 2028 ko ek sambhavit daur kaha tha, pakki tareekh nahi.';
 for(const scenario of ['valid','birth_request','repeated','review_rejected','unavailable','quiet']) {
  const input={...base,query:scenario==='quiet'?'Mtlv, koi sawal mat poochiye.':'Mtlv'};
  const closing=scenario==='birth_request'?'Kya aap apna birth time 12:00 PM confirm kar sakte hain?':
   scenario==='repeated'?'Kya ghar mein baat shuru hui hai?':'Aapko is daur ke baare mein kaunsi baat samajhni hai?';
  let writers=0,reviews=0,closings=0;
  const result=await directAnswer(input,{env,now:()=>new Date('2026-11-28T11:00:00Z'),
   makeMemory:()=>({read:async()=>[],write:async()=>assert.fail('No writes')}),
   makeTools:()=>async()=>assert.fail('No chart handoff'),
   fetchImpl:async(_url,options)=>{
    const body=JSON.parse(options.body),system=body.messages[0].content;let output;
    if(system.startsWith('You interpret the latest utterance')) {
     writers++;output={route:'conversation',reply:original,intent};
    }else if(system.startsWith('Write only one short, NEW closing question')) {
     closings++;
     assert.deepEqual(body.response_format,{type:'json_object'});
     assert.equal(JSON.parse(body.messages[1].content).approved_explanation,original);
     if(scenario==='unavailable')throw Error('Synthetic provider failure');
     output={follow_up:closing};
    }else{
     reviews++;output=reviews>1&&scenario==='review_rejected'?{status:'reject',issues:['Repeated question.']}:{status:'accept',issues:[]};
    }
    return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(output)}}]});
   }});
  assert.equal(writers,1,'Do not regenerate the approved explanation');
  assert.equal(result.reply,scenario==='valid'?original+'\n\n'+closing:original);
  assert.equal(closings,scenario==='quiet'?0:1);
  assert.ok(result.answer_model_calls<=4);
 }
});
