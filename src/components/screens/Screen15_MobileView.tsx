import React, { useState } from 'react';
import {
  Smartphone,
  CheckCircle2,
  Menu,
  Bell,
  Home,
  Search,
  Briefcase,
  FileText,
  User,
} from 'lucide-react';
import { IprsLogo } from '../common/IprsLogo';
import { KraLogo, MpesaLogo, CrbLogo, EmployerLogo, KplcLogo } from '../common/ProviderLogos';
import { useAppData } from '../../context/AppDataContext';
import { useAppRouter } from '../../context/RouterContext';

export const Screen15_MobileView: React.FC = () => {
  const { stats, activeProfile, unreadCount } = useAppData();
  const { navigate } = useAppRouter();
  const [activePhone, setActivePhone] = useState<'dash' | 'profile'>('dash');

  const PhoneChrome: React.FC<{ children: React.ReactNode; activeNav: string }> = ({
    children,
    activeNav,
  }) => (
    <div className="w-[170px] sm:w-[200px] h-[320px] sm:h-[360px] bg-[#071120] rounded-[28px] border-[3px] border-slate-700 p-1.5 shadow-2xl flex flex-col justify-between shrink-0 relative overflow-hidden">
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-16 h-3 bg-slate-800 rounded-full z-20 flex items-center justify-center">
        <span className="w-2 h-2 rounded-full bg-slate-900" />
      </div>
      <div className="pt-3.5 px-2 flex justify-between items-center text-[7px] text-slate-400 font-mono">
        <span>9:41</span>
        <div className="flex items-center gap-1">
          <span>5G</span>
          <div className="w-2.5 h-1.5 border border-slate-400 rounded-sm bg-slate-400" />
        </div>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">{children}</div>
      <div className="pt-1 pb-1.5 border-t border-sky-950 flex justify-around text-slate-400 text-[7px] bg-[#050b14]">
        {[
          { id: 'home', icon: Home, label: 'Home', path: '/dashboard' },
          { id: 'search', icon: Search, label: 'Search', path: '/search' },
          { id: 'cases', icon: Briefcase, label: 'Cases', path: '/cases' },
          { id: 'reports', icon: FileText, label: 'Reports', path: '/report' },
          { id: 'profile', icon: User, label: 'Profile', path: '/profile' },
        ].map((n) => (
          <button
            key={n.id}
            onClick={() => navigate(n.path)}
            className={`flex flex-col items-center gap-0.5 ${activeNav === n.id ? 'text-cyan-400' : ''}`}
          >
            <n.icon size={10} />
            <span>{n.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="w-full h-full min-h-[420px] bg-[#071120] text-slate-100 rounded-xl overflow-hidden border border-sky-900/40 flex flex-col text-xs">
      <div className="px-3 sm:px-4 py-2.5 bg-[#091629] border-b border-sky-900/40 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Smartphone size={15} className="text-cyan-400" />
          <h2 className="text-xs sm:text-sm font-bold text-white">Mobile Responsive View</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#050b14] p-0.5 rounded-lg border border-sky-900 text-[10px]">
            <button
              onClick={() => setActivePhone('dash')}
              className={`px-2 py-0.5 rounded-md ${activePhone === 'dash' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActivePhone('profile')}
              className={`px-2 py-0.5 rounded-md ${activePhone === 'profile' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}
            >
              Profile
            </button>
          </div>
          <span className="text-[10px] text-cyan-400 font-mono bg-sky-950/60 px-2 py-0.5 rounded border border-sky-900/60 hidden sm:inline">
            PWA Ready
          </span>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-6 flex items-center justify-center gap-4 sm:gap-8 bg-[#040913] overflow-x-auto">
        {/* Phone 1 */}
        <div className={`transition-all ${activePhone === 'dash' ? 'scale-100 opacity-100' : 'scale-95 opacity-70 sm:opacity-100 sm:scale-100'}`}>
          <PhoneChrome activeNav="home">
            <div className="mt-1 px-1.5 flex items-center justify-between">
              <IprsLogo size="sm" showSubtitle={false} />
              <div className="flex items-center gap-1.5 text-slate-300 relative">
                <Bell size={11} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 left-2 w-2 h-2 rounded-full bg-rose-500" />
                )}
                <Menu size={12} />
              </div>
            </div>
            <div className="px-1.5 py-1.5 space-y-1.5 overflow-hidden flex-1">
              <div className="text-[9px] font-bold text-white">Dashboard</div>
              <div className="grid grid-cols-2 gap-1 text-[7px]">
                <div className="bg-[#091629] p-1.5 rounded border border-sky-950">
                  <span className="text-slate-400 block text-[6px]">Total</span>
                  <span className="font-bold text-white text-[10px] font-mono">{stats.totalSearches.toLocaleString()}</span>
                </div>
                <div className="bg-[#091629] p-1.5 rounded border border-sky-950">
                  <span className="text-slate-400 block text-[6px]">Success</span>
                  <span className="font-bold text-emerald-400 text-[10px] font-mono">{stats.successful.toLocaleString()}</span>
                </div>
                <div className="bg-[#091629] p-1.5 rounded border border-sky-950">
                  <span className="text-slate-400 block text-[6px]">Failed</span>
                  <span className="font-bold text-rose-400 text-[10px] font-mono">{stats.failed}</span>
                </div>
                <div className="bg-[#091629] p-1.5 rounded border border-sky-950">
                  <span className="text-slate-400 block text-[6px]">Revenue</span>
                  <span className="font-bold text-cyan-300 text-[9px] font-mono">KES 482.6K</span>
                </div>
              </div>
              <div className="bg-[#091629] p-1.5 rounded border border-sky-950">
                <span className="text-[7px] text-slate-400 block">Searches Trend</span>
                <div className="w-full h-10 pt-1">
                  <svg className="w-full h-full" viewBox="0 0 100 30" preserveAspectRatio="none">
                    <path d="M 0 25 Q 25 15 50 18 T 100 5 L 100 30 L 0 30 Z" fill="#0284c7" opacity="0.3" />
                    <path d="M 0 25 Q 25 15 50 18 T 100 5" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>
              <button
                onClick={() => navigate('/search')}
                className="w-full py-1.5 rounded bg-cyan-600 text-white text-[8px] font-bold"
              >
                Start New Search
              </button>
            </div>
          </PhoneChrome>
        </div>

        {/* Phone 2 */}
        <div className={`transition-all ${activePhone === 'profile' ? 'scale-100 opacity-100' : 'scale-95 opacity-70 sm:opacity-100 sm:scale-100'}`}>
          <PhoneChrome activeNav="search">
            <div className="px-1.5 pt-1 text-center">
              <div className="relative inline-block">
                <img
                  src="/images/avatar-john.jpg"
                  alt={activeProfile.fullName}
                  className="w-10 h-10 rounded-full object-cover mx-auto ring-1 ring-cyan-400"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-1 ring-[#071120]" />
              </div>
              <h4 className="text-[9px] font-bold text-white mt-1 leading-tight">{activeProfile.fullName}</h4>
              <span className="text-[7px] text-slate-400 font-mono">ID: {activeProfile.idNumber}</span>
            </div>
            <div className="px-1.5 py-1.5 space-y-1 overflow-hidden flex-1">
              <div className="text-[8px] font-semibold text-slate-300">Registry Status</div>
              <div className="space-y-1 text-[7px]">
                {[
                  { Logo: KraLogo, name: 'KRA' },
                  { Logo: MpesaLogo, name: 'M-PESA' },
                  { Logo: CrbLogo, name: 'CRB' },
                  { Logo: EmployerLogo, name: 'Employer' },
                  { Logo: KplcLogo, name: 'KPLC' },
                ].map(({ Logo, name }) => (
                  <div
                    key={name}
                    className="flex items-center justify-between p-1 rounded bg-[#091629] border border-sky-950"
                  >
                    <div className="flex items-center gap-1">
                      <Logo size={12} />
                      <span className="text-slate-200">{name}</span>
                    </div>
                    <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                      <CheckCircle2 size={8} /> Verified
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </PhoneChrome>
        </div>
      </div>

      <div className="px-4 py-2 border-t border-sky-900/40 bg-[#081527]/50 text-center text-[10px] text-slate-400">
        Tap bottom nav icons to open the real pages · Designed for iOS & Android PWA
      </div>
    </div>
  );
};
export default Screen15_MobileView;
