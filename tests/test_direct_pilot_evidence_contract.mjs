import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceOnly,unifiedPilotPrompt} from '../extensions/reviewed-reading/direct/pilot-evidence-contract.mjs';
import {SOURCE_FLOW_PROMPT} from '../extensions/reviewed-reading/direct/source-contract.mjs';
test('pilot removes output commands from chart envelope but preserves every evidence field',()=>{
 const input={engine:'local-sweph-v2',instruction:'Force HAAN or NAHI',verdict_signals:[{trend:'MIXED'}],dasha:{from:'2031-11-15'},birth_chart:{house:7}};
 const result=JSON.parse(evidenceOnly(JSON.stringify(input)));
 const {instruction,...expected}=input;assert.deepEqual(result,expected);
 assert.equal(input.instruction,'Force HAAN or NAHI');
 assert.equal(evidenceOnly('Tool failed: unavailable'),'Tool failed: unavailable');
 assert.equal(evidenceOnly('{"other":true}'),'{"other":true}');
});
test('pilot replaces the conflicting source output section while preserving language and other policies',()=>{
 const result=unifiedPilotPrompt(SOURCE_FLOW_PROMPT);
 assert.doesNotMatch(result,/PART 1|PART 2|maximum 8 words/);
 assert.match(result,/First answer the exact question/);
 assert.equal(result.slice(result.indexOf('# Language')),SOURCE_FLOW_PROMPT.slice(SOURCE_FLOW_PROMPT.indexOf('# Language')));
});
