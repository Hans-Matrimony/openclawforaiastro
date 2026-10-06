"""Small, question-specific reading packet; no network or LLM calls.

Reviewed paraphrases of VedAstro's classical placement entries. Conditions are
checked against our own Lahiri whole-sign chart, not an upstream AI summary.
See VEDASTRO-MIT.txt. Themes are interpretations, never measured outcomes.
"""
import hashlib
import json
import math
from datetime import datetime, timezone
from vimshottari import current_period
from advanced_facts import advanced_facts

SIGNS = ('Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
         'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces')
LORDS = ('Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
         'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter')
PLANETS = {'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'}
NAKSHATRAS = ('Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
              'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
              'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula',
              'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
              'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati')
SOURCE = 'https://github.com/VedAstro/VedAstro/blob/master/Library/XMLData/HoroscopeDataList.xml'
# Only unconditional, non-fatalistic parts of these entries are admitted.
# Strength, aspects, divisional conditions and outcome claims are not evaluated.
CAREER = {
    1: 'Independent work and personal ownership: explore roles with autonomy, including self-employment.',
    2: 'Family enterprise and earning through a trade: consider these only if they fit actual experience.',
    3: 'Writing, speaking and short journeys: explore communication-related work without assuming aptitude.',
    4: 'Learning, land and property-related activity: explore education, property operations or related work.',
    5: 'Commercial brokerage or speculation: discuss the professional connection, without recommending risky investment.',
    6: 'Service institutions, including legal or healthcare organizations: explore the work environment, not medical ability.',
    7: 'Partnerships, cooperative ventures and diplomatic work: explore collaboration against actual preferences.',
    9: 'Teaching, spiritual service or a family profession: do not assume beliefs or family circumstances.',
    12: 'Work connected with distant places: explore remote or international options without predicting a move.',
}
RULES = [
    {'id': f'House10LordInHouse{h}', 'topics': ('career',), 'ruler_of': 10, 'house': h, 'theme': theme}
    for h, theme in CAREER.items()
] + [
    {'id': 'House5LordInHouse9', 'topics': ('education',), 'ruler_of': 5, 'house': 9,
     'theme': 'Learning through teaching and sharing knowledge: try explaining an idea after studying it.'},
    {'id': 'House5LordInHouse11', 'topics': ('education',), 'ruler_of': 5, 'house': 11,
     'theme': 'Learning connected with writing and groups: explore written summaries or a study group.'},
    {'id': 'House5LordInHouse12', 'topics': ('education',), 'ruler_of': 5, 'house': 12,
     'theme': 'Reflective or spiritual inquiry: explore quiet study without assuming beliefs or academic results.'},
    {'id': 'House2LordInHouse10', 'topics': ('career',), 'ruler_of': 2, 'house': 10,
     'theme': 'Earnings connected with professional activity: compare real payment arrangements and the value of work delivered.'},
    {'id': 'House7LordInHouse1', 'topics': ('marriage',), 'ruler_of': 7, 'house': 1,
     'theme': 'Familiarity and shared history in relationships: consider how two people get to know each other and build trust.'},
    {'id': 'House7LordInHouse4', 'topics': ('marriage',), 'ruler_of': 7, 'house': 4,
     'theme': 'Home and shared domestic comfort: discuss expectations about living together against real circumstances.'},
    {'id': 'MercuryInHouse11', 'topics': ('education', 'career'), 'planet': 'Mercury', 'house': 11,
     'theme': 'Scientific or technical learning and applied engineering: possible directions to explore, not an assigned course or profession.'},
    {'id': 'JupiterInHouse4', 'topics': ('education',), 'planet': 'Jupiter', 'house': 4,
     'theme': 'Reflective learning and philosophical inquiry: explore understanding ideas rather than treating this as measured ability.'},
    {'id': 'MarsInHouse1', 'topics': ('career',), 'planet': 'Mars', 'house': 1,
     'theme': 'Initiative and practical activity: explore taking responsibility for a real project, without assuming talent.'},
    {'id': 'House2LordInHouse1', 'topics': ('career',), 'ruler_of': 2, 'house': 1,
     'theme': 'Earning through personal effort and learning: compare actual work and payment arrangements.'},
]
HOUSE_SYMBOLS = {
    1: 'self-direction and personal priorities', 2: 'resources, family and speech',
    3: 'practice, communication and initiative', 4: 'home, foundations and learning',
    5: 'learning, creative expression and reflection', 6: 'daily service and practical routines',
    7: 'partnership and cooperation', 8: 'change and private reflection',
    9: 'higher study, teaching and worldview', 10: 'work and public responsibilities',
    11: 'groups, networks and goals', 12: 'solitude, reflection and distant places',
}


def verified_positions(chart):
    if not isinstance(chart, dict) or chart.get('calculation_source') != 'pyswisseph':
        raise ValueError('Reviewed readings require the primary Swiss Ephemeris chart')
    lagna = chart.get('lagna')
    positions = chart.get('planet_positions')
    if lagna not in SIGNS or not isinstance(positions, list) or len(positions) != 9:
        raise ValueError('Incomplete reading chart')
    asc = SIGNS.index(lagna)
    result = {}
    for p in positions:
        if not isinstance(p, dict):
            raise ValueError('Invalid reading position')
        name, sign, house, degree = p.get('name'), p.get('sign'), p.get('house'), p.get('sidereal_degree')
        if (not isinstance(name, str) or name not in PLANETS or name in result or sign not in SIGNS
                or type(house) is not int or type(degree) not in (int, float)
                or not math.isfinite(degree) or not 0 <= degree < 360
                or int(degree // 30) != SIGNS.index(sign)
                or house != (SIGNS.index(sign) - asc) % 12 + 1):
            raise ValueError('Conflicting reading position')
        result[name] = {'planet': name, 'sign': sign, 'house': house}
    if chart.get('moon_sign') != result['Moon']['sign']:
        raise ValueError('Conflicting Moon summary')
    return asc, result


def reading_packet(chart, topic, *, as_of_utc=None):
    if topic not in ('career', 'education', 'marriage'):
        raise ValueError('Unsupported reading topic')
    asc, positions = verified_positions(chart)
    degrees = {p['name']: p['sidereal_degree'] for p in chart['planet_positions']}
    star = NAKSHATRAS[int(degrees['Moon'] / (360 / 27))]
    if chart.get('nakshatra') != star:
        raise ValueError('Conflicting Moon nakshatra')
    if not math.isclose((degrees['Ketu'] - degrees['Rahu']) % 360, 180, abs_tol=1e-8):
        raise ValueError('Conflicting lunar nodes')
    factors = []
    for rule in RULES:
        if topic not in rule['topics']:
            continue
        ruler_of = rule.get('ruler_of')
        planet = LORDS[(asc + ruler_of - 1) % 12] if ruler_of else rule['planet']
        fact = positions[planet]
        if fact['house'] != rule['house']:
            continue
        factors.append({'id': rule['id'], 'fact': dict(fact, **({'rules_house': ruler_of} if ruler_of else {})),
                        'traditional_theme': rule['theme'], 'source': 'vedastro_classical'})
    target = {'career': 10, 'education': 5, 'marriage': 7}[topic]
    owner = LORDS[(asc + target - 1) % 12]
    if not any(f['fact'].get('rules_house') == target for f in factors):
        fact = positions[owner]
        factors.insert(0, {'id': f'house-context:{target}:{fact["house"]}',
                          'fact': dict(fact, rules_house=target),
                          'traditional_theme': f'The topic ruler connects to general house symbolism: {HOUSE_SYMBOLS[fact["house"]]}.',
                          'source': 'local_house_symbolism'})
    # Include at most three relevant factors, rather than the entire corpus.
    settings = {'ayanamsa': 'LAHIRI', 'house_system': 'whole_sign', 'node': 'true',
                'dasha_year_days': 365.25, 'engine': 'pyswisseph'}
    supplied_settings = chart.get('calculation_settings', {})
    if not isinstance(supplied_settings, dict):
        raise ValueError('Invalid reading settings')
    settings.update(supplied_settings)
    if (settings['ayanamsa'] != 'LAHIRI' or settings['house_system'] != 'whole_sign'
            or settings['node'] not in ('true', 'mean') or settings['engine'] != 'pyswisseph'
            or type(settings['dasha_year_days']) not in (int, float) or settings['dasha_year_days'] != 365.25):
        raise ValueError('Unsupported reading settings')
    birth = chart.get('user_input')
    if not isinstance(birth, dict) or not isinstance(birth.get('coordinates'), dict):
        raise ValueError('Missing reading birth inputs')
    for field, low, high in (('lat', -90, 90), ('lon', -180, 180)):
        value = birth['coordinates'].get(field)
        if type(value) not in (int, float) or not math.isfinite(value) or not low <= value <= high:
            raise ValueError('Invalid birth coordinates')
    offset = birth.get('timezone_offset')
    if type(offset) not in (int, float) or not math.isfinite(offset) or not -14 <= offset <= 14:
        raise ValueError('Invalid birth timezone offset')
    try:
        birth_utc = datetime.fromisoformat(birth['birth_utc'].replace('Z', '+00:00'))
        if birth_utc.tzinfo is None:
            raise ValueError('UTC birth instant requires timezone')
        birth_utc = birth_utc.astimezone(timezone.utc).replace(tzinfo=None)
    except (KeyError, AttributeError, TypeError, ValueError) as exc:
        raise ValueError('Invalid UTC birth instant') from exc
    as_of = as_of_utc or datetime.now(timezone.utc)
    if not isinstance(as_of, datetime) or as_of.tzinfo is None:
        raise ValueError('Reading timestamp must be timezone-aware')
    as_of = as_of.astimezone(timezone.utc)
    # Refresh time-dependent periods even if the caller supplies an older chart.
    period = current_period(birth_utc, degrees['Moon'], as_of.replace(tzinfo=None))
    active = {'mahadashas': {period['mahadasha']: {
        'start': period['start'], 'end': period['end'],
        'antardashas': {period['antardasha']: {
            'start': period['antardasha_start'], 'end': period['antardasha_end']}}}}}
    canonical = {'dob': birth['dob'], 'tob': birth['tob'], 'coordinates': birth['coordinates'],
                 'timezone_offset': birth['timezone_offset'], 'birth_utc': birth['birth_utc'], 'settings': settings}
    fingerprint = hashlib.sha256(json.dumps(canonical, sort_keys=True).encode()).hexdigest()
    return {
        'schema': 'topic-reading-v1', 'rules_revision': 'reviewed-placements-v1',
        'topic': topic, 'input_fingerprint': fingerprint,
        'as_of_utc': as_of.isoformat(), 'settings': settings,
        'chart_facts': {'lagna': chart['lagna'], 'moon_sign': chart['moon_sign'],
                        'nakshatra': chart['nakshatra']},
        'current_period': active, 'factors': factors[:3],
        'advanced': advanced_facts(chart, asc, positions, topic),
        'period_interpretation_available': False,
        'calculation_warnings': chart.get('summary', {}).get('warnings', []),
        'sources': {'vedastro_classical': SOURCE, 'local_house_symbolism': 'Reviewed general whole-sign house symbolism'},
        'limits': ['Traditional interpretive themes, not measured ability, traits or promised outcomes.',
                   'Personal interpretations are limited to the factors; practical examples are hypothetical options.',
                   'No dasha meaning is supplied; do not infer focus, emotions or aptitude from a period name.',
                   'Period dates are calculated dasha boundaries, not marriage, job or admission forecasts.',
                   'Full sign aspects and D9/D10 topic-ruler placements are calculated; no personality or event forecast follows from them.',
                   'Only sign dignity, repeated-sign placement and uccha bala are evaluated; full Shadbala, transits and event timing are not evaluated.'],
    }
