# Direct answer integration

This development-only route uses the AstroChat `Dev` branch at source revision
`c7d63bb92bfb35bf11a8a4748b40a9afd22cc742`. Its prompt, schemas, server reference
and Swiss Ephemeris calculation/judgment engine are preserved in `assets/dev-v2`.
That directory's `provenance.json` records their hashes. `friend-mode.txt` is the
exact appended prompt extracted from the source server. The original source
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
The initial model request contains exactly one source system prompt followed by
the delivered history and current question. It does not prepend a separate
birth/memory/language instruction. Recalled facts and the selected saved birth
profile are supplied only when the model calls `read_memory`.

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

The source prompt plus Friend Mode, tool registry and five-iteration limit are
retained. Friend Mode requests short conversational messages separated
by blank lines. The source's fixed date is retained unchanged, as requested;
`get_current_datetime` supplies live time when called. HTTP/model retries
are disabled to avoid duplicate paid requests. Responses use the final model
text directly: no second summarizer, selector, verdict, translation repair or
additional answer-writing prompt is run. Ordinary user-memory/tool calls remain
part of the supplied agent flow. Failures do not fall back to the previous
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
and normal provider routing without a seed. Pinning reduces routing and sampling
variation, but cannot guarantee byte-identical output across provider changes,
live transit timestamps, different memory/history, or automatic horary numbers.
If the pinned endpoint is unavailable, stable mode fails rather than switching
providers silently. Tool calls run concurrently, with results kept in their
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
