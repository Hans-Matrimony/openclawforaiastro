import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { configureRuntimeBudget } from '../extensions/inference-budget/config.mjs';

export async function migrateDevConfig(input, runtimeRoot, env = process.env) {
  if (env.VEDASTRO_DIRECT_ENVIRONMENT !== 'development' ||
      !['1', 'true'].includes(env.OPENCLAW_SKIP_CHANNELS) ||
      !['1', 'true'].includes(env.OPENCLAW_SKIP_CRON)) {
    throw new Error('Latest runtime requires isolated development with channels and cron disabled');
  }
  const version = JSON.parse(fs.readFileSync(path.join(runtimeRoot, 'package.json'))).version;
  if (version !== '2026.11.10' || env.ASTROFRIEND_OPENCLAW_RUNTIME !== version) {
    throw new Error('Unverified development runtime version');
  }
  const config = structuredClone(input);
  // Dev scheduling is disabled. Preserve the source heartbeat in the backup;
  // enabling scheduling requires a separate reviewed automation migration.
  delete config.agents?.defaults?.heartbeat;
  for (const agent of config.agents?.list ?? Object.values(config.agents?.entries ?? {})) {
    delete agent.heartbeat;
  }
  const { t: migrations } = await import(pathToFileURL(path.join(runtimeRoot, 'dist/legacy-config-migrations-D77J4M6_.mjs')));
  const changes = [];
  for (const migration of migrations) migration.apply(config, changes);
  // Channel schemas are supplied by bundled plugins, separately from core
  // migrations. Limit this pass to channel data; preserve our custom plugins.
  const { n: migrateChannels } = await import(pathToFileURL(path.join(runtimeRoot, 'dist/channel-legacy-config-migrate-CS_cFh22.mjs')));
  const channelInput = structuredClone(config);
  delete channelInput.plugins;
  config.channels = migrateChannels(channelInput).next.channels;
  const bounded = configureRuntimeBudget(config);
  const { validateConfigObjectRaw } = await import(pathToFileURL(path.join(runtimeRoot, 'dist/config/config.js')));
  const result = validateConfigObjectRaw(bounded);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return bounded;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const filename = process.env.OPENCLAW_CONFIG_PATH;
  if (!filename || !process.argv[2]) throw new Error('Config and runtime paths required');
  const source = fs.readFileSync(filename, 'utf8');
  const config = await migrateDevConfig(JSON.parse(source), process.argv[2]);
  const backup = path.join(process.env.OPENCLAW_STATE_DIR, 'dev-runtime-original-config.json');
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, source, { mode: 0o600, flag: 'wx' });
  fs.writeFileSync(filename, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  console.log('[startup] isolated dev config validated for OpenClaw 2026.11.10; scheduling disabled');
}
