from copy import deepcopy
from datetime import datetime, timedelta, timezone
import unittest

from test_topic_reading import chart as base_chart

def chart(asc=0):
    value = base_chart(asc)
    value["user_input"]["place"] = "Delhi"
    return value
from topic import render_verified_topic
from topic_rules import validate_topic_result


class VerifiedTopicTests(unittest.TestCase):
    def request(self, c, topic='relationship', intent='overview', language='hinglish'):
        return {**{k: c['user_input'][k] for k in ('dob', 'tob', 'place')},
                'topic': topic, 'intent': intent, 'language': language}

    def test_all_ascendants_languages_topics_and_supported_intents(self):
        for asc in range(12):
            c = chart(asc)
            for topic in ('relationship', 'marriage', 'career', 'education', 'finance'):
                for language in ('english', 'hinglish'):
                    for intent in ('overview', 'timing', 'detail', 'brief'):
                        r = render_verified_topic(c, topic, language=language, intent=intent)
                        self.assertTrue(validate_topic_result(r, self.request(c, topic, intent, language)))
                        self.assertEqual(r['evidence']['assessment']['windows'], [])
                        self.assertNotIn('?', r['text'])
                        self.assertEqual(r['model_calls'], 0)
                        self.assertNotIn('2027', r['text'])
            r = render_verified_topic(c, 'relationship', intent='contact')
            self.assertIn('cannot establish when they will reply', r['text'])

    def test_corruption_stale_future_and_cross_birth_are_rejected(self):
        c = chart()
        r = render_verified_topic(c, 'relationship', language='hinglish')
        q = self.request(c)
        for field in ('dob', 'tob', 'place', 'topic', 'intent', 'language'):
            self.assertFalse(validate_topic_result(r, {**q, field: 'altered'}))
        bad = deepcopy(r)
        bad['text'] += '\nYour girlfriend will definitely reply tomorrow.'
        self.assertFalse(validate_topic_result(bad, q))
        bad = deepcopy(r)
        bad['evidence']['assessment']['windows'] = [{'start': '2027-01-01'}]
        self.assertFalse(validate_topic_result(bad, q))
        bad = deepcopy(r)
        bad['evidence']['positions']['Mercury']['house'] = 13
        self.assertFalse(validate_topic_result(bad, q))
        for seconds in (-121, 31):
            bad = deepcopy(r)
            bad['evidence']['as_of_utc'] = (datetime.now(timezone.utc) + timedelta(seconds=seconds)).isoformat()
            self.assertFalse(validate_topic_result(bad, q))
        bad = deepcopy(r)
        bad['model_calls'] = False
        self.assertFalse(validate_topic_result(bad, q))

    def test_detail_adds_other_factor_instead_of_repeating_and_prose_is_not_input(self):
        c = chart()
        c['ai_summary'] = {'text': 'Guaranteed career growth tomorrow'}
        overview = render_verified_topic(c, 'career')
        detail = render_verified_topic(c, 'career', intent='detail')
        self.assertNotEqual(overview['text'], detail['text'])
        self.assertNotIn('Guaranteed', overview['text'])
        with self.assertRaises(ValueError):
            render_verified_topic(c, 'career', intent='contact')
