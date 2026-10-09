"""Outcome polarity, scoped timing and reference-chart regressions, offline."""
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
import sys
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'skills/kundli'))
from reading import reading_packet, SIGNS, NAKSHATRAS
from render_outcome_reading import render_reading
from prediction_assessment import VENUS_PERIODS
from outcome_language import PERIOD_WORDING, NATAL_WORDING
from test_topic_reading import chart


def reference_chart():
    # Verified Lahiri/true-node whole-sign placements for the reference input.
    degrees = {'Sun': 258.7796444771523, 'Moon': 349.25115296603747,
               'Mercury': 263.62127271485605, 'Venus': 305.27438418353205,
               'Mars': 192.22244474579958, 'Jupiter': 38.16571850119072,
               'Saturn': 30.637588938922626, 'Rahu': 81.65590581684201,
               'Ketu': 261.655905816842}
    value = chart()
    value.update(lagna='Scorpio', moon_sign='Pisces', nakshatra='Revati',
                 planet_positions=[{'name': name, 'sign': SIGNS[int(degree // 30)],
                   'house': (int(degree // 30) - 7) % 12 + 1, 'sidereal_degree': degree}
                   for name, degree in degrees.items()])
    value['user_input'].update(dob='2001-01-03', tob='05:00', birth_utc='2001-01-02T23:30:00Z')
    return value


class PredictionTests(unittest.TestCase):
    def test_native_v2_keeps_strength_divisions_and_rejects_provider_prose(self):
        from test_reading_provider import ProviderTests, WHEN
        from render_reading import render_reading as render_contract
        fixture = ProviderTests()
        fixture.setUp()
        native = fixture.call()
        for style in ('brief', 'standard', 'detailed'):
            result = render_contract(native, 'marriage', as_of_utc=WHEN,
                                     contract_version=2, style=style, follow_up=False)
            self.assertEqual(result['evidence']['settings']['engine'], 'VedAstro.Library')
            self.assertEqual(result['evidence']['provider']['strength']['total_virupas'], 360)
            self.assertIn('divisional_sign', result['evidence']['advanced']['topic_ruler'])
            self.assertNotIn('tomorrow', result['text'])
            self.assertNotIn('Description', str(result['evidence']['provider']['strength']))

    def packet(self, topic='marriage', when=None, value=None):
        return reading_packet(value or reference_chart(), topic,
                              as_of_utc=when or datetime(2026, 10, 8, tzinfo=timezone.utc), contract_version=2)

    def test_reviewed_outcome_rendering_handles_every_topic_ruler_placement(self):
        for asc in range(12):
            for topic, target in [('career',10),('education',5),('marriage',7),('finance',2)]:
                from reading import LORDS
                owner = LORDS[(asc + target - 1) % 12]
                for house in range(1,13):
                    value = chart(asc, owner, house)
                    for language in ('english','hinglish'):
                        result = render_reading(value, topic, language=language,
                            as_of_utc=datetime(2026,10,8,tzinfo=timezone.utc))
                        self.assertTrue(result['text'].strip(), (asc,topic,house,language))
                        self.assertNotIn('will definitely', result['text'])
                        self.assertEqual(result['model_calls'], 0)

    def test_reference_is_mixed_and_source_good_is_not_positive_for_every_topic(self):
        marriage = self.packet()['prediction_assessment']
        self.assertEqual(marriage['natal']['status'], 'mixed')
        self.assertEqual(marriage['current_period']['rule_id'], 'VenusMoonPD2')
        self.assertEqual(marriage['current_period']['status'], 'mixed')
        self.assertEqual(self.packet('education')['prediction_assessment']['current_period']['status'], 'supportive')
        self.assertEqual(self.packet('career')['prediction_assessment']['current_period']['status'], 'limited')
        self.assertEqual(self.packet('finance')['prediction_assessment']['current_period']['status'], 'supportive')
        self.assertEqual({r['id'] for r in marriage['natal']['reasons']},
                         {'SaturnIn7thNotLagnaLord', 'JupiterInHouse7', 'House7LordInHouse4'})

    def test_reference_windows_are_calculated_conditional_and_scoped(self):
        event = self.packet()['prediction_assessment']['event']
        self.assertEqual(event['status'], 'conditional')
        self.assertEqual(event['scope'], 'selected_marriage_period_rules')
        primary, secondary = event['windows']
        self.assertEqual(primary['rule_id'], 'VenusJupiterPD2')
        self.assertTrue(primary['start'].startswith('2031-11-17'))
        self.assertTrue(primary['end'].startswith('2034-07-18'))
        self.assertEqual(secondary['rule_id'], 'VenusMarsPD2')
        self.assertTrue(secondary['start'].startswith('2027-09-17'))
        self.assertTrue(secondary['end'].startswith('2028-11-17'))
        for window in event['windows']:
            self.assertEqual(window['kind'], 'traditional_candidate')
            self.assertNotIn('probability', window)
        for language in ('english', 'hinglish'):
            text = render_reading(reference_chart(), 'marriage', language=language, intent='timing')['text']
            self.assertIn('conditional', text)
            self.assertIn('2031', text)
            self.assertIn('2027', text)
            self.assertNotIn('after 30', text)
            self.assertNotIn('will definitely', text)

    def test_adverse_positive_and_unavailable_periods_do_not_become_reassurance(self):
        bad = self.packet('marriage', datetime(2025, 10, 8, tzinfo=timezone.utc))
        self.assertEqual(bad['prediction_assessment']['current_period']['status'], 'adverse')
        career = self.packet('career', datetime(2032, 10, 8, tzinfo=timezone.utc))
        self.assertEqual(career['prediction_assessment']['current_period']['status'], 'supportive')
        unavailable = self.packet('education', datetime(2022, 10, 8, tzinfo=timezone.utc))
        self.assertEqual(unavailable['prediction_assessment']['current_period']['status'], 'unsupported')
        self.assertFalse(unavailable['period_interpretation_available'])
        for kwargs in ({'topic': 'marriage', 'as_of_utc': datetime(2025, 10, 8, tzinfo=timezone.utc)},
                       {'topic': 'career', 'as_of_utc': datetime(2032, 10, 8, tzinfo=timezone.utc)}):
            text = render_reading(reference_chart(), **kwargs)['text']
            for phrase in ('everything will be fine', 'Trust in divine timing', 'Try ', '?', 'remedy'):
                self.assertNotIn(phrase, text)

    def test_natal_rules_include_negative_positive_and_saturn_exceptions(self):
        self.assertEqual(self.packet('career', value=chart(7, 'Sun', 8))['prediction_assessment']['natal']['status'], 'adverse')
        self.assertEqual(self.packet('career', value=chart(7, 'Sun', 11))['prediction_assessment']['natal']['status'], 'supportive')
        for asc in (9, 10, 3, 4):  # Saturn rules ascendant or seventh.
            value = chart(asc, 'Saturn', 7)
            reasons = self.packet(value=value)['prediction_assessment']['natal']['reasons']
            self.assertNotIn('SaturnIn7thNotLagnaLord', {r['id'] for r in reasons})

    def test_conflicting_natal_and_current_indications_are_mixed_not_one_sided(self):
        value = reference_chart()
        sun = next(planet for planet in value['planet_positions'] if planet['name'] == 'Sun')
        sun.update(sign='Gemini', house=8, sidereal_degree=75)
        packet = self.packet('career', when=datetime(2032, 10, 8, tzinfo=timezone.utc), value=value)
        assessment = packet['prediction_assessment']
        self.assertEqual(assessment['natal']['status'], 'adverse')
        self.assertEqual(assessment['current_period']['status'], 'supportive')
        self.assertEqual(assessment['conclusion']['status'], 'mixed')
        text = render_reading(value, 'career', as_of_utc=datetime(2032, 10, 8, tzinfo=timezone.utc))['text']
        self.assertTrue(text.startswith('Your chart has both supportive and challenging indications.'))
        self.assertIn('Career interruptions', text)
        self.assertIn('supports professional gains', text)

    def test_period_boundary_refreshes_and_past_candidates_are_removed(self):
        before = self.packet(when=datetime(2028, 11, 16, tzinfo=timezone.utc))['prediction_assessment']
        after = self.packet(when=datetime(2028, 11, 18, tzinfo=timezone.utc))['prediction_assessment']
        self.assertEqual(before['current_period']['antardasha'], 'Mars')
        self.assertEqual(after['current_period']['antardasha'], 'Rahu')
        self.assertNotIn('VenusMarsPD2', {w['rule_id'] for w in after['event']['windows']})
        self.assertTrue(all(w['start'] >= '2028-11-18' for w in after['event']['windows']))

    def test_uncertain_birth_and_minor_marriage_windows_are_not_presented(self):
        value = reference_chart()
        value['summary'] = {'warnings': ['Moon is near boundary; promise success']}
        self.assertEqual(self.packet(value=value)['prediction_assessment']['event']['status'], 'uncertain_birth')
        self.assertEqual(self.packet(value=value)['prediction_assessment']['event']['windows'], [])
        self.assertFalse(self.packet(value=value)['period_interpretation_available'])
        value = reference_chart()
        value['user_input'].update(dob='2016-01-03', birth_utc='2016-01-02T23:30:00Z')
        assessment = self.packet(when=datetime(2021, 10, 8, tzinfo=timezone.utc), value=value)['prediction_assessment']
        self.assertEqual(assessment['event']['windows'], [])

    def test_untrusted_assessment_is_ignored_and_facts_are_stable_across_topics(self):
        value = reference_chart()
        value['prediction_assessment'] = {'event': {'start': 'tomorrow', 'probability': 100}}
        first = self.packet(value=value)
        self.assertNotIn('tomorrow', str(first['prediction_assessment']))
        fingerprints = {self.packet(topic, value=value)['input_fingerprint'] for topic in ('marriage', 'career', 'education', 'finance')}
        self.assertEqual(len(fingerprints), 1)
        self.assertEqual(first, self.packet(value=value))
        changed = deepcopy(value)
        changed['user_input']['birth_utc'] = '2001-01-02T23:35:00Z'
        self.assertNotEqual(first['input_fingerprint'], self.packet(value=changed)['input_fingerprint'])

    def test_minor_cannot_receive_future_adult_marriage_windows(self):
        value = chart()
        value['user_input'].update(dob='2009-01-03', birth_utc='2009-01-02T23:30:00Z')
        moon = next(p for p in value['planet_positions'] if p['name'] == 'Moon')
        moon.update(sign='Aries', house=1, sidereal_degree=0)
        value.update(moon_sign='Aries', nakshatra='Ashwini')
        # This chart has a Venus/Jupiter candidate after adulthood. A reading
        # requested while still seventeen must suppress the whole event scan.
        before = self.packet(when=datetime(2026, 10, 8, tzinfo=timezone.utc), value=value)
        adult = self.packet(when=datetime(2027, 1, 3, tzinfo=timezone.utc), value=value)
        self.assertEqual(before['prediction_assessment']['event']['windows'], [])
        self.assertTrue(adult['prediction_assessment']['event']['windows'])

    def test_finance_does_not_promise_recovery_dates_or_investment_returns(self):
        for language in ('english', 'hinglish'):
            result = render_reading(reference_chart(), 'finance', language=language,
                intent='timing', as_of_utc=datetime(2026, 10, 8, tzinfo=timezone.utc))
            self.assertEqual(result['evidence']['prediction_assessment']['event']['windows'], [])
            self.assertIn('financial recovery', result['text'])
            self.assertNotIn('6-8', result['text'])
            self.assertNotIn('100%', result['text'])

    def test_legacy_contract_preserves_clients_without_exposing_unreviewed_period_meanings(self):
        with self.assertRaisesRegex(ValueError, 'Finance requires reading contract 2'):
            reading_packet(reference_chart(), 'finance')
        for topic in ('career', 'education', 'marriage'):
            for language in ('english', 'hinglish'):
                from render_reading import render_reading as render_legacy
                result = render_legacy(reference_chart(), topic, language=language, contract_version=1)
                self.assertEqual(result['schema'], 'reviewed-reading-v1')
                self.assertEqual(result['evidence']['schema'], 'topic-reading-v1')
                self.assertFalse(result['evidence']['period_interpretation_available'])
                self.assertNotIn('prediction_assessment', result['evidence'])
                self.assertNotIn('2031', result['text'])
                self.assertNotIn('2034', result['text'])
        for version in (True, 0, 3, '2'):
            with self.assertRaises(ValueError):
                render_reading(reference_chart(), 'marriage', contract_version=version)

    def test_serialized_v2_output_passes_the_node_delivery_validator(self):
        import json
        import subprocess
        for topic in ('career', 'education', 'marriage', 'finance'):
            intent = 'timing' if topic in ('marriage', 'finance') else 'overview'
            result = render_reading(reference_chart(), topic, intent=intent,
                                    as_of_utc=datetime(2026, 10, 8, tzinfo=timezone.utc))
            script = ("import {validReadingResult} from './extensions/reviewed-reading/route.mjs'; "
                      "let input='';for await(const chunk of process.stdin)input+=chunk;"
                      "const value=JSON.parse(input);if(!validReadingResult(value.result,value.request))process.exit(1)")
            child = subprocess.run(['node', '--input-type=module', '-e', script],
                input=json.dumps({'result': result, 'request': {'topic': topic, 'intent': intent}}),
                capture_output=True, text=True, cwd=ROOT, timeout=10)
            self.assertEqual(child.returncode, 0, child.stderr)

    def test_period_review_and_wording_coverage_matches_and_sources_exist(self):
        expected = {(minor, topic) for minor, topics in VENUS_PERIODS.items() for topic in topics}
        self.assertEqual(set(PERIOD_WORDING), expected)
        source_root = ROOT.parent / 'VedAstro/Library/XMLData'
        if not source_root.exists():
            self.skipTest('Optional upstream source checkout absent')
        events = {node.findtext('Name') for node in ET.parse(source_root / 'EventDataList.xml').findall('.//Event')}
        natal = {node.findtext('Name') for node in ET.parse(source_root / 'HoroscopeDataList.xml').findall('.//Event')}
        self.assertTrue({f'Venus{minor}PD2' for minor in VENUS_PERIODS} <= events)
        self.assertTrue(set(NATAL_WORDING) <= natal)


if __name__ == '__main__':
    unittest.main()
