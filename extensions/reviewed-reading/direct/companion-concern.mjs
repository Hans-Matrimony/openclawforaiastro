import { companionFocus, companionTopics, companionNotes } from "./companion-context.mjs";

// Companion-only evidence: never derive a personal problem from an assistant's chart reading.
export function companionConcern(value, facts = []) {
  const focus = companionFocus(value);
  const statements = [
    value.query,
    ...(value.history ?? [])
      .filter((t) => t.role === "user")
      .toReversed()
      .map((t) => t.text),
    ...companionNotes(facts, focus, value),
  ];
  const dismissed = new Set();
  for (const text of statements) {
    const topics = companionTopics(text);
    if (focus.topics.length && topics.length && !topics.some((t) => focus.topics.includes(t))) {
      continue;
    }
    if (
      focus.topics.some((t) => ["education", "career"].includes(t)) &&
      /time manage|manage.{0,15}time|waqt.{0,15}(?:nahi|kam)|samay.{0,15}(?:nahi|kam)|समय.{0,15}(?:नहीं|कम)/i.test(
        text,
      )
    ) {
      return { kind: "time", evidence: text };
    }
    if (
      /\bfees?\b|फीस/i.test(text) &&
      /\b(?:fully paid|sorted|bhar di|jama ho|no longer|issue nahi|tension nahi)\b|भर दी|जमा हो/i.test(
        text,
      )
    ) {
      dismissed.add("fees");
    }
    if (
      !dismissed.has("fees") &&
      focus.topics.some((t) => ["finance", "education"].includes(t)) &&
      /\bfees?\b|फीस/i.test(text)
    ) {
      return { kind: "fees", evidence: text };
    }
    if (
      /family|parents|ghar\s*wal|घरवाल|परिवार/i.test(text) &&
      /now agree|ab maan gaye|ab raazi|अब मान गए|अब राज़ी/i.test(text)
    ) {
      dismissed.add("family");
    }
    if (
      !dismissed.has("family") &&
      focus.topics.includes("relationship") &&
      /family|parents|ghar\s*wal|घरवाल|परिवार/i.test(text) &&
      /khilaaf|khilaf|oppose|opposition|against|dikkat|objection|nahi maan|खिलाफ|दिक्कत|विरोध/i.test(
        text,
      )
    ) {
      return { kind: "family", evidence: text };
    }
    if (
      focus.topics.includes("career") &&
      /\bMBA\b/i.test(text) &&
      /chhod|chod diya|quit|stopped|no longer|छोड़/i.test(text)
    ) {
      return { kind: "job_focus", evidence: text };
    }
  }
  return null;
}

const options = {
  time: {
    hinglish: [
      "Time ki dikkat samajh aayi. Din ka kaunsa hissa thoda apne hisaab se badal sakte ho?",
      "Is busy routine mein aapko apne liye thoda waqt kab milta hai?",
    ],
    english: [
      "Time is the sticking point. Which part of your day has a little flexibility?",
      "When do you get a little breathing room in this routine?",
    ],
    hindi: [
      "समय की दिक्कत समझ आई। दिन का कौन सा हिस्सा थोड़ा अपने हिसाब से बदल सकते हो?",
      "इस व्यस्त दिनचर्या में अपने लिए थोड़ा समय कब मिलता है?",
    ],
  },
  fees: {
    hinglish: [
      "Fees ka pressure samajh aaya. Abhi koi payment kareeb hai, ya aage ka kharcha pareshaan kar raha hai?",
      "Fees wali baat mein ab kis tarah ka saath chahiye, baat karna ya milkar options sochna?",
    ],
    english: [
      "The fees are weighing on you. Is a payment coming up, or is it the longer-term expense?",
      "With the fees, would talking help more right now, or thinking through options together?",
    ],
    hindi: [
      "फीस का दबाव समझ आया। कोई भुगतान करीब है या आगे का खर्च परेशान कर रहा है?",
      "फीस वाली बात पर अभी बात करना चाहोगे या साथ में विकल्प सोचना?",
    ],
  },
  family: {
    hinglish: [
      "Gharwalon ki baat aasaan nahi lagti. Unmein kis se aap khulkar baat kar paate ho?",
      "Is family wali baat mein aap apni partner se kya share kar paaye ho?",
    ],
    english: [
      "That family situation sounds difficult. Who in the family can you talk openly with?",
      "What have you been able to share with your partner about this family situation?",
    ],
    hindi: [
      "घरवालों की बात आसान नहीं लगती। उनमें किससे खुलकर बात कर पाते हो?",
      "परिवार की इस बात पर अपने साथी से क्या साझा कर पाए हो?",
    ],
  },
  job_focus: {
    hinglish: [
      "Ab job par focus hai. Apne kaam mein sabse pehle kya badalna chahte ho?",
      "Job ko priority dene ke baad ab kaisa lag raha hai?",
    ],
    english: [
      "Work is the priority now. What would you most like to change about it first?",
      "How are you feeling now that work is your priority?",
    ],
    hindi: [
      "अब नौकरी पर ध्यान है। अपने काम में सबसे पहले क्या बदलना चाहते हो?",
      "नौकरी को प्राथमिकता देने के बाद अब कैसा लग रहा है?",
    ],
  },
};

export function concernFallback(value, concern) {
  if (!concern) {
    return null;
  }
  const requested = value.query.match(/\b(?:reply|answer|respond) in (english|hindi)\b/i)?.[1];
  const language =
    requested?.toLowerCase() ??
    { en: "english", hi: "hindi" }[value.language?.toLowerCase()] ??
    value.language?.toLowerCase();
  const previous = (value.history ?? [])
    .filter((t) => t.role === "assistant")
    .map((t) => t.text.toLowerCase());
  const userEvidence = [
    value.query,
    ...(value.history ?? []).filter((t) => t.role === "user").map((t) => t.text),
  ].join("\n");
  const paymentKnown =
    concern.kind === "fees" &&
    /(?:payment|fees?).{0,35}(?:next week|tomorrow|kal|agle hafte|due|\d)|(?:अगले हफ्ते|कल).{0,20}फीस/i.test(
      userEvidence,
    );
  // Never recycle a specific question that may already have been answered.
  return (
    options[concern.kind]?.[language]?.find(
      (q, index) =>
        !(paymentKnown && index === 0) && !previous.some((old) => old.includes(q.toLowerCase())),
    ) ?? null
  );
}

export function ignoresKnownConcern(question, concern) {
  if (!concern) {
    return false;
  }
  // Broad restarts are not a meaningful continuation once a concrete concern is known.
  return /(?:tension|stress|pareshan).{0,20}(?:kis baat|kis cheez|kyu)|what.{0,15}(?:causing|worrying)|what.{0,15}weighing on|(?:apni zindagi|life).{0,35}(?:kaisa|how|kya chal)|sabse badi uljhan|सबसे.{0,12}तनाव.{0,10}किस/i.test(
    question,
  );
}
