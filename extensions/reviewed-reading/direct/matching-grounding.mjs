import { verifiedGuna, verifiedGunaFallback } from "./guna-presentation.mjs";

export const matchingGroundingInstruction =
  "\nMatching interpretation: get_match_report supplies a traditional compatibility assessment, not evidence of either person's actual thoughts, feelings, intentions, arrival, fidelity or future choices. A low or zero factor does not establish an emotional diagnosis or a doomed relationship. Keep the exact total and requested factors. Never infer that someone is stuck in their head, will not return, does not love the user, or that the user must wait, leave, marry or move on. A direct qualified verdict may state what the calculation cannot establish. When the user asks about a meeting, offer an optional request for an arrival time and a waiting limit of their own choosing. Do not invent a missed arrival, refusal or other event. Preserve the user's agency and current response language.";

// Sentence-local checks: a disclaimer elsewhere cannot excuse another claim.
// This applies only to a complete, validated matching result, never ordinary chat.
export function matchingGroundingIssues(reply, results) {
  if (!verifiedGuna(results)) {
    return [];
  }
  const issues = new Set();
  const clauses = String(reply)
    .replace(/[’‘]/gu, "'")
    .split(/[.!?;।\n]|\b(?:but|lekin|magar)\b/iu);
  for (const clause of clauses) {
    const text = clause.trim();
    if (!text) {
      continue;
    }
    const qualified =
      /\b(?:cannot|can't|does not|doesn't|do not|don't)\s+(?:tell|establish|determine|prove|reveal|show|predict|know|mean)\b|\b(?:nahi|nahin)\s+(?:bata|jaan|tay)|नहीं (?:बता|जान)|सांगता येत नाही|ठरवत नाही/iu.test(
        text,
      );
    if (
      !qualified &&
      (/\b(?:he|she|they|your partner|this person)\s+(?:(?:is|are)\s+(?:stuck|emotionally|unavailable|blocked|not interested)|(?:doesn't|does not|don't|do not)\s+(?:love|want|care)|(?:(?:may|might|could)\s+)?(?:loves?|wants?|feels?|thinks?|intends?)\b|will\s+(?:not\s+|never\s+)?(?:return|come back|arrive|leave|choose|marry|love))|\b(?:not coming back|struggle to meet each other's core needs|holding space for something|emotional alignment is (?:deeply )?(?:blocked|challenged)|stuck in (?:his|her|their) (?:own )?head)\b/iu.test(
        text,
      ) ||
        /\b(?:woh|wo|vo|unke|uske)\b.{0,45}\b(?:pyaar nahi|pyar nahi|wapas nahi|mann mein|dil mein|soch mein)|(?:वह|वो|उसके|उनके).{0,40}(?:प्यार नहीं|वापस नहीं|मन में|दिल में)|(?:तो|ती|त्याच्या|तिच्या).{0,35}(?:प्रेम करत नाही|परत येणार नाही|मनात)/iu.test(
          text,
        ))
    ) {
      issues.add("partner_mind_reading");
    }
    if (
      !qualified &&
      /\b(?:deep emotional alignment|emotionally incompatible|doomed|destined to fail|cannot work|will never work)\b|\b(?:bhakoot|nadi|gana)\b.{0,80}\b(?:means?|proves?|shows?)\b.{0,45}\b(?:blocked|no love|no future|will fail|cannot last)\b/iu.test(
        text,
      )
    ) {
      issues.add("matching_determinism");
    }
    // An explicit limit such as "cannot decide whether you should wait" is
    // not a directive. Remove only that phrase, never the rest of the clause.
    const directive = text.replace(
      /\b(?:cannot|can't|does not|doesn't)\s+(?:decide|determine)\s+whether\s+you\s+should\s+(?:wait(?:\s+or\s+move\s+(?:on|forward))?|move\s+(?:on|forward))\b/giu,
      "",
    );
    if (
      /(?:^|[,：:]\s*|\b(?:so|therefore)\s+)(?:don't wait|do not wait|move (?:on|forward)|leave (?:him|her|them)|wait for (?:him|her|them)|stay with (?:him|her|them)|marry (?:him|her|them)|break up|end (?:this|the|your) relationship)\b|\byou (?:must|should|need to|have to)\s+(?:move on|move forward|leave|wait|marry|break up)\b|^(?:aage badh|intezaar mat|intazaar mat|unhe chhod|use chhod)|^(?:आगे बढ़|इंतज़ार मत|इंतजार मत|उसे छोड़|पुढे जा|वाट पाहू नका|त्याला सोड|तिला सोड)/iu.test(
        directive,
      )
    ) {
      issues.add("relationship_directive");
    }
  }
  return [...issues];
}

export function matchingDecisionQuestion(value) {
  // The current question owns intent; old unrelated meeting details must not
  // add advice to a later request for a numerical factor breakdown.
  return /\b(?:wait|waiting|move (?:on|forward)|leave (?:him|her|them)|should (?:i|we)|feelings?|intentions?|come back|arriv\w*|meeting|intezaar|intazaar|aage badh)\b|इंतज़ार|इंतजार|आगे बढ़|वाट पाह|पुढे जाऊ/iu.test(
    value.query || "",
  );
}

export function groundedMatchingFallback(results, value) {
  const g = verifiedGuna(results);
  if (!g) {
    return null;
  }
  const requested =
    /^(?:(?:please\s+)?(?:answer|reply|respond|explain)\s+(?:only\s+)?in\s+|in\s+)(english|hindi|hinglish|marathi)\b/iu.exec(
      value.query || "",
    );
  const language =
    requested?.[1].toLowerCase() || String(value.language || "english").toLowerCase();
  const allFactors = /\b(?:factors?|eight|aath|ashtakoota)\b|आठ|अष्टकूट/iu.test(value.query || "");
  const factors = allFactors ? g.factors : g.factors.filter((f) => f.score === 0);
  const scores = factors.map((f) => `${f.name}: ${f.score}/${f.max_score}`).join("; ");
  const total = `Guna Milan: ${g.score_points}/36.${scores ? " " + scores + "." : ""}`;
  const decision = matchingDecisionQuestion(value);
  const meeting =
    /\b(?:meeting|meet|arrival|arrive|on (?:his|her|their|the) way)\b|मिलने|मुलाकात|भेट/iu.test(
      value.query || "",
    ) ||
    (decision &&
      (value.history || [])
        .slice(-6)
        .some(
          (t) =>
            t.role === "user" &&
            /\b(?:meeting|meet|arrival|arrive|on (?:his|her|their|the) way)\b|मिलने|मुलाकात|भेट/iu.test(
              t.text || "",
            ),
        ));
  const copy = /^(?:hi|hindi)(?:-|$)/i.test(language)
    ? {
        limit:
          "यह पारंपरिक अनुकूलता का आकलन है। इससे किसी की भावनाएं, इरादे या भविष्य के फैसले तय नहीं होते। रिश्ते की सफलता की गारंटी नहीं है।",
        meeting:
          "मिलने के लिए आने का स्पष्ट समय पूछ सकते हैं। कितनी देर इंतज़ार करना है, यह आप अपनी सुविधा से तय कर सकते हैं।",
        choice:
          "इंतज़ार करना है या आगे बढ़ना है, इसका फैसला केवल इस स्कोर से नहीं होता। उनकी स्पष्ट बात और व्यवहार को भी ध्यान में रख सकते हैं।",
      }
    : /^(?:mr|marathi)(?:-|$)/i.test(language)
      ? {
          limit:
            "हे पारंपरिक सुसंगततेचे मूल्यमापन आहे. यावरून कोणाच्याही भावना, हेतू किंवा भविष्यातील निर्णय ठरत नाहीत. नाते यशस्वी होण्याची हमी नाही.",
          meeting: "भेटीसाठी येण्याची स्पष्ट वेळ विचारू शकता. किती वेळ थांबायचे हे तुमच्या सोयीने ठरवू शकता.",
          choice:
            "थांबायचे की पुढे जायचे हा निर्णय केवळ या गुणांवर ठरत नाही. त्यांचे स्पष्ट बोलणे आणि वागणेही विचारात घेऊ शकता.",
        }
      : language === "hinglish"
        ? {
            limit:
              "Yeh paramparik compatibility ka aakalan hai. Isse kisi ki feelings, iraade ya future choices tay nahi hote. Rishte ki safalta ki guarantee nahi hai.",
            meeting:
              "Milne ke liye aane ka clear time pooch sakte hain. Kitni der intezaar karna hai, yeh aap apni suvidha se tay kar sakte hain.",
            choice:
              "Intezaar karna hai ya aage badhna hai, iska faisla sirf is score se nahi hota. Unki saaf baat aur vyavahar bhi dhyan mein rakh sakte hain.",
          }
        : /^(?:en|english)(?:-|$)/i.test(language)
          ? {
              limit:
                "This is a traditional compatibility assessment. It cannot establish either person's feelings, intentions or future choices, or guarantee relationship success.",
              meeting:
                "For the meeting, you can ask for a clear arrival time and choose a waiting limit that suits you.",
              choice:
                "The score cannot decide whether you should wait or move forward. You can also consider their direct communication and actions.",
            }
          : null;
  // Preserve the existing localized numerical fallback for other languages.
  if (!copy) {
    return verifiedGunaFallback(results, value.language);
  }
  return `${total}\n\n${copy.limit}${decision ? "\n\n" + (meeting ? copy.meeting : copy.choice) : ""}`;
}
