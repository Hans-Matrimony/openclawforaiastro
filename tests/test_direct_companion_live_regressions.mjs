import test from "node:test";
import assert from "node:assert/strict";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";

const reading = "Unchanged astrology explanation.\n\nUnchanged astrology verdict.";
const user = (text) => ({ role: "user", text });

void test("career and finance replace stock priority questions with concrete invitations", async () => {
  for (const query of [
    "Mere career ke liye kaunsi fields achhi rahengi?",
    "Meri financial condition kab behtar hogi?",
  ]) {
    const generated = "Kaam ko lekar aapke liye abhi sabse zaroori kya hai?";
    const closing = await check(query, [], generated);
    assert.doesNotMatch(closing, /sabse zaroori|sabse zyada/i);
    assert.match(closing, /skill|aamdani/i);
    const next = await check(
      query,
      [{ role: "assistant", text: reading + "\n\n" + closing }],
      generated,
    );
    assert.notEqual(next, closing);
    assert.doesNotMatch(next, /sabse zaroori|sabse zyada/i);
  }
});

void test("friendly closings cannot invent a person, career preference or recurring feeling", async () => {
  for (const [query, generated] of [
    [
      "Meri girlfriend kab banegi?",
      "Tumhare dil mein koi specific insaan hai, uske saath kya soch rahe ho?",
    ],
    [
      "Meri job kab lagegi?",
      "Pata hai ki koi specific field soch rahe ho, usmein kya confidence hai?",
    ],
    [
      "Meri education ke baare mein batao",
      "Kuch missing feel hota hai, kya aaj bhi wohi feeling hai?",
    ],
  ]) {
    assert.notEqual(await check(query, [], generated), generated);
  }
});

void test("marriage follow-up rejects invented fear and an invented specific person", async () => {
  for (const generated of [
    "Aapko kisi ek insaan ke baare mein sochne ka man karta hai, aur main samajh rahi hoon ki usse baat karne ka dar bhi hai... kya aapne kabhi usse apni baat kahi hai?",
    "Usse apni baat kehne ka mauka mila?",
    "Aapke dil mein darr hai. Kya baat karna mushkil hai?",
  ]) {
    const closing = await check("Meri shaadi kab hogi?", [], generated);
    assert.doesNotMatch(closing, /dar|darr|usse|kisi ek insaan/i);
  }
});

void test("unsupported previous companion assumptions are excluded from writer context", async () => {
  const prior = "Usse baat karne ka dar hai. Kya aapne apni baat kahi?";
  let captured;
  await contextualClosing(
    reading,
    {
      query: "Meri shaadi kab hogi?",
      language: "hinglish",
      history: [
        user("Meri shaadi kab hogi?"),
        { role: "assistant", text: reading + "\n\n" + prior },
      ],
    },
    {
      generate: async (_prompt, payload) => {
        captured = JSON.parse(payload);
        return "Shaadi ko lekar aapki apni kya soch hai?";
      },
    },
  );
  assert.ok(captured);
  assert.ok(!captured.history.some((turn) => turn.text === prior));
});

void test("neutral questions and actual user disclosures remain available", async () => {
  const neutral = "Shaadi ko lekar aapki apni kya soch hai?";
  assert.equal(await check("Meri shaadi kab hogi?", [], neutral), neutral);
  const { unsupportedClosingDetail } =
    await import("../extensions/reviewed-reading/direct/companion-context.mjs");
  const detail = "Usse baat karne ka dar hai. Kis baat ka dar hai?";
  assert.equal(
    unsupportedClosingDetail(
      detail,
      {
        query: "Meri shaadi kab hogi?",
        history: [user("Meri crush hai, usse baat karne ka dar hai")],
      },
      [],
    ),
    false,
  );
  assert.equal(
    unsupportedClosingDetail(
      detail,
      {
        query: "Meri shaadi kab hogi?",
        history: [],
      },
      ["Meri crush hai, usse baat karne ka dar hai"],
    ),
    false,
  );
});

void test("exhausted fee questions retain the known concern instead of restarting broadly", async () => {
  const closing = await check(
    "Ghar se financial help nahi mil sakti.",
    [
      user("Agle hafte fees bharni hai"),
      {
        role: "assistant",
        text:
          reading +
          "\n\nFees wali baat mein ab kis tarah ka saath chahiye, baat karna ya milkar options sochna?",
      },
    ],
    new Error("writer unavailable"),
  );
  assert.match(closing, /fees.*deadline/i);
  assert.doesNotMatch(closing, /sabse zaroori|payment kareeb|kab/i);
});

void test("job closing cannot smuggle in unrelated family context", async () => {
  const closing = await check(
    "MBA filhaal chhod diya hai, pehle job chahiye.",
    [user("Mummy maan gayi, papa ka darr hai")],
    "Mummy maan gayi, papa ka darr hai. Kis type ki job chahiye?",
  );
  assert.doesNotMatch(closing, /mummy|papa/i);
});

void test("listening preference also replaces stock social text ending in a question", async () => {
  const reply =
    "Main sun rahi hoon.\nMain sun rahi hoon.\n\nInterview clear hua. Kya ab halka lagta hai?";
  const result = await contextualClosing(
    reply,
    { query: "Abhi advice nahi chahiye, bas baat karni hai.", language: "hinglish", history: [] },
    {},
  );
  assert.doesNotMatch(result, /sun rahi|interview|\?/i);
  assert.match(result, /koi advice nahi/);
});

void test("changing the acknowledgment cannot repeat the previous question", async () => {
  const question = "kya koi part time option ya kisi se baat ki hai jisse thoda time mil sake?";
  const closing = await check(
    "Ghar se financial help nahi mil sakti.",
    [
      user("Agle hafte fees bharni hai"),
      { role: "assistant", text: reading + "\n\nFees ka pressure hai, aur " + question },
    ],
    "Fees heavy hain aur ghar se help nahi mil rahi… " + question,
  );
  assert.ok(!closing.includes(question));
  assert.match(closing, /fees/i);
});

void test("one parent's agreement does not resolve the other parent's objection", async () => {
  const { companionConcern } =
    await import("../extensions/reviewed-reading/direct/companion-concern.mjs");
  assert.equal(
    companionConcern({ query: "Mummy ab maan gaye, papa mana kar denge.", history: [] })?.kind,
    "family",
  );
});

void test("saved fee deadline is also respected when recent history is empty", async () => {
  const reply = await contextualClosing(
    reading,
    {
      query: "My finances are worrying me",
      language: "english",
      history: [],
    },
    {
      facts: ["Next week my fees are due"],
      generate: async () => "Is a fees payment coming up?",
    },
  );
  assert.ok(reply.startsWith(reading + "\n\n"));
  assert.doesNotMatch(reply.slice(reading.length), /coming up|when.*due/i);
  assert.match(reply.slice(reading.length), /fees/i);
});
async function check(query, history, generated) {
  const result = await contextualClosing(
    reading,
    { query, history, language: "hinglish" },
    {
      generate: async () => {
        if (generated instanceof Error) {
          throw generated;
        }
        return generated;
      },
    },
  );
  assert.ok(result.startsWith(reading + "\n\n"));
  assert.equal(result.split("\n\n").length, 3);
  return result.split("\n\n")[2];
}

void test("live listening wording and celebration bypass generic job memory closings", async () => {
  for (const query of [
    "Abhi advice nahi chahiye, bas baat karni hai.",
    "Aaj ek interview ka first round clear ho gaya!",
  ]) {
    let calls = 0;
    const reply = await contextualClosing(
      reading,
      {
        query,
        language: "hinglish",
        history: [user("Software developer banna hai")],
      },
      {
        generate: async () => {
          calls++;
          return "Aajkal zindagi mein kya chal raha hai?";
        },
      },
    );
    assert.equal(calls, 0);
    assert.ok(reply.startsWith(reading + "\n\n"));
    const closing = reply.slice(reading.length);
    assert.doesNotMatch(closing, /sun rahi|yahan|job|field|\?/i);
    assert.match(closing, query.includes("advice") ? /koi advice nahi/ : /achhi khabar/);
  }
});

void test("fees deadline before the noun is retained on rejected output and provider failure", async () => {
  for (const generated of [
    "Fees ka pressure hai. Abhi koi payment kareeb hai?",
    new Error("provider unavailable"),
  ]) {
    const closing = await check(
      "Ghar se financial help nahi mil sakti.",
      [user("Paise ki dikkat hai, agle hafte fees bharni hai.")],
      generated,
    );
    assert.doesNotMatch(closing, /kareeb|kab|coming up/i);
    assert.match(closing, /fees/i);
  }
});

void test("father refusing is an answered concern, not a new reaction question", async () => {
  for (const generated of [
    "Papa ke gusse ka darr kya hai, woh kahenge ya chup rehenge?",
    new Error("provider unavailable"),
  ]) {
    const closing = await check(
      "Papa mana kar denge, isi baat ki tension hai.",
      [user("Mummy maan gayi hain, papa ke gusse se darr lagta hai")],
      generated,
    );
    assert.match(closing, /mana karne/);
    assert.doesNotMatch(closing, /kis reaction|kahenge|chup rehenge/);
  }
});

void test("filhaal stopped MBA does not reopen the study decision", async () => {
  const closing = await check(
    "Education ke baare mein batao. MBA filhaal chhod diya hai, pehle job chahiye.",
    [],
    "MBA ko lekar abhi aapke mann mein sabse badi uljhan kya hai?",
  );
  assert.doesNotMatch(closing, /MBA|uljhan/);
  assert.match(closing, /job|kaam/i);
});

void test("failed interview is not celebrated", async () => {
  const closing = await check(
    "Interview clear nahi hua.",
    [],
    "Interview ke baad ab kaisa lag raha hai?",
  );
  assert.doesNotMatch(closing, /achhi khabar|khushi/);
});

void test("duplicated social presence text is replaced only for explicit listening", async () => {
  const value = {
    query: "Abhi advice nahi chahiye, bas baat karni hai.",
    language: "hinglish",
    history: [],
  };
  const repeated = "Tension bahut hai, main sun rahi hoon.\nTension bahut hai, main sun rahi hoon.";
  const result = await contextualClosing(repeated, value, {
    generate: () => assert.fail("No paid call needed"),
  });
  assert.equal(result, "Theek hai, abhi koi advice nahi. Aaram se apni baat keh sakte ho.");
  const chart = "Saturn aur Moon ki dasha hai, main sun rahi hoon.\n\n2027 ke baad.";
  assert.ok((await contextualClosing(chart, value, {})).startsWith(chart + "\n\n"));
});

void test("future and hypothetical results are never celebrations", async () => {
  const { celebration } =
    await import("../extensions/reviewed-reading/direct/companion-continuity.mjs");
  for (const query of [
    "Mera interview kab clear hoga?",
    "If I passed the exam, would I get a job?",
    "Interview clear nahi hua.",
    "Interview clear karna hai",
  ]) {
    assert.equal(celebration(query), false);
  }
});
