import { test, expect } from './helpers/fixtures.js';
import { videoId as id, youtubeSource, loadVideo } from './helpers/youtube.js';

test('edits sessions without contacting YouTube and saves without adding history entries', async ({ page }, testInfo) => {
  const errors = [];
  const youtubeRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => { if (request.url().includes('youtube.com')) youtubeRequests.push(request.url()); });
  await page.goto('/');
  const historyLength = await page.evaluate(() => history.length);
  await page.getByLabel('Session name').fill('Example session');
  await page.getByLabel('Loop name').fill('Section 1');
  await page.getByLabel('A start time').fill('0');
  await page.getByLabel('B end time').fill('0:15');
  await page.getByRole('button', { name: '+ Add loop' }).click();
  await expect(page.locator('.loop-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Remove loop' }).last().click();
  await expect(page.getByLabel('Loop name')).toHaveValue('Section 1');
  await expect(page.getByRole('button', { name: 'Remove loop' })).toBeDisabled();
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await page.reload();
  await expect(page.getByLabel('Session name')).toHaveValue('Example session');
  await expect(page.getByLabel('B end time')).toHaveValue('0:15');
  expect(youtubeRequests).toEqual([]);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('session.png'), fullPage: true });
});

test('validates video input and recovers from malformed shared links', async ({ page }) => {
  await page.goto('/#%ZZ');
  await expect(page.getByRole('status').filter({ hasText: 'session link is invalid' })).toBeVisible();
  await page.getByLabel('Start with a YouTube video').fill(`https://youtube.com.evil.example/watch?v=${id}`);
  await page.getByRole('button', { name: 'Load video' }).click();
  await expect(page.locator('#video-url')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#message')).toContainText('valid YouTube link');
  await loadVideo(page);
  await expect(page.locator('#video-url')).not.toHaveAttribute('aria-invalid');
});

test('loads legacy sessions safely and follows hash changes', async ({ page }) => {
  const old = { id, title: 'Não <script> & #', intervals: [{ title: '<img src=x onerror=alert(1)>', range: [10, 15] }] };
  await page.goto(`/#${encodeURI(JSON.stringify(old))}`);
  await expect(page.locator('#player-status')).toHaveText('Video ready');
  await expect(page.getByLabel('Session name')).toHaveValue(old.title);
  await expect(page.getByLabel('Loop name')).toHaveValue(old.intervals[0].title);
  await expect(page.getByLabel('A start time')).toHaveValue('10');
  await expect(page.locator('.loop-card img')).toHaveCount(0);
  await page.evaluate(() => { location.hash = ''; });
  await expect(page.getByLabel('Session name')).toHaveValue('');
  await expect(page.locator('#player-placeholder')).toBeVisible();
});

test('validates ranges, loops at B, captures time, and respects native pause', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play loop' }).click();
  await expect(page.getByRole('alert')).toContainText('Load a video');
  await loadVideo(page);
  await page.getByLabel('A start time').fill('20');
  await page.getByLabel('B end time').fill('10');
  await page.getByRole('button', { name: 'Play loop' }).click();
  await expect(page.getByRole('alert')).toContainText('later than A');
  await page.getByLabel('B end time').fill('181');
  await page.getByRole('button', { name: 'Play loop' }).click();
  await expect(page.getByRole('alert')).toContainText('duration');
  await page.getByLabel('A start time').fill('0:10');
  await page.getByLabel('B end time').fill('0:20');
  await page.getByRole('button', { name: 'Play loop' }).click();
  await expect(page.getByRole('button', { name: 'Pause loop' })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => { window.fakePlayer.time = 20; });
  await expect.poll(() => page.evaluate(() => window.fakePlayer.calls.filter(([action]) => action === 'seek').length)).toBe(2);
  expect(await page.evaluate(() => window.fakePlayer.time)).toBe(10);
  await page.evaluate(() => window.fakePlayer.pauseVideo());
  await expect(page.getByRole('button', { name: 'Play loop' })).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.fakePlayer.state)).toBe(2);
  await page.evaluate(() => { window.fakePlayer.time = 32.7; });
  await page.getByRole('button', { name: 'Set A to current video time' }).click();
  await expect(page.getByLabel('A start time')).toHaveValue('32.7');
});

test('switches loops, stops on edit or removal, and restarts at the video end', async ({ page }) => {
  await page.goto('/');
  await loadVideo(page);
  await page.getByLabel('A start time').fill('0');
  await page.getByLabel('B end time').fill('10');
  await page.getByRole('button', { name: 'Play loop' }).click();
  await page.getByRole('button', { name: '+ Add loop' }).click();
  await page.getByLabel('A start time').last().fill('170');
  await page.getByLabel('B end time').last().fill('180');
  await page.getByRole('button', { name: 'Play loop' }).click();
  await expect(page.locator('.playing')).toHaveCount(1);
  await page.evaluate(() => {
    window.fakePlayer.state = 0;
    window.fakePlayer.time = 180;
    window.fakePlayer.options.events.onStateChange({ data: 0, target: window.fakePlayer });
  });
  expect(await page.evaluate(() => [window.fakePlayer.time, window.fakePlayer.state])).toEqual([170, 1]);
  await page.getByLabel('B end time').last().fill('179');
  await expect(page.locator('.playing')).toHaveCount(0);
  await page.getByRole('button', { name: 'Play loop' }).last().click();
  await page.getByRole('button', { name: 'Remove loop' }).last().click();
  await expect(page.locator('.playing')).toHaveCount(0);
  expect(await page.evaluate(() => window.fakePlayer.state)).toBe(2);
});

test('recovers after an API failure and displays player errors', async ({ page }) => {
  await page.route('https://www.youtube.com/iframe_api', (route) => route.abort(), { times: 1 });
  await page.goto('/');
  await page.getByLabel('Start with a YouTube video').fill(id);
  await page.getByRole('button', { name: 'Load video' }).click();
  await expect(page.locator('#message')).toContainText('Could not connect to YouTube');
  await expect(page.getByRole('button', { name: 'Load video' })).toBeEnabled();
  await page.getByLabel('Loop name').fill('Still editable');
  await loadVideo(page);
  await page.evaluate(() => window.fakePlayer.options.events.onError({ data: 150, target: window.fakePlayer }));
  await expect(page.locator('#message')).toContainText('cannot be embedded');
  await expect(page.getByLabel('Loop name')).toHaveValue('Still editable');
});

test('times out a silent API connection and keeps the editor usable', async ({ page }) => {
  await page.clock.install();
  await page.route('https://www.youtube.com/iframe_api', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.goto('/');
  await page.getByLabel('Start with a YouTube video').fill(id);
  await page.getByRole('button', { name: 'Load video' }).click();
  await page.clock.fastForward(12_001);
  await expect(page.locator('#message')).toContainText('YouTube took too long');
  await expect(page.getByRole('button', { name: 'Load video' })).toBeEnabled();
  await page.getByLabel('Loop name').fill('Offline session');
  await expect(page.getByLabel('Loop name')).toHaveValue('Offline session');
});

test('cancels a pending player when navigating to another session', async ({ page }) => {
  // Hold onReady to simulate navigation while the iframe is connecting.
  await page.route('https://www.youtube.com/iframe_api', (route) => route.fulfill({
    contentType: 'text/javascript', body: youtubeSource({ autoReady: false }),
  }));
  await page.goto('/');
  await page.getByLabel('Start with a YouTube video').fill(id);
  await page.getByRole('button', { name: 'Load video' }).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.fakePlayer))).toBe(true);
  await page.evaluate(() => {
    window.stalePlayer = window.fakePlayer;
    location.hash = '';
  });
  await expect(page.locator('#player-status')).toHaveText('No video loaded');
  await page.evaluate(() => {
    window.stalePlayer.options.events.onReady({ target: window.stalePlayer });
    window.stalePlayer.options.events.onError({ data: 150, target: window.stalePlayer });
  });
  await expect(page.locator('#player-status')).toHaveText('No video loaded');
  await expect(page.locator('#player-placeholder')).toBeVisible();
  await expect(page.locator('#message')).toBeHidden();
});

test('times out an unresponsive iframe and allows another load attempt', async ({ page }) => {
  await page.clock.install();
  await page.route('https://www.youtube.com/iframe_api', (route) => route.fulfill({
    contentType: 'text/javascript', body: youtubeSource({ autoReady: false }),
  }));
  await page.goto('/');
  await page.getByLabel('Start with a YouTube video').fill(id);
  await page.getByRole('button', { name: 'Load video' }).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.fakePlayer))).toBe(true);
  await page.clock.fastForward(12_001);
  await expect(page.locator('#message')).toContainText('player took too long');
  await page.evaluate(() => {
    // A late readiness event from the failed iframe must not revive it.
    window.fakePlayer.options.events.onReady({ target: window.fakePlayer });
    const PendingPlayer = window.YT.Player;
    window.YT.Player = class extends PendingPlayer {
      constructor(target, options) {
        super(target, options);
        queueMicrotask(() => options.events.onReady({ target: this }));
      }
    };
  });
  await expect(page.locator('#player-placeholder')).toBeVisible();
  await loadVideo(page);
});
