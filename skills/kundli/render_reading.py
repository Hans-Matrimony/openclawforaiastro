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


def render_vedastro(packet, language, intent):
    """Plain, bounded prose from reviewed themes and validated native facts."""
    hi = language == 'hinglish'
    topic = packet['topic']
    factor = packet['factors'][0]
    fact = factor['fact']
    theme = hinglish_theme(factor) if hi else factor['traditional_theme']
    role = (f", house {fact['rules_house']} ke lord," if hi else f", ruler of house {fact['rules_house']},") if 'rules_house' in fact else ''
    basis = (f"{fact['planet']}{role} house {fact['house']} mein hain ({fact['sign']})." if hi else
             f"{fact['planet']}{role} is in house {fact['house']} ({fact['sign']}).")
    if intent == 'timing':
        lead = ('Shaadi ka exact saal ya mahina is reading se bharose ke saath tay nahi hota.' if hi else
                'This reading does not establish a reliable year or month for your marriage.')
        major, major_data = next(iter(packet['current_period']['mahadashas'].items()))
        sub = next(iter(major_data['antardashas']))
        lead += (f" Abhi {major}-{sub} dasha chal rahi hai; dasha ka naam apne aap shaadi ki window nahi banata." if hi else
                 f" Your current period is {major}-{sub}; the period names alone do not establish a wedding window.")
        first = lead
        second = basis + ' ' + theme
    else:
        first = theme + ' ' + basis
        ruler = packet['advanced']['topic_ruler']
        second = (f"D{ruler['division']} mein {ruler['planet']} {ruler['divisional_sign']} mein hain." if hi else
                  f"In D{ruler['division']}, {ruler['planet']} is in {ruler['divisional_sign']}.")
        strength = packet['provider']['strength']
        if strength['meets_engine_strength_test']:
            second += (' Shadbala ke traditional test mein is planet ki strength supportive hai.' if hi else
                       ' This planet meets the traditional Shadbala strength test.')
        else:
            second += (' Shadbala score traditional supportive threshold se neeche hai; ise failure ki prediction na maanein.' if hi else
                       ' Its Shadbala score is below the traditional supportive threshold; this does not predict failure.')
        second += (' Yeh traditional interpretation hai, future result ki guarantee nahi.' if hi else
                   ' This is a traditional interpretation, not a guaranteed outcome.')
    practical = {
        'career': ('Do pasand ke roles ka daily work compare karke ek chhota project try karein. Aap kaunse options soch rahe hain?',
                   'Compare the daily work in two roles you like and try a small project. Which options are you considering?'),
        'education': ('Course ka syllabus, fees aur apne study experience ko saath dekhein. Aap kya padh rahe hain, ya kaunsa course soch rahe hain?',
                      'Compare course content, fees and your study experience. What are you studying, or which course are you considering?'),
        'marriage': ('Rishta dekhte waqt communication, family expectations aur saath rehne ke plans par khulkar baat karein. Aapki sabse badi concern kya hai?',
                     'Discuss communication, family expectations and plans for living together when considering a match. What is your main concern?'),
    }
    final = practical[topic][0 if hi else 1]
    ruler = packet['advanced']['topic_ruler']
    if (ruler['near_divisional_boundary'] or ruler['near_divisional_ascendant_boundary'] or
            any(isinstance(w, str) and w.startswith('Moon is ') and 'boundary' in w for w in packet['calculation_warnings'])):
        second += (' Placement ki boundary paas hai; birth time approximate ho toh pehle confirm karein.' if hi else
                   ' A placement is near a boundary; confirm an approximate birth time before relying on it.')
    return '\n\n'.join([first, second, final])


def render_reading(chart, topic, *, as_of_utc=None, language='english', intent='overview'):
    if language not in ('english', 'hinglish') or intent not in ('overview', 'timing'):
        raise ValueError('Unsupported reading language or intent')
    if intent == 'timing' and topic != 'marriage':
        raise ValueError('Unsupported timing question')
    packet = reading_packet(chart, topic, as_of_utc=as_of_utc)
    if packet.get('provider', {}).get('name') == 'vedastro-local':
        return {'schema': 'reviewed-reading-v1', 'text': render_vedastro(packet, language, intent),
                'evidence': packet, 'language': language, 'intent': intent,
                'model_calls': 0, 'model_tokens': 0}
    hinglish = language == 'hinglish'
    if intent == 'timing':
        # The packet has no event-window interpretation. Answer that question
        # directly rather than padding a limitation with unrelated placements
        # or exposing internal calculation metadata as conversation.
        text = ('Shaadi ka saal ya mahina abhi bharose se batana mumkin nahi hai. Koi tareekh kehna sirf andaza hoga.'
                if hinglish else
                'I cannot give a reliable year or month for your marriage yet. Naming a date would be a guess.')
        return {'schema': 'reviewed-reading-v1', 'text': text,
                'evidence': packet, 'language': language, 'intent': intent,
                'model_calls': 0, 'model_tokens': 0}
    paragraphs = []
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
        verb = 'casts' if len(aspects) == 1 else 'cast'
        detail += (f". {names} ki full sign drishti house {ruler['rules_house']} par hai"
                   if hinglish else f". {names} {verb} a full sign aspect on house {ruler['rules_house']}")
    paragraphs.append(detail + '.')
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
    answer_count = min(2, len(packet['factors']))
    answer = ' '.join(paragraphs[:answer_count])
    paragraphs = [answer, ' '.join(paragraphs[answer_count:-2]), ' '.join(paragraphs[-2:])]
    return {'schema': 'reviewed-reading-v1', 'text': '\n\n'.join(paragraphs),
            'evidence': packet, 'language': language, 'intent': intent,
            'model_calls': 0, 'model_tokens': 0}
