"""Compact interpretations of the admitted house themes, without new outcomes.

Only delivery changes here. Canonical evidence stays independently recomputable,
and chart, periods and technical detail requests retain their original owners.
"""
try:
    from .topic_rules import HINDI_NAMES, HOUSE_NAMES
except ImportError:
    from topic_rules import HINDI_NAMES, HOUSE_NAMES

SCOPES = ('overview', 'simple', 'why')


def topic_options(evidence, themes, labels, secondary_labels):
    topic, scope = evidence['topic'], evidence['scope']
    if scope not in SCOPES:
        raise ValueError('Unsupported consultation wording scope')
    first, second = evidence['assessment']['factors']
    hi = evidence['language'] == 'hinglish'
    index = 1 if hi else 0
    theme = themes[first['house']][index]
    extra_theme = themes[second['house']][index]
    label = labels[topic][index]
    extra_label = secondary_labels[topic][index]
    if hi:
        subject = {'career': 'Career', 'education': 'Padhai', 'relationship': 'Love life',
                   'marriage': 'Shaadi', 'finance': 'Paison'}[topic]
        opening = {'career': f'Career mein aapki kundli {theme} se jude kaam ki direction dikhati hai.',
                   'education': f'Padhai ke liye aapki kundli {theme} wali direction dikhati hai.',
                   'relationship': f'Love life mein aapki kundli {theme} ko ahmiyat deti hai.',
                   'marriage': f'Shaadi ki reading mein aapki kundli {theme} ko ahmiyat deti hai.',
                   'finance': f'Paison ke maamle mein aapki kundli {theme} se judi direction dikhati hai.'}[topic]
        answer = [opening,
                  f'{subject} mein aapki kundli ka seedha sanket {theme} ki taraf hai.',
                  f'Aapki kundli {subject.lower()} ke liye {theme} ko ahmiyat deti hai.',
                  f'{subject} ki is kundli reading mein {theme} sabse pehle saamne aata hai.']
        ruler = HINDI_NAMES[first['planet']]
        owned, placed = HOUSE_NAMES[first['rules_house'] - 1], HOUSE_NAMES[first['house'] - 1]
        reason = [f'Iska aadhar aapki kundli ke {ruler} hain: {owned} ghar ke swami hokar woh {placed} ghar mein hain, jo {theme} se juda hai.',
                  f'Aapki kundli mein {ruler} {owned} ghar ke swami hokar {placed} ghar mein hain; yeh ghar {theme} se juda hai.',
                  f'Iski wajah kundli mein {ruler} ki placement hai: {owned} ghar ke swami {placed} ghar mein hain, jiska sambandh {theme} se hai.',
                  f'Aapki kundli ke {ruler} {owned} ghar ke swami hain aur {placed} ghar mein baithe hain; isi ghar se {theme} ka sambandh hai.']
        brief_reason = [f'Iska aadhar {ruler} hain: aapki kundli mein woh {owned} ghar ke swami hokar {placed} ghar mein hain.',
                        f'Yeh {ruler} ki sthiti se aata hai: aapki kundli mein woh {owned} ghar ke swami hain aur {placed} ghar mein hain.',
                        f'Is reading ki wajah {ruler} hain, jo aapki kundli mein {owned} ghar ke swami hokar {placed} ghar mein baithe hain.',
                        f'Aapki kundli mein {ruler} {placed} ghar mein hain aur {owned} ghar ke swami hain; yahi is reading ka aadhar hai.']
        extra = [f'Saath hi, {extra_label} mein {extra_theme} ka pehlu bhi aham hai.',
                 f'{extra_label.capitalize()} ki taraf dekhein toh {extra_theme} bhi is reading ka hissa hai.',
                 f'Doosra pehlu {extra_label} ka hai, jahan {extra_theme} ki ahmiyat aati hai.',
                 f'Iske saath {extra_label} ka sambandh {extra_theme} se bhi dikhta hai.']
        simple = [f'Seedhe shabdon mein, aapki kundli {subject.lower()} mein {theme} par dhyaan dene ko kehti hai.',
                  f'Aasaan matlab: {subject.lower()} mein {theme} ko ahmiyat dein; aapki kundli yahi pehlu dikhati hai.',
                  f'Aapki kundli ka aasaan matlab hai: {subject.lower()} mein {theme} par dhyaan dein.',
                  f'{subject} ke liye {theme} ko ahmiyat dena is kundli reading ka seedha matlab hai.']
    else:
        answer = [f'Your kundli highlights {theme} as important for your {label}.',
                  f'For your {label}, the clear focus in your kundli is {theme}.',
                  f'The direction your kundli highlights for your {label} is {theme}.',
                  f'In this kundli reading, {theme} comes first for your {label}.']
        ruler, owned, placed = first['planet'], first['rules_house'], first['house']
        reason = [f'The reason in your kundli is {ruler}: it rules house {owned} and sits in house {placed}, which relates to {theme}.',
                  f'In your kundli, {ruler} rules house {owned} and is in house {placed}, the connection with {theme}.',
                  f'This reading of your kundli is based on {ruler}, ruler of house {owned}, being in house {placed}, associated with {theme}.',
                  f'Your kundli shows {ruler} ruling house {owned} and occupying house {placed}, associated with {theme}.']
        brief_reason = [f'This is based on {ruler}, which rules house {owned} and sits in house {placed} in your kundli.',
                        f'The basis is {ruler}: in your kundli, it rules house {owned} and occupies house {placed}.',
                        f'{ruler} is the reason for this reading, ruling house {owned} and sitting in house {placed} in your kundli.',
                        f'Your kundli places {ruler}, ruler of house {owned}, in house {placed}; that is the basis of this reading.']
        extra = [f'For {extra_label}, {extra_theme} is also part of the picture.',
                 f'The reading also highlights {extra_theme} when looking at {extra_label}.',
                 f'A second consideration is {extra_label}, where {extra_theme} matters in this reading.',
                 f'Alongside this, {extra_theme} also matters for your {extra_label}.']
        simple = [f'Put simply, your kundli highlights {theme} as the focus for your {label}.',
                  f'In everyday terms, focus on {theme} for your {label}; that is the direction in your kundli.',
                  f'The practical meaning of this kundli reading is to focus on {theme} for your {label}.',
                  f'For your {label}, give attention to {theme}; that is the simple message of this kundli reading.']
    if scope == 'simple':
        return [simple, extra]
    if scope == 'why':
        return [reason, extra]
    return [answer, brief_reason, extra]


def compact_timing_sentences(screen, language, sentences):
    """Keep one timing conclusion and its actual monthly-selection reason."""
    if screen['status'] != 'candidate_months':
        return sentences
    if language == 'hinglish':
        # The existing answer already carries the exact admitted month labels.
        answer = sentences[0].removeprefix('Haan, aapki kundli mein shaadi ke yog dikh rahe hain. ')
        return ['Haan, aapki kundli ke hisaab se ' + answer,
                'In mahino mein shaadi se judi dasha aur Guru-Shani ke gochar ka support saath mil raha hai.']
    answer = sentences[0].removeprefix('Yes, your kundli shows support for marriage. ')
    return [answer.replace('This reading highlights ', 'Yes, your kundli highlights ', 1),
            'These months have repeated support from marriage-related dasha periods and Jupiter/Saturn transits together.']
