import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streaks, leaderboard, parseTime, formatTime, addDays } from '../js/stats.js';

test('addDays crosses months and years', () => {
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
});

test('streak counts back from today, or yesterday if today is not played yet', () => {
  const t = '2026-09-28';
  assert.deepEqual(streaks(['2026-09-26', '2026-09-27', '2026-09-28'], t), { current: 3, best: 3, playedToday: true });
  assert.equal(streaks(['2026-09-26', '2026-09-27'], t).current, 2);
  assert.equal(streaks(['2026-09-25', '2026-09-26'], t).current, 0);
  assert.equal(streaks(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-28'], t).best, 4);
  assert.equal(streaks([], t).current, 0);
});

test('parseTime and formatTime', () => {
  assert.equal(parseTime('1:23'), 83);
  assert.equal(parseTime(' 45 '), 45);
  assert.equal(parseTime('1:02:03'), 3723);
  assert.equal(parseTime('1:75'), null);
  assert.equal(parseTime('abc'), null);
  assert.equal(parseTime('0:00'), null);
  assert.equal(formatTime(83), '1:23');
  assert.equal(formatTime(3723), '1:02:03');
  assert.equal(formatTime(null), '—');
});

test('leaderboard counts wins only on days both played', () => {
  const r = (player, puzzle_date, seconds) => ({ player, puzzle_date, seconds });
  const { rows, history } = leaderboard([
    r('Katy', '2026-09-26', 90), r('Fay', '2026-09-26', 120),
    r('Katy', '2026-09-27', 80), r('Fay', '2026-09-27', 60),
    r('Katy', '2026-09-28', 70), r('Fay', '2026-09-28', 70), // tie
    r('Katy', '2026-09-25', 50), // Fay didn't play
  ], ['Katy', 'Fay'], '2026-09-28');
  const katy = rows.find(x => x.player === 'Katy'), fay = rows.find(x => x.player === 'Fay');
  assert.equal(katy.wins, 1);
  assert.equal(fay.wins, 1);
  assert.equal(katy.currentStreak, 4);
  assert.equal(fay.currentStreak, 3);
  assert.equal(katy.bestTime, 50);
  assert.equal(katy.today, 70);
  assert.equal(history[0].day, '2026-09-28');
});
