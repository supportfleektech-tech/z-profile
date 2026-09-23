import React, { useMemo, useState } from 'react';
import { CreditCard, Download, ArrowRight, Wallet as WalletIcon, Receipt, Activity, FileText, RefreshCw } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { useAppRouter } from '../../context/RouterContext';
import { Badge, Button, Callout, EmptyState, Panel, ProgressBar, ResponsiveTable, Tabs, type Column } from '../ui';
import { buildInvoicePdf } from '../../lib/reports';
import { downloadBlob, downloadText, formatDate, KES, timeAgo, toCsv } from '../../lib/format';
import type { InvoiceItem, WalletTransaction } from '../../types';
import { getSnapshot } from '../../services/db';

const TABS = ['Overview', 'Invoices', 'Transactions', 'Payment Methods'] as const;
type Tab = (typeof TABS)[number];

const statusTone = (s: InvoiceItem['status']): 'success' | 'warning' | 'danger' | 'neutral' =>
  s === 'Paid' ? 'success' : s === 'Overdue' ? 'danger' : s === 'Pending' ? 'warning' : 'neutral';

/**
 * Billing & Invoices — wired to the real ledger.
 *
 * Invoice PDFs are generated client-side from the same data shown on screen; quota meters
 * read from usage records rather than hard-coded numbers.
 */
export const Screen8_Billing: React.FC = () => {
  const {
    invoices, currentPlan, setCurrentPlan, pushToast, subscriptionPlans, wallet, myTransactions,
    payments, quota, settings, pricing, can, billingPeriod, setBillingPeriod, users,
  } = useAppData();
  const { navigate } = useAppRouter();
  const [tab, setTab] = useState<Tab>('Overview');
  const [busyId, setBusyId] = useState<string | null>(null);

  const planMeta = subscriptionPlans.find((p) => p.id === currentPlan) ?? subscriptionPlans[0];
  const methods = useMemo(() => getSnapshot().paymentMethods.filter((m) => m.userId === wallet.userId), [wallet.userId, payments.length]);

  const outstanding = invoices.filter((i) => i.status !== 'Paid').reduce((a, i) => a + (i.amountValue ?? 0), 0);
  const paidYtd = invoices.filter((i) => i.status === 'Paid').reduce((a, i) => a + (i.amountValue ?? 0), 0);
  const spend30 = myTransactions.filter((t) => t.direction === 'debit' && Date.now() - new Date(t.at).getTime() < 30 * 864e5).reduce((a, t) => a + t.amount, 0);
  const topUp30 = myTransactions.filter((t) => t.direction === 'credit' && Date.now() - new Date(t.at).getTime() < 30 * 864e5).reduce((a, t) => a + t.amount, 0);

  const downloadInvoice = (inv: InvoiceItem) => {
    setBusyId(inv.id);
    try {
      const doc = buildInvoicePdf(inv, settings, wallet);
      downloadBlob(doc.toBlob(), `${inv.invoiceNo}.pdf`);
      pushToast({ title: 'Invoice downloaded', description: `${inv.invoiceNo}.pdf`, type: 'success' });
    } catch (e) {
      pushToast({ title: 'Could not generate invoice', description: String(e), type: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const invoiceCols: Column<InvoiceItem>[] = [
    {
      key: 'no',
      header: 'Invoice',
      mobilePrimary: true,
      render: (i) => (
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-white font-mono">{i.invoiceNo}</div>
          <div className="text-[10px] text-slate-500 truncate">
            {i.userId ? users.find((u) => u.id === i.userId)?.name ?? i.userId : settings.org.legalName}
          </div>
        </div>
      ),
      sortValue: (i) => i.invoiceNo,
    },
    { key: 'date', header: 'Invoice date', render: (i) => <span className="text-[10px] text-slate-400">{i.date}</span>, className: 'hidden sm:table-cell', sortValue: (i) => i.date },
    { key: 'channel', header: 'Channel', render: (i) => <Badge tone="neutral">{i.channel ?? '—'}</Badge>, className: 'hidden lg:table-cell', sortValue: (i) => i.channel ?? '' },
    { key: 'amount', header: 'Amount', align: 'right', render: (i) => <span className="font-mono text-[11px] font-semibold text-white">{i.amount}</span>, sortValue: (i) => i.amountValue ?? 0 },
    { key: 'status', header: 'Status', render: (i) => <Badge tone={statusTone(i.status)} dot>{i.status}</Badge>, sortValue: (i) => i.status },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (i) => (
        <Button size="xs" variant="secondary" loading={busyId === i.id} icon={<Download size={11} />} onClick={() => downloadInvoice(i)}>
          <span className="hidden sm:inline">PDF</span>
        </Button>
      ),
      renderMobile: (i) => (
        <Button size="xs" variant="secondary" loading={busyId === i.id} icon={<Download size={11} />} onClick={() => downloadInvoice(i)}>
          Download invoice PDF
        </Button>
      ),
    },
  ];

  const txCols: Column<WalletTransaction>[] = [
    {
      key: 'at',
      header: 'When',
      mobilePrimary: true,
      render: (t) => (
        <div className="min-w-0">
          <div className="text-[11px] text-white font-mono">{formatDate(t.at, true)}</div>
          <div className="text-[10px] text-slate-500 truncate">{t.description}</div>
        </div>
      ),
      sortValue: (t) => t.at,
    },
    { key: 'kind', header: 'Type', render: (t) => <Badge tone={t.kind === 'topup' ? 'success' : t.kind === 'refund' ? 'info' : t.kind === 'search' ? 'neutral' : 'warning'}>{t.kind}</Badge>, sortValue: (t) => t.kind },
    { key: 'channel', header: 'Channel', render: (t) => <span className="text-[10px] text-slate-400">{t.channel}</span>, className: 'hidden sm:table-cell', sortValue: (t) => t.channel },
    { key: 'ref', header: 'Reference', render: (t) => <span className="font-mono text-[10px] text-cyan-300">{t.reference}</span>, className: 'hidden lg:table-cell' },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (t) => (
        <span className={`font-mono text-[11px] font-semibold ${t.direction === 'credit' ? 'text-emerald-300' : 'text-slate-200'}`}>
          {t.direction === 'credit' ? '+' : '−'}
          {KES(t.amount, { decimals: false })}
        </span>
      ),
      sortValue: (t) => (t.direction === 'credit' ? t.amount : -t.amount),
    },
    { key: 'balance', header: 'Balance after', align: 'right', render: (t) => <span className="font-mono text-[10px] text-slate-500">{KES(t.balanceAfter, { decimals: false })}</span>, className: 'hidden xl:table-cell', sortValue: (t) => t.balanceAfter },
    { key: 'status', header: 'Status', render: (t) => <Badge tone={t.status === 'success' ? 'success' : t.status === 'failed' ? 'danger' : t.status === 'pending' ? 'warning' : 'neutral'}>{t.status}</Badge>, sortValue: (t) => t.status },
  ];

  return (
    <div className="w-full text-xs text-slate-200">
      <div className="px-3 sm:px-4 py-3 bg-gradient-to-r from-[#08172b] to-[#071120] border-b border-sky-900/50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <CreditCard size={16} className="text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-white">Billing &amp; invoices</h2>
            <p className="text-[10px] text-slate-500 truncate">
              {planMeta?.name} plan · {pricing.batchLabel} · {settings.org.legalName}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" icon={<WalletIcon size={12} />} onClick={() => navigate('/wallet')}>Open wallet</Button>
          <Button size="sm" variant="primary" icon={<ArrowRight size={12} />} onClick={() => navigate('/pricing')}>Change plan</Button>
        </div>
      </div>

      <div className="px-2 sm:px-4 pt-3">
        <Tabs tabs={TABS} active={tab} onChange={(t) => setTab(t as Tab)} badges={{ Invoices: invoices.filter((i) => i.status !== 'Paid').length }} />
      </div>

      <div className="p-2 sm:p-4 space-y-4">
        {tab === 'Overview' && (
          <>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Wallet balance', value: KES(wallet.balance, { decimals: false }), sub: `${wallet.held > 0 ? `${KES(wallet.held, { decimals: false })} held` : 'nothing held'}`, tone: 'success' as const },
                { label: 'Outstanding invoices', value: KES(outstanding, { decimals: false }), sub: `${invoices.filter((i) => i.status !== 'Paid').length} unpaid`, tone: outstanding > 0 ? ('danger' as const) : ('default' as const) },
                { label: 'Spend (30 days)', value: KES(spend30, { decimals: false }), sub: `${myTransactions.filter((t) => t.direction === 'debit').length} debits all-time`, tone: 'default' as const },
                { label: 'Topped up (30 days)', value: KES(topUp30, { decimals: false }), sub: `paid ${KES(paidYtd, { decimals: false })} in invoices`, tone: 'accent' as const },
              ].map((k) => (
                <div key={k.label} className="rounded-xl border border-sky-900/50 bg-[#061020] p-3">
                  <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{k.label}</div>
                  <div className={`text-lg font-black font-mono mt-0.5 ${k.tone === 'success' ? 'text-emerald-300' : k.tone === 'danger' ? 'text-rose-300' : k.tone === 'accent' ? 'text-cyan-300' : 'text-white'}`}>{k.value}</div>
                  <div className="text-[10px] text-slate-500 truncate">{k.sub}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Quota consumption" subtitle="Live from your usage records" icon={<Activity size={14} className="text-cyan-400" />} className="lg:col-span-2">
                {quota.length === 0 ? (
                  <EmptyState title="No quota configured" />
                ) : (
                  <div className="space-y-2.5">
                    {quota.map((q) => (
                      <ProgressBar key={q.label} value={q.used} max={Math.max(1, q.total)} label={q.label} right={`${q.used} / ${q.total}`} warning={0.75} danger={0.9} />
                    ))}
                  </div>
                )}
              </Panel>

              <Panel title="Current plan" icon={<Receipt size={14} className="text-cyan-400" />}>
                <div className="space-y-2">
                  <div className="text-sm font-bold text-white">{planMeta?.name}</div>
                  <div className="text-[10px] text-slate-500">{planMeta?.subtitle}</div>
                  <div className="text-lg font-black text-emerald-300 font-mono">
                    {planMeta?.customPrice ?? KES(billingPeriod === 'yearly' ? planMeta?.yearlyPrice ?? 0 : planMeta?.monthlyPrice ?? 0, { decimals: false })}
                    {!planMeta?.customPrice && <span className="text-[10px] text-slate-500 font-normal">/{billingPeriod === 'yearly' ? 'yr' : 'mo'}</span>}
                  </div>
                  <div className="flex gap-1.5">
                    {(['monthly', 'yearly'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setBillingPeriod(p)}
                        className={`px-2 py-1 rounded-lg border text-[10px] capitalize ${billingPeriod === p ? 'border-cyan-600/70 bg-cyan-950/40 text-cyan-200' : 'border-sky-900/60 bg-[#061020] text-slate-500'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <ul className="space-y-1 pt-1 border-t border-sky-950/60">
                    {(planMeta?.features ?? []).slice(0, 5).map((f) => (
                      <li key={f} className="text-[10px] text-slate-400 flex items-start gap-1.5">
                        <span className="text-emerald-400 mt-0.5">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <Button size="xs" variant="secondary" className="w-full justify-center mt-1" onClick={() => navigate('/pricing')}>Compare plans</Button>
                </div>
              </Panel>
            </div>

            <Panel title="Subscription switcher" icon={<RefreshCw size={14} className="text-cyan-400" />}>
              <div className="flex flex-wrap gap-1.5">
                {subscriptionPlans.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setCurrentPlan(p.id);
                      pushToast({ title: 'Plan updated', description: `Switched to ${p.name}`, type: 'success' });
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-medium transition-colors ${
                      currentPlan === p.id ? 'border-cyan-600/70 bg-cyan-950/40 text-cyan-200' : 'border-sky-900/60 bg-[#061020] text-slate-400 hover:text-white'
                    }`}
                  >
                    {p.name}
                    <span className="ml-1.5 font-mono text-slate-500">{p.customPrice ?? KES(p.monthlyPrice, { decimals: false })}</span>
                  </button>
                ))}
              </div>
            </Panel>
          </>
        )}

        {tab === 'Invoices' && (
          <Panel
            title="Invoices"
            subtitle={`${invoices.length} invoice(s) · ${settings.billing.invoicePrefix} series`}
            icon={<FileText size={14} className="text-cyan-400" />}
            actions={
              <Button size="xs" variant="secondary" icon={<Download size={11} />} onClick={() => { downloadText(toCsv(invoices.map((i) => ({ ...i })) as unknown as Record<string, unknown>[]), 'invoices.csv', 'text/csv;charset=utf-8'); pushToast({ title: 'Invoices exported', type: 'success' }); }}>
                CSV
              </Button>
            }
          >
            <ResponsiveTable columns={invoiceCols} rows={invoices} rowKey={(i) => i.id} dense emptyTitle="No invoices yet" initialSort={{ key: 'no', dir: 'desc' }} />
            {outstanding > 0 && (
              <Callout tone="warning" title="Outstanding balance" className="mt-3">
                {KES(outstanding)} is due across {invoices.filter((i) => i.status !== 'Paid').length} invoice(s). Payment terms are{' '}
                {settings.billing.creditTermsDays} days.
              </Callout>
            )}
          </Panel>
        )}

        {tab === 'Transactions' && (
          <Panel title="Wallet ledger" subtitle={`${myTransactions.length} transaction(s) on your wallet`} icon={<WalletIcon size={14} className="text-emerald-400" />}>
            <ResponsiveTable columns={txCols} rows={myTransactions} rowKey={(t) => t.id} dense initialSort={{ key: 'at', dir: 'desc' }} emptyTitle="No transactions yet" maxHeight="520px" />
          </Panel>
        )}

        {tab === 'Payment Methods' && (
          <Panel
            title="Saved payment methods"
            subtitle="Used for wallet top-ups and subscription renewals"
            icon={<CreditCard size={14} className="text-cyan-400" />}
            actions={<Button size="xs" variant="primary" onClick={() => navigate('/wallet')} disabled={!can('wallet.topup')}>Add method</Button>}
          >
            {methods.length === 0 ? (
              <EmptyState title="No saved methods" description="Add an M-PESA number or card from the wallet page." action={<Button size="sm" variant="primary" onClick={() => navigate('/wallet')}>Open wallet</Button>} />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {methods.map((m) => (
                  <div key={m.id} className="rounded-xl border border-sky-900/50 bg-[#061020] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-white truncate">{m.label}</div>
                        <div className="text-[10px] text-slate-500 font-mono truncate">{m.display}</div>
                      </div>
                      <Badge tone={m.status === 'active' ? 'success' : 'neutral'} dot>{m.status}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                      {m.brand && <Badge tone="info">{m.brand}</Badge>}
                      <Badge tone="neutral">{m.channel}</Badge>
                      {m.isDefault && <Badge tone="accent">Default</Badge>}
                      {m.expiry && <span className="font-mono">exp {m.expiry}</span>}
                    </div>
                    <div className="mt-1.5 text-[9px] text-slate-600">Added {timeAgo(m.addedAt)} · token {m.token.slice(0, 12)}…</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
};

export default Screen8_Billing;
