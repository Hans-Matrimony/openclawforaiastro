export const practicalInstruction =
  "\n\n# Practical next step\nThe current question asks for a practical action, not a new chart reading or prediction. Give one or two concrete, reversible steps relevant to the user's stated goal. Use history for their circumstances, not as proof that past predictions are true. An earlier request to just listen or avoid advice applied to that earlier turn; the current explicit request for a step takes precedence. Do not continue an earlier tiredness conversation instead of answering the current goal. Do not repeat planets, dashas, future years, or a reading/verdict format. Do not advise delaying applications, rejecting opportunities or avoiding a job change because of astrology. Do not call chart tools for this request. Keep the answer brief and leave any friendly question to the companion stage.\n";

export function repeatsPrediction(reply) {
  return /\b20\d{2}\b|\b(?:dasha|antardasha|Jupiter|Saturn|Rahu|Ketu|kundli|horoscope)\b|\bjob\s+change\s+(?:mat|nahi)\b/i.test(reply);
}

export function practicalFallback(value) {
  if (["hi", "hindi"].includes(value.language)) {
    return /\b(?:career|job|naukri)\b/i.test(value.query)
      ? "अपने लक्ष्य वाले पद की ज़रूरतों से अपने कौशल की तुलना कीजिए और सीवी में संबंधित काम स्पष्ट लिखिए। नौकरी बदलने का निर्णय ऑफर, वेतन और अपनी परिस्थिति देखकर लीजिए।"
      : "अपना मुख्य लक्ष्य और उसके रास्ते की एक रुकावट लिखिए। उसे दूर करने के लिए एक छोटा, व्यावहारिक कदम चुनिए जिसका नतीजा आप जाँच सकें।";
  }
  if (/\b(?:career|job|naukri)\b/i.test(value.query)) {
    return value.language === "hinglish"
      ? "Apne target role ki requirements se apni skills compare kijiye aur CV mein relevant projects aur results saaf likhiye. Suitable openings par apply karke options samajhiye; job change ka decision offer, salary aur apni situation dekhkar lijiye."
      : "Compare your skills with the requirements of your target role and highlight relevant projects and results in your CV. Explore suitable openings; base a job change on the offer, pay and your circumstances.";
  }
  return value.language === "hinglish"
    ? "Abhi apna sabse zaroori goal aur usmein aa rahi ek rukawat likhiye. Us rukawat ke liye ek chhota, practical kadam chuniye jiska result aap check kar sakein."
    : "Write down your main goal and one obstacle. Choose a small, practical step whose result you can check.";
}
