import React from 'react';
import { GitBranch, Box, Globe } from 'lucide-react';

export const DeploymentCiCd: React.FC = () => {
  return (
    <div className="w-full bg-[#071120] rounded-xl p-4 border border-sky-900/40 text-slate-100 flex flex-col justify-between">
      <div className="flex items-center justify-between pb-2 border-b border-sky-900/30">
        <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">Deployment</h3>
        <span className="text-[10px] text-cyan-400 font-mono">CI / CD Pipeline</span>
      </div>

      {/* 3 Step Flow */}
      <div className="my-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="p-2.5 rounded-lg bg-[#091629] border border-sky-900/50 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-cyan-400 font-bold">1</span>
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
          </div>
          <div className="mt-2">
            <h4 className="text-[11px] font-bold text-white">Build & Test</h4>
            <p className="text-[9px] text-slate-400 mt-0.5">(Continuous Integration)</p>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-[#091629] border border-sky-900/50 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-blue-400 font-bold">2</span>
            <span className="w-2 h-2 rounded-full bg-blue-400" />
          </div>
          <div className="mt-2">
            <h4 className="text-[11px] font-bold text-white">Staging</h4>
            <p className="text-[9px] text-slate-400 mt-0.5">(Internal Testing)</p>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-[#091629] border border-sky-900/50 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-emerald-400 font-bold">3</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="mt-2">
            <h4 className="text-[11px] font-bold text-white">Production</h4>
            <p className="text-[9px] text-slate-400 mt-0.5">(Live Environment)</p>
          </div>
        </div>
      </div>

      {/* Badges / Logos: GitHub, Docker, Vercel */}
      <div className="pt-2 border-t border-sky-900/30 flex items-center justify-between flex-wrap gap-2 text-[10px] text-slate-400 font-mono">
        <span className="text-slate-300 font-semibold">CI/CD:</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
            <GitBranch size={12} className="text-purple-400" /> GitHub
          </span>
          <span className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
            <Box size={12} className="text-sky-400" /> Docker
          </span>
          <span className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
            <Globe size={12} className="text-emerald-400" /> Vercel
          </span>
        </div>
      </div>
    </div>
  );
};
