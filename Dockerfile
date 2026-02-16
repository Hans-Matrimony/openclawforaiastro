FROM node:22-bookworm-slim

# Cache bust
ARG CACHEBUST=7

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

# Create directories
RUN mkdir -p /app/.openclaw
RUN mkdir -p /app/.openclaw/id_keys
RUN mkdir -p /app/.openclaw/workspace

WORKDIR /app

# Copy and fix config
COPY openclaw.json /app/.openclaw/

# Set environment
ENV OPENCLAW_CONFIG_DIR=/app/.openclaw
ENV HOME=/app

# Gateway port
ARG OPENCLAW_GATEWAY_TOKEN
ENV OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}

ARG ZAI_API_KEY
ENV ZAI_API_KEY=${ZAI_API_KEY}

ARG MEM0_URL
ENV MEM0_URL=${MEM0_URL}

ARG QDRANT_URL
ENV QDRANT_URL=${QDRANT_URL}

ARG QDRANT_MCP_URL
ENV QDRANT_MCP_URL=${QDRANT_MCP_URL}

ARG TELEGRAM_BOT_TOKEN
ENV TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start gateway
CMD ["sh", "-c", "openclaw doctor --fix && openclaw gateway --port 8000 --bind 0.0.0.0"]