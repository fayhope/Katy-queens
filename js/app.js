import { CONFIG } from './config.js';
import { EMPTY, CROSS, QUEEN, findConflicts, isSolved, attackedCells, solve, validateRegions, normalizeRegions } from './queens.js';
import { fileToImage, detectBoard, detectGridSize, extractPuzzle, clampBox, MIN_SIZE, MAX_SIZE } from './parser.js';
import { dateKey, prettyDate, formatTime, parseTime, streaks, leaderboard } from './stats.js';
import { parseCode } from './code.js';
import * as store from './store.js';

// ---------- icons ----------

const ICONS = {
  crown: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2.5 7.5l5 4.2L12 4l4.5 7.7 5-4.2L19.3 18H4.7L2.5 7.5z"/><rect x="4.7" y="19.2" width="14.6" height="2.3" rx="1"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 2h10v2h4v3.5A4.5 4.5 0 0 1 16.8 12a5 5 0 0 1-3.8 3.4V18h3.5v3h-9v-3H11v-2.6A5 5 0 0 1 7.2 12 4.5 4.5 0 0 1 3 7.5V4h4V2zm0 4H5v1.5a2.5 2.5 0 0 0 2 2.4V6zm10 0v3.9a2.5 2.5 0 0 0 2-2.4V6h-2z"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 1.5c.6 3.4-2 5.3-2 8 0 1.3.9 2.3 2.1 2.3 1.5 0 2.3-1.2 2.1-3 2.6 2 4.3 4.7 4.3 7.6 0 4.2-3.4 7.1-7.5 7.1S4.5 20.6 4.5 16.4C4.5 9.8 11 7.2 13 1.5z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
  clear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/></svg>',
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l5 5M11 6l-5 5M13 13l5 5M18 13l-5 5"/><path d="M15 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="currentColor"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 17v3h16v-3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  paste: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 3L2 20h20L12 3zM12 10v4M12 17v.5"/></svg>',
};

const AVATAR_COLOURS = ['#bba3e2', '#96beff', '#ffc992', '#b3dfa0', '#dfa0bf', '#a3d2d8'];

// ---------- state ----------

const state = {
  view: 'play',
  date: dateKey(),
  loading: true,
  puzzle: null,
  marks: [],
  history: [],
  elapsed: 0,          // ms, excluding time the app was hidden
  runningSince: null,  // Date.now() when the clock last started
  solved: false,
  practice: false,     // replaying an already-solved puzzle: not recorded
  solvedSeconds: null,
  autoX: store.loadSetting('autoX', false),
  results: [],
  importing: null,
};

const $app = document.getElementById('app');
const $fileInput = document.getElementById('fileInput');
let timerInterval = null;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), ms);
}

function avatarColour(name) {
  const i = CONFIG.players.indexOf(name);
  return AVATAR_COLOURS[(i >= 0 ? i : name.length) % AVATAR_COLOURS.length];
}

// ---------- boot ----------

async function boot() {
  document.querySelector('.brand-mark').innerHTML = ICONS.crown;
  document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = ICONS[el.dataset.icon]; });
  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => show(tab.dataset.view)));
  $fileInput.addEventListener('change', onFileChosen);
  document.addEventListener('visibilitychange', onVisibility);

  const initial = location.hash === '#leaderboard' ? 'leaderboard' : 'play';
  const linkCode = codeFromHash();
  show(initial);
  await loadDay();
  if (linkCode) openCode(linkCode);
  window.addEventListener('hashchange', () => { const c = codeFromHash(); if (c) openCode(c); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// Links from Claude look like https://<site>/#q=POOOOOO.POOOBBO...
// Optional &d=YYYY-MM-DD picks the day (defaults to today).
function codeFromHash() {
  const m = location.hash.match(/[#&]q=([^&]+)/);
  if (!m) return null;
  const d = location.hash.match(/[#&]d=(\d{4}-\d{2}-\d{2})/);
  return { code: decodeURIComponent(m[1]), date: d ? d[1] : null };
}

async function loadDay() {
  state.loading = true;
  render();
  const [puzzle, results] = await Promise.all([store.loadPuzzle(state.date), store.loadResults()]);
  state.results = results;
  setPuzzle(puzzle);
  state.loading = false;
  render();
  renderStreakPill();
}

function setPuzzle(puzzle) {
  stopClock();
  state.puzzle = puzzle;
  state.history = [];
  state.solved = false;
  state.practice = false;
  state.solvedSeconds = null;
  state.elapsed = 0;
  if (!puzzle) { state.marks = []; return; }

  const n = puzzle.size * puzzle.size;
  const progress = store.loadProgress(state.date);
  const official = state.results.find(r => r.player === CONFIG.player && r.puzzle_date === state.date);
  if (progress && progress.size === puzzle.size && progress.marks?.length === n) {
    state.marks = progress.marks;
    state.elapsed = progress.elapsed || 0;
    state.solved = Boolean(progress.solved);
    state.practice = Boolean(progress.practice);
    state.solvedSeconds = progress.solvedSeconds ?? null;
  } else {
    state.marks = new Array(n).fill(EMPTY);
  }
  if (official && !state.practice) {
    // Already solved today (maybe on another device).
    state.solved = true;
    state.solvedSeconds = official.seconds;
  }
}

function onVisibility() {
  if (document.hidden) {
    pauseClock();
    saveProgress();
    return;
  }
  if (dateKey() !== state.date) {
    state.date = dateKey();
    state.importing = null;
    if (state.view === 'import') state.view = 'play';
    loadDay();
    return;
  }
  if (state.view === 'play') startClockIfPlaying();
  if (!state.puzzle && state.view === 'play') {
    store.loadPuzzle(state.date).then(p => { if (p && !state.puzzle) { setPuzzle(p); render(); } });
  }
  store.loadResults().then(r => { state.results = r; renderStreakPill(); if (state.view === 'leaderboard') render(); });
}

function show(view) {
  state.view = view;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view || (['import', 'sent'].includes(view) && t.dataset.view === 'play')));
  history.replaceState(null, '', view === 'leaderboard' ? '#leaderboard' : location.pathname + location.search);
  if (view !== 'play') pauseClock();
  render();
  window.scrollTo({ top: 0 });
}

function render() {
  if (state.view === 'leaderboard') return renderLeaderboard();
  if (state.view === 'import') return renderImport();
  if (state.view === 'sent') return renderSent();
  return renderPlay();
}

function renderStreakPill() {
  const mine = state.results.filter(r => r.player === CONFIG.player).map(r => r.puzzle_date);
  const s = streaks(mine, state.date);
  const pill = document.getElementById('streakPill');
  pill.innerHTML = `${ICONS.flame}<span>${s.current}</span>`;
  pill.classList.toggle('cold', !s.playedToday);
  pill.title = `${CONFIG.player}'s streak: ${s.current} day${s.current === 1 ? '' : 's'}${s.playedToday ? '' : ' (play today to keep it going)'}`;
}

// ---------- clock ----------

function currentMs() {
  return state.elapsed + (state.runningSince ? Date.now() - state.runningSince : 0);
}

function startClockIfPlaying() {
  if (!state.puzzle || state.solved || state.runningSince || document.hidden) return;
  state.runningSince = Date.now();
  clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 250);
}

function pauseClock() {
  if (state.runningSince) {
    state.elapsed += Date.now() - state.runningSince;
    state.runningSince = null;
  }
  clearInterval(timerInterval);
}

function stopClock() { pauseClock(); }

function updateTimer() {
  const el = document.getElementById('timer');
  if (!el) return;
  const secs = state.solved && !state.practice ? state.solvedSeconds : Math.floor(currentMs() / 1000);
  el.querySelector('span').textContent = formatTime(secs);
}

function saveProgress() {
  if (!state.puzzle) return;
  store.saveProgress(state.date, {
    size: state.puzzle.size,
    marks: state.marks,
    elapsed: currentMs(),
    solved: state.solved,
    practice: state.practice,
    solvedSeconds: state.solvedSeconds,
  });
}

// ---------- play view ----------

function renderPlay() {
  if (state.loading) { $app.innerHTML = '<div class="spinner" aria-label="Loading"></div>'; return; }
  if (!state.puzzle) return renderEmpty();

  const { size } = state.puzzle;
  const done = state.solved && !state.practice;
  $app.innerHTML = `
    <div class="game-head">
      <div>
        <h1 class="game-title">Queens</h1>
        <div class="game-date">${esc(prettyDate(state.date, { weekday: 'long', day: 'numeric', month: 'long' }))}${state.practice ? ' · practice' : ''}</div>
      </div>
      <div class="timer ${done ? 'done' : ''}" id="timer">${done ? ICONS.check : ICONS.clock}<span></span></div>
    </div>
    <div class="board-wrap"><div class="board" id="board" style="--n:${size}"></div></div>
    <div class="toolbar">
      <button class="icon-btn" id="undoBtn" type="button">${ICONS.undo}Undo</button>
      <button class="icon-btn" id="clearBtn" type="button">${ICONS.clear}Clear</button>
      <button class="icon-btn ${state.autoX ? 'on' : ''}" id="autoBtn" type="button" aria-pressed="${state.autoX}">${ICONS.auto}Auto ×</button>
    </div>
    ${done ? solvedCard() : `
      <p class="how">Place one <b>queen</b> in every row, column and colour. Queens can't touch, not even diagonally.
      Tap once for <b>×</b>, twice for a queen. Drag to fill in ×s.</p>`}
    <div class="center" style="margin-top:16px">
      ${done
        ? `<button class="btn ghost" id="practiceBtn" type="button">Play again for practice</button>`
        : state.practice
          ? `<button class="btn ghost" id="endPracticeBtn" type="button">Back to today's result</button>`
          : `<button class="btn ghost small" id="replaceBtn" type="button">${ICONS.upload}Upload a different screenshot</button>`}
    </div>`;

  const board = document.getElementById('board');
  buildBoard(board, state.puzzle);
  updateBoard();
  attachPlayInput(board);
  updateTimer();

  document.getElementById('undoBtn').onclick = undo;
  document.getElementById('clearBtn').onclick = clearBoard;
  document.getElementById('autoBtn').onclick = () => {
    state.autoX = !state.autoX;
    store.saveSetting('autoX', state.autoX);
    const b = document.getElementById('autoBtn');
    b.classList.toggle('on', state.autoX);
    b.setAttribute('aria-pressed', state.autoX);
    updateBoard();
  };
  const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  bind('practiceBtn', startPractice);
  bind('endPracticeBtn', endPractice);
  const okToReplace = () => !state.marks.some(m => m !== EMPTY) || confirm('Replace today\'s puzzle? Your progress on this board will be lost.');
  bind('replaceBtn', () => { if (okToReplace()) $fileInput.click(); });
  bind('lbBtn', () => show('leaderboard'));
  startClockIfPlaying();
}

function renderEmpty() {
  const demo = [0, 1, 1, 0, 2, 1, 3, 3, 2];
  const demoColours = ['#bba3e2', '#ffc992', '#96beff', '#b3dfa0'];
  $app.innerHTML = `
    <div class="card hero">
      <div class="hero-board" aria-hidden="true">
        ${demo.map((g, i) => `<span style="background:${demoColours[g]}">${i === 4 ? ICONS.crown : ''}</span>`).join('')}
      </div>
      <h1>Today's puzzle is on its way</h1>
      <p>Today's board will appear here as soon as it's ready. Check back in a little while!</p>
      <div class="row" style="justify-content:center;flex-wrap:wrap">
        <button class="btn primary" id="refreshBtn" type="button">Check again</button>
      </div>
    </div>
    <p class="how center">Can't wait? <button class="linklike" id="uploadBtn" type="button">Upload a screenshot of the board yourself</button>.</p>`;
  document.getElementById('refreshBtn').onclick = async () => {
    const p = await store.loadPuzzle(state.date);
    if (p) { setPuzzle(p); renderPlay(); } else toast('Not there yet — try again soon.');
  };
  document.getElementById('uploadBtn').onclick = () => $fileInput.click();
}

function solvedCard() {
  const others = CONFIG.players.filter(p => p !== CONFIG.player);
  const lines = others.map(p => {
    const r = state.results.find(x => x.player === p && x.puzzle_date === state.date);
    if (!r) return `${esc(p)} hasn't posted a time yet.`;
    const diff = r.seconds - state.solvedSeconds;
    if (diff > 0) return `You beat ${esc(p)} by ${formatTime(diff)}.`;
    if (diff < 0) return `${esc(p)} was ${formatTime(-diff)} faster.`;
    return `Dead heat with ${esc(p)}!`;
  });
  return `
    <div class="card center" style="margin-top:12px">
      <h2 style="margin-bottom:4px">Solved in ${formatTime(state.solvedSeconds)}</h2>
      <div class="muted small">${lines.join('<br>')}</div>
      <div style="margin-top:12px"><button class="btn" id="lbBtn" type="button">${ICONS.trophy}Leaderboard</button></div>
    </div>`;
}

// Build cells once per board; updateBoard() only toggles classes after that.
function buildBoard(board, puzzle, { editing = false } = {}) {
  const { size, regions, colors } = puzzle;
  board.style.setProperty('--n', size);
  board.classList.toggle('editing', editing);
  const cells = [];
  for (let i = 0; i < size * size; i++) {
    const r = Math.floor(i / size), c = i % size;
    const cls = ['cell'];
    if (c === size - 1) cls.push('last-col');
    else if (regions[i] !== regions[i + 1]) cls.push('r-edge');
    if (r === size - 1) cls.push('last-row');
    else if (regions[i] !== regions[i + size]) cls.push('b-edge');
    cells.push(`<div class="${cls.join(' ')}" data-i="${i}" style="background:${colors[regions[i]]};--d:${r + c}" role="gridcell"><span class="mark"></span></div>`);
  }
  board.innerHTML = cells.join('');
  board.setAttribute('role', 'grid');
}

function updateBoard() {
  const board = document.getElementById('board');
  if (!board || !state.puzzle) return;
  const { size, regions } = state.puzzle;
  const { striped, badQueens } = findConflicts(size, regions, state.marks);
  const auto = state.autoX ? attackedCells(size, regions, state.marks) : new Set();
  const cells = board.children;
  for (let i = 0; i < cells.length; i++) {
    const m = state.marks[i];
    const el = cells[i];
    const wasQueen = el.classList.contains('queen');
    el.classList.toggle('queen', m === QUEEN);
    el.classList.toggle('x', m === CROSS);
    el.classList.toggle('auto-x', m === EMPTY && auto.has(i));
    el.classList.toggle('bad', badQueens.has(i));
    el.classList.toggle('striped', striped.has(i));
    if (m === QUEEN && !wasQueen) el.firstChild.innerHTML = ICONS.crown;
    else if (m !== QUEEN && wasQueen) el.firstChild.innerHTML = '';
    const r = Math.floor(i / size) + 1, c = (i % size) + 1;
    el.setAttribute('aria-label', `Row ${r}, column ${c}${m === QUEEN ? ', queen' : m === CROSS ? ', crossed' : ''}`);
  }
  board.classList.toggle('solved', state.solved);
}

function cellFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  const cell = el && el.closest('.cell');
  return cell ? Number(cell.dataset.i) : -1;
}

// Tap cycles empty -> × -> queen -> empty. Dragging marks ×s (or erases them
// if the drag started on an ×), like the LinkedIn game.
function attachPlayInput(board) {
  let start = -1, dragMode = null, touched = null, pointerId = null;

  board.addEventListener('pointerdown', e => {
    if (!canPlay()) return;
    const i = cellFromPoint(e.clientX, e.clientY);
    if (i < 0) return;
    e.preventDefault();
    board.setPointerCapture(e.pointerId);
    pointerId = e.pointerId;
    start = i; dragMode = null; touched = new Set();
  });

  board.addEventListener('pointermove', e => {
    if (e.pointerId !== pointerId || start < 0) return;
    const i = cellFromPoint(e.clientX, e.clientY);
    if (i < 0) return;
    if (!dragMode) {
      if (i === start) return;
      dragMode = state.marks[start] === CROSS ? 'erase' : 'mark';
      pushHistory();
      paintDrag(start);
    }
    paintDrag(i);
  });

  const end = e => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    if (start >= 0 && !dragMode && e.type === 'pointerup') {
      pushHistory();
      state.marks[start] = (state.marks[start] + 1) % 3;
      afterMove();
    } else if (dragMode) {
      afterMove();
    }
    start = -1; dragMode = null;
  };
  board.addEventListener('pointerup', end);
  board.addEventListener('pointercancel', end);

  function paintDrag(i) {
    if (touched.has(i)) return;
    touched.add(i);
    if (state.marks[i] === QUEEN) return;
    state.marks[i] = dragMode === 'mark' ? CROSS : EMPTY;
    updateBoard();
  }
}

// In practice mode `solved` refers to the practice run.
function canPlay() {
  return Boolean(state.puzzle) && !state.solved;
}

function pushHistory() {
  state.history.push(state.marks.slice());
  if (state.history.length > 300) state.history.shift();
}

function undo() {
  if (!canPlay() || !state.history.length) return;
  state.marks = state.history.pop();
  afterMove();
}

function clearBoard() {
  if (!canPlay() || !state.marks.some(m => m !== EMPTY)) return;
  pushHistory();
  state.marks = state.marks.map(() => EMPTY);
  afterMove();
}

function afterMove() {
  startClockIfPlaying();
  updateBoard();
  if (isSolved(state.puzzle.size, state.puzzle.regions, state.marks)) onSolved();
  else saveProgress();
}

async function onSolved() {
  pauseClock();
  const seconds = Math.max(1, Math.round(currentMs() / 1000));
  if (state.practice) {
    state.solved = true;
    updateBoard();
    saveProgress();
    toast(`Practice solved in ${formatTime(seconds)} (not counted)`);
    return;
  }
  state.solved = true;
  state.solvedSeconds = seconds;
  saveProgress();
  updateBoard();

  const res = await store.saveResult(CONFIG.player, state.date, seconds);
  if (res.duplicate) {
    const existing = state.results.find(r => r.player === CONFIG.player && r.puzzle_date === state.date);
    if (existing) state.solvedSeconds = existing.seconds;
  }
  state.results = await store.loadResults();
  renderStreakPill();
  if (store.remoteEnabled && !res.synced && !res.duplicate) toast('Saved on this phone — will sync when back online.');
  setTimeout(() => { if (state.view === 'play') { renderPlay(); showWinSheet(); } }, 1400);
}

function showWinSheet() {
  const mine = state.results.filter(r => r.player === CONFIG.player).map(r => r.puzzle_date);
  const s = streaks(mine, state.date);
  const others = CONFIG.players.filter(p => p !== CONFIG.player).map(p => {
    const r = state.results.find(x => x.player === p && x.puzzle_date === state.date);
    if (!r) return `Waiting for ${esc(p)}'s time…`;
    const diff = r.seconds - state.solvedSeconds;
    return diff > 0 ? `You beat ${esc(p)} by ${formatTime(diff)} 👑` : diff < 0 ? `${esc(p)} was ${formatTime(-diff)} faster.` : `Dead heat with ${esc(p)}!`;
  });
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="winTitle">
      <div class="big-crown">${ICONS.crown}</div>
      <h2 id="winTitle">You're a queen, ${esc(CONFIG.player)}!</h2>
      <div class="big-time">${formatTime(state.solvedSeconds)}</div>
      <div class="streak-line">${ICONS.flame}${s.current} day streak${s.current > 1 && s.current === s.best ? ' · personal best!' : ''}</div>
      <div class="versus">${others.join('<br>')}</div>
      <div class="actions">
        <button class="btn primary block" data-act="lb" type="button">${ICONS.trophy}See leaderboard</button>
        <button class="btn ghost block" data-act="close" type="button">Close</button>
      </div>
    </div>`;
  overlay.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (e.target === overlay || act === 'close') overlay.remove();
    if (act === 'lb') { overlay.remove(); show('leaderboard'); }
  });
  document.body.appendChild(overlay);
}

function startPractice() {
  state.practice = true;
  state.solved = false;
  state.marks = state.marks.map(() => EMPTY);
  state.history = [];
  state.elapsed = 0;
  saveProgress();
  renderPlay();
}

function endPractice() {
  store.clearProgress(state.date);
  setPuzzle(state.puzzle);
  renderPlay();
}

// ---------- import ----------

async function onFileChosen() {
  const file = $fileInput.files[0];
  $fileInput.value = '';
  if (!file) return;
  pauseClock();
  state.view = 'import';
  $app.innerHTML = '<div class="spinner" aria-label="Reading screenshot"></div><p class="center muted">Reading your screenshot…</p>';
  try {
    const { canvas, image } = await fileToImage(file);
    const box = detectBoard(image);
    const { size } = detectGridSize(image, box);
    state.importing = { canvas, image, box, size, sizeTouched: false, puzzle: extractPuzzle(image, box, size), paint: 0 };
  } catch (err) {
    console.error(err);
    toast('Sorry, that image could not be read. Try a PNG or JPG screenshot.');
    state.view = 'play';
  }
  show(state.view);
}

function reextract({ redetectSize = false } = {}) {
  const imp = state.importing;
  if (redetectSize && !imp.sizeTouched) imp.size = detectGridSize(imp.image, imp.box).size;
  imp.puzzle = extractPuzzle(imp.image, imp.box, imp.size);
  imp.paint = Math.min(imp.paint, imp.puzzle.colors.length - 1);
}

function importCheck(puzzle) {
  const problems = validateRegions(puzzle.size, puzzle.regions);
  if (problems.length) return { level: 'bad', text: problems.join(' ') + ' Fix the colours below, or change the grid size.' };
  const { count } = solve(puzzle.size, puzzle.regions, 2);
  if (count === 0) return { level: 'bad', text: 'This board has no solution, so something was misread. Tap a colour then tap cells to fix it.' };
  if (count > 1) return { level: 'warn', text: 'Board read, but it has more than one solution — double-check the colours against your screenshot.' };
  return { level: 'ok', text: 'Board read perfectly — it has exactly one solution.' };
}

function renderImport() {
  const imp = state.importing;
  if (!imp) { state.view = 'play'; return renderPlay(); }
  const { puzzle } = imp;
  const check = importCheck(puzzle);
  const fromImage = Boolean(imp.image);
  $app.innerHTML = `
    <div class="card">
      <h2>${imp.fromLink ? `Puzzle for ${esc(CONFIG.player)}` : 'Check the board'} <small>· ${esc(prettyDate(imp.date || state.date))}</small></h2>
      <div class="board-wrap"><div class="board" id="board"></div></div>
      <div class="status ${check.level}">${check.level === 'ok' ? ICONS.check : ICONS.warn}<span>${esc(check.text)}</span></div>
      ${fromImage ? `<div class="row">
        <span class="small muted">Grid size</span>
        <span class="spacer"></span>
        <div class="stepper">
          <button type="button" id="sizeDown" aria-label="Smaller grid">−</button>
          <span>${puzzle.size} × ${puzzle.size}</span>
          <button type="button" id="sizeUp" aria-label="Bigger grid">+</button>
        </div>
      </div>` : `<p class="small muted" style="margin:0">${puzzle.size} × ${puzzle.size} board from Claude. Compare it with your screenshot.</p>`}
      <p class="small muted" style="margin:14px 0 0">Wrong colour somewhere? Pick a colour, then tap or drag over cells.</p>
      <div class="swatches" id="swatches">
        ${puzzle.colors.map((c, k) => `<button type="button" class="swatch ${k === imp.paint ? 'sel' : ''}" data-k="${k}" style="background:${c}" aria-label="Colour ${k + 1}"></button>`).join('')}
      </div>
      ${fromImage ? `<details class="crop" id="cropDetails" ${imp.cropOpen ? 'open' : ''}>
        <summary>Board in the wrong place? Adjust the crop</summary>
        <p class="small muted">Drag the box over the coloured squares (inside the thick outer border). Drag the blue dot to resize.</p>
        <div class="crop-clip"><div class="crop-stage" id="cropStage"><div class="crop-box" id="cropBox"><div class="crop-handle" id="cropHandle"></div></div></div></div>
      </details>` : ''}
    </div>
    <div class="row">
      <button class="btn ghost" id="cancelImport" type="button">Cancel</button>
      <span class="spacer"></span>
      ${fromImage ? '<button class="btn" id="otherShot" type="button">Other image</button>' : ''}
      <button class="btn primary" id="startBtn" type="button" ${check.level === 'bad' ? 'disabled' : ''}>${imp.fromLink ? `Send to ${esc(CONFIG.player)}'s app` : 'Start puzzle'}</button>
    </div>`;

  const board = document.getElementById('board');
  buildBoard(board, puzzle, { editing: true });
  attachPaintInput(board);

  if (fromImage) {
    document.getElementById('sizeDown').onclick = () => changeSize(-1);
    document.getElementById('sizeUp').onclick = () => changeSize(1);
    document.getElementById('cropDetails').ontoggle = e => { imp.cropOpen = e.target.open; };
    setupCrop();
  }
  document.getElementById('swatches').onclick = e => {
    const k = e.target.closest('.swatch')?.dataset.k;
    if (k == null) return;
    imp.paint = Number(k);
    document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('sel', s.dataset.k === k));
  };
  document.getElementById('cancelImport').onclick = () => { state.importing = null; show('play'); };
  if (fromImage) document.getElementById('otherShot').onclick = () => $fileInput.click();
  document.getElementById('startBtn').onclick = startImported;
}

// ---------- board codes from Claude ----------

// A link from Claude (#q=<board code>) opens the board ready to send to
// Katy's app: it's saved to Supabase and her phone picks it up.
function openCode({ code, date }) {
  const { puzzle, error } = parseCode(code);
  history.replaceState(null, '', location.pathname + location.search);
  if (error) { toast(error, 5000); return false; }
  pauseClock();
  state.importing = { puzzle, image: null, paint: 0, fromLink: true, date: date || state.date };
  show('import');
  return true;
}

function renderSent() {
  const date = state.sentDate || state.date;
  $app.innerHTML = `
    <div class="card hero">
      <div class="big-crown" style="width:56px;height:56px;margin:0 auto 8px;color:var(--gold)">${ICONS.crown}</div>
      <h1>Sent to ${esc(CONFIG.player)}!</h1>
      <p>The puzzle for ${esc(prettyDate(date, { weekday: 'long', day: 'numeric', month: 'long' }))} is ready in ${esc(CONFIG.player)}'s app.</p>
      ${store.remoteEnabled ? '' : `<p class="status warn" style="text-align:left">${ICONS.warn}<span>Supabase isn't set up yet, so it's only saved on this device. Add the keys in js/config.js.</span></p>`}
      <button class="btn primary" id="sentDone" type="button">Done</button>
    </div>`;
  document.getElementById('sentDone').onclick = () => show('play');
}
function changeSize(delta) {
  const imp = state.importing;
  const n = Math.min(MAX_SIZE, Math.max(MIN_SIZE, imp.size + delta));
  if (n === imp.size) return;
  imp.size = n;
  imp.sizeTouched = true;
  reextract();
  renderImport();
}

function attachPaintInput(board) {
  let active = null;
  const paint = (x, y) => {
    const i = cellFromPoint(x, y);
    const imp = state.importing;
    if (i < 0 || imp.puzzle.regions[i] === imp.paint) return;
    imp.puzzle.regions[i] = imp.paint;
    active.changed = true;
    buildBoard(board, imp.puzzle, { editing: true });
  };
  board.addEventListener('pointerdown', e => {
    e.preventDefault();
    board.setPointerCapture(e.pointerId);
    active = { id: e.pointerId, changed: false };
    paint(e.clientX, e.clientY);
  });
  board.addEventListener('pointermove', e => { if (active && e.pointerId === active.id) paint(e.clientX, e.clientY); });
  const end = e => {
    if (!active || e.pointerId !== active.id) return;
    const changed = active.changed;
    active = null;
    if (changed) renderImport();
  };
  board.addEventListener('pointerup', end);
  board.addEventListener('pointercancel', end);
}

function setupCrop() {
  const imp = state.importing;
  const stage = document.getElementById('cropStage');
  const boxEl = document.getElementById('cropBox');
  const handle = document.getElementById('cropHandle');
  const W = imp.canvas.width, H = imp.canvas.height;
  stage.prepend(imp.canvas);

  const place = () => {
    boxEl.style.left = `${(imp.box.x / W) * 100}%`;
    boxEl.style.top = `${(imp.box.y / H) * 100}%`;
    boxEl.style.width = `${(imp.box.size / W) * 100}%`;
    boxEl.style.height = `${(imp.box.size / H) * 100}%`;
  };
  place();

  let drag = null;
  boxEl.addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    boxEl.setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, mode: e.target === handle ? 'resize' : 'move', x: e.clientX, y: e.clientY, box: { ...imp.box } };
  });
  boxEl.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const scale = W / stage.getBoundingClientRect().width;
    const dx = (e.clientX - drag.x) * scale, dy = (e.clientY - drag.y) * scale;
    const b = drag.box;
    imp.box = drag.mode === 'move'
      ? clampBox({ x: b.x + dx, y: b.y + dy, size: b.size }, W, H)
      : clampBox({ x: b.x, y: b.y, size: b.size + Math.max(dx, dy) }, W, H);
    place();
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    reextract({ redetectSize: true });
    renderImport();
  };
  boxEl.addEventListener('pointerup', end);
  boxEl.addEventListener('pointercancel', end);
}

async function startImported() {
  const imp = state.importing;
  // Tidy ids so they run 0..n-1 and drop any colour that was painted over.
  const regions = normalizeRegions(imp.puzzle.regions);
  const colors = [];
  imp.puzzle.regions.forEach((old, i) => { colors[regions[i]] = imp.puzzle.colors[old]; });
  const puzzle = { size: imp.puzzle.size, regions, colors };

  const date = imp.date || state.date;
  const res = await store.savePuzzle(date, puzzle);
  if (store.remoteEnabled && !res.synced) toast('Saved on this phone — will sync when back online.');
  state.importing = null;
  if (imp.fromLink) {
    if (date === state.date && !state.solved) { store.clearProgress(date); setPuzzle(puzzle); }
    state.sentDate = date;
    show('sent');
    return;
  }
  store.clearProgress(state.date);
  setPuzzle(puzzle);
  show('play');
}

// ---------- leaderboard ----------

function renderLeaderboard() {
  const { rows, history } = leaderboard(state.results, CONFIG.players, state.date);
  const byName = Object.fromEntries(rows.map(r => [r.player, r]));
  const todayTimes = CONFIG.players.map(p => byName[p]?.today).filter(t => t != null);
  const fastest = todayTimes.length > 1 ? Math.min(...todayTimes) : null;
  const winnersToday = fastest == null ? [] : CONFIG.players.filter(p => byName[p]?.today === fastest);
  const inputPlayers = CONFIG.players.filter(p => p !== CONFIG.player);
  const lastInput = store.loadSetting('lastInputPlayer', inputPlayers[0]);
  const pending = store.pendingCount();

  const avatar = p => `<div class="avatar" style="background:${avatarColour(p)}">${esc(p.slice(0, 1).toUpperCase())}</div>`;

  $app.innerHTML = `
    <div class="card">
      <h2>Today <small>· ${esc(prettyDate(state.date))}</small></h2>
      <div class="today-grid">
        ${CONFIG.players.map(p => {
          const r = byName[p];
          const win = winnersToday.length === 1 && winnersToday[0] === p;
          return `
            <div class="player-card ${win ? 'winner' : ''}">
              ${win ? `<div class="crown-badge">${ICONS.crown}</div>` : ''}
              ${avatar(p)}
              <div class="name">${esc(p)}</div>
              ${r?.today != null ? `<div class="time">${formatTime(r.today)}</div>` : `<div class="time none">Not played yet</div>`}
              <div class="streak">${ICONS.flame}${r?.currentStreak ?? 0} day streak</div>
            </div>`;
        }).join('')}
      </div>
    </div>

    ${inputPlayers.length ? `
    <div class="card">
      <h2>Add a time</h2>
      <form id="timeForm" class="form-grid" autocomplete="off">
        ${inputPlayers.length > 1 ? `
          <label>Player
            <select class="field" name="player">${inputPlayers.map(p => `<option ${p === lastInput ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
          </label>` : `<input type="hidden" name="player" value="${esc(inputPlayers[0])}">`}
        <label class="${inputPlayers.length > 1 ? '' : 'full'}">Day
          <input class="field" type="date" name="date" value="${state.date}" max="${state.date}" required>
        </label>
        <label class="full">${inputPlayers.length > 1 ? 'Time' : `${esc(inputPlayers[0])}'s time`} (minutes:seconds)
          <input class="field time-field" name="time" inputmode="numeric" placeholder="1:23" pattern="[0-9:]*" required>
        </label>
        <button class="btn primary full" type="submit">Save time</button>
      </form>
    </div>` : ''}

    <div class="card">
      <h2>Leaderboard</h2>
      <ol class="standings">
        ${rows.map((r, i) => `
          <li>
            <span class="rank ${i === 0 && r.wins > 0 ? 'first' : ''}">${i === 0 && r.wins > 0 ? ICONS.crown : i + 1}</span>
            ${avatar(r.player)}
            <div class="who">
              <b>${esc(r.player)}</b>
              <span>🔥 ${r.currentStreak} day streak (best ${r.bestStreak}) · PB ${formatTime(r.bestTime)} · avg ${formatTime(r.average)}</span>
            </div>
            <div class="wins"><b>${r.wins}</b>wins</div>
          </li>`).join('')}
      </ol>
      <p class="small muted" style="margin:8px 0 0">A win is the fastest time on a day when both of you played. Averages cover the last 30 days.</p>
    </div>

    <div class="card">
      <h2>History</h2>
      ${history.length ? `
        <table class="history">
          <thead><tr><th>Day</th>${CONFIG.players.map(p => `<th>${esc(p)}</th>`).join('')}</tr></thead>
          <tbody>
            ${history.slice(0, 30).map(h => {
              const vals = CONFIG.players.map(p => h.times[p]).filter(t => t != null);
              const best = vals.length > 1 ? Math.min(...vals) : null;
              return `<tr><td>${esc(prettyDate(h.day))}</td>${CONFIG.players.map(p => {
                const t = h.times[p];
                return `<td class="${t != null && t === best ? 'win' : ''}">${formatTime(t)}</td>`;
              }).join('')}</tr>`;
            }).join('')}
          </tbody>
        </table>` : '<p class="muted small" style="margin:0">No games yet. Solve today\'s puzzle to get on the board!</p>'}
    </div>

    <p class="sync">${store.remoteEnabled
      ? (pending ? `${pending} change${pending === 1 ? '' : 's'} waiting to sync.` : 'Synced with Supabase.')
      : 'Saved on this device only — add your Supabase keys in <code>js/config.js</code> to share the leaderboard.'}</p>`;

  const form = document.getElementById('timeForm');
  if (form) form.addEventListener('submit', onTimeSubmit);
}

async function onTimeSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const data = new FormData(form);
  const player = String(data.get('player'));
  const date = String(data.get('date'));
  const seconds = parseTime(data.get('time'));
  if (!seconds) { toast('Type the time like 1:23 (minutes:seconds).'); form.time.focus(); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > state.date) { toast('Pick today or an earlier day.'); return; }
  store.saveSetting('lastInputPlayer', player);
  const res = await store.saveResult(player, date, seconds, { overwrite: true });
  state.results = await store.loadResults();
  toast(`Saved ${player}: ${formatTime(seconds)}${store.remoteEnabled && !res.synced ? ' (will sync later)' : ''}`);
  renderLeaderboard();
}

boot();
