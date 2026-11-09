// Presentation validation only; scores and factor order come from the tool.
const names = ['Varna', 'Vashya', 'Tara', 'Yoni', 'Graha Maitri', 'Gana', 'Bhakoot', 'Nadi'];

export function verifiedGuna(results) {
  const reports = results.flatMap(raw => {
    try { const value = JSON.parse(raw)?.guna_milan; return value?.status === 'ok' ? [value] : []; }
    catch { return []; }
  });
  if (reports.length !== 1) return null;
  const g = reports[0];
  if (g.score_max !== 36 || !Number.isFinite(g.score_points) || g.factors?.length !== 8) return null;
  if (!g.factors.every((f, i) => f.name === names[i] && f.max_score === i + 1 &&
      Number.isFinite(f.score) && f.score >= 0 && f.score <= f.max_score)) return null;
  return g.factors.reduce((sum, f) => sum + f.score, 0) === g.score_points ? g : null;
}

export function invalidGunaPresentation(reply, results, query = '') {
  const g = verifiedGuna(results);
  if (!g) return false;
  const allFactors = /\b(?:factors?|eight|aath|ashtakoota)\b|आठ|अष्टकूट/iu.test(query);
  for (const f of g.factors) {
    const pattern = new RegExp('\\b' + f.name.replaceAll(' ', '\\s+') + '\\s*[:=]?\\s*(\\d+(?:\\.\\d+)?)\\s*\\/\\s*(\\d+(?:\\.\\d+)?)([^;,.\\n]*(?:\\([^)]*\\))?)', 'gi');
    const claims = [...reply.matchAll(pattern)];
    if (allFactors && claims.length !== 1) return true;
    for (const match of claims) {
      if (+match[1] !== f.score || +match[2] !== f.max_score) return true;
      if (f.score === f.max_score && /^\s*\(\s*(?:kam|kamzor|weak|low|poor)\s*\)/i.test(match[3])) return true;
      if (f.score === 0 && /^\s*\(\s*(?:strong|high|full|perfect)\s*\)/i.test(match[3])) return true;
    }
  }
  return false;
}

export function verifiedGunaFallback(results, language) {
  const g = verifiedGuna(results);
  if (!g) return null;
  const factors = g.factors.map(f => `${f.name}: ${f.score}/${f.max_score}`).join('; ');
  const note = /^(?:hi|hindi)(?:-|$)/i.test(language ?? '')
    ? 'यह पारंपरिक आकलन है; सफल रिश्ते की गारंटी नहीं।'
    : language === 'hinglish' ? 'Yeh paramparik aakalan hai; rishte ki safalta ki guarantee nahi.'
      : 'This traditional assessment does not guarantee relationship success.';
  return `${factors}.\n\nGuna Milan: ${g.score_points}/36. ${note}`;
}
