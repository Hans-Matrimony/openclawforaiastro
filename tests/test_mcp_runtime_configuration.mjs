import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { configureMcpRuntime } from "../scripts/configure-mcp-runtime.mjs";

const environment = {
  QDRANT_API_KEY: "synthetic-runtime-key-" + "x".repeat(32),
  QDRANT_URL: "http://qdrant-test:6333",
};
function fixture(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "af-mcp-config-"));
  t.after(() => {
    const resolved = fs.realpathSync(folder);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith("af-mcp-config-"));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const target = path.join(folder, "state/config/mcporter.json"),
    bundled = path.join(folder, "bundled.json");
  const original = {
    mcpServers: {
      qdrant: {
        command: "uvx",
        args: ["mcp-server-qdrant"],
        env: {
          QDRANT_API_KEY: "legacy-test",
          QDRANT_URL: "http://old-test",
          COLLECTION_NAME: "custom",
        },
      },
      other: { command: "custom-command", args: ["custom-argument"] },
    },
    imports: [],
  };
  fs.writeFileSync(bundled, JSON.stringify(original));
  return {
    target,
    bundled,
    original,
    write(value) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, JSON.stringify(value));
    },
  };
}
void test("mounted MCP configuration migrates only Qdrant runtime fields and is idempotent", (t) => {
  const f = fixture(t);
  f.write(f.original);
  assert.equal(configureMcpRuntime(f.target, f.bundled, environment), "updated");
  const result = JSON.parse(fs.readFileSync(f.target, "utf8"));
  assert.deepEqual(result, {
    ...f.original,
    mcpServers: {
      ...f.original.mcpServers,
      qdrant: {
        ...f.original.mcpServers.qdrant,
        env: {
          ...f.original.mcpServers.qdrant.env,
          QDRANT_API_KEY: "${QDRANT_API_KEY}",
          QDRANT_URL: "${QDRANT_URL}",
        },
      },
    },
  });
  assert.ok(!fs.readFileSync(f.target, "utf8").includes(environment.QDRANT_API_KEY));
  assert.equal(configureMcpRuntime(f.target, f.bundled, environment), "unchanged");
});
void test("an empty mounted state receives a bundled configuration with runtime references", (t) => {
  const f = fixture(t);
  assert.equal(configureMcpRuntime(f.target, f.bundled, environment), "created");
  assert.equal(
    JSON.parse(fs.readFileSync(f.target, "utf8")).mcpServers.qdrant.env.QDRANT_API_KEY,
    "${QDRANT_API_KEY}",
  );
});
void test("unconfigured optional MCP leaves existing functionality unchanged; required mode blocks", (t) => {
  const f = fixture(t);
  f.write(f.original);
  const before = fs.readFileSync(f.target);
  assert.equal(configureMcpRuntime(f.target, f.bundled, {}), "skipped");
  assert.deepEqual(fs.readFileSync(f.target), before);
  assert.throws(() =>
    configureMcpRuntime(f.target, f.bundled, { ASTROFRIEND_MCP_ENV_CONFIG_REQUIRED: "1" }),
  );
});
void test("invalid JSON or server schema cannot overwrite a mounted configuration", (t) => {
  const f = fixture(t);
  for (const value of [null, {}, { mcpServers: { qdrant: { env: [] } } }]) {
    f.write(value);
    const before = fs.readFileSync(f.target);
    assert.throws(() => configureMcpRuntime(f.target, f.bundled, environment));
    assert.deepEqual(fs.readFileSync(f.target), before);
  }
  fs.writeFileSync(f.target, "{broken");
  assert.throws(() => configureMcpRuntime(f.target, f.bundled, environment), /cannot be parsed/u);
  assert.equal(fs.readFileSync(f.target, "utf8"), "{broken");
});
void test("invalid credential or URL never changes the stored configuration", (t) => {
  const f = fixture(t);
  f.write(f.original);
  const before = fs.readFileSync(f.target);
  for (const change of [
    { QDRANT_API_KEY: "short" },
    { QDRANT_API_KEY: "x".repeat(32) + "\n" },
    { QDRANT_URL: "file:///tmp/data" },
    { QDRANT_URL: "https://user:password@server" },
    { QDRANT_URL: "not a URL" },
  ]) {
    assert.throws(() => configureMcpRuntime(f.target, f.bundled, { ...environment, ...change }));
    assert.deepEqual(fs.readFileSync(f.target), before);
  }
});
