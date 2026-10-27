import test from "node:test";
import assert from "node:assert/strict";
import { formatDisplayReply } from "../extensions/reviewed-reading/direct/format-reply.mjs";

test("marriage schedule uses readable dates without becoming an event prediction", () => {
  const input = "Rishte mein rukawatein hain.\n\nShaadi ka samay: Mars antardasha 2027-09-15 se 2028-11-14 tak hai.\n\nAap kya chahte ho?";
  assert.equal(formatDisplayReply(input), "Rishte mein rukawatein hain.\n\nMangal ki antardasha 15 September 2027 se 14 November 2028 tak chalegi.\n\nAap kya chahte ho?");
});

test("preserves selected marriage windows, negative readings and other topics", () => {
  for (const text of [
    "Shaadi ka yog November 2031 se July 2034 ke beech hai.",
    "2031 se 2034 ke beech shaadi ki sambhavna kam hai.",
    "Paise ki sthiti: Mars antardasha 2027-09-15 se 2028-11-14 tak hai.",
    "Shaadi ka samay: Mars antardasha 2027-02-30 se 2028-11-14 tak hai.",
    "Shaadi ka samay: Mars antardasha 2029-09-15 se 2028-11-14 tak hai.",
  ]) assert.equal(formatDisplayReply(text), text);
});
