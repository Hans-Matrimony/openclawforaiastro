import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'openclaw.json'), 'utf8'));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('deterministic reading route is authenticated and included in deployed assets', () => {
  assert.ok(config.plugins.load.paths.includes('/app/extensions/reviewed-reading'));
  assert.equal(config.plugins.entries['reviewed-reading'].enabled, true);
  assert.match(read('Dockerfile'), /COPY extensions\/reviewed-reading\/ \/app\/extensions\/reviewed-reading\//);
  assert.match(read('extensions/reviewed-reading/index.ts'), /auth: 'gateway'/);
  assert.match(read('extensions/reviewed-reading/route.mjs'), /--render-reading/);
});

test('reply repair cannot run tools, load skills, heartbeat or cascade across providers', () => {
  assert.equal(config.agents.list[0].id, 'main');
  const agent = config.agents.list.find(a => a.id === 'reply_repair');
  assert.deepEqual(agent.tools.deny, ['*']);
  assert.deepEqual(agent.skills, []);
  assert.deepEqual(agent.model.fallbacks, []);
  // An explicit per-agent heartbeat would change scheduling for every agent.
  // With no overrides, only the unchanged default (main) receives heartbeats.
  assert.ok(config.agents.list.every(a => a.heartbeat === undefined));
  assert.ok(!config.bindings.some(binding => binding.agentId === agent.id));
});

test('repair policy preserves persona and media but cannot add reading claims', () => {
  const policy = read('app/whatsapp-support/workspace-reply-repair/AGENTS.md');
  for (const requirement of ['persona', 'untrusted data', 'IMAGE_URL', 'Do not add facts', 'Return only']) {
    assert.ok(policy.includes(requirement), requirement);
  }
  assert.ok(policy.length < 1500);
  assert.ok(read('Dockerfile').includes('COPY app/whatsapp-support/workspace-reply-repair/ /app/bootstrap/workspace-reply-repair/'));
  assert.ok(read('scripts/start-openclaw-gateway.sh').includes('$APP_DIR/bootstrap/workspace-reply-repair/.'));
});

test('astrologer loop protection has ordered thresholds and preserves its tools', () => {
  const agent = config.agents.list.find(a => a.id === 'astrologer');
  const policy = agent.tools.loopDetection;
  assert.equal(policy.enabled, true);
  assert.ok(policy.warningThreshold < policy.criticalThreshold);
  assert.ok(policy.criticalThreshold < policy.globalCircuitBreakerThreshold);
  assert.ok(policy.globalCircuitBreakerThreshold <= policy.historySize);
  for (const tool of ['exec', 'read', 'process', 'tts', 'image']) {
    assert.ok(agent.tools.alsoAllow.includes(tool));
  }
});
