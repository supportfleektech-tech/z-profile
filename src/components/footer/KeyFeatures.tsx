import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export const KeyFeatures: React.FC = () => {
  const features = [
    'Real-time identity verification',
    'Multi-provider integrations',
    'Unified identity profile',
    'Advanced search & analytics',
    'Case management',
    'Role-based access control',
    'Automated billing & usage metering',
    'Admin-managed pricing',
    'Comprehensive audit logs',
    'Data encryption & privacy',
    'Mobile responsive UI',
    'API access & webhooks',
  ];

  return (
    <div className="w-full bg-[#071120] rounded-xl p-4 border border-sky-900/40 text-slate-100 flex flex-col justify-between">
      <div className="flex items-center justify-between pb-2 border-b border-sky-900/30">
        <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">Key Features</h3>
        <span className="text-[10px] text-emerald-400 font-mono">Enterprise Ready</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-3 text-xs">
        {features.map((feat, idx) => (
          <div key={idx} className="flex items-center gap-2 group">
            <CheckCircle2 size={13} className="text-cyan-400 shrink-0 group-hover:text-emerald-400 transition-colors" />
            <span className="text-slate-300 text-[11px] group-hover:text-white transition-colors">{feat}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
