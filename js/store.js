// Data layer. Everything is cached in localStorage so the app works offline;
// when Supabase is configured, writes are sent there too (and queued for
// retry if the network is down) and reads refresh from it.

import { CONFIG } from './config.js';

const KEYS = { results: 'kq.results', puzzles: 'kq.puzzles', pending: 'kq.pending' };

const url = (CONFIG.supabaseUrl || '').replace(/\/+$/, '');
const key = CONFIG.supabaseAnonKey || '';
export const remoteEnabled = Boolean(url && key);

function lsGet(k, fallback) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function lsSet(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ }
}

async function rest(path, { method = 'GET', body, prefer } = {}) {
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  // Legacy anon keys are JWTs and go in Authorization too; new publishable
  // keys must only be sent as `apikey`.
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

// ---------- local cache ----------

function localResults() { return lsGet(KEYS.results, []); }

function putLocalResult(row, overwrite) {
  const all = localResults();
  const i = all.findIndex(r => r.player === row.player && r.puzzle_date === row.puzzle_date);
  if (i >= 0 && !overwrite) return false;
  if (i >= 0) all[i] = row; else all.push(row);
  lsSet(KEYS.results, all);
  return true;
}

function putLocalPuzzle(date, puzzle) {
  const all = lsGet(KEYS.puzzles, {});
  all[date] = puzzle;
  // Keep the cache small: last 60 puzzles.
  const dates = Object.keys(all).sort();
  for (const d of dates.slice(0, Math.max(0, dates.length - 60))) delete all[d];
  lsSet(KEYS.puzzles, all);
}

// ---------- remote writes with retry queue ----------

async function sendOp(op) {
  if (op.type === 'result') {
    await rest('results?on_conflict=player,puzzle_date', {
      method: 'POST',
      body: op.row,
      prefer: `resolution=${op.overwrite ? 'merge' : 'ignore'}-duplicates,return=minimal`,
    });
  } else if (op.type === 'puzzle') {
    await rest('puzzles?on_conflict=puzzle_date', {
      method: 'POST',
      body: { puzzle_date: op.date, size: op.puzzle.size, regions: op.puzzle.regions, colors: op.puzzle.colors },
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
  }
}

async function write(op) {
  if (!remoteEnabled) return { synced: false };
  try {
    await sendOp(op);
    return { synced: true };
  } catch (err) {
    const pending = lsGet(KEYS.pending, []);
    pending.push(op);
    lsSet(KEYS.pending, pending);
    return { synced: false, error: err };
  }
}

export async function flushPending() {
  if (!remoteEnabled) return;
  const pending = lsGet(KEYS.pending, []);
  if (!pending.length) return;
  const left = [];
  for (const op of pending) {
    try { await sendOp(op); } catch { left.push(op); }
  }
  lsSet(KEYS.pending, left);
}

export function pendingCount() { return lsGet(KEYS.pending, []).length; }

// ---------- public API ----------

export async function loadPuzzle(date) {
  const cached = lsGet(KEYS.puzzles, {})[date] || null;
  if (!remoteEnabled) return cached;
  try {
    const rows = await rest(`puzzles?puzzle_date=eq.${date}&select=size,regions,colors`);
    if (rows && rows[0]) {
      const p = { size: rows[0].size, regions: rows[0].regions, colors: rows[0].colors };
      putLocalPuzzle(date, p);
      return p;
    }
  } catch { /* offline: use cache */ }
  return cached;
}

export async function savePuzzle(date, puzzle) {
  putLocalPuzzle(date, puzzle);
  return write({ type: 'puzzle', date, puzzle });
}

export async function loadResults() {
  if (!remoteEnabled) return localResults();
  try {
    await flushPending();
    const rows = await rest('results?select=player,puzzle_date,seconds&order=puzzle_date.desc&limit=2000');
    // Remote is the source of truth, plus anything still waiting to sync.
    const merged = rows.map(r => ({ player: r.player, puzzle_date: r.puzzle_date, seconds: r.seconds }));
    for (const op of lsGet(KEYS.pending, [])) {
      if (op.type !== 'result') continue;
      const i = merged.findIndex(r => r.player === op.row.player && r.puzzle_date === op.row.puzzle_date);
      if (i < 0) merged.push(op.row); else if (op.overwrite) merged[i] = op.row;
    }
    lsSet(KEYS.results, merged);
    return merged;
  } catch {
    return localResults();
  }
}

// overwrite=false keeps the first recorded time (used for in-app solves);
// overwrite=true replaces it (used for typed-in times).
export async function saveResult(player, date, seconds, { overwrite = false } = {}) {
  const row = { player, puzzle_date: date, seconds: Math.round(seconds) };
  const stored = putLocalResult(row, overwrite);
  if (!stored) return { synced: false, duplicate: true };
  return write({ type: 'result', row, overwrite });
}

// ---------- in-progress game (this device only) ----------

export function loadProgress(date) { return lsGet(`kq.progress.${date}`, null); }
export function saveProgress(date, progress) { lsSet(`kq.progress.${date}`, progress); }
export function clearProgress(date) { try { localStorage.removeItem(`kq.progress.${date}`); } catch { /* ignore */ } }

export function loadSetting(name, fallback) { return lsGet(`kq.setting.${name}`, fallback); }
export function saveSetting(name, value) { lsSet(`kq.setting.${name}`, value); }
