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
