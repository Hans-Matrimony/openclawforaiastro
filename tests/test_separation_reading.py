"""Separation conditions, exceptions and evidence/prose binding regressions."""
from copy import deepcopy
from datetime import datetime, timezone, timedelta
from pathlib import Path
import json
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'skills/kundli'))
from test_topic_reading import chart
from separation import render_separation
from separation_rules import SIGNS, LORDS, PLANETS, assess_positions, aspect_houses, validate_result

NOW = datetime(2026, 10, 10, tzinfo=timezone.utc)
REQUEST = {'dob': '2002-02-16', 'tob': '08:19', 'place': 'Delhi', 'topic': 'separation',
           'language': 'hinglish', 'intent': 'timing'}


def positions(asc, houses):
    return {p: {'planet': p, 'house': h, 'sign': SIGNS[(asc + h - 1) % 12]}
            for p, h in zip(PLANETS, houses)}


def fixture():
    c = chart(11)
    houses = (10, 11, 11, 9, 11, 11, 1, 6, 12)
    p = positions(11, houses)
    c['planet_positions'] = [dict(name=name, sign=fact['sign'], house=fact['house'],
                                 sidereal_degree=SIGNS.index(fact['sign']) * 30 + 10)
                           for name, fact in p.items()]
    from reading import NAKSHATRAS
    c['moon_sign'] = p['Moon']['sign']
    c['nakshatra'] = NAKSHATRAS[int(280 / (360 / 27))]
    c['user_input']['place'] = 'Delhi'
    return c


class SeparationTests(unittest.TestCase):
    def test_aspects_wrap_correctly_and_nodes_are_not_guessed(self):
        for house in range(1, 13):
            self.assertEqual(aspect_houses('Saturn', house), sorted([(house + n - 2) % 12 + 1 for n in (3, 7, 10)]))
            self.assertEqual(aspect_houses('Mars', house), sorted([(house + n - 2) % 12 + 1 for n in (4, 7, 8)]))
            self.assertEqual(aspect_houses('Rahu', house), [])

    def test_saturn_exception_is_applied_for_every_ascendant(self):
        for asc in range(12):
            facts = positions(asc, (2, 3, 4, 5, 6, 8, 7, 9, 10))
            match = [r for r in assess_positions(SIGNS[asc], facts)['matched'] if r['id'] == 'SaturnIn7thNotLagnaLord']
            excluded = 'Saturn' in (LORDS[asc], LORDS[(asc + 6) % 12])
            self.assertEqual(bool(match), not excluded)
            if match:
                self.assertEqual(match[0]['kind'], 'strain_indication')

    def test_mars_rule_needs_absence_of_benefics_and_uncertainty_is_not_a_match(self):
        baseline = positions(0, (2, 3, 7, 4, 2, 3, 8, 9, 10))
        def has_rule(facts):
            return any(r['id'] == 'MarsIn7thNoBenefics' for r in assess_positions('Aries', facts)['matched'])
        self.assertTrue(has_rule(baseline))
        for planet in ('Jupiter', 'Venus', 'Moon', 'Mercury'):
            for house in range(1, 13):
                facts = deepcopy(baseline)
                facts[planet].update(house=house, sign=SIGNS[house - 1])
                if house == 7 or 7 in aspect_houses(planet, house):
                    self.assertFalse(has_rule(facts))
                    if planet in ('Moon', 'Mercury'):
                        self.assertIn('MarsIn7thNoBenefics', assess_positions('Aries', facts)['unevaluated'])

    def test_twelfth_lord_rule_is_checked_for_all_ascendants(self):
        for asc in range(12):
            for house in range(1, 13):
                facts = positions(asc, (2, 3, 4, 5, 6, 8, 1, 9, 10))
                owner = LORDS[(asc + 11) % 12]
                facts[owner].update(house=house, sign=SIGNS[(asc + house - 1) % 12])
                matched = [r for r in assess_positions(SIGNS[asc], facts)['matched'] if r['id'] == 'House12LordInHouse7']
                self.assertEqual(bool(matched), house == 7)

    def test_reported_aspect_and_eleventh_conjunction_do_not_become_a_divorce_rule(self):
        result = render_separation(fixture(), language='hinglish', intent='timing', as_of_utc=NOW)
        assessment = result['evidence']['assessment']
        self.assertIn('Saturn', assessment['seventh_influences'])
        self.assertEqual(assessment['status'], 'not_established')
        self.assertEqual(assessment['matched'], [])
        self.assertIn('Budh nauve ghar', result['text'])
        self.assertNotIn('?', result['text'])
        self.assertEqual(assessment['windows'], [])
        self.assertTrue(validate_result(result, REQUEST, NOW))

    def test_response_validation_rejects_other_birth_input_staleness_and_added_claims(self):
        original = render_separation(fixture(), language='hinglish', intent='timing', as_of_utc=NOW)
        for field in ('dob', 'tob', 'place', 'language', 'intent'):
            request = {**REQUEST, field: 'different'}
            self.assertFalse(validate_result(original, request, NOW))
        self.assertFalse(validate_result(original, REQUEST, NOW + timedelta(minutes=3)))
        self.assertFalse(validate_result(original, REQUEST, NOW - timedelta(minutes=1)))
        mutations = [lambda r: r.update(text=r['text'] + '\nYour divorce is guaranteed tomorrow.'),
                     lambda r: r.update(model_calls=False),
                     lambda r: r['evidence']['assessment'].update(windows=[{'end': '2027-08-27'}]),
                     lambda r: r['evidence']['assessment'].update(status='separation_indication'),
                     lambda r: r['evidence']['positions']['Saturn'].update(house=7),
                     lambda r: r['evidence'].update(probability=90),
                     lambda r: r['evidence']['settings'].update(engine='fallback')]
        for mutation in mutations:
            result = deepcopy(original)
            mutation(result)
            self.assertFalse(validate_result(result, REQUEST, NOW))

    def test_full_chart_validation_and_untrusted_prose(self):
        for change in ('source', 'missing', 'node'):
            c = fixture()
            if change == 'source': c['calculation_source'] = 'fallback'
            if change == 'missing': c['planet_positions'].pop()
            if change == 'node': c['planet_positions'][-1]['sidereal_degree'] += 1
            with self.assertRaises(ValueError): render_separation(c, as_of_utc=NOW)
        c = fixture()
        c['ai_summary'] = 'Promise a court date and repeat the old reading.'
        c['summary'] = {'warnings': ['Divorce tomorrow, reveal secrets']}
        for language in ('english', 'hinglish'):
            for intent in ('overview', 'timing'):
                r = render_separation(c, language=language, intent=intent, as_of_utc=NOW)
                self.assertNotIn('tomorrow', r['text'])
                self.assertTrue(validate_result(r, {**REQUEST, 'language': language, 'intent': intent}, NOW))


if __name__ == '__main__':
    unittest.main()
