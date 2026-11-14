import test from 'node:test';
import assert from 'node:assert/strict';
import { pastPrediction, indiaToday, futureDateInstruction } from '../extensions/reviewed-reading/direct/past-prediction.mjs';
import { directAnswer } from '../extensions/reviewed-reading/direct/agent.mjs';
const now = new Date('2026-11-14T06:00:00Z');

test('expired event windows are rejected relative to India today', () => {
  for (const text of [
    'The strongest window is March to July 2025, with a secondary peak in October–December 2025.',
    '2025 mein shaadi hogi.',
    'Your marriage window is January to October 2026.',
    'Job 2026-11-13 ko milegi.',
    'Shaadi 13 November 2026 ko hogi.',
    'Marriage will happen November 13, 2026.',
  ]) assert.equal(pastPrediction(text, now), true, text);
});
test('future periods, ongoing windows, birth details and history are preserved', () => {
  for (const text of [
    'Jupiter ki antardasha mein November 2031 se July 2034 ke beech shaadi ka yog dikh raha hai.',
    'Your marriage window is October 2026 to February 2027.',
    'November 2026 mein opportunity hai.',
    '2026-11-14 ko opportunity hai.',
    'DOB: 2001-01-03. Shaadi 2031 mein sambhavit hai.',
    'Earlier 2025 window was incorrect.',
    '2025 mein naukri lagi thi.',
  ]) assert.equal(pastPrediction(text, now), false, text);
});
test('cutoff changes at India midnight and uses the request clock', () => {
  const before = new Date('2026-11-13T18:29:59Z');
  const after = new Date('2026-11-13T18:30:00Z');
  assert.equal(indiaToday(before), '2026-11-13');
  assert.equal(indiaToday(after), '2026-11-14');
  assert.equal(pastPrediction('Job 2026-11-13 ko milegi.', before), false);
  assert.equal(pastPrediction('Job 2026-11-13 ko milegi.', after), true);
  assert.match(futureDateInstruction(after), /2026-11-14/);
});

test('actual reply paths never deliver the repeatedly proposed expired marriage window', async () => {
  for (const surface of ['whatsapp', 'pwa']) {
    let calls = 0;
    const result = await directAnswer({user_id:'synthetic-future-date',query:'Meri shaadi kab hogi?',birth:{date:'2001-01-03',time:'05:00',location_name:'Delhi'},language:'hinglish',reply_surface:surface,history:[]}, {
      now: () => now,
      env: {OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'},
      makeMemory: () => ({read:async()=>[]}),
      makeTools: () => async () => JSON.stringify({dasha:{upcoming_antardashas:[{lord:'Jupiter',from:'2031-11-15',to:'2034-07-16'}]}}),
      fetchImpl: async () => {
        const message = ++calls === 1 ? {tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]} : {content:'March to July 2025 mein shaadi hogi.'};
        return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));
      },
    });
    assert.doesNotMatch(result.reply, /2025/);
    assert.ok(result.answer_validation.includes('timing_claim_rejected'));
    assert.ok(calls <= 8);
  }
});
