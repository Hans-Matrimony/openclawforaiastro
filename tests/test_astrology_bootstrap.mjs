import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ASTROLOGY_ASSETS,
  bootstrapAstrologyAssets,
  mergeReadingContract,
} from "../scripts/bootstrap-astrology-assets.mjs";

function fixture(t) {
  const prefix = path.join(os.tmpdir(), "astro-assets-");
  const root = fs.mkdtempSync(prefix);
  t.after(() => {
    assert.ok(path.resolve(root).startsWith(path.resolve(prefix)));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const app = path.join(root, "app"),
    state = path.join(root, "mounted-state");
  for (const relative of ASTROLOGY_ASSETS) {
    const source = path.join(app, "bootstrap", relative);
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, `release:${relative}`);
  }
  return { app, state };
}

test("mounted state gets current code while friend files, memory and cache survive", (t) => {
  const { app, state } = fixture(t);
  const preserved = [
    "workspace-astrologer/AGENTS.md",
    "workspace-astrologer/SOUL.md",
    "workspace-astrologer/memories/private.json",
    "cache/kundli.sqlite3",
    "credentials/private",
  ];
  for (const relative of [...preserved, "skills/kundli/calculate.py"]) {
    const target = path.join(state, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "existing");
  }
  bootstrapAstrologyAssets(app, state);
  bootstrapAstrologyAssets(app, state);
  for (const relative of ASTROLOGY_ASSETS) {
    assert.equal(fs.readFileSync(path.join(state, relative), "utf8"), `release:${relative}`);
  }
  for (const relative of preserved) {
    assert.equal(
      fs.readFileSync(path.join(state, relative), "utf8"),
      /(?:AGENTS|SOUL)\.md$/u.test(relative) ? mergeReadingContract("existing") : "existing",
    );
  }
});

test("incomplete image fails before copying release assets", (t) => {
  const { app, state } = fixture(t);
  fs.unlinkSync(path.join(app, "bootstrap", ASTROLOGY_ASSETS.at(-1)));
  assert.throws(() => bootstrapAstrologyAssets(app, state));
  assert.equal(fs.existsSync(state), false);
});
