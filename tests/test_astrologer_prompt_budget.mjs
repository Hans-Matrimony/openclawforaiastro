import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { auditPromptBudget } from "../scripts/audit-astrologer-prompt-budget.mjs";

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "astro-budget-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("rejects per-file truncation using runtime UTF-16 characters", (t) => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, "SOUL.md"), "😀".repeat(51));
  assert.equal(auditPromptBudget(dir, 102).fits, true);
  assert.equal(auditPromptBudget(dir, 101).fits, false);
  assert.deepEqual(auditPromptBudget(dir, 101).oversized, ["SOUL.md"]);
});

test("rejects aggregate overflow even when every file fits", (t) => {
  const dir = fixture(t);
  for (const name of ["AGENTS.md", "SOUL.md", "TOOLS.md", "MEMORY.md"]) {
    fs.writeFileSync(path.join(dir, name), "x".repeat(1000));
  }
  assert.equal(auditPromptBudget(dir, 2000, 5000).fits, false);
  assert.equal(auditPromptBudget(dir, 2000, 7000).fits, true);
});

test("counts lower-case memory fallback without exposing its contents", (t) => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, "memory.md"), "private".repeat(100));
  const report = auditPromptBudget(dir);
  assert.equal(report.chars, 700);
  assert.ok(!JSON.stringify(report).includes("private"));
  assert.throws(() => auditPromptBudget(dir, 0));
});
