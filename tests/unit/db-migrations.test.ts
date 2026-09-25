import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { createBackup, migrateDb, restoreBackup } from '../../server/db.mjs';

const databases: DatabaseSync[] = [];

function newDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  databases.push(database);
  return database;
}

function backupFixture(database: DatabaseSync) {
  database.prepare(`INSERT INTO users (id,name,email,password,phone,department,job_title,tier,sub_role,status,is_system,mfa_enabled,created_at,failed_logins,doc)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    'usr_1', 'Backup User', 'backup@example.test', 's1$fixture', '', '', '', 'user', 'analyst', 'Active', 0, 0,
    '2026-01-01T00:00:00.000Z', 0,
    JSON.stringify({ id: 'usr_1', name: 'Backup User', email: 'backup@example.test', password: 's1$fixture', phone: '', department: '', jobTitle: '', tier: 'user', subRole: 'analyst', status: 'Active', isSystem: false, mfaEnabled: false, createdAt: '2026-01-01T00:00:00.000Z', failedLoginAttempts: 0, walletId: 'wal_1' }),
  );
  database.prepare(`INSERT INTO sessions (id,user_id,user_name,tier,started_at,last_seen_at,current,doc) VALUES (?,?,?,?,?,?,?,?)`).run(
    'ses_1', 'usr_1', 'Backup User', 'user', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 1, JSON.stringify({ id: 'ses_1', userId: 'usr_1', userName: 'Backup User', tier: 'user', ip: '', device: 'Browser', browser: 'Chrome', location: 'Nairobi', startedAt: '2026-01-01T00:00:00.000Z', lastSeenAt: '2026-01-01T00:00:00.000Z', current: true }),
  );
  database.prepare(`INSERT INTO stk_pending (checkout_request_id,merchant_request_id,user_id,phone,amount,started_at,settle_after,cancelled) VALUES (?,?,?,?,?,?,?,?)`).run(
    'ws_live_1', 'merchant_1', 'usr_1', '254712345678', 1000, Date.now(), Date.now() + 10000, 0,
  );
  database.prepare(`INSERT INTO kv (k,v,updated_at) VALUES (?,?,?)`).run('authSecret', JSON.stringify('signing-secret'), '2026-01-01T00:00:00.000Z');
  database.prepare(`INSERT INTO kv (k,v,updated_at) VALUES (?,?,?)`).run('daraja.callbackToken', JSON.stringify('callback-secret'), '2026-01-01T00:00:00.000Z');
}

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

describe('database migrations', () => {
  it('creates a new database at the current forward-only schema version', () => {
    const database = newDatabase();
    const result = migrateDb(database);

    expect(result.from).toBe(0);
    expect(result.to).toBe(1);
    expect(database.prepare('PRAGMA user_version').get()?.user_version).toBe(1);
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'stk_pending'").get()).toBeTruthy();
  });

  it('stamps a complete pre-versioned database without resetting its rows', () => {
    const database = newDatabase();
    migrateDb(database);
    database.exec('PRAGMA user_version = 0;');
    database.prepare('INSERT INTO kv (k,v,updated_at) VALUES (?,?,?)').run('marker', JSON.stringify(true), '2026-01-01T00:00:00.000Z');

    const result = migrateDb(database);

    expect(result).toEqual({ from: 0, to: 1, stamped: true });
    expect(database.prepare('PRAGMA user_version').get()?.user_version).toBe(1);
    expect(database.prepare('SELECT v FROM kv WHERE k = ?').get('marker')?.v).toBe('true');
  });

  it('does not stamp a pre-versioned database missing required columns', () => {
    const database = newDatabase();
    migrateDb(database);
    database.exec('ALTER TABLE users DROP COLUMN doc');
    database.exec('PRAGMA user_version = 0;');

    expect(() => migrateDb(database)).toThrow(/required schema/i);
    expect(database.prepare('PRAGMA user_version').get()?.user_version).toBe(0);
  });
});

describe('backup and restore', () => {
  it('exports public domain data without sessions, STK intents, or credentials', () => {
    const database = newDatabase();
    migrateDb(database);
    backupFixture(database);

    const backup = createBackup(database);

    expect(backup.format).toBe('iprs-backup');
    expect(backup.version).toBe(1);
    expect(backup.data.users[0]).toMatchObject({ id: 'usr_1', email: 'backup@example.test' });
    expect(backup.data.users[0]).not.toHaveProperty('password');
    expect(backup.data).not.toHaveProperty('sessions');
    expect(backup.data).not.toHaveProperty('stk_pending');
    expect(JSON.stringify(backup)).not.toContain('signing-secret');
    expect(JSON.stringify(backup)).not.toContain('callback-secret');
  });

  it('preserves existing secrets when restoring redacted settings', () => {
    const database = newDatabase();
    migrateDb(database);
    const settings = {
      billing: { mpesaPasskey: 'keep-mpesa' },
      integrations: {
        smsApiKey: 'keep-sms',
        webhooks: [{ id: 'wh-1', secret: 'keep-webhook' }],
      },
    };
    database.prepare('INSERT INTO kv (k,v,updated_at) VALUES (?,?,?)').run('settings', JSON.stringify(settings), '2026-01-01T00:00:00.000Z');
    backupFixture(database);

    const backup = createBackup(database);
    restoreBackup(backup, database);

    const restoredRow = database.prepare('SELECT v FROM kv WHERE k = ?').get('settings');
    const restored = JSON.parse(String(restoredRow?.v));
    expect(restored.billing.mpesaPasskey).toBe('keep-mpesa');
    expect(restored.integrations.smsApiKey).toBe('keep-sms');
    expect(restored.integrations.webhooks[0].secret).toBe('keep-webhook');
    expect(JSON.parse(String(database.prepare('SELECT v FROM kv WHERE k = ?').get('authSecret')?.v))).toBe('signing-secret');
    expect(JSON.parse(String(database.prepare('SELECT v FROM kv WHERE k = ?').get('daraja.callbackToken')?.v))).toBe('callback-secret');
  });

  it('revokes machine API keys that cannot be restored with their secret hash', () => {
    const source = newDatabase();
    const destination = newDatabase();
    migrateDb(source);
    migrateDb(destination);
    backupFixture(source);
    const key = {
      id: 'ak_source', label: 'Source key', prefix: 'iprs_sandbox_source', secretHash: 'source-hash',
      scopes: ['pricing:read'], ownerId: 'usr_1', status: 'active', environment: 'sandbox', lastUsedAt: null, revokedAt: null,
    };
    source.prepare(`INSERT INTO api_keys (id,label,prefix,secret_hash,scopes,owner_id,status,environment,doc)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(
      key.id, key.label, key.prefix, key.secretHash, JSON.stringify(key.scopes), key.ownerId, key.status, key.environment, JSON.stringify(key),
    );

    const backup = createBackup(source);
    restoreBackup(backup, destination);

    const row = destination.prepare('SELECT secret_hash,status,revoked_at,doc FROM api_keys WHERE id = ?').get(key.id) as {
      secret_hash: string | null;
      status: string;
      revoked_at: string | null;
      doc: string;
    };
    expect(row.secret_hash).toBeNull();
    expect(row.status).toBe('revoked');
    expect(row.revoked_at).toBeTruthy();
    expect(JSON.parse(row.doc)).toMatchObject({ secretHash: null, status: 'revoked' });
  });

  it('preserves machine API key hashes in the persisted API-key document', () => {
    const database = newDatabase();
    migrateDb(database);
    const key = {
      id: 'ak_fixture', label: 'Machine key', prefix: 'iprs_sandbox_fixture', secretHash: 'machine-hash',
      scopes: ['pricing:read'], ownerId: 'usr_1', status: 'active', environment: 'sandbox', lastUsedAt: null, revokedAt: null,
    };
    database.prepare(`INSERT INTO api_keys (id,label,prefix,secret_hash,scopes,owner_id,status,environment,doc)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(
      key.id, key.label, key.prefix, key.secretHash, JSON.stringify(key.scopes), key.ownerId, key.status, key.environment, JSON.stringify(key),
    );

    const backup = createBackup(database);
    restoreBackup(backup, database);

    const restored = JSON.parse(String(database.prepare('SELECT doc FROM api_keys WHERE id = ?').get(key.id)?.doc));
    expect(restored.secretHash).toBe('machine-hash');
  });

  it('preserves provider authentication configuration across restore', () => {
    const database = newDatabase();
    migrateDb(database);
    const provider = {
      id: 'prov_fixture', name: 'Fixture provider', code: 'FIXTURE', category: 'Test', enabled: true,
      environment: 'sandbox', status: 'Active', latencyMs: 0, costPerCallKes: 0,
      authType: 'oauth2', consumerKey: 'public-client', consumerSecret: 'keep-provider-secret',
      tokenUrl: 'https://provider.example.test/oauth/token', certificateRef: 'vault://certs/fixture', webhookSecret: 'keep-webhook-secret',
    };
    database.prepare(`INSERT INTO providers (id,name,code,category,enabled,environment,status,latency_ms,cost_per_call,updated_at,doc)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      provider.id, provider.name, provider.code, provider.category, 1, provider.environment, provider.status, provider.latencyMs, provider.costPerCallKes, '2026-01-01T00:00:00.000Z', JSON.stringify(provider),
    );

    const backup = createBackup(database);
    restoreBackup(backup, database);

    const restored = JSON.parse(String(database.prepare('SELECT doc FROM providers WHERE id = ?').get(provider.id)?.doc));
    expect(restored).toMatchObject({
      authType: provider.authType,
      consumerKey: provider.consumerKey,
      consumerSecret: provider.consumerSecret,
      tokenUrl: provider.tokenUrl,
      certificateRef: provider.certificateRef,
      webhookSecret: provider.webhookSecret,
    });
  });

  it('rejects credential material in an uploaded backup', () => {
    const database = newDatabase();
    migrateDb(database);
    backupFixture(database);
    const backup = createBackup(database);
    backup.data.users[0].password = 'injected-password';

    expect(() => restoreBackup(backup, database)).toThrow(/credential/i);
    expect(database.prepare('SELECT COUNT(*) AS n FROM users').get()?.n).toBe(1);
  });

  it('rejects invalid versions before applying data', () => {
    const database = newDatabase();
    migrateDb(database);
    backupFixture(database);
    const backup = createBackup(database);

    expect(() => restoreBackup({ ...backup, version: 99 }, database)).toThrow(/version/i);
    expect(database.prepare('SELECT COUNT(*) AS n FROM users').get()?.n).toBe(1);
  });

  it('rolls back every collection when a restore fails mid-transaction', () => {
    const database = newDatabase();
    migrateDb(database);
    backupFixture(database);
    const backup = createBackup(database);
    const invalid = structuredClone(backup);
    invalid.data.users = [];
    invalid.data.providers = [{ id: 'prov_invalid', name: null, code: 'BROKEN' }];

    expect(() => restoreBackup(invalid, database)).toThrow();
    expect(database.prepare('SELECT COUNT(*) AS n FROM users').get()?.n).toBe(1);
    expect(database.prepare('SELECT COUNT(*) AS n FROM providers').get()?.n).toBe(0);
  });
});
