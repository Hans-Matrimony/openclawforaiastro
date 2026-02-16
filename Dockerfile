FROM node:22-bookworm-slim

# Cache bust to force rebuild with updated config
ARG CACHEBUST=5

  # Install system dependencies
  RUN apt-get update && apt-get install -y \
      sqlite3 \
      ffmpeg \
      python3 \
      python3-pip \
      build-essential \
      curl \
      git \
      && rm -rf /var/lib/apt/lists/*

  # Install OpenClaw CLI
  RUN npm install -g openclaw@latest

  # Create workspace directory
  RUN mkdir -p /app/.openclaw

  WORKDIR /app

  # Copy configuration files (updated 2026-02-16)
  COPY openclaw.json /app/.openclaw/

  # Ensure config is properly loaded
  RUN ls -la /app/.openclaw/ && cat /app/.openclaw/openclaw.json

  # Create id_keys directory
  RUN mkdir -p /app/.openclaw/id_keys

  ENV OPENCLAW_CONFIG_DIR=/app/.openclaw
  ENV NODE_ENV=production

  # GLM/Zhipu API Key (set in Coolify environment variables)
  ARG ZHIPU_API_KEY
  ENV ZHIPU_API_KEY=${ZHIPU_API_KEY}

  # Gateway authentication (optional)
  ARG OPENCLAW_GATEWAY_TOKEN
  ENV OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}

  # Expose port
  EXPOSE 8000

  # Health check
  HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
      CMD curl -f http://localhost:8000/health || exit 1

  # Start OpenClaw Gateway
  CMD ["openclaw", "gateway", "--port", "8000", "--allow-unconfigured",  "--bind", "lan"]