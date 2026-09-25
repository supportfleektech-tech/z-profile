import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import express from 'express';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createMachineApiRouter, hashMachineSecret, MACHINE_ENDPOINTS, MACHINE_SCOPES } from '../../server/apiv1.mjs';
import { dossierFromSpinResult } from '../../server/spin-dossier.mjs';
import { normalizeResponse } from '../../server/spin.mjs';
import { SPIN_MODULES } from '../../src/data/spinModules';

const secret = 'iprs_sandbox_ak_a1.once-only-secret';
const owner = {
  id: 'u-owner',
  name: 'Machine Owner',
  email: 'owner@example.test',
  tier: 'user',
  subRole: 'analyst',
};
let server: Server;
let baseUrl: string;
let mode: 'success' | 'failure' = 'success';
let balance = 1000;
let debits: { amount: number; reference: string; keyId: string; ownerId: string }[] = [];
let refunds: { amount: number; reference: string; reason: string }[] = [];
let usage: { userId: string; apiKeyId: string; costKes: number; status: string }[] = [];
let audit: { actorId: string; apiKeyId: string; action: string }[] = [];

const key = {
  id: 'ak_a1',
  label: 'Test integration',
  prefix: 'iprs_sandbox_ak_test',
  secretHash: hashMachineSecret(secret),
  scopes: [...MACHINE_SCOPES],
  ownerId: owner.id,
  status: 'active',
  environment: 'sandbox',
  createdAt: new Date().toISOString(),
};

const router = () =>
  createMachineApiRouter({
    findKey: (id: string) => (id === key.id ? key : null),
    findUser: (id: string) => (id === owner.id ? owner : null),
    getPricing: () => ({ items: [{ id: 'kyc-id', name: 'IPRS Standard', unitPriceKes: 30 }] }),
    getWallet: () => ({ id: 'wal-owner', userId: owner.id, currency: 'KES', balance, held: 0 }),
    touchKey: () => undefined,
    debit: ({
      amount,
      reference,
      owner,
      key: apiKey,
    }: {
      amount: number;
      reference: string;
      owner: { id: string };
      key: { id: string };
    }) => {
      balance -= amount;
      debits.push({ amount, reference, keyId: apiKey.id, ownerId: owner.id });
      return { transactionId: `wtx-${debits.length}`, usageId: `use-${debits.length}` };
    },
    refund: ({ amount, reference, reason }: { amount: number; reference: string; reason: string }) => {
      balance += amount;
      refunds.push({ amount, reference, reason });
      return { transactionId: `wtx-refund-${refunds.length}` };
    },
    recordUsage: ({
      owner,
      key: apiKey,
      amount,
      status,
    }: {
      owner: { id: string };
      key: { id: string };
      amount: number;
      status: string;
    }) => {
      usage.push({ userId: owner.id, apiKeyId: apiKey.id, costKes: amount, status });
    },
    recordSuccess: ({ owner, key: apiKey }: { owner: { id: string }; key: { id: string } }) => {
      const entry = usage[0];
      if (entry) entry.status = 'success';
      audit.push({ actorId: owner.id, apiKeyId: apiKey.id, action: 'machine.verify' });
    },
    recordFailure: ({ usageId }: { usageId: string }) => {
      const entry = usage.find((item) => !('id' in item));
      if (entry) entry.status = 'failed';
      return { usageId };
    },
    recordAudit: ({ actor, key: apiKey, action }: { actor: { id: string }; key: { id: string }; action: string }) => {
      audit.push({ actorId: actor.id, apiKeyId: apiKey.id, action });
    },
    executeProvider: async ({ searchType, identifier, owner, item }: {
      searchType: string;
      identifier: string;
      owner: { name: string; tier: 'user' | 'admin' | 'super_admin' };
      item: { id: string; unitPriceKes: number };
    }) => {
      const provider = normalizeResponse(
        mode === 'failure'
          ? { code: '402.001', message: 'Consent required', data: null }
          : {
              code: '200.001',
              data: {
                id_number: identifier,
                first_name: 'Verified',
                surname: 'Subject',
                match_status: 'MATCH',
                confidence: 0.99,
              },
            },
      );
      return dossierFromSpinResult({
        result: provider,
        module: SPIN_MODULES.find((entry) => entry.searchType === searchType)!,
        item,
        owner,
        identifier,
      });
    },
    sessionAuthenticate: () => owner,
  });

const call = async (method: 'GET' | 'POST', pathName: string, body?: unknown, credential = secret) => {
  const response = await fetch(`${baseUrl}${pathName}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
};

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', router());
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port.');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(() => {
  mode = 'success';
  balance = 1000;
  debits = [];
  refunds = [];
  usage = [];
  audit = [];
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

describe('machine API v1', () => {
  it('publishes the exact scope and endpoint catalogue', async () => {
    const response = await call('GET', '/api/v1');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      service: 'iprs-machine-api',
      scopes: ['pricing:read', 'wallet:read', 'verify:run', 'verify:read', 'report:read', 'wallet:debit'],
      endpoints: MACHINE_ENDPOINTS,
    });
  });

  it('rejects a missing machine credential with 401', async () => {
    const response = await call('GET', '/api/v1/wallet', undefined, '');
    expect(response.status).toBe(401);
  });

  it('rejects a key without the required scope with 403', async () => {
    const scopedKey = { ...key, scopes: ['pricing:read'] };
    const app = express();
    app.use(express.json());
    app.use(
      '/api/v1',
      createMachineApiRouter({
        findKey: () => scopedKey,
        findUser: () => owner,
        getPricing: () => ({ items: [] }),
        getWallet: () => ({ userId: owner.id }),
        touchKey: () => undefined,
        debit: () => ({ transactionId: 'unused' }),
        refund: () => ({ transactionId: 'unused' }),
        recordUsage: () => undefined,
        recordFailure: () => ({ usageId: 'unused' }),
        recordAudit: () => undefined,
        executeProvider: async () => ({}),
      }),
    );
    const local = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    const address = local.address();
    if (!address || typeof address === 'string') throw new Error('Scoped test server did not bind.');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/wallet`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    await new Promise<void>((resolve, reject) => local.close((error) => (error ? reject(error) : resolve())));
    expect(response.status).toBe(403);
  });

  it('rejects non-boolean consent with 400', async () => {
    const response = await call('POST', '/api/v1/verify', {
      search_type: 'identity',
      identifier: '12345678',
      consent: 'true',
    });
    expect(response.status).toBe(400);
  });

  it('returns 402 with the catalogue rate when the owner wallet is short', async () => {
    balance = 29;
    const response = await call('POST', '/api/v1/verify', {
      search_type: 'identity',
      identifier: '12345678',
      consent: true,
    });
    expect(response.status).toBe(402);
    expect(response.body).toMatchObject({ ok: false, requiredKes: 30 });
    expect(debits).toHaveLength(0);
  });

  it('debits the catalogue rate and attributes usage and audit to the owner key', async () => {
    const response = await call('POST', '/api/v1/verify', {
      search_type: 'identity',
      identifier: '12345678',
      consent: true,
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, costKes: 30, balanceKes: 970 });
    expect(response.body.result).toMatchObject({ subject: { fullName: 'Verified Subject' }, sections: [{ provider: 'Spin Mobile · IPRS Identity Verification' }] });
    expect(debits[0]).toMatchObject({ amount: 30, keyId: key.id, ownerId: owner.id });
    expect(debits[0]?.reference).toMatch(/^DOS-\d{4}-[A-F0-9]{8}$/);
    expect(usage).toEqual([{ userId: owner.id, apiKeyId: key.id, costKes: 30, status: 'success' }]);
    expect(audit).toEqual([{ actorId: owner.id, apiKeyId: key.id, action: 'machine.verify' }]);
  });

  it('uses the same transaction path for session-backed verification', async () => {
    const response = await call('POST', '/api/v1/verify/session', {
      search_type: 'identity',
      identifier: '12345678',
      consent: true,
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, costKes: 30, balanceKes: 970 });
    expect(debits[0]).toMatchObject({ amount: 30, ownerId: owner.id, keyId: `session-${owner.id}` });
    expect(usage[0]?.status).toBe('success');
    expect(audit.map((entry) => entry.action)).toContain('machine.verify');
  });

  it('records provider failure and refunds the same amount', async () => {
    mode = 'failure';
    const response = await call('POST', '/api/v1/verify', {
      search_type: 'identity',
      identifier: '12345678',
      consent: true,
    });
    expect(response.status).toBe(502);
    expect(response.body.message).toContain('Consent required');
    expect(balance).toBe(1000);
    expect(debits).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ amount: 30, reason: 'Consent required' });
    expect(refunds[0]?.reference).toMatch(/^DOS-\d{4}-[A-F0-9]{8}$/);
    expect(usage[0]?.status).toBe('failed');
    expect(audit.map((entry) => entry.action)).toContain('machine.verify.failed');
  });

  it('stores only the SHA-256 digest returned with a one-time secret', async () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), 'iprs-apiv1-unit-'));
    const previousDb = process.env.IPRS_DB;
    process.env.IPRS_DB = path.join(dataDir, 'keys.sqlite');
    vi.resetModules();
    const module = await import('../../server/db.mjs');
    const issued = module.putApiKey({ ...key, secret });
    const stored = module.apiKeys().find((item) => item.id === key.id);
    expect(issued).not.toHaveProperty('secret');
    expect(stored).not.toHaveProperty('secret');
    expect(stored?.secretHash).toBe(hashMachineSecret(secret));
    expect(JSON.stringify(stored)).not.toContain(secret);
    module.db.close();
    if (previousDb === undefined) delete process.env.IPRS_DB;
    else process.env.IPRS_DB = previousDb;
    rmSync(dataDir, { recursive: true, force: true });
  });
});
