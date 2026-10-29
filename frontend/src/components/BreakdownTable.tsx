import { useState, useMemo, Fragment } from 'react';
import type { BreakdownItem } from '../types';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ListTree,
  List,
} from 'lucide-react';

interface BreakdownTableProps {
  title: string;
  subtitle?: string;
  dimensionName: string;
  items: BreakdownItem[];
  emptyMessage?: string;
  groupByCity?: boolean;
}

type SortField = 'name' | 'totalBlocked' | 'totalMrr' | 'returnedRate' | 'churnRate' | 'avgDaysToReturn';
type SortOrder = 'asc' | 'desc';

interface CityGroup {
  city: string;
  totalBlocked: number;
  totalMrr: number;
  returnedCount: number;
  returnedMrr: number;
  returnedRate: number;
  churnedCount: number;
  churnedMrr: number;
  churnRate: number;
  suspendedCount: number;
  stillBlockedCount: number;
  avgDaysToReturn: number;
  bairros: BreakdownItem[];
}

export function BreakdownTable({
  title,
  subtitle,
  dimensionName,
  items,
  emptyMessage = 'Nenhum dado encontrado para esta segmentação.',
  groupByCity,
}: BreakdownTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('all');
  const [sortField, setSortField] = useState<SortField>('totalBlocked');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [expandedCities, setExpandedCities] = useState<Record<string, boolean>>({});

  // Detect whether items have cities attached (e.g. for Bairro / Vila)
  const hasCities = useMemo(() => items.some((i) => i.city && i.city.trim() !== ''), [items]);
  const isDefaultGrouped = groupByCity ?? (dimensionName === 'Bairro / Vila' && hasCities);
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>(isDefaultGrouped ? 'grouped' : 'flat');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Detect unique cities available in items
  const uniqueCities = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.city && i.city.trim() !== '') set.add(i.city.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const cityFilteredItems = useMemo(() => {
    if (selectedCity === 'all') return items;
    return items.filter((item) => item.city === selectedCity);
  }, [items, selectedCity]);

  // Flat list filtered by search term and sorted
  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const filtered = cityFilteredItems.filter((item) => {
      const matchName = item.name.toLowerCase().includes(term);
      const matchCity = item.city ? item.city.toLowerCase().includes(term) : false;
      return matchName || matchCity;
    });

    return filtered.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'string' || typeof valB === 'string') {
        const comp = String(valA).localeCompare(String(valB));
        return sortOrder === 'asc' ? comp : -comp;
      }

      const numA = Number(valA);
      const numB = Number(valB);
      if (numA < numB) return sortOrder === 'asc' ? -1 : 1;
      if (numA > numB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [cityFilteredItems, searchTerm, sortField, sortOrder]);

  // Grouped structure: City -> Bairros / Vilas
  const cityGroups = useMemo<CityGroup[]>(() => {
    if (!hasCities) return [];

    const map = new Map<string, BreakdownItem[]>();
    for (const item of filteredItems) {
      const cityKey = item.city?.trim() || 'Outras Localidades / Não Informado';
      if (!map.has(cityKey)) {
        map.set(cityKey, []);
      }
      map.get(cityKey)!.push(item);
    }

    const groups: CityGroup[] = [];
    for (const [city, bList] of map.entries()) {
      const totalBlocked = bList.reduce((acc, i) => acc + i.totalBlocked, 0);
      const totalMrr = bList.reduce((acc, i) => acc + i.totalMrr, 0);
      const returnedCount = bList.reduce((acc, i) => acc + i.returnedCount, 0);
      const returnedMrr = bList.reduce((acc, i) => acc + i.returnedMrr, 0);
      const churnedCount = bList.reduce((acc, i) => acc + i.churnedCount, 0);
      const churnedMrr = bList.reduce((acc, i) => acc + i.churnedMrr, 0);
      const suspendedCount = bList.reduce((acc, i) => acc + i.suspendedCount, 0);
      const stillBlockedCount = bList.reduce((acc, i) => acc + i.stillBlockedCount, 0);

      let daysSum = 0;
      let daysWeight = 0;
      bList.forEach((i) => {
        if (i.avgDaysToReturn > 0 && i.returnedCount > 0) {
          daysSum += i.avgDaysToReturn * i.returnedCount;
          daysWeight += i.returnedCount;
        }
      });

      const returnedRate = totalBlocked > 0 ? Math.round((returnedCount / totalBlocked) * 1000) / 10 : 0;
      const churnRate = totalBlocked > 0 ? Math.round((churnedCount / totalBlocked) * 1000) / 10 : 0;
      const avgDaysToReturn = daysWeight > 0 ? Math.round((daysSum / daysWeight) * 10) / 10 : 0;

      // Sort bairros inside this city by the current sortField & sortOrder
      const sortedBairros = [...bList].sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (typeof valA === 'string' || typeof valB === 'string') {
          const comp = String(valA).localeCompare(String(valB));
          return sortOrder === 'asc' ? comp : -comp;
        }

        const numA = Number(valA);
        const numB = Number(valB);
        if (numA < numB) return sortOrder === 'asc' ? -1 : 1;
        if (numA > numB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      groups.push({
        city,
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
        avgDaysToReturn,
        bairros: sortedBairros,
      });
    }

    // Sort city groups
    return groups.sort((a, b) => {
      let valA: any = a[sortField as keyof CityGroup];
      let valB: any = b[sortField as keyof CityGroup];

      if (sortField === 'name') {
        valA = a.city;
        valB = b.city;
      }

      if (typeof valA === 'string' || typeof valB === 'string') {
        const comp = String(valA).localeCompare(String(valB));
        return sortOrder === 'asc' ? comp : -comp;
      }

      const numA = Number(valA ?? 0);
      const numB = Number(valB ?? 0);
      if (numA < numB) return sortOrder === 'asc' ? -1 : 1;
      if (numA > numB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredItems, hasCities, sortField, sortOrder]);

  // Overall totals for the active city filter
  const totals = useMemo(() => {
    const totalBlocked = cityFilteredItems.reduce((acc, i) => acc + i.totalBlocked, 0);
    const totalMrr = cityFilteredItems.reduce((acc, i) => acc + i.totalMrr, 0);
    const returnedCount = cityFilteredItems.reduce((acc, i) => acc + i.returnedCount, 0);
    const returnedMrr = cityFilteredItems.reduce((acc, i) => acc + i.returnedMrr, 0);
    const churnedCount = cityFilteredItems.reduce((acc, i) => acc + i.churnedCount, 0);
    const churnedMrr = cityFilteredItems.reduce((acc, i) => acc + i.churnedMrr, 0);
    const suspendedCount = cityFilteredItems.reduce((acc, i) => acc + i.suspendedCount, 0);
    const stillBlockedCount = cityFilteredItems.reduce((acc, i) => acc + i.stillBlockedCount, 0);

    let daysSum = 0;
    let daysWeight = 0;
    cityFilteredItems.forEach((i) => {
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
  }, [cityFilteredItems]);

  const toggleCity = (city: string) => {
    setExpandedCities((prev) => ({
      ...prev,
      [city]: prev[city] === false ? true : false,
    }));
  };

  const isCityExpanded = (city: string) => expandedCities[city] !== false; // expanded by default

  const allExpanded = useMemo(() => {
    if (cityGroups.length === 0) return true;
    return cityGroups.every((g) => expandedCities[g.city] !== false);
  }, [cityGroups, expandedCities]);

  const toggleAllCities = () => {
    if (allExpanded) {
      const next: Record<string, boolean> = {};
      cityGroups.forEach((g) => { next[g.city] = false; });
      setExpandedCities(next);
    } else {
      setExpandedCities({});
    }
  };

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
      <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
            <span>{title}</span>
            {hasCities && viewMode === 'grouped' && (
              <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                Cidade ➔ Bairros / Vilas
              </span>
            )}
          </h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher: Hierarchical vs Flat (if cities present) */}
          {hasCities && (
            <div className="inline-flex rounded-md shadow-2xs p-0.5 bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] rounded transition cursor-pointer ${
                  viewMode === 'grouped'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
                title="Visualizar agrupado hierarquicamente por Cidade"
              >
                <ListTree className="h-3 w-3" />
                <span>Por Cidade</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('flat')}
                className={`inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] rounded transition cursor-pointer ${
                  viewMode === 'flat'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
                title="Visualizar em lista corrida única"
              >
                <List className="h-3 w-3" />
                <span>Lista Geral</span>
              </button>
            </div>
          )}

          {/* Expand / Collapse All (in grouped mode) */}
          {hasCities && viewMode === 'grouped' && cityGroups.length > 0 && (
            <button
              type="button"
              onClick={toggleAllCities}
              className="inline-flex items-center space-x-1 px-2 py-1 text-[11px] text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50 transition cursor-pointer font-medium"
            >
              {allExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <span>{allExpanded ? 'Recolher Cidades' : 'Expandir Cidades'}</span>
            </button>
          )}

          {/* City Filter Dropdown */}
          {uniqueCities.length > 0 && (
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer font-medium"
            >
              <option value="all">Todas as Cidades ({uniqueCities.length})</option>
              {uniqueCities.map((city) => (
                <option key={city} value={city}>
                  {city}{city.toLowerCase().includes('boa vista') ? ' (Distrito de Quatipuru)' : ''}
                </option>
              ))}
            </select>
          )}

          {/* Search Term Input */}
          <div className="relative w-full sm:w-52">
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
            {viewMode === 'grouped' && hasCities
              ? `${cityGroups.length} ${cityGroups.length === 1 ? 'cidade' : 'cidades'} (${filteredItems.length} vilas)`
              : `${filteredItems.length} ${filteredItems.length === 1 ? 'registro' : 'registros'}`}
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
                {viewMode === 'grouped' && hasCities ? 'Cidade / Bairro / Vila' : dimensionName} {renderSortIcon('name')}
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
            ) : viewMode === 'grouped' && hasCities ? (
              /* =========================================================================
                 ESTRUTURA HIERÁRQUICA: CIDADE ➔ BAIRROS / VILAS
                 ========================================================================= */
              cityGroups.map((group) => {
                const expanded = isCityExpanded(group.city);
                const cityShareOfTotal = totals.totalBlocked > 0
                  ? Math.round((group.totalBlocked / totals.totalBlocked) * 1000) / 10
                  : 0;

                return (
                  <Fragment key={'group-' + group.city}>
                    {/* Linha Cabeçalho da Cidade (Pai) */}
                    <tr
                      onClick={() => toggleCity(group.city)}
                      className="bg-slate-100/90 hover:bg-slate-200/80 transition-colors border-t-2 border-b border-slate-200 font-semibold cursor-pointer select-none"
                    >
                      <td className="py-2.5 px-3 text-slate-900">
                        <div className="flex items-center space-x-1.5">
                          <span className="p-0.5 rounded text-slate-500 hover:text-slate-900">
                            {expanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-slate-700" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-slate-700" />
                            )}
                          </span>
                          <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span className="font-bold text-slate-950 text-xs tracking-tight">
                            {group.city}
                          </span>
                          {group.city.toLowerCase().includes('boa vista') && (
                            <span className="text-[10px] bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.2 rounded font-medium">
                              Distrito de Quatipuru
                            </span>
                          )}
                          <span className="text-[10px] bg-white border border-slate-300 text-slate-600 px-1.5 py-0.2 rounded font-normal shadow-2xs">
                            {group.bairros.length} {group.bairros.length === 1 ? 'bairro/vila' : 'bairros/vilas'}
                          </span>
                          {cityShareOfTotal >= 20 && (
                            <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-normal">
                              {cityShareOfTotal}% vol
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {group.totalBlocked.toLocaleString('pt-BR')}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        R$ {group.totalMrr.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-2.5 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-emerald-800 w-12 text-right">
                            {group.returnedRate.toFixed(1)}%
                          </span>
                          <div className="flex-1 min-w-[70px] bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-600 h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, group.returnedRate))}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-slate-500 font-normal">
                            ({group.returnedCount})
                          </span>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                            group.churnRate > 8
                              ? 'bg-rose-200 text-rose-900 font-bold'
                              : group.churnRate > 3
                              ? 'bg-rose-100 text-rose-800 font-semibold'
                              : 'bg-white text-slate-700 border border-slate-200 font-medium'
                          }`}
                        >
                          {group.churnRate.toFixed(1)}% ({group.churnedCount})
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right text-slate-700 font-semibold">
                        {group.stillBlockedCount}
                      </td>

                      <td className="py-2.5 px-3 text-right text-amber-800 font-semibold">
                        {group.suspendedCount}
                      </td>

                      <td className="py-2.5 px-4 text-right font-semibold text-slate-800">
                        {group.avgDaysToReturn > 0 ? `${group.avgDaysToReturn.toFixed(1)} d` : '—'}
                      </td>
                    </tr>

                    {/* Linhas Filhas: Bairros / Vilas da Cidade */}
                    {expanded &&
                      group.bairros.map((bairro, bIdx) => {
                        const shareOfCity = group.totalBlocked > 0
                          ? Math.round((bairro.totalBlocked / group.totalBlocked) * 1000) / 10
                          : 0;

                        return (
                          <tr
                            key={group.city + '-' + bairro.name + '-' + bIdx}
                            className="hover:bg-blue-50/40 transition-colors border-b border-slate-100 bg-white"
                          >
                            <td className="py-2 px-4 pl-8 font-medium text-slate-800">
                              <div className="flex items-center space-x-2">
                                <span className="text-slate-300 font-mono text-sm leading-none select-none">↳</span>
                                <span className="text-slate-700 font-medium">{bairro.name}</span>
                                {shareOfCity >= 25 && (
                                  <span className="text-[9px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded font-normal">
                                    {shareOfCity}% da cidade
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-2 px-3 text-right font-medium text-slate-700">
                              {bairro.totalBlocked.toLocaleString('pt-BR')}
                            </td>

                            <td className="py-2 px-3 text-right font-mono text-slate-600">
                              R$ {bairro.totalMrr.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            <td className="py-2 px-4">
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-emerald-700 w-12 text-right">
                                  {bairro.returnedRate.toFixed(1)}%
                                </span>
                                <div className="flex-1 min-w-[70px] bg-slate-100 rounded-full h-1 overflow-hidden">
                                  <div
                                    className="bg-emerald-500 h-1 rounded-full"
                                    style={{ width: `${Math.min(100, Math.max(0, bairro.returnedRate))}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-slate-400">
                                  ({bairro.returnedCount})
                                </span>
                              </div>
                            </td>

                            <td className="py-2 px-3 text-center">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium ${
                                  bairro.churnRate > 8
                                    ? 'bg-rose-100 text-rose-800 font-semibold'
                                    : bairro.churnRate > 3
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-slate-50 text-slate-600'
                                }`}
                              >
                                {bairro.churnRate.toFixed(1)}% ({bairro.churnedCount})
                              </span>
                            </td>

                            <td className="py-2 px-3 text-right text-slate-500 text-[11px]">
                              {bairro.stillBlockedCount}
                            </td>

                            <td className="py-2 px-3 text-right text-amber-700 text-[11px]">
                              {bairro.suspendedCount}
                            </td>

                            <td className="py-2 px-4 text-right text-slate-600 text-[11px]">
                              {bairro.avgDaysToReturn > 0 ? `${bairro.avgDaysToReturn.toFixed(1)} d` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })
            ) : (
              /* =========================================================================
                 VISÃO EM LISTA PLANA (Padrão para Planos, Ciclos e Cidades)
                 ========================================================================= */
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
                        {item.name.toLowerCase().includes('boa vista') && (
                          <span className="text-[10px] bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
                            Distrito de Quatipuru
                          </span>
                        )}
                        {item.city && (
                          <span className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded font-normal whitespace-nowrap">
                            {item.city}
                          </span>
                        )}
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
                <td className="py-3 px-4">
                  Total Consolidado ({hasCities && viewMode === 'grouped' ? `${cityGroups.length} cidades • ${cityFilteredItems.length} bairros/vilas` : `${cityFilteredItems.length} ${dimensionName.toLowerCase()}s`}
                  {selectedCity !== 'all' ? ` em ${selectedCity}` : ''})
                </td>
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
