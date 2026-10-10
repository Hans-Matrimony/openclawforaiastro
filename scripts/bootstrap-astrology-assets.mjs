import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Copy only release-managed code and guides. Never replace memories, sessions,
// caches, credentials, or the friend persona files in a mounted state directory.
export const ASTROLOGY_ASSETS = [
  ...[
    "calculate.py",
    "reading.py",
    "reading_language.py",
    "render_reading.py",
    "separation.py",
    "separation_rules.py",
    "topic.py",
    "topic_rules.py",
    "timing.py",
    "timing_rules.py",
    "timing_periods.py",
    "TIMING_METHOD.md",
    "natal_cache.py",
    "vimshottari.py",
    "cities_india.json",
    "SKILL.md",
    "VEDASTRO-MIT.txt",
  ].map((name) => `skills/kundli/${name}`),
  ...["KUNDLI_RESPONSE.md"].map((name) => `workspace-astrologer/${name}`),
  ".pi/prompts/astrologer.md",
];

const NOTE_START = "<!-- astrofriend-reading-contract:start -->";
const NOTE_END = "<!-- astrofriend-reading-contract:end -->";
export function mergeReadingContract(source) {
  const start = source.indexOf(NOTE_START);
  const end = source.indexOf(NOTE_END);
  if (
    start < 0 !== end < 0 ||
    (start >= 0 && end < start) ||
    (start >= 0 && source.indexOf(NOTE_START, start + NOTE_START.length) >= 0) ||
    (end >= 0 && source.indexOf(NOTE_END, end + NOTE_END.length) >= 0)
  ) {
    throw new Error("Incomplete reading contract markers");
  }
  const note = `${NOTE_START}\nFor a requested personal astrology reading, answer the topic before advice. Use its checked topic assessment; a raw placement or dasha boundary is not an event forecast. Friend-only curiosity stays in friend conversation. Do not append a counselling or engagement question to a complete reading. The managed astrology evidence policy overrides older timing and friendship examples only for astrology readings.\n${NOTE_END}`;
  return start < 0
    ? `${source}\n\n${note}\n`
    : source.slice(0, start) + note + source.slice(end + NOTE_END.length);
}

export function bootstrapAstrologyAssets(appDir, stateDir) {
  const sourceRoot = path.join(appDir, "bootstrap");
  const personaNotes = ["AGENTS.md", "SOUL.md"]
    .map((name) => {
      const target = path.join(stateDir, "workspace-astrologer", name);
      if (!fs.existsSync(target)) {
        return null;
      }
      const source = fs.readFileSync(target, "utf8");
      return { target, source, merged: mergeReadingContract(source) };
    })
    .filter(Boolean);
  // Validate all inputs before replacing any file. A partial image is an error.
  for (const relative of ASTROLOGY_ASSETS) {
    if (!fs.statSync(path.join(sourceRoot, relative)).isFile()) {
      throw new Error(`Missing bundled astrology asset: ${relative}`);
    }
  }
  for (const relative of ASTROLOGY_ASSETS) {
    const target = path.join(stateDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    const temporary = `${target}.release-${process.pid}`;
    try {
      fs.copyFileSync(path.join(sourceRoot, relative), temporary);
      fs.chmodSync(temporary, 0o600);
      fs.renameSync(temporary, target);
    } finally {
      if (fs.existsSync(temporary)) {
        fs.unlinkSync(temporary);
      }
    }
  }
  // Preserve the full mounted friend persona; refresh only this marked, narrow
  // astrology contract so old engagement examples cannot reverse its scope.
  for (const { target, source, merged } of personaNotes) {
    if (merged === source) {
      continue;
    }
    const temporary = `${target}.release-${process.pid}`;
    try {
      fs.writeFileSync(temporary, merged, { mode: 0o600 });
      fs.renameSync(temporary, target);
    } finally {
      if (fs.existsSync(temporary)) {
        fs.unlinkSync(temporary);
      }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  bootstrapAstrologyAssets(
    process.env.OPENCLAW_APP_DIR || "/app",
    process.env.OPENCLAW_STATE_DIR || "/app/.openclaw",
  );
}
