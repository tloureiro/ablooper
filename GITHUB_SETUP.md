# GitHub setup

These files are prepared locally. No repository settings, branches, releases, or remote files were changed by this setup.

## 1. Push the files and run CI once

Commit and push this workspace to `master` using your normal Git client (GitHub Desktop is fine). If that branch is already protected, use a pull request. The repository's current default branch is `master`; the workflows use that name.

Open [Actions → CI](https://github.com/tloureiro/ablooper/actions/workflows/ci.yml) and wait for the run to pass. You can also select **Run workflow** on `master`. This makes the final **CI** check available in the branch-protection selector.

CI runs lint and unit/HTTP tests with coverage gates, a dependency audit, and four browser projects in parallel. Its final check is named **CI** and fails if any underlying job fails, is canceled, or is skipped. PR updates cancel obsolete CI runs. Reports and failure diagnostics are retained for seven days.

## 2. Protect master

Open [Settings → Branches](https://github.com/tloureiro/ablooper/settings/branches), then **Add classic branch protection rule** (or edit the existing rule for `master`).

- **Branch name pattern:** `master`
- Enable **Require a pull request before merging**.
- Leave **Require approvals** unchecked for this solo-maintainer setup. Requiring a review is valid, but these bot PRs would then wait for that review; the workflow does not auto-approve them.
- Enable **Require status checks to pass before merging** and select **CI** from GitHub Actions. Do not select the separate Dependabot automation check.
- Enable **Require branches to be up to date before merging**.
- Enable **Require conversation resolution before merging**.
- Enable **Do not allow bypassing the above settings**.
- Leave force pushes and deletions disabled.
- Save the rule.

Use the classic rule described here: the automation reads the branch's required-status-check configuration and refuses to enable auto-merge if it cannot find `CI`.

## 3. Enable repository merge settings

Open [Settings → General](https://github.com/tloureiro/ablooper/settings), then **Pull Requests**:

- Enable **Allow squash merging**. A default squash message based on the PR title keeps history concise.
- Enable **Allow auto-merge**.
- Enable **Automatically delete head branches**.
- You can disable merge commits and rebase merging if you want squash-only history.

The Dependabot workflow checks the first two settings before issuing any merge command. It queues a squash merge for a verified Dependabot PR; GitHub enforces the required CI check and branch rules before merging. It never uses an administrator bypass.

## 4. Check Actions and Dependabot settings

Open [Settings → Actions → General](https://github.com/tloureiro/ablooper/settings/actions):

- Ensure GitHub Actions is enabled and the pinned actions referenced by the workflows are allowed. If this repository uses an action allowlist, include `actions/*` and `dependabot/fetch-metadata`.
- Keep the default **Workflow permissions** at read access. Individual jobs request only their needed permissions; release publication and Dependabot merging each request `contents: write` explicitly.
- **Allow GitHub Actions to create and approve pull requests** is not needed: these workflows neither create nor approve PRs.
- Save any changes.

In **Settings → Code security** (the exact sidebar label may vary), enable the dependency graph, Dependabot alerts, and Dependabot security updates if available. Version updates are configured by `.github/dependabot.yml`.

The schedule is Monday at 09:00 America/Toronto. npm and GitHub Actions patch/minor version updates are grouped separately; security fixes have their own npm group. Major updates remain individual PRs for manual review. The automatic merge policy requires the bot author, verified metadata/commits, the same repository, the default target branch, and dependency-manifest/workflow file changes only.

## Verify the setup

Open an existing Dependabot PR, if there is one. In its **Checks** tab, inspect **Dependabot auto-merge**. If the run predates the repository settings above, rerun it from the Actions page. An eligible patch/minor PR should show auto-merge enabled and wait for `CI`. A major update should stay manual. If no bot PR is open, inspect the next weekly update rather than changing a dependency solely to manufacture a PR.

No personal access token, custom secret, or bot account is required. Workflows use the repository's built-in `GITHUB_TOKEN`. The auto-merge workflow runs trusted base-branch code and never checks out PR code with write permissions.

## Releases and versioning

The next version is prepared as `1.1.0` in `package.json` and both root lockfile entries. `CHANGELOG.md` records the changes. It has not been released or tagged. Keep the historical `1.0` tag; use `vMAJOR.MINOR.PATCH` for new releases.

For the first release, after this work lands and CI passes:

1. Replace `Unreleased` in the `1.1.0` changelog heading with the release date and merge that change.
2. Open [Actions → Release](https://github.com/tloureiro/ablooper/actions/workflows/release.yml).
3. Select **Run workflow**, choose branch **master**, and enter `v1.1.0` as the tag.
4. The workflow validates the version/lockfile/changelog, reruns the complete CI suite, and only then creates the GitHub release and tag. It attaches an archive containing just the static app and generates release notes from merged PRs.

Future versions:

```sh
npm version patch --no-git-tag-version # or minor / major
```

Update the changelog, commit the version changes in a PR, and merge after CI passes. Run **Release** on `master` with the matching `v` tag. Patch means fixes, minor means compatible features, and major means breaking changes. Dependency-only PRs do not change the app version automatically; collect them into the next app release.

Pushing a matching `v*.*.*` tag manually also invokes the release workflow. Version mismatches, commits outside `master` history, and an existing tag pointing to a different commit are rejected. Existing tags are not moved. A failed workflow does not publish a GitHub release; a manually pushed tag will still exist if the checks fail. Releases do not publish to npm or deploy the website.

## References

- [GitHub: branch protection setup](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)
- [GitHub: repository auto-merge setting](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-auto-merge-for-pull-requests-in-your-repository)
- [Dependabot metadata and token behavior](https://github.com/dependabot/fetch-metadata)
