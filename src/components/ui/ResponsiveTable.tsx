import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../utils/cn';
import { EmptyState } from './primitives';

/**
 * A table that is a real `<table>` on md+ and a stack of labelled cards below md.
 *
 * This is the fix for "the tables overflow / are unusable on phones" across the platform:
 * one definition, two presentations, identical data.
 */

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  /** Rendered in the table cell. */
  render: (row: T, index: number) => React.ReactNode;
  /** Rendered in the mobile card; defaults to `render`. */
  renderMobile?: (row: T, index: number) => React.ReactNode;
  /** Relative width hint for the desktop table. */
  width?: string;
  align?: 'left' | 'right' | 'center';
  /** Hide this column below a breakpoint class, e.g. `hidden xl:table-cell`. */
  className?: string;
  /** Sort key extractor. */
  sortValue?: (row: T) => string | number;
  sortable?: boolean;
  mobilePrimary?: boolean;
}

export interface ResponsiveTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  dense?: boolean;
  maxHeight?: string;
  className?: string;
  footer?: React.ReactNode;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  caption?: string;
}

export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  emptyTitle = 'Nothing to show yet',
  emptyDescription,
  emptyAction,
  onRowClick,
  selectedKey,
  dense,
  maxHeight,
  className,
  footer,
  initialSort,
  caption,
}: ResponsiveTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (typeof av === 'number' && typeof bv === 'number') return sort.dir === 'asc' ? av - bv : bv - av;
      return sort.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [rows, sort, columns]);

  const toggleSort = (col: Column<T>) => {
    if (!col.sortable || !col.sortValue) return;
    setSort((prev) => (prev?.key === col.key ? { key: col.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key: col.key, dir: 'asc' }));
  };

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} className={className} />;
  }

  const pad = dense ? 'py-1.5 px-2' : 'py-2.5 px-3';

  return (
    <div className={cn('w-full min-w-0', className)}>
      {/* ---------- Desktop / tablet: real table ---------- */}
      <div className={cn('hidden md:block w-full overflow-auto', maxHeight && 'overflow-y-auto')} style={maxHeight ? { maxHeight } : undefined}>
        <table className="w-full text-left border-collapse text-[11px]">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-sky-900/40 bg-[#091629]/80 text-[10px] text-slate-400 uppercase tracking-wider font-semibold sticky top-0 z-10">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    pad,
                    'whitespace-nowrap',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.className,
                    col.sortable && 'cursor-pointer hover:text-cyan-300 select-none'
                  )}
                  onClick={() => toggleSort(col)}
                  aria-sort={sort?.key === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable &&
                      (sort?.key === col.key ? (
                        sort.dir === 'asc' ? (
                          <ChevronUp size={11} className="text-cyan-400" />
                        ) : (
                          <ChevronDown size={11} className="text-cyan-400" />
                        )
                      ) : (
                        <ChevronDown size={11} className="opacity-25" />
                      ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-sky-950/70">
            {sorted.map((row, i) => {
              const key = rowKey(row);
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'transition-colors',
                    onRowClick && 'cursor-pointer',
                    selectedKey === key ? 'bg-cyan-500/10' : 'hover:bg-sky-950/40'
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        pad,
                        'align-middle text-slate-300',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.className
                      )}
                    >
                      {col.render(row, i)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ---------- Mobile: labelled cards ---------- */}
      <div className="md:hidden space-y-2">
        {sorted.map((row, i) => {
          const key = rowKey(row);
          const primary = columns.find((c) => c.mobilePrimary);
          const rest = columns.filter((c) => c !== primary);
          return (
            <div
              key={key}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
              className={cn(
                'rounded-xl bg-[#091629] border p-2.5 min-w-0',
                selectedKey === key ? 'border-cyan-500/50' : 'border-sky-900/50',
                onRowClick && 'active:scale-[0.99] cursor-pointer'
              )}
            >
              {primary && (
                <div className="pb-2 mb-2 border-b border-sky-950/70 text-white text-xs font-semibold min-w-0 break-words">
                  {(primary.renderMobile ?? primary.render)(row, i)}
                </div>
              )}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11px] min-w-0">
                {rest.map((col) => (
                  <React.Fragment key={col.key}>
                    <dt className="text-slate-500 text-[10px] uppercase tracking-wide whitespace-nowrap pt-0.5">{col.header}</dt>
                    <dd className={cn('text-slate-200 min-w-0 break-words', col.align === 'right' && 'text-right')}>
                      {(col.renderMobile ?? col.render)(row, i)}
                    </dd>
                  </React.Fragment>
                ))}
              </dl>
            </div>
          );
        })}
      </div>

      {footer && <div className="mt-2 pt-2 border-t border-sky-950/70">{footer}</div>}
    </div>
  );
}

export default ResponsiveTable;
