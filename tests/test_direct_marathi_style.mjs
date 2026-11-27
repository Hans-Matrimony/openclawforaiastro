import test from 'node:test';
import assert from 'node:assert/strict';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {pilotMarathiStyle} from '../extensions/reviewed-reading/direct/pilot-language-style.mjs';
import {parseConversationReview} from '../extensions/reviewed-reading/direct/conversation-turn.mjs';
import {continuationPolicy} from '../extensions/reviewed-reading/direct/conversation-continuation.mjs';

const value={user_id:'919000000001',reply_surface:'whatsapp',language:'hinglish',user_gender:'male',birth:{},history:[],
 query:'मराठीत उत्तर द्या. जास्त पगारासाठी शनिवारी काम करावे की कमी पगाराची ठराविक वेळेची नोकरी निवडावी? कुटुंबासोबतचा वेळ माझ्यासाठी महत्त्वाचा आहे.'};
const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',
 ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_USERS:value.user_id,
 ASTROFRIEND_PILOT_TOPIC_PROMPTS:'1',ASTROFRIEND_PILOT_COHERENT_REPLIES:'1',ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'1',ASTROFRIEND_PILOT_NATURAL_CONTINUATION_ENABLED:'1'};
const response=content=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}]});
const awkward='ठरलेल्या वेळेची नोकरीत पगार कमी असला तरी कुटुंबासाठी वेळ मिळेल. पगारातील फरक किती आहे?';
const polished='कुटुंबासोबतचा वेळ महत्त्वाचा असल्यामुळे ठराविक वेळेची नोकरी तुमच्यासाठी अधिक योग्य वाटते. त्या पगारात आवश्यक खर्च आणि बचत भागते का?';
async function run(outputs,input=value,config=env){
 let calls=0;const instructions=[];
 const result=await directAnswer(input,{env:config,makeMemory:()=>({read:async()=>[],write:async()=>assert.fail('No memory writes')}),
  makeTools:()=>assert.fail('No chart for practical Marathi advice'),fetchImpl:async(_,options)=>{
   instructions.push(JSON.parse(options.body).messages[0].content);
   assert.ok(calls<outputs.length,'No additional polish or model calls');return response(outputs[calls++]);
  }});
 return {result,calls,instructions};
}

test('Marathi wording applies only to the app preference or current explicit language instruction',()=>{
 for(const query of [value.query,'Please reply in Marathi.','Reply in English. मराठीत उत्तर द्या.'])
  assert.match(pilotMarathiStyle({...value,query}),/natural case endings/);
 assert.ok(pilotMarathiStyle({...value,language:'marathi',query:'आजचा दिवस चांगला गेला.'}));
 for(const query of ['I am studying Marathi.','"मराठीत उत्तर द्या." या वाक्याचा अर्थ काय?',
  '```मराठीत उत्तर द्या.```','Please do not reply in Marathi.','मराठीत उत्तर देऊ नका.',
  'मराठीत उत्तर द्या. Reply in English.','Reply in Marathi. Ab Roman Hindi mein batao.'])
  assert.equal(pilotMarathiStyle({...value,query}),'',query);
 assert.equal(pilotMarathiStyle({...value,language:'marathi',query:'Reply in English.'}),'');
 assert.equal(pilotMarathiStyle({...value,query:'Okay.',history:[{role:'user',text:'Reply in Marathi.'}]}),'');
});

test('accepted Marathi wording feedback triggers one reviewed polish while preserving useful intent',async()=>{
 const {result,calls,instructions}=await run([
  {route:'advice',reply:awkward},{status:'accept',issues:[],presentation_issue:'Use the correct case ending and natural phrasing for the fixed-hours job.'},
  {route:'advice',reply:polished},{status:'accept',issues:[],presentation_issue:''}]);
 assert.equal(calls,4);assert.equal(result.reply,polished);assert.equal(result.answer_conversation_route,'advice');
 assert.match(instructions[0],/Marathi wording/);assert.match(instructions[1],/presentation_issue/);
 assert.equal(result.answer_model_calls,4);assert.deepEqual(result.answer_reading_tools,[]);
});

for(const repair of ['unavailable','changed_facts'])test(`language polish ${repair} preserves the approved answer instead of an error or unsupported facts`,async()=>{
 const outputs=[{route:'advice',reply:awkward},{status:'accept',issues:[],presentation_issue:'Correct the case ending.'},
  ...(repair==='unavailable'?[{bad:'not a valid draft'}]:[
   {route:'advice',reply:'कमी पगाराची नोकरी निश्चित जास्त पगार देईल. त्याच नोकरीत जा.'},
   {status:'reject',issues:['Invented salary outcome and ignored the supplied priority.']}])];
 const {result,calls}=await run(outputs);
 assert.equal(result.reply,awkward);assert.equal(calls,outputs.length);assert.doesNotMatch(result.reply,/busy|try again|निश्चित जास्त/);
});

test('non-Marathi pilot and non-focused conversations get no Marathi presentation pass',async()=>{
 for(const [input,config]of [[{...value,query:'Reply in English. Family time matters to me.'},env],
  [value,{...env,ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'0'}]]){
  const {calls,instructions}=await run([{route:'advice',reply:'Choose fixed hours if the pay covers your needs. Does it?'},{status:'accept',issues:[]}],input,config);
  assert.equal(calls,2);assert.ok(instructions.every(instruction=>!instruction.includes('Marathi wording:')));
 }
});

test('optional presentation feedback does not weaken factual review validation',()=>{
 assert.deepEqual(parseConversationReview('{"status":"accept","issues":[]}'),{status:'accept',issues:[]});
 assert.equal(parseConversationReview('{"status":"accept","issues":["Invented salary"]}'),null);
 assert.deepEqual(parseConversationReview('{"status":"accept","issues":[],"presentation_issue":true}'),{status:'accept',issues:[]});
});

test('Marathi two-line drafts keep their speaker, meaning and format without a forced closing question',async()=>{
 const input={...value,query:'मॅनेजरला पाठवण्यासाठी मराठीत दोन छोट्या ओळी लिहा. शेवटी वेगळा प्रश्न जोडू नका.'};
 const reply='कुटुंबासोबत वेळ घालवता यावा म्हणून मला ठराविक वेळेत काम करायचे आहे.\nया भूमिकेच्या कामाच्या वेळांबद्दल तुमच्याशी बोलायचे आहे.';
 assert.equal(continuationPolicy(input).mode,'format');
 const {result,calls}=await run([{route:'conversation',reply},{status:'accept',issues:[],presentation_issue:''}],input);
 assert.equal(result.reply,reply);assert.equal(calls,2);assert.equal(result.reply.split('\n').length,2);
 assert.doesNotMatch(result.reply,/[?？]/u);
});
