import { test, expect } from '@playwright/test';

test('connects to the real YouTube API and embeds a ready player', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByLabel('Start with a YouTube video').fill(process.env.YOUTUBE_TEST_VIDEO_ID ?? 'M7lc1UVf-VE');
  await page.getByRole('button', { name: 'Load video' }).click();
  await expect(page.locator('#player-status')).toHaveText('Video ready', { timeout: 30_000 });
  await expect(page.locator('iframe')).toHaveAttribute('src', /https:\/\/www.youtube.com\/embed\//);
  await expect(page.locator('iframe')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set A to current video time' })).toBeEnabled();
  expect(errors).toEqual([]);
});
