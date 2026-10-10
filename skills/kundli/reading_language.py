"""Fixed Hinglish renderings of the reviewed rules, never model translations."""

HINGLISH_THEMES = {
    'House10LordInHouse1': 'Apne kaam ki zimmedari aur independent work ka traditional theme hai; apni pasand aur experience ke hisaab se self-employment explore kar sakte hain.',
    'House10LordInHouse2': 'Family business ya kisi trade se earning ka traditional theme hai; in options ko apne actual experience se compare karein.',
    'House10LordInHouse3': 'Writing, bolne aur chhoti journeys se jude kaam ka traditional theme hai; communication roles explore karein, bina skill assume kiye.',
    'House10LordInHouse4': 'Learning, zameen aur property se jude kaam ka traditional theme hai; education ya property operations explore kar sakte hain.',
    'House10LordInHouse5': 'Commercial brokerage ya speculation se jude professional kaam ka theme hai; yeh risky investment karne ki salah nahi hai.',
    'House10LordInHouse6': 'Service institutions, jaise legal ya healthcare organizations, ka theme hai; isse medical ability assume nahi hoti.',
    'House10LordInHouse7': 'Partnership aur saath milkar kaam karne ka traditional theme hai; collaboration ko apni real preferences se compare karein.',
    'House10LordInHouse9': 'Teaching, spiritual service ya family profession ka theme hai; beliefs aur family circumstances assume nahi kiye ja sakte.',
    'House10LordInHouse11': 'Employment aur professional networks ka traditional theme hai; teamwork, hiring ya community se jude roles ko apne real experience se compare karein.',
    'House10LordInHouse12': 'Door ki jagahon se jude kaam ka traditional theme hai; remote ya international options explore karein, relocation ki prediction nahi.',
    'House5LordInHouse9': 'Seekhne ke baad knowledge share karne ka traditional theme hai; padhne ke baad kisi concept ko apne shabdon mein samjhana try karein.',
    'House5LordInHouse11': 'Writing aur groups ke saath learning ka traditional theme hai; written summaries ya study group try kar sakte hain.',
    'House5LordInHouse12': 'Reflection ya spiritual inquiry ka traditional theme hai; shaant jagah par study ek option hai, aapki pasand ya results ki prediction nahi.',
    'House2LordInHouse10': 'Professional activity se earning ka traditional theme hai; actual payment terms aur apne kaam ki value compare karein.',
    'House7LordInHouse1': 'Pehchaan aur shared history ka traditional relationship theme hai; ek doosre ko samajhne aur trust banane par baat kar sakte hain.',
    'House7LordInHouse4': 'Ghar aur saath rehne ke comfort ka traditional relationship theme hai; living arrangements ki expectations par baat kar sakte hain.',
    'House7LordInHouse10': 'Partnership aur work ke sambandh ka traditional theme hai; ek doosre ke career aur responsibilities par baat karein, future partner ki job ya loyalty assume kiye bina.',
    'MercuryInHouse5': 'Learning aur ideas samjhane ka traditional theme hai; written explanation ya kisi concept ko samjhana try karein, chart ko intelligence test na maanein.',
    'JupiterInHouse5': 'Logic, law aur advisory study ka traditional theme hai; reasoned arguments ya case-based learning ko apne real interests aur qualifications se compare karein.',
    'MoonInHouse5': 'Clarity aur reflective learning ka traditional theme hai; study material organize karke understanding review karein, exam marks ki prediction nahi.',
    'MercuryInHouse11': 'Scientific ya technical learning aur applied engineering explore karne ka theme hai; isse koi course ya profession tay nahi hota.',
    'JupiterInHouse4': 'Reflective learning aur philosophical inquiry ka traditional theme hai; concepts samajhne ko explore karein, ise measured ability na maanein.',
    'MercuryInHouse4': 'Classical source mein education aur diplomatic work ke examples hain; teaching ya communication se jude courses aur roles ko actual interests aur eligibility ke saath explore karein.',
    'JupiterInHouse1': 'Classical source mein law, teaching, writing aur theology ke work examples hain; inki study aur work pathways ko actual interests aur qualifications se compare karein, beliefs ya success assume kiye bina.',
    'MarsInHouse1': 'Initiative aur practical activity ka traditional theme hai; kisi real project ki zimmedari lena explore karein, talent assume kiye bina.',
    'House2LordInHouse1': 'Personal effort aur learning se earning ka traditional theme hai; actual work aur payment arrangements compare karein.',
}

HINGLISH_HOUSES = {
    1: 'apni direction aur priorities', 2: 'resources, family aur bol-chaal',
    3: 'practice, communication aur initiative', 4: 'ghar, foundations aur learning',
    5: 'learning, creativity aur reflection', 6: 'daily service aur practical routines',
    7: 'partnership aur cooperation', 8: 'change aur personal reflection',
    9: 'higher study, teaching aur nazariya', 10: 'kaam aur public responsibilities',
    11: 'groups, networks aur goals', 12: 'akele waqt, reflection aur door ki jagahon',
}


def hinglish_theme(factor):
    if factor['source'] == 'local_house_symbolism':
        return ('Is placement ka traditional sambandh '
                + HINGLISH_HOUSES[factor['fact']['house']] + ' se hai; isse aapki pasand ya future result tay nahi hota.')
    return HINGLISH_THEMES[factor['id']]


# Conversational paraphrases retain the existing reviewed meanings. Legacy
# renderings above stay intact; only the verified native reading uses these.
CONVERSATIONAL_THEMES = {
    'House10LordInHouse1': ('A traditional career direction here is work with personal ownership and autonomy.', 'Career mein apni zimmedari aur independent work ka traditional sambandh aata hai.'),
    'House10LordInHouse2': ('Your career reading points to family business or trade as options to explore.', 'Career reading mein family business ya trade explore karne ka sanket hai.'),
    'House10LordInHouse3': ('Writing, speaking and work involving short journeys are traditional directions to explore.', 'Writing, bolne aur chhoti journeys se jude kaam explore karne ka traditional sambandh aata hai.'),
    'House10LordInHouse4': ('Education, land and property operations are traditional work directions to explore.', 'Education, zameen aur property operations se jude kaam explore karne ka traditional sambandh aata hai.'),
    'House10LordInHouse5': ('The traditional work connection is commercial brokerage or speculation; this is not investment advice.', 'Traditional work connection commercial brokerage ya speculation se hai; yeh investment karne ki salah nahi hai.'),
    'House10LordInHouse6': ('The traditional career connection is service in institutions, including legal or healthcare organizations.', 'Traditional career sambandh service institutions, jaise legal ya healthcare organizations, se hai.'),
    'House10LordInHouse7': ('Partnerships and cooperative ventures are traditional work directions to explore.', 'Partnership aur saath milkar kaam karna ek traditional career direction hai.'),
    'House10LordInHouse9': ('Teaching, spiritual service and a family profession are traditional directions to explore.', 'Teaching, spiritual service ya family profession se jude kaam explore karne ka traditional sambandh aata hai.'),
    'House10LordInHouse11': ('Employment and professional networks are traditional career themes here.', 'Career ki traditional reading mein employment aur professional networks ka sambandh aata hai.'),
    'House10LordInHouse12': ('Work connected with distant places is a traditional direction to explore.', 'Door ki jagahon se jude kaam explore karne ka traditional sambandh aata hai.'),
    'House5LordInHouse9': ('For study, the traditional theme is learning and then sharing that knowledge.', 'Padhai mein seekhne ke baad knowledge share karne ka traditional sambandh aata hai.'),
    'House5LordInHouse11': ('Writing and learning with groups are traditional study themes here.', 'Padhai ki traditional reading mein writing aur groups ke saath learning ka sambandh aata hai.'),
    'House5LordInHouse12': ('Reflection and spiritual inquiry are traditional study themes here.', 'Padhai ki traditional reading mein reflection aur spiritual inquiry ka sambandh aata hai.'),
    'House2LordInHouse10': ('A second traditional connection is earning through professional activity.', 'Ek aur traditional sambandh professional kaam se earning ka hai.'),
    'House7LordInHouse1': ('The traditional relationship theme is familiarity and shared history.', 'Relationship ki traditional reading mein pehchaan aur shared history ka sambandh aata hai.'),
    'House7LordInHouse4': ('For marriage, the chart highlights home and expectations about living together.', 'Shaadi ki reading mein ghar aur saath rehne ki expectations khaas hain.'),
    'House7LordInHouse10': ('The traditional relationship theme connects partnership with work and shared responsibilities.', 'Relationship ki traditional reading mein partnership ka sambandh work aur shared responsibilities se hai.'),
    'MercuryInHouse5': ('Learning and explaining ideas is another traditional study theme.', 'Ideas seekhna aur unhein samjhana padhai ka ek aur traditional theme hai.'),
    'JupiterInHouse5': ('Logic, law and advisory study are traditional directions to explore.', 'Logic, law aur advisory study explore karne ka traditional sambandh aata hai.'),
    'MoonInHouse5': ('Clarity and reflection are another traditional study theme.', 'Concepts ko clear karna aur un par sochna padhai ka ek aur traditional theme hai.'),
    'MercuryInHouse11': ('Scientific or technical learning and applied engineering are traditional directions to explore.', 'Scientific ya technical learning aur applied engineering explore karne ka traditional sambandh aata hai.'),
    'JupiterInHouse4': ('Reflective learning and philosophical inquiry are another traditional study theme.', 'Concepts par sochna aur philosophical inquiry padhai ka ek aur traditional theme hai.'),
    'MercuryInHouse4': ('The classical source gives education and diplomatic work as occupational examples; teaching or communication-related pathways are options to explore, not measured aptitude.', 'Classical source mein education aur diplomatic work ke examples hain; teaching ya communication se jude pathways explore karne ke options hain, ability ka test nahi.'),
    'JupiterInHouse1': ('Law, teaching, writing and theology are classical occupational examples; their study and work pathways are options to explore, not promised professions.', 'Law, teaching, writing aur theology classical work examples hain; inki study aur work pathways explore karne ke options hain, pakki profession ki prediction nahi.'),
    'MarsInHouse1': ('Initiative and practical activity are another traditional work theme.', 'Initiative aur practical kaam career ka ek aur traditional theme hai.'),
    'House2LordInHouse1': ('Earning through personal effort and learning is another traditional connection.', 'Apni mehnat aur learning se earning ka ek aur traditional sambandh aata hai.'),
}
HINDI_PLANETS = {'Sun': 'Surya', 'Moon': 'Chandra', 'Mercury': 'Budh', 'Venus': 'Shukra',
                 'Mars': 'Mangal', 'Jupiter': 'Guru', 'Saturn': 'Shani', 'Rahu': 'Rahu', 'Ketu': 'Ketu'}
HINDI_SIGNS = dict(zip(('Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra',
                       'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'),
                      ('Mesh', 'Vrishabh', 'Mithun', 'Kark', 'Simha', 'Kanya', 'Tula',
                       'Vrishchik', 'Dhanu', 'Makar', 'Kumbh', 'Meen')))


def conversational_theme(factor, topic, hi):
    if factor['source'] == 'local_house_symbolism':
        from reading import HOUSE_SYMBOLS
        house = factor['fact']['house']
        if hi:
            label = {'education': 'padhai', 'marriage': 'relationship', 'career': 'career'}[topic]
            return f"Aapki {label} ki reading mein {HINGLISH_HOUSES[house]} ka sambandh aata hai."
        return f"Your {topic} reading connects with {HOUSE_SYMBOLS[house]}."
    return CONVERSATIONAL_THEMES[factor['id']][1 if hi else 0]
