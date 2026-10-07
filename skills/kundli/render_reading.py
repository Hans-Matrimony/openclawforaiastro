"""Render reviewed chart interpretations without a generative model.

Accept a chart, never caller-supplied prose or a prebuilt evidence packet.
Every personalized sentence comes from the verified packet's reviewed rules.
"""
from reading import reading_packet
from reading_language import hinglish_theme, conversational_theme, HINDI_PLANETS, HINDI_SIGNS


QUESTIONS = {
    'career': 'Which work options are you considering in real life?',
    'education': 'What are you studying, or which courses are you considering?',
    'marriage': 'Would you like to think through expectations about communication and living together?',
}


def boundary_warning(packet, hi):
    ruler = packet['advanced']['topic_ruler']
    if (ruler['near_divisional_boundary'] or ruler['near_divisional_ascendant_boundary'] or
            any(isinstance(w, str) and w.startswith('Moon is ') and 'boundary' in w for w in packet['calculation_warnings'])):
        return ('Placement ki boundary paas hai; birth time approximate ho toh pehle confirm karein.' if hi else
                'A placement is near a boundary; confirm an approximate birth time before relying on it.')
    return ''


def native_factor_text(factor, topic, hi):
    """A reviewed interpretation with the exact placement that supports it."""
    fact = factor['fact']
    theme = conversational_theme(factor, topic, hi)
    role = (f", ghar {fact['rules_house']} ke swami," if hi else f", ruler of house {fact['rules_house']},") if 'rules_house' in fact else ''
    basis = (f"{HINDI_PLANETS[fact['planet']]}{role} ghar {fact['house']} mein {HINDI_SIGNS[fact['sign']]} rashi mein hain." if hi else
             f"{fact['planet']}{role} is in house {fact['house']} ({fact['sign']}).")
    return theme + ' ' + basis


def native_supporting_detail(packet, hi, detailed=True):
    """Explain checked divisional, aspect and strength facts without forecasting."""
    advanced = packet['advanced']
    ruler = advanced['topic_ruler']
    planet = HINDI_PLANETS[ruler['planet']] if hi else ruler['planet']
    sign = HINDI_SIGNS[ruler['divisional_sign']] if hi else ruler['divisional_sign']
    division = 'Navamsa' if ruler['division'] == 9 else 'Dashamsa'
    detail = ''
    if detailed or ruler['divisional_own_sign'] or ruler['same_d1_divisional_sign']:
        detail = (f"{division} (D{ruler['division']}) mein {planet} {sign} mein hain" if hi else
                  f"In {division} (D{ruler['division']}), {planet} is in {sign}")
    if detail and ruler['divisional_own_sign']:
        detail += (' (apni rashi)' if hi else ' (its own sign)')
    if detail and ruler['same_d1_divisional_sign']:
        detail += ('; yahi rashi main chart mein bhi hai' if hi else '; this sign also repeats from the main chart')
    if detail:
        detail += '.'
    dignity = ruler['d1_dignity']
    if dignity['own_sign']:
        detail += (f' {planet} main chart mein apni rashi mein hain.' if hi else f' {planet} occupies its own sign in the main chart.')
    elif dignity['exaltation_sign']:
        detail += (f' {planet} main chart mein traditionally uccha rashi mein hain.' if hi else f' The main chart places {planet} in its traditional exaltation sign.')
    elif dignity['debilitation_sign']:
        detail += (f' {planet} main chart mein traditionally neecha rashi mein hain; yeh akela failure ka proof nahi hai.' if hi else
                   f' The main chart places {planet} in its traditional debilitation sign; that alone does not establish failure.')
    aspects = advanced['full_sign_aspects_to_topic_house']
    if detailed and aspects:
        names = ', '.join(HINDI_PLANETS[a['planet']] if hi else a['planet'] for a in aspects)
        verb = 'casts' if len(aspects) == 1 else 'cast'
        detail += (f" {names} ki poori drishti ghar {ruler['rules_house']} par hai." if hi else
                   f" {names} {verb} a full sign aspect on house {ruler['rules_house']}.")
    strength = packet['provider']['strength']
    if strength['meets_engine_strength_test']:
        detail += (f' Shadbala ke traditional strength check mein {planet} supportive threshold ko meet karte hain.' if hi else
                   f' {planet} meets the traditional Shadbala strength threshold.')
    else:
        detail += (f' {planet} ka overall Shadbala score supportive threshold se neeche hai; yeh aapki ability ya failure ka faisla nahi hai.' if hi else
                   f' {planet}\'s overall Shadbala score is below the supportive threshold; it does not establish your ability or predict failure.')
        if detailed and (ruler['divisional_own_sign'] or ruler['same_d1_divisional_sign'] or dignity['own_sign'] or dignity['exaltation_sign']):
            detail += (' Rashi mein achhi placement aur poori planetary strength alag checks hain.' if hi else
                       ' A favorable sign placement and overall planetary strength are separate checks.')
    warning = boundary_warning(packet, hi)
    if warning:
        detail += ' ' + warning
    return detail.strip()


def native_practical(packet, hi):
    """Translate a house theme into a concrete optional step, never an aptitude."""
    topic = packet['topic']
    house = packet['factors'][0]['fact']['house']
    if topic == 'marriage':
        if house == 4:
            return ('Rishta dekhte waqt kahan rahenge, family ki involvement aur ghar ki zimmedariyan kaise baantenge, in baaton par pehle clarity laayein. Abhi rishta dekh rahe hain ya shaadi ke plans par baat chal rahi hai?' if hi else
                    'When considering a match, discuss where you would live, family involvement and how you would share household responsibilities. Are you looking for a match or discussing marriage plans?')
        if house == 10:
            return ('Ek doosre ke career, work hours aur shared responsibilities par expectations clear karein. Career aur relationship ko saath manage karne mein aapki main concern kya hai?' if hi else
                    'Discuss expectations about careers, work hours and shared responsibilities. What concerns you most about balancing work and a relationship?')
        return ('Communication, family expectations aur daily life ke plans par khulkar baat karein. Partner ke saath kaunsi expectation aapke liye sabse zaroori hai?' if hi else
                'Discuss communication, family expectations and everyday plans openly. Which expectation matters most to you in a partnership?')
    if topic == 'education':
        if house in (7, 11):
            return ('Ek study partner ke saath concept samjhana aur practice questions solve karna try karein; dekhein ki aapko isse help milti hai ya nahi. Aap kya padh rahe hain, ya kaunse courses compare kar rahe hain?' if hi else
                    'Try explaining a concept to a study partner and solving practice questions together; see whether it helps you learn. What are you studying, or which courses are you comparing?')
        if house == 9:
            return ('Higher study ke liye syllabus aur entry requirements compare karein; padha hua concept apne shabdon mein samjha kar understanding check karein. Kaunsa course ya subject soch rahe hain?' if hi else
                    'For further study, compare course content and entry requirements; explain a concept in your own words to check understanding. Which course or subject are you considering?')
        return ('Course ka syllabus, fees aur apne study experience ko saath dekhein; ek sample lesson try karke interest check karein. Aap kya padh rahe hain, ya kaunsa course soch rahe hain?' if hi else
                'Compare course content, fees and your study experience; try a sample lesson to explore your interest. What are you studying, or which course are you considering?')
    if house == 2:
        return ('Family business ka option ho toh uska daily work aur earning arrangement kisi employed role se compare karein; chart se salary tay nahi hoti. Aapke paas abhi kaunse work options hain?' if hi else
                'If a family business is an option, compare its daily work and payment arrangements with an employed role; the chart does not establish a salary. Which work options are available to you?')
    if house in (3, 4, 7, 11, 12):
        examples = {3: ('communication', 'communication'), 4: ('education ya property operations', 'education or property operations'),
                    7: ('collaboration', 'collaboration'), 11: ('teamwork aur professional networking', 'teamwork and professional networking'),
                    12: ('remote ya international work', 'remote or international work')}
        option = examples[house][0 if hi else 1]
        return (f'{option.capitalize()} wale roles ka daily work, skills aur qualifications compare karein; ek chhota project se fit check kar sakte hain. Aap kaunse options soch rahe hain?' if hi else
                f'Compare daily work, skills and qualifications in roles involving {option}; try a small project to explore fit. Which options are you considering?')
    return ('Do pasand ke roles ka daily work aur required skills compare karke ek chhota project try karein. Aap kaunse options soch rahe hain?' if hi else
            'Compare the daily work and required skills in two roles you like, then try a small project. Which options are you considering?')


def render_vedastro(packet, language, intent, style='standard', follow_up=True):
    """Respect requested depth while keeping every interpretation source-bound."""
    hi = language == 'hinglish'
    primary = packet['factors'][0]
    topic = packet['topic']
    first = native_factor_text(primary, topic, hi)
    # A second reviewed placement adds depth only when its chart basis differs.
    extra = next((factor for factor in packet['factors'][1:]
                  if (factor['fact']['planet'], factor['fact']['house']) !=
                  (primary['fact']['planet'], primary['fact']['house'])), None)
    second = native_supporting_detail(packet, hi, detailed=style == 'detailed')
    final = native_practical(packet, hi)
    if not follow_up or style == 'brief':
        final = final.rsplit('. ', 1)[0] + '.'
    if intent == 'timing':
        lead = ('Shaadi ka exact saal ya mahina abhi bharose se batana mumkin nahi hai.' if hi else
                'I cannot give a reliable year or month for your marriage yet.')
        if style != 'detailed':
            return lead + (' Koi tareekh kehna sirf andaza hoga.' if hi else ' Naming a date would be a guess.')
        major, major_data = next(iter(packet['current_period']['mahadashas'].items()))
        sub = next(iter(major_data['antardashas']))
        lead += (f" Abhi {HINDI_PLANETS[major]} mahadasha mein {HINDI_PLANETS[sub]} antardasha chal rahi hai, lekin sirf dasha ke naam se shaadi ki window batana andaza hoga." if hi else
                 f" You are in the {major} major period with the {sub} subperiod; these periods alone do not establish a wedding window.")
        ruler = packet['advanced']['topic_ruler']['planet']
        if ruler in (major, sub):
            lead += (f" {HINDI_PLANETS[ruler]} shaadi ke ghar 7 ke swami bhi hain, isliye relationship analysis mein relevant hain." if hi else
                     f" {ruler} also rules marriage house 7, so it is relevant to a relationship analysis.")
        return '\n\n'.join([lead, first, second, final])
    if style == 'brief':
        # A short answer retains the main reviewed theme and its basis. The
        # complete evidence packet is still returned for independent checking.
        return first + (' ' + boundary_warning(packet, hi) if boundary_warning(packet, hi) else '')
    if extra:
        supporting_factor = native_factor_text(extra, topic, hi)
        if style == 'detailed':
            return '\n\n'.join([first, supporting_factor, second, final])
        second = supporting_factor + ' ' + second
    return '\n\n'.join([first, second, final])


def render_reading(chart, topic, *, as_of_utc=None, language='english', intent='overview', style='standard', follow_up=True):
    if language not in ('english', 'hinglish') or intent not in ('overview', 'timing'):
        raise ValueError('Unsupported reading language or intent')
    if style not in ('brief', 'standard', 'detailed') or type(follow_up) is not bool:
        raise ValueError('Unsupported reading presentation')
    if intent == 'timing' and topic != 'marriage':
        raise ValueError('Unsupported timing question')
    packet = reading_packet(chart, topic, as_of_utc=as_of_utc)
    if packet.get('provider', {}).get('name') == 'vedastro-local':
        return {'schema': 'reviewed-reading-v1', 'text': render_vedastro(packet, language, intent, style, follow_up),
                'evidence': packet, 'language': language, 'intent': intent,
                'style': style, 'follow_up': follow_up,
                'model_calls': 0, 'model_tokens': 0}
    hinglish = language == 'hinglish'
    if intent == 'timing':
        # The packet has no event-window interpretation. Answer that question
        # directly rather than padding a limitation with unrelated placements
        # or exposing internal calculation metadata as conversation.
        text = ('Shaadi ka saal ya mahina abhi bharose se batana mumkin nahi hai. Koi tareekh kehna sirf andaza hoga.'
                if hinglish else
                'I cannot give a reliable year or month for your marriage yet. Naming a date would be a guess.')
        return {'schema': 'reviewed-reading-v1', 'text': text, 'style': style, 'follow_up': follow_up,
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
        if follow_up:
            paragraphs.append(questions[topic] if hinglish else QUESTIONS[topic])
    # Keep a normal reading to three bubbles: answer, supporting evidence and
    # one practical next step. Preserve every fact and boundary warning.
    answer_count = min(2, len(packet['factors']))
    answer = ' '.join(paragraphs[:answer_count])
    ending_count = 2 if follow_up else 1
    paragraphs = [answer, ' '.join(paragraphs[answer_count:-ending_count]), ' '.join(paragraphs[-ending_count:])]
    if style == 'brief':
        warning = boundary_warning(packet, hinglish)
        paragraphs = [answer + (' ' + warning if warning else '')]
    return {'schema': 'reviewed-reading-v1', 'text': '\n\n'.join(paragraphs),
            'evidence': packet, 'language': language, 'intent': intent,
            'style': style, 'follow_up': follow_up,
            'model_calls': 0, 'model_tokens': 0}
