import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import { QUESTIONS, parseVerdict, verifyAnswer, validateReviewInput, createReviewHandler } from '../extensions/reviewed-reading/verifier.mjs';

const verdict = (p = 1) => ({ answers: Object.fromEntries(Object.keys(QUESTIONS).map(k => [k,
  { type: 'choice', choice: p >= 0.5 ? 'supported' : 'unsupported', confidence: 0.9,
    probabilities: { supported: p, unsupported: 1 - p } }])), usage: { cost: 0.001, input_tokens: 123, output_tokens: 40 } });
const input = { dob: '2000-01-01', tob: '00:00', place: 'Delhi', topic: 'career', question: 'My career?', draft: 'Draft' };
test('strict schemas reject incomplete, contradictory and nonfinite scores', () => {
  assert.equal(parseVerdict(verdict()).status, 'supported');
  assert.equal(parseVerdict(verdict()).input_tokens, 123);
  assert.equal(parseVerdict(verdict(0.94)).status, 'needs_review');
  for (const mutate of [d => delete d.answers.assurance, d => d.answers.grounding.confidence = NaN,
    d => d.answers.grounding.probabilities.supported = true,
    d => d.answers.grounding.choice = 'unsupported',
    d => d.answers.grounding.probabilities.extra = 0]) {
    const d = verdict(); mutate(d); assert.throws(() => parseVerdict(d));
  }
  assert.equal(parseVerdict({ ...verdict(), usage: {} }).cost_usd, null);
});
test('caller cannot supply evidence, choose model, override mode or exceed bounds', () => {
  assert.deepEqual(validateReviewInput(input), input);
  for (const value of [{ ...input, evidence: {} }, { ...input, mode: 'enforce' },
    { ...input, draft: 'x'.repeat(8001) }, { ...input, question: '' }, { ...input, topic: 'health' }]) {
    assert.throws(() => validateReviewInput(value));
  }
});
test('one bounded provider call; only compact evidence sent, no identity', async () => {
  let calls = 0;
  const result = await verifyAnswer('Question', 'Draft', { userId: 'PRIVATE', factors: [], limits: [] }, {
    apiKey: 'test-only', fetcher: async (url, options) => {
      calls++; assert.equal(url, 'https://openrouter.ai/api/alpha/decisions');
      assert.equal(options.redirect, 'error'); assert.ok(options.signal);
      assert.ok(!options.body.includes('PRIVATE'));
      return new Response(JSON.stringify(verdict()));
    } });
  assert.equal(result.status, 'supported'); assert.equal(calls, 1);
  for (const response of [new Response('', { status: 429 }), new Response('bad json'), new Response('x'.repeat(33000))]) {
    let attempts = 0;
    const r = await verifyAnswer('q', 'd', {}, { apiKey: 'test', fetcher: async () => { attempts++; return response; } });
    assert.equal(r.status, 'unavailable'); assert.equal(r.cost_usd, null); assert.equal(attempts, 1);
  }
  assert.equal((await verifyAnswer('q', 'd', {}, { apiKey: '' })).attempts, 0);
});
test('shadow never edits; enforce rejects uncertainty or outage with deterministic fallback', async () => {
  for (const mode of ['off', 'shadow', 'enforce']) for (const status of ['supported', 'needs_review', 'unavailable']) {
    let calculates = 0, reviews = 0;
    const handler = createReviewHandler({ mode: () => mode,
      calculate: async () => { calculates++; return { text: 'Reviewed fallback', evidence: { input_fingerprint: 'a'.repeat(64) } }; },
      verify: async () => { reviews++; return { status }; } });
    const req = Object.assign(Readable.from([JSON.stringify(input)]), { method: 'POST' });
    const res = { setHeader() {}, writeHead(s) { this.status = s; }, end(b) { this.body = JSON.parse(b); } };
    await handler(req, res);
    assert.equal(res.status, 200);
    assert.equal(res.body.text, mode === 'enforce' && status !== 'supported' ? 'Reviewed fallback' : input.draft);
    assert.equal(calculates, mode === 'off' ? 0 : 1); assert.equal(reviews, calculates);
  }
});
