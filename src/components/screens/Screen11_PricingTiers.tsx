import React, { useMemo, useState } from 'react';
import {
  Layers, Download, Calculator, Info, CheckCircle2, FileText, Save, RotateCcw, AlertTriangle,
  Scale, Coins, ArrowRight, Pencil,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { useAppRouter } from '../../context/RouterContext';
import { Badge, Button, Callout, Field, Modal, Panel, ResponsiveTable, SegmentedControl, Tabs, TextInput, Toggle, type Column } from '../ui';
import { buildPricingSchedulePdf } from '../../lib/reports';
import { downloadBlob, downloadText, KES, toCsv } from '../../lib/format';
import { kycItems, kybItems, pricingProvenance } from '../../data/pricing';
import type { PricedItem, PricingBundle } from '../../types';

const TABS = ['Price list', 'Bundles', 'Calculator', 'Terms'] as const;
type Tab = (typeof TABS)[number];

/**
 * Pricing & Tiers — KYC / KYB Financial Proposal 2026, batch 0–500 only.
 *
 * Every rate on this screen, in the wallet debit, in the search cost estimate and in the
 * PDF schedule is read from `src/data/pricing.ts`. Higher volume bands are deliberately
 * excluded per the agreed scope.
 */
export const Screen11_PricingTiers: React.FC = () => {
  const { pricing, can, updatePricing, settings, pushToast, subscriptionPlans, currentPlan, setCurrentPlan, billingPeriod, setBillingPeriod } = useAppData();
  const prov = pricingProvenance(pricing);
  const { navigate } = useAppRouter();
  const [tab, setTab] = useState<Tab>('Price list');
  const [filter, setFilter] = useState<'all' | 'kyc' | 'kyb'>('all');
  /** Field-level rate adjustments: unit / overage / backup / per-page / included quota. */
  type RateDraft = { unit?: number; overage?: number; backup?: number | null; perPage?: number | null; included?: number };
  const [draft, setDraft] = useState<Record<string, RateDraft>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bundleDraft, setBundleDraft] = useState<Record<string, number>>({});
  const [volumes, setVolumes] = useState<Record<string, number>>({ 'kyc-id': 250, 'kyc-kra': 250, 'kyc-mpesa': 250 });

  const canEdit = can('pricing.edit');
  const items = useMemo(() => (filter === 'all' ? pricing.items : filter === 'kyc' ? kycItems() : kybItems()), [filter, pricing.items]);

  /** Every field currently changed, counted across the table and the drawer. */
  const pendingEdits = pricing.items.flatMap((i) => {
    const d = draft[i.id];
    if (!d) return [] as string[];
    const out: string[] = [];
    if (d.unit !== undefined && d.unit !== i.unitPriceKes) out.push(`${i.id}.unit`);
    if (d.overage !== undefined && d.overage !== i.overageRateKes) out.push(`${i.id}.overage`);
    if (d.backup !== undefined && (d.backup === null ? i.backupRateKes !== undefined : d.backup !== i.backupRateKes)) out.push(`${i.id}.backup`);
    if (d.perPage !== undefined && (d.perPage === null ? i.perPageKes !== undefined : d.perPage !== i.perPageKes)) out.push(`${i.id}.perPage`);
    if (d.included !== undefined && d.included !== i.includedInBatch) out.push(`${i.id}.included`);
    return out;
  });
  const pendingBundleEdits = Object.entries(bundleDraft).filter(([id, v]) => pricing.bundles.find((b) => b.id === id)?.priceKes !== v);
  const editing = editingId ? pricing.items.find((i) => i.id === editingId) ?? null : null;
  const editingDraft = editingId ? draft[editingId] ?? {} : {};

  const applyDraft = (id: string, patch: RateDraft) => setDraft((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const itemCols: Column<PricedItem>[] = [
    {
      key: 'name',
      header: 'Line item',
      mobilePrimary: true,
      render: (i) => (
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-white truncate">{i.name}</div>
          <div className="text-[10px] text-slate-500 line-clamp-2">{i.description}</div>
        </div>
      ),
      sortValue: (i) => i.name,
    },
    { key: 'type', header: 'Type', render: (i) => <Badge tone={i.type === 'kyc' ? 'info' : 'accent'}>{i.type.toUpperCase()}</Badge>, sortValue: (i) => i.type },
    { key: 'source', header: 'Source', render: (i) => <span className="text-[10px] text-slate-400">{i.source}</span>, className: 'hidden lg:table-cell', sortValue: (i) => i.source },
    {
      key: 'price',
      header: canEdit ? 'Unit price (KES)' : 'Unit price',
      align: 'right',
      sortValue: (i) => i.unitPriceKes,
      render: (i) =>
        canEdit ? (
          <TextInput
            type="number"
            value={draft[i.id]?.unit ?? i.unitPriceKes}
            className="w-24 text-right font-mono py-1"
            onChange={(e) => applyDraft(i.id, { unit: Number(e.target.value) })}
          />
        ) : (
          <span className="font-mono text-emerald-300 font-semibold">{KES(i.unitPriceKes, { decimals: false })}</span>
        ),
      renderMobile: (i) => <span className="font-mono text-emerald-300 font-semibold">{KES(i.unitPriceKes, { decimals: false })}</span>,
    },
    { key: 'included', header: 'Included in batch', align: 'right', render: (i) => <span className="font-mono text-[11px]">{i.includedInBatch.toLocaleString('en-KE')}</span>, className: 'hidden sm:table-cell', sortValue: (i) => i.includedInBatch },
    {
      key: 'overage',
      header: canEdit ? 'Overage (KES)' : 'Overage rate',
      align: 'right',
      sortValue: (i) => i.overageRateKes,
      render: (i) =>
        canEdit ? (
          <TextInput
            type="number"
            value={draft[i.id]?.overage ?? i.overageRateKes}
            className="w-20 text-right font-mono py-1"
            onChange={(e) => applyDraft(i.id, { overage: Number(e.target.value) })}
          />
        ) : (
          <span className="font-mono text-[11px] text-slate-400">{KES(i.overageRateKes, { decimals: false })}</span>
        ),
      className: 'hidden xl:table-cell',
    },
    { key: 'turnaround', header: 'Turnaround', render: (i) => <span className="text-[10px] text-slate-400">{i.turnaround}</span>, className: 'hidden lg:table-cell' },
    { key: 'confidence', header: 'Rate confidence', render: (i) => <Badge tone={i.confidence === 'High' ? 'success' : i.confidence === 'Medium' ? 'warning' : 'neutral'}>{i.confidence}</Badge>, className: 'hidden xl:table-cell', sortValue: (i) => i.confidence },
    ...(canEdit
      ? [
          {
            key: 'adjust',
            header: 'Adjust',
            align: 'right' as const,
            render: (i: PricedItem) => (
              <Button size="xs" variant="ghost" icon={<Pencil size={11} />} onClick={() => setEditingId(i.id)} aria-label={`Adjust rates for ${i.name}`}>
                Edit
              </Button>
            ),
            className: 'hidden md:table-cell',
          },
        ]
      : []),
  ];

  // ------------------------------- calculator -------------------------------
  const calcRows = useMemo(
    () =>
      Object.entries(volumes)
        .filter(([, v]) => v > 0)
        .map(([id, v]) => {
          const item = pricing.items.find((i) => i.id === id);
          if (!item) return null;
          const included = Math.min(v, item.includedInBatch);
          const over = Math.max(0, v - item.includedInBatch);
          return { item, volume: v, included, over, cost: included * item.unitPriceKes + over * item.overageRateKes };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [volumes, pricing.items]
  );

  const calcSubtotal = calcRows.reduce((a, r) => a + r.cost, 0);
  const calcVat = calcSubtotal * (pricing.vatRatePct / 100);
  const calcTotal = calcSubtotal + calcVat;
  const effectivePerUnit = calcRows.reduce((a, r) => a + r.volume, 0) > 0 ? calcTotal / calcRows.reduce((a, r) => a + r.volume, 0) : 0;

  const downloadSchedule = () => {
    const doc = buildPricingSchedulePdf(pricing, settings);
    downloadBlob(doc.toBlob(), `IPRS_Pricing_Schedule_${pricing.batchLabel.replace(/[^0-9]/g, '-')}.pdf`);
    pushToast({ title: 'Price schedule downloaded', description: 'PDF generated from the live catalogue', type: 'success' });
  };

  return (
    <div className="w-full text-xs text-slate-200">
      <div className="px-3 sm:px-4 py-3 bg-gradient-to-r from-[#08172b] to-[#071120] border-b border-sky-900/50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Layers size={16} className="text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-white">Pricing &amp; tiers</h2>
            <p className="text-[10px] text-slate-500 truncate">
              {pricing.proposalRef} · valid {pricing.effectiveDate} → {pricing.validUntil}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" icon={<Download size={12} />} onClick={() => { downloadText(toCsv(pricing.items.map((i) => ({ ...i })) as unknown as Record<string, unknown>[]), 'iprs_price_list.csv', 'text/csv;charset=utf-8'); pushToast({ title: 'CSV exported', type: 'success' }); }}>
            CSV
          </Button>
          <Button size="sm" variant="primary" icon={<FileText size={12} />} onClick={downloadSchedule}>
            PDF schedule
          </Button>
        </div>
      </div>

      {!prov.allConfirmed && (
        <div className="px-3 sm:px-4 pt-3">
          <Callout tone="warning" title={`${prov.confirmed} of ${prov.total} rates confirmed from the proposal`} icon={<AlertTriangle size={14} />}>
            <p className="text-[11px] leading-relaxed">
              The proposal has been received in full and the 0–500 batch is transcribed from{' '}
              <strong>{pricing.proposalRef}</strong> (VAT exclusive). {prov.confirmed} line items are confirmed against it. {prov.provisional} remain
              placeholders — each unconfirmed row states its own status and provenance group until an official quote is keyed. This
              banner clears the moment every line is confirmed.{' '}
              {canEdit ? 'You can adjust any rate inline or via the per-row Edit drawer, then save.' : 'The Super Admin can adjust these rates.'} Clearing this
              banner everywhere needs every line confirmed plus{' '}
              <code className="font-mono">confirmedFromProposal</code> set.
            </p>
          </Callout>
        </div>
      )}

      <div className="px-2 sm:px-4 pt-3">
        <Tabs tabs={TABS} active={tab} onChange={(t) => setTab(t as Tab)} badges={{ 'Price list': pricing.items.length, Bundles: pricing.bundles.length }} />
      </div>

      <div className="p-2 sm:p-4 space-y-4">
        {/* ============================= PRICE LIST ============================= */}
        {tab === 'Price list' && (
          <>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Batch in use', value: pricing.batchLabel, sub: `min ${pricing.batchMin} · max ${pricing.batchMax}` },
                { label: 'Currency', value: pricing.currency, sub: `VAT ${pricing.vatRatePct}%` },
                { label: 'One-off setup', value: KES(pricing.setupFeeKes, { decimals: false }), sub: 'platform onboarding' },
                { label: 'Monthly access', value: KES(pricing.monthlyAccessFeeKes, { decimals: false }), sub: 'per organisation' },
              ].map((k) => (
                <div key={k.label} className="rounded-xl border border-sky-900/50 bg-[#061020] p-3">
                  <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{k.label}</div>
                  <div className="text-sm font-black text-white font-mono mt-0.5 truncate">{k.value}</div>
                  <div className="text-[10px] text-slate-500 truncate">{k.sub}</div>
                </div>
              ))}
            </div>

            <Panel
              title="Line items"
              subtitle={`${items.length} priced service(s) — batch ${pricing.batchLabel}`}
              icon={<Coins size={14} className="text-emerald-400" />}
              actions={
                <div className="flex flex-wrap items-center gap-1.5">
                  <SegmentedControl
                    size="sm"
                    value={filter}
                    onChange={(v) => setFilter(v as typeof filter)}
                    options={[
                      { value: 'all', label: 'All' },
                      { value: 'kyc', label: 'KYC' },
                      { value: 'kyb', label: 'KYB' },
                    ]}
                  />
                  {canEdit && pendingEdits.length > 0 && (
                    <>
                      <Button size="xs" variant="ghost" icon={<RotateCcw size={11} />} onClick={() => { setDraft({}); setEditingId(null); }}>Discard</Button>
                      <Button
                        size="xs"
                        variant="primary"
                        icon={<Save size={11} />}
                        onClick={async () => {
                          const res = await updatePricing({
                            items: pricing.items.map((i) => {
                              const d = draft[i.id];
                              if (!d) return i;
                              const next = { ...i };
                              if (d.unit !== undefined) next.unitPriceKes = d.unit;
                              if (d.overage !== undefined) next.overageRateKes = d.overage;
                              if (d.backup !== undefined) {
                                if (d.backup === null) delete next.backupRateKes;
                                else next.backupRateKes = d.backup;
                              }
                              if (d.perPage !== undefined) {
                                if (d.perPage === null) delete next.perPageKes;
                                else next.perPageKes = d.perPage;
                              }
                              if (d.included !== undefined) next.includedInBatch = d.included;
                              return next;
                            }),
                          });
                          if (res.ok) {
                            setDraft({});
                            setEditingId(null);
                            pushToast({ title: 'Pricing saved', description: `${pendingEdits.length} rate field(s) updated — audited`, type: 'success' });
                          }
                        }}
                      >
                        Save {pendingEdits.length} change{pendingEdits.length > 1 ? 's' : ''}
                      </Button>
                    </>
                  )}
                </div>
              }
            >
              <ResponsiveTable columns={itemCols} rows={items} rowKey={(i) => i.id} dense initialSort={{ key: 'type', dir: 'asc' }} />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-sky-900/50">
                <span className="text-[10px] text-slate-500">
                  Rates are per successful verification unless stated. Failed or not-found queries are not charged.
                </span>
                <span className="text-[11px] font-bold text-white">
                  Batch total if all items used at full quota:{' '}
                  <span className="font-mono text-emerald-300">
                    {KES(pricing.items.reduce((a, i) => a + i.unitPriceKes * i.includedInBatch, 0), { decimals: false })}
                  </span>
                </span>
              </div>
            </Panel>
          </>
        )}

        {/* =============================== BUNDLES =============================== */}
        {tab === 'Bundles' && (
          <>
            {canEdit && pendingBundleEdits.length > 0 && (
              <div className="flex items-center justify-end gap-2 px-2 sm:px-4 pb-1">
                <Button size="xs" variant="ghost" icon={<RotateCcw size={11} />} onClick={() => setBundleDraft({})}>Discard</Button>
                <Button
                  size="xs"
                  variant="primary"
                  icon={<Save size={11} />}
                  onClick={async () => {
                    const res = await updatePricing({
                      bundles: pricing.bundles.map((b) => (bundleDraft[b.id] != null ? { ...b, priceKes: bundleDraft[b.id] } : b)),
                    });
                    if (res.ok) {
                      setBundleDraft({});
                      pushToast({ title: 'Bundle prices saved', description: `${pendingBundleEdits.length} bundle(s) updated — audited`, type: 'success' });
                    }
                  }}
                >
                  Save {pendingBundleEdits.length} bundle price{pendingBundleEdits.length > 1 ? 's' : ''}
                </Button>
              </div>
            )}
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {pricing.bundles.map((b: PricingBundle) => {
                const constituent = b.itemIds.reduce((a, id) => a + (pricing.items.find((i) => i.id === id)?.unitPriceKes ?? 0), 0);
                const saving = constituent > 0 ? Math.round(((constituent - b.priceKes) / constituent) * 100) : 0;
                return (
                  <div key={b.id} className={`rounded-xl border p-3 flex flex-col gap-2 ${b.highlighted ? 'border-cyan-700/70 bg-gradient-to-b from-cyan-950/40 to-[#061020] shadow-[0_0_25px_rgba(6,182,212,0.12)]' : 'border-sky-900/50 bg-[#061020]'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-white">{b.name}</div>
                        <div className="text-[10px] text-slate-500 leading-snug">{b.tagline}</div>
                      </div>
                      {b.badge && <Badge tone="accent">{b.badge}</Badge>}
                    </div>
                    <div className="flex items-baseline gap-2">
                      {canEdit ? (
                        <div className="flex items-baseline gap-1.5">
                          <TextInput
                            type="number"
                            value={bundleDraft[b.id] ?? b.priceKes}
                            className="w-28 text-right font-mono text-sm font-black"
                            onChange={(e) => setBundleDraft({ ...bundleDraft, [b.id]: Number(e.target.value) })}
                          />
                          <span className="text-[10px] text-slate-500">KES</span>
                        </div>
                      ) : (
                        <span className="text-xl font-black text-white font-mono">{KES(b.priceKes, { decimals: false })}</span>
                      )}
                      {saving > 0 && <span className="text-[10px] text-emerald-400 font-semibold">save {saving}%</span>}
                    </div>
                    <ul className="space-y-1 flex-1">
                      {b.itemIds.map((id) => {
                        const it = pricing.items.find((i) => i.id === id);
                        return (
                          <li key={id} className="flex items-start gap-1.5 text-[10px] text-slate-400">
                            <CheckCircle2 size={11} className="text-emerald-400 mt-0.5 shrink-0" />
                            <span className="min-w-0">
                              {it?.name ?? id}
                              <span className="text-slate-600 font-mono"> · {KES(it?.unitPriceKes ?? 0, { decimals: false })}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="flex gap-1.5 pt-1 border-t border-sky-950/60">
                      <Button size="xs" variant={b.highlighted ? 'primary' : 'secondary'} className="flex-1 justify-center" icon={<ArrowRight size={11} />} onClick={() => navigate('/search')}>
                        Run this pack
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => { setVolumes(Object.fromEntries(b.itemIds.map((id) => [id, 100]))); setTab('Calculator'); }} icon={<Calculator size={11} />}>
                        Cost it
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <Panel title="Subscription plans" subtitle="Platform access plans layered on top of per-verification pricing" icon={<Layers size={14} className="text-cyan-400" />}>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <SegmentedControl
                  size="sm"
                  value={billingPeriod}
                  onChange={(v) => setBillingPeriod(v as 'monthly' | 'yearly')}
                  options={[
                    { value: 'monthly', label: 'Monthly' },
                    { value: 'yearly', label: 'Yearly (−15%)' },
                  ]}
                />
                <span className="text-[10px] text-slate-500">Current plan: <span className="text-cyan-300 font-semibold">{subscriptionPlans.find((p) => p.id === currentPlan)?.name ?? currentPlan}</span></span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {subscriptionPlans.map((p) => {
                  const price = billingPeriod === 'yearly' ? p.yearlyPrice : p.monthlyPrice;
                  return (
                    <div key={p.id} className={`rounded-xl border p-3 flex flex-col gap-2 ${p.highlighted ? 'border-cyan-700/70 bg-cyan-950/25' : 'border-sky-900/50 bg-[#061020]'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-[11px] font-bold text-white">{p.name}</div>
                        {p.badge && <Badge tone="accent">{p.badge}</Badge>}
                      </div>
                      <div className="text-[10px] text-slate-500 leading-snug">{p.subtitle}</div>
                      <div className="text-lg font-black text-white font-mono">
                        {p.customPrice ?? KES(price, { decimals: false })}
                        {!p.customPrice && <span className="text-[10px] font-normal text-slate-500">/{billingPeriod === 'yearly' ? 'yr' : 'mo'}</span>}
                      </div>
                      <ul className="space-y-1 flex-1">
                        {p.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[10px] text-slate-400">
                            <CheckCircle2 size={10} className="text-emerald-400 mt-0.5 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <Button size="xs" variant={currentPlan === p.id ? 'success' : p.highlighted ? 'primary' : 'secondary'} className="justify-center" disabled={currentPlan === p.id} onClick={() => { setCurrentPlan(p.id); pushToast({ title: 'Plan selected', description: `${p.name} — ${p.ctaText}`, type: 'success' }); }}>
                        {currentPlan === p.id ? 'Current plan' : p.ctaText}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </>
        )}

        {/* ============================== CALCULATOR ============================== */}
        {tab === 'Calculator' && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Panel title="Volume calculator" subtitle="Set the expected monthly volume per line item — batch pricing applies up to the included quota, then overage" icon={<Calculator size={14} className="text-cyan-400" />}>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {pricing.items.map((i) => (
                  <div key={i.id} className={`rounded-lg border px-2.5 py-2 ${volumes[i.id] ? 'border-cyan-800/60 bg-cyan-950/25' : 'border-sky-900/50 bg-[#061020]'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold text-white truncate">{i.name}</div>
                        <div className="text-[9px] text-slate-500 font-mono">{KES(i.unitPriceKes, { decimals: false })} · incl {i.includedInBatch}</div>
                      </div>
                      <Badge tone={i.type === 'kyc' ? 'info' : 'accent'}>{i.type.toUpperCase()}</Badge>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <input
                        type="range"
                        min={0}
                        max={1000}
                        step={10}
                        value={volumes[i.id] ?? 0}
                        onChange={(e) => setVolumes({ ...volumes, [i.id]: Number(e.target.value) })}
                        className="flex-1 accent-cyan-500 h-1"
                        aria-label={`${i.name} monthly volume`}
                      />
                      <TextInput
                        type="number"
                        min={0}
                        value={volumes[i.id] ?? 0}
                        onChange={(e) => setVolumes({ ...volumes, [i.id]: Math.max(0, Number(e.target.value)) })}
                        className="w-20 text-right font-mono py-1"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Button size="xs" variant="ghost" onClick={() => setVolumes({})}>Clear all</Button>
                <Button size="xs" variant="ghost" onClick={() => setVolumes(Object.fromEntries(kycItems().map((i) => [i.id, 100])))}>100 × every KYC check</Button>
                <Button size="xs" variant="ghost" onClick={() => setVolumes(Object.fromEntries(pricing.items.map((i) => [i.id, 500])))}>500 × everything (batch ceiling)</Button>
              </div>
            </Panel>

            <div className="space-y-4">
              <Panel title="Estimate" icon={<Scale size={14} className="text-emerald-400" />}>
                {calcRows.length === 0 ? (
                  <p className="text-[11px] text-slate-500">Move a slider or type a volume to price the pack.</p>
                ) : (
                  <div className="space-y-1.5">
                    {calcRows.map((r) => (
                      <div key={r.item.id} className="flex items-start justify-between gap-2 text-[11px] border-b border-sky-950/60 pb-1.5 last:border-0">
                        <span className="text-slate-400 min-w-0">
                          <span className="block truncate">{r.item.name}</span>
                          <span className="block text-[9px] text-slate-600 font-mono">
                            {r.volume} vol · {r.included} in-batch{r.over > 0 ? ` · ${r.over} overage` : ''}
                          </span>
                        </span>
                        <span className="font-mono text-slate-200 shrink-0">{KES(r.cost, { decimals: false })}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-[11px] pt-1"><span className="text-slate-500">Subtotal</span><span className="font-mono">{KES(calcSubtotal)}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-slate-500">VAT ({pricing.vatRatePct}%)</span><span className="font-mono">{KES(calcVat)}</span></div>
                    {pricing.monthlyAccessFeeKes > 0 && (
                      <div className="flex justify-between text-[11px]"><span className="text-slate-500">Monthly access</span><span className="font-mono">{KES(pricing.monthlyAccessFeeKes)}</span></div>
                    )}
                    <div className="flex justify-between text-sm pt-2 border-t border-sky-800/60">
                      <span className="font-bold text-white">Estimated total</span>
                      <span className="font-mono font-black text-emerald-300">{KES(calcTotal + pricing.monthlyAccessFeeKes)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Effective cost per verification</span>
                      <span className="font-mono">{KES(effectivePerUnit)}</span>
                    </div>
                  </div>
                )}
                <div className="mt-3 flex gap-1.5">
                  <Button size="xs" variant="secondary" className="flex-1 justify-center" icon={<FileText size={11} />} onClick={downloadSchedule}>Schedule PDF</Button>
                  <Button size="xs" variant="primary" className="flex-1 justify-center" icon={<ArrowRight size={11} />} onClick={() => navigate('/wallet')}>Fund wallet</Button>
                </div>
              </Panel>

              <Callout tone="info" title="How billing works" icon={<Info size={14} />}>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                  <li>Searches debit the prepaid wallet at the in-batch rate; overage applies past the included quota.</li>
                  <li>Wallet top-ups accept M-PESA STK Push and card. VAT is applied on invoiced billing, not wallet debits.</li>
                  <li>Payment terms: <strong>{pricing.paymentTerms}</strong>.</li>
                  <li>Channels: {pricing.paymentChannels.join(', ')}.</li>
                </ul>
              </Callout>
            </div>
          </div>
        )}

        {/* ================================ TERMS ================================ */}
        {tab === 'Terms' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Commercial terms" icon={<Scale size={14} className="text-cyan-400" />}>
              <dl className="space-y-2 text-[11px]">
                {[
                  ['Proposal reference', pricing.proposalRef],
                  ['Batch band in use', `${pricing.batchLabel} (${pricing.batchMin}–${pricing.batchMax})`],
                  ['Effective date', pricing.effectiveDate],
                  ['Valid until', pricing.validUntil],
                  ['Currency', pricing.currency],
                  ['VAT rate', `${pricing.vatRatePct}%`],
                  ['One-off setup fee', KES(pricing.setupFeeKes)],
                  ['Monthly access fee', KES(pricing.monthlyAccessFeeKes)],
                  ['Payment terms', pricing.paymentTerms],
                  ['Payment channels', pricing.paymentChannels.join(', ')],
                  ['Credit terms (days)', String(settings.billing.creditTermsDays)],
                  ['Volume discount', `${settings.billing.discountPct}%`],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3 border-b border-sky-950/60 pb-1.5 last:border-0">
                    <dt className="text-slate-500 shrink-0">{k}</dt>
                    <dd className="text-slate-100 text-right break-words">{v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>

            <div className="space-y-4">
              <Panel title="Notes & inclusions" icon={<CheckCircle2 size={14} className="text-emerald-400" />}>
                <ul className="space-y-1.5">
                  {pricing.notes.map((n, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-300 leading-relaxed">
                      <CheckCircle2 size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                      {n}
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel title="Exclusions" icon={<AlertTriangle size={14} className="text-amber-400" />}>
                <ul className="space-y-1.5">
                  {pricing.exclusions.map((n, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-300 leading-relaxed">
                      <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                      {n}
                    </li>
                  ))}
                </ul>
              </Panel>
              {canEdit && (
                <Panel title="Catalogue controls" subtitle="Super Admin only" icon={<Save size={14} className="text-cyan-400" />}>
                  <div className="space-y-2.5">
                    <Toggle
                      checked={pricing.confirmedFromProposal}
                      onChange={(v) => updatePricing({ confirmedFromProposal: v })}
                      label="Figures confirmed from the proposal PDF"
                      description="Removes the provisional banner across the platform"
                    />
                    <Field label="Batch label"><TextInput value={pricing.batchLabel} onChange={(e) => updatePricing({ batchLabel: e.target.value })} /></Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="VAT %"><TextInput type="number" value={pricing.vatRatePct} className="font-mono" onChange={(e) => updatePricing({ vatRatePct: Number(e.target.value) })} /></Field>
                      <Field label="Setup fee"><TextInput type="number" value={pricing.setupFeeKes} className="font-mono" onChange={(e) => updatePricing({ setupFeeKes: Number(e.target.value) })} /></Field>
                    </div>
                    <Field label="Payment terms"><TextInput value={pricing.paymentTerms} onChange={(e) => updatePricing({ paymentTerms: e.target.value })} /></Field>
                  </div>
                </Panel>
              )}
            </div>
          </div>
        )}
      </div>

      {editing && canEdit && (
        <Modal open onClose={() => setEditingId(null)} title={`Adjust rates — ${editing.name}`}>
          <div className="space-y-3">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Changes stage into the pending draft — commit them with <strong className="text-slate-300">Save changes</strong> on the Price list.
              Every committed adjustment is audit-logged with its old and new value. Adjusting a rate here{' '}
              <strong className="text-amber-400">does not</strong> mark it confirmed against the proposal.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Unit price (KES)">
                <TextInput type="number" className="font-mono" value={editingDraft.unit ?? editing.unitPriceKes} onChange={(e) => applyDraft(editing.id, { unit: Number(e.target.value) })} />
              </Field>
              <Field label="Overage rate (KES)">
                <TextInput type="number" className="font-mono" value={editingDraft.overage ?? editing.overageRateKes} onChange={(e) => applyDraft(editing.id, { overage: Number(e.target.value) })} />
              </Field>
              <Field label="Back-up rate (KES)" hint="Empty = no back-up rate">
                <TextInput
                  type="number"
                  className="font-mono"
                  value={editingDraft.backup === null ? '' : editingDraft.backup ?? editing.backupRateKes ?? ''}
                  onChange={(e) => applyDraft(editing.id, { backup: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </Field>
              <Field label="Per page (KES)" hint="Empty = not page-metered">
                <TextInput
                  type="number"
                  className="font-mono"
                  value={editingDraft.perPage === null ? '' : editingDraft.perPage ?? editing.perPageKes ?? ''}
                  onChange={(e) => applyDraft(editing.id, { perPage: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </Field>
              <Field label="Included in batch">
                <TextInput type="number" className="font-mono" value={editingDraft.included ?? editing.includedInBatch} onChange={(e) => applyDraft(editing.id, { included: Number(e.target.value) })} />
              </Field>
              <div className="flex items-end">
                <Badge tone={editing.confirmedFromProposal ? 'success' : 'warning'}>{editing.confirmedFromProposal ? 'Confirmed from proposal' : 'Provisional rate'}</Badge>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Done</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Screen11_PricingTiers;
