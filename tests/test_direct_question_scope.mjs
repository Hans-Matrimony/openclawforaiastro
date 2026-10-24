import test from "node:test";
import assert from "node:assert/strict";
import {
  questionScope,
  mismatchedQuestionReply,
} from "../extensions/reviewed-reading/direct/question-scope.mjs";
import { companionFallback } from "../extensions/reviewed-reading/direct/companion-fallback.mjs";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";

const oldMarriage = "Venus aur Moon rishton se jude hain.\n\nShadi 2027 ke baad possible hai.";
void test("finance and education reject the observed marriage-only verdict", () => {
  assert.ok(mismatchedQuestionReply("Meri financial condition kab behtar hogi?", oldMarriage));
  assert.ok(mismatchedQuestionReply("Mere education ke baare mein batao", oldMarriage));
  assert.equal(
    mismatchedQuestionReply(
      "Meri financial condition kab behtar hogi?",
      "Mixed factors.\n\nIncome improves.",
    ),
    false,
  );
});
const datingReply =
  "Naye rishte ke liye sahyog ke sanket hain.\n\nGirlfriend banne ki sambhavna hai.";
const value = {
  user_id: "synthetic-scope-test",
  query: "GF ka batao meri GF kab banegi",
  language: "hinglish",
  user_gender: "male",
  birth: { date: "2000-01-01", time: "12:00", location_name: "Delhi" },
  history: [
    { role: "user", text: "Meri shadi kab hogi?" },
    { role: "assistant", text: oldMarriage },
  ],
};
const answer = (text) =>
  new Response(
    JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: text } }] }),
  );
const tool = () =>
  new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: "tool_calls",
          message: {
            role: "assistant",
            tool_calls: [
              {
                id: "chart-scope",
                type: "function",
                function: { name: "get_horoscope_predictions", arguments: "{}" },
              },
            ],
          },
        },
      ],
    }),
  );

void test("new partner questions are distinct from marriage and existing-partner conversations", () => {
  for (const query of [
    value.query,
    "Meri BF kab banega?",
    "Meri girlfriend kab milegi?",
    "When will I find a girlfriend?",
    "When will I have a boyfriend?",
  ]) {
    assert.equal(questionScope(query), "dating");
  }
  for (const query of ["Kya meri GF se shaadi hogi?", "Meri shadi kab hogi?"]) {
    assert.equal(questionScope(query), "marriage");
  }
  for (const query of [
    "Meri GF kab baat karegi?",
    "Kya meri GF mujhse pyar karti hai?",
    "My girlfriend is not answering me",
    "Abhi 2026 chal raha hai",
  ]) {
    assert.equal(questionScope(query), null);
  }
  assert.equal(mismatchedQuestionReply(value.query, oldMarriage), true);
  for (const text of [
    datingReply,
    "Reading.\n\nAbhi girlfriend banne ke sanket kamzor hain.",
    datingReply + "\n\nShaadi ki baat ghar par hui?",
  ]) {
    assert.equal(mismatchedQuestionReply(value.query, text), false);
  }
  assert.equal(mismatchedQuestionReply("Mera career kab set hoga?", oldMarriage), true);
  assert.equal(mismatchedQuestionReply("Meri shaadi kab hogi?", oldMarriage), false);
});

void test("GF and BF follow-up fallback stays on dating and uses the third bubble", () => {
  for (const query of ["Meri GF kab banegi?", "Mera BF kab banega?"]) {
    const closing = companionFallback({ ...value, query });
    assert.match(closing, /Naye rishte/);
    assert.doesNotMatch(closing, /shaadi|shadi/i);
  }
});

async function fixture(outputs) {
  let calls = 0,
    tools = 0;
  const requests = [];
  const result = await directAnswer(value, {
    env: {
      OPENROUTER_API_KEY: "test",
      VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "1",
      VEDASTRO_DIRECT_REPLY_CACHE: "0",
    },
    makeMemory: () => ({ read: async () => ["User is interested in meeting a partner"] }),
    makeTools: () => async () => {
      tools++;
      return { birth_chart: { marker: "unchanged-calculation" } };
    },
    fetchImpl: async (_url, options) => {
      const request = JSON.parse(options.body);
      requests.push(request);
      calls++;
      if (calls === 1) {
        return tool();
      }
      if (!request.tools) {
        return answer("Naye rishte ko lekar aapke mann mein kya chal raha hai?");
      }
      return answer(outputs[Math.min(calls - 2, outputs.length - 1)]);
    },
  });
  return { result, calls, tools, requests };
}

void test("a wrong marriage verdict gets one bounded repair using the same calculation evidence", async () => {
  const { result, calls, tools, requests } = await fixture([oldMarriage, datingReply]);
  assert.equal(tools, 1);
  assert.equal(calls, 4);
  assert.ok(result.reply.startsWith(datingReply + "\n\n"));
  assert.equal(result.reply.split("\n\n").length, 3);
  assert.match(requests[0].messages[0].content, /GF means girlfriend/);
  assert.equal(requests[2].messages.filter((m) => m.role === "tool").length, 1);
  assert.equal(
    requests[2].messages.filter((m) => m.role === "assistant" && m.content === oldMarriage).length,
    1,
  ); // Original history only.
});

void test("a valid first answer is unchanged and does not spend a repair request", async () => {
  const { result, calls, tools } = await fixture([datingReply]);
  assert.equal(calls, 3);
  assert.equal(tools, 1);
  assert.equal(result.reply.split("\n\n").slice(0, 2).join("\n\n"), datingReply);
});

void test("persistent topic mismatch never leaks the old prediction or turns into a connection error", async () => {
  const { result, calls, tools } = await fixture([oldMarriage]);
  assert.equal(calls, 4);
  assert.equal(tools, 1);
  assert.equal(result.reply.split("\n\n").length, 3);
  assert.doesNotMatch(result.reply, /2027/);
  assert.match(result.reply, /Naye rishte ki timing/);
});
