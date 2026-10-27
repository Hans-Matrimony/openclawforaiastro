// A concern-sharing turn is not permission to generate a chart prediction.
export function ordinaryReply(reply, value) {
  if (
    !/\b(?:house\s*\d+|\d+(?:st|nd|rd|th)\s+house|dasha|antardasha|transits?|Jupiter|Saturn|Venus|Mercury|Rahu|Ketu|kundli|yog|20\d{2})\b/i.test(
      reply,
    )
  ) {
    return reply;
  }
  const studyWithNightShift =
    /\b(?:night\s*shifts?|raat\s*ki\s*(?:shift|duty))\b|नाइट\s*शिफ्ट/i.test(value.query) &&
    /\b(?:padhai|padhayi|study|studies|mba)\b|पढ़ाई|पढाई/i.test(value.query);
  if (studyWithNightShift) {
    if (/^(?:en|english)$/i.test(value.language)) {
      return "Juggling night shifts and studying sounds exhausting.";
    }
    if (/^(?:hi|hindi)$/i.test(value.language)) {
      return "नाइट शिफ्ट के साथ पढ़ाई संभालना थका देने वाला हो सकता है।";
    }
    return "Night shift ke saath padhai sambhalna kaafi thaka dene wala ho sakta hai.";
  }
  const fees = /\bfees?\b/i.test(value.query);
  if (/^(?:en|english)$/i.test(value.language)) {
    return fees
      ? "The fees are what is worrying you right now. We can focus on that without assuming anything about your future."
      : "That sounds difficult. We can focus on what you are dealing with right now.";
  }
  if (/^(?:hi|hindi)$/i.test(value.language)) {
    return fees
      ? "अभी फीस की चिंता ज़्यादा है। पहले उसी बात पर ध्यान देते हैं।"
      : "यह बात आपको परेशान कर रही है। पहले इसी पर बात करते हैं।";
  }
  return fees
    ? "Abhi fees ki chinta zyada hai. Pehle usi baat par dhyaan dete hain."
    : "Yeh baat aapko pareshan kar rahi hai. Pehle isi par baat karte hain.";
}
