import {confirmedFormBirth} from './birth-evidence.mjs';
import {asksForTiming} from './reading-intent.mjs';

// A selected account profile is never evidence for a different person's chart.
// Match a person attached to a reading subject, not any mention of a friend.
export function otherReadingPerson(query) {
  return /\b(?:my\s+)?(?:friend|sister|brother|mother|father|daughter|son|wife|husband|partner)\s+(?:get\s+married|marry|get\s+a\s+job|go\s+abroad)\b/iu.test(query)||
    /\b(?:friend|dost|sister|brother|mother|father|daughter|son|behen|bhai|mummy|papa|wife|husband|girlfriend|boyfriend|partner|spouse)\s+(?:ki|ka|ke|'s)\s+(?:sha+di|vivah|marriage|career|job|naukri|love|relationship|kundli|chart|birth|ghar|property|abroad|education)|\b(?:my|mere|meri|mera)\s+(?:friend|dost|sister|brother|mother|father|daughter|son|behen|bhai|wife|husband|partner)(?:'s)?\s+(?:marriage|wedding|career|job|chart|horoscope|birth|property)|\b(?:his|her|their|uski|uska|unki|unka)\s+(?:marriage|wedding|sha+di|career|job|kundli|chart|horoscope|birth|property)|(?:दोस्त|बहन|भाई|माँ|पिता|पत्नी|पति|बेटी|बेटा)\s*(?:की|का|के)\s*(?:शादी|विवाह|करियर|कुंडली|जन्म|घर|संपत्ति)/iu.test(query);
}

export function otherReadingBirth(query) {
  return otherReadingPerson(query)?confirmedFormBirth(query):null;
}

export function readingPersonBoundary(value) {
  if(!otherReadingPerson(value.query)||otherReadingBirth(value.query)||
    !(/\b(?:kundli|chart|horoscope|astrology|predict\w*|yog)\b|कुंडली|कुण्डली/u.test(value.query)||
      asksForTiming(value.query,{exactDateRequests:true})))return null;
  const unavailable=/\b(?:details|birth details)\b[^.!?\n]{0,50}\b(?:nahi|nahin|not available)\b|\b(?:don['’]?t|do not)\s+have\b[^.!?\n]{0,45}\b(?:birth|details)\b/iu.test(value.query);
  const reply=unavailable?(value.language==='english'?
    'Without their birth details, I cannot calculate their reading. It needs their own birth date, exact birth time and birthplace.':
    value.language==='hindi'?'उनके जन्म विवरण के बिना उनकी कुंडली की गणना नहीं हो सकती। इसके लिए उनकी जन्मतिथि, सही जन्म समय और जन्मस्थान चाहिए।':
    'Unki birth details ke bina unki kundli ki ganana nahi ho sakti. Iske liye unki janam tareekh, sahi janam samay aur janam sthan chahiye.'):
    value.language==='english'?
    'For their reading, I need their own birth date, exact birth time and birthplace. Do you have those details?':
    value.language==='hindi'?
    'उनकी कुंडली देखने के लिए उनकी जन्मतिथि, सही जन्म समय और जन्मस्थान चाहिए। क्या ये विवरण मिल सकते हैं?':
    'Unki kundli dekhne ke liye unki janam tareekh, sahi janam samay aur janam sthan chahiye. Kya yeh details mil sakti hain?';
  return {kind:'person_profile',supported_event:'personal_reading',reply};
}
