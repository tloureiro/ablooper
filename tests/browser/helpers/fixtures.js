import { test as base, expect } from '@playwright/test';
import { youtubeSource } from './youtube.js';

export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    const errors = [];
    const unexpectedRequests = [];
    context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(baseURL).origin) return route.continue();
      if (url.href === 'https://www.youtube.com/iframe_api') {
        return route.fulfill({ contentType: 'text/javascript', body: youtubeSource() });
      }
      unexpectedRequests.push(url.href);
      return route.abort();
    });
    await use(context);
    expect(errors, 'Uncaught page errors').toEqual([]);
    expect(unexpectedRequests, 'Unexpected external requests').toEqual([]);
  },
});

export { expect };
