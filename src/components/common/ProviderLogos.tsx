import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const KraLogo: React.FC<LogoProps> = ({ className = '', size = 20 }) => (
  <div
    style={{ width: size, height: size }}
    className={`inline-flex items-center justify-center rounded-full bg-red-950/80 border border-red-500/40 text-red-400 font-bold text-[10px] shadow-[0_0_8px_rgba(239,68,68,0.25)] shrink-0 ${className}`}
    title="Kenya Revenue Authority"
  >
    <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L3 7v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V7l-9-5z" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  </div>
);

export const MpesaLogo: React.FC<LogoProps> = ({ className = '', size = 20 }) => (
  <div
    style={{ width: size, height: size }}
    className={`inline-flex items-center justify-center rounded-full bg-emerald-950/90 border border-emerald-500/50 text-emerald-400 font-black text-[9px] shadow-[0_0_8px_rgba(16,185,129,0.3)] shrink-0 ${className}`}
    title="M-PESA / Safaricom"
  >
    <span className="tracking-tighter">M</span>
  </div>
);

export const CrbLogo: React.FC<LogoProps> = ({ className = '', size = 20 }) => (
  <div
    style={{ width: size, height: size }}
    className={`inline-flex items-center justify-center rounded-full bg-cyan-950/90 border border-cyan-400/50 text-cyan-300 font-bold text-[8px] tracking-tight shadow-[0_0_8px_rgba(6,182,212,0.3)] shrink-0 ${className}`}
    title="Credit Reference Bureau (TransUnion/Metropol)"
  >
    <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  </div>
);

export const EmployerLogo: React.FC<LogoProps> = ({ className = '', size = 20 }) => (
  <div
    style={{ width: size, height: size }}
    className={`inline-flex items-center justify-center rounded-full bg-blue-950/90 border border-blue-500/50 text-blue-400 font-bold shadow-[0_0_8px_rgba(59,130,246,0.3)] shrink-0 ${className}`}
    title="Employer Verification"
  >
    <svg width={size * 0.65} height={size * 0.65} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  </div>
);

export const KplcLogo: React.FC<LogoProps> = ({ className = '', size = 20 }) => (
  <div
    style={{ width: size, height: size }}
    className={`inline-flex items-center justify-center rounded-full bg-amber-950/90 border border-amber-400/50 text-amber-400 font-bold shadow-[0_0_8px_rgba(245,158,11,0.3)] shrink-0 ${className}`}
    title="Kenya Power (KPLC)"
  >
    <svg width={size * 0.65} height={size * 0.65} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  </div>
);

export const SpinMobileLogo: React.FC<LogoProps> = ({ className = '', size = 22 }) => (
  <div style={{ width: size, height: size }} className={`relative shrink-0 flex items-center justify-center ${className}`}>
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <circle cx="16" cy="16" r="14" stroke="#0284c7" strokeWidth="2" strokeDasharray="30 15" />
      <path d="M10 16C10 12.6863 12.6863 10 16 10C19.3137 10 22 12.6863 22 16C22 19.3137 19.3137 22 16 22" stroke="#00f5d4" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="16" cy="16" r="3.5" fill="#38bdf8" />
    </svg>
  </div>
);
