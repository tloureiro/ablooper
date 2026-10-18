import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

// Serve only public app files, never repository metadata or installed packages.
const root = new URL('../', import.meta.url);
const files = new Map([
  ['/', ['index.html', 'text/html']],
  ['/index.html', ['index.html', 'text/html']],
  ['/styles.css', ['styles.css', 'text/css']],
  ['/src/app.js', ['src/app.js', 'text/javascript']],
  ['/src/state.js', ['src/state.js', 'text/javascript']],
]);
export function createAppServer({ publicRoot = root } = {}) {
  return createServer(async (request, response) => {
    const pathname = request.url.startsWith('/') ? new URL(`http://localhost${request.url}`).pathname : '';
    const file = files.get(pathname);
    if (!file || !['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(404).end('Not found');
      return;
    }
    try {
      const body = await readFile(new URL(file[0], publicRoot));
      response.writeHead(200, {
        'Content-Type': `${file[1]}; charset=utf-8`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch {
      response.writeHead(500).end('Unable to read file');
    }
  });
}
