import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
const requireCompiler = createRequire(
  path.resolve(process.env.READING_GUARD_COMPILER_PACKAGE || "/build/package.json"),
);
const ts = requireCompiler("typescript");
const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw new Error("Expected source and output directories");
fs.mkdirSync(destination, { recursive: true });
for (const name of ["astrologer-reading-style", "astrologer-reading-stream"]) {
  const input = fs.readFileSync(path.join(source, name + ".ts"), "utf8");
  const result = ts
    .transpileModule(input, {
      compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ES2022 },
      fileName: name + ".ts",
    })
    .outputText.replace('from "@mariozechner/pi-ai"', 'from "./runtime-pi-ai.mjs"');
  fs.writeFileSync(path.join(destination, name + ".js"), result);
}
