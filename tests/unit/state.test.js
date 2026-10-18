import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeState, emptyState, encodeState, extractVideoId, formatTime, parseTime, validateRange } from '../../src/state.js';

const id = 'M7lc1UVf-VE';

test('accepts video IDs and common YouTube URL formats', () => {
  for (const input of [
    id, ` https://www.youtube.com/watch?v=${id}&t=30 `, `youtu.be/${id}?t=30`,
    `https://m.youtube.com/watch?v=${id}`, `https://music.youtube.com/watch?v=${id}`,
    `https://youtube.com/shorts/${id}`, `https://youtube.com/live/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
  ]) assert.equal(extractVideoId(input), id, input);
});

test('rejects lookalike domains, unsupported protocols and malformed IDs', () => {
  for (const input of [
    '', null, {}, 'invalid', 'too-long-video-id', 'javascript:alert(1)',
    `https://youtube.com.evil.example/watch?v=${id}`, `https://evil.example/${id}`,
    `https://youtube.com@evil.example/watch?v=${id}`, `ftp://youtube.com/watch?v=${id}`,
    'https://youtube.com/watch?v=<script>',
  ]) assert.equal(extractVideoId(input), null, String(input));
});

test('parses seconds, decimals, and clock times without coercing invalid values', () => {
  for (const [input, expected] of [[0, 0], ['0', 0], [' 90.5 ', 90.5], ['1:30', 90], ['1:02:03.5', 3723.5]]) {
    assert.equal(parseTime(input), expected);
  }
  for (const input of ['', ' ', '-1', '1:60', '1:99:00', '2cats', 'Infinity', null, true, Infinity, -1, '1e3']) {
    assert.ok(Number.isNaN(parseTime(input)), String(input));
  }
});

test('requires a finite, increasing range within the video', () => {
  assert.deepEqual(validateRange(['0', '1:30'], 120), [0, 90]);
  assert.deepEqual(validateRange(['1.25', '2.5']), [1.25, 2.5]);
  assert.throws(() => validateRange(['', '10']), /Enter both/);
  assert.throws(() => validateRange(['10', '10']), /later/);
  assert.throws(() => validateRange(['20', '10']), /later/);
  assert.throws(() => validateRange(['0', '121'], 120), /duration/);
});

test('round-trips Unicode and reserved characters in shared sessions', () => {
  const state = { id, title: 'Guitarra 🎸 < > & # %2F ?', intervals: [{ title: 'não / # & =', range: ['0', '1:30.5'] }] };
  assert.deepEqual(decodeState(encodeState(state)), state);
});

test('keeps existing encodeURI links and numeric ranges compatible', () => {
  const old = { id, title: 'eu < não #&; %20', intervals: [{ title: 'old loop', range: [10, 15] }] };
  assert.deepEqual(decodeState(`#${encodeURI(JSON.stringify(old))}`), {
    ...old, intervals: [{ title: 'old loop', range: ['10', '15'] }],
  });
});

test('rejects corrupt or unstructured shared state without trusting object fields', () => {
  for (const value of [null, [], {}, { ...emptyState(), id: 'invalid' },
    { ...emptyState(), intervals: [null] }, { ...emptyState(), intervals: [{ title: '', range: [{}, []] }] },
    { ...emptyState(), intervals: Array(101).fill({ title: '', range: [0, 10] }) }]) {
    assert.throws(() => decodeState(`#${encodeURIComponent(JSON.stringify(value))}`), /invalid/);
  }
  for (const hash of ['#%ZZ', '#oops', '#%7B', `#${'x'.repeat(64_000)}`]) assert.throws(() => decodeState(hash));
  assert.deepEqual(decodeState(''), emptyState());
  assert.deepEqual(decodeState('#'), emptyState());
  assert.deepEqual(decodeState(encodeState({ ...emptyState(), intervals: [] })), emptyState());
});

test('normalizes old URL IDs and bounds generated links as well as incoming links', () => {
  assert.equal(decodeState(encodeState({ ...emptyState(), id: `https://youtu.be/${id}` })).id, id);
  assert.throws(() => encodeState({ ...emptyState(), title: 'x'.repeat(64_000) }), /too large/);
});

test('formats a stable playhead including videos longer than an hour', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(90.9), '1:30');
  assert.equal(formatTime(3723), '1:02:03');
  assert.equal(formatTime(NaN), '0:00');
});
