FROM node:22-bookworm-slim

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

# Install OpenClaw
RUN npm install -g openclaw@latest

# Create correct config location
RUN mkdir -p /root/.openclaw/workspace

# Copy config to expected location
COPY openclaw.json /root/.openclaw/openclaw.json

# Force local mode
ENV OPENCLAW_STATE_DIR=/root/.openclaw
ENV OPENCLAW_CONFIG_PATH=/root/.openclaw/openclaw.json
ENV OPENCLAW_GATEWAY_MODE=local
ENV OPENCLAW_GATEWAY_HOST=0.0.0.0
ENV OPENCLAW_GATEWAY_PORT=8000
ENV NODE_ENV=production

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:8000 || exit 1

CMD ["openclaw", "gateway"]
