import React, { useState } from 'react';
import {
  Search,
  RotateCcw,
  User,
  CreditCard,
  Phone,
  Mail,
  ShieldAlert,
  Loader2,
  Calendar,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { IprsLogo } from '../common/IprsLogo';
import { useAppData } from '../../context/AppDataContext';
import { primaryProfile } from '../../data/mockData';

interface Screen3NewSearchProps {
  onExecuteSearch?: (query: { name: string; idNumber: string; phone: string }) => void;
}

export const Screen3_NewSearch: React.FC<Screen3NewSearchProps> = ({ onExecuteSearch }) => {
  const { setLastSearchResult, pushToast, addActivity } = useAppData();
  const [activeTab, setActiveTab] = useState<'Identity' | 'Phone' | 'M-PESA' | 'CRB' | 'Employer' | 'KPLC'>('Identity');
  const [fullName, setFullName] = useState('John Mwangi Kamau');
  const [idNumber, setIdNumber] = useState('23456789');
  const [phone, setPhone] = useState('0712345678');
  const [dob, setDob] = useState('1990-05-15');
  const [county, setCounty] = useState('Nairobi');
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');

  const tabs = ['Identity', 'Phone', 'M-PESA', 'CRB', 'Employer', 'KPLC'] as const;

  const runSearch = async () => {
    if (!idNumber.trim() && !phone.trim() && !fullName.trim()) {
      pushToast({ title: 'Missing input', description: 'Enter at least a name, ID, or phone', type: 'warning' });
      return;
    }

    setIsSearching(true);
    setProgress(0);
    const steps = [
      'Connecting to Spin Mobile gateway…',
      'Querying Civil Registration…',
      'Checking KRA compliance…',
      'Cross-referencing M-PESA KYC…',
      'Validating CRB & utilities…',
      'Building identity dossier…',
    ];

    for (let i = 0; i < steps.length; i++) {
      setStatusMsg(steps[i]);
      setProgress(Math.round(((i + 1) / steps.length) * 100));
      await new Promise((r) => setTimeout(r, 380));
    }

    const result = {
      query: idNumber || phone || fullName,
      profile: {
        ...primaryProfile,
        fullName: fullName || primaryProfile.fullName,
        idNumber: idNumber || primaryProfile.idNumber,
        phone: phone || primaryProfile.phone,
        county: county || primaryProfile.county,
      },
      timestamp: new Date().toISOString(),
      riskScore: primaryProfile.riskScore,
    };

    setLastSearchResult(result);
    addActivity(`Identity Report - ${result.profile.fullName}`, 'identity');
    pushToast({
      title: 'Search complete',
      description: `${result.profile.fullName} verified · Risk ${result.riskScore}%`,
      type: 'success',
    });
    setIsSearching(false);
    setStatusMsg('');
    setProgress(0);

    onExecuteSearch?.({ name: result.profile.fullName, idNumber: result.profile.idNumber, phone: result.profile.phone });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch();
  };

  const handleReset = () => {
    setFullName('');
    setIdNumber('');
    setPhone('');
    setDob('');
    setCounty('');
    setStatusMsg('');
    setProgress(0);
  };

  const handleQuickSearch = (type: string) => {
    if (type === 'id') {
      setIdNumber('23456789');
      setFullName('John Mwangi Kamau');
      setPhone('0712345678');
    } else if (type === 'phone') {
      setPhone('0712345678');
      setFullName('John Mwangi Kamau');
      setIdNumber('23456789');
    } else if (type === 'name') {
      setFullName('Grace Wanjiku');
      setIdNumber('28941042');
      setPhone('0723456789');
    } else if (type === 'email') {
      setFullName('Peter Kimani');
      setIdNumber('31204921');
      setPhone('0734567890');
    }
  };

  return (
    <div className="w-full h-full min-h-[420px] bg-[#071120] text-slate-100 rounded-xl overflow-hidden border border-sky-900/40 flex flex-col text-xs">
      <div className="px-3 sm:px-4 py-2.5 bg-[#050b14] border-b border-sky-900/40 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <IprsLogo size="sm" showSubtitle={false} />
          <span className="text-xs sm:text-sm font-semibold text-white">Start a New Search</span>
        </div>
        <span className="text-[10px] text-cyan-400 font-mono bg-sky-950/60 px-2 py-0.5 rounded border border-sky-900/60 flex items-center gap-1">
          <ShieldAlert size={11} /> National Registry Ready
        </span>
      </div>

      <div className="px-3 sm:px-4 pt-2.5 pb-2 bg-[#081527] border-b border-sky-900/40 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                activeTab === tab
                  ? 'bg-sky-600 text-white shadow-[0_0_10px_rgba(2,132,199,0.5)] font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-sky-950/40'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-3 sm:p-4 grid grid-cols-1 md:grid-cols-12 gap-3 overflow-y-auto">
        <form onSubmit={handleSearch} className="md:col-span-8 bg-[#091629] p-3 sm:p-4 rounded-xl border border-sky-900/40 space-y-3">
          <h3 className="text-xs font-semibold text-white pb-1.5 border-b border-sky-900/30 flex items-center justify-between gap-2 flex-wrap">
            <span>Search Information — {activeTab}</span>
            <span className="text-[10px] text-slate-400 font-normal">Encrypted via Spin Mobile</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-slate-300 mb-1">Full Name</label>
              <div className="relative">
                <User size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. John Mwangi"
                  className="w-full bg-[#050b14] border border-sky-900/70 rounded-lg py-2 pl-8 pr-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-300 mb-1">ID Number</label>
              <div className="relative">
                <CreditCard size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="e.g. 12345678"
                  className="w-full bg-[#050b14] border border-sky-900/70 rounded-lg py-2 pl-8 pr-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-300 mb-1">Phone Number</label>
              <div className="relative">
                <Phone size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07xx xxx xxx"
                  className="w-full bg-[#050b14] border border-sky-900/70 rounded-lg py-2 pl-8 pr-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-300 mb-1">Date of Birth</label>
              <div className="relative">
                <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full bg-[#050b14] border border-sky-900/70 rounded-lg py-2 pl-8 pr-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-slate-300 mb-1">County</label>
            <div className="relative">
              <MapPin size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={county}
                onChange={(e) => setCounty(e.target.value)}
                className="w-full bg-[#050b14] border border-sky-900/70 rounded-lg py-2 pl-8 pr-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              >
                {['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Kiambu', 'Machakos', 'Uasin Gishu'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {isSearching && (
            <div className="p-3 rounded-lg bg-[#050b14] border border-cyan-500/30 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-cyan-300 flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  {statusMsg}
                </span>
                <span className="font-mono text-slate-400">{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <button
              type="submit"
              disabled={isSearching}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-semibold text-[11px] flex items-center gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.4)] transition-all active:scale-95"
            >
              {isSearching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              <span>{isSearching ? 'Searching…' : 'Search'}</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={isSearching}
              className="px-3 py-2 rounded-lg border border-sky-900/80 hover:bg-sky-950/50 text-slate-300 text-[11px] flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          </div>
        </form>

        <div className="md:col-span-4 bg-[#091629] p-3 sm:p-4 rounded-xl border border-sky-900/40 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-semibold text-white pb-1.5 border-b border-sky-900/30">Quick Searches</h3>
            <div className="mt-2.5 space-y-2">
              {[
                { type: 'id', label: 'Search by ID', icon: CreditCard, color: 'text-cyan-400' },
                { type: 'phone', label: 'Search by Phone', icon: Phone, color: 'text-emerald-400' },
                { type: 'name', label: 'Search by Name', icon: User, color: 'text-blue-400' },
                { type: 'email', label: 'Search by Email', icon: Mail, color: 'text-amber-400' },
              ].map((q) => (
                <button
                  key={q.type}
                  type="button"
                  onClick={() => handleQuickSearch(q.type)}
                  disabled={isSearching}
                  className="w-full py-2 px-2.5 rounded-lg bg-[#050b14] hover:bg-sky-950/70 border border-sky-900/50 text-slate-200 text-[11px] flex items-center gap-2 transition-all hover:border-cyan-500/50 text-left disabled:opacity-50"
                >
                  <q.icon size={14} className={`${q.color} shrink-0`} />
                  <span className="truncate">{q.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-sky-900/30 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
              <CheckCircle2 size={12} />
              <span>AES-256 encrypted query tokens</span>
            </div>
            <p className="text-[9px] text-slate-500 leading-relaxed">
              All lookups are logged for audit. Results route to the Identity Profile dossier with multi-provider verification status.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
