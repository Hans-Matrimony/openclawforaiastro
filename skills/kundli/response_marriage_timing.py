"""Bounded traditional marriage screen; not a calibrated event predictor.

Weekly observations over two years combine birth-balanced MD/AD/PD links to
the seventh house, Jupiter/Saturn activation and selected natal/D9 conditions.
Months summarize observations, never exact or uninterrupted event windows.
Astronomical samples come only from the authenticated primary engine.
"""
import calendar
from datetime import datetime, timedelta, timezone
import math

try:
    from .response_calculations import divisional_chart, planet_conditions, ASPECTS
    from .topic_rules import SIGNS, LORDS
    from .timing_periods import periods
except ImportError:
    from response_calculations import divisional_chart, planet_conditions, ASPECTS
    from topic_rules import SIGNS, LORDS
    from timing_periods import periods

METHOD = 'marriage-weekly-double-transit-v1'
MARRIAGE_SCOPES = ('timing_context', 'marriage_why', 'marriage_simple', 'marriage_detail')
HORIZON_DAYS = 730
STEP_DAYS = 7
ORB = {'Moon': 12, 'Mars': 17, 'Mercury': 14, 'Venus': 10, 'Jupiter': 11, 'Saturn': 15}


def sample_dates(as_of):
    if not isinstance(as_of, datetime) or as_of.tzinfo is None:
        raise ValueError('Aware sampling instant required')
    at = as_of.astimezone(timezone.utc)
    return [at + timedelta(days=day) for day in range(0, HORIZON_DAYS + 1, STEP_DAYS)]


def reaches_seventh(planet, house):
    return house == 7 or any((house + offset - 2) % 12 + 1 == 7 for offset in ASPECTS.get(planet, ()))


def assess_marriage(chart, birth, as_of, samples):
    dates = sample_dates(as_of)
    if not isinstance(samples, list) or len(samples) != len(dates):
        raise ValueError('Incomplete marriage transit samples')
    positions = chart['positions']
    asc = SIGNS.index(chart['lagna'])
    seventh_lord = LORDS[(asc + 6) % 12]
    conditions = planet_conditions(chart)['planets']
    d9 = divisional_chart(chart, 9)
    d9_conditions = planet_conditions(d9)['planets']
    born = datetime.fromisoformat(birth['utc']).astimezone(timezone.utc)
    # Calendar adulthood, with March 1 as the conservative non-leap anniversary.
    try:
        adult = born.replace(year=born.year + 18)
    except ValueError:
        adult = born.replace(year=born.year + 18, month=3, day=1)

    def linked(planet):
        return planet == seventh_lord or reaches_seventh(planet, positions[planet]['house'])

    def cautions(planet):
        if planet not in ORB and planet != 'Sun':
            return ['node_strength_not_assessed']
        result = []
        if conditions[planet]['dignity'] == 'debilitated_sign':
            result.append('antardasha_debilitated')
        if d9_conditions[planet]['dignity'] == 'debilitated_sign':
            result.append('antardasha_d9_debilitated')
        if d9_conditions[seventh_lord]['dignity'] == 'debilitated_sign':
            result.append('seventh_lord_d9_debilitated')
        orb = ORB.get(planet, 0)
        if positions[planet]['speed'] < 0 and planet in ('Mercury', 'Venus'):
            orb = {'Mercury': 12, 'Venus': 8}[planet]
        distance = abs((positions[planet]['longitude'] - positions['Sun']['longitude'] + 180) % 360 - 180)
        if planet != 'Sun' and distance < orb:
            result.append('antardasha_combust')
        return result

    months = {}
    aligned, mixed = 0, 0
    for sample, at in zip(samples, dates):
        if (not isinstance(sample, dict) or set(sample) != {'at', 'Jupiter', 'Saturn'} or
                sample['at'] != at.isoformat()):
            raise ValueError('Invalid marriage sampling instant')
        transit_links = []
        for planet in ('Jupiter', 'Saturn'):
            fact = sample[planet]
            if not isinstance(fact, dict) or set(fact) != {'longitude', 'speed'}:
                raise ValueError('Invalid marriage transit measurement')
            lon, speed = fact['longitude'], fact['speed']
            if (type(lon) not in (int, float) or not math.isfinite(lon) or not 0 <= lon < 360 or
                    type(speed) not in (int, float) or not math.isfinite(speed) or not -2 < speed < 2):
                raise ValueError('Invalid marriage transit quantity')
            house = (int(lon // 30) - asc) % 12 + 1
            transit_links.append(reaches_seventh(planet, house))
        current = periods(born, positions['Moon']['longitude'], at)
        md, ad, pd = (current[level]['planet'] for level in ('md', 'ad', 'pd'))
        # No node aspects or assumed node dispositor links.
        period_link = ad not in ('Rahu', 'Ketu') and linked(ad) and any(
            p not in ('Rahu', 'Ketu') and linked(p) for p in (md, pd))
        if at < adult or not period_link or not all(transit_links):
            continue
        flags = cautions(ad)
        kind = 'mixed' if flags else 'aligned'
        aligned += int(not flags)
        mixed += int(bool(flags))
        month = months.setdefault(at.strftime('%Y-%m'), {'aligned_samples': 0, 'mixed_samples': 0, 'cautions': set()})
        month[kind + '_samples'] += 1
        month['cautions'].update(flags)
    windows = []
    for month, hits in sorted(months.items()):
        # A single weekly hit is not enough to list a month. Any opposing
        # observation keeps that month mixed rather than selectively positive.
        if hits['aligned_samples'] + hits['mixed_samples'] >= 2:
            windows.append({'month': month, 'kind': 'mixed' if hits['mixed_samples'] else 'aligned',
                            'aligned_samples': hits['aligned_samples'], 'mixed_samples': hits['mixed_samples'],
                            'cautions': sorted(hits['cautions'])})
    status = ('not_supported_for_minor' if as_of.astimezone(timezone.utc) < adult else
              'candidate_months' if any(w['kind'] == 'aligned' for w in windows) else
              'mixed_only' if windows else 'no_combined_window')
    if status == 'not_supported_for_minor':
        windows = []
    return {'method': METHOD, 'status': status, 'horizon_days': HORIZON_DAYS, 'sampling_days': STEP_DAYS,
            'as_of_utc': as_of.astimezone(timezone.utc).isoformat(), 'seventh_lord': seventh_lord,
            'current_period': periods(born, positions['Moon']['longitude'], as_of),
            'strength_components': {'seventh_lord': conditions[seventh_lord]['dignity'],
                                    'seventh_lord_d9': d9_conditions[seventh_lord]['dignity'],
                                    'shadbala': 'not_computed'},
            'scan_counts': {'aligned': aligned, 'mixed': mixed}, 'months': windows,
            'interpretation': 'conditional_traditional_screen_not_calibrated',
            'exact_event_date': 'not_established', 'samples': samples}


def month_label(month):
    year, number = map(int, month.split('-'))
    return f'{calendar.month_name[number]} {year}'


def timing_sentences(screen, language, scope='timing_context'):
    hi = language == 'hinglish'
    candidates = [month_label(w['month']) for w in screen['months'] if w['kind'] == 'aligned'][:3]
    if screen['status'] == 'not_supported_for_minor':
        return [('Abhi aapke liye shaadi ka timing forecast nahi diya jaayega.' if hi else
                 'I do not provide marriage timing forecasts for minors.')]
    if candidates:
        months = ', '.join(candidates)
        answer = (f'Shaadi ke liye {months} mein dasha aur gochar ke chuninda sanket saath aate hain. In mahino ko sambhavit maukon ke taur par dekhein, pakki shaadi ki tareekh ke taur par nahi.' if hi else
                  f'For marriage, the selected period and transit indicators come together in {months}. These are conditional opportunity months, not promised wedding dates.')
    elif screen['status'] == 'mixed_only':
        answer = ('Agle do saal ki jaanch mein shaadi ke sanket mile-jule hain. Dasha aur gochar ke saath kuch virodhi sanket bhi hain, isliye is jaanch se koi saaf mahina nahi nikalta.' if hi else
                  'The two-year marriage screen is mixed. Some period and transit links have opposing conditions, so no clear opportunity month stands out.')
    else:
        answer = ('Agle do saal ki jaanch mein dasha aur gochar ke chuninda sanket ek saath saaf nahi mile. Isse shaadi na hone ka nateeja nahi nikalta.' if hi else
                  'The selected period and transit indicators do not line up clearly in the two-year scan. That does not mean you will not marry.')
    reason = ('Iske liye maine shaadi se judi dasha, Guru-Shani ke gochar aur D9 ke chuninda sanket saath dekhe hain.' if hi else
              'I checked marriage-related dasha periods, Jupiter and Saturn transits, and selected D9 conditions together.')
    if scope == 'marriage_simple':
        plain = ('Yeh dasha aur Guru/Shani ke gochar ke chuninda sanket hain; inse shaadi ki pakki tareekh nahi nikalti.' if hi else
                 'These are selected indicators from your dasha and Jupiter/Saturn transits; they do not fix a wedding date.')
        return [answer, plain]
    if scope == 'marriage_why':
        rule = ('Mahina chunne ke liye shaadi se judi dasha aur Guru-Shani ka support ek saath, ek se zyada baar milna zaroori rakha hai. Jahan saath mein virodhi sanket mile, use saaf mauka nahi maana.' if hi else
                'A month needs repeated support from marriage-related dasha periods and Jupiter/Saturn transits together. Opposing conditions keep it mixed.')
        return [rule, answer]
    if scope == 'marriage_detail':
        detail = ('Ismein MD/AD/PD ka saatve ghar se sambandh aur 730 din ke andar har saat din ke gochar dekhe gaye hain. Poora Shadbala calculate nahi hua hai; kisi mahine ko chunne ka matlab uske har din support hona ya shaadi ki guarantee nahi hai.' if hi else
                  'The scan checks seventh-house links in MD/AD/PD and samples transits every seven days within 730 days. Full Shadbala is not computed; a listed month does not imply daily support or a guaranteed wedding.')
        return [answer, reason, detail]
    return [answer, reason]
