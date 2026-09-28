// Queens rules: one queen per row, column and colour region, and no two
// queens may touch (including diagonally).
//
// A puzzle is { size, regions } where regions is a flat array of length
// size*size holding a region index (0..size-1) for every cell, row-major.
// Player marks are a flat array: 0 = empty, 1 = X, 2 = queen.

export const EMPTY = 0;
export const CROSS = 1;
export const QUEEN = 2;

export function queensOf(marks) {
  const out = [];
  marks.forEach((m, i) => { if (m === QUEEN) out.push(i); });
  return out;
}

// Returns the cells to stripe red and the queens that are in conflict.
export function findConflicts(size, regions, marks) {
  const striped = new Set();
  const badQueens = new Set();
  const queens = queensOf(marks);
  const byRow = new Map(), byCol = new Map(), byRegion = new Map();
  for (const q of queens) {
    const r = Math.floor(q / size), c = q % size, g = regions[q];
    push(byRow, r, q); push(byCol, c, q); push(byRegion, g, q);
  }
  for (const [r, qs] of byRow) if (qs.length > 1) {
    qs.forEach(q => badQueens.add(q));
    for (let c = 0; c < size; c++) striped.add(r * size + c);
  }
  for (const [c, qs] of byCol) if (qs.length > 1) {
    qs.forEach(q => badQueens.add(q));
    for (let r = 0; r < size; r++) striped.add(r * size + c);
  }
  for (const [g, qs] of byRegion) if (qs.length > 1) {
    qs.forEach(q => badQueens.add(q));
    regions.forEach((rg, i) => { if (rg === g) striped.add(i); });
  }
  for (let i = 0; i < queens.length; i++) {
    for (let j = i + 1; j < queens.length; j++) {
      const a = queens[i], b = queens[j];
      const dr = Math.abs(Math.floor(a / size) - Math.floor(b / size));
      const dc = Math.abs((a % size) - (b % size));
      if (dr <= 1 && dc <= 1) {
        badQueens.add(a); badQueens.add(b);
        striped.add(a); striped.add(b);
      }
    }
  }
  return { striped, badQueens };
}

export function isSolved(size, regions, marks) {
  const queens = queensOf(marks);
  if (queens.length !== size) return false;
  return findConflicts(size, regions, marks).badQueens.size === 0;
}

// Cells that can no longer hold a queen because of the queens already placed.
export function attackedCells(size, regions, marks) {
  const out = new Set();
  for (const q of queensOf(marks)) {
    const qr = Math.floor(q / size), qc = q % size, g = regions[q];
    for (let i = 0; i < size * size; i++) {
      if (i === q) continue;
      const r = Math.floor(i / size), c = i % size;
      if (r === qr || c === qc || regions[i] === g ||
          (Math.abs(r - qr) <= 1 && Math.abs(c - qc) <= 1)) out.add(i);
    }
  }
  return out;
}

// Backtracking solver. Returns { count, solution } where count stops at limit.
export function solve(size, regions, limit = 2) {
  const colUsed = new Array(size).fill(false);
  const regUsed = new Array(size).fill(false);
  const placed = new Array(size).fill(-1);
  let count = 0;
  let solution = null;

  function place(r) {
    if (count >= limit) return;
    if (r === size) {
      count++;
      if (!solution) solution = placed.map((c, row) => row * size + c);
      return;
    }
    for (let c = 0; c < size; c++) {
      const g = regions[r * size + c];
      if (colUsed[c] || regUsed[g]) continue;
      if (r > 0 && Math.abs(placed[r - 1] - c) <= 1) continue;
      colUsed[c] = regUsed[g] = true;
      placed[r] = c;
      place(r + 1);
      colUsed[c] = regUsed[g] = false;
      placed[r] = -1;
    }
  }
  place(0);
  return { count, solution };
}

// Structural problems with a region map (wrong region count, split regions).
export function validateRegions(size, regions) {
  const problems = [];
  if (regions.length !== size * size) {
    problems.push(`Expected ${size * size} cells but got ${regions.length}.`);
    return problems;
  }
  const ids = [...new Set(regions)].sort((a, b) => a - b);
  if (ids.length !== size) {
    problems.push(`A ${size}×${size} board needs ${size} colours, found ${ids.length}.`);
  }
  for (const g of ids) {
    const cells = regions.map((rg, i) => (rg === g ? i : -1)).filter(i => i >= 0);
    const seen = new Set([cells[0]]);
    const stack = [cells[0]];
    while (stack.length) {
      const i = stack.pop();
      const r = Math.floor(i / size), c = i % size;
      for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
        const n = nr * size + nc;
        if (regions[n] === g && !seen.has(n)) { seen.add(n); stack.push(n); }
      }
    }
    if (seen.size !== cells.length) {
      problems.push(`One colour is split into separate pieces.`);
      break;
    }
  }
  return problems;
}

// Renumber regions 0..k-1 in order of first appearance (row-major).
export function normalizeRegions(regions) {
  const map = new Map();
  return regions.map(g => {
    if (!map.has(g)) map.set(g, map.size);
    return map.get(g);
  });
}

function push(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}
