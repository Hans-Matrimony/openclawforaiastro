"""Bounded natal themes, shared with the PWA for independent validation.

These are reviewed whole-sign house meanings, not event or strength rules.
Do not turn a calculated lord placement into an observed life fact or deadline.
"""
import re
from datetime import datetime, timezone

try:
    from .separation_rules import SIGNS, LORDS, PLANETS, HINDI_NAMES, HOUSE_NAMES, request_fingerprint
except ImportError:
    from separation_rules import SIGNS, LORDS, PLANETS, HINDI_NAMES, HOUSE_NAMES, request_fingerprint

REVISION = 'reviewed-natal-topic-themes-v1'
TOPICS = {'career': (10, 2), 'education': (5, 9), 'marriage': (7, 5),
          'relationship': (5, 7), 'finance': (2, 11)}
INTENTS = ('overview', 'timing', 'contact', 'detail', 'brief')
# Meanings, never probabilities, actual habits, aptitude or promises.
THEMES = {
    1: ('personal initiative and your own priorities', 'apni pehel aur apni priorities'),
    2: ('family, resources and communication', 'family, resources aur bol-chaal'),
    3: ('communication, practice and initiative', 'baatcheet, practice aur pehel'),
    4: ('home, foundations and learning', 'ghar, buniyad aur seekhne'),
    5: ('learning and creative expression', 'seekhne aur creativity'),
    6: ('daily work, service and routines', 'roz ke kaam, service aur routine'),
    7: ('partnership and cooperation', 'partnership aur saath milkar kaam karne'),
    8: ('change and matters that need deeper understanding', 'badlav aur gehraai se samajhne'),
    9: ('higher learning, travel and shared outlook', 'padhai, safar aur milte-julte nazariye'),
    10: ('work and public responsibilities', 'kaam aur zimmedari'),
    11: ('friends, groups and networks', 'doston, groups aur jaan-pehchaan'),
    12: ('distance, reflection and private time', 'door ki jagahon, soch-vichar aur apne liye waqt'),
}
LABELS = {
    2: ('earnings', 'kamai'), 5: ('learning and romance', 'padhai aur romance'),
    7: ('partnerships', 'rishton'), 9: ('higher learning', 'aage ki padhai'),
    10: ('career', 'career'), 11: ('networks and gains', 'network aur gains'),
}
FOCUSED_THEMES = {
    ('career', 10, 11): ('Your career reading highlights work connected with groups and professional networks.',
                         'Career mein groups aur professional jaan-pehchaan se jude kaam ka theme dikhta hai.'),
    ('education', 5, 11): ('Your learning reading highlights groups and sharing ideas; study discussions are one way to explore this.',
                           'Padhai mein groups aur ideas share karne ka theme dikhta hai; study discussion is direction ko explore karne ka ek tareeka hai.'),
    ('relationship', 5, 11): ('For new connections, your romance reading highlights friends and social circles.',
                              'Naye connections ke sandarbh mein aapki romance reading ka sambandh doston aur social circle se dikhta hai.'),
    ('relationship', 7, 9): ('Your partnership reading highlights higher learning, travel and a shared outlook.',
                             'Rishton ki reading mein padhai, safar aur milte-julte nazariye se judi pehchaan ka theme dikhta hai.'),
    ('marriage', 7, 9): ('Your marriage reading connects partnership with higher learning, travel and a shared outlook.',
                         'Shaadi ki reading mein padhai, safar aur milte-julte nazariye se juda sambandh dikhta hai.'),
}


def assess_topic(lagna, positions, topic):
    if topic not in TOPICS or lagna not in SIGNS or not isinstance(positions, dict) or set(positions) != set(PLANETS):
        raise ValueError('Incomplete topic chart')
    asc = SIGNS.index(lagna)
    for planet, fact in positions.items():
        if (not isinstance(fact, dict) or set(fact) != {'planet', 'sign', 'house'} or
                fact['planet'] != planet or fact['sign'] not in SIGNS or type(fact['house']) is not int or
                fact['house'] != (SIGNS.index(fact['sign']) - asc) % 12 + 1):
            raise ValueError('Conflicting topic position')
    factors = []
    for target in TOPICS[topic]:
        planet = LORDS[(asc + target - 1) % 12]
        factors.append({'rules_house': target, **positions[planet]})
    return {'status': 'natal_themes_only', 'factors': factors, 'event_timing': 'not_evaluated',
            'strength': 'not_evaluated', 'divisional_charts': 'not_evaluated',
            'transits': 'not_evaluated', 'windows': []}


def render_topic(assessment, topic, language, intent, *, legacy=False):
    if topic not in TOPICS or language not in ('english', 'hinglish') or intent not in INTENTS:
        raise ValueError('Unsupported topic reading')
    if intent == 'contact' and topic != 'relationship':
        raise ValueError('Contact is relationship-only')
    hi = language == 'hinglish'
    paragraphs = []
    if intent == 'contact':
        paragraphs.append('Unke reply ka din aapki kundli se tay nahi hota. Aapki apni relationship reading mein yeh sandarbh milta hai:' if hi else
                          "Your chart cannot establish when they will reply. Your own relationship reading provides this context:")
    timing_limit = ('Is reading mein dasha, gochar aur grah-strength ko saath lekar timing ki jaanch nahi hui hai, isliye abhi koi date ya time-window nikalna sahi nahi hoga.' if hi else
                    'This reading has not assessed periods, transits and planetary strength together for event timing, so it does not establish a date or time window.')
    if intent == 'timing' and not legacy:
        paragraphs.append(timing_limit)
    # Contact concerns the user's partnerships, not the arrival of somebody new.
    factors = assessment['factors'][1:2] if intent in ('detail', 'contact') else assessment['factors'][:1]
    if legacy:
        factors = assessment['factors'][1:2] if intent == 'detail' else assessment['factors'][:1 if intent in ('overview', 'brief', 'contact') else 2]
    for f in factors:
        target, house = f['rules_house'], f['house']
        # The fifth house is used for learning or romance according to the topic.
        label = ('romance', 'romance') if target == 5 and topic in ('relationship', 'marriage') else (
            ('learning', 'padhai') if target == 5 else LABELS[target])
        if legacy and target == 2:
            label = ('resources', 'resources')
        theme = FOCUSED_THEMES.get((topic, target, house))
        if hi:
            meaning = theme[1] if theme else f"Aapki {label[1]} ki reading ka sambandh {THEMES[house][1]} se dikhta hai."
            paragraphs.append(meaning + ' ' +
                              f"Iska aadhar {HOUSE_NAMES[target - 1]} ghar ke swami {HINDI_NAMES[f['planet']]} ka {HOUSE_NAMES[house - 1]} ghar mein hona hai.")
        else:
            meaning = theme[0] if theme else f"Your {label[0]} reading connects with {THEMES[house][0]}."
            paragraphs.append(meaning + ' ' +
                              f"This is based on {f['planet']}, ruler of house {target}, being in house {house}.")
    if intent == 'timing' and legacy:
        paragraphs.append(timing_limit)
    return '\n\n'.join(paragraphs)


def validate_topic_result(result, request, now=None):
    """Reject stale/cross-birth data, altered conditions and unreviewed prose."""
    try:
        if (not isinstance(result, dict) or result.get('schema') != 'reviewed-topic-v1' or
                type(result.get('model_calls')) is not int or result['model_calls'] != 0 or
                type(result.get('model_tokens')) is not int or result['model_tokens'] != 0 or
                result.get('language') != request['language'] or result.get('intent') != request['intent'] or
                result.get('request_fingerprint') != request_fingerprint(request)):
            return False
        e = result['evidence']
        if (set(e) != {'schema', 'rules_revision', 'topic', 'input_fingerprint', 'as_of_utc',
                      'settings', 'lagna', 'positions', 'assessment', 'source'} or
                e['schema'] != 'natal-topic-assessment-v1' or e['rules_revision'] != REVISION or
                e['topic'] != request['topic'] or e['source'] != 'reviewed_whole_sign_house_themes' or
                not re.fullmatch(r'[a-f0-9]{64}', e['input_fingerprint'])):
            return False
        s = e['settings']
        if (s.get('engine') != 'pyswisseph' or s.get('ayanamsa') != 'LAHIRI' or
                s.get('house_system') != 'whole_sign' or s.get('node') not in ('true', 'mean') or
                type(s.get('dasha_year_days')) not in (int, float) or s['dasha_year_days'] != 365.25):
            return False
        stamp = datetime.fromisoformat(e['as_of_utc'].replace('Z', '+00:00'))
        now = now or datetime.now(timezone.utc)
        if stamp.tzinfo is None or not -30 <= (now - stamp).total_seconds() <= 120:
            return False
        expected = assess_topic(e['lagna'], e['positions'], request['topic'])
        # Roll out the validator first. Both exact reviewed renderings bind the
        # same evidence, so the previous server remains usable during rollout.
        approved = [render_topic(expected, request['topic'], request['language'], request['intent'], legacy=old)
                    for old in (False, True)]
        return e['assessment'] == expected and result['text'] in approved
    except (KeyError, ValueError, TypeError, AttributeError, OverflowError):
        return False
