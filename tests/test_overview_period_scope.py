"""Overview presentation changes must not weaken event answers or evidence."""
from datetime import datetime, timezone
import unittest

from test_prediction_assessment import reference_chart
from render_outcome_reading import render_reading


class OverviewPeriodScopeTests(unittest.TestCase):
    def test_overviews_answer_the_topic_without_unasked_event_caveats(self):
        for year in (2026, 2032):
            for topic in ('career', 'education'):
                for language in ('english', 'hinglish'):
                    for style in ('standard', 'brief', 'detailed'):
                        with self.subTest(year=year, topic=topic, language=language, style=style):
                            answer = render_reading(reference_chart(), topic, language=language,
                                style=style, as_of_utc=datetime(year, 10, 13, tzinfo=timezone.utc))
                            self.assertNotRegex(answer['text'], r'admission|exam|job offer|promotion')
                            self.assertIn('gain' if topic == 'career' else 'knowledge', answer['text'].lower())
                            self.assertIn('Chandra' if year == 2026 and language == 'hinglish' else
                                          'Guru' if language == 'hinglish' else
                                          'Moon' if year == 2026 else 'Jupiter', answer['text'])

    def test_detailed_and_timing_answers_keep_their_limits_and_identical_evidence(self):
        for topic in ('career', 'education'):
            for language in ('english', 'hinglish'):
                kwargs = dict(language=language, as_of_utc=datetime(2026, 10, 13, tzinfo=timezone.utc))
                overview = render_reading(reference_chart(), topic, **kwargs)
                detailed = render_reading(reference_chart(), topic, style='detailed', **kwargs)
                timing = render_reading(reference_chart(), topic, intent='timing', **kwargs)
                self.assertNotRegex(detailed['text'], r'admission|exam|job offer|promotion')
                self.assertIn('September 2027', detailed['text'])
                self.assertIn('nahi' if language == 'hinglish' else 'not', timing['text'])
                self.assertEqual(overview['evidence'], detailed['evidence'])
                self.assertEqual(overview['evidence'], timing['evidence'])

    def test_adverse_and_mixed_periods_are_not_softened(self):
        for year in (2025, 2028, 2036):
            for topic in ('career', 'education'):
                for language in ('english', 'hinglish'):
                    answer = render_reading(reference_chart(), topic, language=language,
                        as_of_utc=datetime(year, 1, 1, tzinfo=timezone.utc))
                    current = answer['evidence']['prediction_assessment']['current_period']
                    if current['status'] in ('adverse', 'mixed'):
                        self.assertRegex(answer['text'], r'setback|loss|disruption|pratikool|mixed')


if __name__ == '__main__':
    unittest.main()
