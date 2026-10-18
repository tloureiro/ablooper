import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = fileURLToPath(new URL('../test-results/docker/', import.meta.url));
const { version } = JSON.parse(await readFile(new URL('../node_modules/@playwright/test/package.json', import.meta.url), 'utf8'));
await mkdir(artifacts, { recursive: true });

// Run from a disposable copy with Linux dependencies. The source mount is read-only;
// only reports are written back to the host. Match the image to the installed runner.
const runner = `
set -eu
mkdir -p /tmp/ablooper
cp -R /work/src /work/scripts /work/tests /tmp/ablooper/
cp /work/package.json /work/package-lock.json /work/index.html /work/styles.css /work/eslint.config.js /work/playwright.config.js /work/playwright.live.config.js /tmp/ablooper/
cd /tmp/ablooper
npm ci
set +e
CI=1 PLAYWRIGHT_HTML_OUTPUT_DIR=/artifacts/playwright-report npm run check
check_status=$?
if test -d test-results; then cp -R test-results /artifacts/; fi
exit "$check_status"
`;

const child = spawn('docker', [
  'run', '--rm', '--init', '--shm-size=1g',
  '--mount', `type=bind,source=${root},target=/work,readonly`,
  '--mount', `type=bind,source=${artifacts},target=/artifacts`,
  `mcr.microsoft.com/playwright:v${version}-noble`, 'bash', '-c', runner,
], { stdio: 'inherit' });
child.once('error', (error) => {
  console.error(`Unable to run Docker: ${error.message}`);
  process.exitCode = 1;
});
child.once('exit', (code) => { process.exitCode = code ?? 1; });
