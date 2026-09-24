import type { Permission, RoleDefinition, RoleTier, SubRoleDefinition, SystemUser, UserSubRole } from '../types';

/**
 * Role-based access control.
 *
 * Three tiers, each with its own dashboard, navigation and toolset:
 *   - `super_admin` — seeded by the system, NEVER creatable from any UI.
 *   - `admin`       — creatable only by a `super_admin`.
 *   - `user`        — creatable by `admin` or `super_admin`; scoped further by sub-role.
 *
 * `can()` is the single source of truth. It is consulted by the nav, the router guard and
 * the service layer, so hiding a button is never the only control.
 */

export const PERMISSION_LABELS: Record<Permission, string> = {
  'search.run': 'Run searches',
  'search.view.own': 'View own search results',
  'search.view.all': 'View all search results',
  'case.create': 'Create cases',
  'case.update': 'Update cases',
  'case.view.own': 'View own cases',
  'case.view.all': 'View all cases',
  'report.view': 'View reports',
  'report.export': 'Export / download reports',
  'wallet.view.own': 'View own wallet',
  'wallet.topup': 'Top up wallet',
  'wallet.view.all': 'View all wallets',
  'payments.view.all': 'Monitor all payments',
  'payments.refund': 'Issue refunds',
  'billing.view': 'View billing & invoices',
  'pricing.view': 'View pricing catalogue',
  'pricing.edit': 'Edit pricing catalogue',
  'providers.view': 'View provider gateways',
  'providers.configure': 'Configure provider gateways',
  'providers.test': 'Test provider connections',
  'provider.logs.view': 'View provider request logs',
  'apikeys.manage': 'Manage API keys',
  'users.view': 'View team members',
  'users.create': 'Create user accounts',
  'users.create.admin': 'Create admin accounts',
  'users.edit': 'Edit accounts & roles',
  'users.delete': 'Remove accounts',
  'roles.view': 'View permission matrix',
  'roles.edit': 'Edit permission matrix',
  'sessions.view.all': 'View all active sessions',
  'sessions.revoke': 'Revoke sessions',
  'audit.view': 'View audit log',
  'audit.export': 'Export audit log',
  'settings.view': 'View system settings',
  'settings.edit.operational': 'Edit operational settings',
  'settings.edit.security': 'Edit security settings',
  'settings.edit.compliance': 'Edit compliance settings',
  'settings.edit.platform': 'Edit platform settings',
  'maintenance.toggle': 'Toggle maintenance mode',
  'analytics.view': 'View analytics',
  'profile.manage': 'Manage own profile',
};

export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  {
    label: 'Search & Investigations',
    permissions: ['search.run', 'search.view.own', 'search.view.all', 'case.create', 'case.update', 'case.view.own', 'case.view.all', 'report.view', 'report.export'],
  },
  {
    label: 'Wallet, Billing & Pricing',
    permissions: ['wallet.view.own', 'wallet.topup', 'wallet.view.all', 'payments.view.all', 'payments.refund', 'billing.view', 'pricing.view', 'pricing.edit'],
  },
  {
    label: 'Providers & Integrations',
    permissions: ['providers.view', 'providers.configure', 'providers.test', 'provider.logs.view', 'apikeys.manage'],
  },
  {
    label: 'People & Access',
    permissions: ['users.view', 'users.create', 'users.create.admin', 'users.edit', 'users.delete', 'roles.view', 'roles.edit', 'sessions.view.all', 'sessions.revoke', 'audit.view', 'audit.export'],
  },
  {
    label: 'Platform & Governance',
    permissions: ['settings.view', 'settings.edit.operational', 'settings.edit.security', 'settings.edit.compliance', 'settings.edit.platform', 'maintenance.toggle', 'analytics.view', 'profile.manage'],
  },
];

const OPERATIONS: Permission[] = [
  'search.run',
  'search.view.all',
  'case.create',
  'case.update',
  'case.view.all',
  'report.view',
  'report.export',
  'wallet.view.own',
  'wallet.topup',
  'wallet.view.all',
  'payments.view.all',
  'payments.refund',
  'billing.view',
  'pricing.view',
  'providers.view',
  'providers.configure',
  'providers.test',
  'provider.logs.view',
  'apikeys.manage',
  'users.view',
  'users.create',
  'users.edit',
  'sessions.view.all',
  'sessions.revoke',
  'audit.view',
  'audit.export',
  'settings.view',
  'settings.edit.operational',
  'analytics.view',
  'profile.manage',
];

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    tier: 'user',
    label: 'User',
    description:
      'Operational workspace. Runs searches, manages their own cases and reports, and tops up their own wallet.',
    dashboard: 'User Workspace',
    permissions: [
      'search.run',
      'search.view.own',
      'case.view.own',
      'report.view',
      'report.export',
      'wallet.view.own',
      'wallet.topup',
      'billing.view',
      'pricing.view',
      'providers.view',
      'profile.manage',
    ],
    creatableBy: ['admin', 'super_admin'],
  },
  {
    tier: 'admin',
    label: 'Admin',
    description:
      'Organisation administrator. Manages the team, provider gateways, payments and operational settings across the whole workspace.',
    dashboard: 'Admin Dashboard',
    permissions: OPERATIONS,
    /** Only a Super Admin may mint another Admin. */
    creatableBy: ['super_admin'],
  },
  {
    tier: 'super_admin',
    label: 'Super Admin',
    description:
      'Platform owner. Holds every permission including the security/compliance/platform settings, the permission matrix, admin-account creation and maintenance mode.',
    dashboard: 'Super Admin Dashboard',
    permissions: Object.keys(PERMISSION_LABELS) as Permission[],
    systemOnly: true,
    creatableBy: [],
  },
];

export const SUB_ROLE_DEFINITIONS: SubRoleDefinition[] = [
  {
    id: 'analyst',
    label: 'Analyst',
    description: 'Full investigative access — runs searches, opens and works cases, exports reports.',
    permissions: [
      'search.run',
      'search.view.own',
      'case.create',
      'case.update',
      'case.view.own',
      'report.view',
      'report.export',
      'wallet.view.own',
      'wallet.topup',
      'billing.view',
      'pricing.view',
      'providers.view',
      'profile.manage',
    ],
  },
  {
    id: 'officer',
    label: 'Officer',
    description: 'Runs searches and progresses assigned cases; cannot create new cases.',
    permissions: [
      'search.run',
      'search.view.own',
      'case.update',
      'case.view.own',
      'report.view',
      'wallet.view.own',
      'billing.view',
      'pricing.view',
      'providers.view',
      'profile.manage',
    ],
  },
  {
    id: 'viewer',
    label: 'Viewer',
    description: 'Read-only. Can view completed reports and cases but cannot run new searches.',
    permissions: [
      'search.view.own',
      'case.view.own',
      'report.view',
      'wallet.view.own',
      'billing.view',
      'pricing.view',
      'providers.view',
      'profile.manage',
    ],
  },
  {
    id: 'billing',
    label: 'Billing',
    description: 'Finance seat. Manages invoices, wallet top-ups, pricing views and payment records.',
    permissions: [
      'wallet.view.own',
      'wallet.topup',
      'billing.view',
      'pricing.view',
      'report.view',
      'search.view.own',
      'case.view.own',
      'providers.view',
      'profile.manage',
    ],
  },
];

export const TIER_ORDER: RoleTier[] = ['user', 'admin', 'super_admin'];

export const TIER_LABELS: Record<RoleTier, string> = {
  user: 'User',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

export const TIER_DASHBOARDS: Record<RoleTier, string> = {
  user: 'User Workspace',
  admin: 'Admin Dashboard',
  super_admin: 'Super Admin Dashboard',
};

/** Presentation metadata for each tier — used by the sidebar, dashboards and access guard. */
export const TIER_META: Record<RoleTier, { label: string; blurb: string; accent: string; badge: string; ring: string; icon: string }> = {
  user: {
    label: 'User',
    blurb: 'Operational workspace — searches, cases, reports and your own wallet.',
    accent: 'bg-sky-950/50 border-sky-800/50 text-sky-300',
    badge: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
    ring: 'ring-sky-500/40',
    icon: 'UserCog',
  },
  admin: {
    label: 'Admin',
    blurb: 'Organisation control — team, providers, payments and operational settings.',
    accent: 'bg-violet-950/40 border-violet-800/50 text-violet-300',
    badge: 'bg-violet-500/15 text-violet-300 border-violet-500/35',
    ring: 'ring-violet-500/40',
    icon: 'Shield',
  },
  super_admin: {
    label: 'Super Admin',
    blurb: 'Platform ownership — every permission, the audit trail and system integrity.',
    accent: 'bg-amber-950/40 border-amber-700/50 text-amber-300',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    ring: 'ring-amber-500/40',
    icon: 'ShieldCheck',
  },
};

export function roleDefinition(tier: RoleTier): RoleDefinition {
  return ROLE_DEFINITIONS.find((r) => r.tier === tier) ?? ROLE_DEFINITIONS[0];
}

export function subRoleDefinition(sub: UserSubRole): SubRoleDefinition {
  return SUB_ROLE_DEFINITIONS.find((s) => s.id === sub) ?? SUB_ROLE_DEFINITIONS[0];
}

/**
 * Scope implication: holding an org-wide `.view.all` always satisfies the narrower
 * `.view.own` for the same resource.
 *
 * Without this, a route guarded by `case.view.own` locked out the Admin tier — Admin
 * holds `case.view.all` (it may see *every* case) but not the `.own` variant, so the
 * more-privileged account was denied a page its juniors could open. Superset scopes now
 * imply their subsets.
 */
const IMPLIED_BY_ALL: Partial<Record<Permission, Permission>> = {
  'search.view.all': 'search.view.own',
  'case.view.all': 'case.view.own',
  'wallet.view.all': 'wallet.view.own',
};

function applyImplications(set: Set<Permission>): void {
  for (const [broader, narrower] of Object.entries(IMPLIED_BY_ALL) as [Permission, Permission][]) {
    if (set.has(broader)) set.add(narrower);
  }
}

/** Effective permission set for an account, after sub-role scoping and per-user overrides. */
export function effectivePermissions(user: SystemUser): Set<Permission> {
  const base =
    user.tier === 'user'
      ? new Set<Permission>(subRoleDefinition(user.subRole).permissions)
      : new Set<Permission>(roleDefinition(user.tier).permissions);

  const out = new Set<Permission>(base);
  // Super Admin is never down-scoped — it is the system owner account.
  if (user.tier === 'super_admin') {
    (Object.keys(PERMISSION_LABELS) as Permission[]).forEach((p) => out.add(p));
    return out;
  }
  for (const [key, value] of Object.entries(user.permissionOverrides ?? {})) {
    const perm = key as Permission;
    if (value) out.add(perm);
    else out.delete(perm);
  }
  // An explicit override removing `.view.own` must win over the implication, so
  // implications are applied first and overrides re-asserted afterwards.
  applyImplications(out);
  for (const [key, value] of Object.entries(user.permissionOverrides ?? {})) {
    if (!value) out.delete(key as Permission);
  }
  return out;
}

export function can(user: SystemUser | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  if (user.status !== 'Active') return false;
  return effectivePermissions(user).has(permission);
}

export function isAtLeastTier(user: SystemUser | null | undefined, tier: RoleTier): boolean {
  if (!user) return false;
  return TIER_ORDER.indexOf(user.tier) >= TIER_ORDER.indexOf(tier);
}

/** Can `actor` create an account of `targetTier`? Enforced in the service layer too. */
export function canCreateTier(actor: SystemUser | null | undefined, targetTier: RoleTier): boolean {
  if (!actor) return false;
  // The Super Admin account is seeded by the system and can never be created from a UI.
  if (targetTier === 'super_admin') return false;
  const allowed = roleDefinition(targetTier).creatableBy ?? [];
  return allowed.includes(actor.tier);
}

/** Can `actor` manage (edit / deactivate / delete) `target`? */
export function canManageUser(actor: SystemUser | null | undefined, target: SystemUser): boolean {
  if (!actor) return false;
  if (target.isSystem) return false; // seeded Super Admin is immutable
  if (actor.id === target.id) return false; // no self-demotion / self-deletion
  if (actor.tier === 'super_admin') return true;
  if (actor.tier === 'admin') return target.tier === 'user';
  return false;
}

export function dashboardLabelFor(user: SystemUser | null | undefined): string {
  if (!user) return 'Dashboard';
  return TIER_DASHBOARDS[user.tier];
}

/** Legacy 5-role label → tier, used when migrating older persisted state. */
export function legacyRoleToTier(role: string): { tier: RoleTier; subRole: UserSubRole } {
  switch (role) {
    case 'Super Admin':
      return { tier: 'super_admin', subRole: 'analyst' };
    case 'Analyst':
      return { tier: 'user', subRole: 'analyst' };
    case 'Officer':
      return { tier: 'user', subRole: 'officer' };
    case 'Viewer':
      return { tier: 'user', subRole: 'viewer' };
    case 'Billing':
      return { tier: 'user', subRole: 'billing' };
    default:
      return { tier: 'user', subRole: 'viewer' };
  }
}

/** Human label for a user, e.g. "Admin" or "User · Analyst". */
export function roleLabelFor(user: SystemUser): string {
  if (user.tier === 'user') return `${TIER_LABELS.user} · ${subRoleDefinition(user.subRole).label}`;
  return TIER_LABELS[user.tier];
}
