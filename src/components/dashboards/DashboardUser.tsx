import React from 'react';
import {
  Search, Wallet as WalletIcon, Briefcase, FileBarChart2, Bell, ArrowRight, Plus, Gauge,
  CheckCircle2, AlertTriangle, Clock, Layers,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { useAppRouter } from '../../context/RouterContext';
import { Badge, Button, EmptyState, Panel, ProgressBar, StatCard } from '../ui';
import { KES, formatDate, timeAgo } from '../../lib/format';
import { roleLabelFor } from '../../auth/permissions';

/**
 * User Workspace — the operational dashboard for the User tier (Analyst, Officer, Viewer,
 * Billing sub-roles). Everything here is scoped to the signed-in person: their wallet,
 * their quota, their cases, their reports.
 */
export const DashboardUser: React.FC = () => {
  const { currentUser, wallet, quota, visibleCases, searchHistory, visibleNotifications, unreadCount, can, pricing, settings } = useAppData();
  const { navigate } = useAppRouter();
  if (!currentUser) return null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const myCases = visibleCases.slice(0, 5);
  const recent = searchHistory.filter((s) => s.userId === currentUser.id).slice(0, 6);
  const alerts = visibleNotifications.filter((n) => !n.read).slice(0, 4);
  const lowBalance = wallet.balance <= wallet.lowBalanceAlertKes;

  return (
    <div className="w-full text-xs text-slate-200 space-y-4">
      {/* greeting */}
      <div className="rounded-xl border border-sky-900/50 bg-gradient-to-r from-[#08172b] to-[#071120] p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-base sm:text-lg font-black text-white truncate">
            {greeting}, {currentUser.name.split(' ')[0]}
          </h1>
          <p className="text-[11px] text-slate-400 truncate">
            {roleLabelFor(currentUser)} · {currentUser.department} · {settings.org.tradingName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('search.run') && (
            <Button variant="primary" size="sm" icon={<Search size={13} />} onClick={() => navigate('/search')}>New verification</Button>
          )}
          <Button variant="secondary" size="sm" icon={<WalletIcon size={13} />} onClick={() => navigate('/wallet')}>Top up wallet</Button>
        </div>
      </div>

      {lowBalance && (
        <div className="rounded-xl border border-amber-800/50 bg-amber-950/25 px-3 py-2.5 flex flex-wrap items-center gap-2">
          <AlertTriangle size={14} className="text-amber-400 shrink-0" />
          <span className="text-[11px] text-amber-200 flex-1 min-w-0">
            Your wallet is at {KES(wallet.balance, { decimals: false })} — below your {KES(wallet.lowBalanceAlertKes, { decimals: false })} alert threshold.
            {settings.billing.blockSearchOnNegativeBalance && ' Searches stop when the balance goes negative.'}
          </span>
          <Button size="xs" variant="secondary" onClick={() => navigate('/wallet')} icon={<ArrowRight size={11} />}>Top up</Button>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid gap-2 grid-cols-2 xl:grid-cols-4">
        <StatCard label="Wallet balance" value={KES(wallet.balance, { decimals: false })} sub={`${KES(wallet.lifetimeSpend, { decimals: false })} spent lifetime`} tone="success" icon={<WalletIcon size={14} className="text-emerald-400" />} onClick={() => navigate('/wallet')} />
        <StatCard label="Verifications run" value={String(recent.length || searchHistory.length)} sub={`last: ${recent[0] ? timeAgo(recent[0].at) : 'none yet'}`} icon={<Search size={14} className="text-cyan-400" />} onClick={() => navigate('/search')} />
        <StatCard label="Open cases" value={String(myCases.filter((c) => c.status === 'Open' || c.status === 'In Progress').length)} sub={`${visibleCases.length} visible to you`} icon={<Briefcase size={14} className="text-violet-400" />} onClick={() => navigate('/cases')} />
        <StatCard label="Unread alerts" value={String(unreadCount)} sub={alerts[0]?.title ?? 'nothing pending'} tone={unreadCount ? 'warning' : 'default'} icon={<Bell size={14} className="text-amber-400" />} onClick={() => navigate('/notifications')} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* quota */}
        <Panel title="Your quota" subtitle={`Priced from ${pricing.batchLabel}`} icon={<Gauge size={14} className="text-cyan-400" />}>
          {quota.length === 0 ? (
            <EmptyState title="No quota configured" />
          ) : (
            <div className="space-y-2.5">
              {quota.map((q) => (
                <ProgressBar key={q.label} value={q.used} max={Math.max(1, q.total)} label={q.label} right={`${q.used}/${q.total}`} warning={0.75} danger={0.9} />
              ))}
            </div>
          )}
          <Button size="xs" variant="ghost" className="mt-2" onClick={() => navigate('/billing')} icon={<ArrowRight size={11} />}>Billing &amp; invoices</Button>
        </Panel>

        {/* recent searches */}
        <Panel title="Recent verifications" icon={<Search size={14} className="text-cyan-400" />} className="lg:col-span-2" actions={<Button size="xs" variant="ghost" onClick={() => navigate('/identity-profile')}>Open latest dossier</Button>}>
          {recent.length === 0 ? (
            <EmptyState
              title="No verifications yet"
              description="Run your first search to build a dossier."
              action={can('search.run') ? <Button size="sm" variant="primary" icon={<Plus size={12} />} onClick={() => navigate('/search')}>New search</Button> : undefined}
            />
          ) : (
            <div className="divide-y divide-sky-950/60">
              {recent.map((r, i) => (
                <button key={`${r.query}-${i}`} onClick={() => navigate('/identity-profile')} className="w-full flex items-center gap-2.5 py-2 text-left hover:bg-sky-950/40 px-1.5 rounded-lg transition-colors">
                  <span className="w-7 h-7 rounded-lg bg-[#061020] border border-sky-900/50 flex items-center justify-center text-[9px] font-bold text-cyan-300 shrink-0">
                    {r.subject.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[11px] font-semibold text-white truncate">{r.subject}</span>
                    <span className="block text-[10px] text-slate-500 font-mono truncate">ID {r.query} · {timeAgo(r.at)}</span>
                  </span>
                  <span className="font-mono text-[10px] text-emerald-300 shrink-0">{KES(r.costKes, { decimals: false })}</span>
                  <ChevronRightSm />
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* cases */}
        <Panel title="My cases" icon={<Briefcase size={14} className="text-violet-400" />} actions={<Button size="xs" variant="ghost" onClick={() => navigate('/cases')}>All cases</Button>}>
          {myCases.length === 0 ? (
            <EmptyState title="No cases assigned" />
          ) : (
            <div className="space-y-1.5">
              {myCases.map((c) => (
                <button key={c.id} onClick={() => navigate('/cases')} className="w-full rounded-lg border border-sky-900/50 bg-[#061020] hover:border-cyan-800/60 px-2.5 py-2 text-left transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-white truncate flex-1">{c.subject}</span>
                    <Badge tone={c.priority === 'High' ? 'danger' : c.priority === 'Medium' ? 'warning' : 'neutral'}>{c.priority}</Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
                    <span className="font-mono">{c.caseId}</span>
                    <span className="truncate">{c.type}</span>
                    <Badge tone={c.status === 'Completed' ? 'success' : c.status === 'Closed' ? 'neutral' : 'info'}>{c.status}</Badge>
                    <span className="ml-auto shrink-0">{c.updated}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>

        {/* alerts + shortcuts */}
        <div className="space-y-4">
          <Panel title="Alerts" icon={<Bell size={14} className="text-amber-400" />} actions={<Button size="xs" variant="ghost" onClick={() => navigate('/notifications')}>{unreadCount} unread</Button>}>
            {alerts.length === 0 ? (
              <EmptyState title="You're all caught up" icon={<CheckCircle2 size={20} className="text-emerald-400" />} />
            ) : (
              <div className="space-y-1.5">
                {alerts.map((n) => (
                  <button key={n.id} onClick={() => navigate('/notifications')} className="w-full text-left rounded-lg border border-sky-900/50 bg-[#061020] hover:border-cyan-800/60 px-2.5 py-2 transition-colors">
                    <div className="flex items-center gap-1.5">
                      <Badge tone={n.type === 'danger' ? 'danger' : n.type === 'warning' ? 'warning' : n.type === 'success' ? 'success' : 'info'}>{n.category}</Badge>
                      <span className="text-[11px] font-semibold text-white truncate flex-1">{n.title}</span>
                      <span className="text-[9px] text-slate-600 shrink-0">{n.time}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{n.description}</p>
                  </button>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Quick actions" icon={<Layers size={14} className="text-cyan-400" />}>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: 'New verification', path: '/search', icon: <Search size={12} />, show: can('search.run') },
                { label: 'Open wallet', path: '/wallet', icon: <WalletIcon size={12} />, show: can('wallet.view.own') },
                { label: 'Price schedule', path: '/pricing', icon: <Layers size={12} />, show: can('pricing.view') },
                { label: 'Latest report', path: '/report', icon: <FileBarChart2 size={12} />, show: can('report.view') },
                { label: 'New case', path: '/cases', icon: <Plus size={12} />, show: can('case.create') },
                { label: 'My profile', path: '/profile', icon: <Clock size={12} />, show: true },
              ]
                .filter((a) => a.show)
                .map((a) => (
                  <button key={a.path + a.label} onClick={() => navigate(a.path)} className="flex items-center gap-1.5 rounded-lg border border-sky-900/50 bg-[#061020] hover:border-cyan-800/60 hover:bg-sky-950/40 px-2.5 py-2 text-[11px] text-slate-300 transition-colors">
                    <span className="text-cyan-400">{a.icon}</span>
                    <span className="truncate">{a.label}</span>
                  </button>
                ))}
            </div>
          </Panel>
        </div>
      </div>

      <p className="text-[10px] text-slate-600 text-center pb-1">
        Data retained per {settings.compliance.framework} · consent model {settings.compliance.consentCapture} · latest dossier{' '}
        {formatDate(new Date().toISOString())}
      </p>
    </div>
  );
};

const ChevronRightSm = () => <ArrowRight size={12} className="text-slate-600 shrink-0" />;

export default DashboardUser;
