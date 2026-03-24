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

# 🔴 CREATE package.json (IMPORTANT)
RUN pnpm init -y

# 🔴 INSTALL OPENCLAW LOCALLY (NOT GLOBAL)
RUN pnpm add openclaw@latest

# Install Python deps
RUN pip3 install uv requests duckduckgo-search jyotishganit geopy python-dotenv qdrant-client --break-system-packages

# 🔴 BUILD UI (THIS FIXES YOUR ERROR)
RUN pnpm dlx openclaw ui:build

# Create directories
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

# Copy your configs
COPY openclaw.json /app/.openclaw/
COPY config/ /app/.openclaw/config/
COPY .pi/ /app/.openclaw/.pi/
COPY skills/ /app/.openclaw/skills/
COPY app/whatsapp-support/workspace-astrologer/ /app/.openclaw/workspace-astrologer/

RUN chmod 600 /app/.openclaw/openclaw.json

# Env
ENV OPENCLAW_CONFIG_DIR=/app/.openclaw
ENV HOME=/app

# Port
EXPOSE 8000

# Start
CMD ["pnpm", "exec", "openclaw", "gateway", "--port", "8000", "--bind", "lan"]