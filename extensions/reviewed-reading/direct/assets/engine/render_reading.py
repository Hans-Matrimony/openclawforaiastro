"""Render reviewed chart interpretations without a generative model.

Accept a chart, never caller-supplied prose or a prebuilt evidence packet.
Every personalized sentence comes from the verified packet's reviewed rules.
"""
from reading import reading_packet
from reading_language import (
    english_theme, hinglish_theme, HINGLISH_PLANETS, HINGLISH_SIGNS, HINGLISH_HOUSE_NAMES,
)


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
            'Shaadi ki exact date ya saal abhi tay nahi kiya ja sakta. Aapki reading mein relationship ke jo themes dikhte hain, unhe samjha sakte hain.'
            if hinglish else
            'A marriage date or year cannot be established from this reading. I can explain the relationship themes it does support.')
    # Keep the strongest topic factor and one additional factor; the full packet
    # remains available for traceability. No sign-based personality filler.
    for factor in packet['factors'][:2]:
        fact = factor['fact']
        if hinglish:
            role = f"{HINGLISH_HOUSE_NAMES[fact['rules_house']]} ghar ke swami " if 'rules_house' in fact else ''
            paragraphs.append(hinglish_theme(factor, topic=topic) +
                f" Iska aadhar {role}{HINGLISH_PLANETS[fact['planet']]} ka {HINGLISH_SIGNS[fact['sign']]} rashi ke {HINGLISH_HOUSE_NAMES[fact['house']]} ghar mein hona hai.")
        else:
            role = f", ruler of house {fact['rules_house']}," if 'rules_house' in fact else ''
            paragraphs.append(english_theme(factor, topic=topic) +
                f" This comes from {fact['planet']}{role} in house {fact['house']} ({fact['sign']}).")
    # Full analysis limits remain in evidence. Surface a limitation only when it
    # affects this answer (timing above, uncertain birth input below), not as filler.
    if any(isinstance(warning, str) and warning.startswith('Moon is ') and 'boundary' in warning
           for warning in packet['calculation_warnings']):
        # Warnings are intentionally not interpolated: upstream data can contain prose.
        paragraphs.append('Chandra ki placement boundary ke paas hai; birth time uncertain ho toh pehle confirm karein.'
                          if hinglish else 'The Moon is near a placement boundary; confirm an uncertain birth time before relying on it.')
    return {'schema': 'reviewed-reading-v1', 'text': '\n\n'.join(paragraphs),
            'evidence': packet, 'language': language, 'intent': intent,
            'model_calls': 0, 'model_tokens': 0}
