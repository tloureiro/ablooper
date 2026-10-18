import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeState, emptyInterval, emptyState, encodeState, extractVideoId, formatTime, parseTime, validateRange } from '../../src/state.js';

const id = 'M7lc1UVf-VE';

test('new sessions and intervals never share mutable defaults', () => {
  const first = emptyState();
  first.intervals[0].range[0] = '10';
  first.intervals.push(emptyInterval());
  assert.deepEqual(emptyState(), { id: '', title: '', intervals: [{ title: '', range: ['', ''] }] });
  assert.notEqual(emptyInterval().range, emptyInterval().range);
});

test('handles protocol-less, case-insensitive, and privacy-enhanced YouTube URLs', () => {
  for (const value of [
    `HTTP://WWW.YOUTUBE.COM/watch?v=${id}`, `www.youtu.be/${id}`,
    `www.youtube.com/embed/${id}`, `https://youtube-nocookie.com/embed/${id}`,
    `https://www.youtube.com/watch?list=PL123&v=${id}#t=10`,
  ]) assert.equal(extractVideoId(value), id, value);
});

test('rejects missing IDs, invalid URL syntax and unrecognized YouTube paths', () => {
  for (const value of [
    'https://[', 'https://youtube.com/watch', 'https://youtube.com/shorts/',
    `https://youtube.com/channel/${id}`, `https://youtube.com/watch?v=${id}x`,
    `https://youtube.com./watch?v=${id}`, `https://youtube.example/watch?v=${id}`,
    'https://youtu.be/', 'https://youtube.com/watch?v=',
  ]) assert.equal(extractVideoId(value), null, value);
});

test('rejects non-finite and overflowing time values', () => {
  for (const value of [-Infinity, NaN, [], {}, '1:2:3:4', '1.2:03', '.5', '1.', '9'.repeat(400)]) {
    assert.ok(Number.isNaN(parseTime(value)), String(value));
  }
});

test('accepts valid clock boundaries and fractional seconds', () => {
  for (const [value, expected] of [['00:00', 0], ['59:59.99', 3599.99], ['100:00:00', 360000], ['1:2', 62]]) {
    assert.equal(parseTime(value), expected);
  }
});

test('range validation rejects malformed ranges with a useful message', () => {
  for (const value of [null, undefined, {}, '0,10', [], [0], [0, 10, 20]]) {
    assert.throws(() => validateRange(value), /Enter both A and B/);
  }
});

test('permits endpoints at exactly the duration, and handles unknown durations', () => {
  assert.deepEqual(validateRange(['0', '180'], 180), [0, 180]);
  for (const duration of [0, Infinity, NaN, undefined]) {
    assert.deepEqual(validateRange(['0', '180'], duration), [0, 180]);
  }
});

test('formats second, minute, and hour boundaries without rounding up', () => {
  for (const [value, expected] of [[-1, '0:00'], [Infinity, '0:00'], [59.999, '0:59'], [60, '1:00'], [3599, '59:59'], [3600, '1:00:00']]) {
    assert.equal(formatTime(value), expected);
  }
});

test('normalizes numeric ranges, discards unrelated fields, and leaves the input untouched', () => {
  const state = { id, title: 'Name', unrelated: true, intervals: [{ title: 'Loop', range: [0, 10], extra: 'ignored' }] };
  const original = structuredClone(state);
  const output = decodeState(encodeState(state));
  assert.deepEqual(output, { id, title: 'Name', intervals: [{ title: 'Loop', range: ['0', '10'] }] });
  assert.deepEqual(state, original);
});

test('retains incomplete editing values without pretending they are playable', () => {
  const state = { id, title: '', intervals: [{ title: '', range: ['', 'unfinished'] }] };
  assert.deepEqual(decodeState(encodeState(state)), state);
  assert.throws(() => validateRange(state.intervals[0].range));
});

test('enforces structured interval values on both encode and decode', () => {
  for (const interval of [
    false, [], {}, { title: 1, range: [0, 10] }, { title: '', range: [0] },
    { title: '', range: [0, 1, 2] }, { title: '', range: [null, 10] },
    { title: '', range: [true, 10] }, { title: '', range: [Infinity, 10] },
  ]) assert.throws(() => encodeState({ id, title: '', intervals: [interval] }), /invalid/);
  for (const patch of [{ title: null }, { id: 123 }, { intervals: {} }]) {
    assert.throws(() => encodeState({ ...emptyState(), ...patch }), /invalid/);
  }
});

test('supports exactly 100 loops and rejects 101 on both sides of the link', () => {
  const state = { id, title: '', intervals: Array.from({ length: 100 }, (_, index) => ({ title: String(index), range: ['0', '10'] })) };
  assert.deepEqual(decodeState(encodeState(state)), state);
  state.intervals.push(emptyInterval());
  assert.throws(() => encodeState(state), /invalid/);
  assert.throws(() => decodeState(`#${encodeURIComponent(JSON.stringify(state))}`), /invalid/);
});

test('accepts the maximum link size and rejects the next character', () => {
  const state = emptyState();
  const overhead = encodeState(state).length;
  state.title = 'x'.repeat(64_000 - overhead);
  const hash = encodeState(state);
  assert.equal(hash.length, 64_000);
  assert.deepEqual(decodeState(hash), state);
  state.title += 'x';
  assert.throws(() => encodeState(state), /too large/);
  assert.throws(() => decodeState(`${hash}x`), /too large/);
});

test('keeps prototype-like fields and HTML in JSON as inert data', () => {
  const hash = `#${encodeURIComponent('{"id":"","title":"<script>alert(1)</script>","__proto__":{"polluted":true},"intervals":[]}')}`;
  const state = decodeState(hash);
  assert.equal(state.title, '<script>alert(1)</script>');
  assert.equal(Object.hasOwn(state, '__proto__'), false);
  assert.equal(Object.getPrototypeOf(state), Object.prototype);
  assert.equal({}.polluted, undefined);
});

test('round-trips a deterministic range of Unicode sessions and timestamp formats', () => {
  // Generated cases exercise encoding combinations without a randomness-dependent failure.
  const symbols = ['plain', '日本語', 'العربية', 'não', '📺', '% # & ? / + =', '<>&"\''];
  for (let index = 0; index < 300; index += 1) {
    const start = index * 1.25;
    const end = start + .5;
    const state = {
      id: index % 2 ? id : '', title: `${symbols[index % symbols.length]} ${index}`,
      intervals: [{ title: symbols[(index + 1) % symbols.length], range: [String(start), String(end)] }],
    };
    assert.deepEqual(decodeState(encodeState(state)), state);
    assert.deepEqual(validateRange(state.intervals[0].range), [start, end]);
    assert.equal(parseTime(formatTime(start)), Math.floor(start));
  }
});
