import assert from "node:assert/strict";
import test from "node:test";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { isPracticalFollowup, isPersonalChartQuestion, CHART_TOOL_NAMES, bareToolName } from "../extensions/reviewed-reading/direct/reading-intent.mjs";
import { unsupportedEventTiming } from "../extensions/reviewed-reading/direct/event-timing.mjs";

const query = "Is career reading ke hisaab se abhi mujhe kya practical kadam lena chahiye?";
test("practical intent preserves explicit chart and timing requests", () => {
  assert.equal(isPracticalFollowup(query), true);
  assert.equal(isPersonalChartQuestion(query), false);
  for (const text of ["Meri job kab lagegi?", "Meri kundli ke hisaab se practical steps batao", "When will my job change and what practical steps should I take?"]) {
    assert.equal(isPracticalFollowup(text), false);
    assert.equal(isPersonalChartQuestion(text), true);
  }
  assert.equal(isPracticalFollowup("Mere career aur job change ke liye kaisa time chal raha hai?"), false);
});
test("observed negative career timing cannot hide behind a period schedule", () => {
  const tools = [JSON.stringify({evidence_scope:{timing:"does not calculate event-specific windows"}})];
  for (const reply of ["Career mein 2027 ke baad, tab tak kuch solid move nahi hoga.", "Mars antardasha 2027 ke baad aayega tab tak skill build karo, job change nahi."]) {
    assert.equal(unsupportedEventTiming(reply, tools, query), true);
  }
  assert.equal(unsupportedEventTiming("Apne target role ke liye skills build kijiye.", tools, query), false);
});
for (const persistent of [false, true]) {
  test(`practical follow-up corrects copied forecast within budget, persistent=${persistent}`, async () => {
    let calls=0;
    const result=await directAnswer({
      user_id:"synthetic-practical",query,language:"hinglish",
      birth:{date:"2001-01-03",time:"05:00",location_name:"Delhi"},
      history:[{role:"user",text:"Mujhe design roles pasand hain."},{role:"assistant",text:"OLD_FORECAST 2027 ke baad job change."}],
    },{
      env:{OPENROUTER_API_KEY:"test",VEDASTRO_DIRECT_FLOW:"source",VEDASTRO_DIRECT_ENVIRONMENT:"development",VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:"0"},
      makeMemory:()=>({read:async()=>[]}),
      makeTools:()=>async()=>{throw new Error("Unexpected chart tool");},
      fetchImpl:async(_,options)=>{
        calls++;
        const body=JSON.parse(options.body);
        assert.ok(body.messages.some(m=>m.content==="Mujhe design roles pasand hain."));
        assert.ok(!body.messages.some(m=>m.content?.includes("OLD_FORECAST")));
        assert.ok(body.tools.every(t=>!CHART_TOOL_NAMES.has(bareToolName(t.function.name))));
        return new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{role:"assistant",content:calls===1||persistent?"2027 ke baad job change nahi.":"Apne portfolio mein relevant design projects saaf dikhaiye."}}]}));
      },
    });
    assert.equal(calls,2);
    assert.doesNotMatch(result.reply,/2027|job change nahi/);
    assert.match(result.reply,persistent?/CV/:/portfolio/);
  });
}
