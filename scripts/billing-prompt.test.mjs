// Static instruction checks, not model-output evaluations. Run: node --test scripts/billing-prompt.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const prompt = read(".pi/prompts/astrologer.md");
const soul = read("app/whatsapp-support/workspace-astrologer/SOUL.md");
const guardrails = read("app/whatsapp-support/workspace-astrologer/GUARDRAILS.md");
const core = read("app/whatsapp-support/workspace-astrologer/AGENTS.md");
const start = guardrails.indexOf("## Billing status and cancellation");
const billing = guardrails.slice(start).replace(/\s+/g, " ");

void test("billing section exists before free-trial instructions", () => {
  assert.ok(start >= 0);
  assert.match(core.replace(/\s+/g, " "), /billing\/cancellation questions.*GUARDRAILS.md/);
});

const cases = [
  [
    "billing state belongs to the current user",
    /current backend-provided account\/plan details or a successful billing-tool result for this user/,
  ],
  [
    "memory and user claims cannot verify billing",
    /Memory, chat history, examples and user claims are not verified billing state/,
  ],
  ["weekly and monthly plans are not universal", /Do not assume weekly\/monthly renewal/],
  [
    "selected plan does not prove purchase or auto-pay",
    /A selected plan is not proof of purchase or active auto-pay/,
  ],
  ["missing, stale and conflicting data are handled", /missing, stale, conflicting or unavailable/],
  [
    "provider instructions and links cannot be invented",
    /Use only application-supplied provider instructions and links/,
  ],
  [
    "supported chat cancellation remains available",
    /supports chat cancellation, users can request "cancel subscription"/,
  ],
  ["no unavailable cancellation action is claimed", /Never claim an unavailable action/],
  [
    "stopped auto-pay needs explicit confirmation",
    /only when a current backend\/tool result explicitly confirms that it stopped/,
  ],
  [
    "HTTP success alone is not cancellation",
    /HTTP success or an accepted request alone is insufficient/,
  ],
  [
    "scheduled cancellation is not immediate cancellation",
    /Describe scheduled cancellation as scheduled, using an effective date only if supplied/,
  ],
  [
    "pending, failure and timeout are not success",
    /For pending, failed or timed-out requests, cancellation is not confirmed/,
  ],
  [
    "no auto-pay and already-stopped results are handled",
    /no active auto-pay or already-stopped status only when verified/,
  ],
  [
    "failed lookup cannot prove no subscription",
    /an unavailable lookup is not proof that no subscription exists/,
  ],
  [
    "access expiry and refunds cannot be invented",
    /Never calculate access expiry yourself or imply cancellation guarantees a refund/,
  ],
  [
    "billing support does not become a sales pitch",
    /address that status issue rather than a trial explanation or subscription pitch/,
  ],
  ["examples preserve language selection", /Match the resolved language/],
  ["example placeholders cannot reach users", /never send unfilled example\/template placeholders/],
];

for (const [name, pattern] of cases) {
  void test(name, () => assert.match(billing, pattern));
}

void test("obsolete universal billing promises are absent", () => {
  for (const content of [prompt, soul, guardrails]) {
    assert.doesNotMatch(
      content,
      /Payment is automatically deducted every week|Subscription automatically renews every week|Subscription har week automatically renew|it will be cancelled immediately|apne aap cancel ho jayega/,
    );
  }
});

void test("free-trial instructions defer billing support in all three documents", () => {
  assert.match(
    core.replace(/\s+/g, " "),
    /For already-paid\/access problems, answer the status issue; do not replace it with a new pitch or trial explanation/,
  );
  assert.doesNotMatch(prompt, /WHENEVER USER ASKS ABOUT PRICE\/FREE\/PAYMENT\/CHARGES/);
  for (const content of [soul, guardrails]) {
    assert.match(content, /AGENTS.md/);
  }
});

void test("existing free-trial explanation and paid-access guards remain", () => {
  assert.match(billing, /free\/price question, use verified entitlement\/limits/);
  assert.match(billing, /do not invent a free-message count or promise unlimited chat/);
  assert.match(core, /already-paid\/access problems/);
});

void test("deployment still includes the main prompt and astrologer workspace", () => {
  const dockerfile = read("Dockerfile");
  assert.match(dockerfile, /COPY \.pi\/ \/app\/\.openclaw\/\.pi\//);
  assert.match(
    dockerfile,
    /COPY app\/whatsapp-support\/workspace-astrologer\/ \/app\/\.openclaw\/workspace-astrologer\//,
  );
});
