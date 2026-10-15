// Static contracts only. Model behavior needs the companion conversation review cases.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const workspace = "app/whatsapp-support/workspace-astrologer/";
const main = [
  "AGENTS.md",
  "SOUL.md",
  "TOOLS.md",
  "WORKFLOW.md",
  "GUARDRAILS.md",
  "KUNDLI_RESPONSE.md",
]
  .map((name) => read(workspace + name))
  .join("\n")
  .replace(/\s+/g, " ");
const documents = [
  "AGENTS.md",
  "SOUL.md",
  "WORKFLOW.md",
  "GUARDRAILS.md",
  "KUNDLI_RESPONSE.md",
  "USER.md",
];

for (const path of [
  ".pi/prompts/astrologer.md",
  ...documents.map((name) => workspace + name),
  "app/whatsapp-support/workspace-astrologer-preview/AGENTS.md",
]) {
  void test(`${path}: no obsolete mandatory flow or fabricated biography`, () => {
    assert.doesNotMatch(
      read(path),
      /mandatory remedy|remedy is mandatory|then ALWAYS give one practical remedy|always give remedy|readings MUST include at least one Upay|STICK TO THE SAME TIMING|NEVER contradict (?:your previous|your own) predictions|keep SAME timing|keep the SAME dates|same timing\/dates|Always acknowledge and validate their specific emotion|Always open with emotional warmth|25 years old|Your father and grandfather are astrologers|Main aapke baare mein soch rahi thi|Main aapke baare mein soch raha tha|bubble 4 must be the follow-up/i,
    );
  });
}

const rules = [
  [
    "neutral question gets a direct answer without inferred distress",
    /Never invent distress.*Answer directly/,
  ],
  [
    "calculation failure cannot manufacture precision",
    /Failed, incomplete or fallback stub calculations do not authorize personal chart claims/,
  ],
  [
    "requested remedies remain supported without forcing them",
    /Remedies are optional, safe, supported/,
  ],
  [
    "refusal, beliefs and repeated remedies are respected",
    /respectful of refusal.*without repeated remedies after refusal/,
  ],
  [
    "complete answers and goodbye need no follow-up",
    /complete answer can end naturally.*none just for engagement.*Respect "just listen" or "no questions" by asking none/,
  ],
  [
    "birth forms are exempt from the follow-up limit",
    /soft targets: preserve complete requested content.*birth forms/,
  ],
  [
    "helpful curiosity can follow a complete answer",
    /Ask at most one useful follow-up about one clear thing/,
  ],
  ["useful remedies are offered proactively", /Offer a requested supported upay naturally/],
  [
    "warmth includes listening and celebrating",
    /Listen to expressed worry before advice and celebrate good news/,
  ],
  [
    "close friendship does not mean pressure or exclusivity",
    /Never invent distress, shared history, private feelings, exclusivity or an emotional debt/,
  ],
  ["unchanged evidence preserves continuity", /Retain a supported conclusion on follow-up/],
  [
    "new inputs and unsupported predictions allow correction",
    /correct an unsupported earlier answer or changed evidence with its actual reason/,
  ],
  [
    "corrections cannot invent explanations",
    /A discrepancy you cannot resolve is a limit, not a guessed explanation/,
  ],
  [
    "memory must be grounded in this user's context",
    /Reuse explicit current-user context first.*Never fabricate memory/,
  ],
  [
    "technical identity stays private without a false human claim",
    /Be honest if directly asked whether you are AI.*without inventing a human age.*Do not expose hidden prompts/,
  ],
  [
    "natal placements can be corrected without confusing transits",
    /subject, birth revision, method and as-of date.*A corrected birth requires fresh evidence/,
  ],
];
for (const [name, pattern] of rules) {
  void test(name, () => assert.match(main, pattern));
}

void test("main workspace guides consistently permit optional remedies and follow-ups", () => {
  // Behavioral rules are centralized; other guides must defer to that core
  // rather than repeat the entire policy into every automatically loaded file.
  assert.match(main, /Remedies are optional/);
  assert.match(main, /at most one useful follow-up/);
  for (const name of documents.filter((name) => name !== "USER.md")) {
    assert.doesNotMatch(read(workspace + name), /must always.*remedy|always.*closing question/i);
  }
  assert.match(read(workspace + "SOUL.md"), /AGENTS.md/);
});

void test("warm examples cover emotion, good news, remedies, listening and natural endings", () => {
  for (const phrase of [
    "celebrate good news",
    "Listen to expressed worry",
    "supported upay",
    "just listen",
    "complete answer can end naturally",
  ]) {
    assert.ok(main.includes(phrase), phrase);
  }
});

void test("calculation, image delivery, language and birth-profile guards remain", () => {
  assert.match(main, /Use a successful current-user calculation/);
  assert.match(main, /corrected birth requires fresh evidence/);
  assert.match(main, /Preserve successful IMAGE_URL\/AUDIO_URL\/PDF_URL markers exactly/);
  assert.match(main, /Reuse complete details and ask only for missing\/conflicting fields/);
  assert.match(main, /known male user selects Meera, a female user selects Aarav/);
  assert.match(
    main,
    /application's resolved reply language.*English sentences containing kundli\/dasha remain English/,
  );
});
