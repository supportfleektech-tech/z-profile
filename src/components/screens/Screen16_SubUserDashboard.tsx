import React from 'react';
import {
  Search, Wallet as WalletIcon, Briefcase, FileBarChart2, Bell, ArrowRight, Plus,
  CheckCircle2, Layers, User,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { useAppRouter } from '../../context/RouterContext';
import { Badge, Button, EmptyState, Panel, ProgressBar, StatCard } from '../ui';
import { KES, timeAgo } from '../../lib/format';
import { roleLabelFor } from '../../auth/permissions';

/**
 * Sub-user Dashboard — fresh layout for team members under a host account.
 *
 * Everything here is scoped to the signed-in sub-user's host context:
 * shared wallet (read-only), host-granted checks only, assigned cases only.
 * No Team Members section, no wallet top-up, no billing visibility.
 */
export const Screen16_SubUserDashboard: React.FC = () => {
  const { currentUser, wallet, quota, visibleCases, searchHistory, visibleNotifications, unreadCount, can, pricing, settings } = useAppData();
  const { navigate } = useAppRouter();
  if (!currentUser || !currentUser.isSubUser) return null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const hostName = 'Host'; // would be resolved from context
  const myCases = visibleCases.slice(0, 5);
  const recent = searchHistory.filter((s) => s.userId === currentUser.id).slice(0, 6);
  const alerts = visibleNotifications.filter((n) => !n.read).slice(0, 4);

  return (
    <div className="w-full text-xs text-slate-200 space-y-4">
      {/* greeting + acting-as banner */}
      <div className="rounded-xl border border-sky-900/50 bg-gradient-to-r from-[#08172b] to-[#071120] p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg font-black text-white truncate">
              {greeting}, {currentUser.name.split(' ')[0]}
            </h1>
            <Badge tone="info">Sub-user dashboard</Badge>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1 animate-pulse" />
              Acting as {hostName}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">
            {roleLabelFor(currentUser)} · {currentUser.department} · {settings.org.tradingName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('search.run') && (
            <Button variant="primary" size="sm" icon={<Search size={13} />} onClick={() => navigate('/search')}>Run check</Button>
          )}
          <Button variant="secondary" size="sm" icon={<WalletIcon size={13} />} onClick={() => navigate('/wallet')}>View wallet</Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-2 grid-cols-2 xl:grid-cols-4">
        <StatCard label="Shared wallet" value={KES(wallet.balance, { decimals: false })} sub={`Host: ${hostName}`} tone="success" icon={<WalletIcon size={14} className="text-emerald-400" />} />
        <StatCard label="Checks run" value={String(recent.length || searchHistory.length)} sub={`last: ${recent[0] ? timeAgo(recent[0].at) : 'none yet'}`} icon={<Search size={14} className="text-cyan-400" />} onClick={() => navigate('/search')} />
        <StatCard label="Open cases" value={String(myCases.filter((c) => c.status === 'Open' || c.status === 'In Progress').length)} sub={`${visibleCases.length} visible`} icon={<Briefcase size={14} className="text-violet-400" />} onClick={() => navigate('/cases')} />
        <StatCard label="Unread alerts" value={String(unreadCount)} sub={alerts[0]?.title ?? 'nothing pending'} tone={unreadCount ? 'warning' : 'default'} icon={<Bell size={14} className="text-amber-400" />} onClick={() => navigate('/notifications')} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* host-granted checks */}
        <Panel title="Your available checks" subtitle={`Granted by ${hostName} · ${pricing.batchLabel}`} icon={<Layers size={14} className="text-cyan-400" />}>
          {quota.length === 0 ? (
            <EmptyState title="No checks granted" description="Your host has not granted any verification checks yet." />
          ) : (
            <div className="space-y-2.5">
              {quota.map((q) => (
                <ProgressBar key={q.label} value={q.used} max={Math.max(1, q.total)} label={q.label} right={`${q.used}/${q.total}`} warning={0.75} danger={0.9} />
              ))}
            </div>
          )}
          <Button size="xs" variant="ghost" className="mt-2" onClick={() => navigate('/pricing')} icon={<ArrowRight size={11} />}>Price schedule</Button>
        </Panel>

        {/* recent searches */}
        <Panel title="Your recent verifications" icon={<Search size={14} className="text-cyan-400" />} className="lg:col-span-2" actions={<Button size="xs" variant="ghost" onClick={() => navigate('/identity-profile')}>Open latest dossier</Button>}>
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
                  <ArrowRight size={12} className="text-slate-600 shrink-0" />
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
                { label: 'Run check', path: '/search', icon: <Search size={12} />, show: can('search.run') },
                { label: 'Shared wallet', path: '/wallet', icon: <WalletIcon size={12} />, show: can('wallet.view.own') },
                { label: 'Price schedule', path: '/pricing', icon: <Layers size={12} />, show: can('pricing.view') },
                { label: 'Latest report', path: '/report', icon: <FileBarChart2 size={12} />, show: can('report.view') },
                { label: 'My cases', path: '/cases', icon: <Briefcase size={12} />, show: can('case.view.own') },
                { label: 'My profile', path: '/profile', icon: <User size={12} />, show: true },
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
        Sub-user of {hostName} · Shared wallet & host-granted checks · Data retained per {settings.compliance.framework} · consent model {settings.compliance.consentCapture}
      </p>
    </div>
  );
};

export default Screen16_SubUserDashboard;