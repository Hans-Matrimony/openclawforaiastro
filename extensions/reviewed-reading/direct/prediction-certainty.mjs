// Scope this to a reading, not user testimony or the companion's social reply.
// A qualification elsewhere must not excuse a separate guaranteed prediction.
export function hasPredictionGuarantee(reply) {
  return reply.split(/[.!?;।\n]|\b(?:but|lekin|magar)\b/iu).some((clause) => {
    const text = clause.toLowerCase();
    for (const match of text.matchAll(
      /\b(?:pakk[aie]|guaranteed|definitely|certainly|100\s*percent)\b|100\s*%|पक्क[ाीे]|निश्चित रूप से/giu,
    )) {
      const before = text.slice(0, match.index).trim();
      const after = text.slice(match.index + match[0].length).trim();
      // "not guaranteed" / "pakki nahi hai" are qualifications, not guarantees.
      if (
        /\b(?:not|never|isn't|is not|nahi|nahin)\s*$/iu.test(before) ||
        /(?:नहीं|नही)\s*$/u.test(before) ||
        /^(?:(?:hai|hain|hoga|hogi)\s+)?(?:nahi|nahin)\b|^(?:नहीं|नही)/iu.test(after)
      ) {
        continue;
      }
      return true;
    }
    return false;
  });
}
