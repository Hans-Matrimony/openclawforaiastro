# HANS ASTRO — OpenClaw Workspace (RahuNova-spec)

VedAstro/RahuNova-style AI astrologer setup for OpenClaw.

## Setup

1. Copy workspace files:
   - `SOUL.md`, `AGENTS.md`, `USER.md` → `~/.openclaw/workspace/`
   - `skills/vedastro-chart/` → `~/.openclaw/workspace/skills/`
2. Merge `openclaw.json.example` into `~/.openclaw/openclaw.json` (generate your own gateway token).
3. Set ONE env var: `DEEPSEEK_API_KEY` (platform.deepseek.com) or `DASHSCOPE_API_KEY` (Model Studio, qwen-flash = RahuNova wala model).

## What's inside

- `SOUL.md` — full RahuNova-style reading contract: verdict-first mixed (+/-) readings, 60–105 word limit, placement discipline (houses rare, only drivers), horary 3-digit protocol, memory taxonomy, Hinglish mirroring.
- `skills/vedastro-chart/SKILL.md` — live-verified VedAstro API endpoints (HoroscopePredictions, AllPlanetData, DasaAtRange, MatchReport). Free tier: 5 calls/min, no key.
- `openclaw.json.example` — DeepSeek (primary) + DashScope qwen-flash providers.
