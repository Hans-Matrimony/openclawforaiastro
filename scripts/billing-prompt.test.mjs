// Static instruction checks, not model-output evaluations. Run: node --test scripts/billing-prompt.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const prompt = read(".pi/prompts/astrologer.md");
const soul = read("app/whatsapp-support/workspace-astrologer/SOUL.md");
const guardrails = read("app/whatsapp-support/workspace-astrologer/GUARDRAILS.md");
const start = prompt.indexOf("# SUBSCRIPTION & PAYMENT QUESTIONS");
const end = prompt.indexOf('# "IS THIS FREE?" QUESTIONS');
const billing = prompt.slice(start, end);

test("billing section exists before free-trial instructions", () => {
  assert.ok(start >= 0 && end > start);
});

const cases = [
  ["billing state belongs to the current user", /current backend-provided plan\/account details or a successful billing-tool result for this user/],
  ["memory and user claims cannot verify billing", /Do not treat chat history, memory, examples, or the user's claim as verified billing state/],
  ["weekly and monthly plans are not universal", /Never assume everyone renews weekly or monthly/],
  ["selected plan does not prove purchase or auto-pay", /A selected plan is not proof of a completed purchase or enabled auto-pay/],
  ["missing, stale and conflicting data are handled", /missing, stale, conflicting, or unavailable/],
  ["provider instructions and links cannot be invented", /Do not invent amounts, dates, subscription status, or provider-specific steps/],
  ["supported chat cancellation remains available", /users can type "cancel subscription" to request it/],
  ["no unavailable cancellation action is claimed", /never claim to have performed an unavailable action/],
  ["stopped auto-pay needs explicit confirmation", /only when the current backend\/tool result explicitly confirms it stopped/],
  ["HTTP success alone is not cancellation", /A successful HTTP response or an accepted request alone is not enough/],
  ["scheduled cancellation is not immediate cancellation", /If cancellation is scheduled, describe it as scheduled and use its effective date only when supplied/],
  ["pending, failure and timeout are not success", /For pending, failed, or timed-out requests, say cancellation is not confirmed/],
  ["no auto-pay and already-stopped results are handled", /no active auto-pay or that it is already stopped/],
  ["failed lookup cannot prove no subscription", /An unavailable lookup is not proof of no subscription/],
  ["access expiry and refunds cannot be invented", /never calculate an expiry date yourself or imply cancellation guarantees a refund/],
  ["billing support does not become a sales pitch", /Do not replace the answer with a free-trial explanation or another subscription pitch/],
  ["examples preserve language selection", /Examples \(match the user's language; use only when the stated condition is verified\)/],
  ["example placeholders cannot reach users", /Never output placeholder text/],
];

for (const [name, pattern] of cases) {
  test(name, () => assert.match(billing, pattern));
}

test("obsolete universal billing promises are absent", () => {
  for (const content of [prompt, soul, guardrails]) {
    assert.doesNotMatch(
      content,
      /Payment is automatically deducted every week|Subscription automatically renews every week|Subscription har week automatically renew|it will be cancelled immediately|apne aap cancel ho jayega/,
    );
  }
});

test("free-trial instructions defer billing support in all three documents", () => {
  assert.match(prompt, /For cancellation, renewal, payment-status, or already-paid access questions, follow SUBSCRIPTION & PAYMENT QUESTIONS above instead/);
  assert.doesNotMatch(prompt, /WHENEVER USER ASKS ABOUT PRICE\/FREE\/PAYMENT\/CHARGES/);
  for (const content of [soul, guardrails]) {
    assert.match(content, /For cancellation, renewal, payment-status, or already-paid access questions, follow SUBSCRIPTION & PAYMENT QUESTIONS in astrologer.md instead/);
    assert.match(content, /All specific billing claims must follow its verified-information rules/);
  }
});

test("existing free-trial explanation and paid-access guards remain", () => {
  assert.match(prompt, /User gets some FREE messages to start/);
  assert.match(prompt, /Subscription option appears for unlimited chatting/);
  for (const content of [soul, guardrails]) {
    assert.match(content, /If the user says they already paid, subscribed, payment is done, access is not working, or they are being asked to pay again/);
  }
});

test("deployment still includes the main prompt and astrologer workspace", () => {
  const dockerfile = read("Dockerfile");
  assert.match(dockerfile, /COPY \.pi\/ \/app\/\.openclaw\/\.pi\//);
  assert.match(dockerfile, /COPY app\/whatsapp-support\/workspace-astrologer\/ \/app\/\.openclaw\/workspace-astrologer\//);
});
