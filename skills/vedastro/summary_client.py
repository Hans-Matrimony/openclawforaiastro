"""Opt-in dev client for the observed VedAstro hosted interpretation service.

Provider interpretations are not locally validated chart evidence. Never merge
their driver identifiers into planetary placements or timing calculations.
"""
import json
import os
import re
import sys
from datetime import datetime
from urllib.request import Request, build_opener, HTTPRedirectHandler

ENDPOINT = 'https://mcp-subagent.vedastro.org/api/mcp/public'
MAX_BYTES = 131072


class SummaryError(Exception):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def transport(body, headers):
    request = Request(ENDPOINT, data=json.dumps(body).encode(), headers=headers, method='POST')
    try:
        with build_opener(NoRedirect).open(request, timeout=30) as response:
            raw = response.read(MAX_BYTES + 1)
            if len(raw) > MAX_BYTES:
                raise SummaryError('response_too_large')
            return raw.decode('utf-8'), response.headers.get('Mcp-Session-Id')
    except SummaryError:
        raise
    except Exception:
        raise SummaryError('provider_unavailable') from None


def rpc_result(raw, request_id):
    try:
        if raw.lstrip().startswith(('event:', 'data:', ':')):
            messages = []
            for block in re.split(r'\r?\n\r?\n', raw):
                value = '\n'.join(line[5:].lstrip(' ') for line in block.splitlines() if line.startswith('data:'))
                if value:
                    messages.append(json.loads(value))
            matches = [row for row in messages if isinstance(row, dict) and row.get('id') == request_id]
            if len(matches) != 1:
                raise ValueError()
            row = matches[0]
        else:
            row = json.loads(raw)
        if row.get('jsonrpc') != '2.0' or row.get('id') != request_id or 'error' in row or 'result' not in row:
            raise ValueError()
        return row['result']
    except (ValueError, TypeError, AttributeError):
        raise SummaryError('invalid_rpc_response') from None


def validate_arguments(value):
    fields = {'location_name', 'birth_date', 'birth_time', 'query_text'}
    if not isinstance(value, dict) or set(value) != fields:
        raise SummaryError('invalid_arguments')
    if any(not isinstance(v, str) or not v.strip() for v in value.values()):
        raise SummaryError('invalid_arguments')
    if not 2 <= len(value['location_name']) <= 160 or len(value['query_text']) > 2000:
        raise SummaryError('invalid_arguments')
    try:
        when = datetime.strptime(value['birth_date'] + ' ' + value['birth_time'], '%d/%m/%Y %H:%M')
        if when.strftime('%d/%m/%Y %H:%M') != value['birth_date'] + ' ' + value['birth_time']:
            raise ValueError()
    except ValueError:
        raise SummaryError('invalid_birth_time') from None
    return dict(value)


def summarize(value, env=None, send=transport):
    env = os.environ if env is None else env
    if env.get('VEDASTRO_SUMMARY_DEV_ENABLED') != '1' or env.get('VEDASTRO_SUMMARY_ENVIRONMENT') != 'development':
        raise SummaryError('dev_summary_disabled')
    key = env.get('VEDASTRO_SUMMARY_API_KEY', '').strip()
    if not key or '\n' in key or '\r' in key:
        raise SummaryError('missing_credentials')
    arguments = validate_arguments(value)
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', 'x-api-key': key}

    def call(method, params, identifier):
        body = {'jsonrpc': '2.0', 'method': method, 'params': params}
        if identifier is not None:
            body['id'] = identifier
        raw, session = send(body, dict(headers))
        if session:
            if len(session) > 256 or '\r' in session or '\n' in session:
                raise SummaryError('invalid_session')
            headers['Mcp-Session-Id'] = session
        return rpc_result(raw, identifier) if identifier is not None else None

    initialized = call('initialize', {'protocolVersion': '2024-11-05', 'capabilities': {},
                                     'clientInfo': {'name': 'astrofriend-dev-summary', 'version': '1.0'}}, 1)
    if not isinstance(initialized, dict) or initialized.get('protocolVersion') != '2024-11-05':
        raise SummaryError('unsupported_protocol')
    headers['MCP-Protocol-Version'] = initialized['protocolVersion']
    call('notifications/initialized', {}, None)
    result = call('tools/call', {'name': 'get_horoscope_predictions', 'arguments': arguments}, 2)
    try:
        if not isinstance(result, dict) or result.get('isError'):
            raise ValueError()
        content = result['content']
        if len(content) != 1 or content[0]['type'] != 'text':
            raise ValueError()
        data = json.loads(content[0]['text'])
        if set(data) != {'query', 'summary', 'drivers'} or data['query'] != arguments['query_text']:
            raise ValueError()
        if not isinstance(data['summary'], str) or not 1 <= len(data['summary'].strip()) <= 8000:
            raise ValueError()
        if not isinstance(data['drivers'], list) or len(data['drivers']) > 40:
            raise ValueError()
        if any(not isinstance(x, str) or not re.fullmatch(r'[A-Za-z0-9_]{1,240}', x) for x in data['drivers']):
            raise ValueError()
    except (ValueError, TypeError, KeyError, IndexError):
        raise SummaryError('invalid_summary') from None
    return {'provider': 'vedastro-hosted-subagent', 'interpretation': data,
            'locally_verified': False, 'calculation_settings_verified': False,
            'website_answer_parity_verified': False}


if __name__ == '__main__':
    try:
        raw = sys.stdin.read(8193)
        if len(raw) > 8192:
            raise SummaryError('input_too_large')
        print(json.dumps(summarize(json.loads(raw))))
    except (SummaryError, ValueError) as error:
        print(json.dumps({'error': str(error) if isinstance(error, SummaryError) else 'invalid_json'}))
        sys.exit(1)
