import React, { useEffect, useState, useRef, useMemo } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { useAppRouter } from '../../context/RouterContext';
import { useAppData } from '../../context/AppDataContext';
import { platformRoutes } from '../../types/routes';
import { iconMap } from '../../utils/iconRegistry';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLiveSearch: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenLiveSearch,
}) => {
  const { navigate, currentPath } = useAppRouter();
  const { pushToast, currentUser, can } = useAppData();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setQuery('');
      setSelectedIdx(0);
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => {
        clearTimeout(t);
        if (triggerRef.current?.isConnected) triggerRef.current.focus();
      };
    }
    return undefined;
  }, [isOpen]);

  const actions = useMemo(() => {
    // Only routes this tier/permission set can actually open.
    const reachable = platformRoutes.filter(
      (r) =>
        !r.public &&
        currentUser &&
        (!r.tiers || r.tiers.includes(currentUser.tier)) &&
        (!r.permission || can(r.permission))
    );

    const pageActions = reachable.map((r) => ({
      id: r.id,
      label: r.title,
      description: r.description,
      path: r.path,
      icon: iconMap[r.icon] || <ArrowRight size={15} />,
      type: 'page' as const,
    }));

    const quickActions = can('search.run')
      ? [
          {
            id: 'live-verify',
            label: 'Run Live Citizen ID Verification',
            description: 'Cross-registry instant lookup via Spin Mobile',
            path: '',
            icon: iconMap.Sparkles || <ArrowRight size={15} />,
            type: 'action' as const,
          },
        ]
      : [];

    const all = [...quickActions, ...pageActions];
    if (!query.trim()) return all;

    const q = query.toLowerCase();
    return all.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.path.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, actions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && actions[selectedIdx]) {
        e.preventDefault();
        runAction(actions[selectedIdx]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, actions, selectedIdx]);

  const runAction = (action: (typeof actions)[0]) => {
    if (action.type === 'action' && action.id === 'live-verify') {
      onClose();
      onOpenLiveSearch();
      return;
    }
    if (action.path) {
      navigate(action.path);
      pushToast({ title: `Opened ${action.label}`, type: 'info' });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center pt-[12vh] sm:pt-[15vh] px-3 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#0a1525] border border-cyan-500/40 rounded-2xl shadow-[0_0_60px_rgba(6,182,212,0.25)] overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-sky-900/60">
          {iconMap.Search || <ArrowRight size={18} className="text-cyan-400 shrink-0" />}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, actions, modules…"
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
            autoComplete="off"
          />
          <kbd className="hidden sm:inline-flex px-1.5 py-0.5 rounded bg-sky-950 border border-sky-800 text-[10px] font-mono text-slate-400">
            ESC
          </kbd>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-white sm:hidden">
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {actions.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No matches for “{query}”</div>
          ) : (
            actions.map((action, idx) => (
              <button
                key={action.id}
                onClick={() => runAction(action)}
                onMouseEnter={() => setSelectedIdx(idx)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                  idx === selectedIdx
                    ? 'bg-cyan-600/25 border border-cyan-500/40 text-white'
                    : 'border border-transparent text-slate-300 hover:bg-sky-950/50'
                }`}
              >
                <span
                  className={`p-1.5 rounded-lg shrink-0 ${
                    idx === selectedIdx ? 'bg-cyan-500/30 text-cyan-200' : 'bg-sky-950 text-cyan-400'
                  }`}
                >
                  {action.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-2">
                    {action.label}
                    {action.path === currentPath && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">{action.description}</div>
                </div>
                {action.path && (
                  <span className="text-[10px] font-mono text-slate-500 shrink-0 hidden sm:inline">
                    {action.path}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-sky-900/50 flex items-center justify-between text-[10px] text-slate-500">
          <span>
            <kbd className="px-1 rounded bg-sky-950 border border-sky-800 font-mono">↑↓</kbd> navigate
            {' · '}
            <kbd className="px-1 rounded bg-sky-950 border border-sky-800 font-mono">↵</kbd> open
          </span>
          <span className="font-mono text-cyan-500/70">{actions.length} results</span>
        </div>
      </div>
    </div>
  );
};
