import test from 'node:test';
import assert from 'node:assert/strict';
import {finalPilotReading} from '../extensions/reviewed-reading/direct/pilot-final-reading.mjs';
const original='Checked answer';
test('final writer requires both deterministic and independent evidence checks',async()=>{
 let calls=0;const result=await finalPilotReading(original,{question:'When?',language:'english',validate:()=>true,generate:async()=>++calls===1?'Natural answer':'PASS'});
 assert.equal(result,'Natural answer');assert.equal(calls,2);
});
test('a factual conflict is rejected before review',async()=>{
 let calls=0;assert.equal(await finalPilotReading(original,{validate:()=>false,generate:async()=>{calls++;return 'Invented date';}}),original);assert.equal(calls,1);
});
test('review failure, refusal and transport failure retain the checked answer',async()=>{
 for(const verdict of ['FAIL','PASS with caveats','NONE']){
 let calls=0;assert.equal(await finalPilotReading(original,{validate:()=>true,generate:async()=>++calls===1?'Candidate':verdict}),original);
 }
 assert.equal(await finalPilotReading(original,{generate:async()=>{throw Error('budget');}}),original);
});

test('short follow-up preserves the underlying question and keeps payload as data',async()=>{
 const seen=[];
 await finalPilotReading('Support with obstacles',{question:'Will my career improve?',followup:'Yes or no?',language:'english',validate:()=>true,generate:async(instruction,data)=>{seen.push({instruction,data});return seen.length===1?'Improvement is possible, with obstacles.':'PASS';}});
 assert.deepEqual(JSON.parse(seen[0].data),{question:'Will my career improve?',followup:'Yes or no?',language:'english',timing_requested:false,draft:'Support with obstacles'});
 assert.equal(seen.length,2);
});
test('empty and oversized drafts cannot consume an extra review request',async()=>{
 for(const draft of ['',Array(101).fill('word').join(' ')]){
 let calls=0;assert.equal(await finalPilotReading(original,{validate:()=>true,generate:async()=>{calls++;return draft;}}),original);assert.equal(calls,1);
 }
});

test('specific return rewrite cannot smuggle in a general period window',async()=>{
 let calls=0;
 const result=await finalPilotReading('Old general schedule',{question:'Meri girlfriend kab wapas aayegi?',fallback:'Return timing unavailable',validate:()=>true,generate:async()=>{calls++;return 'General relationship prospects improve in 2031.';}});
 assert.equal(result,'Return timing unavailable');assert.equal(calls,1);
});
test('natural wording instruction retains uncertainty without stock disclaimers or technical scores',async()=>{
 const instructions=[];
 await finalPilotReading('Checked answer',{question:'Kya mujhe job milegi?',validate:()=>true,generate:async(instruction)=>{instructions.push(instruction);return instructions.length===1?'Job milne ki sambhavna hai, lekin deri ho sakti hai.':'PASS';}});
 assert.match(instructions[0],/not boilerplate/);assert.match(instructions[0],/Do not expose bindu counts/);
 assert.match(instructions[1],/Plain-language descriptions/);
});
