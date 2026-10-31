import assert from 'node:assert/strict';
import test from 'node:test';
import { unsupportedActionProgress } from '../extensions/reviewed-reading/direct/companion-action-progress.mjs';
import { contextualClosing } from '../extensions/reviewed-reading/direct/contextual-closing.mjs';

const bad = 'Aapne jo skill practice shuru ki hai, usmein kya progress feel ho raha hai?';
const value = {query:'Mere career ke liye kaisa time hai?', language:'hinglish', user_gender:'male', history:[]};
test('assistant advice and questions cannot establish skill practice', () => {
  for (const text of ['Practice a skill daily.', 'Have you started practicing a skill?', bad]) {
    assert.equal(unsupportedActionProgress(bad, {...value, history:[{role:'assistant',text}]}), true);
  }
  for (const text of ['I want to practice coding.', 'I will start a course.', 'Maine skill practice shuru nahi ki hai.', 'Should I practice coding?', 'I stopped practicing coding.']) {
    assert.equal(unsupportedActionProgress(bad, {...value, query:text}, ['User started practicing coding.']), true, text);
  }
});
test('confirmed user actions and saved facts remain available; latest corrections win', () => {
  for (const text of ['I started practicing coding.', 'I practice coding daily.', 'Maine skill practice shuru ki hai.']) {
    assert.equal(unsupportedActionProgress(bad, {...value, query:text}), false, text);
  }
  assert.equal(unsupportedActionProgress(bad,value,['User started practicing coding.']),false);
  assert.equal(unsupportedActionProgress(bad,value,['User wants to practice coding.']),true);
  assert.equal(unsupportedActionProgress(bad,{...value,query:'I have not started practicing coding.',history:[{role:'user',text:'I started practicing coding.'}]}),true);
  for (const text of ['Kya aapne skill practice shuru ki hai?', 'Have you started practicing a skill?', 'Kis tarah ka kaam pasand hai?']) {
    assert.equal(unsupportedActionProgress(text,value),false);
  }
});
test('reject invented progress for both personas without touching the reading or retrying', async () => {
  const base='Existing mixed chart explanation.\n\nNovember 2031 se July 2034 sambhavit hai.';
  for (const user_gender of ['male','female']) {
    let calls=0;
    const output=await contextualClosing(base,{...value,user_gender,history:[{role:'assistant',text:base+'\n\n'+bad}]},{generate:async (_prompt,data)=>{
      calls++;
      assert.ok(!JSON.parse(data).history.some(turn=>turn.text===bad));
      return bad;
    }});
    assert.equal(calls,1);
    assert.ok(output.startsWith(base));
    assert.ok(!output.includes(bad));
  }
});
