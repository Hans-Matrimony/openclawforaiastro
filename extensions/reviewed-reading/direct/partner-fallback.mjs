import { sourceHouseRuler } from "./house-evidence.mjs";

export function asksPartnerNature(query) {
  return (
    /\b(?:partner|spouse|wife|husband|saathi|jeevansathi)\b|जीवनसाथी|साथी/iu.test(query) &&
    /\b(?:kaisa|kaisi|nature|like|traits|personality)\b|कैसा|कैसी|स्वभाव/iu.test(query)
  );
}

// Reuse only the two reviewed marriage themes in assets/engine/reading.py.
// This fallback describes symbolism, not facts about an unknown real partner.
export function partnerFallback(rows, language, query) {
  if (!asksPartnerNature(query)) {
    return "";
  }
  const charts = rows.filter((r) => r.birth_chart).map((r) => r.birth_chart);
  if (!charts.length || new Set(charts.map((c) => JSON.stringify(c))).size !== 1) {
    return "";
  }
  const chart = charts[0];
  if (chart.label !== "natal") {
    return "";
  }
  const ruler = sourceHouseRuler(chart, 7);
  const matches = (Array.isArray(chart.planets) ? chart.planets : []).filter(
    (p) => typeof p === "string" && p.startsWith(ruler + ":"),
  );
  if (!ruler || matches.length !== 1) {
    return "";
  }
  const house = Number(/\| house (\d{1,2})\b/.exec(matches[0])?.[1]);
  const english = language === "english";
  if (house === 4) {
    return english
      ? "For a partner, the seventh lord in house four suggests valuing home and shared comfort, an interpretive theme rather than a fixed personality."
      : "Saathi ke swabhav mein ghar aur saath rehne ke sukoon ka rujhaan dikhta hai: saatve ghar ke swami chauthe ghar mein hain.";
  }
  if (house === 1) {
    return english
      ? "For a partner, the seventh lord in house one suggests familiarity and shared history, an interpretive theme rather than a fixed personality."
      : "Saathi ke saath apnapan aur ek doosre ko samajhne ka rujhaan dikhta hai: saatve ghar ke swami pehle ghar mein hain.";
  }
  return english
    ? "The checked factors do not establish a particular partner personality."
    : "Saathi ka koi khaas swabhav in sanketon se tay nahi hota.";
}
