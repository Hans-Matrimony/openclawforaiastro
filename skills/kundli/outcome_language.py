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


def hinglish_theme(factor, *, topic=None, include_advice=True):
    if factor['source'] == 'local_house_symbolism':
        label = f'{topic} ki general house reading' if topic else 'general house reading'
        text = ('Aapki ' + label + ' mein '
                + HINGLISH_HOUSES[factor['fact']['house']] + ' ka theme hai.')
        if topic == 'education' and include_advice:
            text += ' ' + EDUCATION_OPTIONS[factor['fact']['house']][1]
        return text
    if factor['id'] not in HINGLISH_THEMES:
        from reading_language import conversational_theme
        return conversational_theme(factor, topic, True)
    text = HINGLISH_THEMES[factor['id']]
    return text if include_advice or factor['id'] == 'House10LordInHouse5' else text.split('. ', 1)[0].rstrip('.') + '.'


def english_theme(factor, *, topic=None, include_advice=True):
    if factor['source'] == 'local_house_symbolism':
        from reading import HOUSE_SYMBOLS
        label = f'For {topic}, your broader house reading' if topic else 'Your broader house reading'
        text = label + ' highlights ' + HOUSE_SYMBOLS[factor['fact']['house']] + '.'
        if topic == 'education' and include_advice:
            text += ' ' + EDUCATION_OPTIONS[factor['fact']['house']][0]
        return text
    if factor['id'] not in ENGLISH_THEMES:
        from reading_language import conversational_theme
        return conversational_theme(factor, topic, False)
    text = ENGLISH_THEMES[factor['id']]
    return text if include_advice or factor['id'] == 'House10LordInHouse5' else text.split('. ', 1)[0].rstrip('.') + '.'


# Topic-specific paraphrases of the reviewed Venus PD2 entries. No blanket
# positivity, traits, medical claims or inference about another person's mind.
PERIOD_WORDING = {
    ('Sun', 'finance'): ('The current period indicates financial setbacks rather than a straightforward recovery.', 'Maujooda period financial setbacks ka sanket deta hai; seedhi recovery ka nateeja support nahi hota.'),
    ('Moon', 'finance'): ('The current period supports financial gains. It does not establish an amount or a date by which a financial problem will be resolved.', 'Maujooda period financial gains ke liye anukool hai. Isse amount ya financial problem solve hone ki date tay nahi hoti.'),
    ('Mars', 'finance'): ('The current period supports income and acquisition of assets, without establishing an individual financial result.', 'Maujooda period income aur assets ke liye anukool hai, bina individual financial result ko tay kiye.'),
    ('Rahu', 'finance'): ('The current period mentions recovery of property, but does not establish overall financial recovery.', 'Maujooda period mein property recovery ka zikr hai, lekin overall financial recovery tay nahi hoti.'),
    ('Jupiter', 'finance'): ('The current period supports gains through professional activity. It does not establish an amount or investment return.', 'Maujooda period professional activity se gains ke liye anukool hai. Isse amount ya investment return tay nahi hota.'),
    ('Saturn', 'finance'): ('The current period contains both asset gains and money-loss indications. Its financial outlook is mixed.', 'Maujooda period mein assets ke gains aur money loss, dono ke sanket hain. Financial outlook mixed hai.'),
    ('Mercury', 'finance'): ('The current period supports financial gains and prosperity, without establishing an amount or guaranteed return.', 'Maujooda period financial gains aur prosperity ke liye anukool hai, bina amount ya pakke return ko tay kiye.'),
    ('Ketu', 'finance'): ('The current period indicates loss-of-wealth risk rather than an uncomplicated financial improvement.', 'Maujooda period mein wealth loss ka risk hai; bina rukawat financial improvement ka nateeja support nahi hota.'),
    ('Venus', 'finance'): ('The current period supports earnings and financial comfort. A particular income level is not established.', 'Maujooda period earning aur financial comfort ke liye anukool hai. Koi particular income level tay nahi hota.'),
    ('Sun', 'marriage'): ('The current period indicates relationship friction and disputes, so it does not support an uncomplicated relationship outlook.', 'Maujooda period mein relationship friction aur disputes ka sanket hai, isliye ise seedha anukool nahi kaha ja sakta.'),
    ('Sun', 'career'): ('The current period indicates setbacks in prosperity; a smooth career outcome is not supported by this period rule.', 'Maujooda period mein prosperity mein setbacks ka sanket hai; career ka smooth outcome is rule se support nahi hota.'),
    ('Moon', 'marriage'): ('The current period contains both relationship friction and domestic comfort indications. Its relationship outlook is mixed.', 'Maujooda period mein relationship friction aur domestic comfort, dono ke sanket hain. Relationship ka outlook mixed hai.'),
    ('Moon', 'education'): ('The current period supports learning and acquiring knowledge. It does not establish a particular admission or exam result.', 'Maujooda period padhai aur knowledge badhane ke liye anukool hai. Isse kisi admission ya exam ka result tay nahi hota.'),
    ('Moon', 'career'): ('This period mentions gains, but does not establish a job offer or promotion.', 'Is period mein gains ka zikr hai, lekin job offer ya promotion ka nateeja tay nahi hota.'),
    ('Mars', 'marriage'): ('This period includes a marriage indication, conditional on the wider chart and real circumstances.', 'Is period mein shaadi ka sanket hai, lekin yeh wider chart aur actual circumstances par conditional hai.'),
    ('Mars', 'career'): ('The current period combines earnings indications with substantial effort and disruption. Career indications are mixed.', 'Maujooda period mein earning ke saath kaafi effort aur disruption ke sanket hain. Career ke indications mixed hain.'),
    ('Rahu', 'marriage'): ('The current period indicates quarrels and relational strain; it is adverse for relationship harmony.', 'Maujooda period mein quarrels aur relationship strain ke sanket hain; harmony ke liye yeh pratikool hai.'),
    ('Rahu', 'career'): ('The current period indicates changing surroundings, but does not establish a favorable career outcome.', 'Maujooda period mein surroundings badalne ka sanket hai, lekin favorable career outcome tay nahi hota.'),
    ('Jupiter', 'marriage'): ('This period includes a marriage indication and domestic support, while also retaining possible difficulties.', 'Is period mein shaadi aur domestic support ke sanket hain, saath mein difficulties ka bhi zikr hai.'),
    ('Jupiter', 'career'): ('The current period supports professional gains and a more settled livelihood. A particular job or promotion is still not established.', 'Maujooda period professional gains aur livelihood settle hone ke liye anukool hai. Koi particular job ya promotion phir bhi tay nahi hota.'),
    ('Jupiter', 'education'): ('The current period supports gaining knowledge. A particular admission or qualification is not established.', 'Maujooda period knowledge badhane ke liye anukool hai. Koi particular admission ya qualification tay nahi hoti.'),
    ('Saturn', 'career'): ('The current period includes loss-of-money and dependence indications; it does not support a uniformly favorable career outlook.', 'Maujooda period mein money loss aur dependence ke sanket hain; career ko poori tarah anukool nahi kaha ja sakta.'),
    ('Mercury', 'marriage'): ('The current period supports domestic enjoyment, but that is not a prediction of a wedding or a partner\'s feelings.', 'Maujooda period domestic enjoyment ke liye anukool hai; yeh shaadi hone ya partner ki feelings ki prediction nahi hai.'),
    ('Mercury', 'career'): ('The current period supports gains and prosperity, without establishing a particular job outcome.', 'Maujooda period gains aur prosperity ke liye anukool hai, bina kisi particular job outcome ko tay kiye.'),
    ('Mercury', 'education'): ('The current period supports mathematical, artistic and scientific learning. It does not prove aptitude or an exam result.', 'Maujooda period mathematics, arts aur science ki learning ke liye anukool hai. Isse aptitude ya exam result prove nahi hota.'),
    ('Ketu', 'marriage'): ('The current period indicates discord and relationship difficulties; its relationship outlook is adverse.', 'Maujooda period mein discord aur relationship difficulties ke sanket hain; outlook pratikool hai.'),
    ('Ketu', 'career'): ('The current period includes loss-of-wealth indications; an uncomplicated improvement is not supported.', 'Maujooda period mein wealth loss ka sanket hai; bina rukawat improvement ka nateeja support nahi hota.'),
    ('Venus', 'career'): ('The current period supports success and earnings, without guaranteeing an individual job result.', 'Maujooda period success aur earning ke liye anukool hai, bina individual job result ko pakka kiye.'),
}

NATAL_WORDING = {
    'SaturnIn7thNotLagnaLord': ('There is an adverse traditional indication for relationship harmony.', 'Relationship harmony ke liye ek pratikool traditional sanket hai.'),
    'JupiterInHouse7': ('There is a supportive traditional relationship indication.', 'Relationship ke liye ek anukool traditional sanket hai.'),
    'House7LordInHouse4': ('There is support for domestic comfort in the traditional relationship reading.', 'Traditional relationship reading mein domestic comfort ka support hai.'),
    'House10LordInHouse8': ('Career interruptions are indicated, so a smooth, uninterrupted rise should not be assumed.', 'Career mein interruptions ka sanket hai, isliye bina rukawat progress assume nahi ki ja sakti.'),
    'House10LordInHouse12': ('The traditional career reading indicates difficulties alongside work connected with distant places.', 'Traditional career reading mein door ki jagahon se jude kaam ke saath difficulties ka bhi sanket hai.'),
    'House10LordInHouse11': ('Professional gains are supported in this traditional career reading.', 'Is traditional career reading mein professional gains ka support hai.'),
}


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
