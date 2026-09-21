import React from 'react';
import {
  Lock,
  ShieldCheck,
  Activity,
  Server,
  KeyRound,
  Database,
} from 'lucide-react';

export const SecurityCompliance: React.FC = () => {
  const items = [
    {
      title: 'Data Encryption',
      sub: '(at rest & in transit)',
      icon: <Lock size={16} className="text-cyan-400" />,
    },
    {
      title: 'GDPR & Kenya DPA',
      sub: 'Data Protection Act Compliant',
      icon: <ShieldCheck size={16} className="text-emerald-400" />,
    },
    {
      title: 'Secure APIs',
      sub: '& monitoring telemetry',
      icon: <Activity size={16} className="text-blue-400" />,
    },
    {
      title: 'Automated Billing',
      sub: '& usage metering (ABAC)',
      icon: <Server size={16} className="text-amber-400" />,
    },
    {
      title: 'Role-Based Access',
      sub: '& privacy (OAuth 2.0 / JWT)',
      icon: <KeyRound size={16} className="text-purple-400" />,
    },
    {
      title: 'Regular Backups',
      sub: '& disaster recovery',
      icon: <Database size={16} className="text-sky-400" />,
    },
  ];

  return (
    <div className="w-full bg-[#071120] rounded-xl p-4 border border-sky-900/40 text-slate-100 flex flex-col justify-between">
      <div className="flex items-center justify-between pb-2 border-b border-sky-900/30">
        <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">Security & Compliance</h3>
        <span className="text-[10px] text-cyan-400 font-mono">ISO 27001 / SOC 2 Ready</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-3">
        {items.map((it, idx) => (
          <div
            key={idx}
            className="p-2 rounded-lg bg-[#091629] border border-sky-900/50 hover:border-cyan-500/40 transition-all flex items-start gap-2"
          >
            <div className="p-1 rounded bg-[#050b14] shrink-0 mt-0.5">{it.icon}</div>
            <div className="min-w-0">
              <h4 className="text-[11px] font-bold text-white truncate">{it.title}</h4>
              <p className="text-[9px] text-slate-400 truncate">{it.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
