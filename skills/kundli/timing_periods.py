"""Vimshottari MD/AD/PD, retaining the existing 365.25-day convention.

No event interpretation is encoded in calendar boundaries. Shared with the
receiving backend so it can recompute period attribution independently.
"""
from datetime import datetime, timedelta, timezone
import math

ORDER = ('Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury')
YEARS = (7, 20, 6, 10, 7, 18, 16, 19, 17)
YEAR_DAYS = 365.25


def instant(value):
    value = datetime.fromisoformat(value.replace('Z', '+00:00')) if isinstance(value, str) else value
    if not isinstance(value, datetime) or value.tzinfo is None:
        raise ValueError('An aware UTC instant is required')
    return value.astimezone(timezone.utc)


def periods(birth, moon, at):
    birth, at = instant(birth), instant(at)
    if type(moon) not in (int, float) or not math.isfinite(moon) or not 0 <= moon < 360 or at < birth:
        raise ValueError('Invalid dasha input')
    segment = moon / (360 / 27)
    star = math.floor(segment)
    index = star % 9
    start = birth - timedelta(days=(segment - star) * YEARS[index] * YEAR_DAYS)
    cycle = timedelta(days=120 * YEAR_DAYS)
    start += ((at - start) // cycle) * cycle
    for _ in range(9):
        end = start + timedelta(days=YEARS[index] * YEAR_DAYS)
        if at < end:
            break
        start, index = end, (index + 1) % 9
    result = {}
    for level in ('md', 'ad', 'pd'):
        result[level] = {'planet': ORDER[index], 'start': start.isoformat(), 'end': end.isoformat()}
        if level == 'pd':
            break
        parent_start, parent_end, parent_index = start, end, index
        for offset in range(9):
            child = (parent_index + offset) % 9
            child_end = (parent_end if offset == 8 else
                         start + (parent_end - parent_start) * (YEARS[child] / 120))
            if at < child_end:
                index, end = child, child_end
                break
            start = child_end
    return result


def scan_dates(as_of):
    """Every seven days over 730 days; NOT exact ingress/event boundaries."""
    start = instant(as_of)
    return [start + timedelta(days=day) for day in range(0, 731, 7)]
