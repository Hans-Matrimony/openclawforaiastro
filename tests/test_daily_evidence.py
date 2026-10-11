"""Native JSON/independent geometry contract and daily renderer regressions.

The fixture comes from the actual pinned local engine for a fictional profile.
No test requests a remote API, reads an account, or sends a horoscope.
"""
from copy import deepcopy
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT/'skills/kundli'), str(ROOT/'skills/horoscope')]
from daily_provider import daily_evidence
from daily_wording import render_daily
from vedastro_client import MatchError

FIXTURE = json.loads((ROOT/'tests/fixtures/vedastro_daily_synthetic.json').read_text(encoding='utf-8'))
VEDHA_FIXTURE = json.loads((ROOT/'tests/fixtures/vedastro_daily_vedha_synthetic.json').read_text(encoding='utf-8'))
WHEN = datetime(2026, 10, 11, 12, tzinfo=timezone.utc)
ENV = {'VEDASTRO_DAILY_ENABLED':'1', 'VEDASTRO_NATAL_ENABLED':'1',
       'VEDASTRO_NATAL_API_URL':'https://calculator.example/api',
       'VEDASTRO_NATAL_API_TOKEN':'synthetic-daily-provider-test-token-0000'}


class DailyEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.chart = deepcopy(FIXTURE['chart'])
        self.raw = deepcopy(FIXTURE['response'])
        self.transport = Mock(side_effect=lambda *args: self.raw)
        self.reference = Mock(side_effect=deepcopy(FIXTURE['references']))

    def call(self, **kwargs):
        return daily_evidence(self.chart, as_of_utc=WHEN, env=ENV, transport=self.transport,
                              reference_calculator=self.reference, **kwargs)

    def test_real_native_fixture_uses_one_request_and_independent_geometry(self):
        evidence = self.call()
        self.assertEqual(evidence, FIXTURE['evidence'])
        self.assertEqual(self.transport.call_count, 1)
        self.assertEqual(self.reference.call_count, 2)
        self.assertTrue(self.transport.call_args.args[0].endswith('/Calculate/DailyEvidence'))
        self.assertEqual(len(evidence['transits']), 9)
        self.assertEqual(len(evidence['kakshas']), 7)
        self.assertFalse(evidence['event_prediction_available'])

    def test_optional_native_vedha_uses_one_request_and_validates_occupancy(self):
        self.raw = deepcopy(VEDHA_FIXTURE['response'])
        env = {**ENV,'VEDASTRO_DAILY_VEDHA_ENABLED':'1'}
        result = daily_evidence(self.chart,as_of_utc=WHEN,env=env,transport=self.transport,reference_calculator=self.reference)
        self.assertEqual(result,VEDHA_FIXTURE['evidence'])
        self.assertTrue(self.transport.call_args.args[1]['includeVedha'])
        self.assertEqual(self.transport.call_count,1)
        self.assertTrue(result['obstruction_evaluated'])
        rows = result['gochara_vedha']['planets']
        self.assertFalse(rows['Venus']['obstructed'])  # No erroneous self-obstruction.
        self.assertEqual(rows['Sun']['exempt_planets_at_point'],['Saturn'])
        self.assertEqual(rows['Mercury']['obstructing_planets'],['Sun'])

    def test_vedha_configuration_and_unrequested_or_missing_geometry_fail_closed(self):
        for flag in ('true','',True,1):
            with self.subTest(flag=flag),self.assertRaises(MatchError):
                daily_evidence(self.chart,env={**ENV,'VEDASTRO_DAILY_VEDHA_ENABLED':flag},transport=self.transport)
        self.transport.assert_not_called()
        for enabled,raw in [(True,FIXTURE['response']),(False,VEDHA_FIXTURE['response'])]:
            with self.subTest(enabled=enabled):
                with self.assertRaises(MatchError):
                    daily_evidence(self.chart,as_of_utc=WHEN,env={**ENV,'VEDASTRO_DAILY_VEDHA_ENABLED':'1' if enabled else '0'},
                        transport=lambda *args:deepcopy(raw),reference_calculator=self.reference)

    def test_vedha_source_frame_point_scope_and_blocker_corruption_are_rejected(self):
        for key,value in [('sourceRevision','unknown'),('tableSelection','other_school'),
                          ('occupancyCorrection','query_transit_house'),('planetScope','nine_planets'),
                          ('houseReference','ascendant'),('eventPredictionAvailable',True)]:
            raw = deepcopy(VEDHA_FIXTURE['response'])
            raw['Payload']['DailyEvidence']['gocharaVedha'][key]=value
            with self.subTest(key=key),self.assertRaises(MatchError):
                daily_evidence(self.chart,as_of_utc=WHEN,env={**ENV,'VEDASTRO_DAILY_VEDHA_ENABLED':'1'},
                    transport=lambda *args:raw,reference_calculator=Mock(side_effect=deepcopy(FIXTURE['references'])))
        for key,value in [('obstructionHouseFromNatalMoon',True),('obstructingPlanets',['Mercury']),
                          ('obstructingPlanets',['Rahu']),('obstructed',False),('exemptPlanetsAtPoint',['Moon'])]:
            raw = deepcopy(VEDHA_FIXTURE['response'])
            raw['Payload']['DailyEvidence']['gocharaVedha']['planets']['Mercury'][key]=value
            with self.subTest(key=key,value=value),self.assertRaises(MatchError):
                daily_evidence(self.chart,as_of_utc=WHEN,env={**ENV,'VEDASTRO_DAILY_VEDHA_ENABLED':'1'},
                    transport=lambda *args:raw,reference_calculator=Mock(side_effect=deepcopy(FIXTURE['references'])))

    def test_vedha_renderer_reports_typed_geometry_without_outcome_or_table_reversal(self):
        evidence = deepcopy(VEDHA_FIXTURE['evidence'])
        for language in ('english','hinglish'):
            text=render_daily(evidence,language)
            self.assertIn('Vedha',text)
            self.assertNotIn('probability',text)
            self.assertNotIn('revers',text)
            self.assertEqual(len(text.split('\n\n')),3)
        evidence['gochara_vedha']['planets']['Mercury']['obstructed']=False
        with self.assertRaises(ValueError):
            render_daily(evidence,'english')

    def test_provider_outage_is_not_retried_or_replaced_with_legacy_reading(self):
        self.transport.side_effect = MatchError('provider_timeout')
        with self.assertRaisesRegex(MatchError, 'provider_timeout'):
            self.call()
        self.assertEqual(self.transport.call_count, 1)
        self.reference.assert_not_called()

    def test_disabled_feature_does_not_request_provider(self):
        with self.assertRaisesRegex(MatchError, 'daily_provider_disabled'):
            daily_evidence(self.chart, env={}, transport=self.transport)
        self.transport.assert_not_called()

    def test_tampered_source_clock_geometry_and_scores_are_rejected(self):
        changes = [
            ('checkTime', 'StdTime', '00:00 11/10/2026 +00:00'),
            ('checkTime', 'Location', {'Latitude':0,'Longitude':77.209}),
            ('period', 'PD1', 'NotAPlanet'),
            ('transits', 'Moon', {'longitude':0,'sign':'Aries','houseFromNatalMoon':1}),
            ('gocharaKakshas', 'Sun', {'Sign':'Aries','KakshaLord':'Sun','KakshaScore':True}),
        ]
        for group, key, value in changes:
            with self.subTest(group=group,key=key):
                self.setUp()
                self.raw['Payload']['DailyEvidence'][group][key] = value
                with self.assertRaises(MatchError):
                    self.call()
        for value in (True, -1, 2, 0.5, '1'):
            with self.subTest(score=value):
                self.setUp()
                self.raw['Payload']['DailyEvidence']['gocharaKakshas']['Sun']['KakshaScore'] = value
                with self.assertRaises(MatchError):
                    self.call()
        for field, value in (('transitHouseReference','ascendant'),('obstructionEvaluated',True),
                             ('eventPredictionAvailable',True),('schema','unknown')):
            with self.subTest(field=field):
                self.setUp()
                self.raw['Payload']['DailyEvidence'][field] = value
                with self.assertRaises(MatchError):
                    self.call()

    def test_native_constellation_alias_and_degree_checked(self):
        self.assertEqual(self.call()['transits']['Sun']['nakshatra'], 'Chitra')
        self.setUp()
        self.raw['Payload']['DailyEvidence']['transits']['Sun']['nakshatra']['DegreesInConstellation'] = 0
        with self.assertRaisesRegex(MatchError, 'calculation_conflict'):
            self.call()

    def test_input_seconds_unknown_offset_and_naive_query_are_rejected(self):
        for key, value in (('birth_utc','1995-03-14T04:45:01Z'),('timezone_offset',15),
                           ('timezone_offset',5.5001)):
            with self.subTest(key=key,value=value):
                self.setUp()
                self.chart['user_input'][key] = value
                with self.assertRaises(MatchError):
                    self.call()
                self.transport.assert_not_called()
        with self.assertRaises(MatchError):
            daily_evidence(FIXTURE['chart'], env=ENV, as_of_utc=WHEN.replace(tzinfo=None),
                           transport=self.transport)

    def test_renderer_preserves_mixed_support_and_house_reference_in_both_languages(self):
        evidence = deepcopy(FIXTURE['evidence'])
        for language in ('english','hinglish'):
            text = render_daily(evidence,language)
            self.assertEqual(len(text.split('\n\n')),3)
            self.assertNotIn('100%',text)
            self.assertNotIn('lucky',text.lower())
            self.assertIn(str(evidence['transits']['Moon']['house_from_natal_moon']),text)
        for value in (False,True):
            evidence['event_prediction_available'] = value
            if value:
                with self.assertRaises(ValueError):
                    render_daily(evidence,'english')

    def test_scheduler_format_does_not_send_or_add_empty_lucky_factors(self):
        fake = type(sys)('calculate')
        fake.generate_daily_horoscope = Mock()
        path = ROOT/'skills/horoscope/scheduler.py'
        spec = importlib.util.spec_from_file_location('test_daily_scheduler',path)
        scheduler = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {'calculate':fake}):
            spec.loader.exec_module(scheduler)
        message = scheduler.format_horoscope_message({'date':'2026-10-11',
            'birth_moon_sign':'Leo','birth_moon_sign_hindi':'Simha','birth_nakshatra':'Magha',
            'transit_moon_house':3,'prediction':'Traditional mixed reading.',
            'lucky_color':'','lucky_numbers':[],'lucky_day':''})
        self.assertIn('\n',message)
        self.assertNotIn('\\n',message)
        self.assertNotIn('Traditional Color',message)
        self.assertNotIn('100%',message)
        fake.generate_daily_horoscope.assert_not_called()
        with self.assertRaises(ValueError):
            scheduler.format_horoscope_message({'error':'provider_timeout'})

    def test_renderer_uses_requested_date_and_does_not_turn_zero_points_into_a_bad_day(self):
        evidence = deepcopy(FIXTURE['evidence'])
        evidence['as_of_utc'] = '2030-05-06T12:00:00+00:00'
        for row in evidence['kakshas'].values():
            row['kaksha_score'] = 0
        text = render_daily(evidence,'english')
        self.assertIn('6 May 2030',text)
        self.assertNotIn('Today',text)
        self.assertIn('does not establish a bad day',text)
        for row in evidence['kakshas'].values():
            row['kaksha_score'] = 1
        self.assertNotIn('mixed',render_daily(evidence,'english'))
        evidence['kakshas']['Sun']['kaksha_score'] = True
        with self.assertRaises(ValueError):
            render_daily(evidence,'english')


if __name__ == '__main__':
    unittest.main()
