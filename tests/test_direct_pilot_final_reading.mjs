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

test('topic guide reaches final writer and review without forcing return certainty',async()=>{
 const seen=[];const candidate='Uske lautne ka faisla kundli se nahi pata chalta.';
 assert.equal(await finalPilotReading('Rejected forecast',{question:'Meri girlfriend kab wapas aayegi?',topicGuide:'PILOT_GUIDE_SENTINEL',validate:()=>true,generate:async(instruction)=>{seen.push(instruction);return seen.length===1?candidate:'{"pass":true,"reason":""}';}}),candidate);
 assert.match(seen[0],/PILOT_GUIDE_SENTINEL/);
 assert.match(seen[1],/is a direct answer, not avoidance/);
 assert.match(seen[1],/FAIL any proposed event timing/);
});
test('disabled topic guide preserves writer and reviewer payloads',async()=>{
 async function capture(extra){const seen=[];await finalPilotReading('Checked answer',{validate:()=>true,...extra,generate:async(instruction,data)=>{seen.push({instruction,data});return seen.length===1?'Checked answer':'PASS';}});return seen;}
 assert.deepEqual(await capture({}),await capture({topicGuide:''}));
});

test('pilot repairs a captured timing-only answer into a qualified outlook without inventing dates',async()=>{
 const timingOnly='Career set hone ka samay in chart factors se tay nahi hota.\n\n10ve ghar ki majbooti sahyog deti hai, par vakri Shani rukawat dikhata hai.';
 const corrected='Career mein aage badhne ki sambhavana hai, lekin iska samay in sanketon se tay nahi hota.\n\n10ve ghar ki majbooti sahyog deti hai, par vakri Shani rukawat dikhata hai.';
 const outputs=[timingOnly,'{"pass":false,"reason":"The opening gives only a timing limit, omitting the checked outlook."}',corrected,'{"pass":true,"reason":""}'];
 const seen=[];let verified=0;
 const result=await finalPilotReading('draft',{
   question:'Career kab set hoga?',language:'hinglish',timingRequested:true,topicGuide:'guide',repairRemaining:1,
   evidence:[{area:'career',verdict:'MIXED',reasons:['strong tenth house','retrograde Saturn obstacle']}],
   validate:()=>true,onVerified:()=>verified++,generate:async(instruction)=>{seen.push(instruction);return outputs.shift();},
 });
 assert.equal(result,corrected);assert.equal(verified,1);assert.equal(seen.length,4);
 assert.ok(seen.every(instruction=>instruction.includes('A timing-only refusal is incomplete')));
 assert.ok(seen.every(instruction=>instruction.includes('Do not invent an outlook for a specific person')));
 assert.doesNotMatch(result,/20\d{2}|will happen|zaroor/iu);
});

test('pilot review rejection records why and returns safe fallback, never rejected original',async()=>{
 let calls=0;const reasons=[];
 const result=await finalPilotReading('Marriage will happen in 2031',{topicGuide:'guide',fallback:'The chart does not establish event timing.',validate:()=>true,onRejected:r=>reasons.push(r),generate:async()=>++calls===1?'Marriage is possible.':'{"pass":false,"reason":"missing material obstacle"}'});
 assert.equal(result,'The chart does not establish event timing.');
 assert.deepEqual(reasons,['review:missing material obstacle']);
});

test('pilot repairs one concrete review failure and rechecks the repair',async()=>{
 const responses=['Possibility exists. The reason follows.','{"pass":false,"reason":"missing obstacle"}','Possibility exists, with delays. Evidence includes an obstacle.','{"pass":true,"reason":""}'];const seen=[];
 const result=await finalPilotReading('draft',{topicGuide:'guide',repairRemaining:1,validate:()=>true,generate:async(instruction)=>{seen.push(instruction);return responses.shift();}});
 assert.equal(seen.length,4);assert.match(seen[2],/missing obstacle/);
 assert.equal(result,'Possibility exists, with delays.\n\nEvidence includes an obstacle.');
});
test('pilot repair is bounded and never publishes a twice-rejected draft',async()=>{
 let calls=0;
 const result=await finalPilotReading('unsafe',{topicGuide:'guide',repairRemaining:1,fallback:'safe',validate:()=>true,generate:async()=>++calls%2?'candidate':'{"pass":false,"reason":"unsupported"}'});
 assert.equal(calls,4);assert.equal(result,'safe');
});

test('pilot review checks repetitive timing limits as well as facts',async()=>{
 const seen=[];
 await finalPilotReading('draft',{topicGuide:'guide',validate:()=>true,generate:async(instruction)=>{seen.push(instruction);return seen.length===1?'A supported possibility.\n\nA checked reason.':'{"pass":true,"reason":""}';}});
 assert.match(seen[0],/first answer bubble to one concise sentence/);
 assert.match(seen[1],/repeated statements of the same timing limitation/);
 assert.match(seen[1],/Do not delete any unique supporting or adverse fact/);
});

test('pilot repairs Devanagari in Hinglish before accepting or reviewing it',async()=>{
 const outputs=['Career \u0939\u0948','Career mein sambhavana hai.','{"pass":true,"reason":""}'];let calls=0;
 const result=await finalPilotReading('draft',{language:'hinglish',topicGuide:'guide',repairRemaining:1,validate:()=>true,generate:async()=>{calls++;return outputs.shift();}});
 assert.equal(result,'Career mein sambhavana hai.');assert.equal(calls,3);
});
test('pilot never accepts an unrepaired Hinglish script mismatch',async()=>{
 let verified=false;const result=await finalPilotReading('draft',{language:'hinglish',topicGuide:'guide',fallback:'safe',validate:()=>true,onVerified:()=>verified=true,generate:async()=> 'Career \u0939\u0948'});
 assert.equal(result,'safe');assert.equal(verified,false);
});

test('pilot rejects the captured Hindi reply written in Hinglish and repairs before review',async()=>{
 const outputs=[
   'Shaadi ka yog dikh raha hai, lekin is chart se shaadi ka samay tay nahi hota.',
   'शादी की संभावना है, लेकिन इन संकेतों से उसका समय तय नहीं होता।\n\nगुरु का सहयोग है, जबकि शनि रुकावट दिखाता है।',
   '{"pass":true,"reason":""}',
 ];
 const seen=[];
 const result=await finalPilotReading('draft',{
   language:'hindi',topicGuide:'guide',repairRemaining:1,validate:()=>true,
   generate:async instruction=>{seen.push(instruction);return outputs.shift();},
 });
 assert.match(result,/शादी की संभावना/);
 assert.doesNotMatch(result,/[A-Za-z]/);
 assert.equal(seen.length,3);
 assert.match(seen[1],/complete answer and reasons in Hindi Devanagari/);
});

test('unrepaired Hindi script mismatch falls back instead of being marked verified',async()=>{
 const rejected=[];let calls=0;
 assert.equal(await finalPilotReading('draft',{
   language:'hindi',topicGuide:'guide',fallback:'safe',validate:()=>true,
   onRejected:reason=>rejected.push(reason),generate:async()=>{calls++;return 'Career mein sambhavana hai.';},
 }),'safe');
 assert.equal(calls,1);assert.deepEqual(rejected,['hindi_script']);
});

test('explicit current English request is not rejected for using the requested script',async()=>{
 const responses=['Career progress is possible, with obstacles.','{"pass":true,"reason":""}'];
 const result=await finalPilotReading('draft',{
   language:'hindi',question:'Career kab set hoga?',followup:'Please reply in English.',
   topicGuide:'guide',validate:()=>true,generate:async()=>responses.shift(),
 });
 assert.equal(result,'Career progress is possible, with obstacles.');
});
