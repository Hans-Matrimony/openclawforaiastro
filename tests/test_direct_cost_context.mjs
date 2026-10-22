import test from "node:test";
import assert from "node:assert/strict";
import { SOURCE_PROMPT } from "../extensions/reviewed-reading/direct/source-contract.mjs";
import {
  compactPrompt,
  uniqueMemory,
} from "../extensions/reviewed-reading/direct/compact-prompt.mjs";
import { readingContext } from "../extensions/reviewed-reading/direct/context.mjs";

void test("runtime compaction keeps reading and memory contracts but removes repeated examples", () => {
  const compact = compactPrompt(SOURCE_PROMPT);
  assert.ok(compact.length < SOURCE_PROMPT.length * 0.85);
  for (const rule of [
    "# Completed Reading Output Contract",
    "# Persistent Memory",
    "<user_memory>",
    "# Sensitive Questions Policy",
    "# Friend Mode",
    "Horary numbers:",
    "Never infer a birth date",
    "# Tool Usage",
  ]) {
    assert.ok(compact.includes(rule), rule);
  }
  assert.ok(!compact.includes("# Examples of correct behavior"));
});

void test("memory cleanup removes duplicates without losing corrections or separate people", () => {
  const rows = [
    "[birth] subject=Self | time=08:00",
    "[birth] subject=Self | time=08:00",
    "[birth] subject=Partner | time=08:00",
    "[birth] subject=Self | time=09:00",
    "Works nights",
    "Works  nights",
    null,
  ];
  assert.deepEqual(uniqueMemory(rows), [rows[0], rows[2], rows[3], rows[4]]);
});

void test("separate companion is not requested twice and preserves persona, profile and facts", async () => {
  const context = await readingContext(
    {
      query: "education?",
      history: [],
      language: "hinglish",
      user_gender: "male",
      birth: { date: "2000-01-01", time: "12:00", location_name: "Delhi" },
    },
    { read: async () => ["Works nights", "Works nights", "Wants MBA"] },
    (x) => x,
    new Date("2026-10-19T12:00:00Z"),
    { separateCompanion: true },
  );
  assert.match(context.prompt, /Do not generate a friendly closing/);
  assert.ok(!context.prompt.includes("# Friendly closing"));
  assert.match(context.prompt, /Meera/);
  assert.equal(context.profile.status, "READY");
  assert.deepEqual(context.memoryFacts, ["Works nights", "Wants MBA"]);
  assert.match(context.prompt, /Do not display bindu totals/);
});
