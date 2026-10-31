import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

void test("known previous release upgrades without treating stock as customization", (t) => {
  const dir = workspace(t);
  const copy = path.join(dir, "bundle");
  fs.cpSync(bundle, copy, { recursive: true });
  const state = path.join(dir, "state");
  seed(state, compact);
  const relative = "workspace-astrologer/AGENTS.md";
  const previous = "Known previous release fixture\n";
  fs.writeFileSync(path.join(state, relative), previous);
  const manifestPath = path.join(copy, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.managed_files[relative].previous_stock_sha256 = [
    createHash("sha256").update(previous).digest("hex"),
  ];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  const result = installPrompts(copy, state, "compact");
  assert.equal(result.updated, 1);
  assert.equal(result.customized_groups_preserved, 0);
  assert.equal(fs.readFileSync(path.join(state, relative), "utf8"), compact[0].text);
  fs.writeFileSync(path.join(state, relative), previous + "local customization");
  assert.equal(installPrompts(copy, state).customized_groups_preserved, 1);
});

void test("both deployment profiles carry the direct reading style and its exceptions", () => {
  for (const profile of [compact, legacy]) {
    for (const relative of ["workspace-astrologer/AGENTS.md", "workspace-astrologer-preview/AGENTS.md"]) {
      const text = profile.find((file) => file.relative === relative).text.replace(/\s+/g, " ");
      assert.match(text, /Answer directly in the first sentence|Lead yes\/no answers with the supported verdict/);
      assert.match(text, /60-90 words, maximum 105/);
      assert.match(text, /2-3 strongest supported factors/);
      assert.match(text, /Explicit detail, multipart requests, birth forms, safety, drafts and media markers are exceptions|Detail, multipart, birth forms, safety, drafts and media are exceptions/);
      assert.match(text, /At most one short supported remedy clause|Remedies: at most one short supported clause/);
      assert.match(text, /equivalents in any language|recap, service menus or stock closing/);
      assert.match(text, /Ask only a necessary clarification in readings|One short relevant follow-up is optional; respect no questions/);
      assert.match(text, /Style never justifies unsupported certainty|Style cannot justify certainty/);
    }
  }
});

void test("packaged production contract retains topic-specific timing without forced certainty", () => {
  const core = compact.find((f) => f.relative === "workspace-astrologer/AGENTS.md").text.replace(/\s+/g, " ");
  assert.match(core, /topic's evaluated month-year window/);
  assert.match(core, /Keep girlfriend\/love distinct from marriage/);
  assert.match(core, /Never force yes\/no or a date from insufficient evidence/);
  assert.match(core, /Preserve adverse\/mixed findings/);
});
