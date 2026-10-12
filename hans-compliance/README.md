# hans-compliance

Fixture-based compliance harness for the HANS astrologer Reading Output Contract
(`hans-astro-workspace/SOUL.md`).

## Why this exists

The 12-Oct-2026 WhatsApp chat showed the bot leaking tool-report language
("VedAstro ke Shadbala assessment mein Shukra strong mana gaya hai") and hedging
("conditional sanket, pakki date nahi") — both explicitly banned by the contract.
This harness verifies replies stay in the VedAstro-style shape:

- first sentence directly answers the question
- 60-105 word reading mixing at least one favorable factor and one caution, with timing
- a separate verdict line under 10 words
- one enticing follow-up question that does not repeat the original
- no tool/field-name leaks, no summary labels, plain chat text

## Usage

```bash
# one-time: rebuild fixtures from the rahunova-re captures
node hans-compliance/tools/make-fixtures.mjs <rahunova-re-dir> hans-compliance/fixtures

# self-test the validators (no API key needed)
node hans-compliance/run.mjs --mock

# live contract test against DeepSeek
DEEPSEEK_API_KEY=sk-... node hans-compliance/run.mjs --model deepseek-chat

# one scenario only
node hans-compliance/run.mjs --mock --scenario gf-marriage
```

Scenarios: `gf-marriage`, `marriage-timing`, `vague-result`, `greeting`.
Reading scenarios expect the full 3-part shape; routine scenarios expect a short
placement-free reply.

## Checks

| Check | Applies to | Fails when |
|---|---|---|
| shape | reading | reading/verdict/follow-up parts missing |
| reading-words | reading | outside 40-130 (warn outside 60-105) |
| reading-sentences | reading | fewer than 2 or more than 5 |
| first-sentence-direct | reading | opener has no answer keyword/year |
| verdict | reading | missing, >10 words, phrased as question, or labelled |
| follow-up | reading | missing, >16 words, or repeats the original question |
| no-leaks | all | Shadbala/VedAstro/field names/tool names/hedges present |
| no-summary-label | all | "in summary/overall/bottom line/..." present |
| plain-text | all | markdown headers, bold, bullets, or emoji present |
| one-window | timing | 4+ month-year tokens (two windows) or none |
| mixed-balance | reading | warn-only: no favorable or no caution term |
| routine-short / no-placements | routine | reply too long or contains placements |

## Fixture provenance

- `marriage-predictions.json`, `planets-slice.json`: live VedAstro API captures from
  `rahunova-re` (2026-10-12), test person 14-06-1996 19:45 Kanpur, RAMAN ayanamsa.
- `dasa-ranges.json`: SYNTHETIC structure with illustrative values (labelled in the
  file). Replace with a live `DasaAtRange` capture before trusting timing accuracy.

## Limitations and next steps

- `first-sentence-direct` and follow-up repetition are keyword heuristics, not
  semantic judgement.
- `mixed-balance` is warn-only because phrasing varies.
- Mock mode proves the validators discriminate contract-perfect replies from the
  observed failure modes; live mode measures the actual model against the contract.
- Workflow: run live once `DEEPSEEK_API_KEY` is available, change `SOUL.md` only in
  response to failing checks, and keep this harness green before prompt edits ship.
