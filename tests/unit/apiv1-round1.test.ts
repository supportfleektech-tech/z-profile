import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import type { Wallet } from '../../src/types';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const dataDir = mkdtempSync(path.join(tmpdir(), 'iprs-apiv1-round1-'));
let database: typeof import('../../server/db.mjs');
let apiv1: typeof import('../../server/apiv1.mjs');
let server: Server;
let originalWallet: Wallet;
let originalFetch: typeof fetch;
const originalEnvironment = { ...process.env };

type WalletMovementInput = {
  userId: string;
  amount: number;
  direction: 'credit' | 'debit';
  kind: string;
  channel: string;
  status: string;
  reference: string;
  description: string;
  gatewayRef?: string;
};

const applyRealWalletMovement = (movement: Record<string, unknown>) => {
  const { userId, amount, direction, kind, channel, status, reference, description, gatewayRef } = movement as WalletMovementInput;
  const wallet = database.walletFor(userId) as unknown as Wallet;
  if (!wallet) throw new Error('wallet not found');
  const at = new Date().toISOString();
  const balanceAfter = Math.round((wallet.balance + (direction === 'credit' ? amount : -amount)) * 100) / 100;
  const next = {
    ...wallet,
    balance: balanceAfter,
    lifetimeSpend: kind === 'search' ? wallet.lifetimeSpend + amount : kind === 'reversal' ? Math.max(0, wallet.lifetimeSpend - amount) : wallet.lifetimeSpend,
    updatedAt: at,
  };
  const transaction = {
    id: `wtx_test_${randomBytes(6).toString('hex')}`,
    walletId: wallet.id,
    userId,
    userName: 'Admin',
    at,
    direction,
    kind,
    amount,
    balanceAfter,
    channel,
    status,
    reference,
    description,
    gatewayRef,
  };
  database.db.exec('BEGIN');
  try {
    database.putWallet(next);
    database.putTransaction(transaction);
    database.db.exec('COMMIT');
  } catch (error) {
    database.db.exec('ROLLBACK');
    throw error;
  }
  return { wallet: next, transaction };
};

const makeKey = () => {
  const id = `ak_${randomBytes(8).toString('hex')}`;
  const secret = `iprs_sandbox_${id}.${randomBytes(32).toString('base64url')}`;
  database.putApiKey({
    id,
    label: 'Round 1 integration key',
    prefix: `iprs_sandbox_${id}`,
    secretHash: apiv1.hashMachineSecret(secret),
    scopes: ['verify:run', 'wallet:debit'],
    ownerId: 'u-admin',
    status: 'active',
    environment: 'sandbox',
    createdAt: new Date().toISOString(),
  });
  return { id, secret };
};

const assertFailureAccounting = (keyId: string) => {
  const usage = database.usageRecords(1000).filter((entry) => entry.apiKeyId === keyId);
  expect(usage).toHaveLength(1);
  expect(usage[0].status).toBe('failed');
  const indexed = database.db.prepare('SELECT status FROM usage WHERE id = ?').get(usage[0].id) as { status: string };
  expect(indexed.status).toBe('failed');
  const audit = database.auditLog({ limit: 1000 }).filter((entry) => entry.entityId === keyId);
  expect(audit.map((entry) => entry.action).sort()).toEqual(['machine.verify.failed', 'machine.verify.requested']);
};

beforeAll(async () => {
  process.env.IPRS_DB = path.join(dataDir, 'round1.sqlite');
  process.env.SPIN_CONSUMER_KEY = 'round1-key';
  process.env.SPIN_CONSUMER_SECRET = 'round1-secret';
  originalFetch = globalThis.fetch;
  vi.resetModules();
  database = await import('../../server/db.mjs');
  apiv1 = await import('../../server/apiv1.mjs');
  database.seedIfEmpty();
  originalWallet = database.walletFor('u-admin') as unknown as Wallet;
  const app = express();
  app.use(express.json());
  const dependencies = apiv1.machineDependencies(applyRealWalletMovement);
  app.use('/api/v1', apiv1.createMachineApiRouter(dependencies));
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Integration server did not bind.');
});

afterAll(async () => {
  globalThis.fetch = originalFetch;
  database.db.close();
  process.env = { ...originalEnvironment };
  rmSync(dataDir, { recursive: true, force: true });
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

describe('machine provider failure accounting', () => {
  it('refunds and records one failed usage plus coherent requested/failed audits', async () => {
    const key = makeKey();
    const dependencies = apiv1.machineDependencies(applyRealWalletMovement);
    dependencies.executeProvider = async () => {
      throw new Error('provider unavailable');
    };
    const app = express();
    app.use(express.json());
    app.use('/api/v1', apiv1.createMachineApiRouter(dependencies));
    const local = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    const address = local.address();
    if (!address || typeof address === 'string') throw new Error('Failure server did not bind.');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key.secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ search_type: 'identity', identifier: '23456789', consent: true }),
    });
    expect(response.status).toBe(502);
    expect(database.walletFor('u-admin')?.balance).toBe(originalWallet.balance);
    assertFailureAccounting(key.id);
    await new Promise<void>((resolve, reject) => local.close((error) => (error ? reject(error) : resolve())));
  });

  it('rejects a 200 provider failure envelope through the production Spin path', async () => {
    const key = makeKey();
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/analytics/auth/')) {
        return { ok: true, status: 200, json: async () => ({ token: 'round1-token', expires: 0 }) } as unknown as Response;
      }
      return { ok: true, status: 200, json: async () => ({ response_code: '400', success: false, message: 'provider rejected', data: null }) } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    const dependencies = apiv1.machineDependencies(applyRealWalletMovement);
    const app = express();
    app.use(express.json());
    app.use('/api/v1', apiv1.createMachineApiRouter(dependencies));
    const local = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    const address = local.address();
    if (!address || typeof address === 'string') throw new Error('Envelope server did not bind.');
    const response = await originalFetch(`http://127.0.0.1:${address.port}/api/v1/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key.secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ search_type: 'identity', identifier: '23456789', consent: true }),
    });
    expect(response.status).toBe(502);
    expect(database.walletFor('u-admin')?.balance).toBe(originalWallet.balance);
    assertFailureAccounting(key.id);
    expect(fetchMock).toHaveBeenCalled();
    await new Promise<void>((resolve, reject) => local.close((error) => (error ? reject(error) : resolve())));
  });
});
