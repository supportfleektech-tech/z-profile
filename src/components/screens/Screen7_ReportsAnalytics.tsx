import React, { useMemo, useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Download, FileText, PieChart, Activity } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { useAppRouter } from '../../context/RouterContext';
import { Badge, Button, EmptyState, Panel, ProgressBar, SegmentedControl, StatCard } from '../ui';
import { buildPaymentsPdf } from '../../lib/reports';
import { KES, downloadBlob, downloadText, formatDate, toCsv } from '../../lib/format';

type Range = '7' | '30' | '90' | 'all';

const RANGE_DAYS: Record<Range, number> = { '7': 7, '30': 30, '90': 90, all: 3650 };

const PALETTE = ['#0284c7', '#06b6d4', '#10b981', '#f97316', '#eab308', '#a855f7', '#f43f5e', '#14b8a6'];

/**
 * Reports & Analytics — every figure on this screen is computed from the live store
 * (usage records, payments, provider logs), not from static demo constants, so the
 * time-range filter genuinely re-slices the data.
 */
export const Screen7_ReportsAnalytics: React.FC = () => {
  const { stats, usage, payments, paymentStats, providerUsage, settings, can, pushToast } = useAppData();
  const { navigate } = useAppRouter();
  const [range, setRange] = useState<Range>('30');

  const cutoff = Date.now() - RANGE_DAYS[range] * 864e5;
  const inRange = (iso: string) => new Date(iso).getTime() >= cutoff;

  const scopedUsage = useMemo(() => usage.filter((u) => inRange(u.at)), [usage, range]);
  const scopedPayments = useMemo(() => payments.filter((p) => inRange(p.at)), [payments, range]);

  /* ------------------------------- KPI deltas ------------------------------- */
  const half = RANGE_DAYS[range] / 2;
  const prevCutoff = Date.now() - RANGE_DAYS[range] * 864e5;
  const midCutoff = Date.now() - half * 864e5;
  const prevCount = usage.filter((u) => { const t = new Date(u.at).getTime(); return t >= prevCutoff && t < midCutoff; }).length;
  const currCount = usage.filter((u) => new Date(u.at).getTime() >= midCutoff).length;
  const deltaPct = prevCount ? Math.round(((currCount - prevCount) / prevCount) * 100) : 0;

  const scopedRevenue = scopedPayments.filter((p) => p.status === 'success').reduce((a, p) => a + p.amount, 0);
  const prevRevenue = payments
    .filter((p) => { const t = new Date(p.at).getTime(); return t >= prevCutoff && t < midCutoff && p.status === 'success'; })
    .reduce((a, p) => a + p.amount, 0);
  const revenueDelta = prevRevenue ? Math.round(((scopedRevenue / 2 - prevRevenue) / prevRevenue) * 100) : 0;

  const successRate = scopedUsage.length
    ? Math.round((scopedUsage.filter((u) => u.status === 'success').length / scopedUsage.length) * 100)
    : 100;
  const failedCount = scopedUsage.filter((u) => u.status === 'failed').length;

  /* ----------------------------- reports by source ---------------------------- */
  const bySource = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of scopedUsage) map.set(u.providerName, (map.get(u.providerName) ?? 0) + 1);
    const total = [...map.values()].reduce((a, b) => a + b, 0) || 1;
    return [...map.entries()]
      .map(([label, n], i) => ({ label, count: n, pct: (n / total) * 100, color: PALETTE[i % PALETTE.length] }))
      .sort((a, b) => b.count - a.count);
  }, [scopedUsage]);

  /* ------------------------------- top services ------------------------------ */
  const topServices = useMemo(() => {
    const map = new Map<string, { count: number; cost: number; success: number }>();
    for (const u of scopedUsage) {
      const cur = map.get(u.checkType) ?? { count: 0, cost: 0, success: 0 };
      cur.count += 1;
      cur.cost += u.costKes;
      if (u.status === 'success') cur.success += 1;
      map.set(u.checkType, cur);
    }
    const total = [...map.values()].reduce((a, v) => a + v.count, 0) || 1;
    return [...map.entries()]
      .map(([name, v]) => ({ name, ...v, pct: (v.count / total) * 100 }))
      .sort((a, b) => b.count - a.count);
  }, [scopedUsage]);

  /* ------------------------------ revenue trend ------------------------------ */
  const trend = useMemo(() => {
    const buckets = range === '7' ? 7 : range === '30' ? 10 : range === '90' ? 12 : 12;
    const span = RANGE_DAYS[range] * 864e5;
    const step = span / buckets;
    const out: { label: string; amount: number; count: number }[] = [];
    for (let i = 0; i < buckets; i += 1) {
      const from = Date.now() - span + i * step;
      const to = from + step;
      const slice = payments.filter((p) => {
        const t = new Date(p.at).getTime();
        return t >= from && t < to && p.status === 'success';
      });
      out.push({
        label: formatDate(new Date(from).toISOString()).slice(0, 6),
        amount: slice.reduce((a, p) => a + p.amount, 0),
        count: slice.length,
      });
    }
    return out;
  }, [payments, range]);

  const trendMax = Math.max(1, ...trend.map((t) => t.amount));

  /* ------------------------------ provider cost ------------------------------ */
  const providerCost = providerUsage.reduce((a, u) => a + u.costKes, 0);

  /* --------------------------------- exports -------------------------------- */
  const exportCsv = () => {
    const rows = scopedUsage.map((u) => ({
      timestamp: u.at, provider: u.providerName, check: u.checkType, user: u.userName,
      status: u.status, cost_kes: u.costKes, latency_ms: u.latencyMs, subject_ref: u.subjectRef,
    }));
    downloadText(toCsv(rows as unknown as Record<string, unknown>[]), `iprs_analytics_${range}d.csv`, 'text/csv;charset=utf-8');
    pushToast({ title: 'Analytics exported', description: `${rows.length} usage records`, type: 'success' });
  };

  const exportPdf = () => {
    downloadBlob(buildPaymentsPdf(scopedPayments, settings, `Analytics Revenue Ledger — last ${range === 'all' ? 'all time' : `${range} days`}`).toBlob(), 'IPRS_Analytics_Ledger.pdf');
    pushToast({ title: 'PDF downloaded', description: `${scopedPayments.length} payments`, type: 'success' });
  };

  const rangeLabel = range === 'all' ? 'all time' : `last ${range} days`;

  return (
    <div className="w-full text-xs text-slate-200 space-y-4">
      <div className="px-3 sm:px-4 py-3 bg-gradient-to-r from-[#08172b] to-[#071120] border border-sky-900/40 rounded-xl flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 size={16} className="text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-white">Reports &amp; analytics</h2>
            <p className="text-[10px] text-slate-500 truncate">
              {scopedUsage.length} verification calls · {scopedPayments.length} payments · {rangeLabel}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            size="sm"
            value={range}
            onChange={(v) => setRange(v as Range)}
            options={[{ value: '7', label: '7d' }, { value: '30', label: '30d' }, { value: '90', label: '90d' }, { value: 'all', label: 'All' }]}
          />
          <Button size="sm" variant="secondary" icon={<Download size={12} />} onClick={exportCsv}>CSV</Button>
          <Button size="sm" variant="primary" icon={<FileText size={12} />} onClick={exportPdf} disabled={!can('report.export')}>PDF</Button>
        </div>
      </div>

      <div className="grid gap-2 grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total reports"
          value={scopedUsage.length.toLocaleString('en-KE')}
          sub={`${stats.totalSearches.toLocaleString('en-KE')} lifetime`}
          delta={{ value: `${deltaPct > 0 ? '+' : ''}${deltaPct}%`, up: deltaPct >= 0 }}
          icon={<Activity size={14} className="text-cyan-400" />}
          onClick={() => navigate('/search')}
        />
        <StatCard
          label="Successful"
          value={`${successRate}%`}
          sub={`${scopedUsage.filter((u) => u.status === 'success').length} of ${scopedUsage.length} calls`}
          tone="success"
          icon={<TrendingUp size={14} className="text-emerald-400" />}
        />
        <StatCard
          label="Failed"
          value={String(failedCount)}
          sub={failedCount ? 'investigate provider health' : 'no failures in range'}
          tone={failedCount ? 'danger' : 'default'}
          icon={<TrendingDown size={14} className="text-rose-400" />}
          onClick={() => navigate('/providers')}
        />
        <StatCard
          label="Revenue"
          value={KES(scopedRevenue, { decimals: false })}
          sub={`${KES(paymentStats.gross, { decimals: false })} lifetime`}
          delta={{ value: `${revenueDelta > 0 ? '+' : ''}${revenueDelta}%`, up: revenueDelta >= 0 }}
          tone="accent"
          icon={<BarChart3 size={14} className="text-violet-400" />}
          onClick={() => navigate('/billing')}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---------------------------- reports by source --------------------------- */}
        <Panel title="Reports by source" subtitle={`Provider mix · ${rangeLabel}`} icon={<PieChart size={14} className="text-cyan-400" />}>
          {bySource.length === 0 ? (
            <EmptyState title="No verification calls in range" description="Widen the time range to see the provider mix." />
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Donut slices={bySource} />
              <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5">
                {bySource.map((s) => (
                  <div key={s.label} className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-[11px] text-slate-300 flex-1 truncate">{s.label}</span>
                    <span className="font-mono text-[10px] text-slate-500 shrink-0">{s.count}</span>
                    <span className="font-mono text-[10px] text-cyan-300 w-9 text-right shrink-0">{s.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>

        {/* ------------------------------ revenue trend ----------------------------- */}
        <Panel title="Revenue trend" subtitle={`Successful collections · ${rangeLabel}`} icon={<TrendingUp size={14} className="text-emerald-400" />} actions={<span className="text-[9px] text-cyan-400 font-mono">peak {KES(trendMax, { decimals: false })}</span>}>
          {scopedRevenue === 0 ? (
            <EmptyState title="No revenue in range" description="Successful top-ups and settlements will plot here." />
          ) : (
            <div className="w-full h-32 sm:h-36 flex items-end justify-between gap-1 sm:gap-2 pt-3 px-1">
              {trend.map((bar, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group cursor-default min-w-0">
                  <span className="text-[8px] font-mono text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {bar.amount ? KES(bar.amount, { decimals: false }) : '—'}
                  </span>
                  <div
                    style={{ height: `${Math.max(2, (bar.amount / trendMax) * 100)}%` }}
                    className="w-full max-w-[48px] rounded-t-md bg-gradient-to-t from-sky-700 to-cyan-400 group-hover:from-cyan-400 group-hover:to-cyan-200 transition-all shadow-[0_0_8px_rgba(6,182,212,0.3)]"
                  />
                  <span className="text-[8px] font-mono text-slate-500 whitespace-nowrap truncate w-full text-center">{bar.label}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* -------------------------------- top services ------------------------------- */}
      <Panel title="Top services" subtitle={`Ranked by call volume · ${rangeLabel}`} icon={<BarChart3 size={14} className="text-violet-400" />}>
        {topServices.length === 0 ? (
          <EmptyState title="No service usage in range" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {topServices.map((svc) => (
              <div key={svc.name} className="p-2.5 rounded-lg bg-[#06101c] border border-sky-950 hover:border-sky-800 transition-colors">
                <div className="flex justify-between items-center text-[11px] mb-1.5 gap-2">
                  <span className="text-slate-200 truncate">{svc.name}</span>
                  <Badge tone={svc.count && svc.success / svc.count >= 0.95 ? 'success' : svc.success / Math.max(1, svc.count) >= 0.8 ? 'warning' : 'danger'}>
                    {svc.pct.toFixed(0)}%
                  </Badge>
                </div>
                <ProgressBar value={svc.count} max={Math.max(1, topServices[0].count)} height={6} />
                <div className="flex justify-between mt-1 text-[9px] text-slate-600 font-mono">
                  <span>{svc.count} calls · {svc.success} ok</span>
                  <span>{KES(svc.cost, { decimals: false })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* ----------------------------- provider economics ---------------------------- */}
      <Panel title="Provider economics" subtitle={`Cost of goods · margin ${KES(scopedRevenue - providerCost, { decimals: false })}`} icon={<TrendingUp size={14} className="text-cyan-400" />} actions={<Button size="xs" variant="ghost" onClick={() => navigate('/providers')}>Manage providers</Button>}>
        {providerUsage.length === 0 ? (
          <EmptyState title="No provider usage recorded" />
        ) : (
          <div className="space-y-2.5">
            {providerUsage
              .slice()
              .sort((a, b) => b.costKes - a.costKes)
              .map((u) => (
                <div key={u.providerId}>
                  <ProgressBar
                    value={u.costKes}
                    max={Math.max(1, providerCost)}
                    label={u.name}
                    right={KES(u.costKes, { decimals: false })}
                    warning={0.4}
                    danger={0.6}
                  />
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-slate-600 font-mono mt-0.5">
                    <span>{u.calls} calls</span>
                    <span>{u.successRatePct.toFixed(1)}% success</span>
                    <span>{u.avgLatencyMs}ms avg</span>
                    <span>quota {u.quotaUsed}/{u.quotaTotal || '∞'}</span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </Panel>
    </div>
  );
};

/** Lightweight SVG donut built from the same slice data as the legend. */
const Donut: React.FC<{ slices: { label: string; pct: number; color: string }[] }> = ({ slices }) => {
  const R = 38;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={R} stroke="#0b1729" strokeWidth="14" fill="none" />
        {slices.map((s) => {
          const len = (s.pct / 100) * C;
          const el = (
            <circle
              key={s.label}
              cx="50"
              cy="50"
              r={R}
              stroke={s.color}
              strokeWidth="14"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
              fill="none"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Sources</span>
        <span className="text-sm font-black text-white font-mono">{slices.length}</span>
      </div>
    </div>
  );
};

export default Screen7_ReportsAnalytics;
