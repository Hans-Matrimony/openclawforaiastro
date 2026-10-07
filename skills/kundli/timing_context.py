"""Verified current sky and reviewed period categories; no event forecasts."""
from copy import deepcopy
import json
from pathlib import Path

from vedastro_client import MatchError

SIGNS = ('Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
         'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces')
REVISION = '40763952742f76369a505d8db2e9e9fa67f75d78'
SOURCE_HASH = '3f2c1f78ee4d5fcd7a349deec77fdf99fb9133493f13e68a63f65a67db280887'
RATINGS = json.loads(Path(__file__).with_name('period_ratings.json').read_text(encoding='utf8'))
if (RATINGS['source_revision'] != REVISION or RATINGS['source_sha256'] != SOURCE_HASH
        or RATINGS['schema'] != 'vedastro-period-ratings-v1'):
    raise ValueError('Unverified period rating source')


def verified_timing_context(value, phase, natal_moon, reference_positions, when, finite):
    """Reject source/category/clock conflicts and independently check transits.

    Normalize only typed facts. Unknown prose and raw predictions are discarded.
    The upstream obstruction calculator is intentionally not invoked or inferred.
    """
    if (not isinstance(value, dict) or value.get('schema') != 'vedastro-timing-context-v1'
            or value.get('scope') != 'current_period_and_transits'
            or value.get('obstructionEvaluated') is not False
            or value.get('eventPredictionAvailable') is not False):
        raise MatchError('calculation_conflict')
    rule_id = phase['mahadasha'] + phase['antardasha'] + 'PD2'
    rule = value['periodRule']
    if rule.get('id') != rule_id or rule.get('ratings') != RATINGS['rules'][rule_id]:
        raise MatchError('calculation_conflict')
    if set(value['transits']) != {'Jupiter', 'Saturn'}:
        raise MatchError('provider_invalid_response')
    expected = {row['name']: row for row in reference_positions}
    transits = {}
    for name in ('Jupiter', 'Saturn'):
        row = value['transits'][name]
        longitude = finite(row['longitude'], 0, 360)
        if longitude >= 360:
            raise MatchError('provider_invalid_response')
        house = (int(longitude // 30) - int(natal_moon // 30)) % 12 + 1
        if (row['sign'] != SIGNS[int(longitude // 30)]
                or type(row['houseFromNatalMoon']) is not int or row['houseFromNatalMoon'] != house
                or abs((longitude - expected[name]['sidereal_degree'] + 180) % 360 - 180) > 0.002):
            raise MatchError('calculation_conflict')
        transits[name] = {'longitude': longitude, 'sign': row['sign'], 'house_from_natal_moon': house}
    return {'schema': 'reviewed-timing-context-v1', 'as_of_utc': when.isoformat(),
            'period_rule_id': rule_id, 'period_ratings': deepcopy(RATINGS['rules'][rule_id]),
            'period_rule_source_revision': REVISION, 'transits': transits,
            'transit_reference': 'natal_moon_sign', 'verified_against': 'pyswisseph',
            'obstruction_evaluated': False, 'event_prediction_available': False}


def period_relevance_text(packet, hi):
    """Connect verified house ownership to the active period, without scoring it."""
    from reading_language import HINDI_PLANETS
    ruler = packet['advanced']['topic_ruler']
    major, data = next(iter(packet['current_period']['mahadashas'].items()))
    minor = next(iter(data['antardashas']))
    if ruler['planet'] not in (major, minor):
        return ''
    planet = HINDI_PLANETS[ruler['planet']] if hi else ruler['planet']
    topic = {'marriage': 'relationship', 'career': 'career', 'education': 'study'}[packet['topic']]
    return (f"{planet} ghar {ruler['rules_house']} ke swami bhi hain, isliye is period ka {topic} reading se seedha sambandh hai; isse result ki guarantee nahi milti." if hi else
            f"{planet} also rules house {ruler['rules_house']}, connecting this period to the {topic} reading; that connection does not guarantee an outcome.")


def current_context_text(packet, hi, *, include_transits=False, include_period=True, include_ratings=True):
    from reading_language import HINDI_PLANETS, HINDI_SIGNS
    value = packet.get('timing_context')
    if not value:
        return ''
    major, major_data = next(iter(packet['current_period']['mahadashas'].items()))
    minor = next(iter(major_data['antardashas']))
    text = (f'Abhi {HINDI_PLANETS[major]} mahadasha aur {HINDI_PLANETS[minor]} antardasha chal rahi hai.' if hi else
            f'You are currently in the {major} major period and {minor} subperiod.')
    if not include_period:
        text = ''
    if include_ratings:
        relevance = period_relevance_text(packet, hi)
        if relevance:
            text += ' ' + relevance
    ratings = value['period_ratings']
    if include_ratings and packet['topic'] == 'marriage':
        categories = {ratings['family'], ratings['relationship']}
        if categories == {'Good'}:
            text += (' Is period ki traditional reading mein family aur relationship themes supportive hain; yeh shaadi hone ka vaada nahi hai.' if hi else
                     ' Traditional period rules classify family and relationship themes as supportive; this does not promise a marriage.')
        elif 'Good' in categories and 'Bad' in categories:
            text += (' Is period mein family aur relationship ke traditional sanket mixed hain; shaadi ki timing ke liye ek saaf nateeja nahi milta.' if hi else
                     ' Traditional family and relationship indicators are mixed in this period, so they do not give a clear marriage-timing conclusion.')
        else:
            text += (' Traditional period categories se aapke rishte ka result ya shaadi ki tareekh tay nahi hoti.' if hi else
                     ' Traditional period categories do not establish your relationship outcome or wedding date.')
    elif include_ratings and packet['topic'] == 'education':
        if ratings['study'] == 'Good':
            text += (' Is period ki traditional reading mein study theme supportive hai; exam result aapki preparation par bhi depend karta hai.' if hi else
                     ' Traditional period rules classify the study theme as supportive; exam results also depend on preparation.')
        else:
            text += (' Is period ki traditional category aapki learning ability ya exam result ka faisla nahi hai.' if hi else
                     ' The traditional period category does not determine your learning ability or exam results.')
    if include_transits:
        text += (' Current transit, janm ke Moon se: ' if hi else ' Current transits counted from your natal Moon: ')
        descriptions = []
        for name in ('Jupiter', 'Saturn'):
            row = value['transits'][name]
            planet, sign = (HINDI_PLANETS[name], HINDI_SIGNS[row['sign']]) if hi else (name, row['sign'])
            descriptions.append(f"{planet}, {sign}, {'ghar' if hi else 'house'} {row['house_from_natal_moon']}")
        text += '; '.join(descriptions) + '.'
        limits = {
            'marriage': ('In positions se akela shaadi ka samay tay nahi hota.',
                         'These positions alone do not establish a wedding window.'),
            'career': ('In positions se job milne ya promotion ki tareekh tay nahi hoti.',
                       'These positions alone do not date a job offer or promotion.'),
            'education': ('In positions se admission ya exam result tay nahi hota.',
                          'These positions alone do not determine admission or exam results.'),
        }
        text += ' ' + limits[packet['topic']][0 if hi else 1]
    return text.strip()
