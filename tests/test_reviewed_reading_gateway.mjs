// Opt-in installed-runtime check. Uses synthetic data, loopback and no model API.
// OPENCLAW_TEST_ENTRY must point to the published 2026.3.28 dist/entry.js.
// PATH must contain python3 with the pinned numerical dependencies installed.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, createHash, generateKeyPairSync, sign } from "node:crypto";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { validReadingResult } from "../extensions/reviewed-reading/route.mjs";
import { writeControlUiConfig } from "../scripts/configure-control-ui.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function browserHandshake(WebSocket, port, origin, token, withIdentity = false) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`, { origin });
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error("Synthetic browser handshake timed out"));
    }, 15000);
    const finish = (value) => {
      clearTimeout(timer);
      socket.terminate();
      resolve(value);
    };
    socket.on("error", () => {
      clearTimeout(timer);
      reject(new Error("Synthetic browser transport failed"));
    });
    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.event === "connect.challenge") {
        const params = {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: "openclaw-control-ui",
            version: "synthetic",
            platform: "web",
            mode: "webchat",
          },
          role: "operator",
          scopes: ["operator.admin"],
          auth: { token },
          caps: [],
        };
        if (withIdentity) {
          const keys = generateKeyPairSync("ed25519");
          const publicKey = keys.publicKey.export({ type: "spki", format: "der" }).subarray(-32);
          const id = createHash("sha256").update(publicKey).digest("hex"),
            signedAt = Date.now();
          const nonce = message.payload.nonce;
          const payload = [
            "v2",
            id,
            params.client.id,
            params.client.mode,
            params.role,
            params.scopes.join(","),
            String(signedAt),
            token,
            nonce,
          ].join("|");
          params.device = {
            id,
            publicKey: publicKey.toString("base64url"),
            signedAt,
            nonce,
            signature: sign(null, Buffer.from(payload), keys.privateKey).toString("base64url"),
          };
        }
        socket.send(
          JSON.stringify({ type: "req", id: "synthetic-connect", method: "connect", params }),
        );
      } else if (message.type === "res" && message.id === "synthetic-connect") {
        // Avoid exposing the returned device token or any server configuration.
        finish({ ok: message.ok, error: message.error?.message });
      }
    });
  });
}

void test(
  "published gateway authenticates and delivers consistent zero-model readings",
  {
    skip: !process.env.OPENCLAW_TEST_ENTRY,
    timeout: 240000,
  },
  async () => {
    const entry = path.resolve(process.env.OPENCLAW_TEST_ENTRY);
    const pkg = JSON.parse(
      await fs.readFile(path.resolve(path.dirname(entry), "../package.json"), "utf8"),
    );
    assert.equal(pkg.version, "2026.3.28");
    const state = await fs.mkdtemp(path.join(os.tmpdir(), "astrofriend-gateway-"));
    const token = randomBytes(32).toString("hex");
    const reservation = net.createServer();
    await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
    const port = reservation.address().port;
    await new Promise((resolve) => reservation.close(resolve));
    await fs.cp(path.join(root, "skills/kundli"), path.join(state, "skills/kundli"), {
      recursive: true,
    });
    // The reading module imports the adapter even with the provider disabled.
    // Copy its code, never a local env file or provider credentials.
    await fs.mkdir(path.join(state, "skills/vedastro"), { recursive: true });
    for (const file of ["natal_client.py", "vedastro_client.py"]) {
      await fs.copyFile(
        path.join(root, "skills/vedastro", file),
        path.join(state, "skills/vedastro", file),
      );
    }
    const configPath = path.join(state, "openclaw.json");
    await fs.writeFile(
      configPath,
      JSON.stringify({
        gateway: {
          mode: "local",
          port,
          bind: "loopback",
          auth: { mode: "token", token },
          controlUi: { enabled: true, allowedOrigins: ["https://admin.example.test"] },
        },
        agents: {
          defaults: { workspace: path.join(state, "workspace"), heartbeat: { every: "0m" } },
        },
        plugins: {
          allow: ["reviewed-reading"],
          load: { paths: [path.join(root, "extensions/reviewed-reading")] },
          entries: { "reviewed-reading": { enabled: true } },
        },
      }),
    );
    writeControlUiConfig(configPath);
    const child = spawn(
      process.execPath,
      [entry, "gateway", "--port", String(port), "--bind", "loopback"],
      {
        env: {
          ...process.env,
          OPENCLAW_STATE_DIR: state,
          OPENCLAW_CONFIG_PATH: configPath,
          KUNDLI_NATAL_CACHE_PATH: path.join(state, "cache/kundli.sqlite3"),
          VEDASTRO_READING_MODE: "off",
        },
        stdio: ["ignore", "ignore", "ignore"],
        windowsHide: true,
      },
    );
    let spawnError;
    child.on("error", (error) => {
      spawnError = error;
    });
    const closed = new Promise((resolve) => child.once("close", resolve));
    const url = `http://127.0.0.1:${port}/astrofriend/reading`;
    const request = (method, body, authorization = `Bearer ${token}`) =>
      fetch(url, {
        method,
        headers: { authorization, "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(35000),
      });
    try {
      const until = Date.now() + 180000;
      for (;;) {
        if (spawnError) {
          throw spawnError;
        }
        assert.equal(child.exitCode, null, "gateway exited before readiness");
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
          await response.arrayBuffer();
          if (response.status === 401) {
            break;
          }
        } catch {}
        assert.ok(Date.now() < until, "gateway readiness deadline exceeded");
        await delay(250);
      }
      for (const [method, body, auth, expected] of [
        ["POST", {}, "", 401],
        ["POST", {}, "Bearer incorrect", 401],
        ["POST", {}, undefined, 400],
        ["GET", undefined, undefined, 405],
        ["POST", { x: "x".repeat(5000) }, undefined, 413],
      ]) {
        const response = await request(method, body, auth);
        await response.arrayBuffer();
        assert.equal(response.status, expected);
      }
      const WebSocket = createRequire(entry)("ws");
      const foreign = await browserHandshake(
        WebSocket,
        port,
        "https://foreign.example.test",
        token,
      );
      assert.equal(foreign.ok, false);
      assert.match(foreign.error, /origin not allowed/i);
      const unpaired = await browserHandshake(WebSocket, port, "https://admin.example.test", token);
      assert.equal(unpaired.ok, false);
      assert.match(unpaired.error, /device identity/i);
      const approvedLocalDevice = await browserHandshake(
        WebSocket,
        port,
        "https://admin.example.test",
        token,
        true,
      );
      assert.equal(approvedLocalDevice.ok, true, approvedLocalDevice.error);
      const fingerprints = new Set();
      for (const [topic, language, intent] of [
        ["career", "english", "overview"],
        ["education", "hinglish", "overview"],
        ["marriage", "english", "timing"],
      ]) {
        const input = { dob: "2002-02-16", tob: "08:19", place: "Delhi", topic, language, intent };
        const response = await request("POST", input);
        const result = await response.json();
        assert.equal(response.status, 200, result.error ?? "Synthetic reading failed");
        assert.equal(validReadingResult(result, input), true);
        assert.equal(result.evidence.chart_facts.lagna, "Aquarius");
        fingerprints.add(result.evidence.input_fingerprint);
      }
      assert.equal(fingerprints.size, 1);
    } finally {
      child.kill();
      await closed;
      // Only the unique temporary directory created by this test is removed.
      assert.equal(path.dirname(state), os.tmpdir());
      assert.ok(path.basename(state).startsWith("astrofriend-gateway-"));
      await fs.rm(state, { recursive: true, force: true });
    }
  },
);
