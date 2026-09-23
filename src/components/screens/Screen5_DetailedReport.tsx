import React, { useState } from 'react';
import { Download, CheckCircle2, ChevronRight, ShieldCheck, Printer } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';

export const Screen5_DetailedReport: React.FC = () => {
  const { activeProfile, pushToast } = useAppData();
  const [reportTab, setReportTab] = useState<'Summary' | 'Full Report'>('Summary');
  const [selectedSection, setSelectedSection] = useState('Personal Details');
  const [downloading, setDownloading] = useState(false);

  const profile = activeProfile;
  const score = profile.riskScore;
  const circumference = 2 * Math.PI * 40;
  const offset = circumference * (1 - score / 100);

  const sections = [
    'Personal Details',
    'KRA Records',
    'M-PESA KYC',
    'CRB Records',
    'Employer Verification',
    'KPLC Records',
    'Connections',
    'Financial Analysis',
  ];

  const handleDownload = () => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      pushToast({
        title: 'Report downloaded',
        description: `IPRS-R-2026-${profile.idNumber}.pdf ready`,
        type: 'success',
      });
    }, 1100);
  };

  const handlePrint = () => {
    pushToast({ title: 'Opening print dialog', description: 'Optimized report layout', type: 'info' });
    setTimeout(() => window.print(), 300);
  };

  return (
    <div className="w-full h-full min-h-[420px] bg-[#071120] text-slate-100 rounded-xl overflow-hidden border border-sky-900/40 flex flex-col text-xs">
      <div className="px-3 sm:px-4 py-2.5 bg-[#091629] border-b border-sky-900/40 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck size={16} className="text-cyan-400 shrink-0" />
          <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
            Identity Report <span className="text-slate-400 font-normal">| {profile.fullName}</span>
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-[#050b14] p-0.5 rounded-lg border border-sky-900/60 text-[10px]">
            {(['Summary', 'Full Report'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setReportTab(t)}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  reportTab === t ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            onClick={handlePrint}
            className="p-1.5 rounded-lg border border-sky-800 text-slate-400 hover:text-white hover:bg-sky-950 transition-colors no-print"
            title="Print"
          >
            <Printer size={14} />
          </button>

          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-[10px] shadow-[0_0_10px_rgba(2,132,199,0.4)] transition-all active:scale-95 disabled:opacity-60 no-print"
          >
            {downloading ? (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Download size={11} />
            )}
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      <div className="flex-1 p-3 sm:p-4 grid grid-cols-1 md:grid-cols-12 gap-3 overflow-y-auto">
        <div className="md:col-span-8 space-y-3">
          <div className="bg-[#091629] p-4 rounded-xl border border-sky-900/40 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke="#0f2238" strokeWidth="8" fill="none" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#10b981"
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  fill="none"
                  className="drop-shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-white font-mono">{score}%</span>
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                  {profile.trustLevel} Risk
                </span>
              </div>
            </div>

            <div className="flex-1 text-center sm:text-left">
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
                National Risk Score
              </span>
              <h3 className="text-sm sm:text-base font-bold text-emerald-400 mt-0.5">
                High Trustworthiness & Clean Record
              </h3>
              <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
                Subject has zero adverse listings across CRB TransUnion, active tax compliance with KRA, verified
                identity with Civil Registration, and validated utility residency via KPLC.
              </p>
            </div>
          </div>

          <div className="bg-[#091629] p-3 sm:p-4 rounded-xl border border-sky-900/40">
            <h3 className="text-xs font-semibold text-white pb-2 border-b border-sky-900/30">Key Findings</h3>
            <div className="mt-2 space-y-1.5">
              {profile.keyFindings.map((finding, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-lg bg-[#06101c] border border-sky-950/60 text-[11px]"
                >
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span className="text-slate-200">{finding}</span>
                </div>
              ))}
            </div>
          </div>

          {reportTab === 'Full Report' && (
            <div className="bg-[#091629] p-3 sm:p-4 rounded-xl border border-sky-900/40 animate-fade-in">
              <h3 className="text-xs font-semibold text-white pb-2 border-b border-sky-900/30">
                {selectedSection}
              </h3>
              <div className="mt-3 space-y-2 text-[11px] text-slate-300">
                <p>
                  Full dossier section for <strong className="text-white">{selectedSection}</strong> covering{' '}
                  {profile.fullName} (ID {profile.idNumber}).
                </p>
                <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                  <div className="p-2 rounded bg-[#050b14] border border-sky-950">
                    <div className="text-slate-500">Registry</div>
                    <div className="text-cyan-300">Verified</div>
                  </div>
                  <div className="p-2 rounded bg-[#050b14] border border-sky-950">
                    <div className="text-slate-500">Confidence</div>
                    <div className="text-emerald-300">99.7%</div>
                  </div>
                  <div className="p-2 rounded bg-[#050b14] border border-sky-950">
                    <div className="text-slate-500">Source</div>
                    <div className="text-slate-200">Spin Mobile API</div>
                  </div>
                  <div className="p-2 rounded bg-[#050b14] border border-sky-950">
                    <div className="text-slate-500">Timestamp</div>
                    <div className="text-slate-200">{new Date().toISOString().slice(0, 19)}Z</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-4 bg-[#091629] p-3 sm:p-4 rounded-xl border border-sky-900/40 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-semibold text-white pb-2 border-b border-sky-900/30">Report Sections</h3>
            <div className="mt-2 space-y-1">
              {sections.map((sec) => (
                <button
                  key={sec}
                  onClick={() => {
                    setSelectedSection(sec);
                    setReportTab('Full Report');
                  }}
                  className={`w-full p-2 rounded-lg text-[11px] flex items-center justify-between text-left transition-colors ${
                    selectedSection === sec && reportTab === 'Full Report'
                      ? 'bg-sky-600/30 text-cyan-300 font-medium border border-sky-500/40'
                      : 'hover:bg-[#06101c] text-slate-300 border border-transparent'
                  }`}
                >
                  <span className="truncate">{sec}</span>
                  <ChevronRight size={12} className="text-slate-500 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-sky-900/30 flex items-center justify-between text-[9px] text-slate-400">
            <span className="font-mono">Doc ID: IPRS-R-2026-{profile.idNumber}</span>
            <button onClick={handlePrint} className="text-slate-400 hover:text-slate-200 no-print">
              <Printer size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Screen5_DetailedReport;
