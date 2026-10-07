import importlib.util
import json
import os
from pathlib import Path
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

TOOLS = Path(__file__).resolve().parents[1] / 'skills/mongo_logger'
sys.path.insert(0, str(TOOLS))
import service_auth
import fetch_history
import logger_client

TOKEN = 'b' * 48


class LoggerClientTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.seen = []
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args): pass
            def do_GET(self):
                cls.seen.append((self.path, self.headers.get('Authorization')))
                if self.path.startswith('/redirect-json'):
                    self.send_response(302)
                    self.send_header('Location', '/should-never-be-called')
                    self.end_headers()
                    self.wfile.write(b'{"sessions":[],"status":"received"}')
                    return
                if self.path.startswith('/redirect'):
                    self.send_response(302)
                    self.send_header('Location', '/should-never-be-called')
                    self.end_headers()
                    return
                self.send_response(200)
                self.end_headers()
                self.wfile.write(json.dumps({'sessions': []}).encode())
            def do_POST(self):
                cls.seen.append((self.path, self.headers.get('Authorization')))
                self.rfile.read(int(self.headers.get('Content-Length', 0)))
                if self.path.startswith('/redirect-json'):
                    self.send_response(302)
                    self.send_header('Location', '/should-never-be-called')
                    self.end_headers()
                    self.wfile.write(b'{"status":"received"}')
                    return
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'{"status":"received"}')
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.base = f'http://127.0.0.1:{cls.server.server_port}'
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def test_base_and_legacy_webhook_urls_normalized(self):
        for base in [self.base, self.base+'/', self.base+'/webhook', self.base+'/webhook/']:
            self.assertEqual(service_auth.logger_url(base, '/webhook'), self.base+'/webhook')
            self.assertEqual(service_auth.logger_url(base, '/messages'), self.base+'/messages')

    def test_urllib_and_requests_clients_authenticate(self):
        methods = [(logger_client, logger_client.call_api_urllib, ({'text':'test'},)),
                   (fetch_history, fetch_history.call_api_urllib, ('/messages', {'userId':'test-account'}))]
        if logger_client.HAS_REQUESTS:
            methods += [(logger_client, logger_client.call_api_requests, ({'text':'test'},)),
                        (fetch_history, fetch_history.call_api_requests, ('/messages', {}))]
        with patch.dict(os.environ, {'MONGO_LOGGER_API_TOKEN':TOKEN}):
            for module, method, args in methods:
                with patch.object(module, 'MONGO_LOGGER_URL', self.base+'/webhook'):
                    result = method(*args)
                    self.assertNotIn('error', result)
                    self.assertEqual(self.seen[-1][1], 'Bearer '+TOKEN)

    def test_authenticated_urllib_does_not_follow_redirect(self):
        before = len(self.seen)
        with patch.dict(os.environ, {'MONGO_LOGGER_API_TOKEN':TOKEN}):
            request = service_auth.urllib.request.Request(self.base+'/redirect', headers=service_auth.logger_headers())
            with self.assertRaises(service_auth.urllib.error.HTTPError):
                service_auth.logger_urlopen(request, timeout=2)
        self.assertEqual(len(self.seen), before+1)
        self.assertEqual(self.seen[-1][0], '/redirect')

    @unittest.skipUnless(logger_client.HAS_REQUESTS, 'requests transport is optional')
    def test_requests_redirect_json_cannot_acknowledge_a_write_or_empty_history(self):
        methods = [(logger_client, logger_client.call_api_requests, ({'text': 'test'},)),
                   (fetch_history, fetch_history.call_api_requests, ('/redirect-json', {}))]
        with patch.dict(os.environ, {'MONGO_LOGGER_API_TOKEN': TOKEN}):
            for module, method, args in methods:
                before = len(self.seen)
                base = self.base + '/redirect-json' if module is logger_client else self.base
                with patch.object(module, 'MONGO_LOGGER_URL', base):
                    result = method(*args)
                self.assertEqual(result.get('status'), 302)
                self.assertIn('error', result)
                self.assertEqual(len(self.seen), before + 1, 'redirect must not follow or retry')

    def test_bad_config_and_optional_compatibility(self):
        with patch.dict(os.environ, {'MONGO_LOGGER_API_TOKEN':''}):
            self.assertNotIn('Authorization', service_auth.logger_headers())
        with patch.dict(os.environ, {'MONGO_LOGGER_API_TOKEN':'bad\nvalue'}):
            with self.assertRaises(ValueError): service_auth.logger_headers()
        for base in ['ftp://bad.test', 'https://a:secret@logger.test', 'https://logger.test?token=secret']:
            with self.assertRaises(ValueError): service_auth.logger_url(base, '/messages')


if __name__ == '__main__':
    unittest.main()
