import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const names = [
  "AGENTS.md",
  "SOUL.md",
  "TOOLS.md",
  "IDENTITY.md",
  "USER.md",
  "HEARTBEAT.md",
  "BOOTSTRAP.md",
];

export function auditPromptBudget(workspace, perFile = 20000, total = 150000) {
  if (![perFile, total].every((n) => Number.isSafeInteger(n) && n > 0)) {
    throw new Error("Invalid bootstrap limits");
  }
  const memory = fs.existsSync(path.join(workspace, "MEMORY.md")) ? "MEMORY.md" : "memory.md";
  const files = [...names, memory].map((name) => {
    const file = path.join(workspace, name);
    const chars = fs.existsSync(file) ? fs.readFileSync(file, "utf8").length : 0;
    return { name, chars };
  });
  const chars = files.reduce((sum, file) => sum + file.chars, 0);
  // UTF-16 length matches the runtime's JavaScript slicing, including emoji.
  // Leave room for injected file labels and separators in the aggregate budget.
  const reservedChars = files.length * 256;
  const oversized = files.filter((file) => file.chars > perFile).map((file) => file.name);
  return {
    files,
    chars,
    reservedChars,
    perFile,
    total,
    oversized,
    fits: oversized.length === 0 && chars + reservedChars <= total,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const config = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const defaults = config.agents?.defaults ?? {};
  for (const agent of config.agents?.list ?? []) {
    if (!["astrologer", "astrologer_preview", "astrologer_preview_fast"].includes(agent.id))
      continue;
    if (!agent.workspace) throw new Error(`Missing workspace for ${agent.id}`);
    const result = auditPromptBudget(
      agent.workspace,
      defaults.bootstrapMaxChars,
      defaults.bootstrapTotalMaxChars,
    );
    console.log(JSON.stringify({ agent: agent.id, ...result }));
    if (!result.fits)
      throw new Error(
        `Astrologer prompt budget exceeded for ${agent.id}; refusing truncated policy`,
      );
  }
}
