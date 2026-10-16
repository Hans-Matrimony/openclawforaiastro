"""Versioned response evidence contract, shared with the PWA validator.

The writer selects reviewed phrasing, not arbitrary personal claims. Numerical
measurements are supplied by the authenticated calculator; rules are recomputed.
"""
import hashlib
import json
import math
import re
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

try:
    from .topic_rules import SIGNS, PLANETS, HINDI_NAMES, HOUSE_NAMES, THEMES, assess_topic
    from .response_calculations import derived_facts
    from .response_consultation_wording import topic_options, compact_timing_sentences
    from .response_marriage_timing import assess_marriage, timing_sentences, delivery_timing_sentences, previous_simple_timing_sentences, MARRIAGE_SCOPES
except ImportError:
    from topic_rules import SIGNS, PLANETS, HINDI_NAMES, HOUSE_NAMES, THEMES, assess_topic
    from response_calculations import derived_facts
    from response_consultation_wording import topic_options, compact_timing_sentences
    from response_marriage_timing import assess_marriage, timing_sentences, delivery_timing_sentences, previous_simple_timing_sentences, MARRIAGE_SCOPES

SCHEMA = 'astrology-evidence-v1'
REVISION = 'response-consultation-v5'
SETTINGS = {'engine': 'pyswisseph', 'ayanamsa': 'LAHIRI', 'house_system': 'whole_sign',
            'node': 'true', 'dasha_year_days': 365.25,
            'speed_reference': 'tropical_ecliptic_deg_per_day'}
TOPICS = ('career', 'education', 'relationship', 'marriage', 'finance')
SCOPES = ('overview', 'why', 'simple', 'detail', 'periods', 'chart', 'transits', *MARRIAGE_SCOPES)
LABELS = {'career': ('career', 'career'), 'education': ('studies', 'padhai'),
          'relationship': ('relationships', 'rishton'), 'marriage': ('marriage', 'shaadi'),
          'finance': ('finances', 'paison')}
SECONDARY_LABELS = {'career': ('earnings', 'kamai'), 'education': ('higher learning', 'aage ki padhai'),
                    'relationship': ('partnerships', 'partnership'), 'marriage': ('romance', 'romance'),
                    'finance': ('networks and gains', 'network aur gains')}

# Everyday wording of the same admitted house meanings. Keep the shared topic
# rules unchanged: those are also used by callers outside this response path.
PLAIN_THEMES = {
    1: ('taking initiative and deciding what matters to you', 'apni pehel aur apni priorities'),
    2: ('family, resources and communication', 'parivaar, resources aur baatcheet'),
    3: ('communication, practice and taking initiative', 'baatcheet, practice aur apni pehel'),
    4: ('home, foundations and learning', 'ghar, buniyad aur padhai'),
    5: ('learning and expressing yourself creatively', 'seekhne aur creativity'),
    6: ('everyday work, service and routines', 'rozmarra ke kaam, seva aur routine'),
    7: ('partnerships and working together', 'partnership aur saath milkar kaam karne'),
    8: ('change and looking more deeply into things', 'badlav aur cheezon ko gehraai se samajhne'),
    9: ('higher learning, travel and a shared outlook', 'aage ki padhai, safar aur milte-julte nazariye'),
    10: ('work and public responsibilities', 'kaam aur zimmedariyon'),
    11: ('friends, groups and networks', 'doston, groups aur jaan-pehchaan'),
    12: ('distance, reflection and time to yourself', 'door ki jagahon, soch-vichar aur apne liye waqt'),
}


def ordinal(number):
    suffix = 'th' if 10 <= number % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(number % 10, 'th')
    return str(number) + suffix


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=True,
                                    separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def validate_request(value):
    keys = {'dob', 'tob', 'place', 'topic', 'language', 'subject_key', 'profile_revision', 'time_precision'}
    if not isinstance(value, dict) or set(value) not in (keys, keys | {'scope'}):
        raise ValueError('Invalid evidence request')
    if value.get('scope', 'overview') not in SCOPES:
        raise ValueError('Unsupported reading scope')
    if value['topic'] not in TOPICS or value['language'] not in ('english', 'hinglish') or value['time_precision'] != 'exact':
        raise ValueError('Unsupported reading')
    if value.get('scope') in MARRIAGE_SCOPES[1:] and value['topic'] != 'marriage':
        raise ValueError('Marriage follow-up scope requires marriage topic')
    for key in ('subject_key', 'profile_revision'):
        if not isinstance(value[key], str) or not re.fullmatch(r'[a-f0-9]{64}', value[key]):
            raise ValueError('Invalid request binding')
    for key in ('dob', 'tob', 'place'):
        if not isinstance(value[key], str) or not 1 <= len(value[key]) <= 160 or any(ord(c) < 32 for c in value[key]):
            raise ValueError('Invalid birth field')
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value['dob']) or not re.fullmatch(r'\d{2}:\d{2}(?::\d{2})?', value['tob']):
        raise ValueError('Unresolved date/time')
    datetime.fromisoformat(value['dob'] + 'T' + value['tob'])
    return value


def verify_natal(chart):
    if not isinstance(chart, dict) or set(chart) != {'lagna', 'lagna_longitude', 'positions', 'backend', 'engine_version'}:
        raise ValueError('Invalid natal data')
    lagna, positions = chart['lagna'], chart['positions']
    if lagna not in SIGNS or not isinstance(positions, dict) or set(positions) != set(PLANETS):
        raise ValueError('Incomplete chart')
    asc = chart['lagna_longitude']
    if type(asc) not in (int, float) or not math.isfinite(asc) or not 0 <= asc < 360 or SIGNS[int(asc // 30)] != lagna:
        raise ValueError('Invalid ascendant')
    if chart['backend'] not in ('swiss', 'moshier') or not isinstance(chart['engine_version'], str) or not chart['engine_version']:
        raise ValueError('Unknown engine')
    simple = {}
    for planet, fact in positions.items():
        if not isinstance(fact, dict) or set(fact) != {'planet', 'longitude', 'speed', 'sign', 'house'} or fact['planet'] != planet:
            raise ValueError('Invalid planet')
        longitude, speed = fact['longitude'], fact['speed']
        if any(type(v) not in (int, float) or not math.isfinite(v) for v in (longitude, speed)) or not 0 <= longitude < 360:
            raise ValueError('Invalid measurement')
        sign = SIGNS[int(longitude // 30)]
        if fact['sign'] != sign or type(fact['house']) is not int or fact['house'] != (SIGNS.index(sign) - SIGNS.index(lagna)) % 12 + 1:
            raise ValueError('Conflicting placement')
        simple[planet] = {key: fact[key] for key in ('planet', 'sign', 'house')}
    if not math.isclose((positions['Ketu']['longitude'] - positions['Rahu']['longitude']) % 360, 180, abs_tol=1e-8):
        raise ValueError('Conflicting nodes')
    if positions['Ketu']['speed'] != positions['Rahu']['speed']:
        raise ValueError('Conflicting node speeds')
    return simple


def claims_for(chart, topic, language, scope='overview', calculations=None):
    assessment = assess_topic(chart['lagna'], verify_natal(chart), topic)
    if topic == 'marriage' and scope in MARRIAGE_SCOPES:
        if not calculations or not calculations.get('marriage_timing'):
            raise ValueError('Checked marriage screen required')
        screen = calculations['marriage_timing']
        sentences = timing_sentences(screen, language, scope)
        claims = [{'id': f'marriage-screen:{scope}:{i}:{screen["status"]}', 'options': [s] * 4}
                  for i, s in enumerate(sentences)]
        return claims, ' '.join(sentences), assessment
    hi = language == 'hinglish'
    target = assessment['factors'][0]
    house, ruler, ruled = target['house'], target['planet'], target['rules_house']
    label = LABELS[topic]
    theme = PLAIN_THEMES[house][1 if hi else 0]
    if hi:
        planet, placed, owned = HINDI_NAMES[ruler], HOUSE_NAMES[house - 1], HOUSE_NAMES[ruled - 1]
        context = {'career': 'Career', 'education': 'Padhai', 'relationship': 'Rishton',
                   'marriage': 'Shaadi', 'finance': 'Paison'}[topic]
        theme_options = [f'{context} ke maamle mein aapki kundli ka zor {theme} par hai.',
                         f'{context} ke liye aapki kundli mein {theme} ka pehlu saamne aata hai.',
                         f'{context} ke maamle mein aapki kundli ki yeh placement {theme} se judti hai.',
                         f'{context} ke liye kundli ka ek pehlu {theme} se juda hai.']
        reason_options = [f'Iska aadhar {planet} ki sthiti hai: woh {label[1]} ke {owned} ghar ke swami hain aur aapki kundli ke {placed} ghar mein hain.',
                          f'Yeh sambandh {planet} se aata hai. Aapki kundli mein woh {owned} ghar ke swami hain aur {placed} ghar mein hain.',
                          f'Aapki kundli mein {planet} {placed} ghar mein hain aur {label[1]} ke {owned} ghar ke swami hain.',
                          f'Aapki kundli mein yeh sambandh {planet} ke {placed} ghar mein hone aur {owned} ghar ke swami hone par aadharit hai.']
    else:
        placed, owned = ordinal(house), ordinal(ruled)
        theme_options = [f'For your {label[0]}, your kundli puts the emphasis on {theme}.',
                         f'Looking at your {label[0]}, the main connection in your kundli is with {theme}.',
                         f'For your {label[0]}, your kundli points to {theme}.',
                         f'Your kundli links your {label[0]} with {theme}.']
        reason_options = [f'This connection comes from {ruler}. In your kundli, it rules the {owned} house of {label[0]} and sits in the {placed} house.',
                          f'In your kundli, {ruler} links these areas: it rules the {owned} house of {label[0]} and sits in the {placed} house.',
                          f'In your kundli, {ruler} rules the {owned} house of {label[0]} and is in the {placed} house.',
                          f'Your kundli shows {ruler} in the {placed} house, ruling the {owned} house of {label[0]}.']
    # Fixed claims prevent a stylistic rewrite from creating outcomes or timing.
    claims = [{'id': f'theme:{topic}:{ruled}:{house}', 'options': theme_options},
              {'id': f'placement:{ruler}:{ruled}:{house}', 'options': reason_options}]
    secondary = assessment['factors'][1]
    second_house, second_ruled, second_ruler = secondary['house'], secondary['rules_house'], secondary['planet']
    second_label = SECONDARY_LABELS[topic][1 if hi else 0]
    second_theme = PLAIN_THEMES[second_house][1 if hi else 0]
    if hi:
        explanation = (f'{HINDI_NAMES[second_ruler]} {HOUSE_NAMES[second_ruled - 1]} ghar ke swami hain '
                       f'aur {HOUSE_NAMES[second_house - 1]} ghar mein hain.')
        secondary_options = [f'{second_label.capitalize()} ke maamle mein {second_theme} ka pehlu bhi aata hai. {explanation}',
                             f'{second_label.capitalize()} ka sambandh bhi {second_theme} se dikhta hai. {explanation}',
                             f'{second_label.capitalize()} ke liye doosra sambandh {second_theme} se hai. {explanation}',
                             f'{second_label.capitalize()} ki reading mein {second_theme} bhi aata hai. {explanation}']
    else:
        explanation = (f'{second_ruler} rules the {ordinal(second_ruled)} house '
                       f'and is in the {ordinal(second_house)} house.')
        secondary_options = [f'A second part of this reading connects {second_label} with {second_theme}. {explanation}',
                             f'Your kundli also connects {second_label} with {second_theme}. {explanation}',
                             f'For {second_label}, the second factor points to {second_theme}. {explanation}',
                             f'The second part of your reading links {second_label} with {second_theme}. {explanation}']
    second = {'id': f'secondary:{topic}:{second_ruler}:{second_ruled}:{second_house}', 'options': secondary_options}
    if scope == 'overview':
        # Keep one explicit chart reason, rather than two repetitive house reports.
        second = dict(second, options=[s.split('. ')[0] + '.' for s in secondary_options])
    if scope == 'simple':
        second = dict(second, options=[s.split('. ')[0] + '.' for s in secondary_options])
        claims = [claims[0], second]
    elif scope == 'why':
        claims = [claims[1], second]
    elif scope in ('periods', 'timing_context'):
        if calculations is None:
            raise ValueError('Period facts required')
        periods = calculations['periods']
        md, ad = periods['mahadasha'], periods['antardasha']
        # Keep exact instants in metadata; chat needs a readable date, not
        # microseconds suggesting that a traditional period is an event forecast.
        end = datetime.fromisoformat(periods['antardasha_end'].replace('Z', '+00:00')).strftime('%d %B %Y') + ' (UTC)'
        text = (f'Is waqt aapki {HINDI_NAMES[md]} mahadasha mein {HINDI_NAMES[ad]} antardasha chal rahi hai. '
                f'Yeh antardasha {end} ko badalti hai.' if hi else
                f'You are currently in {md} mahadasha and {ad} antardasha. '
                f'This antardasha ends on {end}.')
        limit = ('Mahadasha mukhya dasha hai; antardasha uske andar ki chhoti dasha hai.' if hi else
                 'Mahadasha is the main period; antardasha is the sub-period within it.')
        claims = [{'id': f'periods:{md}:{ad}:{periods["antardasha_end"]}', 'options': [text] * 4},
                  {'id': 'limit:periods-not-event-dates', 'options': [limit] * 4}]
        if scope == 'timing_context':
            # These are checked period facts, not an unimplemented event forecast.
            limit = ('Yeh dasha badalne ki boundary hai, shaadi ki date nahi. Aapki shaadi ka time window abhi calculate nahi hua hai.' if hi else
                     'This is a period change, not a marriage date. A marriage window has not been calculated for your chart.')
            if topic != 'marriage':
                limit = ('Yeh dasha badalne ki boundary hai. Is event ka time window abhi calculate nahi hua hai.' if hi else
                         'This is a period change. An event window has not been calculated for your chart.')
            claims[1] = {'id': f'limit:{topic}:no-event-window', 'options': [limit] * 4}
    elif scope == 'chart':
        moon, sun = chart['positions']['Moon'], chart['positions']['Sun']
        text = (f'Aapki D1 kundli ka lagna {chart["lagna"]} hai. Chandra {moon["sign"]} rashi ke '
                f'{HOUSE_NAMES[moon["house"] - 1]} ghar mein hain.' if hi else
                f'Your D1 ascendant is {chart["lagna"]}. Your Moon is in {moon["sign"]} '
                f'in the {ordinal(moon["house"])} house.')
        sunlight = (f'Surya {sun["sign"]} rashi ke {HOUSE_NAMES[sun["house"] - 1]} ghar mein hain.' if hi else
                    f'Your Sun is in {sun["sign"]} in the {ordinal(sun["house"])} house.')
        # The complete nine-planet chart is supplied in public_details. A chart
        # request does not imply a career/earnings interpretation.
        claims = [{'id': f'chart:{chart["lagna"]}:Moon:{moon["sign"]}:{moon["house"]}', 'options': [text] * 4},
                  {'id': f'chart:Sun:{sun["sign"]}:{sun["house"]}', 'options': [sunlight] * 4}]
    elif scope == 'transits':
        if not calculations or not calculations.get('transits'):
            raise ValueError('Transit facts required')
        positions = calculations['transits']['positions']
        claims = []
        for planet in ('Jupiter', 'Saturn'):
            fact = positions[planet]
            text = (f'Abhi {HINDI_NAMES[planet]} {fact["sign"]} rashi mein hain, '
                    f'jo aapki janm-kundli ke lagna se {HOUSE_NAMES[fact["natal_house"] - 1]} ghar hai.' if hi else
                    f'Currently, {planet} is in {fact["sign"]}, the {ordinal(fact["natal_house"])} '
                    'house from your natal ascendant.')
            claims.append({'id': f'transit:{planet}:{fact["sign"]}:{fact["natal_house"]}', 'options': [text] * 4})
        limit = ('Yeh vartaman gochar ki sthiti hai; isse kisi event ki date ya result tay nahi hota.' if hi else
                 'These are current transit positions; they do not establish an event date or outcome.')
        claims.append({'id': 'limit:transits-not-event-dates', 'options': [limit] * 4})
    else:
        claims.append(second)
        if scope == 'detail' and calculations:
            details = []
            for name, division in calculations['divisional_charts'].items():
                fact = division['positions'][ruler]
                details.append(f'{name}: {HINDI_NAMES[ruler]} {fact["sign"]} rashi ke {HOUSE_NAMES[fact["house"] - 1]} ghar mein hain' if hi else
                               f'in {name}, {ruler} is in {fact["sign"]} in the {ordinal(fact["house"])} house')
            text = ('Gehraai se dekhein toh ' + '; '.join(details) + '. Yeh divisional placements janm ke sahi samay par nirbhar hain.' if hi else
                    'Looking more closely, ' + '; '.join(details) + '. These divisional placements depend on the recorded birth time.')
            claims.append({'id': f'divisions:{topic}:{ruler}', 'options': [text] * 4})
    fallback = ' '.join(c['options'][0] for c in claims)
    return claims, fallback, assessment


def _persona_claims(evidence, persona):
    voice = persona.strip().casefold() if isinstance(persona, str) else ''
    start, end = {'meera': (0, 2), 'aarav': (2, 4)}.get(voice, (0, 4))
    return [{'id': claim['id'], 'options': claim['options'][start:end]}
            for claim in evidence['allowed_claims']]


def _marriage_delivery(evidence):
    return (evidence.get('rules_revision') == REVISION and evidence.get('topic') == 'marriage'
            and evidence.get('scope') in MARRIAGE_SCOPES)


def _topic_delivery(evidence):
    return (evidence.get('rules_revision') == REVISION and evidence.get('topic') in TOPICS
            and evidence.get('scope') in ('overview', 'simple', 'why'))


def claims_for_persona(evidence, persona):
    """Restrict style without changing chart facts or mutating signed evidence."""
    claims = _persona_claims(evidence, persona)
    if _topic_delivery(evidence):
        options = topic_options(evidence, PLAIN_THEMES, LABELS, SECONDARY_LABELS)
        if len(options) != len(claims):
            raise ValueError('Incomplete topic reading')
        return _persona_claims(dict(evidence, allowed_claims=[
            {'id': claim['id'], 'options': texts} for claim, texts in zip(claims, options)]), persona)
    if _marriage_delivery(evidence):
        sentences = delivery_timing_sentences(evidence['calculations']['marriage_timing'], evidence['language'], evidence['scope'])
        if evidence['scope'] == 'timing_context':
            sentences = compact_timing_sentences(evidence['calculations']['marriage_timing'], evidence['language'], sentences)
        if len(sentences) != len(claims):
            raise ValueError('Incomplete marriage reading')
        return [{'id': claim['id'], 'options': [text] * len(claim['options'])}
                for claim, text in zip(claims, sentences)]
    return claims


def fallback_for_persona(evidence, persona):
    claims = claims_for_persona(evidence, persona)
    return ' '.join(claim['options'][0] for claim in claims)


def accepted_text(text, evidence, persona):
    """Validate any claim count without constructing a Cartesian product."""
    if not isinstance(text, str):
        return False
    parts = text.split('\n\n')
    def matches(claims):
        return (text == ' '.join(claim['options'][0] for claim in claims) or
                (len(parts) == len(claims) and all(part in claim['options'] for part, claim in zip(parts, claims))))
    if matches(claims_for_persona(evidence, persona)):
        return True
    # Existing completed v5 reservations must replay without another writer
    # call. Admit only their exact original reviewed wording, in claim order.
    if not (_marriage_delivery(evidence) or _topic_delivery(evidence)):
        return False
    original = _persona_claims(evidence, persona)
    if matches(original):
        return True
    if _marriage_delivery(evidence):
        previous = delivery_timing_sentences(evidence['calculations']['marriage_timing'], evidence['language'], evidence['scope'])
        if len(previous) == len(original) and matches([
                {'id': claim['id'], 'options': [sentence] * len(claim['options'])}
                for claim, sentence in zip(original, previous)]):
            return True
    if evidence['scope'] == 'marriage_simple':
        previous = previous_simple_timing_sentences(evidence['calculations']['marriage_timing'], evidence['language'])
        return len(previous) == len(original) and matches([
            {'id': claim['id'], 'options': [sentence] * len(claim['options'])}
            for claim, sentence in zip(original, previous)])
    return False


def evidence_result(request, birth, chart, as_of=None, sky=None, timing_samples=None):
    validate_request(request)
    at = as_of or datetime.now(timezone.utc)
    calculations = derived_facts(chart, birth, request['topic'], at)
    if request['topic'] == 'marriage' and request.get('scope') in MARRIAGE_SCOPES:
        calculations['marriage_timing'] = assess_marriage(chart, birth, at, timing_samples)
    calculations['transits'] = None
    if sky is not None:
        verify_natal(sky)
        moon_sign = SIGNS.index(chart['positions']['Moon']['sign'])
        asc_sign = SIGNS.index(chart['lagna'])
        calculations['transits'] = {'as_of_utc': at.isoformat(), 'sky': sky,
                                   'reference': 'natal_lagna_and_moon_whole_sign',
                                   'positions': {p: dict(sky['positions'][p],
                                        natal_house=(SIGNS.index(sky['positions'][p]['sign']) - asc_sign) % 12 + 1,
                                        moon_house=(SIGNS.index(sky['positions'][p]['sign']) - moon_sign) % 12 + 1)
                                                 for p in ('Jupiter', 'Saturn', 'Rahu', 'Ketu')}}
    claims, fallback, assessment = claims_for(chart, request['topic'], request['language'],
                                             request.get('scope', 'overview'), calculations)
    result = {'schema': SCHEMA, 'rules_revision': REVISION, 'request_fingerprint': digest(request),
              'subject_key': request['subject_key'], 'profile_revision': request['profile_revision'],
              'topic': request['topic'], 'language': request['language'],
              'as_of_utc': at.isoformat(),
              'settings': dict(SETTINGS), 'birth': birth, 'chart': chart,
              'scope': request.get('scope', 'overview'), 'calculations': calculations,
              'assessment': assessment, 'allowed_claims': claims, 'fallback_text': fallback,
              'limits': (['conditional_marriage_screen', 'event_date_not_established', 'full_strength_not_evaluated']
                         if 'marriage_timing' in calculations else
                         ['natal_themes_only', 'event_timing_not_evaluated', 'strength_not_evaluated']),
              'model_calls': 0, 'model_tokens': 0}
    result['evidence_digest'] = digest(result)
    return result


def validate_evidence(value, request, now=None):
    try:
        validate_request(request)
        expected_keys = {'schema', 'rules_revision', 'request_fingerprint', 'subject_key', 'profile_revision',
                         'topic', 'language', 'as_of_utc', 'settings', 'birth', 'chart', 'assessment',
                         'allowed_claims', 'fallback_text', 'limits', 'model_calls', 'model_tokens', 'evidence_digest',
                         'scope', 'calculations'}
        if not isinstance(value, dict) or set(value) != expected_keys or value['schema'] != SCHEMA or value['rules_revision'] != REVISION:
            return False
        if any(value[k] != request[k] for k in ('subject_key', 'profile_revision', 'topic', 'language')) or value['request_fingerprint'] != digest(request):
            return False
        if value['settings'] != SETTINGS or any(type(value[k]) is not int or value[k] != 0 for k in ('model_calls', 'model_tokens')):
            return False
        if value['evidence_digest'] != digest({k: v for k, v in value.items() if k != 'evidence_digest'}):
            return False
        at = datetime.fromisoformat(value['as_of_utc'])
        if at.tzinfo is None or not -30 <= ((now or datetime.now(timezone.utc)) - at).total_seconds() <= 120:
            return False
        birth = value['birth']
        if set(birth) != {'dob', 'tob', 'place', 'coordinates', 'timezone', 'utc', 'offset_hours'} or any(birth[k] != request[k] for k in ('dob', 'tob', 'place')):
            return False
        coords = birth['coordinates']
        if set(coords) != {'lat', 'lon'} or any(
                type(coords[k]) not in (int, float) or not math.isfinite(coords[k]) or not low <= coords[k] <= high
                for k, low, high in (('lat', -90, 90), ('lon', -180, 180))):
            return False
        local = datetime.fromisoformat(request['dob'] + 'T' + request['tob'])
        zone = ZoneInfo(birth['timezone'])
        candidates = {local.replace(tzinfo=zone, fold=fold).astimezone(timezone.utc) for fold in (0, 1)
                      if local.replace(tzinfo=zone, fold=fold).astimezone(timezone.utc).astimezone(zone).replace(tzinfo=None) == local}
        utc = datetime.fromisoformat(birth['utc'])
        if type(birth['offset_hours']) not in (int, float) or not math.isfinite(birth['offset_hours']):
            return False
        if len(candidates) != 1 or utc.tzinfo is None or utc not in candidates or birth['offset_hours'] != local.replace(tzinfo=zone).utcoffset().total_seconds() / 3600:
            return False
        transits = value['calculations']['transits']
        expected = evidence_result(request, birth, value['chart'], at,
                                   transits['sky'] if transits is not None else None,
                                   value['calculations'].get('marriage_timing', {}).get('samples'))
        return value == expected
    except (ValueError, TypeError, KeyError, AttributeError, OverflowError):
        return False


def render_selection(draft, evidence):
    """Only exact admitted sentences can reach delivery; no semantic guesswork."""
    if not isinstance(draft, dict) or set(draft) not in ({'sentences'}, {'choices'}):
        raise ValueError('Invalid writer draft')
    if set(draft) == {'choices'}:
        choices = draft['choices']
        claims = evidence['allowed_claims']
        if not isinstance(choices, list) or len(choices) != len(claims):
            raise ValueError('Incomplete reading')
        sentences = []
        for choice, claim in zip(choices, claims):
            if (not isinstance(choice, dict) or set(choice) != {'claim_id', 'option'} or
                    choice['claim_id'] != claim['id'] or type(choice['option']) is not int or
                    not 0 <= choice['option'] < len(claim['options'])):
                raise ValueError('Unsupported writer choice')
            sentences.append({'claim_id': claim['id'], 'text': claim['options'][choice['option']]})
        draft = {'sentences': sentences}
    if not isinstance(draft['sentences'], list):
        raise ValueError('Invalid writer draft')
    claims = evidence['allowed_claims']
    if len(draft['sentences']) != len(claims):
        raise ValueError('Incomplete reading')
    text = []
    for sentence, claim in zip(draft['sentences'], claims):
        if not isinstance(sentence, dict) or set(sentence) != {'claim_id', 'text'} or sentence['claim_id'] != claim['id'] or sentence['text'] not in claim['options']:
            raise ValueError('Unsupported writer claim')
        text.append(sentence['text'])
    return '\n\n'.join(text)
