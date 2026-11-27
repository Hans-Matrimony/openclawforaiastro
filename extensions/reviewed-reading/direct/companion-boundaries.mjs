const quoted=/```[\s\S]*?```|`[^`\n]*`|"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’|https?:\/\/\S+/gu;

export const companionBoundaryInstruction=`Do not infer another person's thoughts or motives from an interruption, silence or a block, even with "it seems". Describe the reported action and ask only about a genuinely missing detail. Do not promise another person will return, initiate contact or become ready. If someone has blocked the user, advise against bypassing the block with another number or an uninvited workplace visit; leave their future choice unknown. Use respectful aap outside a requested draft or quotation. For a copyable message, give the message itself in the requested tone, without interpreting the recipient's mind, an accusatory preface or extra advice. A follow-up must be a complete natural question and must not ask for information already stated in the current message. For a comparison, address both options and distinguish what is supported for each; a single-option observation is not an answer to the comparison.`;

import {requestedMessageDraft} from './companion-language.mjs';

export function blockedContactQuestion(value) {
  return /\bblock\w*\b|ब्लॉक/iu.test(value.query)&&
    /\b(?:number|office|workplace|contact|message|milne|jaun|jaaoon)\b|नंबर|नम्बर|ऑफिस|दफ्तर/iu.test(value.query);
}

export function companionAddressText(reply,value) {
  // A requested message speaks to its recipient, not to the user. Its informal
  // register is allowed; the semantic reviewer still checks any surrounding prose.
  if(requestedMessageDraft(value))return '';
  return reply.replace(quoted,'');
}

export function companionBoundaryIssue(reply,value) {
  const prose=reply.replace(quoted,'');
  if(/^(?:hinglish|hindi|hi)$/iu.test(value.language??'')&&
    /\b(?:tu|tujhe|tujhko|tera|teri|tere)\b/iu.test(companionAddressText(reply,value)))
    return 'Use respectful aap address outside quotations or the requested draft, with matching grammar.';
  const clauses=prose.split(/[.!?\n।]+|\b(?:but|lekin|magar)\b/iu);
  if(clauses.some(clause=>
    /\b(?:woh|wo|vo|she|he|they)\b[^.!?\n]{0,65}\b(?:khud\s+)?(?:aayenge|aayegi|aayega|lautenge|lautegi|lautega)\b|\b(?:she|he|they)\s+(?:will|shall)\s+(?:come back|return|contact|reach out)|(?:वो|वह|वे)[^।.!?\n]{0,55}(?:लौटेंगे|लौटेगी|लौटेगा|खुद आएंगे)/iu.test(clause)&&
    !/\b(?:cannot|can't|don't know|do not know|unknown|whether|nahi|nahin)\b|नहीं|पता नहीं/iu.test(clause)))
    return 'Remove the unsupported promise about another person returning or initiating contact. Their future decision is unknown; retain the useful present guidance.';
  return null;
}

// A failed optional wording repair must not replace a sound contact boundary
// with an outage, or leak a rejected promise back to the user.
export function blockedContactFallback(value) {
  if(!blockedContactQuestion(value))return null;
  return value.language==='english'?
    'Please do not use another number or visit their workplace to get around the block. Give them space; whether they choose to contact you later is up to them.':
    value.language==='hindi'?
    'दूसरे नंबर से संदेश भेजना या उनके दफ्तर जाना ठीक नहीं होगा। अभी उनकी दूरी का सम्मान कीजिए; आगे संपर्क करना उनका अपना फैसला है।':
    'Doosre number se message bhejna ya unke office jaana theek nahi hoga. Abhi unki doori ka samman kijiye; aage contact karna unka apna faisla hai.';
}
