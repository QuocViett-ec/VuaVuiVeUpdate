'use strict';
const fs = require('node:fs');
const { assert, request } = require('./release.cjs');

function validateRun(run, repo, mode) {
  assert(run.repository?.full_name === repo && run.head_repository?.full_name === repo, 'Run belongs to another repository');
  assert(run.event === (mode === 'quality' ? 'push' : 'workflow_dispatch') ||
    (mode !== 'quality' && run.event === 'workflow_run'), 'Unsupported source event');
  assert(['main', 'master'].includes(run.head_branch), 'Only a trusted release branch is allowed');
  assert(/^[a-f0-9]{40}$/.test(run.head_sha), 'Invalid source SHA');
  assert(run.path === `.github/workflows/${mode === 'quality' ? 'quality' : 'release'}.yml`, 'Wrong source workflow');
  assert(run.status === 'completed', 'Source workflow has not completed');
  if (mode !== 'rollback') assert(run.conclusion === 'success', 'Source workflow did not pass');
  return run.head_sha;
}
async function main() {
  const env = process.env;
  assert(/^\d+$/.test(env.SOURCE_RUN_ID || ''), 'Provide a numeric CI/release run ID');
  assert(/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY || ''), 'Invalid repository');
  assert(['staging', 'production'].includes(env.TARGET_ENVIRONMENT), 'Invalid deployment environment');
  const api = route => request(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}${route}`, {
    headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  const source = await api(`/actions/runs/${env.SOURCE_RUN_ID}`);
  const sha = validateRun(source, env.GITHUB_REPOSITORY, env.RELEASE_ACTION === 'rollback' ? 'rollback' : 'quality');
  if (env.TARGET_ENVIRONMENT === 'production') {
    // A separate read-only token may be needed: GITHUB_TOKEN cannot always read environment protection rules.
    const protection = await request(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/environments/production`, {
      headers: { Authorization: `Bearer ${env.GH_ENVIRONMENT_READ_TOKEN || env.GH_TOKEN}`,
        Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    });
    assert(protection.protection_rules?.some(rule => rule.type === 'required_reviewers' && rule.reviewers?.length > 0),
      'Production environment must have required reviewers');
    if (env.RELEASE_ACTION !== 'rollback') {
      assert(/^\d+$/.test(env.STAGING_RUN_ID || ''), 'Production requires a successful staging release run ID');
      const staging = await api(`/actions/runs/${env.STAGING_RUN_ID}`);
      validateRun(staging, env.GITHUB_REPOSITORY, 'staging');
      // The downloaded staging evidence will be checked against the source artifact SHA before deployment.
    }
  }
  fs.appendFileSync(env.GITHUB_OUTPUT, `sha=${sha}\nsource_run_id=${env.SOURCE_RUN_ID}\n`);
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { validateRun };
