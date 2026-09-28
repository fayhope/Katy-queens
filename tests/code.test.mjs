import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCode, puzzleToCode, COLOUR_LETTERS } from '../js/code.js';
import { autoParse } from '../js/parser.js';
import { validateRegions, solve } from '../js/queens.js';
import { readPng, shrink } from './png.mjs';

const EXAMPLE = 'POOOOOO.POOOBBO.OOOBBBB.OOOGBBW.RRRGGWW.RRRGGWW.RRRRGWY';

test('parses a code into a board with LinkedIn colours', () => {
  const { puzzle, error } = parseCode(EXAMPLE);
  assert.equal(error, undefined);
  assert.equal(puzzle.size, 7);
  assert.deepEqual(puzzle.regions.slice(0, 14), [0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 2, 2, 1]);
  assert.deepEqual(puzzle.colors, ['P', 'O', 'B', 'G', 'W', 'R', 'Y'].map(c => COLOUR_LETTERS[c].hex));
  assert.deepEqual(validateRegions(7, puzzle.regions), []);
  assert.equal(solve(7, puzzle.regions, 2).count, 1);
});

test('accepts links, lower case, spaces and new lines', () => {
  const variants = [
    `https://katy-queens.example/#q=${EXAMPLE}`,
    'https://katy-queens.example/?x=1#q=' + encodeURIComponent(EXAMPLE),
    EXAMPLE.toLowerCase(),
    EXAMPLE.split('.').join('\n'),
    '```\n' + EXAMPLE.split('.').join(' / ') + '\n```',
  ];
  const expected = parseCode(EXAMPLE).puzzle;
  for (const v of variants) assert.deepEqual(parseCode(v).puzzle, expected, v);
});

test('explains bad codes', () => {
  assert.match(parseCode('').error, /board code/);
  assert.match(parseCode('POOOOOO.POOOBB.OOOBBBB.OOOGBBW.RRRGGWW.RRRGGWW.RRRRGWY').error, /Row 2 has 6/);
  assert.match(parseCode('PO.OP').error, /4–12 rows/);
});

test('unknown letters still get distinct colours', () => {
  const { puzzle } = parseCode('XXXXX.XZZZX.QQZVV.QQZVV.QQQMM');
  assert.equal(new Set(puzzle.colors).size, 5);
});

test('the real screenshot turns into the expected code', () => {
  const image = shrink(readPng(new URL('./fixtures/linkedin-7x7-solved.png', import.meta.url).pathname));
  assert.equal(puzzleToCode(autoParse(image).puzzle), EXAMPLE);
});
