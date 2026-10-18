# Direct answer integration

This development-only route uses the supplied AstroChat prompt, tool schemas and
local engine from source revision `07abaeb040f5bd17e96a5796d963d23d37441fa4`.
`assets/provenance.json` records the unchanged source assets. The original source
repository remains untouched.

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

The source's chart tools call VedAstro's public MCP service, with the supplied
local Python engine as fallback. Its existing automatically generated Horary
number behavior is retained. The local fallback uses `python3` in the container;
`VEDASTRO_DIRECT_PYTHON` can select another interpreter. Neither path proves
exact parity with the website or its private calculation settings.

The source prompt, temperature, tool registry and five-iteration limit are
retained. The stale hardcoded date is refreshed at runtime. HTTP/model retries
are disabled to avoid duplicate paid requests. Responses use the final model
text directly: no second summarizer, selector, verdict, translation repair or
additional answer-writing prompt is run. Ordinary user-memory/tool calls remain
part of the supplied agent flow. Failures do not fall back to the previous
answer pipeline. Inputs, output sizes, model rounds and request concurrency are
bounded; private content is not logged by this route.
