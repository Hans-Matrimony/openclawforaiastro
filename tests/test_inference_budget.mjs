import assert from 'node:assert/strict';
import test from 'node:test';
import { ModelBudget, boundPayload, createBudgetTransport } from '../extensions/inference-budget/transport.mjs';
import { createBudgetRuntime } from '../extensions/inference-budget/runtime.mjs';
import { validateBudgetConfig } from '../scripts/validate-inference-budget.mjs';

const body = JSON.stringify({ messages: [{ role: 'user', content: 'hello' }], max_tokens: 9999 });

test('reserves every attempt including identical SDK retries and provider changes', async () => {
  let sends = 0;
  const transport = createBudgetTransport(async () => { sends++; return new Response('{}', { status: 503 }); });
  const budget = new ModelBudget({ attempts: 2 });
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await transport.scope.run({ budget, api: 'openai-completions' },
      () => transport.fetch('https://example.invalid', { method: 'POST', body }));
    assert.equal(response.status, attempt < 2 ? 503 : 400);
  }
  assert.equal(sends, 2);
  assert.equal(budget.outputTokens, 4096);
});

test('unscoped traffic and simultaneous sessions remain independent', async () => {
  let sends = 0;
  const transport = createBudgetTransport(async () => { sends++; return new Response('{}'); });
  const budgets = [new ModelBudget({ attempts: 1 }), new ModelBudget({ attempts: 1 })];
  await Promise.all(budgets.map(budget => transport.scope.run({ budget, api: 'openai-completions' }, async () => {
    await Promise.resolve();
    assert.equal((await transport.fetch('https://example.invalid', { body })).status, 200);
    assert.equal((await transport.fetch('https://example.invalid', { body })).status, 400);
  })));
  assert.equal((await transport.fetch('https://example.invalid')).status, 200);
  assert.equal(sends, 3);
});

test('all supported payloads cap real output fields and reject multiple candidates', () => {
  for (const [api, payload, extract] of [
    ['openai-completions', { messages: [], max_completion_tokens: 9999 }, p => p.max_completion_tokens],
    ['openai-responses', { input: [], max_output_tokens: 9999 }, p => p.max_output_tokens],
    ['google-generative-ai', { contents: [], generationConfig: { maxOutputTokens: 9999 } }, p => p.generationConfig.maxOutputTokens],
  ]) assert.equal(extract(JSON.parse(boundPayload(JSON.stringify(payload), api, new ModelBudget()))), 2048);
  assert.throws(() => boundPayload('{"messages":[],"n":2}', 'openai-completions', new ModelBudget()));
  assert.throws(() => boundPayload('{"contents":[],"generationConfig":{"candidateCount":2}}', 'google-generative-ai', new ModelBudget()));
});

test('aggregate bytes, output reservation and elapsed time fail before another send', () => {
  const bytes = new ModelBudget({ totalBytes: 100 });
  boundPayload(body, 'openai-completions', bytes);
  assert.throws(() => boundPayload(body, 'openai-completions', bytes));
  const tokens = new ModelBudget({ totalOutputTokens: 2048 });
  boundPayload(body, 'openai-completions', tokens);
  assert.throws(() => boundPayload(body, 'openai-completions', tokens));
  let now = 0;
  const timed = new ModelBudget({ durationMs: 10 }, () => now);
  now = 10;
  assert.throws(() => boundPayload(body, 'openai-completions', timed));
  assert.equal(timed.attempts, 0);
});

test('malformed, oversized and unsupported payloads fail closed', async () => {
  for (const payload of [null, '{}', 'null', '[]', '{', ' '.repeat(200000)]) {
    const transport = createBudgetTransport(() => { throw new Error('must not send'); });
    const response = await transport.scope.run({ budget: new ModelBudget(), api: 'openai-completions' },
      () => transport.fetch('https://example.invalid', { body: payload }));
    assert.equal(response.status, 400);
  }
});

test('request uses a deadline, preserves caller cancellation and disables redirects', async () => {
  const abort = new AbortController();
  const transport = createBudgetTransport(async (_url, init) => {
    assert.equal(init.redirect, 'error');
    assert.equal(init.signal.aborted, true);
    assert.equal(JSON.parse(init.body).max_tokens, 2048);
    return new Response('{}');
  });
  abort.abort();
  await transport.scope.run({ budget: new ModelBudget(), api: 'openai-completions' },
    () => transport.fetch('https://example.invalid', { body, signal: abort.signal }));
});

test('fallback attempts and session rollover retain one run budget; new turns reset it', () => {
  const runtime = createBudgetRuntime();
  const context = { agentId: 'astrologer', sessionId: 'one', runId: 'run-one' };
  const budget = runtime.bind(context, '[Language: hindi]');
  budget.reserve(100, 50);
  assert.equal(runtime.bind(context), budget);
  assert.equal(runtime.bind({ ...context, sessionId: 'rollover' }), budget);
  assert.equal(runtime.forSession('rollover').attempts, 1);
  assert.equal(budget.language, 'hindi');
  assert.notEqual(runtime.bind({ ...context, runId: 'run-two' }), budget);
  assert.equal(runtime.forSession('one').attempts, 0);
  assert.equal(runtime.bind({ ...context, agentId: 'tarot_reader' }), undefined);
});

test('SDK compaction and ordinary generation share limits without modifying provider auth', async () => {
  const sends = [];
  const runtime = createBudgetRuntime({ limits: { attempts: 2 }, fetchImpl: async (_url, init) => {
    sends.push(init); return new Response('{}');
  } });
  const providerMap = new Map();
  const stream = (model, _context, options) => {
    const result = runtime.transport.fetch('https://example.invalid', { method: 'POST', body }).then(response => ({
      role: 'assistant', content: [{ type: 'text', text: response.ok ? 'ok' : 'failure' }],
      stopReason: response.ok ? 'stop' : 'error', provider: model.provider,
    }));
    return { async *[Symbol.asyncIterator]() { const message = await result;
      yield message.stopReason === 'error' ? {type:'error',error:message} : {type:'done',message};
    }, result: () => result };
  };
  providerMap.set('openai-completions', { api: 'openai-completions', stream, streamSimple: stream });
  const sdk = { getApiProviders: () => [...providerMap.values()], getApiProvider: api => providerMap.get(api),
    registerApiProvider: provider => providerMap.set(provider.api, provider) };
  runtime.bind({ agentId: 'astrologer', sessionId: 'session', runId: 'run' });
  const model = { id: 'unchanged-model', api: 'openai-completions', provider: 'unchanged-provider' };
  runtime.bindModel(model, 'session');
  runtime.installSdk(sdk); runtime.installSdk(sdk);
  const invoke = options => sdk.getApiProvider(model.api).streamSimple(model, {}, options).result();
  assert.equal((await invoke({sessionId:'session',apiKey:'unchanged'})).stopReason, 'stop');
  assert.equal((await invoke({apiKey:'unchanged'})).stopReason, 'stop');
  assert.equal((await invoke({apiKey:'unchanged'})).stopReason, 'error', 'compaction cannot save a fallback as its summary');
  const final = await invoke({sessionId:'session',apiKey:'unchanged'});
  assert.equal(final.stopReason, 'stop');
  assert.match(final.content[0].text, /couldn’t finish/);
  assert.equal(final.provider, 'unchanged-provider');
  assert.equal(sends.length, 2);
  const unguarded = await invoke({sessionId:'another-agent',apiKey:'unchanged'});
  assert.equal(unguarded.content[0].text,'ok','another agent must not inherit this model budget');
  assert.equal(sends.length,3);
});

test('startup rejects disabled guards and unverified transports', () => {
  const config = {plugins:{load:{paths:['/app/extensions/inference-budget']},entries:{'inference-budget':{enabled:true}}},
    models:{providers:{test:{api:'openai-completions',models:[{id:'model'}]}}},
    agents:{list:[{id:'astrologer',model:{primary:'test/model',fallbacks:[]}}]}};
  assert.doesNotThrow(()=>validateBudgetConfig(config));
  config.models.providers.test.api='openai-responses';
  assert.throws(()=>validateBudgetConfig(config),/transport/);
  config.models.providers.test.api='openai-completions';
  config.plugins.entries['inference-budget'].enabled=false;
  assert.throws(()=>validateBudgetConfig(config),/enabled/);
});

test('startup checks inherited fallbacks, per-model transports and plugin exclusions', () => {
  const config = {plugins:{load:{paths:['/app/extensions/inference-budget']},entries:{'inference-budget':{enabled:true}}},
    models:{providers:{test:{api:'openai-completions',models:[{id:'model'},{id:'other',api:'openai-responses'}]}}},
    agents:{defaults:{model:{primary:'test/model',fallbacks:['test/other']}},list:[{id:'astrologer',model:'test/model'}]}};
  assert.throws(()=>validateBudgetConfig(config),/transport/,'string primary inherits fallback');
  config.agents.list[0].model={primary:'test/model'};
  assert.throws(()=>validateBudgetConfig(config),/transport/,'object primary inherits fallback');
  config.agents.list[0].model.fallbacks=[];
  assert.doesNotThrow(()=>validateBudgetConfig(config),'explicit empty fallbacks override defaults');
  config.plugins.allow=['reviewed-reading'];
  assert.throws(()=>validateBudgetConfig(config),/allowed/);
  config.plugins.allow=['inference-budget'];
  config.plugins.deny=['inference-budget'];
  assert.throws(()=>validateBudgetConfig(config),/allowed/);
  delete config.plugins.deny;
  config.plugins.enabled=false;
  assert.throws(()=>validateBudgetConfig(config),/enabled/);
  delete config.plugins.enabled;
  config.plugins.load.paths=[];
  assert.throws(()=>validateBudgetConfig(config),/load path/);
});
