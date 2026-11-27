import test from 'node:test';
import assert from 'node:assert/strict';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {resolveReadingTopic} from '../extensions/reviewed-reading/direct/topic-period-context.mjs';
import {isPersonalChartQuestion} from '../extensions/reviewed-reading/direct/reading-intent.mjs';
import {selectedSelfBirth} from '../extensions/reviewed-reading/direct/selected-self-birth.mjs';
import {activeReadingQuestion,borrowsCompanionTopic} from '../extensions/reviewed-reading/direct/followup-scope.mjs';
import {focusedReadingDialogue} from '../extensions/reviewed-reading/direct/reading-dialogue.mjs';
import {unrelatedReadingTopic} from '../extensions/reviewed-reading/direct/reading-topic-guard.mjs';
import {get_horoscope_predictions} from '../extensions/reviewed-reading/direct/assets/dev-v2/engine.mjs';
import {correctedReadingSubject} from '../extensions/reviewed-reading/direct/personal-query.mjs';

const birth={date:'1991-04-11',time:'08:00',location_name:'Pune'};
const now=new Date('2026-11-27T06:00:00Z');
const career=[{role:'user',text:'Mera career kab set hoga?'},
 {role:'assistant',text:'Career mein January 2040 se March 2040 tak pragati hogi. Aap kaun si job dhoond rahe hain?'}];
const value={user_id:'919000000001',reply_surface:'whatsapp',birth,history:career,language:'hinglish',user_gender:'male'};
const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',
 VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'1',ASTROFRIEND_PILOT_TOPIC_PROMPTS:'1',
 ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_USERS:'919000000001',
 ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1',ASTROFRIEND_PILOT_COHERENT_REPLIES:'1',
 ASTROFRIEND_PILOT_EVENT_TIMING_ENABLED:'1',ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'1'};
const response=content=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}]});
const chart=()=>get_horoscope_predictions({birth_date:'11/4/1991',birth_time:birth.time,location_name:birth.location_name}).content[0].text;

test('love-life aliases select relationship evidence without inheriting career, while default routing stays unchanged',()=>{
 for(const query of ['Meri love life kaisi rahegi?','When will my dating life improve?',
  'Mujhe pyar kab milega?','Mera pyaar kab milega?','Meri romantic life ke baare mein batao',
  'मेरी लव लाइफ कैसी रहेगी?','मेरा प्रेम जीवन कैसा रहेगा?']) {
  assert.deepEqual(resolveReadingTopic(query,{multilingual:true}),{topic:'relationship',houses:[5,7]},query);
  assert.equal(resolveReadingTopic(query),null,'New aliases are focused-pilot opt-in');
  assert.equal(borrowsCompanionTopic(query,{allowDiscoursePrefix:true}),false,query);
  assert.equal(activeReadingQuestion({...value,query},{focused:true}),query,query);
  assert.deepEqual(selectedSelfBirth(query,birth,{relationshipReading:true}),birth,query);
 }
 for(const query of ['Meri love life kaisi rahegi?','When will my dating life improve?'])
  assert.equal(isPersonalChartQuestion(query,{respectDeclinedChart:true}),true,query);
 for(const query of ['I love you','I love my job','What does love life mean?',
  'Please give me practical dating tips?','I want advice about my love life?'])
  assert.equal(isPersonalChartQuestion(query,{respectDeclinedChart:true}),false,query);
});

test('explicit love/career corrections retain only the replacement topic',()=>{
 for(const [query,topic] of [['Career nahi, meri love life kaisi rahegi?','relationship'],
  ['Love life nahi, mera career kab set hoga?','career'],
  ['Meri love life ki date nahi chahiye. Mera career kab set hoga?','career']]) {
  const subject=correctedReadingSubject(query,{allowDismissal:true});
  assert.equal(resolveReadingTopic(subject,{multilingual:true})?.topic,topic,query);
 }
 for(const query of ['Pehle career ke baare mein poocha tha, ab meri love life kaisi rahegi?',
  'I asked about my career before. Now tell me about my love life.'])
  assert.equal(resolveReadingTopic(correctedReadingSubject(query,{allowDismissal:true}),{multilingual:true})?.topic,'relationship',query);
 for(const query of ['Career aur love life dono batao','Will my love life improve after my career settles?'])
  assert.equal(resolveReadingTopic(correctedReadingSubject(query,{allowDismissal:true}),{multilingual:true}),null,'Genuine comparisons remain mixed requests');
});

test('dialogue starts after a superseded reading and preserves current circumstances and follow-ups',()=>{
 const dialogue=[...career,{role:'user',text:'Meri love life kaisi rahegi? Main abhi single hoon.'},
  {role:'assistant',text:'Aapki love life ke sanket mile-jule hain. Kya aap kisi ko pasand karte hain?'},
  {role:'user',text:'Haan, ek dost ko.'}];
 const input={...value,history:dialogue};const before=structuredClone(input);
 assert.deepEqual(focusedReadingDialogue(value,'relationship'),[]);
 assert.deepEqual(focusedReadingDialogue(input,'relationship'),dialogue.slice(2));
 assert.deepEqual(input,before);
 const wrongAssistant={...value,history:[{role:'user',text:'Meri love life kaisi rahegi?'},career[1]]};
 assert.deepEqual(focusedReadingDialogue(wrongAssistant,'relationship'),[wrongAssistant.history[0]]);
 assert.deepEqual(focusedReadingDialogue({...value,history:[{role:'user',text:'Mera career aur shaadi kab hogi?'},
  {role:'assistant',text:'Career aur shaadi dono January 2040 mein honge.'}]},'relationship'),[]);
});

test('several abbreviated follow-ups stay on the latest love subject and stop at a new topic',()=>{
 const history=[...career,{role:'user',text:'Meri love life kaisi rahegi?'},
  {role:'assistant',text:'A current relationship answer.'},{role:'user',text:'Why?'},
  {role:'assistant',text:'A current relationship explanation.'}];
 for(const query of ['Why?','When will it happen?','Kab tak?']) {
  const active=activeReadingQuestion({...value,query,history},{focused:true});
  assert.match(active,/^Meri love life/);assert.doesNotMatch(active,/career/iu);
 }
 const later=[...history,{role:'user',text:'Meri padhai kaisi rahegi?'}];
 assert.match(activeReadingQuestion({...value,query:'Why?',history:later},{focused:true}),/^Meri padhai/u);
 const chain=[...career,{role:'user',text:'Meri love life kaisi rahegi?'}];
 for(const query of ['Matlab kab tak?','So when will it happen?','Why?','Kaise?','Toh kab hoga?']) {
  assert.match(activeReadingQuestion({...value,query,history:chain},{focused:true}),/^Meri love life/u,query);
  chain.push({role:'assistant',text:'A current relationship explanation.'},{role:'user',text:query});
 }
});

test('wrong-topic answers and closing questions cannot pass even when dates or the model reviewer agree',()=>{
 for(const [topic,reply]of [['relationship','Aapke career ke yog achhe hain.'],
  ['relationship','Aapke career ke yog achhe nahi hain.'],
  ['relationship','Aapki love life ke yog hain.\n\nAap kaun si job dhoond rahe hain?'],
  ['career','Aapki shaadi ke yog January 2040 se March 2040 tak hain.'],
  ['money','Aapki padhai achhi rahegi.'],['property','Aapke career aur salary ke yog achhe hain.']])
  assert.ok(unrelatedReadingTopic(reply,{topic}),reply);
 assert.equal(unrelatedReadingTopic('Aapki love life ke yog hain.\n\nSaathva ghar shaadi aur commitment se juda hai.',{topic:'relationship'}),null);
 assert.equal(unrelatedReadingTopic('Pehle bataya gaya career ka samay ghar kharidne par lagu nahi hota.',{topic:'property'}),null);
 assert.equal(unrelatedReadingTopic('Aapke career ke yog September 2027 se November 2027 tak hain.',{topic:'career'}),null);
 assert.equal(unrelatedReadingTopic('Aapki salary mein badhotri ke yog hain.',{topic:'career'}),null);
});

async function run(query,{history=career,config=env,stale=career[1].text}={}) {
 const requests=[];let writes=0;
 const result=await directAnswer({...value,query,history},{env:config,now:()=>now,
  makeMemory:()=>({read:async()=>[],write:async()=>{writes++;assert.fail('No writes');}}),
  makeTools:()=>async()=>chart(),fetchImpl:async(_,options)=>{
   const body=JSON.parse(options.body);requests.push(body);const instruction=body.messages[0].content;
   if(instruction.startsWith('You interpret the latest utterance'))return response({route:'checked_reading',reply:''});
   if(instruction.startsWith('Collect checked evidence'))return Response.json({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}}]});
   if(instruction.startsWith('Write the complete astrology reply'))return response({answer:stale,reason:'Checked explanation.',remedy:''});
   if(instruction.startsWith('Review this astrology reply'))return response({evidence_ok:true,reason:'',presentation_issue:''});
   throw Error('Unexpected model stage');
  }});
 assert.equal(writes,0);return {result,requests};
}

test('actual career-to-love dispatch rejects the stale career answer and uses only current relationship evidence',async()=>{
 const {result,requests}=await run('Meri love life kaisi rahegi?');
 assert.equal(result.answer_response_flow,'pilot_coherent_reading');
 assert.doesNotMatch(result.reply,/career|job|2040|dasva/iu);
 assert.match(result.reply,/rishta|rishte|relationship|prem|love/iu);
 assert.ok(result.answer_validation.some(v=>v.startsWith('pilot_coherent_rejected:Answer only the locked relationship')));
 const collector=requests.find(b=>b.messages[0].content.startsWith('Collect checked evidence'));
 assert.match(collector.messages[0].content,/"topic":"relationship"/);
 assert.equal(collector.messages.length,2,'No old career answer in the collector dialogue');
 for(const body of requests.filter(b=>b.messages[0].content.startsWith('Write the complete astrology reply'))) {
  const data=JSON.parse(body.messages.at(-1).content);
  assert.equal(data.reading_plan.topic,'relationship');assert.equal(data.checked_evidence.topic,'relationship');
  assert.deepEqual(data.dialogue,[]);assert.equal(data.timing_requested,false);
 }
});

test('actual repeated why follow-up uses the latest love reading rather than the older career subject',async()=>{
 const history=[...career,{role:'user',text:'Meri love life kaisi rahegi?'},
  {role:'assistant',text:'A current relationship answer.'},{role:'user',text:'Why?'},
  {role:'assistant',text:'A current relationship explanation.'}];
 const {result,requests}=await run('Why?',{history});
 assert.equal(result.answer_response_flow,'pilot_coherent_reading');assert.doesNotMatch(result.reply,/career|2040/iu);
 const payload=JSON.parse(requests.find(b=>b.messages[0].content.startsWith('Write the complete astrology reply')).messages.at(-1).content);
 assert.equal(payload.reading_plan.topic,'relationship');assert.match(payload.question,/^Meri love life/u);
 assert.equal(payload.dialogue.length,4);assert.equal(payload.timing_requested,false);
});

test('actual dispatch isolates marriage, finances, studies and property from an earlier career answer',async()=>{
 for(const [query,topic]of [['Meri shaadi ke yog kaise hain?','marriage'],
  ['Meri finances ke sanket kaise hain?','money'],['Meri padhai kaisi rahegi?','education'],
  ['Mere ghar kharidne ke yog kaise hain?','property'],
  ['Pehle career ke baare mein poocha tha, ab meri love life kaisi rahegi?','relationship']]) {
  const {result,requests}=await run(query);
  assert.equal(result.answer_response_flow,'pilot_coherent_reading',query);
  assert.doesNotMatch(result.reply,/career|2040/iu,query);
  const payload=JSON.parse(requests.find(b=>b.messages[0].content.startsWith('Write the complete astrology reply')).messages.at(-1).content);
  assert.equal(payload.reading_plan.topic,topic,query);assert.deepEqual(payload.dialogue,[],query);
 }
});

test('a new career question after love life does not keep the relationship verdict or its closing question',async()=>{
 const history=[{role:'user',text:'Meri love life kaisi rahegi?'},
  {role:'assistant',text:'Rishta banne ke yog hain. Kya aap kisi ko pasand karte hain?'}];
 const {result,requests}=await run('Mera career kaisa rahega?',{history,stale:history[1].text});
 assert.equal(result.answer_response_flow,'pilot_coherent_reading');
 assert.doesNotMatch(result.reply,/rishta|pasand|love|2040/iu);
 assert.match(result.reply,/career/iu);
 const payload=JSON.parse(requests.find(b=>b.messages[0].content.startsWith('Write the complete astrology reply')).messages.at(-1).content);
 assert.equal(payload.reading_plan.topic,'career');assert.deepEqual(payload.dialogue,[]);
});

test('a new explicit love question overrides an old career quote; a genuine short quote follow-up still selects career',()=>{
 const reply_to={role:'assistant',text:'Your career has mixed indications. January 2040 to March 2040.'};
 const query='Meri love life kaisi rahegi?';
 assert.equal(activeReadingQuestion({...value,query,reply_to},{focused:true}),query);
 const active=activeReadingQuestion({...value,query:'Why?',reply_to},{focused:true});
 assert.match(active,/^Mera career/u);assert.doesNotMatch(active,/2040/u);
});

test('practical dating advice remains companion conversation after career without executing a chart',async()=>{
 const query='Please give me practical dating tips?';
 const reply='Baat ki shuruaat kisi shared interest se kijiye aur saamne wale ko jawab dene ki jagah dijiye.';
 let calls=0;
 const result=await directAnswer({...value,query},{env,now:()=>now,
  makeMemory:()=>({read:async()=>[],write:async()=>assert.fail('No writes')}),
  makeTools:()=>async()=>assert.fail('Practical dating advice needs no chart'),
  fetchImpl:async(_,options)=>{
   calls++;const instruction=JSON.parse(options.body).messages[0].content;
   return instruction.startsWith('You interpret the latest utterance')?
    response({route:'advice',reply}):response({status:'accept',issues:[]});
  }});
 assert.equal(result.reply,reply);assert.equal(result.answer_conversation_route,'advice');
 assert.deepEqual(result.answer_reading_tools,[]);assert.equal(calls,2);
});
