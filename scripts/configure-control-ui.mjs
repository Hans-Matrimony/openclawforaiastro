import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export function secureControlUi(config, origins = '') {
  const allowed = new Set(['http://localhost:8000', 'http://127.0.0.1:8000']);
  for (const raw of origins.split(',').map(s => s.trim()).filter(Boolean)) {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
        || url.pathname !== '/' || url.hostname.includes('*')) {
      throw new Error('Control UI requires explicit HTTPS origins');
    }
    allowed.add(url.origin);
  }
  config.gateway.controlUi = {...config.gateway.controlUi,
    allowInsecureAuth: false, dangerouslyDisableDeviceAuth: false,
    dangerouslyAllowHostHeaderOriginFallback: false, allowedOrigins: [...allowed]};
  return config;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const file = process.env.OPENCLAW_CONFIG_PATH || '/app/openclaw.json';
  const config = secureControlUi(JSON.parse(fs.readFileSync(file, 'utf8')),
    process.env.OPENCLAW_CONTROL_UI_ORIGINS || '');
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n', {mode: 0o600});
  console.log('[startup] Control UI requires device authentication and explicit origins');
}
