// Opt-in integration with the published runtime, real SDK retries and a fake
// loopback model service. No customer data, API keys or paid inference required.
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { validateInstalledBudget } from "../scripts/validate-inference-budget.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

void test(
  "published gateway bounds real SDK retries and isolates concurrent agent loops",
  {
    skip: !process.env.OPENCLAW_TEST_ENTRY,
    timeout: 600000,
  },
  async () => {
    const entry = path.resolve(process.env.OPENCLAW_TEST_ENTRY);
    assert.equal(
      JSON.parse(await fs.readFile(path.resolve(path.dirname(entry), "../package.json"))).version,
      "2026.3.28",
    );
    const state = await fs.mkdtemp(path.join(os.tmpdir(), "af-budget-gateway-"));
    const requests = [];
    const server = http.createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
      }
      const data = JSON.parse(body);
      const serialized = JSON.stringify(data.messages);
      const marker = [...serialized.matchAll(/AFTEST:([a-z0-9-]+)/g)].at(-1)?.[1] ?? "unknown";
      const currentStart = data.messages.findLastIndex((message) => message.role === "user");
      const currentToolResults = data.messages
        .slice(currentStart + 1)
        .filter((message) => message.role === "tool").length;
      const previousToolResults = data.messages
        .slice(0, currentStart)
        .filter((message) => message.role === "tool").length;
      requests.push({
        marker,
        tokens: data.max_tokens ?? data.max_completion_tokens,
        url: req.url,
        userTurns: data.messages.filter((message) => message.role === "user").length,
        bytes: Buffer.byteLength(body),
        summaryPresent: serialized.includes("AFSUMMARY:earlier-preferences"),
        currentToolResults,
        previousToolResults,
      });
      if (marker === "retries") {
        res.writeHead(503, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            error: { message: "Synthetic transient failure", type: "server_error" },
          }),
        );
        return;
      }
      const chartRead = marker.startsWith("chart-history-") && currentToolResults === 0;
      const loop = marker.startsWith("loop") || chartRead;
      const delta = loop
        ? {
            role: "assistant",
            tool_calls: [
              {
                index: 0,
                id: `call_${requests.length}`,
                type: "function",
                function: {
                  name: "read",
                  arguments: JSON.stringify({
                    path: path.join(
                      state,
                      chartRead ? "synthetic-chart-history.txt" : `missing-${requests.length}`,
                    ),
                  }),
                },
              },
            ],
          }
        : { role: "assistant", content: "Hello! I am here for a friendly chat." };
      const completion = {
        id: "synthetic",
        object: "chat.completion.chunk",
        created: 0,
        model: "test",
        choices: [{ index: 0, delta, finish_reason: null }],
      };
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write(`data: ${JSON.stringify(completion)}\n\n`);
      res.write(
        `data: ${JSON.stringify({ ...completion, choices: [{ index: 0, delta: {}, finish_reason: loop ? "tool_calls" : "stop" }], usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 } })}\n\n`,
      );
      res.end("data: [DONE]\n\n");
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const portReservation = net.createServer();
    await new Promise((resolve) => portReservation.listen(0, "127.0.0.1", resolve));
    const port = portReservation.address().port;
    await new Promise((resolve) => portReservation.close(resolve));
    const workspace = path.join(state, "workspace-astrologer");
    await fs.mkdir(path.join(workspace, ".pi/extensions"), { recursive: true });
    await fs.cp(
      path.join(root, "extensions/inference-budget"),
      path.join(state, "runtime/inference-budget"),
      { recursive: true },
    );
    await fs.writeFile(
      path.join(workspace, ".pi/extensions/astrofriend-budget.ts"),
      "export { default } from '../../../runtime/inference-budget/pi-extension.mjs';\n",
    );
    const providers = Object.fromEntries(
      ["testa", "testb", "testc"].map((provider) => [
        provider,
        {
          api: "openai-completions",
          apiKey: "synthetic-key",
          baseUrl: `http://127.0.0.1:${server.address().port}/${provider}/v1`,
          models: [
            {
              id: "test",
              name: "test",
              reasoning: false,
              input: ["text"],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              // Synthetic chart exchanges exercise the transport's smaller
              // input cap without triggering an unrelated automatic summary.
              contextWindow: 131072,
              maxTokens: 8192,
            },
          ],
        },
      ]),
    );
    const token = randomUUID();
    const configPath = path.join(state, "openclaw.json");
    const config = {
      gateway: {
        mode: "local",
        port,
        bind: "loopback",
        auth: { mode: "token", token },
        controlUi: { enabled: false },
        http: { endpoints: { responses: { enabled: true } } },
      },
      models: { providers },
      agents: {
        defaults: {
          workspace,
          heartbeat: { every: "0m" },
          model: { primary: "testa/test", fallbacks: ["testb/test", "testc/test"] },
        },
        list: [
          { id: "astrologer", workspace, skills: [], tools: { allow: ["read"] } },
          { id: "astrologer_pwa", workspace, skills: [], tools: { allow: ["read"] } },
        ],
      },
      plugins: {
        allow: ["inference-budget"],
        load: { paths: [path.join(root, "extensions/inference-budget")] },
        entries: { "inference-budget": { enabled: true } },
      },
    };
    await fs.writeFile(configPath, JSON.stringify(config));
    await validateInstalledBudget(
      path.resolve(path.dirname(entry), "../package.json"),
      state,
      config,
    );
    const child = spawn(
      process.execPath,
      [entry, "gateway", "--port", String(port), "--bind", "loopback"],
      {
        env: { ...process.env, OPENCLAW_STATE_DIR: state, OPENCLAW_CONFIG_PATH: configPath },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    let output = "";
    for (const stream of [child.stdout, child.stderr]) {
      stream.on("data", (data) => {
        output = (output + data.toString()).slice(-12000);
      });
    }
    const closed = new Promise((resolve) => child.once("close", resolve));
    const invoke = async (marker, { agent = "astrologer", sessionKey, content = "" } = {}) => {
      const response = await fetch(`http://127.0.0.1:${port}/v1/responses`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-openclaw-scopes": "operator.write",
          "x-openclaw-session-key": sessionKey ?? `agent:${agent}:budget-test:${randomUUID()}`,
        },
        body: JSON.stringify({
          model: `openclaw/${agent}`,
          input: `AFTEST:${marker} [Language: english] Synthetic QA. ${content}`,
          max_output_tokens: 8192,
        }),
        signal: AbortSignal.timeout(110000),
      });
      const data = await response.json();
      assert.equal(response.status, 200, JSON.stringify(data));
      return (
        data.output_text ??
        (data.output ?? [])
          .flatMap((item) => (item.content ?? []).map((c) => c.text ?? ""))
          .join("")
      );
    };
    try {
      const until = Date.now() + 180000;
      for (;;) {
        assert.equal(child.exitCode, null, output);
        try {
          const response = await fetch(`http://127.0.0.1:${port}/health`, {
            signal: AbortSignal.timeout(1000),
          });
          await response.arrayBuffer();
          if (response.ok) {
            break;
          }
        } catch {}
        assert.ok(Date.now() < until, output || "gateway readiness timed out");
        await delay(250);
      }
      console.log("Isolated published gateway ready");
      assert.match(await invoke("single"), /friendly chat/);
      assert.equal(requests.filter((r) => r.marker === "single").length, 1);
      assert.ok(
        requests.every((r) => r.tokens <= 2048),
        "actual SDK payload must be capped",
      );
      assert.match(await invoke("retries"), /couldn’t finish/);
      assert.equal(
        requests.filter((r) => r.marker === "retries").length,
        6,
        "SDK retries and provider fallback must share six attempts",
      );
      console.log("Published SDK request and retry limits passed");
      const replies = await Promise.all([invoke("loop-a"), invoke("loop-b")]);
      for (const reply of replies) {
        assert.match(reply, /couldn’t finish/);
      }
      for (const marker of ["loop-a", "loop-b"]) {
        assert.equal(requests.filter((r) => r.marker === marker).length, 6, marker);
      }
      assert.ok(requests.every((r) => r.tokens <= 2048));
      console.log("Concurrent synthetic tool loops passed");
      const sessionKey = `agent:astrologer_pwa:budget-history:${randomUUID()}`;
      for (let turn = 0; turn < 8; turn++) {
        const marker = `history-${turn}`;
        assert.match(
          await invoke(marker, { agent: "astrologer_pwa", sessionKey, content: "x".repeat(35000) }),
          /friendly chat/,
        );
        const sent = requests.filter((request) => request.marker === marker);
        assert.equal(
          sent.length,
          1,
          "Each PWA turn needs one request, including after history grows",
        );
        assert.ok(sent[0].userTurns <= 3, "Published SDK receives complete bounded PWA history");
        assert.ok(sent[0].bytes < 196608, "PWA history stays below the unchanged request cap");
        console.log(`Bounded PWA history turn ${turn + 1}/8 passed`);
      }
      // Exercise actual pinned Pi compaction persistence/conversion. Only this
      // synthetic session file is changed, while the gateway is between turns.
      const sessions = path.join(state, "agents/astrologer_pwa/sessions");
      const files = (await fs.readdir(sessions)).filter((file) => file.endsWith(".jsonl"));
      assert.equal(files.length, 1);
      const { SessionManager } = await import(
        pathToFileURL(
          path.resolve(
            path.dirname(entry),
            "../../@mariozechner/pi-coding-agent/dist/core/session-manager.js",
          ),
        ).href
      );
      const session = SessionManager.open(path.join(sessions, files[0]));
      const users = session
        .getBranch()
        .filter((item) => item.type === "message" && item.message.role === "user");
      assert.equal(users.length, 8);
      session.appendCompaction("AFSUMMARY:earlier-preferences", users.at(-1).id, 30000);
      for (let turn = 8; turn < 12; turn++) {
        const marker = `history-${turn}`;
        assert.match(
          await invoke(marker, { agent: "astrologer_pwa", sessionKey, content: "x".repeat(35000) }),
          /friendly chat/,
        );
        const sent = requests.filter((request) => request.marker === marker);
        assert.equal(sent.length, 1);
        assert.ok(sent[0].summaryPresent, "Compacted preferences survive later PWA turns");
        assert.ok(sent[0].userTurns <= 4, "Three real user turns plus the converted summary");
        assert.ok(sent[0].bytes < 196608);
        console.log(`Post-compaction PWA history turn ${turn - 7}/4 passed`);
      }
      await fs.writeFile(
        path.join(state, "synthetic-chart-history.txt"),
        "synthetic chart evidence\n".repeat(2100),
      );
      const chartSession = `agent:astrologer_pwa:budget-chart-history:${randomUUID()}`;
      for (let turn = 0; turn < 5; turn++) {
        const marker = `chart-history-${turn}`;
        assert.match(
          await invoke(marker, {
            agent: "astrologer_pwa",
            sessionKey: chartSession,
            content: "x".repeat(35000),
          }),
          /friendly chat/,
        );
        const sent = requests.filter((request) => request.marker === marker);
        assert.equal(sent.length, 2, "Each current chart exchange reaches a final answer");
        assert.ok(sent.every((request) => request.previousToolResults === 0));
        assert.equal(sent[0].currentToolResults, 0);
        assert.equal(
          sent[1].currentToolResults,
          1,
          "Current chart evidence remains in the answer request",
        );
        assert.ok(sent.every((request) => request.bytes < 196608));
        console.log(`Bounded PWA chart-history turn ${turn + 1}/5 passed`);
      }
    } catch (error) {
      // Only synthetic requests are used by this isolated process.
      console.error("Synthetic request observations:", JSON.stringify(requests.slice(-12)));
      console.error(output.replaceAll(token, "[redacted]"));
      throw error;
    } finally {
      // The published entry can respawn Node. Kill only this owned process tree
      // on Windows so its inherited pipes cannot keep the test waiting forever.
      if (process.platform === "win32" && child.exitCode === null) {
        await promisify(execFile)("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"]);
      } else {
        child.kill();
      }
      await closed;
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      assert.equal(path.dirname(state), os.tmpdir());
      assert.ok(path.basename(state).startsWith("af-budget-gateway-"));
      await fs.rm(state, { recursive: true, force: true });
    }
  },
);
