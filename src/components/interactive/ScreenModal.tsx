import React from 'react';
import { X, ExternalLink } from 'lucide-react';

interface ScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  screenNumber: number;
  children: React.ReactNode;
  onSwitchToInteractiveMode?: () => void;
}

export const ScreenModal: React.FC<ScreenModalProps> = ({
  isOpen,
  onClose,
  title,
  screenNumber,
  children,
  onSwitchToInteractiveMode,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#060e1a] border border-cyan-500/50 rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-[0_0_60px_rgba(6,182,212,0.35)] overflow-hidden">
        {/* Top inspection toolbar */}
        <div className="px-4 py-3 bg-[#081527] border-b border-sky-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-xs font-bold text-cyan-400 font-mono">
              {screenNumber}
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">{title}</h3>
              <p className="text-[11px] text-sky-300/70">High-Fidelity Interactive Preview & Functional Test</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSwitchToInteractiveMode && (
              <button
                onClick={() => {
                  onClose();
                  onSwitchToInteractiveMode();
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-800 text-cyan-300 text-xs font-medium transition-colors"
              >
                <ExternalLink size={13} />
                <span>Open in Full App</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-sky-950 transition-colors"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal content viewport */}
        <div className="flex-1 p-3 sm:p-5 overflow-y-auto bg-[#040913]">
          <div className="w-full h-full min-h-[500px]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
