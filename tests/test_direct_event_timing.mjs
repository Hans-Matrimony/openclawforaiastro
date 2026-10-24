import test from "node:test";
import assert from "node:assert/strict";
import { unsupportedEventTiming } from "../extensions/reviewed-reading/direct/event-timing.mjs";
const evidence = [
  JSON.stringify({ evidence_scope: { timing: "does not calculate event-specific windows" } }),
];
void test("period-only evidence cannot establish a dated event prediction", () => {
  for (const reply of [
    "2027 ke baad financial flow improve hoga.",
    "2028 ke baad shaadi ka mauka strong hai.",
    "Your career will improve in 2027.",
  ]) {
    assert.equal(unsupportedEventTiming(reply, evidence), true);
  }
  for (const reply of [
    "Mars antardasha starts in September 2027.",
    "Career indications are mixed.",
    "September 2027 is a period boundary, not an event date for marriage.",
  ]) {
    assert.equal(unsupportedEventTiming(reply, evidence), false);
  }
  assert.equal(unsupportedEventTiming("Marriage will happen in 2027.", []), false);
});

void test("dated verdicts inherit their topic from the explanation", () => {
  for (const reply of [
    "Financial factors are mixed.\n\n2027 ke baad relief aayega.",
    "Shaadi ke factors mixed hain.\n\n2028 ke baad house 7 ka yog shuru hoga.",
    "Career mein technical fields hain.\n\n2028 ke baad badi opportunity aayegi.",
  ]) {
    assert.equal(unsupportedEventTiming(reply, evidence), true);
  }
});

void test("implicit waiting verdict cannot turn a period boundary into event timing", () => {
  assert.equal(
    unsupportedEventTiming(
      "Marriage has mixed factors.\n\n2027 ke baad Mars antardasha shuru hoga, tab tak wait karo.",
      evidence,
    ),
    true,
  );
});
