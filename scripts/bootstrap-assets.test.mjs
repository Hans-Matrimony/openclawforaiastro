import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ASTROLOGY_ASSETS } from "./bootstrap-astrology-assets.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

test("every startup-managed asset is supplied by a Docker bootstrap COPY", () => {
  const dockerfile = fs
    .readFileSync(path.join(root, "Dockerfile"), "utf8")
    .replace(/\\\r?\n\s*/gu, " ");
  const bundled = new Set();
  for (const line of dockerfile.split(/\r?\n/u)) {
    if (!line.startsWith("COPY ")) continue;
    const parts = line.trim().split(/\s+/u).slice(1);
    const destination = parts.pop();
    if (!destination?.startsWith("/app/bootstrap/")) continue;
    for (const source of parts) {
      const absolute = path.join(root, source);
      assert.ok(fs.existsSync(absolute), `Missing Docker source: ${source}`);
      for (const asset of ASTROLOGY_ASSETS) {
        const target = "/app/bootstrap/" + asset;
        if (fs.statSync(absolute).isDirectory()) {
          if (
            target.startsWith(destination) &&
            fs.existsSync(path.join(absolute, target.slice(destination.length)))
          )
            bundled.add(asset);
        } else if (
          target === (destination.endsWith("/") ? destination + path.basename(source) : destination)
        ) {
          bundled.add(asset);
        }
      }
    }
  }
  for (const asset of ASTROLOGY_ASSETS)
    assert.ok(bundled.has(asset), `Startup asset not in image: ${asset}`);
});
