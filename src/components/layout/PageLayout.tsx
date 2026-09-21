import React from 'react';
import { useAppRouter } from '../../context/RouterContext';
import { platformRoutes, PageRoute } from '../../types/routes';
import {
  ArrowLeft,
  ChevronRight,
  Home,
  Share2,
  ExternalLink,
  Check,
} from 'lucide-react';

interface PageLayoutProps {
  children: React.ReactNode;
  title: string;
  moduleNumber?: number;
  subtitle?: string;
  badge?: string;
  relatedPages?: { label: string; path: string }[];
}

export const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  title,
  moduleNumber,
  badge = 'Live Production',
  relatedPages,
}) => {
  const { navigate, goBack, currentPath } = useAppRouter();
  const [copied, setCopied] = React.useState(false);

  const copyUrl = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const currentIndex = platformRoutes.findIndex((r: PageRoute) => r.path === currentPath);
  const prevRoute = currentIndex > 0 ? platformRoutes[currentIndex - 1] : null;
  const nextRoute =
    currentIndex >= 0 && currentIndex < platformRoutes.length - 1
      ? platformRoutes[currentIndex + 1]
      : null;

  return (
    <div className="w-full flex-1 flex flex-col min-h-0 bg-tech-grid">
      {/* Breadcrumb bar */}
      <div className="w-full bg-[#06101c]/95 border-b border-sky-950/80 px-3 sm:px-5 py-2 sm:py-2.5 no-print">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={goBack}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-800 text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-xs shrink-0"
              title="Go back"
            >
              <ArrowLeft size={13} />
              <span className="hidden sm:inline">Back</span>
            </button>

            <div className="hidden sm:block h-4 w-px bg-sky-900/60 shrink-0" />

            <div className="flex items-center gap-1.5 text-xs min-w-0 overflow-hidden">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-slate-400 hover:text-slate-200 flex items-center gap-1 shrink-0"
              >
                <Home size={12} />
                <span className="hidden md:inline">IPRS</span>
              </button>
              <ChevronRight size={11} className="text-slate-600 shrink-0" />
              <span className="text-cyan-400 font-semibold truncate">{title}</span>
            </div>

            {moduleNumber != null && (
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800/60 shrink-0">
                #{moduleNumber}/15
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {badge && (
              <span className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {badge}
              </span>
            )}

            <button
              onClick={copyUrl}
              className="p-1.5 rounded-lg bg-sky-950/70 hover:bg-sky-900 text-slate-400 hover:text-white transition-colors text-xs flex items-center gap-1"
              title="Copy page link"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Share2 size={12} />}
              <span className="hidden sm:inline text-[10px]">{copied ? 'Copied' : 'Share'}</span>
            </button>

            <button
              onClick={() => navigate('/blueprint')}
              className="px-2 py-1.5 rounded-lg bg-[#091b30] hover:bg-sky-900/80 border border-sky-800/80 text-cyan-300 text-[10px] sm:text-xs font-medium transition-colors flex items-center gap-1"
            >
              <ExternalLink size={12} />
              <span className="hidden sm:inline">Blueprint</span>
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto p-2 sm:p-4 md:p-5 flex flex-col gap-4">
        <div className="w-full bg-[#071120] border border-sky-900/50 rounded-xl sm:rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.5)] overflow-hidden animate-slide-up">
          {children}
        </div>

        {/* Footer nav */}
        <div className="pb-4 sm:pb-2 pt-1 border-t border-sky-950/60 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3 text-xs no-print safe-bottom">
          <div className="order-2 sm:order-1">
            {prevRoute && (
              <button
                onClick={() => navigate(prevRoute.path)}
                className="w-full sm:w-auto flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 rounded-lg bg-[#071322] hover:bg-sky-950 border border-sky-900/60 text-slate-300 hover:text-white transition-colors"
              >
                <ArrowLeft size={12} />
                <span>
                  Prev: <strong>{prevRoute.shortTitle}</strong>
                </span>
              </button>
            )}
          </div>

          {relatedPages && relatedPages.length > 0 && (
            <div className="order-1 sm:order-2 flex items-center justify-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-500 hidden sm:inline">Related:</span>
              {relatedPages.map((rp) => (
                <button
                  key={rp.path}
                  onClick={() => navigate(rp.path)}
                  className="px-2.5 py-1.5 rounded-lg bg-sky-950/70 hover:bg-cyan-950 border border-sky-800/60 text-cyan-300 text-[11px] font-medium transition-colors"
                >
                  {rp.label} →
                </button>
              ))}
            </div>
          )}

          <div className="order-3">
            {nextRoute && (
              <button
                onClick={() => navigate(nextRoute.path)}
                className="w-full sm:w-auto flex items-center justify-center sm:justify-end gap-1.5 px-3 py-2 rounded-lg bg-[#071322] hover:bg-sky-950 border border-sky-900/60 text-cyan-300 hover:text-cyan-200 transition-colors"
              >
                <span>
                  Next: <strong>{nextRoute.shortTitle}</strong>
                </span>
                <ChevronRight size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
