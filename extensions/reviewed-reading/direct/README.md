# Direct answer integration

The calculation engine alone is updated to source Dev revision
`fb060c30c10568ab9d954b9e990ba4696528e1a9`, exposing upcoming antardashas and
the next mahadasha. Other captured assets retain their revisions below.
The adapter preserves every calculated field and adjusts only the engine's
output instruction to our existing two-part reading format. It removes the
upstream example date and does not equate a period boundary with an event date.
The period validator accepts the newly returned upcoming antardashas.
Companion prompts, memory, identity, request limits and PWA delivery are unchanged.

This development-only route uses the AstroChat `Dev` branch at source revision
`c7d63bb92bfb35bf11a8a4748b40a9afd22cc742`. Its prompt, schemas, server reference
and Swiss Ephemeris calculation/judgment engine are preserved in `assets/dev-v2`.
That directory's `provenance.json` records their hashes. `friend-mode.txt` began
as the appended source prompt and is now the authoritative dev-editable overlay;
the runtime loads this file directly at startup. The original source
repository remains untouched; the earlier source assets remain for comparison.

`POST /astrofriend/direct-answer` requires gateway authentication. Enable it with
`VEDASTRO_DIRECT_DEV_ENABLED=1` and `VEDASTRO_DIRECT_ENVIRONMENT=development`.
Set `MEM0_URL` and `MEM0_API_KEY` to the development memory service, and set
`VEDASTRO_DIRECT_MEM0_DEV_HOST` to its verified hostname. No production memory
default is used. `OPENROUTER_API_KEY` supplies the existing development model key;
`VEDASTRO_DIRECT_MODEL` defaults to the source example's
`qwen/qwen3-next-80b-a3b-instruct`.

The direct tool loop receives the user's saved birth fields, delivered
conversation pairs and that user's mem0 facts. `read_memory`, `update_memory` and
`save_birth_details` are bound to the caller's server-supplied identity. The model
cannot choose a different memory account. Memory identity and credentials are
excluded from model and chart-tool payloads. The source schema's `memory_text`
argument is honoured; there is no shared in-process user store.
The initial model request contains one system prompt followed by delivered
history and the unchanged current question. The source's existing memory and
selected-person placeholders are populated before the first model call, so a
saved profile is no longer declared empty or hidden behind an optional tool.
User-scoped mem0 facts are read once, bounded and encoded as untrusted data;
explicit birth notes are prioritized. Memory lookup failure is marked unavailable
and does not hide a supplied profile. An explicit request to ignore memory skips
the initial memory read. `read_memory` and writes remain available in the tool loop.

As in the source Dev server, chart tools default to the local `sweph` engine:
natal chart, Ashtakavarga, dasha/antardasha, transit and area judgment signals,
horary and matching. Its exact `sweph` version is pinned and locked in the asset
package; the container installs it and checks a real chart during the build.
The adapter normalizes saved ISO birth dates and 12-hour clock input before
calling the unchanged source engine. Local failures remain failures; there is
no automatic switch to different calculations. The source city table uses
fixed timezone offsets and its horary method automatically generates a number
when omitted. These source limitations are retained, not certified as website
equivalence. `VEDASTRO_DIRECT_USE_LOCAL_ENGINE=0` explicitly selects the previous
MCP-first/Python-fallback transport for comparison. The Python path uses
`VEDASTRO_DIRECT_PYTHON` or `python3`.

The calculation engine and source server reference remain unchanged. Runtime context fixes make the source
prompt and Friend Mode agree on two blank-line-separated parts for completed
chart readings; ordinary chat and clarifications stay brief. Sensitive-question
wording prohibits deriving death dates, lifespan, diagnoses or actual disease
risk from chart symbolism. The runtime date/year are filled from the current
Asia/Kolkata date instead of the source prompt's frozen date;
`get_current_datetime` supplies live time when called. HTTP/model retries
are disabled to avoid duplicate paid requests. Responses use the final model
wording directly: no second summarizer, selector, verdict, translation repair or
additional writer pipeline is run. For supported self-reading questions with a
complete profile, an answer without successful chart-tool evidence is withheld
and the same agent gets one bounded tool-selection correction. Only chart tools
are advertised during that correction, then the normal registry is restored.
Repeated tool avoidance or failed chart tools cannot complete that reading.
The correction drops the rejected ungrounded answer and repeats the exact current
question, preserving its subject instead of reinforcing an earlier prediction.
Clarifications, general explanations, ordinary conversation, practical questions
and death-date limitations are not forced into chart calculations. This guard is
scoped, not a universal intent classifier or a guarantee of factual predictions.
The five-round ceiling and no HTTP retry policy remain in place.
`answer_reading_tools` reports successful reading tools without logging content.
The score sanitizer replaces numeric `N/48` fractions with qualitative strength
words; standalone point counts rely on the Friend Mode instruction. Reading
bubble boundaries are repaired using whitespace only: existing soft
line breaks or the final complete sentence can become the second bubble. Already
valid two-part replies and ordinary chat are unchanged. No summary text is
invented, and a single sentence is never split just to create a second bubble.
The resolved app language is supplied explicitly, with current user overrides
taking priority. Period names and event dates must come from the tool output;
an ending dasha is not automatically a marriage window.
Direct death-date/lifespan questions have an additional date/age-pattern boundary:
supply a concise localized limitation when those patterns detect a predicted
death date or lifespan. Other wording passes through this filter, while runtime
instructions still prohibit unsupported medical assessments. The filter does not
validate health or longevity claims and does not route ordinary mentions of
death, grief or fear into a fixed response.
Failures do not fall back to the previous
answer pipeline. Inputs, output sizes, model rounds and request concurrency are
bounded; private content is not logged by this route.

Generation defaults to `VEDASTRO_DIRECT_GENERATION_MODE=stable`, as requested
after the live comparisons showed variation. This uses temperature `0`, top-k
`1`, top-p `1`, seed `42`, and the Qwen `parasail/fp8` endpoint with provider
fallbacks disabled.
The endpoint advertises seed, temperature and native tool support. Configure
`VEDASTRO_DIRECT_SEED` or `VEDASTRO_DIRECT_PROVIDER` explicitly to override these.
A different model requires an explicitly configured compatible endpoint.
`VEDASTRO_DIRECT_GENERATION_MODE=source` restores the source's temperature `0.7`
and normal provider routing without a seed; the context fixes still apply.
Pinning reduces routing and sampling
variation, but cannot guarantee byte-identical output across provider changes,
live transit timestamps, different memory/history, or automatic horary numbers.
If the pinned endpoint is unavailable, stable mode fails rather than switching
providers unless a backup was explicitly configured. Set
`VEDASTRO_DIRECT_FALLBACK_PROVIDER=deepinfra/fp8` to allow OpenRouter to try only
the primary and this backup for the same model, preserving temperature/seed/tool
requirements. Backup routing caps prices at $0.15 per million input tokens and
$1.50 per million output tokens. This is provider routing inside one request;
the application does not resubmit failed HTTP requests or uncertain generations.
Tool calls run concurrently, with results kept in their
advertised order, as in the source server.

Live frozen-input checks still varied on both tested endpoints with these
sampling controls. Stable mode therefore also uses a process-local cache for
completed tool-backed writer replies: at most 100 entries, expiring after 60
seconds. The key includes the authenticated user, full prompt and conversation,
tool evidence, model and generation settings. Random tool-call IDs are normalized
only for cache keys. Changes to actual tool arguments or evidence invalidate the
entry. Tool calls themselves are never cached and memory tools still execute.
Cache hits carry zero billed tokens/cost, no new generation ID, and an explicit
`answer_cache_hits` count; `answer_model_calls` counts upstream requests only.
Set `VEDASTRO_DIRECT_REPLY_CACHE=0` to disable it. Source mode never uses this
cache. This guarantees reuse only for identical writer inputs in the same live
process and TTL; fresh evidence, other instances and source website replies can
still produce different text.

Completed readings now request one short, relevant friendly question at the end
of the final bubble. The existing explanation and verdict remain; missing-detail
questions, errors, death-date questions, structured output and explicit requests
for no follow-up are excluded. A trailing question does not exempt an otherwise
ungrounded reading from chart-tool checks.
If the writer omits the closing, a local language-matched question is appended
without rewriting the answer or adding a model call. Existing closing questions
are preserved, and the same exclusions apply to this fallback.

With `VEDASTRO_DIRECT_CONTEXTUAL_CLOSING=1` in dev, the fixed fallback is replaced
by one bounded same-model closing request that also reviews an existing closing
question. It receives the current answer, the last ten conversation turns and
already-loaded non-birth memory notes. It must not repeat answered questions,
reuse a prior closing, introduce unrelated memories or invent personal facts.
The question must be answerable by the user, not ask them to predict the future.
The original answer is preserved. Unavailable, repetitive or invalid closings
are omitted; no generic sentence is forced. This request stays within the
existing five-call ceiling and is included in response usage diagnostics.

Personal stress conversations are eligible without a chart-tool call. If the
closing model fails, returns NONE or exhausts its call allowance, a local question
asks about the user's concern or support needs. It uses user statements and saved
facts, never an assistant's chart interpretation as evidence of the stress cause,
and avoids reusing its recent questions. Existing no-follow-up exclusions apply.

Explicit remedy requests retrieve up to five passages using the existing
`skills/qdrant/qdrant_client.py` and the dev `astrology_remedies` collection.
The dev collection contains remedy-bearing reference records copied with their
existing vectors. Structured `remedies` lists are retained alongside passage text.
The writer receives simple-practice references with gemstone-purchase clauses
and unrelated prediction fields omitted; the stored corpus is unchanged.
Set `VEDASTRO_DIRECT_QDRANT_COLLECTION` to use another verified collection. This
override applies only to the direct flow; the shared client's legacy default
is unchanged. It needs
`QDRANT_URL`, `QDRANT_API_KEY` and `OPENAI_API_KEY` (the collection's existing
`text-embedding-3-small` embedding model). Only fixed topic labels are sent for
embedding, not birth details, identifiers or raw conversation history. Current
topics take precedence; a short request such as “upay batao” inherits the most
recent relevant user topic. A short “haan batao” or “yes please” also retrieves
when it accepts the immediately preceding remedy offer. Ordinary readings and explicit refusals of remedies
do not retrieve. Retrieved data is bounded, quoted as untrusted reference material
and never treated as personal chart evidence or instructions. Missing credentials,
empty results, references without remedy content and retrieval errors return a
localized availability message before any model call, preventing unsupported
remedy generation. The PWA dev adapter accepts this specific zero-call result.
The response includes content-free `answer_remedy_status` and
`answer_remedy_sources` diagnostics on remedy turns. No remedy is stored as a
user fact in Mem0 by this integration.
