import React, { useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Menu, X, Command, LogOut, ShieldCheck, Wallet } from 'lucide-react';
import { useAppRouter } from '../../context/RouterContext';
import { useAppData } from '../../context/AppDataContext';
import { CATEGORY_LABELS, CATEGORY_ORDER, findRoute, platformRoutes, type PageRoute } from '../../types/routes';
import { TIER_META } from '../../auth/permissions';
import { IprsLogo } from '../common/IprsLogo';
import { iconAt } from '../../utils/iconRegistry';
import { KES } from '../../lib/format';

interface AppShellProps {
  children: React.ReactNode;
  onOpenCommandPalette: () => void;
}

/**
 * Application chrome. The sidebar is built from the route table filtered by the signed-in
 * tier *and* permission, so a User never sees Governance, an Admin never sees pricing
 * administration, and only a Super Admin sees the full platform.
 */
export const AppShell: React.FC<AppShellProps> = ({ children, onOpenCommandPalette }) => {
  const { currentPath, navigate } = useAppRouter();
  const { sidebarCollapsed, setSidebarCollapsed, mobileMenuOpen, setMobileMenuOpen, unreadCount, currentUser, can, wallet, logout, roleLabel } =
    useAppData();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentPath, setMobileMenuOpen]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setMobileMenuOpen]);

  const groups = useMemo(() => {
    const visible = (r: PageRoute) =>
      !r.public && currentUser && (!r.tiers || r.tiers.includes(currentUser.tier)) && (!r.permission || can(r.permission));
    return CATEGORY_ORDER.map((key) => ({
      key,
      label: CATEGORY_LABELS[key],
      routes: platformRoutes.filter((r) => r.category === key && visible(r)),
    })).filter((g) => g.routes.length > 0);
  }, [currentUser, can]);

  const tierMeta = currentUser ? TIER_META[currentUser.tier] : null;

  const NavContent = ({ collapsed }: { collapsed: boolean }) => (
    <div className="flex flex-col h-full min-h-0">
      {/* Brand */}
      <div className={`px-3 py-3 border-b border-sky-900/50 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed ? (
          <div onClick={() => navigate('/dashboard')} className="cursor-pointer min-w-0">
            <IprsLogo size="sm" showSubtitle={false} />
          </div>
        ) : (
          <button onClick={() => navigate('/dashboard')} className="text-cyan-400 font-mono font-black text-sm" title="Dashboard">
            I
          </button>
        )}
        {!collapsed && (
          <button
            onClick={() => setSidebarCollapsed(true)}
            className="hidden lg:flex p-1 rounded text-slate-500 hover:text-white hover:bg-sky-950"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      {/* Workspace identity */}
      {!collapsed && tierMeta && (
        <div className={`mx-2 mt-2 rounded-lg border p-2 ${tierMeta.accent}`}>
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={12} className="shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">{tierMeta.label} workspace</span>
          </div>
          <p className="text-[10px] leading-snug opacity-80 mt-1 line-clamp-2">{tierMeta.blurb}</p>
        </div>
      )}

      {/* Command palette trigger */}
      <div className="px-2 pt-2 pb-1">
        <button
          onClick={onOpenCommandPalette}
          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-sky-950/60 hover:bg-sky-900/70 border border-sky-800/50 text-slate-400 hover:text-cyan-300 text-xs transition-all ${
            collapsed ? 'justify-center' : ''
          }`}
          title="Command palette (⌘K)"
        >
          <Command size={14} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Quick jump…</span>
              <kbd className="text-[9px] font-mono px-1 rounded bg-[#050b14] border border-sky-900">⌘K</kbd>
            </>
          )}
        </button>
      </div>

      {/* Wallet balance shortcut */}
      {!collapsed && currentUser?.tier !== 'super_admin' && can('wallet.view.own') && (
        <button
          onClick={() => navigate('/wallet')}
          className="mx-2 mt-1.5 mb-1 flex items-center gap-2 rounded-lg border border-emerald-800/40 bg-emerald-950/25 px-2.5 py-2 text-left hover:bg-emerald-950/50 transition-colors"
        >
          <Wallet size={14} className="text-emerald-400 shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-[9px] uppercase tracking-wider text-emerald-500/80 font-semibold">Wallet</span>
            <span className="block text-xs font-bold text-emerald-300 truncate">{KES(wallet.balance, { decimals: false })}</span>
          </span>
          <span className="text-[9px] font-mono text-emerald-500/70">top up</span>
        </button>
      )}

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-3" aria-label="Primary">
        {groups.map((cat) => (
          <div key={cat.key}>
            {!collapsed && <div className="px-2 mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">{cat.label}</div>}
            {collapsed && <div className="my-2 h-px bg-sky-900/60" />}
            <div className="space-y-0.5">
              {cat.routes.map((route) => {
                const isActive = currentPath === route.path;
                const showBadge = route.id === 'notifications' && unreadCount > 0;
                return (
                  <button
                    key={route.id}
                    onClick={() => navigate(route.path)}
                    title={collapsed ? route.shortTitle : route.title}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full flex items-center gap-2.5 rounded-lg text-xs font-medium transition-all ${
                      collapsed ? 'justify-center px-2 py-2.5' : 'px-2.5 py-2'
                    } ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-600/90 to-blue-600/90 text-white shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                        : 'text-slate-400 hover:text-white hover:bg-sky-950/60'
                    }`}
                  >
                    <span className={`shrink-0 relative ${isActive ? 'text-white' : 'text-cyan-500/80'}`}>
                      {iconAt(route.icon)}
                      {showBadge && collapsed && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500" />}
                    </span>
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left truncate">{route.shortTitle}</span>
                        {showBadge && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                            {unreadCount}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className={`border-t border-sky-900/50 p-2 space-y-1 ${collapsed ? 'flex flex-col items-center' : ''}`}>
        {currentUser && (
          <button
            onClick={() => navigate('/profile')}
            className={`flex items-center gap-2.5 rounded-lg hover:bg-sky-950/60 transition-colors w-full ${collapsed ? 'p-1.5 justify-center' : 'p-2'}`}
            title={`${currentUser.name} — ${roleLabel}`}
          >
            <span className="w-7 h-7 rounded-full ring-1 ring-cyan-500/40 shrink-0 flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-br from-cyan-600 to-blue-700">
              {currentUser.name
                .split(' ')
                .map((p) => p[0])
                .slice(0, 2)
                .join('')}
            </span>
            {!collapsed && (
              <span className="text-left min-w-0 flex-1">
                <span className="block text-xs font-semibold text-white truncate">{currentUser.name}</span>
                <span className="block text-[10px] text-cyan-400/80 truncate">{roleLabel}</span>
              </span>
            )}
          </button>
        )}
        {!collapsed && (
          <button
            onClick={() => logout('Signed out from sidebar')}
            className="w-full flex items-center gap-2.5 rounded-lg p-2 text-xs font-medium text-slate-500 hover:text-rose-300 hover:bg-rose-950/30 transition-colors"
            title="Sign out"
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        )}
      </div>
    </div>
  );

  const currentRoute = findRoute(currentPath);

  return (
    <div className="flex flex-1 min-h-0 relative">
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-[#060e1c] border-r border-sky-950/80 transition-all duration-300 ease-out ${
          sidebarCollapsed ? 'w-[60px]' : 'w-[240px]'
        }`}
      >
        {sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="absolute top-3 left-[48px] z-10 p-1 rounded-r-md bg-sky-950 border border-l-0 border-sky-800 text-slate-400 hover:text-white hidden lg:flex"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <ChevronRight size={12} />
          </button>
        )}
        <NavContent collapsed={sidebarCollapsed} />
      </aside>

      {/* Mobile drawer overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setMobileMenuOpen(false)}>
          <aside
            className="absolute left-0 top-0 bottom-0 w-[280px] max-w-[85vw] bg-[#060e1c] border-r border-sky-800 shadow-2xl animate-slide-in-left flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-sky-900/50">
              <IprsLogo size="sm" showSubtitle={false} />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-sky-950"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <NavContent collapsed={false} />
            </div>
          </aside>
        </div>
      )}

      {/* Main content column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Mobile top bar with hamburger */}
        <div className="lg:hidden flex items-center gap-2 px-3 py-2 bg-[#060e1c] border-b border-sky-950/80">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg bg-sky-950/80 border border-sky-800 text-cyan-300 hover:bg-sky-900"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">{currentRoute?.shortTitle ?? 'IPRS'}</div>
            {tierMeta && <div className="text-[9px] uppercase tracking-wider text-slate-500 truncate">{tierMeta.label} workspace</div>}
          </div>
          <button
            onClick={onOpenCommandPalette}
            className="p-2 rounded-lg bg-sky-950/80 border border-sky-800 text-slate-400 hover:text-cyan-300"
            aria-label="Command palette"
          >
            <Command size={16} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
};
