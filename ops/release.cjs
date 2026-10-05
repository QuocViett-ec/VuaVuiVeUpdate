'use strict';

// Only Node built-ins. CI validates the source run before this script receives secrets.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const runFile = promisify(execFile);
const SHA = /^[a-f0-9]{40}$/;
const DEPLOY_ID = /^dep-[a-z0-9]+$/;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const gates = ['P0_CLOSED', 'PAYMENT_SANDBOX_PASSED', 'LOAD_PASSED', 'RESTORE_PASSED',
  'CREDENTIALS_REVIEWED', 'STORAGE_PASSED', 'ML_PASSED', 'ROLLBACK_PASSED'];

function assert(value, message) { if (!value) throw new Error(message); }
function origin(value) {
  const url = new URL(value);
  assert(url.protocol === 'https:' && !url.username && !url.password &&
    url.pathname === '/' && !url.search && !url.hash, 'Expected an HTTPS origin without credentials/path');
  assert(!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname), 'Local origin cannot be a deployment target');
  return url.origin;
}
function config(env = process.env) {
  const required = ['TARGET_ENVIRONMENT', 'RENDER_API_KEY', 'RENDER_BACKEND_SERVICE_ID', 'RENDER_ML_SERVICE_ID',
    'BACKEND_ORIGIN', 'ML_ORIGIN', 'CUSTOMER_ORIGIN', 'ADMIN_ORIGIN', 'VERCEL_TOKEN',
    'VERCEL_ORG_ID', 'VERCEL_CUSTOMER_PROJECT_ID', 'VERCEL_ADMIN_PROJECT_ID'];
  required.forEach(key => assert(env[key], `Missing configuration: ${key}`));
  assert(['staging', 'production'].includes(env.TARGET_ENVIRONMENT), 'Invalid environment');
  assert(env.VERCEL_CUSTOMER_PROJECT_ID !== env.VERCEL_ADMIN_PROJECT_ID, 'Customer/admin projects must differ');
  assert(env.RENDER_BACKEND_SERVICE_ID !== env.RENDER_ML_SERVICE_ID, 'Backend/ML services must differ');
  for (const key of ['RENDER_BACKEND_SERVICE_ID', 'RENDER_ML_SERVICE_ID']) {
    assert(/^srv-[a-z0-9]+$/.test(env[key]), `Invalid service ID: ${key}`);
  }
  for (const key of ['VERCEL_ORG_ID', 'VERCEL_CUSTOMER_PROJECT_ID', 'VERCEL_ADMIN_PROJECT_ID']) {
    assert(/^[a-zA-Z0-9_-]+$/.test(env[key]), `Invalid Vercel ID: ${key}`);
  }
  const c = { ...env };
  assert(!env.GOOGLE_CLIENT_ID || /^[\w.-]+\.apps\.googleusercontent\.com$/.test(env.GOOGLE_CLIENT_ID), 'Invalid public Google client ID');
  for (const key of ['BACKEND_ORIGIN', 'ML_ORIGIN', 'CUSTOMER_ORIGIN', 'ADMIN_ORIGIN']) c[key] = origin(env[key]);
  assert(new Set([c.BACKEND_ORIGIN, c.ML_ORIGIN, c.CUSTOMER_ORIGIN, c.ADMIN_ORIGIN]).size === 4, 'Service origins must differ');
  return c;
}
function targets(c) {
  return Object.fromEntries(['RENDER_BACKEND_SERVICE_ID', 'RENDER_ML_SERVICE_ID', 'VERCEL_CUSTOMER_PROJECT_ID',
    'VERCEL_ADMIN_PROJECT_ID', 'BACKEND_ORIGIN', 'ML_ORIGIN', 'CUSTOMER_ORIGIN', 'ADMIN_ORIGIN'].map(key => [key, c[key]]));
}
function productionGates(env, sha, staging) {
  assert(SHA.test(sha), 'Invalid release SHA');
  assert(env.APPROVED_RELEASE_SHA === sha, 'Production approval must name this exact SHA');
  for (const key of gates) assert(env[key] === 'true', `Production gate not closed: ${key}`);
  assert(staging?.environment === 'staging' && staging.sha === sha && staging.smokePassed === true,
    'Production requires successful staging evidence for this SHA');
  assert(staging.targets && Object.keys(targets(env)).every(key => typeof staging.targets[key] === 'string'), 'Missing staging targets');
  const stageIds = new Set(Object.values(staging.targets));
  for (const value of Object.values(targets(env))) assert(value && !stageIds.has(value), 'Staging and production must use separate targets');
}
function files(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    assert(!entry.isSymbolicLink(), 'Release cannot contain symbolic links');
    const name = prefix + entry.name;
    return entry.isDirectory() ? files(path.join(dir, entry.name), name + '/') : [name];
  });
}
function digest(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function packageRelease(sha, destination) {
  assert(SHA.test(sha), 'Invalid release SHA');
  assert(!fs.existsSync(destination), 'Release destination must be new');
  fs.mkdirSync(destination, { recursive: true });
  for (const portal of ['customer', 'admin']) {
    const source = path.join('frontend/dist', portal === 'customer' ? 'frontend' : 'admin', 'browser');
    assert(fs.existsSync(path.join(source, 'index.html')), `Missing ${portal} production build`);
    fs.cpSync(source, path.join(destination, portal), { recursive: true });
  }
  const hashes = Object.fromEntries(files(destination).map(name => [name, digest(path.join(destination, name))]));
  fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify({ version: 1, sha, hashes }, null, 2));
}
function verifyRelease(dir, expectedSha) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  assert(manifest.version === 1 && SHA.test(manifest.sha) && manifest.sha === expectedSha, 'Release SHA mismatch');
  const actual = files(dir).filter(name => name !== 'manifest.json');
  assert(JSON.stringify(actual.slice().sort()) === JSON.stringify(Object.keys(manifest.hashes).sort()), 'Release file list changed');
  for (const name of actual) assert(digest(path.join(dir, name)) === manifest.hashes[name], 'Release checksum mismatch');
  for (const portal of ['customer', 'admin']) assert(actual.includes(`${portal}/index.html`), 'Missing portal index');
  return manifest;
}
async function request(url, options = {}, fetcher = fetch) {
  let response;
  try { response = await fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(30000) }); }
  catch { throw new Error('Remote request failed or timed out (response omitted)'); }
  assert(response.ok, `Remote HTTP ${response.status} (response omitted)`);
  assert((response.headers.get('content-type') || '').includes('application/json'), 'Expected JSON response');
  try { return await response.json(); }
  catch { throw new Error('Remote response is invalid JSON (response omitted)'); }
}
function renderClient(c, fetcher = fetch) {
  return (route, body) => request(`https://api.render.com/v1${route}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${c.RENDER_API_KEY}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }, fetcher);
}
async function waitRender(api, service, id, sha, pause = sleep, attempts = 120) {
  assert(DEPLOY_ID.test(id) && SHA.test(sha), 'Invalid Render deploy metadata');
  for (let i = 0; i < attempts; i++) {
    const deploy = await api(`/services/${service}/deploys/${id}`);
    assert(deploy.commit?.id === sha, 'Render deployed a different commit');
    if (deploy.status === 'live') return deploy;
    assert(!['build_failed', 'update_failed', 'canceled', 'deactivated', 'pre_deploy_failed'].includes(deploy.status),
      'Render deploy failed; use the release-result artifact to restore previous deployments');
    await pause(10000);
  }
  throw new Error('Render deploy timeout; inspect hosting status before retry/rollback');
}
function candidate(value) {
  const parsed = new URL(value);
  assert(parsed.protocol === 'https:' && parsed.hostname.endsWith('.vercel.app') &&
    !parsed.username && !parsed.password && parsed.pathname === '/' && !parsed.search && !parsed.hash,
  'Invalid Vercel deployment URL');
  return parsed.origin;
}
async function vercel(c, project, args, cwd) {
  try {
    const result = await runFile('vercel', [...args, '--token', c.VERCEL_TOKEN, '--scope', c.VERCEL_ORG_ID], {
      cwd, timeout: 600000, maxBuffer: 1024 * 1024,
      env: { ...process.env, VERCEL_ORG_ID: c.VERCEL_ORG_ID, VERCEL_PROJECT_ID: project },
    });
    return result.stdout.trim();
  } catch { throw new Error('Vercel command failed (credential-bearing output omitted)'); }
}
function preparePortal(c, portal, dir, sha, contextRoot = '.qa-data/deploy') {
  const dest = path.resolve(contextRoot, portal);
  assert(!fs.existsSync(dest), 'Deployment context must be new');
  const output = path.join(dest, '.vercel/output');
  fs.mkdirSync(output, { recursive: true });
  fs.cpSync(path.join(dir, portal), path.join(output, 'static'), { recursive: true });
  const staticDir = path.join(output, 'static');
  const overrides = {};
  // Keep upload filenames ASCII; Vercel serves their original public URLs via overrides.
  for (const name of files(staticDir).filter(name => /[^\x21-\x7e]/.test(name))) {
    const target = 'assets/' + crypto.createHash('sha256').update(name).digest('hex') + path.extname(name);
    fs.mkdirSync(path.join(staticDir, 'assets'), { recursive: true });
    const sourcePath = path.resolve(staticDir, name), targetPath = path.resolve(staticDir, target);
    assert([sourcePath, targetPath].every(value => value.startsWith(staticDir + path.sep)), 'Asset escaped deployment context');
    fs.renameSync(sourcePath, targetPath);
    overrides[target] = { path: name };
  }
  fs.writeFileSync(path.join(output, 'config.json'), JSON.stringify({ version: 3, overrides, routes: [
    { src: '/api/(.*)', dest: `${c.BACKEND_ORIGIN}/api/$1` },
    { src: '/uploads/(.*)', dest: `${c.BACKEND_ORIGIN}/uploads/$1` },
    { src: '/release-config.json', headers: { 'Cache-Control': 'no-store' }, continue: true },
    { handle: 'filesystem' }, { src: '/(.*)', dest: '/index.html' },
  ] }, null, 2));
  fs.writeFileSync(path.join(output, 'static/release-config.json'), JSON.stringify({
    releaseSha: sha, customerPortalBase: c.CUSTOMER_ORIGIN, adminPortalBase: c.ADMIN_ORIGIN,
    ...(c.GOOGLE_CLIENT_ID ? { googleClientId: c.GOOGLE_CLIENT_ID } : {}),
  }));
  fs.writeFileSync(path.join(dest, '.vercel/project.json'), JSON.stringify({
    orgId: c.VERCEL_ORG_ID,
    projectId: c[portal === 'customer' ? 'VERCEL_CUSTOMER_PROJECT_ID' : 'VERCEL_ADMIN_PROJECT_ID'],
  }));
  return dest;
}
function smokeHeaders(c, url) {
  return c.VERCEL_AUTOMATION_BYPASS_SECRET && new URL(url).hostname.endsWith('.vercel.app')
    ? { 'x-vercel-protection-bypass': c.VERCEL_AUTOMATION_BYPASS_SECRET } : {};
}
async function smoke(c, sha, portals, fetcher = fetch) {
  async function backend(base) {
    const health = await request(`${base}/api/health`, { headers: smokeHeaders(c, base) }, fetcher);
    assert(health.status === 'ok' && health.db?.ready === true && health.revision === sha, 'Backend readiness/revision failed');
    assert(health.environment === c.TARGET_ENVIRONMENT, 'Backend environment mismatch');
    assert(health.payments?.momo === false && health.payments?.vnpay === false, 'MoMo/VNPay must remain disabled');
    const products = await request(`${base}/api/products?limit=1`, { headers: smokeHeaders(c, base) }, fetcher);
    assert(products.success === true && Array.isArray(products.data), 'Product API smoke check failed');
    const guest = await fetcher(`${base}/api/orders/me`, { headers: smokeHeaders(c, base),
      redirect: 'error', signal: AbortSignal.timeout(30000) });
    assert(guest.status === 401, 'Guest order access must be denied');
  }
  await backend(c.BACKEND_ORIGIN);
  const ml = await request(`${c.ML_ORIGIN}/health`, {}, fetcher);
  assert(ml.status === 'ok' && ml.adapter_ready === true && ml.revision === sha, 'ML readiness/revision failed');
  assert(ml.environment === c.TARGET_ENVIRONMENT, 'ML environment mismatch');
  for (const [portal, base] of Object.entries(portals)) {
    const runtime = await request(`${base}/release-config.json`, { headers: smokeHeaders(c, base) }, fetcher);
    assert(runtime.releaseSha === sha && runtime.customerPortalBase === c.CUSTOMER_ORIGIN &&
      runtime.adminPortalBase === c.ADMIN_ORIGIN, 'Portal runtime configuration mismatch');
    const html = await fetcher(`${base}/`, { headers: smokeHeaders(c, base), redirect: 'error', signal: AbortSignal.timeout(30000) });
    assert(html.ok && (await html.text()).includes(portal === 'customer' ? '<app-root' : '<admin-root'), 'Wrong portal HTML');
    await backend(base); // Verify the rewrite, not only the direct backend URL.
  }
}
async function snapshot(c, api) {
  const result = { render: {}, vercel: {} };
  for (const [kind, id] of [['backend', c.RENDER_BACKEND_SERVICE_ID], ['ml', c.RENDER_ML_SERVICE_ID]]) {
    const service = await api(`/services/${id}`);
    assert(service.autoDeploy === 'no' || service.autoDeployTrigger === 'off', 'Turn off Render Git auto-deploy before using this pipeline');
    const rows = await api(`/services/${id}/deploys?status=live&limit=1`);
    assert(Array.isArray(rows), 'Unexpected Render deploy list');
    const deploy = rows[0]?.deploy;
    assert(!deploy || deploy.status === 'live', 'Expected the current live Render deployment');
    result.render[kind] = deploy ? { serviceId: id, deployId: deploy.id, sha: deploy.commit?.id } : null;
  }
  for (const portal of ['customer', 'admin']) {
    const project = c[portal === 'customer' ? 'VERCEL_CUSTOMER_PROJECT_ID' : 'VERCEL_ADMIN_PROJECT_ID'];
    const metadata = await request(`https://api.vercel.com/v9/projects/${project}?teamId=${encodeURIComponent(c.VERCEL_ORG_ID)}`,
      { headers: { Authorization: `Bearer ${c.VERCEL_TOKEN}` } });
    result.vercel[portal] = metadata.targets?.production?.url
      ? { projectId: project, url: candidate(`https://${metadata.targets.production.url}`) } : null;
  }
  return result;
}
function rollbackTargets(c, record) {
  assert(record.version === 1 && record.environment === c.TARGET_ENVIRONMENT, 'Rollback environment mismatch');
  const previous = record.previous;
  for (const [kind, id] of [['backend', c.RENDER_BACKEND_SERVICE_ID], ['ml', c.RENDER_ML_SERVICE_ID]]) {
    const value = previous?.render?.[kind];
    assert(value?.serviceId === id && DEPLOY_ID.test(value.deployId) && SHA.test(value.sha), 'No valid previous Render deployment');
  }
  assert(previous.render.backend.sha === previous.render.ml.sha, 'Previous backend/ML revisions differ; restore manually');
  for (const portal of ['customer', 'admin']) {
    const value = previous?.vercel?.[portal];
    assert(value?.projectId === c[portal === 'customer' ? 'VERCEL_CUSTOMER_PROJECT_ID' : 'VERCEL_ADMIN_PROJECT_ID'],
      'Rollback project mismatch');
    candidate(value.url);
  }
  return previous;
}
async function preflight(c, dir, sha) {
  verifyRelease(dir, sha);
  if (c.TARGET_ENVIRONMENT === 'production') productionGates(c, sha,
    JSON.parse(fs.readFileSync('.qa-data/staging-evidence/release-result.json', 'utf8')));
  const api = renderClient(c);
  const record = { version: 1, environment: c.TARGET_ENVIRONMENT, sha, targets: targets(c), qualityRunId: c.SOURCE_RUN_ID,
    releaseRunId: c.GITHUB_RUN_ID, smokePassed: false, previous: await snapshot(c, api), deployed: {} };
  if (c.TARGET_ENVIRONMENT === 'production') {
    const previous = rollbackTargets(c, record);
    for (const portal of ['customer', 'admin']) {
      const oldUrl = previous.vercel[portal].url;
      const runtime = await request(`${oldUrl}/release-config.json`, { headers: smokeHeaders(c, oldUrl) });
      assert(runtime.releaseSha === previous.render.backend.sha, 'Previous release lacks a consistent rollback baseline');
    }
  }
  fs.writeFileSync('.qa-data/release-result.json', JSON.stringify(record, null, 2));
  console.log('Preflight passed; upload the rollback baseline before deploying.');
}
async function deploy(c, dir, sha) {
  verifyRelease(dir, sha);
  const record = JSON.parse(fs.readFileSync('.qa-data/release-result.json', 'utf8'));
  assert(record.version === 1 && record.environment === c.TARGET_ENVIRONMENT && record.sha === sha &&
    record.qualityRunId === c.SOURCE_RUN_ID && JSON.stringify(record.targets) === JSON.stringify(targets(c)),
  'Deployment must use the validated preflight baseline and targets');
  if (c.TARGET_ENVIRONMENT === 'production') productionGates(c, sha,
    JSON.parse(fs.readFileSync('.qa-data/staging-evidence/release-result.json', 'utf8')));
  const api = renderClient(c);
  const save = () => fs.writeFileSync('.qa-data/release-result.json', JSON.stringify(record, null, 2));
  for (const [kind, id] of [['ml', c.RENDER_ML_SERVICE_ID], ['backend', c.RENDER_BACKEND_SERVICE_ID]]) {
    const started = await api(`/services/${id}/deploys`, { commitId: sha });
    record.deployed[kind] = started.id;
    save();
    await waitRender(api, id, started.id, sha);
  }
  const portals = {};
  const contexts = {};
  for (const portal of ['customer', 'admin']) {
    const project = c[portal === 'customer' ? 'VERCEL_CUSTOMER_PROJECT_ID' : 'VERCEL_ADMIN_PROJECT_ID'];
    contexts[portal] = preparePortal(c, portal, dir, sha);
    portals[portal] = candidate(await vercel(c, project, ['deploy', '--prebuilt', '--prod', '--skip-domain', '--yes'], contexts[portal]));
    record.deployed[portal] = portals[portal];
    save();
  }
  await smoke(c, sha, portals);
  for (const portal of ['customer', 'admin']) {
    await vercel(c, c[portal === 'customer' ? 'VERCEL_CUSTOMER_PROJECT_ID' : 'VERCEL_ADMIN_PROJECT_ID'],
      ['promote', portals[portal], '--yes'], contexts[portal]);
  }
  await smoke(c, sha, { customer: c.CUSTOMER_ORIGIN, admin: c.ADMIN_ORIGIN });
  record.smokePassed = true;
  save();
  console.log(`Release ${sha} passed ${c.TARGET_ENVIRONMENT} smoke checks.`);
}
async function rollback(c, record) {
  const previous = rollbackTargets(c, record);
  const api = renderClient(c);
  // Check prior frontend versions before changing anything. This also prevents mixing incompatible revisions.
  const oldSha = previous.render.backend.sha;
  const oldPortals = Object.fromEntries(['customer', 'admin'].map(p => [p, previous.vercel[p].url]));
  for (const url of Object.values(oldPortals)) {
    const runtime = await request(`${url}/release-config.json`, { headers: smokeHeaders(c, url) });
    assert(runtime.releaseSha === oldSha, 'Previous frontend/backend revisions differ; restore manually');
  }
  for (const kind of ['ml', 'backend']) {
    const target = previous.render[kind];
    const started = await api(`/services/${target.serviceId}/rollback`, { deployId: target.deployId });
    await waitRender(api, target.serviceId, started.id, target.sha);
  }
  for (const portal of ['customer', 'admin']) {
    const cwd = path.resolve('.qa-data/rollback', portal);
    fs.mkdirSync(path.join(cwd, '.vercel'), { recursive: true });
    fs.writeFileSync(path.join(cwd, '.vercel/project.json'), JSON.stringify({
      orgId: c.VERCEL_ORG_ID, projectId: previous.vercel[portal].projectId,
    }));
    await vercel(c, previous.vercel[portal].projectId, ['rollback', previous.vercel[portal].url, '--yes'], cwd);
  }
  await smoke(c, oldSha, { customer: c.CUSTOMER_ORIGIN, admin: c.ADMIN_ORIGIN });
  fs.writeFileSync('.qa-data/rollback-result.json', JSON.stringify({ environment: c.TARGET_ENVIRONMENT, sha: oldSha, smokePassed: true }));
  console.log(`Rollback ${oldSha} passed smoke checks. Database/storage were not modified.`);
}
if (require.main === module) {
  (async () => {
    const [mode, arg, sha] = process.argv.slice(2);
    if (mode === 'package') return packageRelease(sha, arg);
    const c = config();
    if (mode === 'preflight') return preflight(c, arg, sha);
    if (mode === 'deploy') return deploy(c, arg, sha);
    if (mode === 'rollback') return rollback(c, JSON.parse(fs.readFileSync(path.join(arg, 'release-result.json'), 'utf8')));
    throw new Error('Expected package, preflight, deploy or rollback');
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { assert, origin, config, productionGates, files, packageRelease, verifyRelease,
  request, waitRender, candidate, preparePortal, smoke, rollbackTargets, gates, targets };
