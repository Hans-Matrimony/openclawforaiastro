"""Native primary engine checks, separate from pure wire/contract tests."""
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / 'skills/kundli'))
from calculate import calculate_kundli
from timing import render_verified_timing
from timing_rules import validate_timing_result


class PrimaryTimingTests(unittest.TestCase):
    def test_multiple_birth_instants_locations_and_topics_from_one_primary_engine(self):
        at = datetime(2026, 10, 10, 5, tzinfo=timezone.utc)
        cases = [('2002-02-16', '08:19', 28.6139, 77.209, 5.5),
                 ('1990-07-01', '00:00', 13.0827, 80.2707, 5.5),
                 ('1985-12-31', '23:59', 40.7128, -74.006, -5)]
        for dob, tob, lat, lon, offset in cases:
            c = calculate_kundli(dob, tob, 'Synthetic location', latitude=lat, longitude=lon, utc_offset=offset)
            self.assertEqual(c['calculation_source'], 'pyswisseph')
            self.assertEqual(len(c['planet_positions']), 9)
            before = json.dumps(c, sort_keys=True)
            for topic in ('career', 'education', 'finance', 'marriage', 'relationship', 'separation'):
                r = render_verified_timing(c, topic, as_of_utc=at)
                q = {'dob': dob, 'tob': tob, 'place': 'Synthetic location', 'topic': topic,
                     'language': 'english', 'intent': 'overview'}
                self.assertTrue(validate_timing_result(r, q, now=at))
                self.assertLess(len(json.dumps(r).encode()), 128 * 1024)
                self.assertEqual(len(r['evidence']['transits']), 105)
            self.assertEqual(json.dumps(c, sort_keys=True), before, 'Timing mutated the original chart contract')

    def test_bad_birth_date_fails_before_any_forecast(self):
        with self.assertRaises(ValueError):
            calculate_kundli('2002-02-30', '08:19', 'Synthetic location', latitude=28, longitude=77, utc_offset=5.5)


if __name__ == '__main__':
    unittest.main()
