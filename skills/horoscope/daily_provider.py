"""One-call native daily evidence; geometry is checked independently, no model."""
from bisect import bisect_left
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path

from reading_provider import finite, minute_time, SIGNS, STARS
from natal_client import REVISION, SETTINGS, PLANETS, configuration, fetch_natal, normalize_natal
from reading import verified_positions
from timing_context import verified_timing_context
from vedastro_client import MatchError
from vimshottari import current_period, nakshatra_index
from vedha_geometry import normalize_vedha

KAKSHA_LORDS = ('Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon', 'Ascendant')
SEVEN = PLANETS - {'Rahu', 'Ketu'}
# Exact ordinal names from the pinned engine's ConstellationName enum. Display
# spellings use STARS, but aliases must not be mistaken for geometry conflicts.
NATIVE_STARS = ('Aswini', 'Bharani', 'Krithika', 'Rohini', 'Mrigasira', 'Aridra',
                'Punarvasu', 'Pushyami', 'Aslesha', 'Makha', 'Pubba', 'Uttara',
                'Hasta', 'Chitta', 'Swathi', 'Vishhaka', 'Anuradha', 'Jyesta',
                'Moola', 'Poorvashada', 'Uttarashada', 'Sravana', 'Dhanishta',
                'Satabhisha', 'Poorvabhadra', 'Uttarabhadra', 'Revathi')


def daily_evidence(chart, *, as_of_utc=None, env=None, transport=None, reference_calculator=None):
    env = os.environ if env is None else env
    if env.get('VEDASTRO_DAILY_ENABLED') != '1':
        raise MatchError('daily_provider_disabled')
    vedha_flag = env.get('VEDASTRO_DAILY_VEDHA_ENABLED','0')
    if vedha_flag not in ('0','1'):
        raise MatchError('provider_invalid_configuration')
    include_vedha = vedha_flag == '1'
    base, token = configuration(env)
    verified_positions(chart)
    if chart['calculation_source'] != 'pyswisseph' or chart['calculation_settings']['node'] != 'true':
        raise MatchError('calculation_conflict')
    try:
        value = chart['user_input']
        latitude = finite(value['coordinates']['lat'], -65.999999, 65.999999)
        longitude = finite(value['coordinates']['lon'], -180, 180)
        seconds = finite(value['timezone_offset'], -14, 14) * 3600
        if seconds % 60:
            raise MatchError('unsupported_timezone_offset')
        birth_utc = datetime.fromisoformat(value['birth_utc'].replace('Z', '+00:00'))
        if birth_utc.tzinfo is None:
            raise MatchError('invalid_birth_details')
        local = birth_utc.astimezone(timezone(timedelta(seconds=seconds)))
        if local.second or local.microsecond:
            raise MatchError('invalid_birth_details')
        std_time = local.strftime('%H:%M %d/%m/%Y %z')
        std_time = std_time[:-2] + ':' + std_time[-2:]
        expected = {'std_time': std_time, 'latitude': latitude, 'longitude': longitude}
        when = minute_time(as_of_utc or datetime.now(timezone.utc))
        if when < birth_utc:
            raise MatchError('invalid_birth_details')
        check_time = when.strftime('%H:%M %d/%m/%Y +00:00')
        location = {'Name': 'Confirmed coordinates', 'Latitude': latitude, 'Longitude': longitude}
        body = {'time': {'StdTime': std_time, 'Location': location}, 'Ayanamsa': 'LAHIRI',
                'checkTime': {'StdTime': check_time, 'Location': location}}
        if include_vedha:
            body['includeVedha'] = True
        raw = (transport or fetch_natal)(base + '/Calculate/DailyEvidence', body, token)
        data = raw['Payload']['DailyEvidence']
        natal = normalize_natal({**raw, 'Payload': {'NatalEvidence': data['natal']}}, expected)['data']
        if (data['schema'] != 'vedastro-daily-evidence-v1' or data['checkTime']['StdTime'] != check_time
                or data['transitHouseReference'] != 'natal_moon_whole_sign'
                or data['obstructionEvaluated'] is not include_vedha or data['eventPredictionAvailable'] is not False
                or (not include_vedha and 'gocharaVedha' in data)):
            raise MatchError('calculation_conflict')
        for key in ('Latitude', 'Longitude'):
            if abs(finite(data['checkTime']['Location'][key], -180, 180) - expected[key.lower()]) > 0.000001:
                raise MatchError('calculation_conflict')
        if reference_calculator is None:
            # A scheduler may occupy the `calculate` import name. Resolve the
            # independent calculator by path rather than import precedence.
            path = Path(__file__).resolve().parent.parent / 'kundli' / 'calculate.py'
            spec = importlib.util.spec_from_file_location('daily_reference_kundli', path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            reference_calculator = module.calculate_kundli_pyswisseph
        birth_ref = reference_calculator(birth_utc.astimezone(timezone.utc).replace(tzinfo=None),
                                         latitude, longitude, sidereal_reference=True)
        transit_ref = reference_calculator(when.replace(tzinfo=None), latitude, longitude, sidereal_reference=True)
        natal_asc = SIGNS.index(natal['ascendant']['sign']) * 30 + natal['ascendant']['degrees_in_sign']
        reference_asc = SIGNS.index(birth_ref['lagna']) * 30 + birth_ref['lagna_degree']
        if abs((natal_asc - reference_asc + 180) % 360 - 180) > 0.002:
            raise MatchError('calculation_conflict')
        for row in birth_ref['planet_positions']:
            if abs((row['sidereal_degree'] - natal['planets'][row['name']]['longitude'] + 180) % 360 - 180) > 0.002:
                raise MatchError('calculation_conflict')
        phase = current_period(birth_utc.astimezone(timezone.utc).replace(tzinfo=None),
                               natal['planets']['Moon']['longitude'], when.replace(tzinfo=None))
        if data['period'] != {'PD1': phase['mahadasha'], 'PD2': phase['antardasha']}:
            raise MatchError('calculation_conflict')
        context = verified_timing_context(data['timingContext'], phase, natal['planets']['Moon']['longitude'],
                                          transit_ref['planet_positions'], when, finite)
        if set(data['transits']) != PLANETS or set(data['gocharaKakshas']) != SEVEN:
            raise MatchError('provider_invalid_response')
        reference = {row['name']: row for row in transit_ref['planet_positions']}
        transits, kakshas = {}, {}
        for name, row in data['transits'].items():
            degree = finite(row['longitude'], 0, 359.999999999999)
            sign = SIGNS[int(degree // 30)]
            house = (int(degree // 30) - int(natal['planets']['Moon']['longitude'] // 30)) % 12 + 1
            constellation = row['nakshatra']
            if (row['sign'] != sign or type(row['houseFromNatalMoon']) is not int or row['houseFromNatalMoon'] != house
                    or abs((degree - reference[name]['sidereal_degree'] + 180) % 360 - 180) > 0.002
                    or constellation['Name'] != NATIVE_STARS[nakshatra_index(degree)]
                    or type(constellation['Quarter']) is not int or not 1 <= constellation['Quarter'] <= 4):
                raise MatchError('calculation_conflict')
            star_degree = degree - nakshatra_index(degree) * (360 / 27)
            if abs(finite(constellation['DegreesInConstellation'], 0, 360 / 27) - star_degree) > 0.002:
                raise MatchError('calculation_conflict')
            transits[name] = {'longitude': degree, 'sign': sign, 'house_from_natal_moon': house,
                             'nakshatra': STARS[nakshatra_index(degree)], 'native_nakshatra_name': constellation['Name']}
            if name in SEVEN:
                score = data['gocharaKakshas'][name]
                lord = KAKSHA_LORDS[bisect_left([3.75 * i for i in range(1, 9)], degree % 30)]
                # Native JSON identifies each planet by its dictionary key.
                if score['Sign'] != sign or score['KakshaLord'] != lord:
                    raise MatchError('calculation_conflict')
                for key, maximum in (('KakshaScore', 1), ('Ashtaka', 8), ('Sarvashtaka', 56)):
                    if type(score[key]) is not int or not 0 <= score[key] <= maximum:
                        raise MatchError('provider_invalid_response')
                kakshas[name] = {'kaksha_lord': lord, 'kaksha_score': score['KakshaScore'],
                                 'bhinna_ashtakavarga': score['Ashtaka'], 'sarva_ashtakavarga': score['Sarvashtaka']}
        if abs((transits['Rahu']['longitude'] - transits['Ketu']['longitude']) % 360 - 180) > 0.001:
            raise MatchError('calculation_conflict')
        fingerprint_inputs = [expected, check_time, SETTINGS, REVISION]
        vedha = normalize_vedha(data['gocharaVedha'],transits) if include_vedha else None
        if include_vedha:
            fingerprint_inputs.append({'includeVedha':True})
        result = {'schema': 'reviewed-daily-evidence-v1', 'as_of_utc': when.isoformat(),
                'input_fingerprint': hashlib.sha256(json.dumps(fingerprint_inputs, sort_keys=True).encode()).hexdigest(),
                'provider': 'vedastro-local', 'source_revision': REVISION, 'native_settings': SETTINGS.copy(),
                'verified_against': 'pyswisseph', 'model_calls': 0, 'natal': natal,
                'current_period': phase, 'timing_context': context, 'transits': transits, 'kakshas': kakshas,
                'kaksha_validation': 'native_source_type_range_and_lord_geometry',
                'transit_house_reference': 'natal_moon_whole_sign', 'obstruction_evaluated': include_vedha,
                'event_prediction_available': False}
        if vedha is not None:
            result['gochara_vedha'] = vedha
        return result
    except MatchError:
        raise
    except (KeyError, TypeError, ValueError, AttributeError, OverflowError):
        raise MatchError('provider_invalid_response') from None
