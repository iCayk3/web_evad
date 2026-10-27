import React, { useState, useMemo } from 'react';
import type { ClientRecord } from '../types';
import { API_BASE } from '../config/api';
import { 
  Search, 
  Download, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';

interface ClientsTableProps {
  clients: ClientRecord[];
  monthLabel: string;
  selectedMonth?: string;
  onSyncSuccess?: () => void;
}

type SortField = 'blockDate' | 'rbxCode' | 'name' | 'contract' | 'plan' | 'city' | 'userRbx' | 'daysToResolve' | 'status' | 'rbxStatus';
type SortDirection = 'asc' | 'desc';

function parseBRDateToTimestamp(dateStr: string): number {
  if (!dateStr) return 0;
  const parts = dateStr.trim().split(' ');
  const dateParts = parts[0].split(/[\/-]/);
  if (dateParts.length !== 3) return 0;
  
  const day = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const year = parseInt(dateParts[2], 10);
  
  let hour = 0, min = 0, sec = 0;
  if (parts[1]) {
    const timeParts = parts[1].split(':');
    hour = parseInt(timeParts[0] || '0', 10);
    min = parseInt(timeParts[1] || '0', 10);
    sec = parseInt(timeParts[2] || '0', 10);
  }
  
  return new Date(year, month, day, hour, min, sec).getTime();
}

export const ClientsTable: React.FC<ClientsTableProps> = ({ 
  clients, 
  monthLabel, 
  selectedMonth,
  onSyncSuccess 
}) => {
  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'returned' | 'blocked' | 'churned' | 'suspended' | 'inherited' | 'mimos'>('all');
  const [rbxFilter, setRbxFilter] = useState<string>('all');
  const [cycleFilter, setCycleFilter] = useState<'all' | '10' | '20' | '30'>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [speedFilter, setSpeedFilter] = useState<'all' | '0-7' | '8-15' | '16-30' | '>30'>('all');
  const [hideMimos, setHideMimos] = useState<boolean>(true);

  const inheritedCount = useMemo(() => {
    return clients.filter((c) => c.isInheritedDebt).length;
  }, [clients]);

  const mimoCount = useMemo(() => {
    return clients.filter((c) => c.isMimo).length;
  }, [clients]);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('blockDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Dynamic filter options based on actual data
  const uniqueCities = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => {
      if (c.city && c.city.trim() !== '') set.add(c.city.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [clients]);

  const uniquePlans = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => {
      if (c.plan && c.plan.trim() !== '') set.add(c.plan.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [clients]);

  // Breakdown of RBX Statuses for quick badges
  const rbxStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: clients.length,
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      S: 0,
      E: 0,
      I: 0,
      T: 0,
      other: 0,
    };
    clients.forEach((c) => {
      const code = (c.rbxStatusCode || '').toUpperCase();
      if (counts[code] !== undefined) {
        counts[code]++;
      } else {
        counts.other++;
      }
    });
    return counts;
  }, [clients]);

  // Trigger RBX Sync
  const handleSyncRbx = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/sync/rbx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedMonth }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncFeedback({
          message: data.message || 'Sincronização concluída com sucesso!',
          type: 'success',
        });
        if (onSyncSuccess) {
          onSyncSuccess();
        }
      } else {
        setSyncFeedback({
          message: data.error || 'Erro ao sincronizar com o RBX.',
          type: 'error',
        });
      }
    } catch {
      setSyncFeedback({
        message: 'Falha de comunicação com o servidor backend.',
        type: 'error',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Sort Header Click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'blockDate' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  // Check if any filter is active
  const isAnyFilterActive = 
    searchTerm !== '' || 
    statusFilter !== 'all' || 
    rbxFilter !== 'all' ||
    cycleFilter !== 'all' || 
    cityFilter !== 'all' || 
    planFilter !== 'all' || 
    speedFilter !== 'all';

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setRbxFilter('all');
    setCycleFilter('all');
    setCityFilter('all');
    setPlanFilter('all');
    setSpeedFilter('all');
    setCurrentPage(1);
  };

  // Filter & Sort Pipeline
  const filteredAndSortedClients = useMemo(() => {
    // 1. Filter
    const filtered = clients.filter((c) => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = 
        term === '' ||
        c.name.toLowerCase().includes(term) ||
        c.rbxCode.toLowerCase().includes(term) ||
        c.contract.toLowerCase().includes(term) ||
        c.city.toLowerCase().includes(term) ||
        c.plan.toLowerCase().includes(term) ||
        c.userRbx.toLowerCase().includes(term) ||
        (c.rbxStatusText && c.rbxStatusText.toLowerCase().includes(term)) ||
        (c.cancellationReason && c.cancellationReason.toLowerCase().includes(term));

      if (statusFilter === 'mimos') {
        if (!c.isMimo) return false;
      } else if (hideMimos && c.isMimo) {
        return false;
      }

      const matchesStatus = 
        statusFilter === 'all' 
          ? true 
          : statusFilter === 'inherited'
          ? !!c.isInheritedDebt
          : statusFilter === 'mimos'
          ? !!c.isMimo
          : c.status === statusFilter;
      
      let matchesRbx = true;
      if (rbxFilter !== 'all') {
        const cCode = (c.rbxStatusCode || '').toUpperCase();
        if (rbxFilter === 'other') {
          matchesRbx = !['A', 'B', 'C', 'D', 'S'].includes(cCode);
        } else {
          matchesRbx = cCode === rbxFilter;
        }
      }

      const matchesCity = cityFilter === 'all' || c.city === cityFilter;
      const matchesPlan = planFilter === 'all' || c.plan === planFilter;

      let matchesCycle = true;
      if (cycleFilter !== 'all') {
        if (cycleFilter === '10') matchesCycle = c.billingCycle?.includes('Ciclo 10') || false;
        else if (cycleFilter === '20') matchesCycle = c.billingCycle?.includes('Ciclo 20') || false;
        else if (cycleFilter === '30') matchesCycle = c.billingCycle?.includes('Ciclo 30') || false;
      }

      let matchesSpeed = true;
      if (speedFilter !== 'all') {
        if (c.status !== 'returned' || c.daysToResolve === null) {
          matchesSpeed = false;
        } else {
          const d = c.daysToResolve;
          if (speedFilter === '0-7') matchesSpeed = d <= 7;
          else if (speedFilter === '8-15') matchesSpeed = d >= 8 && d <= 15;
          else if (speedFilter === '16-30') matchesSpeed = d >= 16 && d <= 30;
          else if (speedFilter === '>30') matchesSpeed = d > 30;
        }
      }

      return matchesSearch && matchesStatus && matchesRbx && matchesCity && matchesPlan && matchesCycle && matchesSpeed;
    });

    // 2. Sort
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'blockDate':
          comparison = parseBRDateToTimestamp(a.blockDate) - parseBRDateToTimestamp(b.blockDate);
          break;
        case 'rbxCode': {
          const numA = parseFloat(a.rbxCode.replace(/[^\d]/g, '')) || 0;
          const numB = parseFloat(b.rbxCode.replace(/[^\d]/g, '')) || 0;
          comparison = numA !== numB ? numA - numB : a.rbxCode.localeCompare(b.rbxCode);
          break;
        }
        case 'contract': {
          const numA = parseFloat(a.contract.replace(/[^\d]/g, '')) || 0;
          const numB = parseFloat(b.contract.replace(/[^\d]/g, '')) || 0;
          comparison = numA !== numB ? numA - numB : a.contract.localeCompare(b.contract);
          break;
        }
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'city':
          comparison = a.city.localeCompare(b.city);
          break;
        case 'plan':
          comparison = a.plan.localeCompare(b.plan);
          break;
        case 'userRbx':
          comparison = a.userRbx.localeCompare(b.userRbx);
          break;
        case 'daysToResolve': {
          const valA = a.daysToResolve !== null ? a.daysToResolve : 9999;
          const valB = b.daysToResolve !== null ? b.daysToResolve : 9999;
          comparison = valA - valB;
          break;
        }
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'rbxStatus':
          comparison = (a.rbxStatusText || '').localeCompare(b.rbxStatusText || '');
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [clients, searchTerm, statusFilter, rbxFilter, cityFilter, planFilter, cycleFilter, speedFilter, hideMimos, sortField, sortDirection]);

  // Pagination Calculations
  const totalItems = filteredAndSortedClients.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedClients = filteredAndSortedClients.slice(startIndex, endIndex);

  // Quick Metrics of filtered dataset
  const filteredReturned = useMemo(() => filteredAndSortedClients.filter((c) => c.status === 'returned').length, [filteredAndSortedClients]);
  const filteredBlocked = useMemo(() => filteredAndSortedClients.filter((c) => c.status === 'blocked').length, [filteredAndSortedClients]);
  const filteredChurned = useMemo(() => filteredAndSortedClients.filter((c) => c.status === 'churned').length, [filteredAndSortedClients]);
  const filteredRate = totalItems > 0 ? ((filteredReturned / totalItems) * 100).toFixed(1) : '0.0';

  // Export to CSV function
  const exportCSV = () => {
    const headers = [
      'Data/Hora Bloqueio',
      'Cliente',
      'Nome',
      'Contrato',
      'Plano',
      'Cidade',
      'Operação',
      'Usuário',
      'Régua/Ciclo',
      'Status RBX Código',
      'Situação RBX',
      'Motivo Cancelamento',
      'Desfecho EVAD',
      'Data Desbloqueio',
      'Dias para Resolver',
    ];

    const rows = filteredAndSortedClients.map((c) => [
      `"${c.blockDate}"`,
      `"${c.rbxCode}"`,
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.contract}"`,
      `"${c.plan.replace(/"/g, '""')}"`,
      `"${c.city.replace(/"/g, '""')}"`,
      `"${c.operation}"`,
      `"${c.userRbx}"`,
      `"${c.billingCycle}"`,
      `"${c.rbxStatusCode || ''}"`,
      `"${c.rbxStatusText || ''}"`,
      `"${c.cancellationReason || ''}"`,
      c.status === 'returned' ? 'Voltou para Base' : c.status === 'blocked' ? 'Ainda Bloqueado' : c.status === 'churned' ? 'Cancelou' : 'Outro',
      `"${c.unblockDate || ''}"`,
      c.daysToResolve !== null ? c.daysToResolve : '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bloqueios_rbx_${monthLabel.replace(/[^a-zA-Z0-9]/g, '_')}_filtrado.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-slate-500 transition ml-1" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-slate-900 ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 text-slate-900 ml-1" />
    );
  };

  // Helper render RBX Status tag
  const renderRbxBadge = (client: ClientRecord) => {
    const code = (client.rbxStatusCode || 'B').toUpperCase();
    const text = client.rbxStatusText || (code === 'A' ? 'Ativo' : code === 'C' ? 'Cancelado' : 'Bloqueado');

    let badgeClass = 'text-slate-700 bg-slate-100 border-slate-200';
    if (code === 'A') {
      badgeClass = 'text-emerald-800 bg-emerald-50 border-emerald-200';
    } else if (code === 'C' || code === 'N') {
      badgeClass = 'text-rose-800 bg-rose-50 border-rose-200';
    } else if (code === 'D') {
      badgeClass = 'text-blue-800 bg-blue-50 border-blue-200';
    } else if (code === 'S') {
      badgeClass = 'text-amber-800 bg-amber-50 border-amber-200';
    } else if (code === 'E' || code === 'I') {
      badgeClass = 'text-cyan-800 bg-cyan-50 border-cyan-200';
    } else if (code === 'T') {
      badgeClass = 'text-indigo-800 bg-indigo-50 border-indigo-200';
    }

    return (
      <div className="flex flex-col">
        <span 
          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${badgeClass} w-fit`}
          title={`Código RBX: ${code} - ${text}`}
        >
          {text} ({code})
        </span>
        {client.cancellationReason && (
          <span 
            className="text-[10px] text-rose-600 truncate max-w-[150px] mt-0.5" 
            title={`Motivo: ${client.cancellationReason}${client.lastOperationRbx ? ` • Operação em ${client.lastOperationRbx}` : ''}`}
          >
            {client.cancellationReason}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
      {/* 1. Header & Quick Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Relatório de Bloqueios e Situação no RBX
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
              {clients.length} contratos
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Exibindo <strong className="text-slate-800">{totalItems}</strong> contratos ({filteredReturned} voltaram, {filteredBlocked} bloqueados, {filteredChurned} cancelados) • Taxa de retorno: <strong className="text-emerald-700">{filteredRate}%</strong>
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Direct RBX Sync Button */}
          <button
            onClick={handleSyncRbx}
            disabled={isSyncing}
            title="Consultar situação atual de todos os contratos diretamente na API do RBX"
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-700 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando RBX...' : 'Sincronizar com RBX'}</span>
          </button>

          {isAnyFilterActive && (
            <button
              onClick={resetFilters}
              title="Limpar todos os filtros aplicados"
              className="flex items-center space-x-1 px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-md transition"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Limpar Filtros</span>
            </button>
          )}

          {totalItems > 0 && (
            <button
              onClick={exportCSV}
              title="Exportar dados filtrados para Excel/CSV"
              className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 transition"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Exportar ({totalItems})</span>
            </button>
          )}
        </div>
      </div>

      {/* Sync Feedback Message */}
      {syncFeedback && (
        <div className={`p-3 rounded-md text-xs flex items-center justify-between ${
          syncFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <div className="flex items-center space-x-2">
            {syncFeedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{syncFeedback.message}</span>
          </div>
          <button 
            onClick={() => setSyncFeedback(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* RBX Status Filter Pills Bar */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mr-1">
          Filtro RBX:
        </span>
        
        <button
          onClick={() => { setRbxFilter('all'); setCurrentPage(1); }}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer border ${
            rbxFilter === 'all' 
              ? 'bg-slate-900 text-white border-slate-900' 
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Todos ({rbxStatusCounts.all})
        </button>

        <button
          onClick={() => { setRbxFilter('A'); setCurrentPage(1); }}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer border ${
            rbxFilter === 'A' 
              ? 'bg-emerald-700 text-white border-emerald-700' 
              : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
          }`}
        >
          Ativos (A): {rbxStatusCounts.A}
        </button>

        <button
          onClick={() => { setRbxFilter('B'); setCurrentPage(1); }}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer border ${
            rbxFilter === 'B' 
              ? 'bg-slate-700 text-white border-slate-700' 
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          Bloqueados (B): {rbxStatusCounts.B}
        </button>

        <button
          onClick={() => { setRbxFilter('C'); setCurrentPage(1); }}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer border ${
            rbxFilter === 'C' 
              ? 'bg-rose-700 text-white border-rose-700' 
              : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
          }`}
        >
          Cancelados (C): {rbxStatusCounts.C}
        </button>

        <button
          onClick={() => { setRbxFilter('D'); setCurrentPage(1); }}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer border ${
            rbxFilter === 'D' 
              ? 'bg-blue-700 text-white border-blue-700' 
              : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
          }`}
        >
          Desbloq. Confiança (D): {rbxStatusCounts.D}
        </button>

        <button
          onClick={() => { setRbxFilter('S'); setCurrentPage(1); }}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer border ${
            rbxFilter === 'S' 
              ? 'bg-amber-700 text-white border-amber-700' 
              : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
          }`}
        >
          Suspensos (S): {rbxStatusCounts.S}
        </button>

        {(rbxStatusCounts.E > 0 || rbxStatusCounts.I > 0 || rbxStatusCounts.T > 0 || rbxStatusCounts.other > 0) && (
          <button
            onClick={() => { setRbxFilter('other'); setCurrentPage(1); }}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer border ${
              rbxFilter === 'other' 
                ? 'bg-cyan-700 text-white border-cyan-700' 
                : 'bg-white text-cyan-800 border-cyan-200 hover:bg-cyan-50'
            }`}
          >
            Outros/Instalação: {rbxStatusCounts.E + rbxStatusCounts.I + rbxStatusCounts.T + rbxStatusCounts.other}
          </button>
        )}
      </div>

      {/* 2. Advanced Multi-Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 pt-2 pb-2 border-t border-b border-slate-100 text-xs">
        {/* Search Input */}
        <div className="relative">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar nome, contrato..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-8 pr-7 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Desfecho EVAD Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white text-slate-700 cursor-pointer"
          >
            <option value="all">Desfecho: Todos</option>
            <option value="returned">Voltaram para a Base</option>
            <option value="blocked">Ainda Bloqueados</option>
            <option value="churned">Cancelados (Churn)</option>
            <option value="suspended">Suspensos</option>
            {inheritedCount > 0 && (
              <option value="inherited">Débitos Herdados / Renegociados ({inheritedCount})</option>
            )}
            {mimoCount > 0 && (
              <option value="mimos">Mimos / TV (R$ 0,00) ({mimoCount})</option>
            )}
          </select>
        </div>

        {/* Billing Cycle Filter */}
        <div>
          <select
            value={cycleFilter}
            onChange={(e) => {
              setCycleFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white text-slate-700 cursor-pointer"
          >
            <option value="all">Régua: Todos os Ciclos</option>
            <option value="10">Ciclo 10 (Bloq. 16-19)</option>
            <option value="20">Ciclo 20 (Bloq. 26-29)</option>
            <option value="30">Ciclo 30 (Bloq. 06-09 M+1)</option>
          </select>
        </div>

        {/* City Filter */}
        <div>
          <select
            value={cityFilter}
            onChange={(e) => {
              setCityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white text-slate-700 cursor-pointer"
          >
            <option value="all">Cidade: Todas ({uniqueCities.length})</option>
            {uniqueCities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        {/* Plan Filter */}
        <div>
          <select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white text-slate-700 cursor-pointer"
          >
            <option value="all">Plano: Todos ({uniquePlans.length})</option>
            {uniquePlans.map((plan) => (
              <option key={plan} value={plan}>
                {plan}
              </option>
            ))}
          </select>
        </div>

        {/* Return Speed Filter */}
        <div>
          <select
            value={speedFilter}
            onChange={(e) => {
              setSpeedFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white text-slate-700 cursor-pointer"
          >
            <option value="all">Tempo Retorno: Todos</option>
            <option value="0-7">Até 7 dias (Rápido)</option>
            <option value="8-15">8 a 15 dias</option>
            <option value="16-30">16 a 30 dias</option>
            <option value=">30">Mais de 30 dias (Tardio)</option>
          </select>
        </div>
      </div>

      {/* Mimo Counter & Active Count Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 pb-2 px-1 text-xs">
        <div className="flex items-center space-x-2 text-slate-500 text-[11px]">
          <span>Exibindo <strong>{filteredAndSortedClients.length}</strong> contratos</span>
          {mimoCount > 0 && hideMimos && (
            <span className="text-purple-600 font-medium">({mimoCount} mimos/TV desconsiderados)</span>
          )}
        </div>
        {mimoCount > 0 && (
          <label className="inline-flex items-center space-x-1.5 text-xs text-slate-700 select-none cursor-pointer px-2.5 py-1 bg-purple-50 hover:bg-purple-100 rounded-md border border-purple-200 transition">
            <input
              type="checkbox"
              checked={hideMimos}
              onChange={(e) => {
                setHideMimos(e.target.checked);
                setCurrentPage(1);
              }}
              className="rounded border-purple-300 text-purple-600 focus:ring-purple-600 h-3.5 w-3.5 cursor-pointer"
            />
            <span className="text-[11px] font-medium text-purple-900">
              Ocultar Mimos R$ 0,00 ({mimoCount})
            </span>
          </label>
        )}
      </div>

      {/* 3. Interactive Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-semibold">
            <tr>
              <th
                onClick={() => handleSort('blockDate')}
                className="py-2.5 px-3 cursor-pointer select-none group hover:bg-slate-100 transition whitespace-nowrap"
              >
                <div className="flex items-center">
                  <span>Data/Hora Bloqueio</span>
                  {renderSortIcon('blockDate')}
                </div>
              </th>
              <th
                onClick={() => handleSort('rbxCode')}
                className="py-2.5 px-3 cursor-pointer select-none group hover:bg-slate-100 transition whitespace-nowrap"
              >
                <div className="flex items-center">
                  <span>Cliente</span>
                  {renderSortIcon('rbxCode')}
                </div>
              </th>
              <th
                onClick={() => handleSort('name')}
                className="py-2.5 px-3 cursor-pointer select-none group hover:bg-slate-100 transition"
              >
                <div className="flex items-center">
                  <span>Nome</span>
                  {renderSortIcon('name')}
                </div>
              </th>
              <th
                onClick={() => handleSort('contract')}
                className="py-2.5 px-3 cursor-pointer select-none group hover:bg-slate-100 transition whitespace-nowrap"
              >
                <div className="flex items-center">
                  <span>Contrato</span>
                  {renderSortIcon('contract')}
                </div>
              </th>
              <th
                onClick={() => handleSort('plan')}
                className="py-2.5 px-3 cursor-pointer select-none group hover:bg-slate-100 transition whitespace-nowrap"
              >
                <div className="flex items-center">
                  <span>Plano</span>
                  {renderSortIcon('plan')}
                </div>
              </th>
              <th
                onClick={() => handleSort('city')}
                className="py-2.5 px-3 cursor-pointer select-none group hover:bg-slate-100 transition whitespace-nowrap"
              >
                <div className="flex items-center">
                  <span>Cidade</span>
                  {renderSortIcon('city')}
                </div>
              </th>
              <th
                onClick={() => handleSort('rbxStatus')}
                className="py-2.5 px-3 cursor-pointer select-none group hover:bg-slate-100 transition whitespace-nowrap"
              >
                <div className="flex items-center">
                  <span>Situação RBX</span>
                  {renderSortIcon('rbxStatus')}
                </div>
              </th>
              <th
                onClick={() => handleSort('daysToResolve')}
                className="py-2.5 px-3 cursor-pointer select-none group hover:bg-slate-100 transition whitespace-nowrap text-right"
              >
                <div className="flex items-center justify-end">
                  <span>Dias p/ Resolver</span>
                  {renderSortIcon('daysToResolve')}
                </div>
              </th>
              <th
                onClick={() => handleSort('status')}
                className="py-2.5 px-3 cursor-pointer select-none group hover:bg-slate-100 transition whitespace-nowrap text-right"
              >
                <div className="flex items-center justify-end">
                  <span>Desfecho</span>
                  {renderSortIcon('status')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedClients.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <HelpCircle className="h-8 w-8 text-slate-300" />
                    <span>Nenhum contrato encontrado com os filtros selecionados.</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedClients.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <div className="font-mono text-slate-800">{client.blockDate}</div>
                    {client.billingCycle && (
                      <div className="text-[10px] text-slate-400 font-medium">
                        {client.billingCycle}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-medium text-slate-900 whitespace-nowrap">
                    {client.rbxCode}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-900">
                    <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                      <span>{client.name}</span>
                      {client.isInheritedDebt && (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800 border border-purple-200"
                          title={client.debtLabel || `Débito herdado do ciclo anterior (${client.originalDebtDueDate})`}
                        >
                          {client.originalDebtDueDate
                            ? `Débito Anterior: ${client.originalDebtDueDate.split('-').reverse().join('/')}`
                            : 'Débito Anterior'}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">Op: {client.userRbx}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                    {client.contract}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">
                    <div className="flex items-center space-x-1.5 flex-wrap">
                      <span className="font-medium text-slate-900">{client.plan}</span>
                      {client.isMimo && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                          Mimo / SVA
                        </span>
                      )}
                    </div>
                    {client.monthlyFee > 0 ? (
                      <div className="text-[10px] text-slate-500 font-mono">R$ {client.monthlyFee.toFixed(2)}</div>
                    ) : (
                      <div className="text-[10px] text-purple-600 font-medium">Gratuito (R$ 0,00)</div>
                    )}
                    {client.linkedMimos && (
                      <div className="mt-1 flex items-center">
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200"
                          title={`Serviços adicionais gratuitos vinculados a este cliente: ${client.linkedMimos}`}
                        >
                          📺 + Mimo: {client.linkedMimos}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                    {client.city}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {renderRbxBadge(client)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                    {client.status === 'returned' && client.daysToResolve !== null ? (
                      <span className="font-semibold text-slate-900">
                        {client.daysToResolve} {client.daysToResolve === 1 ? 'dia' : 'dias'}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium whitespace-nowrap">
                    {client.status === 'returned' && (
                      <div className="flex flex-col items-end">
                        <span
                          className="text-emerald-700 font-semibold"
                          title={client.unblockDate ? `Regularizado no ciclo da coorte` : 'Retornou à base'}
                        >
                          Voltou à base
                        </span>
                        {client.rbxStatusCode === 'C' && (
                          <span
                            className="text-[10px] text-slate-400 font-normal"
                            title={
                              client.cancellationReason
                                ? `Motivo no RBX: ${client.cancellationReason} (Operação em ${client.lastOperationRbx || ''})`
                                : `Cancelado posteriormente em ${client.lastOperationRbx || ''}`
                            }
                          >
                            {client.cancellationReason?.includes('AJUSTE')
                              ? 'Ajuste Técnico'
                              : client.cancellationReason?.includes('TITULARIDADE')
                              ? 'Mud. Titularidade'
                              : client.cancellationReason?.includes('MIGRA')
                              ? 'Migração de Plano'
                              : client.cancellationReason?.includes('SEM USO')
                              ? 'Sem Uso do Ponto'
                              : client.lastOperationRbx
                              ? `Canc. posterior (${client.lastOperationRbx.slice(3, 10)})`
                              : 'Canc. posterior'}
                          </span>
                        )}
                        {(client.rbxStatusCode === 'B' || client.rbxStatusCode === 'P') && (
                          <span
                            className="text-[10px] text-amber-700/80 font-normal"
                            title={`Regularizado na coorte de janeiro. Rebloqueado em ciclo posterior em ${client.lastOperationRbx || ''}`}
                          >
                            {client.lastOperationRbx
                              ? `Rebloqueio post. (${client.lastOperationRbx.slice(3, 10)})`
                              : 'Rebloqueio posterior'}
                          </span>
                        )}
                        {client.rbxStatusCode === 'S' && (
                          <span
                            className="text-[10px] text-amber-700/80 font-normal"
                            title={`Regularizado na coorte de janeiro. Suspenso em ciclo posterior em ${client.lastOperationRbx || ''}`}
                          >
                            {client.lastOperationRbx
                              ? `Susp. posterior (${client.lastOperationRbx.slice(3, 10)})`
                              : 'Susp. posterior'}
                          </span>
                        )}
                      </div>
                    )}
                    {client.status === 'blocked' && (
                      <span className="text-slate-600">
                        Ainda bloqueado
                      </span>
                    )}
                    {client.status === 'churned' && (
                      <div className="flex flex-col items-end">
                        <span
                          className="text-rose-700 font-semibold"
                          title={client.cancellationDate ? `Cancelado em ${client.cancellationDate}` : 'Cancelamento formal'}
                        >
                          Cancelou
                        </span>
                        {client.cancellationReason && (
                          <span
                            className="text-[10px] text-rose-500 font-normal text-right max-w-[130px] truncate"
                            title={`Motivo no RBX: ${client.cancellationReason}`}
                          >
                            {client.cancellationReason.includes('SEM USO')
                              ? 'Sem Uso do Ponto'
                              : client.cancellationReason.replace(/[()]/g, '')}
                          </span>
                        )}
                      </div>
                    )}
                    {client.status === 'suspended' && (
                      <div className="flex flex-col items-end">
                        <span className="text-amber-700 font-medium">
                          Suspenso
                        </span>
                        {client.isInheritedDebt && (
                          <span
                            className="mt-0.5 text-[10px] text-purple-700 font-medium text-right"
                            title={client.debtLabel}
                          >
                            Renegociado RBX
                          </span>
                        )}
                      </div>
                    )}
                    {client.status === 'other' && (
                      <span className="text-cyan-700 font-medium">
                        Em operação
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Pagination & Display Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 border-t border-slate-100 gap-3 text-xs text-slate-500">
        <div className="flex items-center space-x-2">
          <span>Itens por página:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2 py-1 border border-slate-300 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
          >
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-slate-400">|</span>
          <span>
            Mostrando <strong>{totalItems > 0 ? startIndex + 1 : 0}</strong> a <strong>{endIndex}</strong> de <strong>{totalItems}</strong> registros
          </span>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="px-3 py-1 font-medium text-slate-700">
            Página {currentPage} de {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="Próxima página"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
