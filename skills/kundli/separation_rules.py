"""Selected traditional separation conditions, not a divorce prediction engine.

Only the relationship portions of these MIT-licensed VedAstro entries are used.
No claims about a spouse's character, health, death or fidelity are admitted.
Whole-sign aspects are calculated facts; an aspect alone is not a matched rule.
This module is also shipped in the PWA to validate the response independently.
"""
import hashlib
import json
import re
from datetime import datetime, timezone

SOURCE = 'https://github.com/VedAstro/VedAstro/blob/master/Library/XMLData/HoroscopeDataList.xml'
REVISION = 'selected-separation-conditions-v1'
SIGNS = ('Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio',
         'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces')
LORDS = ('Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars',
         'Jupiter', 'Saturn', 'Saturn', 'Jupiter')
PLANETS = ('Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu')
HINDI_NAMES = dict(zip(PLANETS, ('Surya', 'Chandra', 'Mangal', 'Budh', 'Guru', 'Shukra', 'Shani', 'Rahu', 'Ketu')))
HOUSE_NAMES = ('pehle', 'doosre', 'teesre', 'chauthe', 'paanchve', 'chhathe',
               'saatve', 'aathve', 'nauve', 'dasve', 'gyaarahve', 'baarahve')
RULES = ('House12LordInHouse7', 'MarsIn7thNoBenefics', 'SaturnIn7thNotLagnaLord', 'SunVenusIn5th7th9th')


def request_fingerprint(value):
    fields = {key: value[key] for key in ('dob', 'tob', 'place', 'topic', 'language', 'intent')}
    return hashlib.sha256(json.dumps(fields, sort_keys=True, ensure_ascii=True,
                                    separators=(',', ':')).encode()).hexdigest()


def aspect_houses(planet, house):
    offsets = {'Mars': (4, 7, 8), 'Jupiter': (5, 7, 9), 'Saturn': (3, 7, 10)}.get(planet, (7,))
    # Node aspects are deliberately not selected: conventions differ.
    return [] if planet in ('Rahu', 'Ketu') else sorted((house + offset - 2) % 12 + 1 for offset in offsets)


def assess_positions(lagna, positions):
    if lagna not in SIGNS or not isinstance(positions, dict) or set(positions) != set(PLANETS):
        raise ValueError('Incomplete separation chart')
    asc = SIGNS.index(lagna)
    for planet, fact in positions.items():
        if (not isinstance(fact, dict) or set(fact) != {'planet', 'sign', 'house'} or
                fact['planet'] != planet or fact['sign'] not in SIGNS or type(fact['house']) is not int or
                fact['house'] != (SIGNS.index(fact['sign']) - asc) % 12 + 1):
            raise ValueError('Conflicting separation position')
    lord1, lord7, lord12 = [LORDS[(asc + house - 1) % 12] for house in (1, 7, 12)]
    influences = [p for p in PLANETS if positions[p]['house'] == 7 or 7 in aspect_houses(p, positions[p]['house'])]
    matched, unevaluated = [], []
    if positions[lord12]['house'] == 7:
        matched.append({'id': RULES[0], 'kind': 'separation_indication', 'planet': lord12})
    if positions['Mars']['house'] == 7:
        if not {'Jupiter', 'Venus'} & set(influences):
            # Moon phase and Mercury's associations change benefic classification.
            # If either influences the seventh, do not guess the missing condition.
            if {'Moon', 'Mercury'} & set(influences):
                unevaluated.append(RULES[1])
            else:
                matched.append({'id': RULES[1], 'kind': 'separation_indication', 'planet': 'Mars'})
    if positions['Saturn']['house'] == 7 and 'Saturn' not in (lord1, lord7):
        matched.append({'id': RULES[2], 'kind': 'strain_indication', 'planet': 'Saturn'})
    # Review only the seventh-house subset of this broader source entry.
    if positions['Sun']['house'] == positions['Venus']['house'] == 7:
        matched.append({'id': RULES[3], 'kind': 'strain_indication', 'planet': 'Sun'})
    status = ('separation_indication' if any(r['kind'] == 'separation_indication' for r in matched)
              else 'strain_indication' if matched else 'not_established')
    return {'status': status, 'matched': matched, 'unevaluated': unevaluated,
            'seventh_lord': lord7, 'seventh_lord_house': positions[lord7]['house'],
            'seventh_influences': influences, 'event_timing': 'not_established',
            'legal_finalization': 'not_evaluated', 'windows': []}


def render_assessment(assessment, language, intent):
    if language not in ('english', 'hinglish') or intent not in ('overview', 'timing'):
        raise ValueError('Unsupported separation language or intent')
    hi = language == 'hinglish'
    status = assessment['status']
    openings = {
        'not_established': ('The selected conditions checked here do not establish a clear separation indication. This is a limited check, not evidence that divorce cannot happen.',
                            'Abhi check kiye gaye yogon se separation ka saaf sanket establish nahi hua. Yeh limited check hai; iska matlab divorce ho hi nahi sakta, aisa nahi hai.'),
        'strain_indication': ('The checked conditions indicate relationship strain, rather than a confirmed separation outcome.',
                              'Check kiye gaye yog rishton mein tanaav ka sanket dete hain; inse separation ka natija confirm nahi hota.'),
        'separation_indication': ('A traditional separation indication is present in the checked conditions. It calls for a fuller relationship review, rather than a certain divorce verdict.',
                                  'Check kiye gaye yogon mein separation ka paramparik sanket milta hai. Isse relationship ka aur detail mein assessment banta hai, divorce ka pakka verdict nahi.'),
    }
    themes = {
        RULES[0]: ('The twelfth-house lord is in the seventh: this selected traditional rule links partnership with separation or withdrawal.',
                   'Baarahve ghar ke swami saatve ghar mein hain: is paramparik yog mein partnership ke saath doori ya alagav ka theme aata hai.'),
        RULES[1]: ('Mars is in the seventh without the benefic influences checked by this rule: the traditional theme is conflict that can lead to distance.',
                   'Mangal saatve ghar mein hain aur is yog mein check kiya gaya shubh prabhav nahi milta: iska paramparik theme takraav se doori badhna hai.'),
        RULES[2]: ('Saturn occupies the seventh and is neither ascendant nor seventh lord: this rule concerns marital strain, not divorce timing.',
                   'Shani saatve ghar mein hain aur lagna ya saatve ghar ke swami nahi hain: yeh yog vaivahik tanaav se juda hai, divorce ke samay se nahi.'),
        RULES[3]: ('Sun and Venus are together in the seventh: this selected rule concerns difficulty with relationship harmony.',
                   'Surya aur Shukra saatve ghar mein saath hain: is yog ka sambandh relationship mein talmel ki mushkil se hai.'),
    }
    paragraphs = [openings[status][hi]]
    details = [themes[r['id']][hi] for r in assessment['matched'][:2]]
    if not details:
        lord = assessment['seventh_lord']
        details.append((f"Aapke saatve ghar ke swami {HINDI_NAMES[lord]} {HOUSE_NAMES[assessment['seventh_lord_house'] - 1]} ghar mein hain. "
                        'Sirf Shani ki drishti ya Shukra-Mangal ka ek saath hona separation ka verdict nahi hai.') if hi else
                       (f"Your seventh-house lord {lord} is in house {assessment['seventh_lord_house']}. "
                        'A Saturn aspect or a Venus-Mars conjunction alone is not a separation verdict.'))
    if assessment['unevaluated']:
        details.append('Mangal wale yog mein Chandra/Budh ka shubh prabhav poori tarah check nahi hua, isliye usse natija nahi nikala.' if hi else
                       'The Moon/Mercury benefic condition in the Mars rule remains unevaluated, so it was not used for a verdict.')
    paragraphs.append(' '.join(details))
    if intent == 'timing':
        paragraphs.append('Is assessment mein separation ka time-window establish nahi hua; dasha ki end-date divorce ki deadline nahi hai.' if hi else
                          'This assessment has not established a separation window; a dasha end date will not be used as a divorce deadline.')
    else:
        paragraphs.append('Yeh selected janm-kundli yogon ki reading hai; poori grah-strength, Navamsha aur transit ki pushti abhi shamil nahi hai.' if hi else
                          'This reviews selected natal conditions; full strength, Navamsha and transit confirmation are not included.')
    return '\n\n'.join(paragraphs)


def validate_result(result, request, now=None):
    """Bind own birth request, timestamp, all placements, rule results and prose.

    Reject prose that adds a court date, guarantee, unsupported placement or
    counselling. No model judge, extra inference call or keyword-only score.
    """
    try:
        if (not isinstance(result, dict) or result.get('schema') != 'reviewed-separation-v1' or
                type(result.get('model_calls')) is not int or result['model_calls'] != 0 or
                type(result.get('model_tokens')) is not int or result['model_tokens'] != 0 or
                result.get('language') != request['language'] or result.get('intent') != request['intent'] or
                result.get('request_fingerprint') != request_fingerprint(request)):
            return False
        evidence = result['evidence']
        if (set(evidence) != {'schema', 'rules_revision', 'topic', 'input_fingerprint', 'as_of_utc',
                             'settings', 'lagna', 'positions', 'assessment', 'source'} or
                evidence['schema'] != 'separation-assessment-v1' or evidence['rules_revision'] != REVISION or
                evidence['topic'] != 'separation' or request['topic'] != 'separation' or evidence['source'] != SOURCE or
                not re.fullmatch(r'[a-f0-9]{64}', evidence['input_fingerprint'])):
            return False
        settings = evidence['settings']
        if (settings.get('engine') != 'pyswisseph' or settings.get('ayanamsa') != 'LAHIRI' or
                settings.get('house_system') != 'whole_sign' or settings.get('node') not in ('true', 'mean') or
                type(settings.get('dasha_year_days')) not in (int, float) or settings['dasha_year_days'] != 365.25):
            return False
        stamp = datetime.fromisoformat(evidence['as_of_utc'].replace('Z', '+00:00'))
        now = now or datetime.now(timezone.utc)
        if stamp.tzinfo is None or not -30 <= (now - stamp).total_seconds() <= 120:
            return False
        expected = assess_positions(evidence['lagna'], evidence['positions'])
        return (evidence['assessment'] == expected and
                result['text'] == render_assessment(expected, request['language'], request['intent']))
    except (KeyError, ValueError, TypeError, AttributeError, OverflowError):
        return False
