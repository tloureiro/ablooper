import { readFile } from 'node:fs/promises';
import { validateReleaseVersion } from './release-version.js';

const [manifest, lockfile, changelog] = await Promise.all([
  readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../package-lock.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8'),
]);
const tag = validateReleaseVersion({ tag: process.argv[2], manifest, lockfile, changelog });
console.log(`tag=${tag}`);
