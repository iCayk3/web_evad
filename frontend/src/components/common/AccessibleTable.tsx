import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { clsx } from 'clsx';
import { TableDensity } from './DensityToggle.tsx';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

interface AccessibleTableProps<T> {
  columns: Column<T>[];
  data: T[];
  caption: string;
  keyExtractor: (item: T) => string | number;
  emptyMessage?: string;
  density?: TableDensity;
  selectable?: boolean;
  selectedKeys?: (string | number)[];
  onSelectionChange?: (selectedKeys: (string | number)[]) => void;
}

export function AccessibleTable<T>({
  columns,
  data,
  caption,
  keyExtractor,
  emptyMessage = 'Nenhum registro encontrado',
  density = 'comfortable',
  selectable = false,
  selectedKeys = [],
  onSelectionChange,
}: AccessibleTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const selectedSet = React.useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedData = React.useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a: any, b: any) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      const compare = String(valA).localeCompare(String(valB), undefined, { numeric: true });
      return sortDir === 'asc' ? compare : -compare;
    });
  }, [data, sortKey, sortDir]);

  const allSelected = React.useMemo(() => {
    if (data.length === 0) return false;
    return data.every((item) => selectedSet.has(keyExtractor(item)));
  }, [data, selectedSet, keyExtractor]);

  const isIndeterminate = React.useMemo(() => {
    if (data.length === 0 || allSelected) return false;
    return data.some((item) => selectedSet.has(keyExtractor(item)));
  }, [data, selectedSet, allSelected, keyExtractor]);

  const handleToggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      const currentDataKeys = new Set(data.map((d) => keyExtractor(d)));
      onSelectionChange(selectedKeys.filter((k) => !currentDataKeys.has(k)));
    } else {
      const newKeys = Array.from(new Set([...selectedKeys, ...data.map((d) => keyExtractor(d))]));
      onSelectionChange(newKeys);
    }
  };

  const handleToggleRow = (key: string | number, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    if (!onSelectionChange) return;
    if (selectedSet.has(key)) {
      onSelectionChange(selectedKeys.filter((k) => k !== key));
    } else {
      onSelectionChange([...selectedKeys, key]);
    }
  };

  const cellPadding =
    density === 'compact' ? 'py-2 px-3 text-xs' : 'py-3.5 px-4 text-xs';
  const headerPadding =
    density === 'compact' ? 'py-2.5 px-3' : 'py-3.5 px-4';

  return (
    <div className="w-full overflow-x-auto border border-slate-100/90 rounded-2xl bg-white shadow-premium-card">
      <table className="w-full text-left border-collapse text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-slate-50/90 border-b border-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
            {selectable && (
              <th scope="col" className={clsx(headerPadding, 'w-10 text-center')}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isIndeterminate;
                  }}
                  onChange={handleToggleAll}
                  aria-label="Selecionar todos os registros da lista"
                  className="w-4 h-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary/30 cursor-pointer transition-colors"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={clsx(
                  headerPadding,
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                    ? 'text-center'
                    : 'text-left',
                  col.className
                )}
              >
                {col.sortable ? (
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    className="group inline-flex items-center gap-1 font-bold text-slate-700 hover:text-brand-primary transition-colors"
                    aria-label={`Ordenar por ${col.header}`}
                  >
                    <span>{col.header}</span>
                    <span className="text-slate-400 group-hover:text-brand-primary">
                      {sortKey === col.key ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-brand-primary" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-brand-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
                      )}
                    </span>
                  </button>
                ) : (
                  <span>{col.header}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sortedData.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (selectable ? 1 : 0)}
                className="py-12 text-center text-slate-400 font-medium"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedData.map((item, idx) => {
              const itemKey = keyExtractor(item);
              const isSelected = selectedSet.has(itemKey);

              return (
                <tr
                  key={itemKey}
                  className={`transition-colors ${
                    isSelected
                      ? 'bg-blue-50/70 border-l-2 border-l-brand-primary'
                      : idx % 2 === 0
                      ? 'bg-white hover:bg-slate-50/80'
                      : 'bg-slate-50/30 hover:bg-slate-50/80'
                  }`}
                >
                  {selectable && (
                    <td className={clsx(cellPadding, 'w-10 text-center')}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleToggleRow(itemKey, e)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Selecionar registro ${itemKey}`}
                        className="w-4 h-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary/30 cursor-pointer transition-colors"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={clsx(
                        cellPadding,
                        'text-slate-800',
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                      )}
                    >
                      {col.render ? col.render(item) : (item as any)[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
