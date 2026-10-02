import type { SystemUser, Wallet } from '../types';
import { getSnapshot } from './db';
import { walletService } from './wallet.service';
import { SUB_USER_FREE_LIMIT, SUB_USER_PRICE_KES } from '../types';

/**
 * Sub-user billing service (frontend-compatible).
 *
 * Provides billing calculations and summaries for the UI.
 * Actual charging and email sending is handled server-side via the cron endpoint.
 */

export interface SubUserBillingSummary {
  freeLimit: number;
  pricePerSeatKes: number;
  totalSubUsers: number;
  activeSubUsers: number;
  billableCount: number;
  monthlyChargeKes: number;
  walletBalance: number;
  canAffordNextCharge: boolean;
}

function hostWalletFor(hostUserId: string): Wallet {
  const s = getSnapshot();
  return s.wallets.find((w) => w.userId === hostUserId) ?? walletService.for(hostUserId);
}

function activeSubUsersFor(hostUserId: string): SystemUser[] {
  return getSnapshot().users.filter((u) => u.parentUserId === hostUserId && u.status === 'Active');
}

export const billingService = {
  /**
   * Calculate the monthly sub-user charge for a host.
   * Free limit = 5; beyond that, SUB_USER_PRICE_KES per seat.
   */
  calculateMonthlyCharge(hostUserId: string): { billableCount: number; amountKes: number; totalSubUsers: number } {
    const subs = activeSubUsersFor(hostUserId);
    const totalSubUsers = subs.length;
    const billableCount = Math.max(0, totalSubUsers - SUB_USER_FREE_LIMIT);
    const amountKes = billableCount * SUB_USER_PRICE_KES;
    return { billableCount, amountKes, totalSubUsers };
  },

  /**
   * Get billing summary for a host (used in Team Members tab).
   */
  getBillingSummary(hostUserId: string): SubUserBillingSummary {
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