import jyotishganit, json
from datetime import datetime
chart = jyotishganit.calculate_birth_chart(birth_date=datetime(2002, 2, 16, 12, 0), latitude=28.9845, longitude=77.7064, timezone_offset=5.5, name='Test')
d = chart.to_dict()
try:
    cur = d.get('dashas', {}).get('current', {})
    with open('current_dasha.json', 'w', encoding='utf-8') as f:
        json.dump(cur, f, indent=2, default=str)
except Exception as e:
    print('Err:', e)
