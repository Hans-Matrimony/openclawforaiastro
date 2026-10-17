"""Opt-in real ephemeris checks for isolated calculation profiles; no networking."""
from datetime import datetime, timezone
from contextlib import closing
import importlib.util
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'skills/kundli'))


@unittest.skipUnless(os.getenv('ASTRO_REAL_ENGINE_TESTS') == '1', 'opt-in real dependencies required')
class ProfileChartFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('profile_chart_calculate', ROOT / 'skills/kundli/calculate.py')
        cls.calc = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.calc)
        from reading import reading_packet
        cls.reading_packet = staticmethod(reading_packet)

    def chart(self):
        return self.calc.calculate_kundli('1990-06-15', '08:30', 'Synthetic Bengaluru',
                                         latitude=12.9716, longitude=77.5946, utc_offset=5.5)

    def test_profile_cache_and_reading_periods_remain_separate(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {
                'KUNDLI_NATAL_CACHE_PATH':str(Path(directory)/'natal.sqlite'),
                'VEDASTRO_NATIVE_PROFILE_ENVIRONMENT':'development',
                'KUNDLI_ALLOW_LEGACY_FALLBACK':'0'}):
            when = datetime(2026,10,17,12,tzinfo=timezone.utc)
            with patch.object(self.calc,'calculate_kundli_pyswisseph',wraps=self.calc.calculate_kundli_pyswisseph) as compute:
                os.environ['VEDASTRO_NATIVE_PROFILE']='lahiri365_25'
                lahiri=self.chart()
                first=self.reading_packet(lahiri,'marriage',as_of_utc=when,contract_version=2)
                os.environ['VEDASTRO_NATIVE_PROFILE']='raman360'
                raman=self.chart()
                second=self.reading_packet(raman,'marriage',as_of_utc=when,contract_version=2)
                self.assertEqual(second['settings']['ayanamsa'],'RAMAN')
                self.assertEqual(second['settings']['dasha_year_days'],360)
                self.assertEqual(raman['ayanamsa']['name'],'RAMAN')
                self.assertEqual(second['prediction_assessment']['current_period']['antardasha'],'Jupiter')
                self.assertEqual(list(second['current_period']['mahadashas']['Saturn']['antardashas']),['Jupiter'])
                self.assertNotEqual(first['input_fingerprint'],second['input_fingerprint'])
                with self.assertRaises(ValueError):
                    self.reading_packet(lahiri,'marriage',as_of_utc=when,contract_version=2)
                os.environ['VEDASTRO_NATIVE_PROFILE']='lahiri365_25'
                repeat=self.chart()
                self.assertEqual(repeat['planet_positions'],lahiri['planet_positions'])
                self.assertEqual(compute.call_count,2)
            with closing(sqlite3.connect(Path(directory)/'natal.sqlite')) as database:
                self.assertEqual(database.execute('SELECT count(*) FROM natal').fetchone()[0],2)

    def test_nondefault_profile_rejects_legacy_modes_before_resolution(self):
        with patch.dict(os.environ,{'VEDASTRO_NATIVE_PROFILE':'raman360',
                                   'VEDASTRO_NATIVE_PROFILE_ENVIRONMENT':'development',
                                   'KUNDLI_ALLOW_LEGACY_FALLBACK':'0'}), patch.object(self.calc,'get_coordinates') as resolve:
            for options in ({'legacy_full':True},{'include_supplemental':True}):
                with self.assertRaises(ValueError):
                    self.calc.calculate_kundli('1990-06-15','08:30','Synthetic',**options)
            resolve.assert_not_called()

    def test_nondefault_reading_requires_all_explicit_settings(self):
        with patch.dict(os.environ,{'VEDASTRO_NATIVE_PROFILE':'raman360',
                                   'VEDASTRO_NATIVE_PROFILE_ENVIRONMENT':'development',
                                   'KUNDLI_ALLOW_LEGACY_FALLBACK':'0','KUNDLI_NATAL_CACHE_PATH':''}):
            chart=self.chart()
            complete=chart['calculation_settings'].copy()
            for missing in complete:
                with self.subTest(missing=missing), self.assertRaises(ValueError):
                    chart['calculation_settings']={k:v for k,v in complete.items() if k!=missing}
                    self.reading_packet(chart,'marriage',contract_version=2)


if __name__ == '__main__':
    unittest.main()
