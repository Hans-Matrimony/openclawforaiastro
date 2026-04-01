FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y \
    sqlite3 \
    ffmpeg \
    python3 \
    python3-pip \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm openclaw@latest

WORKDIR /app

RUN npm init -y

# install openclaw locally
RUN pnpm add grammy @aws-sdk/client-bedrock

# python deps
RUN pip3 install uv requests duckduckgo-search jyotishganit geopy python-dotenv qdrant-client --break-system-packages

# ❌ REMOVE UI BUILD (this was breaking everything)

# directories
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

RUN chmod -R 700 /app/.openclaw

COPY openclaw.json /app/.openclaw/
COPY config/ /app/.openclaw/config/
COPY .pi/ /app/.openclaw/.pi/
COPY skills/ /app/.openclaw/skills/
COPY app/whatsapp-support/workspace-astrologer/ /app/.openclaw/workspace-astrologer/

RUN chmod 600 /app/.openclaw/openclaw.json

ENV OPENCLAW_CONFIG_DIR=/app/.openclaw
ENV HOME=/app

EXPOSE 8000

CMD ["pnpm", "exec", "openclaw", "gateway", "--port", "8000", "--bind", "lan"]