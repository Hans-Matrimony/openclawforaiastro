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

The source prompt plus Friend Mode, temperature, tool registry and five-iteration
limit are retained. Friend Mode requests short conversational messages separated
by blank lines. The source's fixed date is retained unchanged, as requested;
`get_current_datetime` supplies live time when called. HTTP/model retries
are disabled to avoid duplicate paid requests. Responses use the final model
text directly: no second summarizer, selector, verdict, translation repair or
additional answer-writing prompt is run. Ordinary user-memory/tool calls remain
part of the supplied agent flow. Failures do not fall back to the previous
answer pipeline. Inputs, output sizes, model rounds and request concurrency are
bounded; private content is not logged by this route.
