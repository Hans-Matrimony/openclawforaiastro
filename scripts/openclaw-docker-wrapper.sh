#!/bin/sh
set -eu

REAL_OPENCLAW="${OPENCLAW_REAL_BIN:-/usr/local/bin/openclaw}"

if [ ! -x "$REAL_OPENCLAW" ]; then
  echo "Real OpenClaw binary not found at $REAL_OPENCLAW" >&2
  exit 127
fi

exec /app/start-openclaw-gateway.sh "$REAL_OPENCLAW" "$@"
