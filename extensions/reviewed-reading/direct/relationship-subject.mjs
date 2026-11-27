// Topic vocabulary, not a reading request: "I love you" and love of work
// remain ordinary conversation. The caller still decides prediction vs chat.
export function isLoveLifeQuestion(query) {
 return /\b(?:love[ -]+life|romantic[ -]+life|romance|dating(?:[ -]+life)?|pya+ar|pya+r|mohabbat|prem)\b|प्रेम(?:\s*जीवन)?|प्यार|प्‍यार|लव\s*लाइफ|रोमांटिक\s*जीवन/iu.test(query);
}
