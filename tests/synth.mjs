// Helpers that fake a phone screenshot of a Queens board, pixel by pixel.

import { normalizeRegions } from '../js/queens.js';

export const LINKEDIN_COLOURS = [
  [187, 163, 226], [255, 201, 146], [150, 190, 255], [179, 223, 160],
  [223, 223, 223], [255, 123, 96], [230, 243, 136], [185, 178, 158],
  [223, 160, 191], [163, 210, 216], [98, 239, 234], [255, 229, 153],
];

export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

// Random board: place a valid set of queens, then grow a region from each.
export function randomPuzzle(size, rand) {
  let cols;
  for (;;) {
    cols = [...Array(size).keys()].sort(() => rand() - 0.5);
    if (cols.every((c, r) => r === 0 || Math.abs(c - cols[r - 1]) > 1)) break;
  }
  const regions = new Array(size * size).fill(-1);
  const frontier = [];
  cols.forEach((c, r) => { regions[r * size + c] = r; frontier.push(r * size + c); });
  while (frontier.length) {
    const i = frontier.splice(Math.floor(rand() * frontier.length), 1)[0];
    const r = Math.floor(i / size), c = i % size;
    for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
      if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
      const n = nr * size + nc;
      if (regions[n] === -1) { regions[n] = regions[i]; frontier.push(n); }
    }
  }
  return { size, regions: normalizeRegions(regions), solution: cols.map((c, r) => r * size + c) };
}

export function renderScreenshot(puzzle, opts = {}) {
  const {
    width = 1000, height = 2100, boardX = 60, boardY = 620, boardSize = 880,
    background = [255, 255, 255], dark = false, crop = false, marks = [],
  } = opts;
  const { size, regions } = puzzle;
  const W = crop ? boardSize : width, H = crop ? boardSize : height;
  const ox = crop ? 0 : boardX, oy = crop ? 0 : boardY;
  const data = new Uint8ClampedArray(W * H * 4);
  const fill = (x0, y0, w, h, rgb) => {
    for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++) {
      for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) {
        const p = (y * W + x) * 4;
        data[p] = rgb[0]; data[p + 1] = rgb[1]; data[p + 2] = rgb[2]; data[p + 3] = 255;
      }
    }
  };
  const bg = dark ? [27, 31, 35] : background;
  const text = dark ? [230, 230, 230] : [40, 40, 40];
  fill(0, 0, W, H, bg);
  if (!crop) {
    // App chrome: title text, a blue button, some grey text rows.
    fill(60, 120, 400, 40, text);
    fill(60, 200, 700, 18, text);
    fill(60, 240, 500, 18, text);
    fill(350, 1600, 300, 70, [10, 102, 194]);
    fill(60, 1750, 880, 18, text);
    fill(60, 1790, 600, 18, text);
  }
  const cell = boardSize / size;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const x0 = Math.round(ox + c * cell), y0 = Math.round(oy + r * cell);
      const x1 = Math.round(ox + (c + 1) * cell), y1 = Math.round(oy + (r + 1) * cell);
      fill(x0, y0, x1 - x0, y1 - y0, LINKEDIN_COLOURS[regions[r * size + c]]);
      const m = marks[r * size + c];
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      if (m === 2) fill(Math.round(cx - cell * 0.25), Math.round(cy - cell * 0.2), Math.round(cell * 0.5), Math.round(cell * 0.4), [0, 0, 0]);
      if (m === 1) fill(Math.round(cx - 4), Math.round(cy - 4), 8, 8, [80, 80, 80]);
    }
  }
  // Grid lines: thin grey inside a region, thick black between regions.
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const i = r * size + c;
      const x1 = Math.round(ox + (c + 1) * cell), y1 = Math.round(oy + (r + 1) * cell);
      const x0 = Math.round(ox + c * cell), y0 = Math.round(oy + r * cell);
      if (c < size - 1) {
        const thick = regions[i] !== regions[i + 1];
        fill(x1 - (thick ? 2 : 1), y0, thick ? 4 : 2, y1 - y0, thick ? [0, 0, 0] : [120, 120, 120]);
      }
      if (r < size - 1) {
        const thick = regions[i] !== regions[i + size];
        fill(x0, y1 - (thick ? 2 : 1), x1 - x0, thick ? 4 : 2, thick ? [0, 0, 0] : [120, 120, 120]);
      }
    }
  }
  // Outer border.
  const b = 5;
  fill(ox - b, oy - b, boardSize + 2 * b, b, [0, 0, 0]);
  fill(ox - b, oy + boardSize, boardSize + 2 * b, b, [0, 0, 0]);
  fill(ox - b, oy, b, boardSize, [0, 0, 0]);
  fill(ox + boardSize, oy, b, boardSize, [0, 0, 0]);
  return { width: W, height: H, data };
}
