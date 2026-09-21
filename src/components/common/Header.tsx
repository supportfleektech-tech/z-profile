import React from 'react';
import { IprsLogo } from './IprsLogo';
import { KraLogo, MpesaLogo, CrbLogo, EmployerLogo, KplcLogo, SpinMobileLogo } from './ProviderLogos';
import { MoreHorizontal, Sparkles, Bell, Command } from 'lucide-react';
import { useAppRouter } from '../../context/RouterContext';
import { useAppData } from '../../context/AppDataContext';

interface HeaderProps {
  onOpenLiveSearch: () => void;
  onOpenCommandPalette?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenLiveSearch, onOpenCommandPalette }) => {
  const { navigate } = useAppRouter();
  const { unreadCount, currentUser } = useAppData();

  return (
    <header className="sticky top-0 z-40 w-full bg-[#050b14]/95 backdrop-blur-md border-b border-sky-950/80 shadow-[0_4px_24px_rgba(0,0,0,0.5)] safe-top">
      <div className="w-full px-3 lg:px-5 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        {/* Left brand */}
        <div className="flex items-center gap-3 lg:gap-5 min-w-0">
          <div onClick={() => navigate('/dashboard')} className="cursor-pointer shrink-0">
            <IprsLogo size="md" showSubtitle={false} />
          </div>

          <div className="hidden xl:block h-7 w-px bg-sky-800/40" />

          <div className="hidden lg:flex flex-col min-w-0">
            <h1 className="text-sm font-semibold text-sky-100 tracking-tight flex items-center gap-2 truncate">
              <span className="truncate">Kenya&apos;s Trusted Identity & Background Intelligence</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse" />
                Live
              </span>
            </h1>
            <p className="text-[11px] text-sky-300/60 font-medium">
              Verify <span className="text-sky-500">•</span> Investigate <span className="text-sky-500">•</span> Make Safer Decisions
            </p>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
          {/* Spin Mobile — md+ */}
          <div
            onClick={() => navigate('/providers')}
            className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-sky-950/40 hover:bg-sky-900/50 border border-sky-800/40 cursor-pointer transition-colors"
            title="Provider Gateways"
          >
            <SpinMobileLogo size={22} />
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-[11px] font-bold text-sky-100 leading-tight">Spin Mobile APIs</span>
              <span className="text-[9px] text-cyan-400/80 font-mono">Real-time · Secure</span>
            </div>
          </div>

          {/* Provider pills — lg+ */}
          <div
            onClick={() => navigate('/providers')}
            className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#071322] hover:bg-[#0b1c33] border border-sky-900/40 cursor-pointer transition-colors"
          >
            {[
              { Logo: KraLogo, name: 'KRA', hover: 'group-hover:text-red-400' },
              { Logo: MpesaLogo, name: 'M-PESA', hover: 'group-hover:text-emerald-400' },
              { Logo: CrbLogo, name: 'CRB', hover: 'group-hover:text-cyan-400' },
              { Logo: EmployerLogo, name: 'Employer', hover: 'group-hover:text-blue-400' },
              { Logo: KplcLogo, name: 'KPLC', hover: 'group-hover:text-amber-400' },
            ].map(({ Logo, name, hover }) => (
              <div key={name} className="flex flex-col items-center group" title={`${name} connected`}>
                <div className="relative">
                  <Logo size={18} />
                  <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-[#071322]" />
                </div>
                <span className={`text-[8px] font-medium text-slate-400 ${hover} transition-colors mt-0.5`}>{name}</span>
              </div>
            ))}
            <div className="hidden xl:flex flex-col items-center">
              <div className="w-4.5 h-4.5 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400">
                <MoreHorizontal size={10} />
              </div>
              <span className="text-[8px] text-slate-500 mt-0.5">More</span>
            </div>
          </div>

          {/* Command palette */}
          <button
            onClick={onOpenCommandPalette}
            className="hidden sm:flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-sky-950/60 hover:bg-sky-900 border border-sky-800/60 text-slate-400 hover:text-cyan-300 text-[11px] transition-colors"
            title="Command palette (⌘K)"
          >
            <Command size={13} />
            <kbd className="hidden md:inline text-[9px] font-mono opacity-70">⌘K</kbd>
          </button>

          {/* Notifications */}
          <button
            onClick={() => navigate('/notifications')}
            className="relative p-2 rounded-lg bg-sky-950/60 hover:bg-sky-900 border border-sky-800/60 text-slate-400 hover:text-cyan-300 transition-colors"
            title="Notifications"
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-[#050b14]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* User */}
          <div
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2 pl-1 sm:pl-2 border-l border-sky-900/50 cursor-pointer group"
            title="Profile & Settings"
          >
            <div className="relative shrink-0">
              <img
                src="/images/avatar-john.jpg"
                alt={currentUser?.name || 'User'}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-cyan-500/50 group-hover:ring-cyan-400 transition-all"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#050b14]" />
            </div>
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors leading-tight">
                {currentUser?.name || 'John Kamau'}
              </span>
              <span className="text-[10px] text-cyan-400/90 font-medium">{currentUser?.role || 'Super Admin'}</span>
            </div>
          </div>

          {/* Live verify CTA */}
          <button
            onClick={onOpenLiveSearch}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all hover:scale-105 active:scale-95"
          >
            <Sparkles size={13} className="text-cyan-100" />
            <span className="hidden sm:inline">Test Verification</span>
            <span className="sm:hidden">Verify</span>
          </button>
        </div>
      </div>
    </header>
  );
};
