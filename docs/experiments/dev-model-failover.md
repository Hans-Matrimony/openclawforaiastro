# Development model failover

This opt-in adapter applies only to the reviewed-reading direct HTTP route. It
does not change production, the native agent fallback configuration, astrology
calculations, prompts, palm reading or voice models.

Enable only in an isolated development deployment:

```text
VEDASTRO_DIRECT_DEV_ENABLED=1
VEDASTRO_DIRECT_ENVIRONMENT=development
ASTROFRIEND_DEV_MODEL_FAILOVER=1
```

The configured credential chain is DeepSeek `deepseek-v4-flash`, Groq
`llama-3.3-70b-versatile`, then OpenAI `gpt-4o-mini`. These use independent APIs,
not OpenRouter credits. Supply their respective secret environment variables
through the deployment secret manager. Missing credentials skip that provider;
no configured credentials fail closed. Never put credentials in this file.

Failover handles network errors, timeouts, listed transient/authentication/credit
HTTP failures, malformed responses, truncated output and malformed tool-call JSON.
It does not retry policy refusals, forbidden requests or ordinary invalid requests.
It does not judge whether a prediction is desirable or replace chart evidence.

One answer shares the existing inference allowance across all provider attempts:
six attempts, 80 seconds, and bounded request/output reservations. Each attempt
has a maximum 15-second timeout. A failed provider is not revisited within that
answer. Completed tool results are retained; the adapter never executes tools.
Caller cancellation stops failover. Responses exceeding 128 KiB are cancelled.
Low-temperature generation is retained, but cross-provider determinism is not
promised. Roll back by removing `ASTROFRIEND_DEV_MODEL_FAILOVER` or setting it to 0.

## Upgrade assessment, 2026-11-25

The npm `latest` package inspected was OpenClaw 2026.11.9. It requires Node
`>=24.16.0 <25 || >=26.1.0`; the existing Dockerfile uses Node 22 and OpenClaw
2026.3.28. The new package no longer exposes the root `openclaw/plugin-sdk`
entry or depends on `@mariozechner/pi-ai` / `pi-coding-agent`. The current
inference-budget plugin and startup validator depend on those exact interfaces.

Do not bypass `validateInstalledBudget` or merely change the Docker version.
First migrate the plugin to supported runtime/provider interfaces, then prove
shared budgets across retries, fallback, concurrent sessions and compaction
using the real new runtime with mock providers. Only then update the Docker
runtime and deploy to development. No runtime upgrade is enabled by this change.

## Verification

Focused offline checks:

```sh
node --test tests/test_direct_model_failover.mjs tests/test_direct_generation.mjs tests/test_reviewed_reading_route.mjs
```

All 37 checks passed, including an actual direct-answer invocation with a
simulated primary outage. No paid provider request was made. The broader dev
response suite is not green: existing engine provenance, display-length and
house-evidence expectations fail, and the native engine test needs `sweph` in
this checkout. The engine provenance mismatch is also present in Git HEAD.
These are release blockers to investigate separately, not reasons to rewrite
astrology logic as part of a provider change.
