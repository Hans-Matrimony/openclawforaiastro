import {canAskFollowup} from './friendly-closing.mjs';
import {repeatsClarification} from './conversation-progress.mjs';

const protectedText=/```[\s\S]*?```|`[^`\n]*`|"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’|https?:\/\/\S+/gu;

export function continuationPolicy(value) {
  const query=value.query.replace(protectedText,'');
  const current={...value,query};
  if(!canAskFollowup('Normal prose.',current,true))return {mode:'quiet',reason:'no_questions'};
  if(/\b(?:just listen|only listen|listen only|bas (?:meri baat )?sun\w*|sirf (?:meri baat )?sun\w*)\b|बस\s+(?:मेरी\s+बात\s+)?सुन|सिर्फ\s+(?:मेरी\s+बात\s+)?सुन/iu.test(query))
    return {mode:'quiet',reason:'listening_only'};
  if(/^\s*(?:thank(?:s| you)(?: so much)?|bye|goodbye|good night|bas abhi itna hi|shukriya|dhanyavaad|धन्यवाद|शुक्रिया|शुभ रात्रि)[.!।\s]*$/iu.test(query))
    return {mode:'quiet',reason:'user_closure'};
  if(/\b(?:translate|draft|write (?:a|an|the|this)|repeat exactly|json|csv|exactly\s+\w+\s+(?:short\s+)?(?:lines|sentences|words|steps)|(?:bas|sirf|only|just)\s+.{0,25}(?:lines|sentences|steps)|(?:do|teen|char|three|two|four)\s+(?:chhoti\s+|short\s+)?lines?\s+mein)\b|अनुवाद|मसौदा|(?:दो|तीन|चार)\s+(?:छोटी\s+)?(?:पंक्ति|लाइन|वाक्य)/iu.test(query))
    return {mode:'format',reason:'requested_artifact_or_length'};
  return {mode:'continue',reason:'open_conversation'};
}

export const continuationInstruction=`Keep the conversation open naturally after answering the current request completely. Use continuation_policy, not a generic closing script. In continue mode, finish with ONE short, relevant question that moves this particular exchange forward. Ask about one useful detail not already supplied, the user's present experience, or their priority. Respond to a short answer using your own last question; do not restart the topic or ask the same thing again. Preserve who did what: first-person statements in a user message belong to the user. When a user continues a workplace or family story with "they weren't listening", keep that complaint about the people in the reported event; do not turn it into criticism of the assistant or apologize as though you interrupted them. Only treat it as a correction of you when the dialogue actually supports that. A changed actor is an unsupported fact and must be rejected in review, not treated as style. Stay with the user's present concern rather than switching to project details or advice merely because they mentioned a project. Do not substitute a question for the answer, invent circumstances, turn a question into an unsupported prediction, or offer a menu of services. Avoid "anything else", "hope that helps", "let me know", "would you like more", a repeated verdict, farewell or forced summary. Do not keep users talking after they want to pause or leave. In quiet mode, ask NO questions, including rhetorical questions in an outline; express any template as statements. In format mode, deliver the requested artifact or exact length without appending a question; questions belonging to a requested quotation or draft may remain. Honor these exceptions silently, without repeating the user's no-question instruction. A conversation need not end with a question when the user explicitly wants quiet, a finished artifact or a goodbye. Acknowledge feelings without inventing human experiences, motives or future outcomes.`;

export function continuationIssue(reply,value,policy=continuationPolicy(value)) {
  const prose=reply.replace(protectedText,'');
  const questions=prose.match(/[?？]/gu)??[];
  if(policy.mode==='quiet')return questions.length
    ? 'Respect the request for no questions or quiet listening. Rewrite question-form template lines as statements and do not add a follow-up.' : null;
  if(policy.mode==='format')return null;
  if(!questions.length)return 'The answer stops without continuing this open conversation. Keep the complete answer and finish with one short, relevant question about a useful detail not already supplied.';
  if(questions.length>1||!/[?？]\s*$/u.test(prose))return 'Use only one conversational question, as the final sentence, after the complete answer. Do not bundle questions or add a conclusion after it.';
  if(repeatsClarification(reply,value.history??[]))return 'The follow-up repeats an earlier question. Use the user\'s answer and ask about a new relevant detail instead.';
  if(/\b(?:anything else|hope (?:this|that) helps|let me know|would you like (?:me to |some |any )?(?:explain|help|more))\b|aur kuch|kuch aur bata/iu.test(prose))
    return 'Replace the generic service closing with a specific question that follows the actual conversation; do not repeat the verdict or close the exchange.';
  return null;
}
