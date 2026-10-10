# Combined timing screen

This service calculates a bounded traditional astrology screen. It is not a
calibrated event predictor, complete Shadbala implementation or legal timetable.
The old natal/topic/separation endpoints and raw chart modes stay compatible.
For user-confirmed existing marriages, the marriage-only `harmony` intent labels
the same partnership screen as relationship context, not a forecast of a new
wedding or empirically measured harmony. Remarriage timing needs clarification.

## Calculations

- Primary Swiss Ephemeris, Lahiri, whole-sign houses, true nodes, confirmed birth
  coordinates and historical UTC offset. No substitute chart or second provider.
- Vimshottari MD, AD and PD use birth Moon longitude, balance at birth and the
  existing 365.25-day year. Periods are half-open and retain their full boundaries.
- Seven classical planets get sign dignity, angular Uchcha Bala (0–60 virupas),
  Parashari D9 dignity/vargottama, selected combustion orbs, and retrograde flags.
  Nodes have no invented exaltation/strength or aspect rules. Retrograde is a
  measured flag and is not automatically interpreted as good or bad.
- Combustion orbs: Moon12°, Mars17°, Mercury14°/12° retrograde, Jupiter11°,
  Venus10°/8° retrograde, Saturn15°. This is one explicitly selected convention.
- Jupiter and Saturn positions/speeds are recomputed every seven days for the
  next 730 days. No natal cache is reused for future positions. Output exposes
  every sample and does not imply daily/continuous support between samples.

## Local interpretive filters

The AD must connect with topic houses through ownership, occupation or selected
whole-sign aspects; MD or PD must also connect. Topic houses are career10/2,
education5/9, finance2/11, marriage7/5 and relationships5/7. Mars aspects4/7/8,
Jupiter5/7/9, Saturn3/7/10, other classical planets7; nodes are excluded.

Jupiter occupation/aspects must touch a topic house. Saturn occupation/aspects
are checked as a pressure factor. AD debility, combustion, D9 debility, or Saturn
pressure mark an observation mixed. Two qualifying observations within a month
are needed to list that month; all qualifying observations must be without
these cautions to call the month aligned. This rule is a transparent **local screening heuristic**,
not a quoted classical event prediction or an empirically validated probability.
All mixed observations remain available for audit; the renderer must not turn
them into definite dates or a negative life verdict. Romantic event candidates
are excluded before age18 under the existing year convention.

Separation requires a selected natal separation condition already evaluated by
`separation_rules.py`, AD plus MD/PD links to7/6/8/12, and a Saturn pressure
observation. Strain alone is insufficient. Any flagged months concern the
relationship assessment; they cannot establish filing/hearing/finalization dates.
The timing route resolves the older Mars rule's unevaluated Moon/Mercury inputs:
a waxing Moon is selected as benefic, and Mercury is selected as benefic only
without co-sign association with Sun/Mars/Saturn/nodes or a waning Moon.
These phase/association conventions are explicit, not missing-data guesses.

## Validation and delivery

The authenticated route binds the exact own birth request and language/intent.
The PWA recomputes MD/AD/PD, dignity/D9/combustion, house/aspect filters, candidate
months and exact reviewed prose from supplied measurements. It rejects altered,
stale, incomplete, nonfinite or cross-request evidence before display. It trusts
astronomical measurements from the authenticated service, not an independent
ephemeris in the frontend. Both sides report zero inference calls/tokens.

The endpoint has the existing request size, concurrency, process timeout and
body limits. Failure does not trigger speculative regeneration. Safety, quotas,
ownership, corrected/incomplete birth data, Tarot and media retain their gates.

## References and remaining boundaries

- [Swiss Ephemeris programming interface](https://www.astro.com/swisseph/swephprg.htm): astronomical positions, speeds and sidereal modes.
- [PyJHora Parashari divisional charts](https://github.com/naturalstupid/PyJHora/blob/main/src/jhora/horoscope/chart/charts.py): D9 convention reference.
- [PyJHora strength calculations](https://github.com/naturalstupid/PyJHora/blob/main/src/jhora/horoscope/chart/strength.py): Uchcha Bala reference and the distinction from the complete six-component Shadbala.
- [VedAstro natal conditions](https://github.com/VedAstro/VedAstro/blob/master/Library/XMLData/HoroscopeDataList.xml): the existing selected separation conditions, not the local combined timing filter.

No complete Shadbala (Sthana/Dig/Kala/Cheshta/Naisargika/Drik total), Ashtakavarga,
D10/D24 interpretation, inferred birth time rectification, node dispositors or
probability calibration is claimed. These cannot be safely invented to make a
"full" label. A candidate month is conditional symbolism, not proof an event
will happen, a past marriage occurred, or another person loves/replies to someone.
