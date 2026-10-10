"""Primary-engine topic assessment; no inference, history or external requests."""
from reading import reading_packet, verified_positions
from topic_rules import REVISION, assess_topic, render_topic, request_fingerprint


def render_verified_topic(chart, topic, *, language='english', intent='overview', as_of_utc=None):
    # Complete engine/input/nodes/nakshatra/time checks; no reused marriage verdict.
    base = reading_packet(chart, topic if topic in ('career', 'education', 'marriage') else 'marriage',
                          as_of_utc=as_of_utc)
    _, positions = verified_positions(chart)
    assessment = assess_topic(chart['lagna'], positions, topic)
    request = {key: chart['user_input'][key] for key in ('dob', 'tob', 'place')}
    request.update(topic=topic, language=language, intent=intent)
    evidence = {'schema': 'natal-topic-assessment-v1', 'rules_revision': REVISION,
                'topic': topic, 'input_fingerprint': base['input_fingerprint'],
                'as_of_utc': base['as_of_utc'], 'settings': base['settings'],
                'lagna': chart['lagna'], 'positions': positions, 'assessment': assessment,
                'source': 'reviewed_whole_sign_house_themes'}
    return {'schema': 'reviewed-topic-v1', 'text': render_topic(assessment, topic, language, intent),
            'language': language, 'intent': intent, 'evidence': evidence,
            'request_fingerprint': request_fingerprint(request), 'model_calls': 0, 'model_tokens': 0}
