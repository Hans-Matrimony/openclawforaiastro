import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  instructionHash,
  migrateAstrologyInstructions,
  REVIEWED_REVISIONS,
} from "../scripts/migrate-astrology-instructions.mjs";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "instruction-migration-"));
  t.after(() => {
    assert.equal(path.dirname(root), os.tmpdir());
    fs.rmSync(root, { recursive: true, force: true });
  });
  const app = path.join(root, "app"),
    state = path.join(root, "state");
  const revisions = {};
  for (const name of ["AGENTS.md", "SOUL.md"]) {
    const old = Buffer.from(`Previous synthetic ${name}\r\n`),
      replacement = Buffer.from(`Reviewed synthetic ${name}\n`);
    revisions[name] = { previous: instructionHash(old), replacement: instructionHash(replacement) };
    const target = path.join(state, "workspace-astrologer", name),
      source = path.join(app, "bootstrap/instruction-source", name);
    for (const file of [target, source]) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
    }
    fs.writeFileSync(target, old);
    fs.writeFileSync(source, replacement);
  }
  return {
    root,
    app,
    state,
    revisions,
    target: (name) => path.join(state, "workspace-astrologer", name),
    source: (name) => path.join(app, "bootstrap/instruction-source", name),
  };
}

void test("only reviewed source revisions migrate, retaining exact originals and unrelated state", (t) => {
  const f = fixture(t),
    before = {};
  for (const name of Object.keys(f.revisions)) {
    before[name] = fs.readFileSync(f.target(name));
  }
  const privateFile = path.join(f.state, "workspace-astrologer/private-memory.json");
  fs.writeFileSync(privateFile, "Synthetic private memory");
  const result = migrateAstrologyInstructions(f.app, f.state, f.revisions);
  assert.ok(result.every((row) => row.status === "reviewed_revision_migrated"));
  for (const name of Object.keys(f.revisions)) {
    assert.ok(fs.readFileSync(f.target(name)).equals(fs.readFileSync(f.source(name))));
    assert.ok(
      fs
        .readFileSync(
          path.join(f.state, "instruction-backups", name + "." + f.revisions[name].previous),
        )
        .equals(before[name]),
    );
  }
  assert.equal(fs.readFileSync(privateFile, "utf8"), "Synthetic private memory");
  assert.ok(
    migrateAstrologyInstructions(f.app, f.state, f.revisions).every(
      (row) => row.status === "already_current",
    ),
  );
});

void test("customized and absent personas are preserved, not replaced by image copies", (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.target("AGENTS.md"), "Customized agent instructions");
  fs.unlinkSync(f.target("SOUL.md"));
  const result = migrateAstrologyInstructions(f.app, f.state, f.revisions);
  assert.deepEqual(
    result.map((row) => row.status),
    ["customized_preserved", "absent_preserved"],
  );
  assert.equal(fs.readFileSync(f.target("AGENTS.md"), "utf8"), "Customized agent instructions");
  assert.ok(
    !fs.existsSync(f.target("SOUL.md")) &&
      !fs.existsSync(path.join(f.state, "instruction-backups")),
  );
});

void test("incorrect second replacement aborts before either original changes", (t) => {
  const f = fixture(t),
    before = fs.readFileSync(f.target("AGENTS.md"));
  fs.writeFileSync(f.source("SOUL.md"), "Unreviewed replacement");
  assert.throws(() => migrateAstrologyInstructions(f.app, f.state, f.revisions), /Unreviewed/);
  assert.ok(fs.readFileSync(f.target("AGENTS.md")).equals(before));
});

void test("a conflicting backup stops replacement without overwriting the backup", (t) => {
  const f = fixture(t),
    before = fs.readFileSync(f.target("AGENTS.md"));
  const backup = path.join(
    f.state,
    "instruction-backups",
    "AGENTS.md." + f.revisions["AGENTS.md"].previous,
  );
  fs.mkdirSync(path.dirname(backup));
  fs.writeFileSync(backup, "Conflicting backup");
  assert.throws(() => migrateAstrologyInstructions(f.app, f.state, f.revisions), /backup differs/);
  assert.ok(fs.readFileSync(f.target("AGENTS.md")).equals(before));
  assert.equal(fs.readFileSync(backup, "utf8"), "Conflicting backup");
});

void test("reviewed replacement digests match the bundled persona source", () => {
  for (const [name, revision] of Object.entries(REVIEWED_REVISIONS)) {
    const bytes = fs.readFileSync(
      new URL("../app/whatsapp-support/workspace-astrologer/" + name, import.meta.url),
    );
    assert.equal(instructionHash(bytes), revision.replacement);
  }
});

void test("pre-existing stage file is preserved when exclusive staging fails", (t) => {
  const f = fixture(t),
    original = fs.readFileSync(f.target("AGENTS.md"));
  const stage = f.target("AGENTS.md") + `.instruction-${process.pid}`;
  fs.writeFileSync(stage, "Existing stage must survive");
  assert.throws(() => migrateAstrologyInstructions(f.app, f.state, f.revisions), {
    code: "EEXIST",
  });
  assert.equal(fs.readFileSync(stage, "utf8"), "Existing stage must survive");
  assert.ok(fs.readFileSync(f.target("AGENTS.md")).equals(original));
});
