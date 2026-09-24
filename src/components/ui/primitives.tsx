import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * Shared UI primitives.
 *
 * Every screen in the platform is built from these so responsive behaviour, focus
 * management and keyboard support are consistent by construction rather than per-screen.
 */

/* ---------------------------------- Badge ---------------------------------- */

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  danger: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  info: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  accent: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
};

export const Badge: React.FC<{ tone?: BadgeTone; children: React.ReactNode; className?: string; dot?: boolean }> = ({
  tone = 'neutral',
  children,
  className,
  dot,
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border whitespace-nowrap',
      TONE_CLASS[tone],
      className
    )}
  >
    {dot && <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />}
    {children}
  </span>
);

/* ---------------------------------- Panel ---------------------------------- */

export const Panel: React.FC<{
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  icon?: React.ReactNode;
}> = ({ title, subtitle, actions, children, className, bodyClassName, icon }) => (
  <section className={cn('bg-[#091629] rounded-xl border border-sky-900/40 flex flex-col min-w-0', className)}>
    {(title || actions) && (
      <header className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-sky-900/30 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-cyan-400 shrink-0">{icon}</span>}
          <div className="min-w-0">
            {title && <h3 className="text-xs sm:text-[13px] font-semibold text-white truncate">{title}</h3>}
            {subtitle && <p className="text-[10px] text-slate-400 truncate mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-1.5 flex-wrap shrink-0">{actions}</div>}
      </header>
    )}
    <div className={cn('p-3 sm:p-4 min-w-0', bodyClassName)}>{children}</div>
  </section>
);

/* ----------------------------------- Tabs ----------------------------------- */

export const Tabs: React.FC<{
  tabs: readonly string[];
  active: string;
  onChange: (tab: string) => void;
  size?: 'sm' | 'md';
  className?: string;
  badges?: Record<string, number | string>;
}> = ({ tabs, active, onChange, size = 'sm', className, badges }) => {
  const ref = useRef<HTMLDivElement>(null);

  // Keep the active tab visible when the strip scrolls horizontally on small screens.
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [active]);

  return (
    <div
      ref={ref}
      role="tablist"
      aria-orientation="horizontal"
      className={cn('flex items-center gap-1 overflow-x-auto no-scrollbar -mx-1 px-1 py-1', className)}
    >
      {tabs.map((tab) => {
        const isActive = tab === active;
        const badge = badges?.[tab];
        return (
          <button
            key={tab}
            role="tab"
            aria-selected={isActive}
            data-active={isActive}
            onClick={() => onChange(tab)}
            className={cn(
              'relative rounded-lg font-medium transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5',
              size === 'sm' ? 'px-2.5 py-1.5 text-[11px]' : 'px-3.5 py-2 text-xs',
              isActive
                ? 'bg-sky-600 text-white font-semibold shadow-[0_0_10px_rgba(2,132,199,0.35)]'
                : 'text-slate-400 hover:text-slate-100 hover:bg-sky-950/60'
            )}
          >
            {tab}
            {badge !== undefined && badge !== 0 && (
              <span
                className={cn(
                  'min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center',
                  isActive ? 'bg-white/25 text-white' : 'bg-sky-950 text-cyan-300 border border-sky-800'
                )}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

/* ------------------------------ SegmentedControl ------------------------------ */

export const SegmentedControl: React.FC<{
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  size?: 'sm' | 'md';
  className?: string;
}> = ({ options, value, onChange, size = 'sm', className }) => (
  <div className={cn('inline-flex items-center bg-[#050b14] p-0.5 rounded-lg border border-sky-900/60 gap-0.5', className)}>
    {options.map((o) => (
      <button
        key={o.value}
        onClick={() => onChange(o.value)}
        aria-pressed={value === o.value}
        className={cn(
          'rounded-md transition-all whitespace-nowrap',
          size === 'sm' ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]',
          value === o.value ? 'bg-cyan-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-100'
        )}
      >
        {o.label}
      </button>
    ))}
  </div>
);

/* ---------------------------------- Toggle ---------------------------------- */

export const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  tone?: 'cyan' | 'emerald' | 'rose';
  className?: string;
}> = ({ checked, onChange, label, description, disabled, tone = 'cyan', className }) => {
  const id = useId();
  const on = tone === 'emerald' ? 'bg-emerald-500' : tone === 'rose' ? 'bg-rose-500' : 'bg-cyan-500';
  return (
    <div className={cn('flex items-start gap-2.5', disabled && 'opacity-50', className)}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative shrink-0 w-9 h-5 rounded-full transition-colors mt-0.5 border',
          checked ? `${on} border-transparent` : 'bg-slate-700/60 border-slate-600',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          )}
        />
      </button>
      {(label || description) && (
        <label htmlFor={id} className="min-w-0 cursor-pointer select-none">
          {label && <span className="block text-[11px] font-medium text-slate-200 leading-tight">{label}</span>}
          {description && <span className="block text-[10px] text-slate-500 leading-snug mt-0.5">{description}</span>}
        </label>
      )}
    </div>
  );
};

/* ---------------------------------- Fields ---------------------------------- */

const INPUT_CLASS =
  'w-full bg-[#050b14] border border-sky-900/60 rounded-lg py-2 px-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed';

export const Field: React.FC<{
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ label, hint, error, required, children, className }) => (
  <div className={cn('min-w-0', className)}>
    {label && (
      <label className="block text-[10px] font-medium text-slate-400 mb-1">
        {label}
        {required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
    )}
    {children}
    {error ? (
      <p className="text-[10px] text-rose-400 mt-1">{error}</p>
    ) : hint ? (
      <p className="text-[10px] text-slate-500 mt-1 leading-snug">{hint}</p>
    ) : null}
  </div>
);

export const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }> = ({
  className,
  invalid,
  ...rest
}) => (
  <input
    {...rest}
    className={cn(INPUT_CLASS, invalid && 'border-rose-500/70 focus:border-rose-400 focus:ring-rose-400/40', className)}
  />
);

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className, ...rest }) => (
  <textarea {...rest} className={cn(INPUT_CLASS, 'resize-y min-h-[70px] leading-relaxed', className)} />
);

export const Select: React.FC<
  React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string; disabled?: boolean }[] }
> = ({ className, options, ...rest }) => {
  const id = useId();
  return (
    <div className="relative">
      <select id={id} {...rest} className={cn(INPUT_CLASS, 'appearance-none pr-7 cursor-pointer', className)}>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled} className="bg-[#091629] text-white">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
    </div>
  );
};

export const SearchInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder = 'Search…', className }) => (
  <div className={cn('relative min-w-[140px]', className)}>
    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(INPUT_CLASS, 'pl-7.5 pr-7', 'pl-8')}
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        aria-label="Clear search"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
      >
        <X size={12} />
      </button>
    )}
  </div>
);

/* --------------------------------- StatCard --------------------------------- */

export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  delta?: { value: string; up: boolean };
  tone?: 'default' | 'success' | 'danger' | 'accent' | 'warning';
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}> = ({ label, value, sub, delta, tone = 'default', icon, onClick, className }) => {
  const valueTone =
    tone === 'success' ? 'text-emerald-400' : tone === 'danger' ? 'text-rose-400' : tone === 'accent' ? 'text-cyan-300' : tone === 'warning' ? 'text-amber-300' : 'text-white';
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'text-left bg-[#091629] rounded-xl border border-sky-900/40 p-3 min-w-0 flex flex-col gap-1',
        onClick && 'hover:border-cyan-500/40 card-lift transition-colors cursor-pointer w-full',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-[10px] text-slate-400 font-medium truncate">{label}</span>
        {icon && <span className="text-slate-500 shrink-0">{icon}</span>}
      </div>
      <div className="flex items-baseline justify-between gap-1.5">
        <span className={cn('text-base sm:text-lg font-bold font-mono truncate', valueTone)}>{value}</span>
        {delta && (
          <span className={cn('text-[10px] font-semibold shrink-0', delta.up ? 'text-emerald-400' : 'text-rose-400')}>
            {delta.up ? '▲' : '▼'} {delta.value}
          </span>
        )}
      </div>
      {sub && <span className="text-[9px] text-slate-500 leading-snug">{sub}</span>}
    </Comp>
  );
};

/* -------------------------------- ProgressBar -------------------------------- */

export const ProgressBar: React.FC<{
  value: number;
  max?: number;
  color?: string;
  label?: React.ReactNode;
  right?: React.ReactNode;
  height?: number;
  danger?: number;
  warning?: number;
  className?: string;
}> = ({ value, max = 100, color = '#00e5ff', label, right, height = 6, danger = 90, warning = 75, className }) => {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const auto = pct >= danger ? '#f43f5e' : pct >= warning ? '#f59e0b' : color;
  return (
    <div className={cn('min-w-0', className)}>
      {(label || right) && (
        <div className="flex items-center justify-between gap-2 text-[10px] mb-1">
          <span className="text-slate-300 truncate">{label}</span>
          <span className="font-mono text-slate-400 shrink-0">{right}</span>
        </div>
      )}
      <div className="w-full bg-[#050b14] rounded-full overflow-hidden" style={{ height }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: auto, boxShadow: `0 0 8px ${auto}66` }}
        />
      </div>
    </div>
  );
};

/* -------------------------------- EmptyState -------------------------------- */

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ icon, title, description, action, className }) => (
  <div className={cn('flex flex-col items-center justify-center text-center py-10 px-4 gap-2', className)}>
    {icon && <div className="text-slate-600 mb-1">{icon}</div>}
    <p className="text-xs font-semibold text-slate-300">{title}</p>
    {description && <p className="text-[11px] text-slate-500 max-w-sm leading-relaxed">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

/* --------------------------------- Checkbox --------------------------------- */

export const Checkbox: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  indeterminate?: boolean;
}> = ({ checked, onChange, label, disabled, className, indeterminate }) => {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn('inline-flex items-center gap-2 cursor-pointer select-none text-[11px] text-slate-300', disabled && 'opacity-50 cursor-not-allowed', className)}
    >
      <span className="relative shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          className={cn(
            'w-4 h-4 rounded border flex items-center justify-center transition-all',
            checked || indeterminate ? 'bg-cyan-500 border-cyan-400' : 'bg-[#050b14] border-sky-800 peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-400/50'
          )}
        >
          {indeterminate && !checked ? <span className="w-2 h-0.5 bg-white rounded" /> : checked && <Check size={11} className="text-[#050b14]" strokeWidth={3.5} />}
        </span>
      </span>
      {label && <span className="min-w-0">{label}</span>}
    </label>
  );
};

/* ---------------------------------- Button ---------------------------------- */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.28)] border border-transparent',
  secondary: 'bg-sky-950 hover:bg-sky-900 text-slate-200 border border-sky-800',
  ghost: 'bg-transparent hover:bg-sky-950/70 text-slate-300 hover:text-white border border-transparent',
  danger: 'bg-rose-600/90 hover:bg-rose-500 text-white border border-transparent',
  success: 'bg-emerald-600 hover:bg-emerald-500 text-white border border-transparent',
  outline: 'bg-transparent hover:bg-sky-950/60 text-cyan-300 border border-cyan-500/40',
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'xs' | 'sm' | 'md'; loading?: boolean; icon?: React.ReactNode }
> = ({ variant = 'secondary', size = 'sm', loading, icon, className, children, disabled, ...rest }) => (
  <button
    {...rest}
    disabled={disabled || loading}
    className={cn(
      'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all active:scale-[0.97] disabled:opacity-55 disabled:cursor-not-allowed whitespace-nowrap',
      size === 'xs' ? 'px-2 py-1 text-[10px]' : size === 'sm' ? 'px-2.5 py-1.5 text-[11px]' : 'px-3.5 py-2 text-xs',
      VARIANT_CLASS[variant],
      className
    )}
  >
    {loading ? <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" /> : icon}
    {children}
  </button>
);

/* --------------------------------- Callout --------------------------------- */

export const Callout: React.FC<{
  tone?: BadgeTone;
  title?: React.ReactNode;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}> = ({ tone = 'info', title, children, icon, className }) => {
  const map: Record<BadgeTone, string> = {
    neutral: 'border-slate-600/40 bg-slate-500/5 text-slate-300',
    success: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200',
    warning: 'border-amber-500/30 bg-amber-500/5 text-amber-200',
    danger: 'border-rose-500/30 bg-rose-500/5 text-rose-200',
    info: 'border-sky-500/30 bg-sky-500/5 text-sky-200',
    accent: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-200',
  };
  return (
    <div className={cn('rounded-lg border px-3 py-2.5 text-[11px] leading-relaxed flex gap-2 min-w-0', map[tone], className)}>
      {icon && <span className="shrink-0 mt-0.5">{icon}</span>}
      <div className="min-w-0">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <div className="opacity-90">{children}</div>
      </div>
    </div>
  );
};

/* --------------------------------- CopyButton -------------------------------- */

export const CopyButton: React.FC<{ value: string; label?: string; size?: 'xs' | 'sm' }> = ({ value, label, size = 'xs' }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = value;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border transition-colors',
        size === 'xs' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-[10px]',
        copied ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10' : 'border-sky-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40'
      )}
      title="Copy to clipboard"
    >
      {copied ? <Check size={10} /> : null}
      {copied ? 'Copied' : label ?? 'Copy'}
    </button>
  );
};
