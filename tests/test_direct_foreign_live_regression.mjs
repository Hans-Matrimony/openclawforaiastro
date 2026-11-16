import test from 'node:test';
import assert from 'node:assert/strict';
import {chartGroundingConflicts} from '../extensions/reviewed-reading/direct/chart-grounding.mjs';
import {fitWhatsAppReadingParagraphs,whatsappWordingIssue} from '../extensions/reviewed-reading/direct/whatsapp-presentation.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {unsupportedEventTiming} from '../extensions/reviewed-reading/direct/event-timing.mjs';
import {companionFocus,closingDrifts} from '../extensions/reviewed-reading/direct/companion-context.mjs';
import {companionFallback} from '../extensions/reviewed-reading/direct/companion-fallback.mjs';
const chart={engine:'local-sweph-v2',birth_chart:{planets:['Venus: Taurus | house 12 | Own sign (strong)']}};
const results=[JSON.stringify(chart)];
const value={user_id:'synthetic-foreign-grounding',query:'Can I go abroad?',birth:{date:'2000-01-01',time:'06:00',location_name:'Delhi'},history:[],language:'hinglish',reply_surface:'whatsapp'};
test('foreign travel cannot turn a dasha boundary into the captured unsolicited promise',()=>{
 const evidence=[JSON.stringify({...chart,evidence_scope:{timing:'does not calculate event-specific windows'}})];
 for(const text of ['Venus 12th mein strong hai, abroad ke liye signal hai.\n\n2027-03-31 ke baad Mercury dasha shuru hone se abroad ka mauka clear hoga.','Overseas ka mauka 2027 ke baad banega.','Videsh jaane ka chance 2028 ke baad hoga.'])assert.equal(unsupportedEventTiming(text,evidence,value.query),true,text);
 assert.equal(unsupportedEventTiming('Mercury antardasha starts in March 2027.',evidence,value.query),false);
 assert.equal(unsupportedEventTiming('Abroad jaane ki sambhavana hai, guarantee nahi.',evidence,value.query),false);
});
test('the foreign-travel companion stays on topic in all existing reply languages',()=>{
 for(const query of ['Can I go abroad?','Mere videsh jaane ke chances?','Will I move overseas?']){
  const focus=companionFocus({...value,query});assert.deepEqual(focus.topics,['relocation']);
  assert.equal(closingDrifts('Aajkal apni zindagi mein sabse zyada kya chal raha hai?',focus,{...value,query},[]),true);
  assert.equal(closingDrifts('Have you chosen a country?',focus,{...value,query},[]),false);
  for(const language of ['hinglish','english','hindi'])assert.match(companionFallback({...value,query,language},[],{requireQuestion:true}),/videsh|abroad|विदेश/iu);
 }
});
test('the real abroad reply repairs the captured unsupported event year without another calculation',async()=>{
 let calls=0,charts=0;
 const result=await directAnswer(value,{
  env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'},
  makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{charts++;return JSON.stringify({...chart,evidence_scope:{timing:'does not calculate event-specific windows'}});},
  fetchImpl:async(_url,options)=>{
   const body=JSON.parse(options.body);calls++;
   if(calls===3)assert.match(body.messages.at(-1).content,/expired or unsupported event date/);
   const message=calls===1?{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}:
    {content:calls===2?'Abroad ke liye sanket hain.\n\n2027-03-31 ke baad abroad ka mauka clear hoga.':'Venus apni rashi mein 12ve ghar mein hai. Isse akela videsh jaana pakka nahi hota.\n\nAbroad jaane ki sambhavana ek interpretation hai, guarantee nahi.'};
   return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));
  }});
 assert.equal(calls,3);assert.equal(charts,1);assert.match(result.reply,/Abroad/);assert.doesNotMatch(result.reply,/2027|verify nahi/);
 assert.ok(result.answer_validation.includes('timing_claim_rejected'));assert.ok(!result.answer_validation.includes('timing_fallback'));
});
test('explicit planet dignity cannot contradict the current chart, including the captured foreign draft',()=>{
 for(const reply of ['Venus neecha hai aur Saturn ki sade sati abhi chal rahi hai.','Venus is debilitated.','Shukra neech hai.','Venus exalted hai.'])assert.ok(chartGroundingConflicts(reply,results,value).some(row=>row.type==='planet_dignity'),reply);
 for(const reply of ['Venus own sign mein hai.','Venus neecha nahi hai.','Venus is not debilitated.','Pehle Venus neecha kaha tha.','Venus transit mein neecha hai.','Mars neecha hai.'])assert.deepEqual(chartGroundingConflicts(reply,results,value),[],reply);
 const another={engine:'local-sweph-v2',birth_chart:{planets:['Venus: Virgo | house 9 | Debilitated']}};
 assert.deepEqual(chartGroundingConflicts('Venus neecha hai.',[...results,JSON.stringify(another)],value),[]);
});
test('short readings get lossless complete-sentence paragraph boundaries without changing limits',()=>{
 const reply='Aapke sawal ka jawab is chart ki natal sthiti par aadharit hai aur yahan dikh rahe sambandhon ko ek sambhavana ki tarah dekhna chahiye, pakke nateeje ki tarah nahi. Isliye videsh jaane ki sambhavana ko guaranteed trip ya fixed tareekh na samjhein.';
 assert.ok(whatsappWordingIssue(reply,value));
 const fitted=fitWhatsAppReadingParagraphs(reply,value);
 assert.equal(fitted.replace(/\s+/gu,' '),reply);
 assert.equal(whatsappWordingIssue(fitted,value),null);
 assert.equal(fitWhatsAppReadingParagraphs(reply,{...value,reply_surface:undefined}),reply);
 assert.equal(fitWhatsAppReadingParagraphs(reply,{...value,query:'Explain in detail'}),reply);
 const long='word '.repeat(55);assert.equal(fitWhatsAppReadingParagraphs(long,value),long);
 const sentence='word '.repeat(40).trim()+'.';assert.equal(fitWhatsAppReadingParagraphs(sentence,value),sentence);
});
test('the real agent corrects a captured wrong dignity without recalculating or replacing the abroad answer',async()=>{
 let calls=0,charts=0;
 const reply=await directAnswer(value,{
  env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'},
  makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{charts++;return results[0];},
  fetchImpl:async(_url,options)=>{
   const body=JSON.parse(options.body);calls++;
   if(calls===1)assert.match(body.messages[0].content,/not a foreign-travel verdict/);
   if(calls===3)assert.match(body.messages.at(-1).content,/planet_dignity/);
   const message=calls===1?{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}:
    {content:calls===2?'Venus neecha hai.\n\nAbroad jaane mein rukawat hai.':'Venus apni rashi mein 12ve ghar mein hai. Isse akela videsh jaana pakka nahi hota.\n\nAbroad jaane ki sambhavana ek interpretation hai, guarantee nahi.'};
   return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));
  }});
 assert.equal(charts,1);assert.equal(calls,3);assert.match(reply.reply,/Abroad/);assert.doesNotMatch(reply.reply,/neecha|verify nahi/);
 assert.ok(reply.answer_validation.includes('chart_claim_conflict'));assert.ok(!reply.answer_validation.includes('chart_fallback'));
});
