import assert from "node:assert/strict";
import test from "node:test";
import { limitResponseLength } from "../extensions/reviewed-reading/direct/response-length.mjs";
const count = (s) => s.trim().split(/\s+/u).length;

void test("short readings and their closing are unchanged", () => {
  const reply = "Support is mixed.\n\nNo event date was calculated.\n\nWhat matters to you most?";
  assert.equal(limitResponseLength(reply), reply);
});
void test("long explanations keep the verdict and follow-up within 100 words", () => {
  const verdict = "September 2027 is a period boundary, not an event date.";
  const closing = "What would you like to discuss about your work?";
  const result = limitResponseLength(
    "One complete supporting reason. ".repeat(50) + "\n\n" + verdict + "\n\n" + closing,
  );
  assert.ok(count(result) <= 100);
  assert.equal(result.split("\n\n").length, 3);
  assert.ok(result.endsWith(verdict + "\n\n" + closing));
  assert.ok(result.split("\n\n")[0].endsWith("."));
});
void test("extra bubbles and oversized paragraphs respect the response ceiling", () => {
  for (const n of [1, 2, 3, 5]) {
    const result = limitResponseLength(Array(n).fill("word ".repeat(180)).join("\n\n"));
    assert.ok(count(result) <= 100);
    assert.ok(result.split("\n\n").length <= 3);
  }
});
void test("shortening preserves negative verdicts and supported timing", () => {
  for (const verdict of [
    "Abhi shaadi ke sanket anukool nahi hain.",
    "November 2031 se July 2034 sambhavit period hai.",
    "Support aur rukawat dono hain; nateeja mixed hai.",
  ]) {
    const result = limitResponseLength(
      "A relevant chart reason. ".repeat(35) +
        "\n\n" +
        verdict +
        "\n\nAap is baat ko lekar kya soch rahe hain?",
    );
    assert.equal(result.split("\n\n")[1], verdict);
    assert.ok(count(result) <= 100);
  }
});
void test("structured data and code remain intact", () => {
  for (const value of [
    JSON.stringify({ data: "word ".repeat(200) }),
    "```\n" + "word ".repeat(200) + "\n```",
  ]) {
    assert.equal(limitResponseLength(value), value);
  }
});
