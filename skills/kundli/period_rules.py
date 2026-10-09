"""Small reviewed period contract shared by calculator and reply validators.

Source categories describe a traditional period theme, never an event probability.
Explicit wedding indications are separately reviewed; household weddings and
betrothal-only entries do not qualify as personal marriage candidates.
"""
import json
from pathlib import Path

RULES = json.loads(Path(__file__).with_name('period_rules.json').read_text())['rules']
REVISIONS = ('reviewed-outcomes-v2', 'reviewed-outcomes-v3')
LEGACY_VENUS = {
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


def period_status(major, minor, topic, *, extended=False):
    if topic not in ('marriage', 'career', 'education', 'finance'):
        return None
    if major == 'Venus' and (not extended or topic in LEGACY_VENUS.get(minor, {})):
        return LEGACY_VENUS.get(minor, {}).get(topic)
    if not extended:
        return None
    row = RULES.get(major + minor + 'PD2')
    if not row:
        return None
    ratings = row['ratings']
    if topic == 'career':
        # Money ratings alone cannot establish a job or professional outcome.
        return 'limited'
    values = ({ratings['Family'], ratings['Love']} if topic == 'marriage' else
              {ratings['Studies']} if topic == 'education' else {ratings['Money']})
    return ('mixed' if {'Good', 'Bad'} <= values else 'supportive' if 'Good' in values else
            'adverse' if 'Bad' in values else 'limited')


def marriage_rule(major, minor, *, extended=False):
    if not extended:
        return major == 'Venus' and minor in ('Mars', 'Jupiter')
    return RULES.get(major + minor + 'PD2', {}).get('marriage_event') is True


def period_wording(topic, status, hinglish=False):
    """Explain a traditional category without promising an event."""
    if topic == 'career':
        return ('Is period table se job ya promotion ka saaf nateeja nahi nikalta; career ki reading mein ghar ke sanket bhi dekhein.' if hinglish else
                'The reviewed period categories do not establish a job or promotion outcome; consider the career-house indications as well.')
    targets = {'marriage': ('family aur relationship', 'family and relationship'),
               'education': ('padhai', 'study'), 'finance': ('paise aur savings', 'money and savings')}
    hi, en = targets[topic]
    if status == 'mixed':
        return (f'Traditional period table mein {hi} ke support aur rukawat, dono ke sanket hain; decisions mein dono ko dhyan mein rakhein.' if hinglish else
                f'The traditional period table has both supportive and challenging indications for {en}; take both into account when planning.')
    if status == 'supportive':
        return (f'Traditional period table mein {hi} ke anukool sanket hain. Is support ko practical planning aur apni koshish ke saath dekhein.' if hinglish else
                f'The traditional period table is supportive of {en}. Treat that as context for practical planning and effort.')
    if status == 'adverse':
        return (f'Traditional period table mein {hi} ke liye rukawat ke sanket hain. Jaldbazi se bachkar planning aur expectations par dhyan dein.' if hinglish else
                f'The traditional period table indicates challenges around {en}. Avoid rushing and pay attention to planning and expectations.')
    return (f'Traditional period table mein {hi} ke liye koi saaf anukool ya pratikool sanket nahi hai.' if hinglish else
            f'The traditional period table has no clear supportive or adverse indication for {en}.')


def valid_window_rule(window, *, extended=False):
    major, minor = window.get('mahadasha'), window.get('antardasha')
    return (isinstance(major, str) and isinstance(minor, str)
            and window.get('rule_id') == major + minor + 'PD2'
            and marriage_rule(major, minor, extended=extended))
