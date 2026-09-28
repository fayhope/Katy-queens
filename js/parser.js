// Turns a screenshot of a Queens board into { size, regions, colors }.
//
// All functions here work on ImageData-like objects ({ width, height, data })
// so they can run in the browser or in Node tests.
//
// Pipeline:
//   1. detectBoard   - find the square board by looking for the big block of
//                      pixels that are clearly not page background.
//   2. detectGridSize- the board's grid lines are darker than the cells, so
//                      pick the N whose line positions are darkest relative
//                      to the cell centres.
//   3. extractPuzzle - sample each cell's centre colour and group the cells
//                      into N colour regions.

export const MIN_SIZE = 4;
export const MAX_SIZE = 12;

// ---------- image loading (browser only) ----------

export async function fileToImage(file, maxDim = 1400) {
  let source;
  try {
    source = await createImageBitmap(file);
  } catch {
    source = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image.')); };
      img.src = url;
    });
  }
  const w0 = source.width, h0 = source.height;
  const scale = Math.min(1, maxDim / Math.max(w0, h0));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w0 * scale);
  canvas.height = Math.round(h0 * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return { canvas, image: ctx.getImageData(0, 0, canvas.width, canvas.height) };
}

// ---------- one-shot ----------

export function autoParse(image) {
  const box = detectBoard(image);
  const { size } = detectGridSize(image, box);
  return { box, size, puzzle: extractPuzzle(image, box, size) };
}

// ---------- 1. board location ----------

export function detectBoard(image) {
  const { width: W, height: H, data } = image;
  const bg = estimateBackground(image);
  const mask = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < W * H; i++, p += 4) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const l = luma(r, g, b);
    const d = Math.hypot(r - bg[0], g - bg[1], b - bg[2]);
    mask[i] = d > 40 && l > 70 ? 1 : 0;
  }

  const rowCounts = (x0, x1) => {
    const out = new Float64Array(H);
    for (let y = 0; y < H; y++) {
      let n = 0;
      for (let x = x0; x <= x1; x++) n += mask[y * W + x];
      out[y] = n;
    }
    return out;
  };
  const colCounts = (y0, y1) => {
    const out = new Float64Array(W);
    for (let y = y0; y <= y1; y++) {
      for (let x = 0; x < W; x++) out[x] += mask[y * W + x];
    }
    return out;
  };

  const gapY = Math.round(H * 0.012) + 3;
  const gapX = Math.round(W * 0.012) + 3;

  let rows = longestRun(rowCounts(0, W - 1), 0.35, gapY);
  if (!rows) return fallbackBox(W, H);
  let cols = longestRun(colCounts(rows[0], rows[1]), 0.35, gapX);
  if (!cols) return fallbackBox(W, H);
  rows = longestRun(rowCounts(cols[0], cols[1]), 0.35, gapY) || rows;
  cols = longestRun(colCounts(rows[0], rows[1]), 0.35, gapX) || cols;

  let x = cols[0], y = rows[0];
  let w = cols[1] - cols[0] + 1, h = rows[1] - rows[0] + 1;
  if (Math.min(w, h) < 0.15 * Math.min(W, H)) return fallbackBox(W, H);

  // The board is square. If one side came out short (e.g. an edge region is a
  // colour close to the background), grow it on whichever side looks more
  // like board.
  const side = Math.max(w, h);
  if (w < side) {
    const extra = side - w;
    const left = { x: x - extra, y, w: extra, h };
    const right = { x: x + w, y, w: extra, h };
    x = stripScore(image, left, bg) >= stripScore(image, right, bg) ? x - extra : x;
  }
  if (h < side) {
    const extra = side - h;
    const top = { x, y: y - extra, w: side, h: extra };
    const bottom = { x, y: y + h, w: side, h: extra };
    y = stripScore(image, top, bg) >= stripScore(image, bottom, bg) ? y - extra : y;
  }
  return clampBox({ x, y, size: side }, W, H);
}

function fallbackBox(W, H) {
  const size = Math.round(Math.min(W, H) * 0.9);
  return { x: Math.round((W - size) / 2), y: Math.round((H - size) / 2), size };
}

export function clampBox(box, W, H) {
  const size = Math.max(8, Math.min(Math.round(box.size), W, H));
  return {
    x: Math.min(Math.max(0, Math.round(box.x)), W - size),
    y: Math.min(Math.max(0, Math.round(box.y)), H - size),
    size,
  };
}

// How different a strip looks from the background (higher = more board-like).
function stripScore(image, rect, bg) {
  const { width: W, height: H, data } = image;
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > W || rect.y + rect.h > H) return -1;
  let sum = 0, n = 0;
  for (let y = rect.y; y < rect.y + rect.h; y += 2) {
    for (let x = rect.x; x < rect.x + rect.w; x += 2) {
      const p = (y * W + x) * 4;
      sum += Math.hypot(data[p] - bg[0], data[p + 1] - bg[1], data[p + 2] - bg[2]);
      n++;
    }
  }
  return n ? sum / n : -1;
}

// Most common colour around the edge of the image.
export function estimateBackground(image) {
  const { width: W, height: H, data } = image;
  const bins = new Map();
  const band = Math.max(2, Math.round(Math.min(W, H) * 0.02));
  const add = (x, y) => {
    const p = (y * W + x) * 4;
    const key = (data[p] >> 3) << 10 | (data[p + 1] >> 3) << 5 | (data[p + 2] >> 3);
    let bin = bins.get(key);
    if (!bin) bins.set(key, bin = [0, 0, 0, 0]);
    bin[0] += data[p]; bin[1] += data[p + 1]; bin[2] += data[p + 2]; bin[3]++;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x < band || y < band || x >= W - band || y >= H - band) add(x, y);
      else x = W - band - 1;
    }
  }
  let best = null;
  for (const bin of bins.values()) if (!best || bin[3] > best[3]) best = bin;
  return [best[0] / best[3], best[1] / best[3], best[2] / best[3]];
}

// Longest stretch of indices whose count is >= frac * max, tolerating short
// gaps (the board's dark grid lines).
function longestRun(counts, frac, maxGap) {
  let max = 0;
  for (const c of counts) if (c > max) max = c;
  if (max === 0) return null;
  const thresh = max * frac;
  let best = null, start = -1, last = -1;
  const close = () => {
    if (start >= 0 && (!best || last - start > best[1] - best[0])) best = [start, last];
  };
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] < thresh) continue;
    if (start < 0 || i - last - 1 > maxGap) { close(); start = i; }
    last = i;
  }
  close();
  return best;
}

// ---------- 2. grid size ----------

export function detectGridSize(image, box) {
  const px = darknessProfile(image, box, 'x');
  const py = darknessProfile(image, box, 'y');
  const scores = [];
  for (let n = 5; n <= MAX_SIZE; n++) {
    scores.push({ size: n, score: gridScore(px, n) + gridScore(py, n) });
  }
  scores.sort((a, b) => b.score - a.score);

  // Prefer a strong candidate whose cell colours actually form N groups.
  const top = scores[0].score;
  for (const cand of scores.slice(0, 3)) {
    if (cand.score < top * 0.6) break;
    const colours = cellColours(image, box, cand.size);
    if (countColourGroups(colours) === cand.size) return { size: cand.size, scores };
  }
  return { size: scores[0].size, scores };
}

function darknessProfile(image, box, axis) {
  const { width: W, data } = image;
  const out = new Float64Array(box.size);
  const step = Math.max(1, Math.floor(box.size / 200));
  for (let t = 0; t < box.size; t++) {
    let sum = 0, n = 0;
    for (let s = 0; s < box.size; s += step) {
      const x = axis === 'x' ? box.x + t : box.x + s;
      const y = axis === 'x' ? box.y + s : box.y + t;
      const p = (y * W + x) * 4;
      sum += 255 - luma(data[p], data[p + 1], data[p + 2]);
      n++;
    }
    out[t] = sum / n;
  }
  return out;
}

function gridScore(profile, n) {
  const len = profile.length;
  const cell = len / n;
  const lineWin = Math.max(1, Math.round(cell * 0.12));
  const centreWin = Math.max(1, Math.round(cell * 0.2));
  let lines = 0;
  for (let i = 1; i < n; i++) {
    const pos = Math.round(i * cell);
    let m = 0;
    for (let t = pos - lineWin; t <= pos + lineWin; t++) {
      if (t >= 0 && t < len && profile[t] > m) m = profile[t];
    }
    lines += m;
  }
  let centres = 0;
  for (let i = 0; i < n; i++) {
    const c = Math.round((i + 0.5) * cell);
    let s = 0, k = 0;
    for (let t = c - centreWin; t <= c + centreWin; t++) {
      if (t >= 0 && t < len) { s += profile[t]; k++; }
    }
    centres += s / k;
  }
  return lines / (n - 1) - centres / n;
}

// ---------- 3. regions ----------

export function extractPuzzle(image, box, size) {
  const colours = cellColours(image, box, size);
  const labs = colours.map(rgbToLab);
  const clusters = agglomerate(labs, size);
  const label = new Array(colours.length);
  clusters.forEach((members, k) => members.forEach(i => { label[i] = k; }));

  // Number regions by first appearance so the same board always gets the
  // same ids.
  const order = new Map();
  const regions = label.map(k => {
    if (!order.has(k)) order.set(k, order.size);
    return order.get(k);
  });
  const colors = new Array(order.size);
  for (const [k, id] of order) {
    const members = clusters[k];
    const avg = [0, 0, 0];
    for (const i of members) for (let c = 0; c < 3; c++) avg[c] += colours[i][c] / members.length;
    colors[id] = toHex(avg);
  }
  return { size, regions, colors };
}

// Median colour of the middle of each cell, ignoring dark pixels (queens, Xs,
// text).
export function cellColours(image, box, size) {
  const { width: W, data } = image;
  const cell = box.size / size;
  const out = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const x0 = Math.floor(box.x + (c + 0.28) * cell), x1 = Math.ceil(box.x + (c + 0.72) * cell);
      const y0 = Math.floor(box.y + (r + 0.28) * cell), y1 = Math.ceil(box.y + (r + 0.72) * cell);
      const light = [[], [], []], all = [[], [], []];
      const step = Math.max(1, Math.floor((x1 - x0) / 12));
      for (let y = y0; y < y1; y += step) {
        for (let x = x0; x < x1; x += step) {
          const p = (y * W + x) * 4;
          const rgb = [data[p], data[p + 1], data[p + 2]];
          const bucket = luma(...rgb) >= 60 ? light : all;
          for (let k = 0; k < 3; k++) bucket[k].push(rgb[k]);
          if (bucket === light) for (let k = 0; k < 3; k++) all[k].push(rgb[k]);
        }
      }
      const src = light[0].length >= 4 ? light : all;
      out.push(src.map(median));
    }
  }
  return out;
}

// Number of distinct colours using a fixed "same colour" distance.
function countColourGroups(colours, threshold = 12) {
  const labs = colours.map(rgbToLab);
  const reps = [];
  for (const l of labs) {
    if (!reps.some(r => dist(r, l) < threshold)) reps.push(l);
  }
  return reps.length;
}

// Average-linkage agglomerative clustering down to k clusters.
function agglomerate(points, k) {
  let clusters = points.map((_, i) => [i]);
  const n = points.length;
  let d = [];
  for (let i = 0; i < n; i++) {
    d.push(new Float64Array(n));
    for (let j = 0; j < i; j++) d[i][j] = d[j][i] = dist(points[i], points[j]);
  }
  let active = clusters.map((_, i) => i);
  while (active.length > k) {
    let bi = -1, bj = -1, best = Infinity;
    for (let a = 0; a < active.length; a++) {
      for (let b = a + 1; b < active.length; b++) {
        const v = d[active[a]][active[b]];
        if (v < best) { best = v; bi = active[a]; bj = active[b]; }
      }
    }
    const si = clusters[bi].length, sj = clusters[bj].length;
    for (const o of active) {
      if (o === bi || o === bj) continue;
      d[bi][o] = d[o][bi] = (si * d[bi][o] + sj * d[bj][o]) / (si + sj);
    }
    clusters[bi] = clusters[bi].concat(clusters[bj]);
    clusters[bj] = null;
    active = active.filter(i => i !== bj);
  }
  return active.map(i => clusters[i]);
}

// ---------- colour helpers ----------

function luma(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }

function median(arr) {
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }

export function toHex(rgb) {
  return '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

export function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgbToLab([r, g, b]) {
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = (R * 0.2126 + G * 0.7152 + B * 0.0722);
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
