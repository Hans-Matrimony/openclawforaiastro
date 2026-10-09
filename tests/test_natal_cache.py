"""Cache isolation, invalidation, corruption and bounded-storage regressions."""
import json
from contextlib import closing
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'skills/kundli'))
import natal_cache as cache


class CacheTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = str(Path(self.tmp.name) / 'private' / 'natal.sqlite3')
        env = patch.dict(os.environ, {'KUNDLI_NATAL_CACHE_PATH': self.path})
        env.start()
        self.addCleanup(env.stop)
        self.compute = Mock(return_value={'positions': [1, 2, 3]})
        self.validate = Mock()

    def run_cache(self, key=None):
        return cache.cached_natal(key or {'birth': '2000-01-01', 'node': 'true'}, self.compute, self.validate)

    def test_reuse_returns_independent_values_without_computing_twice(self):
        first = self.run_cache()
        first['positions'].append(9)
        self.assertEqual(self.run_cache(), {'positions': [1, 2, 3]})
        self.compute.assert_called_once()
        self.assertEqual(self.validate.call_count, 2)

    def test_every_settings_change_is_a_cache_miss(self):
        base = {'birth': '2000-01-01', 'node': 'true', 'lat': 28, 'lon': 77,
                'revision': 'v1', 'engine': '2.10', 'ephemeris': 'one'}
        self.run_cache(base)
        for key in base:
            self.run_cache({**base, key: 'different'})
        self.assertEqual(self.compute.call_count, len(base) + 1)

    def test_corrupt_expired_and_future_entries_are_recomputed(self):
        for field, value in [('value', '{bad'), ('value', json.dumps({'bad': True})),
                             ('created', 0), ('created', 1e20)]:
            with self.subTest(field=field, value=value):
                self.run_cache()
                with closing(sqlite3.connect(self.path)) as db:
                    db.execute(f'UPDATE natal SET {field} = ?', (value,))
                    db.commit()
                before = self.compute.call_count
                def validate(value):
                    if 'positions' not in value:
                        raise ValueError('invalid chart')
                self.validate.side_effect = validate
                self.run_cache()
                self.assertEqual(self.compute.call_count, before + 1)

    def test_storage_failure_never_substitutes_or_blocks_chart(self):
        with patch.object(cache.sqlite3, 'connect', side_effect=sqlite3.OperationalError('unavailable')):
            self.assertEqual(self.run_cache(), self.compute.return_value)
        self.compute.side_effect = ValueError('real computation failed')
        with self.assertRaisesRegex(ValueError, 'real computation'):
            self.run_cache()

    def test_cache_capacity_and_missing_cache_opt_out(self):
        with patch.object(cache, 'MAX_ENTRIES', 2):
            for n in range(5):
                self.run_cache({'birth': n})
        with closing(sqlite3.connect(self.path)) as db:
            self.assertEqual(db.execute('SELECT count(*) FROM natal').fetchone()[0], 2)
        with patch.dict(os.environ, {'KUNDLI_NATAL_CACHE_PATH': ''}):
            self.run_cache()
            self.run_cache()
        self.assertEqual(self.compute.call_count, 7)

    def test_failed_computation_is_never_cached(self):
        self.compute.side_effect = ValueError('ephemeris failure')
        for _ in range(2):
            with self.assertRaises(ValueError):
                self.run_cache()
        self.assertEqual(self.compute.call_count, 2)


if __name__ == '__main__':
    unittest.main()
