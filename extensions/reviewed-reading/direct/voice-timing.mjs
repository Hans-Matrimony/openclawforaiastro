import {fallbackFactor} from './fallback-factors.mjs';
import {timingCorrection} from './timing-correction.mjs';

// Use constrained selection only when every supplied career factor has a
// known rendering. Otherwise retain the full agent, including additional tools.
export function preparedVoiceTiming(results, value, now) {
  if (value.reply_surface !== 'voice' || !/\b(career|job|naukri)\b/i.test(value.query)) return null;
  let rows;
  try { rows = results.map(text => JSON.parse(text)); } catch { return null; }
  if (rows.some(row => !row || row.engine !== 'local-sweph-v2' || !Array.isArray(row.verdict_signals))) return null;
  const signals = rows.flatMap(row => row.verdict_signals).filter(s => s?.area === 'career');
  if (signals.length !== 1) return null;
  if (!['positive', 'negative'].every(key => Array.isArray(signals[0][key]))) return null;
  const factors = ['positive', 'negative'].flatMap(key => Array.isArray(signals[0][key]) ? signals[0][key] : []);
  if (!factors.length || factors.some(source => {
    const rendered = fallbackFactor(source, ['english', 'en'].includes(value.language));
    return !rendered || rendered === source;
  })) return null;
  return timingCorrection(results, value.query, value.language, now);
}
