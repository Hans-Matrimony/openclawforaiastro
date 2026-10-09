"""Topic-specific applications of the existing general house symbolism.

These phrases explain the same reviewed themes; they do not add event forecasts,
abilities, financial returns or claims about another person's character.
"""

# Indexes are house number minus one. English and Hinglish use the same meaning.
TOPIC_WORDING = {
    'marriage': (
        ('Personal priorities are a central part of this relationship reading.', 'Shaadi ki reading mein apni priorities ka pehlu saamne aata hai.'),
        ('Family expectations, shared resources and communication are connected here.', 'Shaadi ki reading mein family, saanjhe resources aur baat-cheet ka sambandh aata hai.'),
        ('Everyday communication and shared effort are relevant to partnership here.', 'Rishte mein roz ki baat-cheet aur dono ki koshish ka pehlu saamne aata hai.'),
        ('Home and expectations about living together are central here.', 'Shaadi ki reading mein ghar aur saath rehne ki expectations khaas hain.'),
        ('Creativity and reflection are relevant to the relationship theme here.', 'Rishte ki reading mein creativity aur soch-vichaar ka sambandh aata hai.'),
        ('Partnership connects with daily responsibilities and practical routines here.', 'Shaadi ki reading mein roz ki zimmedariyon aur routine ka sambandh aata hai.'),
        ('Cooperation and the partnership itself are central to this reading.', 'Shaadi ki reading mein saath milkar chalna aur partnership khaas hain.'),
        ('Change and reflection are part of the relationship theme here.', 'Rishte ki reading mein badlav aur soch-vichaar ka pehlu saamne aata hai.'),
        ('Learning and outlook are relevant to the partnership theme here.', 'Rishte ki reading mein seekhne aur nazariye ka sambandh aata hai.'),
        ('Partnership connects with work and shared responsibilities here.', 'Shaadi ki reading mein kaam aur saanjhi zimmedariyon ka sambandh aata hai.'),
        ('Shared goals and social networks are relevant to partnership here.', 'Shaadi ki reading mein saanjhe goals aur social circle ka pehlu saamne aata hai.'),
        ('Personal space, reflection and distant places are relevant themes here.', 'Rishte ki reading mein personal space, soch-vichaar aur door ki jagahon ka sambandh aata hai.'),
    ),
    'education': (
        ('Study connects with personal direction and priorities here.', 'Padhai ki reading mein apni direction aur priorities ka sambandh aata hai.'),
        ('Learning connects with resources, family and spoken expression here.', 'Padhai ki reading mein resources, family aur bolkar samjhane ka sambandh aata hai.'),
        ('Practice, explaining ideas and taking initiative are relevant study themes.', 'Padhai ki reading mein practice, ideas samjhana aur apni koshish khaas hain.'),
        ('Foundational learning and the study environment are relevant here.', 'Padhai ki reading mein basics samajhna aur padhne ka mahaul khaas hain.'),
        ('Learning, creativity and reflecting on ideas are central here.', 'Padhai ki reading mein seekhna, creativity aur ideas par sochna khaas hain.'),
        ('Learning connects with regular practice and practical routines here.', 'Padhai ki reading mein regular practice aur roz ke routine ka sambandh aata hai.'),
        ('Discussion and learning with others are relevant study themes here.', 'Padhai ki reading mein discussion aur milkar seekhne ka sambandh aata hai.'),
        ('Revisiting ideas and reflecting on changes are relevant study themes.', 'Padhai ki reading mein ideas ko dobara samajhne aur badlav par sochne ka sambandh aata hai.'),
        ('Higher study, teaching and a broader outlook are connected here.', 'Padhai ki reading mein higher study, teaching aur nazariye ka sambandh aata hai.'),
        ('Learning connects with work and public responsibilities here.', 'Padhai ki reading mein kaam aur public responsibilities se learning ka sambandh aata hai.'),
        ('Groups, learning networks and study goals are relevant here.', 'Padhai ki reading mein groups, learning networks aur goals ka sambandh aata hai.'),
        ('Quiet reflection and learning connected with distant places are relevant here.', 'Padhai ki reading mein shaant soch-vichaar aur door ki jagahon se learning ka sambandh aata hai.'),
    ),
    'finance': (
        ('Money matters connect with personal priorities here.', 'Paise ki reading mein apni priorities ka sambandh aata hai.'),
        ('Resources, family finances and communication are relevant here.', 'Paise ki reading mein resources, family finances aur baat-cheet ka sambandh aata hai.'),
        ('Money matters connect with initiative and communication here.', 'Paise ki reading mein apni koshish aur communication ka sambandh aata hai.'),
        ('Home and financial foundations are relevant themes here.', 'Paise ki reading mein ghar aur financial foundations ka sambandh aata hai.'),
        ('Creativity and reflection are connected with money matters here.', 'Paise ki reading mein creativity aur soch-vichaar ka sambandh aata hai.'),
        ('Money matters connect with daily service and practical routines here.', 'Paise ki reading mein roz ke service-related kaam aur routine ka sambandh aata hai.'),
        ('Cooperation and shared financial arrangements are relevant here.', 'Paise ki reading mein cooperation aur saanjhe financial arrangements ka sambandh aata hai.'),
        ('Change and reflection are relevant to money matters here.', 'Paise ki reading mein badlav aur soch-vichaar ka pehlu saamne aata hai.'),
        ('Learning and a broader outlook connect with money matters here.', 'Paise ki reading mein learning aur nazariye ka sambandh aata hai.'),
        ('Money matters connect with work and public responsibilities here.', 'Paise ki reading mein kaam aur public responsibilities ka sambandh aata hai.'),
        ('Networks and shared goals are relevant to money matters here.', 'Paise ki reading mein networks aur saanjhe goals ka sambandh aata hai.'),
        ('Reflection and distant places connect with money matters here.', 'Paise ki reading mein soch-vichaar aur door ki jagahon ka sambandh aata hai.'),
    ),
    'career': (
        ('Personal direction and priorities are relevant to your work reading.', 'Career ki reading mein apni direction aur priorities khaas hain.'),
        ('Resources, family and communication connect with work here.', 'Career ki reading mein resources, family aur baat-cheet ka sambandh aata hai.'),
        ('Practice, communication and initiative are relevant work themes.', 'Career ki reading mein practice, communication aur initiative khaas hain.'),
        ('Home, foundations and learning are connected with work here.', 'Career ki reading mein ghar, foundations aur learning ka sambandh aata hai.'),
        ('Creativity, learning and reflection connect with work here.', 'Career ki reading mein creativity, learning aur soch-vichaar ka sambandh aata hai.'),
        ('Service and practical routines are relevant work themes here.', 'Career ki reading mein service aur roz ke practical kaam khaas hain.'),
        ('Partnership and cooperation are connected with work here.', 'Career ki reading mein partnership aur saath milkar kaam karna khaas hain.'),
        ('Change and reflection are relevant to your work reading here.', 'Career ki reading mein badlav aur soch-vichaar ka pehlu saamne aata hai.'),
        ('Higher learning, teaching and outlook connect with work here.', 'Career ki reading mein higher learning, teaching aur nazariye ka sambandh aata hai.'),
        ('Work and public responsibilities are central to this reading.', 'Career ki reading mein kaam aur public responsibilities khaas hain.'),
        ('Groups, professional networks and goals are relevant here.', 'Career ki reading mein groups, professional networks aur goals khaas hain.'),
        ('Reflection and distant places connect with work here.', 'Career ki reading mein soch-vichaar aur door ki jagahon ka sambandh aata hai.'),
    ),
}


def topic_house_wording(topic, house, hinglish=False):
    if topic not in TOPIC_WORDING or type(house) is not int or not 1 <= house <= 12:
        raise ValueError('Unsupported topic or house')
    return TOPIC_WORDING[topic][house - 1][1 if hinglish else 0]
