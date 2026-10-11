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

The authenticated `POST /astrofriend/daily` gateway route provides this same
checked reading without model inference. It accepts confirmed `dob`, `tob`,
`place`, `language`, and an optional `date` (12:00 UTC snapshot). Current requests
use the current UTC minute. Daily and topic routes share two calculation slots,
bounded request/response sizes, and a fixed Python executable without a shell.

The PWA additionally requires `ASTROFRIEND_VERIFIED_DAILY_REPLIES=true` and its
existing verified-astrology rollout flag. This is an opt-in daily path; native
errors return unavailable rather than falling back to a generative forecast.

`VEDASTRO_DAILY_VEDHA_ENABLED=1` separately opts into reviewed obstruction
geometry in the same native request. It requires the service's boolean
`includeVedha` capability. The adapter checks the pinned first-match Vedhanka
table against independently checked Moon-relative positions, seven-planet
occupancy and Sun/Saturn and Moon/Mercury exceptions. It rejects missing,
unrequested or inconsistent geometry. A qualifying obstruction is described
alongside a Kaksha point; it does not become an event verdict, probability or
a reversal of a traditional result. The flag defaults to `0`; both its input
fingerprint and the evidence state distinguish enabled readings. Published
table variants are not silently merged with the pinned source convention.
