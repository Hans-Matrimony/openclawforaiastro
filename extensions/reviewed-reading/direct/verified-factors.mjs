const names = {
  Jupiter: "Guru",
  Saturn: "Shani",
  Mercury: "Budh",
  Mars: "Mangal",
  Venus: "Shukra",
  Moon: "Chandra",
  Sun: "Surya",
  Rahu: "Rahu",
  Ketu: "Ketu",
};

// A small fallback renderer for the local engine's actual rule factors. Unknown
// strings are omitted, never interpreted as placements or predicted outcomes.
function factor(text) {
  let match;
  if ((match = /^house (\d+) \([^)]+\) (strong|weak) support$/.exec(text))) {
    return `Ghar ${match[1]} se ${match[2] === "strong" ? "sahyog" : "kam sahyog"} ke sanket hain.`;
  }
  if ((match = /^house (\d+) lord (\w+) combust \(Sun ke paas\)/.exec(text)) && names[match[2]]) {
    return `Ghar ${match[1]} ke swami ${names[match[2]]} Surya ke bahut paas hain; paramparik reading mein ise kamzor sahyog maana jata hai.`;
  }
  if ((match = /^(Jupiter|Saturn|Mars) ki drishti house (\d+) par/.exec(text))) {
    return `${names[match[1]]} ki ghar ${match[2]} par nazar hai, jo is reading mein ${match[1] === "Jupiter" ? "sahyog" : "dabav"} ka sanket hai.`;
  }
  if ((match = /^(benefic|malefic) (\w+) house (\d+) mein/.exec(text)) && names[match[2]]) {
    return `${names[match[2]]} ghar ${match[3]} mein hain; is reading mein yeh ${match[1] === "benefic" ? "sahyog" : "rukawat"} ka ek sanket hai.`;
  }
  return null;
}

export function verifiedFactors(signal) {
  if (!signal) {
    return [];
  }
  const positive = (signal.positive ?? []).map(factor).find(Boolean);
  const negative = (signal.negative ?? []).map(factor).find(Boolean);
  return [positive, negative].filter(Boolean);
}
