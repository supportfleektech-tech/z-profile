import React, { useMemo, useState } from 'react';
import { ScrollText, Download, FileText, Filter, ShieldAlert, Clock, Users, Terminal } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import {
  Badge, Button, Callout, EmptyState, Panel, ResponsiveTable, SearchInput, SegmentedControl,
  Select, StatCard, type Column,
} from '../ui';
import { buildAuditPdf } from '../../lib/reports';
import { downloadBlob, downloadText, formatDate, timeAgo, toCsv } from '../../lib/format';
import { TIER_META } from '../../auth/permissions';
import type { AuditEntry, RoleTier } from '../../types';

const severityTone = (s: AuditEntry['severity']): 'info' | 'success' | 'warning' | 'danger' =>
  s === 'critical' ? 'danger' : s === 'warning' ? 'warning' : s === 'success' ? 'success' : 'info';

/**
 * Audit Log & Sessions — append-only platform trail with filters, export and forensics.
 */
export const AuditLogScreen: React.FC = () => {
  const { audit, sessions, users, settings, can, pushToast } = useAppData();
  const [q, setQ] = useState('');
  const [severity, setSeverity] = useState<'all' | AuditEntry['severity']>('all');
  const [tier, setTier] = useState<'all' | RoleTier>('all');
  const [action, setAction] = useState('all');
  const [range, setRange] = useState<'1' | '7' | '30' | 'all'>('7');

  const actions = useMemo(() => [...new Set(audit.map((a) => a.action.split('.')[0]))].sort(), [audit]);
  const cutoff = range === 'all' ? 0 : Date.now() - Number(range) * 864e5;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return audit.filter((a) => {
      if (cutoff && new Date(a.at).getTime() < cutoff) return false;
      if (severity !== 'all' && a.severity !== severity) return false;
      if (tier !== 'all' && a.actorTier !== tier) return false;
      if (action !== 'all' && !a.action.startsWith(`${action}.`)) return false;
      if (!needle) return true;
      return [a.actorName, a.action, a.entity, a.entityId ?? '', a.detail ?? '', a.ip].join(' ').toLowerCase().includes(needle);
    });
  }, [audit, q, severity, tier, action, cutoff]);

  const critical = filtered.filter((a) => a.severity === 'critical');

  const cols: Column<AuditEntry>[] = [
    {
      key: 'at',
      header: 'Timestamp',
      mobilePrimary: true,
      render: (a) => (
        <div className="min-w-0">
          <div className="text-[11px] text-white font-mono">{formatDate(a.at, true)}</div>
          <div className="text-[10px] text-slate-500">{timeAgo(a.at)}</div>
        </div>
      ),
      sortValue: (a) => a.at,
    },
    {
      key: 'actor',
      header: 'Actor',
      render: (a) => (
        <div className="min-w-0">
          <div className="text-[11px] text-slate-200 truncate">{a.actorName}</div>
          <div className="flex items-center gap-1">
            <Badge tone={a.actorTier === 'super_admin' ? 'warning' : a.actorTier === 'admin' ? 'accent' : 'info'}>{TIER_META[a.actorTier].label}</Badge>
          </div>
        </div>
      ),
      renderMobile: (a) => `${a.actorName} · ${TIER_META[a.actorTier].label}`,
      sortValue: (a) => a.actorName,
    },
    { key: 'action', header: 'Action', render: (a) => <span className="font-mono text-[10px] text-cyan-300 break-all">{a.action}</span>, sortValue: (a) => a.action },
    {
      key: 'entity',
      header: 'Entity',
      render: (a) => (
        <span className="text-[10px] text-slate-400">
          {a.entity}
          {a.entityId && <span className="block font-mono text-slate-600 truncate">{a.entityId}</span>}
        </span>
      ),
      className: 'hidden sm:table-cell',
      sortValue: (a) => a.entity,
    },
    { key: 'detail', header: 'Detail', render: (a) => <span className="text-[10px] text-slate-500 line-clamp-2">{a.detail ?? '—'}</span>, className: 'hidden lg:table-cell' },
    { key: 'severity', header: 'Severity', render: (a) => <Badge tone={severityTone(a.severity)} dot>{a.severity}</Badge>, sortValue: (a) => a.severity },
    { key: 'ip', header: 'IP', render: (a) => <span className="font-mono text-[10px] text-slate-500">{a.ip}</span>, className: 'hidden xl:table-cell', sortValue: (a) => a.ip },
  ];

  const exportCsv = () => {
    downloadText(toCsv(filtered.map((a) => ({ ...a })) as unknown as Record<string, unknown>[]), 'iprs_audit_log.csv', 'text/csv;charset=utf-8');
    pushToast({ title: 'Audit log exported', description: `${filtered.length} entries`, type: 'success' });
  };

  const exportPdf = () => {
    downloadBlob(buildAuditPdf(filtered, settings).toBlob(), 'IPRS_Audit_Log.pdf');
    pushToast({ title: 'Audit PDF downloaded', description: `${filtered.length} entries`, type: 'success' });
  };

  return (
    <div className="w-full text-xs text-slate-200">
      <div className="px-3 sm:px-4 py-3 bg-gradient-to-r from-[#08172b] to-[#071120] border-b border-sky-900/50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ScrollText size={16} className="text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-white">Audit log &amp; sessions</h2>
            <p className="text-[10px] text-slate-500 truncate">
              Append-only · retained {settings.compliance.auditRetentionMonths} months · {audit.length} total events
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" icon={<Download size={12} />} onClick={exportCsv} disabled={!can('audit.export')}>CSV</Button>
          <Button size="sm" variant="primary" icon={<FileText size={12} />} onClick={exportPdf} disabled={!can('audit.export')}>PDF report</Button>
        </div>
      </div>

      <div className="p-2 sm:p-4 space-y-4">
        <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
          <StatCard label="Events in range" value={filtered.length.toLocaleString('en-KE')} sub={`${range === 'all' ? 'all time' : `last ${range} day(s)`}`} icon={<ScrollText size={14} className="text-cyan-400" />} />
          <StatCard label="Critical events" value={String(critical.length)} sub={critical.length ? critical[0].action : 'none recorded'} tone={critical.length ? 'danger' : 'success'} icon={<ShieldAlert size={14} className="text-rose-400" />} />
          <StatCard label="Distinct actors" value={String(new Set(filtered.map((a) => a.actorId)).size)} sub={`${users.length} provisioned accounts`} icon={<Users size={14} className="text-emerald-400" />} />
          <StatCard label="Active sessions" value={String(sessions.length)} sub={`${sessions.filter((s) => s.current).length} current device`} icon={<Terminal size={14} className="text-violet-400" />} />
        </div>

        {critical.length > 0 && (
          <Callout tone="danger" title={`${critical.length} critical event(s) in range`} icon={<ShieldAlert size={14} />}>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
              {critical.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <span className="font-mono text-rose-300">{c.action}</span> — {c.actorName} ({TIER_META[c.actorTier].label}) ·{' '}
                  {formatDate(c.at, true)}
                  {c.detail ? ` · ${c.detail}` : ''}
                </li>
              ))}
            </ul>
          </Callout>
        )}

        <Panel
          title="Audit trail"
          subtitle={`${filtered.length} of ${audit.length} events`}
          icon={<Filter size={14} className="text-cyan-400" />}
          actions={
            <div className="flex flex-wrap items-center gap-1.5">
              <SearchInput value={q} onChange={setQ} placeholder="Search actor, action, entity, IP…" className="w-44 sm:w-64" />
              <SegmentedControl size="sm" value={range} onChange={(v) => setRange(v as typeof range)} options={[{ value: '1', label: '24h' }, { value: '7', label: '7d' }, { value: '30', label: '30d' }, { value: 'all', label: 'All' }]} />
              <Select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)} options={[{ value: 'all', label: 'Any severity' }, { value: 'info', label: 'Info' }, { value: 'success', label: 'Success' }, { value: 'warning', label: 'Warning' }, { value: 'critical', label: 'Critical' }]} className="w-32" />
              <Select value={tier} onChange={(e) => setTier(e.target.value as typeof tier)} options={[{ value: 'all', label: 'Any tier' }, { value: 'user', label: 'User' }, { value: 'admin', label: 'Admin' }, { value: 'super_admin', label: 'Super Admin' }]} className="w-32" />
              <Select value={action} onChange={(e) => setAction(e.target.value)} options={[{ value: 'all', label: 'Any action' }, ...actions.map((a) => ({ value: a, label: `${a}.*` }))]} className="w-36" />
            </div>
          }
        >
          {filtered.length === 0 ? (
            <EmptyState title="No events match" description="Widen the date range or clear the filters." />
          ) : (
            <ResponsiveTable columns={cols} rows={filtered.slice(0, 500)} rowKey={(a) => a.id} dense initialSort={{ key: 'at', dir: 'desc' }} maxHeight="600px" />
          )}
        </Panel>

        <Panel title="Active sessions" subtitle="Every signed-in session across the platform" icon={<Clock size={14} className="text-violet-400" />}>
          <ResponsiveTable
            dense
            rowKey={(s) => s.id}
            rows={sessions}
            initialSort={{ key: 'seen', dir: 'desc' }}
            columns={[
              { key: 'user', header: 'Account', mobilePrimary: true, render: (s) => <div className="min-w-0"><div className="text-[11px] font-semibold text-white truncate">{s.userName} {s.current && <Badge tone="success">Current</Badge>}</div><div className="text-[10px] text-slate-500 truncate">{s.device} · {s.browser}</div></div>, sortValue: (s) => s.userName },
              { key: 'tier', header: 'Tier', render: (s) => <Badge tone={s.tier === 'super_admin' ? 'warning' : s.tier === 'admin' ? 'accent' : 'info'}>{TIER_META[s.tier].label}</Badge>, sortValue: (s) => s.tier },
              { key: 'ip', header: 'IP', render: (s) => <span className="font-mono text-[10px] text-cyan-300">{s.ip}</span>, sortValue: (s) => s.ip },
              { key: 'loc', header: 'Location', render: (s) => <span className="text-[10px]">{s.location}</span>, className: 'hidden sm:table-cell', sortValue: (s) => s.location },
              { key: 'started', header: 'Started', render: (s) => <span className="text-[10px] text-slate-400">{formatDate(s.startedAt, true)}</span>, className: 'hidden lg:table-cell', sortValue: (s) => s.startedAt },
              { key: 'seen', header: 'Last seen', render: (s) => <span className="text-[10px] text-slate-500">{timeAgo(s.lastSeenAt)}</span>, sortValue: (s) => s.lastSeenAt },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
};

export default AuditLogScreen;
