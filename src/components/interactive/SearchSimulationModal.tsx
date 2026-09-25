import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, ShieldCheck, Sparkles, Wallet as WalletIcon } from 'lucide-react';
import { KraLogo, MpesaLogo, CrbLogo, KplcLogo } from '../common/ProviderLogos';
import { useAppData } from '../../context/AppDataContext';
import { Modal, Button, Callout } from '../ui';
import { KES } from '../../lib/format';

interface SearchSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewProfile?: () => void;
  initialQuery?: string;
  onScanningChange?: (scanning: boolean) => void;
}

export const canCloseSearch = (scanning: boolean): boolean => !scanning;

const DEMO_SUBJECTS = [
  { name: 'John Mwangi Kamau', id: '23456789', phone: '0712345678' },
  { name: 'Amina Hassan Yusuf', id: '31884207', phone: '0722118843' },
  { name: 'Peter Otieno Owino', id: '19744310', phone: '0733991204' },
];

const QUICK_CHECKS = ['kyc-id', 'kyc-kra', 'kyc-mpesa', 'kyc-crb', 'kyc-address', 'kyc-pep'];

/**
 * Quick-launch verification from anywhere in the app.
 *
 * It is not a fake animation any more — it runs the same priced, consented pipeline as
 * the New Search screen and writes the resulting dossier, ledger entry and audit record.
 */
export const SearchSimulationModal: React.FC<SearchSimulationModalProps> = ({ isOpen, onClose, onViewProfile, onScanningChange }) => {
  const { runSearch, priceSearch, preflightSearch, wallet, pricing, pushToast } = useAppData();
  const [subject, setSubject] = useState(DEMO_SUBJECTS[0]);
  const [checks, setChecks] = useState<string[]>(QUICK_CHECKS);
  const [stage, setStage] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle');
  const [stepIndex, setStepIndex] = useState(0);
  const [message, setMessage] = useState('');

  const steps = [
    { label: 'Recording consent', detail: 'Lawful basis + retention policy applied' },
    { label: 'Querying IPRS Civil Registration', detail: 'Validating national ID' },
    { label: 'Checking KRA tax compliance', detail: 'PIN & obligation status' },
    { label: 'Cross-referencing Safaricom M-PESA', detail: 'Mobile KYC name match' },
    { label: 'Validating CRB & utility records', detail: 'Credit score + address confirmation' },
    { label: 'Assembling dossier & scoring risk', detail: 'Writing ledger and audit entries' },
  ];

  useEffect(() => {
    if (isOpen) {
      setStage('idle');
      setStepIndex(0);
      setMessage('');
    }
  }, [isOpen]);

  useEffect(() => {
    onScanningChange?.(stage === 'scanning');
  }, [onScanningChange, stage]);

  const close = () => {
    if (canCloseSearch(stage === 'scanning')) onClose();
  };

  const cost = priceSearch(checks);
  const preflight = preflightSearch(checks);

  const toggleCheck = (id: string) => setChecks((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const run = async () => {
    if (checks.length === 0) return;
    onScanningChange?.(true);
    setStage('scanning');
    setStepIndex(0);

    const timer = setInterval(() => setStepIndex((i) => Math.min(steps.length - 1, i + 1)), 320);

    const res = await runSearch({
      fullName: subject.name,
      idNumber: subject.id,
      phone: subject.phone,
      county: 'Nairobi',
      checkIds: checks,
    });

    clearInterval(timer);
    setStepIndex(steps.length);

    if (res.ok) {
      setStage('done');
      setMessage(`${res.dossier?.subject.fullName} · risk ${res.dossier?.risk.score === null || res.dossier?.risk.score === undefined ? 'unavailable' : `${res.dossier.risk.score}/100`} · ${KES(res.costKes ?? 0, { decimals: false })} debited`);
      pushToast({ title: 'Verification complete', description: message, type: 'success' });
      setTimeout(() => {
        onClose();
        onViewProfile?.();
      }, 900);
    } else {
      setStage('error');
      setMessage(res.message ?? 'The verification could not be completed.');
    }
  };

  const providerLogos = [
    { Logo: KraLogo, name: 'KRA' },
    { Logo: MpesaLogo, name: 'M-PESA' },
    { Logo: CrbLogo, name: 'CRB' },
    { Logo: KplcLogo, name: 'KPLC' },
  ];

  return (
    <Modal
      open={isOpen}
      onClose={close}
      title={
        <span className="flex items-center gap-2">
          <Sparkles size={15} className="text-cyan-400" /> Live citizen verification
        </span>
      }
      subtitle={`Priced from ${pricing.batchLabel} · consent captured automatically`}
      size="lg"
      footer={
        stage === 'idle' || stage === 'error' ? (
          <div className="flex flex-wrap items-center justify-between gap-2 w-full">
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <WalletIcon size={12} className="text-emerald-400" />
              Balance {KES(wallet.balance, { decimals: false })} · debit{' '}
              <strong className="text-emerald-300 font-mono">{KES(cost, { decimals: false })}</strong>
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={close}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={run} disabled={!preflight.ok || checks.length === 0} icon={<ShieldCheck size={13} />}>
                Run verification
              </Button>
            </div>
          </div>
        ) : (
          <div className="w-full flex justify-end">
            <Button variant="secondary" size="sm" onClick={close} disabled={stage === 'scanning'}>
              {stage === 'scanning' ? 'Running…' : 'Close'}
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-4">
        {stage === 'idle' && (
          <>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Demo subject</div>
              <div className="grid gap-1.5 sm:grid-cols-3">
                {DEMO_SUBJECTS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSubject(s)}
                    className={`rounded-lg border px-2.5 py-2 text-left transition-colors ${
                      subject.id === s.id ? 'border-cyan-600/70 bg-cyan-950/40' : 'border-sky-900/60 bg-[#061020] hover:border-sky-700'
                    }`}
                  >
                    <div className="text-[11px] font-semibold text-white truncate">{s.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">ID {s.id}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Checks to run</div>
              <div className="flex flex-wrap gap-1.5">
                {[...QUICK_CHECKS, 'kyc-criminal', 'kyc-employer', 'kyc-deceased', 'kyb-registry'].map((id) => {
                  const on = checks.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggleCheck(id)}
                      className={`px-2 py-1 rounded-lg border text-[10px] font-medium transition-colors ${
                        on ? 'border-cyan-600/70 bg-cyan-950/40 text-cyan-200' : 'border-sky-900/60 bg-[#061020] text-slate-500 hover:text-white'
                      }`}
                    >
                      {id.replace(/^k(y)?[cb]-/, '').toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>

            {!preflight.ok && <Callout tone="danger" title="Cannot run">{preflight.reason}</Callout>}

            <div className="flex items-center justify-center gap-4 py-1">
              {providerLogos.map(({ Logo, name }) => (
                <div key={name} className="flex flex-col items-center gap-1 opacity-70">
                  <Logo size={22} />
                  <span className="text-[8px] text-slate-500">{name}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {(stage === 'scanning' || stage === 'done') && (
          <div className="space-y-2">
            {steps.map((s, i) => {
              const done = i < stepIndex || stage === 'done';
              const active = i === stepIndex && stage === 'scanning';
              return (
                <div
                  key={s.label}
                  className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors ${
                    done ? 'border-emerald-900/50 bg-emerald-950/20' : active ? 'border-cyan-800/60 bg-cyan-950/30' : 'border-sky-900/40 bg-[#061020] opacity-50'
                  }`}
                >
                  {done ? (
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  ) : active ? (
                    <Loader2 size={14} className="text-cyan-300 animate-spin shrink-0" />
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-white truncate">{s.label}</div>
                    <div className="text-[10px] text-slate-500 truncate">{s.detail}</div>
                  </div>
                </div>
              );
            })}
            {stage === 'done' && (
              <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-2 text-[11px] text-emerald-200">
                {message} — opening dossier…
              </div>
            )}
          </div>
        )}

        {stage === 'error' && <Callout tone="danger" title="Verification failed">{message}</Callout>}
      </div>
    </Modal>
  );
};

export default SearchSimulationModal;
