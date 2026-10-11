---
name: vedastro_chart
description: Compute real Vedic astrology charts — planets, houses, predictions, transits, match, dasa — via the free VedAstro API (live-verified contracts). Use for EVERY explicit personal reading before answering. Never invent placements.
---

# vedastro-chart

Real Swiss Ephemeris chart data (the same engine RahuNova uses). Call this FIRST, then answer from the result. All endpoints below are live-tested.

## Rules

- Free tier = 5 calls/minute per IP (no key). On rate-limit Fail, wait 60s and retry once, then tell the user plainly.
- Every Time object: `{"StdTime":"HH:MM DD/MM/YYYY +HH:MM","Location":{"Name":"<place>","Longitude":<lon>,"Latitude":<lat>}}`
- Required inputs: date DD/MM/YYYY, exact time HH:MM 24h, place with lat/lon + timezone offset. If unknown, ask ONE short question — never guess coordinates or timezones.
- Always pass `"Ayanamsa":"RAMAN"`.
- If `Status` is `"Fail"` → report plainly; do not invent data.
- Optional premium: header `-H "x-api-key: $VEDASTRO_API_KEY"` for unlimited calls.

**Base:** `https://vedastro.zaishi.net/api/Calculate/`

## 1. HoroscopePredictions — MAIN reading tool (house-based rule drivers)

```bash
curl -s -X POST "https://vedastro.zaishi.net/api/Calculate/HoroscopePredictions" \
  -H "Content-Type: application/json" \
  -d '{"birthTime":{"StdTime":"19:45 14/06/1996 +05:30","Location":{"Name":"Kanpur","Longitude":80.3329,"Latitude":26.4499}},"Ayanamsa":"RAMAN"}'
```

Returns ~160 predictions. Each: `{Name (rule id like "House10LordInHouse6"), Description, RelatedBody:{Planets[], Houses[], Zodiacs[]}, Weight, Accuracy, Tags}`.

→ Filter to the user's topic (Tags/Name keywords), pick the 2–3 strongest, cite `RelatedBody` exactly ("10th lord in 6th"). Favorable/caution balance comes from the Description polarity.

## 2. AllPlanetData — natal or transit planet snapshot

```bash
curl -s -X POST "https://vedastro.zaishi.net/api/Calculate/AllPlanetData" \
  -H "Content-Type: application/json" \
  -d '{"PlanetName":"All","Time":{"StdTime":"19:45 14/06/1996 +05:30","Location":{"Name":"Kanpur","Longitude":80.3329,"Latitude":26.4499}},"Ayanamsa":"RAMAN"}'
```

→ All 9 planets: sign, nakshatra, house, degree, retrograde, dignity, conjunctions. Birth time = natal; NOW = transits.

## 3. DasaAtRange — Vimshottari periods (use for every "kab" timing question)

```bash
curl -s -X POST "https://vedastro.zaishi.net/api/Calculate/DasaAtRange" \
  -H "Content-Type: application/json" \
  -d '{"birthTime":{"StdTime":"19:45 14/06/1996 +05:30","Location":{"Name":"Kanpur","Longitude":80.3329,"Latitude":26.4499}},"startTime":{"StdTime":"00:00 01/01/2026 +05:30","Location":{"Name":"Kanpur","Longitude":80.3329,"Latitude":26.4499}},"endTime":{"StdTime":"00:00 31/12/2026 +05:30","Location":{"Name":"Kanpur","Longitude":80.3329,"Latitude":26.4499}},"Levels":3,"Ayanamsa":"RAMAN"}'
```

→ Mahadasa/Bhukti/Antaram in range. `startTime`/`endTime` are Time objects (same location), not plain dates.

## 4. MatchReport — two-person compatibility

```bash
curl -s -X POST "https://vedastro.zaishi.net/api/Calculate/MatchReport" \
  -H "Content-Type: application/json" \
  -d '{"MaleBirthTime":{"StdTime":"08:30 15/06/1990 +05:30","Location":{"Name":"Delhi","Longitude":77.21,"Latitude":28.61}},"FemaleBirthTime":{"StdTime":"14:20 22/09/1992 +05:30","Location":{"Name":"Mumbai","Longitude":72.8777,"Latitude":19.076}},"Ayanamsa":"RAMAN"}'
```

→ Kuta score + 16 factors.

## Parameter notes (hard-won — do not "fix" these)

- Param names are camelCase: `birthTime`, `startTime`, `endTime`, `MaleBirthTime`, `FemaleBirthTime`, `PlanetName`.
- POST body dates use `/` (`14/06/1996`). A GET path variant exists but is unreliable — always POST.
- `GeneralAstroData`, `ListAllCalls`, and the `APIKey/FreeAPIUser` path are NOT valid on this instance (tested — they fail).
