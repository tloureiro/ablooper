import { test, expect } from './helpers/fixtures.js';
import { videoId as id, loadVideo } from './helpers/youtube.js';

test('offers a share-link fallback when clipboard access is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined });
    Object.defineProperty(navigator, 'clipboard', { value: undefined });
  });
  await page.goto('/');
  await page.getByLabel('Session name').fill('Share me');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.locator('#message')).toContainText('browser’s address bar');
  const state = await page.evaluate(() => JSON.parse(decodeURIComponent(location.hash.slice(1))));
  expect(state.title).toBe('Share me');
});

test('shares the current video and loops through the native share menu', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: async (data) => { window.sharedSession = data; } });
  });
  await page.goto('/');
  await loadVideo(page);
  await page.getByLabel('Session name').fill('Example session');
  await page.getByLabel('A start time').fill('10');
  await page.getByLabel('B end time').fill('20');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  const shared = await page.evaluate(() => window.sharedSession);
  expect(shared.title).toBe('Example session');
  expect(JSON.parse(decodeURIComponent(new URL(shared.url).hash.slice(1)))).toEqual({
    id, title: 'Example session', intervals: [{ title: '', range: ['10', '20'] }],
  });
  await page.goto(shared.url);
  await expect(page.getByLabel('A start time')).toHaveValue('10');
  await expect(page.getByLabel('B end time')).toHaveValue('20');
});

for (const nativeShare of ['unsupported', 'failed', 'cancelled']) {
  test(`handles ${nativeShare} native sharing without losing the session`, async ({ page }) => {
    await page.addInitScript((mode) => {
      Object.defineProperty(navigator, 'share', {
        value: mode === 'unsupported' ? undefined : async () => {
          throw new DOMException('Share unavailable', mode === 'cancelled' ? 'AbortError' : 'NotAllowedError');
        },
      });
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: async (url) => { window.copiedSession = url; } },
      });
    }, nativeShare);
    await page.goto('/');
    await page.getByLabel('Session name').fill('Share me');
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeEnabled();
    const copied = await page.evaluate(() => window.copiedSession);
    if (nativeShare === 'cancelled') {
      expect(copied).toBeUndefined();
      await expect(page.locator('#message')).toBeHidden();
    } else {
      expect(JSON.parse(decodeURIComponent(new URL(copied).hash.slice(1))).title).toBe('Share me');
      await expect(page.locator('#message')).toHaveText('Session link copied.');
    }
  });
}

