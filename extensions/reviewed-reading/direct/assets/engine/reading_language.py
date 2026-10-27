"""Reviewed conversational wording, with no new predictions or model translations.

Keep interpretive possibilities distinct from calculated placements. Wording may
be direct without assigning a talent, a spouse trait or a guaranteed outcome.
"""

ENGLISH_THEMES = {
    'House10LordInHouse1': 'Your traditional career reading highlights independent work and personal ownership. Explore a role with more responsibility, or self-employment if it fits your experience.',
    'House10LordInHouse2': 'Family business and trade are directions highlighted in your traditional career reading. Compare these options with your actual experience.',
    'House10LordInHouse3': 'Communication, writing and work involving short journeys stand out in your traditional career reading. Explore a role that uses skills you have already developed.',
    'House10LordInHouse4': 'Education, land and property-related work are directions highlighted in your traditional career reading. Compare education or property operations with your experience.',
    'House10LordInHouse5': 'Your traditional career reading connects with brokerage and speculation-related professions. This is a work theme, not a recommendation to risk money on investments.',
    'House10LordInHouse6': 'Your traditional career reading highlights work in service institutions, including legal or healthcare organizations. Consider suitable roles based on your qualifications.',
    'House10LordInHouse7': 'Partnerships and cooperative work are directions highlighted in your traditional career reading. Explore a collaborative role if it fits how you prefer to work.',
    'House10LordInHouse9': 'Teaching, spiritual service and a family profession are directions highlighted in your traditional career reading. Consider only the options that fit your circumstances and interests.',
    'House10LordInHouse12': 'Work connected with distant places is a theme in your traditional career reading. Remote or international roles are options to explore; this does not establish a move abroad.',
    'House5LordInHouse9': 'Learning by sharing knowledge is a theme in your traditional education reading. After studying, try explaining a concept in your own words.',
    'House5LordInHouse11': 'Writing and group learning are themes in your traditional education reading. Try written summaries or a study group and see which helps you.',
    'House5LordInHouse12': 'Reflection and spiritual inquiry are themes in your traditional education reading. Try a quiet study session and judge whether it helps you understand the material.',
    'House2LordInHouse10': 'Your traditional reading connects earnings with professional activity. Compare actual payment terms and the value of the work you deliver.',
    'House7LordInHouse1': 'Familiarity and shared history are themes in your traditional relationship reading. Take time to get to know each other and build trust.',
    'House7LordInHouse4': 'Home and shared domestic comfort are themes in your traditional relationship reading. Discuss where you would live and what each of you expects from daily life together.',
    'MercuryInHouse11': 'Technical learning, science and applied engineering are directions in your traditional reading. Explore them alongside your actual interests and qualifications.',
    'JupiterInHouse4': 'Reflection and philosophical inquiry are themes in your traditional education reading. Try working through why an idea makes sense, rather than only memorizing it.',
    'MarsInHouse1': 'Initiative and practical activity are themes in your traditional career reading. Taking responsibility for a real project is one way to explore this direction.',
    'House2LordInHouse1': 'Your traditional reading connects earning with personal effort and learning. Compare work options and payment arrangements against the skills you actually have.',
}

HINGLISH_THEMES = {
    'House10LordInHouse1': 'Aapki career reading mein independent work aur apne kaam ki zimmedari ka theme hai. Apni pasand aur experience ke hisaab se self-employment explore kar sakte hain.',
    'House10LordInHouse2': 'Aapki career reading mein family business aur trade se jude kaam ki direction dikhti hai. In options ko apne actual experience se compare karein.',
    'House10LordInHouse3': 'Aapki career reading mein writing, communication aur chhoti journeys se jude kaam ka theme hai. Apni maujooda skills ke hisaab se communication roles explore karein.',
    'House10LordInHouse4': 'Aapki career reading mein education, zameen aur property se jude kaam ki direction dikhti hai. Education ya property operations ko apne experience se compare karein.',
    'House10LordInHouse5': 'Commercial brokerage ya speculation se jude professional kaam ka theme hai; yeh risky investment karne ki salah nahi hai.',
    'House10LordInHouse6': 'Aapki career reading mein service institutions, jaise legal ya healthcare organizations, ka theme hai. Apni qualifications ke hisaab se suitable roles dekhein.',
    'House10LordInHouse7': 'Aapki career reading mein partnership aur saath milkar kaam karne ki direction dikhti hai. Collaboration ko apni real preferences se compare karein.',
    'House10LordInHouse9': 'Aapki career reading mein teaching, spiritual service ya family profession ka theme hai. Apne interests aur circumstances se milne wale options hi dekhein.',
    'House10LordInHouse12': 'Aapki career reading mein door ki jagahon se jude kaam ka theme hai. Remote ya international roles explore kar sakte hain; isse abroad shift hona tay nahi hota.',
    'House5LordInHouse9': 'Aapki education reading mein seekhkar knowledge share karne ka theme hai. Padhne ke baad kisi concept ko apne shabdon mein samjhana try karein.',
    'House5LordInHouse11': 'Aapki education reading mein writing aur group learning ka theme hai. Written summaries ya study group try karke dekhein ki kis se madad milti hai.',
    'House5LordInHouse12': 'Aapki education reading mein reflection ya spiritual inquiry ka theme hai. Shaant jagah par ek study session try karke dekhein ki samajhne mein madad milti hai ya nahi.',
    'House2LordInHouse10': 'Aapki reading mein earning ka sambandh professional activity se hai. Actual payment terms aur apne kaam ki value compare karein.',
    'House7LordInHouse1': 'Aapki relationship reading mein pehchaan aur shared history ka theme hai. Ek doosre ko samajhne aur trust banane ke liye waqt dein.',
    'House7LordInHouse4': 'Aapki relationship reading mein ghar aur saath rehne ke comfort ka theme hai. Kahan rahenge aur daily life se kya expectations hain, in par baat karein.',
    'MercuryInHouse11': 'Aapki reading mein technical learning, science aur applied engineering ki direction dikhti hai. Inhe apne actual interests aur qualifications ke saath compare karein.',
    'JupiterInHouse4': 'Aapki education reading mein reflection aur philosophical inquiry ka theme hai. Sirf yaad karne ke saath kisi concept ki wajah samajhna bhi try karein.',
    'MarsInHouse1': 'Aapki career reading mein initiative aur practical activity ka theme hai. Kisi real project ki zimmedari lekar is direction ko explore kar sakte hain.',
    'House2LordInHouse1': 'Aapki reading mein earning ka sambandh personal effort aur learning se hai. Actual skills ke hisaab se work options aur payment arrangements compare karein.',
}

HINGLISH_HOUSES = {
    1: 'apni direction aur priorities', 2: 'resources, family aur bol-chaal',
    3: 'practice, communication aur initiative', 4: 'ghar, foundations aur learning',
    5: 'learning, creativity aur reflection', 6: 'daily service aur practical routines',
    7: 'partnership aur cooperation', 8: 'change aur personal reflection',
    9: 'higher study, teaching aur nazariya', 10: 'kaam aur public responsibilities',
    11: 'groups, networks aur goals', 12: 'akele waqt, reflection aur door ki jagahon',
}


# These are optional exercises, not additional chart interpretations or claims
# about the user's preferences, ability, finances or current circumstances.
EDUCATION_OPTIONS = {
    1: ('Try setting one study goal of your own.', 'Apna ek study goal tay karke try karein.'),
    2: ('Try explaining a concept aloud in your own words.', 'Ek concept apne shabdon mein bolkar samjhana try karein.'),
    3: ('Try practising a concept and explaining each step.', 'Ek concept ki practice karke uske steps samjhana try karein.'),
    4: ('Try reviewing the foundations of a difficult topic.', 'Kisi mushkil topic ke basics dobara samajhna try karein.'),
    5: ('Try making your own example of a concept.', 'Ek concept ka apna example banana try karein.'),
    6: ('Try a short, regular study session.', 'Chhota, regular study session try karein.'),
    7: ('Try discussing a difficult concept with a study partner.', 'Kisi mushkil concept par study partner ke saath discussion try karein.'),
    8: ('Try reviewing a difficult concept and noting the questions it raises.', 'Kisi mushkil concept ko dobara padhkar apne sawaal likhna try karein.'),
    9: ('Try explaining what you have learned to someone else.', 'Jo padha hai, use kisi aur ko samjhana try karein.'),
    10: ('Try connecting a topic to a real work example.', 'Ek topic ko real work example se jodna try karein.'),
    11: ('Try written summaries or a study group.', 'Written summaries ya study group try karein.'),
    12: ('Try a quiet study session and see whether it helps.', 'Shaant jagah par study session try karke dekhein ki madad milti hai ya nahi.'),
}


def hinglish_theme(factor, *, topic=None):
    if factor['source'] == 'local_house_symbolism':
        label = f'{topic} ki general house reading' if topic else 'general house reading'
        text = ('Aapki ' + label + ' mein '
                + HINGLISH_HOUSES[factor['fact']['house']] + ' ka theme hai.')
        if topic == 'education':
            text += ' ' + EDUCATION_OPTIONS[factor['fact']['house']][1]
        return text
    return HINGLISH_THEMES[factor['id']]


def english_theme(factor, *, topic=None):
    if factor['source'] == 'local_house_symbolism':
        from reading import HOUSE_SYMBOLS
        label = f'For {topic}, your broader house reading' if topic else 'Your broader house reading'
        text = label + ' highlights ' + HOUSE_SYMBOLS[factor['fact']['house']] + '.'
        if topic == 'education':
            text += ' ' + EDUCATION_OPTIONS[factor['fact']['house']][0]
        return text
    return ENGLISH_THEMES[factor['id']]


# User-facing Hinglish uses the same planet/sign values with Hindi names.
HINGLISH_PLANETS = dict(zip(
    ('Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'),
    ('Surya', 'Chandra', 'Mangal', 'Budh', 'Guru', 'Shukra', 'Shani', 'Rahu', 'Ketu')))
HINGLISH_SIGNS = dict(zip(
    ('Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'),
    ('Mesh', 'Vrishabh', 'Mithun', 'Kark', 'Singh', 'Kanya', 'Tula', 'Vrishchik', 'Dhanu', 'Makar', 'Kumbh', 'Meen')))
HINGLISH_HOUSE_NAMES = {
    1: 'pehle', 2: 'doosre', 3: 'teesre', 4: 'chauthe', 5: 'paanchve',
    6: 'chhathe', 7: 'saatve', 8: 'aathve', 9: 'nauve', 10: 'dasve',
    11: 'gyaarahve', 12: 'baarahve',
}
