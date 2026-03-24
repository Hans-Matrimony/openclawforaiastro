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

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Create package.json (required for pnpm)
RUN pnpm init -y

# Install OpenClaw locally (IMPORTANT: no global install)
RUN pnpm add openclaw@latest

# Install Python dependencies
RUN pip3 install uv requests duckduckgo-search jyotishganit geopy python-dotenv qdrant-client --break-system-packages

# 🔥 Build OpenClaw UI (FIXES YOUR ERROR)
RUN npx openclaw ui:build

# Create required directories
RUN mkdir -p /app/.openclaw/agents/main/sessions \
    /app/.openclaw/credentials \
    /app/.openclaw/id_keys \
    /app/.openclaw/workspace \
    /app/.openclaw/workspace/memories \
    /app/.openclaw/agents/astrologer/sessions \
    /app/.openclaw/workspace-astrologer \
    /app/.openclaw/workspace-astrologer/memories \
    /app/.openclaw/config \
    /app/.openclaw/skills \
    /app/.openclaw/.pi \
    /app/workspace

# Fix permissions
RUN chmod -R 700 /app/.openclaw

# Copy your configuration files
COPY openclaw.json /app/.openclaw/
COPY config/ /app/.openclaw/config/
COPY .pi/ /app/.openclaw/.pi/
COPY skills/ /app/.openclaw/skills/
COPY app/whatsapp-support/workspace-astrologer/ /app/.openclaw/workspace-astrologer/

# Secure config file
RUN chmod 600 /app/.openclaw/openclaw.json

# Set environment
ENV OPENCLAW_CONFIG_DIR=/app/.openclaw
ENV HOME=/app

# Environment variables (Coolify will inject values)
ARG OPENCLAW_GATEWAY_TOKEN
ENV OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}

ARG ZAI_API_KEY
ENV ZAI_API_KEY=${ZAI_API_KEY}

ARG OPENAI_API_KEY
ENV OPENAI_API_KEY=${OPENAI_API_KEY}

ARG MEM0_URL
ENV MEM0_URL=${MEM0_URL}

ARG QDRANT_URL
ENV QDRANT_URL=${QDRANT_URL}

ARG QDRANT_API_KEY
ENV QDRANT_API_KEY=${QDRANT_API_KEY}

ARG QDRANT_MCP_URL
ENV QDRANT_MCP_URL=${QDRANT_MCP_URL}

ARG MEM0_API_KEY
ENV MEM0_API_KEY=${MEM0_API_KEY}

ARG TELEGRAM_BOT_TOKEN
ENV TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start OpenClaw
CMD ["pnpm", "exec", "openclaw", "gateway", "--port", "8000", "--bind", "lan"]