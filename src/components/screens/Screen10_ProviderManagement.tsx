import React, { useState } from 'react';
import { Server, Activity, RefreshCw, X } from 'lucide-react';
import { KraLogo, MpesaLogo, CrbLogo, EmployerLogo, KplcLogo } from '../common/ProviderLogos';
import { useAppData } from '../../context/AppDataContext';
import { ProviderItem } from '../../types';

export const Screen10_ProviderManagement: React.FC = () => {
  const { providers, pingProvider, syncingProviderId } = useAppData();
  const [activeTab, setActiveTab] = useState<'Providers' | 'API Keys' | 'Logs' | 'Usage'>('Providers');
  const [viewDetails, setViewDetails] = useState<ProviderItem | null>(null);

  const getProviderIcon = (id: string) => {
    switch (id) {
      case 'p-kra':
        return <KraLogo size={22} />;
      case 'p-mpesa':
        return <MpesaLogo size={22} />;
      case 'p-crb':
        return <CrbLogo size={22} />;
      case 'p-employer':
        return <EmployerLogo size={22} />;
      case 'p-kplc':
        return <KplcLogo size={22} />;
      default:
        return <Activity size={18} className="text-cyan-400" />;
    }
  };

  const activeCount = providers.filter((p) => p.status === 'Active').length;

  return (
    <div className="w-full h-full min-h-[420px] bg-[#071120] text-slate-100 rounded-xl overflow-hidden border border-sky-900/40 flex flex-col text-xs relative">
      <div className="px-3 sm:px-4 py-2.5 bg-[#091629] border-b border-sky-900/40 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Server size={15} className="text-cyan-400" />
          <h2 className="text-xs sm:text-sm font-bold text-white">Provider Management</h2>
        </div>
        <span className="text-[10px] text-cyan-400 font-mono bg-sky-950/60 px-2 py-0.5 rounded border border-sky-900/60">
          {activeCount} / {providers.length} Gateways Online
        </span>
      </div>

      <div className="px-3 sm:px-4 py-1.5 bg-[#081527] border-b border-sky-900/40 flex items-center gap-2 overflow-x-auto">
        {(['Providers', 'API Keys', 'Logs', 'Usage'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all whitespace-nowrap ${
              activeTab === tab ? 'bg-sky-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-sky-950/40'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Providers' && (
        <div className="flex-1 overflow-y-auto p-2 sm:p-3">
          {/* Cards grid for all breakpoints */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {providers.map((p) => (
              <div
                key={p.id}
                className="p-3 rounded-xl bg-[#091629] border border-sky-900/50 hover:border-cyan-500/30 transition-all card-lift"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {getProviderIcon(p.id)}
                    <div className="min-w-0">
                      <div className="font-semibold text-white text-xs sm:text-sm truncate">{p.name}</div>
                      <div className="text-[9px] text-slate-400 font-mono truncate">{p.code}</div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {p.status}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                  <div className="bg-[#050b14] rounded-lg p-2 border border-sky-950">
                    <div className="text-slate-500">Latency</div>
                    <div className="font-mono text-cyan-300 font-semibold mt-0.5">{p.latencyMs}ms</div>
                  </div>
                  <div className="bg-[#050b14] rounded-lg p-2 border border-sky-950">
                    <div className="text-slate-500">Uptime</div>
                    <div className="font-mono text-emerald-300 font-semibold mt-0.5">{p.uptime}</div>
                  </div>
                  <div className="bg-[#050b14] rounded-lg p-2 border border-sky-950">
                    <div className="text-slate-500">Sync</div>
                    <div className="font-mono text-slate-300 font-semibold mt-0.5 truncate">{p.lastSync}</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => pingProvider(p.id)}
                    disabled={syncingProviderId === p.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-sky-950 hover:bg-sky-900 border border-sky-800 text-sky-200 text-[10px] font-medium transition-colors disabled:opacity-60"
                  >
                    <RefreshCw size={12} className={syncingProviderId === p.id ? 'animate-spin text-cyan-400' : ''} />
                    {syncingProviderId === p.id ? 'Syncing…' : 'Ping / Sync'}
                  </button>
                  <button
                    onClick={() => setViewDetails(p)}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-[10px] font-semibold transition-colors"
                  >
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab !== 'Providers' && (
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div>
            <p className="text-sm text-slate-300 font-medium">{activeTab}</p>
            <p className="text-xs text-slate-500 mt-1">Detailed {activeTab.toLowerCase()} available in production API console.</p>
          </div>
        </div>
      )}

      {viewDetails && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm z-30 flex items-center justify-center p-3 animate-fade-in">
          <div className="bg-[#091629] border border-sky-800 p-5 rounded-2xl max-w-md w-full space-y-3 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {getProviderIcon(viewDetails.id)}
                <div>
                  <h3 className="text-sm font-bold text-white">{viewDetails.name}</h3>
                  <span className="text-[10px] text-slate-400">{viewDetails.category}</span>
                </div>
              </div>
              <button onClick={() => setViewDetails(null)} className="p-1 text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1.5 text-[11px] bg-[#050b14] p-3 rounded-xl border border-sky-950 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Endpoint Status</span>
                <span className="text-emerald-400">HTTP 200 OK</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Average Latency</span>
                <span className="text-cyan-300">{viewDetails.latencyMs}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Uptime</span>
                <span className="text-emerald-300">{viewDetails.uptime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Auth Method</span>
                <span className="text-slate-300">Spin Mobile mTLS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Last Health Check</span>
                <span className="text-slate-300">{viewDetails.lastSync}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  pingProvider(viewDetails.id);
                }}
                className="px-3 py-1.5 rounded-lg border border-sky-800 text-slate-300 text-xs hover:bg-sky-950 flex items-center gap-1.5"
              >
                <RefreshCw size={12} className={syncingProviderId === viewDetails.id ? 'animate-spin' : ''} />
                Re-sync
              </button>
              <button
                onClick={() => setViewDetails(null)}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
