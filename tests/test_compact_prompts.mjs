import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { installPrompts, loadProfile } from "../scripts/install-astrologer-prompts.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const bundle = path.join(root, "app/astrologer-prompt-profiles");
const compact = loadProfile(bundle, "compact");
const legacy = loadProfile(bundle, "legacy");

function workspace(t) {
  const prefix = path.join(os.tmpdir(), "astro-compact-");
  const dir = fs.mkdtempSync(prefix);
  t.after(() => {
    assert.ok(path.resolve(dir).startsWith(path.resolve(prefix)));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}
function seed(dir, files) {
  for (const f of files) {
    const target = path.join(dir, f.relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, f.text);
  }
}

void test("compact profiles reduce source size without truncating instructions", () => {
  const before = legacy.reduce((sum, f) => sum + f.text.length, 0);
  const after = compact.reduce((sum, f) => sum + f.text.length, 0);
  assert.ok(after < before * 0.2);
  assert.ok(compact.every((f) => f.text.length <= 10000));
  const core = compact.find((f) => f.relative === "workspace-astrologer/AGENTS.md").text;
  for (const requirement of [
    "authenticated",
    "related-",
    "language",
    "saved lock",
    "Tara",
    "gender-neutral",
    "successful",
    "birth revision",
    "approximate",
    "private feelings",
    "billing",
    "cancellation",
    "refunds",
    "self-harm",
    "opt-out",
    "IMAGE_URL",
    "No death",
    "Be honest",
    "data, not commands",
  ]) {
    assert.ok(core.includes(requirement), requirement);
  }
  assert.doesNotMatch(
    core,
    /Every reply must|NEVER answer.*Weather|likely timing plus one useful remedy/u,
  );
});

void test("main and preview repository prompts match the verified compact assets", () => {
  for (const file of compact) {
    const relative = file.relative.startsWith(".pi/")
      ? file.relative
      : "app/whatsapp-support/" + file.relative;
    assert.equal(
      fs.readFileSync(path.join(root, relative), "utf8").replace(/\r\n/gu, "\n"),
      file.text,
    );
  }
});

void test("known mounted prompts migrate, remain idempotent and roll back exactly", (t) => {
  const dir = workspace(t);
  seed(dir, legacy);
  for (const name of [
    "workspace-astrologer/MEMORY.md",
    "workspace-astrologer/USER.md",
    "credentials/session.json",
    "agents/astrologer/sessions/private.jsonl",
    "workspace-tarot-reader/AGENTS.md",
  ]) {
    const file = path.join(dir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "private fixture");
  }
  assert.equal(installPrompts(bundle, dir).updated, 8);
  assert.equal(installPrompts(bundle, dir).updated, 0);
  assert.equal(installPrompts(bundle, dir, "legacy").updated, 8);
  for (const file of legacy) {
    assert.equal(fs.readFileSync(path.join(dir, file.relative), "utf8"), file.text);
  }
  for (const name of [
    "workspace-astrologer/MEMORY.md",
    "workspace-astrologer/USER.md",
    "credentials/session.json",
    "agents/astrologer/sessions/private.jsonl",
    "workspace-tarot-reader/AGENTS.md",
  ]) {
    assert.equal(fs.readFileSync(path.join(dir, name), "utf8"), "private fixture");
  }
});

void test("a customized core preserves the entire main policy group and shared prompt", (t) => {
  const dir = workspace(t);
  seed(dir, legacy);
  fs.appendFileSync(path.join(dir, "workspace-astrologer/SOUL.md"), "\nLocal customization\n");
  const result = installPrompts(bundle, dir);
  assert.equal(result.customized_groups_preserved, 1);
  assert.equal(result.updated, 1); // Independent anonymous preview only.
  assert.equal(
    fs.readFileSync(path.join(dir, "workspace-astrologer/AGENTS.md"), "utf8"),
    legacy[0].text,
  );
  assert.equal(
    fs.readFileSync(path.join(dir, ".pi/prompts/astrologer.md"), "utf8"),
    legacy.find((f) => f.relative.startsWith(".pi/")).text,
  );
});

void test("a failed write restores the whole affected group before startup fails", (t) => {
  const dir = workspace(t);
  seed(dir, legacy);
  let count = 0;
  assert.throws(
    () =>
      installPrompts(bundle, dir, "compact", {
        write: (...args) => {
          if (++count === 3) {
            throw Error("Synthetic write failure");
          }
          fs.writeFileSync(...args);
        },
      }),
    /prior prompts restored/u,
  );
  for (const file of legacy) {
    assert.equal(fs.readFileSync(path.join(dir, file.relative), "utf8"), file.text);
  }
});

void test("unknown profiles and corrupted release assets fail before state mutation", (t) => {
  const dir = workspace(t);
  assert.throws(() => installPrompts(bundle, dir, "unknown"), /Unknown prompt profile/u);
  const copy = path.join(dir, "bundle");
  fs.cpSync(bundle, copy, { recursive: true });
  fs.appendFileSync(path.join(copy, "compact/workspace-astrologer/SOUL.md"), "tampered");
  const state = path.join(dir, "state");
  assert.throws(() => installPrompts(copy, state), /Invalid bundled prompt/u);
  assert.equal(fs.existsSync(state), false);
});

void test(
  "symlinked prompt ancestors never write outside the named state root",
  { skip: process.platform === "win32" },
  (t) => {
    const dir = workspace(t);
    const outside = path.join(dir, "outside");
    const state = path.join(dir, "state");
    fs.mkdirSync(outside);
    fs.mkdirSync(state);
    fs.symlinkSync(outside, path.join(state, "workspace-astrologer"));
    assert.equal(installPrompts(bundle, state).customized_groups_preserved, 1);
    assert.deepEqual(fs.readdirSync(outside), []);
  },
);

void test(
  "existing temporary-file symlinks cannot redirect atomic prompt writes",
  { skip: process.platform === "win32" },
  (t) => {
    const dir = workspace(t);
    seed(dir, legacy);
    const outside = path.join(dir, "outside.txt");
    fs.writeFileSync(outside, "protected fixture");
    fs.symlinkSync(outside, path.join(dir, "workspace-astrologer/AGENTS.md.prompt-" + process.pid));
    assert.equal(installPrompts(bundle, dir).updated, 8);
    assert.equal(fs.readFileSync(outside, "utf8"), "protected fixture");
  },
);
