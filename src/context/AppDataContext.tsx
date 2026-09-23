import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  casesData as initialCases,
  adminUsersData as initialUsers,
  notificationsData as initialNotifications,
  invoicesData,
  providersData as initialProviders,
  primaryProfile,
  recentActivities as initialActivities,
  pricingPlans,
} from '../data/mockData';
import {
  CaseItem,
  UserItem,
  NotificationItem,
  InvoiceItem,
  ProviderItem,
  IdentityProfile,
} from '../types';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export interface SearchResult {
  query: string;
  profile: IdentityProfile;
  timestamp: string;
  riskScore: number;
}

interface AppDataContextType {
  // Auth
  isAuthenticated: boolean;
  currentUser: UserItem | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;

  // Cases
  cases: CaseItem[];
  addCase: (c: Omit<CaseItem, 'id' | 'caseId' | 'updated'>) => CaseItem;
  updateCaseStatus: (id: string, status: CaseItem['status']) => void;

  // Users
  users: UserItem[];
  addUser: (u: Omit<UserItem, 'id'>) => void;
  removeUser: (id: string) => void;
  toggleUserStatus: (id: string) => void;

  // Notifications
  notifications: NotificationItem[];
  unreadCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addNotification: (n: Omit<NotificationItem, 'id' | 'read' | 'time'>) => void;

  // Providers
  providers: ProviderItem[];
  pingProvider: (id: string) => Promise<void>;
  syncingProviderId: string | null;

  // Billing
  invoices: InvoiceItem[];
  currentPlan: string;
  setCurrentPlan: (plan: string) => void;
  billingPeriod: 'monthly' | 'yearly';
  setBillingPeriod: (p: 'monthly' | 'yearly') => void;

  // Search / Profile
  lastSearchResult: SearchResult | null;
  setLastSearchResult: (r: SearchResult | null) => void;
  activeProfile: IdentityProfile;
  setActiveProfile: (p: IdentityProfile) => void;
  searchHistory: SearchResult[];

  // Activities
  activities: typeof initialActivities;
  addActivity: (title: string, type: string) => void;

  // UI
  toasts: ToastMessage[];
  pushToast: (t: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (v: boolean) => void;

  // Stats (derived)
  stats: {
    totalSearches: number;
    successful: number;
    failed: number;
    revenue: string;
  };

  pricingPlans: typeof pricingPlans;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserItem | null>(initialUsers[0]);
  const [cases, setCases] = useState<CaseItem[]>(initialCases);
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [providers, setProviders] = useState<ProviderItem[]>(initialProviders);
  const [invoices] = useState<InvoiceItem[]>(invoicesData);
  const [currentPlan, setCurrentPlan] = useState('professional');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [lastSearchResult, setLastSearchResult] = useState<SearchResult | null>(null);
  const [activeProfile, setActiveProfile] = useState<IdentityProfile>(primaryProfile);
  const [searchHistory, setSearchHistory] = useState<SearchResult[]>([]);
  const [activities, setActivities] = useState(initialActivities);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [syncingProviderId, setSyncingProviderId] = useState<string | null>(null);
  const [stats] = useState({
    totalSearches: 1248,
    successful: 1183,
    failed: 65,
    revenue: 'KES 482,600',
  });

  const pushToast = useCallback((t: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { ...t, id }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 4200);
    return () => clearTimeout(timer);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

const login = useCallback(async (email: string, _password: string) => {
  await new Promise((r) => setTimeout(r, 700));
  const user = users.find((u) => u.email === email) || initialUsers[0];
  if (!user) {
    pushToast({ title: 'Authentication failed', description: 'Invalid credentials', type: 'error' });
    return false;
  }
  setCurrentUser(user);
  setIsAuthenticated(true);
  pushToast({ title: 'Welcome back', description: `Signed in as ${user.name}`, type: 'success' });
  return true;
}, [users, pushToast]);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    pushToast({ title: 'Signed out', description: 'Session ended securely', type: 'info' });
  }, [pushToast]);

  const addCase = useCallback((c: Omit<CaseItem, 'id' | 'caseId' | 'updated'>) => {
    const newCase: CaseItem = {
      ...c,
      id: `c-${Date.now()}`,
      caseId: `IPRS-${Math.floor(10000 + Math.random() * 90000)}`,
      updated: 'Just now',
    };
    setCases((prev) => [newCase, ...prev]);
    pushToast({ title: 'Case created', description: `${newCase.caseId} — ${newCase.subject}`, type: 'success' });
    setNotifications((prev) => [
      {
        id: `n-${Date.now()}`,
        title: 'New case assigned',
        description: `Case ${newCase.caseId} has been created for ${newCase.subject}.`,
        time: 'Just now',
        category: 'System',
        type: 'success',
        read: false,
      },
      ...prev,
    ]);
    return newCase;
  }, [pushToast]);

  const updateCaseStatus = useCallback((id: string, status: CaseItem['status']) => {
    setCases((prev) => prev.map((c) => (c.id === id ? { ...c, status, updated: 'Just now' } : c)));
    pushToast({ title: 'Case updated', description: `Status set to ${status}`, type: 'info' });
  }, [pushToast]);

  const addUser = useCallback((u: Omit<UserItem, 'id'>) => {
    const newUser: UserItem = { ...u, id: `u-${Date.now()}` };
    setUsers((prev) => [...prev, newUser]);
    pushToast({ title: 'User added', description: `${newUser.name} (${newUser.role})`, type: 'success' });
  }, [pushToast]);

  const removeUser = useCallback((id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    pushToast({ title: 'Access revoked', description: 'User removed from organization', type: 'warning' });
  }, [pushToast]);

  const toggleUserStatus = useCallback((id: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' } : u
      )
    );
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    pushToast({ title: 'All caught up', description: 'Notifications marked as read', type: 'success' });
  }, [pushToast]);

  const addNotification = useCallback((n: Omit<NotificationItem, 'id' | 'read' | 'time'>) => {
    setNotifications((prev) => [
      { ...n, id: `n-${Date.now()}`, read: false, time: 'Just now' },
      ...prev,
    ]);
  }, []);

  const pingProvider = useCallback(async (id: string) => {
    setSyncingProviderId(id);
    await new Promise((r) => setTimeout(r, 900));
    setProviders((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, lastSync: 'Just now', latencyMs: Math.floor(60 + Math.random() * 200), status: 'Active' }
          : p
      )
    );
    setSyncingProviderId(null);
    const name = providers.find((p) => p.id === id)?.name || 'Provider';
    pushToast({ title: 'Sync complete', description: `${name} gateway responded OK`, type: 'success' });
  }, [providers, pushToast]);

  const setLastSearchResultWrapped = useCallback((r: SearchResult | null) => {
    setLastSearchResult(r);
    if (r) {
      setSearchHistory((prev) => [r, ...prev].slice(0, 20));
      setActiveProfile(r.profile);
      setActivities((prev) => [
        {
          id: `a-${Date.now()}`,
          title: `Identity Report - ${r.profile.fullName}`,
          time: 'Just now',
          status: 'Completed',
          type: 'identity',
        },
        ...prev,
      ].slice(0, 10));
    }
  }, []);

  const addActivity = useCallback((title: string, type: string) => {
    setActivities((prev) => [
      { id: `a-${Date.now()}`, title, time: 'Just now', status: 'Completed', type },
      ...prev,
    ].slice(0, 10));
  }, []);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value: AppDataContextType = {
    isAuthenticated,
    currentUser,
    login,
    logout,
    cases,
    addCase,
    updateCaseStatus,
    users,
    addUser,
    removeUser,
    toggleUserStatus,
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    addNotification,
    providers,
    pingProvider,
    syncingProviderId,
    invoices,
    currentPlan,
    setCurrentPlan,
    billingPeriod,
    setBillingPeriod,
    lastSearchResult,
    setLastSearchResult: setLastSearchResultWrapped,
    activeProfile,
    setActiveProfile,
    searchHistory,
    activities,
    addActivity,
    toasts,
    pushToast,
    dismissToast,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileMenuOpen,
    setMobileMenuOpen,
    stats,
    pricingPlans,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

export const useAppData = (): AppDataContextType => {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
};
