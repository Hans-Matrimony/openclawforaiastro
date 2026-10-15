"""Derived chart facts, never event probabilities or a substitute for Shadbala.

D9: cyclic ninth harmonic. D10: forward from natal sign (odd) or ninth
sign (even). D24: forward from Leo (odd) or Cancer (even). Boundaries
are half-open and refer to sidereal longitudes, not rounded display degrees.
"""
import math
from datetime import datetime, timezone

try:
    from .topic_rules import SIGNS, LORDS
    from .kundli.vimshottari import current_period
except ImportError:
    from topic_rules import SIGNS, LORDS
    from vimshottari import current_period


METHOD = 'parashari-forward-varga-v1'
EXALTED = {'Sun': 'Aries', 'Moon': 'Taurus', 'Mars': 'Capricorn',
           'Mercury': 'Virgo', 'Jupiter': 'Cancer', 'Venus': 'Pisces', 'Saturn': 'Libra'}
ASPECTS = {'Sun': (7,), 'Moon': (7,), 'Mercury': (7,), 'Venus': (7,),
           'Mars': (4, 7, 8), 'Jupiter': (5, 7, 9), 'Saturn': (3, 7, 10)}


def varga_longitude(longitude, division):
    if type(longitude) not in (int, float) or not math.isfinite(longitude) or not 0 <= longitude < 360:
        raise ValueError('Invalid varga longitude')
    if division not in (9, 10, 24):
        raise ValueError('Unsupported division')
    if division == 9:
        return (longitude * 9) % 360
    sign = int(longitude // 30)
    # Multiply before division; never round a native value across a boundary.
    scaled = (longitude - sign * 30) * division
    part = min(division - 1, int(scaled // 30))
    start = (sign if sign % 2 == 0 else sign + 8) if division == 10 else (4 if sign % 2 == 0 else 3)
    return ((start + part) % 12) * 30 + scaled % 30


def divisional_chart(chart, division):
    asc = varga_longitude(chart['lagna_longitude'], division)
    asc_sign = int(asc // 30)
    positions = {}
    for planet, natal in chart['positions'].items():
        value = varga_longitude(natal['longitude'], division)
        index = int(value // 30)
        positions[planet] = {'planet': planet, 'longitude': value, 'sign': SIGNS[index],
                             'house': (index - asc_sign) % 12 + 1}
    return {'division': division, 'method': METHOD, 'lagna': SIGNS[asc_sign],
            'lagna_longitude': asc, 'positions': positions,
            'birth_time_sensitive': True}


def planet_conditions(chart):
    result = {}
    for planet, fact in chart['positions'].items():
        sign = fact['sign']
        exalted = EXALTED.get(planet)
        # Nodes have competing dignity/aspect conventions; explicitly omit them.
        dignity = 'not_assessed' if exalted is None else (
            'exalted_sign' if sign == exalted else
            'debilitated_sign' if SIGNS[(SIGNS.index(exalted) + 6) % 12] == sign else
            'own_sign' if LORDS[SIGNS.index(sign)] == planet else 'other_sign')
        result[planet] = {'dignity': dignity,
                          'aspect_houses': [(fact['house'] + offset - 2) % 12 + 1
                                            for offset in ASPECTS.get(planet, ())]}
    return {'method': 'sign-dignity-whole-sign-graha-aspects-v1', 'planets': result,
            'shadbala': 'not_evaluated', 'combustion': 'not_evaluated',
            'node_aspects': 'not_evaluated'}


def active_periods(birth_utc, moon, as_of):
    birth = datetime.fromisoformat(birth_utc)
    if (birth.tzinfo is None or not isinstance(as_of, datetime) or as_of.tzinfo is None or
            type(moon) not in (int, float) or not math.isfinite(moon) or not 0 <= moon < 360):
        raise ValueError('Aware instants and a valid sidereal Moon are required')
    birth = birth.astimezone(timezone.utc)
    at = as_of.astimezone(timezone.utc)
    value = current_period(birth.replace(tzinfo=None), moon, at.replace(tzinfo=None))
    return {'method': 'birth-balanced-vimshottari-365.25-v1', 'as_of_utc': at.isoformat(),
            **value, 'event_windows': [], 'event_timing': 'not_evaluated'}


def derived_facts(chart, birth, topic, as_of):
    divisions = (9, 10) if topic == 'career' else (9, 24) if topic == 'education' else (9,)
    return {'divisional_charts': {f'D{d}': divisional_chart(chart, d) for d in divisions},
            'conditions': planet_conditions(chart),
            'periods': active_periods(birth['utc'], chart['positions']['Moon']['longitude'], as_of)}
