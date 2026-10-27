import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { get_horoscope_predictions } from "../extensions/reviewed-reading/direct/assets/dev-v2/engine.mjs";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";
import { unsupportedEventTiming } from "../extensions/reviewed-reading/direct/event-timing.mjs";
import { evidenceFallback } from "../extensions/reviewed-reading/direct/evidence-fallback.mjs";
import { partnerFallback } from "../extensions/reviewed-reading/direct/partner-fallback.mjs";

const now = new Date("2026-10-25T12:00:00Z");
beforeEach((t) => t.mock.timers.enable({ apis: ["Date"], now }));
const query = "Meri shaadi kab hogi aur mera life partner kaisa hoga?";
const value = {
  user_id: "synthetic-coverage",
  user_gender: "male",
  query,
  language: "hinglish",
  history: [],
  birth: { date: "2001-01-03", time: "05:00", location_name: "Delhi" },
};
function source() {
  return JSON.parse(
    get_horoscope_predictions({
      birth_date: "3/1/2001",
      birth_time: "05:00",
      location_name: "Delhi",
    }).content[0].text,
  );
}

void test("dev fallback reports chart factors without injecting an additional partner description", () => {
  const row = source(),
    original = structuredClone(row);
  const reply = evidenceFallback([JSON.stringify(row)], "hinglish", query, now);
  assert.doesNotMatch(reply, /Saathi ke swabhav/);
  assert.match(reply, /sahyog bhi hai aur rukawatein bhi/);
  assert.match(reply, /2027-09-15.*2028-11-14/);
  assert.doesNotMatch(reply, /sharmati|sachchi|bindu|guaranteed/);
  assert.equal(reply.split("\n\n").length, 2);
  assert.deepEqual(row, original);
  assert.doesNotMatch(
    evidenceFallback([JSON.stringify(row)], "hinglish", "Shaadi kab hogi?", now),
    /Saathi ke swabhav/,
  );
});

void test("partner fallback rejects conflicting, transit and malformed charts", () => {
  const row = source();
  const changed = structuredClone(row);
  changed.birth_chart.utc_time = "different subject";
  assert.equal(partnerFallback([row, changed], "hinglish", query), "");
  for (const chart of [
    { ...row.birth_chart, label: "transit" },
    { ...row.birth_chart, planets: null },
    { ...row.birth_chart, planets: [...row.birth_chart.planets, ...row.birth_chart.planets] },
  ]) {
    assert.equal(partnerFallback([{ ...row, birth_chart: chart }], "hinglish", query), "");
  }
  assert.equal(partnerFallback([row], "hinglish", "Meri crush se shaadi hogi?"), "");
  assert.match(
    partnerFallback([row], "english", "What will my spouse be like?"),
    /shared comfort.*interpretive/,
  );
});

void test("ordinary qualified wording retains the exact supported period, never a changed or guaranteed date", () => {
  const row = source();
  row.evidence_scope = { timing: "does not calculate event-specific windows" };
  const data = [JSON.stringify(row)];
  for (const phrase of ["sambhavit hai", "sambhav hai", "ho sakti hai", "is possible"]) {
    const reply = `Shaadi September 2027 se November 2028 ${phrase}. Mars antardasha aur 7th house ki drishti iska reason hai.`;
    assert.equal(unsupportedEventTiming(reply, data), false, reply);
    assert.equal(unsupportedEventTiming(reply.replaceAll("2027", "2029"), data), true);
    assert.equal(unsupportedEventTiming(reply + " Shaadi pakki hai.", data), true);
  }
});

void test("abbreviated period dates preserve qualified timing but never admit changed boundaries", () => {
  const row = source();
  row.evidence_scope = { timing: "does not calculate event-specific windows" };
  const data = [JSON.stringify(row)];
  const prefix =
    "Jupiter aur Saturn 7ve ghar mein hain. Saathi ke swabhav mein ghar ka sukoon hai.\n\n";
  for (const window of [
    "15 Sept 2027 se 14 Nov 2028",
    "15 September 2027 se 14 November 2028",
    "Sept. 15, 2027 to Nov. 14, 2028",
    "Sep 2027 to Nov 2028",
  ]) {
    const reply =
      prefix + `Shaadi 2027 ke baad, Mars ki antardasha (${window}) mein sambhavit hai.`;
    assert.equal(unsupportedEventTiming(reply, data), false, reply);
  }
  for (const window of [
    "16 Sept 2027 se 14 Nov 2028",
    "15 Sept 2027 se 15 Nov 2028",
    "15 Oct 2027 se 14 Nov 2028",
    "15 Sept 2029 se 14 Nov 2030",
    "15 Sept 2027",
    "15 Sept 2027 se 2028-11-14",
  ]) {
    assert.equal(
      unsupportedEventTiming(prefix + `Mars antardasha ${window} mein shaadi sambhavit hai.`, data),
      true,
      window,
    );
  }
});

void test("a model-written corrected window reaches delivery with requested partner nature", async () => {
  const row = source();
  row.evidence_scope = { timing: "does not calculate event-specific windows" };
  const explanation =
    "Jupiter aur Saturn 7ve ghar mein hain, isliye sahyog aur rukawat dono hain. Saathi ke swabhav mein ghar ka sukoon hai.";
  let calls = 0;
  const result = await directAnswer(value, {
    now: () => now,
    env: {
      OPENROUTER_API_KEY: "test",
      VEDASTRO_DIRECT_FLOW: "source",
      VEDASTRO_DIRECT_ENVIRONMENT: "development",
      VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "0",
      VEDASTRO_DIRECT_REPLY_CACHE: "0",
    },
    makeMemory: () => ({ read: async () => [] }),
    makeTools: () => async () => JSON.stringify(row),
    fetchImpl: async () => {
      calls++;
      const message =
        calls === 1
          ? {
              tool_calls: [
                {
                  id: "natal",
                  type: "function",
                  function: {
                    name: "mcp__VedAstro__get_horoscope_predictions",
                    arguments: "{}",
                  },
                },
              ],
            }
          : {
              content:
                explanation +
                "\n\n" +
                (calls === 2
                  ? "Shaadi 2027 ke baad Mars antardasha mein possible hai."
                  : "Shaadi Jupiter antardasha (15 November 2031 se 16 July 2034) mein sambhavit hai."),
            };
      return new Response(
        JSON.stringify({
          choices: [{ finish_reason: message.tool_calls ? "tool_calls" : "stop", message }],
        }),
      );
    },
  });
  assert.equal(calls, 3);
  assert.match(result.reply, /Saathi ke swabhav/);
  assert.match(result.reply, /15 November 2031 se 16 July 2034.*sambhavit/);
  assert.doesNotMatch(result.reply, /schedule hai|event ki bhavishyavani nahi/);
});

void test("bounded dev-style correction retains chart evidence and fallback keeps coverage through formatting", async () => {
  const row = source();
  row.evidence_scope = { timing: "does not calculate event-specific windows" };
  const raw = JSON.stringify(row),
    rejected = "Shaadi 2029 mein pakki hogi.\n\n2029 mein shaadi hogi.";
  let calls = 0;
  const result = await directAnswer(value, {
    now: () => now,
    env: {
      OPENROUTER_API_KEY: "test",
      VEDASTRO_DIRECT_FLOW: "source",
      VEDASTRO_DIRECT_ENVIRONMENT: "development",
      VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "1",
      VEDASTRO_DIRECT_REPLY_CACHE: "0",
    },
    makeMemory: () => ({ read: async () => [] }),
    makeTools: () => async () => raw,
    fetchImpl: async (_, options) => {
      const body = JSON.parse(options.body);
      calls++;
      if (calls === 1) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "tool_calls",
                message: {
                  tool_calls: [
                    {
                      id: "natal",
                      type: "function",
                      function: {
                        name: "mcp__VedAstro__get_horoscope_predictions",
                        arguments: "{}",
                      },
                    },
                  ],
                },
              },
            ],
          }),
        );
      }
      if (calls === 3) {
        assert.equal(body.tool_choice, "auto");
        assert.ok(body.messages.some((m) => m.role === "tool" && m.content === raw));
        assert.match(
          body.messages.at(-1).content,
          /Preserve the useful supported topic explanation/,
        );
        assert.ok(!body.messages.some((m) => m.role === "assistant" && m.content === rejected));
      }
      const content = body.tools ? rejected : "Rishte mein aapke liye kya maayne rakhta hai?";
      return new Response(
        JSON.stringify({ choices: [{ finish_reason: "stop", message: { content } }] }),
      );
    },
  });
  assert.equal(calls, 4);
  assert.equal(result.reply.split("\n\n").length, 3);
  assert.doesNotMatch(result.reply, /Saathi ke swabhav/);
  assert.match(result.reply, /2027-09-15.*2028-11-14/);
  assert.doesNotMatch(result.reply, /2029|pakki/);
  assert.ok(result.reply.split(/\s+/u).length <= 100);
  assert.equal(JSON.stringify(row), raw);
});

void test("awkward companion phrases fall back without rewriting the reading or asking known feelings", async () => {
  const base = "Original astrology explanation.\n\nOriginal verdict.";
  for (const known of [false, true]) {
    const result = await contextualClosing(
      base,
      {
        ...value,
        query: "Meri crush se shaadi hogi?",
        history: known
          ? [{ role: "user", text: "Maine unse apni feelings share kar di hain." }]
          : [],
      },
      { generate: async () => "kya tumne usse apni baat kahin tak toh boli hai?" },
    );
    assert.ok(result.startsWith(base + "\n\n"));
    assert.doesNotMatch(result, /kahin tak toh/);
    assert.equal(result.split("\n\n").length, 3);
    assert.match(result, known ? /baatcheet kaisi/ : /feelings share ki hain/);
  }
  const natural = "Kya aapne unse apni feelings share ki hain?";
  const result = await contextualClosing(
    base,
    { ...value, query: "Meri crush se shaadi hogi?" },
    { generate: async () => natural },
  );
  assert.equal(result, base + "\n\n" + natural);
});

void test("dev reading stays model-written without a pilot-only partner coverage rewrite", async () => {
  const row = source();
  const draft =
    "Mars antardasha September 2027 se November 2028 tak hai.\n\nShaadi ke sanket mixed hain.";
  let calls = 0;
  const result = await directAnswer(value, {
    now: () => now,
    env: {
      OPENROUTER_API_KEY: "test",
      VEDASTRO_DIRECT_FLOW: "source",
      VEDASTRO_DIRECT_ENVIRONMENT: "development",
      VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "0",
      VEDASTRO_DIRECT_REPLY_CACHE: "0",
    },
    makeMemory: () => ({ read: async () => [] }),
    makeTools: () => async () => JSON.stringify(row),
    fetchImpl: async () => {
      calls++;
      const message =
        calls === 1
          ? {
              tool_calls: [
                {
                  id: "chart",
                  type: "function",
                  function: { name: "mcp__VedAstro__get_horoscope_predictions", arguments: "{}" },
                },
              ],
            }
          : { content: draft };
      return new Response(
        JSON.stringify({
          choices: [{ finish_reason: calls === 1 ? "tool_calls" : "stop", message }],
        }),
      );
    },
  });
  assert.equal(calls, 2);
  assert.ok(result.reply.startsWith(draft));
});

void test("companion cannot repeat the fixed backstory or replace AI identity with a human introduction", async () => {
  const base =
    "Mere Meera kirdaar ki kahani mein umar 25 saal hai. Main AstroFriend ki AI dost hoon.";
  const result = await contextualClosing(
    base,
    { ...value, query: "Apni backstory batao" },
    { generate: async () => "Main Meera hoon, Banaras ke ghaton par paida hui, tumhari dost." },
  );
  assert.equal(result, base);
});

void test("companion cannot add marriage reassurance or poetic advice to the checked reading", async () => {
  const base = "Original mixed astrology reading.\n\nOriginal timing verdict.";
  for (const generated of [
    "Tumhari shaadi ka waqt apne aap aayega, par sabse pehle yeh socho kya tumne kisi ko apne dil ki baat sunai hai?",
    "Tumhari crush ke liye dil kitna bhaavuk hai, yeh sabse zaroori baat hai... kya abhi tak tumne usse apni baat kahi hai?",
    "Your marriage time will come. Have you shared your feelings with your crush?",
  ]) {
    const reply = await contextualClosing(
      base,
      { ...value, query: "Meri crush se shaadi hogi?" },
      { generate: async () => generated },
    );
    assert.equal(reply, base + "\n\nKya aapne unse apni feelings share ki hain?");
  }
});

void test("adverse-only live timing is repaired with isolated checked IDs within existing call budget", async () => {
  const row = source();
  row.evidence_scope = { timing: "does not calculate event-specific windows" };
  let calls = 0;
  const result = await directAnswer(
    {
      ...value,
      query: "Meri shaadi kab hogi?",
      history: [{ role: "assistant", text: "February 2028 pakka." }],
    },
    {
      now: () => now,
      env: {
        OPENROUTER_API_KEY: "test",
        VEDASTRO_DIRECT_FLOW: "source",
        VEDASTRO_DIRECT_ENVIRONMENT: "development",
        VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "0",
        VEDASTRO_DIRECT_REPLY_CACHE: "0",
      },
      makeMemory: () => ({ read: async () => [] }),
      makeTools: () => async () => JSON.stringify(row),
      fetchImpl: async (url, options) => {
        calls++;
        const body = JSON.parse(options.body);
        let message;
        if (calls === 1)
          message = {
            tool_calls: [
              {
                id: "natal",
                type: "function",
                function: { name: "mcp__VedAstro__get_horoscope_predictions", arguments: "{}" },
              },
            ],
          };
        else if (calls === 2)
          message = {
            content:
              "Mars antardasha September 2027 se November 2028 mein shaadi sambhavna hai, Mars ki drishti 7ve ghar par hai.",
          };
        else {
          assert.equal(body.tool_choice.function.name, "submit_timing_reading");
          assert.doesNotMatch(JSON.stringify(body.messages), /February 2028 pakka/);
          message = {
            tool_calls: [
              {
                id: "repair",
                type: "function",
                function: {
                  name: "submit_timing_reading",
                  arguments: JSON.stringify({
                    period_id: "p2",
                    outlook: "mixed",
                    factor_ids: ["f0"],
                  }),
                },
              },
            ],
          };
        }
        return new Response(
          JSON.stringify({
            choices: [{ finish_reason: message.tool_calls ? "tool_calls" : "stop", message }],
          }),
        );
      },
    },
  );
  assert.equal(calls, 3);
  assert.match(result.reply, /November 2031.*July 2034/);
  assert.doesNotMatch(result.reply, /2027|2028/);
});
