"""Bounded natal facts derived from the same verified Lahiri longitudes.

D9/D10 mappings and full sign aspects follow VedAstro Vargas.cs/Core.cs
(MIT, see VEDASTRO-MIT.txt). Boundaries are explicitly half-open. These are
calculation facts, not event forecasts or a substitute for full Shadbala.
"""
from bisect import bisect_right
import math

SIGNS = ('Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
         'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces')
LORDS = ('Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
         'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter')
CLASSICAL = ('Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn')
ASPECT_COUNTS = {'Mars': (4, 7, 8), 'Jupiter': (5, 7, 9), 'Saturn': (3, 7, 10)}
VARGA_SOURCE = 'https://github.com/VedAstro/VedAstro/blob/master/Library/Logic/Calculate/Vargas.cs'
ASPECT_SOURCE = 'https://github.com/VedAstro/VedAstro/blob/master/Library/Logic/Calculate/Core.cs'
# Classical peak longitudes, independently checked against PyJHora const.py.
# Uccha bala is one positional component, never total Shadbala strength.
EXALTATION = {'Sun': 10, 'Moon': 33, 'Mars': 298, 'Mercury': 165,
              'Jupiter': 95, 'Venus': 357, 'Saturn': 200}


def longitude(value):
    if type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value < 360:
        raise ValueError('Invalid longitude for advanced facts')
    return value


def divisional_sign(value, division):
    value = longitude(value)
    if type(division) is not int or division not in (9, 10):
        raise ValueError('Unsupported divisional chart')
    # Global boundaries avoid subtraction rounding at the start of a sign.
    slot = bisect_right([i * (30 / division) for i in range(12 * division)], value) - 1
    sign, part = divmod(slot, division)
    if division == 9:
        start = (sign * 9) % 12
    else:
        start = sign if sign % 2 == 0 else (sign + 8) % 12
    return (start + part) % 12


def aspect_houses(planet, house):
    if planet not in CLASSICAL or type(house) is not int or not 1 <= house <= 12:
        raise ValueError('Invalid full-aspect input')
    return tuple((house + count - 2) % 12 + 1 for count in ASPECT_COUNTS.get(planet, (7,)))


def dignity(planet, value):
    value = longitude(value)
    if planet not in CLASSICAL:
        raise ValueError('Node dignity conventions are not evaluated')
    sign = int(value // 30)
    peak = EXALTATION[planet]
    low = (peak + 180) % 360
    separation = abs((value - low + 180) % 360 - 180)
    return {'own_sign': LORDS[sign] == planet,
            'exaltation_sign': sign == int(peak // 30),
            'debilitation_sign': sign == int(low // 30),
            'uccha_bala_virupas': separation / 3,
            'strength_component': 'uccha_bala_only', 'total_shadbala': None}


def advanced_facts(chart, asc, positions, topic):
    """Called only after reading.verified_positions validates the whole D1 chart."""
    target = {'career': 10, 'education': 5, 'marriage': 7}[topic]
    owner = LORDS[(asc + target - 1) % 12]
    degrees = {p['name']: longitude(p['sidereal_degree']) for p in chart['planet_positions']}
    owner_sign = SIGNS.index(positions[owner]['sign'])
    division = 10 if topic == 'career' else 9
    varga_sign = divisional_sign(degrees[owner], division)
    asc_longitude = chart.get('lagna_sidereal_degree')
    asc_varga = None
    if asc_longitude is not None:
        longitude(asc_longitude)
        if int(asc_longitude // 30) != asc:
            raise ValueError('Conflicting ascendant longitude')
        asc_varga = divisional_sign(asc_longitude, division)
    fact = {
        'planet': owner, 'rules_house': target, 'd1_sign': SIGNS[owner_sign],
        'd1_own_sign': LORDS[owner_sign] == owner,
        'd1_dignity': dignity(owner, degrees[owner]),
        'division': division, 'divisional_sign': SIGNS[varga_sign],
        'divisional_own_sign': LORDS[varga_sign] == owner,
        'same_d1_divisional_sign': varga_sign == owner_sign,
        'divisional_house': ((varga_sign - asc_varga) % 12 + 1) if asc_varga is not None else None,
        'divisional_ascendant': SIGNS[asc_varga] if asc_varga is not None else None,
    }
    near = degrees[owner] % (30 / division)
    fact['near_divisional_boundary'] = min(near, 30 / division - near) < 0.05
    asc_near = asc_longitude % (30 / division) if asc_longitude is not None else None
    fact['near_divisional_ascendant_boundary'] = (
        asc_near is not None and min(asc_near, 30 / division - asc_near) < 0.05)
    receiving = []
    for planet in CLASSICAL:
        houses = aspect_houses(planet, positions[planet]['house'])
        if target in houses:
            receiving.append({'planet': planet, 'from_house': positions[planet]['house'],
                              'to_house': target, 'count_from_planet': (target - positions[planet]['house']) % 12 + 1})
    return {
        'schema': 'advanced-natal-facts-v1', 'topic_ruler': fact,
        'full_sign_aspects_to_topic_house': receiving,
        'strength_scope': 'sign dignity, repeated-sign placement and uccha bala only; not full Shadbala',
        'node_aspects_evaluated': False, 'event_timing_available': False,
        'sources': {'divisional_mappings': VARGA_SOURCE, 'full_sign_aspects': ASPECT_SOURCE},
        'strength_sources': ['https://github.com/VedAstro/VedAstro/blob/master/Library/Data/OpenAPIStaticTable.cs',
                             'https://github.com/naturalstupid/PyJHora/blob/main/src/jhora/const.py'],
    }
