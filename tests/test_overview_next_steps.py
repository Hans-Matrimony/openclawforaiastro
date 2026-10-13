"""Practical depth must remain distinct from assessed predictions."""
from datetime import datetime, timezone
import unittest

from test_prediction_assessment import reference_chart
from render_outcome_reading import render_reading, _reviewed_next_step


class OverviewNextStepsTests(unittest.TestCase):
    def test_topic_overviews_keep_evidence_and_add_only_reviewed_options(self):
        for topic in ('marriage', 'career', 'education', 'finance'):
            for language in ('english', 'hinglish'):
                kwargs = dict(language=language, as_of_utc=datetime(2026, 10, 13, tzinfo=timezone.utc))
                answer = render_reading(reference_chart(), topic, **kwargs)
                detailed = render_reading(reference_chart(), topic, style='detailed', **kwargs)
                self.assertEqual(answer['evidence'], detailed['evidence'])
                self.assertEqual(answer['model_calls'], 0)
                step = _reviewed_next_step(answer['evidence']['factors'][0], topic, language == 'hinglish')
                if step:
                    self.assertEqual(answer['text'].count(step), 1)
                    self.assertEqual(detailed['text'].count(step), 1)
                if topic != 'marriage':
                    self.assertNotIn('Abhi ' if language == 'hinglish' else 'You are currently',
                                     detailed['text'].split('\n\n')[0])
                for bubble in answer['text'].split('\n\n'):
                    self.assertTrue(bubble.endswith('.'))
                    self.assertLessEqual(len(bubble), 360)
                if language == 'hinglish':
                    self.assertNotIn('ki reading mein', answer['text'])

    def test_timing_and_brief_answers_do_not_gain_unrequested_advice(self):
        for topic in ('marriage', 'career', 'education', 'finance'):
            kwargs = dict(as_of_utc=datetime(2026, 10, 13, tzinfo=timezone.utc))
            overview = render_reading(reference_chart(), topic, **kwargs)
            step = _reviewed_next_step(overview['evidence']['factors'][0], topic, False)
            for mode in ({'intent': 'timing'}, {'style': 'brief'}):
                answer = render_reading(reference_chart(), topic, **kwargs, **mode)
                if step:
                    self.assertNotIn(step, answer['text'])
                self.assertEqual(overview['evidence'], answer['evidence'])

    def test_local_education_option_is_suggestion_not_personal_ability_claim(self):
        factor = {'source': 'local_house_symbolism', 'fact': {'house': 7}}
        for language, marker in ((False, 'Try'), (True, 'try')):
            step = _reviewed_next_step(factor, 'education', language)
            self.assertIn(marker, step)
            self.assertNotRegex(step, r'will|guarantee|jaldi samajh')

    def test_finance_overview_does_not_answer_an_unasked_deadline_question(self):
        for language in ('english', 'hinglish'):
            kwargs = dict(language=language, as_of_utc=datetime(2026, 10, 13, tzinfo=timezone.utc))
            overview = render_reading(reference_chart(), 'finance', **kwargs)
            timing = render_reading(reference_chart(), 'finance', intent='timing', **kwargs)
            self.assertNotRegex(overview['text'], r'amount|date|timeframe')
            self.assertIn('timeframe', timing['text'])
            self.assertEqual(overview['evidence'], timing['evidence'])


if __name__ == '__main__':
    unittest.main()
