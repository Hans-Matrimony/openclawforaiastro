# Natal Chart Image and PDF Response

Use this when the user asks for their Western chart, birth chart, chart wheel, or PDF report.

## Required Details

- Name
- Date of birth
- Time of birth
- Place of birth

Use memory first. Ask only for missing fields.

## Chart Calculation

```bash
python3 ~/.openclaw/skills/western/natal_chart.py --dob "YYYY-MM-DD" --tob "HH:MM" --place "City" --json
```

If the output includes warnings, keep the interpretation cautious.

## Chart Wheel Image

```bash
python3 ~/.openclaw/skills/western/draw_natal_chart.py --chart-json '<CHART_JSON>' --user-id "<USER_ID>"
```

Send the generated image output exactly through the platform media path.

## PDF Report

Use the backend Western PDF request flow:

```text
WESTERN_PDF_REQUEST: dob=YYYY-MM-DD, tob=HH:MM, place=CITY, name=NAME
```

The WhatsApp backend will detect this line, generate the Western natal chart PDF, upload it to WhatsApp, and send it as a document.

## Chat Copy

After sending media, keep the message short:

```text
I made your Western birth chart.

Your big three are Sun <sign>, Moon <sign>, Rising <sign>.

Which part should we explore first?
```

If chart confidence is low:

```text
I made a limited chart because one calculation dependency was unavailable.

Your Sun sign is reliable, but Moon and Rising may need a full recalculation.

Want me to still explain the Sun sign first?
```
