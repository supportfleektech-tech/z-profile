import React from 'react';

interface IprsLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
}

export const IprsLogo: React.FC<IprsLogoProps> = ({
  className = '',
  size = 'md',
  showSubtitle = true,
}) => {
  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
  };

  const subSizes = {
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-xs',
    xl: 'text-sm',
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Fingerprint / Cyber Ring Emblem */}
      <div className={`relative flex items-center justify-center shrink-0 ${iconSizes[size]}`}>
        <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-[0_0_10px_rgba(6,182,212,0.4)]">
          {/* Outer arc */}
          <circle cx="22" cy="22" r="20" stroke="url(#cyanGlow)" strokeWidth="2" strokeDasharray="95 30" strokeLinecap="round" />
          {/* Middle arc */}
          <circle cx="22" cy="22" r="15" stroke="#00e5ff" strokeWidth="2.2" strokeDasharray="60 25" strokeLinecap="round" transform="rotate(-40 22 22)" />
          {/* Fingerprint loop 1 */}
          <path d="M15 26C15 20 18 16 22 16C26 16 29 20 29 26" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
          {/* Fingerprint loop 2 */}
          <path d="M18.5 27C18.5 23 20 20 22 20C24 20 25.5 23 25.5 27" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" />
          {/* Center core node */}
          <circle cx="22" cy="25" r="2" fill="#00f5d4" />
          
          <defs>
            <linearGradient id="cyanGlow" x1="2" y1="2" x2="42" y2="42" gradientUnits="userSpaceOnUse">
              <stop stopColor="#00e5ff" />
              <stop offset="0.5" stopColor="#0284c7" />
              <stop offset="1" stopColor="#38bdf8" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`font-extrabold tracking-wider text-white font-mono ${textSizes[size]}`}>
            <span className="text-[#00e5ff]">I</span>PRS
          </span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00f5d4] animate-pulse"></span>
        </div>
        {showSubtitle && (
          <span className={`font-medium tracking-tight text-sky-200/70 whitespace-nowrap ${subSizes[size]} mt-0.5`}>
            Intelligence. People. Risk. Solutions.
          </span>
        )}
      </div>
    </div>
  );
};
