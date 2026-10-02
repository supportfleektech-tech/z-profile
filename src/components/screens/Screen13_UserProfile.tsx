import React, { useEffect, useMemo, useState } from 'react';
import {
  UserCog, ShieldCheck, Bell, Palette, KeyRound, Save, Lock, Fingerprint, MonitorSmartphone,
  LogOut, Eye, EyeOff, RefreshCw, CheckCircle2, AlertTriangle, Copy, Smartphone, Globe, Trash2, Plus,
  Users, UserPlus, UserX, UserCheck,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { useAppRouter } from '../../context/RouterContext';
import {
  Badge, Button, Callout, Checkbox, Field, Panel, ProgressBar, ResponsiveTable, SegmentedControl,
  Select, Tabs, TextInput, Toggle, type Column,
} from '../ui';
import { authService } from '../../services/auth.service';
import { billingService } from '../../services/billing.service';
import { scorePassword, formatDate, timeAgo, KES } from '../../lib/format';
import { TIER_META, effectivePermissions, roleLabelFor, PERMISSION_LABELS, PERMISSION_GROUPS } from '../../auth/permissions';
import type { ApiKeyRecord, NotificationChannel, NotificationEvent, SessionRecord, Permission, SystemUser } from '../../types';
import { SUB_USER_FREE_LIMIT, SUB_USER_PRICE_KES } from '../../types';

const TABS = ['Profile', 'Security', 'Notifications', 'Appearance', 'API Keys', 'Team Members'] as const;
type Tab = (typeof TABS)[number];

const EVENT_LABELS: Record<NotificationEvent, string> = {
  'case.assigned': 'Case assigned to me',
  'case.updated': 'Case status changed',
  'report.ready': 'Verification report ready',
  'payment.success': 'Payment succeeded',
  'payment.failed': 'Payment failed',
  'wallet.low': 'Wallet balance low',
  'quota.warning': 'Quota threshold reached',
  'provider.outage': 'Provider gateway outage',
  'security.alert': 'Security alert',
  'login.newDevice': 'Sign-in from a new device',
  'digest.weekly': 'Activity digest',
};

const CHANNELS: { id: NotificationChannel; label: string }[] = [
  { id: 'inApp', label: 'In-app' },
  { id: 'email', label: 'Email' },
  { id: 'sms', label: 'SMS' },
  { id: 'webhook', label: 'Webhook' },
];

const ACCENTS: { id: 'cyan' | 'emerald' | 'violet' | 'amber' | 'rose'; label: string; hex: string }[] = [
  { id: 'cyan', label: 'Cyan', hex: '#22d3ee' },
  { id: 'emerald', label: 'Emerald', hex: '#34d399' },
  { id: 'violet', label: 'Violet', hex: '#a78bfa' },
  { id: 'amber', label: 'Amber', hex: '#fbbf24' },
  { id: 'rose', label: 'Rose', hex: '#fb7185' },
];

/**
 * Profile, Security & Preferences.
 *
 * The Security and Notifications tabs are now genuinely distinct surfaces: Security drives
 * the password policy, MFA, sessions, API keys and IP allowlist; Notifications drives a
 * per-event × per-channel delivery matrix, quiet hours and the digest.
 */
export const Screen13_UserProfile: React.FC = () => {
  const {
    currentUser, pushToast, logout, settings, notificationPrefs, setNotificationPrefs, appearance,
    setAppearance, sessions, revokeSession, apiKeys, createApiKey, revokeApiKey, wallet, quota,
    users,
  } = useAppData();
  const { navigate } = useAppRouter();
  const [tab, setTab] = useState<Tab>('Profile');

  /* ------------------------------- profile ------------------------------- */
  const [form, setForm] = useState({
    name: currentUser?.name ?? '',
    phone: currentUser?.phone ?? '',
    department: currentUser?.department ?? 'Operations',
    jobTitle: currentUser?.jobTitle ?? '',
  });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [mfaEnrolling, setMfaEnrolling] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [ipDraft, setIpDraft] = useState((currentUser?.ipAllowlist ?? []).join(', '));
  const [prefs, setPrefs] = useState(notificationPrefs);
  const [newKeyLabel, setNewKeyLabel] = useState('');

  /* ------------------------------- team members ------------------------------- */
  const [teamTab, setTeamTab] = useState<'list' | 'add' | 'edit'>('list');
  const [editingSubUser, setEditingSubUser] = useState<SystemUser | null>(null);
  const [subUserForm, setSubUserForm] = useState({
    name: '',
    email: '',
    phone: '',
    department: '',
    jobTitle: '',
    features: [] as Permission[],
  });
  const [subUserFormErrors, setSubUserFormErrors] = useState<Record<string, string>>({});

  const subUsers = useMemo(() => users.filter((u) => u.parentUserId === currentUser?.id), [users, currentUser?.id]);
  const billingSummary = useMemo(() => billingService.getBillingSummary(currentUser?.id ?? ''), [currentUser?.id]);
  const canManageSubUsers = currentUser ? authService.permissionsFor(currentUser).has('users.manage.sub') : false;
  const canCreateSubUsers = currentUser ? authService.permissionsFor(currentUser).has('users.create.sub') : false;

  const validateSubUserForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!subUserForm.name.trim()) errors.name = 'Full name is required.';
    if (!subUserForm.email.trim()) errors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subUserForm.email)) errors.email = 'Enter a valid email address.';
    if (!subUserForm.features.length) errors.features = 'At least one feature must be granted.';
    setSubUserFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openAddSubUser = () => {
    setSubUserForm({ name: '', email: '', phone: '', department: currentUser?.department ?? '', jobTitle: 'Sub-user', features: [] });
    setSubUserFormErrors({});
    setEditingSubUser(null);
    setTeamTab('add');
  };

  const openEditSubUser = (sub: SystemUser) => {
    setSubUserForm({
      name: sub.name,
      email: sub.email,
      phone: sub.phone ?? '',
      department: sub.department ?? '',
      jobTitle: sub.jobTitle ?? '',
      features: sub.subUserFeatures ?? [],
    });
    setSubUserFormErrors({});
    setEditingSubUser(sub);
    setTeamTab('edit');
  };

  const cancelSubUserForm = () => {
    setTeamTab('list');
    setEditingSubUser(null);
    setSubUserForm({ name: '', email: '', phone: '', department: '', jobTitle: 'Sub-user', features: [] });
    setSubUserFormErrors({});
  };

  const saveSubUser = async () => {
    if (!currentUser || !validateSubUserForm()) return;

    if (teamTab === 'add') {
      const res = await authService.createSubUser(currentUser, {
        name: subUserForm.name,
        email: subUserForm.email,
        phone: subUserForm.phone,
        department: subUserForm.department,
        jobTitle: subUserForm.jobTitle,
        features: subUserForm.features,
      });
      if (res.ok) {
        pushToast({ title: 'Sub-user created', description: `${res.user?.name} invited. Temp password: ${res.tempPassword}`, type: 'success' });
        cancelSubUserForm();
      } else {
        pushToast({ title: 'Could not create sub-user', description: res.message, type: 'error' });
      }
    } else if (teamTab === 'edit' && editingSubUser) {
      const res = await authService.updateSubUserFeatures(currentUser, editingSubUser.id, subUserForm.features);
      if (res.ok) {
        pushToast({ title: 'Permissions updated', description: `${editingSubUser.name}'s features updated`, type: 'success' });
        cancelSubUserForm();
      } else {
        pushToast({ title: 'Update rejected', description: res.message, type: 'error' });
      }
    }
  };

  const suspendSubUser = async (sub: SystemUser) => {
    if (!currentUser) return;
    const res = await authService.update(currentUser, sub.id, { status: 'Suspended' });
    if (res.ok) pushToast({ title: 'Sub-user suspended', description: `${sub.name} can no longer access the workspace`, type: 'warning' });
    else pushToast({ title: 'Suspend rejected', description: res.message, type: 'error' });
  };

  const reactivateSubUser = async (sub: SystemUser) => {
    if (!currentUser) return;
    const billingSummary = billingService.getBillingSummary(currentUser.id);
    const willBeActive = subUsers.filter((s: SystemUser) => s.status === 'Active').length + 1;
    const willBeBillable = willBeActive > SUB_USER_FREE_LIMIT;
    if (willBeBillable && !billingSummary.canAffordNextCharge) {
      pushToast({ title: 'Cannot reactivate', description: `Reactivating would exceed wallet capacity for monthly billing. Top up first.`, type: 'error' });
      return;
    }
    const res = await authService.update(currentUser, sub.id, { status: 'Active' });
    if (res.ok) pushToast({ title: 'Sub-user reactivated', description: `${sub.name} can now access the workspace`, type: 'success' });
    else pushToast({ title: 'Reactivate rejected', description: res.message, type: 'error' });
  };

  const removeSubUser = async (sub: SystemUser) => {
    if (!currentUser) return;
    const res = await authService.remove(currentUser, sub.id);
    if (res.ok) pushToast({ title: 'Sub-user removed', description: `${sub.name} has been deleted`, type: 'warning' });
    else pushToast({ title: 'Removal rejected', description: res.message, type: 'error' });
  };

  const policy = settings.security.passwordPolicy;
  const strength = scorePassword(pw.next, policy);
  const mySessions = useMemo(() => sessions.filter((s) => s.userId === currentUser?.id), [sessions, currentUser?.id]);
  const myKeys = useMemo(() => apiKeys.filter((k) => k.ownerId === currentUser?.id), [apiKeys, currentUser?.id]);
  const tierMeta = TIER_META[currentUser?.tier ?? 'user'];
  const perms = useMemo(() => (currentUser ? effectivePermissions(currentUser) : new Set<never>()), [currentUser]);

  // Re-sync the form when a different account signs in.
  useEffect(() => {
    if (!currentUser) return;
    setForm({ name: currentUser.name, phone: currentUser.phone, department: currentUser.department, jobTitle: currentUser.jobTitle });
    setIpDraft((currentUser.ipAllowlist ?? []).join(', '));
  }, [currentUser?.id]);

  useEffect(() => {
    setPrefs(notificationPrefs);
  }, [notificationPrefs]);

  const profileDirty = Boolean(
    currentUser &&
      (form.name !== currentUser.name || form.phone !== currentUser.phone || form.department !== currentUser.department || form.jobTitle !== currentUser.jobTitle)
  );

  const saveProfile = async () => {
    if (!currentUser) return;
    const res = await authService.updateSelf(currentUser.id, form);
    if (res.ok) pushToast({ title: 'Profile saved', description: 'Your details have been updated', type: 'success' });
    else pushToast({ title: 'Could not save', description: res.message, type: 'error' });
  };

  const changePassword = async () => {
    if (!currentUser) return;
    setPwBusy(true);
    if (pw.next !== pw.confirm) {
      setPwBusy(false);
      pushToast({ title: 'Passwords do not match', type: 'error' });
      return;
    }
    const res = await authService.changeOwnPassword(currentUser.id, pw.current, pw.next);
    setPwBusy(false);
    if (res.ok) {
      setPw({ current: '', next: '', confirm: '' });
      pushToast({ title: 'Password changed', description: 'Use it at your next sign-in', type: 'success' });
    } else {
      pushToast({ title: 'Password rejected', description: res.message, type: 'error' });
    }
  };

  const enrolMfa = () => {
    const codes = Array.from({ length: 8 }, () => `${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase());
    setRecoveryCodes(codes);
    setMfaEnrolling(true);
  };

  const confirmMfa = async (enable: boolean) => {
    if (!currentUser) return;
    const res = await authService.updateSelf(currentUser.id, { mfaEnabled: enable });
    setMfaEnrolling(false);
    if (res.ok) pushToast({ title: enable ? 'Two-factor enabled' : 'Two-factor disabled', type: enable ? 'success' : 'warning' });
    else pushToast({ title: 'Could not change MFA', description: res.message, type: 'error' });
  };

  const savePrefs = () => {
    setNotificationPrefs(prefs);
  };

  const sessionCols: Column<SessionRecord>[] = [
    {
      key: 'device',
      header: 'Device',
      mobilePrimary: true,
      render: (s) => (
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-white truncate flex items-center gap-1.5">
            <MonitorSmartphone size={11} className="text-cyan-400 shrink-0" /> {s.device}
            {s.current && <Badge tone="success">Current</Badge>}
          </div>
          <div className="text-[10px] text-slate-500 truncate">{s.browser} · {s.location}</div>
        </div>
      ),
      sortValue: (s) => s.device,
    },
    { key: 'ip', header: 'IP', render: (s) => <span className="font-mono text-[10px] text-cyan-300">{s.ip}</span>, sortValue: (s) => s.ip },
    { key: 'started', header: 'Started', render: (s) => <span className="text-[10px] text-slate-400">{formatDate(s.startedAt, true)}</span>, className: 'hidden sm:table-cell', sortValue: (s) => s.startedAt },
    { key: 'seen', header: 'Last seen', render: (s) => <span className="text-[10px] text-slate-500">{timeAgo(s.lastSeenAt)}</span>, className: 'hidden lg:table-cell', sortValue: (s) => s.lastSeenAt },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (s) => (
        <Button size="xs" variant="danger" disabled={s.current} onClick={() => revokeSession(s.id)} icon={<Lock size={11} />}>
          <span className="hidden sm:inline">Revoke</span>
        </Button>
      ),
      renderMobile: (s) => (
        <Button size="xs" variant="danger" disabled={s.current} onClick={() => revokeSession(s.id)} icon={<Lock size={11} />}>
          Revoke this session
        </Button>
      ),
    },
  ];

  const keyCols: Column<ApiKeyRecord>[] = [
    { key: 'label', header: 'Label', mobilePrimary: true, render: (k) => <span className="text-[11px] font-semibold text-white">{k.label}</span>, sortValue: (k) => k.label },
    { key: 'secret', header: 'Key', render: (k) => <span className="font-mono text-[10px] text-cyan-300">{k.prefix}…{k.secretMasked}</span> },
    { key: 'env', header: 'Env', render: (k) => <Badge tone={k.environment === 'live' ? 'danger' : 'info'}>{k.environment}</Badge>, sortValue: (k) => k.environment },
    { key: 'scopes', header: 'Scopes', render: (k) => <div className="flex flex-wrap gap-1">{k.scopes.map((s) => <span key={s} className="px-1.5 py-0.5 rounded bg-sky-950/70 border border-sky-900/60 text-[9px] font-mono text-slate-300">{s}</span>)}</div>, className: 'hidden lg:table-cell' },
    { key: 'last', header: 'Last used', render: (k) => <span className="text-[10px] text-slate-500">{k.lastUsedAt ? timeAgo(k.lastUsedAt) : 'Never'}</span>, className: 'hidden sm:table-cell', sortValue: (k) => k.lastUsedAt ?? '' },
    { key: 'status', header: 'Status', render: (k) => <Badge tone={k.status === 'active' ? 'success' : 'neutral'} dot>{k.status}</Badge>, sortValue: (k) => k.status },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (k) => <Button size="xs" variant="danger" disabled={k.status !== 'active'} onClick={() => revokeApiKey(k.id)} icon={<Trash2 size={11} />}>Revoke</Button>,
      renderMobile: (k) => <Button size="xs" variant="danger" disabled={k.status !== 'active'} onClick={() => revokeApiKey(k.id)} icon={<Trash2 size={11} />}>Revoke key</Button>,
    },
  ];

  if (!currentUser) {
    return (
      <div className="p-6">
        <EmptyNotSignedIn onLogin={() => navigate('/login')} />
      </div>
    );
  }

  return (
    <div className="w-full text-xs text-slate-200">
      {/* ------------------------------ header ------------------------------ */}
      <div className={`px-3 sm:px-4 py-3 border-b border-sky-900/50 bg-gradient-to-r from-[#08172b] to-[#071120] flex flex-col sm:flex-row sm:items-center gap-3`}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className={`w-12 h-12 rounded-xl shrink-0 flex items-center justify-center text-base font-black border ${tierMeta.badge}`}>
            {currentUser.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
          </span>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-white truncate">{currentUser.name}</h2>
            <div className="text-[10px] text-slate-500 truncate font-mono">{currentUser.email}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge tone={currentUser.tier === 'super_admin' ? 'warning' : currentUser.tier === 'admin' ? 'accent' : 'info'}>{tierMeta.label}</Badge>
              <Badge tone={currentUser.mfaEnabled ? 'success' : 'warning'} dot>{currentUser.mfaEnabled ? '2FA on' : '2FA off'}</Badge>
              {currentUser.isSystem && <Badge tone="warning">Seeded system account</Badge>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/25 px-2.5 py-1.5">
            <div className="text-[9px] uppercase tracking-wider text-emerald-500/80 font-bold">Wallet</div>
            <div className="text-[11px] font-bold text-emerald-300 font-mono">{KES(wallet.balance, { decimals: false })}</div>
          </div>
          <Button size="sm" variant="secondary" icon={<LogOut size={12} />} onClick={() => { logout('Signed out from profile'); navigate('/login'); }}>
            Sign out
          </Button>
        </div>
      </div>

      <div className="px-2 sm:px-4 pt-3">
        <Tabs tabs={TABS} active={tab} onChange={(t) => setTab(t as Tab)} badges={{ 'API Keys': myKeys.filter((k) => k.status === 'active').length }} />
      </div>

      <div className="p-2 sm:p-4 space-y-4">
        {/* =============================== PROFILE =============================== */}
        {tab === 'Profile' && (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Personal details" icon={<UserCog size={14} className="text-cyan-400" />} className="lg:col-span-2"
                actions={profileDirty && <Button size="xs" variant="primary" icon={<Save size={11} />} onClick={saveProfile}>Save profile</Button>}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Full name"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                  <Field label="Email address" hint="Managed by an administrator"><TextInput value={currentUser.email} disabled /></Field>
                  <Field label="Phone"><TextInput value={form.phone} className="font-mono" onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                  <Field label="Job title"><TextInput value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} /></Field>
                  <Field label="Department">
                    <Select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} options={['Operations', 'Compliance', 'Finance', 'IT & Security', 'Executive', 'Customer Success'].map((d) => ({ value: d, label: d }))} />
                  </Field>
                  <Field label="Role tier" hint="Only a Super Admin can change this"><TextInput value={tierMeta.label} disabled /></Field>
                </div>
                {!profileDirty && <p className="mt-3 text-[10px] text-slate-600">No unsaved changes.</p>}
              </Panel>

              <div className="space-y-4">
                <Panel title="Access summary" icon={<ShieldCheck size={14} className="text-cyan-400" />}>
                  <div className="space-y-2 text-[11px]">
                    <div className="flex justify-between gap-2"><span className="text-slate-500">Dashboard</span><span className="text-slate-200">{tierMeta.label} → {currentUser.tier === 'user' ? 'User Workspace' : currentUser.tier === 'admin' ? 'Admin Dashboard' : 'Super Admin Dashboard'}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-slate-500">Permissions</span><span className="text-cyan-300 font-mono">{perms.size}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-slate-500">Member since</span><span className="text-slate-200">{formatDate(currentUser.createdAt)}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-slate-500">Last sign-in</span><span className="text-slate-200">{currentUser.lastLoginAt ? formatDate(currentUser.lastLoginAt, true) : '—'}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-slate-500">Active sessions</span><span className="text-slate-200 font-mono">{mySessions.length}</span></div>
                  </div>
                </Panel>

                <Panel title="Quota usage" icon={<Fingerprint size={14} className="text-cyan-400" />}>
                  <div className="space-y-2.5">
                    {quota.map((q) => (
                      <div key={q.label}>
                        <ProgressBar value={q.used} max={Math.max(1, q.total)} label={q.label} right={`${q.used}/${q.total}`} warning={0.75} danger={0.9} />
                      </div>
                    ))}
                    {quota.length === 0 && <p className="text-[10px] text-slate-600">No quota configured for your role.</p>}
                  </div>
                </Panel>
              </div>
            </div>

            <Panel title="Your permissions" subtitle={`${perms.size} effective permission(s) from ${roleLabelFor(currentUser)}`} icon={<KeyRound size={14} className="text-cyan-400" />}>
              <div className="flex flex-wrap gap-1">
                {[...perms].map((p) => (
                  <span key={p} className="px-1.5 py-0.5 rounded bg-sky-950/70 border border-sky-900/60 text-[9px] font-mono text-cyan-300/80">{p}</span>
                ))}
              </div>
            </Panel>
          </>
        )}

        {/* =============================== SECURITY =============================== */}
        {tab === 'Security' && (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Change password" subtitle={`Policy: min ${policy.minLength} chars · ${[policy.requireUppercase && 'upper', policy.requireLowercase && 'lower', policy.requireNumber && 'number', policy.requireSymbol && 'symbol'].filter(Boolean).join(' + ')}`} icon={<Lock size={14} className="text-cyan-400" />}>
                <div className="space-y-3">
                  <Field label="Current password">
                    <div className="relative">
                      <TextInput type={showPw ? 'text' : 'password'} value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} className="pr-9" autoComplete="current-password" />
                      <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-300" aria-label="Toggle password visibility">
                        {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </Field>
                  <Field label="New password" error={pw.next && strength.score < 3 ? `Still needs: ${strength.checks.filter((c) => !c.pass).map((c) => c.label).join(', ')}` : null}>
                    <TextInput type={showPw ? 'text' : 'password'} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" />
                  </Field>
                  {pw.next && (
                    <div className="space-y-1">
                      <ProgressBar value={strength.score} max={4} label="Strength" right={strength.label} warning={2} />
                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                        {[
                          ['Length ≥ ' + policy.minLength, pw.next.length >= policy.minLength],
                          ['Uppercase', !policy.requireUppercase || /[A-Z]/.test(pw.next)],
                          ['Lowercase', !policy.requireLowercase || /[a-z]/.test(pw.next)],
                          ['Number', !policy.requireNumber || /\d/.test(pw.next)],
                          ['Symbol', !policy.requireSymbol || /[^A-Za-z0-9]/.test(pw.next)],
                          ['Not reused', pw.next !== pw.current],
                        ].map(([lbl, ok]) => (
                          <span key={String(lbl)} className={`flex items-center gap-1 ${ok ? 'text-emerald-400' : 'text-slate-600'}`}>
                            <CheckCircle2 size={10} /> {String(lbl)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <Field label="Confirm new password"><TextInput type={showPw ? 'text' : 'password'} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" /></Field>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="primary" icon={<Save size={12} />} loading={pwBusy} disabled={!pw.current || !pw.next} onClick={changePassword}>Update password</Button>
                    <Button size="sm" variant="ghost" icon={<RefreshCw size={12} />} onClick={() => setPw({ current: '', next: '', confirm: '' })}>Clear</Button>
                  </div>
                  <p className="text-[10px] text-slate-600">
                    Password expires every {policy.expiryDays} days · last {policy.historyDepth} passwords cannot be reused
                    {policy.breachCheck ? ' · breached-password screening is on' : ''}.
                  </p>
                </div>
              </Panel>

              <div className="space-y-4">
                <Panel title="Two-factor authentication" icon={<Fingerprint size={14} className="text-cyan-400" />}>
                  <Toggle
                    checked={currentUser.mfaEnabled}
                    onChange={(v) => (v ? enrolMfa() : confirmMfa(false))}
                    disabled={currentUser.isSystem}
                    label="Require a TOTP code at sign-in"
                    description={settings.security.mfaRequiredFor.includes(currentUser.tier) ? `Mandatory by policy for the ${tierMeta.label} tier` : 'Recommended for this tier'}
                  />
                  {currentUser.isSystem && (
                    <Callout tone="warning" title="Seeded account" className="mt-2">
                      MFA is permanently enforced on the system Super Admin account and cannot be switched off.
                    </Callout>
                  )}
                  {mfaEnrolling && (
                    <div className="mt-3 rounded-lg border border-cyan-800/60 bg-cyan-950/30 p-3 space-y-2">
                      <p className="text-[11px] text-cyan-200">
                        Scan this secret with your authenticator app (demo value), then save the recovery codes.
                      </p>
                      <div className="rounded bg-[#050b14] border border-cyan-900/50 px-2.5 py-2 font-mono text-[11px] text-cyan-300 break-all flex items-center justify-between gap-2">
                        JBSWY3DPEHPK3PXPIPRS{currentUser.id.slice(-4).toUpperCase()}
                        <button onClick={() => { navigator.clipboard?.writeText(`JBSWY3DPEHPK3PXP${currentUser.id.slice(-4).toUpperCase()}`); pushToast({ title: 'Secret copied', type: 'success' }); }} className="text-slate-500 hover:text-white shrink-0" aria-label="Copy secret"><Copy size={12} /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {recoveryCodes.map((c) => (
                          <span key={c} className="rounded bg-[#050b14] border border-sky-900/50 px-2 py-1 font-mono text-[10px] text-slate-300">{c}</span>
                        ))}
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="xs" variant="primary" onClick={() => confirmMfa(true)}>Enable 2FA</Button>
                        <Button size="xs" variant="ghost" onClick={() => setMfaEnrolling(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </Panel>

                <Panel title="IP allowlist" subtitle="Restrict sign-in for your account to these CIDR ranges" icon={<Globe size={14} className="text-cyan-400" />}>
                  <Field label="Allowed ranges (comma separated)" hint="Leave empty to allow any address">
                    <TextInput value={ipDraft} className="font-mono" onChange={(e) => setIpDraft(e.target.value)} placeholder="41.90.0.0/16, 197.232.12.4" />
                  </Field>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="xs" variant="primary" icon={<Save size={11} />} onClick={async () => {
                      const list = ipDraft.split(',').map((x) => x.trim()).filter(Boolean);
                      const res = await authService.updateSelf(currentUser.id, { ipAllowlist: list });
                      if (res.ok) pushToast({ title: 'IP allowlist saved', description: list.length ? `${list.length} range(s)` : 'Cleared', type: 'success' });
                      else pushToast({ title: 'Rejected', description: res.message, type: 'error' });
                    }}>Save allowlist</Button>
                    {ipDraft && <Button size="xs" variant="ghost" onClick={() => setIpDraft('')}>Clear</Button>}
                  </div>
                  <div className="mt-2 text-[10px] text-slate-600">
                    Platform-wide allowlist: {settings.security.ipAllowlist.length ? settings.security.ipAllowlist.join(', ') : 'not configured'} · denylist:{' '}
                    {settings.security.ipDenylist.length ? settings.security.ipDenylist.join(', ') : 'empty'}
                  </div>
                </Panel>
              </div>
            </div>

            <Panel title="Your sessions" subtitle={`${mySessions.length} active · platform limit ${settings.security.maxConcurrentSessions} · idle timeout ${settings.security.idleTimeoutMin} min`} icon={<MonitorSmartphone size={14} className="text-cyan-400" />}>
              <ResponsiveTable columns={sessionCols} rows={mySessions} rowKey={(s) => s.id} dense emptyTitle="No active sessions" />
            </Panel>
          </>
        )}

        {/* ============================= NOTIFICATIONS ============================= */}
        {tab === 'Notifications' && (
          <>
            <Callout tone="info" title="These preferences are live">
              The matrix below decides whether an event produces an in-app toast, an email, an SMS or a webhook call. Turning a
              channel off here stops that delivery path for your account.
            </Callout>

            <Panel
              title="Delivery matrix"
              subtitle="Event × channel"
              icon={<Bell size={14} className="text-cyan-400" />}
              actions={
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="xs" variant="ghost" onClick={() => setPrefs(notificationPrefs)} icon={<RefreshCw size={11} />}>Reset</Button>
                  <Button size="xs" variant="primary" icon={<Save size={11} />} onClick={savePrefs}>Save preferences</Button>
                </div>
              }
            >
              <div className="overflow-x-auto rounded-lg border border-sky-900/50">
                <table className="w-full text-[11px]">
                  <thead className="bg-[#08172b]">
                    <tr>
                      <th className="text-left px-2.5 py-2 text-[9px] uppercase tracking-wider text-slate-400 font-bold min-w-[180px]">Event</th>
                      {CHANNELS.map((c) => (
                        <th key={c.id} className="px-2 py-2 text-[9px] uppercase tracking-wider text-slate-400 font-bold text-center whitespace-nowrap">{c.label}</th>
                      ))}
                      <th className="px-2 py-2 text-[9px] uppercase tracking-wider text-slate-400 font-bold text-center">All</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(EVENT_LABELS) as NotificationEvent[]).map((ev) => (
                      <tr key={ev} className="border-t border-sky-950/60 hover:bg-sky-950/30">
                        <td className="px-2.5 py-1.5">
                          <span className="block text-slate-200">{EVENT_LABELS[ev]}</span>
                          <span className="block font-mono text-[9px] text-slate-600">{ev}</span>
                        </td>
                        {CHANNELS.map((c) => (
                          <td key={c.id} className="px-2 py-1.5 text-center">
                            <Checkbox
                              checked={prefs.matrix[ev]?.[c.id] ?? false}
                              onChange={(v) => setPrefs({ ...prefs, matrix: { ...prefs.matrix, [ev]: { ...prefs.matrix[ev], [c.id]: v } } })}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-center">
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => {
                              const allOn = CHANNELS.every((c) => prefs.matrix[ev]?.[c.id]);
                              setPrefs({ ...prefs, matrix: { ...prefs.matrix, [ev]: Object.fromEntries(CHANNELS.map((c) => [c.id, !allOn])) as Record<NotificationChannel, boolean> } });
                            }}
                          >
                            {CHANNELS.every((c) => prefs.matrix[ev]?.[c.id]) ? 'Off' : 'On'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Quiet hours & digest" icon={<Bell size={14} className="text-cyan-400" />}>
                <div className="space-y-3">
                  <Toggle checked={prefs.quietHoursEnabled} onChange={(v) => setPrefs({ ...prefs, quietHoursEnabled: v })} label="Quiet hours" description="Non-critical alerts are held and delivered at the end of the window" />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="From"><TextInput type="time" value={prefs.quietHoursStart} disabled={!prefs.quietHoursEnabled} onChange={(e) => setPrefs({ ...prefs, quietHoursStart: e.target.value })} className="font-mono" /></Field>
                    <Field label="Until"><TextInput type="time" value={prefs.quietHoursEnd} disabled={!prefs.quietHoursEnabled} onChange={(e) => setPrefs({ ...prefs, quietHoursEnd: e.target.value })} className="font-mono" /></Field>
                  </div>
                  <Field label="Digest frequency">
                    <SegmentedControl
                      value={prefs.digestFrequency}
                      onChange={(v) => setPrefs({ ...prefs, digestFrequency: v as typeof prefs.digestFrequency })}
                      options={[{ value: 'off', label: 'Off' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]}
                      size="sm"
                    />
                  </Field>
                </div>
              </Panel>

              <Panel title="Channels" icon={<Smartphone size={14} className="text-cyan-400" />}>
                <div className="space-y-3">
                  <Field label="SMS number" hint={prefs.smsVerified ? 'Verified' : 'Unverified — send a code to verify'}>
                    <div className="flex gap-1.5">
                      <TextInput value={prefs.smsNumber} className="font-mono flex-1" onChange={(e) => setPrefs({ ...prefs, smsNumber: e.target.value, smsVerified: false })} />
                      <Button size="sm" variant="secondary" disabled={prefs.smsVerified} onClick={() => { setPrefs({ ...prefs, smsVerified: true }); pushToast({ title: 'SMS number verified', description: prefs.smsNumber, type: 'success' }); }}>Verify</Button>
                    </div>
                  </Field>
                  <Field label="Webhook URL" hint="POST delivery of enabled events, signed with your secret">
                    <TextInput value={prefs.webhookUrl} className="font-mono" placeholder="https://hooks.example.com/iprs" onChange={(e) => setPrefs({ ...prefs, webhookUrl: e.target.value })} />
                  </Field>
                  <Field label="Webhook signing secret">
                    <TextInput value={prefs.webhookSecret} className="font-mono" placeholder="whsec_…" onChange={(e) => setPrefs({ ...prefs, webhookSecret: e.target.value })} />
                  </Field>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="xs" variant="primary" icon={<Save size={11} />} onClick={savePrefs}>Save channels</Button>
                    <Button
                      size="xs"
                      variant="secondary"
                      disabled={!prefs.webhookUrl}
                      onClick={() => {
                        pushToast({ title: 'Test webhook dispatched', description: `POST ${prefs.webhookUrl} → 200 OK (48 ms)`, type: 'success' });
                      }}
                    >
                      Send test event
                    </Button>
                  </div>
                </div>
              </Panel>
            </div>
          </>
        )}

        {/* ============================== APPEARANCE ============================== */}
        {tab === 'Appearance' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Theme" subtitle="Applied instantly via CSS custom properties" icon={<Palette size={14} className="text-cyan-400" />}>
              <div className="space-y-4">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">Accent colour</div>
                  <div className="flex flex-wrap gap-2">
                    {ACCENTS.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setAppearance({ accent: a.id })}
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors ${appearance.accent === a.id ? 'border-cyan-600/70 bg-cyan-950/40' : 'border-sky-900/60 bg-[#061020] hover:border-sky-700'}`}
                      >
                        <span className="w-4 h-4 rounded-full" style={{ background: a.hex }} />
                        <span className="text-[11px] text-slate-200">{a.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">Density</div>
                  <SegmentedControl
                    value={appearance.density}
                    onChange={(v) => setAppearance({ density: v as typeof appearance.density })}
                    options={[{ value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' }]}
                  />
                </div>

                <Field label={`Interface scale — ${Math.round(appearance.fontScale * 100)}%`}>
                  <input type="range" min={0.9} max={1.2} step={0.05} value={appearance.fontScale} onChange={(e) => setAppearance({ fontScale: Number(e.target.value) })} className="w-full accent-cyan-500" aria-label="Interface scale" />
                </Field>

                <Toggle checked={appearance.reduceMotion} onChange={(v) => setAppearance({ reduceMotion: v })} label="Reduce motion" description="Disables transitions and animated indicators" />
                <Toggle checked={appearance.monoNumerals} onChange={(v) => setAppearance({ monoNumerals: v })} label="Tabular numerals" description="Aligns digits in tables and ledgers" />
                <Toggle checked={appearance.sidebarCollapsed} onChange={(v) => setAppearance({ sidebarCollapsed: v })} label="Collapse sidebar by default" />

                <Button size="sm" variant="ghost" icon={<RefreshCw size={12} />} onClick={() => setAppearance({ accent: 'cyan', density: 'comfortable', fontScale: 1, reduceMotion: false, monoNumerals: true, sidebarCollapsed: false })}>
                  Reset appearance
                </Button>
              </div>
            </Panel>

            <Panel title="Preview" icon={<Eye size={14} className="text-cyan-400" />}>
              <div className="rounded-xl border border-sky-900/50 bg-[#050b14] p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-white">Sample ledger row</span>
                  <Badge tone="success">Success</Badge>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--accent)' }} />
                  <span className="text-slate-400">Wallet top-up</span>
                  <span className="ml-auto font-mono" style={{ color: 'var(--accent)' }}>+{KES(5000, { decimals: false })}</span>
                </div>
                <ProgressBar value={62} max={100} label="Quota" right="62%" />
                <div className="grid grid-cols-3 gap-2 text-center">
                  {['Low', 'Medium', 'High'].map((t, i) => (
                    <div key={t} className={`rounded-lg border px-2 py-1.5 ${i === 0 ? 'border-emerald-800/50 bg-emerald-950/25' : i === 1 ? 'border-amber-800/50 bg-amber-950/25' : 'border-rose-800/50 bg-rose-950/25'}`}>
                      <div className="text-[9px] uppercase tracking-wider text-slate-500">{t}</div>
                      <div className="text-sm font-black text-white">{[18, 54, 81][i]}</div>
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="primary" className="w-full justify-center">Primary action</Button>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  Body copy at {Math.round(appearance.fontScale * 100)}% scale with {appearance.density} density.
                  {appearance.reduceMotion && ' Motion is reduced.'}
                </p>
              </div>
            </Panel>
          </div>
        )}

        {/* =============================== API KEYS =============================== */}
        {tab === 'API Keys' && (
          <Panel
            title="Your API keys"
            subtitle="Personal keys for calling the verification API on your own behalf"
            icon={<KeyRound size={14} className="text-cyan-400" />}
            actions={
              <div className="flex flex-wrap items-center gap-1.5">
                <TextInput value={newKeyLabel} onChange={(e) => setNewKeyLabel(e.target.value)} placeholder="Key label" className="w-36" />
                <Button
                  size="xs"
                  variant="primary"
                  icon={<Plus size={11} />}
                  disabled={!newKeyLabel.trim()}
                  onClick={() => {
                    const res = createApiKey({ label: newKeyLabel.trim(), scopes: ['verify:read'], environment: 'sandbox' });
                    if (res.ok && res.secret) {
                      pushToast({ title: 'Key issued', description: res.secret, type: 'success' });
                      setNewKeyLabel('');
                    } else if (res.message) {
                      pushToast({ title: 'Rejected', description: res.message, type: 'error' });
                    }
                  }}
                >
                  Issue sandbox key
                </Button>
              </div>
            }
          >
            {!currentUser.mfaEnabled && (
              <Callout tone="warning" title="Enable two-factor authentication" className="mb-3">
                Platform policy recommends MFA before issuing API credentials.
              </Callout>
            )}
            <ResponsiveTable columns={keyCols} rows={myKeys} rowKey={(k) => k.id} dense emptyTitle="You have no API keys" emptyDescription="Issue a sandbox key to start calling the verification API." />
          </Panel>
        )}

        {/* ============================ TEAM MEMBERS ============================ */}
        {tab === 'Team Members' && (
          <>
            {teamTab === 'list' ? (
              <>
                <Callout tone="info" title="Sub-user seats" className="mb-4">
                  <div className="grid gap-2 sm:grid-cols-4 text-center">
                    <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/25 p-3">
                      <div className="text-2xl font-bold text-emerald-400">{billingSummary.activeSubUsers}</div>
                      <div className="text-[10px] text-slate-500">Active sub-users</div>
                    </div>
                    <div className="rounded-lg border border-cyan-800/50 bg-cyan-950/25 p-3">
                      <div className="text-2xl font-bold text-cyan-400">{billingSummary.totalSubUsers}</div>
                      <div className="text-[10px] text-slate-500">Total seats</div>
                    </div>
                    <div className="rounded-lg border border-amber-800/50 bg-amber-950/25 p-3">
                      <div className="text-2xl font-bold text-amber-400">{billingSummary.billableCount}</div>
                      <div className="text-[10px] text-slate-500">Billable seats</div>
                    </div>
                    <div className="rounded-lg border border-sky-800/50 bg-sky-950/25 p-3">
                      <div className="text-2xl font-bold text-sky-400">{KES(billingSummary.monthlyChargeKes, { decimals: false })}</div>
                      <div className="text-[10px] text-slate-500">Monthly charge</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="text-slate-400">
                      Free allowance: <span className="font-semibold text-white">{SUB_USER_FREE_LIMIT}</span> seats · Then <span className="font-semibold text-white">{KES(SUB_USER_PRICE_KES)}</span>/seat/month
                    </div>
                    <div className="flex items-center gap-2">
                      <ProgressBar value={billingSummary.walletBalance} max={Math.max(1, billingSummary.monthlyChargeKes + 5000)} label="Wallet" right={KES(billingSummary.walletBalance, { decimals: false })} warning={0.5} danger={0.25} className="w-48" />
                      {billingSummary.canAffordNextCharge ? (
                        <Badge tone="success" dot>Can cover next charge</Badge>
                      ) : (
                        <Badge tone="danger" dot>Insufficient for next charge</Badge>
                      )}
                    </div>
                  </div>
                </Callout>

                <Panel title="Your sub-users" subtitle={`${subUsers.length} seat(s) • Click a row to edit permissions`} icon={<Users size={14} className="text-cyan-400" />} >
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {canCreateSubUsers && subUsers.length < 20 && (
                      <Button size="sm" variant="primary" icon={<UserPlus size={12} />} onClick={openAddSubUser}>
                        Add sub-user
                      </Button>
                    )}
                    {subUsers.length >= 20 && <Badge tone="warning">Maximum 20 sub-users reached</Badge>}
                    {!canCreateSubUsers && <Badge tone="neutral">You cannot create sub-users</Badge>}
                  </div>
                  {subUsers.length === 0 ? (
                    <div className="text-center py-8">
                      <Users size={32} className="text-slate-600 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">No sub-users yet. Add your first team member.</p>
                    </div>
                  ) : (
                    <ResponsiveTable<SystemUser>
                      columns={[
                        {
                          key: 'name',
                          header: 'Name',
                          mobilePrimary: true,
                          render: (u) => (
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-[11px] font-semibold text-white truncate">
                                <span className={`w-2 h-2 rounded-full ${u.status === 'Active' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                {u.name}
                                {u.isSubUser && <Badge tone="info" className="ml-1">Sub-user</Badge>}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate">{u.email}</div>
                            </div>
                          ),
                          sortValue: (u) => u.name,
                        },
                        {
                          key: 'role',
                          header: 'Role',
                          render: (u) => <Badge tone={u.status === 'Active' ? 'success' : 'warning'} dot>{u.status}</Badge>,
                          sortValue: (u) => u.status,
                        },
                        {
                          key: 'features',
                          header: 'Granted features',
                          render: (u) => (
                            <div className="flex flex-wrap gap-1">
                              {(u.subUserFeatures ?? []).slice(0, 5).map((p) => (
                                <span key={p} className="px-1.5 py-0.5 rounded bg-sky-950/70 border border-sky-900/60 text-[9px] font-mono text-cyan-300/80">{PERMISSION_LABELS[p] ?? p}</span>
                              ))}
                              {(u.subUserFeatures ?? []).length > 5 && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] text-slate-400">+{(u.subUserFeatures ?? []).length - 5} more</span>
                              )}
                            </div>
                          ),
                          className: 'hidden lg:table-cell',
                        },
                        {
                          key: 'wallet',
                          header: 'Wallet',
                          render: () => (
                            <div className="text-[11px] text-emerald-300 font-mono">{KES(billingSummary.walletBalance, { decimals: false })}</div>
                          ),
                          className: 'hidden md:table-cell',
                        },
                        {
                          key: 'actions',
                          header: '',
                          align: 'right',
                          render: (u) => (
                            <div className="flex items-center justify-end gap-1.5">
                              {canManageSubUsers && (
                                <Button size="xs" variant="ghost" icon={<UserCheck size={11} />} onClick={() => openEditSubUser(u)}>Edit</Button>
                              )}
                              {u.status === 'Active' && canManageSubUsers && (
                                <Button size="xs" variant="danger" icon={<UserX size={11} />} onClick={() => suspendSubUser(u)}>
                                  <span className="hidden sm:inline">Suspend</span>
                                </Button>
                              )}
                              {u.status === 'Suspended' && canManageSubUsers && (
                                <Button size="xs" variant="success" icon={<UserCheck size={11} />} onClick={() => reactivateSubUser(u)}>
                                  <span className="hidden sm:inline">Reactivate</span>
                                </Button>
                              )}
                              {canManageSubUsers && (
                                <Button size="xs" variant="danger" icon={<Trash2 size={11} />} onClick={() => removeSubUser(u)}>
                                  <span className="hidden sm:inline">Delete</span>
                                </Button>
                              )}
                            </div>
                          ),
                          renderMobile: (u) => (
                            <div className="flex flex-wrap gap-1.5">
                              {canManageSubUsers && (
                                <Button size="xs" variant="ghost" icon={<UserCheck size={11} />} onClick={() => openEditSubUser(u)}>Edit</Button>
                              )}
                              {u.status === 'Active' && canManageSubUsers && (
                                <Button size="xs" variant="danger" icon={<UserX size={11} />} onClick={() => suspendSubUser(u)}>Suspend</Button>
                              )}
                              {u.status === 'Suspended' && canManageSubUsers && (
                                <Button size="xs" variant="success" icon={<UserCheck size={11} />} onClick={() => reactivateSubUser(u)}>Reactivate</Button>
                              )}
                              {canManageSubUsers && (
                                <Button size="xs" variant="danger" icon={<Trash2 size={11} />} onClick={() => removeSubUser(u)}>Delete</Button>
                              )}
                            </div>
                          ),
                        },
                      ]}
                      rows={subUsers}
                      rowKey={(u) => u.id}
                      dense
                      emptyTitle="No sub-users"
                      emptyDescription="Add your first sub-user to start sharing your wallet and delegating work."
                    />
                  )}
                </Panel>
              </>
            ) : (
              <Panel title={teamTab === 'add' ? 'Add sub-user' : 'Edit sub-user permissions'} subtitle="Grant the features this sub-user may access. Searches are billed to your shared wallet." icon={<UserPlus size={14} className="text-cyan-400" />} >
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Full name" error={subUserFormErrors.name}>
                      <TextInput value={subUserForm.name} onChange={(e) => setSubUserForm({ ...subUserForm, name: e.target.value })} disabled={teamTab === 'edit'} />
                    </Field>
                    <Field label="Email" error={subUserFormErrors.email}>
                      <TextInput value={subUserForm.email} onChange={(e) => setSubUserForm({ ...subUserForm, email: e.target.value })} disabled={teamTab === 'edit'} />
                    </Field>
                    <Field label="Phone">
                      <TextInput value={subUserForm.phone} className="font-mono" onChange={(e) => setSubUserForm({ ...subUserForm, phone: e.target.value })} />
                    </Field>
                    <Field label="Job title">
                      <TextInput value={subUserForm.jobTitle} onChange={(e) => setSubUserForm({ ...subUserForm, jobTitle: e.target.value })} />
                    </Field>
                    <Field label="Department">
                      <TextInput value={subUserForm.department} onChange={(e) => setSubUserForm({ ...subUserForm, department: e.target.value })} />
                    </Field>
                  </div>

                  <Field label="Granted features" error={subUserFormErrors.features}>
                    <Callout tone="info" className="mb-2">
                      Select the permissions this sub-user may exercise. They share your wallet (read-only) and can only run the checks you enable here.
                    </Callout>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {PERMISSION_GROUPS.map((group) => (
                        <fieldset key={group.label} className="border border-sky-900/50 rounded-lg p-3 space-y-2">
                          <legend className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{group.label}</legend>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {group.permissions.map((perm) => (
                              <label key={perm} className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                  checked={subUserForm.features.includes(perm)}
                                  onChange={(checked) =>
                                    setSubUserForm({
                                      ...subUserForm,
                                      features: checked
                                        ? [...subUserForm.features, perm]
                                        : subUserForm.features.filter((p) => p !== perm),
                                    })
                                  }
                                />
                                <span className="text-[11px] text-slate-300">{PERMISSION_LABELS[perm] ?? perm}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      ))}
                    </div>
                  </Field>

                  <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-sky-900/30">
                    <Button size="sm" variant="ghost" onClick={cancelSubUserForm}>Cancel</Button>
                    <Button size="sm" variant="primary" icon={<Save size={11} />} onClick={saveSubUser}>
                      {teamTab === 'add' ? 'Create sub-user' : 'Save permissions'}
                    </Button>
                  </div>
                </div>
              </Panel>
            )}
          </>
        )}

        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-600 pb-2">
          <AlertTriangle size={11} /> Session expires after {settings.security.sessionTimeoutMin} minutes of inactivity · lockout after{' '}
          {settings.security.lockoutThreshold} failed attempts
        </div>
      </div>
    </div>
  );
};

const EmptyNotSignedIn: React.FC<{ onLogin: () => void }> = ({ onLogin }) => (
  <div className="text-center py-10">
    <p className="text-sm text-slate-300">You are not signed in.</p>
    <Button variant="primary" className="mt-3" onClick={onLogin}>Go to sign-in</Button>
  </div>
);

export default Screen13_UserProfile;
