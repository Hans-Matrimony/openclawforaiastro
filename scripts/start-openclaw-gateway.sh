#!/bin/sh
set -eu

APP_DIR="${OPENCLAW_APP_DIR:-/app}"
STATE_DIR="${OPENCLAW_STATE_DIR:-$APP_DIR/.openclaw}"
CONFIG_SOURCE="${OPENCLAW_BUNDLED_CONFIG_PATH:-$APP_DIR/openclaw.json}"

export HOME="${OPENCLAW_HOME:-$APP_DIR}"
export OPENCLAW_STATE_DIR="$STATE_DIR"
export OPENCLAW_CONFIG_DIR="${OPENCLAW_CONFIG_DIR:-$STATE_DIR}"
export OPENCLAW_CONFIG_PATH="$CONFIG_SOURCE"

mkdir -p "$OPENCLAW_STATE_DIR" \
  "$OPENCLAW_STATE_DIR/agents/tarot_reader/sessions" \
  "$OPENCLAW_STATE_DIR/workspace-tarot-reader/memories"

if [ -f "$CONFIG_SOURCE" ]; then
  cp "$CONFIG_SOURCE" "$OPENCLAW_STATE_DIR/openclaw.json"
  chmod 600 "$CONFIG_SOURCE" "$OPENCLAW_STATE_DIR/openclaw.json" 2>/dev/null || true
fi

if [ -d "$APP_DIR/bootstrap/workspace-tarot-reader" ]; then
  cp -R "$APP_DIR/bootstrap/workspace-tarot-reader/." "$OPENCLAW_STATE_DIR/workspace-tarot-reader/"
fi

node - "$OPENCLAW_CONFIG_PATH" <<'NODE'
const fs = require("node:fs");
const configPath = process.argv[2];
const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
const agents = new Set((cfg.agents?.list ?? []).map((agent) => agent?.id));
const tarotBindings = (cfg.bindings ?? []).filter((binding) => {
  const match = binding?.match;
  return binding?.agentId === "tarot_reader"
    && match?.channel === "whatsapp"
    && match?.peer
    && ["+919760347653", "919760347653", "9760347653"].includes(String(match.peer.id ?? ""));
});

if (!agents.has("tarot_reader")) {
  throw new Error("tarot_reader agent is missing from active OpenClaw config");
}

if (tarotBindings.length === 0) {
  throw new Error("test-number tarot_reader WhatsApp bindings are missing from active OpenClaw config");
}

console.log(`[startup] OpenClaw config: ${configPath}`);
console.log(`[startup] tarot_reader test bindings: ${tarotBindings.length}`);
NODE

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

exec pnpm exec openclaw gateway \
  --port "${OPENCLAW_GATEWAY_PORT:-8000}" \
  --bind "${OPENCLAW_GATEWAY_BIND:-lan}"
