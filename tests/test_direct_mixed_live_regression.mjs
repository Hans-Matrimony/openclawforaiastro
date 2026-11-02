import test from 'node:test';
import assert from 'node:assert/strict';
import { emotionalReplyFallback } from '../extensions/reviewed-reading/direct/emotional-friendship.mjs';
import { contextualClosing } from '../extensions/reviewed-reading/direct/contextual-closing.mjs';

test('supporting a friend keeps the friend as the listener recipient', () => {
  const reply = emotionalReplyFallback({ query: 'Meri dost breakup ke baad udaas hai. Main theek hoon. Uski baat kaise sunun?', language: 'hinglish' });
  assert.match(reply, /Unhe apni baat poori karne dein/);
  assert.doesNotMatch(reply, /aapko madad chahiye|aap udaas/);
});

test('boundary fallback acknowledges explicitly disclosed upset', () => {
  const reply = emotionalReplyFallback({query:'Dost ne hurt kiya aur main upset hoon. Space lena chahta hoon, kaise bolun?', language:'hinglish'});
  assert.match(reply, /Aap upset hain/);
  assert.match(reply, /thoda waqt/);
});

test('completed reading rejects a personal interview without changing evidence', async () => {
  const reading = 'Jupiter is in house 7.\n\nThe supported window is November 2031 to July 2034.';
  for (const closing of ['Kya aapne kisi se baat karni shuru ki hai, ya waiting mode mein hain?', 'Kya aapne iski positive energy kisi decision mein feel kiya hai?', 'Kya aapne is time ke liye koi step socha hai?', 'NONE']) {
    const reply = await contextualClosing(reading, {query:'Explain the basis.', readingOnlyClosing:true}, {generate:async () => closing});
    assert.equal(reply, reading);
  }
});
test('reading clarification prompt does not mix personal interview instructions', async () => {
  const reading='Jupiter is in house 7.\n\nThe supported window is November 2031 to July 2034.';
  await contextualClosing(reading,{query:'Explain the basis.',readingOnlyClosing:true},{generate:async prompt=>{
    assert.match(prompt,/current chart explanation/);
    assert.doesNotMatch(prompt,/warm, attentive friend|continue the personal conversation/);
    return 'NONE';
  }});
});
