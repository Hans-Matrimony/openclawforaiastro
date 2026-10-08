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
    if intent == 'overview' and assessment['conclusion']['status'] == 'limited':
        paragraphs.append('Reviewed indications se koi saaf anukool ya pratikool nateeja tay nahi hota.'
                          if hinglish else 'The reviewed indications do not establish a clear favorable or adverse outcome.')
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
            if len(windows) > 1:
                other = windows[1]
                dates = f"{_month(other['start'])} se {_month(other['end'])}" if hinglish else f"{_month(other['start'])} to {_month(other['end'])}"
                if other['priority'] < primary['priority']:
                    alternative = (f"{dates} mein bhi shaadi ka sanket hai, par is comparison mein yeh kam anukool hai."
                                   if hinglish else f"Another indicated period is {dates}; it has less support in this comparison.")
                else:
                    alternative = f"Ek aur sambhavit period {dates} hai." if hinglish else f"Another indicated period is {dates}."
                paragraphs.append(alternative)
        else:
            target = {'marriage': ('shaadi', 'marriage'), 'career': ('job ya promotion', 'job or promotion'),
                      'education': ('admission ya exam result', 'admission or exam result'),
                      'finance': ('financial recovery', 'financial recovery')}[topic]
            paragraphs.append(f"Is reading se {target[0]} ka bharosemand timeframe nahi milta."
                              if hinglish else f"This reading does not establish a reliable timeframe for {target[1]}.")
    if natal['reasons']:
        label = {'mixed': ('Indications mixed hain.', 'The indications are mixed.'),
                 'adverse': ('Checked indications pratikool hain.', 'The checked indications are adverse.'),
                 'supportive': ('Checked indications anukool hain.', 'The checked indications are supportive.')}[assessment['conclusion']['status']][0 if hinglish else 1]
        parts = [label]
        for reason in natal['reasons'][:3 if style == 'detailed' else 2]:
            parts.append(NATAL_WORDING[reason['id']][0 if not hinglish else 1] +
                         (_basis(reason['fact'], hinglish) if style != 'brief' else ''))
        paragraphs.append(' '.join(parts))
    if current['status'] != 'unsupported' and (intent == 'overview' or not windows or style == 'detailed'):
        wording = PERIOD_WORDING[(current['antardasha'], topic)][1 if hinglish else 0]
        paragraphs.append(wording + (f" Yeh period {_month(current['end'])} tak hai." if hinglish else f" This period runs until {_month(current['end'])}."))
    if not natal['reasons'] and (intent == 'overview' or not windows or style == 'detailed'):
        for factor in packet['factors'][:1]:
            text = hinglish_theme(factor, topic=topic, include_advice=False) if hinglish else english_theme(factor, topic=topic, include_advice=False)
            paragraphs.append(text + _basis(factor['fact'], hinglish))
    if style == 'detailed' and packet.get('provider', {}).get('name') == 'vedastro-local':
        from render_reading import native_supporting_detail
        paragraphs.append(native_supporting_detail(packet, hinglish, detailed=True))
    # Full analysis limits remain in evidence. Surface a limitation only when it
    # affects this answer (timing above, uncertain birth input below), not as filler.
    if any(isinstance(warning, str) and warning.startswith('Moon is ') and 'boundary' in warning
           for warning in packet['calculation_warnings']):
        # Warnings are intentionally not interpolated: upstream data can contain prose.
        paragraphs.append('Chandra ki placement boundary ke paas hai; birth time uncertain ho toh pehle confirm karein.'
                          if hinglish else 'The Moon is near a placement boundary; confirm an uncertain birth time before relying on it.')
    return {'schema': 'reviewed-reading-v2', 'text': '\n\n'.join(paragraphs),
            'evidence': packet, 'language': language, 'intent': intent,
            'model_calls': 0, 'model_tokens': 0, 'style': style, 'follow_up': follow_up}
