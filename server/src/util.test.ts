import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayIn, hourIn, streakFromDays, toE164 } from './util.ts';

test('toE164 normalises address-book formats', () => {
  assert.equal(toE164('(415) 555-0132'), '+14155550132');
  assert.equal(toE164('1 415 555 0132'), '+14155550132');
  assert.equal(toE164('+44 20 7946 0958'), '+442079460958');
  assert.equal(toE164('555-0132'), null);
  assert.equal(toE164('+0123'), null);
});

test('streak counts back from today, or from yesterday while today is pending', () => {
  assert.equal(streakFromDays(['2026-10-10', '2026-10-09', '2026-10-08'], '2026-10-10'), 3);
  assert.equal(streakFromDays(['2026-10-09', '2026-10-08'], '2026-10-10'), 2);
  assert.equal(streakFromDays(['2026-10-08'], '2026-10-10'), 0);
  assert.equal(streakFromDays(['2026-10-01', '2026-09-30'], '2026-10-01'), 2);
});

test('day and hour follow the user time zone, not the server', () => {
  const at = new Date('2026-10-11T04:00:00Z');
  assert.equal(dayIn('America/Los_Angeles', at), '2026-10-10');
  assert.equal(hourIn('America/Los_Angeles', at), 21);
  assert.equal(dayIn('not/a-zone', at), '2026-10-11');
});
