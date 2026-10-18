import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { request } from 'node:http';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { createAppServer } from '../../scripts/server.js';

const root = new URL('../../', import.meta.url);

async function startServer(t, options) {
  const server = createAppServer(options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.closeAllConnections();
    server.close((error) => error ? reject(error) : resolve());
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

for (const [path, file, type] of [
  ['/', 'index.html', 'text/html'], ['/index.html', 'index.html', 'text/html'],
  ['/styles.css', 'styles.css', 'text/css'], ['/src/app.js', 'src/app.js', 'text/javascript'],
  ['/src/state.js', 'src/state.js', 'text/javascript'],
]) {
  test(`GET ${path} serves the real asset with the right content type and headers`, async (t) => {
    const base = await startServer(t);
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), `${type}; charset=utf-8`);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(await response.text(), await readFile(new URL(file, root), 'utf8'));
  });
}

test('HEAD has matching headers and no response body; query strings still resolve', async (t) => {
  const base = await startServer(t);
  const response = await fetch(`${base}/src/app.js?v=123`, { method: 'HEAD' });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.equal(await response.text(), '');
});

// Use node:http so the client does not normalize traversal attempts before sending them.
function rawRequest(base, path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = request(base, { path, method }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('keeps repository files, dependency files, dotfiles, and traversal targets private', async (t) => {
  const base = await startServer(t);
  for (const path of [
    '/.git/config', '/package.json', '/package-lock.json', '/README.md', '/node_modules/eslint/package.json',
    '/scripts/serve.js', '/tests/unit/state.test.js', '/missing.html', '/src/',
    '/../.git/config', '/%2e%2e/.git/config', '/src/../../package.json', '/..%2fpackage.json',
    '//ignored/index.html', '/%00', '/%ZZ', '*', 'http://example.com/index.html',
  ]) {
    const response = await rawRequest(base, path);
    assert.equal(response.status, 404, path);
    assert.equal(response.body, 'Not found', path);
  }
  assert.equal((await fetch(base)).status, 200, 'Server is still healthy after invalid requests');
});

test('rejects unsupported HTTP methods instead of serving app content', async (t) => {
  const base = await startServer(t);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    assert.deepEqual(await rawRequest(base, '/', method), { status: 404, body: 'Not found' });
  }
});

test('returns a controlled 500 response when an allowed asset cannot be read', async (t) => {
  const base = await startServer(t, { publicRoot: new URL('./nonexistent/', import.meta.url) });
  const response = await fetch(base);
  assert.equal(response.status, 500);
  assert.equal(await response.text(), 'Unable to read file');
});

test('npm start entry point respects PORT and serves the app from any working directory', { timeout: 10_000 }, async (t) => {
  const child = spawn(process.execPath, [new URL('../../scripts/serve.js', import.meta.url).pathname], {
    cwd: tmpdir(), env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      await once(child, 'exit');
    }
  });
  const url = await new Promise((resolve, reject) => {
    let output = '';
    child.on('error', reject);
    child.on('exit', (code) => reject(new Error(`Server exited before listening (${code})`)));
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) resolve(match[0]);
    });
  });
  assert.equal((await fetch(url)).status, 200);
});
