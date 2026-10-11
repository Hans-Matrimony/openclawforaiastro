# Daily horoscope

The calculator returns a current Moon transit relative to the natal Moon, the
Vimshottari period and separate local traditional text. See [SKILL.md](SKILL.md)
for confirmed inputs, deployment scope, language and interpretation requirements.

Astronomical coordinates do not prove an interpretation's future accuracy.
`interpretation_source` and `transit_house_reference` distinguish local rule
text from calculated values.

```bash
python calculate.py --dob "1990-05-15" --tob "10:30 AM" --place "Mumbai" --language english
```

The example is synthetic. `--date` selects a 12:00 UTC snapshot; an omitted
date uses the current UTC instant. Errors do not produce a prediction. Existing
result fields and subscription commands remain available. Calculator tests must
not send readings to real subscribers.

`VEDASTRO_DAILY_ENABLED=1` opts into the configured self-hosted `DailyEvidence`
service. Native birth/current positions are independently checked; dasha,
source categories and typed Kaksha/Ashtakavarga scores are verified before the
original daily wording is composed. Native failures stop the reading, and no
model inference or hosted fallback is used. The service requires the existing
natal-provider configuration. With the flag off, the legacy local-rule flow remains.
