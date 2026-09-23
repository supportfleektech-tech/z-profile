import React, { useMemo, useState } from 'react';
import {
  Wallet as WalletIcon, Smartphone, CreditCard, Download, FileText, Plus, Loader2, CheckCircle2,
  XCircle, AlertTriangle, ArrowUpRight, ArrowDownLeft, Settings2, Zap, ShieldCheck, Info,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import {
  Badge, Button, Callout, EmptyState, Field, Modal, Panel, ProgressBar, ResponsiveTable,
  SegmentedControl, Select, Tabs, TextInput, Toggle, type Column,
} from '../ui';
import { MpesaLogo } from '../common/ProviderLogos';
import { buildWalletStatementPdf } from '../../lib/reports';
import { cardBrand, downloadBlob, downloadText, formatDate, KES, luhn, maskCard, normalizeMsisdn, timeAgo, toCsv } from '../../lib/format';
import { getSnapshot } from '../../services/db';
import type { WalletTransaction } from '../../types';

const TABS = ['Overview', 'Top up', 'Ledger', 'Settings'] as const;
type Tab = (typeof TABS)[number];
type Method = 'mpesa' | 'card';

const txTone = (t: WalletTransaction): 'success' | 'warning' | 'danger' | 'neutral' | 'info' =>
  t.status === 'success' ? 'success' : t.status === 'failed' || t.status === 'timeout' ? 'danger' : t.status === 'pending' || t.status === 'processing' ? 'warning' : t.status === 'refunded' ? 'info' : 'neutral';

/**
 * Wallet & Top Up.
 *
 * M-PESA follows the real Daraja STK Push choreography: dispatch → CheckoutRequestID →
 * wait for the handset → ResultCode. Card follows authorise → 3-D Secure OTP → settle.
 * Both paths write to the payment ledger the admin Payments Monitor reads.
 */
export const WalletScreen: React.FC = () => {
  const {
    wallet, myTransactions, settings, pushToast, topUpMpesa, awaitMpesaTopUp, cancelMpesaTopUp,
    startCardTopUp, confirmCardTopUp, updateWalletSettings, can, currentUser, payments,
  } = useAppData();

  const [tab, setTab] = useState<Tab>('Overview');
  const [method, setMethod] = useState<Method>('mpesa');
  const [amount, setAmount] = useState(5000);
  const [phone, setPhone] = useState(currentUser?.phone ?? '');
  const [card, setCard] = useState({ number: '', expiry: '', cvc: '', holder: currentUser?.name ?? '' });
  const [stage, setStage] = useState<'idle' | 'dispatching' | 'awaiting' | 'settled' | 'failed'>('idle');
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [intent, setIntent] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [result, setResult] = useState<{ ok: boolean; message: string; ref?: string } | null>(null);
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [statementOpen, setStatementOpen] = useState(false);
  const [statementDays, setStatementDays] = useState(30);

  const billing = settings.billing;
  const brand = cardBrand(card.number.replace(/\s/g, ''));
  const cardValid = luhn(card.number.replace(/\s/g, '')) && /^\d{2}\/\d{2}$/.test(card.expiry) && /^\d{3,4}$/.test(card.cvc) && card.holder.trim().length > 2;
  const methods = useMemo(() => getSnapshot().paymentMethods.filter((m) => m.userId === wallet.userId), [wallet.userId, myTransactions.length]);

  const filteredTx = useMemo(
    () => (ledgerFilter === 'all' ? myTransactions : myTransactions.filter((t) => t.direction === ledgerFilter)),
    [myTransactions, ledgerFilter]
  );

  const myPayments = useMemo(() => payments.filter((p) => p.userId === wallet.userId), [payments, wallet.userId]);

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
    {
      key: 'direction',
      header: '',
      render: (t) =>
        t.direction === 'credit' ? <ArrowDownLeft size={13} className="text-emerald-400" /> : <ArrowUpRight size={13} className="text-rose-400" />,
      align: 'center',
      sortValue: (t) => t.direction,
    },
    { key: 'kind', header: 'Type', render: (t) => <Badge tone="neutral">{t.kind}</Badge>, sortValue: (t) => t.kind },
    { key: 'channel', header: 'Channel', render: (t) => <span className="text-[10px] text-slate-400 uppercase">{t.channel}</span>, className: 'hidden sm:table-cell', sortValue: (t) => t.channel },
    { key: 'ref', header: 'Reference', render: (t) => <span className="font-mono text-[10px] text-cyan-300 break-all">{t.reference}</span>, className: 'hidden lg:table-cell' },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (t) => (
        <span className={`font-mono text-[11px] font-bold ${t.direction === 'credit' ? 'text-emerald-300' : 'text-slate-100'}`}>
          {t.direction === 'credit' ? '+' : '−'}{KES(t.amount, { decimals: false })}
        </span>
      ),
      sortValue: (t) => (t.direction === 'credit' ? t.amount : -t.amount),
    },
    { key: 'balance', header: 'Balance', align: 'right', render: (t) => <span className="font-mono text-[10px] text-slate-500">{KES(t.balanceAfter, { decimals: false })}</span>, className: 'hidden xl:table-cell', sortValue: (t) => t.balanceAfter },
    { key: 'status', header: 'Status', render: (t) => <Badge tone={txTone(t)} dot>{t.status}</Badge>, sortValue: (t) => t.status },
  ];

  /* ------------------------------- M-PESA flow ------------------------------- */

  const sendStk = async () => {
    setResult(null);
    const msisdn = normalizeMsisdn(phone);
    if (!msisdn) {
      setResult({ ok: false, message: 'Enter a valid Safaricom number, e.g. 0712 345 678.' });
      return;
    }
    if (amount < billing.walletMinTopUpKes || amount > billing.walletMaxTopUpKes) {
      setResult({ ok: false, message: `Amount must be between ${KES(billing.walletMinTopUpKes, { decimals: false })} and ${KES(billing.walletMaxTopUpKes, { decimals: false })}.` });
      return;
    }
    setStage('dispatching');
    const res = await topUpMpesa({ phone: msisdn, amount });
    if (!res.ok || !res.checkoutRequestID) {
      setStage('failed');
      setResult({ ok: false, message: res.message ?? 'STK push could not be dispatched.' });
      return;
    }
    setCheckoutId(res.checkoutRequestID);
    setStage('awaiting');
    const outcome = await awaitMpesaTopUp(res.checkoutRequestID);
    setStage(outcome.ok ? 'settled' : 'failed');
    setResult({ ok: outcome.ok, message: outcome.message, ref: outcome.payment?.reference });
    setCheckoutId(null);
  };

  /* -------------------------------- card flow -------------------------------- */

  const authoriseCard = async () => {
    setResult(null);
    setStage('dispatching');
    const res = await startCardTopUp({ amount, cardNumber: card.number, expiry: card.expiry, cvc: card.cvc, holder: card.holder });
    if (!res.ok || !res.paymentIntentId) {
      setStage('failed');
      setResult({ ok: false, message: res.message ?? 'Card could not be authorised.' });
      return;
    }
    setIntent(res.paymentIntentId);
    setStage('awaiting');
    setOtp('');
  };

  const confirmCard = async () => {
    if (!intent) return;
    setStage('dispatching');
    const res = await confirmCardTopUp({ paymentIntentId: intent, otp, amount, cardNumber: card.number, holder: card.holder, expiry: card.expiry });
    setStage(res.ok ? 'settled' : 'failed');
    setResult({ ok: res.ok, message: res.message, ref: res.payment?.reference });
    if (res.ok) setIntent(null);
  };

  const reset = () => {
    setStage('idle');
    setResult(null);
    setCheckoutId(null);
    setIntent(null);
    setOtp('');
  };

  const downloadStatement = (days: number) => {
    const cutoff = Date.now() - days * 864e5;
    const rows = myTransactions.filter((t) => new Date(t.at).getTime() >= cutoff);
    const doc = buildWalletStatementPdf(wallet, rows, currentUser?.name ?? 'Account holder', settings, `Last ${days} days`);
    downloadBlob(doc.toBlob(), `IPRS_Wallet_Statement_${days}d.pdf`);
    pushToast({ title: 'Statement downloaded', description: `${rows.length} transactions over ${days} days`, type: 'success' });
    setStatementOpen(false);
  };

  const lowBalance = wallet.balance <= wallet.lowBalanceAlertKes;

  return (
    <div className="w-full text-xs text-slate-200">
      {/* ------------------------------ header ------------------------------ */}
      <div className="px-3 sm:px-4 py-3 bg-gradient-to-r from-[#06231f] via-[#08172b] to-[#071120] border-b border-sky-900/50 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <WalletIcon size={18} className="text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-white">Prepaid wallet</h2>
            <p className="text-[10px] text-slate-500 truncate font-mono">
              {wallet.id} · {wallet.currency} · updated {timeAgo(wallet.updatedAt)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:max-w-[560px] lg:flex-1">
          {[
            { label: 'Available', value: KES(wallet.balance, { decimals: false }), tone: 'text-emerald-300' },
            { label: 'Held', value: KES(wallet.held, { decimals: false }), tone: 'text-amber-300' },
            { label: 'Lifetime top-up', value: KES(wallet.lifetimeTopUp, { decimals: false }), tone: 'text-slate-100' },
            { label: 'Lifetime spend', value: KES(wallet.lifetimeSpend, { decimals: false }), tone: 'text-slate-100' },
          ].map((k) => (
            <div key={k.label} className="rounded-lg bg-[#050b14]/70 border border-emerald-900/30 px-2.5 py-1.5 min-w-0">
              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold truncate">{k.label}</div>
              <div className={`text-sm font-black font-mono truncate ${k.tone}`}>{k.value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" icon={<FileText size={12} />} onClick={() => setStatementOpen(true)}>Statement</Button>
          <Button size="sm" variant="primary" icon={<Plus size={12} />} onClick={() => { setTab('Top up'); reset(); }} disabled={!can('wallet.topup')}>Top up</Button>
        </div>
      </div>

      {lowBalance && (
        <div className="px-3 sm:px-4 pt-3">
          <Callout tone="warning" title="Low balance" icon={<AlertTriangle size={14} />}>
            Your balance is at {KES(wallet.balance)} — at or below your {KES(wallet.lowBalanceAlertKes, { decimals: false })} alert threshold.
            {settings.billing.blockSearchOnNegativeBalance && ' Searches are blocked when the wallet goes negative.'}{' '}
            {wallet.autoTopUp ? `Auto top-up will add ${KES(wallet.autoTopUpAmountKes, { decimals: false })} below ${KES(wallet.autoTopUpTriggerKes, { decimals: false })}.` : ''}
          </Callout>
        </div>
      )}

      <div className="px-2 sm:px-4 pt-3">
        <Tabs tabs={TABS} active={tab} onChange={(t) => setTab(t as Tab)} badges={{ Ledger: myTransactions.length }} />
      </div>

      <div className="p-2 sm:p-4 space-y-4">
        {/* ============================== OVERVIEW ============================== */}
        {tab === 'Overview' && (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Balance position" icon={<WalletIcon size={14} className="text-emerald-400" />} className="lg:col-span-2">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="shrink-0">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Available to spend</div>
                    <div className="text-3xl font-black text-emerald-300 font-mono">{KES(wallet.balance)}</div>
                    <div className="mt-1 text-[10px] text-slate-500">
                      {wallet.held > 0 ? `${KES(wallet.held, { decimals: false })} reserved for in-flight searches` : 'No funds reserved'}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone={wallet.autoTopUp ? 'success' : 'neutral'} dot>Auto top-up {wallet.autoTopUp ? 'on' : 'off'}</Badge>
                      <Badge tone={wallet.overdraftAllowed ? 'warning' : 'neutral'}>Overdraft {wallet.overdraftAllowed ? 'allowed' : 'blocked'}</Badge>
                      <Badge tone="info">Alert at {KES(wallet.lowBalanceAlertKes, { decimals: false })}</Badge>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 space-y-2.5">
                    <ProgressBar value={wallet.balance} max={Math.max(1, wallet.lifetimeTopUp)} label="Balance vs lifetime top-ups" right={`${Math.round((wallet.balance / Math.max(1, wallet.lifetimeTopUp)) * 100)}%`} warning={0.2} danger={0.1} />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-[#061020] border border-sky-900/50 px-2.5 py-2">
                        <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Searches affordable</div>
                        <div className="text-sm font-black text-white font-mono">{Math.floor(wallet.balance / Math.max(1, settings.billing.walletMinTopUpKes / 10))}</div>
                        <div className="text-[9px] text-slate-600">at the cheapest bundle rate</div>
                      </div>
                      <div className="rounded-lg bg-[#061020] border border-sky-900/50 px-2.5 py-2">
                        <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Payments on record</div>
                        <div className="text-sm font-black text-white font-mono">{myPayments.length}</div>
                        <div className="text-[9px] text-slate-600">{myPayments.filter((p) => p.status === 'success').length} successful</div>
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel title="Accepted channels" icon={<Zap size={14} className="text-cyan-400" />}>
                <div className="space-y-2">
                  <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-2.5 flex items-start gap-2.5">
                    <MpesaLogo size={22} />
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-white">M-PESA STK Push</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {billing.mpesaPaybill ? 'Paybill' : 'Till'} {billing.mpesaShortcode}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {KES(billing.walletMinTopUpKes, { decimals: false })} – {KES(billing.walletMaxTopUpKes, { decimals: false })} · settles in ~10s
                      </div>
                    </div>
                  </div>
                  <div className={`rounded-lg border p-2.5 ${billing.cardGateway === 'none' ? 'border-slate-800 bg-[#061020] opacity-60' : 'border-sky-900/50 bg-[#061020]'}`}>
                    <div className="flex items-start gap-2.5">
                      <CreditCard size={20} className="text-cyan-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-white">Card — {billing.cardGateway === 'none' ? 'disabled' : billing.cardGateway}</div>
                        <div className="text-[10px] text-slate-500">Visa · Mastercard · Amex · 3-D Secure enforced · 2.9% fee</div>
                      </div>
                    </div>
                  </div>
                  {billing.cardGateway === 'none' && (
                    <Callout tone="warning" title="Card gateway disabled">
                      An administrator has turned the card gateway off in billing settings. M-PESA remains available.
                    </Callout>
                  )}
                  <div className="rounded-lg border border-sky-900/50 bg-[#061020] p-2.5">
                    <div className="text-[10px] font-bold text-slate-300 flex items-center gap-1"><ShieldCheck size={11} className="text-emerald-400" /> Saved methods</div>
                    {methods.length === 0 ? (
                      <p className="text-[10px] text-slate-600 mt-1">None saved yet — a method is stored after your first successful top-up.</p>
                    ) : (
                      <div className="mt-1 space-y-1">
                        {methods.map((m) => (
                          <div key={m.id} className="flex items-center gap-2 text-[10px]">
                            <Badge tone={m.status === 'active' ? 'success' : 'neutral'}>{m.channel}</Badge>
                            <span className="text-slate-400 truncate">{m.label}</span>
                            <span className="font-mono text-slate-500 ml-auto shrink-0">{m.display}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Panel>
            </div>

            <Panel title="Recent activity" icon={<ArrowUpRight size={14} className="text-cyan-400" />} actions={<Button size="xs" variant="ghost" onClick={() => setTab('Ledger')}>View full ledger</Button>}>
              {myTransactions.length === 0 ? (
                <EmptyState title="No wallet activity" description="Top up your wallet to run your first verification." />
              ) : (
                <ResponsiveTable columns={txCols} rows={myTransactions.slice(0, 8)} rowKey={(t) => t.id} dense initialSort={{ key: 'at', dir: 'desc' }} />
              )}
            </Panel>
          </>
        )}

        {/* =============================== TOP UP =============================== */}
        {tab === 'Top up' && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Panel
              title="Add funds"
              subtitle={`Minimum ${KES(billing.walletMinTopUpKes, { decimals: false })} · maximum ${KES(billing.walletMaxTopUpKes, { decimals: false })}`}
              icon={<Plus size={14} className="text-emerald-400" />}
            >
              {!can('wallet.topup') ? (
                <Callout tone="danger" title="Not permitted">Your role cannot top up a wallet. Ask an administrator.</Callout>
              ) : stage === 'idle' || stage === 'failed' ? (
                <div className="space-y-4">
                  <SegmentedControl
                    value={method}
                    onChange={(v) => setMethod(v as Method)}
                    options={[
                      { value: 'mpesa', label: 'M-PESA' },
                      { value: 'card', label: `Card${billing.cardGateway === 'none' ? ' (disabled)' : ''}` },
                    ]}
                  />

                  <Field label="Amount (KES)">
                    <TextInput type="number" min={billing.walletMinTopUpKes} max={billing.walletMaxTopUpKes} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))} className="font-mono text-base" />
                  </Field>
                  <div className="flex flex-wrap gap-1.5">
                    {[1000, 2500, 5000, 10000, 25000, 50000].map((v) => (
                      <button key={v} onClick={() => setAmount(v)} className={`px-2.5 py-1 rounded-lg border font-mono text-[10px] transition-colors ${amount === v ? 'border-emerald-600/70 bg-emerald-950/40 text-emerald-200' : 'border-sky-900/60 bg-[#061020] text-slate-400 hover:text-white'}`}>
                        {KES(v, { decimals: false })}
                      </button>
                    ))}
                  </div>

                  {method === 'mpesa' ? (
                    <div className="space-y-3">
                      <Field label="Safaricom number" hint="The STK prompt is pushed to this handset" required>
                        <div className="relative">
                          <Smartphone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" className="pl-9 font-mono" inputMode="tel" />
                        </div>
                      </Field>
                      <div className="rounded-lg border border-sky-900/50 bg-[#061020] p-2.5 text-[10px] text-slate-400 leading-relaxed">
                        <strong className="text-slate-200">How it works:</strong> we request a Daraja token, push an STK prompt to your
                        handset and wait for the callback. You enter your M-PESA PIN on the phone — we never see it. The wallet is
                        credited only on <code className="font-mono text-emerald-400">ResultCode 0</code>.
                      </div>
                      <Button variant="primary" className="w-full justify-center py-2.5" icon={<Zap size={14} />} disabled={amount < billing.walletMinTopUpKes} onClick={sendStk}>
                        Send STK push · {KES(amount, { decimals: false })}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {billing.cardGateway === 'none' ? (
                        <Callout tone="warning" title="Card gateway disabled">Switch to M-PESA or ask an administrator to enable a card gateway.</Callout>
                      ) : (
                        <>
                          <Field label="Card number" required error={card.number && !luhn(card.number.replace(/\s/g, '')) ? 'Failed the Luhn check' : null}>
                            <div className="relative">
                              <CreditCard size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                              <TextInput
                                value={card.number}
                                onChange={(e) => setCard({ ...card, number: e.target.value.replace(/[^\d ]/g, '').slice(0, 23) })}
                                placeholder="4242 4242 4242 4242"
                                className="pl-9 pr-20 font-mono"
                                inputMode="numeric"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-cyan-400">{brand !== 'Unknown' ? brand : ''}</span>
                            </div>
                          </Field>
                          <div className="grid grid-cols-2 gap-2">
                            <Field label="Expiry (MM/YY)" required>
                              <TextInput value={card.expiry} onChange={(e) => {
                                let v = e.target.value.replace(/\D/g, '').slice(0, 4);
                                if (v.length > 2) v = `${v.slice(0, 2)}/${v.slice(2)}`;
                                setCard({ ...card, expiry: v });
                              }} placeholder="09/28" className="font-mono" inputMode="numeric" />
                            </Field>
                            <Field label="CVC" required>
                              <TextInput value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="123" className="font-mono" type="password" inputMode="numeric" />
                            </Field>
                          </div>
                          <Field label="Cardholder name" required>
                            <TextInput value={card.holder} onChange={(e) => setCard({ ...card, holder: e.target.value })} placeholder="JOHN M KAMAU" />
                          </Field>
                          <div className="rounded-lg border border-sky-900/50 bg-[#061020] p-2.5 text-[10px] text-slate-400 leading-relaxed">
                            A 2.9% processing fee applies ({KES(Math.round(amount * 0.029), { decimals: false })}). Your bank will send a
                            3-D Secure code — enter <code className="font-mono text-emerald-400">123456</code> to approve, or{' '}
                            <code className="font-mono text-rose-400">000000</code> to see the decline path.
                          </div>
                          <Button variant="primary" className="w-full justify-center py-2.5" icon={<CreditCard size={14} />} disabled={!cardValid} onClick={authoriseCard}>
                            Authorise {KES(amount + Math.round(amount * 0.029), { decimals: false })}
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {result && !result.ok && (
                    <div className="rounded-xl border border-rose-800/50 bg-rose-950/25 p-3">
                      <div className="flex items-center gap-2">
                        <XCircle size={16} className="text-rose-400 shrink-0" />
                        <span className="text-[11px] font-bold text-rose-200">Not completed</span>
                      </div>
                      <p className="text-[11px] text-rose-200/80 mt-1 leading-relaxed">{result.message}</p>
                      <Button variant="ghost" size="xs" className="mt-2" onClick={reset}>Dismiss</Button>
                    </div>
                  )}
                </div>
              ) : (
                /* ---- in-flight / settled ---- */
                <div className="space-y-3">
                  {(stage === 'dispatching' || stage === 'awaiting') && (
                    <div className="rounded-xl border border-cyan-800/50 bg-cyan-950/25 p-4 text-center">
                      <Loader2 size={26} className="text-cyan-300 animate-spin mx-auto" />
                      <div className="mt-2 text-sm font-bold text-white">
                        {stage === 'dispatching' ? (method === 'mpesa' ? 'Requesting Daraja token…' : 'Authorising with the acquirer…') : method === 'mpesa' ? 'Waiting for your handset' : '3-D Secure challenge'}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        {method === 'mpesa'
                          ? `An STK prompt was pushed to ${normalizeMsisdn(phone) ?? phone}. Enter your M-PESA PIN to approve ${KES(amount, { decimals: false })}.`
                          : `Enter the one-time code your bank sent to the registered mobile number.`}
                      </p>
                      {checkoutId && <p className="mt-2 font-mono text-[10px] text-cyan-400/80 break-all">CheckoutRequestID: {checkoutId}</p>}
                      {intent && <p className="mt-2 font-mono text-[10px] text-cyan-400/80 break-all">PaymentIntent: {intent}</p>}
                    </div>
                  )}

                  {method === 'card' && stage === 'awaiting' && intent && (
                    <div className="space-y-3">
                      <Field label="One-time passcode" required hint="6 digits from your bank">
                        <TextInput value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" className="font-mono text-center text-lg tracking-[0.4em]" inputMode="numeric" autoFocus />
                      </Field>
                      <div className="flex gap-2">
                        <Button variant="primary" className="flex-1 justify-center" disabled={otp.length !== 6} onClick={confirmCard} icon={<ShieldCheck size={13} />}>Confirm payment</Button>
                        <Button variant="ghost" onClick={reset}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  {method === 'mpesa' && stage === 'awaiting' && (
                    <Button variant="ghost" className="w-full justify-center" onClick={() => { if (checkoutId) cancelMpesaTopUp(checkoutId); reset(); pushToast({ title: 'STK push cancelled', description: 'No funds were moved', type: 'info' }); }}>
                      Cancel — I did not receive the prompt
                    </Button>
                  )}

                  {stage === 'settled' && result && (
                    <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/25 p-4 text-center">
                      <CheckCircle2 size={30} className="text-emerald-400 mx-auto" />
                      <div className="mt-2 text-sm font-bold text-white">Wallet credited</div>
                      <p className="text-[11px] text-emerald-200/80 mt-1">{result.message}</p>
                      {result.ref && <p className="mt-1.5 font-mono text-[10px] text-emerald-400/80">Receipt: {result.ref}</p>}
                      <div className="mt-3 text-2xl font-black text-emerald-300 font-mono">{KES(wallet.balance)}</div>
                      <div className="text-[10px] text-slate-500">new available balance</div>
                      <div className="mt-3 flex flex-wrap gap-2 justify-center">
                        <Button variant="secondary" size="sm" onClick={reset}>Another top-up</Button>
                        <Button variant="primary" size="sm" onClick={() => setTab('Ledger')}>View ledger</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Panel>

            <div className="space-y-4">
              <Panel title="Daraja result codes" icon={<Info size={14} className="text-cyan-400" />}>
                <div className="space-y-1.5">
                  {[
                    ['0', 'Accepted — wallet credited', 'success'],
                    ['1032', 'Cancelled by the customer on the handset', 'warning'],
                    ['1037', 'Timed out — no PIN entered', 'warning'],
                    ['2001', 'Insufficient M-PESA balance', 'danger'],
                    ['1001', 'Failed to charge — generic decline', 'danger'],
                  ].map(([code, text, tone]) => (
                    <div key={code} className="flex items-start gap-2 text-[10px]">
                      <span className={`shrink-0 px-1.5 py-0.5 rounded font-mono font-bold ${tone === 'success' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50' : tone === 'warning' ? 'bg-amber-950/60 text-amber-300 border border-amber-800/50' : 'bg-rose-950/60 text-rose-300 border border-rose-800/50'}`}>{code}</span>
                      <span className="text-slate-400 leading-snug">{text}</span>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Test cards" icon={<CreditCard size={14} className="text-cyan-400" />}>
                <div className="space-y-1.5 text-[10px] font-mono">
                  {[
                    ['4242 4242 4242 4242', 'Visa · approves'],
                    ['5555 5555 5555 4444', 'Mastercard · approves'],
                    ['4000 0000 0000 0002', 'Visa · declined by issuer'],
                  ].map(([n, d]) => (
                    <button key={n} onClick={() => setCard({ ...card, number: n, expiry: '09/28', cvc: '123' })} className="w-full flex items-center justify-between gap-2 rounded-lg border border-sky-900/50 bg-[#061020] px-2 py-1.5 hover:border-cyan-800/60 text-left">
                      <span className="text-slate-300">{n}</span>
                      <span className="text-slate-600 text-[9px] shrink-0">{d}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-600">Any future expiry and any 3-digit CVC. OTP <span className="font-mono text-emerald-400">123456</span> approves; <span className="font-mono text-rose-400">000000</span> declines.</p>
              </Panel>

              {card.number && (
                <Panel title="Card preview" icon={<CreditCard size={14} className="text-cyan-400" />}>
                  <div className="rounded-xl bg-gradient-to-br from-[#0b2438] to-[#071120] border border-sky-800/60 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-cyan-300">{brand}</span>
                      <WalletIcon size={16} className="text-slate-500" />
                    </div>
                    <div className="mt-3 font-mono text-sm text-white tracking-widest">{maskCard(card.number.replace(/\s/g, '')) || '•••• •••• •••• ••••'}</div>
                    <div className="mt-2 flex items-end justify-between text-[9px] text-slate-400">
                      <span className="uppercase truncate">{card.holder || 'CARDHOLDER NAME'}</span>
                      <span className="font-mono">{card.expiry || 'MM/YY'}</span>
                    </div>
                  </div>
                </Panel>
              )}
            </div>
          </div>
        )}

        {/* =============================== LEDGER =============================== */}
        {tab === 'Ledger' && (
          <Panel
            title="Wallet ledger"
            subtitle={`${filteredTx.length} transaction(s)`}
            icon={<ArrowDownLeft size={14} className="text-emerald-400" />}
            actions={
              <div className="flex flex-wrap items-center gap-1.5">
                <SegmentedControl size="sm" value={ledgerFilter} onChange={(v) => setLedgerFilter(v as typeof ledgerFilter)} options={[{ value: 'all', label: 'All' }, { value: 'credit', label: 'Credits' }, { value: 'debit', label: 'Debits' }]} />
                <Button size="xs" variant="secondary" icon={<Download size={11} />} onClick={() => { downloadText(toCsv(filteredTx.map((t) => ({ ...t })) as unknown as Record<string, unknown>[]), 'wallet_ledger.csv', 'text/csv;charset=utf-8'); pushToast({ title: 'Ledger exported', type: 'success' }); }}>CSV</Button>
                <Button size="xs" variant="secondary" icon={<FileText size={11} />} onClick={() => setStatementOpen(true)}>PDF</Button>
              </div>
            }
          >
            <ResponsiveTable columns={txCols} rows={filteredTx} rowKey={(t) => t.id} dense initialSort={{ key: 'at', dir: 'desc' }} maxHeight="560px" emptyTitle="No transactions" emptyDescription="Top up your wallet to see entries here." />
          </Panel>
        )}

        {/* ============================== SETTINGS ============================== */}
        {tab === 'Settings' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Auto top-up" icon={<Settings2 size={14} className="text-cyan-400" />}>
              <div className="space-y-3">
                <Toggle checked={wallet.autoTopUp} onChange={(v) => updateWalletSettings({ autoTopUp: v })} label="Top up automatically" description="Charges your default method when the balance falls below the trigger" />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Trigger below (KES)"><TextInput type="number" value={wallet.autoTopUpTriggerKes} disabled={!wallet.autoTopUp} className="font-mono" onChange={(e) => updateWalletSettings({ autoTopUpTriggerKes: Number(e.target.value) })} /></Field>
                  <Field label="Top-up amount (KES)"><TextInput type="number" value={wallet.autoTopUpAmountKes} disabled={!wallet.autoTopUp} className="font-mono" onChange={(e) => updateWalletSettings({ autoTopUpAmountKes: Number(e.target.value) })} /></Field>
                </div>
                {!billing.autoTopUpEnabled && <Callout tone="warning" title="Disabled platform-wide">An administrator has turned auto top-up off in billing settings.</Callout>}
              </div>
            </Panel>

            <Panel title="Alerts & limits" icon={<AlertTriangle size={14} className="text-amber-400" />}>
              <div className="space-y-3">
                <Field label="Low balance alert (KES)"><TextInput type="number" value={wallet.lowBalanceAlertKes} className="font-mono" onChange={(e) => updateWalletSettings({ lowBalanceAlertKes: Number(e.target.value) })} /></Field>
                <Toggle checked={wallet.overdraftAllowed} onChange={(v) => updateWalletSettings({ overdraftAllowed: v })} label="Allow overdraft" description="Lets a search complete even if the balance goes negative" />
                <div className="rounded-lg border border-sky-900/50 bg-[#061020] p-2.5 text-[10px] text-slate-400 space-y-1">
                  <div className="flex justify-between"><span>Platform minimum top-up</span><span className="font-mono text-slate-200">{KES(billing.walletMinTopUpKes, { decimals: false })}</span></div>
                  <div className="flex justify-between"><span>Platform maximum top-up</span><span className="font-mono text-slate-200">{KES(billing.walletMaxTopUpKes, { decimals: false })}</span></div>
                  <div className="flex justify-between"><span>Block searches on negative balance</span><span className="font-mono text-slate-200">{billing.blockSearchOnNegativeBalance ? 'Yes' : 'No'}</span></div>
                  <div className="flex justify-between"><span>Currency</span><span className="font-mono text-slate-200">{wallet.currency}</span></div>
                </div>
              </div>
            </Panel>

            <Panel title="Payment attempts" subtitle="Gateway-side records for your account" icon={<CreditCard size={14} className="text-cyan-400" />} className="lg:col-span-2">
              {myPayments.length === 0 ? (
                <EmptyState title="No payment attempts yet" />
              ) : (
                <ResponsiveTable
                  dense
                  rowKey={(p) => p.id}
                  rows={myPayments}
                  initialSort={{ key: 'at', dir: 'desc' }}
                  columns={[
                    { key: 'at', header: 'When', mobilePrimary: true, render: (p) => <span className="font-mono text-[10px]">{formatDate(p.at, true)}</span>, sortValue: (p) => p.at },
                    { key: 'channel', header: 'Channel', render: (p) => <Badge tone={p.channel === 'mpesa' ? 'success' : 'info'}>{p.channel}</Badge>, sortValue: (p) => p.channel },
                    { key: 'method', header: 'Method', render: (p) => <span className="text-[10px] text-slate-400">{p.method}</span> },
                    { key: 'ref', header: 'Reference', render: (p) => <span className="font-mono text-[10px] text-cyan-300">{p.reference}</span>, className: 'hidden sm:table-cell' },
                    { key: 'gateway', header: 'Gateway', render: (p) => <span className="text-[10px] text-slate-500">{p.gateway}</span>, className: 'hidden lg:table-cell' },
                    { key: 'amount', header: 'Amount', align: 'right', render: (p) => <span className="font-mono text-[11px]">{KES(p.amount, { decimals: false })}</span>, sortValue: (p) => p.amount },
                    { key: 'fee', header: 'Fee', align: 'right', render: (p) => <span className="font-mono text-[10px] text-slate-500">{KES(p.feeKes, { decimals: false })}</span>, className: 'hidden xl:table-cell', sortValue: (p) => p.feeKes },
                    { key: 'status', header: 'Status', render: (p) => <Badge tone={p.status === 'success' ? 'success' : p.status === 'failed' ? 'danger' : p.status === 'pending' ? 'warning' : 'neutral'} dot>{p.status}</Badge>, sortValue: (p) => p.status },
                    { key: 'reason', header: 'Failure reason', render: (p) => <span className="text-[10px] text-rose-300 line-clamp-1">{p.failureReason ?? '—'}</span>, className: 'hidden lg:table-cell' },
                  ]}
                />
              )}
            </Panel>
          </div>
        )}
      </div>

      <Modal
        open={statementOpen}
        onClose={() => setStatementOpen(false)}
        title={<span className="flex items-center gap-2"><FileText size={15} className="text-cyan-400" /> Wallet statement</span>}
        subtitle="Period selection for the PDF statement"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setStatementOpen(false)}>Cancel</Button>
            <Button variant="primary" icon={<Download size={13} />} onClick={() => downloadStatement(statementDays)}>Generate PDF</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Period">
            <Select value={String(statementDays)} onChange={(e) => setStatementDays(Number(e.target.value))} options={[{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }, { value: '365', label: 'Last 12 months' }]} />
          </Field>
          <div className="rounded-lg border border-sky-900/50 bg-[#061020] p-2.5 text-[11px] text-slate-400">
            {myTransactions.filter((t) => new Date(t.at).getTime() >= Date.now() - statementDays * 864e5).length} transaction(s) will be included, with opening and closing balances.
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default WalletScreen;
