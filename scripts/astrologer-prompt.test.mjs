// Static contracts only. Model behavior needs the companion conversation review cases.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const main = read(".pi/prompts/astrologer.md");
const workspace = "app/whatsapp-support/workspace-astrologer/";
const documents = ["AGENTS.md", "SOUL.md", "WORKFLOW.md", "GUARDRAILS.md", "KUNDLI_RESPONSE.md", "USER.md"];

for (const path of [".pi/prompts/astrologer.md", ...documents.map((name) => workspace + name), "app/whatsapp-support/workspace-astrologer-preview/AGENTS.md"]) {
  test(`${path}: no obsolete mandatory flow or fabricated biography`, () => {
    assert.doesNotMatch(read(path), /mandatory remedy|remedy is mandatory|then ALWAYS give one practical remedy|always give remedy|readings MUST include at least one Upay|STICK TO THE SAME TIMING|NEVER contradict (?:your previous|your own) predictions|keep SAME timing|keep the SAME dates|same timing\/dates|Always acknowledge and validate their specific emotion|Always open with emotional warmth|Never reveal you are an AI|25 years old|Your father and grandfather are astrologers|Main aapke baare mein soch rahi thi|Main aapke baare mein soch raha tha|bubble 4 must be the follow-up/i);
  });
}

const rules = [
  ["neutral question gets a direct answer without inferred distress", /Answer the actual question directly when enough context is available[\s\S]*do not infer distress from a neutral question/],
  ["calculation failure cannot manufacture precision", /If evidence is missing or a tool fails[\s\S]*never invent a timing window or chart fact/],
  ["requested remedies remain supported without forcing them", /Remedies are optional: offer one only when requested or clearly useful, safe, and supported/],
  ["refusal, beliefs and repeated remedies are respected", /Respect a user's refusal or beliefs, avoid repeating earlier remedies, and never promise an outcome/],
  ["complete answers and goodbye need no follow-up", /Ask at most one useful follow-up question[\s\S]*user wants brevity, declines questions, or says goodbye/],
  ["birth forms are exempt from the follow-up limit", /A required birth-detail form is not a conversational follow-up; keep its existing format/],
  ["helpful curiosity can follow a complete answer", /A relevant question can follow a complete answer; do not add one merely to prolong the chat/],
  ["useful remedies are offered proactively", /Optional does not mean avoid[\s\S]*offer a relevant supported upay naturally/],
  ["warmth includes listening and celebrating", /When the user shares worry, listen and acknowledge it before advice; when they share good news, celebrate it/],
  ["close friendship does not mean pressure or exclusivity", /Do not manufacture emotions, tease about sensitive worries, guilt them into replying, or imply exclusivity/],
  ["unchanged evidence preserves continuity", /Preserve continuity when the evidence is unchanged/],
  ["new inputs and unsupported predictions allow correction", /Correct earlier predictions when birth details, calculations, or relevant evidence change, or a prior answer was unsupported/],
  ["corrections cannot invent explanations", /Never invent a reason for a discrepancy; acknowledge uncertainty if it cannot be resolved/],
  ["memory must be grounded in this user's context", /Reference earlier details only when actually present for this user and useful/],
  ["honest identity without repetitive disclaimers", /If asked whether you are AI, answer honestly and briefly[\s\S]*or repeat identity disclaimers in normal conversation/],
  ["natal placements can be corrected without confusing transits", /Distinguish the user's Birth Chart \(Natal\) from today's Transits \(Gochar\)[\s\S]*Correct a mistaken placement/],
];
for (const [name, pattern] of rules) {
  test(name, () => assert.match(main, pattern));
}

test("main workspace guides consistently permit optional remedies and follow-ups", () => {
  for (const name of documents.filter((name) => name !== "USER.md")) {
    const content = read(workspace + name);
    assert.match(content, /optional remedy|optional-remedy|remedies are optional/i, name);
    assert.match(content, /at most one useful (?:follow-up|question)/i, name);
    assert.match(content, /unsupported/i, name);
    assert.doesNotMatch(content, /(?:skip|skipping) it when the answer is complete/i, name);
  }
});

test("warm examples cover emotion, good news, remedies, listening and natural endings", () => {
  const soul = read(workspace + "SOUL.md");
  for (const phrase of ["Close-Friend Rhythm", "Interview kal hai", "I got the job!", "Padhai se pehle koi simple upay", "Please just listen, no advice", "bas yahi poochna tha"]) {
    assert.ok(soul.includes(phrase), phrase);
  }
});

test("calculation, image delivery, language and birth-profile guards remain", () => {
  const kundli = read(workspace + "KUNDLI_RESPONSE.md");
  assert.match(kundli, /NEVER HALLUCINATE RASHIS/);
  assert.match(kundli, /Run calculate.py EVERY TIME for EVERY user/);
  assert.match(kundli, /MUST include `IMAGE_URL: https:\/\/\.\.\.` line exactly as script outputs it/);
  assert.match(read(workspace + "WORKFLOW.md"), /NEVER ask for birth details if the backend context or Mem0 has an explicit usable birth profile/);
  assert.match(main, /Tone improvements must not change existing gender-detection functionality/);
  assert.match(main, /latest message[\s\S]*100% English/);
});
