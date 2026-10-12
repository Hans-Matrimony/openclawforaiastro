#!/usr/bin/env node
// HANS compliance harness — verifies replies against the Reading Output Contract
// in hans-astro-workspace/SOUL.md.
//
// Usage:
//   node hans-compliance/run.mjs --mock                                   # self-test, no API key
//   DEEPSEEK_API_KEY=sk-... node hans-compliance/run.mjs --model deepseek-chat
//   node hans-compliance/run.mjs --mock --scenario gf-marriage            # one scenario
//
// Live mode calls DeepSeek with SOUL.md as the system prompt and captured VedAstro
// tool output as the user turn, then runs the same contract checks used in mock mode.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scenarios } from './scenarios.mjs';
import { checkScenario } from './checks.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

const args = process.argv.slice(2);
const mock = args.includes('--mock');
const modelIdx = args.indexOf('--model');
const model = modelIdx > -1 ? args[modelIdx + 1] : 'deepseek-chat';
const scIdx = args.indexOf('--scenario');
const only = scIdx > -1 ? args[scIdx + 1] : null;

const soulPath = join(repoRoot, 'hans-astro-workspace', 'SOUL.md');
let soul;
try {
  soul = readFileSync(soulPath, 'utf8');
} catch {
  console.error(`SOUL.md not found at ${soulPath} — run from the repo root or fix the path.`);
  process.exit(2);
}

async function callDeepSeek(userTurn) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    console.error('DEEPSEEK_API_KEY is not set. Live mode needs it — try --mock first.');
    process.exit(2);
  }
  const body = {
    model,
    temperature: 0.7,
    max_tokens: 600,
    messages: [
      { role: 'system', content: soul },
      { role: 'user', content: userTurn },
    ],
  };
  const call = () =>
    fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
  let res = await call();
  if (res.status === 429 || res.status >= 500) {
    console.error('API busy — waiting 65s for one retry (free-tier rule from vedastro-chart skill).');
    await new Promise((r) => setTimeout(r, 65000));
    res = await call();
  }
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.choices[0].message.content.trim();
}

let brokenMocks = 0;
let warnCount = 0;
let ran = 0;

for (const sc of scenarios) {
  if (only && sc.name !== only) continue;
  ran++;
  console.log(`\n=== ${sc.name} (${sc.expect}${sc.timing ? ', timing' : ''}) ===`);
  console.log(`Q: ${sc.question}`);

  if (mock) {
    for (const [label, reply] of [['good', sc.mockGood], ['bad', sc.mockBad]]) {
      const results = checkScenario(sc, reply);
      const hard = results.filter((r) => !r.pass);
      const warns = results.filter((r) => r.warn && r.pass);
      const isBad = label === 'bad';
      const ok = isBad ? hard.length > 0 : hard.length === 0;
      if (!ok) brokenMocks++;
      warnCount += warns.length;
      console.log(
        ` [mock-${label}] ${ok ? 'OK' : 'BROKEN'} — hard-fails: ${hard.length ? hard.map((r) => r.id).join(', ') : 'none'}` +
          (warns.length ? ` | warns: ${warns.map((r) => r.id).join(', ')}` : '')
      );
      if (isBad && !ok) console.log('   !! bad reply passed all checks — validators need tightening');
      if (!isBad && !ok) results.filter((r) => !r.pass).forEach((r) => console.log(`   !! ${r.id}: ${r.note}`));
    }
  } else {
    if (sc.expect === 'reading' && !sc.userTurn.includes('[TOOL RESULTS')) {
      console.error('Fixtures missing — run: node hans-compliance/tools/make-fixtures.mjs <rahunova-re-dir> hans-compliance/fixtures');
      process.exit(2);
    }
    let reply;
    try {
      reply = await callDeepSeek(sc.userTurn);
    } catch (err) {
      console.error(`API call failed: ${err.message}`);
      process.exit(2);
    }
    const results = checkScenario(sc, reply);
    const hard = results.filter((r) => !r.pass);
    const warns = results.filter((r) => r.warn && r.pass);
    brokenMocks += hard.length;
    warnCount += warns.length;
    console.log('--- reply ---\n' + reply);
    console.log('--- checks ---');
    results.forEach((r) => console.log(` ${r.pass ? (r.warn ? 'WARN' : 'PASS') : 'FAIL'} ${r.id}${r.note ? ' — ' + r.note : ''}`));
  }
}

console.log(
  `\n${brokenMocks ? `FAILED (${brokenMocks} problem${brokenMocks > 1 ? 's' : ''})` : 'ALL OK'}` +
    (warnCount ? ` — ${warnCount} warn-level note${warnCount > 1 ? 's' : ''}` : '')
);
process.exit(brokenMocks ? 1 : 0);
