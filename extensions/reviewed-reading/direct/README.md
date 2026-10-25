# Optional direct response engine

This isolated response route preserves the PWA's account, subscription, payment,
quota, identity, conversation persistence and delivery services. It does not
migrate or clear stored data.

## Release configuration

Disabled by default. The isolated `extensions/direct-answer` plugin exposes
`POST /astrofriend/direct-answer`, protected by existing gateway authentication.

Both PWA and gateway must explicitly set:

- `ASTROFRIEND_DIRECT_MODE=pilot`
- `ASTROFRIEND_DIRECT_ENVIRONMENT=staging` (or production after approval)
- `ASTROFRIEND_DIRECT_TEST_USERS`: existing canonical IDs, comma separated.

Gateway configuration also needs `ASTROFRIEND_DIRECT_MEM0_HOST`, the existing
`MEM0_URL` and `MEM0_API_KEY`, and an approved `OPENROUTER_API_KEY`.
Enable the selected source flow with `VEDASTRO_DIRECT_FLOW=source` and the
separate companion with `VEDASTRO_DIRECT_CONTEXTUAL_CLOSING=1`.

Production memory requires HTTPS and the pinned hostname. Do not copy dev secrets
or change memory ownership keys. Partial configuration, empty allowlists and
non-pilot callers fail closed. Explicit `ASTROFRIEND_DIRECT_MODE=off` wins over
dev flags. Legacy `VEDASTRO_DIRECT_DEV_ENABLED=1` and
`VEDASTRO_DIRECT_ENVIRONMENT=development` work only when neither release mode
nor release environment is set.

`configure-direct-answer.mjs` changes only the new plugin's loading/enablement.
Flag-off requires no new keys. Existing agents/plugins retain their settings.
Only text requests for the existing Meera/male or Aarav/female selection qualify.
Tara, unsupported identities, media, attachments, quotes, audio and trial-intro
sessions retain the legacy flow.

Rollback: disable PWA dispatch first, let accepted turns reach a terminal state,
then disable the gateway plugin. Keep all memory/conversation/payment data.
Do not automatically retry uncertain generations.

## Request flow and limits

The PWA sends its canonical user, resolved gender/language, birth profile, last
ten delivered conversation pairs and trusted quota guidance. Failed, conflicting,
future or incomplete pairs are excluded. The current question occurs once.
The gateway reads only that user's Mem0 records. Tools bind memory reads/writes
to the caller, using the existing `/memory/{user}` and `/memory/add` contract.
Ignore-memory requests skip the initial lookup. Failed memory lookup is distinct
from verified empty memory.

Source flow uses the source tool schemas, temperature 0.7, seven reading rounds
and at most one separate companion call: **eight requests total**. Reviewed mode
allows five. PWA accepts the eight-call contract. Gateway deadline is 120 seconds;
the adapter timeout is 125 seconds. Failed paid submissions are not retried.
Server-owned quota guidance reaches both reading and companion prompts.

The companion uses user context without changing the reading's conclusion or
adding chart claims. Current dev presentation limits and evidence/scope/date
checks remain active. This adapted flow does not guarantee identical website text.

An ordinary concern without an astrology question uses the existing non-reading
boundary in both flows. A stress disclosure does not authorize an invented period
or year. Fee disclosures remain relevant to education follow-ups even when the
user does not repeat the study topic in every message. These release fixes add
no model stage and leave calculated-reading requests unchanged.
If an ordinary reply contains chart claims, its fallback acknowledges the stated
concern; study/night-shift disclosures keep that context instead of a generic
opening. This is a deterministic wording fallback, not another model call.

Default model: `qwen/qwen3-next-80b-a3b-instruct`. Source reading routing is automatic
unless `VEDASTRO_DIRECT_SOURCE_PROVIDER` pins an endpoint. Other generation and
companion settings remain in `generation.mjs`. Record deployed settings before
a pilot; this release does not silently change model/provider configuration.

## Calculation provenance and fallback

Calculation code matches source revision
`fb060c30c10568ab9d954b9e990ba4696528e1a9`.
OpenClaw dev commit `f9b80ebfff197c284b03a24d85106e99dd094652` changed two
output instruction strings. `assets/dev-v2/provenance.json` records upstream,
adapted and normalized non-instruction hashes. Other assets retain their recorded
source revisions. Do not describe the whole adapted file as unchanged upstream.

The source local Swiss Ephemeris engine and its locked native dependency remain
the default. Source limitations include a fixed city/timezone table and generated
horary numbers. `VEDASTRO_DIRECT_USE_LOCAL_ENGINE=0` explicitly selects the older
MCP/Python comparison path; failures never silently switch engines.

An unreconciled reading may show a consistent current/future period schedule,
clearly distinguished from an event prediction. Fallbacks validate real calendar
dates, interval order, current India date and consistent subjects/schedules.
This does not change calculated values or invent topic-specific event dates.

Remedies use the existing Qdrant skill at
`/app/.openclaw/skills/qdrant/qdrant_client.py`, the verified collection in
`VEDASTRO_DIRECT_QDRANT_COLLECTION` (default `astrology_remedies`) and existing
`QDRANT_URL`, `QDRANT_API_KEY`, `OPENAI_API_KEY`. Only fixed topic labels are
embedded. Missing references yield an unavailable/empty response, not invented
remedies. This release does not copy corpus data or modify the shared skill.

## Verification and release gates

Run `tests/test_direct_*.mjs`, the PWA adapter/quota/payment/delivery suites and
the browser checks. Docker builds run `scripts/verify-direct-answer-gateway.mjs`
against the pinned packaged runtime using a real local chart plus synthetic
model/memory stubs. No paid APIs are called. Bind the PWA adapter and set
`PWA_DIRECT_ADAPTER` to test both services together with `--network none`.

Offline checks do not certify a production rollout. Remaining gates include
repository-wide checks, deployed image/config verification, isolated staging,
approved live acceptance and a rollback drill. Keep unrelated root dependency
repairs separate from this response feature.
