export function validateReleaseVersion({ tag, manifest, lockfile, changelog }) {
  const version = manifest.version;
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) || tag !== `v${version}`) {
    throw new Error('Use a stable vMAJOR.MINOR.PATCH tag matching package.json.');
  }
  if (lockfile.version !== version || lockfile.packages?.['']?.version !== version) {
    throw new Error('package.json and both root package-lock.json versions must agree.');
  }
  if (!changelog.split('\n').some((line) => line.startsWith(`## [${version}]`))) {
    throw new Error(`Add a CHANGELOG.md section for ${version} before releasing.`);
  }
  return tag;
}
