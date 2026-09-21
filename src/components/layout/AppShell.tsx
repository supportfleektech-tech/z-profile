import React, { useEffect } from 'react';
import {
  LogIn,
  LayoutDashboard,
  Search,
  UserCheck,
  FileBarChart2,
  Briefcase,
  BarChart3,
  CreditCard,
  Shield,
  Server,
  Layers,
  Code2,
  UserCog,
  Bell,
  Smartphone,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Command,
} from 'lucide-react';
import { useAppRouter } from '../../context/RouterContext';
import { useAppData } from '../../context/AppDataContext';
import { platformRoutes, PageRoute } from '../../types/routes';
import { IprsLogo } from '../common/IprsLogo';

const iconMap: Record<string, React.ReactNode> = {
  LogIn: <LogIn size={16} />,
  LayoutDashboard: <LayoutDashboard size={16} />,
  Search: <Search size={16} />,
  UserCheck: <UserCheck size={16} />,
  FileBarChart2: <FileBarChart2 size={16} />,
  Briefcase: <Briefcase size={16} />,
  BarChart3: <BarChart3 size={16} />,
  CreditCard: <CreditCard size={16} />,
  Shield: <Shield size={16} />,
  Server: <Server size={16} />,
  Layers: <Layers size={16} />,
  Code2: <Code2 size={16} />,
  UserCog: <UserCog size={16} />,
  Bell: <Bell size={16} />,
  Smartphone: <Smartphone size={16} />,
  LayoutGrid: <LayoutGrid size={16} />,
};

const categories = [
  { key: 'core', label: 'Core' },
  { key: 'operations', label: 'Operations' },
  { key: 'business', label: 'Business' },
  { key: 'system', label: 'System' },
] as const;

interface AppShellProps {
  children: React.ReactNode;
  onOpenCommandPalette: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({ children, onOpenCommandPalette }) => {
  const { currentPath, navigate } = useAppRouter();
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileMenuOpen,
    setMobileMenuOpen,
    unreadCount,
    currentUser,
  } = useAppData();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentPath, setMobileMenuOpen]);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setMobileMenuOpen]);

  const NavContent = ({ collapsed }: { collapsed: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className={`px-3 py-3 border-b border-sky-900/50 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed ? (
          <div onClick={() => navigate('/dashboard')} className="cursor-pointer">
            <IprsLogo size="sm" showSubtitle={false} />
          </div>
        ) : (
          <button onClick={() => navigate('/dashboard')} className="text-cyan-400 font-mono font-black text-sm">
            I
          </button>
        )}
        {!collapsed && (
          <button
            onClick={() => setSidebarCollapsed(true)}
            className="hidden lg:flex p-1 rounded text-slate-500 hover:text-white hover:bg-sky-950"
            title="Collapse sidebar"
          >
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

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

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {categories.map((cat) => {
          const routes = platformRoutes.filter((r: PageRoute) => r.category === cat.key);
          if (routes.length === 0) return null;
          return (
            <div key={cat.key}>
              {!collapsed && (
                <div className="px-2 mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  {cat.label}
                </div>
              )}
              <div className="space-y-0.5">
                {routes.map((route: PageRoute) => {
                  const isActive = currentPath === route.path;
                  const showBadge = route.id === 'notifications' && unreadCount > 0;
                  return (
                    <button
                      key={route.id}
                      onClick={() => navigate(route.path)}
                      title={collapsed ? route.shortTitle : undefined}
                      className={`w-full flex items-center gap-2.5 rounded-lg text-xs font-medium transition-all ${
                        collapsed ? 'justify-center px-2 py-2.5' : 'px-2.5 py-2'
                      } ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-600/90 to-blue-600/90 text-white shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                          : 'text-slate-400 hover:text-white hover:bg-sky-950/60'
                      }`}
                    >
                      <span className={`shrink-0 relative ${isActive ? 'text-white' : 'text-cyan-500/80'}`}>
                        {iconMap[route.icon] || <LayoutGrid size={16} />}
                        {showBadge && collapsed && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500" />
                        )}
                      </span>
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left truncate">{route.shortTitle}</span>
                          {showBadge && (
                            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                              {unreadCount}
                            </span>
                          )}
                          {route.moduleNumber && !showBadge && (
                            <span className={`text-[9px] font-mono ${isActive ? 'text-white/60' : 'text-slate-600'}`}>
                              {route.moduleNumber}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className={`border-t border-sky-900/50 p-2 ${collapsed ? 'flex justify-center' : ''}`}>
        {currentUser && (
          <button
            onClick={() => navigate('/profile')}
            className={`flex items-center gap-2.5 rounded-lg hover:bg-sky-950/60 transition-colors w-full ${
              collapsed ? 'p-1.5 justify-center' : 'p-2'
            }`}
          >
            <img
              src="/images/avatar-john.jpg"
              alt={currentUser.name}
              className="w-7 h-7 rounded-full object-cover ring-1 ring-cyan-500/40 shrink-0"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            {!collapsed && (
              <div className="text-left min-w-0">
                <div className="text-xs font-semibold text-white truncate">{currentUser.name}</div>
                <div className="text-[10px] text-cyan-400/80 truncate">{currentUser.role}</div>
              </div>
            )}
          </button>
        )}
      </div>
    </div>
  );

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
          >
            <ChevronRight size={12} />
          </button>
        )}
        <NavContent collapsed={sidebarCollapsed} />
      </aside>

      {/* Mobile drawer overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside
            className="absolute left-0 top-0 bottom-0 w-[280px] max-w-[85vw] bg-[#060e1c] border-r border-sky-800 shadow-2xl animate-slide-in-left flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-sky-900/50">
              <IprsLogo size="sm" showSubtitle={false} />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-sky-950"
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
            <div className="text-xs font-semibold text-white truncate">
              {platformRoutes.find((r) => r.path === currentPath)?.shortTitle || 'IPRS'}
            </div>
          </div>
          <button
            onClick={onOpenCommandPalette}
            className="p-2 rounded-lg bg-sky-950/80 border border-sky-800 text-slate-400 hover:text-cyan-300"
            aria-label="Search"
          >
            <Search size={16} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
};
