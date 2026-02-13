FROM node:22-bookworm-slim

# Install required system dependencies
RUN apt-get update && apt-get install -y \
    sqlite3 \
    ffmpeg \
    python3 \
    python3-pip \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install latest OpenClaw CLI
RUN npm install -g openclaw@latest

# Create OpenClaw directories
RUN mkdir -p /app/.openclaw/workspace

WORKDIR /app

# Copy config file
COPY openclaw.json /app/.openclaw/openclaw.json

# Environment
ENV OPENCLAW_CONFIG_DIR=/app/.openclaw
ENV NODE_ENV=production

# Zhipu API key (set in Coolify environment variables)
ENV ZHIPU_API_KEY=${ZHIPU_API_KEY}

# Expose gateway port
EXPOSE 8000

# Health check (OpenClaw serves HTML on root)
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8000 || exit 1

# Start OpenClaw Gateway
CMD ["openclaw", "gateway"]
