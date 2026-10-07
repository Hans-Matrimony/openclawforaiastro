import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ASTROLOGY_ASSETS } from "../scripts/bootstrap-astrology-assets.mjs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

void test("reading release includes every required asset and refreshes mounted state", () => {
  for (const file of [
    "calculate.py",
    "advanced_facts.py",
    "reading_provider.py",
    "timing_context.py",
    "period_ratings.json",
    "reading.py",
    "reading_language.py",
    "render_reading.py",
    "natal_cache.py",
    "vimshottari.py",
    "cities_india.json",
    "SKILL.md",
    "VEDASTRO-MIT.txt",
  ]) {
    assert.ok(ASTROLOGY_ASSETS.includes(`skills/kundli/${file}`));
    assert.ok(read(`skills/kundli/${file}`).trim());
    assert.ok(read("Dockerfile").includes(`skills/kundli/${file}`));
  }
  assert.ok(ASTROLOGY_ASSETS.includes(".pi/prompts/astrologer.md"));
  assert.ok(ASTROLOGY_ASSETS.includes("workspace-astrologer/KUNDLI_RESPONSE.md"));
  assert.ok(
    ASTROLOGY_ASSETS.every(
      (file) => !/AGENTS\.md|SOUL\.md|memories|credentials|cache\//u.test(file),
    ),
  );
  assert.match(
    read("scripts/start-openclaw-gateway.sh"),
    /node "\$APP_DIR\/bootstrap-astrology-assets\.mjs"/u,
  );
});

void test("reading and inference-budget plugins remain authenticated and bundled", () => {
  const config = JSON.parse(read("openclaw.json"));
  assert.deepEqual(config.plugins.load.paths, [
    "/app/extensions/reviewed-reading",
    "/app/extensions/inference-budget",
  ]);
  assert.equal(config.plugins.entries["reviewed-reading"].enabled, true);
  assert.equal(config.plugins.entries["inference-budget"].enabled, true);
  assert.match(read("extensions/reviewed-reading/index.ts"), /auth:\s*["']gateway["']/u);
  assert.match(read("extensions/reviewed-reading/route.mjs"), /--render-reading/u);
  assert.match(
    read("Dockerfile"),
    /COPY extensions\/reviewed-reading\/ \/app\/extensions\/reviewed-reading\//u,
  );
});
