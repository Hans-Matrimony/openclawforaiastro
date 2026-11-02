import test from 'node:test';
import assert from 'node:assert/strict';
import { emotionalReplyFallback } from '../extensions/reviewed-reading/direct/emotional-friendship.mjs';
import { contextualClosing } from '../extensions/reviewed-reading/direct/contextual-closing.mjs';
import { asksForTiming } from '../extensions/reviewed-reading/direct/reading-intent.mjs';

test('next supported dasha period requests are timing requests, definitions are not', () => {
  for (const question of ['Meri shaadi ke liye agla supported dasha period kaunsa hai?', 'What is the next favourable dasha period for my marriage?', 'Mera agla antardasha period?', 'Meri shaadi ka agla sambhavit samay?']) assert.equal(asksForTiming(question),true,question);
  for (const question of ['What is a dasha period?', 'Meri dasha ka matlab samjhaiye.', 'Meri dost upset hai, kaise sunun?']) assert.equal(asksForTiming(question),false,question);
});

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
test('failed optional chart clarification cannot fall back to a personal interview', async () => {
  const reading='Jupiter is in house 7.\n\nNovember 2031 to July 2034 is possible.';
  for (const generate of [async()=>{throw new Error('unavailable');},async()=> 'Shaadi ya rishte ko lekar aapke mann mein kya hai?']) {
    assert.equal(await contextualClosing(reading,{query:'Explain the basis.',readingOnlyClosing:true},{generate}),reading);
  }
});
