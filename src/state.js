const VIDEO_ID = /^[\w-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com',
  'youtube-nocookie.com', 'www.youtube-nocookie.com',
]);

export function extractVideoId(input) {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (VIDEO_ID.test(value)) return value;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    let id;
    if (url.hostname === 'youtu.be' || url.hostname === 'www.youtu.be') {
      [id] = parts;
    } else if (YOUTUBE_HOSTS.has(url.hostname)) {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else if (['embed', 'shorts', 'live'].includes(parts[0])) [, id] = parts;
    }
    return VIDEO_ID.test(id ?? '') ? id : null;
  } catch {
    return null;
  }
}

export function emptyInterval() {
  return { title: '', range: ['', ''] };
}

export function emptyState() {
  return { id: '', title: '', intervals: [emptyInterval()] };
}

export function parseTime(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : NaN;
  if (typeof value !== 'string' || !value.trim()) return NaN;
  const text = value.trim();
  if (!/^\d+(?::\d{1,2}){0,2}(?:\.\d+)?$/.test(text)) return NaN;
  const parts = text.split(':').map(Number);
  if (parts.slice(1).some((part) => part >= 60)) return NaN;
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return Number.isFinite(seconds) ? seconds : NaN;
}

export function validateRange(range, duration = Infinity) {
  if (!Array.isArray(range) || range.length !== 2) {
    throw new Error('Enter both A and B as seconds or a time like 1:30.');
  }
  const [start, end] = range.map(parseTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error('Enter both A and B as seconds or a time like 1:30.');
  }
  if (end <= start) throw new Error('B must be later than A.');
  if (Number.isFinite(duration) && duration > 0 && end > duration) {
    throw new Error('B must be within the video’s duration.');
  }
  return [start, end];
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

function normalizeState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || typeof value.id !== 'string' || typeof value.title !== 'string'
    || !Array.isArray(value.intervals) || value.intervals.length > 100) {
    throw new Error('This session link is invalid.');
  }
  const id = value.id ? extractVideoId(value.id) : '';
  if (id === null) throw new Error('This session link contains an invalid YouTube video.');
  const intervals = value.intervals.map((interval) => {
    if (!interval || typeof interval.title !== 'string' || !Array.isArray(interval.range)
      || interval.range.length !== 2 || !interval.range.every((time) => (
        typeof time === 'string' || (typeof time === 'number' && Number.isFinite(time))
      ))) {
      throw new Error('This session link contains an invalid loop.');
    }
    return { title: interval.title, range: interval.range.map(String) };
  });
  return { id, title: value.title, intervals: intervals.length ? intervals : [emptyInterval()] };
}

export function decodeState(hash) {
  if (!hash || hash === '#') return emptyState();
  if (hash.length > 64_000) throw new Error('This session link is too large.');
  try {
    // decodeURIComponent also reads links produced by the original encodeURI implementation.
    return normalizeState(JSON.parse(decodeURIComponent(hash.replace(/^#/, ''))));
  } catch (error) {
    if (error instanceof URIError || error instanceof SyntaxError) {
      throw new Error('This session link is invalid.', { cause: error });
    }
    throw error;
  }
}

export function encodeState(state) {
  const hash = `#${encodeURIComponent(JSON.stringify(normalizeState(state)))}`;
  if (hash.length > 64_000) throw new Error('This session is too large to share.');
  return hash;
}
