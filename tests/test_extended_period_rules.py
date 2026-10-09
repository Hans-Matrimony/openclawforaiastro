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


if __name__ == '__main__':
    unittest.main()
