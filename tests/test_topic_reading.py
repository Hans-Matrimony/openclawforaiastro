"""Offline contracts for source conditions, chart isolation and compact readings."""
from copy import deepcopy
import math
from datetime import datetime, timezone, timedelta
from pathlib import Path
import sys
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'skills/kundli'))
import reading


def chart(asc=0, owner=None, house=1):
    positions = []
    for i, name in enumerate(sorted(reading.PLANETS)):
        sign_index = (asc + (house - 1 if name == owner else i)) % 12
        positions.append({'name': name, 'sign': reading.SIGNS[sign_index],
                          'house': (sign_index - asc) % 12 + 1, 'sidereal_degree': sign_index * 30 + 10})
    rahu = next(p for p in positions if p['name'] == 'Rahu')
    ketu = next(p for p in positions if p['name'] == 'Ketu')
    sign_index = (reading.SIGNS.index(rahu['sign']) + 6) % 12
    ketu.update(sign=reading.SIGNS[sign_index], house=(sign_index - asc) % 12 + 1,
                sidereal_degree=(rahu['sidereal_degree'] + 180) % 360)
    moon = next(p for p in positions if p['name'] == 'Moon')
    return {'calculation_source': 'pyswisseph', 'lagna': reading.SIGNS[asc],
            'moon_sign': next(p['sign'] for p in positions if p['name'] == 'Moon'),
            'nakshatra': reading.NAKSHATRAS[int(moon['sidereal_degree'] / (360 / 27))], 'planet_positions': positions,
            'user_input': {'birth_utc': '2002-02-16T02:49:00Z', 'dob': '2002-02-16', 'tob': '08:19', 'coordinates': {'lat': 28.6139, 'lon': 77.209}, 'timezone_offset': 5.5},
            'dashas': {'current': {'mahadashas': {'Ketu': {'end': '2028-12-04T21:04:58Z'}}}}}


class ReadingTests(unittest.TestCase):
    def test_moon_star_boundaries_and_neighbors_match_calculator_contract(self):
        # Independent interval enumeration catches division rounding just below
        # the Anuradha/Jyeshtha boundary (226.66666666666666 degrees).
        boundaries = [i * (360 / 27) for i in range(27)]
        for index in range(1, 27):
            for degree, expected in ((math.nextafter(boundaries[index], 0), index - 1),
                                     (boundaries[index], index),
                                     (math.nextafter(boundaries[index], 360), index)):
                c = chart()
                moon = next(p for p in c['planet_positions'] if p['name'] == 'Moon')
                sign = int(degree // 30)
                moon.update(sign=reading.SIGNS[sign], house=sign + 1, sidereal_degree=degree)
                c.update(moon_sign=moon['sign'], nakshatra=reading.NAKSHATRAS[expected])
                with self.subTest(index=index, degree=degree):
                    packet = reading.reading_packet(c, 'education')
                    self.assertEqual(packet['chart_facts']['nakshatra'], reading.NAKSHATRAS[expected])

    def test_every_reviewed_condition_matches_independently_for_all_ascendants(self):
        seen = set()
        for rule in reading.RULES:
            for asc in range(12):
                owner = reading.LORDS[(asc + rule['ruler_of'] - 1) % 12] if 'ruler_of' in rule else rule['planet']
                for house in range(1, 13):
                    c = chart(asc, owner, house)
                    for topic in rule['topics']:
                        packet = reading.reading_packet(c, topic)
                        # Other valid rules may fill the bounded packet first;
                        # whenever a reviewed rule is emitted its condition must hold.
                        for factor in packet['factors']:
                            seen.add(factor['id'])
                            if factor['id'] == rule['id']:
                                self.assertEqual(house, rule['house'])
                                self.assertEqual(factor['fact']['planet'], owner)
                        self.assertLessEqual(len(packet['factors']), 3)
        self.assertTrue({r['id'] for r in reading.RULES} <= seen)

    def test_supported_primary_career_meaning_is_retained(self):
        # Capricorn's tenth lord Venus in house four reproduces the important
        # learning/land/property interpretation, rather than generic reassurance.
        packet = reading.reading_packet(chart(9, 'Venus', 4), 'career')
        self.assertEqual(packet['factors'][0]['id'], 'House10LordInHouse4')
        self.assertIn('property', packet['factors'][0]['traditional_theme'])

    def test_fallback_is_explicitly_local_symbolism(self):
        packet = reading.reading_packet(chart(0, 'Venus', 11), 'marriage')
        self.assertEqual(packet['factors'][0]['source'], 'local_house_symbolism')
        self.assertEqual(packet['factors'][0]['fact']['rules_house'], 7)
        self.assertIn('groups', packet['factors'][0]['traditional_theme'])

    def test_corrections_change_fingerprint_and_repeat_does_not(self):
        c = chart()
        first = reading.reading_packet(c, 'career')['input_fingerprint']
        self.assertEqual(first, reading.reading_packet(c, 'career')['input_fingerprint'])
        for field, value in [('dob', '2002-02-17'), ('tob', '09:19'), ('timezone_offset', 6)]:
            changed = deepcopy(c)
            changed['user_input'][field] = value
            self.assertNotEqual(first, reading.reading_packet(changed, 'career')['input_fingerprint'])
        changed = deepcopy(c)
        changed['calculation_settings'] = {'node': 'mean'}
        mean = reading.reading_packet(changed, 'career')
        self.assertEqual(mean['settings']['node'], 'mean')
        self.assertNotEqual(first, mean['input_fingerprint'])

    def test_conflicting_duplicate_missing_and_nonfinite_chart_is_rejected(self):
        for kind in ('source', 'missing', 'duplicate', 'sign', 'house', 'degree', 'boolean', 'moon_summary'):
            c = chart()
            if kind == 'source': c['calculation_source'] = 'jyotishganit'
            if kind == 'missing': c['planet_positions'].pop()
            if kind == 'duplicate': c['planet_positions'][1] = c['planet_positions'][0]
            if kind == 'sign': c['planet_positions'][0]['sign'] = 'Pisces'
            if kind == 'house': c['planet_positions'][0]['house'] = 12
            if kind == 'degree': c['planet_positions'][0]['sidereal_degree'] = float('nan')
            if kind == 'boolean': c['planet_positions'][0]['house'] = True
            if kind == 'moon_summary': c['moon_sign'] = 'not-the-calculated-Moon'
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                reading.reading_packet(c, 'career')

    def test_packet_has_boundaries_and_limits_but_no_forecast_or_tool_instruction(self):
        packet = reading.reading_packet(chart(), 'marriage')
        self.assertIn('mahadashas', packet['current_period'])
        self.assertTrue(any('not marriage' in s for s in packet['limits']))
        for key in ('probability', 'event_date', 'instructions_for_ai', 'ai_summary', 'planet_positions'):
            self.assertNotIn(key, packet)
        with self.assertRaises(ValueError): reading.reading_packet(chart(), 'health')

    def test_stale_period_is_refreshed_at_exact_boundary(self):
        c = chart()
        when = datetime(2026, 1, 1, tzinfo=timezone.utc)
        first = reading.reading_packet(c, 'career', as_of_utc=when)
        major = next(iter(first['current_period']['mahadashas'].values()))
        sub_name, sub = next(iter(major['antardashas'].items()))
        boundary = datetime.fromisoformat(sub['end'].replace('Z', '+00:00'))
        before = reading.reading_packet(c, 'career', as_of_utc=boundary - timedelta(microseconds=1))
        after = reading.reading_packet(c, 'career', as_of_utc=boundary)
        self.assertEqual(before['current_period'], first['current_period'])
        self.assertNotEqual(after['current_period'], first['current_period'])
        self.assertEqual(after['input_fingerprint'], first['input_fingerprint'])

    def test_malformed_inputs_and_unsupported_settings_fail_closed(self):
        for key, value in [('nakshatra', 'wrong'), ('calculation_settings', []),
                           ('calculation_settings', {'dasha_year_days': 360}), ('user_input', None)]:
            c = chart()
            c[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                reading.reading_packet(c, 'career')
        for value in (float('nan'), float('inf'), True, '28'):
            c = chart()
            c['user_input']['coordinates']['lat'] = value
            with self.subTest(value=value), self.assertRaises(ValueError):
                reading.reading_packet(c, 'career')
        with self.assertRaises(ValueError):
            reading.reading_packet(None, 'career')

    def test_reviewed_ids_exist_in_reference_when_checkout_is_available(self):
        reference = ROOT.parent / 'VedAstro/Library/XMLData/HoroscopeDataList.xml'
        if not reference.exists():
            reference = ROOT.parent.parent / 'VedAstro/Library/XMLData/HoroscopeDataList.xml'
        if not reference.exists(): self.skipTest('Optional upstream source checkout absent')
        names = {node.text for node in ET.parse(reference).findall('.//Name')}
        self.assertTrue({r['id'] for r in reading.RULES} <= names)


if __name__ == '__main__': unittest.main()
