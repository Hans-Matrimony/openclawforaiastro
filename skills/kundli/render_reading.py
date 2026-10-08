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
        if detailed:
            detail += (' Yeh birth chart ka ek aur division hai; sirf is rashi se partner ka swabhav ya koi result tay nahi hota.' if hi else
                       ' This is another division of the birth chart; this sign alone does not establish a partner\'s character or an outcome.') if packet['topic'] == 'marriage' else (
                       ' Yeh birth chart ka ek aur division hai; ise main chart ke saath samjha jaata hai, apne aap mein ability ka test nahi.' if hi else
                       ' This is another division of the birth chart, read alongside the main chart rather than as a test of ability.')
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
    # The pinned engine rounds rupas and applies a 1.1 ratio, not just the
    # textbook minimum. Attribute this classification to that assessment.
    if strength['meets_engine_strength_test']:
        detail += (f' VedAstro ke Shadbala assessment mein {planet} ko strong maana gaya hai.' if hi else
                   f' VedAstro\'s Shadbala assessment classifies {planet} as strong.')
        if detailed:
            detail += (' Shadbala grah ki calculated strength hai; strong hone ka matlab har pehlu favorable hona nahi hai.' if hi else
                       ' Shadbala measures calculated planetary strength; being strong does not make every finding favorable.')
    else:
        detail += (f' VedAstro ke Shadbala assessment mein {planet} ko strong nahi maana gaya hai; yeh aapki ability ya failure ka faisla nahi hai.' if hi else
                   f' VedAstro\'s Shadbala assessment does not classify {planet} as strong; this does not measure your ability or predict failure.')
        if detailed and (ruler['divisional_own_sign'] or ruler['same_d1_divisional_sign'] or dignity['own_sign'] or dignity['exaltation_sign']):
            detail += (' Rashi mein achhi placement aur poori planetary strength alag checks hain.' if hi else
                       ' A favorable sign placement and overall planetary strength are separate checks.')
    warning = boundary_warning(packet, hi)
    if warning:
        detail += ' ' + warning
    return detail.strip()


def native_practical(packet, hi):
    """Offer a practical response to adverse categories, without promising a cure."""
    base = _native_practical(packet, hi)
    ratings = packet.get('timing_context', {}).get('period_ratings', {})
    if packet['topic'] == 'marriage' and any(ratings.get(key) == 'Bad' for key in ('family', 'relationship')):
        action = ('Practical upay: agar family ya relationship mein tension ho, ek waqt par ek mudde par shaanti se baat karein aur dono ki boundaries clear karein.' if hi else
                  'A practical step, if there is tension, is to discuss one issue at a time calmly and make both people\'s boundaries clear.')
        return action + ' ' + base
    if packet['topic'] == 'education' and ratings.get('study') == 'Bad':
        action = ('Practical upay: agar padhai mein rukawat aa rahi ho, chhote study sessions aur weekly practice test se mushkil topics pehchanein; zaroorat par teacher se help lein.' if hi else
                  'If studying feels difficult, use short study sessions and a weekly practice test to identify difficult topics, and ask a teacher for help when needed.')
        return action + ' ' + base
    return base


def _native_practical(packet, hi):
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


def detailed_practical(packet, hi, follow_up):
    """Turn the earlier advice into an optional exercise, not another forecast."""
    topic = packet['topic']
    steps = {
        'marriage': ('Agla practical step: apni do zaroori expectations likhein aur har ek ke saamne likhein ki kis baat par flexibility hai. Rishta dekhte waqt inhe doosre vyakti ki expectations se compare karein.',
                     'For a practical next step, write down two important expectations and where you can be flexible. When considering a match, compare these with the other person\'s expectations.'),
        'education': ('Agla practical step: ek mushkil topic par bina notes dekhe practice questions karein. Galtiyon se agle study session ka focus chunein.',
                      'For a practical next step, answer practice questions on one difficult topic without your notes. Use the mistakes to choose the focus of your next study session.'),
        'career': ('Agla practical step: ek target role ki teen requirements likhein aur har ek ke saamne apne kaam ka example rakhein. Jahan example na mile, us skill par chhota project chunein.',
                   'For a practical next step, list three requirements of a target role and an example of your work for each. Where an example is missing, choose a small project to practice that skill.'),
    }
    text = steps[topic][0 if hi else 1]
    if follow_up:
        questions = {'marriage': 'Kaunsi expectation aapke liye sabse zaroori hai?',
                     'education': 'Kaunsa topic abhi mushkil lag raha hai?',
                     'career': 'Aap kaunsa role soch rahe hain?'}
        text += ' ' + (questions[topic] if hi else QUESTIONS[topic])
    return text


def compact_native_reading(packet, hi, intent, follow_up):
    """Give the answer first; keep the full calculation in the evidence packet."""
    from timing_context import current_context_text
    topic = packet['topic']
    basis = native_factor_text(packet['factors'][0], topic, hi)
    context = current_context_text(packet, hi, include_ratings=False)
    ratings = packet.get('timing_context', {}).get('period_ratings', {})
    labels = {'Good': 'supportive', 'Bad': 'challenging', 'Neutral': 'neutral'}
    if topic == 'marriage' and ratings:
        family, relationship = labels[ratings['family']], labels[ratings['relationship']]
        context += (f' Is dasha ki reading mein family ke sanket {family} aur relationship ke {relationship} hain.' if hi else
                    f' In this period reading, family indicators are {family} and relationship indicators are {relationship}.')
    elif topic == 'education' and ratings:
        label = labels[ratings['study']]
        context += (f' Padhai ke sanket {label} hain; result preparation par bhi depend karta hai.' if hi else
                    f' Study indicators are {label}; results also depend on preparation.')
    planet = packet['advanced']['topic_ruler']['planet']
    name = HINDI_PLANETS[planet] if hi else planet
    strong = packet['provider']['strength']['meets_engine_strength_test']
    strength = ((f'Shadbala mein {name} strong hain.' if strong else f'Shadbala mein {name} ko strong nahi maana gaya hai.') if hi else
                (f'Shadbala rates {name} as strong.' if strong else f'Shadbala does not rate {name} as strong.'))
    if packet['advanced']['topic_ruler']['d1_dignity']['debilitation_sign']:
        strength += (f' Main chart mein {name} neecha rashi mein hain.' if hi else
                     f' The main chart places {name} in its debilitation sign.')
    steps = {
        'marriage': ('Rishta dekhte waqt rehne ki jagah, family involvement aur zimmedariyon par expectations saaf rakhein.',
                     'When considering a match, discuss living arrangements, family involvement and shared responsibilities.'),
        'career': ('Ek pasand ke role ki requirements ko apni skills se compare karein; applications aur interview feedback ka record rakhein.',
                   'Compare a target role with your skills; track applications and interview feedback.'),
        'education': ('Ek mushkil topic par practice questions karein aur galtiyon se agle study session ka focus chunein.',
                      'Try practice questions on one difficult topic and use mistakes to plan your next study session.'),
    }
    final = steps[topic][0 if hi else 1]
    warning = boundary_warning(packet, hi)
    if warning:
        final += ' ' + warning
    if follow_up and intent != 'timing':
        questions = {'marriage': 'Aap rishta dekh rahe hain?', 'career': 'Kaunsa role soch rahe hain?',
                     'education': 'Aap kya padh rahe hain?'}
        final += ' ' + (questions[topic] if hi else QUESTIONS[topic])
    if intent == 'timing':
        lead = (('Shaadi ka saal ya mahina is reading se tay nahi hota.' if hi else
                 'This reading does not establish a marriage year or month.') if topic == 'marriage' else
                ('Job milne ka exact samay is reading se tay nahi hota.' if hi else
                 'This reading does not establish when you will receive a job offer.'))
        sections = [lead + ' ' + context, basis + ' ' + strength, final]
    else:
        sections = [basis + ' ' + strength, context, final]
    # Keep complete sections below the PWA's 360-character bubble limit.
    # Usually two bubbles suffice; warnings can require a third.
    paragraphs = []
    for section in filter(None, sections):
        if paragraphs and len(paragraphs[-1]) + len(section) + 1 <= 340:
            paragraphs[-1] += ' ' + section
        else:
            paragraphs.append(section)
    return '\n\n'.join(paragraphs)


def render_vedastro(packet, language, intent, style='standard', follow_up=True):
    """Respect requested depth while keeping every interpretation source-bound."""
    hi = language == 'hinglish'
    if style == 'standard' and (intent != 'timing' or packet.get('timing_context')):
        return compact_native_reading(packet, hi, intent, follow_up)
    primary = packet['factors'][0]
    topic = packet['topic']
    first = native_factor_text(primary, topic, hi)
    # A second reviewed placement adds depth only when its chart basis differs.
    extra = next((factor for factor in packet['factors'][1:]
                  if (factor['fact']['planet'], factor['fact']['house']) !=
                  (primary['fact']['planet'], primary['fact']['house'])), None)
    second = native_supporting_detail(packet, hi, detailed=style == 'detailed')
    from timing_context import current_context_text
    current_context = current_context_text(packet, hi, include_transits=style == 'detailed',
                                          include_period=intent != 'timing' or style != 'detailed',
                                          limit_already_stated=intent == 'timing')
    if current_context and style != 'brief' and intent != 'timing':
        second += ' ' + current_context
    final = native_practical(packet, hi)
    if not follow_up or style == 'brief':
        final = final.rsplit('. ', 1)[0] + '.'
    if style == 'detailed':
        final = detailed_practical(packet, hi, follow_up)
    if intent == 'timing':
        if topic == 'career':
            return render_career_timing(packet, hi, style, follow_up)
        lead = ('Shaadi ka exact saal ya mahina abhi bharose se batana mumkin nahi hai.' if hi else
                'I cannot give a reliable year or month for your marriage yet.')
        if style != 'detailed':
            if current_context and style == 'standard':
                # A normal timing question deserves the available chart basis,
                # even when the evidence cannot establish a personal date.
                practical = native_practical(packet, hi).rsplit('. ', 1)[0] + '.'
                return '\n\n'.join([lead + ' ' + current_context, first + ' ' + second, practical])
            if current_context and style == 'brief':
                text = lead + ' ' + current_context_text(packet, hi, include_ratings=False)
                warning = boundary_warning(packet, hi)
                return text + (' ' + warning if warning else '')
            return lead + (' Koi tareekh kehna sirf andaza hoga.' if hi else ' Naming a date would be a guess.')
        if current_context:
            second += ' ' + current_context
        major, major_data = next(iter(packet['current_period']['mahadashas'].items()))
        sub = next(iter(major_data['antardashas']))
        lead += (f" Abhi {HINDI_PLANETS[major]} mahadasha mein {HINDI_PLANETS[sub]} antardasha chal rahi hai." if hi else
                 f" You are in the {major} major period with the {sub} subperiod.")
        ruler = packet['advanced']['topic_ruler']['planet']
        if not current_context and ruler in (major, sub):
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


def render_career_timing(packet, hi, style, follow_up):
    """Answer the job timing question with available evidence, not an offer date."""
    from timing_context import current_context_text
    lead = ('Job milne ka exact samay is reading se tay nahi hota.' if hi else
            'This reading does not establish when you will receive a job offer.')
    context = current_context_text(packet, hi, include_transits=style == 'detailed',
                                   include_ratings=style != 'brief', limit_already_stated=True)
    if style == 'brief':
        warning = boundary_warning(packet, hi)
        return ' '.join(part for part in (lead, context, warning) if part)
    basis = native_factor_text(packet['factors'][0], 'career', hi)
    details = native_supporting_detail(packet, hi, detailed=style == 'detailed')
    practical = ('Agla step: target role ke job descriptions se apni skills match karein, applications ka record rakhein aur interview feedback par kaam karein.' if hi else
                 'Next, compare your skills with the requirements of your target role, track your applications and use interview feedback to decide what to improve.')
    if follow_up and style == 'detailed':
        practical += (' Aap applications ya interviews mein kis stage par hain?' if hi else
                      ' Are you applying or already interviewing?')
    if style == 'detailed':
        return '\n\n'.join([lead, basis, ' '.join(part for part in (details, context) if part), practical])
    return '\n\n'.join([' '.join(part for part in (lead, context) if part), basis + ' ' + details, practical])


def render_reading(chart, topic, *, as_of_utc=None, language='english', intent='overview', style='standard', follow_up=True):
    if language not in ('english', 'hinglish') or intent not in ('overview', 'timing'):
        raise ValueError('Unsupported reading language or intent')
    if style not in ('brief', 'standard', 'detailed') or type(follow_up) is not bool:
        raise ValueError('Unsupported reading presentation')
    if intent == 'timing' and topic not in ('marriage', 'career'):
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
        if topic == 'career':
            text = ('Job milne ka exact samay is reading se tay nahi hota. Koi tareekh kehna sirf andaza hoga.' if hinglish else
                    'This reading does not establish when you will receive a job offer. Naming a date would be a guess.')
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
