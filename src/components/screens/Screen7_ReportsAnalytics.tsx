import React, { useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { useAppRouter } from '../../context/RouterContext';

export const Screen7_ReportsAnalytics: React.FC = () => {
  const { stats } = useAppData();
  const { navigate } = useAppRouter();
  const [timeRange, setTimeRange] = useState('Last 30 days');

  const sources = [
    { label: 'KRA', pct: 28, color: '#0284c7' },
    { label: 'M-PESA', pct: 24, color: '#06b6d4' },
    { label: 'CRB', pct: 18, color: '#10b981' },
    { label: 'Employer', pct: 15, color: '#f97316' },
    { label: 'KPLC', pct: 10, color: '#eab308' },
    { label: 'Others', pct: 5, color: '#a855f7' },
  ];

  const topServices = [
    { name: 'Identity Verification', pct: 38 },
    { name: 'KRA Tax Check', pct: 22 },
    { name: 'M-PESA KYC', pct: 18 },
    { name: 'CRB Score & History', pct: 12 },
    { name: 'Employer Verification', pct: 7 },
    { name: 'KPLC Meter Link', pct: 3 },
  ];

  const bars = [
    { date: 'Aug 28', amount: '280K', height: '45%' },
    { date: 'Aug 30', amount: '390K', height: '62%' },
    { date: 'Sep 1', amount: '340K', height: '54%' },
    { date: 'Sep 3', amount: '480K', height: '78%' },
    { date: 'Sep 4', amount: '540K', height: '88%' },
  ];

  return (
    <div className="w-full h-full min-h-[420px] bg-[#071120] text-slate-100 rounded-xl overflow-hidden border border-sky-900/40 flex flex-col text-xs">
      <div className="px-3 sm:px-4 py-2.5 bg-[#091629] border-b border-sky-900/40 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <BarChart3 size={15} className="text-cyan-400" />
          <h2 className="text-xs sm:text-sm font-bold text-white">Reports & Analytics</h2>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="bg-[#050b14] border border-sky-900/70 rounded-lg py-1.5 px-2.5 text-[10px] text-slate-200 focus:outline-none cursor-pointer"
        >
          <option value="Last 7 days">Last 7 days</option>
          <option value="Last 30 days">Last 30 days</option>
          <option value="This Quarter">This Quarter</option>
          <option value="Year to Date">Year to Date</option>
        </select>
      </div>

      <div className="p-3 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 border-b border-sky-900/30 bg-[#081527]/50">
        {[
          { label: 'Total Reports', value: stats.totalSearches.toLocaleString(), delta: '+12%', up: true, path: '/search' },
          { label: 'Successful', value: stats.successful.toLocaleString(), delta: '+15%', up: true, color: 'text-emerald-400', path: '/identity-profile' },
          { label: 'Failed', value: String(stats.failed), delta: '-8%', up: false, color: 'text-rose-400', path: '/providers' },
          { label: 'Revenue', value: stats.revenue, delta: '+22%', up: true, color: 'text-cyan-300', path: '/billing' },
        ].map((card) => (
          <button
            key={card.label}
            onClick={() => navigate(card.path)}
            className="text-left bg-[#091629] p-2.5 sm:p-3 rounded-xl border border-sky-900/40 hover:border-cyan-500/40 card-lift transition-colors"
          >
            <span className="text-[10px] text-slate-400">{card.label}</span>
            <div className="flex items-baseline justify-between mt-0.5 gap-1">
              <span className={`text-sm sm:text-base font-bold font-mono ${card.color || 'text-white'}`}>
                {card.value}
              </span>
              <span className={`text-[10px] font-semibold flex items-center ${card.up ? 'text-emerald-400' : 'text-rose-400'}`}>
                {card.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {card.delta}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="flex-1 p-3 sm:p-4 grid grid-cols-1 md:grid-cols-12 gap-3 overflow-y-auto">
        <div className="md:col-span-6 bg-[#091629] p-3 sm:p-4 rounded-xl border border-sky-900/40">
          <h3 className="text-xs font-semibold text-white pb-2 border-b border-sky-900/30">
            Reports by Source · {timeRange}
          </h3>
          <div className="flex flex-col sm:flex-row items-center gap-4 py-3">
            <div className="relative w-28 h-28 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" stroke="#0284c7" strokeWidth="14" strokeDasharray="67 172" strokeDashoffset="0" fill="none" />
                <circle cx="50" cy="50" r="38" stroke="#06b6d4" strokeWidth="14" strokeDasharray="57 182" strokeDashoffset="-67" fill="none" />
                <circle cx="50" cy="50" r="38" stroke="#10b981" strokeWidth="14" strokeDasharray="43 196" strokeDashoffset="-124" fill="none" />
                <circle cx="50" cy="50" r="38" stroke="#f97316" strokeWidth="14" strokeDasharray="36 203" strokeDashoffset="-167" fill="none" />
                <circle cx="50" cy="50" r="38" stroke="#eab308" strokeWidth="14" strokeDasharray="24 215" strokeDashoffset="-203" fill="none" />
                <circle cx="50" cy="50" r="38" stroke="#a855f7" strokeWidth="14" strokeDasharray="12 227" strokeDashoffset="-227" fill="none" />
              </svg>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] w-full">
              {sources.map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-slate-300 flex-1 truncate">{s.label}</span>
                  <span className="font-mono text-slate-400 text-[10px]">{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="md:col-span-6 bg-[#091629] p-3 sm:p-4 rounded-xl border border-sky-900/40 flex flex-col">
          <div className="flex items-center justify-between pb-2 border-b border-sky-900/30">
            <h3 className="text-xs font-semibold text-white">Revenue Trend</h3>
            <span className="text-[9px] text-cyan-400 font-mono">KES 600K Max</span>
          </div>
          <div className="w-full h-28 sm:h-32 flex items-end justify-between gap-2 sm:gap-3 pt-3 px-1">
            {bars.map((bar, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group cursor-default">
                <span className="text-[8px] font-mono text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity">
                  {bar.amount}
                </span>
                <div
                  style={{ height: bar.height }}
                  className="w-full max-w-[48px] rounded-t-md bg-gradient-to-t from-sky-700 to-cyan-400 group-hover:from-cyan-400 group-hover:to-cyan-200 transition-all shadow-[0_0_8px_rgba(6,182,212,0.3)]"
                />
                <span className="text-[8px] font-mono text-slate-400 whitespace-nowrap">{bar.date}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-12 bg-[#091629] p-3 sm:p-4 rounded-xl border border-sky-900/40">
          <h3 className="text-xs font-semibold text-white pb-2 border-b border-sky-900/30">Top Services</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-3">
            {topServices.map((svc) => (
              <div key={svc.name} className="p-2.5 rounded-lg bg-[#06101c] border border-sky-950 hover:border-sky-800 transition-colors">
                <div className="flex justify-between text-[11px] mb-1.5 gap-2">
                  <span className="text-slate-200 truncate">{svc.name}</span>
                  <span className="font-mono text-cyan-400 shrink-0">{svc.pct}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(svc.pct * 2.2, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
