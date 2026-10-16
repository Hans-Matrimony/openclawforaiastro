import copy
import unittest

from outcome_language import english_theme, hinglish_theme
from render_outcome_reading import _reviewed_next_step


class MarriageSymbolismOptionsTests(unittest.TestCase):
    def test_full_renderer_adds_one_step_without_changing_evidence(self):
        from datetime import datetime, timezone
        from unittest.mock import patch
        from test_topic_reading import chart
        from render_outcome_reading import render_reading
        import outcome_language
        for house in (6, 7):
            value = chart(0, 'Venus', house)
            for language in ('english', 'hinglish'):
                for style in ('brief', 'standard', 'detailed'):
                    kwargs = dict(as_of_utc=datetime(2026, 10, 9, tzinfo=timezone.utc),
                                  language=language, style=style)
                    with patch.dict(outcome_language.MARRIAGE_OPTIONS, {}, clear=True):
                        before = render_reading(value, 'marriage', **kwargs)
                    after = render_reading(value, 'marriage', **kwargs)
                    self.assertEqual(before['evidence'], after['evidence'])
                    step = outcome_language.MARRIAGE_OPTIONS[house][language == 'hinglish']
                    if style == 'brief':
                        self.assertEqual(before['text'], after['text'])
                    else:
                        self.assertEqual(after['text'].count(step), 1)
                        self.assertEqual(after['text'].replace('\n\n' + step, ''), before['text'])

    def test_optional_implication_preserves_finding_and_evidence(self):
        for house in (6, 7):
            for hi, theme in ((False, english_theme), (True, hinglish_theme)):
                factor = {'id': 'local-test', 'source': 'local_house_symbolism',
                          'fact': {'house': house}}
                before = copy.deepcopy(factor)
                finding = theme(factor, topic='marriage', include_advice=False)
                complete = theme(factor, topic='marriage', include_advice=True)
                step = _reviewed_next_step(factor, 'marriage', hi)
                self.assertTrue(step)
                self.assertEqual(complete, finding + ' ' + step)
                self.assertEqual(factor, before)
                self.assertNotEqual(step, _reviewed_next_step(
                    {**factor, 'fact': {'house': 7 if house == 6 else 6}}, 'marriage', hi))

    def test_no_unreviewed_advice_for_other_house_or_topic(self):
        for hi in (False, True):
            for house in (1, 4, 8, 12):
                factor = {'id': 'local-test', 'source': 'local_house_symbolism', 'fact': {'house': house}}
                self.assertEqual(_reviewed_next_step(factor, 'marriage', hi), '')
            factor = {'id': 'local-test', 'source': 'local_house_symbolism', 'fact': {'house': 6}}
            self.assertEqual(_reviewed_next_step(factor, 'finance', hi), '')


if __name__ == '__main__':
    unittest.main()
