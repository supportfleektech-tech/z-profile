import React, { useMemo, useState } from 'react';
import {
  Landmark, Download, FileText, RotateCcw, RefreshCw, TrendingUp, AlertTriangle, Wallet as WalletIcon,
  Server, Activity, Eye, CircleDollarSign, Users,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { useAppRouter } from '../../context/RouterContext';
import {
  Badge, Button, Callout, ConfirmDialog, Drawer, EmptyState, Field, Modal, Panel, ProgressBar,
  ResponsiveTable, SearchInput, SegmentedControl, Select, StatCard, Tabs, type Column,
} from '../ui';
import { buildPaymentsPdf } from '../../lib/reports';
import { downloadBlob, downloadText, formatDate, KES, timeAgo, toCsv } from '../../lib/format';
import type { PaymentChannel, PaymentRecord, PaymentStatus } from '../../types';

const TABS = ['Payments', 'Wallets', 'System use', 'Provider traffic'] as const;
type Tab = (typeof TABS)[number];

const statusTone = (s: PaymentStatus): 'success' | 'warning' | 'danger' | 'neutral' | 'info' =>
  s === 'success' ? 'success' : s === 'failed' || s === 'timeout' ? 'danger' : s === 'refunded' ? 'info' : s === 'pending' || s === 'processing' ? 'warning' : 'neutral';

/**
 * Payments Monitor — Admin / Super Admin only.
 *
 * One place to see every payment from every user, the wallet float across the
 * organisation, overall system use and the request traffic hitting each provider
 * gateway, with refund and retry controls.
 */
export const PaymentsMonitorScreen: React.FC = () => {
  const { payments, wallets, users, paymentStats, providerUsage, providerLogs, refundPayment, retryPayment, settings, can, pushToast } = useAppData();
  const { navigate } = useAppRouter();

  const [tab, setTab] = useState<Tab>('Payments');
  const [q, setQ] = useState('');
  const [channel, setChannel] = useState<'all' | PaymentChannel>('all');
  const [status, setStatus] = useState<'all' | PaymentStatus>('all');
  const [range, setRange] = useState<'7' | '30' | '90' | 'all'>('30');
  const [detail, setDetail] = useState<PaymentRecord | null>(null);
  const [refunding, setRefunding] = useState<PaymentRecord | null>(null);
  const [refundReason, setRefundReason] = useState('Customer request — duplicate charge');
  const [retrying, setRetrying] = useState<PaymentRecord | null>(null);

  const cutoff = range === 'all' ? 0 : Date.now() - Number(range) * 864e5;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return payments.filter((p) => {
      if (cutoff && new Date(p.at).getTime() < cutoff) return false;
      if (channel !== 'all' && p.channel !== channel) return false;
      if (status !== 'all' && p.status !== status) return false;
      if (!needle) return true;
      return [p.userName, p.userEmail, p.reference, p.method, p.gateway, p.gatewayRef ?? ''].join(' ').toLowerCase().includes(needle);
    });
  }, [payments, q, channel, status, cutoff]);

  const totals = useMemo(() => {
    const rows = filtered;
    const success = rows.filter((p) => p.status === 'success');
    return {
      count: rows.length,
      gross: success.reduce((a, p) => a + p.amount, 0),
      fees: success.reduce((a, p) => a + p.feeKes, 0),
      net: success.reduce((a, p) => a + p.netKes, 0),
      failed: rows.filter((p) => p.status === 'failed' || p.status === 'timeout' || p.status === 'cancelled').length,
      pending: rows.filter((p) => p.status === 'pending' || p.status === 'processing').length,
      refunded: rows.filter((p) => p.status === 'refunded').length,
    };
  }, [filtered]);

  const paymentCols: Column<PaymentRecord>[] = [
    {
      key: 'at',
      header: 'When',
      mobilePrimary: true,
      render: (p) => (
        <div className="min-w-0">
          <div className="text-[11px] text-white font-mono">{formatDate(p.at, true)}</div>
          <div className="text-[10px] text-slate-500 truncate">{timeAgo(p.at)}</div>
        </div>
      ),
      sortValue: (p) => p.at,
    },
    {
      key: 'user',
      header: 'Payer',
      render: (p) => (
        <div className="min-w-0">
          <div className="text-[11px] text-slate-200 truncate">{p.userName}</div>
          <div className="text-[10px] text-slate-500 truncate font-mono">{p.userEmail}</div>
        </div>
      ),
      sortValue: (p) => p.userName,
    },
    { key: 'channel', header: 'Channel', render: (p) => <Badge tone={p.channel === 'mpesa' ? 'success' : p.channel === 'card' ? 'info' : 'neutral'}>{p.channel}</Badge>, sortValue: (p) => p.channel },
    { key: 'method', header: 'Method', render: (p) => <span className="text-[10px] text-slate-400 truncate">{p.method}</span>, className: 'hidden lg:table-cell' },
    { key: 'ref', header: 'Reference', render: (p) => <span className="font-mono text-[10px] text-cyan-300 break-all">{p.reference}</span>, className: 'hidden xl:table-cell' },
    { key: 'gateway', header: 'Gateway', render: (p) => <span className="text-[10px] text-slate-500">{p.gateway}</span>, className: 'hidden xl:table-cell', sortValue: (p) => p.gateway },
    { key: 'amount', header: 'Amount', align: 'right', render: (p) => <span className="font-mono text-[11px] font-bold text-white">{KES(p.amount, { decimals: false })}</span>, sortValue: (p) => p.amount },
    { key: 'fee', header: 'Fee', align: 'right', render: (p) => <span className="font-mono text-[10px] text-slate-500">{KES(p.feeKes, { decimals: false })}</span>, className: 'hidden lg:table-cell', sortValue: (p) => p.feeKes },
    { key: 'net', header: 'Net', align: 'right', render: (p) => <span className="font-mono text-[10px] text-emerald-300">{KES(p.netKes, { decimals: false })}</span>, className: 'hidden xl:table-cell', sortValue: (p) => p.netKes },
    { key: 'status', header: 'Status', render: (p) => <Badge tone={statusTone(p.status)} dot>{p.status}</Badge>, sortValue: (p) => p.status },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (p) => (
        <div className="flex items-center justify-end gap-1">
          <Button size="xs" variant="ghost" icon={<Eye size={11} />} onClick={() => setDetail(p)} title="Inspect" />
          {p.status === 'success' && can('payments.refund') && (
            <Button size="xs" variant="ghost" icon={<RotateCcw size={11} />} onClick={() => setRefunding(p)} title="Refund" className="text-amber-400/80 hover:text-amber-300" />
          )}
          {(p.status === 'failed' || p.status === 'timeout') && (
            <Button size="xs" variant="ghost" icon={<RefreshCw size={11} />} onClick={() => setRetrying(p)} title="Retry" className="text-cyan-400/80 hover:text-cyan-300" />
          )}
        </div>
      ),
      renderMobile: (p) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="xs" variant="secondary" icon={<Eye size={11} />} onClick={() => setDetail(p)}>Inspect</Button>
          {p.status === 'success' && can('payments.refund') && <Button size="xs" variant="secondary" icon={<RotateCcw size={11} />} onClick={() => setRefunding(p)}>Refund</Button>}
          {(p.status === 'failed' || p.status === 'timeout') && <Button size="xs" variant="secondary" icon={<RefreshCw size={11} />} onClick={() => setRetrying(p)}>Retry</Button>}
        </div>
      ),
    },
  ];

  const maxDay = Math.max(1, ...paymentStats.last30d.map((d) => d.amount));

  return (
    <div className="w-full text-xs text-slate-200">
      <div className="px-3 sm:px-4 py-3 bg-gradient-to-r from-[#1a1030] via-[#08172b] to-[#071120] border-b border-sky-900/50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Landmark size={16} className="text-violet-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-white">Payments monitor</h2>
            <p className="text-[10px] text-slate-500 truncate">
              {payments.length} payment(s) · float {KES(paymentStats.walletFloat, { decimals: false })} · card gateway {settings.billing.cardGateway}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" icon={<Download size={12} />} onClick={() => { downloadText(toCsv(filtered.map((p) => ({ ...p })) as unknown as Record<string, unknown>[]), 'payments_ledger.csv', 'text/csv;charset=utf-8'); pushToast({ title: 'Ledger exported', description: `${filtered.length} rows`, type: 'success' }); }}>
            CSV
          </Button>
          <Button size="sm" variant="primary" icon={<FileText size={12} />} onClick={() => { downloadBlob(buildPaymentsPdf(filtered, settings).toBlob(), `IPRS_Payments_${range}d.pdf`); pushToast({ title: 'Payments PDF downloaded', type: 'success' }); }}>
            PDF ledger
          </Button>
        </div>
      </div>

      <div className="p-2 sm:p-4 space-y-4">
        {/* KPI row */}
        <div className="grid gap-2 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Gross collected" value={KES(totals.gross, { decimals: false })} sub={`${filtered.filter((p) => p.status === 'success').length} successful`} tone="success" icon={<CircleDollarSign size={14} className="text-emerald-400" />} />
          <StatCard label="Net of fees" value={KES(totals.net, { decimals: false })} sub={`fees ${KES(totals.fees, { decimals: false })}`} icon={<TrendingUp size={14} className="text-cyan-400" />} />
          <StatCard label="Failed / timed out" value={String(totals.failed)} sub={`${totals.pending} pending`} tone={totals.failed > 0 ? 'danger' : 'default'} icon={<AlertTriangle size={14} className="text-rose-400" />} />
          <StatCard label="Refunded" value={String(totals.refunded)} sub={KES(payments.filter((p) => p.status === 'refunded').reduce((a, p) => a + p.amount, 0), { decimals: false })} tone="warning" icon={<RotateCcw size={14} className="text-amber-400" />} />
          <StatCard label="Wallet float" value={KES(paymentStats.walletFloat, { decimals: false })} sub={`${wallets.length} wallets`} icon={<WalletIcon size={14} className="text-emerald-400" />} />
          <StatCard label="Average ticket" value={KES(paymentStats.average, { decimals: false })} sub={`${paymentStats.successful + paymentStats.failed} attempts all-time`} icon={<Activity size={14} className="text-cyan-400" />} />
        </div>

        <div className="px-0">
          <Tabs tabs={TABS} active={tab} onChange={(t) => setTab(t as Tab)} badges={{ Payments: filtered.length, Wallets: wallets.length }} />
        </div>

        {/* ============================== PAYMENTS ============================== */}
        {tab === 'Payments' && (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Collection trend" subtitle="Last 14 days of successful payments" icon={<TrendingUp size={14} className="text-cyan-400" />} className="lg:col-span-2">
                <div className="flex items-end gap-1 h-32">
                  {paymentStats.last30d.map((d) => (
                    <div key={d.day} className="flex-1 flex flex-col items-center gap-1 min-w-0 group" title={`${d.day}: ${KES(d.amount, { decimals: false })} across ${d.count} payment(s)`}>
                      <div className="w-full rounded-t bg-gradient-to-t from-cyan-700 to-cyan-400 transition-all group-hover:from-emerald-600 group-hover:to-emerald-400" style={{ height: `${Math.max(2, (d.amount / maxDay) * 100)}%` }} />
                      <span className="text-[8px] text-slate-600 font-mono truncate w-full text-center">{d.day.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-500">
                  {paymentStats.byChannel.map((c) => (
                    <span key={c.channel} className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-cyan-500" />
                      {c.channel}: {c.count} · {KES(c.amount, { decimals: false })}
                    </span>
                  ))}
                </div>
              </Panel>

              <Panel title="Channel split" icon={<Landmark size={14} className="text-cyan-400" />}>
                <div className="space-y-2.5">
                  {paymentStats.byChannel.map((c) => (
                    <div key={c.channel}>
                      <ProgressBar value={c.amount} max={Math.max(1, paymentStats.gross)} label={<span className="uppercase font-mono text-[10px]">{c.channel}</span>} right={`${c.count} · ${KES(c.amount, { decimals: false })}`} />
                    </div>
                  ))}
                  <div className="pt-2 border-t border-sky-950/60 space-y-1 text-[10px] text-slate-500">
                    <div className="flex justify-between"><span>M-PESA shortcode</span><span className="font-mono text-slate-300">{settings.billing.mpesaShortcode}</span></div>
                    <div className="flex justify-between"><span>Card gateway</span><span className="font-mono text-slate-300">{settings.billing.cardGateway}</span></div>
                    <div className="flex justify-between"><span>Credit terms</span><span className="font-mono text-slate-300">{settings.billing.creditTermsDays} days</span></div>
                    <div className="flex justify-between"><span>VAT</span><span className="font-mono text-slate-300">{settings.billing.vatRatePct}%</span></div>
                  </div>
                </div>
              </Panel>
            </div>

            <Panel
              title="All payments"
              subtitle={`${filtered.length} of ${payments.length} shown`}
              icon={<Landmark size={14} className="text-violet-400" />}
              actions={
                <div className="flex flex-wrap items-center gap-1.5">
                  <SearchInput value={q} onChange={setQ} placeholder="Search payer, reference, gateway…" className="w-40 sm:w-56" />
                  <SegmentedControl size="sm" value={range} onChange={(v) => setRange(v as typeof range)} options={[{ value: '7', label: '7d' }, { value: '30', label: '30d' }, { value: '90', label: '90d' }, { value: 'all', label: 'All' }]} />
                  <Select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} options={[{ value: 'all', label: 'All channels' }, { value: 'mpesa', label: 'M-PESA' }, { value: 'card', label: 'Card' }, { value: 'bank', label: 'Bank' }, { value: 'wallet', label: 'Wallet' }, { value: 'system', label: 'System' }]} className="w-32" />
                  <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} options={[{ value: 'all', label: 'Any status' }, ...(['success', 'pending', 'processing', 'failed', 'timeout', 'cancelled', 'refunded'] as PaymentStatus[]).map((s) => ({ value: s, label: s }))]} className="w-32" />
                </div>
              }
            >
              <ResponsiveTable columns={paymentCols} rows={filtered} rowKey={(p) => p.id} dense initialSort={{ key: 'at', dir: 'desc' }} maxHeight="560px" emptyTitle="No payments match" emptyDescription="Widen the date range or clear the filters." />
            </Panel>
          </>
        )}

        {/* =============================== WALLETS =============================== */}
        {tab === 'Wallets' && (
          <Panel title="Wallet balances across the organisation" subtitle={`${wallets.length} wallet(s) · float ${KES(paymentStats.walletFloat, { decimals: false })}`} icon={<Users size={14} className="text-emerald-400" />}>
            <ResponsiveTable
              dense
              rowKey={(w) => w.id}
              rows={wallets}
              initialSort={{ key: 'balance', dir: 'desc' }}
              columns={[
                {
                  key: 'user',
                  header: 'Holder',
                  mobilePrimary: true,
                  render: (w) => {
                    const u = users.find((x) => x.id === w.userId);
                    return (
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-white truncate">{u?.name ?? w.userId}</div>
                        <div className="text-[10px] text-slate-500 truncate font-mono">{u?.email ?? '—'}</div>
                      </div>
                    );
                  },
                  sortValue: (w) => users.find((x) => x.id === w.userId)?.name ?? '',
                },
                { key: 'tier', header: 'Tier', render: (w) => { const u = users.find((x) => x.id === w.userId); return u ? <Badge tone={u.tier === 'super_admin' ? 'warning' : u.tier === 'admin' ? 'accent' : 'info'}>{u.tier}</Badge> : <span>—</span>; }, className: 'hidden sm:table-cell' },
                { key: 'balance', header: 'Balance', align: 'right', render: (w) => <span className={`font-mono text-[11px] font-bold ${w.balance <= w.lowBalanceAlertKes ? 'text-rose-300' : 'text-emerald-300'}`}>{KES(w.balance, { decimals: false })}</span>, sortValue: (w) => w.balance },
                { key: 'held', header: 'Held', align: 'right', render: (w) => <span className="font-mono text-[10px] text-amber-300">{KES(w.held, { decimals: false })}</span>, className: 'hidden lg:table-cell', sortValue: (w) => w.held },
                { key: 'topup', header: 'Lifetime top-up', align: 'right', render: (w) => <span className="font-mono text-[10px]">{KES(w.lifetimeTopUp, { decimals: false })}</span>, className: 'hidden lg:table-cell', sortValue: (w) => w.lifetimeTopUp },
                { key: 'spend', header: 'Lifetime spend', align: 'right', render: (w) => <span className="font-mono text-[10px]">{KES(w.lifetimeSpend, { decimals: false })}</span>, className: 'hidden xl:table-cell', sortValue: (w) => w.lifetimeSpend },
                { key: 'auto', header: 'Auto top-up', render: (w) => <Badge tone={w.autoTopUp ? 'success' : 'neutral'} dot>{w.autoTopUp ? 'On' : 'Off'}</Badge>, align: 'center', className: 'hidden sm:table-cell', sortValue: (w) => (w.autoTopUp ? 1 : 0) },
                { key: 'alert', header: 'Alert at', align: 'right', render: (w) => <span className="font-mono text-[10px] text-slate-500">{KES(w.lowBalanceAlertKes, { decimals: false })}</span>, className: 'hidden xl:table-cell', sortValue: (w) => w.lowBalanceAlertKes },
                { key: 'updated', header: 'Updated', render: (w) => <span className="text-[10px] text-slate-500">{timeAgo(w.updatedAt)}</span>, className: 'hidden lg:table-cell', sortValue: (w) => w.updatedAt },
              ]}
            />
            {wallets.some((w) => w.balance <= w.lowBalanceAlertKes) && (
              <Callout tone="warning" title="Low balances" className="mt-3">
                {wallets.filter((w) => w.balance <= w.lowBalanceAlertKes).map((w) => users.find((u) => u.id === w.userId)?.name ?? w.userId).join(', ')} are at or below their alert threshold.
              </Callout>
            )}
          </Panel>
        )}

        {/* ============================= SYSTEM USE ============================= */}
        {tab === 'System use' && (
          <>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Provider spend" value={KES(providerUsage.reduce((a, u) => a + u.costKes, 0), { decimals: false })} sub={`${providerUsage.reduce((a, u) => a + u.calls, 0)} calls`} icon={<Server size={14} className="text-cyan-400" />} />
              <StatCard label="Gross margin" value={KES(totals.gross - providerUsage.reduce((a, u) => a + u.costKes, 0), { decimals: false })} sub={`revenue ${KES(totals.gross, { decimals: false })} − provider cost`} tone="accent" icon={<TrendingUp size={14} className="text-violet-400" />} />
              <StatCard label="Active accounts" value={String(users.filter((u) => u.status === 'Active').length)} sub={`${users.length} provisioned`} icon={<Users size={14} className="text-emerald-400" />} />
              <StatCard label="Requests logged" value={providerLogs.length.toLocaleString('en-KE')} sub={`${providerLogs.filter((l) => l.status !== 'success').length} non-success`} icon={<Activity size={14} className="text-cyan-400" />} />
            </div>

            <Panel title="Usage & cost per gateway" icon={<Server size={14} className="text-cyan-400" />} actions={<Button size="xs" variant="secondary" onClick={() => navigate('/providers')}>Manage providers</Button>}>
              <ResponsiveTable
                dense
                rowKey={(u) => u.providerId}
                rows={providerUsage}
                initialSort={{ key: 'cost', dir: 'desc' }}
                columns={[
                  { key: 'name', header: 'Gateway', mobilePrimary: true, render: (u) => <span className="text-[11px] font-semibold text-white">{u.name}</span>, sortValue: (u) => u.name },
                  { key: 'calls', header: 'Calls', align: 'right', render: (u) => <span className="font-mono">{u.calls}</span>, sortValue: (u) => u.calls },
                  { key: 'successes', header: 'Success', align: 'right', render: (u) => <span className="font-mono text-emerald-300">{u.successes}</span>, className: 'hidden sm:table-cell', sortValue: (u) => u.successes },
                  { key: 'errors', header: 'Errors', align: 'right', render: (u) => <span className={`font-mono ${u.errors > 0 ? 'text-rose-300' : 'text-slate-600'}`}>{u.errors}</span>, sortValue: (u) => u.errors },
                  { key: 'rate', header: 'Success rate', render: (u) => <span className="flex items-center gap-2 min-w-[110px]"><ProgressBar value={u.successRatePct} max={100} height={5} className="flex-1" warning={95} /><span className="text-[10px] font-mono text-slate-400 w-10 text-right">{u.successRatePct.toFixed(1)}%</span></span>, sortValue: (u) => u.successRatePct },
                  { key: 'latency', header: 'Avg latency', align: 'right', render: (u) => <span className="font-mono">{u.avgLatencyMs} ms</span>, className: 'hidden lg:table-cell', sortValue: (u) => u.avgLatencyMs },
                  { key: 'quota', header: 'Quota used', render: (u) => <span className="flex items-center gap-2 min-w-[110px]"><ProgressBar value={u.quotaUsed} max={Math.max(1, u.quotaTotal)} height={5} className="flex-1" warning={0.75} danger={0.9} /><span className="text-[9px] font-mono text-slate-500 w-16 text-right">{u.quotaUsed}/{u.quotaTotal}</span></span>, className: 'hidden sm:table-cell', sortValue: (u) => (u.quotaTotal ? u.quotaUsed / u.quotaTotal : 0) },
                  { key: 'cost', header: 'Spend', align: 'right', render: (u) => <span className="font-mono text-emerald-300">{KES(u.costKes, { decimals: false })}</span>, sortValue: (u) => u.costKes },
                ]}
              />
            </Panel>
          </>
        )}

        {/* =========================== PROVIDER TRAFFIC =========================== */}
        {tab === 'Provider traffic' && (
          <Panel title="Recent gateway requests" subtitle="Every request the platform made to a provider" icon={<Activity size={14} className="text-cyan-400" />} actions={<Button size="xs" variant="secondary" icon={<Download size={11} />} onClick={() => { downloadText(toCsv(providerLogs.slice(0, 500).map((l) => ({ ...l })) as unknown as Record<string, unknown>[]), 'provider_traffic.csv', 'text/csv;charset=utf-8'); pushToast({ title: 'Traffic exported', type: 'success' }); }}>CSV</Button>}>
            {providerLogs.length === 0 ? (
              <EmptyState title="No provider traffic yet" description="Run a verification to generate gateway requests." />
            ) : (
              <ResponsiveTable
                dense
                rowKey={(l) => l.id}
                rows={providerLogs.slice(0, 300)}
                initialSort={{ key: 'at', dir: 'desc' }}
                maxHeight="560px"
                columns={[
                  { key: 'at', header: 'When', mobilePrimary: true, render: (l) => <span className="font-mono text-[10px]">{formatDate(l.at, true)}</span>, sortValue: (l) => l.at },
                  { key: 'provider', header: 'Gateway', render: (l) => <span className="text-[11px] text-white">{l.providerName}</span>, sortValue: (l) => l.providerName },
                  { key: 'endpoint', header: 'Endpoint', render: (l) => <span className="font-mono text-[10px] text-cyan-300 break-all">{l.endpoint}</span>, className: 'hidden sm:table-cell' },
                  { key: 'actor', header: 'Requested by', render: (l) => <span className="text-[10px] text-slate-400">{l.actorName}</span>, className: 'hidden lg:table-cell', sortValue: (l) => l.actorName },
                  { key: 'subject', header: 'Subject', render: (l) => <span className="font-mono text-[10px] text-slate-500">{l.subjectRef}</span>, className: 'hidden xl:table-cell' },
                  { key: 'code', header: 'HTTP', align: 'center', render: (l) => <Badge tone={l.httpCode < 300 ? 'success' : l.httpCode < 500 ? 'warning' : 'danger'}>{l.httpCode}</Badge>, sortValue: (l) => l.httpCode },
                  { key: 'status', header: 'Status', render: (l) => <Badge tone={l.status === 'success' ? 'success' : 'danger'} dot>{l.status}</Badge>, sortValue: (l) => l.status },
                  { key: 'latency', header: 'ms', align: 'right', render: (l) => <span className="font-mono text-[10px]">{l.latencyMs}</span>, className: 'hidden sm:table-cell', sortValue: (l) => l.latencyMs },
                  { key: 'cost', header: 'Cost', align: 'right', render: (l) => <span className="font-mono text-[10px]">{KES(l.costKes)}</span>, sortValue: (l) => l.costKes },
                ]}
              />
            )}
          </Panel>
        )}
      </div>

      {/* ------------------------------ detail drawer ------------------------------ */}
      <Drawer open={Boolean(detail)} onClose={() => setDetail(null)} title={detail ? `Payment ${detail.reference}` : ''} subtitle={detail ? `${detail.userName} · ${formatDate(detail.at, true)}` : ''} width="520px">
        {detail && (
          <div className="space-y-4">
            <div className="rounded-xl border border-sky-900/50 bg-[#061020] p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-2xl font-black text-white font-mono">{KES(detail.amount)}</div>
                  <div className="text-[10px] text-slate-500">net {KES(detail.netKes)} after {KES(detail.feeKes)} fees</div>
                </div>
                <Badge tone={statusTone(detail.status)} dot>{detail.status}</Badge>
              </div>
              <dl className="mt-3 space-y-1.5 text-[11px]">
                {[
                  ['Payment ID', detail.id],
                  ['Payer', `${detail.userName} (${detail.userEmail})`],
                  ['Channel', detail.channel],
                  ['Method', detail.method],
                  ['Gateway', detail.gateway],
                  ['Gateway ref', detail.gatewayRef ?? '—'],
                  ['Reference', detail.reference],
                  ['Wallet transaction', detail.walletTransactionId ?? '—'],
                  ['IP address', detail.ip],
                  ['Failure reason', detail.failureReason ?? '—'],
                  ['Refunded', detail.refundedAt ? `${formatDate(detail.refundedAt, true)} by ${detail.refundedBy ?? '—'}` : 'No'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3 border-b border-sky-950/60 pb-1 last:border-0">
                    <dt className="text-slate-500 shrink-0">{k}</dt>
                    <dd className="text-slate-200 font-mono text-right break-all">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {detail.rawResponse && (
              <Panel title="Raw gateway response" icon={<Server size={14} className="text-cyan-400" />}>
                <pre className="rounded-lg bg-[#050b14] border border-sky-900/50 p-2.5 text-[10px] font-mono text-emerald-300/80 overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(detail.rawResponse, null, 2)}
                </pre>
              </Panel>
            )}

            <div className="flex flex-wrap gap-2">
              {detail.status === 'success' && can('payments.refund') && (
                <Button variant="secondary" size="sm" icon={<RotateCcw size={12} />} onClick={() => { setRefunding(detail); setDetail(null); }}>Refund</Button>
              )}
              {(detail.status === 'failed' || detail.status === 'timeout') && (
                <Button variant="primary" size="sm" icon={<RefreshCw size={12} />} onClick={() => { setRetrying(detail); setDetail(null); }}>Retry</Button>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* ------------------------------- refund dialog ------------------------------- */}
      <Modal
        open={Boolean(refunding)}
        onClose={() => setRefunding(null)}
        title={<span className="flex items-center gap-2"><RotateCcw size={15} className="text-amber-400" /> Refund payment</span>}
        subtitle={refunding ? `${refunding.reference} · ${KES(refunding.amount)}` : ''}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefunding(null)}>Cancel</Button>
            <Button
              variant="primary"
              icon={<RotateCcw size={13} />}
              onClick={async () => {
                if (!refunding) return;
                const res = await refundPayment(refunding.id, refundReason);
                if (res.ok) setRefunding(null);
              }}
            >
              Issue refund
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Callout tone="warning" title="This reverses the credit">
            The wallet is debited by the refunded amount and the payer is notified. The action is written to the audit log with
            your identity.
          </Callout>
          <Field label="Reason" required>
            <Select
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              options={[
                'Customer request — duplicate charge',
                'Failed verification — service credit',
                'Gateway error — charge not delivered',
                'Billing correction',
                'Fraud / disputed transaction',
              ].map((r) => ({ value: r, label: r }))}
            />
          </Field>
        </div>
      </Modal>

      {/* ------------------------------- retry dialog ------------------------------- */}
      <ConfirmDialog
        open={Boolean(retrying)}
        onClose={() => setRetrying(null)}
        onConfirm={async () => {
          if (retrying) await retryPayment(retrying.id);
          setRetrying(null);
        }}
        title="Retry failed payment"
        confirmLabel="Retry now"
        message={
          <span>
            Re-submit <strong>{retrying?.reference}</strong> for {KES(retrying?.amount ?? 0)} to{' '}
            <strong>{retrying?.userName}</strong> via {retrying?.channel}. The original failure reason was{' '}
            <em>{retrying?.failureReason ?? 'not recorded'}</em>.
          </span>
        }
      />
    </div>
  );
};

export default PaymentsMonitorScreen;
