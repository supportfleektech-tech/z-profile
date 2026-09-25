/**
 * Persistence layer for the IPRS demo backend.
 *
 * Uses Node's built-in `node:sqlite` (Node 22+) so the scaffold has ZERO native
 * dependencies to install. Entities that are naturally document-shaped (provider
 * configs, settings groups, audit metadata) are stored as JSON columns, while the
 * fields the API actually queries on are promoted to real indexed columns.
 *
 * The database is seeded from the SAME TypeScript modules the browser mock uses
 * (`src/data/*.ts` — Node 22 strips the types on import), so the two adapters can
 * never drift apart. Delete `server/iprs.sqlite` to reseed from scratch.
 */

import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { seedUsers } from '../src/data/users.ts';
import { hashPassword, isHashed } from './passwords.mjs';
import { seedApiKeys, seedProviderConfigs, seedProviderLogs } from '../src/data/providers.ts';
import { defaultSettings } from '../src/data/settings.ts';
import { pricingCatalog } from '../src/data/pricing.ts';
import {
  casesData,
  invoicesData,
  notificationsData,
  recentActivities,
  seedAudit,
  seedPaymentMethods,
  seedPayments,
  seedSessions,
  seedUsage,
  seedWallets,
  seedWalletTransactions,
} from '../src/data/seed.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '.data');
export const DB_PATH = process.env.IPRS_DB ?? path.join(DATA_DIR, 'iprs.sqlite');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

/* -------------------------------------------------------------------------- */
/*                                   schema                                    */
/* -------------------------------------------------------------------------- */

const CREATE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password      TEXT NOT NULL,
  phone         TEXT DEFAULT '',
  department    TEXT DEFAULT '',
  job_title     TEXT DEFAULT '',
  tier          TEXT NOT NULL CHECK (tier IN ('user','admin','super_admin')),
  sub_role      TEXT DEFAULT 'analyst',
  status        TEXT NOT NULL DEFAULT 'Active',
  is_system     INTEGER NOT NULL DEFAULT 0,
  mfa_enabled   INTEGER NOT NULL DEFAULT 0,
  avatar_url    TEXT,
  created_at    TEXT NOT NULL,
  last_login_at TEXT,
  last_login_ip TEXT,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until  TEXT,
  wallet_id     TEXT,
  overrides     TEXT DEFAULT '{}',
  ip_allowlist  TEXT DEFAULT '[]',
  doc           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);

CREATE TABLE IF NOT EXISTS wallets (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'KES',
  balance       REAL NOT NULL DEFAULT 0,
  held          REAL NOT NULL DEFAULT 0,
  lifetime_top  REAL NOT NULL DEFAULT 0,
  lifetime_spend REAL NOT NULL DEFAULT 0,
  auto_topup    INTEGER NOT NULL DEFAULT 0,
  auto_trigger  REAL NOT NULL DEFAULT 0,
  auto_amount   REAL NOT NULL DEFAULT 0,
  low_alert     REAL NOT NULL DEFAULT 0,
  overdraft     INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL,
  doc           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id            TEXT PRIMARY KEY,
  wallet_id     TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  at            TEXT NOT NULL,
  direction     TEXT NOT NULL,
  kind          TEXT NOT NULL,
  amount        REAL NOT NULL,
  balance_after REAL NOT NULL,
  channel       TEXT NOT NULL,
  status        TEXT NOT NULL,
  reference     TEXT NOT NULL,
  doc           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_user_at ON wallet_transactions(user_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_wallet ON wallet_transactions(wallet_id);

CREATE TABLE IF NOT EXISTS payments (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  at            TEXT NOT NULL,
  channel       TEXT NOT NULL,
  method        TEXT NOT NULL,
  amount        REAL NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'KES',
  status        TEXT NOT NULL,
  reference     TEXT NOT NULL,
  gateway       TEXT NOT NULL,
  gateway_ref   TEXT,
  fee_kes       REAL NOT NULL DEFAULT 0,
  net_kes       REAL NOT NULL DEFAULT 0,
  wallet_tx_id  TEXT,
  failure_reason TEXT,
  refunded_at   TEXT,
  refunded_by   TEXT,
  ip            TEXT DEFAULT '',
  doc           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_at ON payments(at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_channel ON payments(channel);

CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, doc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS providers (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  code          TEXT NOT NULL,
  category      TEXT DEFAULT '',
  enabled       INTEGER NOT NULL DEFAULT 1,
  environment   TEXT NOT NULL DEFAULT 'sandbox',
  status        TEXT NOT NULL DEFAULT 'Active',
  latency_ms    INTEGER NOT NULL DEFAULT 0,
  cost_per_call REAL NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL,
  doc           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_logs (
  id          TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  at          TEXT NOT NULL,
  status      TEXT NOT NULL,
  latency_ms  INTEGER NOT NULL DEFAULT 0,
  doc         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_plogs_provider ON provider_logs(provider_id, at DESC);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY, label TEXT NOT NULL, prefix TEXT NOT NULL,
  secret_hash TEXT, scopes TEXT NOT NULL DEFAULT '[]',
  provider_id TEXT, owner_id TEXT, status TEXT NOT NULL DEFAULT 'active',
  environment TEXT NOT NULL DEFAULT 'sandbox', last_used_at TEXT, revoked_at TEXT,
  doc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit (
  id         TEXT PRIMARY KEY,
  at         TEXT NOT NULL,
  actor_id   TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_tier TEXT NOT NULL,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT,
  severity   TEXT NOT NULL DEFAULT 'info',
  ip         TEXT DEFAULT '',
  detail     TEXT,
  doc        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit(at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit(severity);

CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  user_name    TEXT NOT NULL,
  tier         TEXT NOT NULL,
  ip           TEXT DEFAULT '',
  device       TEXT DEFAULT '',
  browser      TEXT DEFAULT '',
  location     TEXT DEFAULT '',
  started_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  current      INTEGER NOT NULL DEFAULT 0,
  doc          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS usage (
  id            TEXT PRIMARY KEY,
  at            TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  provider_id   TEXT NOT NULL,
  check_type    TEXT DEFAULT '',
  cost_kes      REAL NOT NULL DEFAULT 0,
  status        TEXT NOT NULL,
  latency_ms    INTEGER NOT NULL DEFAULT 0,
  doc           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_at ON usage(at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_provider ON usage(provider_id);

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL, subject TEXT NOT NULL,
  status TEXT NOT NULL, priority TEXT NOT NULL, owner_id TEXT,
  created_at TEXT NOT NULL DEFAULT '', doc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cases_created ON cases(created_at DESC);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY, invoice_no TEXT NOT NULL, user_id TEXT, date TEXT NOT NULL DEFAULT '',
  amount_value REAL NOT NULL DEFAULT 0, status TEXT NOT NULL, doc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invoices_no ON invoices(invoice_no DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY, user_id TEXT, category TEXT, type TEXT, read INTEGER NOT NULL DEFAULT 0, doc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY, at TEXT, doc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kv (
  k TEXT PRIMARY KEY, v TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stk_pending (
  checkout_request_id TEXT PRIMARY KEY,
  merchant_request_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  amount REAL NOT NULL,
  started_at INTEGER NOT NULL,
  settle_after INTEGER NOT NULL,
  cancelled INTEGER NOT NULL DEFAULT 0,
  result TEXT
);
`;

const REQUIRED_TABLES = [
  'users', 'wallets', 'wallet_transactions', 'payments', 'payment_methods', 'providers', 'provider_logs', 'api_keys',
  'audit', 'sessions', 'usage', 'cases', 'invoices', 'notifications', 'activities', 'kv', 'stk_pending',
];

const REQUIRED_COLUMNS = {
  users: ['id', 'email', 'password', 'tier', 'doc'],
  wallets: ['id', 'user_id', 'balance', 'doc'],
  wallet_transactions: ['id', 'wallet_id', 'user_id', 'doc'],
  payments: ['id', 'user_id', 'status', 'doc'],
  payment_methods: ['id', 'user_id', 'doc'],
  providers: ['id', 'name', 'code', 'doc'],
  provider_logs: ['id', 'provider_id', 'doc'],
  api_keys: ['id', 'label', 'prefix', 'secret_hash', 'scopes', 'doc'],
  audit: ['id', 'at', 'actor_id', 'doc'],
  sessions: ['id', 'user_id', 'current', 'doc'],
  usage: ['id', 'at', 'user_id', 'doc'],
  cases: ['id', 'case_id', 'doc'],
  invoices: ['id', 'invoice_no', 'doc'],
  notifications: ['id', 'user_id', 'doc'],
  activities: ['id', 'at', 'doc'],
  kv: ['k', 'v', 'updated_at'],
  stk_pending: ['checkout_request_id', 'merchant_request_id', 'user_id', 'result'],
};

function hasRequiredSchema(database) {
  return REQUIRED_TABLES.every((table) => {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
    return REQUIRED_COLUMNS[table].every((column) => columns.includes(column));
  });
}

const CURRENT_SCHEMA_VERSION = 1;
export const migrations = [
  {
    version: 1,
    up(database) {
      database.exec(CREATE_SCHEMA_SQL);
    },
  },
];

function ensureApiKeyColumns(database) {
  const columns = database.prepare('PRAGMA table_info(api_keys)').all();
  if (!columns.some((column) => column.name === 'secret_hash')) database.exec('ALTER TABLE api_keys ADD COLUMN secret_hash TEXT');
  if (!columns.some((column) => column.name === 'scopes')) database.exec("ALTER TABLE api_keys ADD COLUMN scopes TEXT NOT NULL DEFAULT '[]'");
  if (!columns.some((column) => column.name === 'last_used_at')) database.exec('ALTER TABLE api_keys ADD COLUMN last_used_at TEXT');
  if (!columns.some((column) => column.name === 'revoked_at')) database.exec('ALTER TABLE api_keys ADD COLUMN revoked_at TEXT');
}

export function migrateDb(database = db) {
  const from = Number(database.prepare('PRAGMA user_version').get().user_version ?? 0);
  if (from > CURRENT_SCHEMA_VERSION) throw new Error(`Database schema version ${from} is newer than supported version ${CURRENT_SCHEMA_VERSION}.`);
  if (from === CURRENT_SCHEMA_VERSION) return { from, to: from, stamped: false };

  const completeUnversioned = hasRequiredSchema(database);
  if (completeUnversioned) {
    ensureApiKeyColumns(database);
    database.exec(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION};`);
    return { from, to: CURRENT_SCHEMA_VERSION, stamped: true };
  }

  for (const migration of migrations.filter((item) => item.version > from).sort((a, b) => a.version - b.version)) {
    database.exec('BEGIN');
    try {
      migration.up(database);
      ensureApiKeyColumns(database);
      if (!hasRequiredSchema(database)) throw new Error('Database is missing required schema columns.');
      database.exec(`PRAGMA user_version = ${migration.version};`);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
  return { from, to: CURRENT_SCHEMA_VERSION, stamped: false };
}

migrateDb();

function ensureApiKeyColumn(name, definition) {
  const columns = db.prepare('PRAGMA table_info(api_keys)').all();
  if (!columns.some((column) => column.name === name)) db.exec(`ALTER TABLE api_keys ADD COLUMN ${name} ${definition}`);
}

ensureApiKeyColumn('secret_hash', 'TEXT');
ensureApiKeyColumn('scopes', "TEXT NOT NULL DEFAULT '[]'");
ensureApiKeyColumn('last_used_at', 'TEXT');
ensureApiKeyColumn('revoked_at', 'TEXT');

/* -------------------------------------------------------------------------- */
/*                              row <-> doc mapping                            */
/* -------------------------------------------------------------------------- */

/** SQLite has no boolean; normalise 0/1 back to JS booleans inside stored docs. */
const j = (s) => (s == null ? null : JSON.parse(s));

export const rowUser = (r) => (r ? j(r.doc) : null);
export const rowWallet = (r) => (r ? j(r.doc) : null);
export const rowDoc = (r) => (r ? j(r.doc) : null);

export function users() {
  return db.prepare('SELECT doc FROM users ORDER BY created_at ASC').all().map((r) => j(r.doc));
}
export function findUser(id) {
  return rowDoc(db.prepare('SELECT doc FROM users WHERE id = ?').get(id));
}
export function findUserByEmail(email) {
  return rowDoc(db.prepare('SELECT doc FROM users WHERE lower(email) = lower(?)').get(String(email).trim()));
}
/**
 * Migrate every stored credential to a salted scrypt hash and purge plaintext from
 * the database. Idempotent — runs after seeding and on every boot, so databases
 * created before hashing are upgraded in place.
 */
export function hashStoredPasswords() {
  let migrated = 0;
  for (const u of users()) {
    // The `password` column holds `s1$<salt>$<hash>` after migration; plaintext never
    // survives a boot. Idempotent: already-hashed rows are left untouched.
    if (u.password && !isHashed(u.password)) {
      putUser({ ...u, password: hashPassword(u.password) });
      migrated++;
    }
  }
  return migrated;
}

export function putUser(u) {
  db.prepare(
    `INSERT INTO users (id,name,email,password,phone,department,job_title,tier,sub_role,status,is_system,
      mfa_enabled,avatar_url,created_at,last_login_at,last_login_ip,failed_logins,locked_until,wallet_id,
      overrides,ip_allowlist,doc)
     VALUES (@id,@name,@email,@password,@phone,@department,@job_title,@tier,@sub_role,@status,@is_system,
      @mfa_enabled,@avatar_url,@created_at,@last_login_at,@last_login_ip,@failed_logins,@locked_until,@wallet_id,
      @overrides,@ip_allowlist,@doc)
     ON CONFLICT(id) DO UPDATE SET
      name=@name,email=@email,password=@password,phone=@phone,department=@department,job_title=@job_title,
      tier=@tier,sub_role=@sub_role,status=@status,is_system=@is_system,mfa_enabled=@mfa_enabled,
      avatar_url=@avatar_url,last_login_at=@last_login_at,last_login_ip=@last_login_ip,failed_logins=@failed_logins,
      locked_until=@locked_until,wallet_id=@wallet_id,overrides=@overrides,ip_allowlist=@ip_allowlist,doc=@doc`
  ).run({
    id: u.id, name: u.name, email: u.email, password: u.password, phone: u.phone ?? '',
    department: u.department ?? '', job_title: u.jobTitle ?? '', tier: u.tier, sub_role: u.subRole ?? 'analyst',
    status: u.status, is_system: u.isSystem ? 1 : 0, mfa_enabled: u.mfaEnabled ? 1 : 0,
    avatar_url: u.avatarUrl ?? null, created_at: u.createdAt, last_login_at: u.lastLoginAt ?? null,
    last_login_ip: u.lastLoginIp ?? null, failed_logins: u.failedLoginAttempts ?? 0,
    locked_until: u.lockedUntil ?? null, wallet_id: u.walletId ?? null,
    overrides: JSON.stringify(u.permissionOverrides ?? {}), ip_allowlist: JSON.stringify(u.ipAllowlist ?? []),
    doc: JSON.stringify(u),
  });
  return u;
}
export function deleteUser(id) {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

export function wallets() {
  return db.prepare('SELECT doc FROM wallets ORDER BY balance DESC').all().map((r) => j(r.doc));
}
export function walletFor(userId) {
  return rowDoc(db.prepare('SELECT doc FROM wallets WHERE user_id = ?').get(userId));
}
export function walletById(id) {
  return rowDoc(db.prepare('SELECT doc FROM wallets WHERE id = ?').get(id));
}
export function putWallet(w) {
  db.prepare(
    `INSERT INTO wallets (id,user_id,currency,balance,held,lifetime_top,lifetime_spend,auto_topup,auto_trigger,
      auto_amount,low_alert,overdraft,updated_at,doc)
     VALUES (@id,@user_id,@currency,@balance,@held,@lifetime_top,@lifetime_spend,@auto_topup,@auto_trigger,
      @auto_amount,@low_alert,@overdraft,@updated_at,@doc)
     ON CONFLICT(id) DO UPDATE SET balance=@balance,held=@held,lifetime_top=@lifetime_top,
      lifetime_spend=@lifetime_spend,auto_topup=@auto_topup,auto_trigger=@auto_trigger,auto_amount=@auto_amount,
      low_alert=@low_alert,overdraft=@overdraft,updated_at=@updated_at,doc=@doc`
  ).run({
    id: w.id, user_id: w.userId, currency: w.currency ?? 'KES', balance: w.balance, held: w.held,
    lifetime_top: w.lifetimeTopUp, lifetime_spend: w.lifetimeSpend, auto_topup: w.autoTopUp ? 1 : 0,
    auto_trigger: w.autoTopUpTriggerKes, auto_amount: w.autoTopUpAmountKes, low_alert: w.lowBalanceAlertKes,
    overdraft: w.overdraftAllowed ? 1 : 0, updated_at: w.updatedAt, doc: JSON.stringify(w),
  });
  return w;
}

export function transactions(userId, limit = 200) {
  const sql = userId
    ? 'SELECT doc FROM wallet_transactions WHERE user_id = ? ORDER BY at DESC LIMIT ?'
    : 'SELECT doc FROM wallet_transactions ORDER BY at DESC LIMIT ?';
  const rows = userId
    ? db.prepare(sql).all(userId, limit)
    : db.prepare(sql).all(limit);
  return rows.map((r) => j(r.doc));
}
export function putTransaction(t) {
  db.prepare(
    `INSERT INTO wallet_transactions (id,wallet_id,user_id,at,direction,kind,amount,balance_after,channel,status,reference,doc)
     VALUES (@id,@wallet_id,@user_id,@at,@direction,@kind,@amount,@balance_after,@channel,@status,@reference,@doc)
     ON CONFLICT(id) DO UPDATE SET doc=@doc,balance_after=@balance_after,status=@status`
  ).run({
    id: t.id, wallet_id: t.walletId, user_id: t.userId, at: t.at, direction: t.direction, kind: t.kind,
    amount: t.amount, balance_after: t.balanceAfter, channel: t.channel, status: t.status,
    reference: t.reference, doc: JSON.stringify(t),
  });
  return t;
}

export function payments(filter = {}) {
  const where = [];
  const params = {};
  if (filter.userId) { where.push('user_id = @userId'); params.userId = filter.userId; }
  if (filter.status) { where.push('status = @status'); params.status = filter.status; }
  if (filter.channel) { where.push('channel = @channel'); params.channel = filter.channel; }
  if (filter.from) { where.push('at >= @from'); params.from = filter.from; }
  if (filter.to) { where.push('at <= @to'); params.to = filter.to; }
  const sql = `SELECT doc FROM payments ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY at DESC LIMIT @limit`;
  return db.prepare(sql).all({ ...params, limit: filter.limit ?? 1000 }).map((r) => j(r.doc));
}
export function paymentById(id) {
  return rowDoc(db.prepare('SELECT doc FROM payments WHERE id = ?').get(id));
}
export function putPayment(p) {
  db.prepare(
    `INSERT INTO payments (id,user_id,at,channel,method,amount,currency,status,reference,gateway,gateway_ref,
      fee_kes,net_kes,wallet_tx_id,failure_reason,refunded_at,refunded_by,ip,doc)
     VALUES (@id,@user_id,@at,@channel,@method,@amount,@currency,@status,@reference,@gateway,@gateway_ref,
      @fee_kes,@net_kes,@wallet_tx_id,@failure_reason,@refunded_at,@refunded_by,@ip,@doc)
     ON CONFLICT(id) DO UPDATE SET status=@status,refunded_at=@refunded_at,refunded_by=@refunded_by,
      failure_reason=@failure_reason,gateway_ref=@gateway_ref,net_kes=@net_kes,wallet_tx_id=@wallet_tx_id,doc=@doc`
  ).run({
    id: p.id, user_id: p.userId, at: p.at, channel: p.channel, method: p.method, amount: p.amount,
    currency: p.currency ?? 'KES', status: p.status, reference: p.reference, gateway: p.gateway,
    gateway_ref: p.gatewayRef ?? null, fee_kes: p.feeKes ?? 0, net_kes: p.netKes ?? 0,
    wallet_tx_id: p.walletTransactionId ?? null, failure_reason: p.failureReason ?? null,
    refunded_at: p.refundedAt ?? null, refunded_by: p.refundedBy ?? null, ip: p.ip ?? '',
    doc: JSON.stringify(p),
  });
  return p;
}

export function providers() {
  return db.prepare('SELECT doc FROM providers ORDER BY name ASC').all().map((r) => j(r.doc));
}
export function providerById(id) {
  return rowDoc(db.prepare('SELECT doc FROM providers WHERE id = ?').get(id));
}
export function putProvider(p) {
  db.prepare(
    `INSERT INTO providers (id,name,code,category,enabled,environment,status,latency_ms,cost_per_call,updated_at,doc)
     VALUES (@id,@name,@code,@category,@enabled,@environment,@status,@latency_ms,@cost_per_call,@updated_at,@doc)
     ON CONFLICT(id) DO UPDATE SET name=@name,code=@code,category=@category,enabled=@enabled,environment=@environment,
      status=@status,latency_ms=@latency_ms,cost_per_call=@cost_per_call,updated_at=@updated_at,doc=@doc`
  ).run({
    id: p.id, name: p.name, code: p.code, category: p.category ?? '', enabled: p.enabled ? 1 : 0,
    environment: p.environment, status: p.status, latency_ms: p.latencyMs ?? 0,
    cost_per_call: p.costPerCallKes ?? 0, updated_at: new Date().toISOString(), doc: JSON.stringify(p),
  });
  return p;
}

export function providerLogs(providerId, limit = 200) {
  const rows = providerId
    ? db.prepare('SELECT doc FROM provider_logs WHERE provider_id = ? ORDER BY at DESC LIMIT ?').all(providerId, limit)
    : db.prepare('SELECT doc FROM provider_logs ORDER BY at DESC LIMIT ?').all(limit);
  return rows.map((r) => j(r.doc));
}
export function putProviderLog(l) {
  db.prepare(
    `INSERT INTO provider_logs (id,provider_id,at,status,latency_ms,doc) VALUES (@id,@provider_id,@at,@status,@latency_ms,@doc)
     ON CONFLICT(id) DO UPDATE SET doc=@doc`
  ).run({ id: l.id, provider_id: l.providerId, at: l.at, status: l.status ?? 'success', latency_ms: l.latencyMs ?? 0, doc: JSON.stringify(l) });
  return l;
}

export function apiKeys() {
  return db.prepare('SELECT doc FROM api_keys ORDER BY label ASC').all().map((r) => j(r.doc));
}
export function apiKeyById(id) {
  return rowDoc(db.prepare('SELECT doc FROM api_keys WHERE id = ?').get(id));
}
export function putApiKey(k) {
  const { secret, ...record } = k;
  const secretHash = record.secretHash ?? (secret ? createHash('sha256').update(secret).digest('hex') : null);
  const safe = { ...record, secretHash };
  db.prepare(
    `INSERT INTO api_keys (id,label,prefix,secret_hash,scopes,provider_id,owner_id,status,environment,last_used_at,revoked_at,doc)
     VALUES (@id,@label,@prefix,@secret_hash,@scopes,@provider_id,@owner_id,@status,@environment,@last_used_at,@revoked_at,@doc)
     ON CONFLICT(id) DO UPDATE SET label=@label,prefix=@prefix,secret_hash=@secret_hash,scopes=@scopes,
      provider_id=@provider_id,owner_id=@owner_id,status=@status,environment=@environment,
      last_used_at=@last_used_at,revoked_at=@revoked_at,doc=@doc`
  ).run({
    id: safe.id, label: safe.label, prefix: safe.prefix, secret_hash: secretHash, scopes: JSON.stringify(safe.scopes ?? []),
    provider_id: safe.providerId ?? null, owner_id: safe.ownerId ?? null, status: safe.status,
    environment: safe.environment ?? 'sandbox', last_used_at: safe.lastUsedAt ?? null,
    revoked_at: safe.revokedAt ?? null, doc: JSON.stringify(safe),
  });
  return safe;
}

export function auditLog(filter = {}) {
  const where = [];
  const params = {};
  if (filter.severity) { where.push('severity = @severity'); params.severity = filter.severity; }
  if (filter.actorTier) { where.push('actor_tier = @actorTier'); params.actorTier = filter.actorTier; }
  if (filter.action) { where.push('action LIKE @action'); params.action = `${filter.action}%`; }
  if (filter.from) { where.push('at >= @from'); params.from = filter.from; }
  if (filter.q) {
    where.push('(actor_name LIKE @q OR action LIKE @q OR entity LIKE @q OR detail LIKE @q OR ip LIKE @q)');
    params.q = `%${filter.q}%`;
  }
  const sql = `SELECT doc FROM audit ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY at DESC LIMIT @limit`;
  return db.prepare(sql).all({ ...params, limit: filter.limit ?? 500 }).map((r) => j(r.doc));
}
export function appendAudit(entry) {
  const e = { id: entry.id ?? `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, at: entry.at ?? new Date().toISOString(), ...entry };
  db.prepare(
    `INSERT INTO audit (id,at,actor_id,actor_name,actor_tier,action,entity,entity_id,severity,ip,detail,doc)
     VALUES (@id,@at,@actor_id,@actor_name,@actor_tier,@action,@entity,@entity_id,@severity,@ip,@detail,@doc)
     ON CONFLICT(id) DO NOTHING`
  ).run({
    id: e.id, at: e.at, actor_id: e.actorId, actor_name: e.actorName, actor_tier: e.actorTier, action: e.action,
    entity: e.entity, entity_id: e.entityId ?? null, severity: e.severity ?? 'info', ip: e.ip ?? '',
    detail: e.detail ?? null, doc: JSON.stringify(e),
  });
  return e;
}

export function sessions() {
  return db.prepare('SELECT doc FROM sessions ORDER BY last_seen_at DESC').all().map((r) => j(r.doc));
}
export function putSession(s) {
  db.prepare(
    `INSERT INTO sessions (id,user_id,user_name,tier,ip,device,browser,location,started_at,last_seen_at,current,doc)
     VALUES (@id,@user_id,@user_name,@tier,@ip,@device,@browser,@location,@started_at,@last_seen_at,@current,@doc)
     ON CONFLICT(id) DO UPDATE SET last_seen_at=@last_seen_at,current=@current,doc=@doc`
  ).run({
    id: s.id, user_id: s.userId, user_name: s.userName, tier: s.tier, ip: s.ip ?? '', device: s.device ?? '',
    browser: s.browser ?? '', location: s.location ?? '', started_at: s.startedAt, last_seen_at: s.lastSeenAt,
    current: s.current ? 1 : 0, doc: JSON.stringify(s),
  });
  return s;
}
export function deleteSession(id) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

export function usageRecords(limit = 500) {
  return db.prepare('SELECT doc FROM usage ORDER BY at DESC LIMIT ?').all(limit).map((r) => j(r.doc));
}
export function putUsage(u) {
  db.prepare(
    `INSERT INTO usage (id,at,user_id,provider_id,check_type,cost_kes,status,latency_ms,doc)
     VALUES (@id,@at,@user_id,@provider_id,@check_type,@cost_kes,@status,@latency_ms,@doc)
     ON CONFLICT(id) DO UPDATE SET at=@at,user_id=@user_id,provider_id=@provider_id,check_type=@check_type,
      cost_kes=@cost_kes,status=@status,latency_ms=@latency_ms,doc=@doc`
  ).run({
    id: u.id, at: u.at, user_id: u.userId, provider_id: u.providerId, check_type: u.checkType ?? '',
    cost_kes: u.costKes ?? 0, status: u.status, latency_ms: u.latencyMs ?? 0, doc: JSON.stringify(u),
  });
  return u;
}

export function cases() {
  return db.prepare('SELECT doc FROM cases ORDER BY created_at DESC, case_id DESC').all().map((r) => j(r.doc));
}
export function invoices() {
  return db.prepare('SELECT doc FROM invoices ORDER BY invoice_no DESC').all().map((r) => j(r.doc));
}
export function notifications() {
  return db.prepare('SELECT doc FROM notifications ORDER BY id ASC').all().map((r) => j(r.doc));
}
export function activities() {
  return db.prepare('SELECT doc FROM activities ORDER BY at DESC').all().map((r) => j(r.doc));
}
export function paymentMethods() {
  return db.prepare('SELECT doc FROM payment_methods').all().map((r) => j(r.doc));
}

/* ----------------------------------- kv ----------------------------------- */

export function kvGet(key, fallback = null) {
  const row = db.prepare('SELECT v FROM kv WHERE k = ?').get(key);
  return row ? JSON.parse(row.v) : fallback;
}
export function kvSet(key, value) {
  db.prepare(
    `INSERT INTO kv (k,v,updated_at) VALUES (@k,@v,@u) ON CONFLICT(k) DO UPDATE SET v=@v,updated_at=@u`
  ).run({ k: key, v: JSON.stringify(value), u: new Date().toISOString() });
  return value;
}

export const settings = () => kvGet('settings', defaultSettings);
export const saveSettings = (s) => kvSet('settings', s);
export const pricing = () => kvGet('pricing', pricingCatalog);
export const savePricing = (p) => kvSet('pricing', p);

const BACKUP_COLLECTIONS = [
  ['users', 'users'],
  ['wallets', 'wallets'],
  ['walletTransactions', 'wallet_transactions'],
  ['payments', 'payments'],
  ['paymentMethods', 'payment_methods'],
  ['providers', 'providers'],
  ['providerLogs', 'provider_logs'],
  ['apiKeys', 'api_keys'],
  ['audit', 'audit'],
  ['usage', 'usage'],
  ['cases', 'cases'],
  ['invoices', 'invoices'],
  ['notifications', 'notifications'],
  ['activities', 'activities'],
];

const BACKUP_SECRET_KEYS = new Set([
  'password', 'passwordHash', 'secret', 'secretHash', 'secretMasked', 'authSecret', 'callbackToken', 'authToken',
  'consumerSecret', 'webhookSecret', 'smsApiKey', 'mpesaPasskey', 'token', 'apiKey', 'accessToken',
]);

function isSecretKey(key) {
  return BACKUP_SECRET_KEYS.has(key) || /(?:password|passkey|secret|credential|privateKey)/i.test(key);
}

function containsBackupSecret(value) {
  if (Array.isArray(value)) return value.some(containsBackupSecret);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, item]) => isSecretKey(key) || containsBackupSecret(item));
}

function mergePreservedSecrets(current, incoming) {
  if (Array.isArray(incoming)) {
    return incoming.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
      const currentItem = current?.find?.((candidate) => candidate?.id === item.id) ?? current?.[index];
      return mergePreservedSecrets(currentItem, item);
    });
  }
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return incoming;
  const merged = { ...incoming };
  if (!current || typeof current !== 'object' || Array.isArray(current)) return merged;
  for (const [key, value] of Object.entries(current)) {
    if (isSecretKey(key)) {
      if (!(key in merged)) merged[key] = value;
    } else if (merged[key] && typeof merged[key] === 'object' && value && typeof value === 'object') {
      merged[key] = mergePreservedSecrets(value, merged[key]);
    }
  }
  return merged;
}

function redactBackupValue(value) {
  if (Array.isArray(value)) return value.map(redactBackupValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !isSecretKey(key)).map(([key, item]) => [key, redactBackupValue(item)]));
}

function backupRows(database, table) {
  return database.prepare(`SELECT doc FROM ${table} ORDER BY rowid ASC`).all().map((row) => JSON.parse(row.doc));
}

function backupKv(database, key, fallback) {
  const row = database.prepare('SELECT v FROM kv WHERE k = ?').get(key);
  return row ? JSON.parse(row.v) : fallback;
}

export function createBackup(database = db) {
  const data = Object.fromEntries(BACKUP_COLLECTIONS.map(([name, table]) => [name, redactBackupValue(backupRows(database, table))]));
  data.settings = redactBackupValue(backupKv(database, 'settings', defaultSettings));
  data.pricing = redactBackupValue(backupKv(database, 'pricing', pricingCatalog));
  return { format: 'iprs-backup', version: 1, data };
}

function assertStableId(value, collection) {
  if (typeof value !== 'string' || !value.trim() || value.length > 128 || /\s/.test(value)) {
    throw new Error(`Backup ${collection} contains a malformed id.`);
  }
}

export function validateBackup(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Backup payload must be an object.');
  if (payload.format !== 'iprs-backup') throw new Error('Unsupported backup format.');
  if (payload.version !== 1) throw new Error(`Unsupported backup version: ${String(payload.version)}.`);
  const data = payload.data;
  if (!data || typeof data !== 'object') throw new Error('Backup data is required.');
  const allowed = new Set([...BACKUP_COLLECTIONS.map(([name]) => name), 'settings', 'pricing']);
  for (const key of Object.keys(data)) {
    if (!allowed.has(key)) throw new Error(`Backup data contains unsupported collection: ${key}.`);
  }
  for (const [name] of BACKUP_COLLECTIONS) {
    if (!Array.isArray(data[name])) throw new Error(`Backup data requires an array: ${name}.`);
    const ids = new Set();
    for (const record of data[name]) {
      if (!record || typeof record !== 'object') throw new Error(`Backup ${name} contains a malformed record.`);
      assertStableId(record.id, name);
      if (ids.has(record.id)) throw new Error(`Backup ${name} contains duplicate id: ${record.id}.`);
      ids.add(record.id);
    }
  }
  if (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) throw new Error('Backup data requires settings.');
  if (!data.pricing || typeof data.pricing !== 'object' || Array.isArray(data.pricing)) throw new Error('Backup data requires pricing.');
  if (containsBackupSecret(data)) throw new Error('Backup payload contains credential material.');
  return data;
}

function restoreKv(database, key, value, preserveSecrets = false) {
  const current = database.prepare('SELECT v FROM kv WHERE k = ?').get(key);
  const restored = preserveSecrets && current ? mergePreservedSecrets(JSON.parse(current.v), value) : value;
  database.prepare('INSERT INTO kv (k,v,updated_at) VALUES (?,?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v,updated_at=excluded.updated_at').run(key, JSON.stringify(restored), new Date().toISOString());
}

function restoreUser(database, record, existingPasswords) {
  const password = existingPasswords.get(record.id) || hashPassword(`Restored-${record.id}-${randomUUID()}`);
  database.prepare(`INSERT INTO users (id,name,email,password,phone,department,job_title,tier,sub_role,status,is_system,mfa_enabled,avatar_url,created_at,last_login_at,last_login_ip,failed_logins,locked_until,wallet_id,overrides,ip_allowlist,doc)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    record.id, record.name, record.email, password, record.phone ?? '', record.department ?? '', record.jobTitle ?? '', record.tier,
    record.subRole ?? 'analyst', record.status ?? 'Active', record.isSystem ? 1 : 0, record.mfaEnabled ? 1 : 0, record.avatarUrl ?? null,
    record.createdAt, record.lastLoginAt ?? null, record.lastLoginIp ?? null, record.failedLoginAttempts ?? 0, record.lockedUntil ?? null,
    record.walletId ?? null, JSON.stringify(record.permissionOverrides ?? {}), JSON.stringify(record.ipAllowlist ?? []), JSON.stringify({ ...redactBackupValue(record), password }),
  );
}

function restoreRows(database, data, existingPasswords, existingApiKeyHashes, existingProviders) {
  for (const user of data.users) restoreUser(database, user, existingPasswords);
  for (const wallet of data.wallets) {
    database.prepare(`INSERT INTO wallets (id,user_id,currency,balance,held,lifetime_top,lifetime_spend,auto_topup,auto_trigger,auto_amount,low_alert,overdraft,updated_at,doc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      wallet.id, wallet.userId, wallet.currency ?? 'KES', wallet.balance ?? 0, wallet.held ?? 0, wallet.lifetimeTopUp ?? 0, wallet.lifetimeSpend ?? 0,
      wallet.autoTopUp ? 1 : 0, wallet.autoTopUpTriggerKes ?? 0, wallet.autoTopUpAmountKes ?? 0, wallet.lowBalanceAlertKes ?? 0, wallet.overdraftAllowed ? 1 : 0, wallet.updatedAt, JSON.stringify(wallet),
    );
  }
  for (const record of data.walletTransactions) {
    database.prepare(`INSERT INTO wallet_transactions (id,wallet_id,user_id,at,direction,kind,amount,balance_after,channel,status,reference,doc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      record.id, record.walletId, record.userId, record.at, record.direction, record.kind, record.amount, record.balanceAfter, record.channel, record.status, record.reference, JSON.stringify(record),
    );
  }
  for (const record of data.payments) {
    database.prepare(`INSERT INTO payments (id,user_id,at,channel,method,amount,currency,status,reference,gateway,gateway_ref,fee_kes,net_kes,wallet_tx_id,failure_reason,refunded_at,refunded_by,ip,doc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      record.id, record.userId, record.at, record.channel, record.method, record.amount, record.currency ?? 'KES', record.status, record.reference, record.gateway,
      record.gatewayRef ?? null, record.feeKes ?? 0, record.netKes ?? 0, record.walletTransactionId ?? null, record.failureReason ?? null, record.refundedAt ?? null, record.refundedBy ?? null, record.ip ?? '', JSON.stringify(record),
    );
  }
  for (const record of data.paymentMethods) {
    database.prepare('INSERT INTO payment_methods (id,user_id,doc) VALUES (?,?,?)').run(record.id, record.userId ?? '', JSON.stringify(record));
  }
  for (const record of data.providers) {
    const provider = mergePreservedSecrets(existingProviders.get(record.id), record);
    database.prepare(`INSERT INTO providers (id,name,code,category,enabled,environment,status,latency_ms,cost_per_call,updated_at,doc) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      record.id, record.name, record.code, record.category ?? '', record.enabled ? 1 : 0, record.environment ?? 'sandbox', record.status ?? 'Active', record.latencyMs ?? 0, record.costPerCallKes ?? 0, record.updatedAt ?? new Date().toISOString(), JSON.stringify(provider),
    );
  }
  for (const record of data.providerLogs) {
    database.prepare('INSERT INTO provider_logs (id,provider_id,at,status,latency_ms,doc) VALUES (?,?,?,?,?,?)').run(record.id, record.providerId, record.at, record.status, record.latencyMs ?? 0, JSON.stringify(record));
  }
  for (const record of data.apiKeys) {
    const existingHash = existingApiKeyHashes.get(record.id) ?? null;
    const secretHash = existingHash;
    const status = secretHash ? (record.status ?? 'active') : 'revoked';
    const revokedAt = status === 'revoked' ? (record.revokedAt ?? new Date().toISOString()) : null;
    const apiKey = { ...record, secretHash, status, revokedAt };
    database.prepare(`INSERT INTO api_keys (id,label,prefix,secret_hash,scopes,provider_id,owner_id,status,environment,last_used_at,revoked_at,doc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      record.id, record.label, record.prefix, secretHash, JSON.stringify(record.scopes ?? []), record.providerId ?? null, record.ownerId, status, record.environment ?? 'sandbox', record.lastUsedAt ?? null, revokedAt, JSON.stringify(apiKey),
    );
  }
  for (const record of data.audit) {
    database.prepare(`INSERT INTO audit (id,at,actor_id,actor_name,actor_tier,action,entity,entity_id,severity,ip,detail,doc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      record.id, record.at, record.actorId, record.actorName, record.actorTier, record.action, record.entity, record.entityId ?? null, record.severity ?? 'info', record.ip ?? '', record.detail ?? null, JSON.stringify(record),
    );
  }
  for (const record of data.usage) {
    database.prepare('INSERT INTO usage (id,at,user_id,provider_id,check_type,cost_kes,status,latency_ms,doc) VALUES (?,?,?,?,?,?,?,?,?)').run(
      record.id, record.at, record.userId, record.providerId, record.checkType ?? '', record.costKes ?? 0, record.status, record.latencyMs ?? 0, JSON.stringify(record),
    );
  }
  for (const record of data.cases) {
    database.prepare('INSERT INTO cases (id,case_id,subject,status,priority,owner_id,created_at,doc) VALUES (?,?,?,?,?,?,?,?)').run(
      record.id, record.caseId, record.subject, record.status, record.priority, record.ownerId ?? null, record.createdAt ?? '', JSON.stringify(record),
    );
  }
  for (const record of data.invoices) {
    database.prepare('INSERT INTO invoices (id,invoice_no,user_id,date,amount_value,status,doc) VALUES (?,?,?,?,?,?,?)').run(record.id, record.invoiceNo, record.userId ?? null, record.date ?? '', record.amountValue ?? 0, record.status, JSON.stringify(record));
  }
  for (const record of data.notifications) {
    database.prepare('INSERT INTO notifications (id,user_id,category,type,read,doc) VALUES (?,?,?,?,?,?)').run(record.id, record.userId ?? null, record.category ?? null, record.type ?? null, record.read ? 1 : 0, JSON.stringify(record));
  }
  for (const record of data.activities) {
    database.prepare('INSERT INTO activities (id,at,doc) VALUES (?,?,?)').run(record.id, record.at ?? null, JSON.stringify(record));
  }
  restoreKv(database, 'settings', data.settings, true);
  restoreKv(database, 'pricing', data.pricing, true);
}

export function restoreBackup(payload, database = db) {
  const data = validateBackup(payload);
  const existingPasswords = new Map(database.prepare('SELECT id,password FROM users').all().map((row) => [row.id, row.password]));
  const existingApiKeyHashes = new Map(database.prepare('SELECT id,secret_hash FROM api_keys').all().map((row) => [row.id, row.secret_hash]));
  const existingProviders = new Map(database.prepare('SELECT id,doc FROM providers').all().map((row) => [row.id, JSON.parse(row.doc)]));
  database.exec('BEGIN');
  try {
    database.exec('DELETE FROM wallet_transactions; DELETE FROM payments; DELETE FROM payment_methods; DELETE FROM provider_logs; DELETE FROM providers; DELETE FROM api_keys; DELETE FROM audit; DELETE FROM usage; DELETE FROM cases; DELETE FROM invoices; DELETE FROM notifications; DELETE FROM activities; DELETE FROM wallets; DELETE FROM users;');
    restoreRows(database, data, existingPasswords, existingApiKeyHashes, existingProviders);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return { format: 'iprs-backup', version: 1, restored: true };
}

/* ------------------------------ STK pending ------------------------------- */

export function stkPut(p) {
  db.prepare(
    `INSERT INTO stk_pending (checkout_request_id,merchant_request_id,user_id,phone,amount,started_at,settle_after,cancelled,result)
     VALUES (@c,@m,@u,@p,@a,@s,@sa,@x,@r)
     ON CONFLICT(checkout_request_id) DO UPDATE SET cancelled=@x,result=@r`
  ).run({
    c: p.checkoutRequestID, m: p.merchantRequestID, u: p.userId, p: p.phone, a: p.amount,
    s: p.startedAt, sa: p.settleAfter, x: p.cancelled ? 1 : 0, r: p.result ? JSON.stringify(p.result) : null,
  });
}
export function stkGet(id) {
  const r = db.prepare('SELECT * FROM stk_pending WHERE checkout_request_id = ?').get(id);
  if (!r) return null;
  return {
    checkoutRequestID: r.checkout_request_id, merchantRequestID: r.merchant_request_id, userId: r.user_id,
    phone: r.phone, amount: r.amount, startedAt: r.started_at, settleAfter: r.settle_after,
    cancelled: !!r.cancelled, result: r.result ? JSON.parse(r.result) : null,
  };
}
export function stkSetResult(id, result) {
  db.prepare('UPDATE stk_pending SET result = ? WHERE checkout_request_id = ?').run(JSON.stringify(result), id);
}
export function stkSetCancelled(id) {
  db.prepare('UPDATE stk_pending SET cancelled = 1 WHERE checkout_request_id = ?').run(id);
}
export function stkDelete(id) {
  db.prepare('DELETE FROM stk_pending WHERE checkout_request_id = ?').run(id);
}

/* -------------------------------------------------------------------------- */
/*                                    seeding                                  */
/* -------------------------------------------------------------------------- */

function count(table) {
  return db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
}

export function seedIfEmpty() {
  if (count('users') > 0) return { seeded: false };

  const tx = () => {
    for (const u of seedUsers) putUser(u);
    hashStoredPasswords();
    for (const w of seedWallets) putWallet(w);
    for (const t of seedWalletTransactions) putTransaction(t);
    for (const p of seedPayments) putPayment(p);
    for (const m of seedPaymentMethods) {
      db.prepare('INSERT INTO payment_methods (id,user_id,doc) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING')
        .run(m.id, m.userId ?? '', JSON.stringify(m));
    }
    for (const p of seedProviderConfigs) putProvider(p);
    for (const l of seedProviderLogs) putProviderLog(l);
    for (const k of seedApiKeys) putApiKey(k);
    for (const a of seedAudit) appendAudit(a);
    for (const s of seedSessions) putSession(s);
    for (const u of seedUsage) putUsage(u);
    for (const c of casesData) {
      db.prepare('INSERT INTO cases (id,case_id,subject,status,priority,owner_id,created_at,doc) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING')
        .run(c.id, c.caseId, c.subject, c.status, c.priority, c.ownerId ?? null, c.createdAt ?? '', JSON.stringify(c));
    }
    for (const i of invoicesData) {
      db.prepare('INSERT INTO invoices (id,invoice_no,user_id,date,amount_value,status,doc) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING')
        .run(i.id, i.invoiceNo, i.userId ?? null, i.date ?? '', i.amountValue ?? 0, i.status, JSON.stringify(i));
    }
    for (const n of notificationsData) {
      db.prepare('INSERT INTO notifications (id,user_id,category,type,read,doc) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING')
        .run(n.id, n.userId ?? null, n.category ?? null, n.type ?? null, n.read ? 1 : 0, JSON.stringify(n));
    }
    for (const a of recentActivities) {
      db.prepare('INSERT INTO activities (id,at,doc) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING')
        .run(a.id ?? `act_${Math.random().toString(36).slice(2, 9)}`, a.at ?? a.time ?? new Date().toISOString(), JSON.stringify(a));
    }
    saveSettings(defaultSettings);
    savePricing(pricingCatalog);
  };

  db.exec('BEGIN');
  try {
    tx();
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return {
    seeded: true,
    counts: {
      users: count('users'), wallets: count('wallets'), payments: count('payments'),
      providers: count('providers'), audit: count('audit'), sessions: count('sessions'),
    },
  };
}

export function stats() {
  return {
    users: count('users'),
    wallets: count('wallets'),
    transactions: count('wallet_transactions'),
    payments: count('payments'),
    providers: count('providers'),
    providerLogs: count('provider_logs'),
    apiKeys: count('api_keys'),
    audit: count('audit'),
    sessions: count('sessions'),
    usage: count('usage'),
    cases: count('cases'),
    invoices: count('invoices'),
  };
}
