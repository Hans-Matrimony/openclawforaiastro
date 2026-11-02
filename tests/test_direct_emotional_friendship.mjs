import assert from "node:assert/strict";
import test from "node:test";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { emotionalFriendshipPrompt, emotionalConversationContext, emotionalReplyIssue, emotionalIssueCategories, friendshipListeningOnly, friendshipAdviceRequested, isEmotionalFriendship } from "../extensions/reviewed-reading/direct/emotional-friendship.mjs";
import { CHART_TOOL_NAMES, bareToolName } from "../extensions/reviewed-reading/direct/reading-intent.mjs";

void test("short advice follows the latest disclosure without reviving an older breakup", () => {
  for (const field of ["text", "content"]) {
    const history = [
      { role: "user", [field]: "My girlfriend left me." },
      { role: "assistant", [field]: "You must be heartbroken." },
      { role: "user", [field]: "Main udaas hoon. Bas suno, advice nahi." },
      { role: "user", [field]: "haan" },
    ];
    const prompt = emotionalConversationContext(history, "ab kya karu?");
    const boundary = prompt.split("# Current topic boundary")[1];
    assert.match(boundary, /Main udaas hoon/);
    assert.doesNotMatch(boundary, /girlfriend|heartbroken/);
    assert.match(boundary, /overrides an earlier request only to listen/);
    assert.match(prompt, /My girlfriend left me/); // history remains available
    assert.doesNotMatch(prompt, /You must be heartbroken/);
  }
  const direct = emotionalConversationContext([{role:"user",text:"My girlfriend left me."}], "I feel worried about work.");
  assert.match(direct.split("# Current topic boundary")[1], /current user message/);
  assert.doesNotMatch(direct.split("# Current topic boundary")[1], /girlfriend/);
});

void test("observed Hindi hedges and malformed wording trigger the bounded repair", () => {
  const value = {query:"आज मन उदास है। बस मेरी बात सुनिए।",language:"hindi"};
  assert.match(emotionalReplyIssue("मुझे लगा कि शायद अभी कुछ बहुत भारी है।",value), /attribute emptiness/);
  assert.equal(emotionalReplyIssue("मुझे लगा कि शायद अभी कुछ बहुत भारी है।",{...value,query:"मन भारी है"}),null);
  for (const reply of ["आपको कुछ सालने की जरूरत नहीं।", "Kuch karein jo thoda sa theekha lage.", "Aapke dil ka har ek saans kaam kar raha hai."]) {
    const issue = emotionalReplyIssue(reply,value);
    assert.match(issue,/malformed everyday language/);
    assert.ok(emotionalIssueCategories(issue).includes("malformed_language"));
  }
  assert.equal(emotionalReplyIssue("आप उदास हैं। आप अपनी बात आराम से कह सकते हैं; मैं सुन रही हूँ।",value),null);
});

void test("advice and listening contracts stay distinct in English Hindi and Hinglish", () => {
  for (const query of ["ab kya karu?", "What should I do?", "मैं क्या करूँ?"]) {
    const prompt = emotionalFriendshipPrompt({query,language:"hinglish"},{});
    assert.match(prompt, /offer one concrete, relevant optional step/);
    assert.doesNotMatch(prompt, /The next sentence gives permission/);
  }
  for (const query of ["Main udaas hoon, bas suno", "Just listen, no advice", "बस सुनिए, सलाह मत देना"]) {
    const prompt = emotionalFriendshipPrompt({query,language:"hinglish"},{});
    assert.match(prompt, /Do not prescribe activities/);
    assert.doesNotMatch(prompt, /The current message asks for help/);
  }
});

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
  for (const query of ["haan", "ab kya karu?", "What should I do now?"]) {
    assert.equal(isEmotionalFriendship(query,[emotion,{role:"user",text:"haan"},{role:"user",text:"yes"}]),true);
    assert.equal(isEmotionalFriendship(query,[emotion,astrology,{role:"user",text:"haan"}]),false);
    assert.equal(isEmotionalFriendship(query,[{role:"user",text:"haan"}]),false);
  }
});

void test("no-question preference blocks questions without blocking requested advice", () => {
  for(const query of ["I feel upset. No questions please.", "Main udaas hoon, sawal mat puchna", "आज मन उदास है, सवाल मत पूछना"]) {
    const value={query,language:"hinglish"};
    assert.match(emotionalReplyIssue("Aap apni baat keh sakte hain. Kya hua?",value),/requested no questions/);
    assert.equal(emotionalReplyIssue("Aap apni baat apne tareeke se keh sakte hain; koi jaldi nahi hai.",value),null);
  }
  assert.equal(emotionalReplyIssue("You feel upset. What would you like to talk about?",{query:"I feel upset. Can we talk?",language:"en"}),null);
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
      assert.ok(!body.messages[0].content.includes(previous));
      assert.ok(body.messages[0].content.includes("I told my friend I was hurt."));
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

void test("standalone emotions omit stale assistant prose but references retain the latest assistant context", () => {
  const history=[{role:"user",content:"My partner left me."},{role:"assistant",content:"OLD FORECAST"},
    {role:"user",content:"I tried talking to a friend."},{role:"assistant",content:"You could write down what you wanted to say."}];
  const standalone=emotionalConversationContext(history,"I feel sad.");
  assert.match(standalone,/I tried talking to a friend/);
  assert.doesNotMatch(standalone,/OLD FORECAST|You could write/);
  for(const query of ["haan", "Your advice did not help, I am still upset.", "Aapne jo kaha kaam nahi kiya"]) {
    const prompt=emotionalConversationContext(history,query);
    assert.match(prompt,/You could write/);
    assert.doesNotMatch(prompt,/OLD FORECAST/);
  }
  assert.doesNotThrow(()=>emotionalConversationContext([],"haan"));
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

void test("friendship identity excludes shared reading persona instructions for every gender", () => {
  for (const [gender, identity] of [["male", "Meera"], ["female", "Aarav"], [undefined, "gender-neutral"]]) {
    const prompt = emotionalFriendshipPrompt({query:"I feel sad",user_gender:gender,user_name:"Test Name",language:"en"},{});
    assert.ok(prompt.includes(identity));
    assert.match(prompt,/Test Name/);
    assert.doesNotMatch(prompt,/future spouse|future wife|future husband|Banaras|25 years old|mehnat ko pehchaan/);
  }
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
  for (const bad of ["Main sun rahi hoon. Bas yahan hoon.", "Tumne usse pyaar kiya tha, aur ab woh chali gayi. Koi baat nahi. Apne phone ko doosre kamre mein rakh do.", "Pilot Test, aapki gf ne aapko chhor diya yeh sunkar dil dukhta hai. Aapne jo feel kiya, uski koi aadat nahi, koi samajh nahi, bas yeh hua: woh chali gayi. Aapke paas abhi kuch bhi solve karne ka pressure nahi hai. Bas yahan hoon, sun rahi hoon."]) {
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
        return new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:calls===2 && repairWorks ? good : bad}}],usage:{cost:0}}));
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
  }
});

void test("presence fragments cannot bypass the guard by dropping main or changing punctuation", () => {
  const value={query:"My girlfriend left me",language:"en"};
  for (const ending of ["Bas yahan hoon, sun rahi hoon.", "Sun raha hun.", "Yahaan hoon.", "यहाँ हूँ। सुन रही हूँ।"]) {
    assert.match(emotionalReplyIssue("Your girlfriend left. "+ending,value),/presence announcement/);
  }
  const combined=emotionalReplyIssue("Tumhari girlfriend chali gayi. Yahan hoon. Sun rahi hoon. Your chart says so.",value);
  assert.match(combined,/respectful aap/);
  assert.match(combined,/introduces astrology/);
  assert.match(combined,/presence announcement/);
  assert.equal(emotionalReplyIssue("Your girlfriend left. You can share what happened at your own pace.",value),null);
});

void test("one reassurance after specific support is accepted and diagnostics contain only fixed categories", () => {
  const value={query:"My girlfriend left me",language:"en"};
  for(const reassurance of ["I'm here for you.", "Main yahin hoon.", "Sun rahi hoon."]) {
    assert.equal(emotionalReplyIssue("Your girlfriend left you. You can share what happened at your own pace. "+reassurance,value),null);
    assert.ok(emotionalReplyIssue(reassurance,value));
  }
  const issue=emotionalReplyIssue("Tumhari girlfriend chali gayi. Main yahan hoon. Sun rahi hoon.",value);
  assert.deepEqual(emotionalIssueCategories(issue),["informal_address","repeated_presence"]);
  assert.deepEqual(emotionalIssueCategories("private user text or unknown failure"),[]);
});

void test("hedged emptiness claims need user evidence while invitations remain valid", () => {
  const value={query:"My girlfriend left me",language:"hinglish"};
  const bad="Aapki girlfriend chali gayi, lagta hai aapke andar gehra sa khalipana reh gaya hai.";
  assert.match(emotionalReplyIssue(bad,value),/attribute emptiness/);
  assert.ok(emotionalReplyIssue(bad,{...value,history:[{role:"assistant",text:"khalipana"}]}));
  assert.equal(emotionalReplyIssue(bad,{...value,query:"My girlfriend left me. Bahut khalipana hai."}),null);
  assert.equal(emotionalReplyIssue("Aapki girlfriend chali gayi. Aap chahein toh bata sakte hain ki aapko kaisa lag raha hai.",value),null);
});

void test("emotional assertions need current evidence, with clause-local questions and conditionals", () => {
  const value={query:"My girlfriend left me",language:"hinglish"};
  for(const text of ["Aapki girlfriend chali gayi, lagta hai aapke andar kuch bhaari hai.", "Your girlfriend left. You must feel lonely.", "Aapki girlfriend chali gayi. Aapka dil toot gaya hai.", "Your girlfriend left. If you want, share more. You feel heavy inside."]) {
    assert.ok(emotionalReplyIssue(text,value));
    assert.ok(emotionalReplyIssue(text,{...value,history:[{role:"user",text:"I felt lonely and heavy yesterday."}]}));
  }
  assert.ok(emotionalReplyIssue("Your girlfriend left. You feel lonely.",{...value,query:"My girlfriend left, but I am not lonely."}));
  assert.equal(emotionalReplyIssue("Your girlfriend left. You feel lonely.",{...value,query:"My girlfriend left. I feel lonely."}),null);
  assert.equal(emotionalReplyIssue("Your girlfriend left. Are you feeling lonely?",value),null);
  assert.equal(emotionalReplyIssue("Your girlfriend left. If you feel lonely, you can talk about it.",value),null);
  for(const ending of ["Main yahin hoon.", "Main yahaan hoon.", "I'm here for you.", "मैं यहीं हूँ।"]) assert.match(emotionalReplyIssue("Your girlfriend left. "+ending,value),/presence announcement/);
});

void test("emotional boundaries reject observed defects without suppressing requested advice", () => {
  const value = {query:"meri Gf chli gayi Mujhe Chhor Kr",language:"hinglish"};
  const issue = emotionalReplyIssue("Tumne usse pyaar kiya tha. Woh chali gayi, koi baat nahi. Phone rakh do.", value);
  assert.match(issue,/respectful aap/);
  assert.match(issue,/feeling was not supplied/);
  assert.match(issue,/No advice was requested/);
  assert.match(issue,/without dismissal/);
  assert.ok(emotionalReplyIssue("तुम्हारी girlfriend चली गई।", value));
  const advice = "Your partner left. You could write down what you want to say.";
  assert.ok(emotionalReplyIssue(advice,value));
  assert.equal(emotionalReplyIssue(advice,{...value,query:"My partner left me. What should I do?"}),null);
  assert.ok(emotionalReplyIssue(advice,{...value,query:"My partner left me. No advice, just listen."}));
  assert.equal(emotionalReplyIssue("You loved your partner, and your partner left.",{...value,query:"I loved my partner and they left me."}),null);
  for (const query of ["What should I do?", "Ab kya karun?", "Kaise sambhalun?", "मैं क्या करूँ?"]) assert.equal(friendshipAdviceRequested(query),true);
  for (const query of ["meri Gf chli gayi Mujhe Chhor Kr", "No advice, just listen", "advice nahi, bas suno"]) assert.equal(friendshipAdviceRequested(query),false);
});

void test("breakup replies cannot invent silence but retain user-supplied details", () => {
  const value = {query:"meri Gf chli gayi Mujhe Chhor Kr", language:"hinglish"};
  for (const reply of ["Woh chali gayi, aur aapke saath kuchh bhi na kah sake.", "Your partner left without saying goodbye.", "Woh bina bataye chali gayi."]) {
    assert.match(emotionalReplyIssue(reply, value), /invents a lack of communication/);
    assert.ok(emotionalReplyIssue(reply, {...value, history:[{role:"assistant",text:reply}]}));
    assert.equal(emotionalReplyIssue(reply, {...value, history:[{role:"user",text:reply}]}), null);
  }
  assert.equal(emotionalReplyIssue("Aapki girlfriend chali gayi. Aap chahein toh iske baare mein baat kar sakte hain.", value), null);
  assert.equal(emotionalReplyIssue("Your partner left without saying goodbye.", {...value,query:"My partner left me without saying goodbye."}), null);
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
