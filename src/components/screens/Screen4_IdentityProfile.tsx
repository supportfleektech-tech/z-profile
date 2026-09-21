import React, { useState } from 'react';
import { CheckCircle2, ShieldCheck, Download, Briefcase } from 'lucide-react';
import { KraLogo, MpesaLogo, CrbLogo, EmployerLogo, KplcLogo } from '../common/ProviderLogos';
import { useAppData } from '../../context/AppDataContext';
import { useAppRouter } from '../../context/RouterContext';

interface Screen4Props {
  onViewDetailedReport?: () => void;
}

export const Screen4_IdentityProfile: React.FC<Screen4Props> = ({ onViewDetailedReport }) => {
  const { activeProfile, lastSearchResult, addCase } = useAppData();
  const { navigate } = useAppRouter();
  const [activeTab, setActiveTab] = useState<'Overview' | 'Personal' | 'Financial' | 'Connections' | 'Logs'>('Overview');
  const profile = activeProfile;

  const handleCreateCase = () => {
    addCase({
      subject: profile.fullName,
      type: 'Full Background',
      priority: 'High',
      status: 'Open',
    });
    navigate('/cases');
  };

  const providers = [
    { key: 'kra', label: 'KRA', Logo: KraLogo, data: profile.providers.kra },
    { key: 'mpesa', label: 'M-PESA', Logo: MpesaLogo, data: profile.providers.mpesa },
    { key: 'crb', label: 'CRB', Logo: CrbLogo, data: profile.providers.crb },
    { key: 'employer', label: 'Employer', Logo: EmployerLogo, data: profile.providers.employer },
    { key: 'kplc', label: 'KPLC', Logo: KplcLogo, data: profile.providers.kplc },
  ];

  return (
    <div className="w-full h-full min-h-[420px] bg-[#071120] text-slate-100 rounded-xl overflow-hidden border border-sky-900/40 flex flex-col text-xs">
      {/* Header */}
      <div className="p-3 sm:p-4 bg-[#091629] border-b border-sky-900/40 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <img
              src={profile.avatarUrl}
              alt={profile.fullName}
              className="w-14 h-14 rounded-full object-cover ring-2 ring-cyan-500/50 shadow-md"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-[#091629] flex items-center justify-center">
              <CheckCircle2 size={10} className="text-white" />
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">{profile.fullName}</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1 shrink-0">
                <CheckCircle2 size={10} /> Verified
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400 mt-1 font-mono">
              <span>
                ID: <strong className="text-slate-200">{profile.idNumber}</strong>
              </span>
              <span className="text-slate-600">·</span>
              <span>
                DOB: <strong className="text-slate-200">{profile.dob}</strong>
              </span>
              <span className="text-slate-600">·</span>
              <span>
                Phone: <strong className="text-slate-200">{profile.phone}</strong>
              </span>
            </div>
            {lastSearchResult && (
              <div className="text-[10px] text-cyan-400/80 mt-0.5">
                Last verified {new Date(lastSearchResult.timestamp).toLocaleString('en-KE')}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCreateCase}
            className="px-3 py-1.5 rounded-lg bg-sky-950 hover:bg-sky-900 border border-sky-800 text-slate-200 text-[11px] font-medium transition-colors flex items-center gap-1.5"
          >
            <Briefcase size={12} /> Open Case
          </button>
          <button
            onClick={() => {
              if (onViewDetailedReport) onViewDetailedReport();
              else navigate('/report');
            }}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold transition-colors flex items-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
          >
            <Download size={12} /> Full Report
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-3 sm:px-4 bg-[#081527] border-b border-sky-900/40 flex gap-1 sm:gap-2 overflow-x-auto">
        {(['Overview', 'Personal', 'Financial', 'Connections', 'Logs'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-2 px-3 border-b-2 font-medium text-[11px] transition-all whitespace-nowrap ${
              activeTab === tab
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto">
        {/* Personal details */}
        <div className="bg-[#091629] p-3 sm:p-4 rounded-xl border border-sky-900/40 flex flex-col">
          <h3 className="text-xs font-semibold text-white pb-2 border-b border-sky-900/30 flex items-center justify-between">
            <span>Personal Details</span>
            <ShieldCheck size={13} className="text-cyan-400" />
          </h3>

          <div className="divide-y divide-sky-950/60 mt-2 space-y-0 text-[11px] flex-1">
            {[
              ['Full Name', profile.fullName],
              ['Gender', profile.gender],
              ['Date of Birth', profile.dob],
              ['Nationality', profile.nationality],
              ['County', profile.county],
              ['KRA PIN', profile.kraPin],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-2 gap-2">
                <span className="text-slate-400 shrink-0">{label}</span>
                <span className={`font-semibold text-right ${label === 'KRA PIN' ? 'font-mono text-cyan-400' : 'text-white'}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-2 border-t border-sky-900/30 flex items-center gap-1.5 text-[10px] text-emerald-400">
            <CheckCircle2 size={12} />
            <span>National Identity Registry match confirmed</span>
          </div>
        </div>

        {/* Verification status */}
        <div className="bg-[#091629] p-3 sm:p-4 rounded-xl border border-sky-900/40 flex flex-col">
          <div className="flex items-center justify-between pb-2 border-b border-sky-900/30">
            <h3 className="text-xs font-semibold text-white">Verification Status</h3>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400">Risk</span>
              <span className="text-sm font-black font-mono text-emerald-400">{profile.riskScore}%</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                {profile.riskLevel}
              </span>
            </div>
          </div>

          <div className="space-y-2 mt-3 flex-1">
            {providers.map(({ key, label, Logo, data }) => (
              <div
                key={key}
                className="flex items-center justify-between p-2 rounded-lg bg-[#06101c] border border-sky-900/50 hover:border-sky-800 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Logo size={22} />
                  <div>
                    <span className="font-medium text-slate-200 text-[11px] block">{label}</span>
                    <span className="text-[9px] text-slate-500">{data.status}</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 size={10} /> Verified
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 text-[9px] text-slate-400 text-right">
            Last verified via Spin Mobile · All registries green
          </div>
        </div>

        {/* Key findings full width on mobile when overview */}
        {activeTab === 'Overview' && (
          <div className="md:col-span-2 bg-[#091629] p-3 sm:p-4 rounded-xl border border-sky-900/40">
            <h3 className="text-xs font-semibold text-white pb-2 border-b border-sky-900/30">Key Findings</h3>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {profile.keyFindings.map((finding, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-lg bg-[#06101c] border border-sky-950/60 text-[11px]"
                >
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                  <span className="text-slate-200">{finding}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
