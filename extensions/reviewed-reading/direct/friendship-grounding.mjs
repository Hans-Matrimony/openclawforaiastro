import { isFriendshipContinuation, rejectsPreviousAdvice } from "./friendship-intent.mjs";

export function currentFriendshipDisclosure(value) {
  if (!isFriendshipContinuation(value.query) && !rejectsPreviousAdvice(value.query)) return value.query;
  const turn = [...(value.history || [])].reverse().find(turn => {
    const text = turn.text ?? turn.content ?? "";
    return turn.role === "user" && !isFriendshipContinuation(text) && !rejectsPreviousAdvice(text);
  });
  return turn?.text ?? turn?.content ?? value.query;
}

// Observable failures from live replies; never modify chart interpretations.
export function friendshipGroundingIssues(reply, value) {
  const issues = [];
  const disclosure = currentFriendshipDisclosure(value);
  if (/\bek aadmi ya aurat\b/iu.test(reply) ||
      (/\bjo aapke dil mein hai\b/iu.test(reply) && !/\bjo aapke dil mein hai\b/iu.test(disclosure))) {
    issues.push('Use natural neutral wording for a trusted person, not a gender checklist or an assumed romantic contact. Loneliness does not establish a partner, crush or someone in the user\'s heart. Offer one optional relevant step without inventing who they should contact.');
  }
  if (/\b(?:my|meri) (?:girlfriend|gf|partner)\b.{0,55}(?:left|chali|chli|ended|khatam)/iu.test(disclosure) &&
      /\b(?:you (?:ended|left|broke)|aapne.{0,25}(?:rishta|relationship).{0,15}khatam)/iu.test(reply)) {
    issues.push("Preserve who ended the relationship: the user said their partner ended it, not the user. Do not reverse that fact.");
  }
  if (/\b(?:dhadkan.{0,12}ruk|heartbeat.{0,12}stop|dard sahi lag|kisi ki galati nahi|nobody is at fault)\b/iu.test(reply)) {
    issues.push("Remove exaggerated bodily metaphors and unsupported judgments about fault or pain. Use literal, grounded language.");
  }
  if (/\b(?:breakup|girlfriend|boyfriend|relationship|rishta|gf|bf)\b/iu.test(disclosure) &&
      /\b(?:ab main samajh raha hoon ki aapke liye yeh sahi hai|this is (?:right|best) for you|i accept your decision|maine (?:aapka|tumhara) faisla maan liya)\b/iu.test(reply) &&
      !/\b(?:accept|accepted|sweekar|faisla maan|sahi hai)\b/iu.test(disclosure)) {
    issues.push("Do not invent acceptance, closure, or agreement on the user's behalf, including suggested messages. Offer time before replying or neutral wording that asks for space.");
  }
  const relationshipDisclosure = /\b(?:breakup|girlfriend|boyfriend|relationship|rishta|gf|bf)\b/iu.test(disclosure);
  const requestedDraft = requestsMessageDraft(value.query);
  if (relationshipDisclosure && !requestedDraft && /["\u201c][^"\u201d]{12,}["\u201d]/u.test(reply) && /\b(?:message|reply|keh (?:dein|sakte)|likh|bol (?:dein|sakte))\b/iu.test(reply)) {
    issues.push("The user has not asked you to compose a message to their partner. Do not script their reply or decision; acknowledge their uncertainty and offer time before responding.");
  }
  if (/\b(?:kehne ka dimaag|bina kisi ki awaaz|dil ki baat apne aap se|dil ki aawaz sun)\b/iu.test(reply)) {
    issues.push("Replace vague or awkward reassurance with plain acknowledgement and room to speak. Do not tell the user to talk to themselves or listen to their heart; avoid kehne ka dimaag wording.");
  }
  const opening = reply.split(/[.!?\n]/u)[0].toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
  const query = value.query.toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
  if (query.split(/\s+/u).length >= 4 && opening.includes(query)) {
    issues.push("Do not echo the user's message as your own first-person experience. Acknowledge it in your own words.");
  }
  // Quoted wording is for the user to say, not the companion's self-reference.
  const narration = reply.replace(/```[^]*?```|[“"][^”"]*[”"]|‘[^’]*’|(?<!\p{L})'[^'\n]+'(?!\p{L})/gu, "");
  // Aap is a second-person subject; hoon is first-person. Keep quoted drafts
  // and a new main-clause subject separate from this observed role reversal.
  if (/\baap\b(?:(?!\b(?:main|mai|mein|hain|hon)\b)[^,.!?\n]){0,100}\bhoon\b/iu.test(narration)) {
    issues.push('Keep the subject aap with second-person respectful grammar, not first-person hoon. Do not merge the user with the companion or support an emotion as though it were a person.');
  }
  // Hindi commonly omits "main". The first-person hoon still identifies the
  // companion, while quoted drafts keep the user's own grammatical gender.
  const masculineSelf = /\b(?:main.{0,25}(?:sakta|raha|samajhta|samjhta)|(?:samajh|samjh|sun|kar|keh|kah|dekh)\s+(?:sakta|raha))\s+(?:hoon|hun)\b/iu;
  const feminineSelf = /\b(?:main.{0,25}(?:sakti|rahi|samajhti|samjhti)|(?:samajh|samjh|sun|kar|keh|kah|dekh)\s+(?:sakti|rahi))\s+(?:hoon|hun)\b/iu;
  if ((value.user_gender === "male" && masculineSelf.test(narration)) ||
      (value.user_gender === "female" && feminineSelf.test(narration))) {
    issues.push("Keep the companion persona's grammatical gender consistent; quoted words for the user are separate.");
  }
  if (/\b(?:space|boundar\w*)\b/iu.test(value.query) &&
      /\b(?:dono(?:n)? (?:ke|ki) feelings|both (?:of you|our|your) feelings)\b/iu.test(reply) &&
      !/\b(?:dono(?:n)?|both)\b/iu.test(value.query)) {
    issues.push("Do not invent mutual feelings, even inside a suggested message. A request for space establishes only the user's need; phrase the boundary in terms of that need.");
  }
  if (/\b(?:likh lo|likh do|kar lo|batao|socho|rakh do|pi lo|pee lo|karo|bana lo|sun lo|dekh lo)\b/iu.test(narration)) {
    issues.push("Use respectful aap forms consistently instead of informal instructions.");
  }
  return issues;
}

export function requestsMessageDraft(query) {
  return /\b(?:draft|compose|write (?:a |the )?(?:message|reply)|(?:message|reply|jawab) (?:likh|likhkar|bana))\b/iu.test(query);
}
