"""Conversational wording preserves the complete assessed marriage findings."""
from datetime import datetime, timezone
import unittest

from test_prediction_assessment import reference_chart
from render_outcome_reading import render_reading


class MarriageConversationTests(unittest.TestCase):
    def test_standard_timing_uses_two_complete_bubbles_without_repeating_verdict(self):
        for language in ('english', 'hinglish'):
            with self.subTest(language=language):
                kwargs = dict(language=language, intent='timing',
                              as_of_utc=datetime(2026, 10, 13, tzinfo=timezone.utc))
                result = render_reading(reference_chart(), 'marriage', **kwargs)
                detailed = render_reading(reference_chart(), 'marriage', style='detailed', **kwargs)
                text = result['text']
                bubbles = text.split('\n\n')
                self.assertEqual(len(bubbles), 2)
                self.assertTrue(all(bubble.endswith('.') and len(bubble) <= 360 for bubble in bubbles))
                self.assertLessEqual(len(text.split()), 105)
                for period in ('November 2031', 'July 2034', 'September 2027', 'November 2028'):
                    self.assertEqual(text.count(period), 1)
                for name in (('Guru', 'Shani', 'Shukra', 'Vrishabh', 'Kumbh', 'tanav') if language == 'hinglish'
                             else ('Jupiter', 'Saturn', 'Venus', 'Taurus', 'Aquarius', 'strain')):
                    self.assertIn(name, text)
                self.assertEqual(text.count('pakki tareekh nahi' if language == 'hinglish' else 'not a fixed wedding date'), 1)
                self.assertEqual(result['evidence'], detailed['evidence'])
                self.assertEqual(result['model_calls'], 0)

    def test_combination_requires_both_verified_opposing_factors(self):
        chart = reference_chart()
        jupiter = next(p for p in chart['planet_positions'] if p['name'] == 'Jupiter')
        jupiter.update(sign='Virgo', house=11, sidereal_degree=158.0)
        for language in ('english', 'hinglish'):
            result = render_reading(chart, 'marriage', language=language, intent='timing',
                                    as_of_utc=datetime(2026, 10, 13, tzinfo=timezone.utc))
            self.assertNotIn('JupiterInHouse7', [r['id'] for r in result['evidence']['prediction_assessment']['natal']['reasons']])
            self.assertNotIn('Guru rishte ke liye sahyog' if language == 'hinglish' else 'Jupiter in Taurus in house 7', result['text'])
            self.assertIn('tanav' if language == 'hinglish' else 'strain', result['text'])


if __name__ == '__main__':
    unittest.main()
