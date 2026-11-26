import test from 'node:test';
import assert from 'node:assert/strict';
import {whatsappWordingIssue,whatsappStyleInstruction} from '../extensions/reviewed-reading/direct/whatsapp-presentation.mjs';
const value={reply_surface:'whatsapp',query:'Career kab set hoga?'};
test('pilot word limits agree with checked writer without changing legacy limits',()=>{
 const reply=Array(30).fill('word').join(' ')+'.\n\n'+Array(30).fill('reason').join(' ')+'.';
 assert.ok(whatsappWordingIssue(reply,value));
 assert.equal(whatsappWordingIssue(reply,value,{pilotReading:true}),null);
 assert.match(whatsappStyleInstruction(value),/at most 50 words/);
 assert.match(whatsappStyleInstruction(value,{pilotReading:true}),/at most 100 words/);
});
test('pilot still rejects excessive length and internal tool wording',()=>{
 assert.ok(whatsappWordingIssue(Array(101).fill('word').join(' '),value,{pilotReading:true}));
 assert.ok(whatsappWordingIssue('The upstream provider says yes.',value,{pilotReading:true}));
});
