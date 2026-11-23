import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationGroundingIssue as issue,conversationGroundingFallback as fallback,isUnresolvedPredictionNotice} from '../extensions/reviewed-reading/direct/conversation-grounding.mjs';
import {repeatsPrediction} from '../extensions/reviewed-reading/direct/practical-followup.mjs';
const profile={status:'READY'};
test('user event dates remain conversational and practical',()=>{
 for(const [query,reply] of [['I start my new job in 2027','Congratulations on your new job in 2027!'],['My wedding is in December 2027','Your wedding in December 2027 sounds exciting.'],['What should I prepare for my 2027 interview?','Prepare your CV for the 2027 interview.']]){
 assert.equal(issue(reply,{query,history:[]},profile),null);
 assert.equal(repeatsPrediction(reply,query),false);
 }
});
test('date echo does not permit forecasts or changed events',()=>{
 for(const [query,reply] of [['Will I get a job in 2027?','Your job in 2027 looks favorable.'],['I start my job in 2027','Your wedding in 2027 sounds exciting.'],['My wedding is in December 2027','Your wedding is in November 2027.'],['Prepare for my 2027 interview','You will succeed in your 2027 interview.']]) assert.equal(repeatsPrediction(reply,query),true);
 assert.equal(repeatsPrediction('Jupiter supports your job in 2027','I start my job in 2027'),true);
});
test('generic conversational recovery does not blame prediction repetition; old notices still resolve',()=>{
 for(const language of ['english','hindi','hinglish']){
 const reply=fallback({query:'okay',language,history:[]},profile);
 assert.doesNotMatch(reply,/prediction|purani|भविष्यवाणी/);
 assert.equal(isUnresolvedPredictionNotice(reply),true);
 }
 assert.equal(isUnresolvedPredictionNotice('Bina jaanch ke purani prediction dohrana sahi nahi hoga. Mere pichhle jawab ki kis baat ko saaf karun?'),true);
});
