import {isPersonalChartQuestion, asksForTiming, isPracticalFollowup} from './reading-intent.mjs';

const reminder = /\b(?:already|pehle|pahle)\b.{0,60}\b(?:details?|provided|diya|diye|de\s*rakh|de\s*rekh|bata)|\bdetails?\b.{0,45}\b(?:already|pehle|pahle)|पहले.{0,35}(?:जानकारी|विवरण|बताया|दी|दिया)/iu;
const palm = /\bpalm(?:istry)?\b|\b(?:haath|hath|hand)\b.{0,30}\b(?:read|padh|pad|dekh)|हथेली|हस्तरेखा|हाथ.{0,20}(?:पढ़|देख)/iu;
const planets = /\b(?:Jupiter|Venus|Saturn|Mars|Mercury|Rahu|Ketu|Guru|Shani|Shukra|Mangal)\b|गुरु|शनि|शुक्र|राहु|केतु|बृहस्पति/iu;
const chart = /\b(?:antardasha|mahadasha|dasha|kundli|horoscope|\d{1,2}(?:ve|va|th|st|nd|rd)?\s+(?:ghar|house)|house\s+\d{1,2})\b|अंतर्दशा|महादशा|कुंडली|भाव/iu;
const forecast = /\b(?:sha+di|marriage|marry|wedding|career|naukri|job|rishta|window|yog|strong|favourable|favorable|support|connection|bond|meeting|hogi|hoga|milega|milegi|sambhavit|possible|likely)\b|शादी|विवाह|नौकरी|योग|संभावना|अनुकूल|होगी|होगा/iu;
const dated = /\b(?:19|20)\d{2}\b|[१२][०-९]{3}/u;
const periodWindow = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b.{0,35}\b(?:to|se|tak|through)\b|\b(?:agle|agli|agla|next)\s+(?:saal|mahine|year|month)\b|अगले\s*(?:साल|महीने)/iu;
const personalForecast = /\b(?:sha+di|marriage|wedding|naukri|job)\b.{0,45}\b(?:hogi|hoga|milegi|milega|will happen|will improve|pakka)\b|\byou\s+will\s+(?:marry|get\s+(?:married|a job))\b|(?:शादी|नौकरी).{0,30}(?:होगी|मिलेगी)/iu;
const personal = /\b(?:your|you(?:'re|r)?|aap(?:k[aei])?|tumhar[aei]|meri|mera|mere|my|abhi|current|chal\s+rah)\b|आपक|तुम्हार|अभी|चल\s*रह/iu;
const currentPeriod = /\b(?:abhi|filhaal|currently|right now|at present|current|this|yeh?|is)\b.{0,55}\b(?:time|samay|waqt|period|phase|window)\b|अभी.{0,35}(?:समय|वक़्त|वक्त|दौर)/isu;
const favourablePeriod = /\b(?:best|right|good|favourable|favorable|strong|shubh|anukool|achch?[ae])\b|अनुकूल|शुभ|अच्छा|बेहतर/iu;
const palmRefusal = /\bpalm(?:\s+reading)?\b.{0,65}\b(?:(?:nahi|nahin)\s+(?:kar|padh|pad|dekh)|cannot|can't|unable|not supported)|\b(?:cannot|can't|unable|do not|don't)\b.{0,45}\b(?:read\s+palms?|palm\s+reading)\b|(?:हथेली|हस्तरेखा).{0,40}(?:नहीं\s+(?:पढ़|कर|देख)|(?:पढ़|कर|देख).{0,12}नहीं)/isu;
const otherReadingOffer = /\b(?:sha+di|marriage|wedding|career|naukri)\b.{0,65}\b(?:sawaal|sawal|question|batao|pooch|ask|help|madad)\b|\b(?:help|offer|assist)\b.{0,45}\b(?:marriage|wedding|career)\b/isu;

function palmReminder(value) {
  const latest = [...(value.history ?? [])].reverse().find(turn => turn.role === 'user')?.text ?? '';
  return reminder.test(value.query) && palm.test(latest);
}

export function conversationalTurn(value) {
  return !isPersonalChartQuestion(value.query) && !asksForTiming(value.query);
}

export function conversationGroundingInstruction(value, profile) {
  if (!conversationalTurn(value)) return '';
  let instruction = '\n# Current conversation boundary\nAnswer the latest user request, not an older reading. Earlier assistant predictions, dates and chart statements are unverified conversation data, never evidence. Do not add or repeat personal forecasts, event windows, planetary placements or current dasha claims on this ordinary conversation turn. A short clarification such as "Jaise?" asks you to explain the immediately preceding question, not to change a marriage prediction. A reminder that details were already supplied is not a new marriage question. Image captions preserve what the user asked; they are not calculated chart evidence.\n';
  if (reminder.test(value.query) && profile.status === 'READY') {
    instruction += 'The selected birth profile is already complete. Acknowledge that it is saved and does not need re-entry. Return to the most recent user topic, including an attached palm image, instead of offering a marriage date. Do not claim you inspected a photo unless an image-reading result is actually supplied.\n';
  }
  if (palmReminder(value)) instruction += 'Palm photos are assessed through a separate image path. No photo assessment is supplied on this text turn. Do not claim to have read the image or deny the product\'s palm-reading capability. Acknowledge the saved details and ask for the palm photo to be resent through that path, without offering marriage, career or another reading menu.\n';
  instruction += 'An example request must remain an example: do not add that the current time is best, favourable or strong for a relationship or career without checked evidence.\n';
  return instruction;
}

export function conversationGroundingIssue(reply, value, profile, hasCheckedReadings = false) {
  if (!conversationalTurn(value)) return null;
  // Existing practical-action validation has a more specific repair/fallback.
  if (isPracticalFollowup(value.query)) return null;
  const strictConversation = reminder.test(value.query) || /^(?:jaise|for example|examples?|matlab|haan|han|yes|okay|ok)[?!.\s]*$/iu.test(value.query.trim());
  // Some valid chart questions use natural wording outside the narrow personal
  // request detector. Their checked evidence keeps its established validators.
  if (hasCheckedReadings && !strictConversation) return null;
  const latestUser = [...(value.history ?? [])].reverse().find(turn => turn.role === 'user')?.text ?? '';
  if (palmReminder(value) && (palmRefusal.test(reply) || otherReadingOffer.test(reply))) {
    return 'This text turn has no palm assessment. Do not deny the image capability or redirect to another reading. Acknowledge the saved details and request the palm photo through the image path.';
  }
  if (reminder.test(value.query) && palm.test(latestUser) && !palm.test(reply) &&
      /\b(?:sha+di|marriage|wedding|relationship|rishta)\b|शादी|विवाह/iu.test(reply)) {
    return 'The latest user request was a palm image, not a marriage reading. Acknowledge the saved details and continue the palm request.';
  }
  if (reminder.test(value.query) && profile.status === 'READY' &&
      /\b(?:share|provide|send|confirm|bata|bhej|dijiye)\b.{0,70}\b(?:birth\s+details|date\s+of\s+birth|DOB|birth\s*time)|जन्म.{0,30}(?:बताइए|भेज|दीजिए)/iu.test(reply)) {
    return 'The selected birth details are already saved; do not request them again.';
  }
  // Even a tool call cannot make an unsolicited prediction relevant to a
  // conversational acknowledgement. General astrology definitions stay valid.
  const generalDefinition = /^(?:what\s+(?:is|are|does)|how\s+does|explain|define)\b|\b(?:kya\s+hota|matlab|meaning|definition)\b/iu.test(value.query);
  const scheduledByUser = /\b(?:scheduled|booked|fixed|confirmed|decided|tay\s+hai|date\s+fix)\b/iu.test(value.query) &&
    [...reply.matchAll(/\b(?:19|20)\d{2}\b/gu)].every(match => value.query.includes(match[0]));
  if ((!generalDefinition && ((!scheduledByUser && (dated.test(reply) || periodWindow.test(reply) ||
        (currentPeriod.test(reply) && favourablePeriod.test(reply))) && forecast.test(reply)) ||
        personalForecast.test(reply) || (planets.test(reply) && chart.test(reply)))) ||
      (!hasCheckedReadings && generalDefinition && personal.test(reply) && chart.test(reply) &&
        (planets.test(reply) || dated.test(reply)))) {
    return 'This conversational reply contains a personal astrology claim or dated window without a current request and checked evidence. Explain only the latest conversation; do not copy prior forecasts.';
  }
  return null;
}

export function conversationGroundingFallback(value, profile) {
  const latest = [...(value.history ?? [])].reverse().find(turn => turn.role === 'user')?.text ?? '';
  const previous = [...(value.history ?? [])].reverse().find(turn => turn.role === 'assistant')?.text ?? '';
  if (/^(?:jaise|for example|examples?)[?!.\s]*$/iu.test(value.query.trim()) &&
      /\b(?:serious\s+(?:connection|relationship)|rishta|dating)\b|रिश्ता/iu.test(previous)) {
    return value.language === 'english'
      ? 'For example, regularly talking to someone, meeting them, or being introduced for a relationship. Is anything like that happening?'
      : value.language === 'hindi'
        ? 'जैसे किसी से नियमित बात होना, मिलना, या रिश्ते के लिए कोई परिचय आना। क्या अभी ऐसा कुछ चल रहा है?'
        : 'Jaise kisi se regular baat hona, milna, ya rishte ko lekar koi introduction aana. Kya abhi aisa kuch chal raha hai?';
  }
  if (reminder.test(value.query) && profile.status === 'READY') {
    if (palm.test(latest)) return value.language === 'english'
      ? 'Your birth details are saved; you do not need to enter them again. You asked about your palm photo, not marriage timing. Please resend that photo so it can be assessed.'
      : value.language === 'hindi'
        ? 'आपकी जन्म जानकारी सेव है, दोबारा देने की ज़रूरत नहीं है। आपने हथेली की फोटो के बारे में पूछा था। कृपया वह फोटो दोबारा भेज दें, ताकि उसकी रेखाएँ देखी जा सकें।'
        : 'Aapki birth details saved hain, dobara dene ki zaroorat nahi. Aapne palm photo ki reading poochhi thi. Kripya woh photo dobara bhej dijiye, taaki uski rekhaein dekhi ja sakein.';
    return value.language === 'english' ? 'Your birth details are saved; you do not need to enter them again. Which part of your last question would you like to continue with?'
      : value.language === 'hindi' ? 'आपकी जन्म जानकारी सेव है, दोबारा देने की ज़रूरत नहीं है। अपने पिछले सवाल में किस बात पर आगे बात करना चाहेंगे?'
        : 'Aapki birth details saved hain, dobara dene ki zaroorat nahi. Apne pichhle sawal mein kis baat par aage baat karna chahenge?';
  }
  return value.language === 'english' ? 'I should not repeat an earlier prediction without checking it. Which part of my last reply would you like me to clarify?'
    : value.language === 'hindi' ? 'बिना जाँच के पुरानी भविष्यवाणी दोहराना सही नहीं होगा। मेरे पिछले जवाब की किस बात को स्पष्ट करूँ?'
      : 'Bina jaanch ke purani prediction dohrana sahi nahi hoga. Mere pichhle jawab ki kis baat ko saaf karun?';
}
