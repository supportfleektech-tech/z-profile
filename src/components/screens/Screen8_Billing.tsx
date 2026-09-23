import React, { useState } from 'react';
import { CreditCard, Download, ExternalLink, Check } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { useAppRouter } from '../../context/RouterContext';

export const Screen8_Billing: React.FC = () => {
  const { invoices, currentPlan, setCurrentPlan, pushToast, pricingPlans } = useAppData();
  const { navigate } = useAppRouter();
  const [activeTab, setActiveTab] = useState<'Invoices' | 'Transactions' | 'Payment Methods'>('Invoices');
  const [downloading, setDownloading] = useState<string | null>(null);

  const planMeta = pricingPlans.find((p) => p.id === currentPlan) || pricingPlans[1];

  const usageStats = [
    { label: 'Identity Searches', used: 842, total: 1000, color: '#00e5ff' },
    { label: 'KRA Checks', used: 324, total: 500, color: '#38bdf8' },
    { label: 'M-PESA Checks', used: 210, total: 500, color: '#10b981' },
    { label: 'CRB Checks', used: 98, total: 200, color: '#06b6d4' },
    { label: 'KPLC Checks', used: 45, total: 100, color: '#f59e0b' },
  ];

  const handleDownload = (invId: string, invNo: string) => {
    setDownloading(invId);
    setTimeout(() => {
      setDownloading(null);
      pushToast({ title: 'Invoice downloaded', description: `${invNo}.pdf saved`, type: 'success' });
    }, 800);
  };

  return (
    <div className="w-full h-full min-h-[420px] bg-[#071120] text-slate-100 rounded-xl overflow-hidden border border-sky-900/40 flex flex-col text-xs">
      <div className="px-3 sm:px-4 py-2.5 bg-[#091629] border-b border-sky-900/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard size={15} className="text-cyan-400" />
          <h2 className="text-xs sm:text-sm font-bold text-white">Billing & Subscriptions</h2>
        </div>
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active
        </span>
      </div>

      <div className="p-3 sm:p-4 bg-gradient-to-r from-[#091e38] to-[#071526] border-b border-sky-900/40 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60">
              {planMeta.name} Plan
            </span>
            <span className="text-xs text-slate-400">Next billing: 15 Oct 2026</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            {planMeta.customPrice ? (
              <span className="text-lg font-bold text-white font-mono">{planMeta.customPrice}</span>
            ) : (
              <>
                <span className="text-lg sm:text-xl font-bold text-white font-mono">
                  KES {planMeta.monthlyPrice.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400">/ month</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate('/pricing')}
            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-[10px] shadow-[0_0_10px_rgba(2,132,199,0.4)] transition-all"
          >
            Manage Plan
          </button>
          <button
            onClick={() => {
              if (invoices[0]) handleDownload(invoices[0].id, invoices[0].invoiceNo);
            }}
            className="px-3 py-1.5 rounded-lg border border-sky-800/80 hover:bg-sky-950/60 text-slate-300 text-[10px] transition-colors"
          >
            View Invoice
          </button>
        </div>
      </div>

      <div className="flex-1 p-3 sm:p-4 grid grid-cols-1 md:grid-cols-12 gap-3 overflow-y-auto">
        <div className="md:col-span-6 bg-[#091629] p-3 sm:p-4 rounded-xl border border-sky-900/40">
          <h3 className="text-xs font-semibold text-white pb-1.5 border-b border-sky-900/30">Usage This Month</h3>
          <div className="space-y-2.5 mt-3">
            {usageStats.map((item) => {
              const pct = Math.round((item.used / item.total) * 100);
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-slate-300">{item.label}</span>
                    <span className="font-mono text-slate-400">
                      <strong className="text-white">{item.used}</strong> / {item.total}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#050b14] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: item.color,
                        boxShadow: `0 0 8px ${item.color}80`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="md:col-span-6 bg-[#091629] p-3 sm:p-4 rounded-xl border border-sky-900/40 flex flex-col">
          <div className="flex items-center gap-3 border-b border-sky-900/30 pb-2 overflow-x-auto">
            {(['Invoices', 'Transactions', 'Payment Methods'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-[10px] font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'Invoices' && (
            <div className="mt-3 space-y-2 font-mono text-[10px] flex-1">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="p-2.5 rounded-lg bg-[#06101c] border border-sky-950 flex items-center justify-between hover:border-sky-800 transition-colors gap-2"
                >
                  <div className="min-w-0">
                    <span className="text-cyan-300 font-medium">{inv.invoiceNo}</span>
                    <span className="text-slate-500 text-[9px] block font-sans">{inv.date}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-white font-semibold">{inv.amount}</span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5">
                      <Check size={8} /> {inv.status}
                    </span>
                    <button
                      onClick={() => handleDownload(inv.id, inv.invoiceNo)}
                      className="p-1 text-slate-400 hover:text-white"
                      title="Download PDF"
                    >
                      {downloading === inv.id ? (
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
                      ) : (
                        <Download size={12} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'Payment Methods' && (
            <div className="mt-3 space-y-2 flex-1">
              <div className="p-3 rounded-lg bg-[#06101c] border border-sky-950 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-xs">
                    M
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">M-PESA</div>
                    <div className="text-[10px] text-slate-400">Primary · **** 5678</div>
                  </div>
                </div>
                <span className="text-[9px] text-emerald-400 font-semibold">Default</span>
              </div>
              <div className="p-3 rounded-lg bg-[#06101c] border border-sky-950 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-500/40 flex items-center justify-center text-blue-400">
                    <CreditCard size={14} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Bank Transfer</div>
                    <div className="text-[10px] text-slate-400">KCB · **** 4421</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Transactions' && (
            <div className="mt-3 flex-1 text-center py-8 text-slate-500 text-[11px]">
              Transaction ledger mirrors paid invoices above.
            </div>
          )}

          <div className="mt-3 pt-2 border-t border-sky-900/30 flex items-center justify-between text-[9px] text-slate-400">
            <span>Billing via Safaricom M-PESA & Bank Transfer</span>
            <button onClick={() => navigate('/pricing')} className="text-cyan-400 hover:underline flex items-center gap-0.5">
              Change plan <ExternalLink size={10} />
            </button>
          </div>
        </div>
      </div>

      {/* Quick plan switcher chips */}
      <div className="px-3 sm:px-4 py-2 border-t border-sky-900/40 bg-[#081527]/50 flex items-center gap-2 overflow-x-auto">
        <span className="text-[10px] text-slate-500 shrink-0">Switch plan:</span>
        {pricingPlans.filter((p) => !p.customPrice).map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setCurrentPlan(p.id);
              pushToast({ title: 'Plan updated', description: `Switched to ${p.name}`, type: 'success' });
            }}
            className={`px-2.5 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-all ${
              currentPlan === p.id
                ? 'bg-cyan-600 text-white'
                : 'bg-sky-950 text-slate-400 hover:text-white border border-sky-900'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
};
export default Screen8_Billing;
