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
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


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
        backend = ROOT.parent / 'AstroFriend_pwa' / 'backend'
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
        self.assertEqual((ROOT / 'skills/kundli/vimshottari.py').read_bytes(), (backend / 'app/services/kundli/vimshottari.py').read_bytes())

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
        with patch.object(self.k, '_PYSWISSEPH_AVAILABLE', False):
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

