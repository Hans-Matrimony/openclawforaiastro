---
name: horoscope
description: Daily Vedic Moon-transit snapshots with separate traditional interpretations in English and Hinglish.
metadata: { "openclaw": { "requires": { "bins": ["python3"], "py": ["pyswisseph"] } } }
---

# Daily horoscope

Use this skill for an explicitly requested daily reading. A greeting or
emotional-only message needs no horoscope. Marriage, career, education and finance
outcomes use the fresh reviewed topic contract in `kundli`; daily Moon themes
are not evidence of a wedding, job, exam result or financial recovery.

## Confirmed inputs and deployment

Reuse the current subject's confirmed birth date, local time and resolved place
from the backend/session profile. Retrieve missing or conflicting inputs only
through the existing authenticated tools configured for this deployment. Never
copy a service URL from an example or contact another environment. If a lookup
fails, ask only for missing inputs; do not claim that memory retrieval always works.
Keep third-party details separate. Do not save profile or memory records merely
to generate a reading; use the existing authorized correction workflow.

## Calculate

```bash
python3 ~/.openclaw/skills/horoscope/calculate.py --dob "1990-05-15" --tob "10:30 AM" --place "Mumbai" --language english
python3 ~/.openclaw/skills/horoscope/calculate.py --dob "1990-05-15" --tob "10:30 AM" --place "Mumbai" --language hinglish
```

These inputs are synthetic, never the user's defaults. Resolve unknown times,
places and timezone conflicts before calculating. Follow an explicit user language
instruction; otherwise use the latest meaningful message. Auto detection can use
`--language auto --user-input "mera aaj ka horoscope batao"`.

Without `--date`, use the current UTC instant. `--date YYYY-MM-DD` evaluates
12:00 UTC on that date, recorded in `calculated_at_utc`; it is not local sunrise.
The date controls both transits and dasha selection. Vimshottari uses the birth
balance, elapsed time and a 365.25-day year. Do not label a future snapshot as
today or substitute noon/midnight for an unknown birth time.

## Evidence and answer

Missing rules, unknown signs or unavailable calculators return an error and a
nonzero CLI exit. Do not interpret an error or repeat the identical failed call.
With `VEDASTRO_DAILY_ENABLED=1`, the flow requires the configured self-hosted
`DailyEvidence` endpoint and `VEDASTRO_NATAL_ENABLED=1`. It checks native birth
and current positions against independent Swiss calculations, verifies the
clock, dasha and source categories, and validates typed native Kaksha scores.
An enabled native failure is an error, never a silent legacy fallback. Its
general house themes are labeled separately from native scores. This does not
reproduce the website's private interpretation engine. Transit Vedha is omitted
unless `VEDASTRO_DAILY_VEDHA_ENABLED=1` is explicitly configured. That option
adds a seven-planet obstruction-house occupancy check to the same native request,
using the pinned source's first-match table and Sun-Saturn/Moon-Mercury exceptions.
The gateway verifies the table and occupants before presenting a separate Vedha
fact. Do not equate a Kaksha point with an unobstructed transit or turn an
obstruction into a reversed outcome, probability, or event date.

With the daily flag off, the existing Swiss coordinates and `local_daily_rules`
from `vedic_rules.json` remain available. In either mode,
`transit_house_reference` is `natal_moon_whole_sign`, not a natal
placement or an ascendant-relative house.

Answer the daily focus first, then its relevant calculated facts and traditional
themes. Explain support and caution together. An ordinary answer can use 2-4
flowing sentences; requested detail may need more. Stop after the answer without
a repeated conclusion, service offer or routine closing question.

The legacy `prediction` field is traditional rule prose, not verified knowledge
about the user's health, investments, relationships or future. Do not promise gains,
medical outcomes, job results, wedding dates or another person's intentions.
Period names alone do not prove outcomes. Lucky color/number/day lookups are
cultural suggestions, not event evidence or guaranteed remedies. Numerical
ephemeris precision does not validate future predictions.

## Existing subscription workflow

Generating a reading does not authorize a subscription or outbound delivery.
Use subscription commands only in the existing user-authorized workflow. This
example ID is synthetic and must not replace the current authenticated user:

```bash
python3 ~/.openclaw/skills/horoscope/scheduler.py subscribe --user-id "+19995550123" --dob "1990-05-15" --tob "10:30 AM" --place "Mumbai" --language english --time "08:00"
python3 ~/.openclaw/skills/horoscope/scheduler.py unsubscribe --user-id "+19995550123"
python3 ~/.openclaw/skills/horoscope/scheduler.py send --dry-run
```

Do not run real subscriber delivery as a quality test. Use synthetic local
`scheduler.py test --dob ... --tob ... --place ...` inputs instead.
