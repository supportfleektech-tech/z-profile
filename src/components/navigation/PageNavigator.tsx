import React, { useState } from 'react';
import { useAppRouter } from '../../context/RouterContext';
import { platformRoutes, PageRoute } from '../../types/routes';
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
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

export const PageNavigator: React.FC = () => {
  const { currentPath, navigate } = useAppRouter();
  const [isOpen, setIsOpen] = useState(false);

  const getRouteIcon = (iconName: string) => {
    switch (iconName) {
      case 'LogIn':
        return <LogIn size={13} />;
      case 'LayoutDashboard':
        return <LayoutDashboard size={13} />;
      case 'Search':
        return <Search size={13} />;
      case 'UserCheck':
        return <UserCheck size={13} />;
      case 'FileBarChart2':
        return <FileBarChart2 size={13} />;
      case 'Briefcase':
        return <Briefcase size={13} />;
      case 'BarChart3':
        return <BarChart3 size={13} />;
      case 'CreditCard':
        return <CreditCard size={13} />;
      case 'Shield':
        return <Shield size={13} />;
      case 'Server':
        return <Server size={13} />;
      case 'Layers':
        return <Layers size={13} />;
      case 'Code2':
        return <Code2 size={13} />;
      case 'UserCog':
        return <UserCog size={13} />;
      case 'Bell':
        return <Bell size={13} />;
      case 'Smartphone':
        return <Smartphone size={13} />;
      case 'LayoutGrid':
        return <LayoutGrid size={13} />;
      default:
        return <ChevronRight size={13} />;
    }
  };

  const currentRoute: PageRoute =
    platformRoutes.find((r: PageRoute) => r.path === currentPath) || platformRoutes[1];

  return (
    <div className="w-full bg-[#040a14] border-b border-sky-950/90 py-2 px-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
        {/* Current Active Page Pill with Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#081527] border border-cyan-500/40 hover:border-cyan-400 text-slate-100 text-xs font-medium transition-all shadow-[0_0_12px_rgba(6,182,212,0.2)]"
          >
            <span className="text-cyan-400">{getRouteIcon(currentRoute.icon)}</span>
            <span className="font-semibold text-white">{currentRoute.title}</span>
            <span className="text-[10px] text-slate-400 hidden md:inline">({currentRoute.path})</span>
            <ChevronDown size={13} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <div className="absolute left-0 mt-2 w-72 sm:w-80 bg-[#071322] border border-cyan-500/50 rounded-xl shadow-2xl p-2 z-50 animate-fadeIn max-h-[75vh] overflow-y-auto">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-sky-900/60 mb-1 flex justify-between">
                <span>Select Platform Page</span>
                <span className="text-cyan-400 font-mono">16 Routes</span>
              </div>

              <div className="space-y-0.5">
                {platformRoutes.map((route: PageRoute) => {
                  const isActive = route.path === currentPath;
                  return (
                    <a
                      key={route.id}
                      href={`#${route.path}`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(route.path);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-semibold'
                          : 'text-slate-300 hover:bg-sky-950/60 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={isActive ? 'text-white' : 'text-cyan-400'}>
                          {getRouteIcon(route.icon)}
                        </span>
                        <span className="truncate">{route.title}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 ml-1 shrink-0">
                        {route.path}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Quick Horizontal Page Chips */}
        <div className="hidden lg:flex items-center gap-1 overflow-x-auto text-xs py-0.5">
          {[
            { label: 'Login', path: '/login' },
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Search', path: '/search' },
            { label: 'Profile', path: '/identity-profile' },
            { label: 'Report', path: '/report' },
            { label: 'Cases', path: '/cases' },
            { label: 'Analytics', path: '/analytics' },
            { label: 'Billing', path: '/billing' },
            { label: 'Admin', path: '/admin' },
            { label: 'Providers', path: '/providers' },
            { label: 'Pricing', path: '/pricing' },
            { label: 'API Docs', path: '/api-docs' },
          ].map((item) => {
            const isSelected = currentPath === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-sky-950/40'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Poster Blueprint Mode Link */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/blueprint')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              currentPath === '/blueprint'
                ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]'
                : 'bg-sky-950/80 hover:bg-sky-900/80 border border-sky-800 text-cyan-300'
            }`}
          >
            <LayoutGrid size={12} />
            <span className="font-semibold">All-in-One Blueprint</span>
          </button>
        </div>
      </div>
    </div>
  );
};
