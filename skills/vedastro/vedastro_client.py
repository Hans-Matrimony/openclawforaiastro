"""Narrow, opt-in VedAstro matching adapter. JSON stdin/stdout; no stored birth data."""
import argparse
from datetime import datetime, timezone
import hashlib
from http.client import HTTPException
import json
import math
import os
import re
import socket
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

MAX_BYTES = 131072
FACTORS = ('Graha Maitram', 'Nadi Kuta', 'Vasya Kuta', 'Dina Kuta',
           'Guna Kuta', 'Rasi Kuta', 'Varna', 'Yoni Kuta')
SETTINGS = {'ayanamsa': 'LAHIRI', 'operation': 'VedAstro.MatchReport'}


class MatchError(Exception):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


def number(value, low, high):
    if type(value) not in (int, float) or not low <= value <= high or not math.isfinite(value):
        raise MatchError('invalid_birth_details')
    return value


def birth(value):
    if not isinstance(value, dict):
        raise MatchError('birth_details_missing')
    required = {'date', 'time', 'latitude', 'longitude', 'timezone', 'time_precision'}
    if not required <= value.keys():
        raise MatchError('birth_details_missing')
    if value['time_precision'] != 'exact':
        raise MatchError('birth_time_uncertain')
    if not isinstance(value['date'], str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value['date']):
        raise MatchError('invalid_birth_details')
    if not isinstance(value['time'], str) or not re.fullmatch(r'\d{2}:\d{2}', value['time']):
        raise MatchError('invalid_birth_details')
    try:
        local = datetime.strptime(value['date'] + ' ' + value['time'], '%Y-%m-%d %H:%M')
        if not isinstance(value['timezone'], str):
            raise ValueError()
        zone = ZoneInfo(value['timezone'])
    except (ValueError, ZoneInfoNotFoundError, TypeError):
        raise MatchError('invalid_birth_details') from None
    if local.year < 1900 or local.year > datetime.now(timezone.utc).year:
        raise MatchError('unsupported_birth_date')
    candidates = {}
    for fold in (0, 1):
        aware = local.replace(tzinfo=zone, fold=fold)
        utc = aware.astimezone(timezone.utc)
        if utc.astimezone(zone).replace(tzinfo=None) == local:
            candidates[aware.utcoffset()] = utc
    if not candidates:
        raise MatchError('nonexistent_birth_time')
    if len(candidates) > 1:
        raise MatchError('ambiguous_birth_time')
    offset, utc = next(iter(candidates.items()))
    if local.year < 1900 or utc > datetime.now(timezone.utc):
        raise MatchError('unsupported_birth_date')
    seconds = int(offset.total_seconds())
    if seconds % 60:
        raise MatchError('unsupported_timezone_offset')
    minutes = abs(seconds) // 60
    offset_text = ('+' if seconds >= 0 else '-') + f'{minutes // 60:02}:{minutes % 60:02}'
    return {'date': value['date'], 'time': value['time'],
            'latitude': number(value['latitude'], -90, 90),
            'longitude': number(value['longitude'], -180, 180),
            'timezone': value['timezone'], 'offset': offset_text,
            'std_time': local.strftime('%H:%M %d/%m/%Y ') + offset_text}


def time_path(value):
    # VedAstro parses coordinate text as latitude,longitude, NOT constructor order.
    coordinates = f"{value['latitude']},{value['longitude']}"
    date = datetime.strptime(value['date'], '%Y-%m-%d').strftime('%d/%m/%Y')
    return f"Location/{quote(coordinates, safe=',.-')}/Time/{value['time']}/{date}/{quote(value['offset'], safe=':')}"


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise MatchError('provider_redirect_rejected')


def fetch(url):
    deadline = time.monotonic() + 10
    try:
        with build_opener(NoRedirect()).open(Request(url, headers={'Accept': 'application/json'}), timeout=10) as response:
            chunks, size = [], 0
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise MatchError('provider_timeout')
                # HTTPResponse closes fp after the last Content-Length byte.
                if response.fp is None:
                    break
                # Bound each socket read by the remaining overall response budget.
                response.fp.raw._sock.settimeout(remaining)
                chunk = response.read1(min(8192, MAX_BYTES + 1 - size))
                size += len(chunk)
                if size > MAX_BYTES:
                    raise MatchError('provider_response_too_large')
                if not chunk:
                    if response.length not in (None, 0):
                        raise MatchError('provider_invalid_response')
                    break
                chunks.append(chunk)
            return json.loads(b''.join(chunks))
    except MatchError:
        raise
    except (TimeoutError, socket.timeout):
        raise MatchError('provider_timeout') from None
    except HTTPError as exc:
        raise MatchError('provider_rate_limited' if exc.code == 429 else 'provider_unavailable') from None
    except URLError as exc:
        code = 'provider_timeout' if isinstance(exc.reason, TimeoutError) else 'provider_unavailable'
        raise MatchError(code) from None
    except OSError:
        raise MatchError('provider_unavailable') from None
    except HTTPException:
        raise MatchError('provider_invalid_response') from None
    except (ValueError, UnicodeError):
        raise MatchError('provider_invalid_response') from None


def normalize(raw, male, female):
    try:
        if raw['Status'] != 'Pass':
            raise MatchError('provider_calculation_failed')
        if type(raw['Input']['Ayanamsa']) is not int or raw['Input']['Ayanamsa'] != 1:
            raise MatchError('calculation_conflict')
        report = raw['Payload']['MatchReport']
        for role, expected in [('Male', male), ('Female', female)]:
            echoed = report[role]['BirthTime']
            if echoed['StdTime'] != expected['std_time']:
                raise MatchError('calculation_conflict')
            for field in ('Latitude', 'Longitude'):
                actual = number(echoed['Location'][field], -180, 180)
                if abs(actual - expected[field.lower()]) > 0.000001:
                    raise MatchError('calculation_conflict')
        score = report['KutaScore']
        if type(score) not in (int, float) or not 0 <= score <= 100 or not math.isfinite(score):
            raise MatchError('provider_invalid_response')
        predictions = report['PredictionList']
        if not isinstance(predictions, list):
            raise MatchError('provider_invalid_response')
        factors = {}
        for item in predictions:
            name = item['Name']
            if name not in FACTORS:
                continue
            if name in factors or item['Nature'] not in ('Good', 'Bad', 'Neutral'):
                raise MatchError('provider_incomplete_report')
            factors[name] = {'name': name, 'status': {'Good': 'favorable', 'Bad': 'unfavorable', 'Neutral': 'neutral'}[item['Nature']]}
        if set(factors) != set(FACTORS):
            raise MatchError('provider_incomplete_report')
        return {'score_percent': score, 'score_points': None, 'score_max': None,
                'scoring_method': 'VedAstro rounded Kuta percentage',
                'factors': [factors[name] for name in FACTORS]}
    except MatchError:
        raise
    except (KeyError, TypeError, ValueError):
        raise MatchError('provider_invalid_response') from None


def match_report(payload, env=None, transport=None):
    env = os.environ if env is None else env
    if env.get('VEDASTRO_MATCH_ENABLED') != '1':
        raise MatchError('matching_disabled')
    base = env.get('VEDASTRO_BASE_URL', '').rstrip('/')
    try:
        parsed = urlsplit(base)
        parsed.port  # Validate malformed/non-numeric ports before any request.
    except ValueError:
        raise MatchError('provider_not_configured') from None
    if (parsed.scheme not in ('https', 'http') or not parsed.hostname or parsed.username
            or parsed.password or parsed.query or parsed.fragment
            or (parsed.scheme == 'http' and parsed.hostname not in ('localhost', '127.0.0.1', '::1'))):
        raise MatchError('provider_not_configured')
    if not isinstance(payload, dict) or not {'male', 'female'} <= payload.keys():
        raise MatchError('birth_details_missing')
    male, female = birth(payload['male']), birth(payload['female'])
    url = f'{base}/Calculate/MatchReport/{time_path(male)}/{time_path(female)}/Ayanamsa/LAHIRI'
    data = normalize((transport or fetch)(url), male, female)
    fingerprint = hashlib.sha256(json.dumps([male, female, SETTINGS], sort_keys=True).encode()).hexdigest()
    return {'status': 'ok', 'operation': 'match-report', 'schema_version': 1,
            'provider': 'vedastro', 'provider_revision': env.get('VEDASTRO_PROVIDER_REVISION', 'unverified-hosted'),
            'calculation_settings': SETTINGS.copy(), 'input_fingerprint': fingerprint,
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'warnings': ['Traditional matching assessment; not a prediction of relationship success.',
                         'Rounded percentage cannot be converted to an exact score out of 36.',
                         'Matching factors use VedAstro; do not merge them into existing chart calculations.'],
            'data': data}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['match-report'])
    parser.parse_args()
    try:
        text = sys.stdin.read(MAX_BYTES + 1)
        if len(text) > MAX_BYTES:
            raise MatchError('input_too_large')
        try:
            payload = json.loads(text)
        except ValueError:
            raise MatchError('invalid_json') from None
        result = match_report(payload)
    except MatchError as exc:
        print(json.dumps({'status': 'error', 'operation': 'match-report', 'schema_version': 1, 'code': exc.code}))
        return 1
    except Exception:
        # Never expose provider URLs (birth details), credentials or tracebacks.
        print(json.dumps({'status': 'error', 'operation': 'match-report', 'schema_version': 1, 'code': 'internal_error'}))
        return 1
    print(json.dumps(result, allow_nan=False))
    return 0


if __name__ == '__main__':
    sys.exit(main())
