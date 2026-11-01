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
 assert.deepEqual(friendshipGroundingIssues('Main sun rahi hoon. Aap keh sakte hain: “Main baat kar sakta hoon.”',value),[]);
 assert.deepEqual(friendshipGroundingIssues('Main sun raha hoon.',{...value,user_gender:'female'}),[]);
});
test('new topic and content-shaped history resolve without old breakup ownership',()=>{
 assert.equal(currentFriendshipDisclosure({...value,query:'Mere exam ke marks kam aaye.'}),'Mere exam ke marks kam aaye.');
 assert.equal(currentFriendshipDisclosure({...value,history:[{role:'user',content:'Mera interview reject hua.'}]}),'Mera interview reject hua.');
});
