import React from 'react';
import { X, CheckCircle2, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useAppData();

  if (toasts.length === 0) return null;

  const iconFor = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />;
      case 'error':
        return <AlertCircle size={16} className="text-rose-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle size={16} className="text-amber-400 shrink-0" />;
      default:
        return <Info size={16} className="text-cyan-400 shrink-0" />;
    }
  };

  const borderFor = (type: string) => {
    switch (type) {
      case 'success':
        return 'border-emerald-500/40';
      case 'error':
        return 'border-rose-500/40';
      case 'warning':
        return 'border-amber-500/40';
      default:
        return 'border-cyan-500/40';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-2 sm:px-0">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-[#0a1628]/95 backdrop-blur-md border ${borderFor(t.type)} shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-slide-in-right`}
        >
          {iconFor(t.type)}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-tight">{t.title}</p>
            {t.description && (
              <p className="text-xs text-slate-400 mt-0.5 leading-snug">{t.description}</p>
            )}
          </div>
          <button
            onClick={() => dismissToast(t.id)}
            className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-sky-950 transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
