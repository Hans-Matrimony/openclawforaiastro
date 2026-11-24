import test from "node:test";
import assert from "node:assert/strict";
import { repeatsClarification, conversationProgressEnabled } from "../extensions/reviewed-reading/direct/conversation-progress.mjs";
import { contextualClosing } from "../extensions/reviewed-reading/direct/contextual-closing.mjs";

test("pilot defaults off and requires exact account, not suffix or wildcard", () => {
  const env={ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:"1",ASTROFRIEND_CONVERSATION_PROGRESS_USERS:"919000000001"};
  assert.equal(conversationProgressEnabled(env,"+919000000001"),true);
  for(const user of ["919000000002","0001","other:919000000001",undefined]) assert.equal(conversationProgressEnabled(env,user),false);
  assert.equal(conversationProgressEnabled({...env,ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:"0"},"919000000001"),false);
  assert.equal(conversationProgressEnabled({...env,ASTROFRIEND_CONVERSATION_PROGRESS_USERS:"*"},"919000000001"),false);
});

test("optional statement and dialogue context are pilot only", async () => {
  const value={query:"career?",language:"english",history:[{role:"assistant",text:"Which city are you considering?"}]};
  for(const progressPilot of [false,true]) {
    const result=await contextualClosing("Original answer.",value,{progressPilot,generate:async(_,data)=>{
      const payload=JSON.parse(data);
      assert.equal(Boolean(payload.recent_dialogue_context_not_evidence),progressPilot);
      assert.equal(Boolean(payload.current_answer),progressPilot);
      return "We can compare the options together.";
    }});
    assert.equal(result.includes("We can compare the options together."),progressPilot);
  }
});
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";

test("clarification repetition is language and topic independent", () => {
  for (const text of ["Koi specific jagah soch rahe ho?", "Which option do you prefer?", "आप कौन सा शहर सोच रहे हैं?"]) {
    assert.equal(repeatsClarification(text, [{role: "assistant", text}]), true);
    assert.equal(repeatsClarification(text, [{role: "user", text}]), false);
  }
  assert.equal(repeatsClarification("What is your budget?", [{role:"assistant", text:"Which city do you prefer?"}]), false);
});

test("agent repairs a repeated clarification with the ordered dialogue preserved", async () => {
  const question = "Koi specific jagah soch rahe ho?";
  const history = [{role:"user", text:"Ghar kaha kharidna chahiye?"}, {role:"assistant", text:question}];
  let calls = 0;
  const result = await directAnswer({user_id:"+919000000001", query:"Tum batao naa", history, birth:{}, language:"hinglish"}, {
    env:{ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:"1",ASTROFRIEND_CONVERSATION_PROGRESS_USERS:"919000000001",OPENROUTER_API_KEY:"test", VEDASTRO_DIRECT_REPLY_CACHE:"0"},
    makeMemory:()=>({read:async()=>[]}), makeTools:()=>async()=>{throw Error("unexpected tool");},
    fetchImpl:async (_url, options)=>{
      const body = JSON.parse(options.body);
      assert.ok(body.messages.some(turn=>turn.role==="assistant" && turn.content===question));
      calls++;
      return new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:calls===1?question:"Rehne ke liye ghar le rahe hain toh kaam ke paas aur budget mein aane wali jagah se shuru kijiye."}}]}));
    },
  });
  assert.equal(calls, 2);
  assert.doesNotMatch(result.reply, /specific jagah/);
});
