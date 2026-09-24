import React, { useMemo, useState } from 'react';
import {
  Shield, Users, KeyRound, ScrollText, Building2, Plus, Pencil, Ban, CheckCircle2, RotateCcw,
  Lock, ShieldCheck, AlertTriangle, Download, Eye, Trash2, Fingerprint, Mail, Phone,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { useAppRouter } from '../../context/RouterContext';
import {
  Badge, Button, Callout, Checkbox, ConfirmDialog, Drawer, EmptyState, Field, Modal, Panel,
  ResponsiveTable, SearchInput, Select, Tabs, TextInput, Toggle, type Column,
} from '../ui';
import {
  PERMISSION_GROUPS, PERMISSION_LABELS, ROLE_DEFINITIONS, SUB_ROLE_DEFINITIONS, TIER_META, TIER_ORDER,
  canCreateTier, canManageUser, effectivePermissions, roleLabelFor, subRoleDefinition,
} from '../../auth/permissions';
import { downloadText, formatDate, maskSecret, timeAgo, toCsv } from '../../lib/format';
import { DEMO_PASSWORD } from '../../data/users';
import type { AuditEntry, Permission, RoleTier, SessionRecord, SystemUser, UserSubRole } from '../../types';

const TABS = ['Users', 'Roles & Permissions', 'Sessions', 'Audit', 'Organisation'] as const;
type Tab = (typeof TABS)[number];

const tierBadge = (t: RoleTier) => <Badge tone={t === 'super_admin' ? 'warning' : t === 'admin' ? 'accent' : 'info'}>{TIER_META[t].label}</Badge>;

/**
 * Admin Console — Team & Access Control.
 *
 * Creation rules are enforced in the UI *and* in `authService`:
 *  • Super Admin is a seeded system account and can never be created, edited, suspended
 *    or deleted from any interface.
 *  • Only a Super Admin may create an Admin account.
 *  • Admins may create and manage User-tier accounts.
 */
export const Screen9_AdminConsole: React.FC = () => {
  const {
    users, currentUser, addUser, updateUser, removeUser, toggleUserStatus, resetUserPassword, can,
    sessions, revokeSession, audit, settings, updateSettings, pushToast,
  } = useAppData();
  const { navigate } = useAppRouter();

  const [tab, setTab] = useState<Tab>('Users');
  const [q, setQ] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | RoleTier>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SystemUser['status']>('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<SystemUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SystemUser | null>(null);
  const [issuedPassword, setIssuedPassword] = useState<{ user: string; password: string } | null>(null);

  /* ------------------------------- create form ------------------------------- */
  const blank = {
    name: '',
    email: '',
    phone: '',
    department: 'Operations',
    jobTitle: '',
    tier: 'user' as RoleTier,
    subRole: 'analyst' as UserSubRole,
    password: '',
    mfaEnabled: false,
  };
  const [form, setForm] = useState(blank);
  const [formError, setFormError] = useState<string | null>(null);

  const creatableTiers = useMemo(() => TIER_ORDER.filter((t) => canCreateTier(currentUser, t)), [currentUser]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return users.filter((u) => {
      if (tierFilter !== 'all' && u.tier !== tierFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (!needle) return true;
      return [u.name, u.email, u.department, u.jobTitle, roleLabelFor(u)].join(' ').toLowerCase().includes(needle);
    });
  }, [users, q, tierFilter, statusFilter]);

  const userCols: Column<SystemUser>[] = [
    {
      key: 'name',
      header: 'Account',
      mobilePrimary: true,
      render: (u) => (
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold border ${TIER_META[u.tier].badge}`}>
            {u.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold text-white truncate">
              {u.name}
              {u.isSystem && <span className="ml-1.5 text-[8px] uppercase tracking-wider text-amber-400/90 font-bold">system</span>}
            </span>
            <span className="block text-[10px] text-slate-500 truncate font-mono">{u.email}</span>
          </span>
        </div>
      ),
      sortValue: (u) => u.name,
    },
    {
      key: 'role',
      header: 'Role',
      render: (u) => (
        <div className="flex flex-col gap-0.5">
          {tierBadge(u.tier)}
          {u.tier === 'user' && <span className="text-[9px] text-slate-500">{subRoleDefinition(u.subRole).label}</span>}
        </div>
      ),
      renderMobile: (u) => `${TIER_META[u.tier].label}${u.tier === 'user' ? ` · ${subRoleDefinition(u.subRole).label}` : ''}`,
      sortValue: (u) => u.tier,
    },
    { key: 'dept', header: 'Department', render: (u) => <span className="text-[11px] text-slate-300">{u.department}</span>, className: 'hidden lg:table-cell', sortValue: (u) => u.department },
    { key: 'title', header: 'Job title', render: (u) => <span className="text-[11px] text-slate-400 truncate">{u.jobTitle}</span>, className: 'hidden xl:table-cell' },
    {
      key: 'perms',
      header: 'Permissions',
      render: (u) => <span className="font-mono text-[11px] text-cyan-300">{effectivePermissions(u).size}</span>,
      align: 'right',
      sortValue: (u) => effectivePermissions(u).size,
    },
    {
      key: 'mfa',
      header: 'MFA',
      render: (u) => (u.mfaEnabled ? <Badge tone="success" dot>On</Badge> : <Badge tone="neutral">Off</Badge>),
      align: 'center',
      className: 'hidden sm:table-cell',
      sortValue: (u) => (u.mfaEnabled ? 1 : 0),
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <Badge tone={u.status === 'Active' ? 'success' : u.status === 'Suspended' ? 'danger' : 'neutral'} dot>
          {u.status}
        </Badge>
      ),
      sortValue: (u) => u.status,
    },
    {
      key: 'last',
      header: 'Last sign-in',
      render: (u) => (
        <span className="text-[10px] text-slate-500">
          {u.lastLoginAt ? (
            <>
              <span className="block">{timeAgo(u.lastLoginAt)}</span>
              <span className="block font-mono text-slate-600">{u.lastLoginIp ?? '—'}</span>
            </>
          ) : (
            'Never'
          )}
        </span>
      ),
      className: 'hidden lg:table-cell',
      sortValue: (u) => u.lastLoginAt ?? '',
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (u) => {
        const manageable = canManageUser(currentUser, u);
        return (
          <div className="flex items-center justify-end gap-1">
            <Button size="xs" variant="ghost" onClick={() => setEditing(u)} disabled={!manageable} title={manageable ? 'Edit account' : 'Not manageable by your role'} icon={<Eye size={12} />}>
              <span className="hidden sm:inline">View</span>
            </Button>
            {can('users.edit') && (
              <Button size="xs" variant="ghost" onClick={() => toggleUserStatus(u.id)} disabled={!manageable || u.isSystem} title="Toggle active / suspended" icon={u.status === 'Active' ? <Ban size={12} /> : <CheckCircle2 size={12} />} />
            )}
            {can('users.edit') && (
              <Button size="xs" variant="ghost" onClick={async () => {
                const res = await resetUserPassword(u.id);
                if (res.ok && res.temporaryPassword) setIssuedPassword({ user: u.name, password: res.temporaryPassword });
              }} disabled={!manageable} title="Issue temporary password" icon={<RotateCcw size={12} />} />
            )}
            {can('users.delete') && (
              <Button size="xs" variant="ghost" onClick={() => setConfirmDelete(u)} disabled={!manageable || u.isSystem} title="Revoke access" icon={<Trash2 size={12} />} className="text-rose-400/80 hover:text-rose-300" />
            )}
          </div>
        );
      },
      renderMobile: (u) => {
        const manageable = canManageUser(currentUser, u);
        return (
          <div className="flex items-center gap-1.5">
            <Button size="xs" variant="secondary" onClick={() => setEditing(u)} disabled={!manageable} icon={<Pencil size={11} />}>
              {manageable ? 'Edit' : 'View only'}
            </Button>
            {can('users.delete') && !u.isSystem && manageable && (
              <Button size="xs" variant="danger" onClick={() => setConfirmDelete(u)} icon={<Trash2 size={11} />}>
                Revoke
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const sessionCols: Column<SessionRecord>[] = [
    {
      key: 'user',
      header: 'Account',
      mobilePrimary: true,
      render: (s) => (
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-white truncate flex items-center gap-1.5">
            {s.userName}
            {s.current && <Badge tone="success">This device</Badge>}
          </div>
          <div className="text-[10px] text-slate-500 truncate">{s.device} · {s.browser}</div>
        </div>
      ),
      sortValue: (s) => s.userName,
    },
    { key: 'tier', header: 'Tier', render: (s) => tierBadge(s.tier), sortValue: (s) => s.tier },
    { key: 'ip', header: 'IP address', render: (s) => <span className="font-mono text-[10px] text-cyan-300">{s.ip}</span>, sortValue: (s) => s.ip },
    { key: 'loc', header: 'Location', render: (s) => <span className="text-[11px]">{s.location}</span>, className: 'hidden sm:table-cell', sortValue: (s) => s.location },
    { key: 'started', header: 'Started', render: (s) => <span className="text-[10px] text-slate-400">{formatDate(s.startedAt, true)}</span>, sortValue: (s) => s.startedAt },
    { key: 'seen', header: 'Last seen', render: (s) => <span className="text-[10px] text-slate-500">{timeAgo(s.lastSeenAt)}</span>, className: 'hidden lg:table-cell', sortValue: (s) => s.lastSeenAt },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (s) => (
        <Button size="xs" variant="danger" disabled={!can('sessions.revoke') || s.current} onClick={() => revokeSession(s.id)} icon={<Lock size={11} />}>
          <span className="hidden sm:inline">Revoke</span>
        </Button>
      ),
      renderMobile: (s) => (
        <Button size="xs" variant="danger" disabled={!can('sessions.revoke') || s.current} onClick={() => revokeSession(s.id)} icon={<Lock size={11} />}>
          Revoke session
        </Button>
      ),
    },
  ];

  const auditCols: Column<AuditEntry>[] = [
    { key: 'at', header: 'When', render: (a) => <span className="font-mono text-[10px] text-slate-400">{formatDate(a.at, true)}</span>, mobilePrimary: true, sortValue: (a) => a.at },
    { key: 'actor', header: 'Actor', render: (a) => (
      <span className="text-[11px]">
        <span className="text-white">{a.actorName}</span>
        <span className="block text-[9px] text-slate-500">{TIER_META[a.actorTier].label}</span>
      </span>
    ), sortValue: (a) => a.actorName },
    { key: 'action', header: 'Action', render: (a) => <span className="font-mono text-[10px] text-cyan-300">{a.action}</span>, sortValue: (a) => a.action },
    { key: 'entity', header: 'Entity', render: (a) => <span className="text-[10px] text-slate-400">{a.entity}{a.entityId ? ` · ${a.entityId}` : ''}</span>, className: 'hidden sm:table-cell' },
    { key: 'detail', header: 'Detail', render: (a) => <span className="text-[10px] text-slate-500 line-clamp-1">{a.detail ?? '—'}</span>, className: 'hidden lg:table-cell' },
    {
      key: 'severity',
      header: 'Severity',
      render: (a) => <Badge tone={a.severity === 'critical' ? 'danger' : a.severity === 'warning' ? 'warning' : a.severity === 'success' ? 'success' : 'info'}>{a.severity}</Badge>,
      sortValue: (a) => a.severity,
    },
    { key: 'ip', header: 'IP', render: (a) => <span className="font-mono text-[10px] text-slate-500">{a.ip}</span>, className: 'hidden xl:table-cell' },
  ];

  const submitCreate = async () => {
    setFormError(null);
    if (form.name.trim().length < 3) return setFormError('Enter the full name of the account holder.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return setFormError('Enter a valid work email address.');
    if (users.some((u) => u.email.toLowerCase() === form.email.trim().toLowerCase())) return setFormError('That email address is already registered.');
    if (form.tier === 'super_admin') return setFormError('Super Admin is a seeded system account and cannot be created from the interface.');
    if (form.tier === 'admin' && currentUser?.tier !== 'super_admin') return setFormError('Only a Super Admin may create Admin accounts.');

    const res = await addUser({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      department: form.department,
      jobTitle: form.jobTitle.trim(),
      tier: form.tier,
      subRole: form.tier === 'user' ? form.subRole : 'analyst',
      password: form.password.trim() || DEMO_PASSWORD,
    });
    if (res.ok) {
      setCreateOpen(false);
      setForm(blank);
    } else {
      setFormError(res.message ?? 'Account creation was rejected.');
    }
  };

  const tierCounts = useMemo(
    () => TIER_ORDER.map((t) => ({ tier: t, total: users.filter((u) => u.tier === t).length, active: users.filter((u) => u.tier === t && u.status === 'Active').length })),
    [users]
  );

  return (
    <div className="w-full text-xs text-slate-200">
      <div className="px-3 sm:px-4 py-3 bg-gradient-to-r from-[#08172b] to-[#071120] border-b border-sky-900/50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Shield size={16} className="text-violet-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-white">Team &amp; access control</h2>
            <p className="text-[10px] text-slate-500 truncate">
              {users.length} accounts · {tierCounts.map((c) => `${c.active}/${c.total} ${TIER_META[c.tier].label.toLowerCase()}`).join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can('audit.export') && (
            <Button size="sm" variant="secondary" icon={<Download size={12} />} onClick={() => {
              downloadText(toCsv(audit.map((a) => ({ at: a.at, actor: a.actorName, tier: a.actorTier, action: a.action, entity: a.entity, entityId: a.entityId ?? '', severity: a.severity, ip: a.ip, detail: a.detail ?? '' }))), 'iprs_audit_export.csv', 'text/csv;charset=utf-8');
              pushToast({ title: 'Audit export ready', description: `${audit.length} entries written to CSV`, type: 'success' });
            }}>
              Export audit
            </Button>
          )}
          <Button size="sm" variant="secondary" icon={<ScrollText size={12} />} onClick={() => navigate('/audit')} disabled={!can('audit.view')}>
            Full audit log
          </Button>
          {can('users.create') && (
            <Button size="sm" variant="primary" icon={<Plus size={12} />} onClick={() => { setForm({ ...blank, tier: creatableTiers[0] ?? 'user' }); setFormError(null); setCreateOpen(true); }}>
              New account
            </Button>
          )}
        </div>
      </div>

      <div className="px-2 sm:px-4 pt-3">
        <Tabs tabs={TABS} active={tab} onChange={(t) => setTab(t as Tab)} badges={{ Users: users.length, Sessions: sessions.filter((s) => !s.current).length + 1 }} />
      </div>

      <div className="p-2 sm:p-4 space-y-4">
        {/* ============================== USERS ============================== */}
        {tab === 'Users' && (
          <>
            <Callout tone="info" title="Account creation rules">
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                <li><strong>Super Admin</strong> is seeded with the platform. It cannot be created, edited, suspended or removed from any interface.</li>
                <li><strong>Admin</strong> accounts can only be created by a Super Admin{currentUser?.tier === 'super_admin' ? ' — which is you.' : '.'}</li>
                <li><strong>User</strong> accounts can be created by Admins and the Super Admin, then given an Analyst, Officer, Viewer or Billing sub-role.</li>
              </ul>
            </Callout>

            <div className="grid gap-2 sm:grid-cols-3">
              {tierCounts.map((c) => (
                <div key={c.tier} className={`rounded-xl border p-3 ${TIER_META[c.tier].accent}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider">{TIER_META[c.tier].label} tier</span>
                    <span className="text-lg font-black text-white">{c.total}</span>
                  </div>
                  <p className="text-[10px] opacity-80 mt-1 leading-snug">{TIER_META[c.tier].blurb}</p>
                  <p className="text-[10px] mt-1 opacity-70">{c.active} active · dashboard: {ROLE_DEFINITIONS.find((r) => r.tier === c.tier)?.dashboard}</p>
                </div>
              ))}
            </div>

            <Panel
              title="Accounts"
              subtitle={`${filtered.length} of ${users.length} shown`}
              icon={<Users size={14} className="text-cyan-400" />}
              actions={
                <div className="flex flex-wrap items-center gap-1.5">
                  <SearchInput value={q} onChange={setQ} placeholder="Search name, email, department…" className="w-44 sm:w-56" />
                  <Select
                    value={tierFilter}
                    onChange={(e) => setTierFilter(e.target.value as 'all' | RoleTier)}
                    options={[{ value: 'all', label: 'All tiers' }, ...TIER_ORDER.map((t) => ({ value: t, label: TIER_META[t].label }))]}
                    className="w-32"
                  />
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | SystemUser['status'])}
                    options={[
                      { value: 'all', label: 'Any status' },
                      { value: 'Active', label: 'Active' },
                      { value: 'Inactive', label: 'Inactive' },
                      { value: 'Suspended', label: 'Suspended' },
                    ]}
                    className="w-32"
                  />
                </div>
              }
            >
              <ResponsiveTable
                columns={userCols}
                rows={filtered}
                rowKey={(u) => u.id}
                emptyTitle="No accounts match"
                emptyDescription="Adjust the filters or create a new account."
                initialSort={{ key: 'name', dir: 'asc' }}
              />
            </Panel>
          </>
        )}

        {/* ========================= ROLES & PERMISSIONS ========================= */}
        {tab === 'Roles & Permissions' && (
          <>
            <div className="grid gap-3 lg:grid-cols-3">
              {ROLE_DEFINITIONS.map((r) => {
                const canCreate = canCreateTier(currentUser, r.tier);
                return (
                  <div key={r.tier} className={`rounded-xl border p-3 ${TIER_META[r.tier].accent}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white">{r.label}</div>
                        <div className="text-[10px] opacity-80">{r.dashboard}</div>
                      </div>
                      {r.systemOnly ? <Badge tone="warning">System only</Badge> : <Badge tone={canCreate ? 'success' : 'neutral'}>{canCreate ? 'You can create' : 'Restricted'}</Badge>}
                    </div>
                    <p className="text-[10px] opacity-85 mt-2 leading-relaxed">{r.description}</p>
                    <div className="mt-2 text-[10px] space-y-0.5">
                      <div><span className="opacity-70">Permissions:</span> <strong>{r.permissions.length}</strong></div>
                      <div>
                        <span className="opacity-70">Creatable by:</span>{' '}
                        <strong>{r.systemOnly ? 'Seeded at install — never via UI' : (r.creatableBy ?? []).map((t) => TIER_META[t].label).join(', ') || '—'}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Panel
              title="Sub-roles within the User tier"
              subtitle="Analyst, Officer, Viewer and Billing are permission presets applied to User-tier accounts"
              icon={<KeyRound size={14} className="text-cyan-400" />}
            >
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {SUB_ROLE_DEFINITIONS.map((s) => (
                  <div key={s.id} className="rounded-lg border border-sky-900/50 bg-[#061020] p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-white">{s.label}</span>
                      <span className="text-[9px] font-mono text-cyan-400">{s.permissions.length} perms</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-snug">{s.description}</p>
                    <div className="mt-1.5 text-[9px] text-slate-600">
                      {users.filter((u) => u.tier === 'user' && u.subRole === s.id).length} account(s) assigned
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              title="Permission matrix"
              subtitle="Effective permissions per tier and User sub-role"
              icon={<ShieldCheck size={14} className="text-cyan-400" />}
              actions={
                !can('roles.edit') && (
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Lock size={10} /> Reference only — editing requires Super Admin
                  </span>
                )
              }
            >
              <div className="overflow-x-auto rounded-lg border border-sky-900/50">
                <table className="w-full text-[10px]">
                  <thead className="bg-[#08172b] sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-2 font-bold text-slate-400 uppercase tracking-wider text-[9px] min-w-[180px]">Permission</th>
                      {SUB_ROLE_DEFINITIONS.map((s) => (
                        <th key={s.id} className="px-2 py-2 font-bold text-sky-300 text-center whitespace-nowrap">{s.label}<span className="block text-[8px] font-normal text-slate-600">User</span></th>
                      ))}
                      <th className="px-2 py-2 font-bold text-violet-300 text-center whitespace-nowrap">Admin</th>
                      <th className="px-2 py-2 font-bold text-amber-300 text-center whitespace-nowrap">Super Admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSION_GROUPS.map((g) => (
                      <React.Fragment key={g.label}>
                        <tr className="bg-[#071322]">
                          <td colSpan={7} className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-cyan-400/80">{g.label}</td>
                        </tr>
                        {g.permissions.map((p: Permission) => (
                          <tr key={p} className="border-t border-sky-950/60 hover:bg-sky-950/30">
                            <td className="px-2 py-1.5 text-slate-300">
                              <span className="block">{PERMISSION_LABELS[p]}</span>
                              <span className="block font-mono text-[9px] text-slate-600">{p}</span>
                            </td>
                            {SUB_ROLE_DEFINITIONS.map((s) => (
                              <Cell key={s.id} on={s.permissions.includes(p)} />
                            ))}
                            <Cell on={(ROLE_DEFINITIONS.find((r) => r.tier === 'admin')?.permissions ?? []).includes(p)} />
                            <Cell on={(ROLE_DEFINITIONS.find((r) => r.tier === 'super_admin')?.permissions ?? []).includes(p)} />
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )}

        {/* ============================== SESSIONS ============================== */}
        {tab === 'Sessions' && (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { label: 'Active sessions', value: sessions.length, tone: 'info' as const },
                { label: 'Session timeout', value: `${settings.security.sessionTimeoutMin} min`, tone: 'neutral' as const },
                { label: 'Max concurrent', value: String(settings.security.maxConcurrentSessions), tone: 'neutral' as const },
              ].map((k) => (
                <div key={k.label} className="rounded-xl border border-sky-900/50 bg-[#061020] p-3">
                  <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{k.label}</div>
                  <div className="text-lg font-black text-white font-mono mt-0.5">{k.value}</div>
                </div>
              ))}
            </div>
            <Panel title="Active sessions" subtitle="Revoke any session except the one you are using" icon={<Fingerprint size={14} className="text-cyan-400" />}>
              <ResponsiveTable columns={sessionCols} rows={sessions} rowKey={(s) => s.id} dense emptyTitle="No active sessions" initialSort={{ key: 'seen', dir: 'desc' }} />
            </Panel>
          </>
        )}

        {/* =============================== AUDIT =============================== */}
        {tab === 'Audit' && (
          <Panel
            title="Recent audit entries"
            subtitle={`${audit.length} events · append-only`}
            icon={<ScrollText size={14} className="text-cyan-400" />}
            actions={<Button size="xs" variant="secondary" onClick={() => navigate('/audit')} disabled={!can('audit.view')}>Open full log</Button>}
          >
            {audit.length === 0 ? (
              <EmptyState title="No audit entries yet" />
            ) : (
              <ResponsiveTable columns={auditCols} rows={audit.slice(0, 60)} rowKey={(a) => a.id} dense initialSort={{ key: 'at', dir: 'desc' }} maxHeight="460px" />
            )}
          </Panel>
        )}

        {/* ============================ ORGANISATION ============================ */}
        {tab === 'Organisation' && <OrganisationPanel canEdit={can('settings.edit.operational')} settings={settings} updateSettings={updateSettings} />}
      </div>

      {/* ------------------------------ create modal ------------------------------ */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={<span className="flex items-center gap-2"><Plus size={15} className="text-cyan-400" /> Create account</span>}
        subtitle="Tier selection is limited by your own role"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={submitCreate} icon={<ShieldCheck size={13} />}>Create account</Button>
          </>
        }
      >
        <div className="space-y-3">
          {creatableTiers.length === 0 && (
            <Callout tone="warning" title="No tiers available">
              Your role cannot create any account tier.
            </Callout>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" required>
              <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Wanjiru" />
            </Field>
            <Field label="Work email" required>
              <TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@iprs.co.ke" />
            </Field>
            <Field label="Phone">
              <TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0712 000 000" className="font-mono" />
            </Field>
            <Field label="Job title">
              <TextInput value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="Compliance Officer" />
            </Field>
            <Field label="Department">
              <Select
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                options={['Operations', 'Compliance', 'Finance', 'IT & Security', 'Executive', 'Customer Success'].map((d) => ({ value: d, label: d }))}
              />
            </Field>
            <Field
              label="Role tier"
              hint={form.tier === 'admin' ? 'Admin accounts may only be created by a Super Admin' : undefined}
            >
              <Select
                value={form.tier}
                onChange={(e) => setForm({ ...form, tier: e.target.value as RoleTier })}
                options={TIER_ORDER.map((t) => ({
                  value: t,
                  label: `${TIER_META[t].label}${canCreateTier(currentUser, t) ? '' : ' — not permitted'}`,
                  disabled: !canCreateTier(currentUser, t),
                }))}
              />
            </Field>
            {form.tier === 'user' && (
              <Field label="Sub-role" hint={subRoleDefinition(form.subRole).description}>
                <Select
                  value={form.subRole}
                  onChange={(e) => setForm({ ...form, subRole: e.target.value as UserSubRole })}
                  options={SUB_ROLE_DEFINITIONS.map((s) => ({ value: s.id, label: s.label }))}
                />
              </Field>
            )}
            <Field label="Temporary password" hint={`Left blank → ${DEMO_PASSWORD}`}>
              <TextInput value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={DEMO_PASSWORD} className="font-mono" />
            </Field>
          </div>

          <Toggle checked={form.mfaEnabled} onChange={(v) => setForm({ ...form, mfaEnabled: v })} label="Require multi-factor authentication" description="Enforced at the next sign-in" />

          {form.tier !== 'user' && (
            <Callout tone="info" title={`${TIER_META[form.tier].label} dashboard`}>
              <p className="text-[11px]">
                This account lands on the <strong>{ROLE_DEFINITIONS.find((r) => r.tier === form.tier)?.dashboard}</strong> with{' '}
                {ROLE_DEFINITIONS.find((r) => r.tier === form.tier)?.permissions.length} permissions.
              </p>
            </Callout>
          )}

          {formError && <Callout tone="danger" title="Cannot create">{formError}</Callout>}
        </div>
      </Modal>

      {/* ------------------------------ edit drawer ------------------------------ */}
      <Drawer
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? editing.name : ''}
        subtitle={editing ? `${roleLabelFor(editing)} · ${editing.email}` : ''}
        width="520px"
        footer={
          editing && !editing.isSystem && can('users.edit') && canManageUser(currentUser, editing) ? (
            <>
              <Button variant="ghost" onClick={() => setEditing(null)}>Close</Button>
              <Button
                variant="primary"
                icon={<CheckCircle2 size={13} />}
                onClick={async () => {
                  await updateUser(editing.id, {
                    name: editing.name,
                    email: editing.email,
                    phone: editing.phone,
                    department: editing.department,
                    jobTitle: editing.jobTitle,
                    subRole: editing.subRole,
                    mfaEnabled: editing.mfaEnabled,
                    permissionOverrides: editing.permissionOverrides,
                    ipAllowlist: editing.ipAllowlist,
                  });
                  setEditing(null);
                }}
              >
                Save changes
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setEditing(null)}>Close</Button>
          )
        }
      >
        {editing && (
          <div className="space-y-4">
            {editing.isSystem && (
              <Callout tone="warning" title="Seeded system account">
                This Super Admin was created when the platform was installed. It cannot be edited, suspended, deleted or have its
                permissions reduced — by design.
              </Callout>
            )}

            {!canManageUser(currentUser, editing) && (
              <Callout tone="danger" title="Read only">
                Your role cannot modify this account. Manageable scope: {currentUser?.tier === 'super_admin' ? 'all except seeded Super Admin' : 'User-tier accounts you administer'}.
              </Callout>
            )}

            <div className="rounded-xl border border-sky-900/50 bg-[#061020] p-3">
              <div className="flex items-center gap-3">
                <span className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border ${TIER_META[editing.tier].badge}`}>
                  {editing.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{editing.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">{editing.email}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {tierBadge(editing.tier)}
                    <Badge tone={editing.status === 'Active' ? 'success' : editing.status === 'Suspended' ? 'danger' : 'neutral'}>{editing.status}</Badge>
                    {editing.mfaEnabled && <Badge tone="info">MFA</Badge>}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                <div><span className="text-slate-500 block">Department</span><span className="text-slate-200">{editing.department}</span></div>
                <div><span className="text-slate-500 block">Job title</span><span className="text-slate-200">{editing.jobTitle || '—'}</span></div>
                <div><span className="text-slate-500 block">Phone</span><span className="text-slate-200 font-mono">{editing.phone || '—'}</span></div>
                <div><span className="text-slate-500 block">Created</span><span className="text-slate-200">{formatDate(editing.createdAt)}</span></div>
                <div><span className="text-slate-500 block">Last sign-in</span><span className="text-slate-200">{editing.lastLoginAt ? formatDate(editing.lastLoginAt, true) : 'Never'}</span></div>
                <div><span className="text-slate-500 block">Failed attempts</span><span className="text-slate-200 font-mono">{editing.failedLoginAttempts}</span></div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name"><TextInput value={editing.name} disabled={editing.isSystem} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Email"><TextInput value={editing.email} disabled={editing.isSystem} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></Field>
              <Field label="Phone"><TextInput value={editing.phone} disabled={editing.isSystem} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} className="font-mono" /></Field>
              <Field label="Job title"><TextInput value={editing.jobTitle} disabled={editing.isSystem} onChange={(e) => setEditing({ ...editing, jobTitle: e.target.value })} /></Field>
              <Field label="Department">
                <Select
                  value={editing.department}
                  disabled={editing.isSystem}
                  onChange={(e) => setEditing({ ...editing, department: e.target.value })}
                  options={['Operations', 'Compliance', 'Finance', 'IT & Security', 'Executive', 'Customer Success'].map((d) => ({ value: d, label: d }))}
                />
              </Field>
              {editing.tier === 'user' && (
                <Field label="Sub-role" hint={subRoleDefinition(editing.subRole).description}>
                  <Select
                    value={editing.subRole}
                    disabled={editing.isSystem || !can('users.edit')}
                    onChange={(e) => setEditing({ ...editing, subRole: e.target.value as UserSubRole })}
                    options={SUB_ROLE_DEFINITIONS.map((s) => ({ value: s.id, label: s.label }))}
                  />
                </Field>
              )}
            </div>

            <Toggle
              checked={editing.mfaEnabled}
              disabled={editing.isSystem}
              onChange={(v) => setEditing({ ...editing, mfaEnabled: v })}
              label="Multi-factor authentication"
              description={settings.security.mfaRequiredFor.includes(editing.tier) ? `Required by policy for the ${TIER_META[editing.tier].label} tier` : 'Optional for this tier'}
            />

            {can('roles.edit') && (
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Per-account permission overrides
                </div>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-sky-900/50 bg-[#050b14] divide-y divide-sky-950/60 pr-1">
                  {(Object.keys(PERMISSION_LABELS) as Permission[]).map((p) => {
                    const base = effectivePermissions({ ...editing, permissionOverrides: undefined });
                    const override = editing.permissionOverrides?.[p];
                    const effective = override ?? base.has(p);
                    return (
                      <label key={p} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-sky-950/40 cursor-pointer">
                        <Checkbox
                          checked={effective}
                          onChange={(v) =>
                            setEditing({
                              ...editing,
                              permissionOverrides: { ...(editing.permissionOverrides ?? {}), [p]: v === base.has(p) ? undefined : v },
                            })
                          }
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[11px] text-slate-200 truncate">{PERMISSION_LABELS[p]}</span>
                          <span className="block font-mono text-[9px] text-slate-600">{p}</span>
                        </span>
                        {override !== undefined && <Badge tone={override ? 'success' : 'danger'}>{override ? 'granted' : 'revoked'}</Badge>}
                      </label>
                    );
                  })}
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  className="mt-1.5"
                  onClick={() => setEditing({ ...editing, permissionOverrides: undefined })}
                  icon={<RotateCcw size={11} />}
                >
                  Reset overrides to role defaults
                </Button>
              </div>
            )}

            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">Effective permissions ({effectivePermissions(editing).size})</div>
              <div className="flex flex-wrap gap-1">
                {[...effectivePermissions(editing)].map((p) => (
                  <span key={p} className="px-1.5 py-0.5 rounded bg-sky-950/70 border border-sky-900/60 text-[9px] font-mono text-cyan-300/80">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* --------------------------- delete confirmation --------------------------- */}
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) await removeUser(confirmDelete.id);
          setConfirmDelete(null);
        }}
        title="Revoke account access"
        tone="danger"
        confirmLabel="Revoke access"
        requireText={confirmDelete?.name.split(' ')[0]?.toUpperCase()}
        message={
          <span>
            This removes <strong>{confirmDelete?.name}</strong> ({confirmDelete?.email}) and ends every active session. Their
            wallet, cases and reports are retained for audit. Type <code className="font-mono text-rose-300">{confirmDelete?.name.split(' ')[0]?.toUpperCase()}</code> to confirm.
          </span>
        }
      />

      {/* -------------------------- issued password dialog -------------------------- */}
      <Modal
        open={Boolean(issuedPassword)}
        onClose={() => setIssuedPassword(null)}
        title={<span className="flex items-center gap-2"><KeyRound size={15} className="text-emerald-400" /> Temporary password issued</span>}
        size="sm"
        footer={<Button variant="primary" onClick={() => setIssuedPassword(null)}>Done</Button>}
      >
        {issuedPassword && (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-400">
              Share this with <strong className="text-white">{issuedPassword.user}</strong> over a secure channel. They must change
              it at first sign-in.
            </p>
            <div className="rounded-lg bg-[#050b14] border border-emerald-900/50 px-3 py-2 font-mono text-sm text-emerald-300 select-all break-all">
              {issuedPassword.password}
            </div>
            <p className="text-[10px] text-slate-600 flex items-center gap-1">
              <AlertTriangle size={11} /> This value is shown once and is masked everywhere else ({maskSecret(issuedPassword.password, 2)}).
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

const Cell: React.FC<{ on: boolean }> = ({ on }) => (
  <td className="px-2 py-1.5 text-center">
    {on ? <CheckCircle2 size={13} className="inline text-emerald-400" /> : <span className="inline-block w-3 h-px bg-slate-800 align-middle" />}
  </td>
);

const OrganisationPanel: React.FC<{
  canEdit: boolean;
  settings: ReturnType<typeof useAppData>['settings'];
  updateSettings: ReturnType<typeof useAppData>['updateSettings'];
}> = ({ canEdit, settings, updateSettings }) => {
  const [draft, setDraft] = useState(settings.org);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings.org);

  const fields: { key: keyof typeof draft; label: string; mono?: boolean }[] = [
    { key: 'legalName', label: 'Legal name' },
    { key: 'tradingName', label: 'Trading name' },
    { key: 'kraPin', label: 'KRA PIN', mono: true },
    { key: 'registrationNo', label: 'Registration no.', mono: true },
    { key: 'address', label: 'Registered address' },
    { key: 'city', label: 'City' },
    { key: 'country', label: 'Country' },
    { key: 'supportEmail', label: 'Support email', mono: true },
    { key: 'supportPhone', label: 'Support phone', mono: true },
    { key: 'website', label: 'Website', mono: true },
    { key: 'timezone', label: 'Timezone' },
    { key: 'locale', label: 'Locale' },
    { key: 'fiscalYearStart', label: 'Fiscal year start' },
    { key: 'businessHours', label: 'Business hours' },
  ];

  return (
    <Panel
      title="Organisation profile"
      subtitle="Appears on invoices, reports, PDF covers and the attestation block"
      icon={<Building2 size={14} className="text-cyan-400" />}
      actions={
        canEdit ? (
          <Button
            size="xs"
            variant="primary"
            disabled={!dirty}
            loading={saving}
            onClick={async () => {
              setSaving(true);
              await updateSettings('org', draft);
              setSaving(false);
            }}
          >
            Save organisation
          </Button>
        ) : (
          <span className="text-[10px] text-slate-500 flex items-center gap-1"><Lock size={10} /> Read only</span>
        )
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map((f) => (
          <Field key={f.key} label={f.label}>
            <TextInput
              value={String(draft[f.key] ?? '')}
              disabled={!canEdit}
              className={f.mono ? 'font-mono' : undefined}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
            />
          </Field>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-sky-900/50 bg-[#061020] p-3">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1"><Mail size={11} /> Data protection officer</div>
          <div className="text-[11px] text-white">{settings.compliance.dpoName}</div>
          <div className="text-[10px] text-slate-400 font-mono">{settings.compliance.dpoEmail}</div>
          <div className="text-[10px] text-slate-400 font-mono">{settings.compliance.dpoPhone}</div>
          <div className="mt-2 text-[10px] text-slate-500">Framework: <span className="text-slate-300">{settings.compliance.framework}</span></div>
        </div>
        <div className="rounded-lg border border-sky-900/50 bg-[#061020] p-3">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1"><Phone size={11} /> Branding</div>
          <div className="text-[11px] text-white">{settings.branding.loginHeadline}</div>
          <div className="text-[10px] text-slate-400">{settings.branding.loginSubtext}</div>
          <div className="mt-2 text-[10px] text-slate-500">Report footer: <span className="text-slate-300">{settings.branding.reportFooter}</span></div>
          <div className="text-[10px] text-slate-500">Email sender: <span className="text-slate-300">{settings.branding.emailSenderName}</span></div>
        </div>
      </div>
    </Panel>
  );
};

export default Screen9_AdminConsole;
