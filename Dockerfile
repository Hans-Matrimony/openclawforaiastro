FROM node:22-bookworm-slim AS reading-guard-build
WORKDIR /build
RUN npm install --ignore-scripts --no-audit --no-fund typescript@5.9.3
COPY src/agents/astrologer-reading-style.ts src/agents/astrologer-reading-stream.ts /build/src/
COPY scripts/build-reading-guard.mjs /build/build-reading-guard.mjs
RUN node /build/build-reading-guard.mjs /build/src /build/output

FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y \
    sqlite3 \
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm openclaw@2026.3.28

WORKDIR /app

RUN npm init -y

# install openclaw locally
RUN pnpm add grammy @aws-sdk/client-bedrock

# python deps
RUN pip3 install uv requests duckduckgo-search jyotishganit geopy python-dotenv qdrant-client --break-system-packages

# Pin new evidence dependencies in a separate interpreter so enabling this
# route does not upgrade or change the legacy calculator's Python packages.
RUN python3 -m venv /opt/astrology-response-python \
    && /opt/astrology-response-python/bin/python -m pip install \
    pyswisseph==2.10.3.2 timezonefinder==9.0.0 tzdata==2026.4

# ❌ REMOVE UI BUILD (this was breaking everything)

# directories
RUN mkdir -p /app/.openclaw/agents/main/sessions \
    /app/.openclaw/credentials \
    /app/.openclaw/id_keys \
    /app/.openclaw/workspace \
    /app/.openclaw/workspace/memories \
    /app/.openclaw/agents/astrologer/sessions \
    /app/.openclaw/agents/tarot_reader/sessions \
    /app/.openclaw/agents/astrologer_preview/sessions \
    /app/.openclaw/agents/astrologer_preview_fast/sessions \
    /app/.openclaw/workspace-astrologer \
    /app/.openclaw/workspace-astrologer/memories \
    /app/.openclaw/workspace-tarot-reader \
    /app/.openclaw/workspace-tarot-reader/memories \
    /app/.openclaw/workspace-astrologer-preview \
    /app/.openclaw/workspace-astrologer-preview/memories \
    /app/.openclaw/config \
    /app/.openclaw/skills \
    /app/.openclaw/.pi \
    /app/bin \
    /app/workspace

RUN chmod -R 700 /app/.openclaw

COPY openclaw.json /app/openclaw.json
COPY openclaw.json /app/.openclaw/
COPY config/ /app/.openclaw/config/
COPY .pi/ /app/.openclaw/.pi/
COPY skills/ /app/.openclaw/skills/
COPY app/whatsapp-support/workspace-astrologer/ /app/.openclaw/workspace-astrologer/
COPY app/whatsapp-support/workspace-tarot-reader/ /app/.openclaw/workspace-tarot-reader/
COPY app/whatsapp-support/workspace-tarot-reader/ /app/bootstrap/workspace-tarot-reader/
COPY app/whatsapp-support/workspace-astrologer-preview/ /app/.openclaw/workspace-astrologer-preview/
COPY app/astrologer-prompt-profiles/ /app/astrologer-prompt-profiles/
COPY scripts/install-astrologer-prompts.mjs /app/install-astrologer-prompts.mjs
COPY extensions/astrologer-reading/ /app/extensions/astrologer-reading/
COPY --from=reading-guard-build /build/output/ /app/extensions/astrologer-reading/
COPY scripts/configure-reading-guard.mjs /app/configure-reading-guard.mjs
COPY scripts/verify-reading-guard-gateway.mjs /app/verify-reading-guard-gateway.mjs
# Fail the image build if the pinned runtime cannot load or apply the guard.
# Uses only synthetic credentials, a loopback model and an isolated state dir.
RUN node /app/verify-reading-guard-gateway.mjs /app/extensions/astrologer-reading
# The optional response path has its own immutable assets, outside mounted
# legacy skill/persona state. It cannot overwrite memories or credentials.
COPY extensions/astrology-response/ /app/extensions/astrology-response/
COPY extensions/reviewed-reading/route.mjs /app/extensions/reviewed-reading/route.mjs
COPY skills/kundli/response_evidence.py skills/kundli/response_contract.py skills/kundli/response_calculations.py skills/kundli/response_marriage_timing.py skills/kundli/response_consultation_wording.py skills/kundli/timing_periods.py skills/kundli/vimshottari.py skills/kundli/topic_rules.py skills/kundli/separation_rules.py skills/kundli/natal_cache.py skills/kundli/cities_india.json skills/kundli/verify_response_runtime.py /app/astrology-response/kundli/
RUN /opt/astrology-response-python/bin/python /app/astrology-response/kundli/verify_response_runtime.py
COPY app/astrology-response-writer/ /app/astrology-response/writer/
COPY scripts/start-openclaw-gateway.sh /app/start-openclaw-gateway.sh
COPY scripts/openclaw-docker-wrapper.sh /app/bin/openclaw

RUN chmod 600 /app/openclaw.json /app/.openclaw/openclaw.json \
    && chmod +x /app/start-openclaw-gateway.sh /app/bin/openclaw \
    && mkdir -p /app/node_modules/.bin \
    && ln -sf /app/bin/openclaw /app/node_modules/.bin/openclaw

ENV OPENCLAW_STATE_DIR=/app/.openclaw
ENV ASTROFRIEND_RESPONSE_PYTHON=/opt/astrology-response-python/bin/python
ENV OPENCLAW_CONFIG_PATH=/app/openclaw.json
ENV OPENCLAW_CONFIG_DIR=/app/.openclaw
ENV HOME=/app
ENV PATH=/app/bin:$PATH

# Health check to ensure the gateway is responsive
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8000/ || exit 1

EXPOSE 8000

ENTRYPOINT ["/app/start-openclaw-gateway.sh"]
CMD ["pnpm", "exec", "openclaw", "gateway", "--port", "8000", "--bind", "lan"]
