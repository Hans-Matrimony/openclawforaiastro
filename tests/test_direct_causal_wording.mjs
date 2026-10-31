import assert from "node:assert/strict";
import test from "node:test";
import { formatDisplayReply } from "../extensions/reviewed-reading/direct/format-reply.mjs";
test("live qualitative score wording preserves mixed evidence, timing and companion", () => {
  const suffix = "\n\nNovember 2031 se July 2034 ke beech shaadi ho sakti hai.\n\nRishte ko lekar aaj kaisa lag raha hai?";
  const raw = "Jupiter 7ve ghar mein supportive hai, lekin Saturn bhi hai aur house ka score bahut kam hai.";
  assert.equal(formatDisplayReply(raw + suffix),
    "Jupiter 7ve ghar mein supportive hai, lekin Saturn bhi hai aur is ghar ka sahyog bahut kam hai." + suffix);
  assert.equal(formatDisplayReply("10ve ghar ka lord Sun hai aur uski ashtakavarga score strong hai, lekin progress slow hai."),
    "10ve ghar ka lord Sun hai aur uska sahyog strong hai, lekin progress slow hai.");
});
test("qualitative wording retains negation and does not interpret scores or alter code", () => {
  for (const strength of ["kam", "bahut kam", "kamzor", "weak", "strong", "strong nahi"]) {
    const result = formatDisplayReply(`House ka score ${strength} hai.`);
    assert.equal(result, `is ghar ka sahyog ${strength} hai.`);
    assert.equal(formatDisplayReply(result), result);
  }
  for (const unchanged of [
    "My exam score is strong.", "house ka score 20 hai.",
    "2031 mein 7ve ghar ka kharcha 20 lakh hai.",
    '`house ka score bahut kam hai`',
    '```text\nashtakavarga score weak hai\n```',
    '{"text":"house ka score weak hai"}',
    "https://example.com/house-ka-score",
  ]) assert.equal(formatDisplayReply(unchanged), unchanged);
});
test("technical word removal preserves a complete causal clause and dates", () => {
  const raw =
    "Jupiter retrograde hai, isliye deri ke sanket hain.\n\nNovember 2031 se July 2034 sambhavit hai.\n\nAapne baat ki?";
  const out = formatDisplayReply(raw);
  assert.equal(
    out,
    "Jupiter ki sthiti ki wajah se deri ke sanket hain.\n\nNovember 2031 se July 2034 sambhavit hai.\n\nAapne baat ki?",
  );
  assert.equal(out.split("\n\n").length, 3);
});
test("ordinary positive and negative conclusions are unchanged", () => {
  for (const text of [
    "Shaadi ki sambhavna kam hai.",
    "Jupiter 7ve ghar mein hai.",
    "Naukri ke liye sahyog hai.",
  ]) {
    assert.equal(formatDisplayReply(text), text);
  }
});

void test("clear marriage timing keeps dates and contrary indications", () => {
  assert.equal(
    formatDisplayReply("Shaadi November 2031 se July 2034 ke beech ki sambhavna hai."),
    "Shaadi ka yog November 2031 se July 2034 ke beech hai.",
  );
  assert.equal(
    formatDisplayReply(
      "Jupiter ki antardasha mein November 2031 se July 2034 ke beech shaadi hone ki sambhavna hai.",
    ),
    "Jupiter ki antardasha mein November 2031 se July 2034 ke beech shaadi ka yog dikh raha hai.",
  );
  const negative = "Shaadi November 2031 se July 2034 ke beech hone ki sambhavna kam hai.";
  assert.equal(formatDisplayReply(negative), negative);
  const mixed =
    "Shaadi November 2031 se July 2034 ke beech ki sambhavna hai, lekin rukawatein bhi hain.";
  assert.match(formatDisplayReply(mixed), /lekin rukawatein bhi hain/);
});
