"""Offline image smoke test of the isolated evidence assets and dependencies."""
import importlib.metadata
import json
import os

from response_contract import digest, validate_evidence
from response_evidence import prepare


def check_runtime():
    expected = {'pyswisseph': '2.10.3.2', 'timezonefinder': '9.0.0', 'tzdata': '2026.4'}
    versions = {name: importlib.metadata.version(name) for name in expected}
    if versions != expected:
        raise ValueError('Calculation dependencies do not match the verified versions')
    birth = {'dob': '2000-01-01', 'tob': '08:00', 'place': 'Delhi, India'}
    request = dict(birth, topic='career', language='english', subject_key='a' * 64,
                   profile_revision=digest(birth), time_precision='exact')
    # The image check must not populate any configured user cache.
    prior = os.environ.pop('KUNDLI_NATAL_CACHE_PATH', None)
    try:
        evidence = prepare(request)
    finally:
        if prior is not None:
            os.environ['KUNDLI_NATAL_CACHE_PATH'] = prior
    if not validate_evidence(evidence, request):
        raise ValueError('Evidence runtime check failed')
    return {'status': 'passed', 'dependencies': versions, 'backend': evidence['chart']['backend'], 'positions': 9}


if __name__ == '__main__':
    try:
        print(json.dumps(check_runtime()))
    except Exception as error:
        print(json.dumps({'status': 'failed', 'error_type': type(error).__name__}))
        raise SystemExit(1)
