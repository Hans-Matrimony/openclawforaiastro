"""Strict opt-in natal preparation. Never import the legacy installing calculator."""
import argparse
import hashlib
import json
import math
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from response_contract import SIGNS, SETTINGS, digest, evidence_result, validate_request, verify_natal
from natal_cache import cached_natal
from response_marriage_timing import sample_dates, MARRIAGE_SCOPES

IDS = {'Sun': 0, 'Moon': 1, 'Mercury': 2, 'Venus': 3, 'Mars': 4,
       'Jupiter': 5, 'Saturn': 6, 'Rahu': 11}
ENGINE_REVISION = 'strict-response-natal-v3'


def ephemeris_path():
    if os.getenv('SE_EPHE_PATH'):
        raise ValueError('Uncontrolled ephemeris override')
    path = Path(os.getenv('ASTROFRIEND_RESPONSE_EPHE_PATH') or Path(__file__).parent / 'ephe').resolve()
    if len(os.fsencode(path)) > 255:
        raise ValueError('Ephemeris path exceeds engine limit')
    return path


def resolve_birth(request):
    validate_request(request)
    # The birth form also saves "City, India". Only that explicit country
    # qualifier may be removed; never discard an unknown country/state/locality.
    cities = json.loads((Path(__file__).parent / 'cities_india.json').read_text(encoding='utf-8'))
    parts = [part.strip() for part in request['place'].split(',')]
    city_name = parts[0] if len(parts) == 2 and parts[1].casefold() == 'india' else request['place'].strip()
    match = next((coords for city, coords in cities.items() if city.casefold() == city_name.casefold()), None)
    if match is None:
        raise ValueError('Birthplace unresolved')
    lat, lon = match
    if any(type(v) not in (int, float) or not math.isfinite(v) for v in (lat, lon)) or not -90 <= lat <= 90 or not -180 <= lon <= 180:
        raise ValueError('Invalid coordinates')
    from timezonefinder import TimezoneFinder
    name = TimezoneFinder().timezone_at(lat=lat, lng=lon)
    if not name:
        raise ValueError('Birth timezone unresolved')
    zone = ZoneInfo(name)
    local = datetime.fromisoformat(request['dob'] + 'T' + request['tob'])
    candidates = {local.replace(tzinfo=zone, fold=f).astimezone(timezone.utc) for f in (0, 1)
                  if local.replace(tzinfo=zone, fold=f).astimezone(timezone.utc).astimezone(zone).replace(tzinfo=None) == local}
    if len(candidates) != 1:
        raise ValueError('Ambiguous or nonexistent birth time')
    utc = next(iter(candidates))
    if utc > datetime.now(timezone.utc) or utc.year < 1900:
        raise ValueError('Unsupported birth date')
    return {'dob': request['dob'], 'tob': request['tob'], 'place': request['place'],
            'coordinates': {'lat': lat, 'lon': lon}, 'timezone': name, 'utc': utc.isoformat(),
            'offset_hours': local.replace(tzinfo=zone).utcoffset().total_seconds() / 3600}


def calculate_at(birth):
    import swisseph as swe
    # Source selection is explicit. Moshier is admitted for this bounded natal
    # screen and reported as such; a missing data file never changes providers.
    swe.set_ephe_path(str(ephemeris_path()))
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    at = datetime.fromisoformat(birth['utc']).astimezone(timezone.utc)
    hour = at.hour + at.minute / 60 + at.second / 3600 + at.microsecond / 3_600_000_000
    jd = swe.julday(at.year, at.month, at.day, hour)
    aya = swe.get_ayanamsa_ut(jd)
    coords = birth['coordinates']
    _, angles = swe.houses(jd, coords['lat'], coords['lon'], b'W')
    lagna_longitude = (angles[0] - aya) % 360
    lagna = SIGNS[int(lagna_longitude // 30)]
    positions, backends = {}, set()
    for name, index in IDS.items():
        xx, flags = swe.calc_ut(jd, index, swe.FLG_SWIEPH | swe.FLG_SPEED)
        if not flags & swe.FLG_SPEED:
            raise ValueError('Missing speed')
        backend = 'swiss' if flags & swe.FLG_SWIEPH else 'moshier' if flags & swe.FLG_MOSEPH else None
        if backend is None:
            raise ValueError('Unapproved ephemeris source')
        backends.add(backend)
        longitude = (xx[0] - aya) % 360
        sign = SIGNS[int(longitude // 30)]
        positions[name] = {'planet': name, 'longitude': longitude, 'speed': xx[3], 'sign': sign,
                           'house': (SIGNS.index(sign) - SIGNS.index(lagna)) % 12 + 1}
    if len(backends) != 1:
        raise ValueError('Mixed ephemeris source')
    longitude = (positions['Rahu']['longitude'] + 180) % 360
    sign = SIGNS[int(longitude // 30)]
    positions['Ketu'] = {'planet': 'Ketu', 'longitude': longitude, 'speed': positions['Rahu']['speed'],
                         'sign': sign, 'house': (SIGNS.index(sign) - SIGNS.index(lagna)) % 12 + 1}
    result = {'lagna': lagna, 'lagna_longitude': lagna_longitude, 'positions': positions,
              'backend': next(iter(backends)), 'engine_version': str(swe.version)}
    verify_natal(result)
    return result


def calculate_natal(birth):
    return calculate_at(birth)


def prepare(request):
    import swisseph as swe
    birth = resolve_birth(request)
    # Separate from the legacy cache namespace. A setting/engine/data change is
    # a different key; fresh evidence is bound to this request after cache reuse.
    ephe = ephemeris_path()
    data_revision = []
    files = list(ephe.glob('*.se1')) + [ephe / name for name in ('sedeltat.txt', 'seleapsec.txt')]
    for file in sorted(files):
        if file.is_file():
            with file.open('rb') as stream:
                data_revision.append((file.name, hashlib.file_digest(stream, 'sha256').hexdigest()))
    key = {'birth': birth, 'settings': SETTINGS, 'engine_revision': ENGINE_REVISION,
           'engine_version': str(swe.version), 'ephemeris_path': str(ephe), 'data_revision': data_revision}
    chart = cached_natal(key, lambda: calculate_natal(birth), verify_natal)
    as_of = datetime.now(timezone.utc)
    # Time-dependent facts are fresh on every request and never cached as natal.
    sky = calculate_at(dict(birth, utc=as_of.isoformat()))
    timing_samples = None
    if request['topic'] == 'marriage' and request.get('scope') in MARRIAGE_SCOPES:
        timing_samples = []
        for at in sample_dates(as_of):
            # Same strict primary engine and source checks as the natal chart.
            future = sky if at == as_of else calculate_at(dict(birth, utc=at.isoformat()))
            if (future['backend'], future['engine_version']) != (chart['backend'], chart['engine_version']):
                raise ValueError('Timing and natal ephemeris sources differ')
            timing_samples.append({'at': at.isoformat(), **{p: {key: future['positions'][p][key]
                for key in ('longitude', 'speed')} for p in ('Jupiter', 'Saturn')}})
    return evidence_result(request, birth, chart, as_of, sky, timing_samples)


if __name__ == '__main__':
    argparse.ArgumentParser(description='Verified natal response evidence from JSON stdin').parse_args()
    try:
        data = sys.stdin.buffer.read(4097)
        if len(data) > 4096:
            raise ValueError('Request too large')
        result = prepare(json.loads(data))
        print(json.dumps(result, ensure_ascii=True, allow_nan=False))
    except Exception:
        # No raw inputs, paths or traceback in the wire error.
        print(json.dumps({'error': 'evidence_unavailable'}))
        sys.exit(1)
