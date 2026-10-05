'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const release = require('../release.cjs');
const { validateRun } = require('../validate-release-run.cjs');
const { checkStaging } = require('../monitor-staging.cjs');
const sha = 'a'.repeat(40);
const fixtureConfig = {
  TARGET_ENVIRONMENT: 'staging', RENDER_API_KEY: 'fixture-not-a-real-key', VERCEL_TOKEN: 'fixture-not-a-real-token',
  RENDER_BACKEND_SERVICE_ID: 'srv-backend', RENDER_ML_SERVICE_ID: 'srv-ml',
  VERCEL_ORG_ID: 'team_fixture', VERCEL_CUSTOMER_PROJECT_ID: 'prj_customer', VERCEL_ADMIN_PROJECT_ID: 'prj_admin',
  BACKEND_ORIGIN: 'https://backend.example.invalid', ML_ORIGIN: 'https://ml.example.invalid',
  CUSTOMER_ORIGIN: 'https://customer.example.invalid', ADMIN_ORIGIN: 'https://admin.example.invalid',
};
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

test('deployment rejects missing secrets and unsafe/duplicate targets before remote writes', () => {
  assert.throws(() => release.config({}), /Missing configuration/);
  for (const value of ['http://backend.example.invalid', 'https://user:private@example.invalid',
    'https://example.invalid/path', 'https://example.invalid?key=private', 'https://localhost']) {
    assert.throws(() => release.config({ ...fixtureConfig, BACKEND_ORIGIN: value }));
  }
  assert.throws(() => release.config({ ...fixtureConfig, RENDER_BACKEND_SERVICE_ID: 'srv-ml' }), /must differ/);
  assert.equal(release.config(fixtureConfig).CUSTOMER_ORIGIN, fixtureConfig.CUSTOMER_ORIGIN);
});
test('production requires every gate, the exact approved SHA and matching staging evidence', () => {
  const env = { ...fixtureConfig, APPROVED_RELEASE_SHA: sha, ...Object.fromEntries(release.gates.map(key => [key, 'true'])) };
  const staging = { environment: 'staging', sha, smokePassed: true,
    targets: Object.fromEntries(Object.entries(release.targets(fixtureConfig)).map(([key, value]) => [key, value + '-staging'])) };
  release.productionGates(env, sha, staging);
  for (const key of release.gates) assert.throws(() => release.productionGates({ ...env, [key]: 'false' }, sha, staging), /gate not closed/);
  assert.throws(() => release.productionGates(env, 'b'.repeat(40), staging), /approval/);
  assert.throws(() => release.productionGates(env, sha, { ...staging, smokePassed: false }), /staging evidence/);
  assert.throws(() => release.productionGates(env, sha, { ...staging, targets: { ...staging.targets,
    RENDER_BACKEND_SERVICE_ID: env.RENDER_BACKEND_SERVICE_ID } }), /separate targets/);
});
test('source run validation rejects forks, PRs, failed CI, different workflows and unfinished runs', () => {
  const repo = 'fixture/shop';
  const run = { repository: { full_name: repo }, head_repository: { full_name: repo }, event: 'push',
    head_branch: 'main', head_sha: sha, path: '.github/workflows/quality.yml', status: 'completed', conclusion: 'success' };
  assert.equal(validateRun(run, repo, 'quality'), sha);
  for (const change of [{ head_repository: { full_name: 'other/shop' } }, { event: 'pull_request' },
    { conclusion: 'failure' }, { status: 'in_progress' }, { path: '.github/workflows/other.yml' }, { head_branch: 'feature' }]) {
    assert.throws(() => validateRun({ ...run, ...change }, repo, 'quality'));
  }
  assert.equal(validateRun({ ...run, event: 'workflow_run', path: '.github/workflows/release.yml', conclusion: 'failure' }, repo, 'rollback'), sha);
});
test('Render polling rejects another commit, failed status and timeout', async () => {
  let attempts = 0;
  const api = async () => ({ commit: { id: sha }, status: ++attempts === 2 ? 'live' : 'build_in_progress' });
  assert.equal((await release.waitRender(api, 'srv-fixture', 'dep-fixture', sha, async () => {}, 3)).status, 'live');
  await assert.rejects(release.waitRender(async () => ({ commit: { id: 'b'.repeat(40) }, status: 'live' }), 'srv-fixture', 'dep-fixture', sha), /different commit/);
  await assert.rejects(release.waitRender(async () => ({ commit: { id: sha }, status: 'build_failed' }), 'srv-fixture', 'dep-fixture', sha), /failed/);
  await assert.rejects(release.waitRender(async () => ({ commit: { id: sha }, status: 'build_in_progress' }), 'srv-fixture', 'dep-fixture', sha, async () => {}, 1), /timeout/);
});
test('HTTP failures omit private provider responses and reject a 200 HTML login page', async () => {
  await assert.rejects(release.request('https://example.invalid', {}, async () => new Response('PRIVATE_RESPONSE', { status: 403 })), /HTTP 403 \(response omitted\)/);
  await assert.rejects(release.request('https://example.invalid', {}, async () => new Response('<html>Login</html>')), /Expected JSON/);
  await assert.rejects(release.request('https://example.invalid', {}, async () => new Response('PRIVATE_RESPONSE', { headers: { 'Content-Type': 'application/json' } })), /invalid JSON \(response omitted\)/);
});
test('artifact verification detects extra files, tampering and wrong source SHA', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vvv-release-'));
  try {
    for (const portal of ['customer', 'admin']) { fs.mkdirSync(path.join(dir, portal)); fs.writeFileSync(path.join(dir, portal, 'index.html'), portal); }
    const hashes = Object.fromEntries(release.files(dir).map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, name))).digest('hex')]));
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ version: 1, sha, hashes }));
    assert.equal(release.verifyRelease(dir, sha).sha, sha);
    assert.throws(() => release.verifyRelease(dir, 'b'.repeat(40)), /SHA mismatch/);
    fs.writeFileSync(path.join(dir, 'extra.js'), 'unexpected');
    assert.throws(() => release.verifyRelease(dir, sha), /file list/);
    fs.unlinkSync(path.join(dir, 'extra.js'));
    fs.writeFileSync(path.join(dir, 'admin/index.html'), 'tampered');
    assert.throws(() => release.verifyRelease(dir, sha), /checksum/);
  } finally { fs.rmSync(dir, { recursive: true }); }
});
test('Vercel preparation preserves tested JS, points API to the environment and writes only public runtime fields', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vvv-vercel-'));
  try {
    fs.mkdirSync(path.join(dir, 'source/customer'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'source/customer/index.html'), '<app-root></app-root>');
    fs.writeFileSync(path.join(dir, 'source/customer/tested.js'), 'verified-by-ci');
    fs.writeFileSync(path.join(dir, 'source/customer/ảnh sản phẩm.jpg'), 'fixture-image-bytes');
    const c = release.config(fixtureConfig);
    const output = release.preparePortal(c, 'customer', path.join(dir, 'source'), sha, path.join(dir, 'deploy'));
    assert.equal(fs.readFileSync(path.join(output, '.vercel/output/static/tested.js'), 'utf8'), 'verified-by-ci');
    const routes = JSON.parse(fs.readFileSync(path.join(output, '.vercel/output/config.json'))).routes;
    const overrides = JSON.parse(fs.readFileSync(path.join(output, '.vercel/output/config.json'))).overrides;
    const [asset, override] = Object.entries(overrides)[0];
    assert.match(asset, /^assets\/[a-f0-9]+\.jpg$/);
    assert.equal(override.path, 'ảnh sản phẩm.jpg');
    assert.equal(fs.readFileSync(path.join(output, '.vercel/output/static', asset), 'utf8'), 'fixture-image-bytes');
    assert.deepEqual(routes[0], { src: '/api/(.*)', dest: c.BACKEND_ORIGIN + '/api/$1' });
    assert.deepEqual(routes.at(-1), { src: '/(.*)', dest: '/index.html' });
    const runtime = JSON.parse(fs.readFileSync(path.join(output, '.vercel/output/static/release-config.json')));
    assert.deepEqual(runtime, { releaseSha: sha, customerPortalBase: c.CUSTOMER_ORIGIN, adminPortalBase: c.ADMIN_ORIGIN });
    assert.throws(() => release.preparePortal(c, 'customer', path.join(dir, 'source'), sha, path.join(dir, 'deploy')), /must be new/);
  } finally { fs.rmSync(dir, { recursive: true }); }
});
test('prebuilt CLI link uses the verified project without inheriting its repository root or secrets', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vvv-link-'));
  try {
    await release.linkVercel(fixtureConfig, 'prj_customer', dir,
      async () => json({ id: 'prj_customer', name: 'customer-staging', rootDirectory: 'frontend', env: ['private'] }));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, '.vercel/project.json'))), {
      orgId: fixtureConfig.VERCEL_ORG_ID, projectId: 'prj_customer', projectName: 'customer-staging', projectRootDirectory: '.',
    });
    await assert.rejects(release.linkVercel(fixtureConfig, 'prj_customer', dir,
      async () => json({ id: 'prj_wrong', name: 'wrong' })), /metadata mismatch/);
  } finally { fs.rmSync(dir, { recursive: true }); }
});
test('smoke checks both portal proxies, wrong revision, disabled payments and unauthenticated order access', async () => {
  const c = release.config(fixtureConfig);
  let errorMode = '';
  const seen = [];
  const fetcher = async (url) => {
    seen.push(url);
    const route = new URL(url).pathname;
    if (route === '/api/health') return json({ status: 'ok', db: { ready: true },
      environment: errorMode === 'environment' ? 'production' : 'staging',
      revision: errorMode === 'revision' ? 'b'.repeat(40) : sha,
      payments: { momo: errorMode === 'payments', vnpay: false } });
    if (route === '/api/products') return json({ success: true, data: [] });
    if (route === '/api/orders/me') return json({}, errorMode === 'authorization' ? 200 : 401);
    if (route === '/health') return json({ status: 'ok', adapter_ready: true, revision: sha, environment: 'staging' });
    if (route === '/release-config.json') return json({ releaseSha: sha, customerPortalBase: c.CUSTOMER_ORIGIN, adminPortalBase: c.ADMIN_ORIGIN });
    return new Response(url.includes('customer') ? '<app-root></app-root>' : '<admin-root></admin-root>');
  };
  const portals = { customer: c.CUSTOMER_ORIGIN, admin: c.ADMIN_ORIGIN };
  await release.smoke(c, sha, portals, fetcher);
  assert.deepEqual(await checkStaging(c, fetcher), { status: 'Passed', environment: 'staging', sha });
  assert(seen.includes(`${c.ADMIN_ORIGIN}/api/health`) && seen.includes(`${c.CUSTOMER_ORIGIN}/api/health`));
  for (const mode of ['revision', 'payments', 'authorization', 'environment']) {
    errorMode = mode;
    await assert.rejects(release.smoke(c, sha, portals, fetcher));
    await assert.rejects(checkStaging(c, fetcher));
  }
});
test('rollback rejects mismatched services, projects, environments and mixed backend/ML versions', () => {
  const c = release.config(fixtureConfig);
  const previous = { render: {
    backend: { serviceId: c.RENDER_BACKEND_SERVICE_ID, deployId: 'dep-backend', sha },
    ml: { serviceId: c.RENDER_ML_SERVICE_ID, deployId: 'dep-ml', sha },
  }, vercel: {
    customer: { projectId: c.VERCEL_CUSTOMER_PROJECT_ID, url: 'https://customer-previous.vercel.app' },
    admin: { projectId: c.VERCEL_ADMIN_PROJECT_ID, url: 'https://admin-previous.vercel.app' },
  } };
  const record = { version: 1, environment: 'staging', previous };
  assert.equal(release.rollbackTargets(c, record), previous);
  assert.throws(() => release.rollbackTargets(c, { ...record, environment: 'production' }), /environment/);
  previous.render.ml.sha = 'b'.repeat(40);
  assert.throws(() => release.rollbackTargets(c, record), /revisions differ/);
  previous.render.ml.sha = sha;
  previous.vercel.customer.projectId = 'prj_other';
  assert.throws(() => release.rollbackTargets(c, record), /project mismatch/);
  previous.vercel.customer.projectId = c.VERCEL_CUSTOMER_PROJECT_ID;
  previous.render.backend.serviceId = 'srv-other';
  assert.throws(() => release.rollbackTargets(c, record), /previous Render/);
});
