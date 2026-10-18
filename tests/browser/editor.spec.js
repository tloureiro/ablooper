import { test, expect } from './helpers/fixtures.js';
import { loadVideo, videoId } from './helpers/youtube.js';

test('initial state has one loop, disabled capture/removal controls, and no network player', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('AB Looper');
  await expect(page.locator('.loop-card')).toHaveCount(1);
  await expect(page.locator('#loop-count')).toHaveText('01');
  await expect(page.getByRole('button', { name: 'Remove loop' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Set A to current video time' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Set B to current video time' })).toBeDisabled();
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(await page.evaluate(() => window.YT)).toBeUndefined();
});

test('updates the document title, restores the default, and clears invalid video feedback', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Session name').fill('Example');
  await expect(page).toHaveTitle('Example · AB Looper');
  await page.getByLabel('Session name').fill('');
  await expect(page).toHaveTitle('AB Looper');
  await page.getByRole('button', { name: 'Load video' }).click();
  await expect(page.getByLabel('Start with a YouTube video')).toBeFocused();
  await expect(page.locator('#video-url')).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('Start with a YouTube video').fill(videoId);
  await expect(page.locator('#video-url')).not.toHaveAttribute('aria-invalid');
});

test('removing the first loop preserves the next loop and its focus', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Loop name').fill('Remove this');
  await page.getByRole('button', { name: '+ Add loop' }).click();
  await page.getByLabel('Loop name').last().fill('Keep this');
  await page.getByRole('button', { name: 'Remove loop' }).first().click();
  await expect(page.getByLabel('Loop name')).toHaveValue('Keep this');
  await expect(page.getByLabel('Loop name')).toBeFocused();
  await expect(page.locator('.loop-number')).toHaveText('01');
  await expect(page.locator('#loop-count')).toHaveText('01');
});

test('enforces the loop limit and re-enables adding after removal', async ({ page }) => {
  const state = { id: '', title: '', intervals: Array.from({ length: 100 }, (_, index) => ({ title: `Loop ${index}`, range: ['', ''] })) };
  await page.goto(`/#${encodeURIComponent(JSON.stringify(state))}`);
  await expect(page.locator('.loop-card')).toHaveCount(100);
  await expect(page.getByRole('button', { name: '+ Add loop' })).toBeDisabled();
  await page.getByRole('button', { name: 'Remove loop' }).last().click();
  await expect(page.getByRole('button', { name: '+ Add loop' })).toBeEnabled();
  await page.getByRole('button', { name: '+ Add loop' }).click();
  await expect(page.locator('.loop-card')).toHaveCount(100);
  await expect(page.getByRole('button', { name: '+ Add loop' })).toBeDisabled();
});

test('oversized sessions leave the last valid URL intact and cannot be shared', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: async () => { window.didShare = true; } });
  });
  await page.goto('/');
  await page.getByLabel('Session name').fill('Small session');
  const previous = page.url();
  await page.getByLabel('Session name').fill('x'.repeat(64_000));
  await expect(page.locator('#message')).toContainText('too large');
  expect(page.url()).toBe(previous);
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  expect(await page.evaluate(() => window.didShare)).toBeUndefined();
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeEnabled();
  await page.getByLabel('Session name').fill('Small again');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  expect(await page.evaluate(() => window.didShare)).toBe(true);
});

test('ignores stale events from destroyed players after a different video is loaded', async ({ page }) => {
  await page.goto('/');
  await loadVideo(page);
  await page.evaluate(() => { window.oldPlayer = window.fakePlayer; location.hash = ''; });
  await expect(page.locator('#player-status')).toHaveText('No video loaded');
  await loadVideo(page);
  await page.getByLabel('A start time').fill('0');
  await page.getByLabel('B end time').fill('10');
  await page.getByRole('button', { name: 'Play loop' }).click();
  await page.evaluate(() => {
    window.oldPlayer.emit('onStateChange', 2);
    window.oldPlayer.emit('onStateChange', 0);
    window.oldPlayer.emit('onError', 150);
    window.oldPlayer.emit('onAutoplayBlocked');
  });
  await expect(page.locator('.playing')).toHaveCount(1);
  await expect(page.locator('#message')).toBeHidden();
});
