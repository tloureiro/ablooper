import assert from 'node:assert/strict';
import { test } from 'node:test';
import { autoMergeBlockReason, enableAutoMerge } from '../../scripts/dependabot-policy.js';
import { validateReleaseVersion } from '../../scripts/release-version.js';

function update() {
  return {
    pr: {
      number: 20, user: { login: 'dependabot[bot]', type: 'Bot' }, state: 'open', draft: false,
      head: { ref: 'dependabot/npm_and_yarn/tools', sha: 'tested-sha', repo: { full_name: 'owner/repo' } },
      base: { ref: 'master', repo: { full_name: 'owner/repo' } },
    },
    repository: { full_name: 'owner/repo', default_branch: 'master', allow_auto_merge: true, allow_squash_merge: true },
    branch: { protected: true, protection: { required_status_checks: { contexts: ['CI'] } } },
    files: [{ filename: 'package.json' }, { filename: 'package-lock.json' }],
    updateType: 'version-update:semver-patch', expectedSha: 'tested-sha',
  };
}

test('allows patch/minor npm and action updates with required CI protection', () => {
  for (const updateType of ['version-update:semver-patch', 'version-update:semver-minor']) {
    for (const files of [[{ filename: 'package-lock.json' }], [{ filename: '.github/workflows/ci.yml' }]]) {
      assert.equal(autoMergeBlockReason({ ...update(), updateType, files }), null);
    }
  }
  const value = update();
  value.branch.protection.required_status_checks = { checks: [{ context: 'CI', app_id: 15368 }] };
  assert.equal(autoMergeBlockReason(value), null);
});

test('never auto-merges human PRs, forks, non-default targets, drafts or closed PRs', () => {
  const mutations = [
    (value) => { value.pr.user.login = 'human'; },
    (value) => { value.pr.user.type = 'User'; },
    (value) => { value.pr.head.repo = { full_name: 'fork/repo' }; },
    (value) => { value.pr.head.repo = null; },
    (value) => { value.pr.head.ref = 'feature'; },
    (value) => { value.pr.base.repo.full_name = 'other/repo'; },
    (value) => { value.pr.base.ref = 'release'; },
    (value) => { value.pr.draft = true; },
    (value) => { value.pr.state = 'closed'; },
    (value) => { value.pr.head.sha = 'newer-unverified-sha'; },
  ];
  for (const mutate of mutations) {
    const value = update();
    mutate(value);
    assert.ok(autoMergeBlockReason(value));
  }
});

test('leaves major and missing update classifications for manual review', () => {
  for (const updateType of ['version-update:semver-major', '', undefined]) {
    assert.match(autoMergeBlockReason({ ...update(), updateType }), /manual review/);
  }
});

test('blocks source changes, renamed source files and unknown paths', () => {
  for (const files of [[], [{ filename: 'src/app.js' }], [{ filename: '.github/actions/custom.yml' }],
    [{ filename: 'package.json', previous_filename: 'src/app.js' }],
    [{ filename: 'package-lock.json' }, { filename: 'README.md' }]]) {
    assert.match(autoMergeBlockReason({ ...update(), files }), /manual review/);
  }
});

test('requires branch protection, the CI gate, and enabled repository merge settings', () => {
  for (const branch of [{ protected: false }, { protected: true },
    { protected: true, protection: { required_status_checks: { contexts: ['something-else'] } } }]) {
    assert.match(autoMergeBlockReason({ ...update(), branch }), /branch protection/);
  }
  for (const field of ['allow_auto_merge', 'allow_squash_merge']) {
    const value = update();
    value.repository[field] = false;
    assert.match(autoMergeBlockReason(value), /repository settings/);
  }
});

function apiHarness(value = update()) {
  const commands = [];
  const notices = [];
  const listFiles = () => {};
  return {
    commands, notices,
    options: {
      context: { repo: { owner: 'owner', repo: 'repo' }, payload: { pull_request: value.pr } },
      github: {
        rest: {
          pulls: { get: async () => ({ data: value.pr }), listFiles },
          repos: { get: async () => ({ data: value.repository }), getBranch: async () => ({ data: value.branch }) },
        },
        paginate: async (method) => { assert.equal(method, listFiles); return value.files; },
      },
      core: { notice: (text) => notices.push(text) },
      updateType: value.updateType,
      execute: (...args) => commands.push(args),
    },
  };
}

test('enables auto-merge for the verified head using structured CLI arguments', async () => {
  const harness = apiHarness();
  assert.equal(await enableAutoMerge(harness.options), true);
  assert.deepEqual(harness.commands, [['gh', ['pr', 'merge', '20', '--repo', 'owner/repo', '--auto', '--squash', '--match-head-commit', 'tested-sha'], { stdio: 'inherit' }]]);
  assert.deepEqual(harness.notices, []);
});

test('does not issue merge commands when branch setup is incomplete', async () => {
  const value = update();
  value.branch.protected = false;
  const harness = apiHarness(value);
  assert.equal(await enableAutoMerge(harness.options), false);
  assert.equal(harness.commands.length, 0);
  assert.equal(harness.notices.length, 1);
});

test('API failures propagate without attempting a merge', async () => {
  const harness = apiHarness();
  harness.options.github.rest.repos.getBranch = async () => { throw new Error('API unavailable'); };
  await assert.rejects(() => enableAutoMerge(harness.options), /API unavailable/);
  assert.equal(harness.commands.length, 0);
});

function release() {
  return {
    tag: 'v1.1.0', manifest: { version: '1.1.0' },
    lockfile: { version: '1.1.0', packages: { '': { version: '1.1.0' } } },
    changelog: '# Changelog\n\n## [1.1.0] - Unreleased\n',
  };
}

test('accepts a stable release when the tag, both manifests, and changelog match', () => {
  assert.equal(validateReleaseVersion(release()), 'v1.1.0');
});

test('rejects mismatched, malformed, prerelease and noncanonical release tags', () => {
  for (const tag of ['1.1.0', 'v1.0.0', 'v01.1.0', 'v1.1.0-beta.1', 'v1.1.0;echo bad', undefined]) {
    assert.throws(() => validateReleaseVersion({ ...release(), tag }), /stable/);
  }
  assert.throws(() => validateReleaseVersion({ ...release(), manifest: { version: '01.1.0' } }), /stable/);
});

test('rejects stale lockfile versions or missing changelog entries', () => {
  for (const lockfile of [{ version: '1.0.0' }, { version: '1.1.0' },
    { version: '1.1.0', packages: { '': { version: '1.0.0' } } }]) {
    assert.throws(() => validateReleaseVersion({ ...release(), lockfile }), /must agree/);
  }
  assert.throws(() => validateReleaseVersion({ ...release(), changelog: '## [1.0.0]' }), /CHANGELOG/);
});
