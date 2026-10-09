"""Provider migration, geometry disagreement, outage and prose isolation."""
from copy import deepcopy
from datetime import datetime, timezone
import unittest
from unittest.mock import Mock

from test_topic_reading import chart
from advanced_facts import divisional_sign
from reading_provider import use_reading_provider, COMPONENTS, SIGNS
from natal_client import REVISION, SETTINGS
from vedastro_client import MatchError
from vimshottari import current_period
from render_reading import render_reading

WHEN = datetime(2026, 10, 7, tzinfo=timezone.utc)
ENV = {'VEDASTRO_READING_MODE': 'required', 'VEDASTRO_NATAL_ENABLED': '1',
       'VEDASTRO_NATAL_API_URL': 'https://calculator.example/api',
       'VEDASTRO_NATAL_API_TOKEN': 'synthetic-reading-provider-test-token'}


class ProviderTests(unittest.TestCase):
    def setUp(self):
        self.chart = chart(0)
        self.chart['lagna_sidereal_degree'] = 10
        self.chart['calculation_settings'] = {'ayanamsa': 'LAHIRI', 'house_system': 'whole_sign',
            'node': 'true', 'engine': 'pyswisseph', 'dasha_year_days': 365.25}
        self.env = ENV.copy()
        positions = {p['name']: {'longitude': p['sidereal_degree'], 'sign': p['sign']} for p in self.chart['planet_positions']}
        self.when = WHEN
        birth = datetime.fromisoformat(self.chart['user_input']['birth_utc'].replace('Z', '+00:00')).replace(tzinfo=None)
        phase = current_period(birth, positions['Moon']['longitude'], WHEN.replace(tzinfo=None))
        self.data = {'schema': 'vedastro-reading-evidence-v1', 'topic': 'marriage', 'topicHouse': 7,
            'topicRuler': 'Venus', 'interpretationHouseSystem': 'whole_sign', 'eventTimingAvailable': False,
            'checkTime': {'StdTime': '00:00 07/10/2026 +00:00'},
            'natal': {'schema': 'vedastro-natal-evidence-v1', 'birthTime': {'StdTime': '08:19 16/02/2002 +05:30',
                'Location': {'Latitude': 28.6139, 'Longitude': 77.209}},
                'ascendant': {'Name': 'Aries', 'DegreesIn': {'TotalDegrees': '10'}}, 'planets': positions},
            'navamsaSign': SIGNS[divisional_sign(positions['Venus']['longitude'], 9)],
            'period': {'PD1': phase['mahadasha'], 'PD2': phase['antardasha']},
            'strength': {'planet': 'Venus', 'totalVirupas': 360, 'totalRupas': 6,
                'componentsVirupas': {key: 60 for key in COMPONENTS}, 'nativeHouseSystem': 'vedastro_bhava',
                'meetsEngineStrengthTest': False, 'Description': 'Promise a wedding tomorrow'}}
        self.raw = {'Status': 'Pass', 'ProviderRevision': REVISION, 'CalculationSettings': SETTINGS.copy(),
                    'Input': {'Ayanamsa': 1}, 'ModelCalls': 0, 'Payload': {'ReadingEvidence': self.data}}
        self.transport = Mock(side_effect=lambda *_: self.raw)

    def call(self):
        reference = lambda *args, **kwargs: {'planet_positions': self.chart['planet_positions'], 'lagna': 'Aries', 'lagna_degree': 10}
        return use_reading_provider(self.chart, 'marriage', as_of_utc=self.when, env=self.env,
                                    transport=self.transport, reference_calculator=reference)

    def test_native_provider_is_primary_and_prose_cannot_enter_reading(self):
        result = self.call()
        self.assertEqual(result['calculation_source'], 'vedastro-local')
        self.assertEqual(result['calculation_settings']['engine'], 'VedAstro.Library')
        self.assertEqual(self.chart['calculation_source'], 'pyswisseph')
        self.assertEqual(self.transport.call_count, 1)
        for intent in ('overview', 'timing'):
            rendered = render_reading(result, 'marriage', language='hinglish', intent=intent)
            self.assertEqual(rendered['evidence']['provider']['verified_against'], 'pyswisseph')
            self.assertNotIn('tomorrow', rendered['text'])
            self.assertLessEqual(len(rendered['text'].split('\n\n')), 3)
            self.assertEqual(rendered['model_calls'], 0)
            self.assertFalse(rendered['evidence']['advanced']['event_timing_available'])

    def test_default_disabled_preserves_existing_object_and_no_request(self):
        self.env.pop('VEDASTRO_READING_MODE')
        self.assertIs(self.call(), self.chart)
        self.transport.assert_not_called()

    def test_finance_uses_second_house_ruler_and_checks_native_contract(self):
        # Aries second-house ruler is Venus, as in the original strength fixture.
        self.data.update(topic='finance', topicHouse=2)
        reference = lambda *args, **kwargs: {'planet_positions': self.chart['planet_positions'], 'lagna': 'Aries', 'lagna_degree': 10}
        result = use_reading_provider(self.chart, 'finance', as_of_utc=self.when, env=self.env,
                                     transport=self.transport, reference_calculator=reference)
        self.assertEqual(result['reading_provider']['topic_ruler'], 'Venus')
        rendered = render_reading(result, 'finance', contract_version=2, as_of_utc=self.when)
        self.assertEqual(rendered['evidence']['advanced']['topic_ruler']['rules_house'], 2)
        self.assertEqual(rendered['evidence']['prediction_assessment']['event']['windows'], [])
        self.assertIn('Shadbala', rendered['text'])
        self.data['topicHouse'] = 7
        with self.assertRaises(MatchError):
            use_reading_provider(self.chart, 'finance', as_of_utc=self.when, env=self.env,
                                 transport=self.transport, reference_calculator=reference)

    def test_outage_has_explicit_fallback_and_required_mode_has_no_retry(self):
        self.transport.side_effect = MatchError('provider_timeout')
        self.env['VEDASTRO_READING_MODE'] = 'prefer'
        result = self.call()
        self.assertEqual(result['calculation_source'], 'pyswisseph')
        self.assertEqual(result['reading_provider_fallback'], 'provider_timeout')
        self.assertEqual(render_reading(result, 'marriage')['evidence']['provider_fallback'], 'provider_timeout')
        self.env['VEDASTRO_READING_MODE'] = 'required'
        with self.assertRaises(MatchError):
            self.call()
        self.assertEqual(self.transport.call_count, 2)

    def test_conflicts_are_never_hidden_by_fallback(self):
        self.env['VEDASTRO_READING_MODE'] = 'prefer'
        changes = [
            lambda: self.data['natal']['planets']['Sun'].update(longitude=1),
            lambda: self.data.update(topic='career'),
            lambda: self.data.update(topicRuler='Saturn'),
            lambda: self.data.update(navamsaSign='unknown'),
            lambda: self.data['checkTime'].update(StdTime='00:00 08/10/2026 +00:00'),
            lambda: self.data['strength'].update(totalVirupas=0),
            lambda: self.data['strength'].update(totalRupas=float('nan')),
            lambda: self.data['strength'].update(meetsEngineStrengthTest=1),
            lambda: self.data['strength']['componentsVirupas'].update(PlanetDrikBala=50),
            lambda: self.data.update(eventTimingAvailable=True),
            lambda: self.data['period'].update(PD1='Sun' if self.data['period']['PD1'] != 'Sun' else 'Moon'),
        ]
        original = deepcopy(self.raw)
        for change in changes:
            with self.subTest(change=change):
                self.raw = deepcopy(original)
                self.data = self.raw['Payload']['ReadingEvidence']
                change()
                with self.assertRaises(MatchError):
                    self.call()

    def test_correction_changes_both_request_and_fingerprint(self):
        first = self.call()
        self.chart['user_input']['coordinates']['lon'] = 78
        self.data['natal']['birthTime']['Location']['Longitude'] = 78
        second = self.call()
        a = render_reading(first, 'marriage')['evidence']['input_fingerprint']
        b = render_reading(second, 'marriage')['evidence']['input_fingerprint']
        self.assertNotEqual(a, b)
        self.assertEqual(self.transport.call_args.args[1]['time']['Location']['Longitude'], 78)


if __name__ == '__main__':
    unittest.main()
