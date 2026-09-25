import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * Modal + Drawer overlays.
 *
 * Both are portalled to `document.body`, trap focus, close on Escape and on backdrop
 * click, and lock body scroll while open. Sized to stay usable at 360px wide.
 */

function useOverlay(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
      if (e.key === 'Tab' && ref.current) {
        const focusables = ref.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const target = ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current?.querySelector<HTMLElement>('button,input,select,textarea');
      target?.focus();
    }, 40);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);

  return ref;
}

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  icon?: React.ReactNode;
}> = ({ open, onClose, title, subtitle, children, footer, size = 'md', icon }) => {
  const ref = useOverlay(open, onClose);
  if (!open || typeof document === 'undefined') return null;

  const width = size === 'sm' ? 'max-w-sm' : size === 'md' ? 'max-w-lg' : size === 'lg' ? 'max-w-3xl' : 'max-w-5xl';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" role="presentation">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Dialog'}
        className={cn(
          'relative w-full bg-[#091629] border border-sky-800 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col animate-scale-in max-h-[92dvh]',
          width
        )}
      >
        <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-sky-900/50 shrink-0">
          <div className="flex items-start gap-2.5 min-w-0">
            {icon && <span className="text-cyan-400 mt-0.5 shrink-0">{icon}</span>}
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white leading-tight break-words">{title}</h2>
              {subtitle && <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-sky-950 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3.5 min-w-0">{children}</div>
        {footer && <footer className="px-4 py-3 border-t border-sky-900/50 flex flex-wrap items-center justify-end gap-2 shrink-0">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
};

export const Drawer: React.FC<{
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  side?: 'right' | 'left';
  width?: string;
  icon?: React.ReactNode;
}> = ({ open, onClose, title, subtitle, children, footer, side = 'right', width = 'w-full sm:w-[560px]', icon }) => {
  const ref = useOverlay(open, onClose);
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex animate-fade-in" role="presentation">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Panel'}
        className={cn(
          'relative bg-[#071120] border-sky-800 shadow-2xl flex flex-col max-w-full h-full',
          width,
          side === 'right' ? 'ml-auto border-l animate-slide-in-right' : 'mr-auto border-r animate-slide-in-left'
        )}
      >
        <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-sky-900/50 bg-[#091629] shrink-0">
          <div className="flex items-start gap-2.5 min-w-0">
            {icon && <span className="text-cyan-400 mt-0.5 shrink-0">{icon}</span>}
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white leading-tight break-words">{title}</h2>
              {subtitle && <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-sky-950 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 min-w-0">{children}</div>
        {footer && <footer className="px-4 py-3 border-t border-sky-900/50 bg-[#091629] flex flex-wrap items-center justify-end gap-2 shrink-0">{footer}</footer>}
      </aside>
    </div>,
    document.body
  );
};

/** Small confirmation dialog with optional typed confirmation. */
export const ConfirmDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  requireText?: string;
  loading?: boolean;
}> = ({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', tone = 'danger', requireText, loading }) => {
  const [typed, setTyped] = React.useState('');
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);
  const ready = !requireText || typed.trim().toUpperCase() === requireText.toUpperCase();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-300 hover:text-white bg-sky-950 border border-sky-800">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!ready || loading}
            className={cn(
              'px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white disabled:opacity-50 transition-all',
              tone === 'danger' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-cyan-600 hover:bg-cyan-500'
            )}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-[11px] text-slate-300 leading-relaxed space-y-3">
        <div>{message}</div>
        {requireText && (
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">
              Type <span className="font-mono text-rose-300">{requireText}</span> to confirm
            </label>
            <input
              data-autofocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full bg-[#050b14] border border-sky-900 rounded-lg py-2 px-2.5 text-xs text-white font-mono focus:outline-none focus:border-rose-400"
              placeholder={requireText}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};
