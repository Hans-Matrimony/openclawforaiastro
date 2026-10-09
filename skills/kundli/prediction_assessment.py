"""Selected traditional indications, not measured probabilities or promised events.

Paraphrases of VedAstro HoroscopeDataList and EventDataList. Natal placement
conditions and PD1/PD2 conditions are checked independently. No source-wide
Good/Bad label is treated as a probability that an individual event will happen.
"""
from datetime import datetime, timedelta
from vimshottari import current_period
from period_rules import period_status, marriage_rule

HOROSCOPE_SOURCE = 'https://github.com/VedAstro/VedAstro/blob/master/Library/XMLData/HoroscopeDataList.xml'
PERIOD_SOURCE = 'https://github.com/VedAstro/VedAstro/blob/master/Library/XMLData/EventDataList.xml'
REVISION = 'reviewed-outcomes-v2'

# Each value is a topic-specific review, not the event's general Nature rating.
# Health, death, sexual claims, accusations and fixed spouse traits are excluded.
VENUS_PERIODS = {
    'Sun': {'marriage': 'adverse', 'career': 'adverse', 'finance': 'adverse'},
    'Moon': {'marriage': 'mixed', 'career': 'limited', 'education': 'supportive', 'finance': 'supportive'},
    'Mars': {'marriage': 'conditional', 'career': 'mixed', 'finance': 'supportive'},
    'Rahu': {'marriage': 'adverse', 'career': 'limited', 'finance': 'limited'},
    'Jupiter': {'marriage': 'conditional', 'career': 'supportive', 'education': 'supportive', 'finance': 'supportive'},
    'Saturn': {'career': 'adverse', 'finance': 'mixed'},
    'Mercury': {'marriage': 'supportive', 'career': 'supportive', 'education': 'supportive', 'finance': 'supportive'},
    'Ketu': {'marriage': 'adverse', 'career': 'adverse', 'finance': 'adverse'},
    'Venus': {'career': 'supportive', 'finance': 'supportive'},
}


def _reason(rule_id, status, planet, positions, rules_house=None):
    fact = dict(positions[planet])
    if rules_house is not None:
        fact['rules_house'] = rules_house
    return {'id': rule_id, 'status': status, 'fact': fact, 'source': HOROSCOPE_SOURCE}


def assess(positions, lords, topic, birth_utc, moon_degree, as_of, *, uncertain_birth=False, extended=False):
    """Called only after reading_packet has verified the complete chart and inputs."""
    reasons = []
    if topic == 'marriage':
        # Upstream exception: Saturn as ascendant or seventh lord is excluded.
        if positions['Saturn']['house'] == 7 and 'Saturn' not in (lords[1], lords[7]):
            reasons.append(_reason('SaturnIn7thNotLagnaLord', 'adverse', 'Saturn', positions))
        if positions['Jupiter']['house'] == 7:
            reasons.append(_reason('JupiterInHouse7', 'supportive', 'Jupiter', positions))
        if positions[lords[7]]['house'] == 4:
            reasons.append(_reason('House7LordInHouse4', 'supportive', lords[7], positions, 7))
    elif topic == 'career':
        owner = lords[10]
        house = positions[owner]['house']
        if house in (8, 12):
            reasons.append(_reason(f'House10LordInHouse{house}', 'adverse', owner, positions, 10))
        elif house == 11:
            reasons.append(_reason('House10LordInHouse11', 'supportive', owner, positions, 10))
    statuses = {r['status'] for r in reasons}
    natal_status = ('mixed' if statuses == {'supportive', 'adverse'} else
                    next(iter(statuses)) if statuses else 'limited')
    current = current_period(birth_utc, moon_degree, as_of.replace(tzinfo=None))
    reviewed = period_status(current['mahadasha'], current['antardasha'], topic, extended=extended)
    if uncertain_birth:
        reviewed = None
    period = {'status': reviewed or 'unsupported', 'rule_id':
              f"{current['mahadasha']}{current['antardasha']}PD2" if reviewed else None,
              'mahadasha': current['mahadasha'], 'antardasha': current['antardasha'],
              'start': current['antardasha_start'], 'end': current['antardasha_end'],
              'source': PERIOD_SOURCE if reviewed else None}
    windows = []
    try:
        adult_from = birth_utc.replace(year=birth_utc.year + 18)
    except ValueError:
        adult_from = birth_utc.replace(year=birth_utc.year + 18, day=28)
    # Only these reviewed descriptions explicitly include marriage. A pleasant
    # period, earnings theme or marriage-harmony theme does not imply a wedding.
    # Legacy rules require major-lord natal relevance. Extended rules expose only
    # explicit source-table candidates, without claiming complete chart confirmation.
    relevant_major = lords[7] == 'Venus' or positions['Venus']['house'] == 7
    horizon = as_of.replace(tzinfo=None) + timedelta(days=8 * 365.25)
    cursor = as_of.replace(tzinfo=None)
    if (topic == 'marriage' and (extended or relevant_major) and not uncertain_birth
            and as_of.replace(tzinfo=None) >= adult_from):
        for _ in range(81):
            candidate = current_period(birth_utc, moon_degree, cursor)
            start = datetime.fromisoformat(candidate['antardasha_start'].replace('Z', '+00:00')).replace(tzinfo=None)
            end = datetime.fromisoformat(candidate['antardasha_end'].replace('Z', '+00:00')).replace(tzinfo=None)
            if start >= horizon:
                break
            if marriage_rule(candidate['mahadasha'], candidate['antardasha'], extended=extended):
                minor = candidate['antardasha']
                # Explicit declared priority, not a calibrated strength score:
                # Jupiter period has a favorable source reading and, when in
                # the seventh, an additional natal connection to partnership.
                priority = 2 if minor == 'Jupiter' and positions['Jupiter']['house'] == 7 else 1
                eligible_start = max(start, cursor, adult_from)
                if eligible_start >= end or eligible_start >= horizon:
                    cursor = end
                    continue
                windows.append({'rule_id': f"{candidate['mahadasha']}{minor}PD2", 'start': eligible_start.isoformat() + 'Z',
                                'period_start': candidate['antardasha_start'],
                                'end': candidate['antardasha_end'], 'source': PERIOD_SOURCE,
                                'kind': 'traditional_candidate', 'priority': priority,
                                'mahadasha': candidate['mahadasha'], 'antardasha': minor})
            if end <= cursor:
                raise ValueError('Non-advancing period scan')
            cursor = end
            if cursor >= horizon:
                break
    windows.sort(key=lambda window: (-window['priority'], window['start']))
    event_status = 'uncertain_birth' if uncertain_birth else 'conditional' if windows else 'unsupported'
    directional = {natal_status, period['status']}
    conclusion = ('mixed' if 'mixed' in directional or {'supportive', 'adverse'} <= directional else
                  'supportive' if 'supportive' in directional else 'adverse' if 'adverse' in directional else
                  'conditional' if 'conditional' in directional else 'limited')
    return {'schema': 'prediction-assessment-v1', 'topic': topic,
            'conclusion': {'status': conclusion, 'scope': {
                'marriage': 'relationship_quality', 'career': 'career_indications',
                'education': 'learning_conditions', 'finance': 'financial_indications'}[topic]},
            'natal': {'status': natal_status, 'scope': 'relationship_quality' if topic == 'marriage' else 'topic_indications',
                      'reasons': reasons},
            'current_period': period, 'event': {'status': event_status, 'windows': windows[:2],
                'scope': 'selected_marriage_period_rules' if topic == 'marriage' else 'event_timing_not_reviewed',
                'search_end': horizon.isoformat() + 'Z',
                'ranking_basis': 'Jupiter period with natal Jupiter in seventh precedes other reviewed candidates'
                                 if topic == 'marriage' else None},
            'limits': ['Traditional indications are not calibrated probabilities.',
                       'An adverse harmony indication does not mean marriage is denied or divorce is certain.',
                       'Candidate periods are not fixed wedding dates or a comparison of all timing methods.',
                       'Transits, strength and divisional confirmation were not evaluated.']}
