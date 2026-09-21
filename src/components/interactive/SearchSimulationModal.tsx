import React, { useState, useEffect } from 'react';
import { X, Search, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react';
import { KraLogo, MpesaLogo, CrbLogo, KplcLogo } from '../common/ProviderLogos';
import { primaryProfile } from '../../data/mockData';
import { useAppData } from '../../context/AppDataContext';

interface SearchSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewProfile?: () => void;
  initialQuery?: string;
}

export const SearchSimulationModal: React.FC<SearchSimulationModalProps> = ({
  isOpen,
  onClose,
  onViewProfile,
  initialQuery = '23456789',
}) => {
  const { setLastSearchResult, pushToast } = useAppData();
  const [queryId, setQueryId] = useState(initialQuery);
  const [stage, setStage] = useState<'idle' | 'scanning' | 'done'>('idle');
  const [stepIndex, setStepIndex] = useState(0);

  const steps = [
    { label: 'Connecting to Spin Mobile Gateway', detail: 'mTLS handshake with secure proxy' },
    { label: 'Querying IPRS Civil Registration', detail: 'Validating National ID' },
    { label: 'Checking KRA Tax Compliance', detail: 'PIN confirmed active' },
    { label: 'Cross-referencing Safaricom M-PESA', detail: 'Mobile KYC name matched 100%' },
    { label: 'Validating CRB & Utility Records', detail: 'TransUnion clear & KPLC active' },
  ];

  useEffect(() => {
    if (isOpen) {
      setStage('idle');
      setStepIndex(0);
      setQueryId(initialQuery);
    }
  }, [isOpen, initialQuery]);

  const handleStartScan = () => {
    if (!queryId.trim()) {
      pushToast({ title: 'Enter an ID or phone number', type: 'warning' });
      return;
    }
    setStage('scanning');
    setStepIndex(0);
  };

  useEffect(() => {
    if (stage !== 'scanning') return;

    if (stepIndex < steps.length) {
      const timer = setTimeout(() => setStepIndex((prev) => prev + 1), 500);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setStage('done');
      setLastSearchResult({
        query: queryId,
        profile: primaryProfile,
        timestamp: new Date().toISOString(),
        riskScore: primaryProfile.riskScore,
      });
      pushToast({
        title: 'Verification complete',
        description: `${primaryProfile.fullName} · ${primaryProfile.riskScore}% low risk`,
        type: 'success',
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [stage, stepIndex, steps.length, queryId, setLastSearchResult, pushToast]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#071322] border border-cyan-500/40 rounded-2xl w-full max-w-xl overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.3)] max-h-[92vh] flex flex-col animate-scale-in">
        <div className="p-4 bg-[#09182d] border-b border-sky-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">Live Kenyan Identity Verification</h3>
              <p className="text-[11px] text-cyan-300/80 font-mono truncate">Cross-registry instant lookup</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-sky-950 transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={queryId}
                onChange={(e) => setQueryId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && stage !== 'scanning' && handleStartScan()}
                placeholder="National ID or Phone (e.g. 23456789)"
                className="w-full bg-[#040a14] border border-sky-800/80 rounded-lg py-2.5 pl-9 pr-3 text-sm text-white font-mono focus:outline-none focus:border-cyan-400"
                disabled={stage === 'scanning'}
              />
            </div>
            <button
              onClick={handleStartScan}
              disabled={stage === 'scanning'}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-lg font-semibold text-xs transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] flex items-center gap-1.5 disabled:opacity-50 shrink-0"
            >
              {stage === 'scanning' ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              <span className="hidden sm:inline">Verify ID</span>
              <span className="sm:hidden">Go</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span>Samples:</span>
            {[
              { id: '23456789', name: 'John Mwangi' },
              { id: '28941042', name: 'Grace Wanjiku' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setQueryId(s.id);
                  setStage('idle');
                  setTimeout(() => {
                    setStage('scanning');
                    setStepIndex(0);
                  }, 50);
                }}
                disabled={stage === 'scanning'}
                className="text-cyan-400 hover:underline font-mono disabled:opacity-50"
              >
                {s.id} ({s.name})
              </button>
            ))}
          </div>

          {stage === 'scanning' && (
            <div className="p-4 rounded-xl bg-[#050c18] border border-sky-800/70 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="text-cyan-400 font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  Querying National Registries…
                </span>
                <span className="font-mono text-slate-400">
                  {Math.round((stepIndex / steps.length) * 100)}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
                  style={{ width: `${(stepIndex / steps.length) * 100}%` }}
                />
              </div>
              <div className="space-y-1.5 pt-1">
                {steps.map((st, idx) => {
                  const isPast = idx < stepIndex;
                  const isCurrent = idx === stepIndex;
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 p-1.5 rounded text-xs transition-colors ${
                        isCurrent
                          ? 'bg-sky-950 text-cyan-300 border border-sky-800'
                          : isPast
                          ? 'text-slate-300'
                          : 'text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isPast ? (
                          <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                        ) : isCurrent ? (
                          <Loader2 size={13} className="animate-spin text-cyan-400 shrink-0" />
                        ) : (
                          <div className="w-3 h-3 rounded-full border border-slate-700 shrink-0" />
                        )}
                        <span className="font-medium">{st.label}</span>
                      </div>
                      <span className="text-[10px] font-mono opacity-80 pl-5 sm:pl-0">{st.detail}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {stage === 'done' && (
            <div className="p-4 rounded-xl bg-[#050e1d] border border-emerald-500/50 space-y-3 shadow-lg animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src="/images/avatar-john.jpg"
                    alt={primaryProfile.fullName}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-500 shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-bold text-white">{primaryProfile.fullName}</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        100% Match
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                      <span>ID: {primaryProfile.idNumber}</span>
                      <span>·</span>
                      <span>DOB: {primaryProfile.dob}</span>
                    </div>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Risk Score</span>
                  <span className="text-xl font-black text-emerald-400 font-mono">92/100</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-sky-950">
                {[
                  { Logo: KraLogo, label: 'KRA: Valid' },
                  { Logo: MpesaLogo, label: 'M-PESA: Active' },
                  { Logo: CrbLogo, label: 'CRB: Clean' },
                  { Logo: KplcLogo, label: 'KPLC: Verified' },
                ].map(({ Logo, label }) => (
                  <div key={label} className="p-1.5 rounded bg-[#071322] border border-sky-900 flex items-center gap-1.5">
                    <Logo size={16} />
                    <span className="text-[10px] text-slate-200 truncate">{label}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="px-3 py-2 rounded-lg border border-sky-800 text-slate-300 text-xs hover:bg-sky-950"
                >
                  Close
                </button>
                {onViewProfile && (
                  <button
                    onClick={onViewProfile}
                    className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                  >
                    Open Full Profile Dossier →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
