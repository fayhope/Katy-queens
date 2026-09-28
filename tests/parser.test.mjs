import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoParse } from '../js/parser.js';
import { randomPuzzle, renderScreenshot, rng } from './synth.mjs';

function check(puzzle, opts) {
  const shot = renderScreenshot(puzzle, opts);
  const { size, puzzle: parsed } = autoParse(shot);
  assert.equal(size, puzzle.size, 'grid size');
  assert.deepEqual(parsed.regions, puzzle.regions, 'regions');
  assert.equal(parsed.colors.length, puzzle.size);
}

for (const size of [5, 6, 7, 8, 9, 10, 11]) {
  test(`reads a ${size}x${size} light-mode screenshot`, () => {
    const rand = rng(size * 31);
    for (let k = 0; k < 4; k++) check(randomPuzzle(size, rand), {});
  });
}

test('reads a dark-mode screenshot', () => {
  const rand = rng(7);
  for (const size of [7, 8, 9]) check(randomPuzzle(size, rand), { dark: true });
});

test('reads a screenshot cropped to just the board', () => {
  const rand = rng(11);
  for (const size of [6, 8, 10]) check(randomPuzzle(size, rand), { crop: true });
});

test('reads a board with queens and Xs already placed', () => {
  const rand = rng(99);
  const p = randomPuzzle(8, rand);
  const marks = new Array(64).fill(0);
  p.solution.slice(0, 3).forEach(i => { marks[i] = 2; });
  [1, 10, 20, 33, 47].forEach(i => { if (!marks[i]) marks[i] = 1; });
  check(p, { marks });
});

test('reads a smaller, off-centre board on a beige page', () => {
  const rand = rng(5);
  check(randomPuzzle(9, rand), { boardX: 140, boardY: 900, boardSize: 640, background: [244, 242, 238] });
});

// A real LinkedIn screenshot (iPhone, light mode, already solved with gold
// crowns and ×s on the board).
test('reads a real LinkedIn Queens screenshot', async () => {
  const { readPng, shrink } = await import('./png.mjs');
  const { solve } = await import('../js/queens.js');
  const full = readPng(new URL('./fixtures/linkedin-7x7-solved.png', import.meta.url).pathname);
  const expected = [
    0, 1, 1, 1, 1, 1, 1,
    0, 1, 1, 1, 2, 2, 1,
    1, 1, 1, 2, 2, 2, 2,
    1, 1, 1, 3, 2, 2, 4,
    5, 5, 5, 3, 3, 4, 4,
    5, 5, 5, 3, 3, 4, 4,
    5, 5, 5, 5, 3, 4, 6,
  ];
  for (const image of [shrink(full), full]) {
    const { size, puzzle } = autoParse(image);
    assert.equal(size, 7);
    assert.deepEqual(puzzle.regions, expected);
    assert.deepEqual(puzzle.colors, ['#bba3e2', '#ffc992', '#96beff', '#b3dfa0', '#dfdfdf', '#ff7b60', '#e6f388']);
  }
  const { count, solution } = solve(7, expected, 2);
  assert.equal(count, 1);
  // The queens in the screenshot: (0,0) (1,4) (2,1) (3,3) (4,5) (5,2) (6,6).
  assert.deepEqual(solution, [0, 11, 15, 24, 33, 37, 48]);
});
