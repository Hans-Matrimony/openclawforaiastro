"""Render reviewed chart interpretations without a generative model.

Accept a chart, never caller-supplied prose or a prebuilt evidence packet.
Every personalized sentence comes from the verified packet's reviewed rules.
"""
from reading import reading_packet
from reading_language import hinglish_theme


QUESTIONS = {
    'career': 'Which work options are you considering in real life?',
    'education': 'What are you studying, or which courses are you considering?',
    'marriage': 'Would you like to think through expectations about communication and living together?',
}


def render_reading(chart, topic, *, as_of_utc=None, language='english', intent='overview'):
    if language not in ('english', 'hinglish') or intent not in ('overview', 'timing'):
        raise ValueError('Unsupported reading language or intent')
    if intent == 'timing' and topic != 'marriage':
        raise ValueError('Unsupported timing question')
    packet = reading_packet(chart, topic, as_of_utc=as_of_utc)
    hinglish = language == 'hinglish'
    paragraphs = []
    if intent == 'timing':
        paragraphs.append(
            'In verified chart factors se shaadi ka saal ya date reliably tay nahi hoti. Dasha ki start/end dates ko shaadi ki prediction nahi maana ja sakta.'
            if hinglish else
            'These verified chart factors do not establish when you will marry. Calculated dasha boundaries alone are not evidence of a marriage window.')
    # Keep the strongest topic factor and one additional factor; the full packet
    # remains available for traceability. No sign-based personality filler.
    for factor in packet['factors'][:2]:
        fact = factor['fact']
        if hinglish:
            role = f", house {fact['rules_house']} ke lord," if 'rules_house' in fact else ''
            paragraphs.append(hinglish_theme(factor) +
                f" Iska chart basis: {fact['planet']}{role} house {fact['house']} mein hain ({fact['sign']}).")
        else:
            role = f", ruler of house {fact['rules_house']}," if 'rules_house' in fact else ''
            paragraphs.append(factor['traditional_theme'] +
                f" The chart basis is {fact['planet']}{role} in house {fact['house']} ({fact['sign']}).")
    paragraphs.append(
        'Yeh traditional themes hain, guarantees nahi; strength, aspects aur divisional charts evaluate nahi hue hain.'
        if hinglish else
        'These are traditional themes, not guarantees; strength, aspects and divisional charts have not been evaluated.')
    if any(isinstance(warning, str) and warning.startswith('Moon is ') and 'boundary' in warning
           for warning in packet['calculation_warnings']):
        # Warnings are intentionally not interpolated: upstream data can contain prose.
        paragraphs.append('Moon placement ki boundary ke paas hai; birth time uncertain ho toh pehle confirm karein.'
                          if hinglish else 'The Moon is near a placement boundary; confirm an uncertain birth time before relying on it.')
    if intent == 'overview':
        questions = {'career': 'Aap kaunse work options soch rahe hain?',
                     'education': 'Aap kya padh rahe hain, ya kaunse courses soch rahe hain?',
                     'marriage': 'Saath rehne aur communication ki expectations par baat karna chahenge?'}
        paragraphs.append(questions[topic] if hinglish else QUESTIONS[topic])
    return {'schema': 'reviewed-reading-v1', 'text': '\n\n'.join(paragraphs),
            'evidence': packet, 'language': language, 'intent': intent,
            'model_calls': 0, 'model_tokens': 0}
