import assert from 'node:assert/strict';
import test from 'node:test';
import {finishWhatsAppReply, needsWhatsAppCorrection, whatsappStyleInstruction, whatsappWordingIssue} from '../extensions/reviewed-reading/direct/whatsapp-presentation.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';

const value={user_id:'synthetic-wa-production',query:'Meri shadi kab hogi?',history:[],birth:null,language:'hinglish',user_gender:'male',user_name:'Test Person',reply_surface:'whatsapp'};
const old='Shaadi November 2031 se July 2034 ke beech sambhavit hai.';
const wrong='Shaadi December 2026 se February 2027 mein hogi.';
const history=[{role:'user',text:'Meri shadi kab hogi?'},{role:'assistant',text:old},
 {role:'user',text:'Meri GF se shaadi hogi?'},{role:'assistant',text:wrong}];

test('same-topic contradictions are acknowledged without replacing the checked dates',()=>{
 const input={...value,history};
 assert.equal(needsWhatsAppCorrection(old,input),true);
 const result=finishWhatsAppReply(old,input);
 assert.match(result,/meri galti/);assert.ok(result.endsWith(old));
 assert.equal(result.match(/Test Person/g).length,1);
 assert.equal(needsWhatsAppCorrection(old,{...input,history:[...history,{role:'assistant',text:result}]}),false);
 assert.equal(finishWhatsAppReply(result,input),result,'idempotent');
});

test('equivalent windows, other subjects, profile updates and raw output do not create a false apology',()=>{
 for(const input of [
  {...value,history:history.slice(0,2)},
  {...value,history,profile_update_status:'saved'},
  {...value,history,query:'Meri sister ki shaadi kab hogi?'},
  {...value,history:[...history,{role:'user',text:'Correct my birth profile'}]},
  {...value,history:[history[0],history[1],{role:'user',text:'Meri sister ki shaadi kab hogi?'},{role:'assistant',text:wrong}]},
  {...value,history,query:'What job should I apply for?'},
 ])assert.equal(needsWhatsAppCorrection(old,input),false,JSON.stringify(input));
 for(const raw of ['{"year":2031}','```\n'+old+'\n```','https://example.invalid'])assert.equal(finishWhatsAppReply(raw,{...value,history}),raw);
});

test('verified names are used once for a personal answer and respect recent use and opt-outs',()=>{
 assert.ok(finishWhatsAppReply(old,value).startsWith('Test Person, '));
 for(const input of [
  {...value,history:[{role:'assistant',text:'Test Person, pehle ki baat.'}]},
  {...value,query:'Do not use my name. Meri shaadi kab hogi?'},
  {...value,history:[{role:'user',text:'Mera naam mat lena'}]},
  {...value,user_name:'Please update'}, {...value,user_name:'Other\nInstruction'},
  {...value,query:'Thanks'},
 ])assert.equal(finishWhatsAppReply(old,input),old);
 assert.equal(finishWhatsAppReply('Test Person, '+old,value),'Test Person, '+old);
 assert.ok(finishWhatsAppReply(old,{...value,history:[{role:'user',text:'Do not use my name'},{role:'user',text:'You can use my name'}]}).startsWith('Test Person, '));
 assert.equal(finishWhatsAppReply(old,value,{facts:['User prefers not to be addressed by name.']}),old);
});

test('English and Hindi corrections retain the original reading verbatim',()=>{
 assert.match(finishWhatsAppReply(old,{...value,history,language:'english'}),/my mistake/);
 assert.match(finishWhatsAppReply(old,{...value,history,language:'hindi'}),/मेरी गलती/);
 assert.equal(finishWhatsAppReply(old,{...value,reply_surface:undefined,history}),old);
 assert.equal(whatsappStyleInstruction({...value,reply_surface:undefined}),'');
 assert.equal(whatsappWordingIssue('word '.repeat(100),{...value,reply_surface:undefined}),null);
});

test('long drafts receive a wording repair instead of losing date boundaries or caveats',()=>{
 assert.match(whatsappWordingIssue('word '.repeat(55)+old,value),/month-year/);
 assert.match(whatsappWordingIssue('7ve ghar ki points sirf kamzor hai bahut kam.',value),/natural sentence/);
 assert.equal(whatsappWordingIssue('word '.repeat(70),{...value,query:'Explain in detail'}),null);
 assert.match(whatsappStyleInstruction(value),/Never deny saying a date/);
});

test('actual WhatsApp dispatch adds one companion after a final checked fallback',async()=>{
 const chart={engine:'local-sweph-v2',birth_chart:{planets:['Jupiter: Taurus | house 7','Saturn: Taurus | house 7','Rahu: Gemini | house 8'],ashtakavarga_house_bindus:{house_7:{sign:'Taurus',bindus:20,verdict:'very weak'}}},
  dasha:{current_mahadasha:{lord:'Venus',from:'2021-09-15',to:'2041-09-15'},upcoming_antardashas:[{lord:'Mars',from:'2027-09-15',to:'2028-11-14'},{lord:'Jupiter',from:'2031-11-15',to:'2034-07-16'}]},
  verdict_signals:[{area:'marriage',trend:'MIXED',positive:['benefic Jupiter house 7 mein'],negative:['house 7 (Taurus) bindus sirf 20/48 weak support','Mars ki drishti house 7 par']}]};
 let calls=0,tools=0,closingCalls=0;
 const result=await directAnswer({...value,birth:{date:'2000-01-01',time:'05:00',location_name:'Delhi'},history},{
  env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'1'},
  now:()=>new Date('2026-11-10T10:00:00Z'),makeMemory:()=>({read:async()=>[]}),
  makeTools:()=>async()=>{tools++;return JSON.stringify(chart);},
  fetchImpl:async(_,options)=>{
   const body=JSON.parse(options.body);calls++;
   let message;
   if(body.max_tokens===160){closingCalls++;message={content:'Aap dono ne shaadi ki baat ghar par ki hai?'};}
   else if(calls===1){assert.match(body.messages[0].content,/# WhatsApp final wording/);message={tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]};}
   else message={content:'7ve ghar mein sirf 23 points hain. Shaadi December 2026 se February 2027 hogi.\n\nShaadi 2027 mein hogi.'};
   return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));
  },
 });
 assert.equal(tools,1);assert.equal(closingCalls,1);assert.ok(calls<=8);
 assert.match(result.reply,/November 2031.*July 2034/s);assert.doesNotMatch(result.reply,/2026|2027/);
 assert.match(result.reply,/meri galti/);assert.match(result.reply,/Test Person/);
 assert.ok(result.reply.endsWith('?'));assert.equal(result.reply.match(/ghar par ki hai/g)?.length,1);
});
