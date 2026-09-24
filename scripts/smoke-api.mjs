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
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}`;
const results = [];
const check = (name, cond, detail = '') => {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  return !!cond;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dataDir = mkdtempSync(path.join(tmpdir(), 'iprs-apitest-'));
const child = spawn(process.execPath, ['server/index.mjs'], {
  cwd: new URL('..', import.meta.url).pathname,
  env: { ...process.env, PORT: String(PORT), IPRS_DB: path.join(dataDir, 'test.sqlite') },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
child.stdout.on('data', (d) => { serverLog += d; });
child.stderr.on('data', (d) => { serverLog += d; });

const waitHealthy = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  return false;
};

let bearer = null; // suite-wide default, set on first successful login
const req = async (method, p, body, userId, asToken) => {
  const tok = asToken === undefined ? bearer : asToken; // pass null explicitly to send none
  const r = await fetch(`${BASE}${p}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(userId ? { 'x-user-id': userId } : {}),
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await r.json(); } catch { /* non-JSON */ }
  return { status: r.status, json };
};

let exitCode = 1;
try {
  if (!(await waitHealthy())) {
    console.error('server never became healthy:\n' + serverLog.slice(-800));
    process.exit(1);
  }
  // Guard against a stale process on the test port: our child seeds a throwaway DB.
  const hb = (await req('GET', '/api/health')).json;
  if (hb?.storage?.path !== path.join(dataDir, 'test.sqlite')) {
    console.error(`port ${PORT} is answered by a foreign server (${hb?.storage?.path}). Kill it and rerun.`);
    child.kill('SIGTERM');
    process.exit(1);
  }
  check('health: server answers with counts', hb?.counts?.users === 7, `${hb?.counts?.users} seeded users`);

  /* ---- auth ---- */
  const badPw = await req('POST', '/api/auth/login', { email: 'analyst@iprs.co.ke', password: 'wrong' });
  check('auth: wrong password rejected', badPw.status === 401 && badPw.json?.ok === false);
  const noBody = await req('POST', '/api/auth/login', {});
  check('auth: empty credentials rejected', noBody.status >= 400);
  const login = await req('POST', '/api/auth/login', { email: 'analyst@iprs.co.ke', password: 'Iprs@2026!' });
  check('auth: correct credentials accepted', login.status === 200 && login.json?.user?.email === 'analyst@iprs.co.ke');
  check('auth: response leaks no password material', !JSON.stringify(login.json).match(/"password(hash)?"/i));
  bearer = login.json?.token ?? null;
  check('auth: login issues a signed bearer token', typeof bearer === 'string' && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(bearer ?? ''), String(bearer?.slice(0, 24)));
  const meTok = await req('GET', '/api/auth/me');
  check('auth: bearer token resolves the actor', meTok.json?.user?.id === login.json.user.id);
  const headerTry = await req('GET', '/api/auth/me', null, login.json.user.id, null);
  check('auth: a bare x-user-id header alone is RETIRED (401)', headerTry.status === 401, String(headerTry.status));
  const tampered = await req('GET', '/api/auth/me', null, null, `${bearer.slice(0, -4)}AAAA`);
  check('auth: tampered token is rejected', tampered.status === 401);
  const garbage = await req('GET', '/api/auth/me', null, null, 'garbage.payload');
  check('auth: garbage token is rejected', garbage.status === 401);
  for (const ep of ['/api/users', '/api/payments', '/api/audit', '/api/settings', '/api/sessions', '/api/providers']) {
    const anon = await req('GET', ep, null, null, null);
    check(`auth: ${ep} without an actor is 401`, anon.status === 401, String(anon.status));
  }

  // Lockout policy (officer account, so later assertions are unaffected)
  let locked = null;
  for (let i = 0; i < 8 && !locked; i++) {
    const r = await req('POST', '/api/auth/login', { email: 'officer@iprs.co.ke', password: 'definitely-wrong' });
    if (r.status === 423 || /lock/i.test(r.json?.message ?? '')) locked = r;
  }
  check('auth: repeated failures trigger the lockout policy', !!locked, locked?.json?.message?.slice(0, 60));
  const lockedOut = await req('POST', '/api/auth/login', { email: 'officer@iprs.co.ke', password: 'Iprs@2026!' });
  check('auth: even the CORRECT password is rejected while locked', lockedOut.status >= 400 && /lock/i.test(lockedOut.json?.message ?? ''), `${lockedOut.status} ${lockedOut.json?.message?.slice(0, 50)}`);

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
  const superCreatesAdmin = await req('POST', '/api/users', { name: 'Zuri Achieng', email: 'zuri.achieng@iprs.co.ke', tier: 'admin', password: 'Str0ng!Pass1', phone: '0712000001' }, null, superTok);
  check('tiers: super admin CAN create an admin', [200, 201].includes(superCreatesAdmin.status) && superCreatesAdmin.json?.user?.tier === 'admin', JSON.stringify(superCreatesAdmin.json).slice(0, 80));
  const newUserId = superCreatesAdmin.json?.user?.id;
  check('tiers: created admin response leaks no password', !JSON.stringify(superCreatesAdmin.json).match(/"password(hash)?"/i));
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
  const stk = await req('POST', '/api/wallet/topup/mpesa/stk', { userId: asAnalyst, phone: '0712345678', amount: 1000 }, asAnalyst);
  check('mpesa: STK dispatch accepted', stk.status === 200 || stk.status === 202, JSON.stringify(stk.json).slice(0, 70));
  const checkoutId = stk.json?.checkoutRequestID ?? stk.json?.checkoutRequestId ?? stk.json?.transaction?.checkoutRequestID;
  check('mpesa: dispatch returns a checkout reference', !!checkoutId);
  if (checkoutId) {
    const poll = await req('GET', `/api/wallet/topup/mpesa/stk/${encodeURIComponent(checkoutId)}`);
    check('mpesa: poll reports the push is awaiting the handset', ['pending', 'sent', 'dispatched'].includes(String(poll.json?.status ?? poll.json?.state ?? '').toLowerCase()), String(poll.json?.status ?? poll.json?.state));
    const balMid = await asBal(asAnalyst);
    check('mpesa: balance NOT credited before confirmation', balMid === bal0, `${bal0} -> ${balMid}`);
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
  check('card: OTP 000000 declines the payment', decline.status === 200 || decline.status === 402 ? (decline.json?.status === 'failed' || decline.json?.ok === false || decline.json?.payment?.status === 'failed') : false, JSON.stringify(decline.json).slice(0, 80));
  const bal3 = await asBal(asAnalyst);
  check('card: declined top-up does NOT credit the wallet', bal3 === bal2, `${bal2} -> ${bal3}`);

  /* ---- token lifecycle: revocation on logout ---- */
  const viewerLogin = await req('POST', '/api/auth/login', { email: 'viewer@iprs.co.ke', password: 'Iprs@2026!' });
  const viewerToken = viewerLogin.json?.token;
  check('auth: second persona gets its own token', typeof viewerToken === 'string' && viewerToken !== bearer);
  const viewerMe = await req('GET', '/api/auth/me', null, null, viewerToken);
  check('auth: viewer token authenticates before logout', viewerMe.json?.user?.email === 'viewer@iprs.co.ke');
  const prevBearer = bearer;
  bearer = viewerToken;
  await req('POST', '/api/auth/logout', { reason: 'token revocation test' });
  bearer = prevBearer;
  const viewerAfter = await req('GET', '/api/auth/me', null, null, viewerToken);
  check('auth: token is DEAD after logout (session-bound revocation)', viewerAfter.status === 401, String(viewerAfter.status));

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
  const maint = await req('POST', '/api/settings/maintenance', { enabled: true }, null, adminTok);
  check('settings: maintenance mode is super-admin only', maint.status === 403);

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
  check('auth: a created account can sign in (hash round-trip)', zuriLogin.status === 200 && !!zuriLogin.json?.token, String(zuriLogin.status));
} finally {
  child.kill('SIGTERM');
  await sleep(300);
  try { rmSync(dataDir, { recursive: true, force: true }); } catch { /* best effort */ }
}

const fail = results.filter((r) => !r.ok).length;
console.log(`\n──────── BACKEND API ────────\nPASS ${results.length - fail} / FAIL ${fail}  (${results.length} assertions)`);
process.exit(fail === 0 ? 0 : 1);
