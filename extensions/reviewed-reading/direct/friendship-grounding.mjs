import { friendshipContinuation, rejectsPreviousAdvice } from "./friendship-intent.mjs";

export function currentFriendshipDisclosure(value) {
  if (!friendshipContinuation.test(value.query.trim()) && !rejectsPreviousAdvice(value.query)) return value.query;
  const turn = [...(value.history || [])].reverse().find(turn => {
    const text = turn.text ?? turn.content ?? "";
    return turn.role === "user" && !friendshipContinuation.test(text.trim()) && !rejectsPreviousAdvice(text);
  });
  return turn?.text ?? turn?.content ?? value.query;
}

// Observable failures from live replies; never modify chart interpretations.
export function friendshipGroundingIssues(reply, value) {
  const issues = [];
  const disclosure = currentFriendshipDisclosure(value);
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
  const requestedDraft = /\b(?:draft|compose|write (?:a |the )?(?:message|reply)|(?:message|reply|jawab) (?:likh|likhkar|bana))\b/iu.test(value.query);
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
  const narration = reply.replace(/[“"][^”"]*[”"]/gu, "");
  if ((value.user_gender === "male" && /\bmain.{0,25}(?:sakta|raha) (?:hoon|hun)\b/iu.test(narration)) ||
      (value.user_gender === "female" && /\bmain.{0,25}(?:sakti|rahi) (?:hoon|hun)\b/iu.test(narration))) {
    issues.push("Keep the companion persona's grammatical gender consistent; quoted words for the user are separate.");
  }
  if (/\b(?:likh lo|kar lo|batao|socho)\b/iu.test(narration)) {
    issues.push("Use respectful aap forms consistently instead of informal instructions.");
  }
  return issues;
}
