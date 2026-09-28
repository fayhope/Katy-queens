// Dates are local-calendar "YYYY-MM-DD" strings throughout.

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function prettyDate(key, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
}

export function formatTime(seconds) {
  if (seconds == null) return '—';
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

// "1:23", "83", "1:02:03" -> seconds, or null when unreadable.
export function parseTime(text) {
  const t = String(text).trim();
  if (!/^\d+(:\d{1,2}){0,2}$/.test(t)) return null;
  const parts = t.split(':').map(Number);
  if (parts.slice(1).some(p => p > 59)) return null;
  const s = parts.reduce((acc, p) => acc * 60 + p, 0);
  return s > 0 ? s : null;
}

// Current streak counts back from today, or from yesterday if today isn't
// played yet (so the streak isn't "lost" until the day is actually over).
export function streaks(dates, today = dateKey()) {
  const set = new Set(dates);
  let current = 0;
  let day = set.has(today) ? today : addDays(today, -1);
  while (set.has(day)) { current++; day = addDays(day, -1); }

  let best = 0, run = 0, prev = null;
  for (const d of [...set].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best, playedToday: set.has(today) };
}

// results: [{ player, puzzle_date, seconds }]
export function leaderboard(results, players, today = dateKey()) {
  const byPlayer = new Map(players.map(p => [p, new Map()]));
  for (const r of results) {
    if (!byPlayer.has(r.player)) byPlayer.set(r.player, new Map());
    byPlayer.get(r.player).set(r.puzzle_date, r.seconds);
  }
  const days = [...new Set(results.map(r => r.puzzle_date))].sort().reverse();

  const wins = new Map([...byPlayer.keys()].map(p => [p, 0]));
  for (const day of days) {
    const times = [...byPlayer].map(([p, m]) => [p, m.get(day)]).filter(([, s]) => s != null);
    if (times.length < 2) continue;
    const bestTime = Math.min(...times.map(([, s]) => s));
    const winners = times.filter(([, s]) => s === bestTime);
    if (winners.length === 1) wins.set(winners[0][0], wins.get(winners[0][0]) + 1);
  }

  const rows = [...byPlayer].map(([player, m]) => {
    const secs = [...m.values()];
    const last30 = [...m].filter(([d]) => d > addDays(today, -30)).map(([, s]) => s);
    const s = streaks([...m.keys()], today);
    return {
      player,
      today: m.get(today) ?? null,
      played: secs.length,
      wins: wins.get(player),
      bestTime: secs.length ? Math.min(...secs) : null,
      average: last30.length ? last30.reduce((a, b) => a + b, 0) / last30.length : null,
      currentStreak: s.current,
      bestStreak: s.best,
    };
  });
  rows.sort((a, b) => b.wins - a.wins || b.currentStreak - a.currentStreak || (a.average ?? 1e9) - (b.average ?? 1e9));

  const history = days.map(day => ({
    day,
    times: Object.fromEntries([...byPlayer].map(([p, m]) => [p, m.get(day) ?? null])),
  }));
  return { rows, history };
}
