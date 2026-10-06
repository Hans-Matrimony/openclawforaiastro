import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Copy only release-managed code and guides. Never replace memories, sessions,
// caches, credentials, or the friend persona files in a mounted state directory.
export const ASTROLOGY_ASSETS = [
  ...['calculate.py', 'reading.py', 'reading_language.py', 'render_reading.py',
    'natal_cache.py', 'vimshottari.py', 'cities_india.json', 'SKILL.md', 'VEDASTRO-MIT.txt']
    .map(name => `skills/kundli/${name}`),
  'skills/qdrant/qdrant_client.py',
  ...['KUNDLI_RESPONSE.md', 'WORKFLOW.md', 'TOOLS.md', 'TOOL_REFERENCE.md'].map(name => `workspace-astrologer/${name}`),
  '.pi/prompts/astrologer.md',
  ...['transport.mjs', 'runtime.mjs', 'pi-extension.mjs'].map(name => `runtime/inference-budget/${name}`),
  ...['workspace-astrologer', 'workspace-reply-repair', 'workspace-astrologer-preview']
    .map(workspace => `${workspace}/.pi/extensions/astrofriend-budget.ts`),
];

export function bootstrapAstrologyAssets(appDir, stateDir) {
  const sourceRoot = path.join(appDir, 'bootstrap');
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
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  bootstrapAstrologyAssets(process.env.OPENCLAW_APP_DIR || '/app',
    process.env.OPENCLAW_STATE_DIR || '/app/.openclaw');
}
