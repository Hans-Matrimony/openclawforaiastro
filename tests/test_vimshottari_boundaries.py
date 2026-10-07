"""Independent star interval and timestamp contract regressions; offline only."""
from datetime import datetime, timezone
import math
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'skills/kundli'))
from vimshottari import current_period, nakshatra_index, ORDER


class StarBoundaryTests(unittest.TestCase):
    def test_all_star_boundaries_neighbors_and_final_longitude(self):
        for index in range(1, 27):
            boundary = index * (360 / 27)
            for degree, expected in ((math.nextafter(boundary, 0), index - 1),
                                     (boundary, index), (math.nextafter(boundary, 360), index)):
                with self.subTest(index=index, degree=degree):
                    self.assertEqual(nakshatra_index(degree), expected)
        self.assertEqual(nakshatra_index(0), 0)
        self.assertEqual(nakshatra_index(math.nextafter(360, 0)), 26)

    def test_each_star_starts_with_its_own_major_and_sub_period(self):
        birth = datetime(2000, 1, 1)
        for index in range(27):
            value = current_period(birth, index * (360 / 27), birth)
            self.assertEqual(value['mahadasha'], ORDER[index % 9])
            self.assertEqual(value['antardasha'], ORDER[index % 9])
            self.assertEqual(value['start'], '2000-01-01T00:00:00Z')

    def test_invalid_longitudes_and_non_utc_instant_contract_fail_closed(self):
        birth = datetime(2000, 1, 1)
        for degree in (True, False, None, '30', -1, 360, float('nan'), float('inf')):
            with self.subTest(degree=degree), self.assertRaises(ValueError):
                current_period(birth, degree, birth)
        for instant in (None, '2000-01-01', birth.replace(tzinfo=timezone.utc)):
            for left, right in ((instant, birth), (birth, instant)):
                with self.assertRaises(ValueError):
                    current_period(left, 0, right)


if __name__ == '__main__':
    unittest.main()
