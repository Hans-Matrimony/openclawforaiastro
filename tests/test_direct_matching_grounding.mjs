import assert from "node:assert/strict";
import test from "node:test";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { readingContext } from "../extensions/reviewed-reading/direct/context.mjs";
import { invalidGunaPresentation } from "../extensions/reviewed-reading/direct/guna-presentation.mjs";
import {
  matchingGroundingIssues,
  groundedMatchingFallback,
} from "../extensions/reviewed-reading/direct/matching-grounding.mjs";

const names = ["Varna", "Vashya", "Tara", "Yoni", "Graha Maitri", "Gana", "Bhakoot", "Nadi"];
const g = {
  status: "ok",
  score_points: 26.5,
  score_max: 36,
  factors: names.map((name, i) => ({
    name,
    score: [1, 1, 1.5, 4, 5, 6, 0, 8][i],
    max_score: i + 1,
  })),
};
const results = [JSON.stringify({ guna_milan: g })];
const value = {
  user_id: "synthetic-matching-grounding",
  query: "Our compatibility: should I wait or move forward?",
  language: "english",
  history: [{ role: "user", text: "We planned a meeting and he said he was on his way." }],
  birth: { date: "2000-01-01", time: "05:00", location_name: "Delhi" },
};

test("matching rejects invented mental states, deterministic interpretations and relationship commands", () => {
  for (const text of [
    "Guna Milan 26.5/36. He's stuck in his own head. Move forward.",
    "He is stuck in his own head; you are holding space for something that is not coming back.",
    "She does not love you. Leave her.",
    "They might feel trapped.",
    "Bhakoot is zero, meaning deep emotional alignment is blocked.",
    "The score is mixed. So move on.",
    "You should wait for him.",
    "वह तुमसे प्यार नहीं करता। आगे बढ़ो।",
    "Woh wapas nahi aayega. Aage badho.",
    "तो परत येणार नाही. पुढे जा.",
  ]) {
    assert.ok(matchingGroundingIssues(text, results).length, text);
  }
  assert.deepEqual(matchingGroundingIssues("He is stuck in his own head.", []), []);
});

test("matching preserves qualified limits, optional practical steps and checked factor descriptions", () => {
  for (const text of [
    "Guna Milan is 26.5/36. Bhakoot: 0/7. It cannot tell whether he loves you or will return.",
    "You can ask him for a clear arrival time and choose a waiting limit that suits you.",
    "Traditional indicators are mixed; this does not prove the relationship will fail.",
    "Gana: 6/6; Nadi: 8/8. These factors have full points in this calculation.",
  ]) {
    assert.deepEqual(matchingGroundingIssues(text, results), [], text);
  }
  assert.ok(
    matchingGroundingIssues(
      "This cannot determine his feelings. But he does not love you.",
      results,
    ).length,
  );
});

test("grounded fallback uses only verified scores, requested factors and current intent", () => {
  const reply = groundedMatchingFallback(results, value);
  assert.match(reply, /26\.5\/36/);
  assert.match(reply, /Bhakoot: 0\/7/);
  assert.match(reply, /cannot establish/);
  assert.match(reply, /arrival time/);
  assert.doesNotMatch(reply, /he cannot confirm|he did not|not coming back|Move forward\./);
  assert.deepEqual(matchingGroundingIssues(reply, results), []);
  const detail = groundedMatchingFallback(results, { ...value, query: "Show all eight factors" });
  assert.equal(invalidGunaPresentation(detail, results, "all eight factors"), false);
  assert.doesNotMatch(detail, /arrival|waiting/);
  assert.equal(groundedMatchingFallback([], value), null);
  assert.equal(groundedMatchingFallback([...results, ...results], value), null);
  const corrupt = JSON.stringify({ guna_milan: { ...g, score_points: 27 } });
  assert.equal(groundedMatchingFallback([corrupt], value), null);
});

test("grounded fallback retains Hindi, Hinglish, Marathi and explicit current English preference", () => {
  assert.match(groundedMatchingFallback(results, { ...value, language: "hindi" }), /भावनाएं/);
  assert.match(
    groundedMatchingFallback(results, { ...value, language: "hinglish" }),
    /kisi ki feelings/,
  );
  assert.match(groundedMatchingFallback(results, { ...value, language: "marathi" }), /भावना/);
  assert.match(
    groundedMatchingFallback(results, {
      ...value,
      language: "hinglish",
      query: "Reply in English: should I wait?",
    }),
    /cannot establish/,
  );
  assert.match(
    groundedMatchingFallback(results, {
      ...value,
      language: "hindi",
      query: "Do not reply in English. Should I wait?",
    }),
    /भावनाएं/,
  );
});

async function run(draft, { query = value.query, polish = null } = {}) {
  let calls = 0;
  const requests = [];
  const result = await directAnswer(
    { ...value, query },
    {
      env: {
        OPENROUTER_API_KEY: "fixture",
        VEDASTRO_DIRECT_FLOW: "source",
        VEDASTRO_DIRECT_ENVIRONMENT: "development",
        VEDASTRO_DIRECT_REPLY_CACHE: "0",
        VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "0",
      },
      makeMemory: () => ({ read: async () => [] }),
      makeTools: () => async () => results[0],
      fetchImpl: async (_url, options) => {
        calls++;
        const request = JSON.parse(options.body);
        requests.push(request);
        const first = calls === 1;
        const content = polish && request.max_tokens === 60 ? polish : draft;
        return new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: first ? "tool_calls" : "stop",
                message: first
                  ? {
                      tool_calls: [
                        {
                          id: "matching",
                          type: "function",
                          function: { name: "mcp__VedAstro__get_match_report", arguments: "{}" },
                        },
                      ],
                    }
                  : { content },
              },
            ],
          }),
        );
      },
    },
  );
  return { result, calls, requests };
}

test("actual tool loop replaces the observed reply and preserves the score without reasking", async () => {
  const { result } = await run(
    "Guna Milan score is 26.5/36. He's stuck in his own head; you are holding space for something that is not coming back.\n\nMove forward.",
  );
  assert.match(result.reply, /26\.5\/36/);
  assert.match(result.reply, /cannot establish/);
  assert.match(result.reply, /arrival time/);
  assert.doesNotMatch(result.reply, /stuck|not coming back|Move forward\.|confirm.*birth/);
  assert.ok(result.answer_validation.includes("matching_grounding_rejected"));
  assert.ok(result.answer_validation.includes("matching_grounded_delivery"));
});

test("final delivery grounds decision queries even when a draft paraphrases the unsafe conclusion", async () => {
  const { result } = await run(
    "Guna Milan: 26.5/36. Bhakoot: 0/7.\n\nClose this chapter and find someone else.",
  );
  assert.match(result.reply, /cannot establish/);
  assert.doesNotMatch(result.reply, /Close this chapter|find someone else/);
});

test("factor-only matching keeps valid factual prose and general prompts prohibit invented intentions", async () => {
  const { result } = await run(
    "Guna Milan: 26.5/36. Bhakoot: 0/7.\n\nThis traditional assessment does not guarantee relationship success.",
    { query: "My Guna Milan score" },
  );
  assert.match(result.reply, /26\.5\/36/);
  assert.ok(!result.answer_validation.includes("matching_grounding_rejected"));
  const ctx = await readingContext(value, { read: async () => [] }, (text) => text);
  assert.match(ctx.prompt, /not evidence of either person's actual thoughts/);
  assert.match(ctx.prompt, /qualified verdict may state what the calculation cannot establish/);
});
