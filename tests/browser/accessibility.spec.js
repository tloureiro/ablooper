import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './helpers/fixtures.js';
import { loadVideo } from './helpers/youtube.js';

async function audit(page, testInfo) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  await testInfo.attach('accessibility-results', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  expect(result.violations).toEqual([]);
}

test('initial editor has no automated WCAG A/AA violations', async ({ page }, testInfo) => {
  await page.goto('/');
  await audit(page, testInfo);
});

test('loaded player with multiple loops and a validation error remains accessible', async ({ page }, testInfo) => {
  await page.goto('/');
  await loadVideo(page);
  await page.getByRole('button', { name: '+ Add loop' }).click();
  await page.getByRole('button', { name: 'Play loop' }).first().click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await audit(page, testInfo);
});

test('active loop exposes its pressed state and retains an accessible player title', async ({ page }, testInfo) => {
  await page.goto('/');
  await loadVideo(page);
  await page.getByLabel('A start time').fill('0');
  await page.getByLabel('B end time').fill('10');
  await page.getByRole('button', { name: 'Play loop' }).click();
  await expect(page.getByRole('button', { name: 'Pause loop' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('iframe')).toHaveAttribute('title', 'YouTube video');
  await audit(page, testInfo);
});
