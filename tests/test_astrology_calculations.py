"""Offline regression tests. Ephemeris I/O is stubbed; period arithmetic is real.

Run: python -B -m unittest discover -s tests -p test_astrology_calculations.py
"""

import contextlib
from datetime import datetime, timedelta
import importlib.util
import io
import json
import math
import os
from pathlib import Path
import runpy
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
KUNDLI = ROOT / "skills" / "kundli"
sys.path.insert(0, str(KUNDLI))
from vimshottari import current_period


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class CalculationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.swe = types.ModuleType("swisseph")
        self.swe.SIDM_LAHIRI = 1
        self.swe.MOON = 1
        self.swe.set_ephe_path = Mock()
        self.swe.set_sid_mode = Mock()
        self.swe.julday = Mock(side_effect=lambda y, m, d, h: float(y))
        self.swe.get_ayanamsa_ut = Mock(side_effect=lambda jd: 23 if jd < 2000 else 24)
        self.swe.houses = Mock(return_value=((100,) * 12, (100,) * 8))
        self.swe.calc_ut = Mock(side_effect=lambda jd, planet: ((40 + planet * 10, 0, 0, 0, 0, 0), 2))
        self.jyotish = types.ModuleType("jyotishganit")
        self.jyotish.calculate_birth_chart = Mock(side_effect=RuntimeError("secondary engine failed"))
        geopy = types.ModuleType("geopy")
        geocoders = types.ModuleType("geopy.geocoders")
        geocoders.Nominatim = Mock()
        geocoders.Nominatim.return_value.geocode.return_value = types.SimpleNamespace(latitude=28.6, longitude=77.2)
        modules = {"swisseph": self.swe, "jyotishganit": self.jyotish,
                   "geopy": geopy, "geopy.geocoders": geocoders,
                   "timezonefinder": None}
        self.patcher = patch.dict(sys.modules, modules)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)
        self.k = load("test_kundli", KUNDLI / "calculate.py")
        self.h = load("test_horoscope", ROOT / "skills" / "horoscope" / "calculate.py")
        self.k.SCRIPT_DIR = self.tmp.name
        self.h.SCRIPT_DIR = self.tmp.name
        self.k.get_coordinates = Mock(return_value=(28.6, 77.2))
        self.resolve_timezone = self.k.get_timezone_offset
        self.k.get_timezone_offset = Mock(return_value=5.5)
        self.h.calculate_kundli = self.k.calculate_kundli

    def test_noon_and_midnight(self):
        for parser in (self.k.parse_time, self.h.parse_time_local):
            self.assertEqual(parser("12:00").hour, 12)
            self.assertEqual(parser("00:00").hour, 0)
            self.assertEqual(parser("12:00 AM").hour, 0)
            self.assertEqual(parser("12 PM").hour, 12)
            with self.assertRaises(ValueError):
                parser("12")

    def test_explicit_coordinates_and_confirmed_dst_offset(self):
        result = self.k.calculate_kundli('2000-01-01', '09:30', 'Confirmed location',
                                        latitude=40, longitude=-74, utc_offset=-5)
        self.k.get_coordinates.assert_not_called()
        self.k.get_timezone_offset.assert_not_called()
        self.assertEqual(result['user_input']['coordinates'], {'lat': 40, 'lon': -74})
        self.assertEqual(result['user_input']['timezone_offset'], -5)
        for values in ({'latitude': 40}, {'longitude': -74}, {'latitude': 90, 'longitude': 0},
                       {'latitude': float('nan'), 'longitude': 0}, {'latitude': True, 'longitude': 0},
                       {'utc_offset': 15}, {'utc_offset': float('inf')}, {'utc_offset': True}):
            with self.subTest(values=values), self.assertRaises(ValueError):
                self.k.calculate_kundli('2000-01-01', '09:30', 'Delhi', **values)

    def test_whole_sign_engine_does_not_request_placidus_cusps(self):
        self.k.calculate_kundli_pyswisseph(datetime(2000, 1, 1), 78, 15)
        self.assertEqual(self.swe.houses.call_args.args[-1], b'W')

    def test_international_geocoding_rejects_ambiguity_without_india_suffix(self):
        module = sys.modules['geopy.geocoders']
        geocoder = module.Nominatim.return_value
        location = types.SimpleNamespace(latitude=40, longitude=-74)
        geocoder.geocode.return_value = [location]
        # setUp replaces the module's public resolver; call the original by reloading.
        original = load('geocoder_test', KUNDLI / 'calculate.py')
        self.assertEqual(original.get_coordinates('New York, USA'), (40, -74))
        self.assertEqual(geocoder.geocode.call_args.args[0], 'New York, USA')
        self.assertEqual(geocoder.geocode.call_args.kwargs['timeout'], 5)
        geocoder.geocode.return_value = [location, location]
        with self.assertRaisesRegex(ValueError, 'not uniquely resolved'):
            original.get_coordinates('Springfield')
        with self.assertRaises(ValueError):
            original.get_coordinates('')

    def test_confirmed_indian_place_aliases_work_without_network(self):
        geocoder = sys.modules['geopy.geocoders'].Nominatim.return_value
        geocoder.geocode.reset_mock()
        geocoder.geocode.return_value = None
        original = load('place_alias_test', KUNDLI / 'calculate.py')
        for place in ('Delhi, India', '  DELHI ,  India ', 'New Delhi, Delhi, India'):
            self.assertEqual(original.get_coordinates(place), (28.6139, 77.209))
        self.assertEqual(original.get_coordinates('Meerut, Uttar Pradesh, India'), (28.9845, 77.7064))
        for place in ('Bengaluru', 'Bangalore', 'Bengaluru, India', 'Bangalore, India',
                      'Bengaluru, Karnataka, India', 'Bangalore, Karnataka, India',
                      '  BENGALURU , Karnataka ,  India '):
            self.assertEqual(original.get_coordinates(place), (12.9716, 77.5946))
        geocoder.geocode.assert_not_called()
        for place in ('Delhi, Canada', 'Delhi, Ontario, Canada', 'Meerut, Unknown Region, India',
                      'Bengaluru, Canada', 'Bengaluru, Unknown Region, India',
                      'Bangalore, Unknown Region, India'):
            with self.assertRaisesRegex(ValueError, 'not uniquely resolved'):
                original.get_coordinates(place)

    def test_ayanamsa_uses_birth_epoch(self):
        old = self.k.calculate_kundli_pyswisseph(datetime(1980, 1, 1), 28, 77)
        new = self.k.calculate_kundli_pyswisseph(datetime(2020, 1, 1), 28, 77)
        self.assertEqual(old["ayanamsa_degree"], 23)
        self.assertEqual(new["ayanamsa_degree"], 24)
        self.assertEqual(old["moon_sidereal_degree"] - new["moon_sidereal_degree"], 1)
        self.swe.set_sid_mode.assert_called_with(1)

    def test_mean_nodes_are_explicit_and_leave_the_default_unchanged(self):
        when = datetime(2000, 1, 1)
        default = self.k.calculate_kundli_pyswisseph(when, 28, 77)
        mean = self.k.calculate_kundli_pyswisseph(when, 28, 77, node_convention='mean')
        self.assertEqual(default['node_convention'], 'true')
        self.assertEqual(mean['node_convention'], 'mean')
        true_rahu = next(p for p in default['planet_positions'] if p['name'] == 'Rahu')
        mean_rahu = next(p for p in mean['planet_positions'] if p['name'] == 'Rahu')
        self.assertNotEqual(true_rahu['sidereal_degree'], mean_rahu['sidereal_degree'])
        ketu = next(p for p in mean['planet_positions'] if p['name'] == 'Ketu')
        self.assertEqual((ketu['sidereal_degree'] - mean_rahu['sidereal_degree']) % 360, 180)
        with self.assertRaises(ValueError):
            self.k.calculate_kundli_pyswisseph(when, 28, 77, node_convention='unknown')

    def test_timezone_resolution_never_silently_substitutes_ist(self):
        self.k._TZ_FINDER = None
        with self.assertRaisesRegex(ValueError, 'resolver unavailable'):
            self.resolve_timezone(40, -74, datetime(2000, 1, 1))
        self.k._TZ_FINDER = Mock()
        self.k._TZ_FINDER.timezone_at.return_value = None
        with self.assertRaisesRegex(ValueError, 'could not be resolved'):
            self.resolve_timezone(40, -74, datetime(2000, 1, 1))
        with self.assertRaisesRegex(ValueError, 'Birth datetime is required'):
            self.resolve_timezone(40, -74)

    def test_dst_overlap_and_gap_are_rejected_and_normal_offset_is_historical(self):
        self.k._TZ_FINDER = Mock()
        self.k._TZ_FINDER.timezone_at.return_value = 'America/New_York'
        for birth in (datetime(2021, 11, 7, 1, 30), datetime(2021, 3, 14, 2, 30)):
            with self.assertRaisesRegex(ValueError, 'Ambiguous or nonexistent'):
                self.resolve_timezone(40, -74, birth)
        self.assertEqual(self.resolve_timezone(40, -74, datetime(2021, 7, 1)), -4)
        self.assertEqual(self.resolve_timezone(40, -74, datetime(2021, 1, 1)), -5)

    def test_missing_ephemeris_check_does_not_install_packages(self):
        import subprocess
        with patch.dict(sys.modules, {'swisseph': None}), patch.object(subprocess, 'check_call') as install:
            self.assertFalse(self.k.ensure_pyswisseph())
            install.assert_not_called()

    def test_failed_moon_does_not_become_ashwini(self):
        def fail_moon(jd, planet):
            if planet == 1:
                raise ValueError("no Moon")
            return (40, 0, 0, 0, 0, 0), 2
        self.swe.calc_ut.side_effect = fail_moon
        with self.assertRaisesRegex(ValueError, "Moon"):
            self.k.calculate_kundli_pyswisseph(datetime(2000, 1, 1), 28, 77)

    def test_primary_chart_does_not_need_secondary(self):
        result = self.k.calculate_kundli("2000-01-01", "12:00", "Delhi")
        self.jyotish.calculate_birth_chart.assert_not_called()
        self.assertEqual(len(result["ai_summary"]["planet_positions"]), 9)
        self.assertEqual(result["summary"]["moon_sign"], result["moon_sign"])
        self.assertEqual(result["calculation_source"], "pyswisseph")
        self.assertIn("dashas", result)

    def test_summary_failure_is_not_a_null_success(self):
        self.k.HINDI_RASHI = None
        with self.assertRaisesRegex(ValueError, "Could not build chart summary"):
            self.k.calculate_kundli("2000-01-01", "12:00", "Delhi")

    def test_invalid_lagna_cannot_become_an_aries_house_default(self):
        chart = self.k.calculate_kundli_pyswisseph(datetime(2000, 1, 1), 28, 77)
        chart['lagna'] = None
        with patch.object(self.k, 'calculate_kundli_pyswisseph', return_value=chart):
            with self.assertRaisesRegex(ValueError, 'Incomplete chart summary'):
                self.k.calculate_kundli('2000-01-01', '12:00', 'Delhi')

    def test_optional_full_data_failure_keeps_primary_chart(self):
        result = self.k.calculate_kundli("2000-01-01", "12:00", "Delhi", include_supplemental=True)
        self.assertEqual(len(result['planet_positions']), 9)
        self.assertIn('supplemental_error', result)
        self.assertNotIn('supplemental_jyotishganit', result)

    def test_full_data_is_separate_from_primary(self):
        legacy = {'moon_sign': 'Pisces', 'dashas': {'different': 'convention'}}
        self.jyotish.calculate_birth_chart.side_effect = None
        self.jyotish.calculate_birth_chart.return_value.to_dict.return_value = legacy
        result = self.k.calculate_kundli("2000-01-01", "12:00", "Delhi", include_supplemental=True)
        self.assertEqual(result['moon_sign'], 'Aries')
        self.assertEqual(result['supplemental_jyotishganit'], legacy)
        self.assertIn('current', result['dashas'])

    def test_valid_zero_degree_fallback_position(self):
        star, pada, changed = self.k.validate_or_correct_nakshatra('Aries', 0, None)
        self.assertEqual((star, pada), ('Ashwini', 1))

    def test_incomplete_fallback_is_rejected(self):
        self.k._PYSWISSEPH_AVAILABLE = False
        moon = types.SimpleNamespace(celestial_body='Moon', to_dict=lambda: {
            'celestialBody': 'Moon', 'sign': 'Aries', 'signDegrees': 2,
            'nakshatra': 'Ashwini', 'pada': 1})
        chart = types.SimpleNamespace(
            ascendant=types.SimpleNamespace(sign='Aries'),
            d1_chart=types.SimpleNamespace(planets=[moon]), to_dict=lambda: {})
        self.jyotish.calculate_birth_chart.side_effect = None
        self.jyotish.calculate_birth_chart.return_value = chart
        with self.assertRaisesRegex(ValueError, 'dependency unavailable'):
            self.k.calculate_kundli('2000-01-01', '12:00', 'Delhi')
        self.jyotish.calculate_birth_chart.assert_not_called()
        with patch.dict(os.environ, {'KUNDLI_ALLOW_LEGACY_FALLBACK': '1'}), self.assertRaisesRegex(ValueError, 'Incomplete fallback chart'):
            self.k.calculate_kundli('2000-01-01', '12:00', 'Delhi')

    def test_primary_engine_failure_does_not_silently_substitute_a_chart(self):
        with patch.object(self.k, 'calculate_kundli_pyswisseph', side_effect=ValueError('ephemeris failed')):
            with self.assertRaisesRegex(ValueError, 'no chart was substituted'):
                self.k.calculate_kundli('2000-01-01', '12:00', 'Delhi')
        self.jyotish.calculate_birth_chart.assert_not_called()

    def test_exact_nakshatra_boundary(self):
        self.assertEqual(self.k.get_nakshatra_from_degree(13.3331)[0], "Ashwini")
        self.assertEqual(self.k.get_nakshatra_from_degree(360 / 27)[0], "Bharani")
        self.assertEqual(self.k.calculate_pada(3.3331, 0), 1)

    def test_all_quarter_boundaries_and_neighbors(self):
        for index in range(1, 108):
            boundary = index * (360 / 108)
            for degree, expected in ((math.nextafter(boundary, 0), (index - 1) % 4 + 1),
                                     (boundary, index % 4 + 1),
                                     (math.nextafter(boundary, 360), index % 4 + 1)):
                with self.subTest(index=index, degree=degree):
                    _, start = self.k.get_nakshatra_from_degree(degree)
                    self.assertEqual(self.k.calculate_pada(degree, start), expected)

    def test_all_star_boundaries_and_neighbors(self):
        for index in range(1, 27):
            boundary = index * (360 / 27)
            for degree, expected in ((math.nextafter(boundary, 0), index - 1),
                                     (boundary, index), (math.nextafter(boundary, 360), index)):
                with self.subTest(index=index, degree=degree):
                    self.assertEqual(self.k.get_nakshatra_from_degree(degree)[0],
                                     self.k.NAKSHATRA_RANGES[expected][0])

    def test_invalid_dates_times_and_nonfinite_positions(self):
        for parser in (self.k.parse_date, self.h.parse_date_local):
            self.assertEqual(parser('2000-02-29'), datetime(2000, 2, 29).date())
            for text in ('1900-02-29', '2020-13-01', 'not a date', ''):
                with self.subTest(text=text), self.assertRaises(ValueError):
                    parser(text)
        for parser in (self.k.parse_time, self.h.parse_time_local):
            for text in ('24:00', '13 PM', '-1:30', ''):
                with self.subTest(text=text), self.assertRaises(ValueError):
                    parser(text)
        for degree in (float('nan'), float('inf'), -1, 360):
            with self.assertRaises(ValueError):
                self.k.get_nakshatra_from_degree(degree)

    def test_missing_or_invalid_planet_never_yields_success(self):
        for failed_planet in self.k.PYSWISSEPH_PLANETS.values():
            def bad_position(jd, planet):
                return ((float('nan') if planet == failed_planet else 40, 0, 0, 0, 0, 0), 2)
            self.swe.calc_ut.side_effect = bad_position
            with self.subTest(planet=failed_planet), self.assertRaises(ValueError):
                self.k.calculate_kundli_pyswisseph(datetime(2000, 1, 1), 28, 77)

    def test_invalid_or_prebirth_horoscope_date_is_error(self):
        for date in ('invalid', '2026-02-30', '1990-01-01'):
            result = self.h.generate_daily_horoscope('2000-01-01', '12:00', 'Delhi', date=date)
            self.assertIn('error', result)

    def test_transit_failure_is_not_a_prediction(self):
        with patch.object(self.h, 'get_current_moon_sign', return_value=(None, 0, None)):
            result = self.h.generate_daily_horoscope('2000-01-01', '12:00', 'Delhi')
        self.assertIn('error', result)
        self.assertNotIn('prediction', result)

    def test_default_horoscope_has_no_datetime_scope_error(self):
        result = self.h.generate_daily_horoscope("2000-01-01", "12:00", "Delhi")
        self.assertNotIn("error", result, result)
        self.assertTrue(result["calculated_at_utc"].endswith("Z"))

    def test_requested_date_controls_transits_and_dasha(self):
        requested = datetime(2030, 5, 6, 12)
        with patch.object(self.h, "get_current_moon_sign", return_value=("Aries", 1, "Ashwini")) as transit, \
             patch.object(self.h, "get_current_dasha_info", return_value={"mahadasha": "Venus"}) as dasha:
            result = self.h.generate_daily_horoscope("2000-01-01", "12:00", "Delhi", date="2030-05-06")
        self.assertNotIn("error", result, result)
        transit.assert_called_once_with(requested)
        dasha.assert_called_once_with(datetime(2000, 1, 1, 6, 30), requested)
        self.assertEqual(result["date"], "2030-05-06")

    def test_no_fake_chart_when_birth_calculator_unavailable(self):
        self.h.calculate_kundli = None
        result = self.h.generate_daily_horoscope("2000-01-01", "12:00", "Delhi")
        self.assertIn("error", result)
        self.assertNotIn("lagna", result)

    def test_kundli_cli_error_json_and_exit_code(self):
        output = io.StringIO()
        argv = ["calculate.py", "--dob", "invalid", "--tob", "12:00", "--place", "Delhi"]
        with patch.object(sys, "argv", argv), contextlib.redirect_stdout(output):
            with self.assertRaises(SystemExit) as error:
                runpy.run_path(str(KUNDLI / "calculate.py"), run_name="__main__")
        self.assertEqual(error.exception.code, 1)
        self.assertEqual(json.loads(output.getvalue())["status"], "error")

    def test_horoscope_cli_error_exit_code(self):
        output = io.StringIO()
        argv = ["calculate.py", "--dob", "invalid", "--tob", "12:00", "--place", "Delhi"]
        with patch.object(sys, "argv", argv), contextlib.redirect_stdout(output):
            with self.assertRaises(SystemExit) as error:
                runpy.run_path(str(ROOT / "skills" / "horoscope" / "calculate.py"), run_name="__main__")
        self.assertEqual(error.exception.code, 1)
        self.assertIn("error", json.loads(output.getvalue()))


class PeriodTests(unittest.TestCase):
    def test_all_major_boundaries_over_multiple_cycles(self):
        from vimshottari import ORDER, YEARS
        birth = datetime(1800, 1, 1)
        start = birth
        for index in range(27):
            end = start + timedelta(days=YEARS[index % 9] * 365.25)
            for when, expected in ((start, ORDER[index % 9]),
                                   (end - timedelta(microseconds=1), ORDER[index % 9]),
                                   (end, ORDER[(index + 1) % 9])):
                with self.subTest(index=index, when=when):
                    self.assertEqual(current_period(birth, 0, when)['mahadasha'], expected)
            start = end

    def test_major_period_boundary(self):
        birth = datetime(2000, 1, 1)
        boundary = birth + timedelta(days=7 * 365.25)
        self.assertEqual(current_period(birth, 0, boundary - timedelta(seconds=1))["mahadasha"], "Ketu")
        self.assertEqual(current_period(birth, 0, boundary)["mahadasha"], "Venus")

    def test_balance_at_birth(self):
        birth = datetime(2000, 1, 1)
        boundary = birth + timedelta(days=3.5 * 365.25)
        self.assertEqual(current_period(birth, 360 / 54, boundary)["mahadasha"], "Venus")

    def test_subperiod_boundary(self):
        birth = datetime(2000, 1, 1)
        boundary = birth + timedelta(days=7 * 7 / 120 * 365.25)
        self.assertEqual(current_period(birth, 0, boundary)["antardasha"], "Venus")

    def test_full_cycle(self):
        birth = datetime(2000, 1, 1)
        result = current_period(birth, 0, birth + timedelta(days=120 * 365.25))
        self.assertEqual(result["mahadasha"], "Ketu")
        self.assertEqual(result["antardasha"], "Ketu")

    def test_date_before_birth(self):
        with self.assertRaises(ValueError):
            current_period(datetime(2000, 1, 1), 0, datetime(1999, 1, 1))


if __name__ == "__main__":
    unittest.main()
