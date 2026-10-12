import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { instructionManifest } from "../scripts/astrology-instruction-manifest.mjs";
import { ASTROLOGY_ASSETS } from "../scripts/bootstrap-astrology-assets.mjs";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "instruction-manifest-"));
  const app = path.join(root, "app"),
    state = path.join(root, "state");
  t.after(() => {
    assert.equal(path.dirname(root), os.tmpdir());
    fs.rmSync(root, { recursive: true, force: true });
  });
  const active = path.join(state, "workspace-astrologer/AGENTS.md");
  const bundled = path.join(app, "bootstrap/instruction-source/AGENTS.md");
  for (const file of [active, bundled]) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "Synthetic private persona\r\n");
  }
  const config = {
    agents: {
      list: [{ id: "astrologer_pwa", workspace: path.join(state, "workspace-astrologer") }],
    },
  };
  return { root, app, state, active, bundled, config };
}

void test("metadata identifies mounted instruction drift without text or file writes", (t) => {
  const f = fixture(t);
  const before = fs.readFileSync(f.active);
  const manifest = instructionManifest(f.config, f.app, f.state);
  assert.equal(manifest.files.length, 5);
  assert.equal(manifest.files[0].matches_bundled, true);
  assert.equal(
    manifest.files[0].active.sha256_lf,
    createHash("sha256").update("Synthetic private persona\n").digest("hex"),
  );
  assert.equal(manifest.files[0].active.words, 3);
  assert.equal(manifest.files[1].active.status, "unavailable");
  assert.equal(manifest.system_prompt_injection_verified, false);
  assert.ok(!JSON.stringify(manifest).includes("Synthetic private persona"));
  assert.ok(fs.readFileSync(f.active).equals(before));
  fs.writeFileSync(f.active, "Customized persona");
  assert.equal(instructionManifest(f.config, f.app, f.state).files[0].matches_bundled, false);
});

void test("foreign or ambiguous workspaces produce no file fingerprints", (t) => {
  const f = fixture(t);
  for (const list of [
    [],
    [{ id: "astrologer_pwa", workspace: f.root }],
    [...f.config.agents.list, ...f.config.agents.list],
  ]) {
    const result = instructionManifest({ agents: { list } }, f.app, f.state);
    assert.equal(result.configured_workspace_matches_expected, false);
    assert.deepEqual(result.files, []);
  }
});

void test("bounded reader rejects oversized files and directories", (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.active, Buffer.alloc(512 * 1024 + 1));
  assert.equal(instructionManifest(f.config, f.app, f.state).files[0].active.status, "too_large");
  fs.unlinkSync(f.active);
  fs.mkdirSync(f.active);
  assert.equal(
    instructionManifest(f.config, f.app, f.state).files[0].active.status,
    "redirected_or_not_regular",
  );
});

void test("redirected instruction paths never expose the target fingerprint", (t) => {
  const f = fixture(t);
  const secret = path.join(f.root, "credential.txt");
  fs.writeFileSync(secret, "Synthetic credential, never included");
  fs.unlinkSync(f.active);
  try {
    fs.symlinkSync(secret, f.active);
  } catch (error) {
    if (process.platform !== "win32" || error.code !== "EPERM") {
      throw error;
    }
    // Windows without the symlink privilege still supports directory junctions.
    // Exercise ancestor redirection rather than skip the disclosure check.
    const redirected = path.join(f.root, "redirected");
    fs.mkdirSync(redirected);
    fs.writeFileSync(path.join(redirected, "AGENTS.md"), fs.readFileSync(secret));
    fs.rmdirSync(path.dirname(f.active));
    fs.symlinkSync(redirected, path.dirname(f.active), "junction");
  }
  const result = instructionManifest(f.config, f.app, f.state).files[0].active;
  assert.equal(result.status, "redirected_or_not_regular");
  assert.equal(result.sha256_lf, undefined);
});

void test("diagnostic image copies do not overwrite the persisted persona", () => {
  assert.ok(!ASTROLOGY_ASSETS.some((name) => /AGENTS\.md|SOUL\.md|instruction-source/u.test(name)));
  const docker = fs.readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
  assert.ok(docker.includes("SOUL.md /app/bootstrap/instruction-source/"));
  const start = fs.readFileSync(
    new URL("../scripts/start-openclaw-gateway.sh", import.meta.url),
    "utf8",
  );
  assert.ok(
    start.indexOf("bootstrap-astrology-assets.mjs") <
      start.indexOf("astrology-instruction-manifest.mjs"),
  );
});
