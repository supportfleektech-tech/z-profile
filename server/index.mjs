/**
 * IPRS Kenya — reference backend scaffold.
 *
 * Express 5 + node:sqlite (Node 22+, zero native deps). The Vite dev server proxies
 * `/api` here; if this process is not running the frontend's service layer falls back
 * to its in-browser mock adapter and the header chip reads LOCAL instead of API.
 *
 *   npm run server      # listen on 0.0.0.0:8787
 *   IPRS_DB=/tmp/x.sqlite npm run server
 *
 * Every mutating route appends to the `audit` table, mirroring what the browser
 * adapter does, so the audit trail is identical whichever transport is live.
 */

import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';

import {
  db, seedIfEmpty, stats, DB_PATH,
  users, findUser, findUserByEmail, putUser, deleteUser,
  wallets, walletFor, walletById, putWallet,
  transactions, putTransaction,
  payments, paymentById, putPayment, paymentMethods,
  providers, providerById, putProvider, providerLogs, putProviderLog,
  apiKeys, putApiKey,
  auditLog, appendAudit,
  sessions, putSession, deleteSession,
  usageRecords, putUsage,
  cases, invoices, notifications, activities,
  settings, saveSettings, pricing, savePricing,
  stkPut, stkGet, stkSetResult, stkSetCancelled, stkDelete,
} from './db.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
const STARTED_AT = new Date().toISOString();

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '2mb' }));

/* -------------------------------------------------------------------------- */
/*                                  utilities                                  */
/* -------------------------------------------------------------------------- */

/**
 * Never let a credential leave the server.
 *
 * The seed stores demo passwords in plaintext (so the login screen can show them),
 * but no API response should ever echo one back — that would leak every account's
 * password to the browser and into any logged response body.
 */
function publicUser(u) {
  if (!u) return u;
  const { password: _password, ...rest } = u;
  return rest;
}
const publicUsers = (list) => (Array.isArray(list) ? list.map(publicUser) : list);

const uid = (p) => `${p}_${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
const now = () => new Date().toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clientIp = (req) =>
  (req.headers['x-forwarded-for']?.split(',')[0] ?? req.socket?.remoteAddress ?? '0.0.0.0').trim();

/** Daraja-style receipt code: 3 letters + 7 alphanumerics. */
const receiptCode = () => {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const N = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 3; i += 1) s += A[crypto.randomInt(A.length)];
  for (let i = 0; i < 7; i += 1) s += N[crypto.randomInt(N.length)];
  return s;
};

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

/** Mirrors `src/lib/format.ts#normalizeMsisdn` exactly — same accepted shapes. */
const normalizeMsisdn = (raw) => {
  const digits = String(raw ?? '').replace(/[^\d]/g, '');
  if (!digits) return null;
  if (digits.startsWith('254') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) return `254${digits}`;
  if (digits.length === 12) return digits;
  return null;
};

const maskMsisdn = (p) => {
  const d = String(p ?? '').replace(/\D/g, '');
  return d.length >= 9 ? `254•••${d.slice(-3)}` : '254•••';
};

const cardBrand = (digits) => {
  const d = String(digits ?? '').replace(/\D/g, '');
  if (/^4/.test(d)) return 'Visa';
  if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return 'Mastercard';
  if (/^3[47]/.test(d)) return 'Amex';
  return 'Card';
};

const luhn = (digits) => {
  const d = String(digits ?? '').replace(/\D/g, '');
  if (d.length < 12) return false;
  let sum = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i -= 1) {
    let n = Number(d[i]);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
};

const maskCard = (digits) => {
  const d = String(digits ?? '').replace(/\D/g, '');
  return d.length >= 4 ? `•••• •••• •••• ${d.slice(-4)}` : '•••• •••• •••• ••••';
};

/** Best-effort actor resolution from a bearer/`x-user-id` header. Demo only. */
function actorOf(req) {
  const id = req.headers['x-user-id'] ?? req.body?.actorId ?? null;
  return id ? findUser(String(id)) : null;
}

const wrap = (fn) => (req, res) => {
  try {
    const out = fn(req, res);
    if (out instanceof Promise) out.catch((e) => fail(res, e));
  } catch (e) {
    fail(res, e);
  }
};

function fail(res, e) {
  const status = e?.status ?? 500;
  console.error(`[api] ${e?.message ?? e}`);
  if (!res.headersSent) res.status(status).json({ ok: false, message: e?.message ?? 'Internal error' });
}

const bad = (res, message, status = 400) => res.status(status).json({ ok: false, message });

/* -------------------------------------------------------------------------- */
/*                              wallet operations                              */
/* -------------------------------------------------------------------------- */

function ensureWallet(userId) {
  let w = walletFor(userId);
  if (w) return w;
  const s = settings();
  w = {
    id: uid('wal'), userId, currency: 'KES', balance: 0, held: 0, lifetimeTopUp: 0, lifetimeSpend: 0,
    autoTopUp: false, autoTopUpTriggerKes: s.billing?.lowBalanceAlertKes ?? 5000, autoTopUpAmountKes: 10000,
    lowBalanceAlertKes: s.billing?.lowBalanceAlertKes ?? 5000, overdraftAllowed: !!s.billing?.overdraftAllowed,
    updatedAt: now(),
  };
  putWallet(w);
  return w;
}

/**
 * Apply a wallet movement and (optionally) the matching payment record in one
 * transaction, exactly as the browser adapter's `creditWallet` does.
 */
function applyWalletMovement({ userId, amount, direction, kind, channel, status, reference, description, gatewayRef, payment, meta }) {
  const wallet = ensureWallet(userId);
  const user = findUser(userId);
  const delta = direction === 'credit' ? amount : -amount;
  const balanceAfter = Math.round((wallet.balance + delta) * 100) / 100;

  const transaction = {
    id: uid('wtx'), walletId: wallet.id, userId, userName: user?.name ?? 'Unknown', at: now(),
    direction, kind, amount, balanceAfter, channel, status, reference, description,
    gatewayRef, meta,
  };

  const nextWallet = {
    ...wallet,
    balance: balanceAfter,
    lifetimeTopUp: kind === 'topup' && status === 'success' ? wallet.lifetimeTopUp + amount : wallet.lifetimeTopUp,
    lifetimeSpend: kind === 'search' ? wallet.lifetimeSpend + amount : wallet.lifetimeSpend,
    updatedAt: transaction.at,
  };

  let paymentRecord = null;
  if (payment) {
    paymentRecord = {
      id: uid('pay'), userId, userName: user?.name ?? 'Unknown', userEmail: user?.email ?? '',
      at: transaction.at, channel: payment.channel ?? channel, method: payment.method ?? channel,
      amount: payment.amount ?? amount, currency: 'KES', status: payment.status ?? status,
      reference: payment.reference ?? reference, gateway: payment.gateway ?? 'IPRS Gateway',
      gatewayRef: payment.gatewayRef ?? gatewayRef, feeKes: payment.feeKes ?? 0,
      netKes: payment.netKes ?? (payment.status === 'success' ? (payment.amount ?? amount) : 0),
      walletTransactionId: transaction.id, rawResponse: payment.rawResponse,
      failureReason: payment.failureReason, ip: payment.ip ?? user?.lastLoginIp ?? '0.0.0.0',
    };
  }

  db.exec('BEGIN');
  try {
    putWallet(nextWallet);
    putTransaction(transaction);
    if (paymentRecord) putPayment(paymentRecord);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return { wallet: nextWallet, transaction, payment: paymentRecord };
}

/* -------------------------------------------------------------------------- */
/*                                    routes                                   */
/* -------------------------------------------------------------------------- */

app.get('/api/health', wrap((_req, res) => {
  res.json({
    ok: true,
    service: 'iprs-demo-api',
    version: '1.0.0',
    uptimeSec: Math.round((Date.now() - new Date(STARTED_AT).getTime()) / 1000),
    startedAt: STARTED_AT,
    node: process.version,
    storage: { engine: 'node:sqlite', path: DB_PATH },
    counts: stats(),
  });
}));

/* ---------------------------------- auth ---------------------------------- */

app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body ?? {};
  await sleep(320);
  const user = findUserByEmail(email ?? '');
  if (!user) return bad(res, 'No account matches that email address.', 401);

  if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
    return res.status(423).json({ ok: false, reason: 'locked', message: `Account locked until ${new Date(user.lockedUntil).toLocaleTimeString('en-KE')}.` });
  }
  if (user.status !== 'Active') {
    return res.status(403).json({ ok: false, reason: 'inactive', message: `This account is ${user.status.toLowerCase()}. Contact your administrator.` });
  }
  if (user.password !== password) {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const s = settings();
    const max = s.security?.lockoutThreshold ?? 5;
    const locked = attempts >= max;
    putUser({
      ...user,
      failedLoginAttempts: locked ? 0 : attempts,
      lockedUntil: locked ? new Date(Date.now() + (s.security?.lockoutDurationMin ?? 15) * 60000).toISOString() : user.lockedUntil,
    });
    appendAudit({
      actorId: user.id, actorName: user.name, actorTier: user.tier, action: 'auth.login.failed',
      entity: 'Session', entityId: user.id, severity: locked ? 'critical' : 'warning', ip: clientIp(req),
      detail: locked ? `Account locked after ${attempts} failed attempts` : `Failed sign-in attempt ${attempts}/${max}`,
    });
    return res.status(401).json({
      ok: false, reason: locked ? 'locked' : 'invalid_credentials',
      message: locked ? `Too many attempts. Locked for ${s.security?.lockoutDurationMin ?? 15} minutes.` : 'Incorrect password.',
    });
  }

  const ip = clientIp(req);
  const requiresMfa = !!user.mfaEnabled;
  const updated = { ...user, failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now(), lastLoginIp: ip };
  putUser(updated);

  putSession({
    id: uid('ses'), userId: updated.id, userName: updated.name, tier: updated.tier, ip,
    device: req.body?.device ?? 'Web client', browser: req.body?.browser ?? 'Chrome',
    location: 'Nairobi, KE', startedAt: now(), lastSeenAt: now(), current: true,
  });

  appendAudit({
    actorId: updated.id, actorName: updated.name, actorTier: updated.tier, action: 'auth.login',
    entity: 'Session', severity: 'success', ip,
    detail: `Signed in as ${updated.tier === 'user' ? `User · ${updated.subRole}` : updated.tier === 'admin' ? 'Admin' : 'Super Admin'}${requiresMfa ? ' (MFA required)' : ''}`,
  });

  res.json({ ok: true, user: publicUser(updated), requiresMfa });
}));

app.post('/api/auth/logout', wrap((req, res) => {
  const actor = actorOf(req);
  if (actor) {
    for (const s of sessions().filter((x) => x.userId === actor.id && x.current)) putSession({ ...s, current: false });
    appendAudit({
      actorId: actor.id, actorName: actor.name, actorTier: actor.tier, action: 'auth.logout',
      entity: 'Session', severity: 'info', ip: clientIp(req), detail: req.body?.reason ?? 'Signed out',
    });
  }
  res.json({ ok: true });
}));

app.get('/api/auth/me', wrap((req, res) => {
  const actor = actorOf(req);
  if (!actor) return bad(res, 'Not authenticated.', 401);
  res.json({ ok: true, user: publicUser(actor) });
}));

/* ---------------------------------- users --------------------------------- */

app.get('/api/users', wrap((_req, res) => res.json(publicUsers(users()))));

app.get('/api/users/:id', wrap((req, res) => {
  const u = findUser(req.params.id);
  if (!u) return bad(res, 'Account not found.', 404);
  res.json(publicUser(u));
}));

/**
 * Account creation. Enforces the platform's hard rules:
 *  - super_admin can NEVER be created through the API (system-seeded only)
 *  - admin can only be created by a super_admin
 */
app.post('/api/users', wrap(async (req, res) => {
  const actor = actorOf(req);
  const input = req.body ?? {};
  if (!actor) return bad(res, 'Not authenticated.', 401);
  if (input.tier === 'super_admin') {
    return res.status(403).json({ ok: false, message: 'Super Admin accounts are seeded by the system and cannot be created from the UI.' });
  }
  if (input.tier === 'admin' && actor.tier !== 'super_admin') {
    return res.status(403).json({ ok: false, message: 'Only a Super Admin can create Admin accounts.' });
  }
  if (actor.tier === 'user') return res.status(403).json({ ok: false, message: 'You do not have permission to create accounts.' });
  if (!input.name?.trim() || !input.email?.trim()) return bad(res, 'Name and email are required.');
  if (findUserByEmail(input.email)) return bad(res, 'An account with that email already exists.', 409);

  await sleep(220);
  const s = settings();
  const walletId = uid('wal');
  const user = {
    id: uid('usr'), name: input.name.trim(), email: input.email.trim().toLowerCase(),
    password: input.password || 'ChangeMe@123', phone: input.phone ?? '', department: input.department ?? '',
    jobTitle: input.jobTitle ?? '', tier: input.tier ?? 'user', subRole: input.subRole ?? 'analyst',
    status: 'Active', isSystem: false,
    mfaEnabled: (s.security?.mfaRequiredFor ?? []).includes(input.tier ?? 'user'),
    createdAt: now(), failedLoginAttempts: 0, lockedUntil: null, walletId,
  };
  putUser(user);
  putWallet({
    id: walletId, userId: user.id, currency: 'KES', balance: 0, held: 0, lifetimeTopUp: 0, lifetimeSpend: 0,
    autoTopUp: false, autoTopUpTriggerKes: s.billing?.lowBalanceAlertKes ?? 5000, autoTopUpAmountKes: 10000,
    lowBalanceAlertKes: s.billing?.lowBalanceAlertKes ?? 5000, overdraftAllowed: !!s.billing?.overdraftAllowed,
    updatedAt: now(),
  });
  appendAudit({
    actorId: actor.id, actorName: actor.name, actorTier: actor.tier, action: 'user.created',
    entity: 'SystemUser', entityId: user.id, severity: 'critical', ip: clientIp(req),
    detail: `Created ${user.name} <${user.email}> as ${user.tier === 'admin' ? 'Admin' : `User · ${user.subRole}`}`,
  });
  res.status(201).json({ ok: true, user: publicUser(user) });
}));

app.patch('/api/users/:id', wrap((req, res) => {
  const actor = actorOf(req);
  const target = findUser(req.params.id);
  if (!actor) return bad(res, 'Not authenticated.', 401);
  if (!target) return bad(res, 'Account not found.', 404);
  if (target.isSystem && actor.id !== target.id) {
    return res.status(403).json({ ok: false, message: 'The Super Admin account is seeded by the system and is immutable.' });
  }
  const patch = req.body ?? {};
  // Guard the invariants even if a client tries to bypass the UI.
  if (patch.tier === 'super_admin' && !target.isSystem) {
    return res.status(403).json({ ok: false, message: 'Accounts cannot be promoted to Super Admin.' });
  }
  if (patch.tier === 'admin' && actor.tier !== 'super_admin') {
    return res.status(403).json({ ok: false, message: 'Only a Super Admin can grant the Admin tier.' });
  }
  if (target.isSystem) delete patch.tier;

  const changes = Object.keys(patch).filter((k) => JSON.stringify(patch[k]) !== JSON.stringify(target[k]));
  const next = { ...target, ...patch, id: target.id, isSystem: target.isSystem, createdAt: target.createdAt };
  putUser(next);

  if (next.walletId) {
    const w = walletById(next.walletId);
    if (w) putWallet({ ...w, userId: next.id });
  }

  appendAudit({
    actorId: actor.id, actorName: actor.name, actorTier: actor.tier, action: actor.id === target.id ? 'user.self.updated' : 'user.updated',
    entity: 'SystemUser', entityId: target.id,
    severity: changes.some((c) => ['tier', 'status', 'permissionOverrides', 'mfaEnabled'].includes(c)) ? 'critical' : 'info',
    ip: clientIp(req), detail: `${target.name}: ${changes.length ? changes.join(', ') : 'no effective change'}`,
  });
  res.json({ ok: true, user: publicUser(next), message: 'Account updated.' });
}));

app.delete('/api/users/:id', wrap((req, res) => {
  const actor = actorOf(req);
  const target = findUser(req.params.id);
  if (!actor) return bad(res, 'Not authenticated.', 401);
  if (!target) return bad(res, 'Account not found.', 404);
  if (target.isSystem) return res.status(403).json({ ok: false, message: 'Seeded system accounts cannot be deleted.' });
  if (target.id === actor.id) return bad(res, 'You cannot deactivate your own account.');
  if (target.tier === 'admin' && actor.tier !== 'super_admin') {
    return res.status(403).json({ ok: false, message: 'Only a Super Admin can remove an Admin account.' });
  }
  deleteUser(target.id);
  appendAudit({
    actorId: actor.id, actorName: actor.name, actorTier: actor.tier, action: 'user.deleted',
    entity: 'SystemUser', entityId: target.id, severity: 'critical', ip: clientIp(req),
    detail: `Deleted ${target.name} <${target.email}>`,
  });
  res.json({ ok: true, message: `${target.name} removed.` });
}));

app.post('/api/users/:id/reset-password', wrap((req, res) => {
  const actor = actorOf(req);
  const target = findUser(req.params.id);
  if (!actor) return bad(res, 'Not authenticated.', 401);
  if (!target) return bad(res, 'Account not found.', 404);
  const temp = `Iprs@${crypto.randomInt(1000, 9999)}`;
  putUser({ ...target, password: temp, failedLoginAttempts: 0, lockedUntil: null });
  appendAudit({
    actorId: actor.id, actorName: actor.name, actorTier: actor.tier, action: 'user.password.reset',
    entity: 'SystemUser', entityId: target.id, severity: 'critical', ip: clientIp(req),
    detail: `Reset password for ${target.name} <${target.email}>`,
  });
  res.json({ ok: true, tempPassword: temp, message: `Temporary password issued for ${target.name}.` });
}));

/* --------------------------------- wallet --------------------------------- */

app.get('/api/wallet', wrap((req, res) => {
  const userId = req.query.userId ? String(req.query.userId) : null;
  res.json(userId ? (walletFor(userId) ?? ensureWallet(userId)) : wallets());
}));

app.get('/api/wallet/transactions', wrap((req, res) => {
  const userId = req.query.userId ? String(req.query.userId) : null;
  const limit = Math.min(Number(req.query.limit ?? 200), 1000);
  res.json(transactions(userId, limit));
}));

app.patch('/api/wallet/:id', wrap((req, res) => {
  const actor = actorOf(req);
  const w = walletById(req.params.id) ?? walletFor(req.params.id);
  if (!w) return bad(res, 'Wallet not found.', 404);
  const patch = req.body ?? {};
  const next = { ...w, ...patch, id: w.id, userId: w.userId, updatedAt: now() };
  putWallet(next);
  appendAudit({
    actorId: actor?.id ?? w.userId, actorName: actor?.name ?? 'System', actorTier: actor?.tier ?? 'user',
    action: 'wallet.settings.updated', entity: 'Wallet', entityId: w.id, severity: 'info',
    ip: clientIp(req), detail: `Wallet settings updated: ${Object.keys(patch).join(', ')}`,
  });
  res.json(next);
}));

/* ---------------------------- M-PESA STK (Daraja) --------------------------- */

app.post('/api/wallet/topup/mpesa/stk', wrap(async (req, res) => {
  const { userId, phone, amount } = req.body ?? {};
  const s = settings();
  const msisdn = normalizeMsisdn(phone);
  if (!msisdn) return bad(res, 'Enter a valid Safaricom number, e.g. 0712 345 678.');
  const value = Math.round(Number(amount));
  if (!Number.isFinite(value) || value <= 0) return bad(res, 'Enter an amount greater than zero.');
  const min = s.billing?.walletMinTopUpKes ?? 100;
  const max = s.billing?.walletMaxTopUpKes ?? 200000;
  if (value < min) return bad(res, `Minimum top-up is KES ${min.toLocaleString('en-KE')}.`);
  if (value > max) return bad(res, `Maximum top-up is KES ${max.toLocaleString('en-KE')}.`);
  if (!findUser(userId)) return bad(res, 'Unknown wallet holder.', 404);

  await sleep(700); // modelled OAuth token fetch + STK dispatch

  const checkoutRequestID = `ws_CO_${stamp()}_${crypto.randomInt(1000, 9999)}`;
  const merchantRequestID = `29115-${crypto.randomInt(1000000, 9999999)}-${crypto.randomInt(0, 9)}`;

  // Modelled handset outcome, resolved when the client polls /stk/:id or the
  // Daraja callback route posts the result.
  const roll = Math.random();
  let ResultCode = 0;
  let ResultDesc = 'The service request is processed successfully.';
  if (value > 70000 && roll < 0.35) { ResultCode = 2001; ResultDesc = 'Insufficient funds in the customer wallet.'; }
  else if (roll > 0.94) { ResultCode = 1037; ResultDesc = 'DS timeout — the customer could not be reached.'; }
  else if (roll > 0.88) { ResultCode = 1032; ResultDesc = 'Request cancelled by the customer on the handset.'; }

  stkPut({
    checkoutRequestID, merchantRequestID, userId, phone: msisdn, amount: value,
    startedAt: Date.now(), settleAfter: Date.now() + 7000 + crypto.randomInt(0, 2500),
    cancelled: false, result: null,
  });
  stkSetResult(checkoutRequestID, {
    MerchantRequestID: merchantRequestID, CheckoutRequestID: checkoutRequestID, ResultCode, ResultDesc,
    MpesaReceiptNumber: ResultCode === 0 ? receiptCode() : undefined,
    TransactionDate: ResultCode === 0 ? stamp() : undefined,
    PhoneNumber: msisdn, Amount: value,
  });

  appendAudit({
    actorId: userId, actorName: findUser(userId)?.name ?? 'System', actorTier: findUser(userId)?.tier ?? 'user',
    action: 'wallet.topup.initiated', entity: 'Wallet', entityId: walletFor(userId)?.id ?? null,
    severity: 'info', ip: clientIp(req),
    detail: `M-PESA STK dispatched to ${maskMsisdn(msisdn)} for KES ${value.toLocaleString('en-KE')} (${checkoutRequestID})`,
  });

  res.json({ ok: true, checkoutRequestID, merchantRequestID, phone: msisdn, amount: value });
}));

/** Poll the handset outcome. Returns `pending` until the modelled settle time passes. */
app.get('/api/wallet/topup/mpesa/stk/:checkoutRequestID', wrap((req, res) => {
  const p = stkGet(req.params.checkoutRequestID);
  if (!p) return bad(res, 'No pending STK request found for that checkout reference.', 404);
  if (!p.result) return res.json({ ok: true, status: 'pending', checkoutRequestID: p.checkoutRequestID });
  if (Date.now() < p.settleAfter && !p.cancelled) {
    return res.json({ ok: true, status: 'pending', checkoutRequestID: p.checkoutRequestID });
  }
  res.json({ ok: true, status: 'settled', checkoutRequestID: p.checkoutRequestID, result: p.result });
}));

/** Daraja callback shape — what a real Safaricom webhook would POST. */
app.post('/api/wallet/topup/mpesa/callback', wrap((req, res) => {
  const body = req.body?.Body?.stkCallback ?? req.body ?? {};
  const id = body.CheckoutRequestID;
  const p = id ? stkGet(id) : null;
  if (!p) return bad(res, 'Unknown checkout request.', 404);
  const result = {
    MerchantRequestID: body.MerchantRequestID ?? p.merchantRequestID,
    CheckoutRequestID: id,
    ResultCode: Number(body.ResultCode ?? 0),
    ResultDesc: body.ResultDesc ?? 'Accepted',
    MpesaReceiptNumber: body.CallbackMetadata?.Item?.find?.((i) => i.Name === 'MpesaReceiptNumber')?.Value ?? body.MpesaReceiptNumber,
    PhoneNumber: p.phone,
    Amount: p.amount,
  };
  stkSetResult(id, result);
  res.json({ ok: true, result });
}));

/** Settle a dispatched STK into the wallet. */
app.post('/api/wallet/topup/mpesa/confirm', wrap((req, res) => {
  const id = String(req.body?.checkoutRequestID ?? '');
  const actor = actorOf(req);
  const p = stkGet(id);
  if (!p) return bad(res, 'No pending STK request found for that checkout reference.', 404);
  const result = p.result ?? {
    MerchantRequestID: p.merchantRequestID, CheckoutRequestID: id, ResultCode: 1037,
    ResultDesc: 'DS timeout — the customer could not be reached.', PhoneNumber: p.phone, Amount: p.amount,
  };
  const success = Number(result.ResultCode) === 0;
  const reference = result.MpesaReceiptNumber ? `MPESA-${result.MpesaReceiptNumber}` : `MPESA-${id.slice(-8)}`;
  const status = success ? 'success' : Number(result.ResultCode) === 1032 ? 'cancelled' : Number(result.ResultCode) === 1037 ? 'timeout' : 'failed';
  const user = findUser(p.userId);

  const { transaction, payment } = applyWalletMovement({
    userId: p.userId, amount: result.Amount ?? p.amount, direction: 'credit', kind: 'topup', channel: 'mpesa',
    status, reference,
    description: success ? `M-PESA STK Push top-up — ${maskMsisdn(result.PhoneNumber)}` : `M-PESA STK Push failed — ${result.ResultDesc}`,
    gatewayRef: result.MpesaReceiptNumber ?? id,
    payment: {
      channel: 'mpesa', method: `STK Push — ${maskMsisdn(result.PhoneNumber)}`, amount: result.Amount ?? p.amount,
      status, reference, gateway: 'Safaricom Daraja', gatewayRef: result.MpesaReceiptNumber, feeKes: 0,
      netKes: success ? (result.Amount ?? p.amount) : 0, rawResponse: result,
      failureReason: success ? undefined : result.ResultDesc, ip: user?.lastLoginIp ?? clientIp(req),
    },
  });

  appendAudit({
    actorId: actor?.id ?? p.userId, actorName: actor?.name ?? user?.name ?? 'System',
    actorTier: actor?.tier ?? user?.tier ?? 'user',
    action: success ? 'wallet.topup.success' : 'wallet.topup.failed', entity: 'Wallet', entityId: transaction.walletId,
    severity: success ? 'success' : 'warning', ip: clientIp(req),
    detail: success
      ? `KES ${Number(result.Amount).toLocaleString('en-KE')} credited via M-PESA receipt ${result.MpesaReceiptNumber}`
      : `M-PESA STK failed (${result.ResultCode}) — ${result.ResultDesc}`,
  });

  stkDelete(id);
  res.json({
    ok: success, status: success ? 'success' : 'failed',
    message: success
      ? `KES ${Number(result.Amount).toLocaleString('en-KE')} credited. Receipt ${result.MpesaReceiptNumber}.`
      : `${result.ResultDesc} (ResultCode ${result.ResultCode})`,
    payment, transaction, raw: result,
  });
}));

app.post('/api/wallet/topup/mpesa/cancel', wrap((req, res) => {
  const id = String(req.body?.checkoutRequestID ?? '');
  const p = stkGet(id);
  if (!p) return bad(res, 'No pending STK request found.', 404);
  stkSetCancelled(id);
  stkSetResult(id, {
    MerchantRequestID: p.merchantRequestID, CheckoutRequestID: id, ResultCode: 1032,
    ResultDesc: 'Request cancelled by user', PhoneNumber: p.phone, Amount: p.amount,
  });
  res.json({ ok: true, cancelled: true });
}));

/* ---------------------------------- card ---------------------------------- */

app.post('/api/wallet/topup/card', wrap(async (req, res) => {
  const { userId, amount, cardNumber, expiry, cvc, holder } = req.body ?? {};
  const s = settings();
  const digits = String(cardNumber ?? '').replace(/\s/g, '');
  if (!luhn(digits)) return bad(res, 'That card number failed validation. Check the digits.');
  if (!/^\d{2}\/\d{2}$/.test(String(expiry ?? ''))) return bad(res, 'Expiry must be in MM/YY format.');
  const [mm, yy] = String(expiry).split('/').map(Number);
  if (mm < 1 || mm > 12) return bad(res, 'Expiry month is invalid.');
  if (new Date(2000 + yy, mm, 0, 23, 59, 59).getTime() < Date.now()) return bad(res, 'That card has expired.');
  if (!/^\d{3,4}$/.test(String(cvc ?? ''))) return bad(res, 'CVC must be 3 or 4 digits.');
  if (!String(holder ?? '').trim()) return bad(res, 'Cardholder name is required.');
  const value = Math.round(Number(amount));
  const min = s.billing?.walletMinTopUpKes ?? 100;
  const max = s.billing?.walletMaxTopUpKes ?? 200000;
  if (value < min) return bad(res, `Minimum top-up is KES ${min.toLocaleString('en-KE')}.`);
  if (value > max) return bad(res, `Maximum top-up is KES ${max.toLocaleString('en-KE')}.`);
  if (!findUser(userId)) return bad(res, 'Unknown wallet holder.', 404);

  await sleep(900);
  const paymentIntentId = `PI-${crypto.randomInt(1000000, 9999999)}`;
  stkPut({
    checkoutRequestID: paymentIntentId, merchantRequestID: `card_${Date.now()}`, userId,
    phone: holder, amount: value, startedAt: Date.now(), settleAfter: Date.now() + 120000,
    cancelled: false, result: null,
  });
  appendAudit({
    actorId: userId, actorName: findUser(userId)?.name ?? 'System', actorTier: findUser(userId)?.tier ?? 'user',
    action: 'wallet.topup.initiated', entity: 'Wallet', entityId: walletFor(userId)?.id ?? null, severity: 'info',
    ip: clientIp(req), detail: `Card intent ${paymentIntentId} created for KES ${value.toLocaleString('en-KE')} (${maskCard(digits)})`,
  });
  res.json({ ok: true, paymentIntentId, requires3ds: true, brand: cardBrand(digits) });
}));

app.post('/api/wallet/topup/card/confirm', wrap(async (req, res) => {
  const { userId, paymentIntentId, otp, amount, cardNumber, holder, expiry } = req.body ?? {};
  const actor = actorOf(req);
  const digits = String(cardNumber ?? '').replace(/\D/g, '');
  const brand = cardBrand(digits);
  const value = Math.round(Number(amount));
  const code = String(otp ?? '').trim();
  const declined = code === '000000' || code.length !== 6;
  const reference = `CARD-${paymentIntentId}`;
  const fee = Math.round(value * 0.029);
  const user = findUser(userId);
  await sleep(900);

  const raw = {
    intent: paymentIntentId, brand, maskedPan: maskCard(digits), holder: holder ?? '', expiry: expiry ?? '',
    authCode: declined ? null : `AUTH${crypto.randomInt(100000, 999999)}`,
    threeDs: declined ? 'failed' : 'authenticated', declineCode: declined ? 'incorrect_otp' : null,
    processedAt: now(), acquirer: 'IPRS Acquiring (sandbox)', feeKes: fee,
  };
  const status = declined ? 'failed' : 'success';

  const { transaction, payment } = applyWalletMovement({
    userId, amount: value, direction: 'credit', kind: 'topup', channel: 'card', status, reference,
    description: declined ? `Card top-up declined — ${brand} ${maskCard(digits)}` : `Card top-up — ${brand} ${maskCard(digits)}`,
    gatewayRef: raw.authCode ?? paymentIntentId,
    payment: {
      channel: 'card', method: `${brand} ${maskCard(digits)}`, amount: value, status, reference,
      gateway: 'IPRS Card Acquirer', gatewayRef: raw.authCode ?? undefined, feeKes: declined ? 0 : fee,
      netKes: declined ? 0 : value - fee, rawResponse: raw,
      failureReason: declined ? '3-D Secure authentication failed (OTP 000000 or malformed).' : undefined,
      ip: user?.lastLoginIp ?? clientIp(req),
    },
  });

  appendAudit({
    actorId: actor?.id ?? userId, actorName: actor?.name ?? user?.name ?? 'System', actorTier: actor?.tier ?? user?.tier ?? 'user',
    action: declined ? 'wallet.topup.failed' : 'wallet.topup.success', entity: 'Wallet', entityId: transaction.walletId,
    severity: declined ? 'warning' : 'success', ip: clientIp(req),
    detail: declined
      ? `Card top-up declined for KES ${value.toLocaleString('en-KE')} (${brand} ${maskCard(digits)})`
      : `KES ${value.toLocaleString('en-KE')} credited via ${brand} ${maskCard(digits)} (fee KES ${fee.toLocaleString('en-KE')})`,
  });
  stkDelete(String(paymentIntentId));

  res.json({
    ok: !declined, status,
    message: declined
      ? 'Card declined — 3-D Secure authentication failed. No funds were captured.'
      : `KES ${value.toLocaleString('en-KE')} credited. Authorisation ${raw.authCode}.`,
    payment, transaction, raw,
  });
}));

/* -------------------------------- payments -------------------------------- */

app.get('/api/payments', wrap((req, res) => {
  const q = req.query;
  res.json(payments({
    userId: q.userId ? String(q.userId) : undefined,
    status: q.status ? String(q.status) : undefined,
    channel: q.channel ? String(q.channel) : undefined,
    from: q.from ? String(q.from) : undefined,
    to: q.to ? String(q.to) : undefined,
    limit: Math.min(Number(q.limit ?? 1000), 5000),
  }));
}));

app.get('/api/payments/stats', wrap((_req, res) => {
  const all = payments({ limit: 5000 });
  const gross = all.filter((p) => p.status === 'success').reduce((a, p) => a + p.amount, 0);
  const fees = all.filter((p) => p.status === 'success').reduce((a, p) => a + (p.feeKes ?? 0), 0);
  res.json({
    gross, net: gross - fees, fees,
    successful: all.filter((p) => p.status === 'success').length,
    failed: all.filter((p) => p.status === 'failed' || p.status === 'timeout').length,
    pending: all.filter((p) => p.status === 'pending' || p.status === 'processing').length,
    refunded: all.filter((p) => p.status === 'refunded').length,
    total: all.length,
    walletFloat: wallets().reduce((a, w) => a + w.balance, 0),
    byChannel: ['mpesa', 'card', 'bank', 'wallet'].map((channel) => ({
      channel,
      count: all.filter((p) => p.channel === channel).length,
      amount: all.filter((p) => p.channel === channel && p.status === 'success').reduce((a, p) => a + p.amount, 0),
    })),
  });
}));

app.get('/api/payments/:id', wrap((req, res) => {
  const p = paymentById(req.params.id);
  if (!p) return bad(res, 'Payment not found.', 404);
  res.json(p);
}));

app.post('/api/payments/:id/refund', wrap((req, res) => {
  const actor = actorOf(req);
  const p = paymentById(req.params.id);
  if (!p) return bad(res, 'Payment not found.', 404);
  if (p.status === 'refunded') return bad(res, 'That payment has already been refunded.', 409);
  if (p.status !== 'success') return bad(res, `Only successful payments can be refunded (this one is ${p.status}).`, 409);

  const reason = String(req.body?.reason ?? '').trim() || 'Administrative refund';
  const refunded = { ...p, status: 'refunded', refundedAt: now(), refundedBy: actor?.name ?? 'System' };

  const { transaction } = applyWalletMovement({
    userId: p.userId, amount: p.amount, direction: 'debit', kind: 'refund', channel: p.channel,
    status: 'success', reference: `REFUND-${p.reference}`,
    description: `Reversal of ${p.reference} — ${reason}`, gatewayRef: p.gatewayRef,
  });

  putPayment({ ...refunded, walletTransactionId: transaction.id });
  appendAudit({
    actorId: actor?.id ?? 'system', actorName: actor?.name ?? 'System', actorTier: actor?.tier ?? 'admin',
    action: 'payment.refunded', entity: 'Payment', entityId: p.id, severity: 'critical', ip: clientIp(req),
    detail: `Refunded KES ${p.amount.toLocaleString('en-KE')} (${p.reference}) — ${reason}`,
  });
  res.json({ ok: true, payment: refunded, transaction, message: `Refunded KES ${p.amount.toLocaleString('en-KE')}.` });
}));

app.post('/api/payments/:id/retry', wrap(async (req, res) => {
  const actor = actorOf(req);
  const p = paymentById(req.params.id);
  if (!p) return bad(res, 'Payment not found.', 404);
  if (p.status === 'success') return bad(res, 'That payment already succeeded.', 409);
  await sleep(600);
  const succeeds = Math.random() > 0.25;
  const retry = {
    ...p, status: succeeds ? 'success' : 'failed', at: now(),
    netKes: succeeds ? p.amount - (p.feeKes ?? 0) : 0,
    failureReason: succeeds ? undefined : `Retry failed — ${p.failureReason ?? 'gateway declined'}`,
    gatewayRef: succeeds ? (p.gatewayRef ?? receiptCode()) : p.gatewayRef,
    rawResponse: { ...(p.rawResponse ?? {}), retriedAt: now(), retryAttempt: ((p.rawResponse?.retryAttempt ?? 0) + 1) },
  };
  putPayment(retry);
  if (succeeds) {
    applyWalletMovement({
      userId: p.userId, amount: p.amount, direction: 'credit', kind: 'topup', channel: p.channel,
      status: 'success', reference: p.reference, description: `Retry of ${p.reference} succeeded`, gatewayRef: retry.gatewayRef,
    });
  }
  appendAudit({
    actorId: actor?.id ?? 'system', actorName: actor?.name ?? 'System', actorTier: actor?.tier ?? 'admin',
    action: 'payment.retried', entity: 'Payment', entityId: p.id, severity: succeeds ? 'success' : 'warning',
    ip: clientIp(req), detail: `Retry of ${p.reference} ${succeeds ? 'succeeded' : 'failed again'}`,
  });
  res.json({ ok: succeeds, payment: retry, message: succeeds ? 'Retry succeeded and the wallet was credited.' : 'Retry failed again.' });
}));

app.get('/api/payment-methods', wrap((_req, res) => res.json(paymentMethods())));

/* -------------------------------- providers ------------------------------- */

app.get('/api/providers', wrap((_req, res) => res.json(providers())));

app.get('/api/providers/:id', wrap((req, res) => {
  const p = providerById(req.params.id);
  if (!p) return bad(res, 'Provider not found.', 404);
  res.json(p);
}));

app.patch('/api/providers/:id', wrap((req, res) => {
  const actor = actorOf(req);
  const current = providerById(req.params.id);
  if (!current) return bad(res, 'Provider not found.', 404);
  const patch = req.body ?? {};
  const changes = Object.keys(patch).filter((k) => JSON.stringify(patch[k]) !== JSON.stringify(current[k]));
  const next = { ...current, ...patch, id: current.id };
  putProvider(next);
  appendAudit({
    actorId: actor?.id ?? 'system', actorName: actor?.name ?? 'System', actorTier: actor?.tier ?? 'admin',
    action: 'provider.config.updated', entity: 'ProviderConfig', entityId: current.id,
    severity: changes.includes('consumerSecret') || changes.includes('consumerKey') ? 'critical' : 'info',
    ip: clientIp(req), detail: `${current.name}: ${changes.length ? changes.join(', ') : 'no effective change'}`,
  });
  res.json({ ok: true, provider: next, message: `${current.name} configuration saved.` });
}));

/** Multi-stage gateway handshake modelled on a real provider test. */
app.post('/api/providers/:id/test', wrap(async (req, res) => {
  const actor = actorOf(req);
  const p = providerById(req.params.id);
  if (!p) return bad(res, 'Provider not found.', 404);

  const stages = [
    { name: 'DNS resolution', ms: 12 + crypto.randomInt(0, 20) },
    { name: 'TLS handshake', ms: 40 + crypto.randomInt(0, 60) },
    { name: 'OAuth token exchange', ms: 90 + crypto.randomInt(0, 140) },
    { name: 'Schema probe', ms: 60 + crypto.randomInt(0, 90) },
    { name: 'Rate-limit check', ms: 20 + crypto.randomInt(0, 30) },
  ];
  const results = [];
  for (const s of stages) {
    await sleep(Math.min(s.ms, 220));
    const ok = Math.random() > (p.enabled ? 0.03 : 0.5);
    results.push({ ...s, ok, detail: ok ? 'passed' : p.enabled ? 'gateway refused the probe' : 'provider is disabled' });
    if (!ok) break;
  }
  const passed = results.every((r) => r.ok);
  const latency = results.reduce((a, r) => a + r.ms, 0);

  const next = { ...p, lastTestAt: now(), lastTestResult: passed ? 'pass' : 'fail', latencyMs: latency, status: passed ? 'Active' : 'Degraded' };
  putProvider(next);

  putProviderLog({
    id: uid('plog'), providerId: p.id, providerName: p.name, at: next.lastTestAt, endpoint: `${p.method} ${p.baseUrl}${p.endpointPath}`,
    status: passed ? 'success' : 'error', latencyMs: latency, checkType: 'connectivity-test',
    request: { test: true, actor: actor?.name ?? 'system' },
    response: { stages: results, passed },
    costKes: 0, userId: actor?.id ?? 'system', userName: actor?.name ?? 'System',
  });

  appendAudit({
    actorId: actor?.id ?? 'system', actorName: actor?.name ?? 'System', actorTier: actor?.tier ?? 'admin',
    action: 'provider.test', entity: 'ProviderConfig', entityId: p.id, severity: passed ? 'success' : 'warning',
    ip: clientIp(req), detail: `${p.name} connectivity test ${passed ? 'passed' : 'FAILED'} in ${latency}ms`,
  });

  res.json({ ok: passed, stages: results, latencyMs: latency, testedAt: next.lastTestAt, provider: next });
}));

app.get('/api/providers/:id/logs', wrap((req, res) => {
  res.json(providerLogs(req.params.id, Math.min(Number(req.query.limit ?? 200), 1000)));
}));

app.get('/api/provider-logs', wrap((req, res) => {
  res.json(providerLogs(null, Math.min(Number(req.query.limit ?? 200), 1000)));
}));

app.get('/api/api-keys', wrap((_req, res) => res.json(apiKeys())));

app.post('/api/api-keys/:id/revoke', wrap((req, res) => {
  const actor = actorOf(req);
  const key = apiKeys().find((k) => k.id === req.params.id);
  if (!key) return bad(res, 'API key not found.', 404);
  const next = { ...key, status: 'revoked' };
  putApiKey(next);
  appendAudit({
    actorId: actor?.id ?? 'system', actorName: actor?.name ?? 'System', actorTier: actor?.tier ?? 'admin',
    action: 'apikey.revoked', entity: 'ApiKey', entityId: key.id, severity: 'critical', ip: clientIp(req),
    detail: `Revoked API key ${key.label} (${key.prefix}…)`,
  });
  res.json({ ok: true, key: next });
}));

/* -------------------------------- settings -------------------------------- */

app.get('/api/settings', wrap((_req, res) => res.json(settings())));

app.patch('/api/settings/:group', wrap((req, res) => {
  const actor = actorOf(req);
  const group = req.params.group;
  const current = settings();
  if (!current || !(group in current)) return bad(res, `Unknown settings group: ${group}`, 404);
  const before = current[group];
  const patch = req.body ?? {};
  const changed = Object.keys(patch).filter((k) => JSON.stringify(patch[k]) !== JSON.stringify(before?.[k]));
  const next = { ...current, [group]: { ...before, ...patch } };
  saveSettings(next);
  appendAudit({
    actorId: actor?.id ?? 'system', actorName: actor?.name ?? 'System', actorTier: actor?.tier ?? 'admin',
    action: `settings.${group}.updated`, entity: 'SystemSettings', entityId: group,
    severity: ['security', 'compliance', 'platform'].includes(group) ? 'critical' : 'info',
    ip: clientIp(req), detail: changed.length ? `${group}: ${changed.join(', ')}` : `${group}: no effective change`,
  });
  res.json({ ok: true, settings: next, message: `${group} saved.` });
}));

app.post('/api/settings/maintenance', wrap((req, res) => {
  const actor = actorOf(req);
  if (actor && actor.tier !== 'super_admin') {
    return res.status(403).json({ ok: false, message: 'Only a Super Admin can toggle maintenance mode.' });
  }
  const current = settings();
  const enabled = !!req.body?.enabled;
  const next = {
    ...current,
    platform: {
      ...current.platform,
      maintenanceMode: enabled,
      ...(req.body?.message !== undefined ? { maintenanceMessage: req.body.message } : {}),
    },
  };
  saveSettings(next);
  appendAudit({
    actorId: actor?.id ?? 'system', actorName: actor?.name ?? 'System', actorTier: actor?.tier ?? 'super_admin',
    action: 'platform.maintenance.toggled', entity: 'SystemSettings', entityId: 'platform',
    severity: 'critical', ip: clientIp(req), detail: enabled ? 'Maintenance mode ENABLED' : 'Maintenance mode disabled',
  });
  res.json({ ok: true, settings: next });
}));

app.post('/api/settings/import', wrap((req, res) => {
  const actor = actorOf(req);
  const incoming = req.body?.settings ?? req.body;
  if (!incoming || typeof incoming !== 'object') return bad(res, 'No configuration payload supplied.');
  const current = settings();
  const next = { ...current };
  for (const [group, values] of Object.entries(incoming)) {
    if (group in next && values && typeof values === 'object') next[group] = { ...next[group], ...values };
  }
  saveSettings(next);
  appendAudit({
    actorId: actor?.id ?? 'system', actorName: actor?.name ?? 'System', actorTier: actor?.tier ?? 'super_admin',
    action: 'settings.imported', entity: 'SystemSettings', severity: 'critical', ip: clientIp(req),
    detail: `Imported configuration for ${Object.keys(incoming).join(', ')}`,
  });
  res.json({ ok: true, settings: next });
}));

/* --------------------------------- pricing -------------------------------- */

app.get('/api/pricing', wrap((_req, res) => res.json(pricing())));

app.patch('/api/pricing', wrap((req, res) => {
  const actor = actorOf(req);
  const current = pricing();
  const patch = req.body ?? {};
  const next = { ...current, ...patch };
  if (patch.items) next.items = patch.items;
  savePricing(next);
  appendAudit({
    actorId: actor?.id ?? 'system', actorName: actor?.name ?? 'System', actorTier: actor?.tier ?? 'admin',
    action: 'pricing.updated', entity: 'PricingCatalog', severity: 'warning', ip: clientIp(req),
    detail: `Pricing updated: ${Object.keys(patch).join(', ') || 'no fields'}`,
  });
  res.json({ ok: true, pricing: next });
}));

/* ------------------------------ audit/sessions ---------------------------- */

app.get('/api/audit', wrap((req, res) => {
  const q = req.query;
  res.json(auditLog({
    severity: q.severity ? String(q.severity) : undefined,
    actorTier: q.actorTier ? String(q.actorTier) : undefined,
    action: q.action ? String(q.action) : undefined,
    from: q.from ? String(q.from) : undefined,
    q: q.q ? String(q.q) : undefined,
    limit: Math.min(Number(q.limit ?? 500), 5000),
  }));
}));

app.get('/api/sessions', wrap((_req, res) => res.json(sessions())));

app.delete('/api/sessions/:id', wrap((req, res) => {
  const actor = actorOf(req);
  const target = sessions().find((s) => s.id === req.params.id);
  if (!target) return bad(res, 'Session not found.', 404);
  deleteSession(target.id);
  appendAudit({
    actorId: actor?.id ?? 'system', actorName: actor?.name ?? 'System', actorTier: actor?.tier ?? 'admin',
    action: 'session.revoked', entity: 'Session', entityId: target.id, severity: 'warning', ip: clientIp(req),
    detail: `Revoked session for ${target.userName} (${target.device} · ${target.ip})`,
  });
  res.json({ ok: true, message: `Session for ${target.userName} revoked.` });
}));

/* ---------------------------------- usage --------------------------------- */

app.get('/api/usage', wrap((req, res) => res.json(usageRecords(Math.min(Number(req.query.limit ?? 500), 5000)))));

app.post('/api/usage', wrap((req, res) => {
  const u = req.body ?? {};
  const record = {
    id: uid('use'), at: now(), userId: u.userId ?? 'system', userName: u.userName ?? 'System',
    providerId: u.providerId ?? '', providerName: u.providerName ?? '', checkType: u.checkType ?? '',
    costKes: Number(u.costKes ?? 0), status: u.status ?? 'success', latencyMs: Number(u.latencyMs ?? 0),
    subjectRef: u.subjectRef ?? '',
  };
  putUsage(record);
  res.status(201).json(record);
}));

/* --------------------------- operational entities -------------------------- */

app.get('/api/cases', wrap((_req, res) => res.json(cases())));
app.get('/api/invoices', wrap((_req, res) => res.json(invoices())));
app.get('/api/notifications', wrap((_req, res) => res.json(notifications())));
app.get('/api/activities', wrap((_req, res) => res.json(activities())));

/* ---------------------------------- meta ---------------------------------- */

app.get('/api', wrap((_req, res) => {
  res.json({
    ok: true, service: 'iprs-demo-api', version: '1.0.0',
    endpoints: [
      'GET  /api/health', 'POST /api/auth/login', 'POST /api/auth/logout', 'GET  /api/auth/me',
      'GET  /api/users', 'POST /api/users', 'GET  /api/users/:id', 'PATCH /api/users/:id',
      'DELETE /api/users/:id', 'POST /api/users/:id/reset-password',
      'GET  /api/wallet', 'GET  /api/wallet/transactions', 'PATCH /api/wallet/:id',
      'POST /api/wallet/topup/mpesa/stk', 'GET  /api/wallet/topup/mpesa/stk/:checkoutRequestID',
      'POST /api/wallet/topup/mpesa/confirm', 'POST /api/wallet/topup/mpesa/cancel',
      'POST /api/wallet/topup/mpesa/callback',
      'POST /api/wallet/topup/card', 'POST /api/wallet/topup/card/confirm',
      'GET  /api/payments', 'GET  /api/payments/stats', 'GET  /api/payments/:id',
      'POST /api/payments/:id/refund', 'POST /api/payments/:id/retry', 'GET  /api/payment-methods',
      'GET  /api/providers', 'GET  /api/providers/:id', 'PATCH /api/providers/:id',
      'POST /api/providers/:id/test', 'GET  /api/providers/:id/logs', 'GET  /api/provider-logs',
      'GET  /api/api-keys', 'POST /api/api-keys/:id/revoke',
      'GET  /api/settings', 'PATCH /api/settings/:group', 'POST /api/settings/maintenance',
      'POST /api/settings/import',
      'GET  /api/pricing', 'PATCH /api/pricing',
      'GET  /api/audit', 'GET  /api/sessions', 'DELETE /api/sessions/:id',
      'GET  /api/usage', 'POST /api/usage',
      'GET  /api/cases', 'GET  /api/invoices', 'GET  /api/notifications', 'GET  /api/activities',
    ],
  });
}));

app.use('/api', (_req, res) => res.status(404).json({ ok: false, message: 'Unknown API endpoint.' }));

/* -------------------------------------------------------------------------- */
/*                                   bootstrap                                 */
/* -------------------------------------------------------------------------- */

const seedResult = seedIfEmpty();
if (seedResult.seeded) {
  console.log(`[api] seeded SQLite at ${DB_PATH}`, seedResult.counts);
} else {
  console.log(`[api] reusing existing database at ${DB_PATH}`, stats());
}

app.listen(PORT, HOST, () => {
  console.log(`[api] IPRS demo backend listening on http://${HOST}:${PORT}`);
  console.log(`[api] health check: http://127.0.0.1:${PORT}/api/health`);
});

export default app;
