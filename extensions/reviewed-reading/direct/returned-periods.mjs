// Keep period levels explicit when comparing the schedule returned by a tool.
// This selects no event date and calculates no new periods.
export function upcomingPeriods(schedule) {
  const minor = Array.isArray(schedule?.upcoming_antardashas) ? schedule.upcoming_antardashas : [];
  return [
    ...minor.map(p => ({...p, kind:'antardasha'})),
    ...(schedule?.next_mahadasha ? [{...schedule.next_mahadasha, kind:'mahadasha'}] : []),
  ].filter(p => {
    if (!/^(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu)$/.test(p.lord ?? '') ||
        typeof p.from !== 'string' || typeof p.to !== 'string' || p.from >= p.to) return false;
    return [p.from,p.to].every(value => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const parsed = new Date(value+'T00:00:00Z');
      return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0,10) === value;
    });
  });
}
