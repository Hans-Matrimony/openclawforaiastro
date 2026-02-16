FROM node:22-bookworm-slim

# Cache bust
ARG CACHEBUST=8

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
RUN mkdir -p /app/.openclaw/agents/main/sessions
RUN mkdir -p /app/.openclaw/credentials
RUN mkdir -p /app/.openclaw/id_keys
RUN mkdir -p /app/.openclaw/workspace
RUN mkdir -p /app/.openclaw/workspace/memories
RUN mkdir -p /app/workspace

# Fix permissions
RUN chmod -R 700 /app/.openclaw

WORKDIR /app

# Copy and fix config
COPY openclaw.json /app/.openclaw/
RUN chmod 600 /app/.openclaw/openclaw.json

# Set environment
ENV OPENCLAW_CONFIG_DIR=/app/.openclaw
ENV HOME=/app

# Environment variables
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

# Health check (longer start period for first run)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start gateway (bind to lan for Coolify)
CMD ["openclaw", "gateway", "--port", "8000", "--bind", "lan"]