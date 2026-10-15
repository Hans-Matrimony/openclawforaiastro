"""Vimshottari MD/AD/PD, retaining the existing 365.25-day convention.

No event interpretation is encoded in calendar boundaries. Shared with the
receiving backend so it can recompute period attribution independently.
"""
from datetime import datetime, timedelta, timezone
import math

try:
    from .kundli.vimshottari import current_period
except ImportError:
    from vimshottari import current_period

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
    # Retain the established MD/AD calendar byte-for-byte. Recomputing those
    # durations with a different float multiplication order can shift a boundary.
    base = current_period(birth.replace(tzinfo=None), moon, at.replace(tzinfo=None))
    result = {
        'md': {'planet': base['mahadasha'], 'start': instant(base['start']).isoformat(), 'end': instant(base['end']).isoformat()},
        'ad': {'planet': base['antardasha'], 'start': instant(base['antardasha_start']).isoformat(),
               'end': instant(base['antardasha_end']).isoformat()},
    }
    start, end = instant(base['antardasha_start']), instant(base['antardasha_end'])
    index = ORDER.index(base['antardasha'])
    parent_start = start
    for offset in range(9):
        child = (index + offset) % 9
        child_end = end if offset == 8 else start + (end - parent_start) * (YEARS[child] / 120)
        if at < child_end:
            result['pd'] = {'planet': ORDER[child], 'start': start.isoformat(), 'end': child_end.isoformat()}
            return result
        start = child_end
    raise ValueError('Unable to locate active pratyantardasha')


def scan_dates(as_of):
    """Every seven days over 730 days; NOT exact ingress/event boundaries."""
    start = instant(as_of)
    return [start + timedelta(days=day) for day in range(0, 731, 7)]
