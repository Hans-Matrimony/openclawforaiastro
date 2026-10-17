"""Convention boundaries and isolation; these are calculation tests, not forecasts."""
from datetime import datetime, timedelta
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'skills/kundli'))
from vimshottari import current_period, ORDER, YEARS


class ExplicitDashaProfileTests(unittest.TestCase):
    def test_default_is_unchanged_and_explicit_calls_do_not_leak(self):
        birth = datetime(2000, 1, 1)
        when = birth + timedelta(days=7 * 360)
        default = current_period(birth, 0, when)
        raman = current_period(birth, 0, when, year_days=360)
        self.assertEqual(default['mahadasha'], 'Ketu')
        self.assertEqual(raman['mahadasha'], 'Venus')
        self.assertEqual(current_period(birth, 0, when), default)
        self.assertEqual(current_period(birth, 0, when, year_days=365.25), default)
        self.assertEqual(raman['year_days'], 360)

    def test_major_boundaries_and_cycles_for_both_profiles(self):
        birth = datetime(1800, 1, 1)
        for days in (360, 365.25):
            start = birth
            for index in range(27):
                end = start + timedelta(days=YEARS[index % 9] * days)
                for when, expected in ((start, ORDER[index % 9]),
                                       (end - timedelta(microseconds=1), ORDER[index % 9]),
                                       (end, ORDER[(index + 1) % 9])):
                    with self.subTest(days=days, index=index, when=when):
                        self.assertEqual(current_period(birth, 0, when, year_days=days)['mahadasha'], expected)
                start = end

    def test_minor_boundaries_and_balance_at_birth_for_both_profiles(self):
        birth = datetime(2000, 1, 1)
        for days in (360, 365.25):
            boundary = birth + timedelta(days=7 * 7 / 120 * days)
            self.assertEqual(current_period(birth, 0, boundary - timedelta(microseconds=1), year_days=days)['antardasha'], 'Ketu')
            self.assertEqual(current_period(birth, 0, boundary, year_days=days)['antardasha'], 'Venus')
            partial = birth + timedelta(days=3.5 * days)
            self.assertEqual(current_period(birth, 360 / 54, partial, year_days=days)['mahadasha'], 'Venus')

    def test_unsupported_conventions_fail_without_coercion(self):
        for value in (True, False, '360', 0, 359.9, 365, float('nan'), float('inf')):
            with self.subTest(value=value), self.assertRaises(ValueError):
                current_period(datetime(2000, 1, 1), 0, datetime(2026, 1, 1), year_days=value)


if __name__ == '__main__':
    unittest.main()
