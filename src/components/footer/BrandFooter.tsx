import React from 'react';
import { IprsLogo } from '../common/IprsLogo';
import { SpinMobileLogo } from '../common/ProviderLogos';

export const BrandFooter: React.FC = () => {
  return (
    <div className="w-full bg-[#071120] rounded-xl p-5 border border-sky-900/40 text-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
      {/* Brand & Slogan */}
      <div className="flex items-center gap-4">
        <IprsLogo size="lg" showSubtitle={true} />

        <div className="hidden sm:block h-10 w-[1px] bg-sky-900/50" />

        <div>
          <h4 className="text-sm font-bold text-white tracking-wide">
            Trusted Data. Smarter Decisions.
          </h4>
          <p className="text-xs text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 font-semibold">
            A Safer Kenya.
          </p>
        </div>
      </div>

      {/* Spin Mobile Partner Tag */}
      <div className="flex items-center gap-3 bg-[#050b14] px-4 py-2.5 rounded-lg border border-sky-800/60 shadow-inner">
        <SpinMobileLogo size={32} />
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-normal text-slate-400">Powered by</span>
            <span className="text-xs font-extrabold text-white tracking-tight">spin mobile.</span>
          </div>
          <span className="text-[10px] text-cyan-300 font-mono block">
            Kenya's Leading API Integration Partner
          </span>
        </div>
      </div>
    </div>
  );
};
