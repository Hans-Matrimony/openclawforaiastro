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
    // Fees remain relevant to studying even when the latest short disclosure
    // is classified as finance and does not repeat "MBA" or "education".
    const educationFees = focus.topics.includes("education") && /\bfees?\b|फीस/i.test(text);
    if (
      focus.topics.length &&
      topics.length &&
      !topics.some((t) => focus.topics.includes(t)) &&
      !educationFees
    ) {
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
      /family|parents|mummy|papa|mom|dad|father|mother|ghar\s*wal|घरवाल|परिवार/i.test(text) &&
      /khilaaf|khilaf|oppose|opposition|against|dikkat|objection|nahi maan|mana kar|guss|darr|खिलाफ|दिक्कत|विरोध/i.test(
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
      "Apni baat gharwalon ke saamne rakhte waqt sabse mushkil kya lagta hai?",
    ],
    english: [
      "That family situation sounds difficult. Who in the family can you talk openly with?",
      "What feels hardest about explaining your side to your family?",
    ],
    hindi: [
      "घरवालों की बात आसान नहीं लगती। उनमें किससे खुलकर बात कर पाते हो?",
      "घरवालों के सामने अपनी बात रखते समय सबसे मुश्किल क्या लगता है?",
    ],
  },
  job_focus: {
    hinglish: [
      "Ab job par focus hai. Kis tarah ka kaam karna chahte ho?",
      "Job ko priority dene ke baad ab kaisa lag raha hai?",
    ],
    english: [
      "Work is the priority now. What kind of work would you like to do?",
      "How are you feeling now that work is your priority?",
    ],
    hindi: [
      "अब नौकरी पर ध्यान है। किस तरह का काम करना चाहते हो?",
      "नौकरी को प्राथमिकता देने के बाद अब कैसा लग रहा है?",
    ],
  },
};

function knownWorkPreference(value) {
  const latest = [
    value.query,
    ...(value.history ?? [])
      .filter((t) => t.role === "user")
      .toReversed()
      .map((t) => t.text),
  ].find((text) => /software (?:developer|engineer)|\b(?:sales|marketing)\b/i.test(text));
  return Boolean(latest && !/\b(?:nahi|nahin|not|no longer)\b/i.test(latest));
}

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
    concern.evidence ?? "",
    value.query,
    ...(value.history ?? []).filter((t) => t.role === "user").map((t) => t.text),
  ].join("\n");
  const paymentKnown =
    concern.kind === "fees" &&
    /(?:next week|tomorrow|kal|agle hafte).{0,35}(?:payment|fees?)|(?:payment|fees?).{0,35}(?:next week|tomorrow|kal|agle hafte|due|\d)|(?:अगले हफ्ते|कल).{0,20}फीस/i.test(
      userEvidence,
    );
  // Never recycle a specific question that may already have been answered.
  // Use only the newest user statement for this specific fallback. Older history
  // must not turn a resolved fear into a claim about how the user feels now.
  const specific =
    concern.kind === "job_focus" && knownWorkPreference(value)
      ? {
          hinglish:
            "Kaam ki direction toh clear hai. Is field mein aapko sabse zyada kya pasand aata hai?",
          english: "You have a direction in mind. What interests you most about this kind of work?",
          hindi: "काम की दिशा तो तय है। इस क्षेत्र में आपको सबसे ज़्यादा क्या पसंद आता है?",
        }[language]
      : concern.kind === "family" &&
          /papa.{0,45}(?:darr|dar lag|afraid|scared)|(?:afraid|scared).{0,30}(?:dad|father)/i.test(
            value.query,
          )
        ? {
            hinglish: "Papa se baat karne ka darr hai. Unke kis reaction ki sabse zyada fikr hai?",
            english: "Talking to your dad feels scary. What reaction are you most worried about?",
            hindi: "पापा से बात करने में डर लग रहा है। उनकी किस प्रतिक्रिया की सबसे ज़्यादा चिंता है?",
          }[language]
        : null;
  return (
    [specific, ...(options[concern.kind]?.[language] ?? [])]
      .filter(Boolean)
      .find(
        (q) =>
          !(paymentKnown && q === options.fees[language]?.[0]) &&
          !ignoresKnownConcern(q, concern, value) &&
          !previous.some((old) => old.includes(q.toLowerCase())),
      ) ??
    (paymentKnown
      ? {
          hinglish:
            "Fees ki deadline ka pressure hai. Abhi sab ek saath suljhana zaroori nahi; apni baat aaram se keh sakte ho.",
          english:
            "There is pressure from the fees deadline. You do not have to sort everything out at once; take your time talking it through.",
          hindi:
            "फीस की समय सीमा का दबाव है। अभी सब एक साथ सुलझाना ज़रूरी नहीं; अपनी बात आराम से कह सकते हो।",
        }[language]
      : concern.kind === "fees"
        ? {
            hinglish:
              "Fees ki baat par hi rehte hain. Isko lekar abhi aap kya share karna chahte ho?",
            english: "Let's stay with the fees. What would you like to share about that right now?",
            hindi: "फीस की बात पर ही रहते हैं। इसे लेकर अभी आप क्या साझा करना चाहते हैं?",
          }[language]
        : null)
  );
}

export function ignoresKnownConcern(question, concern, value = {}) {
  if (!concern) {
    return false;
  }
  const finalQuestion = question.split(/(?<=[.!?।])\s+|\n+/u).at(-1) ?? question;
  const related = {
    fees: /fees?|payment|scholarship|support|madad|kharch|pais[aeo]|financial|amount|installment|kisht|budget|expense|iske liye|फीस|मदद|सहारा/i,
    time: /time|routine|din|day|schedule|waqt|samay|shift|ghanta|hour|padhai|study|workload|समय|दिन/i,
    family:
      /family|ghar|partner|parents|mummy|papa|baat|conversation|speak|talk|explaining|घर|बात/i,
    job_focus: /job|work|career|kaam|skill|naukri|field|interview|application|काम|क्षेत्र/i,
  }[concern.kind];
  // Natural continuations use pronouns: "Fees ka pressure hai. Iske liye koi
  // madad mil sakti hai?" Require a grounded opening, not repeated topic words.
  const groundedContinuation =
    related?.test(question.slice(0, question.length - finalQuestion.length)) &&
    /\b(?:iske|isme|uske|unke|unse|isse|that|this|their|them)\b|इसके|उनसे|उनकी/i.test(finalQuestion);
  if (
    /[?？]$/.test(finalQuestion) &&
    related &&
    !related.test(finalQuestion) &&
    !groundedContinuation
  ) {
    return true;
  }
  const userEvidence = [
    concern.evidence ?? "",
    value.query ?? "",
    ...(value.history ?? []).filter((t) => t.role === "user").map((t) => t.text),
  ].join("\n");
  if (
    concern.kind === "job_focus" &&
    knownWorkPreference(value) &&
    /(?:kis|kaun|what|which).{0,15}(?:tarah|kind|type|job|work)|किस तरह का काम/i.test(finalQuestion)
  ) {
    // Asking why a known role appeals is different from asking them to choose it again.
    if (!/interests|pasand|पसंद/i.test(finalQuestion)) {
      return true;
    }
  }
  if (
    concern.kind === "fees" &&
    /(?:next week|tomorrow|kal|agle hafte).{0,35}(?:fees?|payment)|(?:fees?|payment).{0,35}(?:next week|tomorrow|kal|agle hafte|due|\d)/i.test(
      userEvidence,
    ) &&
    /(?:fees?|payment).{0,30}(?:kab|when|due|kareeb|coming up)|when.{0,30}(?:pay|due)/i.test(
      question,
    )
  ) {
    return true;
  }
  if (
    concern.kind === "family" &&
    /(?:mummy|papa|maa|mom|dad).{0,15}(?:se baat kar sak|can talk|baat ho chuki)/i.test(
      userEvidence,
    ) &&
    /kis\s*se|who.{0,25}talk/i.test(question)
  ) {
    return true;
  }
  // Broad restarts are not a meaningful continuation once a concrete concern is known.
  return /(?:tension|stress|pareshan).{0,20}(?:kis baat|kis cheez|kyu)|what.{0,15}(?:causing|worrying)|what.{0,15}weighing on|(?:apni zindagi|life).{0,35}(?:kaisa|how|kya chal)|sabse badi uljhan|सबसे.{0,12}तनाव.{0,10}किस/i.test(
    question,
  );
}
