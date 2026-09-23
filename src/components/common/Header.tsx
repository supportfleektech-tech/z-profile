import React from 'react';
import { IprsLogo } from './IprsLogo';
import { KraLogo, MpesaLogo, CrbLogo, EmployerLogo, KplcLogo, SpinMobileLogo } from './ProviderLogos';
import { MoreHorizontal, Sparkles, Bell, Command, LogOut, Wallet, Server, Terminal, User } from 'lucide-react';
import { useAppRouter } from '../../context/RouterContext';
import { useAppData } from '../../context/AppDataContext';
import { TIER_META } from '../../auth/permissions';
import { KES } from '../../lib/format';

interface HeaderProps {
  onOpenLiveSearch: () => void;
  onOpenCommandPalette?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenLiveSearch, onOpenCommandPalette }) => {
  const { navigate } = useAppRouter();
  const { unreadCount, currentUser, roleLabel, wallet, can, logout, apiMode, providers, settings } = useAppData();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const tierMeta = currentUser ? TIER_META[currentUser.tier] : null;
  const healthyProviders = providers.filter((p) => p.enabled && p.status === 'Active').length;
  const liveGateway = apiMode === 'api' && settings.billing.cardGateway !== 'none';

  return (
    <header className="sticky top-0 z-40 w-full bg-[#050b14]/95 backdrop-blur-md border-b border-sky-950/80 shadow-[0_4px_24px_rgba(0,0,0,0.5)] safe-top no-print">
      <div className="w-full px-3 lg:px-5 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3">
        {/* Left brand */}
        <div className="flex items-center gap-3 lg:gap-5 min-w-0">
          <div onClick={() => navigate('/dashboard')} className="cursor-pointer shrink-0">
            <IprsLogo size="md" showSubtitle={false} />
          </div>

          <div className="hidden xl:block h-7 w-px bg-sky-800/40" />

          <div className="hidden lg:flex flex-col min-w-0">
            <h1 className="text-sm font-semibold text-sky-100 tracking-tight flex items-center gap-2 truncate">
              <span className="truncate">Kenya&apos;s Trusted Identity &amp; Background Intelligence</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse" />
                {settings.platform.maintenanceMode ? 'Maintenance' : 'Live'}
              </span>
            </h1>
            <p className="text-[11px] text-sky-300/60 font-medium">
              Verify <span className="text-sky-500">•</span> Investigate <span className="text-sky-500">•</span> Make Safer Decisions
            </p>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 justify-end min-w-0">
          {/* Backend mode chip */}
          <div
            onClick={() => can('settings.view') && navigate('/settings')}
            className={`hidden md:flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-mono uppercase tracking-wider transition-colors ${
              apiMode === 'api'
                ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-300 cursor-pointer hover:bg-emerald-950'
                : 'bg-amber-950/40 border-amber-800/50 text-amber-300'
            }`}
            title={apiMode === 'api' ? 'Connected to the Node + SQLite backend on :8787' : 'Running the in-browser adapter (backend offline)'}
          >
            <Terminal size={12} />
            <span>{apiMode === 'api' ? 'API' : 'Local'}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${apiMode === 'api' ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
          </div>

          {/* Gateway health */}
          <div
            onClick={() => can('providers.view') && navigate('/providers')}
            className="hidden lg:flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-sky-950/50 hover:bg-sky-900/60 border border-sky-800/50 cursor-pointer transition-colors"
            title={`${healthyProviders}/${providers.length} gateways healthy`}
          >
            <Server size={12} className={healthyProviders === providers.length ? 'text-emerald-400' : 'text-amber-400'} />
            <span className="text-[10px] font-mono text-slate-300">
              {healthyProviders}/{providers.length}
            </span>
          </div>

          {/* Spin Mobile — md+ */}
          <div
            onClick={() => can('providers.view') && navigate('/providers')}
            className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-sky-950/40 hover:bg-sky-900/50 border border-sky-800/40 cursor-pointer transition-colors"
            title="Provider gateways"
          >
            <SpinMobileLogo size={22} />
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-[11px] font-bold text-sky-100 leading-tight">Spin Mobile APIs</span>
              <span className="text-[9px] text-cyan-400/80 font-mono">Real-time · Secure</span>
            </div>
          </div>

          {/* Provider pills — lg+ */}
          <div
            onClick={() => can('providers.view') && navigate('/providers')}
            className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#071322] hover:bg-[#0b1c33] border border-sky-900/40 cursor-pointer transition-colors"
          >
            {[
              { Logo: KraLogo, name: 'KRA' },
              { Logo: MpesaLogo, name: 'M-PESA' },
              { Logo: CrbLogo, name: 'CRB' },
              { Logo: EmployerLogo, name: 'Employer' },
              { Logo: KplcLogo, name: 'KPLC' },
            ].map(({ Logo, name }) => (
              <div key={name} className="flex flex-col items-center" title={`${name} gateway`}>
                <div className="relative">
                  <Logo size={18} />
                  <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-[#071322]" />
                </div>
                <span className="text-[8px] font-medium text-slate-400 mt-0.5">{name}</span>
              </div>
            ))}
            <div className="hidden xl:flex flex-col items-center">
              <div className="w-[18px] h-[18px] rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400">
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
            aria-label="Open command palette"
          >
            <Command size={13} />
            <kbd className="hidden md:inline text-[9px] font-mono opacity-70">⌘K</kbd>
          </button>

          {/* Wallet balance */}
          {can('wallet.view.own') && (
            <button
              onClick={() => navigate('/wallet')}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-800/50 text-emerald-300 text-[11px] font-semibold transition-colors"
              title="Open wallet — top up with M-PESA or card"
            >
              <Wallet size={13} />
              <span className="font-mono">{KES(wallet.balance, { decimals: false })}</span>
              <span className="text-emerald-500/80 font-normal">+</span>
            </button>
          )}

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

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 pl-1 sm:pl-2 border-l border-sky-900/50 group"
              title="Account menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="relative shrink-0">
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white ring-2 ring-cyan-500/50 group-hover:ring-cyan-400 bg-gradient-to-br from-cyan-600 to-blue-700 transition-all">
                  {currentUser?.name
                    .split(' ')
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join('') ?? <User size={14} />}
                </span>
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#050b14]" />
              </span>
              <span className="hidden xl:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors leading-tight truncate max-w-[120px]">
                  {currentUser?.name ?? 'Guest'}
                </span>
                <span className="text-[10px] text-cyan-400/90 font-medium truncate max-w-[120px]">{roleLabel}</span>
              </span>
            </button>

            {menuOpen && currentUser && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 rounded-xl bg-[#071120] border border-sky-800/70 shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden animate-slide-up z-50"
              >
                <div className={`px-3 py-2.5 border-b border-sky-900/60 ${tierMeta?.accent ?? ''}`}>
                  <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
                  <div className="text-[10px] opacity-90 truncate">{currentUser.email}</div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${tierMeta?.badge ?? ''}`}>
                      {tierMeta?.label}
                    </span>
                    <span className="text-[9px] opacity-80 truncate">{roleLabel}</span>
                  </div>
                </div>
                <div className="p-1.5 space-y-0.5 text-xs">
                  {[
                    { label: 'Profile & security', path: '/profile', icon: <User size={13} />, show: true },
                    { label: 'My wallet', path: '/wallet', icon: <Wallet size={13} />, show: can('wallet.view.own') },
                    { label: 'Team & access', path: '/admin', icon: <Sparkles size={13} />, show: can('users.view') },
                    { label: 'System settings', path: '/settings', icon: <Command size={13} />, show: can('settings.view') },
                  ]
                    .filter((i) => i.show)
                    .map((i) => (
                      <button
                        key={i.path}
                        onClick={() => {
                          setMenuOpen(false);
                          navigate(i.path);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-sky-950/70 transition-colors"
                      >
                        <span className="text-cyan-400/80">{i.icon}</span>
                        {i.label}
                      </button>
                    ))}
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      logout('Signed out from header');
                      navigate('/login');
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-rose-300/90 hover:text-rose-200 hover:bg-rose-950/40 transition-colors"
                  >
                    <LogOut size={13} />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Live verify CTA */}
          {can('search.run') && (
            <button
              onClick={onOpenLiveSearch}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all hover:scale-105 active:scale-95 shrink-0"
            >
              <Sparkles size={13} className="text-cyan-100" />
              <span className="hidden sm:inline">Live Verification</span>
              <span className="sm:hidden">Verify</span>
            </button>
          )}

          {liveGateway === false && apiMode === 'api' && can('wallet.topup') && (
            <span className="hidden 2xl:inline-flex items-center gap-1 text-[9px] font-mono text-amber-400/80" title="Card gateway disabled in billing settings">
              <MoreHorizontal size={10} /> no card gateway
            </span>
          )}
        </div>
      </div>
    </header>
  );
};
