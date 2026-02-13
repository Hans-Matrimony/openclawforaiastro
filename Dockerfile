FROM node:22-bookworm-slim

  # Install system dependencies
  RUN apt-get update && apt-get install -y \
      sqlite3 \
      ffmpeg \
      python3 \
      python3-pip \
      build-essential \
      curl \
      && rm -rf /var/lib/apt/lists/*

  # Install OpenClaw CLI
  RUN npm install -g openclaw@latest

  # Create workspace directory
  RUN mkdir -p /app/.openclaw

  WORKDIR /app

  # Copy configuration files
  COPY openclaw.json /app/.openclaw/

  # Create id_keys directory
  RUN mkdir -p /app/.openclaw/id_keys

  ENV OPENCLAW_CONFIG_DIR=/app/.openclaw
  ENV NODE_ENV=production

  # Expose port
  EXPOSE 8000

  # Health check
  HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
      CMD curl -f http://localhost:8000/health || exit 1

  # Start OpenClaw Gateway
  CMD ["openclaw", "gateway", "--host", "0.0.0.0", "--port", "8000"]