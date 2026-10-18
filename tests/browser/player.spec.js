import { test, expect } from './helpers/fixtures.js';
import { loadVideo, videoId, youtubeSource } from './helpers/youtube.js';

test.beforeEach(async ({ page }) => {
  await page.clock.install();
});

async function startLoop(page, start = '10', end = '20') {
  await page.getByLabel('A start time').fill(start);
  await page.getByLabel('B end time').fill(end);
  await page.getByRole('button', { name: 'Play loop' }).click();
}

test('seeks only outside the range while playing and leaves buffering alone', async ({ page }) => {
  await page.goto('/');
  await loadVideo(page);
  await startLoop(page);
  for (const current of [10, 15, 19.99]) {
    await page.evaluate((time) => { window.fakePlayer.time = time; }, current);
    await page.clock.fastForward(101);
  }
  expect(await page.evaluate(() => window.fakePlayer.calls.filter(([name]) => name === 'seek'))).toEqual([['seek', 10]]);
  await page.evaluate(() => { window.fakePlayer.time = 9.9; });
  await page.clock.fastForward(101);
  expect(await page.evaluate(() => window.fakePlayer.time)).toBe(10);
  await page.evaluate(() => { window.fakePlayer.time = 20; window.fakePlayer.state = 3; });
  await page.clock.fastForward(501);
  expect(await page.evaluate(() => window.fakePlayer.time)).toBe(20);
  await page.evaluate(() => { window.fakePlayer.state = 1; });
  await page.clock.fastForward(101);
  expect(await page.evaluate(() => window.fakePlayer.time)).toBe(10);
});

test('the loop pause button stops playback and background ticks never restart it', async ({ page }) => {
  await page.goto('/');
  await loadVideo(page);
  await startLoop(page, '0', '10');
  await page.getByRole('button', { name: 'Pause loop' }).click();
  await page.clock.fastForward(5_000);
  expect(await page.evaluate(() => window.fakePlayer.state)).toBe(2);
  await expect(page.locator('.playing')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play loop' })).toHaveAttribute('aria-pressed', 'false');
});

test('renaming an active loop does not interrupt it; capturing B stops it', async ({ page }) => {
  await page.goto('/');
  await loadVideo(page);
  await startLoop(page);
  await page.getByLabel('Loop name').fill('Updated name');
  await expect(page.locator('.playing')).toHaveCount(1);
  await page.evaluate(() => { window.fakePlayer.time = 18.25; });
  await page.getByRole('button', { name: 'Set B to current video time' }).click();
  await expect(page.getByLabel('B end time')).toHaveValue('18.2');
  await expect(page.locator('.playing')).toHaveCount(0);
  expect(await page.evaluate(() => window.fakePlayer.state)).toBe(2);
});

test('updates the playhead and rejects a range once delayed duration metadata arrives', async ({ page }) => {
  await page.route('https://www.youtube.com/iframe_api', (route) => route.fulfill({ contentType: 'text/javascript', body: youtubeSource({ duration: 0 }) }));
  await page.goto('/');
  await loadVideo(page);
  await startLoop(page, '10', '200');
  await page.evaluate(() => { window.fakePlayer.time = 72.8; window.fakePlayer.duration = 180; });
  await page.clock.fastForward(101);
  await expect(page.locator('#current-time')).toHaveText('1:12');
  await expect(page.locator('#duration')).toHaveText(' / 3:00');
  await expect(page.getByRole('alert')).toContainText('duration');
  await expect(page.locator('.playing')).toHaveCount(0);
});

test('reuses the player when loading another video and stops the previous loop', async ({ page }) => {
  await page.goto('/');
  await loadVideo(page);
  await startLoop(page);
  const next = 'dQw4w9WgXcQ';
  await loadVideo(page, next);
  await expect(page.locator('.playing')).toHaveCount(0);
  expect(await page.evaluate(() => window.fakePlayers.length)).toBe(1);
  expect(await page.evaluate(() => window.apiLoadCount)).toBe(1);
  expect(await page.evaluate(() => window.fakePlayer.calls.at(-1))).toEqual(['cue', next]);
  const state = await page.evaluate(() => JSON.parse(decodeURIComponent(location.hash.slice(1))));
  expect(state.id).toBe(next);
});

for (const [code, expected] of [[100, 'unavailable or private'], [101, 'cannot be embedded'], [150, 'cannot be embedded'], [153, 'could not verify'], [5, 'could not play']]) {
  test(`reports YouTube error ${code} and clears active loop state`, async ({ page }) => {
    await page.goto('/');
    await loadVideo(page);
    await startLoop(page);
    await page.evaluate((data) => window.fakePlayer.emit('onError', data), code);
    await expect(page.locator('#message')).toContainText(expected);
    await expect(page.locator('#player-status')).toHaveText('Video unavailable');
    await expect(page.locator('.playing')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Load video' })).toBeEnabled();
  });
}

test('shows failures before readiness without leaving controls locked', async ({ page }) => {
  await page.route('https://www.youtube.com/iframe_api', (route) => route.fulfill({ contentType: 'text/javascript', body: youtubeSource({ initialError: 100 }) }));
  await page.goto('/');
  await page.getByLabel('Start with a YouTube video').fill(videoId);
  await page.getByRole('button', { name: 'Load video' }).click();
  await expect(page.locator('#message')).toContainText('unavailable or private');
  await expect(page.getByRole('button', { name: 'Load video' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Set A to current video time' })).toBeDisabled();
});

test('handles autoplay blocking without retrying playback in a loop', async ({ page }) => {
  await page.goto('/');
  await loadVideo(page);
  await startLoop(page);
  await page.evaluate(() => window.fakePlayer.emit('onAutoplayBlocked'));
  await expect(page.locator('#message')).toContainText('Press Play');
  await expect(page.locator('.playing')).toHaveCount(0);
  const calls = await page.evaluate(() => window.fakePlayer.calls.length);
  await page.clock.fastForward(1_000);
  expect(await page.evaluate(() => window.fakePlayer.calls.length)).toBe(calls);
});

test('suspends timers on page hide and starts a single timer when restored', async ({ page }) => {
  await page.goto('/');
  await loadVideo(page);
  await startLoop(page);
  const beforeHide = await page.evaluate(() => {
    window.dispatchEvent(new Event('pagehide'));
    return document.querySelector('#current-time').textContent;
  });
  await expect(page.locator('.playing')).toHaveCount(0);
  await page.evaluate(() => { window.fakePlayer.time = 45; });
  await page.clock.fastForward(1_000);
  await expect(page.locator('#current-time')).toHaveText(beforeHide);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('pageshow'));
    window.dispatchEvent(new Event('pageshow'));
  });
  await page.clock.fastForward(101);
  await expect(page.locator('#current-time')).toHaveText('0:45');
});

test('navigating while the API is pending does not create an abandoned player', async ({ page }) => {
  let releaseAPI;
  await page.route('https://www.youtube.com/iframe_api', async (route) => {
    await new Promise((resolve) => { releaseAPI = resolve; });
    await route.fulfill({ contentType: 'text/javascript', body: youtubeSource() });
  });
  await page.goto('/');
  await page.getByLabel('Start with a YouTube video').fill(videoId);
  await page.getByRole('button', { name: 'Load video' }).click();
  await expect.poll(() => Boolean(releaseAPI)).toBe(true);
  await page.evaluate(() => { location.hash = ''; });
  await expect(page.locator('#player-status')).toHaveText('No video loaded');
  releaseAPI();
  await expect.poll(() => page.evaluate(() => window.apiLoadCount)).toBe(1);
  expect(await page.evaluate(() => window.fakePlayers.length)).toBe(0);
  await loadVideo(page);
  expect(await page.evaluate(() => window.fakePlayers.length)).toBe(1);
});
