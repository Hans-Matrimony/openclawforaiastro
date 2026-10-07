"""Opt-in, one-call self-hosted reading provider with independent geometry checks.

Birth resolution and legacy output modes stay with calculate.py. No provider
prose is admitted. Bhava strength and whole-sign placements retain separate
conventions; neither supplies a personal event forecast.
"""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import math
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'vedastro'))
from natal_client import REVISION, SETTINGS, configuration, fetch_natal, normalize_natal
from vedastro_client import MatchError
from advanced_facts import divisional_sign
from vimshottari import current_period, nakshatra_index

SIGNS = ('Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
         'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces')
LORDS = ('Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
         'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter')
STARS = ('Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
         'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
         'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula',
         'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
         'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati')
COMPONENTS = {'PlanetSthanaBala', 'PlanetDigBala', 'PlanetKalaBala', 'PlanetChestaBala',
              'PlanetNaisargikaBala', 'PlanetDrikBala'}


def finite(value, low=-10000, high=10000):
    if type(value) not in (int, float) or not math.isfinite(value) or not low <= value <= high:
        raise MatchError('provider_invalid_response')
    return value


def minute_time(value):
    if not isinstance(value, datetime) or value.tzinfo is None:
        raise ValueError('Reading timestamp must be timezone-aware')
    return value.astimezone(timezone.utc).replace(second=0, microsecond=0)


def use_reading_provider(chart, topic, *, as_of_utc=None, env=None, transport=None, reference_calculator=None):
    env = os.environ if env is None else env
    mode = env.get('VEDASTRO_READING_MODE', 'off')
    if mode == 'off':
        return chart
    if mode not in ('prefer', 'required'):
        raise ValueError('Invalid reading provider mode')
    timing_mode = env.get('VEDASTRO_TIMING_CONTEXT_ENABLED', '0')
    if timing_mode not in ('0', '1'):
        raise ValueError('Invalid timing context configuration')
    from reading import verified_positions
    verified_positions(chart)
    if chart['calculation_source'] != 'pyswisseph' or chart['calculation_settings']['node'] != 'true':
        raise MatchError('calculation_conflict')
    try:
        base, token = configuration(env)
        birth = chart['user_input']
        latitude, longitude = birth['coordinates']['lat'], birth['coordinates']['lon']
        if abs(latitude) >= 66:
            raise MatchError('unsupported_polar_location')
        offset_seconds = birth['timezone_offset'] * 3600
        if offset_seconds % 60:
            raise MatchError('unsupported_timezone_offset')
        offset = timedelta(seconds=offset_seconds)
        birth_utc = datetime.fromisoformat(birth['birth_utc'].replace('Z', '+00:00'))
        if birth_utc.tzinfo is None:
            raise MatchError('invalid_birth_details')
        local = birth_utc.astimezone(timezone(offset))
        if local.second or local.microsecond:
            raise MatchError('invalid_birth_details')
        if reference_calculator is None:
            from calculate import calculate_kundli_pyswisseph
            reference_calculator = calculate_kundli_pyswisseph
        reference = reference_calculator(birth_utc.astimezone(timezone.utc).replace(tzinfo=None),
            latitude, longitude, sidereal_reference=True)
        basis = deepcopy(chart)
        basis.update(planet_positions=reference['planet_positions'], lagna=reference['lagna'],
                     moon_sign=next(p['sign'] for p in reference['planet_positions'] if p['name'] == 'Moon'),
                     lagna_sidereal_degree=SIGNS.index(reference['lagna']) * 30 + reference['lagna_degree'])
        asc, _ = verified_positions(basis)
        target = {'marriage': 7, 'career': 10, 'education': 5}[topic]
        owner = LORDS[(asc + target - 1) % 12]
        std_time = local.strftime('%H:%M %d/%m/%Y %z')
        std_time = std_time[:-2] + ':' + std_time[-2:]
        expected = {'std_time': std_time, 'latitude': latitude, 'longitude': longitude,
                    'date': local.strftime('%Y-%m-%d'), 'time': local.strftime('%H:%M'),
                    'offset': std_time[-6:], 'timezone': 'confirmed-offset'}
        when = minute_time(as_of_utc or datetime.now(timezone.utc))
        check = when.strftime('%H:%M %d/%m/%Y +00:00')
        location = {'Name': 'Confirmed birth coordinates', 'Latitude': latitude, 'Longitude': longitude}
        body = {'time': {'StdTime': std_time, 'Location': location}, 'Ayanamsa': 'LAHIRI',
                'topic': topic, 'checkTime': {'StdTime': check, 'Location': location}}
        raw = (transport or fetch_natal)(base + '/Calculate/ReadingEvidence', body, token)
        evidence = raw['Payload']['ReadingEvidence']
        normalized = normalize_natal({**raw, 'Payload': {'NatalEvidence': evidence['natal']}}, expected)
        remote = normalized['data']
        if (evidence['schema'] != 'vedastro-reading-evidence-v1' or evidence['topic'] != topic
                or evidence['interpretationHouseSystem'] != 'whole_sign'
                or type(evidence['topicHouse']) is not int or evidence['topicHouse'] != target
                or evidence['topicRuler'] != owner or evidence['checkTime']['StdTime'] != check
                or evidence['eventTimingAvailable'] is not False):
            raise MatchError('calculation_conflict')
        # A remote calculator/settings failure cannot silently alter the chart.
        for position in basis['planet_positions']:
            row = remote['planets'][position['name']]
            if (row['sign'] != position['sign'] or
                    abs((row['longitude'] - position['sidereal_degree'] + 180) % 360 - 180) > 0.002):
                raise MatchError('calculation_conflict')
        remote_asc = SIGNS.index(remote['ascendant']['sign']) * 30 + remote['ascendant']['degrees_in_sign']
        if (remote['ascendant']['sign'] != basis['lagna'] or
                abs((remote_asc - basis['lagna_sidereal_degree'] + 180) % 360 - 180) > 0.002):
            raise MatchError('calculation_conflict')
        if evidence['navamsaSign'] != SIGNS[divisional_sign(remote['planets'][owner]['longitude'], 9)]:
            raise MatchError('calculation_conflict')
        strength = evidence['strength']
        if (strength['planet'] != owner or strength['nativeHouseSystem'] != 'vedastro_bhava'
                or set(strength['componentsVirupas']) != COMPONENTS
                or type(strength['meetsEngineStrengthTest']) is not bool):
            raise MatchError('provider_invalid_response')
        total = finite(strength['totalVirupas'], 0.001)
        parts = {key: finite(value) for key, value in strength['componentsVirupas'].items()}
        if (abs(total - sum(parts.values())) > 0.011 or
                abs(finite(strength['totalRupas'], 0.00001) - total / 60) > 0.000001):
            raise MatchError('calculation_conflict')
        minimum = {'Sun': 5, 'Moon': 6, 'Mars': 5, 'Mercury': 7, 'Jupiter': 6.5, 'Venus': 5.5, 'Saturn': 5}[owner]
        # Match the pinned engine's Math.Round(rupas, 1) and 1.1 ratio test.
        strength_test = (round(total / 60 * 10) / 10) / minimum >= 1.1
        if strength['meetsEngineStrengthTest'] != strength_test:
            raise MatchError('calculation_conflict')
        phase = current_period(birth_utc.astimezone(timezone.utc).replace(tzinfo=None),
                               remote['planets']['Moon']['longitude'], when.replace(tzinfo=None))
        if evidence['period'] != {'PD1': phase['mahadasha'], 'PD2': phase['antardasha']}:
            raise MatchError('calculation_conflict')
        result = basis
        result['planet_positions'] = [{'name': name, 'sign': row['sign'],
            'house': (SIGNS.index(row['sign']) - asc) % 12 + 1, 'sidereal_degree': row['longitude']}
            for name, row in remote['planets'].items()]
        result.update(calculation_source='vedastro-local', lagna_sidereal_degree=remote_asc,
                      moon_sign=remote['planets']['Moon']['sign'],
                      nakshatra=STARS[nakshatra_index(remote['planets']['Moon']['longitude'])])
        result['calculation_settings'] = {'ayanamsa': 'LAHIRI', 'house_system': 'whole_sign',
            'node': 'true', 'dasha_year_days': 365.25, 'engine': 'VedAstro.Library', 'source_revision': REVISION}
        result['reading_provider'] = {'name': 'vedastro-local', 'source_revision': REVISION,
            'verified_against': 'pyswisseph', 'native_settings': SETTINGS.copy(), 'as_of_utc': when.isoformat(),
            'topic': topic, 'topic_ruler': owner, 'native_d9_sign': evidence['navamsaSign'],
            'strength': {'planet': owner, 'total_virupas': total, 'total_rupas': total / 60,
                         'components_virupas': parts, 'native_house_system': 'vedastro_bhava',
                         'meets_engine_strength_test': strength['meetsEngineStrengthTest']}}
        if timing_mode == '1':
            from timing_context import verified_timing_context
            current_reference = reference_calculator(when.replace(tzinfo=None), latitude, longitude,
                                                     sidereal_reference=True)
            result['reading_provider']['timing_context'] = verified_timing_context(
                evidence['timingContext'], phase, remote['planets']['Moon']['longitude'],
                current_reference['planet_positions'], when, finite)
        return result
    except MatchError as error:
        if mode == 'prefer' and error.code in ('provider_timeout', 'provider_unavailable',
                'provider_rate_limited', 'unsupported_polar_location', 'unsupported_timezone_offset'):
            result = deepcopy(chart)
            result['reading_provider_fallback'] = error.code
            return result
        raise
    except (KeyError, TypeError, AttributeError, ValueError, OverflowError):
        raise MatchError('provider_invalid_response') from None
