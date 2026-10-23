import test from "node:test";
import assert from "node:assert/strict";
import { previousSameQuestion } from "../extensions/reviewed-reading/direct/repeated-question.mjs";

void test("repeat comparison uses latest exact question and excludes companionship", () => {
  const history = [
    { role: "user", text: "Meri shaadi kab hogi?" },
    { role: "assistant", text: "Old reason.\n\nOld verdict.\n\nOld closing?" },
    { role: "user", text: "Meri job kab lagegi?" },
    { role: "assistant", text: "Unrelated job answer." },
  ];
  assert.equal(
    previousSameQuestion({ query: " meri SHAADI  kab hogi? ", history }),
    "Old reason.\n\nOld verdict.",
  );
  assert.equal(previousSameQuestion({ query: "Meri shaadi 2030 tak hogi?", history }), null);
  assert.equal(previousSameQuestion({ query: "Why?", history }), null);
  assert.equal(previousSameQuestion({ query: "Meri shaadi kab hogi?", history: [] }), null);
  history.push(
    { role: "user", text: "Meri shaadi kab hogi?" },
    { role: "assistant", text: "Corrected reason.\n\nCorrected verdict." },
  );
  assert.equal(
    previousSameQuestion({ query: "Meri shaadi kab hogi?", history }),
    "Corrected reason.\n\nCorrected verdict.",
  );
});
