import assert from "node:assert/strict";
import test from "node:test";
import { unsupportedEventTiming } from "../extensions/reviewed-reading/direct/event-timing.mjs";
import { formatDisplayReply } from "../extensions/reviewed-reading/direct/format-reply.mjs";
import { alignPeriodVerdict } from "../extensions/reviewed-reading/direct/period-interpretation.mjs";
import { timingRepairEvidence } from "../extensions/reviewed-reading/direct/timing-repair.mjs";

const evidence = [
  JSON.stringify({
    engine: "local-sweph-v2",
    evidence_scope: { timing: "does not calculate event-specific windows" },
    dasha: { upcoming_antardashas: [{ lord: "Mars", from: "2027-09-15", to: "2028-11-14" }] },
  }),
];

test("plural house-score wording retains meaning without an orphaned number", () => {
  const text = "7ve ghar ki bindus sirf 20 hain \u2014 bahut kam.";
  assert.equal(formatDisplayReply(text), "7ve ghar mein sahyog bahut kam hai.");
  for (const preserved of ["7ve ghar ki keemat sirf 20 lakh hai.", "Age sirf 20 hai."]) {
    assert.equal(formatDisplayReply(preserved), preserved);
  }
  assert.equal(formatDisplayReply(formatDisplayReply(text)), formatDisplayReply(text));
});

test("observed dating and job promises undergo the same timing check as marriage", () => {
  for (const reply of [
    "Girlfriend 2027-09-15 ke baad banegi.",
    "Job 2027 ke baad lagegi.",
    "Boyfriend 2027 mein milega.",
    "Naukri 2028 mein mil jayegi.",
    "GF 2027 ke baad nahi banegi.",
  ]) {
    assert.equal(unsupportedEventTiming(reply, evidence), true, reply);
  }
  for (const reply of [
    "Mars antardasha September 2027 se November 2028 tak hai.",
    "Job ke sanket mixed hain.",
    "Girlfriend ki timing ka sawal hai.",
  ]) {
    assert.equal(unsupportedEventTiming(reply, evidence), false, reply);
  }
});

test("qualified complete windows keep positive, negative and mixed meanings", () => {
  for (const topic of ["girlfriend", "job", "shaadi"]) {
    for (const conclusion of [
      "sambhavana hai",
      "sambhavana kam hai",
      "sambhavna hai, lekin rukawatein bhi hain",
    ]) {
      const reply = `Mars ki drishti 7ve ghar par hai.\n\nMars antardasha September 2027 se November 2028 mein ${topic} ki ${conclusion}.`;
      assert.equal(unsupportedEventTiming(reply, evidence), false, reply);
      assert.equal(unsupportedEventTiming(reply.replaceAll("2028", "2029"), evidence), true, reply);
    }
  }
});

test("observed orphaned score is cleaned without changing placements, timing or polarity", () => {
  const input =
    "7ve ghar mein Jupiter aur Saturn dono baithte hain, lekin sirf 20 hain weak hai.\n\nMars antardasha 2027-09-15 se shuru hota hai.\n\nKisi se baat hui?";
  assert.equal(
    formatDisplayReply(input),
    input.replace("sirf 20 hain weak hai", "sahyog weak hai"),
  );
  for (const input of [
    "7ve ghar mein Jupiter hai, lekin sirf 20 lakh bache hain.",
    "7ve ghar mein Jupiter hai. Sirf 20 marks hain weak hai.",
    "7ve ghar mein Jupiter hai.\n\n2027-09-15 se 2028-11-14 tak.",
    "`7ve ghar mein Jupiter hai, lekin sirf 20 hain weak hai`",
  ]) {
    assert.equal(formatDisplayReply(input), input);
  }
});

test("repair dates come from evidence rather than a repeated example year", () => {
  const other = evidence.map((text) => text.replaceAll("2027", "2037").replaceAll("2028", "2038"));
  const prompt = timingRepairEvidence(other);
  assert.match(prompt, /September 2037/);
  assert.match(prompt, /November 2038/);
  assert.doesNotMatch(prompt, /2027|2028/);
});

test("captured correction keeps the verdict inside the model-selected window", () => {
  const explanation =
    "Mars ki drishti house 7 par hai. Mars antardasha September 2027 se November 2028 mein shaadi sambhavit hai.";
  for (const ending of [
    "shaadi ka sambhavna hai.",
    "shaadi ki sambhavna kam hai.",
    "shaadi sambhavit hai, lekin rukawatein bhi hain.",
  ]) {
    const reply = explanation + "\n\n2027 ke baad Mars antardasha mein " + ending;
    const aligned = alignPeriodVerdict(reply, evidence);
    assert.equal(
      aligned,
      explanation + "\n\nSeptember 2027 se November 2028 ke beech Mars antardasha mein " + ending,
    );
    assert.equal(unsupportedEventTiming(aligned, evidence), false);
  }
  for (const reply of [
    explanation + "\n\n2027 ke baad shaadi hogi.",
    explanation + "\n\n2027 ke baad Jupiter antardasha mein shaadi ki sambhavna hai.",
    explanation + "\n\n2029 ke baad Mars antardasha mein shaadi ki sambhavna hai.",
    "Mars 7ve ghar par hai.\n\n2027 ke baad Mars antardasha mein shaadi ki sambhavna hai.",
  ]) {
    assert.equal(alignPeriodVerdict(reply, evidence), reply);
  }
  const reply = explanation + "\n\n2027 ke baad Mars antardasha mein shaadi ki sambhavna hai.";
  assert.equal(alignPeriodVerdict(reply, []), reply);
  assert.equal(
    alignPeriodVerdict(reply, [...evidence, evidence[0].replace("2028-11-14", "2029-11-14")]),
    reply,
  );
});

test("parenthesized internal score disappears but ages and amounts stay", () => {
  const input = "house 7 weak hai (bindus sirf 20), aur Saturn wahan hai.";
  assert.equal(formatDisplayReply(input), "house 7 weak hai, aur Saturn wahan hai.");
  for (const value of ["Age (sirf 20) hai.", "Fees (20 lakh) hain.", '{"score":20}']) {
    assert.equal(formatDisplayReply(value), value);
  }
});
