import assert from 'node:assert/strict';
import { test } from 'node:test';
import { durationToIso } from './duration.ts';

test('durationToIso turns HH:MM:SS into an ISO 8601 duration', () => {
  assert.equal(durationToIso('00:01:30'), 'PT1M30S');
  assert.equal(durationToIso('01:00:05'), 'PT1H5S');
  assert.equal(durationToIso('12:34:56'), 'PT12H34M56S');
  assert.equal(durationToIso('00:00:45'), 'PT45S');
  assert.equal(durationToIso('02:00:00'), 'PT2H');
});

test('durationToIso writes a zero length as PT0S', () => {
  assert.equal(durationToIso('00:00:00'), 'PT0S');
});

test('durationToIso rejects anything but HH:MM:SS', () => {
  for (const bad of ['0:30', '00:60:00', '00:00:30:00', 'x', '']) {
    assert.throws(() => durationToIso(bad), /HH:MM:SS/, bad);
  }
});
