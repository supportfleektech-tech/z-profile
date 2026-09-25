import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import express from 'express';
import { SPIN_MODULES } from '../src/data/spinModules.ts';
import { dossierForQuery } from '../src/data/dossier.ts';
import {
  pricing as dbPricing,
  walletFor,
  apiKeyById,
  findUser,
  db,
  putApiKey,
  putWallet,
  putTransaction,
  putUsage,
  appendAudit,
  usageRecords,
} from './db.mjs';
import { assertRequestShape } from './security.mjs';
import * as spin from './spin.mjs';
import { dossierFromSpinResult } from './spin-dossier.mjs';

export const MACHINE_SCOPES = Object.freeze([
  'pricing:read',
  'wallet:read',
  'verify:run',
  'verify:read',
  'report:read',
  'wallet:debit',
]);
export const MACHINE_ENDPOINTS = Object.freeze(['GET /api/v1/pricing', 'GET /api/v1/wallet', 'POST /api/v1/verify']);

export function hashMachineSecret(secret) {
  return createHash('sha256').update(String(secret)).digest('hex');
}

export function issueMachineApiKey({ ownerId, label, scopes, environment = 'sandbox' }) {
  const id = `ak_${randomBytes(8).toString('hex')}`;
  const prefix = `iprs_${environment}_${id}`;
  const secret = `${prefix}.${randomBytes(32).toString('base64url')}`;
  const at = new Date().toISOString();
  return {
    key: {
      id,
      prefix,
      label,
      environment,
      scopes,
      ownerId,
      status: 'active',
      createdAt: at,
      lastUsedAt: null,
      revokedAt: null,
    },
    secret,
  };
}

export function publicApiKey(key) {
  if (!key) return key;
  const { secretHash: _secretHash, secret: _secret, ...record } = key;
  return record;
}

const machineId = (credential) => {
  const match = /^iprs_(?:sandbox|live)_(ak_[a-f0-9]+)\.[A-Za-z0-9_-]+$/.exec(credential);
  return match?.[1] ?? null;
};

const sameSecret = (credential, expectedHash) => {
  const actual = Buffer.from(hashMachineSecret(credential), 'hex');
  const expected = Buffer.from(String(expectedHash ?? ''), 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

const providerItem = (searchType) => {
  const module = SPIN_MODULES.find((entry) => entry.searchType === searchType && entry.pricedItemId);
  if (!module?.pricedItemId) return null;
  return { module, itemId: module.pricedItemId };
};

const publicKeyForUi = (key) => publicApiKey(key);

export function createMachineApiRouter({
  findKey = apiKeyById,
  findUser: findUserById = findUser,
  getPricing = dbPricing,
  getWallet = walletFor,
  touchKey = (key) => putApiKey(key),
  debit,
  refund,
  recordUsage,
  recordSuccess = () => undefined,
  recordFailure,
  recordAudit,
  executeProvider,
  sessionAuthenticate,
  rateLimit = (_req, _res, next) => next(),
}) {
  const router = express.Router();

  const authenticate = (req, res, next) => {
    const authorization = String(req.headers.authorization ?? '');
    const credential = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    const id = machineId(credential);
    const key = id ? findKey(id) : null;
    const owner = key?.ownerId ? findUserById(key.ownerId) : null;
    if (
      !credential ||
      !key ||
      key.status !== 'active' ||
      key.revokedAt ||
      !key.secretHash ||
      !sameSecret(credential, key.secretHash) ||
      !owner
    ) {
      return res.status(401).json({ ok: false, message: 'Invalid machine API credential.' });
    }
    req.machine = { key, owner, scopes: Array.isArray(key.scopes) ? key.scopes : [] };
    try {
      touchKey({ ...key, lastUsedAt: new Date().toISOString() });
    } catch {
      return res.status(500).json({ ok: false, message: 'Machine API credential update failed.' });
    }
    return next();
  };

  const requireScope = (scope) => (req, res, next) => {
    if (!req.machine?.scopes.includes(scope))
      return res.status(403).json({ ok: false, message: `Machine API key requires ${scope}.` });
    return next();
  };

  router.get('/', (_req, res) => {
    res.json({ service: 'iprs-machine-api', scopes: [...MACHINE_SCOPES], endpoints: [...MACHINE_ENDPOINTS] });
  });

  router.get('/pricing', authenticate, requireScope('pricing:read'), rateLimit, (_req, res) => {
    res.json(getPricing());
  });

  router.get('/wallet', authenticate, requireScope('wallet:read'), rateLimit, (req, res) => {
    res.json(getWallet(req.machine.owner.id));
  });

  const verify = async (req, res) => {
    const checked = assertRequestShape(req.body, ['search_type', 'identifier', 'consent']);
    if (!checked.ok) return res.status(400).json({ ok: false, message: checked.message });
    const { search_type: searchType, identifier: rawIdentifier, consent } = checked.value;
    if (typeof searchType !== 'string' || !searchType.trim())
      return res.status(400).json({ ok: false, message: 'search_type must be a non-empty string.' });
    if (typeof rawIdentifier !== 'string' || !rawIdentifier.trim())
      return res.status(400).json({ ok: false, message: 'identifier must be a non-empty string.' });
    if (consent !== true) return res.status(400).json({ ok: false, message: 'consent must be the boolean true.' });
    const selected = providerItem(searchType);
    if (!selected) return res.status(400).json({ ok: false, message: `Unsupported search_type: ${searchType}.` });
    const item = getPricing().items.find((entry) => entry.id === selected.itemId);
    if (!item)
      return res.status(400).json({ ok: false, message: `No catalogue item is configured for ${searchType}.` });
    const requiredKes = item.unitPriceKes;
    const wallet = getWallet(req.machine.owner.id);
    if (!wallet) return res.status(404).json({ ok: false, message: 'API key owner wallet not found.' });
    if (wallet.balance < requiredKes)
      return res.status(402).json({ ok: false, message: 'Insufficient wallet balance.', requiredKes });

    const reference = `DOS-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const debitResult = debit({
      owner: req.machine.owner,
      key: req.machine.key,
      amount: requiredKes,
      reference,
      searchType,
      identifier: rawIdentifier.trim(),
      ip: req.ip,
    });
    if (!debitResult?.usageRecorded)
      recordUsage({
        owner: req.machine.owner,
        key: req.machine.key,
        amount: requiredKes,
        status: 'pending',
        reference,
        searchType,
        identifier: rawIdentifier.trim(),
        ip: req.ip,
      });

    try {
      const result = await executeProvider({
        searchType,
        identifier: rawIdentifier.trim(),
        consent,
        owner: req.machine.owner,
        item,
      });
      if (debitResult?.usageId) {
        const completion = recordSuccess({
          usageId: debitResult.usageId,
          owner: req.machine.owner,
          key: req.machine.key,
          amount: requiredKes,
          reference,
          searchType,
          identifier: rawIdentifier.trim(),
          ip: req.ip,
        });
        if (completion?.auditRecorded === false) {
          recordAudit({
            actor: req.machine.owner,
            key: req.machine.key,
            action: 'machine.verify',
            reference,
            detail: `${searchType} verification completed`,
            ip: req.ip,
            severity: 'success',
          });
        }
      } else {
        recordAudit({
          actor: req.machine.owner,
          key: req.machine.key,
          action: 'machine.verify',
          reference,
          detail: `${searchType} verification completed`,
          ip: req.ip,
          severity: 'success',
        });
      }
      const currentWallet = getWallet(req.machine.owner.id);
      return res.json({
        ok: true,
        result,
        reference,
        costKes: requiredKes,
        balanceKes: currentWallet?.balance ?? wallet.balance - requiredKes,
        wallet: { currency: currentWallet?.currency ?? 'KES', debitedKes: requiredKes },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Provider request failed.';
      const safeReason = reason.slice(0, 200);
      const restored = refund({
        ownerId: req.machine.owner.id,
        amount: requiredKes,
        reference,
        reason: safeReason,
      });
      const failure = recordFailure({
        usageId: debitResult?.usageId,
        owner: req.machine.owner,
        key: req.machine.key,
        amount: requiredKes,
        reference,
        reason: safeReason,
        ip: req.ip,
      });
      if (!failure?.auditRecorded) {
        recordAudit({
          actor: req.machine.owner,
          key: req.machine.key,
          action: 'machine.verify.failed',
          reference,
          detail: failure?.message ?? 'Provider request failed.',
          ip: req.ip,
          severity: 'critical',
        });
      }
      return res
        .status(502)
        .json({
          ok: false,
          message: `Verification provider failed: ${safeReason}`,
          refundKes: requiredKes,
          walletTransactionId: restored?.transactionId,
        });
    }
  };

  const authenticateSession = (req, res, next) => {
    const owner = sessionAuthenticate?.(req);
    if (!owner) return res.status(401).json({ ok: false, message: 'Not authenticated.' });
    req.machine = { key: { id: `session-${owner.id}` }, owner, scopes: ['verify:run', 'wallet:debit'] };
    return next();
  };

  router.post('/verify', authenticate, requireScope('verify:run'), requireScope('wallet:debit'), rateLimit, verify);
  router.post('/verify/session', authenticateSession, rateLimit, verify);

  return router;
}

const execution = async ({ searchType, identifier, consent, owner, item }) => {
  const selected = providerItem(searchType);
  const result = spin.isLive() ? await spin.search(searchType, identifier, { consent }) : dossierForQuery(identifier, '', identifier);
  return dossierFromSpinResult({ result, module: selected.module, item, owner, identifier });
};

export function machineDependencies(applyWalletMovement) {
  return {
    executeProvider: execution,
    touchKey: (key) => putApiKey(key),
    debit: ({ owner, key, amount, reference, searchType, identifier, ip }) => {
      const at = new Date().toISOString();
      const wallet = walletFor(owner.id);
      if (!wallet) throw new Error('API key owner wallet not found.');
      const next = {
        ...wallet,
        balance: wallet.balance - amount,
        lifetimeSpend: wallet.lifetimeSpend + amount,
        updatedAt: at,
      };
      const transaction = {
        id: `wtx_${randomBytes(8).toString('hex')}`,
        walletId: wallet.id,
        userId: owner.id,
        userName: owner.name,
        at,
        direction: 'debit',
        kind: 'search',
        amount,
        balanceAfter: next.balance,
        channel: 'wallet',
        status: 'success',
        reference,
        description: `Machine verification ${searchType} for ${identifier}`,
        gatewayRef: key.id,
        meta: { apiKeyId: key.id, searchType, consentRef: reference },
      };
      const usage = {
        id: `use_${randomBytes(8).toString('hex')}`,
        at,
        userId: owner.id,
        userName: owner.name,
        providerId: itemProvider(searchType),
        providerName: 'IPRS Machine API',
        checkType: searchType,
        costKes: amount,
        status: 'pending',
        latencyMs: 0,
        subjectRef: identifier,
        apiKeyId: key.id,
        reference,
      };
      const auditEntry = {
        actorId: owner.id,
        actorName: owner.name,
        actorTier: owner.tier,
        action: 'machine.verify.requested',
        entity: 'ApiKey',
        entityId: key.id,
        severity: 'info',
        ip,
        detail: `Machine verification ${searchType} requested (${reference})`,
        meta: { apiKeyId: key.id, reference },
      };
      db.exec('BEGIN');
      try {
        putWallet(next);
        putTransaction(transaction);
        putUsage(usage);
        appendAudit(auditEntry);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return { transactionId: transaction.id, usageId: usage.id, usageRecorded: true, auditRecorded: true };
    },
    refund: ({ ownerId, amount, reference, reason }) =>
      applyWalletMovement({
        userId: ownerId,
        amount,
        direction: 'credit',
        kind: 'reversal',
        channel: 'wallet',
        status: 'success',
        reference: `REFUND-${reference}`,
        description: `Provider failure refund — ${reason}`,
        gatewayRef: reference,
      }).transaction,
    recordUsage: () => undefined,
    recordSuccess: ({ usageId, owner, key, amount, reference, searchType, ip }) => {
      const existing = usageRecords(1000).find((entry) => entry.id === usageId);
      if (!existing) return { auditRecorded: false };
      const completed = { ...existing, status: 'success', apiKeyId: key.id, reference, costKes: amount, checkType: searchType, at: new Date().toISOString() };
      db.exec('BEGIN');
      try {
        putUsage(completed);
        appendAudit({
          actorId: owner.id,
          actorName: owner.name,
          actorTier: owner.tier,
          action: 'machine.verify',
          entity: 'ApiKey',
          entityId: key.id,
          severity: 'success',
          ip,
          detail: `Machine verification ${searchType} completed (${reference})`,
          meta: { apiKeyId: key.id, reference },
        });
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return { auditRecorded: true };
    },
    recordFailure: ({ usageId, owner, key, amount, reference, reason, ip }) => {
      const at = new Date().toISOString();
      const existing = usageId ? usageRecords(1000).find((entry) => entry.id === usageId) : null;
      const failure = {
        ...(existing ?? {}),
        id: usageId ?? `use_fail_${randomBytes(8).toString('hex')}`,
        at,
        userId: owner.id,
        userName: owner.name,
        providerId: existing?.providerId ?? itemProvider('machine'),
        providerName: existing?.providerName ?? 'IPRS Machine API',
        checkType: existing?.checkType ?? 'provider_failure',
        costKes: amount,
        status: 'failed',
        latencyMs: existing?.latencyMs ?? 0,
        subjectRef: existing?.subjectRef ?? reference,
        apiKeyId: key.id,
        reference,
        failureReason: reason,
      };
      db.exec('BEGIN');
      try {
        putUsage(failure);
        appendAudit({
          actorId: owner.id,
          actorName: owner.name,
          actorTier: owner.tier,
          action: 'machine.verify.failed',
          entity: 'ApiKey',
          entityId: key.id,
          severity: 'critical',
          ip,
          detail: `Provider failure for ${reference}: ${reason}`,
          meta: { apiKeyId: key.id, reference },
        });
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return { message: reason, auditRecorded: true };
    },
    recordAudit: () => undefined,
  };
}

const itemProvider = (searchType) => {
  const selected = providerItem(searchType);
  return selected?.itemId === 'kyc-id' ? 'civil' : (selected?.module.id ?? 'machine');
};

export { publicKeyForUi };
