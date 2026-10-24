// Render supported source factor types as prose, never as new predictions.
const planets = {
  Sun: "Surya",
  Moon: "Chandra",
  Mars: "Mangal",
  Mercury: "Budh",
  Jupiter: "Guru",
  Venus: "Shukra",
  Saturn: "Shani",
  Rahu: "Rahu",
  Ketu: "Ketu",
};

export function fallbackFactor(text, english) {
  if (typeof text !== "string") {
    return null;
  }
  if (english) {
    // Unknown source phrases are not translated speculatively.
    if (/bindus?|benefic|malefic|combust|retrograde|house \d/i.test(text)) {
      const house = /house (\d{1,2})/i.exec(text)?.[1];
      const planet = /\b(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu)\b/.exec(text)?.[1];
      if (house && /strong support/.test(text)) {
        return `House ${house} contributes support to this reading`;
      }
      if (house && /weak support/.test(text)) {
        return `House ${house} contributes limited support to this reading`;
      }
      if (house && planet && /^(?:benefic|malefic) /.test(text)) {
        return `${planet} in house ${house} is counted as ${text.startsWith("benefic") ? "a supporting" : "a challenging"} factor`;
      }
      return null;
    }
    return text;
  }
  let match = /^house (\d{1,2}) \([^)]+\) bindus (?:sirf )?\d+\/48 .* (strong|weak) support$/.exec(
    text,
  );
  if (match) {
    return `${match[1]}ve ghar se ${match[2] === "strong" ? "achha" : "kam"} sahyog milta hai`;
  }
  match = /^(benefic|malefic) (\w+) house (\d{1,2}) mein/.exec(text);
  if (match && planets[match[2]]) {
    return `${planets[match[2]]} ka ${match[3]}ve ghar mein hona ${match[1] === "benefic" ? "sahyog ka" : "rukawat ka"} sanket hai`;
  }
  match = /^(Jupiter|Saturn|Mars) ki drishti house (\d{1,2}) par/.exec(text);
  if (match) {
    return `${planets[match[1]]} ki ${match[2]}ve ghar par drishti ${match[1] === "Jupiter" ? "sahyog" : "dabav aur deri"} ka sanket deti hai`;
  }
  if (/^current dasha\/antardasha lord .*period ACTIVE hai$/.test(text)) {
    return "Maujooda dasha ka is sawaal se sambandh hai";
  }
  if (text.startsWith("current dasha lords is area se directly linked nahi")) {
    return "Maujooda dasha se is maamle mein seedha sahyog kam hai";
  }
  match = /^(\w+) retrograde .* results me Atkaav$/.exec(text);
  if (match && planets[match[1]]) {
    return `${planets[match[1]]} ki sthiti rukawat ka sanket deti hai`;
  }
  return null;
}
