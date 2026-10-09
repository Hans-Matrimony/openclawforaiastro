"""Render reviewed chart interpretations without a generative model.

Accept a chart, never caller-supplied prose or a prebuilt evidence packet.
Every personalized sentence comes from the verified packet's reviewed rules.
"""
from reading import reading_packet
from outcome_language import (
    english_theme, hinglish_theme, HINGLISH_PLANETS, HINGLISH_SIGNS, HINGLISH_HOUSE_NAMES,
    PERIOD_WORDING, NATAL_WORDING,
)
from datetime import datetime, timezone, timedelta


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


def _natal_reason(reason, hinglish):
    """Join the reviewed relationship meaning and its placement into one sentence."""
    fact = reason['fact']
    if reason['id'] not in ('SaturnIn7thNotLagnaLord', 'JupiterInHouse7', 'House7LordInHouse4'):
        return NATAL_WORDING[reason['id']][1 if hinglish else 0] + _basis(fact, hinglish)
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
    if intent == 'overview' and assessment['conclusion']['status'] == 'limited':
        paragraphs.append('Kundli ke in sanketon se abhi koi saaf anukool ya pratikool nateeja nahi nikalta.'
                          if hinglish else 'These chart indications do not point clearly to a favorable or adverse outcome.')
    if intent == 'timing':
        if windows:
            primary = windows[0]
            dates = f"{_month(primary['start'])} se {_month(primary['end'])}" if hinglish else f"{_month(primary['start'])} to {_month(primary['end'])}"
            if primary['priority'] == 2:
                lead = f"Is dasha-based reading mein shaadi ke liye zyada anukool window {dates} hai."
                english = f"In this comparison of dasha periods, the more supportive marriage window is {dates}."
            else:
                lead = f"Is dasha-based reading mein shaadi ka ek sambhavit period {dates} hai."
                english = f"This dasha reading indicates a possible marriage period of {dates}."
            major = HINGLISH_PLANETS[primary['mahadasha']] if hinglish else primary['mahadasha']
            minor = HINGLISH_PLANETS[primary['antardasha']] if hinglish else primary['antardasha']
            paragraphs.append((lead + f" Yeh {major} {minor} period ka conditional sanket hai, shaadi ki pakki date nahi."
                               if hinglish else english + f" It comes from the {major} {minor} period and is conditional, not a fixed wedding date."))
            if len(windows) > 1 and style != 'brief':
                other = windows[1]
                dates = f"{_month(other['start'])} se {_month(other['end'])}" if hinglish else f"{_month(other['start'])} to {_month(other['end'])}"
                if other['priority'] < primary['priority']:
                    alternative = (f"{dates} mein bhi shaadi ka sanket hai, par is comparison mein yeh kam anukool hai."
                                   if hinglish else f"Another indicated period is {dates}; it has less support in this comparison.")
                else:
                    alternative = f"Ek aur sambhavit period {dates} hai." if hinglish else f"Another indicated period is {dates}."
                paragraphs[-1] += ' ' + alternative
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
            parts.append(_natal_reason(reason, hinglish) if style != 'brief' else
                         NATAL_WORDING[reason['id']][1 if hinglish else 0])
        paragraphs.append(' '.join(parts))
    if current['status'] != 'unsupported' and (intent == 'overview' or not windows or style == 'detailed'):
        if current['mahadasha'] == 'Venus' and (current['antardasha'], topic) in PERIOD_WORDING:
            wording = PERIOD_WORDING[(current['antardasha'], topic)][1 if hinglish else 0]
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
        paragraphs.append(lead + wording + (f" Yeh period {_month(current['end'])} tak hai." if hinglish else f" This period runs until {_month(current['end'])}."))
        if timing_limit:
            paragraphs[-1] += ' ' + timing_limit
            timing_limit = None
    if style != 'brief':
        # Add only distinct chart reasons; do not repeat the same planet/house.
        used = {(reason['fact']['planet'], reason['fact']['house']) for reason in natal['reasons'][:3 if style == 'detailed' else 2]}
        extras = []
        for factor in packet['factors']:
            identity = (factor['fact']['planet'], factor['fact']['house'])
            if identity in used:
                continue
            used.add(identity)
            text = hinglish_theme(factor, topic=topic, include_advice=False) if hinglish else english_theme(factor, topic=topic, include_advice=False)
            extras.append(text + _basis(factor['fact'], hinglish))
            if len(extras) >= (2 if style == 'detailed' or not natal['reasons'] else 1):
                break
        if extras:
            paragraphs.append(' '.join(extras))
    elif not natal['reasons'] and intent != 'timing':
        factor = packet['factors'][0]
        paragraphs.append(hinglish_theme(factor, topic=topic, include_advice=False) if hinglish else english_theme(factor, topic=topic, include_advice=False))
    if style != 'brief' and packet.get('provider', {}).get('name') == 'vedastro-local':
        from render_reading import native_supporting_detail
        detail = native_supporting_detail(packet, hinglish, detailed=style == 'detailed')
        if style == 'standard':
            detail = detail.replace('; yeh aapki ability ya failure ka faisla nahi hai', '').replace('; this does not measure your ability or predict failure', '')
        if style == 'standard' and paragraphs:
            paragraphs[-1] += ' ' + detail
        else:
            paragraphs.append(detail)
    # Full analysis limits remain in evidence. Surface a limitation only when it
    # affects this answer (timing above, uncertain birth input below), not as filler.
    if any(isinstance(warning, str) and warning.startswith('Moon is ') and 'boundary' in warning
           for warning in packet['calculation_warnings']):
        # Warnings are intentionally not interpolated: upstream data can contain prose.
        paragraphs.append('Chandra ki placement boundary ke paas hai; birth time uncertain ho toh pehle confirm karein.'
                          if hinglish else 'The Moon is near a placement boundary; confirm an uncertain birth time before relying on it.')
    if style == 'brief':
        warning = paragraphs[-1] if any('boundary' in p for p in paragraphs[-1:]) else None
        paragraphs = [' '.join(paragraphs[:1 if intent == 'timing' and windows else 2])]
        if warning and warning not in paragraphs[0]:
            paragraphs[0] += ' ' + warning
    return {'schema': 'reviewed-reading-v2', 'text': '\n\n'.join(paragraphs),
            'evidence': packet, 'language': language, 'intent': intent,
            'model_calls': 0, 'model_tokens': 0, 'style': style, 'follow_up': follow_up}
