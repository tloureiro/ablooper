import { test, expect } from './helpers/fixtures.js';

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`keeps controls visible without horizontal scrolling at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByLabel('Session name').fill('A long session name that should stay inside its field');
    await page.getByLabel('Loop name').fill('A long loop name that should stay inside its card');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    for (const selector of ['#share', '#load-video', '.play-loop', '.loop-start', '.loop-end']) {
      const box = await page.locator(selector).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.height).toBeGreaterThanOrEqual(28);
    }
    const video = await page.locator('.video-panel').boundingBox();
    const loops = await page.locator('.loops-panel').boundingBox();
    if (width <= 800) expect(loops.y).toBeGreaterThan(video.y);
    else expect(loops.x).toBeGreaterThan(video.x);
    await testInfo.attach(`layout-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  });
}

test('honors reduced motion and leaves focused controls visibly outlined', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const add = page.getByRole('button', { name: '+ Add loop' });
  await page.keyboard.press('Tab');
  await add.focus();
  const styles = await add.evaluate((button) => {
    const style = getComputedStyle(button);
    return { transition: style.transitionDuration, outline: style.outlineStyle, width: style.outlineWidth };
  });
  expect(styles.transition).toBe('0s');
  expect(styles.outline).toBe('solid');
  expect(parseFloat(styles.width)).toBeGreaterThanOrEqual(2);
});
