import { execFileSync } from 'node:child_process';

export function autoMergeBlockReason({ pr, repository, branch, files, updateType, expectedSha }) {
  if (pr.user.login !== 'dependabot[bot]' || pr.user.type !== 'Bot') return 'Only Dependabot PRs qualify.';
  if (pr.state !== 'open' || pr.draft) return 'The PR must be open and ready for review.';
  if (pr.head.repo?.full_name !== repository.full_name || !pr.head.ref.startsWith('dependabot/')) {
    return 'The PR must use a Dependabot branch in this repository.';
  }
  if (pr.base.repo.full_name !== repository.full_name || pr.base.ref !== repository.default_branch) {
    return 'Only updates targeting the default branch qualify.';
  }
  if (pr.head.sha !== expectedSha) return 'The PR changed; wait for its latest automation run.';
  if (!['version-update:semver-patch', 'version-update:semver-minor'].includes(updateType)) {
    return 'Major or unclassified updates need manual review.';
  }
  const paths = files.flatMap((file) => [file.filename, file.previous_filename].filter(Boolean));
  if (!paths.length || !paths.every((path) => (
    ['package.json', 'package-lock.json'].includes(path) || /^\.github\/workflows\/[^/]+\.ya?ml$/.test(path)
  ))) return 'Updates that change files outside dependency manifests/workflows need manual review.';
  const required = branch.protection?.required_status_checks;
  const contexts = [...(required?.contexts ?? []), ...(required?.checks ?? []).map((check) => check.context)];
  if (!branch.protected || !contexts.includes('CI')) return 'Configure branch protection with required check CI first.';
  if (!repository.allow_auto_merge || !repository.allow_squash_merge) return 'Enable auto-merge and squash merging in repository settings first.';
  return null;
}

export async function enableAutoMerge({ github, context, core, updateType, execute = execFileSync }) {
  const coordinates = { ...context.repo, pull_number: context.payload.pull_request.number };
  const { data: pr } = await github.rest.pulls.get(coordinates);
  const { data: repository } = await github.rest.repos.get(context.repo);
  const { data: branch } = await github.rest.repos.getBranch({ ...context.repo, branch: pr.base.ref });
  const files = await github.paginate(github.rest.pulls.listFiles, { ...coordinates, per_page: 100 });
  const reason = autoMergeBlockReason({
    pr, repository, branch, files, updateType, expectedSha: context.payload.pull_request.head.sha,
  });
  if (reason) {
    core.notice(reason);
    return false;
  }
  execute('gh', ['pr', 'merge', String(pr.number), '--repo', repository.full_name,
    '--auto', '--squash', '--match-head-commit', pr.head.sha], { stdio: 'inherit' });
  return true;
}
