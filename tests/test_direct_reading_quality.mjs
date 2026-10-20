import assert from "node:assert/strict";
import test from "node:test";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import {
  collectPeriods,
  expiredTargetReply,
  unsupportedTiming,
  wrongReplyScript,
} from "../extensions/reviewed-reading/direct/reading-quality.mjs";
import { requiresChartReading } from "../extensions/reviewed-reading/direct/reading-intent.mjs";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";

const input = {
  user_id: "synthetic-quality",
  language: "hinglish",
  user_gender: "male",
  birth: { date: "2000-01-01", time: "12:00", location_name: "Delhi, India" },
  query: "meri shaadi kab hogi?",
  history: [],
};
const evidence = JSON.stringify({
  engine: "local-sweph-v2",
  dasha: {
    current_mahadasha: { lord: "Saturn", from: "2020-06-09", to: "2039-06-10" },
    current_antardasha: { lord: "Ketu", from: "2026-02-20", to: "2027-03-31" },
  },
});
const completion = (text) =>
  new Response(
    JSON.stringify({
      choices: [{ finish_reason: "stop", message: { role: "assistant", content: text } }],
    }),
  );
const tool = () =>
  new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: "tool_calls",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "chart",
                type: "function",
                function: { name: "mcp__VedAstro__get_horoscope_predictions", arguments: "{}" },
              },
            ],
          },
        },
      ],
    }),
  );
const dependencies = {
  env: {
    OPENROUTER_API_KEY: "test",
    VEDASTRO_DIRECT_REPLY_CACHE: "0",
    VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "1",
  },
  makeMemory: () => ({ read: async () => [] }),
  makeTools: () => async () => evidence,
  now: () => new Date("2026-10-20T00:00:00Z"),
};

void test("explicit listening skips astrology, advice, tools and paid generation despite old predictions", async () => {
  const result = await directAnswer(
    {
      ...input,
      user_gender: "female",
      query: "Unko hamari alag caste se dikkat hai. Bas suno, abhi koi advice nahi.",
      history: [{ role: "assistant", text: "2027 ke baad shaadi hogi." }],
    },
    {
      ...dependencies,
      makeMemory: () => {
        assert.fail("Listening does not need a memory lookup");
      },
      makeTools: () => {
        assert.fail("Listening must not calculate a reading");
      },
      fetchImpl: async () => {
        assert.fail("Listening must not generate predictions");
      },
    },
  );
  assert.equal(result.answer_model_calls, 0);
  assert.equal(result.reply, "Theek hai, abhi koi advice nahi. Aaram se apni baat keh sakti ho.");
  assert.deepEqual(result.answer_reading_tools, []);
  assert.doesNotMatch(result.reply, /2027|Saturn|Ketu|\?/i);
});

void test("expired upcoming year is clarified without current transits or a paid model call", async () => {
  const result = await directAnswer(
    { ...input, query: "2025 mein shaadi hogi kya?" },
    {
      ...dependencies,
      fetchImpl: async () => {
        assert.fail("Expired target must not generate a prediction");
      },
    },
  );
  assert.match(result.reply, /2025 beet chuka hai/);
  assert.equal(result.answer_model_calls, 0);
  for (const query of [
    "Mera birth year 2000 hai, shaadi kab hogi?",
    "2025 mein shaadi hui thi",
    "2027 mein shaadi hogi?",
  ]) {
    assert.equal(expiredTargetReply({ ...input, query }, "2026-10-20"), null);
  }
  assert.ok(expiredTargetReply({ ...input, query: "2026 tak hogi?" }, "2027-01-01"));
});

void test("reported informal reading requests cannot skip chart tools", () => {
  for (const query of [
    "educatoin ke baare main batao",
    "thodi pareshani hai paiso ko leke kab poori hogi",
    "life main bahut tension hai kab khatam hogi",
  ]) {
    assert.equal(requiresChartReading(query, { status: "READY" }), true, query);
  }
});

void test("period checks reject the observed invented Jupiter transition but accept current periods", () => {
  const periods = collectPeriods(evidence);
  assert.ok(unsupportedTiming("2027 ke baad Jupiter ki dasha shuru hogi.", periods, "2026-10-20"));
  assert.ok(unsupportedTiming("2027 ke baad Saturn ki dasha shuru hogi.", periods, "2026-10-20"));
  assert.equal(
    unsupportedTiming(
      "Saturn ki dasha chal rahi hai. Ketu antardasha 2027 tak hai.",
      periods,
      "2026-10-20",
    ),
    null,
  );
  assert.deepEqual(collectPeriods("not JSON"), []);
  assert.ok(
    unsupportedTiming("Agla anukool samay 2027 ke baad aayega.", periods, "2026-10-20", {
      periodBoundariesOnly: true,
    }),
  );
  assert.ok(
    unsupportedTiming("Agle 3-4 mahine mein paise ki pareshani thik hogi.", periods, "2026-10-20", {
      periodBoundariesOnly: true,
    }),
  );
  assert.ok(
    unsupportedTiming("Next year Jupiter aapke 2nd house mein aayega.", periods, "2026-10-20", {
      periodBoundariesOnly: true,
    }),
  );
  assert.equal(
    unsupportedTiming("Ketu ka daur March 2027 tak hai.", periods, "2026-10-20", {
      periodBoundariesOnly: true,
    }),
    null,
  );
  assert.ok(unsupportedTiming("Shaadi March 2026 mein hogi.", [], "2026-10-20"));
  assert.ok(unsupportedTiming("Shaadi 2025 mein hogi.", [], "2026-10-20"));
  assert.equal(unsupportedTiming("2025 mein shaadi hui thi.", [], "2026-10-20"), null);
  assert.equal(
    unsupportedTiming("March 2026 se March 2027 tak yeh daur rahega.", periods, "2026-10-20"),
    null,
  );
});

void test("unsupported timing and technical wording are corrected before companion and delivery", async () => {
  let calls = 0;
  const answer =
    "Abhi rishte ki baat dheere badh sakti hai.\n\nFilhaal jaldi ka pakka sanket nahi.";
  const result = await directAnswer(input, {
    ...dependencies,
    fetchImpl: async (_url, options) => {
      calls++;
      const body = JSON.parse(options.body);
      if (calls === 1) {
        return tool();
      }
      if (calls === 2) {
        return completion("Mercury combust hai.\n\n2027 ke baad Jupiter ki dasha shuru hogi.");
      }
      if (calls === 3) {
        assert.match(body.messages.at(-1).content, /no Jupiter period/);
        return completion(answer);
      }
      return completion("NONE");
    },
  });
  assert.equal(calls, 4);
  assert.ok(result.reply.startsWith(answer + "\n\n"));
  assert.equal(result.reply.split("\n\n").length, 3);
  assert.doesNotMatch(result.reply, /Jupiter|2027|combust/);
});

void test("missing event windows cannot be replaced with a promise of improvement soon", async () => {
  assert.ok(
    unsupportedTiming(
      "अगले 2-3 महीने में कुछ बदलाव शुरू हो जाएगा।",
      collectPeriods(evidence),
      "2026-10-20",
      { periodBoundariesOnly: true },
    ),
  );
  assert.ok(
    unsupportedTiming("पैसे की स्थिति जल्द सुधरने लगेगी।", collectPeriods(evidence), "2026-10-20", {
      periodBoundariesOnly: true,
    }),
  );
  assert.ok(unsupportedTiming("शादी २०२५ में होगी।", [], "2026-10-20"));
  assert.ok(
    unsupportedTiming(
      "Next 3-4 mahine mein situation sudharne ki sambhavana hai.",
      collectPeriods(evidence),
      "2026-10-20",
      { periodBoundariesOnly: true },
    ),
  );
  assert.ok(
    unsupportedTiming(
      "Jaise hi Saturn ki dasha badlegi aur Jupiter ya Venus ki period shuru hogi, waise hi naya mauka aayega.",
      collectPeriods(evidence),
      "2026-10-20",
      { periodBoundariesOnly: true },
    ),
  );
  assert.ok(
    unsupportedTiming(
      "Paise ki pareshani jald khatam hogi.",
      collectPeriods(evidence),
      "2026-10-20",
      { periodBoundariesOnly: true },
    ),
  );
  assert.equal(
    unsupportedTiming(
      "Jaldi natija nikalna sahi nahi hoga.",
      collectPeriods(evidence),
      "2026-10-20",
      { periodBoundariesOnly: true },
    ),
    null,
  );
  const answer = "Abhi milajule sanket hain.\n\nSamay saaf nahi hai.";
  const value = {
    ...input,
    query: "Mera career kab set hoga? Main night shift karta hoon aur MBA chahta hoon.",
  };
  for (const output of [
    "Aapki kundali ke anusar MBA ka samay sakriya hai.",
    "Paise ki pareshani jaldi door hogi, tension mat lijiye.",
  ]) {
    let status;
    const result = await contextualClosing(answer, value, {
      generate: async () => output,
      onOutcome: (outcome) => {
        status = outcome;
      },
    });
    assert.equal(status, "fallback_reading_repeated");
    assert.match(result.split("\n\n")[2], /Night shift/);
    assert.ok(result.startsWith(answer));
  }
});

void test("requested Hinglish cannot silently switch to a Hindi reading or closing", async () => {
  const hindi = "अभी पैसों की तंगी और दबाव चल रहा है। अगले 2-3 महीने में कुछ बदलाव दिखने लगेगा।";
  assert.equal(wrongReplyScript(hindi, input), true);
  assert.equal(wrongReplyScript("Shani ka daur chal raha hai.", input), false);
  assert.equal(wrongReplyScript(hindi, { ...input, language: "hindi" }), false);
  assert.equal(wrongReplyScript(hindi, { ...input, query: "Hindi mein batao" }), false);
  const answer = "Abhi milajule sanket hain.\n\nSamay saaf nahi hai.";
  const result = await contextualClosing(answer, input, { generate: async () => hindi });
  assert.equal(result.split("\n\n").length, 3);
  assert.equal(wrongReplyScript(result, input), false);
});

void test("a first quality failure on the final allowed model round falls back instead of exceeding the loop budget", async () => {
  let calls = 0;
  const result = await directAnswer(input, {
    ...dependencies,
    fetchImpl: async () => {
      calls++;
      return calls < 5 ? tool() : completion("Next 3-4 mahine mein shaadi ki sambhavana hai.");
    },
  });
  assert.equal(calls, 5);
  assert.equal(result.answer_quality_fallback, true);
  assert.equal(result.reply.split("\n\n").length, 3);
  assert.doesNotMatch(result.reply, /3-4|Next/);
});

void test("a repeated incorrect education house claim cannot be delivered", async () => {
  const wrong =
    "Tumhare chart mein Jupiter aur Mercury dono hi 10th house mein hain.\n\nPadhai aur career jud rahe hain.";
  const packet = {
    ...JSON.parse(evidence),
    birth_chart: {
      planets: [
        "Jupiter: Aries 30.00° | house 2 | Test",
        "Mercury: Sagittarius 240.00° | house 10 | Test",
      ],
    },
  };
  let calls = 0;
  const result = await directAnswer(
    { ...input, query: "educatoin ke baare main batao" },
    {
      ...dependencies,
      makeTools: () => async () => JSON.stringify(packet),
      fetchImpl: async () => {
        calls++;
        return calls === 1 ? tool() : completion(wrong);
      },
    },
  );
  assert.equal(result.answer_quality_fallback, true);
  assert.doesNotMatch(result.reply, /Jupiter aur Mercury dono/);
  assert.equal(result.reply.split("\n\n").length, 3);
});

void test("repeated invalid timing returns verified facts and a third bubble instead of an error", async () => {
  let calls = 0;
  const result = await directAnswer(input, {
    ...dependencies,
    fetchImpl: async () => {
      calls++;
      return calls === 1 ? tool() : completion("2027 ke baad Jupiter ki dasha shuru hogi.");
    },
  });
  assert.equal(calls, 4);
  assert.equal(result.answer_quality_fallback, true);
  assert.match(result.reply, /Shani aur Ketu/);
  assert.doesNotMatch(result.reply, /Jupiter|2027/);
  assert.equal(result.reply.split("\n\n").length, 3);
});

void test("an unrecognized informal question cannot ship invented personal chart claims without tools", async () => {
  let calls = 0;
  const result = await directAnswer(
    { ...input, query: "meri uljhan ka kya scene hai?" },
    {
      ...dependencies,
      fetchImpl: async (_url, options) => {
        calls++;
        const body = JSON.parse(options.body);
        if (calls === 1) {
          return completion("Saturn ka transit aapko pareshan kar raha hai.");
        }
        if (calls === 2) {
          assert.equal(body.tool_choice, "required");
          return tool();
        }
        if (calls === 3) {
          return completion(
            "Abhi baat ko dheere samajhna behtar hoga.\n\nJaldi ka pakka sanket nahi.",
          );
        }
        return completion("Aapko abhi sabse zyada kis baat ki uljhan hai?");
      },
    },
  );
  assert.equal(result.answer_reading_tools.length, 1);
});

void test("companion fallback uses relevant user history or memory and never assistant predictions", async () => {
  const answer = "Original explanation.\n\nOriginal verdict.";
  const generate = async () => "NONE";
  const cases = [
    [
      {
        ...input,
        query: "Mera career kab set hoga? Main night shift karta hoon aur MBA karna chahta hoon.",
      },
      [],
      /Night shift/,
    ],
    [
      { ...input, query: "education ke baare mein batao" },
      ["User works night shift and is preparing for MBA"],
      /Night shift/,
    ],
    [
      {
        ...input,
        history: [{ role: "user", text: "Mere gharwale mere relationship ke khilaaf hain." }],
      },
      [],
      /Gharwalon/,
    ],
    [
      {
        ...input,
        history: [{ role: "assistant", text: "Your family opposes your relationship." }],
      },
      [],
      /Is rishte/,
    ],
  ];
  for (const [value, facts, expected] of cases) {
    const result = await contextualClosing(answer, value, { facts, generate });
    assert.equal(result.split("\n\n").length, 3);
    assert.ok(result.startsWith(answer + "\n\n"));
    assert.match(result.split("\n\n")[2], expected);
  }
});
