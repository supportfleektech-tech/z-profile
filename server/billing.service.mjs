import { getSnapshot, setState, appendAudit } from './db.mjs';
import { walletService, debitWallet, walletFor, ensureWallet } from './wallet.mjs';
import { sendMailInternal } from './mailer.mjs';
import { uid } from './format.mjs';
import { SUB_USER_FREE_LIMIT, SUB_USER_PRICE_KES } from './types.mjs';

/**
 * Sub-user billing service (server-side).
 *
 * Handles the monthly charge of (count - 5) * 500 KES to the host wallet on the 1st.
 * If the host wallet has insufficient funds, ALL of that host's sub-users are suspended.
 * Sends receipt emails via Resend (dev = outbox).
 */

/**
 * @typedef {Object} SubUserBillingResult
 * @property {boolean} ok
 * @property {string} [message]
 * @property {number} [amountCharged]
 * @property {number} [billableCount]
 * @property {number} [suspendedCount]
 * @property {number} [walletBalanceAfter]
 */

/**
 * @typedef {Object} SubUserBillingSummary
 * @property {number} freeLimit
 * @property {number} pricePerSeatKes
 * @property {number} totalSubUsers
 * @property {number} activeSubUsers
 * @property {number} billableCount
 * @property {number} monthlyChargeKes
 * @property {number} walletBalance
 * @property {boolean} canAffordNextCharge
 */

function hostWalletFor(hostUserId) {
  return walletFor(hostUserId);
}

function activeSubUsersFor(hostUserId) {
  return getSnapshot().users.filter((u) => u.parentUserId === hostUserId && u.status === 'Active');
}

function suspendedSubUsersFor(hostUserId) {
  return getSnapshot().users.filter((u) => u.parentUserId === hostUserId && u.status === 'Suspended');
}

async function sendBillingReceipt(host, amountKes, billableCount, period) {
  await sendMailInternal({
    to: host.email,
    subject: `Fleek IPRS — sub-user billing: KES ${amountKes.toLocaleString('en-KE')} charged`,
    template: 'fleek-iprs-sub-user-billing',
    vars: {
      hostName: host.name,
      amountKes,
      billableCount,
      period,
      freeIncluded: SUB_USER_FREE_LIMIT,
      pricePerSeatKes: SUB_USER_PRICE_KES,
    },
  });
}

async function sendSuspendedNotice(host, amountKes, suspendedCount) {
  await sendMailInternal({
    to: host.email,
    subject: 'Fleek IPRS — sub-user access suspended (insufficient wallet balance)',
    template: 'fleek-iprs-sub-user-suspended',
    vars: {
      hostName: host.name,
      amountKes,
      suspendedCount,
      topupUrl: 'https://fleek-iprs.co.ke/#/wallet',
    },
  });
}

export const billingService = {
  /**
   * Calculate the monthly sub-user charge for a host.
   * Free limit = 5; beyond that, SUB_USER_PRICE_KES per seat.
   */
  calculateMonthlyCharge(hostUserId) {
    const subs = activeSubUsersFor(hostUserId);
    const totalSubUsers = subs.length;
    const billableCount = Math.max(0, totalSubUsers - SUB_USER_FREE_LIMIT);
    const amountKes = billableCount * SUB_USER_PRICE_KES;
    return { billableCount, amountKes, totalSubUsers };
  },

  /**
   * Charge the host wallet for sub-user seats.
   * Returns the result including whether sub-users were suspended due to insufficient funds.
   * @returns {Promise<SubUserBillingResult>}
   */
  async chargeSubUserBilling(hostUserId, period = new Date().toLocaleString('en-KE', { month: 'long', year: 'numeric' })) {
    const s = getSnapshot();
    const host = s.users.find((u) => u.id === hostUserId);
    if (!host) return { ok: false, message: 'Host user not found.' };

    const { billableCount, amountKes } = billingService.calculateMonthlyCharge(hostUserId);
    if (billableCount === 0) {
      return { ok: true, message: 'No billable sub-users this month.', amountCharged: 0, billableCount: 0, walletBalanceAfter: hostWalletFor(hostUserId).balance };
    }

    const wallet = hostWalletFor(hostUserId);
    if (wallet.balance < amountKes) {
      // Insufficient funds — suspend ALL active sub-users
      const subs = activeSubUsersFor(hostUserId);
      let suspendedCount = 0;
      setState((prev) => ({
        users: prev.users.map((u) => {
          if (u.parentUserId === hostUserId && u.status === 'Active') {
            suspendedCount++;
            return { ...u, status: 'Suspended' };
          }
          return u;
        }),
      }));

      appendAudit({
        actorId: 'system',
        actorName: 'System (cron)',
        actorTier: 'super_admin',
        action: 'sub_user.suspended',
        entity: 'SystemUser',
        severity: 'critical',
        ip: '0.0.0.0',
        detail: `Suspended ${suspendedCount} sub-user(s) for host ${host.name} <${host.email}> — insufficient wallet balance for KES ${amountKes.toLocaleString('en-KE')} monthly charge`,
        meta: { hostUserId, amountKes, billableCount, suspendedCount },
      });

      // Send suspension notice (best-effort)
      await sendSuspendedNotice(host, amountKes, suspendedCount);

      return {
        ok: false,
        message: `Insufficient wallet balance (KES ${wallet.balance.toLocaleString('en-KE')}). All ${suspendedCount} sub-user(s) suspended.`,
        amountCharged: 0,
        billableCount,
        suspendedCount,
        walletBalanceAfter: wallet.balance,
      };
    }

    // Sufficient funds — debit the wallet
    const reference = `SUB-${uid('bill')}`;
    const { transaction } = walletService.debitWallet(hostUserId, amountKes, {
      kind: 'subscription',
      reference,
      description: `Monthly sub-user billing — ${billableCount} billable seat(s) @ KES ${SUB_USER_PRICE_KES} (${period})`,
      meta: { billableCount, pricePerSeat: SUB_USER_PRICE_KES, period },
    });

    // Record payment
    const paymentRecord = {
      id: uid('pay'),
      userId: hostUserId,
      userName: host.name,
      userEmail: host.email,
      at: transaction.at,
      channel: 'wallet',
      method: 'Sub-user billing',
      amount: amountKes,
      currency: 'KES',
      status: 'success',
      reference,
      gateway: 'Fleek IPRS Billing',
      gatewayRef: transaction.id,
      feeKes: 0,
      netKes: amountKes,
      walletTransactionId: transaction.id,
      ip: host.lastLoginIp ?? '0.0.0.0',
    };
    setState((prev) => ({ payments: [paymentRecord, ...prev.payments] }));

    appendAudit({
      actorId: 'system',
      actorName: 'System (cron)',
      actorTier: 'super_admin',
      action: 'sub_user.billing_charged',
      entity: 'Wallet',
      entityId: wallet.id,
      severity: 'info',
      ip: '0.0.0.0',
      detail: `Charged KES ${amountKes.toLocaleString('en-KE')} for ${billableCount} billable sub-user seat(s) to host ${host.name} <${host.email}>`,
      meta: { hostUserId, amountKes, billableCount, transactionId: transaction.id },
    });

    // Send billing receipt (best-effort)
    await sendBillingReceipt(host, amountKes, billableCount, period);

    return {
      ok: true,
      message: `Charged KES ${amountKes.toLocaleString('en-KE')} for ${billableCount} billable sub-user seat(s).`,
      amountCharged: amountKes,
      billableCount,
      suspendedCount: 0,
      walletBalanceAfter: wallet.balance - amountKes,
    };
  },

  /**
   * Cron endpoint handler — charges ALL hosts with active sub-users.
   * Intended to be called from the server's POST /api/cron/sub-billing endpoint.
   * @returns {Promise<{processed:number,charged:number,suspended:number,errors:string[]}>}
   */
  async runMonthlyCron() {
    const s = getSnapshot();
    const hosts = s.users.filter((u) => {
      const subs = s.users.filter((sub) => sub.parentUserId === u.id && sub.status === 'Active');
      return subs.length > 0;
    });

    let processed = 0;
    let charged = 0;
    let suspended = 0;
    const errors = [];

    for (const host of hosts) {
      processed++;
      try {
        const result = await billingService.chargeSubUserBilling(host.id);
        if (result.ok && result.amountCharged && result.amountCharged > 0) charged++;
        if (result.suspendedCount && result.suspendedCount > 0) suspended += result.suspendedCount;
      } catch (e) {
        errors.push(`${host.email}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { processed, charged, suspended, errors };
  },

  /**
   * Get billing summary for a host (used in Team Members tab).
   * @returns {SubUserBillingSummary}
   */
  getBillingSummary(hostUserId) {
    const wallet = hostWalletFor(hostUserId);
    const { billableCount, amountKes, totalSubUsers } = billingService.calculateMonthlyCharge(hostUserId);
    const subs = activeSubUsersFor(hostUserId);
    return {
      freeLimit: SUB_USER_FREE_LIMIT,
      pricePerSeatKes: SUB_USER_PRICE_KES,
      totalSubUsers,
      activeSubUsers: subs.length,
      billableCount,
      monthlyChargeKes: amountKes,
      walletBalance: wallet.balance,
      canAffordNextCharge: wallet.balance >= amountKes,
    };
  },
};