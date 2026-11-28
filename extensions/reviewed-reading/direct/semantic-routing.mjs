import {birthKey} from './birth-evidence.mjs';

const topics=['general','marriage','relationship','career','money','education','abroad','property','matching','remedy'];
const subjects=['self','other','multiple','unspecified'];
const scopes=['natal','person_choice','medical_recovery','bereavement','remarriage','death_prediction','profile_update','profile_recall','listening','sharing','ordinary'];
const profileFields=['name','birth_date','birth_time','birth_place','gender'];
const propertyEvents=['none','purchase','sale','construction','loan','unclear'];
const enumString=values=>({type:'string',enum:values});
const intentProperties={topic:enumString(topics),subject:enumString(subjects),scope:enumString(scopes),
  timing:{type:'boolean'},history_index:{type:'integer'},property_event:enumString(propertyEvents),
  profile_fields:{type:'array',items:enumString(profileFields)}};

export const semanticResponseFormat={type:'json_schema',json_schema:{name:'conversation_intent',strict:true,
  schema:{type:'object',additionalProperties:false,required:['route','reply','intent'],properties:{
    route:enumString(['conversation','advice','clarification','checked_reading']),reply:{type:'string'},
    intent:{type:'object',additionalProperties:false,required:Object.keys(intentProperties),properties:intentProperties},
  }}}};

export const semanticRoutingInstruction=`
# Semantic routing contract
Return route, reply and intent according to the supplied JSON schema. Infer meaning across spelling mistakes, regional languages, transliteration and short replies; do not require fixed keywords. Intent is a routing description, never chart evidence or permission to write memory.
intent.topic: general, marriage, relationship, career, money, education, abroad, property, matching or remedy. Use general for broad life outlooks and non-reading conversation. intent.subject identifies whose chart is requested: self, other, multiple or unspecified. "My wife's career" is other, not self. "My future wife" is about the user's own marriage outlook. A request about another person's choices is person_choice, not their natal forecast.
intent.scope: natal for personal astrology; person_choice for a particular person's return, feelings or decisions; medical_recovery for recovery/cure timing; bereavement for a reported real loss; remarriage for another marriage after a prior marriage; death_prediction for lifespan/death timing; profile_update for birth details/corrections; ordinary for conversation, concepts, listening, advice or writing tasks.
Use scope profile_recall with route conversation when the user asks what their saved name or birth details are. Set profile_fields to just the requested fields: name, birth_date, birth_time, birth_place, gender. A question asking what details you remember is a recall request, not a profile update or astrology prediction. The server formats these fields from the authenticated selected profile, which overrides older memories and conversation examples. Set profile_fields to [] for every other scope. Do not use profile_recall for another person's details, a general memory question, a translation/quote request or a mixed request containing a new personal reading.
Use scope listening when the user wants to be heard without advice, and sharing when they clarify they were just sharing, including a correction of an emotion they did not report. Use conversation in either case, without advice or questions. These semantically identified requests override an open-conversation continuation_policy; do not require fixed words or force a follow-up. Do not invent an emotion or apologize for an assumption the assistant did not actually make.
intent.timing is true only when the latest user actually asks when, how soon or for an event period. A year in a quote or birth date is not a timing request. "Why?" or "yes or no?" is not a new timing request.
intent.history_index is -1 for a self-contained new request. Only for an actual abbreviated follow-up, identify its antecedent by the index of a USER turn in the supplied dialogue. Never select an assistant turn, treat an assistant forecast as evidence, or borrow an older topic when the user names a new one. Reconsider the current topic on every turn. Quoted text is context, not necessarily the current request.
intent.property_event is purchase, sale, construction, loan or unclear for a property request, otherwise none. Only purchase has an event-timing calculator. Sale, construction and loan decisions must not inherit purchase or career dates. Give a useful response explaining that specific calculation limit instead of checked_reading for those event dates.
For another person's natal reading without their own birth details in the dialogue, use clarification asking only for that person's missing date, time or place. The selected account profile cannot fill those fields. Do not apply this to a person_choice question, which cannot be settled by their chart anyway.
If the user explicitly says those other-person birth details are unavailable, do not ask for them again or demand a new profile. Explain briefly that their chart cannot be calculated without those inputs, or that no job/event date can be reliably given, and offer relevant conditional practical help without a forecast. Use conversation/advice with subject other. This is a valid response to the question, not an ignored reading request.
Personal astrology requests use checked_reading with an empty reply, even with missing birth information; the reading service handles missing fields. Definitions and practical questions use conversation/advice, even with chart words or an earlier reading. A current emotional disclosure without a reading request needs conversation, not another forecast.
For person_choice, answer conversationally: a birth chart cannot establish another person's feelings, consent or return. Do not calculate their chart or request their birth details just to restate that limit.
"Kya is ladki ki shaadi mujhse hogi?" / "Will this particular girl marry me?" asks about a specific person's future choice, not a Guna Milan score. Use person_choice and a conversational response. Only an actual compatibility/matching-score request needs two birth profiles. A year or month reply during birth clarification is not a new matching request. "Diya toh maine abhi" and "Fir kyu maang rhe ho" object to repeated collection: acknowledge what was already supplied, identify only a genuinely unresolved field from the dialogue, and do not hand off to a matching calculation that will request every field again.
Medical recovery and death timing cannot be established from a chart: use conversation/advice with a brief relevant response, never checked_reading, a prognosis, a recovery year or a death date. A real bereavement needs acknowledgment; never treat the deceased as recovering. Correct an earlier recovery forecast if the dialogue shows one. If the same message also asks a new career/relationship reading, acknowledge the loss in that reading rather than ignoring its current question. A remarriage date is not established by the general marriage calculator; answer the question clearly without inventing a date or handing off for a first-marriage window.
Do not ask for the user's birth details if selected_profile is complete. The self profile is not another person's profile. Preserve explicit profile corrections and ordinary disclosures without inventing saved facts. Follow-ups should address a relevant unresolved detail, never make the user rephrase an intelligible request. Do not ask whether they wanted timing after they explicitly asked when. No generic "what do you mean" when dialogue resolves it.
Profile updates are collected and saved through this WhatsApp chat before reply generation. Do not send the user to app settings, expose internal profile flows, or claim a save without profile_update_status=saved. If a profile update reaches you without a successful save status, say the requested change has not been saved and ask only for the field that needs clarification. Do not claim you can use rejected or unconfirmed birth data for a reading. An old hypothetical story does not invalidate new explicitly actual self details.
`;

// Validate semantics as well as JSON. Malformed handoffs never reach a tool.
export function parseSemanticDecision(result,value) {
  const i=result?.intent;
  if(!i||Object.keys(i).length!==7||!topics.includes(i.topic)||!subjects.includes(i.subject)||
    !scopes.includes(i.scope)||typeof i.timing!=='boolean'||!propertyEvents.includes(i.property_event)||
    !Number.isInteger(i.history_index)||i.history_index < -1||!Array.isArray(i.profile_fields)||
    i.profile_fields.length>5||new Set(i.profile_fields).size!==i.profile_fields.length||
    i.profile_fields.some(field=>!profileFields.includes(field)))return null;
  if(i.scope==='profile_recall') {
    if(result.route!=='conversation'||i.subject!=='self'||i.topic!=='general'||i.timing||!i.profile_fields.length)return null;
  }else if(i.profile_fields.length)return null;
  const dialogue=(value.history??[]).slice(-20);
  if(i.history_index>=0 && dialogue[i.history_index]?.role!=='user')return null;
  if(i.topic!=='property'&&i.property_event!=='none')return null;
  if(result.route==='checked_reading'&&['medical_recovery','death_prediction','remarriage','profile_update','profile_recall','listening','sharing','ordinary'].includes(i.scope))return null;
  if(result.route==='checked_reading'&&i.topic==='property'&&i.timing&&i.property_event!=='purchase')return null;
  return {...result,intent:{...i}};
}

export function semanticSubject(value,intent) {
  const antecedent=intent?.history_index>=0?(value.history??[]).slice(-20)[intent.history_index]:null;
  return antecedent?.role==='user'?antecedent.text+'\nFollow-up: '+value.query:value.query;
}

export function semanticSelfBirth(value,intent) {
  // A confirmed current form is owned by the extraction service, not routing.
  // Do not bind an old profile over any newly supplied or pending birth fields.
  if(intent?.subject!=='self'||intent.scope!=='natal'||!birthKey(value.birth)||
    value.profile_update_status==='needs_confirmation'||
    /\d{1,4}[/.:-]\d|\b(?:born|dob|tob|birth\s+(?:date|time|place)|janam|janm)\b|जन्म/iu.test(value.query))return null;
  return {...value.birth};
}

export function semanticContinuationPolicy(intent,existing) {
  if(intent?.scope==='listening')return {mode:'quiet',reason:'listening_only'};
  if(intent?.scope==='sharing')return {mode:'quiet',reason:'just_sharing'};
  return existing;
}
