import assert from "node:assert/strict";
import test from "node:test";
import { formatDisplayReply } from "../extensions/reviewed-reading/direct/format-reply.mjs";
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
