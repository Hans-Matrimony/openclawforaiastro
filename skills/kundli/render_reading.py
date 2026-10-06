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
    advanced = packet['advanced']
    ruler = advanced['topic_ruler']
    detail = (f"D{ruler['division']} mein {ruler['planet']} {ruler['divisional_sign']} mein hain"
              if hinglish else f"In D{ruler['division']}, {ruler['planet']} is in {ruler['divisional_sign']}")
    if ruler['divisional_house'] is not None:
        detail += (f", house {ruler['divisional_house']}" if hinglish else f", house {ruler['divisional_house']}")
    if ruler['d1_own_sign']:
        detail += ('; D1 mein apni rashi mein hain' if hinglish else '; it occupies its own sign in D1')
    if ruler['d1_dignity']['exaltation_sign']:
        detail += ('; D1 mein uccha rashi mein hain' if hinglish else '; D1 places it in its traditional exaltation sign')
    elif ruler['d1_dignity']['debilitation_sign']:
        detail += ('; D1 mein neecha rashi mein hain, jo akela failure ka proof nahi hai' if hinglish else '; D1 places it in its traditional debilitation sign, which alone does not establish failure')
    if ruler['same_d1_divisional_sign']:
        detail += ('; D1 aur is division mein rashi same hai' if hinglish else '; its sign repeats from D1 in this division')
    aspects = advanced['full_sign_aspects_to_topic_house']
    if aspects:
        names = ', '.join(a['planet'] for a in aspects)
        detail += (f". {names} ki full sign drishti house {ruler['rules_house']} par hai"
                   if hinglish else f". {names} casts a full sign aspect on house {ruler['rules_house']}")
    paragraphs.append(detail + '.')
    if intent == 'timing':
        major_name, major = next(iter(packet['current_period']['mahadashas'].items()))
        sub_name, sub = next(iter(major['antardashas'].items()))
        paragraphs.append(
            (f"Abhi {major_name} mahadasha aur {sub_name} antardasha hai; antardasha ki calculated UTC boundary {sub['start'][:10]} se {sub['end'][:10]} hai. Isse shaadi ki date ya favorable window tay nahi hoti."
             if hinglish else
             f"The current calculated period is {major_name} mahadasha / {sub_name} antardasha, with UTC boundaries {sub['start'][:10]} to {sub['end'][:10]}. This does not establish a marriage date or favorable window."))
    paragraphs.append(
        'Yeh traditional themes hain; poori Shadbala strength, transits aur event timing evaluate nahi hue hain.'
        if hinglish else
        'These are traditional themes; full Shadbala strength, transits and event timing have not been evaluated.')
    if ruler['near_divisional_boundary'] or ruler['near_divisional_ascendant_boundary']:
        paragraphs.append('Division ki boundary paas hai; birth time approximate ho toh is detail par bharosa karne se pehle confirm karein.'
                          if hinglish else 'This divisional placement is near a boundary; confirm an approximate birth time before relying on it.')
    if any(isinstance(warning, str) and warning.startswith('Moon is ') and 'boundary' in warning
           for warning in packet['calculation_warnings']):
        # Warnings are intentionally not interpolated: upstream data can contain prose.
        paragraphs.append('Moon placement ki boundary ke paas hai; birth time uncertain ho toh pehle confirm karein.'
                          if hinglish else 'The Moon is near a placement boundary; confirm an uncertain birth time before relying on it.')
    if intent == 'overview':
        # Practical decision support, explicitly independent of astrological
        # claims about aptitude, future events or another person's feelings.
        practical = {
            'career': ('Practical taur par, do pasand ke roles ki skills aur daily work compare karein; ek chhota project karke apna interest check kar sakte hain.',
                       'For a practical next step, compare the skills and daily work of two roles you like; try a small project to explore your interest.'),
            'education': ('Course choose karte waqt syllabus, fees, apni pasand aur ab tak ke study experience ko saath dekhein; chart se aapki ability ya exam result tay nahi hota.',
                          'Compare course content, fees, your interests and your study experience; the chart does not establish your abilities or exam results.'),
            'marriage': ('Practical taur par, partner ke saath communication, family expectations aur future plans par khulkar baat karna useful ho sakta hai.',
                         'As a practical step, discuss communication, family expectations and future plans with a prospective partner.'),
        }
        paragraphs.append(practical[topic][0 if hinglish else 1])
        questions = {'career': 'Aap kaunse work options soch rahe hain?',
                     'education': 'Aap kya padh rahe hain, ya kaunse courses soch rahe hain?',
                     'marriage': 'Saath rehne aur communication ki expectations par baat karna chahenge?'}
        paragraphs.append(questions[topic] if hinglish else QUESTIONS[topic])
    # Keep a normal reading to three bubbles: answer, supporting evidence and
    # one practical next step. Preserve every fact and boundary warning.
    answer_count = min(2, len(packet['factors'])) + (1 if intent == 'timing' else 0)
    answer = ' '.join(paragraphs[:answer_count])
    if intent == 'overview':
        paragraphs = [answer, ' '.join(paragraphs[answer_count:-2]), ' '.join(paragraphs[-2:])]
    else:
        paragraphs = [answer, ' '.join(paragraphs[answer_count:])]
    return {'schema': 'reviewed-reading-v1', 'text': '\n\n'.join(paragraphs),
            'evidence': packet, 'language': language, 'intent': intent,
            'model_calls': 0, 'model_tokens': 0}
