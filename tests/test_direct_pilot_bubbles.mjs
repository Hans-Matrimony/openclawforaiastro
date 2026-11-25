import test from 'node:test';
import assert from 'node:assert/strict';
import {pilotAnswerFirst} from '../extensions/reviewed-reading/direct/pilot-bubbles.mjs';
import {formatReadingReply} from '../extensions/reviewed-reading/direct/format-reply.mjs';
import {limitResponseLength} from '../extensions/reviewed-reading/direct/response-length.mjs';
test('pilot moves a checked verdict ahead of reasons without changing any words or dates',()=>{
 const reason='10ve ghar ki majbooti achhi hai, lekin Shani ki sthiti rukawat deti hai.';
 const answer='Career mein sahyog bhi hai aur rukawatein bhi.';
 assert.equal(pilotAnswerFirst(reason+'\n\n'+answer),answer+'\n\n'+reason);
 assert.equal(pilotAnswerFirst(answer+'\n\n'+reason),answer+'\n\n'+reason);
 assert.equal(pilotAnswerFirst(reason+'\n\nKya aap job khoj rahe hain?'),reason+'\n\nKya aap job khoj rahe hain?');
});
test('four useful pilot bubbles survive formatting and length limits; defaults remain unchanged',()=>{
 const text='Shaadi sambhavit hai.\n\n7ve ghar mein sahyog hai.\n\nRukawatein bhi hain.\n\nKya aap baat karna chahenge?';
 assert.equal(formatReadingReply(text,true,{flexibleBubbles:true}),text);
 assert.equal(limitResponseLength(text,{preserveFourBubbles:true}),text);
 assert.equal(limitResponseLength(text).split('\n\n').length,3);
 assert.equal(pilotAnswerFirst('```json\n{}\n```'),'```json\n{}\n```');
});
import {specificReturnBoundary} from '../extensions/reviewed-reading/direct/pilot-bubbles.mjs';
test('captured career assessment separates from its reasons without changing content',()=>{
 const assessment='Career mein sahyog bhi hai aur rukawatein bhi.';
 const reasons='10ve ghar ki majbooti achhi hai, lekin Shani ki sthiti rukawat ka sanket deti hai.';
 assert.equal(pilotAnswerFirst(assessment+' '+reasons+'\n\nKya aap apply kar rahe hain?'),assessment+'\n\n'+reasons+'\n\nKya aap apply kar rahe hain?');
});
test('specific partner return gets explicit limitation; general outlook and other topics are retained',()=>{
 const reply='November 2031 se July 2034 general relationship window hai.';
 const fixed=specificReturnBoundary(reply,'Meri girlfriend kab wapas aayegi?','hinglish');
 assert.match(fixed,/tay nahi hota/);
 assert.ok(fixed.endsWith(reply));
 assert.equal(specificReturnBoundary(fixed,'Meri girlfriend kab wapas aayegi?','hinglish'),fixed);
 assert.equal(specificReturnBoundary(reply,'Meri shaadi kab hogi?','hinglish'),reply);
});
