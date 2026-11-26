import test from 'node:test';
import assert from 'node:assert/strict';
import {pilotScheduleBubble} from '../extensions/reviewed-reading/direct/pilot-schedule.mjs';
const now=new Date('2026-11-25T06:00:00Z');
const chart={engine:'local-sweph-v2',birth_chart:{id:'synthetic'},dasha:{upcoming_antardashas:[{lord:'Mars',from:'2027-09-15',to:'2028-11-14'}]}};
const bubble=(rows,query='Career kab set hoga?')=>pilotScheduleBubble(rows.map(JSON.stringify),'hinglish',query,now);
test('pilot dates preserve exact tool boundaries and identify schedule scope',()=>{
 const reply=bubble([chart]);assert.match(reply,/15 September 2027 se 14 November 2028/);assert.match(reply,/dasha ka samay/);assert.doesNotMatch(reply,/job mil|shaadi ho/);
});
test('past or invalid schedules are never attached',()=>{
 for(const p of [{lord:'Mars',from:'2025-01-01',to:'2025-12-01'},{lord:'Mars',from:'2027-02-30',to:'2028-01-01'}])assert.equal(bubble([{...chart,dasha:{upcoming_antardashas:[p]}}]),'');
});
test('conflicting subjects or schedules do not produce dates',()=>{
 assert.equal(bubble([chart,{...chart,birth_chart:{id:'other'}}]),'');
 assert.equal(bubble([chart,{...chart,dasha:{}}]),'');
});
test('specific return and explicit event windows do not get unrelated schedules',()=>{
 assert.equal(bubble([chart],'Meri girlfriend kab wapas aayegi?'),'');
 assert.equal(bubble([{...chart,event_windows:[{from:'2027-01-01',to:'2027-02-01'}]}]),'');
});

test('Hindi and English schedules use the requested language and future tense',()=>{
 const data=[JSON.stringify(chart)];
 const hi=pilotScheduleBubble(data,'hindi','शादी कब होगी?',now);
 assert.match(hi,/मंगल अंतर्दशा/);
 assert.match(hi,/15 सितंबर 2027 से 14 नवंबर 2028/);
 assert.doesNotMatch(hi,/[A-Za-z]/);
 const en=pilotScheduleBubble(data,'english','When will my career settle?',now);
 assert.match(en,/Your Mars sub-period runs from 15 September 2027 to 14 November 2028/);
 assert.match(bubble([chart]),/tak chalegi/);
});

test('current-only schedules show the future end boundary, not the historical start',()=>{
 const row={...chart,dasha:{current_antardasha:{lord:'Moon',from:'2025-01-01',to:'2027-06-01'}}};
 const text=pilotScheduleBubble([JSON.stringify(row)],'english','When will my career settle?',now);
 assert.match(text,/continues until 1 June 2027/);
 assert.doesNotMatch(text,/2025/);
});

test('failed chart envelopes cannot supply the date bubble',()=>{
 assert.equal(bubble([{...chart,isError:true}]),'');
});
