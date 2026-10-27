import { useState, useMemo } from 'react';
import type { BreakdownItem } from '../types';
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface BreakdownTableProps {
  title: string;
  subtitle?: string;
  dimensionName: string;
  items: BreakdownItem[];
  emptyMessage?: string;
}

type SortField = 'name' | 'totalBlocked' | 'totalMrr' | 'returnedRate' | 'churnRate' | 'avgDaysToReturn';
type SortOrder = 'asc' | 'desc';

export function BreakdownTable({
  title,
  subtitle,
  dimensionName,
  items,
  emptyMessage = 'Nenhum dado encontrado para esta segmentação.',
}: BreakdownTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('totalBlocked');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const filtered = items.filter((item) =>
      item.name.toLowerCase().includes(term)
    );

    return filtered.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'string' || typeof valB === 'string') {
        const strA = String(valA);
        const strB = String(valB);
        const comp = strA.localeCompare(strB);
        return sortOrder === 'asc' ? comp : -comp;
      }

      const numA = Number(valA);
      const numB = Number(valB);
      if (numA < numB) return sortOrder === 'asc' ? -1 : 1;
      if (numA > numB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [items, searchTerm, sortField, sortOrder]);

  // Overall totals
  const totals = useMemo(() => {
    const totalBlocked = items.reduce((acc, i) => acc + i.totalBlocked, 0);
    const totalMrr = items.reduce((acc, i) => acc + i.totalMrr, 0);
    const returnedCount = items.reduce((acc, i) => acc + i.returnedCount, 0);
    const returnedMrr = items.reduce((acc, i) => acc + i.returnedMrr, 0);
    const churnedCount = items.reduce((acc, i) => acc + i.churnedCount, 0);
    const churnedMrr = items.reduce((acc, i) => acc + i.churnedMrr, 0);
    const suspendedCount = items.reduce((acc, i) => acc + i.suspendedCount, 0);
    const stillBlockedCount = items.reduce((acc, i) => acc + i.stillBlockedCount, 0);

    let daysSum = 0;
    let daysWeight = 0;
    items.forEach((i) => {
      if (i.avgDaysToReturn > 0 && i.returnedCount > 0) {
        daysSum += i.avgDaysToReturn * i.returnedCount;
        daysWeight += i.returnedCount;
      }
    });

    const returnedRate = totalBlocked > 0 ? Math.round((returnedCount / totalBlocked) * 1000) / 10 : 0;
    const churnRate = totalBlocked > 0 ? Math.round((churnedCount / totalBlocked) * 1000) / 10 : 0;
    const avgDays = daysWeight > 0 ? Math.round((daysSum / daysWeight) * 10) / 10 : 0;

    return {
      totalBlocked,
      totalMrr,
      returnedCount,
      returnedMrr,
      returnedRate,
      churnedCount,
      churnedMrr,
      churnRate,
      suspendedCount,
      stillBlockedCount,
      avgDays,
    };
  }, [items]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-slate-300 ml-1 inline opacity-0 group-hover:opacity-100 transition" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-slate-900 ml-1 inline" />
    ) : (
      <ArrowDown className="h-3 w-3 text-slate-900 ml-1 inline" />
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs break-inside-avoid">
      {/* Table Header Controls */}
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={`Filtrar ${dimensionName.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
          <span className="text-[11px] text-slate-400 whitespace-nowrap hidden sm:inline">
            {filteredItems.length} {filteredItems.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>
      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600 border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
              <th
                onClick={() => handleSort('name')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition group select-none"
              >
                {dimensionName} {renderSortIcon('name')}
              </th>
              <th
                onClick={() => handleSort('totalBlocked')}
                className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100 transition group select-none"
              >
                Bloqueados {renderSortIcon('totalBlocked')}
              </th>
              <th
                onClick={() => handleSort('totalMrr')}
                className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100 transition group select-none"
              >
                MRR Bloqueado {renderSortIcon('totalMrr')}
              </th>
              <th
                onClick={() => handleSort('returnedRate')}
                className="py-3 px-4 text-left cursor-pointer hover:bg-slate-100 transition group select-none"
              >
                Recuperados (%) {renderSortIcon('returnedRate')}
              </th>
              <th
                onClick={() => handleSort('churnRate')}
                className="py-3 px-3 text-center cursor-pointer hover:bg-slate-100 transition group select-none"
              >
                Churn (C) {renderSortIcon('churnRate')}
              </th>
              <th className="py-3 px-3 text-right">Ainda Bloq.</th>
              <th className="py-3 px-3 text-right">Suspensos</th>
              <th
                onClick={() => handleSort('avgDaysToReturn')}
                className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100 transition group select-none"
              >
                Dias Médios {renderSortIcon('avgDaysToReturn')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filteredItems.map((item, idx) => {
                const shareOfTotal = totals.totalBlocked > 0
                  ? Math.round((item.totalBlocked / totals.totalBlocked) * 1000) / 10
                  : 0;

                return (
                  <tr
                    key={item.name + idx}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      <div className="flex items-center space-x-2">
                        <span>{item.name}</span>
                        {shareOfTotal >= 20 && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-normal">
                            {shareOfTotal}% vol
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                      {item.totalBlocked.toLocaleString('pt-BR')}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                      R$ {item.totalMrr.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    <td className="py-2.5 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-emerald-700 w-12 text-right">
                          {item.returnedRate.toFixed(1)}%
                        </span>
                        <div className="flex-1 min-w-[70px] bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(0, item.returnedRate))}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-slate-400">
                          ({item.returnedCount})
                        </span>
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                          item.churnRate > 8
                            ? 'bg-rose-100 text-rose-800 font-semibold'
                            : item.churnRate > 3
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-slate-50 text-slate-600'
                        }`}
                      >
                        {item.churnRate.toFixed(1)}% ({item.churnedCount})
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-right text-slate-600 font-medium">
                      {item.stillBlockedCount}
                    </td>

                    <td className="py-2.5 px-3 text-right text-amber-700">
                      {item.suspendedCount}
                    </td>

                    <td className="py-2.5 px-4 text-right font-medium text-slate-700">
                      {item.avgDaysToReturn > 0 ? `${item.avgDaysToReturn.toFixed(1)} d` : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Table Footer Totals */}
          {items.length > 0 && (
            <tfoot>
              <tr className="bg-slate-100/90 border-t-2 border-slate-300 font-semibold text-slate-900 text-xs">
                <td className="py-3 px-4">Total Consolidado ({items.length} {dimensionName.toLowerCase()}s)</td>
                <td className="py-3 px-3 text-right">{totals.totalBlocked.toLocaleString('pt-BR')}</td>
                <td className="py-3 px-3 text-right font-mono">
                  R$ {totals.totalMrr.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-emerald-800 w-12 text-right">
                      {totals.returnedRate.toFixed(1)}%
                    </span>
                    <span className="text-slate-500 font-normal">
                      ({totals.returnedCount.toLocaleString('pt-BR')} recuperados)
                    </span>
                  </div>
                </td>
                <td className="py-3 px-3 text-center">
                  <span className="font-bold text-rose-800">
                    {totals.churnRate.toFixed(1)}% ({totals.churnedCount})
                  </span>
                </td>
                <td className="py-3 px-3 text-right">{totals.stillBlockedCount}</td>
                <td className="py-3 px-3 text-right text-amber-800">{totals.suspendedCount}</td>
                <td className="py-3 px-4 text-right">
                  {totals.avgDays > 0 ? `${totals.avgDays.toFixed(1)} d` : '—'}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
