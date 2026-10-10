"""Bounded primary-engine forecast scan, isolated from legacy chart contracts."""
import math
from datetime import datetime, timezone
from pathlib import Path

from reading import reading_packet, verified_positions
from timing_periods import instant, scan_dates
from timing_rules import REVISION, SETTINGS, assess_timing, evidence_digest, render_timing, validate_timing_result
from separation_rules import request_fingerprint

IDS = {'Sun': 0, 'Moon': 1, 'Mercury': 2, 'Venus': 3, 'Mars': 4,
       'Jupiter': 5, 'Saturn': 6, 'Rahu': 11}


def render_verified_timing(chart, topic, *, language='english', intent='overview', as_of_utc=None):
    import swisseph as swe
    # Reuse input/engine/node/nakshatra checks before any forecast interpretation.
    base = reading_packet(chart, topic if topic in ('career', 'education', 'marriage') else 'marriage',
                          as_of_utc=as_of_utc)
    if base['settings'] != SETTINGS:
        raise ValueError('Timing uses only the documented Lahiri/true-node convention')
    verified_positions(chart)
    birth = {key: chart['user_input'][key] for key in
             ('dob', 'tob', 'place', 'coordinates', 'timezone_offset', 'birth_utc')}
    at = instant(base['as_of_utc'])
    swe.set_ephe_path(str(Path(__file__).parent / 'ephe'))
    swe.set_sid_mode(swe.SIDM_LAHIRI)

    def julian(when):
        return swe.julday(when.year, when.month, when.day,
                         when.hour + when.minute / 60 + (when.second + when.microsecond / 1e6) / 3600)

    def measurements(when, names):
        jd = julian(when)
        aya = swe.get_ayanamsa_ut(jd)
        result = {}
        for planet in names:
            xx, flags = swe.calc_ut(jd, IDS[planet], swe.FLG_SWIEPH | swe.FLG_SPEED)
            if not flags & swe.FLG_SPEED:
                raise ValueError('Ephemeris did not return speeds')
            result[planet] = {'longitude': (xx[0] - aya) % 360, 'speed': xx[3]}
        return result

    born = instant(birth['birth_utc'])
    natal = measurements(born, IDS)
    natal['Ketu'] = {'longitude': (natal['Rahu']['longitude'] + 180) % 360, 'speed': natal['Rahu']['speed']}
    for p in chart['planet_positions']:
        if not math.isclose(natal[p['name']]['longitude'], p['sidereal_degree'], abs_tol=1e-6):
            raise ValueError('Timing and natal engines disagree')
    jd = julian(born)
    _, asc = swe.houses(jd, birth['coordinates']['lat'], birth['coordinates']['lon'], b'W')
    lagna_longitude = (asc[0] - swe.get_ayanamsa_ut(jd)) % 360
    from reading import SIGNS
    if SIGNS[int(lagna_longitude // 30)] != chart['lagna']:
        raise ValueError('Timing ascendant disagrees with natal chart')
    e = {'schema': 'timing-evidence-v1', 'rules_revision': REVISION, 'topic': topic,
         'birth': birth, 'settings': SETTINGS, 'lagna_longitude': lagna_longitude,
         'natal': natal, 'as_of_utc': at.isoformat(),
         'transits': [{'at': date.isoformat(), **measurements(date, ('Jupiter', 'Saturn'))}
                      for date in scan_dates(at)]}
    e['input_fingerprint'] = evidence_digest(e)
    a = assess_timing(e, topic)
    request = {key: birth[key] for key in ('dob', 'tob', 'place')}
    request.update(topic=topic, language=language, intent=intent)
    result = {'schema': 'reviewed-timing-v1', 'language': language, 'intent': intent,
              'request_fingerprint': request_fingerprint(request), 'evidence': e, 'assessment': a,
              'text': render_timing(a, topic, language, intent), 'model_calls': 0, 'model_tokens': 0}
    if not validate_timing_result(result, request, now=at):
        raise ValueError('Timing evidence validation failed')
    return result
