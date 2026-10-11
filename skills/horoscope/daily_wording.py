"""Original wording for typed native daily facts; never a generative forecast."""
from datetime import datetime
from reading_language import HINDI_PLANETS, HINDI_SIGNS
from vedha_geometry import validate_vedha

THEMES = {
    1: ('personal plans', 'apni planning'), 2: ('family conversations and spending', 'family ki baat aur kharch'),
    3: ('communication', 'communication'), 4: ('home and daily comfort', 'ghar aur daily comfort'),
    5: ('creative work', 'creative kaam'), 6: ('routines and responsibilities', 'routine aur zimmedari'),
    7: ('cooperation', 'saath milkar kaam'), 8: ('reflection and careful planning', 'soch-vichaar aur planning'),
    9: ('learning and mentors', 'learning aur mentors'), 10: ('professional responsibilities', 'kaam ki zimmedari'),
    11: ('friends and networks', 'dost aur networks'), 12: ('rest and reviewing expenses', 'aaram aur kharch review'),
}
TASKS = {
    1: ('choose one manageable personal priority', 'ek manageable personal priority chunein'),
    2: ('check a spending commitment before agreeing', 'kharch ki commitment dene se pehle check karein'),
    3: ('keep an important message clear and brief', 'zaroori message clear aur chhota rakhein'),
    4: ('clarify one household responsibility', 'ghar ki ek zimmedari clear karein'),
    5: ('finish a small creative draft', 'ek chhota creative draft poora karein'),
    6: ('plan essential tasks with breaks', 'zaroori kaam aur breaks ki planning karein'),
    7: ('confirm a shared plan before proceeding', 'saath ki planning aage badhane se pehle confirm karein'),
    8: ('double-check details before a decision', 'faisle se pehle details dobara check karein'),
    9: ('review one learning question with a mentor', 'mentor ke saath learning ka ek sawaal review karein'),
    10: ('set a concrete work priority', 'kaam ki ek concrete priority tay karein'),
    11: ('follow up on one useful conversation', 'ek useful conversation par follow-up karein'),
    12: ('review an expense and make time to rest', 'ek kharch review karein aur aaram ka waqt rakhein'),
}


def render_daily(evidence, language):
    if evidence['schema'] != 'reviewed-daily-evidence-v1' or language not in ('english', 'hinglish'):
        raise ValueError('Unsupported daily reading contract')
    if evidence['event_prediction_available'] is not False or type(evidence['obstruction_evaluated']) is not bool:
        raise ValueError('Unreviewed daily outcome claim')
    vedha = evidence.get('gochara_vedha')
    if evidence['obstruction_evaluated']:
        if not validate_vedha(vedha,evidence['transits']):
            raise ValueError('Unreviewed daily obstruction geometry')
    elif vedha is not None:
        raise ValueError('Unexpected daily obstruction geometry')
    hi = language == 'hinglish'
    if set(evidence['kakshas']) != {'Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'} or any(
            type(row['kaksha_score']) is not int or row['kaksha_score'] not in (0,1)
            for row in evidence['kakshas'].values()):
        raise ValueError('Invalid daily transit indicators')
    when = datetime.fromisoformat(evidence['as_of_utc'])
    date = when.strftime('%d %B %Y').lstrip('0')
    marked = sum(row['kaksha_score'] for row in evidence['kakshas'].values())
    if marked == 7:
        lead = (f'{date} ki traditional transit reading mein supportive points hain; yeh har kaam mein success ka vaada nahi hai.' if hi else
                f'The traditional transit indicators for {date} contain supportive points, without promising success in every activity.')
    elif marked == 0:
        lead = (f'{date} ke transit indicators mein favorable point nahi mila; iska matlab pakka bura din nahi hai.' if hi else
                f'The transit indicators for {date} have no favorable points; this does not establish a bad day.')
    else:
        lead = (f'{date} ki traditional transit reading mixed hai: kuch indicators supportive hain, lekin sab nahi.' if hi else
                f'The traditional transit reading for {date} is mixed: some indicators show support, but not all.')
    # Select at most one point and one missing point for explanation. This order
    # controls presentation only; it is not a weight or event-probability score.
    order = ('Moon','Jupiter','Mercury','Venus','Saturn','Mars','Sun')
    positive = next((name for name in order if evidence['kakshas'][name]['kaksha_score'] == 1), None)
    missing = next((name for name in order if evidence['kakshas'][name]['kaksha_score'] == 0), None)
    nuance = ''
    if positive and missing:
        def position(name):
            planet = HINDI_PLANETS[name] if hi else name
            if name == 'Moon':
                return planet  # The next sentence supplies the Moon's sign.
            sign = evidence['transits'][name]['sign']
            return f'{HINDI_SIGNS[sign]} rashi mein {planet}' if hi else f'{planet} in {sign}'
        if hi:
            nuance = f'{position(positive)} ka Kaksha point supportive hai, jabki {position(missing)} ko favorable point nahi mila.'
        else:
            nuance = f'{position(positive)} has a supportive Kaksha point, while {position(missing)} has no favorable point.'
    if vedha is not None:
        # Report a qualifying obstruction alongside a point, never turn a
        # favorable/absent binary point into an event verdict or probability.
        qualified = next((name for name in order if evidence['kakshas'][name]['kaksha_score'] == 1
                          and vedha['planets'][name]['obstructed']),None)
        if qualified:
            row = vedha['planets'][qualified]
            blockers = ', '.join(HINDI_PLANETS[name] if hi else name for name in row['obstructing_planets'])
            point = row['obstruction_house_from_natal_moon']
            clause = (f'{HINDI_PLANETS[qualified]} ki separate Vedha check mein {blockers} janam rashi se obstruction ghar {point} mein hain.' if hi else
                      f'The separate Vedha check for {qualified} finds {blockers} in obstruction house {point} from your natal Moon.')
            nuance = (nuance + ' ' + clause).strip()
    moon = evidence['transits']['Moon']
    house = moon['house_from_natal_moon']
    sign = HINDI_SIGNS[moon['sign']] if hi else moon['sign']
    theme = THEMES[house][hi]
    detail = (f'Is snapshot mein Chandra {sign} mein hain, aapki janam rashi se ghar {house}; iska general theme {theme} hai.' if hi else
              f'In this snapshot the Moon is in {sign}, house {house} from your natal Moon; its general theme is {theme}.')
    task = TASKS[house][hi]
    phase = evidence['current_period']
    major, minor = phase['mahadasha'], phase['antardasha']
    ratings = evidence['timing_context']['period_ratings']
    domains = ('family','relationship','study')
    caution = next((d for d in domains if ratings[d] == 'Bad'), None)
    support = next((d for d in domains if ratings[d] == 'Good'), None)
    period = ''
    if caution or support:
        parts = ([f'{support} support' if not hi else f'{support} ke supportive sanket'] if support else [])
        if caution:
            parts.append(f'{caution} caution' if not hi else f'{caution} mein caution')
        label = f'{HINDI_PLANETS[major]}-{HINDI_PLANETS[minor]}' if hi else f'{major}-{minor}'
        categories = (' aur ' if hi else ' and ').join(parts)
        period = (f'{label} ki broader period table {categories} dikhati hai; yeh ek din ka forecast nahi hai. ' if hi else
                  f'The broader {label} period table suggests {categories}; this is not a one-day forecast. ')
    practical = (f'Practical focus: {task}. Yeh traditional guidance hai, guaranteed outcome nahi.' if hi else
                 f'Practical focus: {task}. These are traditional indicators, without a guaranteed outcome.')
    return '\n\n'.join((lead + (' ' + nuance if nuance else ''), detail, period + practical))
