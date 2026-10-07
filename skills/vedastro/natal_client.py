"""Small opt-in client for the self-hosted VedAstro natal data API; no LLM or persistence."""
from datetime import datetime, timezone
import hashlib
from http.client import HTTPException
import json
import os
import socket
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener
from vedastro_client import MatchError, NoRedirect, birth, number

REVISION = '40763952742f76369a505d8db2e9e9fa67f75d78'
SETTINGS = {'ayanamsa': 'LAHIRI', 'node': 'true', 'dasha_year_days': 365.25,
            'house_system': 'vedastro_bhava', 'engine': 'VedAstro.Library'}
SIGNS = ('Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra',
         'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces')
PLANETS = {'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'}
MAX_BYTES = 32768


def fetch_natal(url, body, token):
    deadline = time.monotonic() + 10
    request = Request(url, data=json.dumps(body).encode(), headers={
        'Content-Type': 'application/json', 'Accept': 'application/json', 'x-api-key': token})
    try:
        with build_opener(NoRedirect()).open(request, timeout=10) as response:
            chunks, size = [], 0
            while response.fp is not None:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise MatchError('provider_timeout')
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
            return json.loads(b''.join(chunks), parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
    except MatchError:
        raise
    except (TimeoutError, socket.timeout):
        raise MatchError('provider_timeout') from None
    except HTTPError as error:
        raise MatchError('provider_rate_limited' if error.code == 429 else 'provider_unavailable') from None
    except (OSError, URLError):
        raise MatchError('provider_unavailable') from None
    except HTTPException:
        raise MatchError('provider_invalid_response') from None
    except (ValueError, UnicodeError):
        raise MatchError('provider_invalid_response') from None


def configuration(env):
    if env.get('VEDASTRO_NATAL_ENABLED') != '1':
        raise MatchError('natal_provider_disabled')
    base = env.get('VEDASTRO_NATAL_API_URL', '').rstrip('/')
    token = env.get('VEDASTRO_NATAL_API_TOKEN', '')
    try:
        parsed = urlsplit(base)
        parsed.port
    except ValueError:
        raise MatchError('provider_not_configured') from None
    if (parsed.scheme not in ('https', 'http') or not parsed.hostname or parsed.username or parsed.password
            or parsed.query or parsed.fragment or parsed.path.rstrip('/') != '/api'
            or (parsed.scheme == 'http' and parsed.hostname not in ('localhost', '127.0.0.1', '::1'))
            or not isinstance(token, str) or not 32 <= len(token) <= 256 or any(ord(c) < 32 for c in token)):
        raise MatchError('provider_not_configured')
    return base, token


def natal_evidence(payload, env=None, transport=None):
    env = os.environ if env is None else env
    base, token = configuration(env)
    if not isinstance(payload, dict) or set(payload) != {'birth'}:
        raise MatchError('invalid_birth_details')
    value = birth(payload['birth'])
    if abs(value['latitude']) >= 66:
        raise MatchError('unsupported_polar_location')
    body = {'time': {'StdTime': value['std_time'], 'Location': {
        'Name': 'Confirmed birth coordinates', 'Latitude': value['latitude'], 'Longitude': value['longitude']}},
        'Ayanamsa': 'LAHIRI'}
    raw = (transport or fetch_natal)(base + '/Calculate/NatalEvidence', body, token)
    return normalize_natal(raw, value)


def normalize_natal(raw, value):
    try:
        if (raw['Status'] != 'Pass' or raw['ProviderRevision'] != REVISION
                or raw['CalculationSettings'] != SETTINGS or type(raw['ModelCalls']) is not int or raw['ModelCalls'] != 0
                or type(raw['Input']['Ayanamsa']) is not int or raw['Input']['Ayanamsa'] != 1):
            raise MatchError('calculation_conflict')
        data = raw['Payload']['NatalEvidence']
        if data['schema'] != 'vedastro-natal-evidence-v1' or data['birthTime']['StdTime'] != value['std_time']:
            raise MatchError('calculation_conflict')
        for field in ('Latitude', 'Longitude'):
            if abs(number(data['birthTime']['Location'][field], -180, 180) - value[field.lower()]) > 0.000001:
                raise MatchError('calculation_conflict')
        if set(data['planets']) != PLANETS or data['ascendant']['Name'] not in SIGNS:
            raise MatchError('provider_invalid_response')
        ascendant = {'sign': data['ascendant']['Name'],
                     'degrees_in_sign': number(float(data['ascendant']['DegreesIn']['TotalDegrees']), 0, 29.999999999)}
        planets = {}
        for name, row in data['planets'].items():
            longitude = number(row['longitude'], 0, 359.999999999)
            if row['sign'] != SIGNS[int(longitude // 30)]:
                raise MatchError('calculation_conflict')
            planets[name] = {'longitude': longitude, 'sign': row['sign']}
        if abs((planets['Rahu']['longitude'] - planets['Ketu']['longitude']) % 360 - 180) > 0.001:
            raise MatchError('calculation_conflict')
    except MatchError:
        raise
    except (KeyError, TypeError, ValueError, OverflowError):
        raise MatchError('provider_invalid_response') from None
    fingerprint = hashlib.sha256(json.dumps([value, SETTINGS, REVISION], sort_keys=True).encode()).hexdigest()
    return {'status': 'ok', 'operation': 'natal-evidence', 'provider': 'vedastro-local',
            'provider_revision': REVISION, 'calculation_settings': SETTINGS.copy(),
            'input_fingerprint': fingerprint, 'model_calls': 0,
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'data': {'ascendant': ascendant, 'planets': planets},
            'warnings': ['Natal coordinates only; no event forecast or personality interpretation.',
                         'VedAstro bhava house-rule outputs cannot be merged into a whole-sign reading.']}


if __name__ == '__main__':
    try:
        if sys.argv[1:] != ['natal-evidence']:
            raise MatchError('unsupported_operation')
        text = sys.stdin.read(4097)
        if len(text) > 4096:
            raise MatchError('invalid_birth_details')
        print(json.dumps(natal_evidence(json.loads(text))))
    except (MatchError, ValueError) as error:
        print(json.dumps({'status': 'error', 'error': error.code if isinstance(error, MatchError) else 'invalid_json'}))
        sys.exit(1)
