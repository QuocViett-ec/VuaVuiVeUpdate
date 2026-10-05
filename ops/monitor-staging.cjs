'use strict';
const fs = require('node:fs');
const { assert, origin, request, smoke } = require('./release.cjs');

async function checkStaging(env, fetcher = fetch) {
  const c = { TARGET_ENVIRONMENT: 'staging' };
  for (const key of ['BACKEND_ORIGIN', 'ML_ORIGIN', 'CUSTOMER_ORIGIN', 'ADMIN_ORIGIN']) c[key] = origin(env[key]);
  assert(new Set(Object.values(c)).size === 5, 'Staging origins must differ');
  const runtime = await request(`${c.CUSTOMER_ORIGIN}/release-config.json`, {}, fetcher);
  assert(/^[a-f0-9]{40}$/.test(runtime.releaseSha || ''), 'Missing deployed release SHA');
  await smoke(c, runtime.releaseSha, { customer: c.CUSTOMER_ORIGIN, admin: c.ADMIN_ORIGIN }, fetcher);
  return { status: 'Passed', environment: 'staging', sha: runtime.releaseSha };
}

async function main() {
  let result;
  // Free staging services can be asleep. Retry the read-only checks, then fail visibly.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      result = { ...await checkStaging(process.env), attempt };
      break;
    } catch {
      result = { status: 'Failed', environment: 'staging', attempt,
        reason: 'Health, revision, portal routing or guest authorization check failed; inspect provider logs.' };
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 15000));
    }
  }
  result.checkedAt = new Date().toISOString();
  fs.mkdirSync('.qa-data', { recursive: true });
  fs.writeFileSync('.qa-data/monitor-result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (result.status !== 'Passed') process.exitCode = 1;
}
if (require.main === module) main().catch(() => { console.error('Staging monitor could not complete.'); process.exitCode = 1; });
module.exports = { checkStaging };
