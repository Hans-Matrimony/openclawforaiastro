"""Optional service authentication shared by logger tools and chart uploads."""
import os
import re
import urllib.request
from urllib.parse import urlsplit, urlunsplit


def logger_url(base, endpoint):
    parsed = urlsplit(base)
    if (parsed.scheme not in {'https', 'http'} or not parsed.hostname
            or parsed.username or parsed.password or parsed.query or parsed.fragment):
        raise ValueError('Invalid logger service URL')
    path = parsed.path.rstrip('/')
    if path.endswith('/webhook'):
        path = path[:-len('/webhook')]
    return urlunsplit((parsed.scheme, parsed.netloc, path + endpoint, '', ''))


def logger_headers():
    headers = {'Content-Type': 'application/json'}
    token = os.getenv('MONGO_LOGGER_API_TOKEN', '').strip()
    if token:
        if not re.fullmatch(r'[A-Za-z0-9_-]{32,256}', token):
            raise ValueError('Invalid logger service credential')
        headers['Authorization'] = 'Bearer ' + token
    return headers


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def logger_urlopen(request, *, timeout):
    return urllib.request.build_opener(NoRedirect).open(request, timeout=timeout)
