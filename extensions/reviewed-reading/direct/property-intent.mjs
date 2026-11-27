// Recognize a purchase/ownership subject without interpreting it as a request
// for astrology. Practical advice and a requested forecast have separate routes.
export function isPropertyQuestion(query) {
  return /\b(?:property|real estate|home ownership|home purchase)\b/iu.test(query)||
    /\b(?:buy\w*|purchas\w*|own\w*)\b[^.!?\n]{0,55}\b(?:home|house|flat|apartment|land)\b/iu.test(query)||
    /\b(?:home|house|flat|apartment|land)\b[^.!?\n]{0,55}\b(?:buy\w*|purchas\w*|own\w*)\b/iu.test(query)||
    /\b(?:ghar|makaan|makan|zameen|zamin)\b[^.!?\n]{0,55}\b(?:kha?r[ie]*d\w*|len[aei]|lunga|lungi|banwa\w*)\b/iu.test(query)||
    /\b(?:kha?r[ie]*d\w*)\b[^.!?\n]{0,55}\b(?:ghar|makaan|makan|zameen|zamin)\b/iu.test(query)||
    /(?:घर|मकान|ज़मीन|जमीन)[^।.!?\n]{0,55}(?:खरीद|लूँ|लूं|लेना|बनवा)|(?:खरीद)[^।.!?\n]{0,55}(?:घर|मकान|ज़मीन|जमीन)/u.test(query);
}
