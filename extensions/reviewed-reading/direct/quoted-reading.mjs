import {isPersonalChartQuestion} from './reading-intent.mjs';
import {selectedSelfBirth} from './selected-self-birth.mjs';

const topics = [
  [/\b(?:marriage|marry|wedding|sha+di)\b/iu, 'Meri shaadi ke baare mein batao'],
  [/\b(?:career|job|naukri|promotion)\b/iu, 'Mera career ke baare mein batao'],
  [/\b(?:education|studies|study|exams?|padhai)\b/iu, 'Meri padhai ke baare mein batao'],
  [/\b(?:finances?|financial|money|income|salary|paisa|paise)\b/iu, 'Meri finances ke baare mein batao'],
];

export function quotedSelfReading(value) {
  const quote = value.reply_to;
  if (!quote || typeof quote.text !== 'string') return null;
  if (quote.role === 'user') {
    return isPersonalChartQuestion(quote.text) && selectedSelfBirth(quote.text, value.birth)
      ? quote.text : null;
  }
  if (quote.role !== 'assistant') return null;
  // A quote may select a subject, never supply calculation evidence, dates or
  // another person's profile. Ambiguous and multi-topic quotes stay unresolved.
  if (/\b(?:sister|brother|mother|father|daughter|son|behen|bhai|dost|friend|his|her|their|uski|uska|unki|unka|dob|born|birth|janm|janam|correct|change|update|replace)\b/iu.test(quote.text)) return null;
  const matches = topics.filter(([pattern]) => pattern.test(quote.text));
  if (matches.length !== 1) return null;
  const [topic, question] = matches[0];
  const clauses = quote.text.split(/[.!?\n]+/u);
  const own = clauses.some(clause => {
    const address = clause.match(/\b(?:your|aapki|aapka|aapke|tumhari|tumhara|tumhare)\b/iu);
    return address && topic.test(clause.slice(address.index + address[0].length, address.index + address[0].length + 80));
  });
  return own && selectedSelfBirth(question, value.birth) ? question : null;
}
