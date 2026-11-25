import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { migrateDevConfig } from '../scripts/configure-dev-runtime.mjs';
import { configureProviderRender } from '../scripts/configure-provider-render.mjs';

const runtime = process.env.OPENCLAW_TEST_RUNTIME_ROOT;
const env = { VEDASTRO_DIRECT_ENVIRONMENT: 'development', OPENCLAW_SKIP_CHANNELS: '1', OPENCLAW_SKIP_CRON: '1', ASTROFRIEND_OPENCLAW_RUNTIME: '2026.11.10' };
const input = JSON.parse(fs.readFileSync(new URL('../openclaw.json', import.meta.url)));

test('latest dev migration refuses production or enabled external delivery', async () => {
  for (const patch of [{ VEDASTRO_DIRECT_ENVIRONMENT: 'production' }, { OPENCLAW_SKIP_CHANNELS: '0' }, { OPENCLAW_SKIP_CRON: '0' }]) {
    await assert.rejects(migrateDevConfig(input, 'unused', { ...env, ...patch }), /isolated development/);
  }
});

test('full shipped config migrates, preserves agents and models, and survives repeated startup', { skip: !runtime }, async () => {
  const original = structuredClone(input);
  const result = await migrateDevConfig(input, runtime, env);
  assert.deepEqual(input, original);
  assert.deepEqual(Object.keys(result.agents.entries).sort(), input.agents.list.map(a => a.id).sort());
  assert.equal(result.agents.defaults.heartbeat, undefined);
  assert.ok(result.agents.defaults.modelPolicy.allow.includes(result.agents.entries.astrologer.model.primary));
  for (const agent of input.agents.list) {
    const primary = typeof agent.model === 'string' ? agent.model : agent.model?.primary;
    if (primary) assert.equal(result.agents.entries[agent.id].model.primary?.replace(/^astro-budget-/, '') ?? result.agents.entries[agent.id].model, primary);
  }
  const repeated = await migrateDevConfig(configureProviderRender(result, {}), runtime, env);
  assert.deepEqual(repeated, result);
  assert.equal(result.bindings.length, input.bindings.length);
});

test('production Dockerfile retains its original runtime', () => {
  const source = fs.readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
  assert.match(source, /FROM node:22-bookworm-slim/);
  assert.match(source, /openclaw@2026\.3\.28/);
});
