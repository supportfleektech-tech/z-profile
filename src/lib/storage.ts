/**
 * Namespaced, versioned, crash-safe localStorage persistence.
 *
 * The prototype ships as a single HTML file with no backend, so the browser is the
 * database. Every read is defensive (corrupt JSON must never white-screen the app) and
 * every write is best-effort (private-mode quota errors are swallowed).
 */

const NS = 'iprs.v1';
const SCHEMA_VERSION = 3;

type Store = Record<string, unknown>;

function memoryFallback(): Store {
  const m: Store = {};
  return m;
}

let memStore: Store | null = null;

function hasLocalStorage(): boolean {
  try {
    const k = `${NS}.probe`;
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

const USE_LS = typeof window !== 'undefined' && hasLocalStorage();

function key(name: string): string {
  return `${NS}.${name}`;
}

export function readStore<T>(name: string, fallback: T): T {
  try {
    const raw = USE_LS ? window.localStorage.getItem(key(name)) : (memStore ??= memoryFallback())[name] as string | undefined;
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    if (parsed === null || parsed === undefined) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

export function writeStore<T>(name: string, value: T): void {
  try {
    const raw = JSON.stringify(value);
    if (USE_LS) window.localStorage.setItem(key(name), raw);
    else (memStore ??= memoryFallback())[name] = raw;
  } catch {
    /* quota exceeded / private mode — keep running in memory */
  }
}

export function removeStore(name: string): void {
  try {
    if (USE_LS) window.localStorage.removeItem(key(name));
    else delete (memStore ??= memoryFallback())[name];
  } catch {
    /* ignore */
  }
}

export interface PersistedState<T> {
  v: number;
  data: T;
}

/** Read with a schema-version guard; stale payloads are discarded rather than half-migrated. */
export function readVersioned<T>(name: string, fallback: T): T {
  const stored = readStore<PersistedState<T> | null>(name, null);
  if (!stored || stored.v !== SCHEMA_VERSION) return fallback;
  return stored.data ?? fallback;
}

export function writeVersioned<T>(name: string, data: T): void {
  writeStore<PersistedState<T>>(name, { v: SCHEMA_VERSION, data });
}

export const STORE_KEYS = {
  session: 'session',
  users: 'users',
  wallets: 'wallets',
  walletTx: 'wallet-transactions',
  payments: 'payments',
  paymentMethods: 'payment-methods',
  providerConfigs: 'provider-configs',
  providerLogs: 'provider-logs',
  apiKeys: 'api-keys',
  settings: 'settings',
  audit: 'audit-log',
  sessions: 'sessions',
  notifications: 'notifications',
  notifPrefs: 'notification-prefs',
  appearance: 'appearance',
  cases: 'cases',
  usage: 'usage',
  pricingOverrides: 'pricing-overrides',
  permissionOverrides: 'permission-overrides',
} as const;

export function resetAllStores(): void {
  Object.values(STORE_KEYS).forEach(removeStore);
}

export function storageKind(): 'localStorage' | 'memory' {
  return USE_LS ? 'localStorage' : 'memory';
}
