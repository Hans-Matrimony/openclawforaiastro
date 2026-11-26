// Narrow presentation edits to conversational drafts, before semantic review.
// Quoted speech, code and URLs retain their original wording.
const protectedText=/(```[\s\S]*?```|`[^`\n]*`|"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’|(?<!\w)'[^'\n]*'(?!\w)|https?:\/\/[^\s]+)/gu;
const pronouns={tum:'aap',tumne:'aapne',tumhe:'aapko',tumko:'aapko',tumhara:'aapka',tumhari:'aapki',tumhare:'aapke'};
const imperatives={karo:'kijiye',batao:'bataiye',rakho:'rakhiye',dekho:'dekhiye',suno:'suniye'};
const mapped=(word,words)=>word[0]===word[0].toUpperCase()?words[word.toLowerCase()].replace(/^./u,c=>c.toUpperCase()):words[word.toLowerCase()];
function respectful(text) {
  return text
    .replace(/\b(?:tum|tumne|tumhe|tumko|tumhara|tumhari|tumhare)\b/giu,word=>mapped(word,pronouns))
    .replace(/\b(kar|dekh|rakh|le|pi|sun|soch|samajh|likh|padh|bol|kha|pooch|mat|saans)\s+lo\b/giu,'$1 lijiye')
    .replace(/\b(keh|bata|bol)\s+do\b/giu,'$1 dijiye')
    .replace(/\b(?:karo|batao|rakho|dekho|suno)\b/giu,word=>mapped(word,imperatives))
    .replace(/\b(sakte|sakti|chahte|chahti)\s+ho\b/giu,'$1 hain')
    .replace(/\baap\s+ho\b(?!\s+(?:sakt|rahe|rahi|gaye|gayi))/giu,'aap hain')
    // This impersonal feeling construction needs no assumption about gender.
    .replace(/(^|[.!?]\s+)((?:(?:Aaj|Abhi)\s+)?(?:bahut\s+)?)akel[ai]\s+feel\s+ho\s+rah[ai]\s+hai\b/giu,'$1$2akelapan mehsoos ho raha hai');
}
export function normalizeCompanionLanguage(reply,value) {
  if(!/^(?:hinglish|hindi|hi)$/iu.test(value.language??''))return reply;
  return reply.split(protectedText).map((part,index)=>index%2?part:respectful(part)).join('');
}
