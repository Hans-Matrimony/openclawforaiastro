import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import {
  SOURCE_PROMPT,
  SOURCE_TOOLS,
  SOURCE_CONFIG,
} from "../extensions/reviewed-reading/direct/source-contract.mjs";

void test("source tools match Dev server; prompt loads the tracked dev Friend Mode overlay", () => {
  const assets = new URL("../extensions/reviewed-reading/direct/assets/dev-v2/", import.meta.url);
  const server = fs.readFileSync(new URL("server.mjs", assets), "utf8");
  const start = server.indexOf("const SYSTEM_PROMPT =");
  const end = server.indexOf("// ---------- SESSIONS");
  assert.ok(start > 0 && end > start);
  const context = vm.createContext({
    fs: { readFileSync: (name, encoding) => fs.readFileSync(new URL(name, assets), encoding) },
    path: { join: (_root, name) => name },
    ROOT: ".",
  });
  vm.runInContext(
    server.slice(start, end) + "\nglobalThis.result = {prompt:SYSTEM_PROMPT, tools:TOOLS};",
    context,
    { timeout: 1000 },
  );
  const base = fs.readFileSync(new URL("system-prompt.txt", assets), "utf8");
  const friend = fs
    .readFileSync(new URL("friend-mode.txt", assets), "utf8")
    .replace(/\r\n?/g, "\n");
  assert.equal(SOURCE_PROMPT, base + friend);
  assert.ok(context.result.prompt.startsWith(base));
  assert.ok(SOURCE_PROMPT.includes("Be blunt both ways:"));
  assert.deepEqual(SOURCE_TOOLS, JSON.parse(JSON.stringify(context.result.tools)));
  assert.equal(SOURCE_CONFIG.model, "qwen/qwen3-next-80b-a3b-instruct");
  assert.equal(SOURCE_CONFIG.baseUrl, "https://openrouter.ai/api/v1/chat/completions");
});
