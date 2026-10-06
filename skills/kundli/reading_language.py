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
