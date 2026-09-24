import { useSyncExternalStore } from 'react';
import type {
  ActivityItem,
  ApiKeyRecord,
  AppearanceSettings,
  AuditEntry,
  CaseItem,
  Dossier,
  InvoiceItem,
  NotificationItem,
  NotificationPreferences,
  PaymentMethod,
  PaymentRecord,
  ProviderConfig,
  ProviderRequestLog,
  QuotaState,
  SessionRecord,
  SystemSettings,
  SystemUser,
  UsageRecord,
  Wallet,
  WalletTransaction,
  PricingCatalog,
} from '../types';
import { readStore, removeStore, writeStore } from '../lib/storage';
import { uid } from '../lib/format';
import { seedUsers } from '../data/users';
import { seedApiKeys, seedProviderConfigs, seedProviderLogs } from '../data/providers';
import { defaultSettings } from '../data/settings';
import { pricingCatalog } from '../data/pricing';
import { primaryDossier } from '../data/dossier';
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
} from '../data/seed';

/**
 * Single source of truth for the platform's data.
 *
 * A tiny observable store: services mutate it, React binds to it through
 * `useSyncExternalStore`, and every change is persisted so the workspace survives a
 * refresh. When the Express backend is reachable, `services/http.ts` mirrors the same
 * mutations over REST — screens never know the difference.
 */

export interface DbState {
  /* identity & access */
  currentUserId: string | null;
  /** Bearer token issued by the backend at login (null in LOCAL mode). */
  authToken: string | null;
  authTokenExpiresAt: string | null;
  users: SystemUser[];
  sessions: SessionRecord[];
  audit: AuditEntry[];

  /* notifications */
  notifications: NotificationItem[];
  notificationPrefs: Record<string, NotificationPreferences>;

  /* operations */
  cases: CaseItem[];
  usage: UsageRecord[];
  activities: ActivityItem[];
  searchHistory: { query: string; at: string; subject: string; costKes: number; userId: string }[];

  /* dossier / report */
  activeDossier: Dossier;
  dossierCache: Record<string, Dossier>;
  /** Legacy search-result shape still consumed by older screens. */
  lastSearch: { query: string; profile: import('../types').IdentityProfile; timestamp: string; riskScore: number } | null;

  /* money */
  wallets: Wallet[];
  walletTransactions: WalletTransaction[];
  payments: PaymentRecord[];
  paymentMethods: PaymentMethod[];
  invoices: InvoiceItem[];
  pricing: PricingCatalog;

  /* providers */
  providerConfigs: ProviderConfig[];
  providerLogs: ProviderRequestLog[];
  apiKeys: ApiKeyRecord[];

  /* platform */
  settings: SystemSettings;
  appearance: AppearanceSettings;
}

const STORAGE_KEY = 'workspace';

export const defaultNotificationPrefs: NotificationPreferences = {
  matrix: {
    'case.assigned': { inApp: true, email: true, sms: false, webhook: false },
    'case.updated': { inApp: true, email: false, sms: false, webhook: false },
    'report.ready': { inApp: true, email: true, sms: false, webhook: true },
    'payment.success': { inApp: true, email: true, sms: false, webhook: false },
    'payment.failed': { inApp: true, email: true, sms: true, webhook: true },
    'wallet.low': { inApp: true, email: true, sms: true, webhook: false },
    'quota.warning': { inApp: true, email: true, sms: false, webhook: false },
    'provider.outage': { inApp: true, email: true, sms: true, webhook: true },
    'security.alert': { inApp: true, email: true, sms: true, webhook: true },
    'login.newDevice': { inApp: true, email: true, sms: true, webhook: false },
    'digest.weekly': { inApp: true, email: true, sms: false, webhook: false },
  },
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '06:00',
  digestFrequency: 'weekly',
  smsNumber: '+254 712 345 678',
  smsVerified: true,
  webhookUrl: '',
  webhookSecret: '',
};

export const defaultAppearance: AppearanceSettings = {
  accent: 'cyan',
  density: 'comfortable',
  fontScale: 1,
  sidebarCollapsed: false,
  reduceMotion: false,
  monoNumerals: true,
};

function freshState(): DbState {
  return {
    currentUserId: null,
    authToken: null,
    authTokenExpiresAt: null,
    users: seedUsers.map((u) => ({ ...u })),
    sessions: seedSessions.map((s) => ({ ...s })),
    audit: seedAudit.map((a) => ({ ...a })),
    notifications: notificationsData.map((n) => ({ ...n })),
    notificationPrefs: {},
    cases: casesData.map((c) => ({ ...c })),
    usage: seedUsage.map((u) => ({ ...u })),
    activities: recentActivities.map((a) => ({ ...a })),
    searchHistory: [],
    activeDossier: primaryDossier,
    dossierCache: { [primaryDossier.id]: primaryDossier },
    lastSearch: null,
    wallets: seedWallets.map((w) => ({ ...w })),
    walletTransactions: seedWalletTransactions.map((t) => ({ ...t })),
    payments: seedPayments.map((p) => ({ ...p })),
    paymentMethods: seedPaymentMethods.map((m) => ({ ...m })),
    invoices: invoicesData.map((i) => ({ ...i })),
    pricing: pricingCatalog,
    providerConfigs: seedProviderConfigs.map((p) => ({ ...p })),
    providerLogs: seedProviderLogs.map((l) => ({ ...l })),
    apiKeys: seedApiKeys.map((k) => ({ ...k })),
    settings: defaultSettings,
    appearance: defaultAppearance,
  };
}

function load(): DbState {
  const base = freshState();
  const saved = readStore<Partial<DbState> | null>(STORAGE_KEY, null);
  if (!saved) return base;
  // Merge defensively: any collection missing or malformed falls back to the seed.
  const merged: DbState = { ...base };
  for (const key of Object.keys(base) as (keyof DbState)[]) {
    const v = saved[key];
    if (v === undefined || v === null) continue;
    if (Array.isArray(base[key]) && !Array.isArray(v)) continue;
    (merged as unknown as Record<string, unknown>)[key] = v as unknown;
  }
  // Settings and pricing are nested objects — guard against partial saves.
  if (!merged.settings?.security?.passwordPolicy) merged.settings = base.settings;
  if (!merged.pricing?.items?.length) merged.pricing = base.pricing;
  if (!merged.activeDossier?.sections?.length) merged.activeDossier = base.activeDossier;
  return merged;
}

/* ------------------------------- store plumbing ------------------------------- */

type Listener = () => void;
const listeners = new Set<Listener>();
let state: DbState = typeof window === 'undefined' ? freshState() : load();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function persist(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    writeStore(STORAGE_KEY, state);
  }, 120);
}

function notify(): void {
  listeners.forEach((l) => l());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): DbState {
  return state;
}

/** Replace one or more slices. Always creates a new state object so React re-renders. */
export function setState(patch: Partial<DbState> | ((prev: DbState) => Partial<DbState>)): void {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  notify();
  persist();
}

/** Convenience for list slices. */
export function updateList<K extends keyof DbState>(
  key: K,
  fn: (list: DbState[K] extends (infer T)[] ? T[] : never) => DbState[K] extends (infer T)[] ? T[] : never
): void {
  const current = state[key] as unknown[];
  const next = fn(current as never) as unknown[];
  setState({ [key]: next } as Partial<DbState>);
}

export function resetWorkspace(): void {
  removeStore(STORAGE_KEY);
  state = freshState();
  notify();
}

/* --------------------------------- selectors --------------------------------- */

export function useDb(): DbState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useDbSelector<T>(select: (s: DbState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(state),
    () => select(state)
  );
}

export function currentUser(): SystemUser | null {
  if (!state.currentUserId) return null;
  return state.users.find((u) => u.id === state.currentUserId) ?? null;
}

export function walletFor(userId: string): Wallet | null {
  return state.wallets.find((w) => w.userId === userId) ?? null;
}

export function ensureWallet(userId: string): Wallet {
  const existing = walletFor(userId);
  if (existing) return existing;
  const created: Wallet = {
    id: `w-${userId}`,
    userId,
    currency: 'KES',
    balance: 0,
    held: 0,
    lifetimeTopUp: 0,
    lifetimeSpend: 0,
    autoTopUp: false,
    autoTopUpTriggerKes: 2500,
    autoTopUpAmountKes: 10000,
    lowBalanceAlertKes: 2500,
    overdraftAllowed: false,
    updatedAt: new Date().toISOString(),
  };
  setState((prev) => ({ wallets: [...prev.wallets, created] }));
  return created;
}

export function prefsFor(userId: string): NotificationPreferences {
  return state.notificationPrefs[userId] ?? defaultNotificationPrefs;
}

export function quotaFor(userId: string | null): QuotaState[] {
  if (!userId) return [];
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const mine = state.usage.filter((u) => u.userId === userId && new Date(u.at) >= monthStart);
  const count = (providerId: string) => mine.filter((u) => u.providerId === providerId).length;
  const configs = state.providerConfigs;
  const wallet = walletFor(userId);
  return [
    {
      label: 'Total verifications',
      used: mine.length,
      total: 500,
      color: '#00e5ff',
    },
    ...configs.slice(0, 5).map((c) => ({
      label: c.name,
      used: count(c.id),
      total: c.includedMonthlyQuota,
      color: c.color,
    })),
    {
      label: 'Wallet balance',
      used: Math.max(0, (wallet?.balance ?? 0)),
      total: 25000,
      color: '#10b981',
    },
  ];
}

export function newId(prefix: string): string {
  return uid(prefix);
}
