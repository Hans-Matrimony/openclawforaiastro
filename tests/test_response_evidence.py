"""Strict new engine, temporal boundaries and parity with the existing engine."""
from copy import deepcopy
from contextlib import closing
from datetime import datetime, timezone
import importlib.util
import json
import os
import sqlite3
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'skills/kundli'))
import response_evidence as engine
from response_contract import digest, validate_evidence


def request(topic='career', language='english'):
    return {'dob': '1995-01-01', 'tob': '06:00', 'place': 'Delhi', 'topic': topic,
            'language': language, 'subject_key': 'a' * 64, 'profile_revision': 'b' * 64, 'time_precision': 'exact'}


class ResponseEvidenceTests(unittest.TestCase):
    def test_real_marriage_scan_is_bounded_checked_and_not_cached_as_natal(self):
        value = dict(request('marriage'), place='Delhi, India', scope='timing_context')
        evidence = engine.prepare(value)
        self.assertTrue(validate_evidence(evidence, value))
        timing = evidence['calculations']['marriage_timing']
        self.assertEqual(len(timing['samples']), 105)
        self.assertEqual(timing['method'], 'marriage-weekly-double-transit-v1')
        self.assertLess(len(json.dumps(evidence).encode()), 64 * 1024)
        self.assertEqual(evidence['model_calls'], 0)
        self.assertEqual(timing['exact_event_date'], 'not_established')

    def test_saved_form_country_qualifier_preserves_chart_and_original_identity(self):
        base = engine.prepare(request())
        for place in ('Delhi, India', ' delhi , INDIA ', 'Mumbai, India'):
            with self.subTest(place=place):
                qualified = dict(request(), place=place)
                result = engine.prepare(qualified)
                plain = engine.prepare(dict(request(), place=place.split(',')[0].strip()))
                self.assertEqual(result['chart'], plain['chart'])
                self.assertEqual(result['birth']['utc'], plain['birth']['utc'])
                self.assertEqual(result['birth']['place'], place)
                self.assertTrue(validate_evidence(result, qualified))
                self.assertFalse(validate_evidence(result, request()))
                self.assertNotEqual(result['request_fingerprint'], base['request_fingerprint'])

    def test_country_qualifier_never_guesses_foreign_or_unknown_places(self):
        for place in ('Delhi, USA', 'Delhi, Canada', 'Unknown, India', 'Delhi, New York, India',
                      'Delhi,', ', India', 'Delhi, IN', 'Delhi India', 'New Delhi, India, India'):
            with self.subTest(place=place), self.assertRaisesRegex(ValueError, 'Birthplace unresolved'):
                engine.resolve_birth(dict(request(), place=place))

    def test_real_engine_checked_packet_and_cache(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, {'KUNDLI_NATAL_CACHE_PATH': str(Path(tmp)/'cache.db')}):
            first = engine.prepare(request())
            self.assertTrue(validate_evidence(first, request()))
            with patch.object(engine, 'calculate_natal', side_effect=AssertionError('Cache missed')):
                second = engine.prepare(request())
            self.assertEqual(first['chart'], second['chart'])
            self.assertEqual(first['request_fingerprint'], second['request_fingerprint'])
            changed = request('education', 'hinglish')
            with patch.object(engine, 'calculate_natal', side_effect=AssertionError('Natal cache included response text')):
                third = engine.prepare(changed)
            self.assertTrue(validate_evidence(third, changed))
            self.assertNotEqual(first['allowed_claims'], third['allowed_claims'])

    def test_legacy_primary_numerical_parity_for_multiple_births(self):
        spec = importlib.util.spec_from_file_location('legacy_response_parity', ROOT/'skills/kundli/calculate.py')
        legacy = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(legacy)
        with tempfile.TemporaryDirectory() as tmp:
            legacy.SCRIPT_DIR = tmp
            for dob, tob, place in [('1995-01-01', '06:00', 'Delhi'), ('1980-07-21', '23:59', 'Mumbai'),
                                    ('2002-02-16', '08:19', 'Delhi')]:
                value = dict(request(), dob=dob, tob=tob, place=place)
                birth = engine.resolve_birth(value)
                new = engine.calculate_natal(birth)
                at = datetime.fromisoformat(birth['utc']).astimezone(timezone.utc).replace(tzinfo=None)
                old = legacy.calculate_kundli_pyswisseph(at, birth['coordinates']['lat'], birth['coordinates']['lon'])
                self.assertEqual(new['lagna'], old['lagna'])
                for planet in old['planet_positions']:
                    measured = new['positions'][planet['name']]
                    self.assertAlmostEqual(measured['longitude'], planet['sidereal_degree'], places=6)
                    self.assertEqual(measured['house'], planet['house'])

    def test_no_geocoding_or_ist_fallback(self):
        with self.assertRaises(ValueError):
            engine.resolve_birth(dict(request(), place='unresolved synthetic place'))
        with patch('timezonefinder.TimezoneFinder') as finder:
            finder.return_value.timezone_at.return_value = None
            with self.assertRaises(ValueError):
                engine.resolve_birth(request())

    def test_dst_gaps_and_overlaps_are_not_guessed(self):
        with patch('timezonefinder.TimezoneFinder') as finder:
            finder.return_value.timezone_at.return_value = 'America/New_York'
            for dob, tob in [('2024-03-10', '02:30'), ('2024-11-03', '01:30')]:
                with self.assertRaises(ValueError):
                    engine.resolve_birth(dict(request(), dob=dob, tob=tob))

    def test_seconds_preserved_and_unknown_precision_rejected(self):
        birth = engine.resolve_birth(dict(request(), tob='06:00:42'))
        self.assertIn('00:30:42', birth['utc'])
        with self.assertRaises(ValueError):
            engine.resolve_birth(dict(request(), time_precision='approximate'))

    def test_primary_failure_does_not_import_or_install_legacy(self):
        with patch('swisseph.calc_ut', side_effect=RuntimeError('missing measurement')):
            with self.assertRaises(RuntimeError):
                engine.prepare(request())

    def test_future_and_invalid_birth_date_rejected(self):
        for dob in ('2999-01-01', '2000-02-30'):
            with self.assertRaises(ValueError):
                engine.resolve_birth(dict(request(), dob=dob))

    def test_changed_ephemeris_data_invalidates_natal_cache(self):
        with tempfile.TemporaryDirectory() as tmp:
            ephe = Path(tmp) / 'ephe'
            ephe.mkdir()
            with patch.dict(os.environ, {'KUNDLI_NATAL_CACHE_PATH': str(Path(tmp)/'cache.db'),
                                         'ASTROFRIEND_RESPONSE_EPHE_PATH': str(ephe)}):
                engine.prepare(request())
                (ephe / 'synthetic.se1').write_bytes(b'changed data manifest')
                with patch.object(engine, 'calculate_natal', side_effect=RuntimeError('Recalculated')):
                    with self.assertRaisesRegex(RuntimeError, 'Recalculated'):
                        engine.prepare(request())

    def test_same_size_same_timestamp_data_change_cannot_reuse_cache(self):
        with tempfile.TemporaryDirectory() as tmp:
            ephe = Path(tmp) / 'ephe'
            ephe.mkdir()
            file = ephe / 'synthetic.se1'
            file.write_bytes(b'first')
            with patch.dict(os.environ, {'KUNDLI_NATAL_CACHE_PATH': str(Path(tmp)/'cache.db'),
                                         'ASTROFRIEND_RESPONSE_EPHE_PATH': str(ephe)}):
                engine.prepare(request())
                stat = file.stat()
                file.write_bytes(b'other')
                os.utime(file, ns=(stat.st_atime_ns, stat.st_mtime_ns))
                with patch.object(engine, 'calculate_natal', side_effect=RuntimeError('Data changed')):
                    with self.assertRaisesRegex(RuntimeError, 'Data changed'):
                        engine.prepare(request())

    def test_uncontrolled_ephemeris_environment_is_rejected(self):
        with patch.dict(os.environ, {'SE_EPHE_PATH': 'uncontrolled-path'}):
            with self.assertRaisesRegex(ValueError, 'override'):
                engine.prepare(request())

    def test_missing_speed_unapproved_or_mixed_sources_are_rejected(self):
        import swisseph as swe
        birth = engine.resolve_birth(request())
        original = swe.calc_ut
        for mode in ('no_speed', 'unknown', 'mixed'):
            def calculate(jd, index, flags):
                xx, actual = original(jd, index, flags)
                if mode == 'no_speed':
                    actual &= ~swe.FLG_SPEED
                elif mode == 'unknown':
                    actual = swe.FLG_SPEED
                else:
                    actual = swe.FLG_SPEED | (swe.FLG_SWIEPH if index == swe.SUN else swe.FLG_MOSEPH)
                return xx, actual
            with self.subTest(mode=mode), patch.object(swe, 'calc_ut', calculate):
                with self.assertRaises(ValueError):
                    engine.calculate_natal(birth)

    def test_incompatible_cached_positions_are_recomputed(self):
        with tempfile.TemporaryDirectory() as tmp:
            file = Path(tmp) / 'cache.db'
            with patch.dict(os.environ, {'KUNDLI_NATAL_CACHE_PATH': str(file)}):
                original = engine.prepare(request())
                broken = deepcopy(original['chart'])
                broken['positions'] = list(broken['positions'])
                with closing(sqlite3.connect(file)) as connection:
                    connection.execute('UPDATE natal SET value = ?', (json.dumps(broken),))
                    connection.commit()
                with patch.object(engine, 'calculate_natal', wraps=engine.calculate_natal) as calculate:
                    repaired = engine.prepare(request())
                    calculate.assert_called_once()
                self.assertEqual(repaired['chart'], original['chart'])
                self.assertTrue(validate_evidence(repaired, request()))


if __name__ == '__main__':
    unittest.main()
