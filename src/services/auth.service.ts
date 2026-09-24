import type { AuditEntry, RoleTier, SystemUser } from '../types';
import { can, canCreateTier, canManageUser, effectivePermissions, legacyRoleToTier } from '../auth/permissions';
import { getSnapshot, setState } from './db';
import { apiOr } from './http';
import { isValidEmail, sleep, uid } from '../lib/format';
import { DEMO_PASSWORD } from '../data/users';

/**
 * Authentication and account administration.
 *
 * Every mutation re-checks the permission in the service layer — hiding a button in the
 * UI is never the only control. The seeded Super Admin is immutable and no caller can
 * ever create another one.
 */

export interface LoginResult {
  ok: boolean;
  user?: SystemUser;
  reason?: 'invalid_credentials' | 'inactive' | 'locked' | 'mfa_required' | 'unknown_email';
  message?: string;
  requiresMfa?: boolean;
  /** Signed bearer token issued by the backend (absent in LOCAL mode). */
  token?: string;
  expiresAt?: string;
}

const sessionUser = (): SystemUser | null => {
  const s = getSnapshot();
  return s.users.find((u) => u.id === s.currentUserId) ?? null;
};

export const authService = {
  async login(email: string, password: string, opts: { ip?: string; device?: string; browser?: string } = {}): Promise<LoginResult> {
    const local = async (): Promise<LoginResult> => {
      await sleep(620);
      const s = getSnapshot();
      const user = s.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!user) return { ok: false, reason: 'unknown_email', message: 'No account matches that email address.' };
      if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
        return { ok: false, reason: 'locked', message: `Account locked until ${new Date(user.lockedUntil).toLocaleTimeString('en-KE')}.` };
      }
      if (user.status !== 'Active') {
        return { ok: false, reason: 'inactive', message: `This account is ${user.status.toLowerCase()}. Contact your administrator.` };
      }
      if (user.password !== password) {
        const attempts = user.failedLoginAttempts + 1;
        const threshold = s.settings.security.lockoutThreshold;
        const lockout = attempts >= threshold;
        setState((prev) => ({
          users: prev.users.map((u) =>
            u.id === user.id
              ? {
                  ...u,
                  failedLoginAttempts: lockout ? 0 : attempts,
                  lockedUntil: lockout
                    ? new Date(Date.now() + s.settings.security.lockoutDurationMin * 60_000).toISOString()
                    : u.lockedUntil,
                }
              : u
          ),
        }));
        auditService.append({
          actorId: user.id,
          actorName: user.email,
          actorTier: user.tier,
          action: lockout ? 'auth.lockout' : 'auth.login.failed',
          entity: 'SystemUser',
          entityId: user.id,
          severity: lockout ? 'critical' : 'warning',
          ip: opts.ip ?? '0.0.0.0',
          detail: lockout
            ? `Account locked after ${threshold} failed attempts`
            : `Failed sign-in attempt ${attempts} of ${threshold}`,
        });
        return {
          ok: false,
          reason: lockout ? 'locked' : 'invalid_credentials',
          message: lockout
            ? `Too many failed attempts. Locked for ${s.settings.security.lockoutDurationMin} minutes.`
            : `Incorrect password. ${threshold - attempts} attempt(s) remaining.`,
        };
      }

      const requiresMfa = user.mfaEnabled || s.settings.security.mfaRequiredFor.includes(user.tier);
      const now = new Date().toISOString();
      setState((prev) => ({
        currentUserId: user.id,
        users: prev.users.map((u) =>
          u.id === user.id ? { ...u, failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now, lastLoginIp: opts.ip ?? '41.90.112.34' } : u
        ),
        sessions: [
          {
            id: `s-${uid('s')}`,
            userId: user.id,
            userName: user.name,
            tier: user.tier,
            ip: opts.ip ?? '41.90.112.34',
            device: opts.device ?? 'This device',
            browser: opts.browser ?? 'This browser',
            location: 'Nairobi, KE',
            startedAt: now,
            lastSeenAt: now,
            current: true,
          },
          ...prev.sessions.map((x) => (x.current ? { ...x, current: false } : x)),
        ],
      }));
      auditService.append({
        actorId: user.id,
        actorName: user.name,
        actorTier: user.tier,
        action: 'auth.login',
        entity: 'Session',
        severity: 'success',
        ip: opts.ip ?? '41.90.112.34',
        detail: `Signed in as ${user.tier === 'user' ? `User · ${user.subRole}` : user.tier === 'admin' ? 'Admin' : 'Super Admin'}${requiresMfa ? ' (MFA required)' : ''}`,
      });
      return { ok: true, user, requiresMfa };
    };

    const { data } = await apiOr<LoginResult>('/api/auth/login', { method: 'POST', body: { email, password } }, local);
    if (data.ok && data.user) {
      // Mirror a backend-authenticated session into the local store for offline rendering,
      // and keep the bearer token so http.ts can sign every subsequent call.
      setState((prev) => ({
        currentUserId: data.user!.id,
        authToken: data.token ?? null,
        authTokenExpiresAt: data.expiresAt ?? null,
        users: prev.users.some((u) => u.id === data.user!.id) ? prev.users : [...prev.users, data.user!],
      }));
    }
    return data;
  },

  logout(reason = 'Signed out'): void {
    const s = getSnapshot();
    const me = sessionUser();
    if (me) {
      setState((prev) => ({
        sessions: prev.sessions.map((x) => (x.userId === me.id && x.current ? { ...x, current: false } : x)),
      }));
      auditService.append({
        actorId: me.id,
        actorName: me.name,
        actorTier: me.tier,
        action: 'auth.logout',
        entity: 'Session',
        severity: 'info',
        ip: me.lastLoginIp ?? '0.0.0.0',
        detail: reason,
      });
    }
    // Fire-and-forget: let the backend revoke the session row (kills the bearer token
    // server-side) even though the local store is already cleared below.
    void apiOr('/api/auth/logout', { method: 'POST', body: { reason } }, async () => undefined);
    setState({ currentUserId: null, authToken: null, authTokenExpiresAt: null });
    return void s;
  },

  list(): SystemUser[] {
    return getSnapshot().users;
  },

  /**
   * Create an account. Enforces:
   *  - Super Admin accounts can NEVER be created (system-seeded only).
   *  - Admin accounts can only be created by a Super Admin.
   *  - User accounts can be created by an Admin or a Super Admin.
   */
  async create(
    actor: SystemUser | null,
    input: { name: string; email: string; phone?: string; department?: string; jobTitle?: string; tier: RoleTier; subRole?: SystemUser['subRole']; password?: string }
  ): Promise<{ ok: boolean; user?: SystemUser; message?: string }> {
    const local = async () => {
      await sleep(380);
      if (!actor) return { ok: false, message: 'Not authenticated.' };
      if (input.tier === 'super_admin') {
        return { ok: false, message: 'Super Admin accounts are seeded by the system and cannot be created from the UI.' };
      }
      if (!can(actor, 'users.create')) return { ok: false, message: 'You do not have permission to create accounts.' };
      if (!canCreateTier(actor, input.tier)) {
        return {
          ok: false,
          message:
            input.tier === 'admin'
              ? 'Only a Super Admin can create Admin accounts.'
              : 'You cannot create accounts of this role.',
        };
      }
      const email = input.email.trim().toLowerCase();
      if (!isValidEmail(email)) return { ok: false, message: 'Enter a valid email address.' };
      if (!input.name.trim()) return { ok: false, message: 'Full name is required.' };
      const s = getSnapshot();
      if (s.users.some((u) => u.email.toLowerCase() === email)) return { ok: false, message: 'An account with that email already exists.' };
      const password = input.password?.trim() || DEMO_PASSWORD;
      if (password.length < s.settings.security.passwordPolicy.minLength) {
        return { ok: false, message: `Password must be at least ${s.settings.security.passwordPolicy.minLength} characters.` };
      }
      const walletId = `w-${uid('u')}`;
      const user: SystemUser = {
        id: uid('u'),
        name: input.name.trim(),
        email,
        password,
        phone: input.phone?.trim() || '',
        department: input.department?.trim() || 'Operations',
        jobTitle: input.jobTitle?.trim() || (input.tier === 'admin' ? 'Administrator' : 'Analyst'),
        tier: input.tier,
        subRole: input.tier === 'user' ? input.subRole ?? 'analyst' : 'analyst',
        status: 'Active',
        isSystem: false,
        mfaEnabled: s.settings.security.mfaRequiredFor.includes(input.tier),
        createdAt: new Date().toISOString(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        walletId,
      };
      setState((prev) => ({
        users: [...prev.users, user],
        wallets: [
          ...prev.wallets,
          {
            id: walletId,
            userId: user.id,
            currency: 'KES',
            balance: 0,
            held: 0,
            lifetimeTopUp: 0,
            lifetimeSpend: 0,
            autoTopUp: false,
            autoTopUpTriggerKes: prev.settings.billing.lowBalanceAlertKes,
            autoTopUpAmountKes: 10000,
            lowBalanceAlertKes: prev.settings.billing.lowBalanceAlertKes,
            overdraftAllowed: prev.settings.billing.overdraftAllowed,
            updatedAt: new Date().toISOString(),
          },
        ],
      }));
      auditService.append({
        actorId: actor.id,
        actorName: actor.name,
        actorTier: actor.tier,
        action: 'user.created',
        entity: 'SystemUser',
        entityId: user.id,
        severity: 'critical',
        ip: actor.lastLoginIp ?? '0.0.0.0',
        detail: `Created ${user.name} <${user.email}> as ${user.tier === 'admin' ? 'Admin' : `User · ${user.subRole}`}`,
      });
      return { ok: true, user };
    };
    return apiOr('/api/users', { method: 'POST', body: input }, local, { syncLocal: true }).then((r) => r.data);
  },

  async update(actor: SystemUser | null, id: string, patch: Partial<SystemUser>): Promise<{ ok: boolean; message?: string }> {
    const local = async () => {
      await sleep(260);
      if (!actor) return { ok: false, message: 'Not authenticated.' };
      const target = getSnapshot().users.find((u) => u.id === id);
      if (!target) return { ok: false, message: 'Account not found.' };
      if (!canManageUser(actor, target)) {
        if (target.isSystem) return { ok: false, message: 'The Super Admin account is seeded by the system and is immutable.' };
        return { ok: false, message: 'You cannot modify this account.' };
      }
      if (patch.tier === 'super_admin') return { ok: false, message: 'Accounts cannot be promoted to Super Admin.' };
      if (patch.tier === 'admin' && actor.tier !== 'super_admin') return { ok: false, message: 'Only a Super Admin may grant the Admin role.' };
      if (patch.isSystem !== undefined) return { ok: false, message: 'The system flag cannot be changed.' };
      setState((prev) => ({ users: prev.users.map((u) => (u.id === id ? { ...u, ...patch, id: u.id, isSystem: u.isSystem } : u)) }));
      auditService.append({
        actorId: actor.id,
        actorName: actor.name,
        actorTier: actor.tier,
        action: 'user.updated',
        entity: 'SystemUser',
        entityId: id,
        severity: 'info',
        ip: actor.lastLoginIp ?? '0.0.0.0',
        detail: `Updated ${target.name}: ${Object.keys(patch).join(', ')}`,
      });
      return { ok: true };
    };
    return apiOr(`/api/users/${id}`, { method: 'PATCH', body: patch }, local, { syncLocal: true }).then((r) => r.data);
  },

  async remove(actor: SystemUser | null, id: string): Promise<{ ok: boolean; message?: string }> {
    const local = async () => {
      await sleep(240);
      if (!actor) return { ok: false, message: 'Not authenticated.' };
      const target = getSnapshot().users.find((u) => u.id === id);
      if (!target) return { ok: false, message: 'Account not found.' };
      if (!can(actor, 'users.delete')) return { ok: false, message: 'You do not have permission to remove accounts.' };
      if (!canManageUser(actor, target)) return { ok: false, message: target.isSystem ? 'The Super Admin account cannot be removed.' : 'You cannot remove this account.' };
      setState((prev) => ({
        users: prev.users.filter((u) => u.id !== id),
        sessions: prev.sessions.filter((s) => s.userId !== id),
      }));
      auditService.append({
        actorId: actor.id,
        actorName: actor.name,
        actorTier: actor.tier,
        action: 'user.deleted',
        entity: 'SystemUser',
        entityId: id,
        severity: 'critical',
        ip: actor.lastLoginIp ?? '0.0.0.0',
        detail: `Removed ${target.name} <${target.email}>`,
      });
      return { ok: true };
    };
    return apiOr(`/api/users/${id}`, { method: 'DELETE' }, local, { syncLocal: true }).then((r) => r.data);
  },

  async toggleStatus(actor: SystemUser | null, id: string): Promise<{ ok: boolean; message?: string }> {
    const target = getSnapshot().users.find((u) => u.id === id);
    if (!target) return { ok: false, message: 'Account not found.' };
    const next = target.status === 'Active' ? 'Inactive' : 'Active';
    const res = await authService.update(actor, id, { status: next });
    if (res.ok) {
      auditService.append({
        actorId: actor?.id ?? 'system',
        actorName: actor?.name ?? 'System',
        actorTier: actor?.tier ?? 'super_admin',
        action: next === 'Active' ? 'user.reactivated' : 'user.deactivated',
        entity: 'SystemUser',
        entityId: id,
        severity: 'warning',
        ip: actor?.lastLoginIp ?? '0.0.0.0',
        detail: `${target.name} set to ${next}`,
      });
    }
    return res;
  },

  async resetPassword(actor: SystemUser | null, id: string): Promise<{ ok: boolean; temporaryPassword?: string; message?: string }> {
    const local = async () => {
      if (!actor || !can(actor, 'users.edit')) return { ok: false, message: 'Not permitted.' };
      const target = getSnapshot().users.find((u) => u.id === id);
      if (!target) return { ok: false, message: 'Account not found.' };
      if (!canManageUser(actor, target)) return { ok: false, message: target.isSystem ? 'The Super Admin account is immutable.' : 'Not permitted.' };
      const temp = `Iprs!${Math.random().toString(36).slice(2, 8)}`;
      await authService.update(actor, id, { password: temp, failedLoginAttempts: 0, lockedUntil: null });
      auditService.append({
        actorId: actor.id,
        actorName: actor.name,
        actorTier: actor.tier,
        action: 'user.password.reset',
        entity: 'SystemUser',
        entityId: id,
        severity: 'critical',
        ip: actor.lastLoginIp ?? '0.0.0.0',
        detail: `Temporary password issued for ${target.name}`,
      });
      return { ok: true, temporaryPassword: temp };
    };
    return apiOr(`/api/users/${id}/reset-password`, { method: 'POST' }, local, { syncLocal: true }).then((r) => r.data);
  },

  /**
   * Self-service profile update. Deliberately narrower than `update()` — a user may never
   * change their own tier, sub-role, status, system flag or password through this path.
   */
  async updateSelf(userId: string, patch: Partial<Pick<SystemUser, 'name' | 'phone' | 'department' | 'jobTitle' | 'avatarUrl' | 'mfaEnabled' | 'ipAllowlist'>>): Promise<{ ok: boolean; message?: string }> {
    const s = getSnapshot();
    const user = s.users.find((u) => u.id === userId);
    if (!user) return { ok: false, message: 'Account not found.' };
    if (!can(user, 'profile.manage')) return { ok: false, message: 'Your role cannot edit its own profile.' };
    const allowed = ['name', 'phone', 'department', 'jobTitle', 'avatarUrl', 'mfaEnabled', 'ipAllowlist'] as const;
    const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => (allowed as readonly string[]).includes(k)));
    setState((prev) => ({ users: prev.users.map((u) => (u.id === userId ? { ...u, ...clean } : u)) }));
    auditService.append({
      actorId: user.id,
      actorName: user.name,
      actorTier: user.tier,
      action: 'profile.updated',
      entity: 'SystemUser',
      entityId: userId,
      severity: 'info',
      ip: user.lastLoginIp ?? '0.0.0.0',
      detail: `Self-service profile update: ${Object.keys(clean).join(', ')}`,
    });
    return { ok: true };
  },

  /** A user changing their own password — allowed for everyone with `profile.manage`. */
  async changeOwnPassword(userId: string, current: string, next: string): Promise<{ ok: boolean; message?: string }> {
    const s = getSnapshot();
    const user = s.users.find((u) => u.id === userId);
    if (!user) return { ok: false, message: 'Account not found.' };
    if (user.password !== current) return { ok: false, message: 'Current password is incorrect.' };
    const policy = s.settings.security.passwordPolicy;
    const fails: string[] = [];
    if (next.length < policy.minLength) fails.push(`at least ${policy.minLength} characters`);
    if (policy.requireUppercase && !/[A-Z]/.test(next)) fails.push('an uppercase letter');
    if (policy.requireLowercase && !/[a-z]/.test(next)) fails.push('a lowercase letter');
    if (policy.requireNumber && !/\d/.test(next)) fails.push('a number');
    if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(next)) fails.push('a symbol');
    if (fails.length) return { ok: false, message: `Password policy requires ${fails.join(', ')}.` };
    if (next === current) return { ok: false, message: 'New password must differ from the current one.' };
    setState((prev) => ({ users: prev.users.map((u) => (u.id === userId ? { ...u, password: next } : u)) }));
    auditService.append({
      actorId: user.id,
      actorName: user.name,
      actorTier: user.tier,
      action: 'user.password.changed',
      entity: 'SystemUser',
      entityId: user.id,
      severity: 'critical',
      ip: user.lastLoginIp ?? '0.0.0.0',
      detail: 'Self-service password change',
    });
    return { ok: true };
  },

  async revokeSession(actor: SystemUser | null, sessionId: string): Promise<{ ok: boolean; message?: string }> {
    const local = async () => {
      const s = getSnapshot();
      const session = s.sessions.find((x) => x.id === sessionId);
      if (!session) return { ok: false, message: 'Session not found.' };
      const isSelf = actor?.id === session.userId;
      if (!isSelf && !can(actor, 'sessions.revoke')) return { ok: false, message: 'Not permitted.' };
      if (!isSelf && actor && actor.tier === 'admin' && session.tier === 'super_admin') {
        return { ok: false, message: 'An Admin cannot revoke a Super Admin session.' };
      }
      setState((prev) => ({ sessions: prev.sessions.filter((x) => x.id !== sessionId) }));
      auditService.append({
        actorId: actor?.id ?? 'system',
        actorName: actor?.name ?? 'System',
        actorTier: actor?.tier ?? 'super_admin',
        action: 'session.revoked',
        entity: 'Session',
        entityId: sessionId,
        severity: 'warning',
        ip: actor?.lastLoginIp ?? '0.0.0.0',
        detail: `Session for ${session.userName} (${session.ip}) revoked`,
      });
      return { ok: true };
    };
    return apiOr(`/api/sessions/${sessionId}`, { method: 'DELETE' }, local, { syncLocal: true }).then((r) => r.data);
  },

  permissionsFor(user: SystemUser): ReturnType<typeof effectivePermissions> {
    return effectivePermissions(user);
  },

  migrateLegacyRole(role: string): { tier: RoleTier; subRole: SystemUser['subRole'] } {
    return legacyRoleToTier(role);
  },
};

/* --------------------------------- audit --------------------------------- */

export const auditService = {
  append(entry: Omit<AuditEntry, 'id' | 'at'>): AuditEntry {
    const record: AuditEntry = { ...entry, id: uid('au'), at: new Date().toISOString() };
    setState((prev) => ({ audit: [record, ...prev.audit].slice(0, 2000) }));
    return record;
  },
  list(): AuditEntry[] {
    return getSnapshot().audit;
  },
};
