import assert from "node:assert/strict";
import test from "node:test";
import { unsupportedClosingDetail } from "../extensions/reviewed-reading/direct/companion-context.mjs";
import { unsupportedPeriodClaim } from "../extensions/reviewed-reading/direct/period-evidence.mjs";
import { isOrdinaryConcern } from "../extensions/reviewed-reading/direct/reading-intent.mjs";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";

void test('a checked antardasha within the active mahadasha cannot be placed after it',()=>{
  const evidence=[JSON.stringify({dasha:{current_mahadasha:{lord:'Venus',from:'2021-09-15',to:'2041-09-15'},upcoming_antardashas:[{lord:'Jupiter',from:'2031-11-15',to:'2034-07-16'}]}})];
  for(const text of ['Venus mahadasha ke baad Jupiter antardasha November 2031 se July 2034 tak chalega.',
    'After Venus mahadasha, Jupiter antardasha runs from November 2031 to July 2034.'])
    assert.equal(unsupportedPeriodClaim(text,evidence),true,text);
  assert.equal(unsupportedPeriodClaim('Venus mahadasha mein Jupiter antardasha November 2031 se July 2034 tak hai.',evidence),false);
  assert.equal(unsupportedPeriodClaim('After Moon mahadasha, Jupiter antardasha starts.',evidence),false,'do not infer an absent major-period boundary');
});

void test('a repeated cross-level timing error falls back without changing the checked window or recalculating',async()=>{
  const evidence={engine:'local-sweph-v2',birth_chart:{planets:['Jupiter: Taurus | house 7','Saturn: Taurus | house 7']},
    dasha:{current_mahadasha:{lord:'Venus',from:'2021-09-15',to:'2041-09-15'},upcoming_antardashas:[{lord:'Jupiter',from:'2031-11-15',to:'2034-07-16'}]},
    verdict_signals:[{area:'marriage',positive:['benefic Jupiter house 7 mein'],negative:['Saturn house 7 par delay']}]};
  let calls=0,calculations=0;
  const result=await directAnswer({user_id:'synthetic-period-level',query:'Meri shaadi kab hogi?',language:'hinglish',birth:{date:'2001-01-03',time:'05:00',location_name:'Delhi'},history:[]},{
    env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'},
    now:()=>new Date('2026-11-04T00:00:00Z'),makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{calculations++;return JSON.stringify(evidence);},
    fetchImpl:async()=>{calls++;const message=calls===1?{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}:
      {content:'Venus mahadasha ke baad Jupiter antardasha November 2031 se July 2034 tak chalega.\n\nShaadi ki sambhavna November 2031 se July 2034 ke beech hai.'};
      return new Response(JSON.stringify({choices:[{finish_reason:calls===1?'tool_calls':'stop',message}]}));},
  });
  assert.ok(calls<=7);assert.equal(calculations,1);assert.doesNotMatch(result.reply,/mahadasha ke baad Jupiter/);
  assert.match(result.reply,/2031/);assert.match(result.reply,/2034/);assert.ok(result.answer_validation.includes('timing_claim_rejected'));
});

void test("upcoming source antardashas are accepted without confusing next mahadasha", () => {
  const evidence = [
    JSON.stringify({
      dasha: {
        current_antardasha: { lord: "Moon", from: "2025-01-01" },
        upcoming_antardashas: [{ lord: "Mars", from: "2027-06-01", to: "2028-08-01" }],
        next_mahadasha: { lord: "Sun", from: "2038-01-01" },
      },
    }),
  ];
  assert.equal(unsupportedPeriodClaim("Mars antardasha starts in 2027.", evidence), false);
  assert.equal(unsupportedPeriodClaim("Mars antardasha starts in 2026.", evidence), true);
  assert.equal(unsupportedPeriodClaim("Sun antardasha starts in 2038.", evidence), true);
});

void test("explicit period start years must match the supplied schedule", () => {
  const evidence = [
    JSON.stringify({ dasha: { antardashas: [{ lord: "Jupiter", from: "2031-11-15" }] } }),
  ];
  assert.equal(
    unsupportedPeriodClaim("2027 mein Jupiter ki antardasha shuru hogi.", evidence),
    true,
  );
  assert.equal(
    unsupportedPeriodClaim("2031 mein Jupiter ki antardasha shuru hogi.", evidence),
    false,
  );
});

void test("fee sharing is ordinary conversation while timing requests remain readings", () => {
  assert.equal(
    isOrdinaryConcern(
      "Main night shift mein kaam karta hoon aur MBA ki fees ko lekar pareshan hoon.",
    ),
    true,
  );
  assert.equal(isOrdinaryConcern("Abhi sabse zyada fees ki tension hai, time ki nahi."), true);
  assert.equal(isOrdinaryConcern("Fees ki tension kab kam hogi?"), false);
  assert.equal(isOrdinaryConcern("Kundli se batao meri tension kab kam hogi"), false);
});

void test("parent disagreement is not evidence of fear", () => {
  const value = {
    query: "Meri shaadi kab hogi?",
    history: [{ role: "user", text: "Papa agree nahi karte" }],
  };
  assert.equal(
    unsupportedClosingDetail("Papa se baat karne mein darr lag raha hai?", value, []),
    true,
  );
  assert.equal(
    unsupportedClosingDetail(
      "Papa se baat karne mein darr lag raha hai?",
      { ...value, query: "Mujhe papa se darr lagta hai" },
      [],
    ),
    false,
  );
});

void test("future period names require actual antardasha evidence, not a mahadasha name", () => {
  const evidence = [
    JSON.stringify({
      dasha: { current_mahadasha: { lord: "Venus" }, current_antardasha: { lord: "Moon" } },
    }),
  ];
  assert.equal(
    unsupportedPeriodClaim("2027 ke baad Jupiter ki antardasha shuru hogi.", evidence),
    true,
  );
  assert.equal(unsupportedPeriodClaim("Venus ki antardasha shuru hogi.", evidence), true);
  assert.equal(unsupportedPeriodClaim("Moon antardasha starts now.", evidence), false);
  assert.equal(unsupportedPeriodClaim("Jupiter supports work.", evidence), false);
  assert.equal(
    unsupportedPeriodClaim("Jupiter ki antardasha shuru hogi.", [
      JSON.stringify({ dasha: { antardashas: [{ lord: "Jupiter" }] } }),
    ]),
    false,
  );
});

void test("month-specific period starts require the matching month", () => {
  const evidence = [
    JSON.stringify({ dasha: { upcoming_antardashas: [{ lord: "Mars", from: "2027-09-15" }] } }),
  ];
  assert.equal(unsupportedPeriodClaim("Mars antardasha starts in March 2027.", evidence), true);
  assert.equal(
    unsupportedPeriodClaim("Mars antardasha starts in September 2027.", evidence),
    false,
  );
  assert.equal(
    unsupportedPeriodClaim("March 2027 mein Mars antardasha shuru hogi.", evidence),
    true,
  );
  assert.equal(
    unsupportedPeriodClaim(
      "After Mars antardasha starts, finances improve in March 2028.",
      evidence,
    ),
    false,
  );
});

void test("companion does not invent parental waiting from a marriage question", () => {
  const value = { query: "Meri shaadi kab hogi?", history: [] };
  assert.equal(
    unsupportedClosingDetail(
      "Papa ki baat ka intezaar kar rahe ho, kya kisi se baat ki?",
      value,
      [],
    ),
    true,
  );
  assert.equal(unsupportedClosingDetail("Kya papa se is baare mein baat hui?", value, []), false);
  assert.equal(
    unsupportedClosingDetail(
      "Papa ki baat ka intezaar kar rahe ho?",
      { ...value, history: [{ role: "user", text: "Papa ke jawab ka intezaar hai" }] },
      [],
    ),
    false,
  );
});

void test("a period cannot start after a year later than its actual start", () => {
  const evidence = [
    JSON.stringify({ dasha: { upcoming_antardashas: [{ lord: "Mars", from: "2027-09-15" }] } }),
  ];
  assert.equal(unsupportedPeriodClaim("2028 ke baad Mars antardasha shuru hoga.", evidence), true);
  assert.equal(unsupportedPeriodClaim("2027 ke baad Mars antardasha shuru hoga.", evidence), false);
});

void test("friendship cannot claim chart-derived strengths as user facts", () => {
  assert.equal(
    unsupportedClosingDetail(
      "Tere strengths tech aur communication se jude hain. Koi project try kiya?",
      { query: "Career ke baare mein batao", history: [] },
      [],
    ),
    true,
  );
  assert.equal(
    unsupportedClosingDetail(
      "Tech ya design mein kis cheez mein interest hai?",
      { query: "Career ke baare mein batao", history: [] },
      [],
    ),
    false,
  );
});
