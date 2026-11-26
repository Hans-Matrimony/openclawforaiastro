import test from 'node:test';
import assert from 'node:assert/strict';
import {categoricalOutcomeClaim,readingVerdictIssue} from '../extensions/reviewed-reading/direct/pilot-relationship-reading.mjs';
const reply='Career mein aage badhne ka yog hai, lekin kab set hoga iska specific samay in sanketon se nahi nikalta. Abhi chal rahe dasha swami bhi career se seedhe jude nahi hain, isliye kisi khaas period ko career set hone ka waqt kehna theek nahi hoga.';
const results=[JSON.stringify({engine:'local-sweph-v2',verdict_signals:[{area:'career',trend:'MIXED',positive:['support'],negative:['delay']}]})];
test('pilot accepts explicit timing uncertainty in a reported WHEN question',()=>{
 assert.ok(readingVerdictIssue(reply,results,'career'));
 assert.equal(readingVerdictIssue(reply,results,'career',{allowTimingUncertainty:true}),null);
});
test('timing uncertainty cannot hide a separate categorical prediction',()=>{
 for(const text of ['Career set hoga. '+reply,'Job milegi lekin date nahi pata.','Career 2031 mein set hoga, kab ka samay nahi nikalta.','You will get a job. I cannot determine when.'])
 assert.equal(categoricalOutcomeClaim(text,{allowTimingUncertainty:true}),true,text);
});

test('captured reverse-order timing limit is not mistaken for a career promise',()=>{
 const text='Career kab set hoga, iska event-specific samay chart se tay nahi hota.\n\n10ve ghar ki majbooti career ko sahara deti hai, lekin vakri Shani atkaav la sakta hai.';
 assert.equal(readingVerdictIssue(text,results,'career',{allowTimingUncertainty:true}),null);
});

test('reported questions do not hide assertions before or after them',()=>{
 for (const text of [
   'Career set hoga, kab ka samay tay nahi hota.',
   'Career kab set hoga, iska samay tay nahi hota, lekin job milegi.',
   'Career kab set hoga, iska samay tay nahi hota. You will get a job.',
   'Job milegi, career ka samay kehna theek nahi hoga.',
 ]) assert.equal(categoricalOutcomeClaim(text,{allowTimingUncertainty:true}),true,text);
});
