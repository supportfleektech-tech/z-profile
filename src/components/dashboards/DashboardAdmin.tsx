import React, { useMemo } from 'react';
import {
  Shield, Users, Server, Landmark, TrendingUp, AlertTriangle, ArrowRight, Activity,
  Wallet as WalletIcon, ScrollText, Gauge,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { useAppRouter } from '../../context/RouterContext';
import { Badge, Button, EmptyState, Panel, ProgressBar, ResponsiveTable, StatCard, type Column } from '../ui';
import { KES, formatDate, timeAgo } from '../../lib/format';
import { TIER_META, effectivePermissions } from '../../auth/permissions';
import type { SystemUser, Wallet } from '../../types';

/**
 * Admin Dashboard — organisation-wide operations.
 *
 * Team, provider health, payments and quota across every user, plus the operational
 * settings an Admin owns. Security/compliance/platform policy is visibly out of scope.
 */
export const DashboardAdmin: React.FC = () => {
  const {
    currentUser, users, providers, providerUsage, payments, paymentStats, wallets, quota, usage,
    audit, settings, stats, can, sessions,
  } = useAppData();
  const { navigate } = useAppRouter();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const healthyProviders = providers.filter((p) => p.status === 'Active' && p.enabled);
  const degraded = providers.filter((p) => p.status === 'Degraded' || p.status === 'Offline' || !p.enabled);
  const activeUsers = users.filter((u) => u.status === 'Active');
  const lowBalances = wallets.filter((w) => w.balance <= w.lowBalanceAlertKes);
  const failedPayments = payments.filter((p) => p.status === 'failed' || p.status === 'timeout');
  const successRate = usage.length ? Math.round((usage.filter((u) => u.status === 'success').length / usage.length) * 100) : 100;
  const margin = stats.revenueValue - providerUsage.reduce((a, u) => a + u.costKes, 0);

  const recentAudit = useMemo(() => audit.slice(0, 8), [audit]);

  const walletCols: Column<Wallet>[] = [
    {
      key: 'user',
      header: 'Holder',
      mobilePrimary: true,
      render: (w) => {
        const u = users.find((x) => x.id === w.userId);
        return (
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-white truncate">{u?.name ?? w.userId}</div>
            <div className="text-[10px] text-slate-500 truncate">{u ? TIER_META[u.tier].label : '—'}</div>
          </div>
        );
      },
      sortValue: (w) => users.find((x) => x.id === w.userId)?.name ?? '',
    },
    { key: 'balance', header: 'Balance', align: 'right', render: (w) => <span className={`font-mono text-[11px] font-bold ${w.balance <= w.lowBalanceAlertKes ? 'text-rose-300' : 'text-emerald-300'}`}>{KES(w.balance, { decimals: false })}</span>, sortValue: (w) => w.balance },
    { key: 'held', header: 'Held', align: 'right', render: (w) => <span className="font-mono text-[10px] text-amber-300">{KES(w.held, { decimals: false })}</span>, className: 'hidden lg:table-cell', sortValue: (w) => w.held },
    { key: 'spend', header: 'Lifetime spend', align: 'right', render: (w) => <span className="font-mono text-[10px]">{KES(w.lifetimeSpend, { decimals: false })}</span>, className: 'hidden xl:table-cell', sortValue: (w) => w.lifetimeSpend },
    { key: 'auto', header: 'Auto top-up', align: 'center', render: (w) => <Badge tone={w.autoTopUp ? 'success' : 'neutral'} dot>{w.autoTopUp ? 'On' : 'Off'}</Badge>, className: 'hidden sm:table-cell', sortValue: (w) => (w.autoTopUp ? 1 : 0) },
    { key: 'updated', header: 'Updated', render: (w) => <span className="text-[10px] text-slate-500">{timeAgo(w.updatedAt)}</span>, className: 'hidden lg:table-cell', sortValue: (w) => w.updatedAt },
  ];

  const userCols: Column<SystemUser>[] = [
    {
      key: 'name',
      header: 'Account',
      mobilePrimary: true,
      render: (u) => (
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-white truncate">
            {u.name}
            {u.isSystem && <span className="ml-1.5 text-[8px] uppercase tracking-wider text-amber-400/90 font-bold">system</span>}
          </div>
          <div className="text-[10px] text-slate-500 truncate font-mono">{u.email}</div>
        </div>
      ),
      sortValue: (u) => u.name,
    },
    { key: 'tier', header: 'Role', render: (u) => <Badge tone={u.tier === 'super_admin' ? 'warning' : u.tier === 'admin' ? 'accent' : 'info'}>{TIER_META[u.tier].label}</Badge>, sortValue: (u) => u.tier },
    { key: 'perms', header: 'Perms', align: 'right', render: (u) => <span className="font-mono text-[11px] text-cyan-300">{effectivePermissions(u).size}</span>, className: 'hidden sm:table-cell', sortValue: (u) => effectivePermissions(u).size },
    { key: 'mfa', header: 'MFA', align: 'center', render: (u) => <Badge tone={u.mfaEnabled ? 'success' : 'warning'}>{u.mfaEnabled ? 'On' : 'Off'}</Badge>, className: 'hidden lg:table-cell', sortValue: (u) => (u.mfaEnabled ? 1 : 0) },
    { key: 'status', header: 'Status', render: (u) => <Badge tone={u.status === 'Active' ? 'success' : u.status === 'Suspended' ? 'danger' : 'neutral'} dot>{u.status}</Badge>, sortValue: (u) => u.status },
    { key: 'last', header: 'Last sign-in', render: (u) => <span className="text-[10px] text-slate-500">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</span>, className: 'hidden lg:table-cell', sortValue: (u) => u.lastLoginAt ?? '' },
  ];

  return (
    <div className="w-full text-xs text-slate-200 space-y-4">
      <div className="rounded-xl border border-violet-900/40 bg-gradient-to-r from-[#1a1030] via-[#08172b] to-[#071120] p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-violet-400 shrink-0" />
            <h1 className="text-base sm:text-lg font-black text-white truncate">{greeting}, {currentUser?.name.split(' ')[0]}</h1>
            <Badge tone="accent">Admin Dashboard</Badge>
          </div>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">
            {settings.org.legalName} · {activeUsers.length} active accounts · {healthyProviders.length}/{providers.length} gateways healthy ·{' '}
            {sessions.length} live sessions
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<Users size={13} />} onClick={() => navigate('/admin')}>Team &amp; access</Button>
          <Button variant="secondary" size="sm" icon={<Server size={13} />} onClick={() => navigate('/providers')}>Providers</Button>
          <Button variant="primary" size="sm" icon={<Landmark size={13} />} onClick={() => navigate('/payments')}>Payments monitor</Button>
        </div>
      </div>

      {/* attention strip */}
      {(degraded.length > 0 || failedPayments.length > 0 || lowBalances.length > 0) && (
        <div className="grid gap-2 sm:grid-cols-3">
          {degraded.length > 0 && (
            <button onClick={() => navigate('/providers')} className="text-left rounded-xl border border-amber-800/50 bg-amber-950/25 px-3 py-2.5 hover:bg-amber-950/40 transition-colors">
              <div className="flex items-center gap-1.5 text-amber-300"><AlertTriangle size={13} /><span className="text-[11px] font-bold">{degraded.length} gateway(s) need attention</span></div>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{degraded.map((p) => `${p.name} (${p.status})`).join(', ')}</p>
            </button>
          )}
          {failedPayments.length > 0 && (
            <button onClick={() => navigate('/payments')} className="text-left rounded-xl border border-rose-800/50 bg-rose-950/25 px-3 py-2.5 hover:bg-rose-950/40 transition-colors">
              <div className="flex items-center gap-1.5 text-rose-300"><Landmark size={13} /><span className="text-[11px] font-bold">{failedPayments.length} failed payment(s)</span></div>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{KES(failedPayments.reduce((a, p) => a + p.amount, 0), { decimals: false })} needs retry or refund</p>
            </button>
          )}
          {lowBalances.length > 0 && (
            <button onClick={() => navigate('/payments')} className="text-left rounded-xl border border-amber-800/50 bg-amber-950/25 px-3 py-2.5 hover:bg-amber-950/40 transition-colors">
              <div className="flex items-center gap-1.5 text-amber-300"><WalletIcon size={13} /><span className="text-[11px] font-bold">{lowBalances.length} wallet(s) low</span></div>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                {lowBalances.slice(0, 3).map((w) => users.find((u) => u.id === w.userId)?.name ?? w.userId).join(', ')}
                {lowBalances.length > 3 ? ' …' : ''}
              </p>
            </button>
          )}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid gap-2 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Verifications" value={stats.totalSearches.toLocaleString('en-KE')} sub={`${stats.successful} successful · ${stats.failed} failed`} icon={<Activity size={14} className="text-cyan-400" />} />
        <StatCard label="Success rate" value={`${successRate}%`} sub={`${usage.length} recorded calls`} tone={successRate >= 95 ? 'success' : 'warning'} icon={<Gauge size={14} className="text-emerald-400" />} />
        <StatCard label="Revenue collected" value={KES(paymentStats.gross, { decimals: false })} sub={`fees ${KES(paymentStats.fees, { decimals: false })}`} tone="success" icon={<TrendingUp size={14} className="text-emerald-400" />} onClick={() => navigate('/payments')} />
        <StatCard label="Gross margin" value={KES(margin, { decimals: false })} sub={`provider cost ${KES(providerUsage.reduce((a, u) => a + u.costKes, 0), { decimals: false })}`} tone="accent" icon={<TrendingUp size={14} className="text-violet-400" />} />
        <StatCard label="Wallet float" value={KES(paymentStats.walletFloat, { decimals: false })} sub={`${wallets.length} wallets`} icon={<WalletIcon size={14} className="text-emerald-400" />} onClick={() => navigate('/payments')} />
        <StatCard label="Accounts" value={`${activeUsers.length}/${users.length}`} sub={`${sessions.length} live sessions`} icon={<Users size={14} className="text-cyan-400" />} onClick={() => navigate('/admin')} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* provider health */}
        <Panel title="Provider health" subtitle="Live gateway status, latency and quota" icon={<Server size={14} className="text-cyan-400" />} className="lg:col-span-2" actions={<Button size="xs" variant="ghost" onClick={() => navigate('/providers')} icon={<ArrowRight size={11} />}>Manage</Button>}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {providers.map((p) => {
              const u = providerUsage.find((x) => x.providerId === p.id);
              return (
                <button key={p.id} onClick={() => navigate('/providers')} className="text-left rounded-lg border border-sky-900/50 bg-[#061020] hover:border-cyan-800/60 p-2.5 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${p.status === 'Active' && p.enabled ? 'bg-emerald-400 animate-pulse' : p.status === 'Degraded' ? 'bg-amber-400' : 'bg-rose-500'}`} />
                    <span className="text-[11px] font-semibold text-white truncate flex-1">{p.name}</span>
                    <Badge tone={p.environment === 'live' ? 'danger' : 'info'}>{p.environment}</Badge>
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-1 text-center">
                    <div className="rounded bg-[#050b14] border border-sky-950/70 py-1">
                      <div className="text-[8px] uppercase text-slate-600 font-bold">Latency</div>
                      <div className="text-[10px] font-mono text-slate-200">{p.latencyMs}ms</div>
                    </div>
                    <div className="rounded bg-[#050b14] border border-sky-950/70 py-1">
                      <div className="text-[8px] uppercase text-slate-600 font-bold">Uptime</div>
                      <div className="text-[10px] font-mono text-slate-200">{p.uptime}</div>
                    </div>
                    <div className="rounded bg-[#050b14] border border-sky-950/70 py-1">
                      <div className="text-[8px] uppercase text-slate-600 font-bold">Calls</div>
                      <div className="text-[10px] font-mono text-slate-200">{u?.calls ?? 0}</div>
                    </div>
                  </div>
                  {u && u.quotaTotal > 0 && (
                    <div className="mt-1.5">
                      <ProgressBar value={u.quotaUsed} max={u.quotaTotal} height={4} warning={0.75} danger={0.9} right={<span className="text-[9px] font-mono text-slate-600">{u.quotaUsed}/{u.quotaTotal}</span>} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Panel>

        {/* collection trend */}
        <Panel title="Collections" subtitle="Last 14 days" icon={<TrendingUp size={14} className="text-emerald-400" />} actions={<Button size="xs" variant="ghost" onClick={() => navigate('/payments')}>Monitor</Button>}>
          <div className="flex items-end gap-1 h-24">
            {paymentStats.last30d.map((d) => {
              const max = Math.max(1, ...paymentStats.last30d.map((x) => x.amount));
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${d.day}: ${KES(d.amount, { decimals: false })}`}>
                  <div className="w-full rounded-t bg-gradient-to-t from-emerald-700 to-emerald-400" style={{ height: `${Math.max(2, (d.amount / max) * 100)}%` }} />
                  <span className="text-[7px] text-slate-600 font-mono truncate w-full text-center">{d.day.split(' ')[0]}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 space-y-1.5">
            {paymentStats.byChannel.map((c) => (
              <ProgressBar key={c.channel} value={c.amount} max={Math.max(1, paymentStats.gross)} label={<span className="uppercase font-mono text-[10px]">{c.channel}</span>} right={`${c.count} · ${KES(c.amount, { decimals: false })}`} />
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Wallet balances" subtitle={`Float ${KES(paymentStats.walletFloat, { decimals: false })}`} icon={<WalletIcon size={14} className="text-emerald-400" />} actions={<Button size="xs" variant="ghost" onClick={() => navigate('/payments')}>All payments</Button>}>
          {wallets.length === 0 ? <EmptyState title="No wallets" /> : <ResponsiveTable columns={walletCols} rows={wallets} rowKey={(w) => w.id} dense initialSort={{ key: 'balance', dir: 'desc' }} maxHeight="300px" />}
        </Panel>

        <Panel title="Team" subtitle={`${users.length} accounts · ${activeUsers.length} active`} icon={<Users size={14} className="text-cyan-400" />} actions={<Button size="xs" variant="ghost" onClick={() => navigate('/admin')} icon={<ArrowRight size={11} />}>Admin console</Button>}>
          <ResponsiveTable columns={userCols} rows={users} rowKey={(u) => u.id} dense initialSort={{ key: 'tier', dir: 'asc' }} maxHeight="300px" />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Recent audit events" icon={<ScrollText size={14} className="text-violet-400" />} actions={can('audit.view') ? <Button size="xs" variant="ghost" onClick={() => navigate('/audit')}>Full log</Button> : undefined}>
          <div className="divide-y divide-sky-950/60">
            {recentAudit.length === 0 && <EmptyState title="No audit events yet" />}
            {recentAudit.map((a) => (
              <div key={a.id} className="py-1.5 flex items-start gap-2">
                <Badge tone={a.severity === 'critical' ? 'danger' : a.severity === 'warning' ? 'warning' : a.severity === 'success' ? 'success' : 'info'}>{a.severity}</Badge>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-slate-200 truncate">
                    <span className="font-mono text-cyan-300">{a.action}</span> — {a.actorName}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">{a.detail ?? a.entity}</div>
                </div>
                <span className="text-[9px] text-slate-600 shrink-0 font-mono">{timeAgo(a.at)}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Operational quota" subtitle={`Platform quota state · success rate ${successRate}%`} icon={<Gauge size={14} className="text-cyan-400" />}>
          {quota.length === 0 ? (
            <EmptyState title="No quota configured" />
          ) : (
            <div className="space-y-2.5">
              {quota.map((q) => (
                <ProgressBar key={q.label} value={q.used} max={Math.max(1, q.total)} label={q.label} right={`${q.used}/${q.total}`} warning={0.75} danger={0.9} />
              ))}
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
            <div className="rounded-lg border border-sky-900/50 bg-[#061020] px-2.5 py-2">
              <div className="text-slate-500">Environment</div>
              <div className="text-slate-200 font-mono">{settings.platform.environment}</div>
            </div>
            <div className="rounded-lg border border-sky-900/50 bg-[#061020] px-2.5 py-2">
              <div className="text-slate-500">Maintenance</div>
              <div className={settings.platform.maintenanceMode ? 'text-rose-300 font-mono' : 'text-emerald-300 font-mono'}>{settings.platform.maintenanceMode ? 'ON' : 'off'}</div>
            </div>
            <div className="rounded-lg border border-sky-900/50 bg-[#061020] px-2.5 py-2">
              <div className="text-slate-500">Global concurrency</div>
              <div className="text-slate-200 font-mono">{settings.platform.globalConcurrency}</div>
            </div>
            <div className="rounded-lg border border-sky-900/50 bg-[#061020] px-2.5 py-2">
              <div className="text-slate-500">Last snapshot</div>
              <div className="text-slate-200 font-mono">{formatDate(settings.backup.lastSnapshotAt)}</div>
            </div>
          </div>
        </Panel>
      </div>

      {!can('settings.edit.security') && (
        <p className="text-[10px] text-slate-600 text-center pb-1">
          Security, compliance and platform policy are reserved for the Super Admin tier. Your workspace covers{' '}
          {TIER_META.admin.label.toLowerCase()} operations only.
        </p>
      )}
    </div>
  );
};

export default DashboardAdmin;
