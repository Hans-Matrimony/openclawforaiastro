import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { isEmotionalFriendship, friendshipListeningOnly, friendshipAdviceRequested, emotionalFriendshipPrompt, emotionalReplyIssue, emotionalReplyFallback } from "../extensions/reviewed-reading/direct/emotional-friendship.mjs";
import { friendshipNoName } from "../extensions/reviewed-reading/direct/friendship-intent.mjs";
import { CHART_TOOL_NAMES, bareToolName } from "../extensions/reviewed-reading/direct/reading-intent.mjs";

const cases = JSON.parse(fs.readFileSync(new URL("./fixtures/friendship_live_regressions.json", import.meta.url)));
test("all 15 disclosed live cases stay on friendship, with no chart tools or second companion", async () => {
  const history = [];
  for (const scenario of cases) {
    assert.equal(isEmotionalFriendship(scenario.question, history), true, scenario.id);
    let calls = 0;
    const reply = scenario.id === "breakup-hinglish" ? "Rishta khatam hone ke baad kya kehna hai, is par aaram se baat kar sakte hain." : "Aap apni baat aaram se keh sakte hain. Hum is par bina jaldi kiye baat kar sakte hain.";
    const value = {user_id:"test:friendship-fixtures",query:scenario.question,history:[...history],language:"hinglish",birth:{},user_gender:"male",user_name:"Example User"};
    const result = await directAnswer(value, {
      env:{OPENROUTER_API_KEY:"test-only",VEDASTRO_DIRECT_REPLY_CACHE:"0",VEDASTRO_DIRECT_FLOW:"source",VEDASTRO_DIRECT_ENVIRONMENT:"development",VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:"1"},
      makeMemory:()=>({read:async()=>[]}),
      makeTools:()=>async()=>assert.fail("Friendship must not execute tools: "+scenario.id),
      fetchImpl:async(_url, options)=>{
        calls++;
        const body=JSON.parse(options.body);
        assert.match(body.messages[0].content,/Emotional conversation/);
        assert.ok(body.tools.every(t=>!CHART_TOOL_NAMES.has(bareToolName(t.function.name))),scenario.id);
        assert.equal(body.messages.at(-1).content,scenario.question);
        return new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:reply}}],usage:{cost:0}}));
      },
    });
    assert.equal(calls,1,scenario.id);
    assert.deepEqual(result.answer_reading_tools,[],scenario.id);
    assert.equal(result.reply,reply,scenario.id);
    history.push({role:"user",text:scenario.question},{role:"assistant",text:reply});
  }
});

test("explicit astrology and safety requests retain existing handling", () => {
  for (const q of ["Meri girlfriend ne relationship khatam kar diya, kundli dekho", "My job rejected me, when will I get a job?", "I feel ignored, analyze my chart", "मेरी नानी का निधन हुआ, मेरी कुंडली देखिए", "I feel sad and unsafe", "I am upset and want to kill myself", "I am sad, should I change my medicine?", "I feel upset, suggest an astrology remedy", "Meri shaadi kab hogi?"]) {
    assert.equal(isEmotionalFriendship(q),false,q);
  }
  assert.equal(isEmotionalFriendship("ab kya karu?",[{role:"user",text:"What does my chart say?"}]),false);
  assert.equal(isEmotionalFriendship("What is rejection?"),false);
});

test("rejecting one suggestion is not a blanket refusal of advice", () => {
  const query="Maine likhkar dekh liya, usse help nahi hui. Wahi advice dobara mat dena.";
  assert.equal(friendshipListeningOnly(query),false);
  assert.equal(friendshipAdviceRequested(query),true);
  assert.equal(friendshipListeningOnly(query+" Bas suno."),true);
});

test("no-name preference persists in friendship until the user changes it", () => {
  const value={query:"Achhi khabar: aaj meri tareef hui!",user_name:"Example User",history:[{role:"user",text:"Please mera naam mat use karna."}]};
  assert.equal(friendshipNoName(value),true);
  const prompt=emotionalFriendshipPrompt(value,{});
  assert.doesNotMatch(prompt,/Example User/);
  assert.match(emotionalReplyIssue("Example User, congratulations on your good news!",value),/requested no name/);
  assert.equal(friendshipNoName({...value,query:"You can use my name again."}),false);
  assert.equal(friendshipNoName({...value,history:[{role:"assistant",text:"Don't use my name"}]}),false);
});

test("fallbacks address boundaries and rejected advice without invented biography", () => {
  const boundary = cases.find(c=>c.id==="boundaries").question;
  for (const language of ["en","hindi","hinglish"]) {
    const reply=emotionalReplyFallback({query:boundary,language});
    assert.doesNotMatch(reply,/write down|likh lein|लिख लें/);
    assert.match(reply,/time|waqt|समय/);
    const rejected=emotionalReplyFallback({query:"Your advice did not help, don't repeat it.",language});
    assert.doesNotMatch(rejected,/write down|likh lein|लिख लें|no advice right now/);
  }
});
