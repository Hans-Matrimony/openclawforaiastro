import test from "node:test";
import assert from "node:assert/strict";
import { unsupportedEventTiming } from "../extensions/reviewed-reading/direct/event-timing.mjs";
const evidence = [
  JSON.stringify({ evidence_scope: { timing: "does not calculate event-specific windows" } }),
];
void test("qualified interpretations retain an exact returned period without inventing event dates", () => {
  const rows = [
    JSON.stringify({
      evidence_scope: { timing: "does not calculate event-specific windows" },
      dasha: { upcoming_antardashas: [{ lord: "Jupiter", from: "2031-11-15", to: "2034-07-15" }] },
    }),
  ];
  const reading =
    "Shaadi ke liye November 2031 se July 2034 sambhavit period hai. Jupiter antardasha mein 7th house ka support iska reason hai.\n\nNovember 2031 se July 2034 sambhavit hai.";
  assert.equal(unsupportedEventTiming(reading, rows), false);
  for (const bad of [
    reading.replaceAll("2031", "2030"),
    reading.replaceAll("July", "June"),
    reading.replace("Jupiter", "Venus"),
    reading.replaceAll("sambhavit", "guaranteed"),
    reading + " Shaadi 2035 mein hogi.",
  ]) {
    assert.equal(unsupportedEventTiming(bad, rows), true, bad);
  }
  assert.equal(unsupportedEventTiming(reading, evidence), true);
});
void test("period-only evidence cannot establish a dated event prediction", () => {
  for (const reply of [
    "2027 ke baad financial flow improve hoga.",
    "2028 ke baad shaadi ka mauka strong hai.",
    "Your career will improve in 2027.",
    "2027 ke baad financial situation behtar hogi.",
    "Shaadi ke liye 2028 ke baad ek possible window khul sakta hai.",
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

void test("financial support claims cannot borrow a date from a dasha boundary", () => {
  for (const reply of [
    "Financial support direct nahi hai.\n\n2027 ke baad Mars antardasha shuru hoga isme house 11 ka sahyog badh sakta hai, lekin Mercury hone ki wajah se paise ka flow slow rahega.",
    "Finance is mixed.\n\nMars antardasha starts in September 2027. Income may increase during it.",
    "Paise ke factors mixed hain.\n\n2027 mein dasha badlegi. Isme sahyog badhega.",
    "Income will decrease after 2027.",
  ]) {
    assert.equal(unsupportedEventTiming(reply, evidence), true, reply);
  }
  for (const reply of [
    "Financial factors are mixed.\n\nMars antardasha starts in September 2027.",
    "Income may increase, but no verified event date follows from September 2027.",
    "Financial support is mixed and income may increase.",
  ]) {
    assert.equal(unsupportedEventTiming(reply, evidence), false, reply);
  }
});
