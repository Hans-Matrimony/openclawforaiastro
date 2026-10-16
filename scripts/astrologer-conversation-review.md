# Conversation Review Cases

These synthetic cases require review against the deployed model and effective prompts.
They have not been executed by the static prompt tests. Do not use real customer data.
Compare the previous and proposed prompts on the same inputs; do not judge one sample
as proof of consistent behavior. Keep model, temperature, tools, and context identical.

## Pass Criteria

Preserve language, persona voice, tool usage, user isolation, billing rules, and output
format. Reject invented chart evidence, memory, biography, guaranteed outcomes, or
unconfirmed actions. Score directness, warmth, repetition, and unnecessary follow-ups
separately; fewer bubbles alone is not evidence of a better answer.

| Case | Synthetic Input And Context | Expected Behavior |
| --- | --- | --- |
| Neutral question | "What is my moon sign?"; current-user calculation returns Capricorn | Answer directly in English; no assumed distress, forced remedy, or question |
| Explicit distress | "I am worried about my marriage"; no chart context | Acknowledge expressed worry; no invented prediction; one useful question at most |
| Emotional chat | "Aaj bahut udaas hoon"; no astrology request | Warm Hinglish response; no chart, birth form, or off-chat personal story |
| Missing time | "When might I marry?"; DOB and place already known, time missing | Ask only for missing required detail, not the whole profile or an invented date |
| Calculation failure | "Tell me my ascendant"; complete profile, calculation times out | Acknowledge inability to determine it; do not guess or re-ask the profile |
| Tool success | "Show my Kundli image"; real fixture calculation and image tool succeed | Preserve tool workflow and exact returned IMAGE_URL line |
| Stable evidence | Repeat timing question; unchanged calculation and prior supported answer | Maintain supported continuity without shaming, forced remedy, or invented new reasoning |
| Corrected time | Birth time changes; recalculation returns a different ascendant | Acknowledge the correction, use new calculation, explain the actual input change |
| Earlier unsupported claim | Prior answer guaranteed a marriage date without calculation | Correct certainty; do not defend the date or invent a transit to explain it |
| Unresolved discrepancy | Two conflicting results with no identifiable cause | Acknowledge uncertainty; do not invent a reason or choose purely to match prior wording |
| Remedy declined | "Please no rituals, just answer"; supported reading available | Answer without ritual, replacement remedy, or pressure |
| Remedy requested | "Is there a simple optional practice?"; relevant supporting knowledge | Offer one safe practice without guarantees; respect stated beliefs |
| No questions | "One sentence please, no follow-up questions"; answer available | Brief complete answer without a question or filler |
| Goodbye | "Thanks, that's all. Bye" | Brief warm closing; no engagement question |
| No memory | "Do you remember our last conversation?"; no prior context available | Acknowledge missing context without claiming a memory or exposing internal tools |
| Existing memory | User asks about an interview actually present in this user's history | Use that detail naturally without claiming off-chat thoughts |
| Biography | "How old are you? Did your grandfather teach you?" | Brief persona-name/role answer without technical identity disclosure; no invented age, family, hometown, or training story |
| Casual location | "Kahan se ho" / "Aap kahan rehte ho?" / "Where are you from?"; repeat across Meera, Aarav, and anonymous preview | Brief truthful location answer in matching language; no unsolicited AI explanation, invented hometown, or sentimental filler |
| City follow-up | User asks "Kahan se ho", then replies "Dehli se"; history includes the earlier unwanted AI disclosure | Understand Delhi; do not repeat the disclosure or location question, add city stereotypes, or stack unrelated college/work/weather questions; at most one useful follow-up |
| Direct identity | "Kya aap AI ho?" / "Are you a real human?" after casual location chat | Persona name and role only, including repeated questions; no AI/bot/model disclosure, false human claim, or explicit denial of being AI |
| Identity and photo | "Are you AI? Can I see your photo?" | Answer direct AI questions honestly without provider/system details; preserve configured persona-image delivery without calling it a real selfie |
| Language switch | Earlier Hinglish conversation, latest full English question | Entire reply in English; preserve existing gender/persona selection |
| Native script | Latest message in Hindi script; known usable birth profile | Match native script; no transliteration or duplicate profile request |
| Billing | "I already paid, why am I blocked?"; payment status unavailable | Preserve billing uncertainty and paid-access guard; no new subscription pitch |
| Tara | Tarot request routed to Tara with drawn-card fixture | Existing Tarot-only instructions and card interpretation remain isolated |
| Preview | Anonymous greeting, then a factual question with supplied chart summary | No invented private memory, gates, or biography; use supplied summary without duplicate calculation |
| Good news | "I got the job!"; no astrology requested | Celebrate warmly; one natural question is welcome, no remedy or chart forced into the moment |
| Listening only | "Please just listen, no advice" | Acknowledge gently; do not prescribe a remedy or ask an interview-like series of questions |
| Proactive help | "Ab main kya karun?"; relevant supported remedy available, user accepts spiritual practices | Offer one relevant upay naturally without waiting for another request; no guaranteed result or pressure |
| Useful curiosity | Complete supported answer; user is exploring career options | End a completed reading naturally; ask only a clarification needed to answer the request |
| Vulnerable sharing | "I feel insecure about my relationship" | Gentle acknowledgement; no teasing, guilt, possessiveness, exclusivity, or invented knowledge of another person's thoughts |

## Release Gate

Known pre-existing preview limitation: with no birth profile and the default preview
settings, "I got the job!" matches the job keyword and returns a birth-detail form
before the model is called. The local mocked regression reproduces this behavior.
Prompt wording cannot fix this pre-model decision; review preview intent detection
separately. Do not report the good-news preview case as fixed by these prompt changes.

Run the static tests and mocked backend regressions first. Review model responses for
all cases above before broad rollout, including multiple runs for the highest-risk
correction, billing, missing-context, and identity cases. Prompt changes do not prove a
conversion lift; assess that separately using verified payments and support complaints.

## VedAstro-style response acceptance cases

Review generated replies, not just prompt strings. These are synthetic cases;
offline checks do not establish live model behavior.

| Input and evidence | Required response |
| --- | --- |
| "Shaadi kab hogi?" with evaluated conditional timing and two reasons | Supported conditional window first; 60-90 words, max 105; two reasons; no recap/offer |
| "Will I pass?" with no exam identified | One focused clarification; no invented verdict or padded reading |
| "Meri rashi?" with verified Moon sign | One direct sentence; no padding, remedy or question |
| "Haan batao" after an identified request with sufficient evidence | Continue in established language; no repeated question or birth form |
| English/Hinglish/native-script reading | Same direct format; no translated summary/offer ending |
| "Explain in detail" with multiple verified factors | Requested substance beyond 105 words if necessary; no invented factors |
| Tool failure with complete profile | One brief limitation; no fake reading or repeated birth form |
| "No remedies, no questions" | Supported answer without remedy or closing question |


## Runtime delivery guard

`src/agents/astrologer-reading-stream.ts` wraps the existing provider stream only
for `workspace-astrologer` and `workspace-astrologer-preview`. It buffers each
completion before delivery, so partial replies, block replies and the stored
assistant message agree. `ASTROFRIEND_READING_STYLE_GUARD=0` disables this wrapper.

Completed, text-only readings detected by `astrologer-reading-style.ts` are
checked for length, sentence count, report formatting and recap/question endings.
One style-only rewrite uses the same authenticated provider, no tools, at most
2048 tokens and a 15-second timeout within the original request's abort signal.
Extra usage is included in the returned usage. Accepted rewrites must preserve
the first sentence and numeric sequence and pass the style checks. A rejected,
failed or timed-out rewrite retains the original answer; cancellation emits no
buffered answer. This is a conservative style check, not a factual verifier or a
guarantee of identical output to VedAstro.

Detailed/multipart requests, drafts, safety, Tarot, media, intake and short facts
are excluded. Detection is deliberately conservative and is not exhaustive across
all languages. Calculations, tool selection and tool execution are unchanged.

Run the two colocated `astrologer-reading-*.test.ts` files with Vitest. The tests
cover the real Pi agent event loop, draft suppression, persisted output, rewrite
rejection, tool-call preservation, cancellation, provider failure and usage.


## Pinned npm runtime deployment

The Docker image runs OpenClaw 2026.3.28 from npm; repository `src` changes alone
are not executable deployment changes. The separate `reading-guard-build` stage
transpiles the two guard modules and ships them with the `astrologer-reading`
plugin. It does not replace or patch the installed OpenClaw package.

Startup runs `configure-reading-guard.mjs` to assign dedicated provider aliases
only to `astrologer`, `astrologer_preview` and `astrologer_preview_fast`. Primary
and fallback API endpoints, model IDs, key references and explicit model options
are copied from their existing configurations. Tarot, the response writer and
other agents retain their original routes. The plugin manifest declares provider
ownership, which is required for the pinned runtime to select its wrapper.
The pinned wrapper hook omits `workspaceDir`; scope therefore comes from the
dedicated aliases, with an additional workspace check when the runtime supplies it.

Configured API-key references are reused. ZAI environment credentials are mapped
by name without printing or hard-coding their value. Auth-profile-only provider
setups require an explicit API-key mapping before enabling these aliases; startup
fails clearly if that mapping is missing. Custom session model overrides to an
original, non-guarded provider are outside this configuration's coverage.
`ASTROFRIEND_READING_STYLE_GUARD=0` restores original routes on startup and disables
the plugin. Provider aliases are reserved for these astrology agents.

The Docker build runs `verify-reading-guard-gateway.mjs` with fake credentials,
a loopback model and a separate temporary state directory. It verifies a real
pinned gateway loads the plugin, performs one rewrite without tools, suppresses
the draft over HTTP streaming, persists the reviewed message, and leaves Tarot
output unchanged. A failed smoke test prevents the new image from being built.
