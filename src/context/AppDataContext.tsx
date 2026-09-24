import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ActivityItem,
  AppearanceSettings,
  AuditEntry,
  CaseItem,
  Dossier,
  IdentityProfile,
  InvoiceItem,
  NotificationItem,
  NotificationPreferences,
  PaymentRecord,
  Permission,
  ProviderConfig,
  ProviderRequestLog,
  PricingCatalog,
  SessionRecord,
  SystemSettings,
  SystemUser,
  UsageRecord,
  Wallet,
  WalletTransaction,
} from '../types';
import { currentUser, ensureWallet, getSnapshot, prefsFor, quotaFor, setState, useDb } from '../services/db';
import { authService, auditService } from '../services/auth.service';
import { walletService } from '../services/wallet.service';
import { providerService } from '../services/provider.service';
import { settingsService } from '../services/settings.service';
import { searchService } from '../services/search.service';
import { getApiMode, onApiModeChange, probeApi, setAuthTokenProvider, type ApiMode } from '../services/http';
import { can as canPermission, dashboardLabelFor, effectivePermissions, roleLabelFor } from '../auth/permissions';
import { dossierToProfile } from '../data/dossier';
import { subscriptionPlans } from '../data/pricing';
import { uid } from '../lib/format';
import type { SearchOutcome, SearchRequest } from '../services/search.service';
import type { TestResult } from '../services/provider.service';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

/** Legacy search-result shape still consumed by older screens. */
export interface SearchResult {
  query: string;
  profile: IdentityProfile;
  timestamp: string;
  riskScore: number;
}

interface AppDataContextType {
  /* ---- auth & RBAC ---- */
  isAuthenticated: boolean;
  currentUser: SystemUser | null;
  tier: SystemUser['tier'] | null;
  roleLabel: string;
  dashboardLabel: string;
  can: (permission: Permission) => boolean;
  permissions: Set<Permission>;
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string; requiresMfa?: boolean }>;
  logout: (reason?: string) => void;

  /* ---- people ---- */
  users: SystemUser[];
  addUser: (input: Parameters<typeof authService.create>[1]) => ReturnType<typeof authService.create>;
  updateUser: (id: string, patch: Partial<SystemUser>) => ReturnType<typeof authService.update>;
  removeUser: (id: string) => ReturnType<typeof authService.remove>;
  toggleUserStatus: (id: string) => ReturnType<typeof authService.toggleStatus>;
  resetUserPassword: (id: string) => ReturnType<typeof authService.resetPassword>;

  /* ---- cases ---- */
  cases: CaseItem[];
  visibleCases: CaseItem[];
  addCase: (c: Omit<CaseItem, 'id' | 'caseId' | 'updated'>) => CaseItem;
  updateCaseStatus: (id: string, status: CaseItem['status']) => void;

  /* ---- notifications ---- */
  notifications: NotificationItem[];
  visibleNotifications: NotificationItem[];
  unreadCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addNotification: (n: Omit<NotificationItem, 'id' | 'read' | 'time'>) => void;
  notificationPrefs: NotificationPreferences;
  setNotificationPrefs: (p: NotificationPreferences) => void;

  /* ---- providers ---- */
  providers: ProviderConfig[];
  providerLogs: ProviderRequestLog[];
  apiKeys: ReturnType<typeof providerService.apiKeys>;
  pingProvider: (id: string) => Promise<void>;
  syncingProviderId: string | null;
  updateProviderConfig: (id: string, patch: Partial<ProviderConfig>) => ReturnType<typeof providerService.update>;
  testProvider: (id: string) => Promise<TestResult>;
  testingProviderId: string | null;
  createApiKey: (input: { label: string; scopes: string[]; providerId?: string; environment: 'sandbox' | 'live' }) => ReturnType<typeof providerService.createApiKey>;
  revokeApiKey: (id: string) => ReturnType<typeof providerService.revokeApiKey>;
  providerUsage: ReturnType<typeof providerService.usage>;

  /* ---- billing & pricing ---- */
  invoices: InvoiceItem[];
  pricing: PricingCatalog;
  subscriptionPlans: typeof subscriptionPlans;
  currentPlan: string;
  setCurrentPlan: (plan: string) => void;
  billingPeriod: 'monthly' | 'yearly';
  setBillingPeriod: (p: 'monthly' | 'yearly') => void;
  updatePricing: (patch: Partial<PricingCatalog>) => ReturnType<typeof settingsService.updatePricing>;

  /* ---- wallet & payments ---- */
  wallet: Wallet;
  wallets: Wallet[];
  walletTransactions: WalletTransaction[];
  myTransactions: WalletTransaction[];
  payments: PaymentRecord[];
  paymentStats: ReturnType<typeof walletService.stats>;
  topUpMpesa: (input: { phone: string; amount: number }) => Promise<{ checkoutRequestID?: string; message?: string; ok: boolean }>;
  awaitMpesaTopUp: (checkoutRequestID: string) => ReturnType<typeof walletService.awaitMpesaStk>;
  cancelMpesaTopUp: (checkoutRequestID: string) => void;
  startCardTopUp: (input: { amount: number; cardNumber: string; expiry: string; cvc: string; holder: string }) => ReturnType<typeof walletService.startCardPayment>;
  confirmCardTopUp: (input: { paymentIntentId: string; otp: string; amount: number; cardNumber: string; holder: string; expiry: string }) => ReturnType<typeof walletService.confirmCardPayment>;
  refundPayment: (paymentId: string, reason: string) => ReturnType<typeof walletService.refund>;
  retryPayment: (paymentId: string) => ReturnType<typeof walletService.retryFailed>;
  updateWalletSettings: (patch: Partial<Wallet>) => Wallet;

  /* ---- search & dossier ---- */
  activeDossier: Dossier;
  activeProfile: IdentityProfile;
  lastSearchResult: SearchResult | null;
  searchHistory: { query: string; at: string; subject: string; costKes: number; userId: string }[];
  runSearch: (req: Omit<SearchRequest, 'actor'>) => Promise<SearchOutcome>;
  priceSearch: (checkIds: string[]) => number;
  preflightSearch: (checkIds: string[]) => { ok: boolean; reason?: string; costKes: number; balance: number };

  /* ---- usage ---- */
  usage: UsageRecord[];
  quota: ReturnType<typeof quotaFor>;

  /* ---- platform ---- */
  settings: SystemSettings;
  updateSettings: <K extends keyof SystemSettings>(group: K, patch: Partial<SystemSettings[K]>) => ReturnType<typeof settingsService.update<K>>;
  canEditSettingsGroup: (group: keyof SystemSettings) => boolean;
  settingsHealth: ReturnType<typeof settingsService.health>;
  appearance: AppearanceSettings;
  setAppearance: (patch: Partial<AppearanceSettings>) => void;
  audit: AuditEntry[];
  appendAudit: (entry: Omit<AuditEntry, 'id' | 'at'>) => AuditEntry;
  sessions: SessionRecord[];
  revokeSession: (id: string) => ReturnType<typeof authService.revokeSession>;

  /* ---- activity & UI ---- */
  activities: ActivityItem[];
  addActivity: (title: string, type: string) => void;
  toasts: ToastMessage[];
  pushToast: (t: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (v: boolean) => void;
  apiMode: ApiMode;

  /* ---- derived stats ---- */
  stats: { totalSearches: number; successful: number; failed: number; revenue: string; revenueValue: number };
}

const AppDataContext = React.createContext<AppDataContextType | undefined>(undefined);

/**
 * Hand the transport layer the signed session token, so guarded backend routes can
 * resolve the acting account from it. Registered at module scope — before the first
 * render.
 */
setAuthTokenProvider(() => getSnapshot().authToken);

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const db = useDb();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(db.appearance.sidebarCollapsed);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [syncingProviderId, setSyncingProviderId] = useState<string | null>(null);
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [currentPlan, setCurrentPlanState] = useState('professional');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [apiMode, setApiMode] = useState<ApiMode>(getApiMode());

  const me = useMemo(() => currentUser(), [db.currentUserId, db.users]);

  // Probe the backend once; fall back to the local adapter silently.
  useEffect(() => {
    void probeApi();
    return onApiModeChange(setApiMode);
  }, []);

  // Apply appearance tokens to the document.
  useEffect(() => {
    const a = db.appearance;
    const root = document.documentElement;
    const accents: Record<AppearanceSettings['accent'], string> = {
      cyan: '#22d3ee',
      emerald: '#34d399',
      violet: '#a78bfa',
      amber: '#fbbf24',
      rose: '#fb7185',
    };
    root.style.setProperty('--accent', accents[a.accent] ?? '#22d3ee');
    root.style.setProperty('--font-scale', String(a.fontScale));
    root.classList.toggle('density-compact', a.density === 'compact');
    root.classList.toggle('density-comfortable', a.density === 'comfortable');
    root.classList.toggle('reduce-motion', a.reduceMotion);
    setSidebarCollapsed(a.sidebarCollapsed);
  }, [db.appearance]);

  const pushToast = useCallback((t: Omit<ToastMessage, 'id'>) => {
    const id = uid('toast');
    setToasts((prev) => [...prev.slice(-4), { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4600);
  }, []);

  const dismissToast = useCallback((id: string) => setToasts((prev) => prev.filter((x) => x.id !== id)), []);

  const permissions = useMemo(() => (me ? effectivePermissions(me) : new Set<Permission>()), [me]);
  const can = useCallback((p: Permission) => canPermission(me, p), [me]);

  /* ---------------------------------- auth ---------------------------------- */

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authService.login(email, password, {
        device: navigator.userAgent.includes('Mobile') ? 'Mobile device' : 'Desktop',
        browser: navigator.userAgent.includes('Firefox') ? 'Firefox' : navigator.userAgent.includes('Edg') ? 'Edge' : 'Chrome',
      });
      if (res.ok && res.user) {
        pushToast({ title: 'Welcome back', description: `Signed in as ${res.user.name} — ${dashboardLabelFor(res.user)}`, type: 'success' });
      } else {
        pushToast({ title: 'Sign-in failed', description: res.message ?? 'Invalid credentials', type: 'error' });
      }
      return { ok: res.ok, message: res.message, requiresMfa: res.requiresMfa };
    },
    [pushToast]
  );

  const logout = useCallback(
    (reason = 'Signed out') => {
      authService.logout(reason);
      pushToast({ title: 'Signed out', description: 'Session ended securely', type: 'info' });
    },
    [pushToast]
  );

  /* --------------------------------- people --------------------------------- */

  const addUser = useCallback(
    async (input: Parameters<typeof authService.create>[1]) => {
      const res = await authService.create(me, input);
      pushToast({ title: res.ok ? 'Account created' : 'Could not create account', description: res.message ?? `${input.name} (${input.tier})`, type: res.ok ? 'success' : 'error' });
      return res;
    },
    [me, pushToast]
  );

  const updateUser = useCallback(
    async (id: string, patch: Partial<SystemUser>) => {
      const res = await authService.update(me, id, patch);
      if (!res.ok) pushToast({ title: 'Update rejected', description: res.message, type: 'error' });
      else pushToast({ title: 'Account updated', type: 'success' });
      return res;
    },
    [me, pushToast]
  );

  const removeUser = useCallback(
    async (id: string) => {
      const res = await authService.remove(me, id);
      pushToast({ title: res.ok ? 'Access revoked' : 'Removal rejected', description: res.message, type: res.ok ? 'warning' : 'error' });
      return res;
    },
    [me, pushToast]
  );

  const toggleUserStatus = useCallback(
    async (id: string) => {
      const res = await authService.toggleStatus(me, id);
      if (!res.ok) pushToast({ title: 'Status change rejected', description: res.message, type: 'error' });
      return res;
    },
    [me, pushToast]
  );

  const resetUserPassword = useCallback(
    async (id: string) => {
      const res = await authService.resetPassword(me, id);
      pushToast({
        title: res.ok ? 'Temporary password issued' : 'Reset rejected',
        description: res.ok ? res.temporaryPassword : res.message,
        type: res.ok ? 'success' : 'error',
      });
      return res;
    },
    [me, pushToast]
  );

  /* ---------------------------------- cases ---------------------------------- */

  const addCase = useCallback(
    (c: Omit<CaseItem, 'id' | 'caseId' | 'updated'>) => {
      const newCase: CaseItem = {
        ...c,
        id: uid('c'),
        caseId: `IPRS-${Math.floor(10000 + Math.random() * 90000)}`,
        updated: 'Just now',
        ownerId: me?.id,
        assignedTo: me?.name,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({ cases: [newCase, ...prev.cases] }));
      pushToast({ title: 'Case created', description: `${newCase.caseId} — ${newCase.subject}`, type: 'success' });
      setState((prev) => ({
        notifications: [
          {
            id: uid('n'),
            title: 'New case created',
            description: `Case ${newCase.caseId} has been created for ${newCase.subject}.`,
            time: 'Just now',
            category: 'System',
            type: 'success',
            read: false,
            userId: me?.id,
          },
          ...prev.notifications,
        ],
      }));
      auditService.append({
        actorId: me?.id ?? 'system',
        actorName: me?.name ?? 'System',
        actorTier: me?.tier ?? 'user',
        action: 'case.created',
        entity: 'Case',
        entityId: newCase.caseId,
        severity: 'info',
        ip: me?.lastLoginIp ?? '0.0.0.0',
        detail: `${newCase.type} — ${newCase.subject} (${newCase.priority} priority)`,
      });
      return newCase;
    },
    [me, pushToast]
  );

  const updateCaseStatus = useCallback(
    (id: string, status: CaseItem['status']) => {
      setState((prev) => ({ cases: prev.cases.map((c) => (c.id === id ? { ...c, status, updated: 'Just now' } : c)) }));
      pushToast({ title: 'Case updated', description: `Status set to ${status}`, type: 'info' });
      auditService.append({
        actorId: me?.id ?? 'system',
        actorName: me?.name ?? 'System',
        actorTier: me?.tier ?? 'user',
        action: 'case.updated',
        entity: 'Case',
        entityId: id,
        severity: 'info',
        ip: me?.lastLoginIp ?? '0.0.0.0',
        detail: `Status → ${status}`,
      });
    },
    [me, pushToast]
  );

  /* ------------------------------- notifications ------------------------------- */

  const markNotificationRead = useCallback((id: string) => {
    setState((prev) => ({ notifications: prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setState((prev) => ({ notifications: prev.notifications.map((n) => ({ ...n, read: true })) }));
    pushToast({ title: 'All caught up', description: 'Notifications marked as read', type: 'success' });
  }, [pushToast]);

  const addNotification = useCallback((n: Omit<NotificationItem, 'id' | 'read' | 'time'>) => {
    setState((prev) => ({ notifications: [{ ...n, id: uid('n'), read: false, time: 'Just now' }, ...prev.notifications] }));
  }, []);

  const setNotificationPrefs = useCallback(
    (p: NotificationPreferences) => {
      if (!me) return;
      settingsService.setNotificationPrefs(me.id, p, me);
      pushToast({ title: 'Notification preferences saved', type: 'success' });
    },
    [me, pushToast]
  );

  /* --------------------------------- providers --------------------------------- */

  const pingProvider = useCallback(
    async (id: string) => {
      setSyncingProviderId(id);
      await providerService.ping(me, id);
      setSyncingProviderId(null);
      const cfg = providerService.get(id);
      pushToast({ title: 'Sync complete', description: `${cfg?.name ?? 'Provider'} gateway responded OK`, type: 'success' });
    },
    [me, pushToast]
  );

  const updateProviderConfig = useCallback(
    async (id: string, patch: Partial<ProviderConfig>) => {
      const res = await providerService.update(me, id, patch);
      pushToast({ title: res.ok ? 'Configuration saved' : 'Save rejected', description: res.message, type: res.ok ? 'success' : 'error' });
      return res;
    },
    [me, pushToast]
  );

  const testProvider = useCallback(
    async (id: string) => {
      setTestingProviderId(id);
      const res = await providerService.test(me, id);
      setTestingProviderId(null);
      pushToast({
        title: res.ok ? 'Connection test passed' : 'Connection test failed',
        description: res.message,
        type: res.ok ? 'success' : 'error',
      });
      return res;
    },
    [me, pushToast]
  );

  const createApiKey = useCallback(
    (input: { label: string; scopes: string[]; providerId?: string; environment: 'sandbox' | 'live' }) => {
      const res = providerService.createApiKey(me, input);
      pushToast({ title: res.ok ? 'API key issued' : 'Rejected', description: res.message, type: res.ok ? 'success' : 'error' });
      return res;
    },
    [me, pushToast]
  );

  const revokeApiKey = useCallback(
    (id: string) => {
      const res = providerService.revokeApiKey(me, id);
      pushToast({ title: res.ok ? 'API key revoked' : 'Rejected', description: res.message, type: res.ok ? 'warning' : 'error' });
      return res;
    },
    [me, pushToast]
  );

  /* ------------------------------ wallet & payments ------------------------------ */

  const wallet = useMemo(() => (me ? ensureWallet(me.id) : ensureWallet('__anonymous__')), [me]);

  const topUpMpesa = useCallback(
    async (input: { phone: string; amount: number }) => {
      if (!me) return { ok: false, message: 'Not signed in.' };
      return walletService.requestMpesaStk({ userId: me.id, phone: input.phone, amount: input.amount });
    },
    [me]
  );

  const awaitMpesaTopUp = useCallback(
    async (checkoutRequestID: string) => {
      if (!me) return { ok: false, status: 'failed' as const, message: 'Not signed in.' };
      const res = await walletService.awaitMpesaStk(checkoutRequestID, me.id, me);
      pushToast({ title: res.ok ? 'Wallet credited' : 'Top-up not completed', description: res.message, type: res.ok ? 'success' : 'error' });
      return res;
    },
    [me, pushToast]
  );

  const cancelMpesaTopUp = useCallback((checkoutRequestID: string) => walletService.cancelMpesaStk(checkoutRequestID), []);

  const startCardTopUp = useCallback(
    (input: { amount: number; cardNumber: string; expiry: string; cvc: string; holder: string }) => {
      if (!me) return Promise.resolve({ ok: false, message: 'Not signed in.' });
      return walletService.startCardPayment({ userId: me.id, ...input });
    },
    [me]
  );

  const confirmCardTopUp = useCallback(
    async (input: { paymentIntentId: string; otp: string; amount: number; cardNumber: string; holder: string; expiry: string }) => {
      if (!me) return { ok: false, status: 'failed' as const, message: 'Not signed in.' };
      const res = await walletService.confirmCardPayment({ userId: me.id, actor: me, ...input });
      pushToast({ title: res.ok ? 'Wallet credited' : 'Payment declined', description: res.message, type: res.ok ? 'success' : 'error' });
      return res;
    },
    [me, pushToast]
  );

  const refundPayment = useCallback(
    async (paymentId: string, reason: string) => {
      const res = await walletService.refund(me, paymentId, reason);
      pushToast({ title: res.ok ? 'Refund issued' : 'Refund rejected', description: res.message, type: res.ok ? 'success' : 'error' });
      return res;
    },
    [me, pushToast]
  );

  const retryPayment = useCallback(
    async (paymentId: string) => {
      const res = await walletService.retryFailed(me, paymentId);
      pushToast({ title: res.ok ? 'Retry succeeded' : 'Retry failed', description: res.message, type: res.ok ? 'success' : 'warning' });
      return res;
    },
    [me, pushToast]
  );

  const updateWalletSettings = useCallback(
    (patch: Partial<Wallet>) => {
      if (!me) return wallet;
      const next = walletService.updateWalletSettings(me.id, patch, me);
      pushToast({ title: 'Wallet settings saved', type: 'success' });
      return next;
    },
    [me, wallet, pushToast]
  );

  /* ---------------------------------- search ---------------------------------- */

  const runSearch = useCallback(
    async (req: Omit<SearchRequest, 'actor'>): Promise<SearchOutcome> => {
      const res = await searchService.run({ ...req, actor: me });
      if (!res.ok) pushToast({ title: 'Search rejected', description: res.message, type: 'error' });
      else
        pushToast({
          title: 'Verification complete',
          description: `${res.dossier?.subject.fullName} — score ${res.dossier?.risk.score}/100 · ${res.costKes ? `KES ${res.costKes.toLocaleString('en-KE')} debited` : ''}`,
          type: 'success',
        });
      return res;
    },
    [me, pushToast]
  );

  /* --------------------------------- settings --------------------------------- */

  const updateSettings = useCallback(
    async <K extends keyof SystemSettings>(group: K, patch: Partial<SystemSettings[K]>) => {
      const res = await settingsService.update(me, group, patch);
      pushToast({ title: res.ok ? 'Settings saved' : 'Change rejected', description: res.message, type: res.ok ? 'success' : 'error' });
      return res;
    },
    [me, pushToast]
  );

  const setAppearance = useCallback((patch: Partial<AppearanceSettings>) => {
    settingsService.setAppearance(patch);
  }, []);

  const updatePricing = useCallback(
    async (patch: Partial<PricingCatalog>) => {
      const res = await settingsService.updatePricing(me, patch);
      pushToast({ title: res.ok ? 'Pricing updated' : 'Rejected', description: res.message, type: res.ok ? 'success' : 'error' });
      return res;
    },
    [me, pushToast]
  );

  const revokeSession = useCallback(
    async (id: string) => {
      const res = await authService.revokeSession(me, id);
      pushToast({ title: res.ok ? 'Session revoked' : 'Rejected', description: res.message, type: res.ok ? 'warning' : 'error' });
      return res;
    },
    [me, pushToast]
  );

  /* --------------------------------- derived --------------------------------- */

  const visibleCases = useMemo(() => {
    if (!me) return [];
    if (canPermission(me, 'case.view.all')) return db.cases;
    return db.cases.filter((c) => c.ownerId === me.id || c.assignedTo === me.name);
  }, [db.cases, me]);

  const visibleNotifications = useMemo(() => {
    if (!me) return [];
    return db.notifications.filter((n) => {
      if (n.userId && n.userId !== me.id) return false;
      if (n.tiers && !n.tiers.includes(me.tier)) return false;
      return true;
    });
  }, [db.notifications, me]);

  const unreadCount = useMemo(() => visibleNotifications.filter((n) => !n.read).length, [visibleNotifications]);

  const myTransactions = useMemo(() => (me ? db.walletTransactions.filter((t) => t.userId === me.id) : []), [db.walletTransactions, me]);

  const stats = useMemo(() => {
    const total = db.usage.length;
    const successful = db.usage.filter((u) => u.status === 'success').length;
    const revenueValue = db.payments.filter((p) => p.status === 'success').reduce((a, p) => a + p.amount, 0);
    return {
      totalSearches: Math.max(total, db.searchHistory.length),
      successful,
      failed: total - successful,
      revenueValue,
      revenue: `KES ${revenueValue.toLocaleString('en-KE')}`,
    };
  }, [db.usage, db.payments, db.searchHistory]);

  const paymentStats = useMemo(() => walletService.stats(), [db.payments, db.wallets]);
  const providerUsage = useMemo(() => providerService.usage(), [db.providerLogs, db.usage, db.providerConfigs]);
  const settingsHealth = useMemo(() => settingsService.health(me), [db.settings, db.providerConfigs, db.apiKeys, db.users, db.pricing, me]);
  const activeProfile = useMemo(() => dossierToProfile(db.activeDossier), [db.activeDossier]);

  const value: AppDataContextType = {
    isAuthenticated: Boolean(me),
    currentUser: me,
    tier: me?.tier ?? null,
    roleLabel: me ? roleLabelFor(me) : 'Guest',
    dashboardLabel: dashboardLabelFor(me),
    can,
    permissions,
    login,
    logout,

    users: db.users,
    addUser,
    updateUser,
    removeUser,
    toggleUserStatus,
    resetUserPassword,

    cases: db.cases,
    visibleCases,
    addCase,
    updateCaseStatus,

    notifications: db.notifications,
    visibleNotifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    addNotification,
    notificationPrefs: me ? prefsFor(me.id) : settingsService.notificationPrefs('__anon__'),
    setNotificationPrefs,

    providers: db.providerConfigs,
    providerLogs: db.providerLogs,
    apiKeys: db.apiKeys,
    pingProvider,
    syncingProviderId,
    updateProviderConfig,
    testProvider,
    testingProviderId,
    createApiKey,
    revokeApiKey,
    providerUsage,

    invoices: db.invoices,
    pricing: db.pricing,
    subscriptionPlans,
    currentPlan,
    setCurrentPlan: setCurrentPlanState,
    billingPeriod,
    setBillingPeriod,
    updatePricing,

    wallet,
    wallets: db.wallets,
    walletTransactions: db.walletTransactions,
    myTransactions,
    payments: db.payments,
    paymentStats,
    topUpMpesa,
    awaitMpesaTopUp,
    cancelMpesaTopUp,
    startCardTopUp,
    confirmCardTopUp,
    refundPayment,
    retryPayment,
    updateWalletSettings,

    activeDossier: db.activeDossier,
    activeProfile,
    lastSearchResult: db.lastSearch,
    searchHistory: db.searchHistory,
    runSearch,
    priceSearch: (ids) => searchService.price(ids),
    preflightSearch: (ids) => searchService.preflight(me, ids),

    usage: db.usage,
    quota: quotaFor(me?.id ?? null),

    settings: db.settings,
    updateSettings,
    canEditSettingsGroup: (g) => settingsService.canEdit(me, g),
    settingsHealth,
    appearance: db.appearance,
    setAppearance,
    audit: db.audit,
    appendAudit: (e) => auditService.append(e),
    sessions: db.sessions,
    revokeSession,

    activities: db.activities,
    addActivity: (title, type) => {
      setState((prev) => ({
        activities: [{ id: uid('a'), title, time: 'Just now', status: 'Completed', type, userId: me?.id }, ...prev.activities].slice(0, 20),
      }));
    },
    toasts,
    pushToast,
    dismissToast,
    sidebarCollapsed,
    setSidebarCollapsed: (v) => {
      setSidebarCollapsed(v);
      settingsService.setAppearance({ sidebarCollapsed: v });
    },
    mobileMenuOpen,
    setMobileMenuOpen,
    apiMode,

    stats,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

export const useAppData = (): AppDataContextType => {
  const ctx = React.useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within an AppDataProvider');
  return ctx;
};

/** Direct store access for components that need slices the context does not surface. */
export { getSnapshot, setState };
export type { SessionRecord, WalletTransaction, InvoiceItem };
