import test from 'node:test';
import assert from 'node:assert/strict';
import { directFailureCategory } from '../extensions/reviewed-reading/direct-route.mjs';

test('operational categories distinguish incomplete output, context and loop limits', () => {
  for (const [message,category] of [
    ['Incomplete direct reply','model_reply_incomplete'],
    ['Missing direct reply','model_reply_missing'],
    ['Direct context too large','context_too_large'],
    ['Direct tool loop did not converge','tool_loop_limit'],
    ['Timing reading requires the period schedule','period_evidence_missing'],
  ]) assert.equal(directFailureCategory(new Error(message)),category);
  assert.equal(directFailureCategory({name:'TimeoutError'}),'generation_timeout');
  assert.equal(directFailureCategory({code:'model_http_429'}),'model_http_429');
});
test('unknown messages and codes cannot leak prompts or upstream payloads', () => {
  assert.equal(directFailureCategory({message:'private prompt and provider secret',code:'model_http_503 private secret'}),'generation_failed');
  assert.equal(directFailureCategory(null),'generation_failed');
  assert.equal(directFailureCategory({message:'constructor'}),'generation_failed');
});
