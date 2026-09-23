import React, { useMemo, useState } from 'react';
import {
  Search, Wallet as WalletIcon, ShieldCheck, Loader2, CheckCircle2, XCircle, ChevronRight, Scale,
  AlertTriangle, Briefcase, ArrowRight, Layers, Info,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { useAppRouter } from '../../context/RouterContext';
import { Badge, Button, Callout, Checkbox, Field, Panel, Select, TextInput } from '../ui';
import { kycItems, kybItems } from '../../data/pricing';
import { KES, uid } from '../../lib/format';
import type { PricedItem } from '../../types';

interface Props {
  onExecuteSearch?: () => void;
}

const PRESETS: { id: string; label: string; description: string; items: string[] }[] = [
  { id: 'basic', label: 'Basic KYC', description: 'ID + KRA + M-PESA + deceased', items: ['kyc-id', 'kyc-kra', 'kyc-mpesa', 'kyc-deceased'] },
  { id: 'standard', label: 'Standard KYC', description: 'Basic + address, employer, PEP', items: ['kyc-id', 'kyc-kra', 'kyc-mpesa', 'kyc-deceased', 'kyc-address', 'kyc-employer', 'kyc-pep'] },
  { id: 'enhanced', label: 'Enhanced due diligence', description: 'All KYC checks incl. CRB & criminal', items: ['kyc-id', 'kyc-kra', 'kyc-mpesa', 'kyc-deceased', 'kyc-address', 'kyc-employer', 'kyc-pep', 'kyc-crb', 'kyc-criminal'] },
  { id: 'kyb', label: 'KYB entity pack', description: 'Registry, directors, BO, tax, litigation', items: ['kyb-registry', 'kyb-directors', 'kyb-bo', 'kyb-tax', 'kyb-litigation', 'kyb-licence'] },
];

const COUNTIES = [
  'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Uasin Gishu', 'Kiambu', 'Machakos', 'Kajiado', 'Kilifi', 'Murang’a',
  'Nyeri', 'Meru', 'Kakamega', 'Bungoma', 'Kericho', 'Laikipia', 'Trans Nzoia', 'Other / unknown',
];

/**
 * New Search / Investigation.
 *
 * A real, priced, consented query: the catalogue drives the cost, the wallet is checked
 * *before* dispatch, every gateway call is logged, and the debit lands in the ledger.
 */
export const Screen3_NewSearch: React.FC<Props> = ({ onExecuteSearch }) => {
  const { pricing, wallet, runSearch, preflightSearch, priceSearch, visibleCases, settings } = useAppData();
  const { navigate } = useAppRouter();

  const [fullName, setFullName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [county, setCounty] = useState('Nairobi');
  const [dob, setDob] = useState('');
  const [caseId, setCaseId] = useState('');
  const [selected, setSelected] = useState<string[]>(PRESETS[1].items);
  const [consent, setConsent] = useState(false);
  const [purpose, setPurpose] = useState('Customer onboarding (KYC)');
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<{ label: string; ok: boolean; ms: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [consentRef] = useState(() => uid('CNS').toUpperCase());

  const catalogue = useMemo(() => ({ kyc: kycItems(), kyb: kybItems() }), []);
  const byId = useMemo(() => Object.fromEntries(pricing.items.map((i) => [i.id, i])), [pricing.items]);

  const subtotal = priceSearch(selected);
  const vat = Math.round(subtotal * (pricing.vatRatePct / 100) * 100) / 100;
  const total = subtotal; // wallet debits are net of VAT; VAT applies to invoiced billing
  const preflight = preflightSearch(selected);

  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const applyPreset = (p: (typeof PRESETS)[number]) => setSelected(p.items);

  const canRun = fullName.trim().length > 2 && idNumber.trim().length >= 5 && consent && selected.length > 0 && !running;

  const execute = async () => {
    setError(null);
    if (!canRun) return;
    if (!preflight.ok) {
      setError(preflight.reason ?? 'Preflight check failed.');
      return;
    }
    setRunning(true);
    setStages([]);

    // Staged progress — the service returns the real per-gateway timings afterwards.
    const planned = [
      { label: 'Recording consent & lawful basis', ms: 260 },
      { label: 'Pricing checks against the 0–500 batch', ms: 220 },
      { label: `Reserving ${KES(total, { decimals: false })} from wallet`, ms: 300 },
      ...selected.map((id) => ({ label: `Querying ${byId[id]?.name ?? id}`, ms: 420 + Math.random() * 420 })),
      { label: 'Assembling dossier & scoring risk', ms: 480 },
    ];

    for (const p of planned) {
      setStages((prev) => [...prev, { label: p.label, ok: true, ms: Math.round(p.ms) }]);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, Math.min(180, p.ms / 3)));
    }

    const res = await runSearch({
      fullName: fullName.trim(),
      idNumber: idNumber.trim(),
      phone: phone.trim(),
      county,
      dob: dob.trim() || undefined,
      checkIds: selected,
      consentRef,
      caseId: caseId || undefined,
    });

    setRunning(false);
    if (!res.ok) {
      setStages([]);
      setError(res.message ?? 'Search failed.');
      return;
    }
    setStages(res.stages ?? planned.map((p) => ({ label: p.label, ok: true, ms: Math.round(p.ms) })));
    onExecuteSearch?.();
    navigate('/identity-profile');
  };

  const ItemRow: React.FC<{ item: PricedItem }> = ({ item }) => {
    const on = selected.includes(item.id);
    return (
      <button
        type="button"
        onClick={() => toggle(item.id)}
        className={`w-full flex items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
          on ? 'border-cyan-700/70 bg-cyan-950/35' : 'border-sky-900/50 bg-[#061020] hover:border-sky-700/70'
        }`}
      >
        <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-cyan-500 border-cyan-400 text-black' : 'border-slate-600'}`}>
          {on && <CheckCircle2 size={11} />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[11px] font-semibold text-white truncate">{item.name}</span>
          <span className="block text-[10px] text-slate-500 leading-snug line-clamp-2">{item.description}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{item.source}</Badge>
            <Badge tone="info">{item.turnaround}</Badge>
            <span className="text-[9px] text-slate-600 font-mono">incl. {item.includedInBatch}/batch</span>
          </span>
        </span>
        <span className="text-right shrink-0">
          <span className="block text-[11px] font-bold text-emerald-300 font-mono">{KES(item.unitPriceKes, { decimals: false })}</span>
          <span className="block text-[9px] text-slate-600 font-mono">over {KES(item.overageRateKes, { decimals: false })}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="w-full text-xs text-slate-200">
      <div className="px-3 sm:px-4 py-3 bg-gradient-to-r from-[#08172b] to-[#071120] border-b border-sky-900/50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Search size={16} className="text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-white">New verification search</h2>
            <p className="text-[10px] text-slate-500 truncate">
              Priced from {pricing.batchLabel} · consent captured · debited from your wallet
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-2.5 py-1.5 flex items-center gap-2">
            <WalletIcon size={13} className="text-emerald-400" />
            <div>
              <div className="text-[9px] uppercase tracking-wider text-emerald-500/80 font-bold leading-none">Wallet</div>
              <div className="text-[11px] font-bold text-emerald-300 font-mono leading-tight">{KES(wallet.balance)}</div>
            </div>
          </div>
          <Button size="sm" variant="secondary" icon={<WalletIcon size={12} />} onClick={() => navigate('/wallet')}>
            Top up
          </Button>
        </div>
      </div>

      {!pricing.confirmedFromProposal && (
        <div className="px-3 sm:px-4 pt-3">
          <Callout tone="warning" title="Provisional pricing">
            Rates shown come from <strong>{pricing.proposalRef}</strong> and are flagged as placeholders until the proposal figures
            are confirmed. Set them in <em>Pricing &amp; Tiers</em> (admin) once transcribed.
          </Callout>
        </div>
      )}

      <div className="p-2 sm:p-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ---------------- left: form + catalogue ---------------- */}
        <div className="space-y-4 min-w-0">
          <Panel title="Subject details" subtitle="At least a full name and an identifier are required" icon={<Briefcase size={14} className="text-cyan-400" />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full legal name" required>
                <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. John Mwangi Kamau" />
              </Field>
              <Field label="National ID / Passport no." required>
                <TextInput value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="e.g. 23456789" className="font-mono" />
              </Field>
              <Field label="Mobile number" hint="Used for the M-PESA name &amp; number match">
                <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" className="font-mono" />
              </Field>
              <Field label="Date of birth" hint="Optional — improves match confidence">
                <TextInput value={dob} onChange={(e) => setDob(e.target.value)} placeholder="1986-04-12" className="font-mono" />
              </Field>
              <Field label="County">
                <Select value={county} onChange={(e) => setCounty(e.target.value)} options={COUNTIES.map((c) => ({ value: c, label: c }))} />
              </Field>
              <Field label="Link to case" hint="Optional">
                <Select
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  options={[{ value: '', label: '— No case —' }, ...visibleCases.map((c) => ({ value: c.caseId, label: `${c.caseId} · ${c.subject}` }))]}
                />
              </Field>
            </div>
          </Panel>

          <Panel
            title="Select verification checks"
            subtitle={`${selected.length} selected · ${catalogue.kyc.length} KYC and ${catalogue.kyb.length} KYB items available`}
            icon={<Layers size={14} className="text-cyan-400" />}
            actions={
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    title={p.description}
                    className={`px-2 py-1 rounded-lg border text-[10px] font-medium transition-colors ${
                      selected.length === p.items.length && p.items.every((i) => selected.includes(i))
                        ? 'border-cyan-600/70 bg-cyan-950/50 text-cyan-200'
                        : 'border-sky-900/60 bg-[#061020] text-slate-400 hover:text-white hover:border-sky-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <button type="button" onClick={() => setSelected([])} className="px-2 py-1 rounded-lg border border-sky-900/60 bg-[#061020] text-[10px] text-slate-500 hover:text-rose-300">
                  Clear
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">KYC — individual checks</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {catalogue.kyc.map((it) => (
                    <ItemRow key={it.id} item={it} />
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">KYB — entity checks</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {catalogue.kyb.map((it) => (
                    <ItemRow key={it.id} item={it} />
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          {running && stages.length > 0 && (
            <Panel title="Search in progress" icon={<Loader2 size={14} className="text-cyan-400 animate-spin" />}>
              <ol className="space-y-1.5">
                {stages.map((s, i) => (
                  <li key={`${s.label}-${i}`} className="flex items-center gap-2 text-[11px]">
                    {s.ok ? <CheckCircle2 size={12} className="text-emerald-400 shrink-0" /> : <XCircle size={12} className="text-rose-400 shrink-0" />}
                    <span className="text-slate-300 flex-1 truncate">{s.label}</span>
                    <span className="font-mono text-[10px] text-slate-500 shrink-0">{s.ms} ms</span>
                  </li>
                ))}
                {running && (
                  <li className="flex items-center gap-2 text-[11px] text-cyan-300">
                    <Loader2 size={12} className="animate-spin shrink-0" />
                    <span>Working…</span>
                  </li>
                )}
              </ol>
            </Panel>
          )}
        </div>

        {/* ---------------- right: cost + consent + run ---------------- */}
        <div className="space-y-4 min-w-0">
          <Panel title="Cost estimate" icon={<Scale size={14} className="text-emerald-400" />}>
            {selected.length === 0 ? (
              <p className="text-[11px] text-slate-500">Select at least one check to price the search.</p>
            ) : (
              <div className="space-y-1.5">
                {selected.map((id) => {
                  const it = byId[id];
                  if (!it) return null;
                  return (
                    <div key={id} className="flex items-center justify-between gap-2 text-[11px] border-b border-sky-950/60 pb-1.5 last:border-0">
                      <span className="text-slate-400 truncate">{it.name}</span>
                      <span className="font-mono text-slate-200 shrink-0">{KES(it.unitPriceKes, { decimals: false })}</span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-mono text-slate-200">{KES(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">
                    VAT ({pricing.vatRatePct}%) <span className="text-slate-600">— invoiced billing</span>
                  </span>
                  <span className="font-mono text-slate-400">{KES(vat)}</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t border-sky-800/60">
                  <span className="font-bold text-white">Wallet debit</span>
                  <span className="font-mono font-black text-emerald-300">{KES(total)}</span>
                </div>
              </div>
            )}

            <div className="mt-3 rounded-lg bg-[#061020] border border-sky-900/50 px-2.5 py-2">
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>Balance after search</span>
                <span className={`font-mono font-bold ${wallet.balance - total < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                  {KES(wallet.balance - total)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-[#0b1c33] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                  style={{ width: `${Math.max(2, Math.min(100, ((wallet.balance - total) / Math.max(1, wallet.balance)) * 100))}%` }}
                />
              </div>
            </div>

            {!preflight.ok && selected.length > 0 && (
              <Callout tone="danger" title="Cannot run" className="mt-3">
                <p className="text-[11px]">{preflight.reason}</p>
                <Button size="xs" variant="secondary" className="mt-2" icon={<ArrowRight size={11} />} onClick={() => navigate('/wallet')}>
                  Open wallet
                </Button>
              </Callout>
            )}
          </Panel>

          <Panel title="Consent & lawful basis" icon={<ShieldCheck size={14} className="text-cyan-400" />}>
            <div className="space-y-2.5">
              <Field label="Purpose of processing">
                <Select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  options={[
                    'Customer onboarding (KYC)',
                    'Enhanced due diligence',
                    'Employment screening',
                    'Credit assessment',
                    'Fraud investigation',
                    'KYB / supplier onboarding',
                  ].map((p) => ({ value: p, label: p }))}
                />
              </Field>
              <Checkbox
                checked={consent}
                onChange={setConsent}
                label={
                  <span className="text-[11px] text-slate-300 leading-snug">
                    I confirm the data subject has given consent under the <strong>Data Protection Act, 2019</strong> and that this
                    query is for the stated purpose only.
                  </span>
                }
              />
              <div className="rounded-lg bg-[#061020] border border-sky-900/50 px-2.5 py-2 text-[10px] text-slate-500 font-mono break-all">
                Consent ref: {consentRef}
                <br />
                Model: {settings.compliance.consentCapture} · Retention{' '}
                {settings.compliance.retention.find((r) => r.recordType.toLowerCase().includes('dossier'))?.months ?? 24} months
              </div>
            </div>
          </Panel>

          {error && (
            <Callout tone="danger" title="Search rejected">
              <p className="text-[11px] flex items-start gap-1.5">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                {error}
              </p>
            </Callout>
          )}

          <Button
            variant="primary"
            className="w-full justify-center py-3 text-sm"
            onClick={execute}
            disabled={!canRun}
            loading={running}
            icon={running ? undefined : <Search size={15} />}
          >
            {running ? 'Running verification…' : `Run verification · ${KES(total, { decimals: false })}`}
          </Button>

          <div className="flex items-start gap-1.5 text-[10px] text-slate-600 leading-relaxed">
            <Info size={11} className="mt-0.5 shrink-0" />
            Every gateway call is written to the provider request log, the wallet ledger and the platform audit trail before the
            dossier is assembled.
          </div>

          {stages.length > 0 && !running && (
            <button onClick={() => navigate('/identity-profile')} className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-cyan-950/40 border border-cyan-800/50 py-2 text-[11px] text-cyan-300 hover:bg-cyan-950/70">
              View the assembled dossier <ChevronRight size={12} />
            </button>
          )}

          <div className="rounded-lg border border-sky-900/50 bg-[#061020] p-2.5">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Batch &amp; terms</div>
            <div className="space-y-1 text-[10px] text-slate-400">
              <div className="flex justify-between gap-2"><span>Batch in use</span><span className="text-slate-200">{pricing.batchLabel}</span></div>
              <div className="flex justify-between gap-2"><span>Effective</span><span className="text-slate-200">{pricing.effectiveDate}</span></div>
              <div className="flex justify-between gap-2"><span>Valid until</span><span className="text-slate-200">{pricing.validUntil}</span></div>
              <div className="flex justify-between gap-2"><span>Payment terms</span><span className="text-slate-200">{pricing.paymentTerms}</span></div>
            </div>
            <button onClick={() => navigate('/pricing')} className="mt-2 text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
              Full price schedule <ChevronRight size={10} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Screen3_NewSearch;
