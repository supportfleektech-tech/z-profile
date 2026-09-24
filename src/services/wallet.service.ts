import type { MpesaStkResult, PaymentChannel, PaymentRecord, SystemUser, Wallet, WalletTransaction } from '../types';
import { getSnapshot, setState, ensureWallet } from './db';
import { apiOr } from './http';
import { auditService } from './auth.service';
import { cardBrand, luhn, maskCard, maskMsisdn, normalizeMsisdn, sleep, uid } from '../lib/format';

/**
 * Wallet + payments.
 *
 * The M-PESA flow models the real Safaricom Daraja STK Push lifecycle: a checkout request
 * is created, the customer is prompted on the handset, and a callback returns a
 * `ResultCode`. Card payments model a PaymentIntent plus a 3-D Secure challenge. Swapping
 * the simulated gateway for live Daraja/Pesapal credentials is a server-side change only —
 * these signatures are the contract.
 */

/* ------------------------------ STK simulation ------------------------------ */

interface PendingStk {
  checkoutRequestID: string;
  merchantRequestID: string;
  phone: string;
  amount: number;
  userId: string;
  startedAt: number;
  resolve: (r: MpesaStkResult) => void;
  cancelled: boolean;
  timer: ReturnType<typeof setTimeout>;
}

const pendingStk = new Map<string, PendingStk>();

function receiptCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/* --------------------------------- service --------------------------------- */

export interface TopUpRequest {
  userId: string;
  amount: number;
  phone?: string;
}

export interface TopUpOutcome {
  ok: boolean;
  status: PaymentRecord['status'];
  message: string;
  payment?: PaymentRecord;
  transaction?: WalletTransaction;
  raw?: MpesaStkResult | Record<string, unknown>;
}

export const walletService = {
  for(userId: string): Wallet {
    return ensureWallet(userId);
  },

  all(): Wallet[] {
    return getSnapshot().wallets;
  },

  transactions(filter: { userId?: string; kind?: string; status?: string; limit?: number } = {}): WalletTransaction[] {
    const s = getSnapshot();
    return s.walletTransactions
      .filter((t) => (!filter.userId || t.userId === filter.userId) && (!filter.kind || t.kind === filter.kind) && (!filter.status || t.status === filter.status))
      .slice(0, filter.limit ?? 500);
  },

  payments(filter: { userId?: string; channel?: PaymentChannel; status?: string; from?: string; to?: string; limit?: number } = {}): PaymentRecord[] {
    const s = getSnapshot();
    return s.payments
      .filter((p) => {
        if (filter.userId && p.userId !== filter.userId) return false;
        if (filter.channel && p.channel !== filter.channel) return false;
        if (filter.status && p.status !== filter.status) return false;
        if (filter.from && new Date(p.at) < new Date(filter.from)) return false;
        if (filter.to && new Date(p.at) > new Date(filter.to)) return false;
        return true;
      })
      .slice(0, filter.limit ?? 1000);
  },

  /** Credit a wallet and record the transaction + payment. Internal, but exported for tests. */
  creditWallet(userId: string, amount: number, opts: {
    channel: PaymentChannel;
    kind: WalletTransaction['kind'];
    reference: string;
    description: string;
    gatewayRef?: string;
    status?: WalletTransaction['status'];
    payment?: Omit<PaymentRecord, 'id' | 'userId' | 'at' | 'walletTransactionId'>;
    actor?: SystemUser | null;
  }): { transaction: WalletTransaction; payment?: PaymentRecord } {
    const wallet = ensureWallet(userId);
    const status = opts.status ?? 'success';
    const credited = status === 'success' ? amount : 0;
    const txId = uid('wt');
    const transaction: WalletTransaction = {
      id: txId,
      walletId: wallet.id,
      userId,
      userName: getSnapshot().users.find((u) => u.id === userId)?.name ?? 'Unknown',
      at: new Date().toISOString(),
      direction: 'credit',
      kind: opts.kind,
      amount,
      balanceAfter: wallet.balance + credited,
      channel: opts.channel,
      status,
      reference: opts.reference,
      description: opts.description,
      gatewayRef: opts.gatewayRef,
    };

    let payment: PaymentRecord | undefined;
    if (opts.payment) {
      payment = { ...opts.payment, id: uid('pay'), userId, at: transaction.at, walletTransactionId: status === 'success' ? txId : undefined };
    }

    setState((prev) => ({
      walletTransactions: [transaction, ...prev.walletTransactions],
      payments: payment ? [payment, ...prev.payments] : prev.payments,
      wallets: prev.wallets.map((w) =>
        w.id === wallet.id
          ? { ...w, balance: w.balance + credited, lifetimeTopUp: w.lifetimeTopUp + credited, updatedAt: transaction.at }
          : w
      ),
    }));
    return { transaction, payment };
  },

  /** Debit a wallet (search charges, subscriptions). Returns false on insufficient funds. */
  debitWallet(userId: string, amount: number, opts: {
    kind: WalletTransaction['kind'];
    reference: string;
    description: string;
    meta?: Record<string, string | number>;
    force?: boolean;
  }): { ok: boolean; message?: string; transaction?: WalletTransaction } {
    const wallet = ensureWallet(userId);
    const s = getSnapshot();
    if (amount <= 0) return { ok: false, message: 'Amount must be greater than zero.' };
    if (!opts.force && wallet.balance < amount) {
      if (!wallet.overdraftAllowed && s.settings.billing.blockSearchOnNegativeBalance) {
        return { ok: false, message: `Insufficient wallet balance. You need KES ${(amount - wallet.balance).toLocaleString('en-KE')} more.` };
      }
    }
    const transaction: WalletTransaction = {
      id: uid('wt'),
      walletId: wallet.id,
      userId,
      userName: s.users.find((u) => u.id === userId)?.name ?? 'Unknown',
      at: new Date().toISOString(),
      direction: 'debit',
      kind: opts.kind,
      amount,
      balanceAfter: wallet.balance - amount,
      channel: 'wallet',
      status: 'success',
      reference: opts.reference,
      description: opts.description,
      meta: opts.meta,
    };
    setState((prev) => ({
      walletTransactions: [transaction, ...prev.walletTransactions],
      wallets: prev.wallets.map((w) =>
        w.id === wallet.id ? { ...w, balance: w.balance - amount, lifetimeSpend: w.lifetimeSpend + amount, updatedAt: transaction.at } : w
      ),
      usage: prev.usage,
    }));
    auditService.append({
      actorId: userId,
      actorName: transaction.userName,
      actorTier: s.users.find((u) => u.id === userId)?.tier ?? 'user',
      action: 'wallet.debit',
      entity: 'Wallet',
      entityId: wallet.id,
      severity: 'info',
      ip: s.users.find((u) => u.id === userId)?.lastLoginIp ?? '0.0.0.0',
      detail: `KES ${amount.toLocaleString('en-KE')} debited — ${opts.description}`,
    });
    return { ok: true, transaction };
  },

  updateWalletSettings(userId: string, patch: Partial<Wallet>, actor?: SystemUser | null): Wallet {
    const wallet = ensureWallet(userId);
    setState((prev) => ({
      wallets: prev.wallets.map((w) => (w.id === wallet.id ? { ...w, ...patch, id: w.id, userId: w.userId, updatedAt: new Date().toISOString() } : w)),
    }));
    auditService.append({
      actorId: actor?.id ?? userId,
      actorName: actor?.name ?? 'System',
      actorTier: actor?.tier ?? 'user',
      action: 'wallet.settings.updated',
      entity: 'Wallet',
      entityId: wallet.id,
      severity: 'info',
      ip: actor?.lastLoginIp ?? '0.0.0.0',
      detail: `Wallet settings updated: ${Object.keys(patch).join(', ')}`,
    });
    return { ...wallet, ...patch };
  },

  /* ------------------------------ M-PESA STK push ------------------------------ */

  async requestMpesaStk(req: TopUpRequest): Promise<{ ok: boolean; checkoutRequestID?: string; message?: string }> {
    const s = getSnapshot();
    const phone = normalizeMsisdn(req.phone ?? '');
    if (!phone) return { ok: false, message: 'Enter a valid Safaricom number, e.g. 0712 345 678.' };
    const amount = Math.round(req.amount);
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: 'Enter an amount greater than zero.' };
    if (amount < s.settings.billing.walletMinTopUpKes) return { ok: false, message: `Minimum top-up is KES ${s.settings.billing.walletMinTopUpKes.toLocaleString('en-KE')}.` };
    if (amount > s.settings.billing.walletMaxTopUpKes) return { ok: false, message: `Maximum top-up is KES ${s.settings.billing.walletMaxTopUpKes.toLocaleString('en-KE')}.` };

    const local = async () => {
      await sleep(900); // Daraja token + STK dispatch
      const checkoutRequestID = `ws_CO_${stamp()}_${Math.floor(Math.random() * 9000 + 1000)}`;
      const merchantRequestID = `29115-${Math.floor(Math.random() * 9000000 + 1000000)}-${Math.floor(Math.random() * 9)}`;
      return { ok: true, checkoutRequestID, merchantRequestID, phone, amount };
    };

    const { data } = await apiOr<{ ok: boolean; checkoutRequestID?: string; merchantRequestID?: string; phone?: string; amount?: number; message?: string }>(
      '/api/wallet/topup/mpesa/stk',
      { method: 'POST', body: { userId: req.userId, phone, amount } },
      local
    );

    if (!data.ok || !data.checkoutRequestID) return { ok: false, message: data.message ?? 'STK push could not be dispatched.' };

    const checkoutRequestID = data.checkoutRequestID;
    const merchantRequestID = data.merchantRequestID ?? `29115-${Date.now()}`;
    const phoneValue = data.phone ?? phone!;

    // Schedule the handset outcome; `awaitMpesaStk` picks it up when the UI is ready.
    const settleAfter = 7000 + Math.random() * 2500;
    const entry: PendingStk = {
      checkoutRequestID,
      merchantRequestID,
      phone: phoneValue,
      amount,
      userId: req.userId,
      startedAt: Date.now(),
      resolve: () => {},
      cancelled: false,
      timer: setTimeout(() => {}, 0),
    };
    entry.timer = setTimeout(() => {
      pendingStk.delete(checkoutRequestID);
      if (entry.cancelled) return;
      // Modelled Daraja outcomes.
      let resultCode = 0;
      let resultDesc = 'The service request is processed successfully.';
      const roll = Math.random();
      if (amount > 70000 && roll < 0.35) {
        resultCode = 2001;
        resultDesc = 'Insufficient funds in the customer wallet.';
      } else if (roll > 0.94) {
        resultCode = 1037;
        resultDesc = 'DS timeout — the customer could not be reached.';
      } else if (roll > 0.88) {
        resultCode = 1032;
        resultDesc = 'Request cancelled by the customer on the handset.';
      }
      entry.resolve({
        MerchantRequestID: merchantRequestID,
        CheckoutRequestID: checkoutRequestID,
        ResultCode: resultCode,
        ResultDesc: resultDesc,
        MpesaReceiptNumber: resultCode === 0 ? receiptCode() : undefined,
        TransactionDate: resultCode === 0 ? stamp() : undefined,
        PhoneNumber: phoneValue,
        Amount: amount,
      });
    }, settleAfter);
    pendingStk.set(checkoutRequestID, entry);

    return { ok: true, checkoutRequestID };
  },

  /** Wait for the STK callback and settle the top-up. */
  async awaitMpesaStk(checkoutRequestID: string, userId: string, actor?: SystemUser | null): Promise<TopUpOutcome> {
    const pending = pendingStk.get(checkoutRequestID);
    if (!pending) {
      return { ok: false, status: 'failed', message: 'No pending STK request found for that checkout reference.' };
    }
    const result = await new Promise<MpesaStkResult>((resolve) => {
      pending.resolve = resolve;
    });
    pendingStk.delete(checkoutRequestID);
    return walletService.settleMpesa(userId, result, actor);
  },

  /** Customer pressed "Cancel" on the handset (or the UI aborted). */
  cancelMpesaStk(checkoutRequestID: string): void {
    const pending = pendingStk.get(checkoutRequestID);
    if (!pending) return;
    pending.cancelled = true;
    clearTimeout(pending.timer);
    pending.resolve({
      MerchantRequestID: pending.merchantRequestID,
      CheckoutRequestID: checkoutRequestID,
      ResultCode: 1032,
      ResultDesc: 'Request cancelled by user',
      PhoneNumber: pending.phone,
      Amount: pending.amount,
    });
    pendingStk.delete(checkoutRequestID);
  },

  /** Apply a Daraja callback to the wallet (also the shape the real webhook posts). */
  settleMpesa(userId: string, result: MpesaStkResult, actor?: SystemUser | null): TopUpOutcome {
    const s = getSnapshot();
    const user = s.users.find((u) => u.id === userId);
    const reference = result.MpesaReceiptNumber ? `MPESA-${result.MpesaReceiptNumber}` : `MPESA-${result.CheckoutRequestID.slice(-8)}`;
    const success = result.ResultCode === 0;
    const { transaction, payment } = walletService.creditWallet(userId, result.Amount, {
      channel: 'mpesa',
      kind: 'topup',
      reference,
      description: success
        ? `M-PESA STK Push top-up — ${maskMsisdn(result.PhoneNumber)}`
        : `M-PESA STK Push failed — ${result.ResultDesc}`,
      gatewayRef: result.MpesaReceiptNumber ?? result.CheckoutRequestID,
      status: success ? 'success' : result.ResultCode === 1032 ? 'cancelled' : result.ResultCode === 1037 ? 'timeout' : 'failed',
      payment: {
        userName: user?.name ?? 'Unknown',
        userEmail: user?.email ?? '',
        channel: 'mpesa',
        method: `STK Push — ${maskMsisdn(result.PhoneNumber)}`,
        amount: result.Amount,
        currency: 'KES',
        status: success ? 'success' : result.ResultCode === 1032 ? 'cancelled' : result.ResultCode === 1037 ? 'timeout' : 'failed',
        reference,
        gateway: 'Safaricom Daraja',
        gatewayRef: result.MpesaReceiptNumber,
        feeKes: 0,
        netKes: success ? result.Amount : 0,
        rawResponse: { ...result } as unknown as Record<string, string | number | boolean | null>,
        failureReason: success ? undefined : result.ResultDesc,
        ip: user?.lastLoginIp ?? '0.0.0.0',
      },
    });

    auditService.append({
      actorId: actor?.id ?? userId,
      actorName: actor?.name ?? user?.name ?? 'System',
      actorTier: actor?.tier ?? user?.tier ?? 'user',
      action: success ? 'wallet.topup.success' : 'wallet.topup.failed',
      entity: 'Wallet',
      entityId: transaction.walletId,
      severity: success ? 'success' : 'warning',
      ip: user?.lastLoginIp ?? '0.0.0.0',
      detail: success
        ? `KES ${result.Amount.toLocaleString('en-KE')} credited via M-PESA receipt ${result.MpesaReceiptNumber}`
        : `M-PESA STK failed (${result.ResultCode}) — ${result.ResultDesc}`,
    });

    return {
      ok: success,
      status: success ? 'success' : 'failed',
      message: success
        ? `KES ${result.Amount.toLocaleString('en-KE')} credited. Receipt ${result.MpesaReceiptNumber}.`
        : `${result.ResultDesc} (ResultCode ${result.ResultCode})`,
      payment,
      transaction,
      raw: result,
    };
  },

  /* --------------------------------- card --------------------------------- */

  async startCardPayment(input: { userId: string; amount: number; cardNumber: string; expiry: string; cvc: string; holder: string }): Promise<
    { ok: boolean; paymentIntentId?: string; requires3ds?: boolean; message?: string; brand?: string }
  > {
    const s = getSnapshot();
    const digits = input.cardNumber.replace(/\s/g, '');
    if (!luhn(digits)) return { ok: false, message: 'That card number failed validation. Check the digits.' };
    if (!/^\d{2}\/\d{2}$/.test(input.expiry)) return { ok: false, message: 'Expiry must be in MM/YY format.' };
    const [mm, yy] = input.expiry.split('/').map(Number);
    if (mm < 1 || mm > 12) return { ok: false, message: 'Expiry month is invalid.' };
    const expiryDate = new Date(2000 + yy, mm, 0, 23, 59, 59);
    if (expiryDate.getTime() < Date.now()) return { ok: false, message: 'That card has expired.' };
    if (!/^\d{3,4}$/.test(input.cvc)) return { ok: false, message: 'CVC must be 3 or 4 digits.' };
    if (!input.holder.trim()) return { ok: false, message: 'Cardholder name is required.' };
    const amount = Math.round(input.amount);
    if (amount < s.settings.billing.walletMinTopUpKes) return { ok: false, message: `Minimum top-up is KES ${s.settings.billing.walletMinTopUpKes.toLocaleString('en-KE')}.` };
    if (amount > s.settings.billing.walletMaxTopUpKes) return { ok: false, message: `Maximum top-up is KES ${s.settings.billing.walletMaxTopUpKes.toLocaleString('en-KE')}.` };

    const local = async () => {
      await sleep(1100);
      return { ok: true, paymentIntentId: `PI-${Math.floor(Math.random() * 9000000 + 1000000)}`, requires3ds: true, brand: cardBrand(digits) };
    };
    const { data } = await apiOr<{ ok: boolean; paymentIntentId?: string; requires3ds?: boolean; message?: string; brand?: string }>(
      '/api/wallet/topup/card',
      { method: 'POST', body: { ...input, cardNumber: maskCard(digits) } },
      local
    );
    return data;
  },

  async confirmCardPayment(input: {
    userId: string;
    paymentIntentId: string;
    otp: string;
    amount: number;
    cardNumber: string;
    holder: string;
    expiry: string;
    actor?: SystemUser | null;
  }): Promise<TopUpOutcome> {
    const digits = input.cardNumber.replace(/\s/g, '');
    const brand = cardBrand(digits);
    const s = getSnapshot();
    const user = s.users.find((u) => u.id === input.userId);
    const declined = input.otp.trim() === '000000' || input.otp.trim().length !== 6;
    const reference = `CARD-${input.paymentIntentId}`;
    const fee = Math.round(input.amount * 0.029);

    const local = async (): Promise<TopUpOutcome> => {
      await sleep(1300);
      const raw = {
        id: input.paymentIntentId,
        status: declined ? 'requires_payment_method' : 'succeeded',
        amount: input.amount,
        currency: 'KES',
        three_d_secure: declined ? 'failed' : 'authenticated',
        brand: brand.toLowerCase(),
        last4: digits.slice(-4),
        decline_code: declined ? 'incorrect_otp' : undefined,
        risk_score: 12,
      } as Record<string, unknown>;

      const { transaction, payment } = walletService.creditWallet(input.userId, input.amount, {
        channel: 'card',
        kind: 'topup',
        reference,
        description: declined
          ? `Card top-up declined — 3-D Secure authentication failed (${brand} ${maskCard(digits)})`
          : `Card top-up — ${brand} ${maskCard(digits)} (3-D Secure passed)`,
        gatewayRef: input.paymentIntentId,
        status: declined ? 'failed' : 'success',
        payment: {
          userName: user?.name ?? 'Unknown',
          userEmail: user?.email ?? '',
          channel: 'card',
          method: `${brand} ${maskCard(digits)}`,
          amount: input.amount,
          currency: 'KES',
          status: declined ? 'failed' : 'success',
          reference,
          gateway: s.settings.billing.cardGateway,
          gatewayRef: input.paymentIntentId,
          feeKes: declined ? 0 : fee,
          netKes: declined ? 0 : input.amount - fee,
          rawResponse: raw as Record<string, string | number | boolean | null>,
          failureReason: declined ? '3-D Secure OTP incorrect or malformed' : undefined,
          ip: user?.lastLoginIp ?? '0.0.0.0',
        },
      });

      // Save the card as a payment method on first successful use.
      if (!declined) {
        const token = `tok_${brand.toLowerCase()}_${digits.slice(-4)}`;
        setState((prev) => ({
          paymentMethods: prev.paymentMethods.some((m) => m.token === token)
            ? prev.paymentMethods
            : [
                ...prev.paymentMethods,
                {
                  id: uid('pm'),
                  userId: input.userId,
                  channel: 'card' as PaymentChannel,
                  label: `${brand} card`,
                  display: maskCard(digits),
                  isDefault: prev.paymentMethods.filter((m) => m.userId === input.userId).length === 0,
                  addedAt: new Date().toISOString(),
                  brand: brand === 'Unknown' ? undefined : (brand as 'Visa'),
                  expiry: input.expiry,
                  token,
                  status: 'active' as const,
                },
              ],
        }));
      }

      auditService.append({
        actorId: input.actor?.id ?? input.userId,
        actorName: input.actor?.name ?? user?.name ?? 'System',
        actorTier: input.actor?.tier ?? user?.tier ?? 'user',
        action: declined ? 'payment.failed' : 'wallet.topup.success',
        entity: 'Payment',
        entityId: reference,
        severity: declined ? 'warning' : 'success',
        ip: user?.lastLoginIp ?? '0.0.0.0',
        detail: declined
          ? `Card top-up of KES ${input.amount.toLocaleString('en-KE')} declined at 3-D Secure`
          : `KES ${input.amount.toLocaleString('en-KE')} credited via ${brand} ${maskCard(digits)}`,
      });

      return {
        ok: !declined,
        status: declined ? 'failed' : 'success',
        message: declined
          ? '3-D Secure authentication failed. No funds were taken.'
          : `KES ${input.amount.toLocaleString('en-KE')} credited. Gateway fee KES ${fee.toLocaleString('en-KE')}.`,
        payment,
        transaction,
        raw,
      };
    };

    const { data } = await apiOr<TopUpOutcome>('/api/wallet/topup/card/confirm', { method: 'POST', body: { ...input, cardNumber: maskCard(digits) } }, local, { syncLocal: true });
    return data;
  },

  /* ------------------------------ admin actions ------------------------------ */

  async refund(actor: SystemUser | null, paymentId: string, reason: string): Promise<{ ok: boolean; message?: string }> {
    const local = async () => {
      await sleep(520);
      const s = getSnapshot();
      if (!actor || actor.tier === 'user') return { ok: false, message: 'Only an Admin or Super Admin can issue refunds.' };
      const payment = s.payments.find((p) => p.id === paymentId);
      if (!payment) return { ok: false, message: 'Payment not found.' };
      if (payment.status === 'refunded') return { ok: false, message: 'This payment has already been refunded.' };
      if (payment.status !== 'success') return { ok: false, message: 'Only successful payments can be refunded.' };

      setState((prev) => ({
        payments: prev.payments.map((p) =>
          p.id === paymentId ? { ...p, status: 'refunded', refundedAt: new Date().toISOString(), refundedBy: actor.name } : p
        ),
      }));
      // Reverse the wallet credit.
      walletService.debitWallet(payment.userId, payment.amount, {
        kind: 'refund',
        reference: `RFD-${payment.reference}`,
        description: `Refund reversal — ${reason}`,
        force: true,
      });
      auditService.append({
        actorId: actor.id,
        actorName: actor.name,
        actorTier: actor.tier,
        action: 'payment.refunded',
        entity: 'Payment',
        entityId: paymentId,
        severity: 'warning',
        ip: actor.lastLoginIp ?? '0.0.0.0',
        detail: `KES ${payment.amount.toLocaleString('en-KE')} refunded (${payment.channel}) — ${reason}`,
      });
      return { ok: true, message: `Refunded KES ${payment.amount.toLocaleString('en-KE')}.` };
    };
    return apiOr(`/api/payments/${paymentId}/refund`, { method: 'POST', body: { reason } }, local, { syncLocal: true }).then((r) => r.data);
  },

  async retryFailed(actor: SystemUser | null, paymentId: string): Promise<{ ok: boolean; message?: string }> {
    const s = getSnapshot();
    const payment = s.payments.find((p) => p.id === paymentId);
    if (!payment) return { ok: false, message: 'Payment not found.' };
    if (payment.status === 'success') return { ok: false, message: 'This payment already succeeded.' };
    if (!actor || actor.tier === 'user') return { ok: false, message: 'Only an Admin or Super Admin can retry payments.' };
    await sleep(900);
    const succeeded = Math.random() > 0.35;
    setState((prev) => ({
      payments: prev.payments.map((p) => (p.id === paymentId ? { ...p, status: succeeded ? 'success' : 'failed', failureReason: succeeded ? undefined : 'Retry declined by the gateway' } : p)),
    }));
    if (succeeded) {
      walletService.creditWallet(payment.userId, payment.amount, {
        channel: payment.channel,
        kind: 'topup',
        reference: `${payment.reference}-R1`,
        description: `Successful retry of ${payment.reference}`,
        gatewayRef: payment.gatewayRef,
      });
    }
    auditService.append({
      actorId: actor.id,
      actorName: actor.name,
      actorTier: actor.tier,
      action: succeeded ? 'payment.retry.success' : 'payment.retry.failed',
      entity: 'Payment',
      entityId: paymentId,
      severity: succeeded ? 'success' : 'warning',
      ip: actor.lastLoginIp ?? '0.0.0.0',
      detail: `Retried ${payment.reference} — ${succeeded ? 'succeeded' : 'declined again'}`,
    });
    return { ok: succeeded, message: succeeded ? 'Retry succeeded — wallet credited.' : 'Retry declined by the gateway.' };
  },

  /** Admin/super-admin monitoring roll-up. */
  stats(): {
    gross: number;
    successful: number;
    failed: number;
    pending: number;
    refunded: number;
    fees: number;
    net: number;
    average: number;
    byChannel: { channel: PaymentChannel; count: number; amount: number }[];
    last30d: { day: string; amount: number; count: number }[];
    walletFloat: number;
    totalBalance: number;
  } {
    const s = getSnapshot();
    const paid = s.payments.filter((p) => p.status === 'success');
    const gross = paid.reduce((a, p) => a + p.amount, 0);
    const fees = paid.reduce((a, p) => a + p.feeKes, 0);
    const byChannelMap = new Map<PaymentChannel, { count: number; amount: number }>();
    s.payments.forEach((p) => {
      const cur = byChannelMap.get(p.channel) ?? { count: 0, amount: 0 };
      cur.count += 1;
      if (p.status === 'success') cur.amount += p.amount;
      byChannelMap.set(p.channel, cur);
    });
    const days: { day: string; amount: number; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayPayments = paid.filter((p) => p.at.slice(0, 10) === key);
      days.push({
        day: d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short' }),
        amount: dayPayments.reduce((a, p) => a + p.amount, 0),
        count: dayPayments.length,
      });
    }
    return {
      gross,
      successful: paid.length,
      failed: s.payments.filter((p) => p.status === 'failed' || p.status === 'timeout' || p.status === 'cancelled').length,
      pending: s.payments.filter((p) => p.status === 'pending' || p.status === 'processing').length,
      refunded: s.payments.filter((p) => p.status === 'refunded').length,
      fees,
      net: gross - fees,
      average: paid.length ? gross / paid.length : 0,
      byChannel: [...byChannelMap.entries()].map(([channel, v]) => ({ channel, ...v })),
      last30d: days,
      walletFloat: s.wallets.reduce((a, w) => a + w.balance, 0),
      totalBalance: s.wallets.reduce((a, w) => a + w.balance + w.held, 0),
    };
  },
};

