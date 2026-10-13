"""Render reviewed chart interpretations without a generative model.

Accept a chart, never caller-supplied prose or a prebuilt evidence packet.
Every personalized sentence comes from the verified packet's reviewed rules.
"""
from reading import reading_packet
from outcome_language import (
    english_theme, hinglish_theme, HINGLISH_PLANETS, HINGLISH_SIGNS, HINGLISH_HOUSE_NAMES,
    PERIOD_WORDING, OVERVIEW_PERIOD_WORDING, NATAL_WORDING,
)
from datetime import datetime, timezone, timedelta
import re


def _chat_paragraphs(paragraphs, limit=340):
    """Keep sentence boundaries below the existing client's word-cut threshold.

    Do not abbreviate dates, omit adverse findings, or split decimal strengths.
    An unusually long single sentence stays intact for the client's fallback.
    """
    result = []
    for paragraph in paragraphs:
        sentences = re.split(r'(?<=[.!?])\s+', paragraph.strip())
        chunk = ''
        for sentence in sentences:
            if chunk and len(chunk) + len(sentence) + 1 > limit:
                result.append(chunk)
                chunk = ''
            chunk = (chunk + ' ' + sentence).strip()
        if chunk:
            result.append(chunk)
    return result


def _month(value):
    # Birth and comparison settings remain UTC; user-facing periods use IST.
    date = datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(timezone(timedelta(hours=5.5)))
    months = ('January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December')
    return f'{months[date.month - 1]} {date.year}'


def _basis(fact, hinglish):
    if hinglish:
        role = f"{HINGLISH_HOUSE_NAMES[fact['rules_house']]} ghar ke swami " if 'rules_house' in fact else ''
        return f" Iska aadhar {role}{HINGLISH_PLANETS[fact['planet']]} ka {HINGLISH_SIGNS[fact['sign']]} rashi ke {HINGLISH_HOUSE_NAMES[fact['house']]} ghar mein hona hai."
    role = f", ruler of house {fact['rules_house']}," if 'rules_house' in fact else ''
    return f" This comes from {fact['planet']}{role} in house {fact['house']} ({fact['sign']})."


def _conversational_basis(fact, hinglish):
    """Same placement, expressed as a reason rather than a separate report label."""
    if hinglish:
        role = f"{HINGLISH_HOUSE_NAMES[fact['rules_house']]} ghar ke swami " if 'rules_house' in fact else ''
        return f"{role}{HINGLISH_PLANETS[fact['planet']]} {HINGLISH_SIGNS[fact['sign']]} ke {HINGLISH_HOUSE_NAMES[fact['house']]} ghar mein hain"
    role = f", ruler of house {fact['rules_house']}," if 'rules_house' in fact else ''
    return f"{fact['planet']}{role} is in {fact['sign']} in house {fact['house']}"


def _factor_reason(factor, topic, hinglish, compact=False):
    if compact and topic == 'marriage' and factor['id'] == 'House7LordInHouse4':
        fact = factor['fact']
        return (f"Shaadi ke swami {HINGLISH_PLANETS[fact['planet']]} {HINGLISH_SIGNS[fact['sign']]} ke {HINGLISH_HOUSE_NAMES[fact['house']]} ghar mein hain; yahan ghar aur saath rehne ke sukoon par zor hai."
                if hinglish else f"{fact['planet']}, your marriage-house ruler, is in {fact['sign']} in house {fact['house']}, linking the relationship reading with home and comfort in living together.")
    text = hinglish_theme(factor, topic=topic, include_advice=False) if hinglish else english_theme(factor, topic=topic, include_advice=False)
    # Remove presentation filler only; never infer a new talent, trait or outcome.
    for prefix in ('Aapki career reading mein ', 'Aapki education reading mein ',
                   'Aapki relationship reading mein ', 'Aapki reading mein '):
        if text.startswith(prefix):
            text = text[len(prefix):]
            topic_prefix = {'career': 'Career mein ', 'education': 'Padhai mein ',
                            'marriage': 'Rishte mein ', 'finance': 'Paise ke maamle mein '}[topic]
            text = topic_prefix + text
            break
    for report, conversational in (('Padhai ki reading mein ', 'Padhai mein '),
                                    ('Paise ki reading mein ', 'Paise ke maamle mein '),
                                    ('Shaadi ki reading mein ', 'Rishte mein '),
                                    ('Rishte ki reading mein ', 'Rishte mein '),
                                    ('Career ki reading mein ', 'Career mein ')):
        if text.startswith(report):
            text = conversational + text[len(report):]
            break
    if hinglish:
        # Translate the existing theme, not the user's abilities or future.
        text = text.replace(' ka sambandh aata hai.', ' par zor hai.')
        text = text.replace(' ka theme hai.', ' ka pehlu khaas hai.')
    return text.rstrip('.') + ' — ' + _conversational_basis(factor['fact'], hinglish) + '.'


def _reviewed_next_step(factor, topic, hinglish):
    """Use only the optional action already reviewed for this exact factor.

    A suggested activity is not evidence of aptitude, a prediction or a remedy
    guaranteed to alter an event. Fall back to no advice for other rule shapes.
    """
    theme = hinglish_theme if hinglish else english_theme
    finding = theme(factor, topic=topic, include_advice=False)
    complete = theme(factor, topic=topic, include_advice=True)
    prefix = finding + ' '
    return complete[len(prefix):] if complete.startswith(prefix) else ''


def _natal_reason(reason, hinglish, compact=False):
    """Join the reviewed relationship meaning and its placement into one sentence."""
    fact = reason['fact']
    if reason['id'] not in ('SaturnIn7thNotLagnaLord', 'JupiterInHouse7', 'House7LordInHouse4'):
        return NATAL_WORDING[reason['id']][1 if hinglish else 0] + _basis(fact, hinglish)
    if compact:
        if reason['id'] == 'House7LordInHouse4':
            return _factor_reason(reason, 'marriage', hinglish, compact=True)
        names = HINGLISH_PLANETS if hinglish else {fact['planet']: fact['planet']}
        meanings = {
            'SaturnIn7thNotLagnaLord': ('rishte mein tanav', 'strain in the relationship'),
            'JupiterInHouse7': ('rishte ke liye sahyog', 'support for the relationship'),
            'House7LordInHouse4': ('ghar aur saath rehne ke comfort', 'home and comfort in living together'),
        }
        meaning = meanings[reason['id']][0 if hinglish else 1]
        return (f"{names[fact['planet']]} {HINGLISH_SIGNS[fact['sign']]} ke {HINGLISH_HOUSE_NAMES[fact['house']]} ghar mein {meaning} se jude hain."
                if hinglish else f"{fact['planet']} in {fact['sign']} in house {fact['house']} is associated with {meaning}.")
    if hinglish:
        role = 'Shaadi ke saatve ghar ke swami ' if 'rules_house' in fact else ''
        basis = f"{role}{HINGLISH_PLANETS[fact['planet']]} {HINGLISH_SIGNS[fact['sign']]} rashi ke {HINGLISH_HOUSE_NAMES[fact['house']]} ghar mein hain"
        meaning = {'SaturnIn7thNotLagnaLord':'rishton mein tanav ka traditional sanket',
                   'JupiterInHouse7':'relationship ke liye support ka traditional sanket',
                   'House7LordInHouse4':'ghar aur saath rehne ke comfort se juda traditional sanket'}[reason['id']]
        return basis + ', jo ' + meaning + ' hai.'
    role = ', ruler of house 7,' if 'rules_house' in fact else ''
    basis = f"{fact['planet']}{role} is in {fact['sign']} in house {fact['house']}"
    meaning = {'SaturnIn7thNotLagnaLord':'strain in relationship harmony',
               'JupiterInHouse7':'support for the relationship',
               'House7LordInHouse4':'home and comfort in living together'}[reason['id']]
    return basis + ', a traditional indication of ' + meaning + '.'


def render_reading(chart, topic, *, as_of_utc=None, language='english', intent='overview', contract_version=2, style='standard', follow_up=True):
    if language not in ('english', 'hinglish') or intent not in ('overview', 'timing'):
        raise ValueError('Unsupported reading language or intent')
    if type(contract_version) is not int or contract_version not in (1, 2):
        raise ValueError('Unsupported reading contract')
    if style not in ('brief', 'standard', 'detailed') or type(follow_up) is not bool:
        raise ValueError('Unsupported reading presentation')
    packet = reading_packet(chart, topic, as_of_utc=as_of_utc, contract_version=2)
    if contract_version != 2:
        raise ValueError('Outcome renderer requires contract 2')
    hinglish = language == 'hinglish'
    paragraphs = []
    assessment = packet['prediction_assessment']
    natal = assessment['natal']
    current = assessment['current_period']
    windows = assessment['event']['windows']
    timing_limit = None
    combined_marriage_reasons = False
    if (intent == 'overview' and assessment['conclusion']['status'] == 'limited'
            and style == 'detailed' and not packet['factors']):
        paragraphs.append('Kundli ke in sanketon se abhi koi saaf anukool ya pratikool nateeja nahi nikalta.'
                          if hinglish else 'These chart indications do not point clearly to a favorable or adverse outcome.')
    if intent == 'timing':
        if windows:
            primary = windows[0]
            dates = f"{_month(primary['start'])} se {_month(primary['end'])}" if hinglish else f"{_month(primary['start'])} to {_month(primary['end'])}"
            major = HINGLISH_PLANETS[primary['mahadasha']] if hinglish else primary['mahadasha']
            minor = HINGLISH_PLANETS[primary['antardasha']] if hinglish else primary['antardasha']
            # All lengths use the same natural qualification. Detail belongs
            # in the explanation, not in a second boilerplate disclaimer.
            if primary['priority'] == 2:
                paragraphs.append(f"Aapki shaadi ke liye {dates} ka {major}-{minor} daur zyada anukool dikhta hai."
                                  if hinglish else f"The {major}-{minor} period from {dates} looks more favorable for marriage in this dasha reading.")
            else:
                paragraphs.append(f"Shaadi ka ek sambhavit daur {dates} hai, {major}-{minor} dasha ke hisaab se."
                                  if hinglish else f"The {major}-{minor} dasha points to a possible marriage period from {dates}.")
            if len(windows) > 1 and style != 'brief':
                other = windows[1]
                dates = f"{_month(other['start'])} se {_month(other['end'])}" if hinglish else f"{_month(other['start'])} to {_month(other['end'])}"
                if other['priority'] < primary['priority']:
                    alternative = (f"{dates} mein bhi shaadi ka sanket hai, lekin support kam hai." if hinglish else
                                   f"{dates} also carries a marriage indication, with less support in this comparison.")
                else:
                    alternative = f"Ek aur sambhavit period {dates} hai." if hinglish else f"Another indicated period is {dates}."
                paragraphs[-1] += ' ' + alternative
            # Standard wording already qualifies this as a possible or more
            # favorable dasha period. Do not repeat a certainty disclaimer.
            # The evidence retains the complete conditional event assessment.
        else:
            target = {'marriage': ('shaadi', 'marriage'), 'career': ('job ya promotion', 'job or promotion'),
                      'education': ('admission ya exam result', 'admission or exam result'),
                      'finance': ('financial recovery', 'financial recovery')}[topic]
            timing_limit = (f"Is reading se {target[0]} ka bharosemand timeframe nahi milta."
                            if hinglish else f"This reading does not establish a reliable timeframe for {target[1]}.")
            if topic == 'marriage' or current['status'] == 'unsupported':
                paragraphs.append(timing_limit)
                timing_limit = None
    if natal['reasons']:
        label = {'mixed': ('Kundli mein support aur rukawat, dono ke sanket hain.', 'Your chart has both supportive and challenging indications.'),
                 'adverse': ('Is reading mein rukawat ke sanket zyada hain.', 'This reading shows more challenging indications.'),
                 'supportive': ('Is reading mein anukool sanket zyada hain.', 'This reading shows more supportive indications.')}[assessment['conclusion']['status']][0 if hinglish else 1]
        parts = [label]
        for reason in natal['reasons'][:3 if style == 'detailed' else 2]:
            parts.append(_natal_reason(reason, hinglish, compact=style in ('standard', 'brief')))
        # Combine this assessed opposition without turning a harmony warning
        # into marriage denial or inferring a new delay. Other rule sets keep
        # their existing individual reasons and polarity label.
        by_id = {reason['id']: reason['fact'] for reason in natal['reasons'][:2]}
        if (style in ('standard', 'detailed') and topic == 'marriage'
                and set(by_id) == {'SaturnIn7thNotLagnaLord', 'JupiterInHouse7'}):
            saturn, jupiter = by_id['SaturnIn7thNotLagnaLord'], by_id['JupiterInHouse7']
            if saturn['house'] == jupiter['house'] == 7 and saturn['sign'] == jupiter['sign']:
                parts = ([f"{HINGLISH_SIGNS[jupiter['sign']]} ke saatve ghar mein Guru rishte ke liye sahyog ka sanket dete hain, jabki wahin Shani tanav dikhate hain."] if hinglish else
                         [f"Jupiter in {jupiter['sign']} in house 7 indicates support for the relationship, while Saturn there indicates strain."])
                if style == 'detailed':
                    parts.extend(_natal_reason(reason, hinglish, compact=True) for reason in natal['reasons'][2:3])
                combined_marriage_reasons = True
        paragraphs.append(' '.join(parts))
    if current['status'] != 'unsupported' and (intent == 'overview' or not windows or style == 'detailed'):
        from period_rules import marriage_period_wording
        scoped_marriage = (marriage_period_wording(current['rule_id'], hinglish)
                           if topic == 'marriage' and packet['rules_revision'] == 'reviewed-outcomes-v3' else None)
        if scoped_marriage is not None:
            wording = scoped_marriage
        elif current['mahadasha'] == 'Venus' and (current['antardasha'], topic) in PERIOD_WORDING:
            key = (current['antardasha'], topic)
            wordings = OVERVIEW_PERIOD_WORDING if intent == 'overview' and style != 'detailed' else {}
            wording = wordings.get(key, PERIOD_WORDING[key])[1 if hinglish else 0]
        else:
            from period_rules import period_wording
            wording = period_wording(topic, current['status'], hinglish)
        if timing_limit:
            # The single timing qualification below replaces repeated result limits.
            wording = wording.split('. ', 1)[0].rstrip('.') + '.'
        major = HINGLISH_PLANETS[current['mahadasha']] if hinglish else current['mahadasha']
        minor = HINGLISH_PLANETS[current['antardasha']] if hinglish else current['antardasha']
        lead = (f"Abhi {major} mahadasha mein {minor} antardasha chal rahi hai. " if hinglish else
                f"You are currently in the {major} major period and {minor} subperiod. ")
        # An ordinary overview needs the period's meaning, not an unsolicited
        # deadline. Detailed and timing answers retain the labelled boundary.
        boundary = ''
        if style == 'detailed' or intent == 'timing':
            boundary = (f" Yeh period {_month(current['end'])} tak hai." if hinglish else
                        f" This period runs until {_month(current['end'])}.")
        paragraphs.append(lead + wording + boundary)
        if timing_limit:
            paragraphs[-1] += ' ' + timing_limit
            timing_limit = None
    if style != 'brief':
        # Add only distinct chart reasons; do not repeat the same planet/house.
        used = {(reason['fact']['planet'], reason['fact']['house']) for reason in natal['reasons'][:3 if style == 'detailed' else 2]}
        extras = []
        # Occupational examples add the specific direction that a generic
        # topic-ruler paragraph cannot supply. Retain the bounded three-factor
        # packet when present, rather than silently dropping its last example.
        example_ids = {'MercuryInHouse4', 'JupiterInHouse1'}
        extra_limit = 3 if any(f['id'] in example_ids for f in packet['factors']) else (2 if style == 'detailed' else 1)
        for factor in packet['factors']:
            identity = (factor['fact']['planet'], factor['fact']['house'])
            if identity in used:
                continue
            used.add(identity)
            extras.append(_factor_reason(factor, topic, hinglish, compact=True))
            if len(extras) >= extra_limit:
                break
        if extras:
            if combined_marriage_reasons and intent == 'timing' and windows:
                paragraphs[-1] += ' ' + ' '.join(extras)
            else:
                paragraphs.append(' '.join(extras))
    elif not natal['reasons'] and intent != 'timing':
        factor = packet['factors'][0]
        # Brief direction readings must retain the reason before period context.
        paragraphs.insert(0, _factor_reason(factor, topic, hinglish, compact=True))
    if style == 'detailed' and packet.get('provider', {}).get('name') == 'vedastro-local':
        from render_reading import native_supporting_detail
        # Raw strength/divisional facts are still present in the packet. They
        # are not an assessed reason for the outcome and need not pad a short
        # answer. Explicit detailed readings continue to show their nuance.
        paragraphs.append(native_supporting_detail(packet, hinglish, detailed=True))
    # Full analysis limits remain in evidence. Surface a limitation only when it
    # affects this answer (timing above, uncertain birth input below), not as filler.
    if any(isinstance(warning, str) and warning.startswith('Moon is ') and 'boundary' in warning
           for warning in packet['calculation_warnings']):
        # Warnings are intentionally not interpolated: upstream data can contain prose.
        paragraphs.append('Chandra ki placement boundary ke paas hai; birth time uncertain ho toh pehle confirm karein.'
                          if hinglish else 'The Moon is near a placement boundary; confirm an uncertain birth time before relying on it.')
    if style == 'standard':
        # A direction question should lead with its chart-supported direction,
        # not a generic absence-of-certainty sentence. Mixed/adverse labels stay.
        if intent == 'overview' and not natal['reasons'] and extras:
            factor_paragraph = next(p for p in paragraphs if p.startswith(extras[0]))
            paragraphs.remove(factor_paragraph)
            paragraphs.insert(0, factor_paragraph)
        if intent == 'overview' and packet['factors']:
            # One relevant practical option gives a direction reading substance
            # without padding it with additional, unassessed chart claims.
            step = _reviewed_next_step(packet['factors'][0], topic, hinglish)
            if step and not any(step in paragraph for paragraph in paragraphs):
                paragraphs.append(step)
        # Do not merge every remaining fact into one oversized paragraph:
        # the PWA splits it at an arbitrary word (e.g. "Shadbala assessment").
        # Preserve the answer/evidence sections and every complete sentence.
        paragraphs = _chat_paragraphs(paragraphs)
    if style == 'brief':
        warning = paragraphs[-1] if any('boundary' in p for p in paragraphs[-1:]) else None
        paragraphs = [' '.join(paragraphs[:1 if intent == 'timing' and windows else 2])]
        if warning and warning not in paragraphs[0]:
            paragraphs[0] += ' ' + warning
    return {'schema': 'reviewed-reading-v2', 'text': '\n\n'.join(paragraphs),
            'evidence': packet, 'language': language, 'intent': intent,
            'model_calls': 0, 'model_tokens': 0, 'style': style, 'follow_up': follow_up}
