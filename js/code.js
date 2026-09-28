// Board codes: a puzzle written as one letter per cell, one row per word,
// rows separated by dots. Each letter is the colour of that region, e.g. the
// 7x7 board
//
//   POOOOOO.POOOBBO.OOOBBBB.OOOGBBW.RRRGGWW.RRRGGWW.RRRRGWY
//
// This is what Claude sends back after reading a screenshot, either on its
// own or in a link: https://<site>/#q=POOOOOO.POOOBBO...

import { MIN_SIZE, MAX_SIZE, hexToRgb } from './parser.js';

// LinkedIn's region colours.
export const COLOUR_LETTERS = {
  P: { name: 'purple', hex: '#bba3e2' },
  O: { name: 'orange', hex: '#ffc992' },
  B: { name: 'blue', hex: '#96beff' },
  G: { name: 'green', hex: '#b3dfa0' },
  W: { name: 'grey', hex: '#dfdfdf' },
  R: { name: 'red', hex: '#ff7b60' },
  Y: { name: 'yellow', hex: '#e6f388' },
  T: { name: 'tan', hex: '#b9b29e' },
  K: { name: 'pink', hex: '#dfa0bf' },
  C: { name: 'teal', hex: '#a3d2d8' },
  A: { name: 'aqua', hex: '#62efea' },
  L: { name: 'light blue', hex: '#c4e3f9' },
};

// For any other letters (e.g. two regions that look alike).
const SPARE_COLOURS = ['#f7b7a3', '#9fd8b4', '#d6c1f0', '#f2d17c', '#a8c5e8', '#e8a8d0', '#c9e89a', '#f0c4a8'];

// Accepts a bare code, a code with spaces/newlines/slashes between rows, or a
// whole link containing "q=". Returns { puzzle } or { error }.
export function parseCode(text) {
  let s = String(text || '').trim();
  const m = s.match(/[#?&]q=([^&\s]+)/);
  if (m) s = decodeURIComponent(m[1]);
  const rows = s.toUpperCase().split(/[^A-Z]+/).filter(Boolean);
  const size = rows.length;
  if (!size) return { error: 'That doesn\'t look like a board code.' };
  if (size < MIN_SIZE || size > MAX_SIZE) return { error: `A board code needs ${MIN_SIZE}–${MAX_SIZE} rows; this one has ${size}.` };
  const bad = rows.findIndex(r => r.length !== size);
  if (bad >= 0) return { error: `Row ${bad + 1} has ${rows[bad].length} letters but the board is ${size}×${size}.` };

  const ids = new Map();
  const regions = [];
  for (const ch of rows.join('')) {
    if (!ids.has(ch)) ids.set(ch, ids.size);
    regions.push(ids.get(ch));
  }
  let spare = 0;
  const colors = [...ids.keys()].map(ch => COLOUR_LETTERS[ch]?.hex ?? SPARE_COLOURS[spare++ % SPARE_COLOURS.length]);
  return { puzzle: { size, regions, colors } };
}

// Turns a puzzle back into a code, naming each region by its nearest colour.
export function puzzleToCode(puzzle) {
  const used = new Set();
  const letters = puzzle.colors.map(hex => {
    const rgb = hexToRgb(hex);
    const ranked = Object.entries(COLOUR_LETTERS)
      .map(([ch, c]) => [ch, Math.hypot(...hexToRgb(c.hex).map((v, k) => v - rgb[k]))])
      .sort((a, b) => a[1] - b[1]);
    const pick = ranked.find(([ch]) => !used.has(ch))?.[0]
      ?? 'DEFHIJMNQSUVXZ'.split('').find(ch => !used.has(ch));
    used.add(pick);
    return pick;
  });
  const rows = [];
  for (let r = 0; r < puzzle.size; r++) {
    rows.push(puzzle.regions.slice(r * puzzle.size, (r + 1) * puzzle.size).map(g => letters[g]).join(''));
  }
  return rows.join('.');
}
