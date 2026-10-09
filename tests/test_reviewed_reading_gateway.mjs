// Opt-in installed-runtime check. Uses synthetic data, loopback and no model API.
// OPENCLAW_TEST_ENTRY must point to the published 2026.3.28 dist/entry.js.
// PATH must contain python3 with the pinned numerical dependencies installed.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { validReadingResult } from '../extensions/reviewed-reading/route.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('published gateway authenticates and delivers consistent zero-model readings', {
  skip: !process.env.OPENCLAW_TEST_ENTRY, timeout: 240000,
}, async () => {
  const entry = path.resolve(process.env.OPENCLAW_TEST_ENTRY);
  const pkg = JSON.parse(await fs.readFile(path.resolve(path.dirname(entry), '../package.json'), 'utf8'));
  assert.equal(pkg.version, '2026.3.28');
  const state = await fs.mkdtemp(path.join(os.tmpdir(), 'astrofriend-gateway-'));
  const token = randomBytes(32).toString('hex');
  const reservation = net.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  await fs.cp(path.join(root, 'skills/kundli'), path.join(state, 'skills/kundli'), { recursive: true });
  const configPath = path.join(state, 'openclaw.json');
  await fs.writeFile(configPath, JSON.stringify({
    gateway: { mode: 'local', port, bind: 'loopback', auth: { mode: 'token', token }, controlUi: { enabled: false } },
    agents: { defaults: { workspace: path.join(state, 'workspace'), heartbeat: { every: '0m' } } },
    plugins: { allow: ['reviewed-reading'], load: { paths: [path.join(root, 'extensions/reviewed-reading')] },
      entries: { 'reviewed-reading': { enabled: true } } },
  }));
  const child = spawn(process.execPath, [entry, 'gateway', '--port', String(port), '--bind', 'loopback'], {
    env: { ...process.env, OPENCLAW_STATE_DIR: state, OPENCLAW_CONFIG_PATH: configPath },
    stdio: ['ignore', 'ignore', 'ignore'], windowsHide: true,
  });
  let spawnError;
  child.on('error', error => { spawnError = error; });
  const closed = new Promise(resolve => child.once('close', resolve));
  const url = `http://127.0.0.1:${port}/astrofriend/reading`;
  const request = (method, body, authorization = `Bearer ${token}`) => fetch(url, {
    method, headers: { authorization, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(35000),
  });
  try {
    const until = Date.now() + 180000;
    for (;;) {
      if (spawnError) throw spawnError;
      assert.equal(child.exitCode, null, 'gateway exited before readiness');
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
        await response.arrayBuffer();
        if (response.status === 401) break;
      } catch {}
      assert.ok(Date.now() < until, 'gateway readiness deadline exceeded');
      await delay(250);
    }
    for (const [method, body, auth, expected] of [
      ['POST', {}, '', 401], ['POST', {}, 'Bearer incorrect', 401],
      ['POST', {}, undefined, 400], ['GET', undefined, undefined, 405],
      ['POST', { x: 'x'.repeat(5000) }, undefined, 413],
    ]) {
      const response = await request(method, body, auth);
      await response.arrayBuffer();
      assert.equal(response.status, expected);
    }
    const fingerprints = new Set();
    for (const [topic, language, intent] of [
      ['career', 'english', 'overview'], ['education', 'hinglish', 'overview'], ['marriage', 'english', 'timing'],
    ]) {
      const input = { dob: '2002-02-16', tob: '08:19', place: 'Delhi', topic, language, intent };
      const response = await request('POST', input);
      const result = await response.json();
      assert.equal(response.status, 200);
      assert.equal(validReadingResult(result, input), true);
      assert.equal(result.evidence.chart_facts.lagna, 'Aquarius');
      fingerprints.add(result.evidence.input_fingerprint);
    }
    assert.equal(fingerprints.size, 1);
  } finally {
    child.kill();
    await closed;
    // Only the unique temporary directory created by this test is removed.
    assert.equal(path.dirname(state), os.tmpdir());
    assert.ok(path.basename(state).startsWith('astrofriend-gateway-'));
    await fs.rm(state, { recursive: true, force: true });
  }
});
