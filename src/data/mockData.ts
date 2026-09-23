/**
 * Compatibility + derived seed data.
 *
 * Older screens import from here; the canonical sources now live in `./seed`,
 * `./users`, `./providers`, `./pricing` and `./dossier`. This module re-exports them and
 * derives the legacy `ProviderItem` / `pricingPlans` / `primaryProfile` shapes so nothing
 * drifts between the two representations.
 */
import type { IdentityProfile, PricingPlan, ProviderItem, SystemUser } from '../types';
import { casesData, invoicesData, notificationsData, recentActivities } from './seed';
import { seedUsers } from './users';
import { seedProviderConfigs } from './providers';
import { pricingCatalog, subscriptionPlans } from './pricing';
import { dossierToProfile, primaryDossier } from './dossier';

export { casesData, invoicesData, notificationsData, recentActivities };
export { seedUsers, seedProviderConfigs, pricingCatalog, primaryDossier };
export { seedWallets, seedWalletTransactions, seedPayments, seedPaymentMethods, seedSessions, seedAudit, seedUsage } from './seed';
export { seedApiKeys, seedProviderLogs } from './providers';
export { defaultSettings, SETTINGS_GROUPS } from './settings';
export { subscriptionPlans, estimateCost, priceChecks, itemById } from './pricing';

/** Legacy export name consumed by the app context. */
export const adminUsersData: SystemUser[] = seedUsers;

/** Legacy provider card shape, derived from the full configuration records. */
export const providersData: ProviderItem[] = seedProviderConfigs.map((p) => ({
  id: p.id,
  name: p.name,
  code: p.code,
  category: p.category,
  status: p.enabled ? p.status : 'Disabled',
  lastSync: p.lastSync,
  latencyMs: p.latencyMs,
  uptime: p.uptime,
  color: p.color,
}));

/** Legacy plan shape consumed by Billing and Pricing screens. */
export const pricingPlans: PricingPlan[] = subscriptionPlans;

/** Legacy profile shape derived from the full dossier. */
export const primaryProfile: IdentityProfile = dossierToProfile(primaryDossier);

/** Convenience: the 0–500 batch label used across billing surfaces. */
export const BATCH_LABEL = pricingCatalog.batchLabel;
