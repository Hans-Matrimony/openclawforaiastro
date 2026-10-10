"""Explicit traditional screening rules, independently checked by the PWA.

Astronomical inputs come from the authenticated primary ephemeris service.
These local conjunction/aspect/period filters are NOT a calibrated predictor.
No generic auspicious period is converted into a promised personal event.
See TIMING_METHOD.md for conventions, sources, sampling and excluded claims.
"""
import hashlib
import json
import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone

try:
    from .timing_periods import instant, periods, scan_dates
    from .topic_rules import TOPICS, assess_topic, render_topic
    from .separation_rules import SIGNS, LORDS, PLANETS, HINDI_NAMES, aspect_houses, assess_positions, request_fingerprint
except ImportError:
    from timing_periods import instant, periods, scan_dates
    from topic_rules import TOPICS, assess_topic, render_topic
    from separation_rules import SIGNS, LORDS, PLANETS, HINDI_NAMES, aspect_houses, assess_positions, request_fingerprint

REVISION = 'combined-timing-screen-v1'
SETTINGS = {'ayanamsa': 'LAHIRI', 'house_system': 'whole_sign', 'node': 'true',
            'dasha_year_days': 365.25, 'engine': 'pyswisseph'}
EXALT = {'Sun': 10, 'Moon': 33, 'Mars': 298, 'Mercury': 165,
         'Jupiter': 95, 'Venus': 357, 'Saturn': 200}
# Selected conventional combustion orbs in degrees; retrograde exceptions below.
COMBUST = {'Moon': 12, 'Mars': 17, 'Mercury': 14, 'Jupiter': 11, 'Venus': 10, 'Saturn': 15}
LABELS = {'career': ('career', 'career'), 'education': ('learning', 'padhai'),
          'finance': ('earnings', 'kamai'), 'marriage': ('marriage', 'shaadi'),
          'relationship': ('new relationships', 'naye rishton'),
          'separation': ('relationship strain', 'relationship ke tanaav')}


def finite(value, low, high):
    if type(value) not in (int, float) or not math.isfinite(value) or not low <= value < high:
        raise ValueError('Invalid astronomical quantity')
    return value


def distance(a, b):
    return abs((a - b + 180) % 360 - 180)


def navamsa(longitude):
    # Traditional Parashari D9: movable/same, fixed/ninth, dual/fifth.
    return int(longitude * 9 / 30) % 12


def dignity(planet, sign):
    if sign == int(EXALT[planet] // 30):
        return 'exalted'
    if sign == (int(EXALT[planet] // 30) + 6) % 12:
        return 'debilitated'
    return 'own' if LORDS[sign] == planet else 'ordinary'


def strengths(natal):
    result = {}
    for planet in EXALT:
        lon, speed = natal[planet]['longitude'], natal[planet]['speed']
        sign, d9 = int(lon // 30), navamsa(lon)
        orb = COMBUST.get(planet, 0)
        if speed < 0 and planet in ('Mercury', 'Venus'):
            orb = {'Mercury': 12, 'Venus': 8}[planet]
        result[planet] = {'dignity': dignity(planet, sign), 'navamsa_sign': SIGNS[d9],
                          'navamsa_dignity': dignity(planet, d9), 'vargottama': sign == d9,
                          'uchcha_virupas': round(distance(lon, (EXALT[planet] + 180) % 360) / 3, 6),
                          'combust': planet != 'Sun' and distance(lon, natal['Sun']['longitude']) < orb,
                          'retrograde': speed < 0}
    return result


def positions_from(lagna_longitude, natal):
    asc = int(finite(lagna_longitude, 0, 360) // 30)
    if not isinstance(natal, dict) or set(natal) != set(PLANETS):
        raise ValueError('Incomplete timing chart')
    positions = {}
    for planet, value in natal.items():
        if not isinstance(value, dict) or set(value) != {'longitude', 'speed'}:
            raise ValueError('Invalid timing position')
        lon = finite(value['longitude'], 0, 360)
        finite(value['speed'], -20, 20)
        sign = int(lon // 30)
        positions[planet] = {'planet': planet, 'sign': SIGNS[sign], 'house': (sign - asc) % 12 + 1}
    if not math.isclose((natal['Ketu']['longitude'] - natal['Rahu']['longitude']) % 360, 180, abs_tol=1e-7):
        raise ValueError('Conflicting lunar nodes')
    return SIGNS[asc], positions


def evidence_digest(e):
    return hashlib.sha256(json.dumps({key: e[key] for key in
        ('birth', 'settings', 'lagna_longitude', 'natal')}, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def connected(planet, targets, asc, positions):
    if planet in ('Rahu', 'Ketu'):
        return False  # Node dispositors/aspects differ by school; no guessed rules.
    ruled = {h for h in range(1, 13) if LORDS[(asc + h - 1) % 12] == planet}
    p = positions[planet]
    return bool(set(targets) & (ruled | {p['house']} | set(aspect_houses(planet, p['house']))))


def separation_natal(lagna, positions, natal):
    """Resolve the old Mars rule's missing phase/association conditions.

    Selected convention: waxing Moon is benefic; Mercury is benefic only when
    not co-sign with Sun/Mars/Saturn/nodes or a waning Moon. No node aspects.
    """
    a = assess_positions(lagna, positions)
    waxing = 0 < (natal['Moon']['longitude'] - natal['Sun']['longitude']) % 360 <= 180
    mercury_sign = positions['Mercury']['sign']
    malefics = ['Sun', 'Mars', 'Saturn', 'Rahu', 'Ketu'] + ([] if waxing else ['Moon'])
    mercury_benefic = not any(positions[p]['sign'] == mercury_sign for p in malefics)
    a['benefic_conditions'] = {'moon_waxing': waxing, 'mercury_unassociated_with_selected_malefics': mercury_benefic}
    if 'MarsIn7thNoBenefics' in a['unevaluated']:
        influences = a['seventh_influences']
        protected = ('Moon' in influences and waxing) or ('Mercury' in influences and mercury_benefic)
        a['unevaluated'].remove('MarsIn7thNoBenefics')
        if not protected:
            a['matched'].append({'id': 'MarsIn7thNoBenefics', 'kind': 'separation_indication', 'planet': 'Mars'})
            a['status'] = 'separation_indication'
    return a


def assess_timing(e, topic):
    if topic not in LABELS:
        raise ValueError('Unsupported timing topic')
    lagna, positions = positions_from(e['lagna_longitude'], e['natal'])
    asc = SIGNS.index(lagna)
    natal = e['natal']
    at, birth = instant(e['as_of_utc']), instant(e['birth']['birth_utc'])
    if at < birth:
        raise ValueError('Future birth input')
    targets = (7, 6, 8, 12) if topic == 'separation' else TOPICS[topic]
    lord = LORDS[(asc + targets[0] - 1) % 12]
    strength = strengths(natal)
    natal_assessment = (separation_natal(lagna, positions, natal) if topic == 'separation' else
                        assess_topic(lagna, positions, topic))
    active = periods(birth, natal['Moon']['longitude'], at)
    expected_dates = scan_dates(at)
    samples = e['transits']
    if not isinstance(samples, list) or len(samples) != len(expected_dates):
        raise ValueError('Incomplete transit scan')
    monthly = defaultdict(list)
    counts = {'period_aligned': 0, 'transit_aligned': 0, 'combined_aligned': 0, 'combined_mixed': 0}
    for sample, when in zip(samples, expected_dates):
        if not isinstance(sample, dict) or set(sample) != {'at', 'Jupiter', 'Saturn'} or instant(sample['at']) != when:
            raise ValueError('Invalid transit sampling instant')
        houses = {}
        for planet in ('Jupiter', 'Saturn'):
            value = sample[planet]
            if not isinstance(value, dict) or set(value) != {'longitude', 'speed'}:
                raise ValueError('Invalid transit sample')
            lon = finite(value['longitude'], 0, 360)
            finite(value['speed'], -1, 1)
            houses[planet] = (int(lon // 30) - asc) % 12 + 1
        ps = periods(birth, natal['Moon']['longitude'], when)
        dp = [ps[level]['planet'] for level in ('md', 'ad', 'pd')]
        period_match = (connected(dp[1], targets, asc, positions) and
                        any(connected(p, targets, asc, positions) for p in (dp[0], dp[2])))
        # Jupiter's presence/aspects are supportive symbolism, not event proof.
        j_hits = sorted(set(targets) & ({houses['Jupiter']} | set(aspect_houses('Jupiter', houses['Jupiter']))))
        s_hits = sorted(set(targets) & ({houses['Saturn']} | set(aspect_houses('Saturn', houses['Saturn']))))
        transit_match = bool(s_hits) if topic == 'separation' else bool(j_hits)
        counts['period_aligned'] += int(period_match)
        counts['transit_aligned'] += int(transit_match)
        # Separation needs an actual selected natal separation condition, not a
        # general marriage period. Never forecast court finalization.
        eligible = topic != 'separation' or natal_assessment['status'] == 'separation_indication'
        if topic in ('relationship', 'marriage') and (when - birth).days < 18 * 365.25:
            eligible = False
        ad_strength = strength.get(dp[1])
        cautions = []
        if ad_strength is None:
            cautions.append('node_period_not_assessed')
        else:
            if ad_strength['dignity'] == 'debilitated':
                cautions.append('antardasha_debilitated')
            if ad_strength['combust']:
                cautions.append('antardasha_combust')
            if ad_strength['navamsa_dignity'] == 'debilitated':
                cautions.append('antardasha_navamsa_debilitated')
        if topic != 'separation' and s_hits:
            cautions.append('saturn_pressure')
        if period_match and transit_match and eligible:
            kind = 'mixed' if cautions else 'aligned'
            counts['combined_' + kind] += 1
            monthly[when.strftime('%Y-%m')].append({'at': when.isoformat(),
                'periods': dp, 'jupiter_houses': j_hits, 'saturn_houses': s_hits,
                'kind': kind, 'cautions': cautions})
    windows = []
    # At least two seven-day observations in the same month; no inferred exact
    # start/end day or claim of uninterrupted support between observations.
    for month, hits in sorted(monthly.items()):
        if len(hits) >= 2:
            windows.append({'month': month, 'kind': 'aligned' if all(h['kind'] == 'aligned' for h in hits) else 'mixed',
                            'observations': hits})
    return {'status': 'candidate_months' if windows else 'no_combined_window',
            'natal': natal_assessment, 'strengths': strength, 'current_period': active,
            'topic_lord': lord, 'scan_counts': counts, 'windows': windows,
            'sampling_days': 7, 'horizon_days': 730,
            'interpretation': 'traditional_screen_not_calibrated',
            'legal_finalization': 'not_predictable', 'private_actions': 'not_predictable',
            'shadbala': 'not_computed'}


def render_timing(a, topic, language, intent):
    if language not in ('english', 'hinglish') or intent not in ('overview', 'timing', 'contact', 'detail', 'brief'):
        raise ValueError('Unsupported timing rendering')
    if intent == 'contact' and topic != 'relationship':
        raise ValueError('Contact is relationship-only')
    hi = language == 'hinglish'
    if topic == 'separation':
        opening = {'not_established': (
            'The checked natal conditions do not establish a clear separation indication; this does not rule divorce out.',
            'Check kiye gaye janm-kundli yogon mein separation ka saaf sanket nahi milta; isse divorce impossible nahi maana jaata.'),
            'strain_indication': ('The checked natal conditions indicate relationship strain, without confirming separation.',
                                 'Check kiye gaye yog relationship mein tanaav dikhate hain, separation confirm nahi karte.'),
            'separation_indication': ('A selected traditional separation indication is present in your natal chart.',
                                     'Aapki janm-kundli mein check kiya gaya separation ka paramparik sanket milta hai.')}[a['natal']['status']][hi]
    else:
        opening = render_topic(a['natal'], topic, language, 'detail' if intent in ('contact', 'detail') else 'overview')
    if intent == 'brief':
        return opening
    paragraphs = [opening]
    if topic == 'separation':
        from_house = a['natal']['seventh_lord_house']
        try:
            from .separation_rules import HOUSE_NAMES
        except ImportError:
            from separation_rules import HOUSE_NAMES
        lord7 = a['natal']['seventh_lord']
        paragraphs.append((f"Saatve ghar ke swami {HINDI_NAMES[lord7]} {HOUSE_NAMES[from_house - 1]} ghar mein hain." if hi else
                           f"The seventh-house lord {lord7} is in house {from_house}."))
    p = a['current_period']
    names = [p[level]['planet'] for level in ('md', 'ad', 'pd')]
    names = [HINDI_NAMES[n] for n in names] if hi else names
    paragraphs.append((f"Abhi {names[0]} mahadasha, {names[1]} antardasha aur {names[2]} pratyantardasha chal rahi hai." if hi else
                       f"The active MD/AD/PD periods are {names[0]} / {names[1]} / {names[2]}."))
    lord = a['topic_lord']
    s = a['strengths'][lord]
    labels = {'exalted': ('exalted', 'uchcha'), 'own': ('in its own sign', 'apni rashi mein'),
              'debilitated': ('debilitated', 'neecha'), 'ordinary': ('neither exalted nor debilitated', 'na uchcha na neecha')}
    info = labels[s['dignity']][hi]
    cautions = []
    if s['combust']:
        cautions.append('Surya ke kareeb hone se asta' if hi else 'combust near the Sun')
    if s['navamsa_dignity'] == 'debilitated':
        cautions.append('Navamsha mein neecha' if hi else 'debilitated in Navamsha')
    extra = ('; ' + ', '.join(cautions)) if cautions else ''
    paragraphs.append((f"Is topic ke swami {HINDI_NAMES[lord]} janm-rashi mein {info} hain{extra}." if hi else
                       f"The topic ruler {lord} is {info} in the natal sign{extra}."))
    candidates = [w for w in a['windows'] if w['kind'] == 'aligned'][:3]
    if candidates and intent != 'contact':
        months = ', '.join(w['month'] for w in candidates)
        paragraphs.append((f"Dasha, grah-sthiti aur Guru-Shani ke gochar ko saath check karne par {months} mein {LABELS[topic][1]} ke liye paramparik sanket milte hain. Yeh sambhavit maukon ke mahine hain, pakke event ki dates nahi." if hi else
                           f"The combined period, strength and Jupiter/Saturn transit screen flags {months} for {LABELS[topic][0]}. These are traditional opportunity months, not guaranteed event dates."))
    else:
        reason = ('natal separation ka yog clear nahi hai' if hi else 'a natal separation indication is not established') if topic == 'separation' and a['natal']['status'] != 'separation_indication' else (
            'dasha, gochar aur strength ke sanket ek saath saaf support nahi dete' if hi else
            'period, transit and strength factors do not provide clear combined support')
        paragraphs.append((f"Agle do saal ki saath mein ki gayi jaanch mein {reason}. Isliye is assessment se saaf event-window nahi nikli; iska matlab mauka kabhi nahi aayega, aisa nahi hai." if hi else
                           f"In the combined two-year scan, {reason}. No clear event window is established by this screen; this does not exclude future opportunities."))
    if intent == 'contact':
        paragraphs[-1] = ('Yeh aapke apne relationship ke samay ka assessment hai; unke reply karne ka din ya unka faisla isse confirm nahi hota.' if hi else
                          'This assesses your own relationship context; it cannot establish their decision or the day they will reply.')
    if topic == 'separation':
        paragraphs.append('Court mein divorce final hone ki deadline is reading se nahi nikalti.' if hi else
                          'This reading does not determine a court divorce deadline.')
    return '\n\n'.join(paragraphs)


def validate_timing_result(result, request, now=None):
    """Recompute all period/strength/rule/window/prose results before display.

    Astronomical measurements are trusted only from the authenticated service;
    the PWA does not secretly call a second ephemeris or an LLM judge.
    """
    try:
        if (not isinstance(result, dict) or set(result) != {'schema', 'text', 'language', 'intent', 'request_fingerprint',
                                                          'model_calls', 'model_tokens', 'evidence', 'assessment'} or
                result['schema'] != 'reviewed-timing-v1' or result['language'] != request['language'] or
                result['intent'] != request['intent'] or result['request_fingerprint'] != request_fingerprint(request) or
                type(result['model_calls']) is not int or result['model_calls'] != 0 or
                type(result['model_tokens']) is not int or result['model_tokens'] != 0):
            return False
        e = result['evidence']
        if (set(e) != {'schema', 'rules_revision', 'topic', 'birth', 'settings', 'lagna_longitude', 'natal',
                      'transits', 'as_of_utc', 'input_fingerprint'} or
                e['schema'] != 'timing-evidence-v1' or e['rules_revision'] != REVISION or e['topic'] != request['topic'] or
                e['settings'] != SETTINGS or e['input_fingerprint'] != evidence_digest(e)):
            return False
        b = e['birth']
        if set(b) != {'dob', 'tob', 'place', 'coordinates', 'timezone_offset', 'birth_utc'} or any(
                b[key] != request[key] for key in ('dob', 'tob', 'place')):
            return False
        if set(b['coordinates']) != {'lat', 'lon'}:
            return False
        finite(b['coordinates']['lat'], -90, 90.000001)
        finite(b['coordinates']['lon'], -180, 180.000001)
        finite(b['timezone_offset'], -14, 14.000001)
        # The primary parser supports other date formats; canonical ISO inputs
        # also get an independent birth UTC/offset check here.
        try:
            local = datetime.fromisoformat(request['dob'] + 'T' + request['tob'])
        except ValueError:
            local = None
        if local is not None and (local.tzinfo is not None or
                (local - timedelta(hours=b['timezone_offset'])).replace(tzinfo=timezone.utc) != instant(b['birth_utc'])):
            return False
        stamp = instant(e['as_of_utc'])
        if not -30 <= (instant(now or datetime.now(timezone.utc)) - stamp).total_seconds() <= 120:
            return False
        expected = assess_timing(e, request['topic'])
        return result['assessment'] == expected and result['text'] == render_timing(
            expected, request['topic'], request['language'], request['intent'])
    except (KeyError, ValueError, TypeError, AttributeError, OverflowError, ZeroDivisionError):
        return False
