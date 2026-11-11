// Whole-turn social greetings only: short factual follow-ups and mixed bursts
// must keep the normal PWA evidence, clarification and conversation flow.
export function isBriefWhatsAppGreeting(value) {
  if (value.reply_surface !== 'whatsapp' || value.reply_to || value.profile_update_status === 'saved' ||
      typeof value.query !== 'string' || value.query.length > 160) return false;
  const text = value.query.normalize('NFKC').toLowerCase()
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, ' ')
    .replace(/[.!?,;:।…]+/gu, ' ').trim().replace(/\s+/gu, ' ');
  const greeting = '(?:hi+|he+y+|hello+|namaste|namaskar|नमस्ते|नमस्कार|हाय|हेलो|jai shri ram|जय श्री राम|good (?:morning|afternoon|evening))(?:\\s+(?:meera|aarav|ji|मीरा|आरव))?';
  const wellbeing = "(?:how are you|how r u|how are u|how['’]s it going|kaise ho|kaisi ho|kaise hain|kya haal hai|क्या हाल है|कैसे हो|कैसी हो|कैसे हैं)";
  return new RegExp('^(?:(?:' + greeting + ')\\s*){1,4}(?:' + wellbeing + ')?$|^' + wellbeing + '$', 'u').test(text);
}

const fallbacks = {
  english: 'Hello!', en: 'Hello!', hinglish: 'Namaste!', hindi: 'नमस्ते!', hi: 'नमस्ते!',
  tamil: 'வணக்கம்!', telugu: 'నమస్కారం!', kannada: 'ನಮಸ್ಕಾರ!', malayalam: 'നമസ്കാരം!',
  gujarati: 'નમસ્તે!', marathi: 'नमस्कार!', bengali: 'নমস্কার!', punjabi: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ!', urdu: 'سلام!',
};

export function boundWhatsAppGreeting(reply, value) {
  if (!isBriefWhatsAppGreeting(value) || typeof reply !== 'string' || !reply.trim() ||
      /```|`|https?:\/\/|(?:^|\n)\s*\||(?:PDF_REQUEST|MEDIA_BASE64|KUNDLI_IMAGE|MEDIA|IMAGE_URL|IMAGE):/u.test(reply)) return reply;
  try { JSON.parse(reply); return reply; } catch { /* Plain social prose. */ }
  const text = reply.trim().replace(/\s+/gu, ' ');
  if (text.split(/\s+/u).length <= 20 && text.length <= 180) return text;
  // A complete greeting, never the first 20 words of a truncated prediction.
  // No question or name is invented here; the existing preference-aware finish
  // stage can add the verified name when appropriate.
  return fallbacks[value.language] ?? reply;
}
