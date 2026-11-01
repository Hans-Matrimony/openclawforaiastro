import assert from "node:assert/strict";
import test from "node:test";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { emotionalFriendshipPrompt, emotionalReplyIssue, friendshipListeningOnly, isEmotionalFriendship } from "../extensions/reviewed-reading/direct/emotional-friendship.mjs";
import { CHART_TOOL_NAMES, bareToolName } from "../extensions/reviewed-reading/direct/reading-intent.mjs";

void test("emotional chat gets warmth without capturing astrology or safety requests", () => {
  for (const query of [
    "I feel lonely. Can we talk?", "Main bahut udaas hoon", "Mera breakup ho gaya, rona aa raha hai",
    "Main stressed hoon, kya karu?", "आज मन उदास है", "I feel upset, please just listen, no advice",
    "I am grieving and need someone to listen", "I am not sad, but I feel lonely",
    "meri Gf chli gayi Mujhe Chhor Kr", "Meri girlfriend chali gayi", "My partner left me",
    "meri Gf chli gayi Mujhe Chhor Kr?", "I feel sad?",
  ]) assert.equal(isEmotionalFriendship(query), true, query);
  for (const query of [
    "Meri shaadi kab hogi?", "I am worried, when will I get a job?",
    "Feeling lonely, meri kundli dekho", "Mere career ke baare mein batao",
    "I am upset, suggest an astrology remedy", "I am sad and suicidal",
    "I feel unsafe", "What is my dasha?", "Hello", "Mera upay batao",
    "I feel upset, can you suggest remedies?", "Feeling sad, explain my transits",
    "I am sad and need medical advice", "Main pareshan hoon aur marna chahta hoon",
    "What is loneliness?", "Why do people cry?", "Define sad",
    "मन उदास है, मेरी कुण्डली देखो", "Mujhe tension hai, meri kundali dekho",
    "I am not sad anymore", "I am no longer feeling lonely", "Main udaas nahi hoon",
    "मैं उदास नहीं हूँ", "I passed my exam!", "My friend needs a horoscope, I feel upset",
    "My girlfriend has not left me", "Meri gf chali gayi, kundli dekho",
    "Meri gf chali gayi, kab wapas aayegi?",
    "Meri girlfriend chali gayi, will she return?",
  ]) assert.equal(isEmotionalFriendship(query), false, query);
});

void test("short continuations use only the last user topic, never assistant assumptions", () => {
  const emotion = { role: "user", text: "I feel lonely" };
  const astrology = { role: "user", text: "Meri shaadi kab hogi?" };
  assert.equal(isEmotionalFriendship("haan", [emotion]), true);
  assert.equal(isEmotionalFriendship("bas suno", [emotion]), true);
  assert.equal(isEmotionalFriendship("yes", [emotion, astrology]), false);
  assert.equal(isEmotionalFriendship("yes", [{ role: "assistant", text: "You feel lonely" }]), false);
  assert.equal(isEmotionalFriendship("yes"), false);
  assert.equal(isEmotionalFriendship("Meri shaadi kab hogi?", [emotion]), false);
  assert.equal(isEmotionalFriendship("I am fine now", [emotion]), false);
});

void test("friendship listening preferences include Hindi and do not suppress advice requests", () => {
  for (const query of ["बस सुनो", "सलाह मत देना", "सवाल मत पूछना", "bas suno", "no advice"])
    assert.equal(friendshipListeningOnly(query), true, query);
  for (const query of ["What should I do?", "Mujhe advice do", "मुझे सलाह दीजिए"])
    assert.equal(friendshipListeningOnly(query), false, query);
});

void test("emotional reply preserves conversation and instructs comfort before advice", async () => {
  for (const sourceFlow of [false, true]) {
  const acknowledgement = "It hurts when someone dismisses what you shared. You do not have to rush into fixing this tonight.";
  const previous = "You said you felt ignored after talking to your friend.";
  let calls = 0;
  const result = await directAnswer({
    user_id: "test:emotional", query: "I feel upset. Can we talk about it?", language: "en",
    birth: {}, history: [{ role: "user", text: "I told my friend I was hurt." }, { role: "assistant", text: previous }],
  }, {
    env: { OPENROUTER_API_KEY: "test-only", VEDASTRO_DIRECT_REPLY_CACHE: "0",
      ...(sourceFlow ? { VEDASTRO_DIRECT_FLOW: "source", VEDASTRO_DIRECT_ENVIRONMENT: "development" } : {}) },
    makeMemory: () => ({ read: async () => [] }),
    makeTools: () => async () => assert.fail("No chart execution for emotional chat"),
    fetchImpl: async (_url, options) => {
      calls++;
      const body = JSON.parse(options.body);
      assert.match(body.messages[0].content, /Before any answer or advice, acknowledge/);
      assert.match(body.messages[0].content, /no advice/);
      assert.ok(body.messages[0].content.includes(previous));
      assert.ok(!body.messages.some(message => message.role === "assistant"));
      assert.ok(body.tools.every(tool => !CHART_TOOL_NAMES.has(bareToolName(tool.function.name))));
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: acknowledgement } }], usage: { cost: 0 } }));
    },
  });
  assert.equal(calls, 1);
  assert.ok(result.reply.startsWith(acknowledgement));
  assert.deepEqual(result.answer_reading_tools, []);
  }
});

void test("emotional disclosures and listening requests do not add a duplicate companion", async () => {
  for (const query of [
    "I feel upset, just listen, no advice and no questions",
    "Main udaas hoon, sawal mat puchna",
    "आज मन उदास है, बस सुनो, सलाह मत देना",
    "meri Gf chli gayi Mujhe Chhor Kr",
    "meri Gf chli gayi Mujhe Chhor Kr?",
  ]) {
    let calls = 0;
    const reply = query.includes("Gf")
      ? "Your girlfriend leaving is a big change. You can talk about what happened at your own pace."
      : "You felt ignored after sharing something important. That can hurt, and you do not have to explain it all right now.";
    const result = await directAnswer({
      user_id: "test:listening", query, language: "en", birth: {}, history: [],
    }, {
      env: { OPENROUTER_API_KEY: "test-only", VEDASTRO_DIRECT_REPLY_CACHE: "0",
        VEDASTRO_DIRECT_FLOW: "source", VEDASTRO_DIRECT_ENVIRONMENT: "development",
        VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "1" },
      makeMemory: () => ({ read: async () => [] }),
      makeTools: () => async () => assert.fail("No tools expected"),
      fetchImpl: async () => {
        calls++;
        return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: reply } }], usage: { cost: 0 } }));
      },
    });
    assert.equal(calls, 1);
    assert.equal(result.reply, reply);
    assert.deepEqual(result.answer_reading_tools, []);
  }
});

void test("friendship prompt preserves identity, language, memory and current preferences without chart contract", () => {
  const prompt = emotionalFriendshipPrompt({query: "My partner left me. What should I do?", language: "hinglish", user_name: "Ravi"},
    {memoryStatus: "available", memoryFacts: ["User already tried talking to their friend."]});
  assert.match(prompt, /Ravi/);
  assert.match(prompt, /hinglish/);
  assert.match(prompt, /already tried talking/);
  assert.match(prompt, /does not override a new explicit request for advice/);
  assert.doesNotMatch(prompt, /Completed Reading Output Contract|40 words of explanation|VEDASTRO/);
});

void test("quality guard rejects the observed empty consolation but permits specific support in supported scripts", () => {
  const value = {query: "meri Gf chli gayi Mujhe Chhor Kr", language: "hinglish"};
  for (const reply of ["Main sun rahi hoon. Bas yahan hoon.", "Dil toot gaya hai aur koi nahi samajh raha.", "Aapke chart mein breakup hai."]) {
    assert.ok(emotionalReplyIssue(reply, value));
  }
  for (const reply of ["Unke jaane ke baad aapko kaisa lag raha hai?", "Your girlfriend leaving can be difficult to process.", "उनके छोड़कर जाने के बाद आप कैसा महसूस कर रहे हैं?"]) {
    assert.equal(emotionalReplyIssue(reply, value), null);
  }
  assert.equal(emotionalReplyIssue("Je comprends votre peine.", {...value, language: "fr"}), null);
});

void test("stale consolation gets one rewrite; repeated bad wording still delivers support within two calls", async () => {
  const good = "Aapki girlfriend chhod kar chali gayi. Yeh ek bada badlav hai. Aap chahein toh bata sakte hain ki kya hua.";
  for (const repairWorks of [true, false]) {
    let calls = 0;
    const run = directAnswer({user_id:"test:breakup", query:"meri Gf chli gayi Mujhe Chhor Kr", language:"hinglish", birth:{},
      history:[{role:"user",text:"Abhi bas suno"},{role:"assistant",text:"Main sun rahi hoon. Bas yahan hoon."}]}, {
      env:{OPENROUTER_API_KEY:"test-only",VEDASTRO_DIRECT_REPLY_CACHE:"0",VEDASTRO_DIRECT_FLOW:"source",VEDASTRO_DIRECT_ENVIRONMENT:"development",VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:"1"},
      makeMemory:()=>({read:async()=>[]}), makeTools:()=>async()=>assert.fail("No tools expected"),
      fetchImpl:async(_url,options)=>{
        calls++;
        const body=JSON.parse(options.body);
        assert.doesNotMatch(body.messages[0].content,/40 words of explanation/);
        assert.deepEqual(body.messages.map(m=>m.role), ["system", "user"]);
        if(calls===2) {
          assert.match(body.messages[0].content,/Rewrite this emotional reply once/);
          assert.equal(body.messages.at(-1).content,"meri Gf chli gayi Mujhe Chhor Kr");
          assert.ok(!body.messages.some(m=>m.role==="assistant"));
        }
        return new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:calls===2 && repairWorks ? good : "Main sun rahi hoon. Bas yahan hoon."}}],usage:{cost:0}}));
      },
    });
    if(repairWorks){const result=await run;assert.equal(result.reply,good);assert.deepEqual(result.answer_reading_tools,[]);assert.deepEqual(result.answer_validation,["emotional_quality_rewrite"]);}
    else {
      const result=await run;
      assert.match(result.reply,/aapko chhodkar jaana/);
      assert.doesNotMatch(result.reply,/Main sun rahi|yahan hoon|chart|dasha/);
      assert.deepEqual(result.answer_validation,["emotional_quality_rewrite","emotional_quality_fallback"]);
    }
    assert.equal(calls,2);
  }
});

void test("current advice request keeps prior attempts and works when saved memory is unavailable", async () => {
  const reply = "Being dismissed after opening up can hurt. Since talking to that friend did not help, you could write down what you wanted them to understand before deciding whether to talk again.";
  let calls = 0;
  const result = await directAnswer({user_id:"test:advice",query:"I still feel upset. What should I do now?",language:"en",birth:{},
    history:[{role:"user",text:"Just listen for now. I tried talking to my friend and was dismissed."},{role:"assistant",text:"I am here."}]}, {
    env:{OPENROUTER_API_KEY:"test-only",VEDASTRO_DIRECT_REPLY_CACHE:"0",VEDASTRO_DIRECT_FLOW:"source",VEDASTRO_DIRECT_ENVIRONMENT:"development",VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:"1"},
    makeMemory:()=>({read:async()=>{throw new Error("Memory unavailable");}}),
    makeTools:()=>async()=>assert.fail("No chart needed for advice"),
    fetchImpl:async(_url,options)=>{
      calls++;
      const body=JSON.parse(options.body);
      assert.match(body.messages[0].content,/"status":"unavailable"/);
      assert.ok(body.messages[0].content.includes("I tried talking"));
      assert.equal(body.messages.at(-1).content,"I still feel upset. What should I do now?");
      assert.ok(body.tools.every(t=>!CHART_TOOL_NAMES.has(bareToolName(t.function.name))));
      return new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:reply}}],usage:{cost:0}}));
    },
  });
  assert.equal(calls,1);
  assert.equal(result.reply,reply);
});
