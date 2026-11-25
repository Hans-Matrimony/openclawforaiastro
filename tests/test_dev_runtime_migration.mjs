import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
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

async function verifyMigration(input, runtime, env) {
  const original = structuredClone(input);
  const result = await migrateDevConfig(input, runtime, env);
  assert.deepEqual(input, original);
  assert.deepEqual(Object.keys(result.agents.entries).sort(), input.agents.list.map(a => a.id).sort());
  assert.equal(result.agents.defaults.heartbeat, undefined);
  assert.equal(result.channels.whatsapp.streaming.block.enabled, input.channels.whatsapp.blockStreaming);
  assert.equal(result.channels.whatsapp.streaming.chunkMode, input.channels.whatsapp.chunkMode);
  assert.equal(result.channels.whatsapp.heartbeatVisibility, undefined);
  assert.equal(result.channels.whatsapp.heartbeat, undefined);
  assert.deepEqual(result.plugins, input.plugins);
  assert.ok(result.agents.defaults.modelPolicy.allow.includes(result.agents.entries.astrologer.model.primary));
  for (const agent of input.agents.list) {
    const primary = typeof agent.model === 'string' ? agent.model : agent.model?.primary;
    if (primary) assert.equal(result.agents.entries[agent.id].model.primary?.replace(/^astro-budget-/, '') ?? result.agents.entries[agent.id].model, primary);
  }
  const repeated = await migrateDevConfig(configureProviderRender(result, {}), runtime, env);
  assert.deepEqual(repeated, result);
  assert.equal(result.bindings.length, input.bindings.length);
}

test('full shipped config migrates, preserves agents and models, and survives repeated startup', { skip: !runtime }, async () => {
  // The installed runtime's test loader expects unpublished channel fixtures.
  // Use an ordinary child process to exercise the shipped channel contracts.
  const childEnv = { ...process.env };
  delete childEnv.NODE_TEST_CONTEXT;
  const code = `import assert from 'node:assert/strict';
    import {migrateDevConfig} from ${JSON.stringify(new URL('../scripts/configure-dev-runtime.mjs', import.meta.url).href)};
    import {configureProviderRender} from ${JSON.stringify(new URL('../scripts/configure-provider-render.mjs', import.meta.url).href)};
    const input = ${JSON.stringify(input)};
    input.plugins.load.paths = input.plugins.load.paths.map(p => p.replace('/app/', ${JSON.stringify(fileURLToPath(new URL('../', import.meta.url)).replaceAll('\\', '/'))}));
    await (${verifyMigration.toString()})(input,${JSON.stringify(runtime)},${JSON.stringify(env)});`;
  await promisify(execFile)(process.execPath, ['--input-type=module', '-e', code], { env: childEnv, timeout: 60000, windowsHide: true });
});

test('production Dockerfile retains its original runtime', () => {
  const source = fs.readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
  assert.match(source, /FROM node:22-bookworm-slim/);
  assert.match(source, /openclaw@2026\.3\.28/);
});

test('custom HTTP routes and budget hooks are loaded at gateway startup', () => {
  for (const id of ['reviewed-reading', 'inference-budget']) {
    const manifest = JSON.parse(fs.readFileSync(new URL(`../extensions/${id}/openclaw.plugin.json`, import.meta.url)));
    assert.equal(manifest.activation.onStartup, true);
  }
});
