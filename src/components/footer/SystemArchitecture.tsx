import React from 'react';
import {
  Smartphone,
  Network,
  Layout,
  Cpu,
  Layers,
  Database,
  Server,
  Box,
  CheckCircle2,
  ShieldCheck,
  Lock,
  ArrowRight,
} from 'lucide-react';

export const SystemArchitecture: React.FC = () => {
  const nodes = [
    { name: 'Users/Web/Mobile', sub: 'Native & PWA', icon: <Smartphone size={16} className="text-cyan-400" /> },
    { name: 'Load Balancer', sub: 'Cloudflare / NGINX', icon: <Network size={16} className="text-blue-400" /> },
    { name: 'Frontend', sub: 'Next.js / React', icon: <Layout size={16} className="text-sky-400" /> },
    { name: 'API Gateway', sub: 'FastAPI / Python', icon: <Cpu size={16} className="text-cyan-300" /> },
    { name: 'Spin Mobile', sub: 'Provider Layer', icon: <Layers size={16} className="text-emerald-400" /> },
    { name: 'PostgreSQL', sub: 'Primary DB', icon: <Database size={16} className="text-blue-400" /> },
    { name: 'Redis', sub: 'Cache Store', icon: <Server size={16} className="text-red-400" /> },
    { name: 'Workers', sub: 'Celery / Queue', icon: <Cpu size={16} className="text-amber-400" /> },
    { name: 'Docker', sub: 'Containers / K8s', icon: <Box size={16} className="text-sky-400" /> },
  ];

  return (
    <div className="w-full bg-[#071120] rounded-xl p-4 border border-sky-900/40 text-slate-100 flex flex-col justify-between">
      <div className="flex items-center justify-between pb-2 border-b border-sky-900/30">
        <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide flex items-center gap-2">
          <span>System Architecture</span>
          <span className="text-[10px] text-cyan-400 font-normal bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
            High Availability 99.99%
          </span>
        </h3>
      </div>

      {/* Nodes Flow */}
      <div className="my-3 overflow-x-auto py-2">
        <div className="flex items-center gap-1.5 min-w-max">
          {nodes.map((node, idx) => (
            <React.Fragment key={node.name}>
              <div className="bg-[#091629] hover:bg-[#0c1f38] border border-sky-900/50 hover:border-cyan-500/50 p-2 rounded-lg flex flex-col items-center text-center w-24 sm:w-28 transition-all hover:scale-105 group cursor-default">
                <div className="w-8 h-8 rounded-full bg-[#050b14] flex items-center justify-center mb-1.5 group-hover:shadow-[0_0_10px_rgba(6,182,212,0.4)]">
                  {node.icon}
                </div>
                <span className="text-[10px] font-bold text-white truncate w-full">{node.name}</span>
                <span className="text-[8px] text-slate-400 truncate w-full font-mono mt-0.5">{node.sub}</span>
              </div>

              {idx < nodes.length - 1 && (
                <ArrowRight size={13} className="text-sky-700 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Badges */}
      <div className="pt-2 border-t border-sky-900/30 flex items-center gap-3 sm:gap-6 flex-wrap text-[11px] font-medium text-slate-300">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 font-semibold">Kenya-Focused</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Lock size={12} className="text-cyan-400" />
          <span>Secure</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={12} className="text-emerald-400" />
          <span>Compliant</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-blue-400" />
          <span>Scalable</span>
        </div>
      </div>
    </div>
  );
};
