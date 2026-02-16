FROM node:22-bookworm-slim

# Cache bust to force rebuild with updated config
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

# Install OpenClaw CLI globally
RUN npm install -g openclaw@latest

# Create workspace directory
RUN mkdir -p /app/.openclaw
RUN mkdir -p /app/.openclaw/id_keys
RUN mkdir -p /app/.openclaw/workspace

WORKDIR /app

# Copy configuration file
COPY openclaw.json /app/.openclaw/

# Set environment variables
ENV OPENCLAW_CONFIG_DIR=/app/.openclaw
ENV HOME=/app

# Gateway port
ENV OPENCLAW_GATEWAY_PORT=8000

# Gateway authentication
ARG OPENCLAW_GATEWAY_TOKEN
ENV OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}

# ZAI API Key (Zhipu/GLM)
ARG ZAI_API_KEY
ENV ZAI_API_KEY=${ZAI_API_KEY}

# Mem0 URL
ARG MEM0_URL
ENV MEM0_URL=${MEM0_URL}

# Qdrant URLs
ARG QDRANT_URL
ENV QDRANT_URL=${QDRANT_URL}

ARG QDRANT_MCP_URL
ENV QDRANT_MCP_URL=${QDRANT_MCP_URL}

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start OpenClaw Gateway (FIXED: bind to 0.0.0.0 for Coolify)
CMD ["openclaw", "gateway", "--port", "8000", "--allow-unconfigured", "--bind", "0.0.0.0"]