"""Separation assessment from the primary verified chart, with fixed wording."""
from reading import reading_packet, verified_positions
from separation_rules import REVISION, SOURCE, assess_positions, render_assessment, request_fingerprint


def render_separation(chart, *, as_of_utc=None, language='english', intent='overview'):
    # Reuse the complete chart, input, engine, nodes and timestamp checks. Do not
    # reuse the marriage themes as separation evidence or its periods as dates.
    base = reading_packet(chart, 'marriage', as_of_utc=as_of_utc)
    _, positions = verified_positions(chart)
    assessment = assess_positions(chart['lagna'], positions)
    request = {key: chart['user_input'][key] for key in ('dob', 'tob', 'place')}
    request.update(topic='separation', language=language, intent=intent)
    evidence = {'schema': 'separation-assessment-v1', 'rules_revision': REVISION,
                'topic': 'separation', 'input_fingerprint': base['input_fingerprint'],
                'as_of_utc': base['as_of_utc'], 'settings': base['settings'],
                'lagna': chart['lagna'], 'positions': positions, 'assessment': assessment, 'source': SOURCE}
    return {'schema': 'reviewed-separation-v1', 'text': render_assessment(assessment, language, intent),
            'language': language, 'intent': intent, 'evidence': evidence,
            'request_fingerprint': request_fingerprint(request), 'model_calls': 0, 'model_tokens': 0}
