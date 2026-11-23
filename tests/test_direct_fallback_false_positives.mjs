import test from 'node:test';
import assert from 'node:assert/strict';
import {ordinaryReply} from '../extensions/reviewed-reading/direct/ordinary-reply.mjs';
import {unwantedListeningAdvice} from '../extensions/reviewed-reading/direct/current-turn.mjs';
import {repeatsPrediction} from '../extensions/reviewed-reading/direct/practical-followup.mjs';
import {conversationGroundingFallback} from '../extensions/reviewed-reading/direct/conversation-grounding.mjs';
test('ordinary concern retains user supplied dates but blocks added chart claims',()=>{
 const value={query:'My exam is in 2027 and I am worried about fees',language:'english'};
 const reply='Your 2027 exam fees are putting pressure on you.';
 assert.equal(ordinaryReply(reply,value),reply);
 for(const bad of [reply+' Venus supports you.',reply+' Your 7th house is strong.', 'Your exam in 2028 will go well.'])assert.notEqual(ordinaryReply(bad,value),bad);
});
test('permission not to explain is preserved; additional advice still triggers',()=>{
 const reply='You do not have to try to explain everything right now. I am listening.';
 assert.equal(unwantedListeningAdvice(reply),false);
 assert.equal(unwantedListeningAdvice(reply+' You should get some rest.'),true);
 assert.equal(unwantedListeningAdvice('Try to explain everything now.'),true);
});
test('explicit rejection of chart-based job advice is not a forecast',()=>{
 const reply='Do not base your job decision on a horoscope; compare the offer and salary.';
 assert.equal(repeatsPrediction(reply),false);
 for(const suffix of [' Jupiter supports you.',' Your antardasha is strong.',' Change jobs in 2028.'])assert.equal(repeatsPrediction(reply+suffix),true);
 assert.equal(repeatsPrediction('Base your job decision on your horoscope.'),true);
});
test('punctuated status replies retain context without swallowing new questions',()=>{
 const value={language:'hinglish',history:[{role:'assistant',text:'Kya aapne kisi se serious baat shuru ki hai?'}]};
 for(const query of ['No, not yet','Nahi, abhi nahi','Nahi，abhi nahi'])assert.match(conversationGroundingFallback({...value,query},{status:'READY'}),/serious baat shuru nahi/);
 for(const query of ['Nahi, career kab set hoga','No, when will I marry?'])assert.doesNotMatch(conversationGroundingFallback({...value,query},{status:'READY'}),/serious baat shuru nahi/);
});
