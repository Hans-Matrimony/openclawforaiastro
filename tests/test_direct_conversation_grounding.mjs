import assert from 'node:assert/strict';
import test from 'node:test';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {conversationGroundingIssue as issue, conversationGroundingInstruction as instruction} from '../extensions/reviewed-reading/direct/conversation-grounding.mjs';

const value={user_id:'synthetic-conversation',query:'Jaise?',language:'hinglish',reply_surface:'whatsapp',
 birth:{date:'1991-04-11',time:'08:00',location_name:'Pune'},history:[
  {role:'user',text:'Meri shaadi kab hogi?'},{role:'assistant',text:'2031 se 2034 ek sambhavit window hai. Abhi koi serious connection ya meeting shuru hui hai?'}]};
const profile={status:'READY'};
const bad='December 2026 se February 2027 strong window hai. Abhi Jupiter antardasha chal rahi hai, Guru 7ve ghar mein hai.';

test('ordinary clarifications cannot inherit a date or personal chart claim from assistant history',()=>{
 assert.ok(issue(bad,value,profile));
 assert.ok(issue(bad,value,profile,true),'Even unsolicited tool use cannot change the current subject');
 for(const reply of ['Shaadi jaldi hogi.','Your marriage window is December se February.','अगले साल शादी होगी।'])assert.ok(issue(reply,value,profile),reply);
 assert.equal(issue('Jaise kisi se lagataar baat hona, milna, ya rishte ko lekar saaf baat hona.',value,profile),null);
 for(const query of ['Meri shaadi kab hogi?','Mera career kab improve hoga?'])assert.equal(issue(bad,{...value,query},profile),null);
});
test('saved profile reminder and palm photo stay separate from old marriage questions',()=>{
 const input={...value,query:'maine pehle hi details de rekha hai',history:[...value.history,{role:'user',text:'[User attached an image. Caption: Mera haath padh kr batao]'}]};
 assert.match(instruction(input,profile),/already complete/);
 assert.match(instruction(input,profile),/attached palm image/);
 assert.ok(issue('Please provide your birth details.',input,profile));
 assert.ok(issue('Shaadi ke liye ghar par baat karte hain.',input,profile));
 assert.equal(issue('Aapki birth details saved hain. Palm photo ki reading ke liye unhe dobara dene ki zaroorat nahi.',input,profile),null);
});
test('general definitions, known birth facts, and user-confirmed scheduled dates remain valid',()=>{
 assert.equal(issue('Jupiter antardasha is a period used in Vedic astrology.',{...value,query:'What is Jupiter antardasha?'},profile),null);
 assert.equal(issue('Your birth date is 11 April 1991.',{...value,query:'What is my saved birth date?'},profile),null);
 assert.equal(issue('Your job interview is scheduled in December 2026.',{...value,query:'My job interview is confirmed for December 2026.'},profile),null);
 assert.ok(issue('Your Jupiter antardasha is active in your 7th house.',{...value,query:'What is Jupiter antardasha?'},profile));
});

test('a clarification cannot smuggle in an undated favourable relationship window',()=>{
 for(const reply of [
  'Jaise koi serious connection shuru ho rahi ho, ya koi introduction ho raha ho abhi ka time uske liye best hai.',
  'This is a favourable period for your career.',
  'अभी का समय शादी के लिए अच्छा है।',
 ])assert.ok(issue(reply,value,profile),reply);
 assert.equal(issue('Jaise kisi se regular baat hona ya kisi introduction ke liye milna. Kya aisa kuch chal raha hai?',value,profile),null);
 assert.equal(issue('Aap job interview ke liye abhi kya tayari kar rahe hain?',value,profile),null);
});

test('saved-details clarification does not deny the image path or offer unrelated readings',()=>{
 const input={...value,query:'maine pehle hi details de rekha hai',history:[{role:'user',text:'[User attached an image. Caption: Mera haath padh kr batao]'}]};
 assert.match(instruction(input,profile),/separate image path/);
 for(const reply of [
  'Main palm reading nahi kar sakta. Tumne birth details de rakhe hain, shadi, career, ya koi bhi sawaal ho, batao.',
  'I cannot read palms. I can help with marriage or career.',
  'I can help with career. Your birth details are saved.',
 ])assert.ok(issue(reply,input,profile),reply);
 assert.equal(issue('Your birth details are saved. Please resend your palm photo so it can be assessed.',input,profile),null);
 assert.equal(issue('Palm photo ke liye birth details dobara dene ki zaroorat nahi. Photo dobara bhej dijiye.',input,profile),null);
 assert.equal(issue('हथेली की फोटो के लिए जन्म जानकारी दोबारा देने की ज़रूरत नहीं है।',input,profile),null);
});

async function run(query,replies,history=value.history){
 let calls=0;
 const result=await directAnswer({...value,query,history},{
  env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0'},
  makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{throw Error('No reading was requested');},
  fetchImpl:async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:replies[Math.min(calls++,replies.length-1)]}}]})),
 });
 return {result,calls};
}
test('actual direct engine repairs the reported Jaise follow-up once without chart work',async()=>{
 const {result,calls}=await run('Jaise?',[bad,'Jaise kisi se lagataar baat hona ya milna. Kya aisa koi connection hai?']);
 assert.equal(calls,2);assert.deepEqual(result.answer_reading_tools,[]);
 assert.doesNotMatch(result.reply,/2026|2027|Jupiter|7ve/);
 assert.ok(result.answer_validation.includes('conversation_grounding_rejected'));
});
test('a repeated bad draft closes with a contextual palm acknowledgement, not another date',async()=>{
 const {result,calls}=await run('maine pehle hi details de rekha hai',[bad],
  [...value.history,{role:'user',text:'[User attached an image. Caption: Mera haath padh kr batao]'},
   {role:'assistant',text:'Please provide your birth details.'}]);
 assert.equal(calls,2);assert.match(result.reply,/saved hain/);assert.match(result.reply,/palm photo/i);
 assert.doesNotMatch(result.reply,/2026|2027|sha+di|marriage|Jupiter/);
 assert.ok(result.answer_validation.includes('conversation_grounding_fallback'));
});

test('captured undated optimism is repaired or rejected by the actual engine',async()=>{
 const reply='Jaise koi serious connection shuru ho rahi ho, ya koi introduction ho raha ho abhi ka time uske liye best hai.';
 const {result,calls}=await run('Jaise?',[reply]);
 assert.equal(calls,2);assert.doesNotMatch(result.reply,/best|favourable|favorable/i);
 assert.match(result.reply,/regular baat|introduction/);
 assert.ok(result.answer_validation.includes('conversation_grounding_fallback'));
});

test('captured palm refusal cannot survive the repair and final delivery boundaries',async()=>{
 const reply='Main palm reading nahi kar sakta main sirf Vedic astrology se help kar sakta hoon. Tumne pehle hi birth details de rakhe hain, main unhe use kar sakta hoon shadi, career, ya koi bhi sawaal ho, batao.';
 const {result,calls}=await run('maine pehle hi details de rekha hai',[reply],
  [{role:'user',text:'[User attached an image. Caption: Mera haath padh kr batao]'}]);
 assert.equal(calls,2);assert.match(result.reply,/saved hain/);assert.match(result.reply,/photo dobara/);
 assert.doesNotMatch(result.reply,/nahi kar sakta|shadi|career|Vedic/i);
 assert.ok(result.answer_validation.includes('conversation_grounding_fallback'));
});
