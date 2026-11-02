import test from 'node:test';
import assert from 'node:assert/strict';
import { emotionalReplyFallback, emotionalReplyIssue } from '../extensions/reviewed-reading/direct/emotional-friendship.mjs';

test('Hindi listening uses grammatical acknowledgement without advice or a question', () => {
  const value={query:'आज मन उदास है। सलाह नहीं चाहिए, बस मेरी बात सुनिए और कोई सवाल मत पूछिए।',language:'hindi',user_gender:'male',history:[]};
  assert.match(emotionalReplyIssue('मैं सुन रही हूँ। आपको जो भी बात है, वो अभी आपके दिल में है।',value), /malformed everyday language/);
  const reply=emotionalReplyFallback(value);
  assert.match(reply,/आप उदास हैं/);assert.doesNotMatch(reply,/[?？]|आपको जो भी बात है/);
  assert.equal(emotionalReplyIssue(reply,value),null);
});
test('Hindi fallback does not attribute another persons sadness or a negated feeling to the user', () => {
  for (const query of ['मेरी दोस्त उदास है, मैं ठीक हूँ।', 'आज मन उदास नहीं है।']) {
    assert.doesNotMatch(emotionalReplyFallback({query,language:'hindi',history:[]}),/आप उदास हैं/);
  }
});
