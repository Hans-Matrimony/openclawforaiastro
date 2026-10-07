import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { secureControlUi, writeControlUiConfig } from "../scripts/configure-control-ui.mjs";

const fixture = () => ({
  gateway: {
    port: 8000,
    auth: { mode: "token", token: "${OPENCLAW_GATEWAY_TOKEN}" },
    controlUi: {
      enabled: true,
      allowedOrigins: [
        "https://admin.example.test",
        "*",
        "http://unsafe.example.test",
        "https://bad.example.test/path",
      ],
    },
  },
});

void test("restart preserves approved HTTPS domains and drops insecure legacy entries", () => {
  const result = secureControlUi(fixture());
  assert.deepEqual(result.gateway.controlUi.allowedOrigins, [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "https://admin.example.test",
  ]);
  assert.equal(result.gateway.controlUi.enabled, true);
  assert.deepEqual(result.gateway.auth, { mode: "token", token: "${OPENCLAW_GATEWAY_TOKEN}" });
  assert.deepEqual(secureControlUi(structuredClone(result)), result);
});

void test("explicit origins replace old domains and honor the configured local port", () => {
  const config = fixture();
  config.gateway.port = 18789;
  const result = secureControlUi(config, "https://new.example.test,https://new.example.test/");
  assert.deepEqual(result.gateway.controlUi.allowedOrigins, [
    "http://localhost:18789",
    "http://127.0.0.1:18789",
    "https://new.example.test",
  ]);
  assert.equal(result.gateway.controlUi.dangerouslyDisableDeviceAuth, false);
});

void test("invalid overrides cannot mutate configuration or expose supplied secrets", () => {
  const config = fixture(),
    before = structuredClone(config),
    secret = "invalid-private-value";
  assert.throws(
    () => secureControlUi(config, secret),
    (error) =>
      error.message === "Control UI requires explicit HTTPS origins" &&
      !String(error).includes(secret),
  );
  assert.deepEqual(config, before);
  for (const port of [0, 65536, "8000", NaN]) {
    const value = fixture();
    value.gateway.port = port;
    assert.throws(() => secureControlUi(value), /Invalid gateway port/);
  }
});

void test("disk failure retains original config and removes only its own temporary file", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "af-control-ui-"));
  t.after(() => {
    assert.equal(path.dirname(directory), os.tmpdir());
    assert.ok(path.basename(directory).startsWith("af-control-ui-"));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const file = path.join(directory, "openclaw.json"),
    original = JSON.stringify(fixture());
  fs.writeFileSync(file, original);
  fs.writeFileSync(path.join(directory, "unrelated.txt"), "preserve");
  const storage = {
    ...fs,
    renameSync() {
      throw Object.assign(new Error("simulated disk failure"), { code: "ENOSPC" });
    },
  };
  assert.throws(() => writeControlUiConfig(file, "https://new.example.test", storage), {
    code: "ENOSPC",
  });
  assert.equal(fs.readFileSync(file, "utf8"), original);
  assert.deepEqual(fs.readdirSync(directory).toSorted(), ["openclaw.json", "unrelated.txt"]);
  writeControlUiConfig(file, "https://new.example.test");
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")).gateway.controlUi.allowedOrigins, [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "https://new.example.test",
  ]);
});
