import React from 'react';
import {
  LayoutDashboard,
  Search,
  Briefcase,
  UserCheck,
  FileBarChart2,
  CreditCard,
  Users,
  Settings,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  ArrowRight,
  Bell,
} from 'lucide-react';
import { IprsLogo } from '../common/IprsLogo';
import { KraLogo, MpesaLogo, CrbLogo, KplcLogo } from '../common/ProviderLogos';
import { useAppData } from '../../context/AppDataContext';
import { useAppRouter } from '../../context/RouterContext';

interface Screen2DashboardProps {
  onNavigateToSearch?: () => void;
  onNavigateToCases?: () => void;
  onNavigateToProfile?: () => void;
}

export const Screen2_Dashboard: React.FC<Screen2DashboardProps> = ({
  onNavigateToSearch,
  onNavigateToCases,
  onNavigateToProfile,
}) => {
  const { stats, activities, cases, unreadCount, currentUser } = useAppData();
  const { navigate } = useAppRouter();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const nowStr = new Date().toLocaleString('en-KE', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const go = (path: string, fallback?: () => void) => {
    if (fallback) fallback();
    else navigate(path);
  };

  const openCases = cases.filter((c) => c.status === 'Open' || c.status === 'In Progress').length;

  return (
    <div className="w-full h-full min-h-[420px] bg-[#071120] text-slate-100 rounded-xl overflow-hidden border border-sky-900/40 flex flex-col md:flex-row text-xs">
      {/* Mini Sidebar — desktop */}
      <div className="hidden sm:flex flex-col w-32 lg:w-36 bg-[#050b14] border-r border-sky-900/40 p-2.5 shrink-0 justify-between">
        <div>
          <div className="pb-3 border-b border-sky-900/40 flex items-center justify-center">
            <IprsLogo size="sm" showSubtitle={false} />
          </div>
          <nav className="mt-3 space-y-1">
            {[
              { label: 'Dashboard', icon: LayoutDashboard, active: true, path: '/dashboard' },
              { label: 'New Search', icon: Search, path: '/search', fn: onNavigateToSearch },
              { label: 'Cases', icon: Briefcase, path: '/cases', fn: onNavigateToCases, badge: openCases },
              { label: 'Profiles', icon: UserCheck, path: '/identity-profile', fn: onNavigateToProfile },
              { label: 'Reports', icon: FileBarChart2, path: '/analytics' },
              { label: 'Billing', icon: CreditCard, path: '/billing' },
              { label: 'Users', icon: Users, path: '/admin' },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => go(item.path, item.fn)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-left transition-colors ${
                  item.active
                    ? 'bg-sky-600/30 text-cyan-300 font-semibold border border-sky-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-sky-950/40'
                }`}
              >
                <item.icon size={13} className={item.active ? 'text-cyan-400' : ''} />
                <span className="truncate flex-1">{item.label}</span>
                {item.badge ? (
                  <span className="text-[9px] font-bold bg-cyan-500/20 text-cyan-300 px-1 rounded">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
        </div>
        <button
          onClick={() => navigate('/profile')}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-sky-950/40 text-[11px]"
        >
          <Settings size={13} />
          <span>Settings</span>
        </button>
      </div>

      {/* Main */}
      <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3.5 bg-gradient-to-br from-[#071120] to-[#040913]">
        {/* Greeting */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-sky-900/30">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-1.5">
              <span>
                {greeting}, {currentUser?.name?.split(' ')[0] || 'John'}
              </span>
              <span className="text-amber-400">👋</span>
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
              Here&apos;s what&apos;s happening with your platform today.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={() => navigate('/notifications')}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] font-semibold hover:bg-rose-500/20 transition-colors"
              >
                <Bell size={12} />
                {unreadCount} new
              </button>
            )}
            <div className="text-[10px] text-sky-300/80 font-mono bg-sky-950/50 px-2.5 py-1 rounded-lg border border-sky-900/50">
              {nowStr}
            </div>
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {[
            {
              label: 'Total Searches',
              value: stats.totalSearches.toLocaleString(),
              delta: '+12%',
              up: true,
              sub: 'vs last 7 days',
              onClick: () => go('/search', onNavigateToSearch),
            },
            {
              label: 'Successful',
              value: stats.successful.toLocaleString(),
              delta: '+15%',
              up: true,
              sub: '94.8% success rate',
              color: 'text-emerald-400',
              onClick: () => go('/analytics'),
            },
            {
              label: 'Failed',
              value: String(stats.failed),
              delta: '-8%',
              up: false,
              sub: 'Timeout / Invalid ID',
              color: 'text-rose-400',
              onClick: () => go('/analytics'),
            },
            {
              label: 'Revenue',
              value: stats.revenue,
              delta: '+22%',
              up: true,
              sub: 'MTD Billing',
              color: 'text-cyan-300',
              onClick: () => go('/billing'),
            },
          ].map((card) => (
            <button
              key={card.label}
              onClick={card.onClick}
              className="text-left bg-[#091629] p-3 rounded-xl border border-sky-900/40 hover:border-cyan-500/40 card-lift transition-colors"
            >
              <span className="text-[10px] text-slate-400 font-medium block">{card.label}</span>
              <div className="flex items-baseline justify-between mt-1 gap-1">
                <span className={`text-base sm:text-lg font-bold font-mono ${card.color || 'text-white'}`}>
                  {card.value}
                </span>
                <span
                  className={`text-[10px] font-semibold flex items-center gap-0.5 shrink-0 ${
                    card.up ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {card.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {card.delta}
                </span>
              </div>
              <span className="text-[9px] text-slate-500 block mt-0.5">{card.sub}</span>
            </button>
          ))}
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => go('/search', onNavigateToSearch)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold shadow-[0_0_12px_rgba(6,182,212,0.35)] transition-all active:scale-95"
          >
            <Search size={12} /> Start New Search
          </button>
          <button
            onClick={() => go('/cases', onNavigateToCases)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-950 hover:bg-sky-900 border border-sky-800 text-slate-200 text-[11px] font-medium transition-colors"
          >
            <Briefcase size={12} /> View Cases ({openCases} open)
          </button>
          <button
            onClick={() => go('/analytics')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-950 hover:bg-sky-900 border border-sky-800 text-slate-200 text-[11px] font-medium transition-colors"
          >
            <FileBarChart2 size={12} /> Analytics
          </button>
        </div>

        {/* Chart + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 sm:gap-3">
          <div className="lg:col-span-7 bg-[#091629] p-3 sm:p-4 rounded-xl border border-sky-900/40 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white">Searches Trend</span>
              <span className="text-[10px] text-cyan-400 font-mono">Last 7 days</span>
            </div>
            <div className="w-full h-28 sm:h-32 relative">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 320 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartGradientDash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[15, 40, 65, 90].map((y) => (
                  <line key={y} x1="25" y1={y} x2="315" y2={y} stroke="#1e293b" strokeDasharray="3 3" />
                ))}
                <text x="18" y="18" textAnchor="end" fill="#64748b" fontSize="8" fontFamily="monospace">500</text>
                <text x="18" y="43" textAnchor="end" fill="#64748b" fontSize="8" fontFamily="monospace">400</text>
                <text x="18" y="68" textAnchor="end" fill="#64748b" fontSize="8" fontFamily="monospace">200</text>
                <text x="18" y="93" textAnchor="end" fill="#64748b" fontSize="8" fontFamily="monospace">0</text>
                <path d="M 30 80 Q 75 55 120 60 T 210 35 T 310 20 L 310 90 L 30 90 Z" fill="url(#chartGradientDash)" />
                <path d="M 30 80 Q 75 55 120 60 T 210 35 T 310 20" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
                {[
                  [30, 80],
                  [75, 62],
                  [120, 60],
                  [165, 48],
                  [210, 35],
                  [260, 28],
                  [310, 20],
                ].map(([cx, cy], i) => (
                  <circle key={i} cx={cx} cy={cy} r={i === 6 ? 3.5 : 3} fill="#00e5ff" stroke={i === 6 ? '#fff' : undefined} strokeWidth={i === 6 ? 1 : 0} />
                ))}
              </svg>
            </div>
            <div className="flex justify-between pl-6 text-[8px] font-mono text-slate-400 mt-1">
              {['Aug 28', 'Aug 29', 'Aug 30', 'Sep 1', 'Sep 2', 'Sep 3', 'Sep 4'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 bg-[#091629] p-3 sm:p-4 rounded-xl border border-sky-900/40 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white">Recent Activity</span>
              <button
                onClick={() => go('/identity-profile', onNavigateToProfile)}
                className="text-[10px] text-cyan-400 hover:underline flex items-center gap-0.5"
              >
                View all <ArrowRight size={10} />
              </button>
            </div>
            <div className="space-y-2 mt-1 flex-1">
              {activities.slice(0, 4).map((act) => (
                <button
                  key={act.id}
                  onClick={() => go('/identity-profile', onNavigateToProfile)}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-900/60 hover:bg-sky-950/50 border border-sky-950 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {act.type === 'identity' && <KraLogo size={18} />}
                    {act.type === 'mpesa' && <MpesaLogo size={18} />}
                    {act.type === 'crb' && <CrbLogo size={18} />}
                    {act.type === 'kplc' && <KplcLogo size={18} />}
                    {!['identity', 'mpesa', 'crb', 'kplc'].includes(act.type) && <KraLogo size={18} />}
                    <div className="min-w-0">
                      <span className="text-[10px] font-medium text-slate-200 truncate block">
                        {act.title}
                      </span>
                      <span className="text-[8px] text-slate-400">
                        {act.time} · <span className="text-emerald-400">{act.status}</span>
                      </span>
                    </div>
                  </div>
                  <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
