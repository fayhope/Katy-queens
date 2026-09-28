import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findConflicts, isSolved, attackedCells, solve, validateRegions, QUEEN, CROSS } from '../js/queens.js';
import { randomPuzzle, rng } from './synth.mjs';

// 5x5 with a single solution: queens at (0,0) (1,2) (2,4) (3,1) (4,3).
const P5 = {
  size: 5,
  regions: [
    0, 0, 1, 1, 1,
    0, 0, 1, 2, 2,
    3, 3, 1, 2, 2,
    3, 3, 4, 4, 2,
    3, 4, 4, 4, 4,
  ],
};

test('solver finds the solution of a generated board', () => {
  const rand = rng(3);
  for (const size of [5, 6, 7, 8, 9]) {
    const p = randomPuzzle(size, rand);
    const { count, solution } = solve(p.size, p.regions, 1);
    assert.equal(count, 1);
    const marks = new Array(size * size).fill(0);
    solution.forEach(i => { marks[i] = QUEEN; });
    assert.ok(isSolved(p.size, p.regions, marks));
  }
});

test('conflicts: same row, same region and touching queens', () => {
  const marks = new Array(25).fill(0);
  marks[0] = QUEEN; marks[2] = QUEEN; // same row
  let c = findConflicts(5, P5.regions, marks);
  assert.deepEqual([...c.badQueens].sort(), [0, 2]);
  assert.ok(c.striped.has(4));

  const m2 = new Array(25).fill(0);
  m2[0] = QUEEN; m2[6] = QUEEN; // diagonal neighbours, same region
  c = findConflicts(5, P5.regions, m2);
  assert.deepEqual([...c.badQueens].sort(), [0, 6]);

  const m3 = new Array(25).fill(0);
  m3[0] = QUEEN; m3[7] = QUEEN; m3[3] = CROSS; // fine
  assert.equal(findConflicts(5, P5.regions, m3).badQueens.size, 0);
});

test('isSolved needs every queen and no conflicts', () => {
  const { solution } = solve(5, P5.regions, 1);
  const marks = new Array(25).fill(0);
  solution.forEach(i => { marks[i] = QUEEN; });
  assert.ok(isSolved(5, P5.regions, marks));
  marks[solution[4]] = 0;
  assert.ok(!isSolved(5, P5.regions, marks));
});

test('attacked cells cover row, column, region and neighbours', () => {
  const marks = new Array(25).fill(0);
  marks[12] = QUEEN; // centre, region 1
  const a = attackedCells(5, P5.regions, marks);
  for (const i of [10, 14, 2, 22, 6, 8, 16, 18, 3, 4]) assert.ok(a.has(i), `cell ${i}`);
  assert.ok(!a.has(12) && !a.has(0) && !a.has(20));
});

test('validateRegions spots wrong counts and split colours', () => {
  assert.deepEqual(validateRegions(5, P5.regions), []);
  const split = P5.regions.slice(); split[24] = 0;
  assert.ok(validateRegions(5, split).some(m => m.includes('split')));
  const merged = P5.regions.map(g => (g === 4 ? 3 : g));
  assert.ok(validateRegions(5, merged).some(m => m.includes('needs 5')));
});
