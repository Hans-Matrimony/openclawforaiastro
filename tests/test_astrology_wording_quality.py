"""Presentation quality gates using fixed, verified-shape chart evidence."""
from datetime import datetime, timezone
import unittest
from test_prediction_assessment import reference_chart
from test_topic_reading import chart
from reading import reading_packet
from render_outcome_reading import render_reading
from topic_wording import topic_house_wording

WHEN=datetime(2026,10,9,tzinfo=timezone.utc)


class WordingQualityTests(unittest.TestCase):
    def test_every_general_house_has_topic_specific_bilingual_wording(self):
        for house in range(1,13):
            for topic in ('marriage','career','education','finance'):
                for hi in (True,False):
                    text=topic_house_wording(topic,house,hi)
                    self.assertTrue(text.strip())
                    self.assertNotIn('general house reading',text)
                    self.assertNotIn('broader house reading',text)
                    self.assertNotIn('will definitely',text)
            self.assertEqual(len({topic_house_wording(topic,house) for topic in ('marriage','career','education','finance')}),4)
        for house in (0,13,True,'7'):
            with self.assertRaises(ValueError):topic_house_wording('marriage',house)

    def test_brief_timing_is_one_paragraph_and_does_not_replay_other_periods(self):
        for language in ('english','hinglish'):
            brief=render_reading(reference_chart(),'marriage',as_of_utc=WHEN,language=language,intent='timing',style='brief')
            full=render_reading(reference_chart(),'marriage',as_of_utc=WHEN,language=language,intent='timing')
            self.assertEqual(brief['evidence'],full['evidence'])
            self.assertEqual(len(brief['text'].split('\n\n')),1)
            self.assertIn('2031',brief['text'])
            self.assertIn('conditional',brief['text'])
            self.assertNotIn('2027',brief['text'])
            self.assertLess(len(brief['text']),len(full['text'])/2)

    def test_all_topics_keep_identical_evidence_across_styles(self):
        for topic in ('marriage','career','education','finance'):
            for language in ('english','hinglish'):
                results=[render_reading(reference_chart(),topic,as_of_utc=WHEN,language=language,style=style)
                         for style in ('brief','standard','detailed')]
                self.assertTrue(all(r['evidence']==results[0]['evidence'] for r in results))
                self.assertEqual(len(results[0]['text'].split('\n\n')),1)
                self.assertLessEqual(len(results[1]['text'].split('\n\n')),4)
                self.assertTrue(all(r['model_calls']==r['model_tokens']==0 for r in results))

    def test_mixed_chart_retains_both_support_and_challenge(self):
        result=render_reading(reference_chart(),'marriage',as_of_utc=WHEN,language='english')
        self.assertIn('supportive and challenging',result['text'])
        self.assertIn('Saturn',result['text'])
        self.assertIn('Jupiter',result['text'])
        self.assertIn('Venus',result['text'])
        self.assertNotIn('everything will be fine',result['text'])

    def test_standard_direction_leads_with_theme_and_retains_exact_evidence(self):
        for topic in ('career','education','finance'):
            for language in ('english','hinglish'):
                standard=render_reading(reference_chart(),topic,as_of_utc=WHEN,language=language,style='standard')
                detailed=render_reading(reference_chart(),topic,as_of_utc=WHEN,language=language,style='detailed')
                self.assertEqual(standard['evidence'],detailed['evidence'])
                self.assertNotIn('do not point clearly',standard['text'].split('.')[0])
                self.assertNotIn('saaf anukool ya pratikool',standard['text'].split('.')[0])
                self.assertLessEqual(len(standard['text'].split('\n\n')),2)
                self.assertIn('house' if language=='english' else 'ghar',standard['text'].split('\n\n')[0])
                if topic=='career' and language=='hinglish':
                    self.assertTrue(standard['text'].startswith('Career mein '))

    def test_concise_timing_keeps_primary_secondary_and_opposing_reasons(self):
        for language in ('english','hinglish'):
            standard=render_reading(reference_chart(),'marriage',as_of_utc=WHEN,language=language,intent='timing',style='standard')
            detailed=render_reading(reference_chart(),'marriage',as_of_utc=WHEN,language=language,intent='timing',style='detailed')
            self.assertEqual(standard['evidence'],detailed['evidence'])
            self.assertTrue(all(year in standard['text'] for year in ('2031','2034','2027','2028')))
            self.assertIn('conditional',standard['text'])
            self.assertTrue(all(planet in standard['text'] for planet in (('Saturn','Jupiter') if language=='english' else ('Shani','Guru'))))
            self.assertLess(len(standard['text'].split()),len(detailed['text'].split()))
            self.assertLessEqual(len(standard['text'].split()),140)
