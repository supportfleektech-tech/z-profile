import { walletFor as dbWalletFor, wallets as dbWallets, walletById as dbWalletById, putWallet as dbPutWallet, users, findUserByEmail, findUser } from './db.mjs';

/**
 * Server-side wallet service wrapper.
 * Re-exports db.mjs wallet functions with consistent naming.
 */

export function walletFor(userId) { return dbWalletFor(userId); }
export function wallets() { return dbWallets(); }
export function walletById(id) { return dbWalletById(id); }
export function putWallet(w) { return dbPutWallet(w); }
export { users, findUserByEmail, findUser };

/**
 * Ensure a wallet exists for a user, creating one if needed.
 * @returns {Object|null}
 */
export function ensureWallet(userId) {
  const existing = dbWalletFor(userId);
  if (existing) return existing;
  const walletId = `w-${userId}`;
  const newWallet = {
    id: `w-${userId}`,
    userId,
    currency: 'KES',
    balance: 0,
    held: 0,
    lifetimeTopUp: 0,
    lifetimeSpend: 0,
    autoTopUp: false,
    autoTopUpTriggerKes: 5000,
    autoTopUpAmountKes: 10000,
    lowBalanceAlertKes: 5000,
    overdraftAllowed: false,
    updatedAt: new Date().toISOString(),
  };
  return newWallet;
}

/**
 * Debit the wallet for a user.
 * @returns {{ok: boolean, message?: string, transaction?: Object}}
 */
export function debitWallet(userId, amount, opts = {}) {
  const w = dbWalletFor(userId);
  if (!w) return { ok: false, message: 'Wallet not found.' };

  if (!opts.force && w.balance < amount) {
    return { ok: false, message: `Insufficient wallet balance. You need KES ${(amount - w.balance).toLocaleString('en-KE')} more.` };
  }

  const transaction = {
    id: `wtx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    walletId: w.id,
    userId,
    userName: (users().find((u) => u.id === userId) || {}).name ?? 'Unknown',
    actorUserId: opts.actor?.id,
    hostUserId: opts.actor?.id && users().find((u) => u.id === opts.actor?.id)?.isSubUser ? users().find((u) => u.id === opts.actor?.id)?.parentUserId : undefined,
    at: new Date().toISOString(),
    direction: 'debit',
    kind: opts.kind,
    amount,
    reference: opts.reference,
    description: opts.description,
    meta: opts.meta,
    status: opts.status ?? 'success',
  };

  w.balance = Math.round((w.balance - amount) * 100) / 100;
  w.updatedAt = new Date().toISOString();
  if (opts.kind === 'topup') w.lifetimeTopUp = Math.round((w.lifetimeTopUp + amount) * 100) / 100;
  if (opts.kind === 'search') w.lifetimeSpend = Math.round((w.lifetimeSpend + amount) * 100) / 100;
  if (transaction.status === 'success') {
    w.held = Math.max(0, w.held - amount);
  }

  dbPutWallet(w);
  return { ok: true, transaction };
}

/**
 * Credit the wallet for a user.
 * @returns {{ok: boolean, message?: string, transaction?: Object}}
 */
export function creditWallet(userId, amount, opts = {}) {
  const w = dbWalletFor(userId);
  if (!w) return { ok: false, message: 'Wallet not found.' };

  const transaction = {
    id: `wtx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    walletId: w.id,
    userId,
    userName: (users().find((u) => u.id === userId) || {}).name ?? 'Unknown',
    actorUserId: opts.actor?.id,
    hostUserId: opts.actor?.id && users().find((u) => u.id === opts.actor?.id)?.isSubUser ? users().find((u) => u.id === opts.actor?.id)?.parentUserId : undefined,
    at: new Date().toISOString(),
    direction: 'credit',
    kind: opts.kind,
    amount,
    reference: opts.reference,
    description: opts.description,
    meta: opts.meta,
    status: opts.status ?? 'success',
  };

  w.balance = Math.round((w.balance + amount) * 100) / 100;
  w.updatedAt = new Date().toISOString();
  if (opts.kind === 'topup') w.lifetimeTopUp = Math.round((w.lifetimeTopUp + amount) * 100) / 100;

  dbPutWallet(w);
  return { ok: true, transaction };
}