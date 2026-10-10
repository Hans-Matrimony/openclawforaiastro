import { readFileSync } from "node:fs";

const rules = JSON.parse(
  readFileSync(new URL("./period_rules.json", import.meta.url), "utf8"),
).rules;
const legacyVenus = {
  Sun: {
    marriage: "adverse",
    career: "adverse",
    finance: "adverse",
  },
  Moon: {
    marriage: "mixed",
    career: "limited",
    education: "supportive",
    finance: "supportive",
  },
  Mars: {
    marriage: "conditional",
    career: "mixed",
    finance: "supportive",
  },
  Rahu: {
    marriage: "adverse",
    career: "limited",
    finance: "limited",
  },
  Jupiter: {
    marriage: "conditional",
    career: "supportive",
    education: "supportive",
    finance: "supportive",
  },
  Saturn: {
    career: "adverse",
    finance: "mixed",
  },
  Mercury: {
    marriage: "supportive",
    career: "supportive",
    education: "supportive",
    finance: "supportive",
  },
  Ketu: {
    marriage: "adverse",
    career: "adverse",
    finance: "adverse",
  },
  Venus: {
    career: "supportive",
    finance: "supportive",
  },
};
export const revisions = ["reviewed-outcomes-v2", "reviewed-outcomes-v3"];
export function periodStatus(major, minor, topic, extended = false) {
  if (!["marriage", "career", "education", "finance"].includes(topic)) {
    return undefined;
  }
  if (major === "Venus" && (!extended || legacyVenus[minor]?.[topic])) {
    return legacyVenus[minor]?.[topic];
  }
  if (!extended) {
    return undefined;
  }
  const row = rules[major + minor + "PD2"];
  if (!row) {
    return undefined;
  }
  if (topic === "career") {
    return "limited";
  }
  const values =
    topic === "marriage"
      ? [row.ratings.Family, row.ratings.Love]
      : [row.ratings[topic === "education" ? "Studies" : "Money"]];
  return values.includes("Good") && values.includes("Bad")
    ? "mixed"
    : values.includes("Good")
      ? "supportive"
      : values.includes("Bad")
        ? "adverse"
        : "limited";
}
export function validWindowRule(window, extended = false) {
  const major = window?.mahadasha,
    minor = window?.antardasha;
  if (
    typeof major !== "string" ||
    typeof minor !== "string" ||
    window.rule_id !== major + minor + "PD2"
  ) {
    return false;
  }
  return extended
    ? rules[window.rule_id]?.marriage_event === true
    : major === "Venus" && ["Mars", "Jupiter"].includes(minor);
}
