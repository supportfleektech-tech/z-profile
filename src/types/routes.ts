import type { Permission, RoleTier } from './index';

export interface PageRoute {
  id: string;
  path: string;
  title: string;
  shortTitle: string;
  moduleNumber?: number;
  category: 'core' | 'operations' | 'business' | 'system' | 'governance';
  icon: string;
  description: string;
  /** Which tiers may open this route. Omitted = every authenticated tier. */
  tiers?: RoleTier[];
  /** Permission required in addition to the tier check. */
  permission?: Permission;
  /** Rendered outside the app shell. */
  public?: boolean;
}

/**
 * The platform route table.
 *
 * `tiers` + `permission` drive three things at once: sidebar visibility, the router's
 * access guard, and the command palette — so the User, Admin and Super Admin experiences
 * genuinely differ instead of just hiding a few buttons.
 */
export const platformRoutes: PageRoute[] = [
  {
    id: 'login',
    path: '/login',
    title: 'Secure Sign In',
    shortTitle: 'Login',
    moduleNumber: 1,
    category: 'core',
    icon: 'LogIn',
    description: 'Role-aware authentication gateway with lockout and MFA',
    public: true,
  },
  {
    id: 'dashboard',
    path: '/dashboard',
    title: 'Dashboard',
    shortTitle: 'Dashboard',
    moduleNumber: 2,
    category: 'core',
    icon: 'LayoutDashboard',
    description: 'Tier-specific dashboard — User Workspace, Admin Dashboard or Super Admin Dashboard',
  },

  /* --------------------------------- operations -------------------------------- */
  {
    id: 'new-search',
    path: '/search',
    title: 'New Search / Investigation',
    shortTitle: 'New Search',
    moduleNumber: 3,
    category: 'operations',
    icon: 'Search',
    description: 'Priced, consented querying across the national registry, M-PESA, CRB, KRA and utilities',
    tiers: ['user', 'admin', 'super_admin'],
    permission: 'search.run',
  },
  {
    id: 'identity-profile',
    path: '/identity-profile',
    title: 'Identity Profile (Results)',
    shortTitle: 'Identity Profile',
    moduleNumber: 4,
    category: 'operations',
    icon: 'UserCheck',
    description: 'Citizen dossier — Personal, Financial, Connections and Logs tabs with the full extracted record',
    permission: 'report.view',
  },
  {
    id: 'detailed-report',
    path: '/report',
    title: 'Detailed Report View',
    shortTitle: 'Detailed Report',
    moduleNumber: 5,
    category: 'operations',
    icon: 'FileBarChart2',
    description: 'Executive summary or the complete report, with real print layout and PDF download',
    permission: 'report.view',
  },
  {
    id: 'cases',
    path: '/cases',
    title: 'Cases / Investigations',
    shortTitle: 'Cases',
    moduleNumber: 6,
    category: 'operations',
    icon: 'Briefcase',
    description: 'Case pipeline with priority, ownership and status progression',
    permission: 'case.view.own',
  },

  /* ---------------------------------- business --------------------------------- */
  {
    id: 'wallet',
    path: '/wallet',
    title: 'Wallet & Top Up',
    shortTitle: 'Wallet',
    moduleNumber: 7,
    category: 'business',
    icon: 'Wallet',
    description: 'Prepaid wallet, M-PESA STK Push and card top-ups, ledger and statements',
    permission: 'wallet.view.own',
  },
  {
    id: 'billing',
    path: '/billing',
    title: 'Billing & Invoices',
    shortTitle: 'Billing',
    moduleNumber: 8,
    category: 'business',
    icon: 'CreditCard',
    description: 'Quota meters, invoices, payment methods and subscription management',
    permission: 'billing.view',
  },
  {
    id: 'pricing',
    path: '/pricing',
    title: 'Pricing & Tiers (Batch 0–500)',
    shortTitle: 'Pricing',
    moduleNumber: 9,
    category: 'business',
    icon: 'Layers',
    description: 'KYC / KYB Financial Proposal 2026 line items, bundles and cost calculator',
    permission: 'pricing.view',
  },
  {
    id: 'payments',
    path: '/payments',
    title: 'Payments Monitor',
    shortTitle: 'Payments',
    moduleNumber: 10,
    category: 'business',
    icon: 'Landmark',
    description: 'Every payment across every user — reconciliation, refunds, retries and gateway responses',
    tiers: ['admin', 'super_admin'],
    permission: 'payments.view.all',
  },
  {
    id: 'reports-analytics',
    path: '/analytics',
    title: 'Reports & Analytics',
    shortTitle: 'Analytics',
    moduleNumber: 11,
    category: 'business',
    icon: 'BarChart3',
    description: 'Registry breakdown, revenue, provider cost and service metrics',
    tiers: ['admin', 'super_admin'],
    permission: 'analytics.view',
  },

  /* ----------------------------------- system ---------------------------------- */
  {
    id: 'provider-management',
    path: '/providers',
    title: 'Provider Management',
    shortTitle: 'Providers',
    moduleNumber: 12,
    category: 'system',
    icon: 'Server',
    description: 'Gateway connection, behaviour, commercial terms, field mapping, webhooks and request logs',
    permission: 'providers.view',
  },
  {
    id: 'api-docs',
    path: '/api-docs',
    title: 'API Documentation',
    shortTitle: 'API Docs',
    moduleNumber: 13,
    category: 'system',
    icon: 'Code2',
    description: 'REST endpoints, bearer tokens, scopes and cURL references',
    permission: 'providers.view',
  },

  /* --------------------------------- governance -------------------------------- */
  {
    id: 'admin-console',
    path: '/admin',
    title: 'Team & Access Control',
    shortTitle: 'Admin Console',
    moduleNumber: 14,
    category: 'governance',
    icon: 'Shield',
    description: 'Accounts, roles, the permission matrix, active sessions and organisation profile',
    tiers: ['admin', 'super_admin'],
    permission: 'users.view',
  },
  {
    id: 'system-settings',
    path: '/settings',
    title: 'System Settings',
    shortTitle: 'System Settings',
    moduleNumber: 15,
    category: 'governance',
    icon: 'Settings',
    description: 'Organisation, security, compliance, risk engine, billing, integrations, platform and backup',
    tiers: ['admin', 'super_admin'],
    permission: 'settings.view',
  },
  {
    id: 'audit',
    path: '/audit',
    title: 'Audit Log & Sessions',
    shortTitle: 'Audit Log',
    moduleNumber: 16,
    category: 'governance',
    icon: 'ScrollText',
    description: 'Append-only platform audit trail with filters, export and session forensics',
    tiers: ['admin', 'super_admin'],
    permission: 'audit.view',
  },

  /* ----------------------------------- core ------------------------------------ */
  {
    id: 'notifications',
    path: '/notifications',
    title: 'Alerts & Notifications',
    shortTitle: 'Notifications',
    moduleNumber: 17,
    category: 'core',
    icon: 'Bell',
    description: 'Security alerts, case dispatch, provider outages and payment events',
  },
  {
    id: 'user-profile',
    path: '/profile',
    title: 'Profile, Security & Preferences',
    shortTitle: 'Profile & Settings',
    moduleNumber: 18,
    category: 'core',
    icon: 'UserCog',
    description: 'Personal details, password and 2FA, sessions, API keys, notification channels and appearance',
    permission: 'profile.manage',
  },
];

export const CATEGORY_LABELS: Record<PageRoute['category'], string> = {
  core: 'Workspace',
  operations: 'Operations',
  business: 'Finance',
  system: 'Integrations',
  governance: 'Governance',
};

export const CATEGORY_ORDER: PageRoute['category'][] = ['core', 'operations', 'business', 'system', 'governance'];

/** Routes visible to a tier, used by the sidebar, command palette and access guard. */
export function routesForTier(tier: RoleTier | null | undefined): PageRoute[] {
  if (!tier) return platformRoutes.filter((r) => r.public);
  return platformRoutes.filter((r) => !r.public && (!r.tiers || r.tiers.includes(tier)));
}

export function findRoute(path: string): PageRoute | undefined {
  return platformRoutes.find((r) => r.path === path);
}

export const TOTAL_MODULES = platformRoutes.filter((r) => !r.public).length;
