// Only the external YouTube boundary is simulated. The page, modules, DOM,
// navigation, timers, and HTTP server all run normally in a real browser.
function installYouTube(settings) {
  window.apiLoadCount = (window.apiLoadCount ?? 0) + 1;
  window.fakePlayers ??= [];
  window.YT = { Player: class {
    constructor(target, options) {
      if (settings.constructorError) throw new Error('Player construction failed');
      this.options = options;
      this.time = 0;
      this.duration = settings.duration;
      this.state = 5;
      this.calls = [];
      this.iframe = document.createElement('iframe');
      this.iframe.id = target;
      this.iframe.srcdoc = '<!doctype html><html lang="en"><head><title>Test video</title></head><body><main>Simulated video</main></body></html>';
      document.getElementById(target).replaceWith(this.iframe);
      window.fakePlayer = this;
      window.fakePlayers.push(this);
      if (settings.initialError) setTimeout(() => this.emit('onError', settings.initialError), 0);
      else if (settings.autoReady) setTimeout(() => this.emit('onReady'), 0);
    }
    emit(name, data) { this.options.events[name]?.({ target: this, data }); }
    getCurrentTime() { return this.time; }
    getDuration() { return this.duration; }
    getPlayerState() { return this.state; }
    getIframe() { return this.iframe; }
    seekTo(time) { this.time = time; this.calls.push(['seek', time]); }
    playVideo() { this.state = 1; this.calls.push(['play']); this.emit('onStateChange', 1); }
    pauseVideo() { this.state = 2; this.calls.push(['pause']); this.emit('onStateChange', 2); }
    cueVideoById(id) { this.time = 0; this.state = 5; this.calls.push(['cue', id]); this.emit('onStateChange', 5); }
    destroy() { this.calls.push(['destroy']); this.destroyed = true; this.iframe.remove(); }
  } };
  window.onYouTubeIframeAPIReady();
}

export function youtubeSource(options = {}) {
  return `(${installYouTube.toString()})(${JSON.stringify({ autoReady: true, duration: 180, ...options })});`;
}

export const videoId = 'M7lc1UVf-VE';

export async function loadVideo(page, id = videoId) {
  await page.getByLabel('Start with a YouTube video').fill(`https://youtu.be/${id}`);
  await page.getByRole('button', { name: 'Load video' }).click();
  await page.locator('#player-status').getByText('Video ready', { exact: true }).waitFor();
}
