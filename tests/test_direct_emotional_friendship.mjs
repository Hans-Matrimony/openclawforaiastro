import assert from "node:assert/strict";
import test from "node:test";
import { directAnswer } from "../extensions/reviewed-reading/direct/agent.mjs";
import { friendshipListeningOnly, isEmotionalFriendship } from "../extensions/reviewed-reading/direct/emotional-friendship.mjs";
import { CHART_TOOL_NAMES, bareToolName } from "../extensions/reviewed-reading/direct/reading-intent.mjs";

void test("emotional chat gets warmth without capturing astrology or safety requests", () => {
  for (const query of [
    "I feel lonely. Can we talk?", "Main bahut udaas hoon", "Mera breakup ho gaya, rona aa raha hai",
    "Main stressed hoon, kya karu?", "आज मन उदास है", "I feel upset, please just listen, no advice",
    "I am grieving and need someone to listen", "I am not sad, but I feel lonely",
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
      assert.ok(body.messages.some(message => message.role === "assistant" && message.content === previous));
      assert.ok(body.tools.every(tool => !CHART_TOOL_NAMES.has(bareToolName(tool.function.name))));
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: acknowledgement } }], usage: { cost: 0 } }));
    },
  });
  assert.equal(calls, 1);
  assert.ok(result.reply.startsWith(acknowledgement));
  assert.deepEqual(result.answer_reading_tools, []);
  }
});

void test("explicit listening and no-question requests do not add a companion call", async () => {
  for (const query of [
    "I feel upset, just listen, no advice and no questions",
    "Main udaas hoon, sawal mat puchna",
    "आज मन उदास है, बस सुनो, सलाह मत देना",
  ]) {
    let calls = 0;
    const reply = "You felt ignored after sharing something important. That can hurt, and you do not have to explain it all right now.";
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
