"""Coverage, exclusions and legacy isolation for reviewed source-table periods."""
from copy import deepcopy
from datetime import datetime, timezone, timedelta
import os
from unittest.mock import patch
import unittest

from test_topic_reading import chart
from test_prediction_assessment import reference_chart
from period_rules import RULES, LEGACY_VENUS, period_status, marriage_rule
from reading import reading_packet
from render_outcome_reading import render_reading
from vimshottari import ORDER, YEARS


def period_chart(major, minor):
    value = chart()
    moon = next(p for p in value['planet_positions'] if p['name'] == 'Moon')
    degree = ORDER.index(major) * (360 / 27) + 0.01
    from reading import SIGNS, NAKSHATRAS
    moon.update(sidereal_degree=degree, sign=SIGNS[int(degree // 30)], house=int(degree // 30) + 1)
    value.update(moon_sign=moon['sign'], nakshatra=NAKSHATRAS[ORDER.index(major)])
    birth = datetime(1980, 1, 1)
    value['user_input'].update(dob='1980-01-01', tob='05:30', birth_utc=birth.isoformat() + 'Z')
    index = ORDER.index(major)
    offset = (ORDER.index(minor) - index) % 9
    days = sum(YEARS[index] * YEARS[(index+i) % 9] / 120 * 365.25 for i in range(offset))
    when = birth + timedelta(days=120 * 365.25 + days + 2)
    return value, when.replace(tzinfo=timezone.utc)


class ExtendedPeriodTests(unittest.TestCase):
    def test_only_explicit_personal_marriage_entries_are_admitted(self):
        expected = {'SunVenusPD2', 'MoonMoonPD2', 'MarsMercuryPD2', 'RahuVenusPD2',
                    'MercuryJupiterPD2', 'KetuJupiterPD2', 'VenusMarsPD2', 'VenusJupiterPD2'}
        self.assertEqual({key for key,row in RULES.items() if row['marriage_event']}, expected)
        for major, minor in [('Rahu','Jupiter'), ('Jupiter','Moon'), ('Moon','Venus'), ('Mercury','Venus')]:
            self.assertFalse(marriage_rule(major, minor, extended=True))
        self.assertEqual(len(RULES), 81)

    def test_all_81_periods_render_four_topics_in_both_languages(self):
        with patch.dict(os.environ, ASTROFRIEND_EXTENDED_PERIOD_RULES='1'):
            for major in ORDER:
                for minor in ORDER:
                    value, when = period_chart(major, minor)
                    for topic in ('marriage','career','education','finance'):
                        for language in ('english','hinglish'):
                            result = render_reading(value, topic, as_of_utc=when, language=language)
                            period = result['evidence']['prediction_assessment']['current_period']
                            self.assertEqual((period['mahadasha'], period['antardasha']), (major,minor))
                            self.assertEqual(period['status'], period_status(major,minor,topic,extended=True))
                            self.assertEqual(result['model_calls'], 0)
                            self.assertTrue(result['text'].strip())
                            self.assertNotIn('will definitely', result['text'])
                            if topic == 'marriage':
                                meanings = {'Good': 'supportive', 'Bad': 'challenging', 'Neutral': 'neutral'}
                                ratings = RULES[major + minor + 'PD2']['ratings']
                                family, relationship = meanings[ratings['Family']], meanings[ratings['Love']]
                                if family == relationship:
                                    expected = (f'family and relationship indications are {family}' if language == 'english' else
                                                f'family aur relationship ke sanket {family} hain')
                                else:
                                    expected = (f'family indications are {family}, while relationship indications are {relationship}'
                                                if language == 'english' else
                                                f'family ke sanket {family} hain, jabki relationship ke sanket {relationship} hain')
                                self.assertIn(expected, result['text'])

    def test_legacy_contract_and_default_flag_are_unchanged(self):
        when = datetime(2026,10,8,tzinfo=timezone.utc)
        with patch.dict(os.environ, ASTROFRIEND_EXTENDED_PERIOD_RULES='0'):
            old = reading_packet(reference_chart(),'marriage',as_of_utc=when,contract_version=1)
            v2 = reading_packet(reference_chart(),'marriage',as_of_utc=when,contract_version=2)
        with patch.dict(os.environ, ASTROFRIEND_EXTENDED_PERIOD_RULES='1'):
            self.assertEqual(old, reading_packet(reference_chart(),'marriage',as_of_utc=when,contract_version=1))
        self.assertEqual(v2['rules_revision'], 'reviewed-outcomes-v2')
        for minor, topics in LEGACY_VENUS.items():
            for topic, status in topics.items():
                self.assertEqual(period_status('Venus',minor,topic), status)

    def test_new_marriage_candidates_respect_uncertain_birth_and_other_topics(self):
        value, when = period_chart('Mercury','Jupiter')
        with patch.dict(os.environ, ASTROFRIEND_EXTENDED_PERIOD_RULES='1'):
            result = reading_packet(value,'marriage',as_of_utc=when,contract_version=2)
            self.assertTrue(any(w['rule_id']=='MercuryJupiterPD2' for w in result['prediction_assessment']['event']['windows']))
            for topic in ('career','education','finance'):
                self.assertEqual(reading_packet(value,topic,as_of_utc=when,contract_version=2)['prediction_assessment']['event']['windows'], [])
            value['summary'] = {'warnings':['Moon is near a boundary']}
            event = reading_packet(value,'marriage',as_of_utc=when,contract_version=2)['prediction_assessment']['event']
            self.assertEqual(event['status'],'uncertain_birth')
            self.assertEqual(event['windows'], [])

    def test_non_venus_career_rating_is_not_inferred_from_money(self):
        for major in ORDER:
            if major != 'Venus':
                for minor in ORDER:
                    self.assertEqual(period_status(major,minor,'career',extended=True), 'limited')
        self.assertIsNone(period_status('Sun','Venus','health',extended=True))

    def test_marriage_family_and_relationship_scope_stays_separate_for_all_periods(self):
        meanings = {'Good': 'supportive', 'Bad': 'challenging',
                    'Neutral': 'neutral (no clear supportive or adverse indication)'}
        with patch.dict(os.environ, ASTROFRIEND_EXTENDED_PERIOD_RULES='1'):
            for major in ORDER:
                for minor in ORDER:
                    value, when = period_chart(major, minor)
                    packet = reading_packet(value, 'marriage', as_of_utc=when, contract_version=2)
                    ratings = RULES[major + minor + 'PD2']['ratings']
                    scope = next(note for note in packet['limits'] if note.startswith('Current-period family indications'))
                    self.assertIn('family indications are ' + meanings[ratings['Family']], scope)
                    self.assertIn('relationship indications are ' + meanings[ratings['Love']], scope)
                    self.assertIn('not relationship-only verdicts', scope)
                    self.assertEqual(packet['prediction_assessment']['current_period']['status'],
                                     period_status(major, minor, 'marriage', extended=True))

    def test_scope_guidance_does_not_restore_uncertain_or_legacy_period_interpretations(self):
        value, when = period_chart('Mercury', 'Saturn')
        with patch.dict(os.environ, ASTROFRIEND_EXTENDED_PERIOD_RULES='1'):
            v2 = reading_packet(value, 'marriage', as_of_utc=when, contract_version=2)
            scope = next(note for note in v2['limits'] if note.startswith('Current-period family indications'))
            self.assertIn('family indications are challenging', scope)
            self.assertIn('relationship indications are neutral', scope)
            legacy = reading_packet(value, 'marriage', as_of_utc=when, contract_version=1)
            self.assertFalse(any(note.startswith('Current-period family indications') for note in legacy['limits']))
            self.assertFalse(any('overview need not' in note for note in legacy['limits']))
            value['summary'] = {'warnings': ['Moon is near a boundary']}
            uncertain = reading_packet(value, 'marriage', as_of_utc=when, contract_version=2)
            self.assertEqual(uncertain['prediction_assessment']['current_period']['status'], 'unsupported')
            self.assertFalse(any(note.startswith('Current-period family indications') for note in uncertain['limits']))
        with patch.dict(os.environ, ASTROFRIEND_EXTENDED_PERIOD_RULES='0'):
            disabled = reading_packet(value, 'marriage', as_of_utc=when, contract_version=2)
            self.assertFalse(any(note.startswith('Current-period family indications') for note in disabled['limits']))

    def test_rendered_marriage_periods_do_not_conflate_family_and_relationship(self):
        examples = (
            ('Mercury', 'Saturn', 'family indications are challenging, while relationship indications are neutral',
             'family ke sanket challenging hain, jabki relationship ke sanket neutral hain'),
            ('Venus', 'Moon', 'family indications are supportive, while relationship indications are challenging',
             'family ke sanket supportive hain, jabki relationship ke sanket challenging hain'),
        )
        with patch.dict(os.environ, ASTROFRIEND_EXTENDED_PERIOD_RULES='1'):
            for major, minor, english, hinglish in examples:
                value, when = period_chart(major, minor)
                for language, expected in (('english', english), ('hinglish', hinglish)):
                    result = render_reading(value, 'marriage', as_of_utc=when, language=language)
                    self.assertIn(expected, result['text'])
                    self.assertNotIn('relationship outlook is mixed', result['text'])
                    self.assertNotIn('Relationship ka outlook mixed', result['text'])
                    self.assertEqual(result['evidence'], reading_packet(value, 'marriage', as_of_utc=when, contract_version=2))
                value['summary'] = {'warnings': ['Moon is near a boundary']}
                uncertain = render_reading(value, 'marriage', as_of_utc=when)
                self.assertNotIn(english, uncertain['text'])
                self.assertEqual(uncertain['evidence']['prediction_assessment']['current_period']['status'], 'unsupported')

    def test_brief_marriage_overview_keeps_the_actual_planets_signs_and_houses(self):
        value = reference_chart()
        when = datetime(2026, 10, 12, tzinfo=timezone.utc)
        with patch.dict(os.environ, ASTROFRIEND_EXTENDED_PERIOD_RULES='1'):
            for language, names in (('english', ('Saturn', 'Jupiter', 'Taurus', 'house 7')),
                                    ('hinglish', ('Shani', 'Guru', 'Vrishabh', 'saatve ghar'))):
                result = render_reading(value, 'marriage', as_of_utc=when,
                                        language=language, style='brief', follow_up=False)
                for name in names:
                    self.assertIn(name, result['text'])
                self.assertEqual(result['evidence'], reading_packet(value, 'marriage', as_of_utc=when, contract_version=2))
                self.assertNotIn('2031', result['text'])
                self.assertFalse(result['follow_up'])


if __name__ == '__main__':
    unittest.main()
