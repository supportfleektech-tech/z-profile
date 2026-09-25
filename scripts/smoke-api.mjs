#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  BACKEND API SUITE
 *  Boots `server/index.mjs` on a throwaway port + throwaway SQLite file, then
 *  exercises the real HTTP surface: auth + lockout, the tier-creation rules,
 *  M-PESA STK lifecycle, card 3-DS decline, refund idempotency, pricing shape,
 *  settings authorisation and audit. Exits non-zero on any failure.
 *
 *  Previously this lived in /tmp and was lost with the sandbox; it is now a
 *  committed gate wired into `npm run verify`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}`;
const results = [];
const check = (name, cond, detail = '') => {
  const ok = !!cond;
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) throw new Error(`Smoke assertion failed: ${name}`);
  return true;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sessionIdOf = (token) => JSON.parse(Buffer.from(token.split('.')[0], 'base64url')).sid;

const dataDir = mkdtempSync(path.join(tmpdir(), 'iprs-apitest-'));
const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const child = spawn(process.execPath, ['server/index.mjs'], {
  cwd: projectRoot,
  env: {
    ...process.env,
    PORT: String(PORT),
    IPRS_DB: path.join(dataDir, 'test.sqlite'),
    LOGIN_RATE_MAX: '100',
    STK_RATE_MAX: '100',
    API_V1_RATE_MAX: '2',
    NODE_ENV: 'development',
    DARAJA_CALLBACK_TOKEN: 'smoke-callback-token',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
let spawnError = null;
child.on('error', (error) => { spawnError = error; });
child.stdout.on('data', (d) => { serverLog += d; });
child.stderr.on('data', (d) => { serverLog += d; });

const waitHealthy = async () => {
  for (let i = 0; i < 60; i++) {
    if (spawnError) throw spawnError;
    if (serverLog.includes('[api] IPRS demo backend listening')) {
      try {
        const r = await fetch(`${BASE}/api/health`);
        if (r.ok) return true;
      } catch { /* not up yet */ }
    }
    await sleep(250);
  }
  return false;
};

let bearer = null; // suite-wide default, set on first successful login
const req = async (method, p, body, userId, asToken, extraHeaders = {}) => {
  const tok = asToken === undefined ? bearer : asToken; // pass null explicitly to send none
  const r = await fetch(`${BASE}${p}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(userId ? { 'x-user-id': userId } : {}),
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await r.json(); } catch { /* non-JSON */ }
  return { status: r.status, json, headers: r.headers };
};

let exitCode = 1;
try {
  if (!(await waitHealthy())) {
    throw new Error(`server never became healthy:\n${serverLog.slice(-800)}`);
  }
  const health = await req('GET', '/api/health');
  const hb = health.json;
  check('health: server answers with counts', hb?.counts?.users === 7, `${hb?.counts?.users} seeded users`);
  check('health: SQLite path is not exposed', hb?.storage?.path === undefined && !JSON.stringify(hb).includes(dataDir));
  const migrationDb = new DatabaseSync(path.join(dataDir, 'test.sqlite'));
  const schemaVersion = Number(migrationDb.prepare('PRAGMA user_version').get().user_version);
  migrationDb.close();
  check('migration: fresh database reaches the forward-only baseline', schemaVersion === 1, `user_version=${schemaVersion}`);
  check('security: baseline response headers are present',
    health.headers.get('x-content-type-options') === 'nosniff' && health.headers.get('x-frame-options') === 'DENY' && health.headers.get('referrer-policy') === 'no-referrer');
  const sameOrigin = await req('GET', '/api/health', null, null, null, { Origin: BASE });
  const devOrigin = await req('GET', '/api/health', null, null, null, { Origin: 'http://localhost:5173' });
  const deniedOrigin = await req('GET', '/api/health', null, null, null, { Origin: 'https://attacker.example' });
  check('cors: allowlist accepts configured origins and denies an unlisted origin',
    sameOrigin.headers.get('access-control-allow-origin') === BASE &&
    devOrigin.headers.get('access-control-allow-origin') === 'http://localhost:5173' &&
    deniedOrigin.headers.get('access-control-allow-origin') === null);
  const discovery = await req('GET', '/api');
  check('discovery: callback route is tokenized without exposing the token', discovery.json?.endpoints?.includes('POST /api/wallet/topup/mpesa/callback/:token') && !JSON.stringify(discovery.json).includes('smoke-callback-token'));

  /* ---- auth ---- */
  const badPw = await req('POST', '/api/auth/login', { email: 'analyst@iprs.co.ke', password: 'wrong' });
  const noBody = await req('POST', '/api/auth/login', {});
  check('auth: wrong and empty credentials are rejected', badPw.status === 401 && badPw.json?.ok === false && noBody.status >= 400);
  const login = await req('POST', '/api/auth/login', { email: 'analyst@iprs.co.ke', password: 'Iprs@2026!' });
  check('auth: correct credentials accepted', login.status === 200 && login.json?.user?.email === 'analyst@iprs.co.ke');
  check('rate-limit: login responses publish fixed-window headers', login.headers.get('ratelimit-limit') === '100' && login.headers.has('ratelimit-remaining') && login.headers.has('ratelimit-reset'));
  check('auth: response leaks no password material', !JSON.stringify(login.json).match(/"password(hash)?"/i));
  bearer = login.json?.token ?? null;
  check('auth: login issues a signed bearer token', typeof bearer === 'string' && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(bearer ?? ''), String(bearer?.slice(0, 24)));
  const meTok = await req('GET', '/api/auth/me');
  check('auth: bearer token resolves the actor', meTok.json?.user?.id === login.json.user.id);
  const headerTry = await req('GET', '/api/auth/me', null, login.json.user.id, null);
  check('auth: a bare x-user-id header alone is RETIRED (401)', headerTry.status === 401, String(headerTry.status));
  const tampered = await req('GET', '/api/auth/me', null, null, `${bearer.slice(0, -4)}AAAA`);
  const garbage = await req('GET', '/api/auth/me', null, null, 'garbage.payload');
  check('auth: tampered and malformed tokens are rejected', tampered.status === 401 && garbage.status === 401);
  const machineAdminLogin = await req('POST', '/api/auth/login', { email: 'admin@iprs.co.ke', password: 'Iprs@2026!' });
  const machineAdminToken = machineAdminLogin.json?.token;
  const machineIssue = async (token, scopes, label) => {
    const issued = await req('POST', '/api/api-keys', { label, scopes, environment: 'sandbox' }, null, token);
    return issued;
  };
  const machineAll = await machineIssue(machineAdminToken, ['pricing:read', 'wallet:read', 'verify:run', 'verify:read', 'report:read', 'wallet:debit'], 'Smoke machine key');
  const machineAllSecret = machineAll.json?.secret;
  check('machine-api: server issues a key with all six scopes', machineAll.status === 201 && machineAll.json?.ok === true && machineAll.json?.key?.scopes?.length === 6 && typeof machineAllSecret === 'string', `${machineAll.status} ${JSON.stringify(machineAll.json).slice(0, 100)}`);
  const billingLogin = await req('POST', '/api/auth/login', { email: 'billing@iprs.co.ke', password: 'Iprs@2026!' });
  const billingToken = billingLogin.json?.token;
  const analystToken = login.json.token;
  const secondAnalystLogin = await req('POST', '/api/auth/login', { email: 'analyst@iprs.co.ke', password: 'Iprs@2026!' });
  const secondAnalystToken = secondAnalystLogin.json?.token;
  const ownSessions = await req('GET', '/api/auth/sessions', null, null, analystToken);
  check('sessions: self-service list contains only the actor sessions', ownSessions.status === 200 && ownSessions.json?.length > 0 && ownSessions.json.every((s) => s.userId === login.json.user.id));
  check('sessions: only the requesting token session is marked current', ownSessions.json?.filter((s) => s.current).length === 1 && ownSessions.json?.some((s) => s.id === sessionIdOf(analystToken)));
  const foreignSessionDelete = await req('DELETE', `/api/auth/sessions/${sessionIdOf(machineAdminToken)}`, null, null, analystToken);
  const adminAfterDeniedDelete = await req('GET', '/api/auth/me', null, null, machineAdminToken);
  check('sessions: denied foreign/admin revocation is 403 and leaves the target token live',
    foreignSessionDelete.status === 403 && adminAfterDeniedDelete.status === 200, `${foreignSessionDelete.status}/${adminAfterDeniedDelete.status}`);
  const revokeOthers = await req('POST', '/api/auth/sessions/revoke-others', null, null, analystToken);
  const secondAfterRevoke = await req('GET', '/api/auth/me', null, null, secondAnalystToken);
  check('sessions: revoke-others revokes every other actor session', revokeOthers.status === 200 && secondAfterRevoke.status === 401, `${revokeOthers.json?.revoked ?? 0} revoked`);
  const anonymousWalletPatch = await req('PATCH', '/api/wallet/w-analyst', { autoTopUp: false }, null, null);
  check('wallet: anonymous settings mutation is rejected', anonymousWalletPatch.status === 401);
  const crossWalletPatch = await req('PATCH', '/api/wallet/w-billing', { autoTopUp: false }, null, analystToken);
  check('wallet: user tier cannot mutate another wallet', crossWalletPatch.status === 403);
  const protectedPatches = [];
  for (const [field, value] of [['balance', 999999], ['held', 10], ['userId', billingLogin.json.user.id], ['unknown', true]]) {
    protectedPatches.push(await req('PATCH', '/api/wallet/w-analyst', { [field]: value }, null, analystToken));
  }
  check('wallet: protected and unknown settings fields are all rejected', protectedPatches.every((response) => response.status === 400), protectedPatches.map((response) => response.status).join(','));
  const anonymousProviderLogs = await req('GET', '/api/provider-logs', null, null, null);
  check('providers: anonymous provider logs are rejected', anonymousProviderLogs.status === 401);
  const anonymousKeyRevoke = await req('POST', '/api/api-keys/ak-1/revoke', null, null, null);
  check('api-keys: anonymous revocation is rejected', anonymousKeyRevoke.status === 401);
  const crossKeyRevoke = await req('POST', '/api/api-keys/ak-1/revoke', null, null, analystToken);
  check('api-keys: user tier cannot revoke another owner key', crossKeyRevoke.status === 403);
  const crossUsageWrite = await req('POST', '/api/usage', { userId: billingLogin.json.user.id, costKes: 1, latencyMs: 1 }, null, analystToken);
  check('usage: user tier cannot write usage for another user', crossUsageWrite.status === 403);
  const sanitizedUsage = await req('POST', '/api/usage', { userId: analystToken ? login.json.user.id : null, costKes: -9, latencyMs: -4 }, null, analystToken);
  check('usage: negative numeric values are sanitized to zero', sanitizedUsage.status === 201 && sanitizedUsage.json?.costKes === 0 && sanitizedUsage.json?.latencyMs === 0);
  const machineRateKey = await machineIssue(machineAdminToken, ['pricing:read'], 'Smoke rate-limit key');
  const machineRateSecret = machineRateKey.json?.secret;
  const invalidV1 = [];
  for (let i = 0; i < 3; i += 1) invalidV1.push(await req('GET', '/api/v1/pricing', null, null, null));
  const firstV1 = await req('GET', '/api/v1/pricing', null, null, machineRateSecret);
  const secondV1 = await req('GET', '/api/v1/pricing', null, null, machineRateSecret);
  const thirdV1 = await req('GET', '/api/v1/pricing', null, null, machineRateSecret);
  check('rate-limit: API v1 authenticates before applying fixed-window limits', invalidV1.every((response) => response.status === 401 && !response.headers.has('retry-after')) && firstV1.headers.get('ratelimit-limit') === '2' && firstV1.headers.get('ratelimit-remaining') === '1');
  check('rate-limit: API v1 rejects the authenticated key after its fixed window limit', secondV1.headers.get('ratelimit-remaining') === '0' && thirdV1.status === 429 && thirdV1.json?.ok === false && thirdV1.json?.message === 'Too many requests.' && thirdV1.headers.has('retry-after'));

  const machineDiscovery = await req('GET', '/api/v1', null, null, null);
  const machineConsent = await machineIssue(machineAdminToken, ['verify:run', 'wallet:debit'], 'Smoke consent key');
  const machineConsentSecret = machineConsent.json?.secret;
  const machineVerifyKey = await machineIssue(machineAdminToken, ['verify:run', 'wallet:debit'], 'Smoke verify key');
  const machineVerifySecret = machineVerifyKey.json?.secret;
  const machineScopedSecret = machineRateSecret;
  const machineWallet = await req('GET', '/api/v1/wallet', null, null, machineAllSecret);
  const machineConsentResponse = await req('POST', '/api/v1/verify', { search_type: 'identity', identifier: '12345678', consent: 'true' }, null, machineConsentSecret);
  const machinePricing = firstV1;
  check('machine-api: missing key is 401', (await req('GET', '/api/v1/wallet', null, null, null)).status === 401);
  check('machine-api: discovery is public and names the exact scopes/endpoints', machineDiscovery.json?.service === 'iprs-machine-api' && machineDiscovery.json?.scopes?.length === 6 && machineDiscovery.json?.endpoints?.length === 3);
  check('machine-api: wrong scope is 403', (await req('GET', '/api/v1/wallet', null, null, machineScopedSecret)).status === 403);
  check('machine-api: non-boolean consent is 400', machineConsentResponse.status === 400);
  check('machine-api: pricing scope reads the existing 34-item catalogue', machinePricing.status === 200 && machinePricing.json?.items?.length === 34);
  check('machine-api: wallet response is the key owner only', machineWallet.status === 200 && machineWallet.json?.userId === machineAdminLogin.json.user.id);
  const machineVerify = await req('POST', '/api/v1/verify', { search_type: 'identity', identifier: '12345678', consent: true }, null, machineVerifySecret);
  check('machine-api: successful verification debits the catalogue rate', machineVerify.status === 200 && machineVerify.json?.costKes === 30 && machineVerify.json?.balanceKes === machineWallet.json?.balance - 30);
  const adminKeyList = await req('GET', '/api/api-keys', null, null, machineAdminToken);
  const analystKeyList = await req('GET', '/api/api-keys', null, null, analystToken);
  const adminKeyJson = JSON.stringify(adminKeyList.json ?? []);
  const adminKeyId = machineAll.json?.key?.id;
  check('machine-api: owner list redacts secrets and analyst cannot see the admin key',
    adminKeyList.status === 200 && Array.isArray(adminKeyList.json) && adminKeyList.json.some((key) => key.id === adminKeyId) &&
    !adminKeyJson.includes(machineAllSecret) && !adminKeyJson.includes('secretHash') &&
    analystKeyList.status === 200 && Array.isArray(analystKeyList.json) && !analystKeyList.json.some((key) => key.id === adminKeyId));
  const anonymousRoutes = [];
  for (const ep of ['/api/users', '/api/payments', '/api/audit', '/api/settings', '/api/sessions', '/api/providers']) {
    anonymousRoutes.push(await req('GET', ep, null, null, null));
  }
  check('auth: privileged route matrix rejects every anonymous request', anonymousRoutes.every((response) => response.status === 401), anonymousRoutes.map((response) => response.status).join(','));

  // Lockout policy (officer account, so later assertions are unaffected)
  let locked = null;
  for (let i = 0; i < 8 && !locked; i++) {
    const r = await req('POST', '/api/auth/login', { email: 'officer@iprs.co.ke', password: 'definitely-wrong' });
    if (r.status === 423 || /lock/i.test(r.json?.message ?? '')) locked = r;
  }
  const lockedOut = await req('POST', '/api/auth/login', { email: 'officer@iprs.co.ke', password: 'Iprs@2026!' });
  check('auth: lockout blocks even the correct password', !!locked && lockedOut.status >= 400 && /lock/i.test(lockedOut.json?.message ?? ''), `${lockedOut.status} ${lockedOut.json?.message?.slice(0, 50)}`);

  /* ---- tier rules: who may create whom (Req #10) ---- */
  const asAnalyst = login.json.user.id;
  const userCreates = await req('POST', '/api/users', { name: 'X', email: 'x@iprs.co.ke', tier: 'user', password: 'Str0ng!Pass1' }, asAnalyst);
  check('tiers: user tier may NOT create accounts', userCreates.status === 403);
  const adminLogin = await req('POST', '/api/auth/login', { email: 'admin@iprs.co.ke', password: 'Iprs@2026!' });
  const adminId = adminLogin.json.user.id;
  const adminTok = adminLogin.json.token;
  const adminCreatesAdmin = await req('POST', '/api/users', { name: 'Y', email: 'y@iprs.co.ke', tier: 'admin', password: 'Str0ng!Pass1' }, null, adminTok);
  check('tiers: admin may NOT create an admin (super admin only)', adminCreatesAdmin.status === 403);
  const superLogin = await req('POST', '/api/auth/login', { email: 'superadmin@iprs.co.ke', password: 'Iprs@2026!' });
  const superId = superLogin.json.user.id;
  const superTok = superLogin.json.token;
  const adminBackup = await req('GET', '/api/admin/backup', null, null, analystToken);
  const superBackup = await req('GET', '/api/admin/backup', null, null, superTok);
  const backupJson = JSON.stringify(superBackup.json ?? {});
  check('backup: non-Super-Admin export is denied', adminBackup.status === 403, String(adminBackup.status));
  check('backup: versioned payload excludes sessions, STK, and credentials', superBackup.status === 200 && superBackup.json?.format === 'iprs-backup' && superBackup.json?.version === 1 && !superBackup.json?.data?.sessions && !superBackup.json?.data?.stk_pending && !backupJson.includes('smoke-callback-token') && !backupJson.includes('authSecret') && !backupJson.includes('"password"'));
  const invalidBackup = await req('POST', '/api/admin/restore', { ...superBackup.json, version: 99 }, null, superTok);
  check('backup: unsupported restore version is rejected', invalidBackup.status === 400, String(invalidBackup.status));
  const restoreBackup = await req('POST', '/api/admin/restore', superBackup.json, null, superTok);
  const bearerAfterRestore = await req('GET', '/api/auth/me', null, null, bearer);
  const machineAfterRestore = await req('GET', '/api/v1/wallet', null, null, machineAllSecret);
  check('backup: restore round-trip succeeds transactionally', restoreBackup.status === 200 && restoreBackup.json?.ok === true && bearerAfterRestore.status === 200, String(restoreBackup.status));
  check('backup: machine credentials remain usable after restore', machineAfterRestore.status === 200 && machineAfterRestore.json?.userId === machineAdminLogin.json.user.id, String(machineAfterRestore.status));
  const superCreatesAdmin = await req('POST', '/api/users', { name: 'Zuri Achieng', email: 'zuri.achieng@iprs.co.ke', tier: 'admin', password: 'Str0ng!Pass1', phone: '0712000001' }, null, superTok);
  check('tiers: super admin CAN create an admin', [200, 201].includes(superCreatesAdmin.status) && superCreatesAdmin.json?.user?.tier === 'admin', JSON.stringify(superCreatesAdmin.json).slice(0, 80));
  const newUserId = superCreatesAdmin.json?.user?.id;
  const forbiddenUserPatch = await req('PATCH', `/api/users/${newUserId}`, { walletId: 'wal-attacker', failedLoginAttempts: 999 }, null, superTok);
  check('tiers: created admin response is public and immutable fields are rejected',
    !JSON.stringify(superCreatesAdmin.json).match(/"password(hash)?"/i) && forbiddenUserPatch.status === 400,
    String(forbiddenUserPatch.status));
  const newWallet = await req('GET', '/api/wallet', null, null, superTok);
  const newArr = Array.isArray(newWallet.json) ? newWallet.json : [newWallet.json];
  check('tiers: new admin gets a provisioned wallet', typeof newArr[0]?.balance === 'number', `balance ${newArr[0]?.balance}`);
  const superCreatesSuper = await req('POST', '/api/users', { name: 'S', email: 's@iprs.co.ke', tier: 'super_admin', password: 'Str0ng!Pass1' }, null, superTok);
  check('tiers: NOBODY can create a super admin via the API (seeded only)', superCreatesSuper.status === 403, superCreatesSuper.json?.message?.slice(0, 60));

  /* ---- wallet: M-PESA STK lifecycle ---- */
  const asBal = async (uid) => {
    const r = await req('GET', '/api/wallet', null, uid);
    const arr = Array.isArray(r.json) ? r.json : [r.json];
    return arr[0]?.balance;
  };
  const bal0 = await asBal(asAnalyst);
  {
    const wResp = await req('GET', '/api/wallet', null, asAnalyst);
    const wArr = Array.isArray(wResp.json) ? wResp.json : [wResp.json];
    check('wallet: user tier sees exactly its own wallet', wArr.length === 1 && wArr[0].userId === asAnalyst, `rows ${wArr.length}`);
  }
  const belowMinimum = await req('POST', '/api/wallet/topup/mpesa/stk', { userId: asAnalyst, phone: '0712345678', amount: 499 }, asAnalyst);
  check('mpesa: KES 500 minimum remains enforced', belowMinimum.status === 400);
  const stk = await req('POST', '/api/wallet/topup/mpesa/stk', { userId: asAnalyst, phone: '0712345678', amount: 1000 }, asAnalyst);
  check('mpesa: STK dispatch accepted with rate-limit headers',
    (stk.status === 200 || stk.status === 202) && stk.headers.get('ratelimit-limit') === '100' && stk.headers.has('ratelimit-remaining') && stk.headers.has('ratelimit-reset'),
    JSON.stringify(stk.json).slice(0, 70));
  const checkoutId = stk.json?.checkoutRequestID ?? stk.json?.checkoutRequestId ?? stk.json?.transaction?.checkoutRequestID;
  check('mpesa: dispatch returns a checkout reference', !!checkoutId);
  const foreignStk = await req('POST', '/api/wallet/topup/mpesa/stk', { userId: billingLogin.json.user.id, phone: '0712000009', amount: 1000 }, null, billingToken);
  const foreignCheckoutId = foreignStk.json?.checkoutRequestID;
  check('mpesa: foreign checkout dispatch succeeds for ownership tests', [200, 202].includes(foreignStk.status) && !!foreignCheckoutId, `${foreignStk.status} ${foreignCheckoutId ?? 'no checkout'}`);
  const oldCallback = await req('POST', '/api/wallet/topup/mpesa/callback', { Body: { stkCallback: { CheckoutRequestID: checkoutId, Amount: 1000 } } }, null, null);
  check('mpesa: tokenless callback route is absent', oldCallback.status === 404);
  const crossConfirm = await req('POST', '/api/wallet/topup/mpesa/confirm', { checkoutRequestID: foreignCheckoutId ?? '' }, null, analystToken);
  const crossCancel = await req('POST', '/api/wallet/topup/mpesa/cancel', { checkoutRequestID: foreignCheckoutId ?? '' }, null, analystToken);
  check('mpesa: user tier cannot confirm or cancel another checkout', crossConfirm.status === 403 && crossCancel.status === 403, `${crossConfirm.status}/${crossCancel.status}`);
  if (checkoutId) {
    const wrongToken = await req('POST', '/api/wallet/topup/mpesa/callback/wrong-token', { Body: { stkCallback: { CheckoutRequestID: checkoutId, Amount: 1000 } } }, null, null);
    check('mpesa: callback rejects the wrong token with 401', wrongToken.status === 401, String(wrongToken.status));
    const mismatch = await req('POST', '/api/wallet/topup/mpesa/callback/smoke-callback-token', { Body: { stkCallback: { CheckoutRequestID: checkoutId, ResultCode: 0, Amount: 999 } } }, null, null);
    check('mpesa: callback rejects an amount mismatch', mismatch.status === 400);
    const criticalAudit = await req('GET', '/api/audit?action=wallet.topup.callback.amount_mismatch', null, null, superTok);
    check('mpesa: amount mismatch appends a critical audit record', (Array.isArray(criticalAudit.json) ? criticalAudit.json : []).some((entry) => entry.severity === 'critical'));
    const crossPoll = await req('GET', `/api/wallet/topup/mpesa/stk/${encodeURIComponent(checkoutId)}`, null, null, billingToken);
    check('mpesa: user tier cannot poll another checkout', crossPoll.status === 403);
    const poll = await req('GET', `/api/wallet/topup/mpesa/stk/${encodeURIComponent(checkoutId)}`, null, null, analystToken);
    check('mpesa: poll reports the push is awaiting the handset', ['pending', 'sent', 'dispatched'].includes(String(poll.json?.status ?? poll.json?.state ?? '').toLowerCase()), String(poll.json?.status ?? poll.json?.state));
    const balMid = await asBal(asAnalyst);
    check('mpesa: balance NOT credited before confirmation', balMid === bal0, `${bal0} -> ${balMid}`);
    let simulatedSettlement = null;
    for (let attempt = 0; attempt < 48; attempt += 1) {
      simulatedSettlement = await req('GET', `/api/wallet/topup/mpesa/stk/${encodeURIComponent(checkoutId)}`, null, null, analystToken);
      if (simulatedSettlement.json?.status === 'settled') break;
      await sleep(250);
    }
    check('mpesa: simulated result remains persisted after STK creation', simulatedSettlement.json?.status === 'settled' && !!simulatedSettlement.json?.result, JSON.stringify(simulatedSettlement.json).slice(0, 100));
    const validCallback = await req('POST', '/api/wallet/topup/mpesa/callback/smoke-callback-token', { Body: { stkCallback: { CheckoutRequestID: checkoutId, ResultCode: 0, ResultDesc: 'Accepted', Amount: 1000 } } }, null, null);
    check('mpesa: valid tokenized callback is accepted', validCallback.status === 200 && validCallback.json?.ok === true);
    const confirm = await req('POST', '/api/wallet/topup/mpesa/confirm', { checkoutRequestID: checkoutId, userId: asAnalyst, outcome: 'success' }, asAnalyst);
    check('mpesa: confirm settles the push', confirm.status === 200, JSON.stringify(confirm.json).slice(0, 70));
    const bal1 = await asBal(asAnalyst);
    check('mpesa: wallet credited exactly the amount', bal1 === bal0 + 1000, `${bal0} -> ${bal1}`);
    const ledger = await req('GET', '/api/wallet/transactions', null, asAnalyst);
    const mpesaRow = (ledger.json?.transactions ?? ledger.json ?? []).find?.((t) => String(t.reference ?? t.id ?? '').startsWith('MPESA-'));
    check('mpesa: ledger carries an MPESA- referenced entry', !!mpesaRow);
    check('mpesa: ledger entry is exactly +1000', Number(mpesaRow?.amount ?? 0) === 1000);
  }

  /* ---- wallet: card 3-DS decline ---- */
  const bal2 = (await req('GET', '/api/wallet', null, asAnalyst)).json.balance;
  const card = await req('POST', '/api/wallet/topup/card', { userId: asAnalyst, amount: 2500, cardNumber: '4242 4242 4242 4242', expiry: '12/29', cvc: '123', holder: 'Sarah Wanjiku' }, asAnalyst);
  check('card: valid card enters the 3-DS challenge', card.status === 200 || card.status === 202, JSON.stringify(card.json).slice(0, 70));
  const badCard = await req('POST', '/api/wallet/topup/card', { userId: asAnalyst, amount: 2500, cardNumber: '1234 5678 9012 3456', expiry: '12/29', cvc: '123', holder: 'Sarah Wanjiku' }, asAnalyst);
  check('card: Luhn-invalid number rejected up front', badCard.status === 400);
  const decline = await req('POST', '/api/wallet/topup/card/confirm', { userId: asAnalyst, paymentIntentId: card.json?.paymentIntentId, amount: 2500, cardNumber: '4242424242424242', holder: 'Sarah Wanjiku', expiry: '12/29', otp: '000000' }, asAnalyst);
  const successCard = await req('POST', '/api/wallet/topup/card', { userId: asAnalyst, amount: 2500, cardNumber: '5555 5555 5555 4444', expiry: '12/29', cvc: '123', holder: 'Sarah Wanjiku' }, asAnalyst);
  const wrongCardAmount = await req('POST', '/api/wallet/topup/card/confirm', { userId: asAnalyst, paymentIntentId: successCard.json?.paymentIntentId, amount: 3000, cardNumber: '5555555555554444', holder: 'Sarah Wanjiku', expiry: '12/29', otp: '123456' }, asAnalyst);
  const wrongCardFraction = await req('POST', '/api/wallet/topup/card/confirm', { userId: asAnalyst, paymentIntentId: successCard.json?.paymentIntentId, amount: 2500.4, cardNumber: '5555555555554444', holder: 'Sarah Wanjiku', expiry: '12/29', otp: '123456' }, asAnalyst);
  const wrongCardOwner = await req('POST', '/api/wallet/topup/card/confirm', { userId: billingLogin.json.user.id, paymentIntentId: successCard.json?.paymentIntentId, amount: 2500, cardNumber: '5555555555554444', holder: 'Sarah Wanjiku', expiry: '12/29', otp: '123456' }, asAnalyst);
  const success = await req('POST', '/api/wallet/topup/card/confirm', { userId: asAnalyst, paymentIntentId: successCard.json?.paymentIntentId, amount: 2500, cardNumber: '5555555555554444', holder: 'Sarah Wanjiku', expiry: '12/29', otp: '123456' }, asAnalyst);
  check('card: confirmation is bound to the stored intent, owner, and amount for decline and success',
    [200, 402].includes(decline.status) && decline.json?.payment?.status === 'failed' &&
    wrongCardAmount.status === 400 && wrongCardFraction.status === 400 && wrongCardOwner.status === 403 &&
    success.status === 200 && success.json?.status === 'success' && success.json?.payment?.netKes === 2427,
    `${decline.status}/${wrongCardAmount.status}/${wrongCardFraction.status}/${wrongCardOwner.status}/${success.status}`);
  const bal3 = await asBal(asAnalyst);
  check('card: only the successful bound top-up credits the wallet', bal3 === bal2 + 2500, `${bal2} -> ${bal3}`);

  /* ---- token lifecycle: revocation on logout ---- */
  const viewerLogin = await req('POST', '/api/auth/login', { email: 'viewer@iprs.co.ke', password: 'Iprs@2026!' });
  const viewerToken = viewerLogin.json?.token;
  check('auth: second persona gets its own token', typeof viewerToken === 'string' && viewerToken !== bearer, `${viewerLogin.status} ${JSON.stringify(viewerLogin.json).slice(0, 120)}`);
  const viewerMe = await req('GET', '/api/auth/me', null, null, viewerToken);
  check('auth: viewer token authenticates before logout', viewerMe.json?.user?.email === 'viewer@iprs.co.ke', `${viewerMe.status} ${JSON.stringify(viewerMe.json).slice(0, 80)}`);
  const prevBearer = bearer;
  bearer = viewerToken;
  await req('POST', '/api/auth/logout', { reason: 'token revocation test' });
  bearer = prevBearer;
  const viewerAfter = await req('GET', '/api/auth/me', null, null, viewerToken);
  check('auth: token is DEAD after logout (session-bound revocation)', viewerAfter.status === 401, `${viewerAfter.status} ${JSON.stringify(viewerAfter.json).slice(0, 80)}`);

  /* ---- payments: refund + idempotency ---- */
  const pays = await req('GET', '/api/payments', null, null, superTok);
  const successPay = (pays.json?.payments ?? pays.json ?? []).find((p) => p.status === 'success');
  check('payments: a successful payment exists to refund', !!successPay);
  if (successPay) {
    const refund = await req('POST', `/api/payments/${successPay.id}/refund`, { reason: 'Duplicate collection', actorId: superId }, null, superTok);
    check('payments: refund succeeds and marks the payment refunded', refund.status === 200 && (refund.json?.payment?.status ?? refund.json?.status) === 'refunded', JSON.stringify(refund.json).slice(0, 80));
    const again = await req('POST', `/api/payments/${successPay.id}/refund`, { reason: 'Try twice', actorId: superId }, null, superTok);
    check('payments: double refund is rejected (409)', again.status === 409);
  }

  /* ---- pricing: the transcribed proposal ---- */
  const pricing = await req('GET', '/api/pricing');
  const byId = (id) => pricing.json?.items?.find((i) => i.id === id);
  check('pricing: catalogue serves 34 line items', pricing.json?.items?.length === 34, String(pricing.json?.items?.length));
  check('pricing: ALL 34 items carry confirmedFromProposal', pricing.json?.items?.filter((i) => i.confirmedFromProposal).length === 34);
  check('pricing: IPRS Standard is KES 30 with a KES 45 back-up rate', pricing.json?.items?.find((i) => i.id === 'kyc-id')?.unitPriceKes === 30 && pricing.json?.items?.find((i) => i.id === 'kyc-id')?.backupRateKes === 45);
  check('pricing: catalogue master flag is TRUE (fully priced)', pricing.json?.confirmedFromProposal === true);
  check('pricing: the 6 platform-priced items carry their keyed rates',
    byId('kyc-criminal')?.unitPriceKes === 500 && byId('kyc-deceased')?.unitPriceKes === 150 && byId('kyb-tax')?.unitPriceKes === 250 &&
    byId('kyb-crb')?.unitPriceKes === 1500 && byId('kyc-id-kra')?.unitPriceKes === 45 && byId('kyc-fullkyc')?.unitPriceKes === 200);
  check('pricing: platform-priced items declare their origin in proposalGroup',
    byId('kyc-criminal')?.proposalGroup?.startsWith('Platform-priced') === true);
  check('pricing: vehicle KES 1,160 and driving licence 200/260 (proposal 0–500)', byId('kyc-vehicle')?.unitPriceKes === 1160 && byId('kyc-driving-licence')?.unitPriceKes === 200 && byId('kyc-driving-licence')?.backupRateKes === 260);
  check('pricing: Metropol tiers 85/150/300 all confirmed', byId('kyc-metropol-score')?.unitPriceKes === 85 && byId('kyc-metropol-standard')?.unitPriceKes === 150 && byId('kyc-metropol-full')?.unitPriceKes === 300);
  check('pricing: CreditInfo 50/350/2,000 all confirmed', byId('kyc-ci-score')?.unitPriceKes === 50 && byId('kyc-creditinfo')?.unitPriceKes === 350 && byId('kyc-ci-status')?.unitPriceKes === 2000);
  check('pricing: BRS (KYB) APIs at KES 1,300, five products confirmed', ['kyb-registry', 'kyb-directors', 'kyb-bo', 'kyb-litigation', 'kyb-licence'].every((id) => byId(id)?.unitPriceKes === 1300 && byId(id)?.confirmedFromProposal));

  /* ---- super admin adjusts prices ---- */
  const adjust = (items, unit, id = 'kyc-id') => items.map((i) => (i.id === id ? { ...i, unitPriceKes: unit } : i));
  const origItems = pricing.json.items;
  const adj = await req('PATCH', '/api/pricing', { items: adjust(origItems, 35) }, null, superTok);
  check('pricing: SUPER ADMIN can adjust a rate', adj.status === 200, String(adj.status));
  const reread = await req('GET', '/api/pricing');
  check('pricing: adjusted rate persists (30 → 35)', reread.json?.items?.find((i) => i.id === 'kyc-id')?.unitPriceKes === 35);
  const auditAfterAdj = await req('GET', '/api/audit', null, null, superTok);
  const adjDetail = (Array.isArray(auditAfterAdj.json) ? auditAfterAdj.json : []).find((e) => e.action === 'pricing.updated')?.detail ?? '';
  check('pricing: adjustment is audit-logged with old → new', /kyc-id unitPriceKes 30→35/.test(adjDetail), adjDetail.slice(0, 70));
  const neg = await req('PATCH', '/api/pricing', { items: adjust(origItems, -5) }, null, superTok);
  check('pricing: negative rate is rejected (400)', neg.status === 400);
  // pricing.edit is deliberately Super-Admin-only: Admin holds pricing.view but not .edit.
  const adminDeny = await req('PATCH', '/api/pricing', { bundles: pricing.json.bundles }, null, adminTok);
  check('pricing: admin is DENIED rate adjustment (super admin only, by design)', adminDeny.status === 403, String(adminDeny.status));
  const userDeny = await req('PATCH', '/api/pricing', { vatRatePct: 18 }, null, login.json.token);
  check('pricing: user tier is denied rate adjustments', userDeny.status === 403, String(userDeny.status));
  // restore the shipped figures so later reads see the proposal values
  const restore = await req('PATCH', '/api/pricing', { items: origItems, bundles: pricing.json.bundles }, null, superTok);
  check('pricing: rates restored to proposal figures', restore.status === 200 && (await req('GET', '/api/pricing')).json.items.find((i) => i.id === 'kyc-id').unitPriceKes === 30);

  /* ---- Spin Mobile module registry ---- */
  const spinMods = await req('GET', '/api/spin/modules', null, null, superTok);
  check('spin: module registry serves 24 documented Kenya modules (incl. CRB tiers)', spinMods.json?.modules?.length === 24, String(spinMods.json?.modules?.length));
  check('spin: registry carries the SuperCrunch auth contract', spinMods.json?.auth?.tokenPath === '/analytics/auth/' && spinMods.json?.auth?.tokenTtlMinutes === 10);
  check('spin: MPESAKYCCHECK module maps to the priced M-PESA check', spinMods.json?.modules?.find((m) => m.searchType === 'MPESAKYCCHECK')?.pricedItemId === 'kyc-mpesa');
  // providers.view is deliberately held by user sub-roles (read-only visibility in the
  // route table); configuring is what stays privileged. So: analyst reads, anon cannot.
  const spinAsUser = await req('GET', '/api/spin/modules', null, null, login.json.token);
  check('spin: user tier can READ the module registry (read-only by design)', spinAsUser.status === 200, String(spinAsUser.status));
  const spinAnon = await req('GET', '/api/spin/modules', null, null, null);
  check('spin: module registry denied without an actor', spinAnon.status === 401);

  /* ---- settings authorisation ---- */
  const userPatch = await req('PATCH', '/api/settings/security', { maxFailedLogins: 2 }, asAnalyst);
  check('settings: user tier may NOT patch security settings', userPatch.status === 403);
  const adminPlatform = await req('PATCH', '/api/settings/platform', { allowSignups: true }, null, adminTok);
  check('settings: admin may NOT patch the platform group (super only)', adminPlatform.status === 403);
  const adminBilling = await req('PATCH', '/api/settings/billing', { blockSearchOnNegativeBalance: true }, null, adminTok);
  check('settings: admin CAN patch operational (billing) settings', adminBilling.status === 200, JSON.stringify(adminBilling.json).slice(0, 60));
  const anonymousMaintenance = await req('POST', '/api/settings/maintenance', { enabled: true }, null, null);
  const adminMaintenance = await req('POST', '/api/settings/maintenance', { enabled: true }, null, adminTok);
  const superMaintenance = await req('POST', '/api/settings/maintenance', { enabled: true }, null, superTok);
  const providerBefore = await req('GET', '/api/providers/p-crb', null, null, superTok);
  const providerUpdate = await req('PATCH', '/api/providers/p-crb', { consumerSecret: 'rotated-provider-secret', notes: 'write-only rotation' }, null, superTok);
  const settingsBefore = await req('GET', '/api/settings', null, null, superTok);
  const settingsUpdate = await req('PATCH', '/api/settings/integrations', { smsApiKey: 'rotated-sms-secret', smsSender: 'IPRS-SECURE' }, null, superTok);
  const providerAfter = await req('GET', '/api/providers/p-crb', null, null, superTok);
  const settingsAfter = await req('GET', '/api/settings', null, null, superTok);
  const secretResponses = [providerBefore, providerUpdate, settingsBefore, settingsUpdate, providerAfter, settingsAfter];
  const secretResponseJson = JSON.stringify(secretResponses.map((response) => response.json));
  check('settings: maintenance is permission-gated and provider/settings secrets remain write-only',
    anonymousMaintenance.status === 401 && adminMaintenance.status === 403 && superMaintenance.status === 200 &&
    providerUpdate.status === 200 && providerAfter.json?.notes === 'write-only rotation' &&
    settingsUpdate.status === 200 && settingsAfter.json?.integrations?.smsSender === 'IPRS-SECURE' &&
    !/consumerKey|consumerSecret|webhookSecret|smsApiKey|mpesaPasskey|secretHash|password/i.test(secretResponseJson),
    `anon/admin/super ${anonymousMaintenance.status}/${adminMaintenance.status}/${superMaintenance.status}`);

  /* ---- audit ---- */
  const audit = await req('GET', '/api/audit', null, null, superTok);
  const auditRows = Array.isArray(audit.json) ? audit.json : audit.json?.entries ?? [];
  check('audit: privileged actions are recorded', auditRows.some((e) => /user|created|account/i.test(JSON.stringify(e))), `${auditRows.length} entries`);
  const auditAsUser = await req('GET', '/api/audit', null, asAnalyst);
  check('audit: user tier is denied the audit trail', auditAsUser.status === 403);

  /* ---- scoping ---- */
  const cases = await req('GET', '/api/cases', null, asAnalyst);
  const caseRows = cases.json?.cases ?? cases.json ?? [];
  const foreigners = (Array.isArray(caseRows) ? caseRows : []).filter((c) => c.createdBy && c.createdBy !== asAnalyst && c.visibility !== 'org');
  check('cases: user tier sees only its own cases', foreigners.length === 0, `${Array.isArray(caseRows) ? caseRows.length : '?'} rows`);

  const unknown = await req('GET', '/api/nope');
  check('misc: unknown routes answer JSON, not HTML', unknown.status === 404 && unknown.json?.ok === false);
  /* ---- header fallback retired: identity is bearer-only ---- */
  const headerOnly = await req('GET', '/api/users', null, superId, null);
  check('hardened: the bare x-user-id header is RETIRED (401 even for a real id)', headerOnly.status === 401, String(headerOnly.status));
  const stillWorks = await req('GET', '/api/users', null, null, superTok);
  check('hardened: bearer token remains the sole identity', stillWorks.status === 200);

  /* ---- password hashing ---- */
  const pwScan = JSON.stringify(login.json);
  check('auth: no plaintext or hash material leaks in auth responses', !/"password(hash)?"/i.test(pwScan));
  const zuriLogin = await req('POST', '/api/auth/login', { email: 'zuri.achieng@iprs.co.ke', password: 'Str0ng!Pass1' });
  const passwordUpdate = await req('PATCH', `/api/users/${newUserId}`, { password: 'N3wHashed!Pass1' }, null, superTok);
  const zuriNewPasswordLogin = await req('POST', '/api/auth/login', { email: 'zuri.achieng@iprs.co.ke', password: 'N3wHashed!Pass1' });
  const zuriOldPasswordLogin = await req('POST', '/api/auth/login', { email: 'zuri.achieng@iprs.co.ke', password: 'Str0ng!Pass1' });
  check('auth: a created account password is hashed immediately on update',
    zuriLogin.status === 200 && passwordUpdate.status === 200 && !JSON.stringify(passwordUpdate.json).match(/"password(hash)?"/i) &&
    zuriNewPasswordLogin.status === 200 && !!zuriNewPasswordLogin.json?.token && zuriOldPasswordLogin.status === 401,
    `${zuriLogin.status}/${passwordUpdate.status}/${zuriNewPasswordLogin.status}/${zuriOldPasswordLogin.status}`);
  const lowBalanceKey = await machineIssue(zuriLogin.json.token, ['verify:run', 'wallet:debit'], 'Smoke insufficient-wallet key');
  const insufficient = await req('POST', '/api/v1/verify', { search_type: 'identity', identifier: '12345678', consent: true }, null, lowBalanceKey.json?.secret);
  check('machine-api: insufficient wallet is 402 with requiredKes', insufficient.status === 402 && insufficient.json?.requiredKes === 30);
} finally {
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => child.once('exit', resolve)), sleep(3000)]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  try { rmSync(dataDir, { recursive: true, force: true }); } catch { /* best effort */ }
}

const fail = results.filter((r) => !r.ok).length;
console.log(`\n──────── BACKEND API ────────\nPASS ${results.length - fail} / FAIL ${fail}  (${results.length} assertions)`);
process.exit(fail === 0 ? 0 : 1);
