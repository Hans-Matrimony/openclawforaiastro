"""Check the pinned native Vedhanka convention against independent house geometry."""
from natal_client import REVISION
from vedastro_client import MatchError

# Selected first matches in the hash-locked Calculate.Vedhanka source. Venus
# has overlapping branches; do not silently substitute another school's table.
POINTS = {
    'Sun': {11:5,3:9,10:4,6:12,5:11,9:3,4:10,12:6},
    'Moon': {7:2,1:5,6:12,11:8,10:4,3:9,2:7,5:1,12:6,8:11,4:10,9:3},
    'Mars': {3:12,11:5,6:9,12:3,5:11,9:6},
    'Mercury': {2:5,4:3,6:9,8:1,10:7,11:12,5:2,3:4,9:6,1:8,7:10,12:11},
    'Jupiter': {2:12,11:8,9:10,5:4,7:3,12:2,8:11,10:9,4:5,3:7},
    'Venus': {1:8,2:7,3:1,4:10,5:9,8:5,9:11,11:6,12:3,7:2,10:4,6:11},
    'Saturn': {3:12,11:5,6:9,12:3,5:11,9:6},
}
EXEMPT = {'Sun':{'Saturn'}, 'Saturn':{'Sun'}, 'Moon':{'Mercury'}, 'Mercury':{'Moon'}}
METADATA = {
    'schema':'reviewed-vedha-geometry-v1', 'source_revision':REVISION,
    'table_method':'Calculate.Vedhanka', 'table_selection':'pinned_upstream_first_match',
    'occupancy_method':'Calculate.PlanetsInGocharaHouse', 'occupancy_correction':'query_obstruction_house',
    'planet_scope':'seven_classical_planets', 'house_reference':'natal_moon_whole_sign',
    'event_prediction_available':False,
}
RAW_KEYS = {'schema':'schema','source_revision':'sourceRevision','table_method':'tableMethod',
            'table_selection':'tableSelection','occupancy_method':'occupancyMethod',
            'occupancy_correction':'occupancyCorrection','planet_scope':'planetScope',
            'house_reference':'houseReference','event_prediction_available':'eventPredictionAvailable'}


def expected_rows(transits):
    rows = {}
    for name, table in POINTS.items():
        house = transits[name]['house_from_natal_moon']
        if type(house) is not int or not 1 <= house <= 12:
            raise MatchError('calculation_conflict')
        point = table.get(house,0)
        occupants = [other for other in POINTS if point and transits[other]['house_from_natal_moon']==point]
        exempt = EXEMPT.get(name,set())
        blockers = sorted(other for other in occupants if other!=name and other not in exempt)
        rows[name] = {'house_from_natal_moon':house,'obstruction_house_from_natal_moon':point,
                      'obstructing_planets':blockers,'exempt_planets_at_point':sorted(set(occupants)&exempt),
                      'obstructed':bool(blockers)}
    return rows


def validate_vedha(bundle, transits):
    try:
        if (not isinstance(bundle,dict) or set(bundle)!=set(METADATA)|{'planets'}
                or any(type(bundle[key]) is not type(value) or bundle[key]!=value for key,value in METADATA.items())
                or not isinstance(bundle['planets'],dict) or set(bundle['planets'])!=set(POINTS)):
            return False
        expected = expected_rows(transits)
        for name,row in bundle['planets'].items():
            if (not isinstance(row,dict) or set(row)!=set(expected[name])
                    or type(row['house_from_natal_moon']) is not int
                    or type(row['obstruction_house_from_natal_moon']) is not int
                    or type(row['obstructed']) is not bool or row!=expected[name]):
                return False
        return True
    except (KeyError,TypeError,ValueError,MatchError):
        return False


def normalize_vedha(raw, transits):
    try:
        if not isinstance(raw,dict) or set(raw)!=set(RAW_KEYS.values())|{'planets'}:
            raise MatchError('provider_invalid_response')
        result = {key:raw[source] for key,source in RAW_KEYS.items()}
        row_keys = {'house_from_natal_moon':'houseFromNatalMoon',
                    'obstruction_house_from_natal_moon':'obstructionHouseFromNatalMoon',
                    'obstructing_planets':'obstructingPlanets','exempt_planets_at_point':'exemptPlanetsAtPoint',
                    'obstructed':'obstructed'}
        result['planets'] = {}
        for name,row in raw['planets'].items():
            if set(row)!=set(row_keys.values()):
                raise MatchError('provider_invalid_response')
            result['planets'][name] = {key:row[source] for key,source in row_keys.items()}
        if not validate_vedha(result,transits):
            raise MatchError('calculation_conflict')
        return result
    except (KeyError,TypeError,ValueError,AttributeError):
        raise MatchError('provider_invalid_response') from None
