import { conversationProgressEnabled } from "./conversation-progress.mjs";
import {correctedReadingSubject} from './personal-query.mjs';
import {resolveReadingTopic} from './topic-period-context.mjs';
import {isSpecificReturnQuestion} from './pilot-bubbles.mjs';
// Instructions select evidence and presentation, never a canned prediction.
export const TOPIC_PROMPTS = Object.freeze({
  marriage_timing: {
    description: "Whether and when marriage may happen",
    check: "Check the selected person's confirmed birth profile, current relationship situation, marriage-specific factors returned by the chart tools, and relevant current/upcoming periods. Separate readiness, meeting someone, engagement and marriage; these are not the same event.",
    answer: "Lead with the supported marriage outlook. If timing is asked, include the relevant supported future window in that answer. Then explain the strongest supporting factor and meaningful obstacle. Do not substitute a period schedule for a marriage assessment.",
  },
  marriage_partner: {
    description: "Future spouse, love versus arranged marriage, partner characteristics",
    check: "Check which partner characteristics or relationship pathways the tools actually support and what the user has already shared about preferences and family. Distinguish a possible tendency from an identifiable person's facts.",
    answer: "Answer the specific characteristic or pathway first. Explain only supported tendencies; never invent a name, address, exact occupation, appearance or guaranteed love/arranged outcome.",
  },
  compatibility: {
    description: "Compatibility or matching between two identified people",
    check: "Confirm whose profiles are being compared and request only missing required fields. Use the match tool when both profiles are available. Keep overall score, individual dimensions and practical relationship concerns distinct.",
    answer: "Give the overall compatibility assessment first, then the most relevant strength and friction point. Explain the limits of a score; it does not prove consent, loyalty, safety or that the relationship must succeed or fail.",
  },
  marriage_obstacles: {
    description: "Marriage delay, family objections or obstacles to marriage",
    check: "Separate user-reported obstacles from tool-supported chart indications. Check the actual marriage evidence and timing relevant to the obstacle; do not attribute every delay to a planet or repeat a generic delay explanation.",
    answer: "Address why progress appears difficult and whether the evidence supports improvement. Keep family discussions and practical choices separate from prediction. Do not invent a curse, defect, permanent denial or paid remedy requirement.",
  },
  career_job: {
    description: "Getting a job or establishing a career",
    check: "Use the user's known employment status and current career question. Check tool-returned career support, obstacles and relevant periods. Distinguish getting an offer, joining, income stability and feeling settled.",
    answer: "Answer the requested job/career outcome first, with supported timing if requested. Explain the strongest relevant evidence in the next bubble. Do not answer only by naming an antardasha or guarantee an offer.",
  },
  career_growth: {
    description: "Promotion, recognition, pay growth or career stagnation",
    check: "Check known role and goals, current versus future career indicators and any tool-supported growth window. Separate promotion, salary increase and recognition rather than treating one as proof of the others.",
    answer: "State the outlook for the exact type of growth requested, then the reason and limiting factor. Do not invent employer decisions, salary figures or promotion deadlines.",
  },
  career_change: {
    description: "Switching jobs, choosing a field or changing career direction",
    check: "Identify the choices already supplied, the user's priorities and relevant career evidence. Compare only options the user supplied or broadly explain criteria when none are supplied. Check timing only if relevant to the question.",
    answer: "Give a reasoned direction or comparison first. Distinguish chart interpretation from practical considerations such as skills, finances and an actual offer. Do not tell the user to resign solely because of a chart.",
  },
  business: {
    description: "Business, self-employment or business partnerships",
    check: "Distinguish starting, expanding, cash flow and partnership questions. Use available business/career indicators and relevant timing without treating potential as a financial guarantee. Use known business details rather than inventing them.",
    answer: "Answer the business decision or outlook first, then relevant support and risk. Do not promise revenue, profits or partner honesty. Practical advice should use general decision criteria and identify missing material information.",
  },
  money: {
    description: "Financial stability, income, debt or money timing",
    check: "Separate earned income, savings, debt and speculative gains. Check only tool-supported financial indications and periods. Do not turn a general favorable factor into proof of a particular payment or return.",
    answer: "Answer the requested financial outlook clearly, then explain its basis. No guaranteed returns, windfalls, exact wealth amounts or investment recommendations based on astrology. Keep practical budgeting separate from symbolic interpretation.",
  },
  property: {
    description: "Buying a home, property timing or location choices",
    check: "Distinguish prediction about ownership/timing from practical location advice. Check property-relevant tool evidence only for a requested reading. Use known budget, commute and priorities for practical comparisons; do not infer a specific city from a generic chart factor.",
    answer: "Answer the ownership/timing question if supported. For location advice give useful selection criteria or compare supplied options, rather than repeatedly asking the user to choose first. Never invent local prices, returns or an exact future address.",
  },
  abroad: {
    description: "Foreign travel, migration, overseas work or settlement",
    check: "Distinguish a trip, study, work and permanent settlement. Use relevant travel/relocation evidence and supplied periods. A foreign-travel indication does not establish a visa approval, destination or permanent move.",
    answer: "State the outlook for the specific goal first and explain the supporting evidence. Include a supported future window only when relevant. Do not promise immigration decisions or choose a country without supporting information.",
  },
  love_new: {
    description: "New relationship, crush, dating or first contact",
    check: "Distinguish meeting someone, talking to a known crush and entering a relationship. Preserve the specific person and current situation. Check relevant relationship evidence; a general relationship period is not evidence of the crush's feelings.",
    answer: "Answer the requested relationship/contact outlook first, then explain the evidence. Respect the other person's agency. Do not replace a crush question with generic marriage timing or claim knowledge of private feelings.",
  },
  partner_return: {
    description: "An ex or girlfriend/boyfriend returning or reconciliation",
    check: "Keep reconciliation separate from a new relationship or marriage. Use known breakup/contact context and relevant checked relationship evidence. Distinguish an opportunity for communication from proof that this particular person will return.",
    answer: "Address reunion directly and give the strongest justified assessment. If the chart cannot establish whether this person will return, say so plainly rather than manufacturing yes/no certainty. A supported relationship window may be explained without turning it into a return date. Do not encourage repeated contact after rejection.",
  },
  relationship_conflict: {
    description: "Relationship conflict, commitment, breakup or trust concerns",
    check: "Use user-reported events and the current question, not imagined partner motives. Separate listening/practical support from a requested reading. For a reading, use relevant relationship evidence without treating symbolism as proof of cheating or abuse.",
    answer: "Address the concern first with a clear, proportionate assessment. Explain what is known versus uncertain. Do not accuse a partner, pressure reconciliation or use a chart to override consent or personal safety.",
  },
  education: {
    description: "Studies, exams, admission or academic direction",
    check: "Distinguish preparation, exam performance, admission and subject selection. Use known educational goals and relevant tool evidence; effort, eligibility and actual decisions are separate from chart indications.",
    answer: "Answer the academic question first, followed by supported reasons and timing if asked. Do not guarantee marks, ranks or admission. Give practical study guidance only when wanted and do not fabricate the user's preparation level.",
  },
  family: {
    description: "Family relationships, parenting or family planning",
    check: "Identify whose question this is and separate relational concerns from fertility, pregnancy or medical claims. Use only relevant family evidence for a requested reading and user-provided facts for companionship.",
    answer: "Address the family concern respectfully without assigning blame from a chart. Do not predict a child's sex, diagnose infertility, guarantee pregnancy or invent family members' intentions. Medical questions require medical evidence, not chart inference.",
  },
  wellbeing: {
    description: "Emotional wellbeing, health worries or life-direction uncertainty",
    check: "Determine whether the user wants listening, practical support or symbolic reflection. Use their actual words and known history. Chart factors cannot establish illness, diagnosis, lifespan or death dates.",
    answer: "Respond to the feeling or concern first. Do not convert distress into a forecast, medical reassurance or a request for birth details. Do not predict death or prescribe treatment from astrology. Avoid unsolicited advice when the user wants to be heard.",
  },
});


// Keep this experiment inside the existing WhatsApp pilot; no extra model call.
export function selectedTopicGuides(subject,topic) {
  const text=correctedReadingSubject(subject??'',{allowDismissal:true});
  const resolved=topic??resolveReadingTopic(text)?.topic??(
    /शादी|विवाह|जीवनसाथी/iu.test(text)?'marriage':/करियर|नौकरी|पदोन्नति/iu.test(text)?'career':
    /\b(?:business|startup|self.employ\w*|vyapar|karobar)\b|व्यापार|कारोबार/iu.test(text)?'career':
    /पैस[ेा]|आर्थिक|वित्त/iu.test(text)?'money':/रिश्त[ाे]|प्रेम/iu.test(text)?'relationship':null);
  // These select instructions, never the reading route or a prediction.
  if(/\b(?:guna?|kuta|compatibility|matching|match report|kundali milan)\b|गुण\s*मिलान|कुंडली\s*मिलान/iu.test(text))return ['compatibility'];
  if(isSpecificReturnQuestion(text))return ['partner_return'];
  if(/\b(?:property|real estate|ghar\s+(?:kharid|lena)|buy\w*\s+(?:a\s+)?(?:home|house))\b|मकान|घर\s*(?:खरीद|लेना)/iu.test(text))return ['property'];
  if(/\b(?:abroad|overseas|videsh|foreign (?:travel|settlement|work))\b|विदेश/iu.test(text))return ['abroad'];
  if(/\b(?:education|studies|study|exams?|admission|padhai|padhaai|padhayi)\b|पढ़ाई|परीक्षा|शिक्षा/iu.test(text))return ['education'];
  if(resolved==='marriage') {
    const partner=/\b(?:love (?:or|vs|versus) arranged|arranged|kaisa|kaisi|characteristics|qualities)\b|\babout\b.{0,30}\b(?:spouse|wife|husband)\b|कैस[ाी]|अरेंज/iu.test(text);
    const obstacle=/\b(?:delay|delayed|obstacles?|rukawat|deri|why|kyun|kyu)\b|देरी|रुकावट|क्यों/iu.test(text);
    return [partner?'marriage_partner':'marriage_timing',...(obstacle?['marriage_obstacles']:[])];
  }
  if(resolved==='career') {
    if(/\b(?:business|self.employ\w*|startup|vyapar|karobar)\b|व्यापार|कारोबार/iu.test(text))return ['business'];
    if(/\b(?:switch|change|changing|resign|field|direction|badal\w*)\b|बदल|इस्तीफा/iu.test(text))return ['career_change'];
    if(/\b(?:promotion|pormotion|salary|pay|growth|recognition|stagnation|tarakki)\b|तरक्की|पदोन्नति|वेतन/iu.test(text))return ['career_growth'];
    return ['career_job'];
  }
  if(resolved==='money')return ['money'];
  if(/\b(?:family|parenting|children|parents|parivar)\b|परिवार|माता|पिता|बच्चे/iu.test(text))return ['family'];
  if(resolved==='relationship')return [/\b(?:conflict|breakup|trust|cheat\w*|commitment|jhagda|ladai)\b|झगड़ा|भरोसा|धोखा/iu.test(text)?'relationship_conflict':'love_new'];
  if(/\b(?:health|wellbeing|well.being|lonely|anxious|akela|udaas)\b|सेहत|स्वास्थ्य|अकेला|उदास/iu.test(text))return ['wellbeing'];
  return [];
}

export function pilotTopicPrompt(env, value, readingRequired, {subject=value.query,topic}={}) {
  if (env.ASTROFRIEND_PILOT_TOPIC_PROMPTS !== "1" ||
      env.VEDASTRO_DIRECT_FLOW !== "source" || value.reply_surface !== "whatsapp" ||
      !readingRequired || !conversationProgressEnabled(env, value.user_id)) return "";
  const focused=env.ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED==='1'&&env.ASTROFRIEND_PILOT_COHERENT_REPLIES==='1'&&env.ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED==='1';
  const guides=focused?selectedTopicGuides(subject,topic).map(key=>TOPIC_PROMPTS[key]):Object.values(TOPIC_PROMPTS);
  return "\n# Pilot use-case guides\nChoose only the relevant guide(s) from the latest request and ordered conversation. These are instructions, not chart evidence or canned answers. A short follow-up inherits the current subject unless the user changes it. Corrections override earlier topics. Do not print guide names or answer unrelated topics.\nAnswer the actual question first, then explain the checked reasons in a separate bubble. Preserve material opposing evidence. A yes/no question needs the strongest supported assessment, never manufactured certainty. Missing evidence is unknown, not no. Use the user's language throughout. Use only returned chart facts; a period schedule alone does not establish an event or someone's intentions. Future forecasts must refer to future time; past period boundaries may be identified as historical. Request only genuinely missing required details. Never repeat a clarification already answered.\n" +
    guides.map(entry => "\n## " + entry.description + "\nCheck: " + entry.check + "\nAnswer: " + entry.answer).join("\n");
}
