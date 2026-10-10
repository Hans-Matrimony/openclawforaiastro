from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
import math
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / 'skills/kundli'))
from timing_periods import periods, scan_dates
from timing_rules import (validate_timing_result, assess_timing, render_timing, separation_natal, positions_from,
                          strengths, navamsa, evidence_digest, request_fingerprint)
from vimshottari import current_period

ROWS = json.loads((Path(__file__).parent / 'fixtures/timing_wire.json').read_text())
NOW = datetime(2026, 10, 10, 5, 0, tzinfo=timezone.utc)


class TimingTests(unittest.TestCase):
    def test_primary_wire_all_topics_languages_intents_and_no_promise(self):
        for row in ROWS:
            for lang in ('english', 'hinglish'):
                for intent in ('overview', 'timing', 'detail', 'brief'):
                    q = {**row['request'], 'language': lang, 'intent': intent}
                    r = deepcopy(row['result'])
                    r.update(language=lang, intent=intent, request_fingerprint=request_fingerprint(q),
                             text=render_timing(r['assessment'], q['topic'], lang, intent))
                    self.assertTrue(validate_timing_result(r, q, now=NOW), (q, r['text']))
                    self.assertNotIn('?', r['text'])
                    self.assertNotIn('guaranteed to', r['text'])
        row = next(r for r in ROWS if r['request']['topic'] == 'relationship')
        self.assertIn('cannot establish their decision', render_timing(row['result']['assessment'], 'relationship', 'english', 'contact'))
        with self.assertRaises(ValueError):
            render_timing(row['result']['assessment'], 'career', 'english', 'contact')

    def test_periods_match_existing_convention_and_half_open_boundaries(self):
        birth = datetime(2000, 1, 1, tzinfo=timezone.utc)
        for moon in (0, 13.333333333333334, 100, 250, 359.999999):
            for year in (2000, 2001, 2026, 2121, 2240):
                at = datetime(year, 1, 1, tzinfo=timezone.utc)
                new = periods(birth, moon, at)
                old = current_period(birth.replace(tzinfo=None), moon, at.replace(tzinfo=None))
                self.assertEqual(new['md']['planet'], old['mahadasha'])
                self.assertEqual(new['ad']['planet'], old['antardasha'])
                for level in ('md', 'ad', 'pd'):
                    start = datetime.fromisoformat(new[level]['start'])
                    end = datetime.fromisoformat(new[level]['end'])
                    self.assertLessEqual(start, at)
                    self.assertLess(at, end)
                    self.assertNotEqual(periods(birth, moon, end)[level]['start'], new[level]['start'])
        for moon in (False, float('nan'), -1, 360):
            with self.assertRaises(ValueError):
                periods(birth, moon, NOW)

    def test_navamsa_exaltation_debility_combustion_and_retrograde(self):
        for index in range(108):
            self.assertEqual(navamsa(index * 360 / 108 + 1e-8), index % 12)
        natal = deepcopy(ROWS[0]['result']['evidence']['natal'])
        natal['Sun']['longitude'] = 10
        natal['Mars']['longitude'] = 298
        natal['Jupiter']['longitude'] = 275
        natal['Venus'] = {'longitude': 18.5, 'speed': 1}
        s = strengths(natal)
        self.assertEqual(s['Sun']['uchcha_virupas'], 60)
        self.assertEqual(s['Mars']['dignity'], 'exalted')
        self.assertEqual(s['Jupiter']['uchcha_virupas'], 0)
        self.assertTrue(s['Venus']['combust'])
        natal['Venus']['speed'] = -1
        self.assertFalse(strengths(natal)['Venus']['combust'])
        self.assertTrue(strengths(natal)['Venus']['retrograde'])
        self.assertNotIn('Rahu', s)

    def test_tampering_birth_staleness_nonfinite_unknown_fields_and_truncated_scan(self):
        row = ROWS[0]
        q, original = row['request'], row['result']
        mutations = [
            lambda r: r.update(text=r['text'] + ' Your girlfriend will reply tomorrow.'),
            lambda r: r.update(model_calls=False),
            lambda r: r['assessment'].update(windows=[{'month': '2027-01', 'kind': 'aligned'}]),
            lambda r: r['evidence']['transits'].pop(),
            lambda r: r['evidence']['transits'][0].update(at='2026-10-11T05:00:00+00:00'),
            lambda r: r['evidence']['natal']['Moon'].update(longitude=float('nan')),
            lambda r: r['evidence']['settings'].update(node='mean'),
            lambda r: r['evidence']['birth'].update(birth_utc='2002-02-17T02:49:00Z'),
            lambda r: r['evidence'].update(extra='unapproved'),
            lambda r: r['assessment']['strengths']['Jupiter'].update(dignity='exalted'),
        ]
        for mutate in mutations:
            r = deepcopy(original)
            mutate(r)
            self.assertFalse(validate_timing_result(r, q, now=NOW))
        for key in ('dob', 'tob', 'place', 'topic', 'intent', 'language'):
            self.assertFalse(validate_timing_result(original, {**q, key: 'changed'}, now=NOW))
        for delta in (-31, 121):
            self.assertFalse(validate_timing_result(original, q, now=NOW + timedelta(seconds=delta)))

    def test_sparse_observations_and_separation_no_false_deadline(self):
        for row in ROWS:
            a = row['result']['assessment']
            for window in a['windows']:
                self.assertGreaterEqual(len(window['observations']), 2)
                self.assertNotIn('start', window)
                self.assertNotIn('probability', window)
            self.assertEqual(a['sampling_days'], 7)
            self.assertEqual(a['shadbala'], 'not_computed')
        sep = ROWS[-1]['result']
        if sep['assessment']['natal']['status'] != 'separation_indication':
            self.assertEqual(sep['assessment']['windows'], [])
        self.assertIn('court divorce deadline', render_timing(sep['assessment'], 'separation', 'english', 'timing'))
        self.assertEqual(len(scan_dates(NOW)), 105)

    def test_no_support_is_not_impossibility_and_months_are_conditional(self):
        for row in ROWS:
            a = row['result']['assessment']
            text = render_timing(a, row['request']['topic'], 'english', 'timing')
            if any(w['kind'] == 'aligned' for w in a['windows']):
                self.assertIn('not guaranteed event dates', text)
            else:
                self.assertIn('does not exclude', text)

    def test_moon_and_mercury_conditions_resolve_separation_without_generic_marriage_rule(self):
        natal = deepcopy(ROWS[0]['result']['evidence']['natal'])
        # Aries ascendant: Mars in Libra7, Jupiter/Venus in Taurus2 (no seventh
        # aspect protection); Moon in Libra7 is waxing or waning by Sun position.
        for planet, lon in {'Mars': 195, 'Moon': 200, 'Sun': 100, 'Mercury': 45,
                            'Jupiter': 50, 'Venus': 55, 'Saturn': 35, 'Rahu': 75, 'Ketu': 255}.items():
            natal[planet]['longitude'] = lon
        lagna, pos = positions_from(10, natal)
        a = separation_natal(lagna, pos, natal)
        self.assertTrue(a['benefic_conditions']['moon_waxing'])
        self.assertNotIn('MarsIn7thNoBenefics', [r['id'] for r in a['matched']])
        natal['Sun']['longitude'] = 250
        lagna, pos = positions_from(10, natal)
        a = separation_natal(lagna, pos, natal)
        self.assertFalse(a['benefic_conditions']['moon_waxing'])
        self.assertIn('MarsIn7thNoBenefics', [r['id'] for r in a['matched']])
        self.assertEqual(a['unevaluated'], [])


if __name__ == '__main__':
    unittest.main()
