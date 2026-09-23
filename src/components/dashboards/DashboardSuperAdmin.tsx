import React, { useMemo } from 'react';
import {
  ShieldCheck, TrendingUp, AlertTriangle, ArrowRight, Power, Terminal, Database, ScrollText,
  Users, Server, KeyRound, Scale, Landmark, Activity, Lock,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { useAppRouter } from '../../context/RouterContext';
import { Badge, Button, Callout, Panel, ProgressBar, ResponsiveTable, StatCard, type Column } from '../ui';
import { settingsService } from '../../services/settings.service';
import { KES, timeAgo } from '../../lib/format';
import { PERMISSION_LABELS, ROLE_DEFINITIONS, SUB_ROLE_DEFINITIONS, TIER_META, TIER_ORDER, effectivePermissions } from '../../auth/permissions';
import { getSnapshot } from '../../services/db';
import type { SystemUser } from '../../types';

/**
 * Super Admin Dashboard — platform ownership.
 *
 * Revenue and margin, permission drift, the critical audit stream, configuration health
 * and the maintenance switch. This is the only dashboard that can see every other tier's
 * data and change security, compliance and platform policy.
 */
export const DashboardSuperAdmin: React.FC = () => {
  const {
    currentUser, users, payments, paymentStats, providerUsage, providers, audit, settings,
    settingsHealth, stats, apiMode, sessions, wallets, pricing, pushToast, can,
  } = useAppData();
  const { navigate } = useAppRouter();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const providerCost = providerUsage.reduce((a, u) => a + u.costKes, 0);
  const margin = paymentStats.gross - providerCost;
  const marginPct = paymentStats.gross > 0 ? Math.round((margin / paymentStats.gross) * 100) : 0;
  const critical = audit.filter((a) => a.severity === 'critical').slice(0, 8);
  const drift = users.filter((u) => u.permissionOverrides && Object.keys(u.permissionOverrides).length > 0);
  const unhealthy = settingsHealth.filter((h) => !h.ok);
  const storageBytes = useMemo(() => {
    try {
      return new Blob([JSON.stringify(getSnapshot())]).size;
    } catch {
      return 0;
    }
  }, [users.length, payments.length, audit.length]);

  const tierCols: Column<{ tier: (typeof TIER_ORDER)[number]; total: number; active: number; mfa: number; perms: number }>[] = [
    {
      key: 'tier',
      header: 'Tier',
      mobilePrimary: true,
      render: (r) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Badge tone={r.tier === 'super_admin' ? 'warning' : r.tier === 'admin' ? 'accent' : 'info'}>{TIER_META[r.tier].label}</Badge>
            {ROLE_DEFINITIONS.find((d) => d.tier === r.tier)?.systemOnly && <Badge tone="danger">System only</Badge>}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 truncate">{ROLE_DEFINITIONS.find((d) => d.tier === r.tier)?.dashboard}</div>
        </div>
      ),
    },
    { key: 'total', header: 'Accounts', align: 'right', render: (r) => <span className="font-mono text-[11px] font-bold text-white">{r.total}</span>, sortValue: (r) => r.total },
    { key: 'active', header: 'Active', align: 'right', render: (r) => <span className="font-mono text-[11px] text-emerald-300">{r.active}</span>, className: 'hidden sm:table-cell', sortValue: (r) => r.active },
    { key: 'mfa', header: 'MFA on', align: 'right', render: (r) => <span className="font-mono text-[11px] text-cyan-300">{r.mfa}</span>, className: 'hidden sm:table-cell', sortValue: (r) => r.mfa },
    { key: 'perms', header: 'Permissions', align: 'right', render: (r) => <span className="font-mono text-[11px] text-violet-300">{r.perms}</span>, sortValue: (r) => r.perms },
    { key: 'creatable', header: 'Creatable by', render: (r) => <span className="text-[10px] text-slate-400">{ROLE_DEFINITIONS.find((d) => d.tier === r.tier)?.systemOnly ? 'Seeded at install' : (ROLE_DEFINITIONS.find((d) => d.tier === r.tier)?.creatableBy ?? []).map((t) => TIER_META[t].label).join(', ') || '—'}</span>, className: 'hidden lg:table-cell' },
  ];

  const tierRows = TIER_ORDER.map((tier) => {
    const list = users.filter((u) => u.tier === tier);
    return {
      tier,
      total: list.length,
      active: list.filter((u) => u.status === 'Active').length,
      mfa: list.filter((u) => u.mfaEnabled).length,
      perms: ROLE_DEFINITIONS.find((d) => d.tier === tier)?.permissions.length ?? 0,
    };
  });

  const driftCols: Column<SystemUser>[] = [
    {
      key: 'name',
      header: 'Account',
      mobilePrimary: true,
      render: (u) => (
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-white truncate">{u.name}</div>
          <div className="text-[10px] text-slate-500 truncate">{TIER_META[u.tier].label}{u.tier === 'user' ? ` · ${SUB_ROLE_DEFINITIONS.find((s) => s.id === u.subRole)?.label}` : ''}</div>
        </div>
      ),
      sortValue: (u) => u.name,
    },
    {
      key: 'overrides',
      header: 'Overrides',
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {Object.entries(u.permissionOverrides ?? {}).map(([p, v]) => (
            <span key={p} className={`px-1.5 py-0.5 rounded border text-[9px] font-mono ${v ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-300' : 'border-rose-800/60 bg-rose-950/40 text-rose-300'}`}>
              {v ? '+' : '−'}{p}
            </span>
          ))}
        </div>
      ),
    },
    { key: 'effective', header: 'Effective perms', align: 'right', render: (u) => <span className="font-mono text-[11px] text-cyan-300">{effectivePermissions(u).size}</span>, sortValue: (u) => effectivePermissions(u).size },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: () => (
        <Button size="xs" variant="secondary" onClick={() => navigate('/admin')} icon={<ArrowRight size={11} />}>
          <span className="hidden sm:inline">Review</span>
        </Button>
      ),
    },
  ];

  return (
    <div className="w-full text-xs text-slate-200 space-y-4">
      <div className="rounded-xl border border-amber-800/40 bg-gradient-to-r from-[#241a08] via-[#08172b] to-[#071120] p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <ShieldCheck size={16} className="text-amber-400 shrink-0" />
            <h1 className="text-base sm:text-lg font-black text-white truncate">{greeting}, {currentUser?.name.split(' ')[0]}</h1>
            <Badge tone="warning">Super Admin Dashboard</Badge>
            {currentUser?.isSystem && <Badge tone="danger">Seeded system account</Badge>}
          </div>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">
            Full platform ownership · {users.length} accounts · {providers.length} gateways · {audit.length} audit events ·{' '}
            backend {apiMode === 'api' ? 'connected' : 'local adapter'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<KeyRound size={13} />} onClick={() => navigate('/admin')}>Team &amp; access</Button>
          <Button variant="secondary" size="sm" icon={<ScrollText size={13} />} onClick={() => navigate('/audit')}>Audit log</Button>
          <Button variant="primary" size="sm" icon={<Terminal size={13} />} onClick={() => navigate('/settings')}>System settings</Button>
        </div>
      </div>

      {/* maintenance / integrity banners */}
      {settings.platform.maintenanceMode && (
        <Callout tone="danger" title="Maintenance mode is ON" icon={<Power size={14} />}>
          {settings.platform.maintenanceMessage || 'Sign-in and searches are blocked for non-exempt tiers.'}{' '}
          <Button size="xs" variant="secondary" className="ml-1" onClick={async () => { const r = await settingsService.toggleMaintenance(currentUser, false); if (r.ok) pushToast({ title: 'Platform back online', type: 'success' }); }}>
            Bring platform online
          </Button>
        </Callout>
      )}
      {!pricing.confirmedFromProposal && (
        <Callout tone="warning" title="Pricing not yet confirmed from the proposal" icon={<Scale size={14} />}>
          Rates are placeholders against <strong>{pricing.proposalRef}</strong>.{' '}
          <Button size="xs" variant="secondary" className="ml-1" onClick={() => navigate('/pricing')}>Open pricing</Button>
        </Callout>
      )}
      {unhealthy.length > 0 && (
        <Callout tone="warning" title={`${unhealthy.length} configuration check(s) need attention`} icon={<AlertTriangle size={14} />}>
          <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
            {unhealthy.map((h) => (
              <li key={h.label}><strong>{h.label}</strong> — {h.detail}</li>
            ))}
          </ul>
          <Button size="xs" variant="secondary" className="mt-1.5" onClick={() => navigate('/settings')}>Open system settings</Button>
        </Callout>
      )}

      {/* KPI strip */}
      <div className="grid gap-2 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Gross revenue" value={KES(paymentStats.gross, { decimals: false })} sub={`${paymentStats.successful} successful payments`} tone="success" icon={<TrendingUp size={14} className="text-emerald-400" />} onClick={() => navigate('/payments')} />
        <StatCard label="Gross margin" value={KES(margin, { decimals: false })} sub={`${marginPct}% of revenue`} tone={marginPct >= 30 ? 'accent' : 'warning'} icon={<Landmark size={14} className="text-violet-400" />} />
        <StatCard label="Provider cost" value={KES(providerCost, { decimals: false })} sub={`${providerUsage.reduce((a, u) => a + u.calls, 0)} gateway calls`} icon={<Server size={14} className="text-cyan-400" />} onClick={() => navigate('/providers')} />
        <StatCard label="Failed payments" value={String(paymentStats.failed)} sub={`${paymentStats.refunded} refunded · ${paymentStats.pending} pending`} tone={paymentStats.failed ? 'danger' : 'default'} icon={<AlertTriangle size={14} className="text-rose-400" />} onClick={() => navigate('/payments')} />
        <StatCard label="Critical audit events" value={String(audit.filter((a) => a.severity === 'critical').length)} sub={critical[0] ? timeAgo(critical[0].at) : 'none'} tone={critical.length ? 'warning' : 'default'} icon={<ScrollText size={14} className="text-amber-400" />} onClick={() => navigate('/audit')} />
        <StatCard label="Wallet float" value={KES(paymentStats.walletFloat, { decimals: false })} sub={`${wallets.length} wallets · ${KES(paymentStats.totalBalance, { decimals: false })} total`} icon={<Activity size={14} className="text-emerald-400" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* tier governance */}
        <Panel title="Role governance" subtitle="Who exists, what they can do, and who may create them" icon={<Users size={14} className="text-cyan-400" />} className="lg:col-span-2" actions={<Button size="xs" variant="ghost" onClick={() => navigate('/admin')} icon={<ArrowRight size={11} />}>Admin console</Button>}>
          <ResponsiveTable columns={tierCols} rows={tierRows} rowKey={(r) => r.tier} dense />
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {ROLE_DEFINITIONS.map((r) => (
              <div key={r.tier} className={`rounded-lg border p-2.5 ${TIER_META[r.tier].accent}`}>
                <div className="text-[10px] font-bold uppercase tracking-wider">{r.label}</div>
                <div className="text-[10px] opacity-80 mt-0.5 leading-snug line-clamp-3">{r.description}</div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[9px]">
                  {r.systemOnly ? <Lock size={10} /> : <KeyRound size={10} />}
                  <span>{r.systemOnly ? 'Immutable — seeded' : `${r.permissions.length} permissions`}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* system diagnostics */}
        <Panel title="System diagnostics" icon={<Terminal size={14} className="text-violet-400" />}>
          <div className="space-y-1.5">
            {[
              ['Backend mode', apiMode === 'api' ? 'API (Node + SQLite)' : 'Local in-browser adapter', apiMode === 'api' ? 'success' : 'warning'],
              ['Environment', settings.platform.environment, settings.platform.environment === 'production' ? 'danger' : 'info'],
              ['Maintenance', settings.platform.maintenanceMode ? 'ON' : 'off', settings.platform.maintenanceMode ? 'danger' : 'success'],
              ['Log level', settings.platform.logLevel, 'neutral'],
              ['Workers', String(settings.platform.workers), 'neutral'],
              ['Global concurrency', String(settings.platform.globalConcurrency), 'neutral'],
              ['Cache TTL', `${settings.platform.cacheTtlSec}s`, 'neutral'],
              ['Live sessions', String(sessions.length), 'info'],
              ['Workspace payload', `${(storageBytes / 1024).toFixed(1)} KB`, 'neutral'],
              ['Last snapshot', settings.backup.lastSnapshotAt, 'neutral'],
              ['Encryption at rest', settings.backup.encryptionAtRest ? 'AES-256 on' : 'off', settings.backup.encryptionAtRest ? 'success' : 'danger'],
              ['Offsite replication', settings.backup.offsiteReplication ? 'enabled' : 'disabled', settings.backup.offsiteReplication ? 'success' : 'warning'],
            ].map(([k, v, tone]) => (
              <div key={k} className="flex items-center justify-between gap-2 border-b border-sky-950/60 pb-1 last:border-0">
                <span className="text-[10px] text-slate-500 flex items-center gap-1.5">
                  <Database size={10} className="text-slate-700" /> {k}
                </span>
                <Badge tone={tone as 'success' | 'warning' | 'danger' | 'info' | 'neutral'}>{v}</Badge>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {settings.platform.featureFlags.map((f) => (
              <button key={f.id} onClick={() => navigate('/settings')} className={`px-2 py-1 rounded-lg border text-[9px] font-medium transition-colors ${f.enabled ? 'border-emerald-800/60 bg-emerald-950/30 text-emerald-300' : 'border-sky-900/60 bg-[#061020] text-slate-600'}`} title={f.description}>
                {f.label}
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* permission drift */}
        <Panel title="Permission drift" subtitle={`${drift.length} account(s) carry per-user overrides of their role defaults`} icon={<KeyRound size={14} className="text-amber-400" />}>
          {drift.length === 0 ? (
            <div className="text-[11px] text-slate-500">
              No overrides. Every account resolves to its role's default permission set — the cleanest posture.
            </div>
          ) : (
            <ResponsiveTable columns={driftCols} rows={drift} rowKey={(u) => u.id} dense />
          )}
          <div className="mt-2 text-[10px] text-slate-600">
            {Object.keys(PERMISSION_LABELS).length} permissions defined across the platform.
          </div>
        </Panel>

        {/* critical audit stream */}
        <Panel title="Critical audit stream" icon={<ScrollText size={14} className="text-rose-400" />} actions={<Button size="xs" variant="ghost" onClick={() => navigate('/audit')}>Open log</Button>}>
          {critical.length === 0 ? (
            <div className="text-[11px] text-slate-500">No critical events recorded.</div>
          ) : (
            <div className="divide-y divide-sky-950/60">
              {critical.map((a) => (
                <div key={a.id} className="py-1.5 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-slate-200 truncate">
                      <span className="font-mono text-rose-300">{a.action}</span> — {a.actorName}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">{a.detail ?? a.entity}</div>
                  </div>
                  <span className="text-[9px] text-slate-600 shrink-0 font-mono">{timeAgo(a.at)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Configuration health" icon={<ShieldCheck size={14} className="text-emerald-400" />} className="lg:col-span-2" actions={<Button size="xs" variant="ghost" onClick={() => navigate('/settings')} icon={<ArrowRight size={11} />}>Settings</Button>}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {settingsHealth.map((h) => (
              <div key={h.label} className={`rounded-lg border px-2.5 py-2 ${h.ok ? 'border-emerald-900/50 bg-emerald-950/20' : h.severity === 'danger' ? 'border-rose-900/50 bg-rose-950/20' : 'border-amber-900/50 bg-amber-950/20'}`}>
                <div className="flex items-center gap-1.5">
                  {h.ok ? <ShieldCheck size={11} className="text-emerald-400 shrink-0" /> : <AlertTriangle size={11} className={h.severity === 'danger' ? 'text-rose-400 shrink-0' : 'text-amber-400 shrink-0'} />}
                  <span className="text-[10px] font-bold text-slate-200 truncate">{h.label}</span>
                </div>
                <p className="text-[9px] text-slate-500 leading-snug mt-0.5">{h.detail}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Provider economics" icon={<Server size={14} className="text-cyan-400" />} actions={<Button size="xs" variant="ghost" onClick={() => navigate('/providers')}>Manage</Button>}>
          <div className="space-y-2.5">
            {providerUsage.slice(0, 6).map((u) => (
              <div key={u.providerId}>
                <ProgressBar value={u.costKes} max={Math.max(1, providerCost)} label={u.name} right={KES(u.costKes, { decimals: false })} warning={0.5} danger={0.7} />
                <div className="text-[9px] text-slate-600 mt-0.5">
                  {u.calls} calls · {u.successRatePct.toFixed(1)}% success · {u.avgLatencyMs}ms avg
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total verifications', value: stats.totalSearches.toLocaleString('en-KE'), path: '/analytics' },
          { label: 'Accounts provisioned', value: String(users.length), path: '/admin' },
          { label: 'Gateway calls logged', value: providerUsage.reduce((a, u) => a + u.calls, 0).toLocaleString('en-KE'), path: '/providers' },
          { label: 'Payments processed', value: String(payments.length), path: '/payments' },
        ].map((k) => (
          <button key={k.label} onClick={() => navigate(k.path)} className="text-left rounded-xl border border-sky-900/50 bg-[#061020] hover:border-cyan-800/60 px-3 py-2.5 transition-colors">
            <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{k.label}</div>
            <div className="text-lg font-black text-white font-mono">{k.value}</div>
          </button>
        ))}
      </div>

      {!can('settings.edit.platform') && (
        <p className="text-[10px] text-slate-600 text-center pb-1">Platform policy editing is restricted.</p>
      )}
    </div>
  );
};

export default DashboardSuperAdmin;
