import test from 'node:test';
import assert from 'node:assert/strict';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {lifeEventBoundary,disclosesBereavement,lifeEventContextInstruction} from '../extensions/reviewed-reading/direct/life-event-boundaries.mjs';
import {asksForTiming,isPersonalChartQuestion} from '../extensions/reviewed-reading/direct/reading-intent.mjs';
import {resolveReadingTopic} from '../extensions/reviewed-reading/direct/topic-period-context.mjs';
import {conversationGroundingInstruction,conversationGroundingIssue} from '../extensions/reviewed-reading/direct/conversation-grounding.mjs';
import {selectedSelfBirth} from '../extensions/reviewed-reading/direct/selected-self-birth.mjs';

const env={OPENROUTER_API_KEY:'synthetic',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',
 ASTROFRIEND_PILOT_TOPIC_PROMPTS:'1',ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',
 ASTROFRIEND_CONVERSATION_PROGRESS_USERS:'919000000001',ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1',
 ASTROFRIEND_PILOT_COHERENT_REPLIES:'1',ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'1'};
const value={user_id:'919000000001',reply_surface:'whatsapp',language:'hinglish',query:'Wife ka health thik kub hoga',
 history:[],birth:{date:'1990-05-12',time:'08:20',location_name:'Pune'}};
const loss='Wife ka death 14 october 2026 me ho gaya. Aage or kya dekhna padega';

test('pilot catches medical recovery, bereavement, remarriage and control replies before model or chart calls',async()=>{
 for(const [query,rule,required] of [
   [value.query,'medical_recovery_boundary',/doctor/iu],
   [loss,'bereavement_acknowledgement',/afsos/iu],
   ['Dusra shaadi kub Tak','remarriage_timing_limit',/doosri shaadi/iu],
   ['nfm_reply','form_control_reply',/sawaal/iu],
 ]){
   const never=()=>assert.fail('Boundary must not use model, memory or chart tools');
   const result=await directAnswer({...value,query},{env,fetchImpl:never,makeMemory:never,makeTools:never});
   assert.equal(result.answer_conversation_rule,rule);
   assert.equal(result.answer_model_calls,0);
   assert.deepEqual(result.answer_reading_tools,[]);
   assert.match(result.reply,required);
   assert.doesNotMatch(result.reply,/2029|2032|Shayad|internal setup|koi naya sawal/iu);
 }
});

test('a bereavement disclosure is distinct from death timing, hypotheticals and negations',()=>{
 assert.ok(disclosesBereavement(loss));
 assert.ok(disclosesBereavement('My wife passed away last month.'));
 for(const q of ['Wife ki death kab hogi?','My wife has not died.','If my wife died, what would happen?',
   'My wife died in a dream.','His wife died.','Wife ka death nahi hua.'])assert.equal(disclosesBereavement(q),false,q);
 const reply=lifeEventBoundary({...value,query:loss,history:[{role:'assistant',text:'Wife ki health 2029 se sudhar sakti hai.'}]}).reply;
 assert.match(reply,/galat tha/iu);
 const instruction=lifeEventContextInstruction({...value,query:'Aage ka carrer',history:[{role:'user',text:loss}]});
 assert.match(instruction,/new, intelligible request/iu);
 assert.match(instruction,/deceased/iu);
 assert.equal(lifeEventContextInstruction(value),'');
 assert.equal(lifeEventBoundary({...value,query:'When is World Health Day?'}),null);
});

test('focused routing understands clear spelling variants and short career/future questions without changing legacy routing',()=>{
 assert.equal(asksForTiming('Dusra shaadi kub Tak',{exactDateRequests:true}),true);
 assert.equal(asksForTiming('Dusra shaadi kub Tak'),false);
 for(const query of ['Dusra shaadi kub Tak','Aage ka carrer','Mera future kya likha hai']){
   assert.equal(isPersonalChartQuestion(query,{exactDateRequests:true,respectDeclinedChart:true}),true,query);
   const turn={...value,query};
   assert.equal(conversationGroundingInstruction(turn,{status:'READY'},{focused:true}),'');
   assert.equal(conversationGroundingIssue('Career ke liye current chart dekhti hoon.',turn,{status:'READY'},false,{focused:true}),null);
 }
 assert.equal(resolveReadingTopic('Aage ka carrer',{multilingual:true})?.topic,'career');
 assert.equal(resolveReadingTopic('Aage ka carrer'),null);
 for(const query of ['Aage ka carrer','Mera future kya likha hai']){
   assert.deepEqual(selectedSelfBirth(query,value.birth,{propertyReading:true,relationshipReading:true}),value.birth);
   assert.equal(selectedSelfBirth(query,value.birth),null);
 }
 assert.equal(selectedSelfBirth('Meri wife ka carrer',value.birth,{propertyReading:true,relationshipReading:true}),null);
 for(const query of ['What is future tense?','Which future phone should I buy?','What does career mean?'])
   assert.equal(isPersonalChartQuestion(query,{exactDateRequests:true,respectDeclinedChart:true}),false,query);
});

test('the early safety behavior is isolated to focused WhatsApp pilots',async()=>{
 for(const patch of [{user_id:'919000000002'},{reply_surface:'pwa'},{reply_surface:'voice'}]){
   let downstream=false;
   await assert.rejects(directAnswer({...value,...patch},{env,
     makeMemory:()=>{downstream=true;throw Error('legacy downstream reached');}}));
   assert.equal(downstream,true);
 }
});

test('a complete pilot profile cannot be denied on an ordinary life-direction question',()=>{
 const turn={...value,query:'Mera life me or kya dekhna padega'};
 for(const reply of ['Aapki koi birth details nahi hai, main kuch bhi nahi bol sakti.',
   "I don't have your birth details. Please send them.", 'आपकी जन्म जानकारी नहीं है।']){
   assert.match(conversationGroundingIssue(reply,turn,{status:'READY'},false,{focused:true}),/profile is complete/u);
   assert.equal(conversationGroundingIssue(reply,turn,{status:'VERIFIED_EMPTY'},false,{focused:true}),null);
 }
 assert.equal(conversationGroundingIssue('A birth chart cannot establish a medical recovery date.',turn,{status:'READY'},false,{focused:true}),null);
});
