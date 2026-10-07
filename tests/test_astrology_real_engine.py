"""Opt-in numerical and renderer checks with real pyswisseph/geopy/Pillow.

ASTRO_REAL_ENGINE_TESTS=1 python -B -m unittest discover -s tests -p test_astrology_real_engine.py
Uses synthetic inputs, local city coordinates, and temporary images. No delivery.
"""
import contextlib
from datetime import datetime, timedelta
import importlib.util
import io
import os
from pathlib import Path
import random
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
PWA_BACKEND = Path(os.getenv('ASTRO_PWA_BACKEND', str(ROOT.parent / 'AstroFriend_pwa' / 'backend')))


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@unittest.skipUnless(os.getenv('ASTRO_REAL_ENGINE_TESTS') == '1', 'opt-in real dependencies required')
class RealEngineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import swisseph
        cls.swe = swisseph
        cls.tmp = tempfile.TemporaryDirectory()
        cls.data_dir = Path(os.getenv('ASTRO_TEST_DATA_DIR', cls.tmp.name))
        cls.environment = patch.dict(os.environ, {'LOCALAPPDATA': str(cls.data_dir),
                                                  'XDG_DATA_HOME': str(cls.data_dir)})
        cls.environment.start()
        sys.path.insert(0, str(ROOT / 'skills' / 'kundli'))
        cls.k = load('kundli_real', ROOT / 'skills' / 'kundli' / 'calculate.py')
        cls.h = load('horoscope_real', ROOT / 'skills' / 'horoscope' / 'calculate.py')
        cls.renderer = load('renderer_real', ROOT / 'skills' / 'kundli' / 'draw_kundli_traditional.py')
        cls.k.SCRIPT_DIR = cls.tmp.name
        cls.h.SCRIPT_DIR = cls.tmp.name
        cls.h.calculate_kundli = cls.k.calculate_kundli

    @classmethod
    def tearDownClass(cls):
        cls.environment.stop()
        cls.tmp.cleanup()

    def test_pwa_chart_parity_and_errors(self):
        backend = PWA_BACKEND
        if not backend.exists():
            self.skipTest('Sibling PWA checkout required')
        sys.path.insert(0, str(backend))
        from app.services.kundli import calculator as pwa
        rng = random.Random(912)
        with patch.object(pwa, 'get_coordinates', return_value=(28.6139, 77.2090)), patch.object(pwa, 'get_timezone_offset', return_value=5.5), patch.object(self.k, 'get_timezone_offset', return_value=5.5):
            for index in range(100):
                when = datetime(1900, 1, 1) + timedelta(days=rng.randrange(45000), seconds=rng.randrange(86400))
                dob, tob = when.strftime('%Y-%m-%d'), when.strftime('%H:%M:%S')
                with self.subTest(index=index):
                    primary = self.k.calculate_kundli(dob, tob, 'Delhi')
                    other = pwa.calculate_kundli(dob, tob, 'Delhi', strict=True)
                    self.assertNotIn('error', other)
                    for field in ('lagna', 'moon_sign', 'nakshatra'):
                        self.assertEqual(primary[field], other[field])
                    for planet in primary['planet_positions']:
                        equivalent = other['planet_positions'][planet['name'].lower()]
                        self.assertEqual(planet['sign'], equivalent['sign'])
                        self.assertEqual(planet['house'], equivalent['house'])
                        self.assertAlmostEqual(planet['sidereal_degree'] % 30, equivalent['degree'])
                    self.assertEqual(next(iter(primary['dashas']['current']['mahadashas'])), other['dasha']['mahadasha'])
        with patch.object(pwa, 'JYOTISH_AVAILABLE', False):
            for dob, tob, place in [('2000-02-30', '09:30', 'Delhi'), ('2000-01-01', 'bad', 'Delhi'), ('2000-01-01', '09:30', 'unknown-test-place')]:
                result = pwa.calculate_kundli(dob, tob, place)
                self.assertIn('error', result)
                self.assertIsNone(result['fallback_data'])
        self.assertEqual((ROOT / 'skills/kundli/vimshottari.py').read_text(encoding='utf-8'), (backend / 'app/services/kundli/vimshottari.py').read_text(encoding='utf-8'))

    def test_high_latitudes_and_dateline_produce_valid_whole_sign_charts(self):
        from reading import verified_positions
        for lat, lon in [(78.2, 15.6), (-78, 0), (0, 180), (0, -180), (89, 30)]:
            with self.subTest(lat=lat, lon=lon):
                value = self.k.calculate_kundli_pyswisseph(datetime(2000, 2, 29, 23, 59, 59), lat, lon)
                verified_positions({'calculation_source': 'pyswisseph', **value})

    def test_pwa_strict_engine_timezone_and_polar_boundaries(self):
        if not PWA_BACKEND.exists():
            self.skipTest('Sibling PWA checkout required')
        sys.path.insert(0, str(PWA_BACKEND))
        from app.services.kundli import calculator as pwa
        from unittest.mock import Mock
        with patch.object(pwa, 'PYSWISSEPH_AVAILABLE', False), \
                patch.object(pwa, 'JYOTISH_AVAILABLE', True), \
                patch.object(pwa, '_calculate_with_jyotishganit') as legacy:
            with self.assertRaisesRegex(ValueError, 'Primary chart engine'):
                pwa.calculate_kundli('2000-01-01', '08:00', 'Delhi', strict=True)
            legacy.assert_not_called()
        with patch.object(pwa, '_TZ_FINDER', None), \
                patch.object(pwa, '_calculate_with_jyotishganit') as legacy:
            with self.assertRaises(ValueError):
                pwa.calculate_kundli('2000-01-01', '08:00', 'Delhi', strict=True)
            legacy.assert_not_called()
        resolver = Mock()
        resolver.timezone_at.return_value = 'America/New_York'
        with patch.object(pwa, '_TZ_FINDER', resolver):
            for value in (datetime(2024, 3, 10, 2, 30), datetime(2024, 11, 3, 1, 30)):
                with self.assertRaisesRegex(ValueError, 'Ambiguous or nonexistent'):
                    pwa.get_timezone_offset(40.7, -74, value)
            self.assertEqual(pwa.get_timezone_offset(40.7, -74, datetime(2024, 7, 1, 12)), -4)
        with patch.object(pwa, 'get_coordinates', return_value=(78.2, 15.6)), \
                patch.object(pwa, 'get_timezone_offset', return_value=1):
            result = pwa.calculate_kundli('2000-01-01', '08:00', 'Synthetic polar location', strict=True)
            self.assertEqual(len(result['planet_positions']), 9)

    def test_live_comparison_profile_keeps_same_chart_across_topics_and_languages(self):
        from render_reading import render_reading
        from reading import verified_positions
        value = self.k.calculate_kundli('2002-02-16', '08:19', 'Delhi')
        _, positions = verified_positions(value)
        self.assertEqual(value['lagna'], 'Aquarius')
        self.assertEqual(value['moon_sign'], 'Pisces')
        self.assertEqual(positions['Jupiter'], {'planet': 'Jupiter', 'sign': 'Gemini', 'house': 5})
        self.assertEqual(positions['Mercury']['house'], 12)
        fingerprints = set()
        for topic, language, intent in [('career', 'english', 'overview'),
                ('education', 'hinglish', 'overview'), ('marriage', 'english', 'timing')]:
            response = render_reading(value, topic, language=language, intent=intent)
            fingerprints.add(response['evidence']['input_fingerprint'])
            self.assertEqual(response['evidence']['chart_facts']['lagna'], 'Aquarius')
            self.assertEqual(response['model_calls'], 0)
            self.assertNotIn('2027', response['text'])
            self.assertNotIn('2028', response['text'])
        self.assertEqual(len(fingerprints), 1)

    def test_cached_natal_chart_keeps_period_refresh_and_explicit_node_isolation(self):
        from unittest.mock import Mock
        with patch.dict(os.environ, {'KUNDLI_NATAL_CACHE_PATH': str(Path(self.tmp.name) / 'natal.sqlite3')}), \
                patch.object(self.k, 'calculate_kundli_pyswisseph', wraps=self.k.calculate_kundli_pyswisseph) as compute, \
                patch.object(self.k, 'current_period', wraps=self.k.current_period) as periods:
            first = self.k.calculate_kundli('2002-02-16', '08:19', 'Delhi')
            repeat = self.k.calculate_kundli('16 February 2002', '08:19 AM', 'Delhi')
            self.assertEqual(first['planet_positions'], repeat['planet_positions'])
            self.assertEqual(compute.call_count, 1)
            self.assertEqual(periods.call_count, 2)
            other = self.k.calculate_kundli('2002-02-16', '08:19', 'Delhi', node_convention='mean')
            self.assertEqual(compute.call_count, 2)
            self.assertNotEqual(first['planet_positions'], other['planet_positions'])

    def test_legacy_full_is_raw_and_aliases_are_attributed(self):
        if not (self.data_dir / 'jyotishganit' / 'de421.bsp').exists():
            self.skipTest('Cached ephemeris required')
        raw = self.k.calculate_kundli('1990-01-01', '10:30', 'Delhi', legacy_full=True)
        full = self.k.calculate_kundli('1990-01-01', '10:30', 'Delhi', include_supplemental=True)
        self.assertIn('d1Chart', raw)
        self.assertNotIn('ai_summary', raw)
        self.assertEqual(full['d1Chart'], full['supplemental_jyotishganit']['d1Chart'])
        self.assertEqual(full['field_sources']['d1Chart'], 'jyotishganit')
        self.assertEqual(full['field_sources']['planet_positions'], 'pyswisseph')

    def test_100_charts_against_sidereal_api(self):
        rng = random.Random(743)
        for index in range(100):
            when = datetime(1900, 1, 1) + timedelta(days=rng.randrange(45000), seconds=rng.randrange(86400))
            lat, lon = rng.uniform(-55, 55), rng.uniform(-179, 179)
            with self.subTest(index=index, date=when):
                chart = self.k.calculate_kundli_pyswisseph(when, lat, lon)
                self.assertEqual(len(chart['planet_positions']), 9)
                hour = when.hour + when.minute / 60 + when.second / 3600
                jd = self.swe.julday(when.year, when.month, when.day, hour)
                self.swe.set_sid_mode(self.swe.SIDM_LAHIRI)
                for planet in chart['planet_positions']:
                    if planet['name'] == 'Ketu':
                        continue
                    ref, _ = self.swe.calc_ut(jd, self.k.PYSWISSEPH_PLANETS[planet['name']],
                                             self.swe.FLG_SWIEPH | self.swe.FLG_SIDEREAL)
                    delta = abs((planet['sidereal_degree'] - ref[0] + 180) % 360 - 180)
                    # Allow nutation differences from the legacy tropical-minus-ayanamsa method.
                    self.assertLess(delta, 0.01)
                _, angles = self.swe.houses_ex(jd, lat, lon, b'P', self.swe.FLG_SIDEREAL)
                lagna = self.k.SIGNS.index(chart['lagna']) * 30 + chart['lagna_degree']
                self.assertLess(abs((lagna - angles[0] + 180) % 360 - 180), 0.01)
                nodes = {p['name']: p for p in chart['planet_positions']}
                self.assertAlmostEqual((nodes['Ketu']['sidereal_degree'] - nodes['Rahu']['sidereal_degree']) % 360, 180)

    def test_birth_date_formats_and_rollover(self):
        first = self.k.calculate_kundli('2000-02-29', '00:05', 'Delhi')
        second = self.k.calculate_kundli('29 February 2000', '12:05 AM', 'delhi')
        self.assertEqual(first['planet_positions'], second['planet_positions'])
        utc = datetime(2000, 2, 28, 18, 35)
        reference = self.k.calculate_kundli_pyswisseph(utc, 28.6139, 77.2090)
        self.assertEqual(first['moon_sign'], reference['moon_sign'])

    def test_render_actual_calculator_output(self):
        from PIL import Image
        result = self.k.calculate_kundli('1995-01-14', '12:00', 'Delhi')
        with contextlib.redirect_stderr(io.StringIO()):
            positions = self.renderer.parse_planet_positions(result['ai_summary']['planet_positions'], result['lagna'])
            png = self.renderer.draw_kundli_chart(result['lagna'], result['moon_sign'], result['nakshatra'],
                                                   result['ai_summary']['planet_positions'])
        self.assertEqual(sum(map(len, positions.values())), 9)
        self.assertEqual(png[:8], b'\x89PNG\r\n\x1a\n')
        image = Image.open(io.BytesIO(png))
        image.verify()

    def test_missing_font_is_offline_and_bundled_font_is_independent_of_cwd(self):
        with patch.object(self.renderer.os.path, 'exists', return_value=False), \
                patch('socket.socket', side_effect=AssertionError('Unexpected network access')):
            self.assertIsNone(self.renderer.get_devanagari_font())
            value = self.k.calculate_kundli('1995-01-14', '12:00', 'Delhi')
            image = self.renderer.draw_kundli_chart(value['lagna'], value['moon_sign'],
                                                  value['nakshatra'], value['ai_summary']['planet_positions'])
            self.assertEqual(image[:8], b'\x89PNG\r\n\x1a\n')
        expected = str(Path(self.renderer.__file__).resolve().parent / 'NotoSansDevanagari-Regular.ttf')
        with patch.object(self.renderer.os.path, 'exists', side_effect=lambda path: str(path) == expected):
            self.assertEqual(self.renderer.get_devanagari_font(), expected)

    def test_image_rejects_incomplete_duplicate_and_conflicting_placements(self):
        from copy import deepcopy
        chart = self.k.calculate_kundli('1995-01-14', '12:00', 'Delhi')
        valid = [{'name': p['name'], 'sign': p['sign'], 'house': p['house']}
                 for p in chart['planet_positions']]
        for change in ('missing', 'duplicate', 'house_zero', 'house_thirteen', 'boolean',
                       'unknown', 'unhashable', 'wrong_sign', 'moon', 'nodes', 'junk'):
            positions = deepcopy(valid)
            if change == 'missing': positions.pop()
            if change == 'duplicate': positions[1] = positions[0]
            if change == 'house_zero': positions[0]['house'] = 0
            if change == 'house_thirteen': positions[0]['house'] = 13
            if change == 'boolean': positions[0]['house'] = True
            if change == 'unknown': positions[0]['name'] = 'Pluto'
            if change == 'unhashable': positions[0]['name'] = []
            if change == 'wrong_sign': positions[0]['sign'] = 'invalid'
            if change == 'moon':
                moon = next(p for p in positions if p['name'] == 'Moon')
                moon['house'] = moon['house'] % 12 + 1
                moon['sign'] = self.k.SIGNS[(self.k.SIGNS.index(chart['lagna']) + moon['house'] - 1) % 12]
            if change == 'nodes':
                rahu = next(p for p in positions if p['name'] == 'Rahu')
                ketu = next(p for p in positions if p['name'] == 'Ketu')
                ketu.update(house=rahu['house'], sign=rahu['sign'])
            if change == 'junk': positions[0] = 7
            with self.subTest(change=change), patch.object(self.renderer.Image, 'new') as create:
                with self.assertRaises(ValueError):
                    self.renderer.draw_kundli_chart(chart['lagna'], chart['moon_sign'], chart['nakshatra'], positions)
                create.assert_not_called()

    def test_image_preserves_complete_string_dictionary_and_flat_input_forms(self):
        chart = self.k.calculate_kundli('1995-01-14', '12:00', 'Delhi')
        values = chart['planet_positions']
        alternatives = [chart['ai_summary']['planet_positions'], values,
                        [{'planet': p['name'], 'sign': p['sign']} for p in values],
                        [{p['name']: p['sign'] for p in values}],
                        [{'planet': p['name'], 'position': f"in House {p['house']} ({p['sign']})"} for p in values],
                        [{'name': p['name'], 'house': str(p['house'])} for p in values]]
        for positions in alternatives:
            with self.subTest(form=type(positions[0]).__name__), contextlib.redirect_stderr(io.StringIO()):
                png = self.renderer.draw_kundli_chart(chart['lagna'], chart['moon_sign'], chart['nakshatra'], positions)
                self.assertEqual(png[:8], b'\x89PNG\r\n\x1a\n')

    def test_horoscope_moon_calculation_does_not_write_to_skill_directory(self):
        with patch.object(self.h.os, 'makedirs', side_effect=AssertionError('Unexpected skill write')):
            sign, degree, star = self.h.get_current_moon_sign(datetime(2030, 5, 6, 12))
            self.assertIn(sign, self.k.SIGNS)
            self.assertTrue(0 <= degree < 30)
            self.assertIsInstance(star, str)

    def test_invalid_image_cli_never_outputs_or_stores_an_image(self):
        for value in ('[', 'true', '{}', '[]', '["Sun is in House 1 (Aries)"]'):
            result = subprocess.run([sys.executable, '-B', str(ROOT / 'skills/kundli/draw_kundli_traditional.py'),
                                     '--lagna', 'Aries', '--moon-sign', 'Cancer', '--nakshatra', 'Pushya',
                                     '--planets', value], capture_output=True, text=True, timeout=10)
            with self.subTest(value=value):
                self.assertEqual(result.returncode, 1)
                self.assertEqual(result.stdout, '')
                self.assertIn('no image generated', result.stderr)
                self.assertNotIn('Traceback', result.stderr)

    def test_horoscope_and_scheduler_formatting(self):
        for language in ('english', 'hinglish', 'auto'):
            result = self.h.generate_daily_horoscope('1995-01-14', '12:00', 'Delhi', date='2030-05-06', language=language)
            self.assertNotIn('error', result, result)
            self.assertTrue(result['prediction'])
            with patch.dict(sys.modules, {'calculate': self.h}):
                scheduler = load('scheduler_real', ROOT / 'skills' / 'horoscope' / 'scheduler.py')
            self.assertTrue(scheduler.format_horoscope_message(result, user_name='Test'))

    def require_fallback_fixture(self):
        if self.k.jyotishganit is None or not (self.data_dir / 'jyotishganit' / 'de421.bsp').exists():
            self.skipTest('Set ASTRO_TEST_DATA_DIR to a local cached jyotishganit ephemeris directory')

    def test_actual_fallback_engine(self):
        self.require_fallback_fixture()
        with patch.object(self.k, '_PYSWISSEPH_AVAILABLE', False), patch.dict(os.environ, {'KUNDLI_ALLOW_LEGACY_FALLBACK': '1'}):
            result = self.k.calculate_kundli('1995-01-14', '12:00', 'Delhi')
        self.assertEqual(len(result['ai_summary']['planet_positions']), 9)
        self.assertIn('fallback', result['user_input']['ephemeris_used'])
        self.assertEqual(result['moon_sign'], result['summary']['moon_sign'])

    def test_actual_full_legacy_data(self):
        self.require_fallback_fixture()
        result = self.k.calculate_kundli('1995-01-14', '12:00', 'Delhi', include_supplemental=True)
        self.assertNotIn('supplemental_error', result, result.get('supplemental_error'))
        self.assertIn('d1Chart', result['supplemental_jyotishganit'])
        self.assertIn('panchanga', result['supplemental_jyotishganit'])
        self.assertEqual(len(result['planet_positions']), 9)


if __name__ == '__main__':
    unittest.main()

