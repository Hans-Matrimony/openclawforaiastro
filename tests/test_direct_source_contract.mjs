import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import {
  SOURCE_PROMPT,
  SOURCE_TOOLS,
  SOURCE_CONFIG,
} from "../extensions/reviewed-reading/direct/source-contract.mjs";

void test("assembled system prompt and advertised tools exactly match source Dev server execution", () => {
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
  assert.equal(SOURCE_PROMPT, context.result.prompt);
  assert.deepEqual(SOURCE_TOOLS, JSON.parse(JSON.stringify(context.result.tools)));
  assert.equal(SOURCE_CONFIG.model, "qwen/qwen3-next-80b-a3b-instruct");
  assert.equal(SOURCE_CONFIG.baseUrl, "https://openrouter.ai/api/v1/chat/completions");
});
