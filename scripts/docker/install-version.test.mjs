import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const bash = process.env.BASH_PATH || (process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash');
for (const runner of ['install-sh-nonroot', 'install-sh-smoke', 'install-sh-e2e']) {
  test(`${runner}: version display normalization keeps exact version checks`, () => {
    const source = readFileSync(new URL(`./${runner}/run.sh`, import.meta.url), 'utf8');
    const line = source.split('\n').find(line => line.startsWith('INSTALLED_VERSION='));
    assert.ok(line);
    const pipeline = line.slice(line.indexOf('|'), line.lastIndexOf(')'));
    for (const [display, expected] of [
      ['2026.10.9', '2026.10.9'],
      ['OpenClaw 2026.10.9 (8b18b55)', '2026.10.9'],
      ['OpenClaw 2026.10.9', '2026.10.9'],
      ['OpenClaw 2026.10.9 (8b18b55)\r\n', '2026.10.9'],
      ['OpenClaw 2026.10.9-beta.1 (8b18b55)', '2026.10.9-beta.1'],
      ['2026.10.9-beta.1+build.2', '2026.10.9-beta.1+build.2'],
      ['OpenClaw 2026.10.8 (8b18b55)', '2026.10.8'],
      ['unexpected 2026.10.9 text', 'unexpected 2026.10.9 text'],
      ['', ''],
    ]) {
      const result = spawnSync(bash, ['-c', `cat ${pipeline}`], { input: display, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), expected);
      assert.equal(result.stdout.trim() === '2026.10.9', expected === '2026.10.9');
    }
    assert.match(source, /if \[\[ "\$INSTALLED_VERSION" != "\$(LATEST_VERSION|EXPECTED_VERSION)" \]\]; then/);
  });
}
