"""Independent reference mappings, boundary tests and topic isolation."""
from copy import deepcopy
import math
from pathlib import Path
import re
import unittest

from test_topic_reading import chart
from advanced_facts import SIGNS, EXALTATION, aspect_houses, dignity, divisional_sign
from reading import reading_packet


class AdvancedTests(unittest.TestCase):
    def test_uccha_component_peaks_symmetry_and_reference_constants(self):
        independent = (10, 33, 298, 165, 95, 357, 200)
        for planet, peak in zip(('Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'), independent):
            self.assertEqual(EXALTATION[planet], peak)
            self.assertEqual(dignity(planet, peak)['uccha_bala_virupas'], 60)
            self.assertEqual(dignity(planet, (peak + 180) % 360)['uccha_bala_virupas'], 0)
            self.assertTrue(dignity(planet, peak)['exaltation_sign'])
            self.assertTrue(dignity(planet, (peak + 180) % 360)['debilitation_sign'])
            self.assertIsNone(dignity(planet, peak)['total_shadbala'])
            for distance in range(1, 180):
                a = dignity(planet, (peak + distance) % 360)['uccha_bala_virupas']
                b = dignity(planet, (peak - distance) % 360)['uccha_bala_virupas']
                self.assertAlmostEqual(a, b)
                self.assertTrue(0 <= a <= 60)
        with self.assertRaises(ValueError):
            dignity('Rahu', 5)

    def test_divisional_mappings_against_all_vedastro_table_cells(self):
        reference = Path(__file__).resolve().parents[3] / 'VedAstro/Library/Logic/Calculate/Vargas.cs'
        if not reference.exists():
            self.skipTest('Upstream source checkout absent')
        source = reference.read_text(encoding='utf-8-sig')
        for division, table in ((9, 'NavamshaTable'), (10, 'DashamamshaTable')):
            block = source.split(table + ' = new()', 1)[1].split('};', 1)[0]
            rows = re.findall(r'\{ ZodiacName\.(\w+), new\(\) \{(.*?)\}\s*\}', block, re.S)
            self.assertEqual(len(rows), 12)
            for sign, content in rows:
                cells = re.findall(r'new DegreeRange\(([^,]+), ([^)]+)\), ZodiacName\.(\w+)', content)
                self.assertEqual(len(cells), division)
                for low, high, expected in cells:
                    # Tables round D9 degree boundaries; interior points test the
                    # intended mapping independently of our rational boundaries.
                    point = SIGNS.index(sign) * 30 + (float(low) + float(high)) / 2
                    self.assertEqual(SIGNS[divisional_sign(point, division)], expected)

    def test_all_division_boundaries_are_half_open(self):
        for division in (9, 10):
            for cell in range(1, 12 * division):
                boundary = cell * (30 / division)
                expected = divisional_sign(boundary, division)
                self.assertEqual(divisional_sign(math.nextafter(boundary, math.inf), division), expected)
                left = divisional_sign(math.nextafter(boundary, -math.inf), division)
                self.assertEqual(left, divisional_sign(boundary - 0.1, division))
                if cell % division:
                    self.assertNotEqual(left, expected)
            self.assertGreaterEqual(divisional_sign(math.nextafter(360, 0), division), 0)
        for value in (360, -1, True, '30', float('nan'), float('inf')):
            with self.assertRaises(ValueError):
                divisional_sign(value, 9)
        with self.assertRaises(ValueError):
            divisional_sign(30, 7)

    def test_full_aspects_all_houses_and_excluded_node_convention(self):
        expected = {'Sun': (7,), 'Moon': (7,), 'Mercury': (7,), 'Venus': (7,),
                    'Mars': (4, 7, 8), 'Jupiter': (5, 7, 9), 'Saturn': (3, 7, 10)}
        for planet, counts in expected.items():
            for house in range(1, 13):
                observed = aspect_houses(planet, house)
                self.assertEqual(tuple((h - house) % 12 + 1 for h in observed), counts)
        for planet, house in (('Rahu', 1), ('Ketu', 1), ('Mars', True), ('Mars', 13)):
            with self.assertRaises(ValueError):
                aspect_houses(planet, house)

    def test_topic_ruler_divisional_house_uses_own_ascendant(self):
        c = chart(7)
        c['lagna_sidereal_degree'] = 7 * 30 + 10
        for topic, target, division in (('marriage', 7, 9), ('career', 10, 10), ('education', 5, 9)):
            facts = reading_packet(c, topic)['advanced']
            self.assertEqual(facts['topic_ruler']['rules_house'], target)
            self.assertEqual(facts['topic_ruler']['division'], division)
            self.assertIsNotNone(facts['topic_ruler']['divisional_house'])
            self.assertFalse(facts['event_timing_available'])
            self.assertFalse(facts['node_aspects_evaluated'])
        without = deepcopy(c)
        without.pop('lagna_sidereal_degree')
        self.assertIsNone(reading_packet(without, 'marriage')['advanced']['topic_ruler']['divisional_house'])
        c['lagna_sidereal_degree'] = 5
        with self.assertRaises(ValueError):
            reading_packet(c, 'marriage')
