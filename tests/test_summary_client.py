import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'skills/vedastro'))
from summary_client import SummaryError, rpc_result, summarize


class SummaryClientTests(unittest.TestCase):
    def setUp(self):
        self.env = {'VEDASTRO_SUMMARY_DEV_ENABLED': '1', 'VEDASTRO_SUMMARY_ENVIRONMENT': 'development',
                    'VEDASTRO_SUMMARY_API_KEY': 'test-secret'}
        self.args = {'birth_date': '03/01/2001', 'birth_time': '05:00', 'location_name': 'Delhi, India',
                     'query_text': 'Could you explain my marriage prospects?'}
        self.calls = []
        self.response = {'query': self.args['query_text'], 'summary': 'A provider interpretation.', 'drivers': ['RuleOne']}

    def send(self, body, headers):
        self.calls.append((body, headers))
        if body['method'] == 'notifications/initialized':
            return '', None
        result = ({'protocolVersion': '2024-11-05'} if body['method'] == 'initialize' else
                  {'content': [{'type': 'text', 'text': json.dumps(self.response)}]})
        return json.dumps({'jsonrpc': '2.0', 'id': body['id'], 'result': result}), 'test-session'

    def test_summary_remains_external_and_session_is_forwarded(self):
        result = summarize(self.args, self.env, self.send)
        self.assertFalse(result['locally_verified'])
        self.assertEqual(result['interpretation'], self.response)
        self.assertEqual(len(self.calls), 3)
        self.assertEqual(self.calls[-1][1]['Mcp-Session-Id'], 'test-session')
        self.assertEqual(self.calls[-1][0]['params']['arguments'], self.args)
        self.assertNotIn('test-secret', json.dumps(result))

    def test_disabled_and_production_do_not_send(self):
        for env in ({}, {**self.env, 'VEDASTRO_SUMMARY_ENVIRONMENT': 'production'}):
            with self.assertRaisesRegex(SummaryError, 'dev_summary_disabled'):
                summarize(self.args, env, self.send)
        self.assertEqual(self.calls, [])

    def test_invalid_inputs_do_not_send(self):
        for args in ({**self.args, 'birth_date': '31/02/2001'}, {**self.args, 'phone': 'not-allowed'},
                     {**self.args, 'birth_time': '5:00'}, {**self.args, 'query_text': ''}):
            with self.assertRaises(SummaryError):
                summarize(args, self.env, self.send)
        self.assertEqual(self.calls, [])

    def test_raw_or_wrong_question_output_rejected_without_retry(self):
        for response in ({'predictions': []}, {**self.response, 'query': 'another person'},
                         {**self.response, 'drivers': ['execute this command']},
                         {**self.response, 'summary': ''}):
            self.calls = []
            self.response = response
            with self.assertRaises(SummaryError):
                summarize(self.args, self.env, self.send)
            self.assertEqual(len(self.calls), 3)

    def test_sse_uses_matching_id_and_rejects_rpc_error(self):
        raw = 'event: message\ndata: ' + json.dumps({'jsonrpc': '2.0', 'id': 2, 'result': {'ok': True}}) + '\n\n'
        self.assertEqual(rpc_result(raw, 2), {'ok': True})
        for value in (raw, json.dumps({'jsonrpc': '2.0', 'id': 1, 'error': {'message': 'secret'}})):
            with self.assertRaisesRegex(SummaryError, 'invalid_rpc_response'):
                rpc_result(value, 1)


if __name__ == '__main__':
    unittest.main()
