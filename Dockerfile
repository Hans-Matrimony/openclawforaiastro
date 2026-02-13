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

RUN npm install -g openclaw@latest

WORKDIR /app

RUN mkdir -p /app/.openclaw

COPY openclaw.json /app/.openclaw/openclaw.json

ENV OPENCLAW_CONFIG_PATH=/app/.openclaw/openclaw.json
ENV NODE_ENV=production

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["openclaw", "gateway", "--port", "8000"]
