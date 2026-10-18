import { defineConfig, devices } from '@playwright/test';

// Explicit opt-in: this suite contacts real YouTube and is excluded from check/CI.
export default defineConfig({
  testDir: './tests/live',
  outputDir: './test-results/live',
  workers: 1,
  timeout: 45_000,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/live', open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm start', env: { PORT: '4174' }, url: 'http://127.0.0.1:4174', reuseExistingServer: false,
  },
});
