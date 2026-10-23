import test from "node:test";
import assert from "node:assert/strict";
import { ordinaryReply } from "../extensions/reviewed-reading/direct/ordinary-reply.mjs";
import { asksKnownDetail } from "../extensions/reviewed-reading/direct/companion-context.mjs";

void test("ordinary fee concerns cannot carry copied chart predictions", () => {
  const value = { query: "Fees ki tension hai", language: "hinglish", history: [] };
  for (const reply of [
    "Jupiter ki dasha hai.",
    "2027 ke baad fees arrange hongi.",
    "House 11 strong hai.",
  ]) {
    assert.equal(
      ordinaryReply(reply, value),
      "Abhi fees ki chinta zyada hai. Pehle usi baat par dhyaan dete hain.",
    );
  }
  const plain = "Installments ka option dekha hai?";
  assert.equal(ordinaryReply(plain, value), plain);
  assert.equal(asksKnownDetail("Paise ko lekar sabse zaroori kya hai?", value, []), true);
  assert.equal(asksKnownDetail("Payment kab due hai?", value, []), false);
});
