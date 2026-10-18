import { decodeState, emptyInterval, emptyState, encodeState, extractVideoId, formatTime, validateRange } from './state.js';

const $ = (selector, root = document) => root.querySelector(selector);
const loops = $('#loops');
const template = $('#loop-template');
let videoId = '';
let player;
let playerReady = false;
let activeLoop = null;
let ticker;
let apiPromise;
let loadSequence = 0;
let cancelPlayerLoad;

function message(text, error = false) {
  $('#message').textContent = text;
  $('#message').classList.toggle('error', error);
  $('#message').hidden = !text;
}

function collectState() {
  return {
    id: videoId,
    title: $('#session-title').value,
    intervals: [...loops.children].map((card) => ({
      title: $('.loop-title', card).value,
      range: [$('.loop-start', card).value, $('.loop-end', card).value],
    })),
  };
}

function saveState() {
  try {
    // Replace rather than push so typing does not fill the browser's Back history.
    history.replaceState(null, '', encodeState(collectState()));
    return true;
  } catch (error) {
    message(error.message, true);
    return false;
  }
}

function updateControls() {
  const cards = [...loops.children];
  $('#loop-count').textContent = String(cards.length).padStart(2, '0');
  $('#add-loop').disabled = cards.length >= 100;
  cards.forEach((card, index) => {
    $('.loop-number', card).textContent = String(index + 1).padStart(2, '0');
    $('.remove-loop', card).disabled = cards.length === 1;
    $('.set-start', card).disabled = !playerReady;
    $('.set-end', card).disabled = !playerReady;
  });
}

function appendLoop(interval = emptyInterval()) {
  const card = template.content.firstElementChild.cloneNode(true);
  $('.loop-title', card).value = interval.title;
  $('.loop-start', card).value = interval.range[0];
  $('.loop-end', card).value = interval.range[1];
  loops.append(card);
  updateControls();
  return card;
}

function stopLoop(pause = false) {
  if (activeLoop) {
    activeLoop.card.classList.remove('playing');
    const button = $('.play-loop', activeLoop.card);
    button.textContent = '▶ Play loop';
    button.setAttribute('aria-pressed', 'false');
    activeLoop = null;
  }
  if (pause && playerReady) player.pauseVideo();
  if (playerReady) $('#player-status').textContent = 'Video ready';
}

function playLoop(card) {
  const error = $('.loop-error', card);
  error.hidden = true;
  if (!playerReady) {
    error.textContent = 'Load a video and wait for it to be ready before playing a loop.';
    error.hidden = false;
    return;
  }
  if (activeLoop?.card === card) {
    stopLoop(true);
    return;
  }
  try {
    const range = validateRange(
      [$('.loop-start', card).value, $('.loop-end', card).value], player.getDuration(),
    );
    stopLoop();
    activeLoop = { card, range };
    card.classList.add('playing');
    $('.play-loop', card).textContent = 'Ⅱ Pause loop';
    $('.play-loop', card).setAttribute('aria-pressed', 'true');
    $('#player-status').textContent = `Looping ${formatTime(range[0])} → ${formatTime(range[1])}`;
    player.seekTo(range[0], true);
    player.playVideo();
  } catch (reason) {
    error.textContent = reason.message;
    error.hidden = false;
  }
}

function tick() {
  if (!playerReady) return;
  const current = player.getCurrentTime();
  const duration = player.getDuration();
  $('#current-time').textContent = formatTime(current);
  $('#duration').textContent = ` / ${formatTime(duration)}`;
  if (activeLoop && duration > 0 && activeLoop.range[1] > duration) {
    const error = $('.loop-error', activeLoop.card);
    error.textContent = 'B must be within the video’s duration.';
    error.hidden = false;
    stopLoop(true);
  }
  // Respect pauses in the native player. Only seek while playback is active.
  if (activeLoop && player.getPlayerState() === 1) {
    const [start, end] = activeLoop.range;
    if (current < start || current >= end) player.seekTo(start, true);
  }
}

function startTicker() {
  clearInterval(ticker);
  ticker = setInterval(tick, 100);
}

function loadYouTubeAPI() {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = setTimeout(() => finish(new Error('YouTube took too long to respond. Check your connection and load the video again.')), 12_000);
    function finish(error) {
      clearTimeout(timeout);
      script.onerror = null;
      delete window.onYouTubeIframeAPIReady;
      if (error) {
        script.remove();
        apiPromise = null;
        reject(error);
      } else resolve();
    }
    window.onYouTubeIframeAPIReady = () => finish();
    script.onerror = () => finish(new Error('Could not connect to YouTube. Check your connection or content blocker, then load the video again.'));
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.head.append(script);
  });
  return apiPromise;
}

function playerError(code) {
  if ([101, 150].includes(code)) return 'This video cannot be embedded. Try another YouTube video.';
  if (code === 100) return 'This video is unavailable or private. Try another video.';
  if (code === 153) return 'YouTube could not verify this player. Open the app over HTTP or HTTPS and allow the page’s referrer.';
  return 'YouTube could not play this video. Try loading it again or choose another video.';
}

async function loadVideo(id, persist = true) {
  const sequence = ++loadSequence;
  cancelPlayerLoad?.();
  stopLoop(true);
  videoId = id;
  $('#video-url').value = id;
  $('#video-url').removeAttribute('aria-invalid');
  if (persist) saveState();
  message('');
  $('#load-video').disabled = true;
  $('#player-status').textContent = 'Connecting to YouTube…';
  try {
    if (playerReady) {
      player.cueVideoById(id);
    } else {
      await loadYouTubeAPI();
      if (sequence !== loadSequence) return;
      player?.destroy();
      if (!$('#player')) {
        const target = document.createElement('div');
        target.id = 'player';
        $('#player-shell').prepend(target);
      }
      await new Promise((resolve, reject) => {
        let settled = false;
        const cancel = () => finish(new Error('Video load cancelled.'));
        const timeout = setTimeout(() => finish(new Error('The video player took too long to load. Try loading the video again.')), 12_000);
        function finish(error) {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          if (cancelPlayerLoad === cancel) cancelPlayerLoad = undefined;
          if (error) reject(error);
          else resolve();
        }
        cancelPlayerLoad = cancel;
        player = new window.YT.Player('player', {
          width: '100%', height: '100%', videoId: id,
          playerVars: { playsinline: 1, origin: location.origin },
          events: {
            onReady: ({ target }) => {
              if (settled || sequence !== loadSequence || target !== player) return;
              playerReady = true;
              $('#player-placeholder').hidden = true;
              const iframe = player.getIframe();
              iframe.title = 'YouTube video';
              startTicker();
              updateControls();
              finish();
            },
            onStateChange: ({ data, target }) => {
              if (target !== player) return;
              if (data === 2) stopLoop();
              else if (data === 0 && activeLoop) {
                player.seekTo(activeLoop.range[0], true);
                player.playVideo();
              }
            },
            onError: ({ data, target }) => {
              if (target !== player) return;
              stopLoop();
              message(playerError(data), true);
              $('#player-status').textContent = 'Video unavailable';
              if (!playerReady) finish(new Error(playerError(data)));
            },
            onAutoplayBlocked: ({ target }) => {
              if (target !== player) return;
              stopLoop();
              message('Press Play in the video player, then start your loop.');
            },
          },
        });
      });
    }
    if (sequence === loadSequence) $('#player-status').textContent = 'Video ready';
  } catch (error) {
    if (sequence !== loadSequence) return;
    playerReady = false;
    player?.destroy();
    player = undefined;
    $('#player-placeholder').hidden = false;
    $('#player-status').textContent = 'Connection unavailable';
    updateControls();
    message(error.message, true);
  } finally {
    if (sequence === loadSequence) $('#load-video').disabled = false;
  }
}

function restoreSession() {
  // Invalidate any pending load before applying a different shared link.
  loadSequence += 1;
  cancelPlayerLoad?.();
  stopLoop(true);
  let state;
  try {
    state = decodeState(location.hash);
    message('');
  } catch (error) {
    state = emptyState();
    message(`${error.message} You can start a new session below.`, true);
  }
  videoId = state.id;
  $('#video-url').value = state.id;
  $('#session-title').value = state.title;
  document.title = state.title ? `${state.title} · AB Looper` : 'AB Looper';
  loops.replaceChildren();
  state.intervals.forEach(appendLoop);
  $('#load-video').disabled = false;
  if (videoId) void loadVideo(videoId, false);
  else {
    playerReady = false;
    player?.destroy();
    player = undefined;
    clearInterval(ticker);
    $('#player-placeholder').hidden = false;
    $('#player-status').textContent = 'No video loaded';
    $('#current-time').textContent = '0:00';
    $('#duration').textContent = ' / 0:00';
    updateControls();
  }
}

$('#video-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const id = extractVideoId($('#video-url').value);
  if (!id) {
    $('#video-url').setAttribute('aria-invalid', 'true');
    message('Enter a valid YouTube link or an 11-character video ID.', true);
    $('#video-url').focus();
    return;
  }
  void loadVideo(id);
});
$('#video-url').addEventListener('input', () => $('#video-url').removeAttribute('aria-invalid'));
$('#session-title').addEventListener('input', () => {
  document.title = $('#session-title').value ? `${$('#session-title').value} · AB Looper` : 'AB Looper';
  saveState();
});
$('#add-loop').addEventListener('click', () => {
  if (loops.children.length >= 100) return;
  const card = appendLoop();
  $('.loop-title', card).focus();
  saveState();
});
loops.addEventListener('input', (event) => {
  const card = event.target.closest('.loop-card');
  if (!card) return;
  $('.loop-error', card).hidden = true;
  if (activeLoop?.card === card && !event.target.matches('.loop-title')) stopLoop(true);
  saveState();
});
loops.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  const card = button?.closest('.loop-card');
  if (!card) return;
  if (button.matches('.remove-loop') && loops.children.length > 1) {
    if (activeLoop?.card === card) stopLoop(true);
    const next = card.nextElementSibling ?? card.previousElementSibling;
    card.remove();
    updateControls();
    $('.loop-title', next).focus();
    saveState();
  } else if (button.matches('.play-loop')) {
    playLoop(card);
  } else if (button.matches('.set-start, .set-end') && playerReady) {
    if (activeLoop?.card === card) stopLoop(true);
    const input = button.matches('.set-start') ? $('.loop-start', card) : $('.loop-end', card);
    input.value = String(Math.floor(player.getCurrentTime() * 10) / 10);
    $('.loop-error', card).hidden = true;
    saveState();
  }
});
$('#share').addEventListener('click', async () => {
  if (!saveState()) return;
  const button = $('#share');
  const data = { title: $('#session-title').value || 'AB Looper', url: location.href };
  button.disabled = true;
  message('');
  try {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(data);
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(data.url);
      message('Session link copied.');
    } catch {
      message('Copy the link from your browser’s address bar to share this session.');
    }
  } finally {
    button.disabled = false;
  }
});
window.addEventListener('hashchange', restoreSession);
window.addEventListener('pagehide', () => { stopLoop(true); clearInterval(ticker); });
window.addEventListener('pageshow', () => { if (playerReady) startTicker(); });
restoreSession();
