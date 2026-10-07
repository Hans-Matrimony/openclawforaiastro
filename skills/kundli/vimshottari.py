"""Vimshottari periods from sidereal Moon longitude, using a 365.25-day year."""

from bisect import bisect_right
from datetime import datetime, timedelta
import math
from numbers import Real

ORDER = ("Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury")
YEARS = (7, 20, 6, 10, 7, 18, 16, 19, 17)
YEAR_DAYS = 365.25
NAKSHATRA_SPAN = 360 / 27
NAKSHATRA_STARTS = tuple(i * NAKSHATRA_SPAN for i in range(27))


def nakshatra_index(longitude):
    """Half-open star intervals, including exact floating-point neighbors."""
    if isinstance(longitude, bool) or not isinstance(longitude, Real) or not math.isfinite(longitude) or not 0 <= longitude < 360:
        raise ValueError("Invalid sidereal Moon longitude")
    return bisect_right(NAKSHATRA_STARTS, longitude) - 1


def current_period(birth_utc, moon_longitude, as_of_utc):
    """Return the active maha/antardasha, accounting for the balance at birth.

    Inputs are naive UTC datetimes. Periods are half-open: [start, end).
    """
    star = nakshatra_index(moon_longitude)
    if any(not isinstance(value, datetime) or value.tzinfo is not None
           for value in (birth_utc, as_of_utc)):
        raise ValueError("Dasha instants must be naive UTC datetimes")
    if as_of_utc < birth_utc:
        raise ValueError("Dasha date cannot precede birth")
    index = star % 9
    elapsed = (moon_longitude - NAKSHATRA_STARTS[star]) / NAKSHATRA_SPAN
    start = birth_utc - timedelta(days=elapsed * YEARS[index] * YEAR_DAYS)
    # Skip whole cycles before scanning at most nine major periods.
    cycle = timedelta(days=120 * YEAR_DAYS)
    start += ((as_of_utc - start) // cycle) * cycle
    for _ in range(9):
        end = start + timedelta(days=YEARS[index] * YEAR_DAYS)
        if as_of_utc < end:
            break
        start = end
        index = (index + 1) % 9
    sub_start = start
    for offset in range(9):
        sub_index = (index + offset) % 9
        sub_end = (end if offset == 8 else sub_start + timedelta(
            days=YEARS[index] * YEARS[sub_index] / 120 * YEAR_DAYS))
        if as_of_utc < sub_end:
            return {
                "mahadasha": ORDER[index], "antardasha": ORDER[sub_index],
                "start": start.isoformat() + "Z", "end": end.isoformat() + "Z",
                "antardasha_start": sub_start.isoformat() + "Z",
                "antardasha_end": sub_end.isoformat() + "Z",
                "year_days": YEAR_DAYS,
            }
        sub_start = sub_end
    raise ValueError("Unable to locate active dasha")
