# Enhanced Memory Workflow

## Returning User

1. Fetch Mem0 list.
2. Fetch MongoDB recent messages.
3. Extract birth details and last topic.
4. Run the natal chart calculator if details are complete.
5. Avoid repeating the same reading unless the user asks to revisit it.
6. Save only genuinely new facts.

## New User

If they ask for a chart, ask once:

```text
I'd love to look at your chart.

Could you share your date of birth, time, and birth place?
```

If they ask a general question without details, answer from Western Qdrant at a general level and ask what area of life they want to explore.

## After a Chart Calculation

Save:

```text
Western chart calculated: Sun <sign>, Moon <sign>, Ascendant <sign>, confidence <high/medium/low>.
```

If confidence is low, save why:

```text
Western chart warning: Swiss Ephemeris unavailable, only simple Sun sign was reliable.
```

## After a Reading

Save:

```text
Western reading: User asked about <topic>; response focused on <placements/transits>; next follow-up asked <question>.
```
