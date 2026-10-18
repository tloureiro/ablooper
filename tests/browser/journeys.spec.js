import { test, expect } from './helpers/fixtures.js';
import { loadVideo, videoId } from './helpers/youtube.js';

test('creates a multi-loop session and opens the copied URL in a separate page', async ({ page, context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (url) => { window.copiedURL = url; } } });
  });
  await page.goto('/');
  await loadVideo(page);
  await page.getByLabel('Session name').fill('Example < > & 日本語');
  await page.getByLabel('Loop name').fill('First section');
  await page.getByLabel('A start time').fill('0');
  await page.getByLabel('B end time').fill('10.5');
  await page.getByRole('button', { name: '+ Add loop' }).click();
  await page.getByLabel('Loop name').last().fill('Second section');
  await page.getByLabel('A start time').last().fill('1:00');
  await page.getByLabel('B end time').last().fill('1:15');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.locator('#message')).toHaveText('Session link copied.');
  const url = await page.evaluate(() => window.copiedURL);
  const recipient = await context.newPage();
  await recipient.goto(url);
  await expect(recipient.locator('#player-status')).toHaveText('Video ready');
  await expect(recipient.getByLabel('Session name')).toHaveValue('Example < > & 日本語');
  await expect(recipient.getByLabel('Loop name')).toHaveCount(2);
  await expect(recipient.getByLabel('Loop name').first()).toHaveValue('First section');
  await expect(recipient.getByLabel('Loop name').last()).toHaveValue('Second section');
  await expect(recipient.getByLabel('A start time').last()).toHaveValue('1:00');
  await recipient.getByRole('button', { name: 'Play loop' }).last().click();
  expect(await recipient.evaluate(() => window.fakePlayer.time)).toBe(60);
  await recipient.getByRole('button', { name: 'Pause loop' }).click();
  await recipient.reload();
  await expect(recipient.getByLabel('B end time').last()).toHaveValue('1:15');
  await expect(recipient.locator('.playing')).toHaveCount(0);
  await recipient.close();
});

test('browser Back and Forward restore distinct linked sessions', async ({ page }) => {
  const makeLink = (title, start) => `/#${encodeURIComponent(JSON.stringify({ id: videoId, title, intervals: [{ title, range: [start, start + 5] }] }))}`;
  await page.goto(makeLink('First session', 10));
  await expect(page.getByLabel('Session name')).toHaveValue('First session');
  await page.evaluate((hash) => { location.hash = hash; }, makeLink('Second session', 20).slice(1));
  await expect(page.getByLabel('Session name')).toHaveValue('Second session');
  await page.goBack();
  await expect(page.getByLabel('Session name')).toHaveValue('First session');
  await expect(page.getByLabel('A start time')).toHaveValue('10');
  await page.goForward();
  await expect(page.getByLabel('Session name')).toHaveValue('Second session');
  await expect(page.getByLabel('A start time')).toHaveValue('20');
});

test('keyboard activation can load, add, play, pause, and remove a loop', async ({ page }) => {
  await page.goto('/');
  const input = page.getByLabel('Start with a YouTube video');
  await input.focus();
  await page.keyboard.type(videoId);
  await page.keyboard.press('Enter');
  await expect(page.locator('#player-status')).toHaveText('Video ready');
  const add = page.getByRole('button', { name: '+ Add loop' });
  await add.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Loop name').last()).toBeFocused();
  await page.keyboard.type('Keyboard loop');
  await page.getByLabel('A start time').last().focus();
  await page.keyboard.type('10');
  await page.getByLabel('B end time').last().focus();
  await page.keyboard.type('20');
  await page.getByRole('button', { name: 'Play loop' }).last().focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Pause loop' })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.locator('.playing')).toHaveCount(0);
  await page.getByRole('button', { name: 'Remove loop' }).last().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.loop-card')).toHaveCount(1);
  await expect(page.getByLabel('Loop name')).toBeFocused();
});

test('can edit and share while the browser is offline after loading the app', async ({ page, context }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (url) => { window.copiedURL = url; } } });
  });
  await page.goto('/');
  await context.setOffline(true);
  await page.getByLabel('Session name').fill('Offline session');
  await page.getByLabel('B end time').fill('30');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.locator('#message')).toHaveText('Session link copied.');
  expect(await page.evaluate(() => window.copiedURL)).toBe(page.url());
  await context.setOffline(false);
});
