import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const runner = fileURLToPath(new URL("./run.mjs", import.meta.url));
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) =>
    ["SYSTEMROOT", "WINDIR", "PATH", "PATHEXT", "COMSPEC", "TEMP", "TMP"].includes(
      key.toUpperCase(),
    ),
  ),
);
function run(args) {
  return spawnSync(process.execPath, [runner, "--mock", ...args], {
    env,
    encoding: "utf8",
    windowsHide: true,
    timeout: 15000,
  });
}

void test("unknown and missing scenarios fail instead of reporting an empty success", () => {
  for (const args of [["--scenario", "not-a-scenario"], ["--scenario"]]) {
    const result = run(args);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Unknown or missing scenario/);
    assert.doesNotMatch(result.stdout, /ALL OK/);
  }
});

void test("known mock scenarios still execute and classify both reply fixtures", () => {
  const result = run(["--scenario", "greeting"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /=== greeting/);
  assert.match(result.stdout, /mock-good.*OK/);
  assert.match(result.stdout, /mock-bad.*OK/);
  assert.match(result.stdout, /ALL OK/);
});
