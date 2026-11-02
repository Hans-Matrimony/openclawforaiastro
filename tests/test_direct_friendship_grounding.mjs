import assert from 'node:assert/strict';
import test from 'node:test';
import {friendshipGroundingIssues, currentFriendshipDisclosure} from '../extensions/reviewed-reading/direct/friendship-grounding.mjs';
import {emotionalReplyFallback} from '../extensions/reviewed-reading/direct/emotional-friendship.mjs';
const value={query:'Ab kya karu?',user_gender:'male',language:'hinglish',history:[{role:'user',text:'Meri girlfriend ne relationship khatam kar diya.'},{role:'assistant',text:'Maine socha tha hum dono saath rahenge.'}]};
test('breakup actor is grounded in user history, not assistant examples',()=>{
 assert.match(currentFriendshipDisclosure(value),/^Meri girlfriend/);
 assert.ok(friendshipGroundingIssues('Aapne jo rishta khatam kiya, uski yaad aa rahi hai.',value).some(x=>x.includes('who ended')));
 assert.deepEqual(friendshipGroundingIssues('Aapko abhi jawab dene ki jaldi nahi hai.',value),[]);
 assert.match(emotionalReplyFallback(value),/waqt/);
});
test('copied first-person disclosure is rejected',()=>{
 assert.ok(friendshipGroundingIssues('Yaar meri GF chali gayi, yeh sunke dukh hua.',{...value,query:'Yaar meri GF chali gayi'}).some(x=>x.includes('echo')));
});
test('dramatic and invented blame language is rejected',()=>{
 for(const reply of ['Yeh ek dhadkan ka ruk jana hai.','Yeh dard sahi lag raha hai.','Yeh kisi ki galati nahi.']) assert.ok(friendshipGroundingIssues(reply,value).length,reply);
});
test('persona check distinguishes narration from quoted user wording',()=>{
 assert.ok(friendshipGroundingIssues('Main samajh sakta hoon.',value).length);
 assert.deepEqual(friendshipGroundingIssues('Main sun rahi hoon. Aap keh sakte hain: “Main baat kar sakta hoon.”',{...value,query:'Please draft a reply to my girlfriend.'}),[]);
 assert.deepEqual(friendshipGroundingIssues('Main sun raha hoon.',{...value,user_gender:'female'}),[]);
});
test('habitual persona grammar is checked while quoted user grammar is preserved',()=>{
 assert.ok(friendshipGroundingIssues('Main samjhta hoon ki aap hurt hain.',value).some(x=>x.includes('grammatical gender')));
 assert.deepEqual(friendshipGroundingIssues('Main samajhti hoon. Aap keh sakte hain: "Main samjhta hoon."',{...value,query:'Please draft a reply.'}),[]);
 assert.ok(friendshipGroundingIssues('Main samajhti hoon.',{...value,user_gender:'female'}).length);
 assert.deepEqual(friendshipGroundingIssues('Main samajhta hoon.',{...value,user_gender:'female'}),[]);
});
test('boundary drafts cannot invent mutual feelings',()=>{
 const boundary={...value,query:'Dost ne hurt kiya. Mujhe space chahiye, kaise bolun?'};
 assert.ok(friendshipGroundingIssues('Aap keh sakte hain: "Time chahiye taaki dono ke feelings theek ho sakein."',boundary).some(x=>x.includes('mutual feelings')));
 assert.deepEqual(friendshipGroundingIssues('Mujhe thoda waqt chahiye.',boundary),[]);
 assert.deepEqual(friendshipGroundingIssues('Dono ke feelings samajhne ke liye space chahiye.',{...boundary,query:'Hum dono upset hain aur space chahiye.'}),[]);
});
test('new topic and content-shaped history resolve without old breakup ownership',()=>{
 assert.equal(currentFriendshipDisclosure({...value,query:'Mere exam ke marks kam aaye.'}),'Mere exam ke marks kam aaye.');
 assert.equal(currentFriendshipDisclosure({...value,history:[{role:'user',content:'Mera interview reject hua.'}]}),'Mera interview reject hua.');
});
import { asksForTiming } from '../extensions/reviewed-reading/direct/reading-intent.mjs';
import { contextualClosing } from '../extensions/reviewed-reading/direct/contextual-closing.mjs';
test('live breakup wording cannot invent acceptance but user-stated acceptance is allowed',()=>{
 const reply='Aap keh sakte hain: "Ab main samajh raha hoon ki aapke liye yeh sahi hai."';
 assert.ok(friendshipGroundingIssues(reply,{...value,query:'Meri girlfriend ne relationship khatam kar diya. Samajh nahi aa raha kya bolun.'}).some(x=>x.includes('acceptance')));
 assert.ok(!friendshipGroundingIssues(reply,{...value,query:'Meri girlfriend ne relationship khatam kiya. I accept her decision.'}).some(x=>x.includes('acceptance')));
});
test('natural samay question activates timing contract without classifying ordinary conversation',()=>{
 for(const q of ['Meri kundli ke hisaab se shaadi ka agla sambhavit samay kya hai?','Shaadi ka samay kya hai?','Agli window kya hai?']) assert.equal(asksForTiming(q),true,q);
 for(const q of ['Mujhe thoda samay chahiye','Main apna samay doston ke saath bitata hoon']) assert.equal(asksForTiming(q),false,q);
});
test('chart closing discards emotional drift without modifying reading evidence',async()=>{
 const reading='Jupiter ki sthiti sahayak hai.\n\nNovember 2031 se July 2034 ek sambhavit avadhi hai.';
 const result=await contextualClosing(reading,{...value,query:'Meri shaadi kab hogi?',history:[],readingOnlyClosing:true},{generate:async()=> 'Kya aapne kisi se apni baat share ki hai?'});
 assert.equal(result,reading);
});
test('uncertain breakup user is not given a scripted decision unless a draft is requested',()=>{
 const q={...value,query:'Meri girlfriend ne relationship khatam kar diya. Samajh nahi aa raha kya bolun.'};
 const reply='Ek message likh lein: "Aapki decision ki respect karti hoon."';
 assert.ok(friendshipGroundingIssues(reply,q).some(x=>x.includes('compose')));
 assert.ok(!friendshipGroundingIssues(reply,{...q,query:q.query+' Please draft a reply.'}).some(x=>x.includes('compose')));
 assert.ok(!friendshipGroundingIssues('Kya hua? Aap batana chahenge?',q).some(x=>x.includes('compose')));
});
test('live vague self-talk and awkward reassurance require a fresh response',()=>{
 for(const reply of ['Aapke paas kuch kehne ka dimaag nahi hai.','Apne dil ki baat apne aap se bol sakte hain, bina kisi ki awaaz ke.']) assert.ok(friendshipGroundingIssues(reply,value).some(x=>x.includes('awkward')));
 assert.ok(!friendshipGroundingIssues('Abhi jawab dene ki jaldi nahi hai. Aap aaram se bata sakte hain.',value).some(x=>x.includes('awkward')));
});
test('fallback acknowledges the live ended-relationship wording and uncertainty',()=>{
 const q={...value,query:'Meri girlfriend ne relationship khatam kar diya. Samajh nahi aa raha kya bolun.'};
 const reply=emotionalReplyFallback(q);
 assert.match(reply,/rishta khatam/);assert.match(reply,/turant jawab/);
 assert.doesNotMatch(reply,/ek baat likh|respect|accept/);
});
import { emotionalFriendshipPrompt, emotionalIssueCategories } from '../extensions/reviewed-reading/direct/emotional-friendship.mjs';
test('uncertainty is not a draft request and explicit drafts remain available',()=>{
 const context={memoryStatus:'available',memoryFacts:[]};
 const q={...value,query:'Meri girlfriend ne relationship khatam kar diya. Samajh nahi aa raha kya bolun.'};
 const prompt=emotionalFriendshipPrompt(q,context);
 assert.match(prompt,/The user is unsure what to say/);
 assert.doesNotMatch(prompt,/Style references only|offer one usable sentence|pehle ek baat likh/);
 assert.doesNotMatch(emotionalFriendshipPrompt({...q,query:q.query+' Please draft a message.'},context),/The user is unsure what to say/);
 assert.ok(emotionalIssueCategories('The user has not asked you to compose a message.').includes('unsolicited_draft'));
});
