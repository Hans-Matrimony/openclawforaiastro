import assert from "node:assert/strict";
import test from "node:test";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import {
  suppliedBirth,
  matchingEvidence,
  confirmedMatchingArguments,
  matchingForms,
} from "../extensions/reviewed-reading/direct/birth-evidence.mjs";
import { readingContext } from "../extensions/reviewed-reading/direct/context.mjs";
import { matchingFormText } from "../extensions/reviewed-reading/direct/matching-text.mjs";
import { sourceReading } from "../extensions/reviewed-reading/direct/source-engine.mjs";
import { createTools } from "../extensions/reviewed-reading/direct/tools.mjs";

const birth = { date: "1992-01-10", time: "05:30", location_name: "Delhi" };
const other = { date: "1989-06-09", time: "08:00", location_name: "Bangalore" };
const args = {
  female_birth_date: birth.date,
  female_birth_time: birth.time,
  female_location_name: birth.location_name,
  male_birth_date: other.date,
  male_birth_time: other.time,
  male_location_name: other.location_name,
};
const memory = { read: async () => [], write: async () => ({ saved: true }) };
const natural = "Rohan 9th June 1989 8.00am Bangalore";
const context = {
  birth,
  gender: "female",
  query: natural,
  history: [{ role: "user", text: "Please compare my partner and my saved profile." }],
};

test("the real matching engine supports the confirmed city without substituting another city", async () => {
  const input = { ...args, female_location_name: "Kolhapur, Maharashtra, India" };
  const report = JSON.parse((await sourceReading("get_match_report", input)).content[0].text);
  assert.equal(report.guna_milan.status, "ok");
  assert.equal(report.female_chart.utc_time, "1992-01-10T00:00:00.000Z");
  await assert.rejects(
    sourceReading("get_match_report", { ...input, female_location_name: "Kolhapur, Canada" }),
    /conflicts/,
  );
  await assert.rejects(
    sourceReading("get_match_report", {
      ...input,
      female_location_name: "Unknown Kolhapur suburb",
    }),
    /supported exact city/,
  );
});

test("natural and single-line matching forms retain explicit date, clock and city", () => {
  for (const text of [
    natural,
    "Rohan 9 June 1989 8am Bangalore",
    "Rohan 09/06/1989 08:00 Bangalore",
    "Rohan 1989-06-09 8:00 AM Bangalore",
    "DOB: 9th June 1989; Time: 8.00am; Place: Bangalore",
    "9 June 1989\n8.00am\nBangalore",
  ]) {
    assert.equal(suppliedBirth(other, text), true, text);
    const ctx = { ...context, query: text };
    assert.equal(matchingEvidence(confirmedMatchingArguments(args, ctx), ctx), true, text);
  }
  assert.equal(matchingFormText("9 June 1989 8:00am Bangalore").includes("8:00:00"), false);
  assert.equal(matchingFormText(matchingFormText(natural)), matchingFormText(natural));
  assert.equal(
    suppliedBirth({ ...other, time: "20:00" }, natural.replace("8.00am", "8.00pm")),
    true,
  );
  assert.equal(suppliedBirth({ ...other, time: "00:00" }, natural.replace("8.00am", "12am")), true);
  assert.equal(suppliedBirth({ ...other, time: "12:00" }, natural.replace("8.00am", "12pm")), true);
});

test("invalid, hypothetical, conflicting and assistant-authored profiles stay blocked", () => {
  for (const text of [
    natural.replace("9th June", "31st June"),
    natural.replace("8.00am", "8.99am"),
    natural.replace("8.00am", "25:00"),
    natural.replace("8.00am", "8.00"),
    natural.replace("Bangalore", "Bangalore, Canada"),
    "Example: " + natural,
    "Not " + natural,
    natural + "\n10 June 1989",
    "Assistant guessed " + natural,
  ]) {
    assert.equal(suppliedBirth(other, text), false, text);
  }
  assert.equal(
    matchingEvidence(args, {
      ...context,
      query: "Already shared",
      history: [{ role: "assistant", text: natural }],
    }),
    false,
  );
  assert.equal(
    matchingEvidence(
      {
        ...args,
        male_birth_date: birth.date,
        male_birth_time: birth.time,
        male_location_name: birth.location_name,
      },
      context,
    ),
    false,
  );
});

test("latest user form survives a short complaint; changed person and corrected complete forms replace it", () => {
  const ctx = {
    ...context,
    query: "It is already shared, how many times?",
    history: [...context.history, { role: "user", text: natural }],
  };
  assert.equal(matchingEvidence(args, ctx), true);
  assert.equal(matchingEvidence(args, { ...ctx, query: "Different partner, compare now" }), false);
  assert.equal(
    matchingEvidence(args, { ...ctx, query: natural.replace("9th June", "10th June") }),
    false,
  );
  assert.equal(
    matchingEvidence(
      { ...args, male_birth_date: "1989-06-10" },
      { ...ctx, query: natural.replace("9th June", "10th June") },
    ),
    true,
  );
  assert.equal(matchingForms({ ...ctx, query: "Different partner, compare now" }).length, 0);
});

test("natural city qualifiers are restored without swapping countries or changing the saved profile", async () => {
  const ctx = { ...context, query: natural.replace("Bangalore", "Bangalore, Karnataka, India") };
  const normalized = confirmedMatchingArguments(args, ctx);
  assert.equal(normalized.male_location_name, "Bangalore, Karnataka, India");
  assert.equal(matchingEvidence(normalized, ctx), true);
  assert.equal(
    matchingEvidence(
      confirmedMatchingArguments({ ...args, male_location_name: "Bangalore, Canada" }, ctx),
      ctx,
    ),
    false,
  );
  let calls = 0;
  const before = structuredClone(birth);
  const execute = createTools({
    ...ctx,
    memory,
    reading: async (name, input) => {
      calls++;
      assert.equal(name, "get_match_report");
      assert.equal(input.male_location_name, normalized.male_location_name);
      return { content: [{ type: "text", text: "verified" }] };
    },
  });
  assert.equal(await execute("get_match_report", args), "verified");
  assert.equal(calls, 1);
  assert.deepEqual(birth, before);
});

test("both prompt flows expose normalized user data without treating assistant text as birth evidence", async () => {
  for (const sourceFlow of [false, true]) {
    const value = {
      ...context,
      user_gender: "female",
      language: "english",
      query: "Already shared",
      history: [...context.history, { role: "user", text: natural }],
    };
    const c = await readingContext(value, memory, (t) => t, new Date("2026-11-09"), { sourceFlow });
    assert.match(c.prompt, /Explicit birth forms/);
    assert.match(c.prompt, /9\/6\/1989/);
    assert.match(c.prompt, /8:00 am/);
    assert.match(c.prompt, /Do not infer gender from a name/);
    assert.deepEqual(c.profile.fields, birth);
    const noEvidence = await readingContext(
      { ...value, history: [{ role: "assistant", text: natural }] },
      memory,
      (t) => t,
      undefined,
      { sourceFlow },
    );
    assert.doesNotMatch(noEvidence.prompt, /Explicit birth forms/);
  }
});

test("the reported form and subsequent complaint execute matching once instead of the missing-details loop", async () => {
  for (const followup of [false, true]) {
    let models = 0,
      calculations = 0;
    const value = {
      user_id: "synthetic-natural-match",
      birth,
      user_gender: "female",
      language: "english",
      query: followup ? "It is already shared, how many times?" : natural,
      history: [
        ...context.history,
        ...(followup
          ? [
              { role: "user", text: natural },
              { role: "assistant", text: "Please confirm your partner birth details?" },
            ]
          : []),
      ],
    };
    const result = await directAnswer(value, {
      env: {
        OPENROUTER_API_KEY: "fixture",
        VEDASTRO_DIRECT_FLOW: "source",
        VEDASTRO_DIRECT_ENVIRONMENT: "development",
        VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "0",
        VEDASTRO_DIRECT_REPLY_CACHE: "0",
      },
      makeMemory: () => memory,
      makeTools: (options) =>
        createTools({
          ...options,
          reading: async () => {
            calculations++;
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    guna_milan: { status: "ok", score_points: 24.5, score_max: 36 },
                  }),
                },
              ],
            };
          },
        }),
      fetchImpl: async () => {
        models++;
        return new Response(
          JSON.stringify({
            choices: [
              models === 1
                ? {
                    finish_reason: "tool_calls",
                    message: {
                      tool_calls: [
                        {
                          id: "match",
                          type: "function",
                          function: { name: "get_match_report", arguments: JSON.stringify(args) },
                        },
                      ],
                    },
                  }
                : {
                    finish_reason: "stop",
                    message: {
                      content:
                        "The verified Guna Milan score is 24.5/36. This traditional assessment does not guarantee relationship success.",
                    },
                  },
            ],
          }),
        );
      },
    });
    assert.equal(calculations, 1);
    assert.equal(models, 2);
    assert.deepEqual(result.answer_reading_tools, ["get_match_report"]);
    assert.match(result.reply, /24\.5\/36/);
    assert.doesNotMatch(result.reply, /confirm.*birth/i);
  }
});
