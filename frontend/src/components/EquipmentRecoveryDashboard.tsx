import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PackageCheck,
  PackageX,
  RotateCcw,
  Clock,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  MapPin,
  HardDrive,
  FileText,
  Calendar,
  Layers,
  Building2,
  Eye,
  EyeOff,
  GitBranch,
} from 'lucide-react';
import { API_BASE } from '../config/api';
import type { EquipamentoResponse } from '../types';

const formatMonthLabel = (monthKey: string) => {
  if (!monthKey) return '';
  const [year, month] = monthKey.split('-');
  const monthNames: Record<string, string> = {
    '01': 'Janeiro',
    '02': 'Fevereiro',
    '03': 'Março',
    '04': 'Abril',
    '05': 'Maio',
    '06': 'Junho',
    '07': 'Julho',
    '08': 'Agosto',
    '09': 'Setembro',
    '10': 'Outubro',
    '11': 'Novembro',
    '12': 'Dezembro',
  };
  const name = monthNames[month] || month;
  return `${name} / ${year}`;
};

interface ParsedFlow {
  topico: string;
  causa: string;
  abertura: string;
  encerramento: string;
  usuario: string;
  setor: string;
  detalhes: string;
}

const parseFlows = (assunto: string): ParsedFlow[] => {
  if (!assunto || !assunto.includes('Fluxo finalizado')) return [];
  const parts = assunto.split(/#\s*###\s*Fluxo finalizado:\s*#\s*###\//i);
  const flows: ParsedFlow[] = [];

  for (let i = 1; i < parts.length; i++) {
    const text = parts[i];
    const topicoMatch = text.match(/#\s*Tópico:\s*([^#/]+)#/i);
    const causaMatch = text.match(/#\s*Causa:\s*([^#/]+)#/i);
    const abertMatch = text.match(/#\s*Data\/Hora Abertura:\s*([^#/]+)#/i);
    const encMatch = text.match(/#\s*Data\/Hora Encerramento:\s*([^#/]+)#/i);
    const userMatch = text.match(/#\s*Usuário:\s*([^#/]+)#/i);
    const setorMatch = text.match(/#\s*Setor\/Grupo:\s*([^#/]+)#/i);

    const detalhes = text
      .replace(/#\s*[^#]+#\//g, '')
      .replace(/#\s*[^#]+#/g, '')
      .trim();

    flows.push({
      topico: topicoMatch ? topicoMatch[1].trim() : 'Fluxo Concluído',
      causa: causaMatch ? causaMatch[1].trim() : '',
      abertura: abertMatch ? abertMatch[1].trim() : '',
      encerramento: encMatch ? encMatch[1].trim() : '',
      usuario: userMatch ? userMatch[1].trim() : '',
      setor: setorMatch ? setorMatch[1].trim() : '',
      detalhes,
    });
  }
  return flows;
};

interface EquipmentRecoveryDashboardProps {
  selectedMonth?: string;
  onMonthChange?: (month: string) => void;
}

export const EquipmentRecoveryDashboard: React.FC<EquipmentRecoveryDashboardProps> = ({
  selectedMonth: propMonth,
  onMonthChange,
}) => {
  const [data, setData] = useState<EquipamentoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(propMonth || '2026-01');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Sincroniza com a competência global caso o usuário navegue no cabeçalho superior
  useEffect(() => {
    if (propMonth && propMonth !== selectedMonth) {
      setSelectedMonth(propMonth);
    }
  }, [propMonth]);

  const handleMonthSelect = (newMonth: string) => {
    setSelectedMonth(newMonth);
    if (onMonthChange) {
      onMonthChange(newMonth);
    }
  };
  const [cityFilter, setCityFilter] = useState<string>('todas');
  const [showDuplicates, setShowDuplicates] = useState(false); // Preferivelmente manter oculto por padrão
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const fetchData = useCallback(async (month: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/equipamentos/retiradas?month=${month}`);
      if (res.ok) {
        const json: EquipamentoResponse = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Erro ao carregar atendimentos de equipamentos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(selectedMonth);
  }, [selectedMonth, fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/equipamentos/sync`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setSyncMessage({ text: json.message || 'Sincronização concluída!', isError: false });
        await fetchData(selectedMonth);
      } else {
        setSyncMessage({ text: json.error || 'Erro ao sincronizar', isError: true });
      }
    } catch (err: any) {
      setSyncMessage({ text: `Falha na requisição: ${err.message}`, isError: true });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 6000);
    }
  };

  const citiesList = useMemo(() => {
    if (!data?.orders) return [];
    const set = new Set<string>();
    data.orders.forEach((o) => {
      if (o.cidade && o.cidade !== 'Não Informado') set.add(o.cidade);
    });
    return Array.from(set).sort();
  }, [data?.orders]);

  const filteredOrders = useMemo(() => {
    if (!data?.orders) return [];
    return data.orders.filter((order) => {
      // Filtro de duplicados (preferivelmente manter oculto por padrão)
      if (!showDuplicates && order.ehDuplicado) {
        return false;
      }
      // Status Filter
      if (statusFilter !== 'todos' && order.statusRecuperacao !== statusFilter) {
        return false;
      }
      // City Filter
      if (cityFilter !== 'todas' && order.cidade !== cityFilter) {
        return false;
      }
      // Search Term
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchName = order.nomeCliente.toLowerCase().includes(term);
        const matchCode = order.codigoCliente.toLowerCase().includes(term);
        const matchProtocol = order.protocolo.toLowerCase().includes(term);
        const matchId = order.id.toLowerCase().includes(term);
        const matchEquip = order.equipamentoIdentificado.toLowerCase().includes(term);
        const matchSerial = order.serialMac.toLowerCase().includes(term);
        const matchCity = order.cidade.toLowerCase().includes(term);
        const matchBairro = order.bairro.toLowerCase().includes(term);
        const matchSolution = order.solucao.toLowerCase().includes(term);
        if (
          !matchName &&
          !matchCode &&
          !matchProtocol &&
          !matchId &&
          !matchEquip &&
          !matchSerial &&
          !matchCity &&
          !matchBairro &&
          !matchSolution
        ) {
          return false;
        }
      }
      return true;
    });
  }, [data?.orders, showDuplicates, statusFilter, cityFilter, searchTerm]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'recuperado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Recuperado
          </span>
        );
      case 'pendente':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <PackageX className="w-3.5 h-3.5 text-rose-600" />
            Não Recuperado / Pendente
          </span>
        );
      case 'em_andamento':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Em Andamento
          </span>
        );
      case 'sem_os':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            Sem OS (Em Risco)
          </span>
        );
      case 'cancelamento_abortado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
            Desistiu / Retido
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const summary = data?.summary || {
    totalOrders: 0,
    totalDuplicados: 0,
    recuperados: 0,
    pendentes: 0,
    emAndamento: 0,
    cancelamentoAbortado: 0,
    semOS: 0,
    taxaRecuperacao: 0,
    taxaEfetividadeOS: 0,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner / Controls */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-lg shrink-0">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                <span>Recuperação de Equipamentos</span>
                <span className="text-[10px] sm:text-[11px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  Gestão de Hardware
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Auditoria estrita dos clientes da planilha de <strong>{formatMonthLabel(selectedMonth)}</strong> cruzados com as ordens de retirada do RBX
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
          {/* Seletor de Mês */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium shrink-0">
            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="hidden sm:inline">Mês:</span>
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthSelect(e.target.value)}
              className="bg-transparent font-bold text-slate-900 border-none outline-none cursor-pointer pr-1 text-xs"
            >
              {data?.availableMonths && data.availableMonths.length > 0 ? (
                data.availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))
              ) : (
                <option value={selectedMonth}>{formatMonthLabel(selectedMonth)}</option>
              )}
            </select>
          </div>

          {/* Botão Sincronizar RBX */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Sincronizando RBX...' : 'Sincronizar Atendimentos'}</span>
          </button>
        </div>
      </div>

      {/* Sync feedback message */}
      {syncMessage && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center space-x-2 animate-fade-in ${
            syncMessage.isError
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {syncMessage.isError ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          )}
          <span>{syncMessage.text}</span>
        </div>
      )}

      {/* KPI Cards Grid - Responsivo: 2 cols mobile, 3 cols tablet/notebook, 6 cols desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-3.5">
        {/* Card 1: Total */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider truncate">Total em Atenção</span>
            <Layers className="w-4 h-4 text-slate-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900">
            {loading ? '...' : summary.totalOrders}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">Chamados + Churn s/ OS</p>
        </div>

        {/* Card 2: Recuperados */}
        <div className="bg-white border border-emerald-200/80 rounded-xl p-3.5 sm:p-4 shadow-xs bg-emerald-50/20">
          <div className="flex items-center justify-between text-emerald-800 mb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider truncate">Recuperados</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-700">
            {loading ? '...' : summary.recuperados}
          </div>
          <p className="text-[10px] sm:text-[11px] text-emerald-600/80 mt-0.5 truncate">Equipamentos recolhidos</p>
        </div>

        {/* Card 3: Taxa de Recuperação Global */}
        <div className="bg-white border border-blue-200/80 rounded-xl p-3.5 sm:p-4 shadow-xs bg-blue-50/20">
          <div className="flex items-center justify-between text-blue-900 mb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider truncate">Taxa Global</span>
            <span className="text-xs font-bold text-blue-700">{summary.taxaRecuperacao}%</span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-blue-700">
            {loading ? '...' : `${summary.taxaRecuperacao}%`}
          </div>
          {/* Visual progress bar */}
          <div className="w-full bg-blue-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(summary.taxaRecuperacao, 100)}%` }}
            ></div>
          </div>
          <p className="text-[10px] text-blue-600 font-medium mt-1 truncate">
            Eficácia OS: {summary.taxaEfetividadeOS ?? 0}%
          </p>
        </div>

        {/* Card 4: Sem OS Aberta (Equipamento em Risco) */}
        <div className="bg-amber-50/40 border border-amber-300/80 rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-900 mb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider truncate">Sem OS (Em Risco)</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-amber-700">
            {loading ? '...' : summary.semOS}
          </div>
          <p className="text-[10px] sm:text-[11px] text-amber-700/80 mt-0.5 truncate">Cancelou s/ ordem busca</p>
        </div>

        {/* Card 5: Pendentes / Insucesso */}
        <div className="bg-white border border-rose-200/80 rounded-xl p-3.5 sm:p-4 shadow-xs bg-rose-50/20">
          <div className="flex items-center justify-between text-rose-800 mb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider truncate">Não Recuperados</span>
            <PackageX className="w-4 h-4 text-rose-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-rose-700">
            {loading ? '...' : summary.pendentes}
          </div>
          <p className="text-[10px] sm:text-[11px] text-rose-600/80 mt-0.5 truncate">Ninguém no local / Insucesso</p>
        </div>

        {/* Card 6: Desistiu / Retido */}
        <div className="bg-white border border-purple-200/80 rounded-xl p-3.5 sm:p-4 shadow-xs bg-purple-50/20">
          <div className="flex items-center justify-between text-purple-800 mb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider truncate">Desistiu / Retido</span>
            <RotateCcw className="w-4 h-4 text-purple-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-purple-700">
            {loading ? '...' : summary.cancelamentoAbortado}
          </div>
          <p className="text-[10px] sm:text-[11px] text-purple-600/80 mt-0.5 truncate">Cancelamento abortado</p>
        </div>
      </div>

      {/* Regional Summary Badges */}
      {data?.byCity && data.byCity.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Desempenho por Cidade no Mês</span>
          </div>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {data.byCity.map((c) => (
              <button
                key={c.cidade}
                onClick={() => setCityFilter(cityFilter === c.cidade ? 'todas' : c.cidade)}
                className={`text-[11px] sm:text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border transition flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
                  cityFilter === c.cidade
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span className="font-semibold">{c.cidade}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${cityFilter === c.cidade ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-800'}`}>
                  {c.total}
                </span>
                <span className={`text-[10px] font-bold ${c.taxaRecuperacao >= 60 ? 'text-emerald-600' : 'text-amber-600'} ${cityFilter === c.cidade ? 'text-emerald-300' : ''}`}>
                  {c.taxaRecuperacao}%
                </span>
                {c.semOS > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${cityFilter === c.cidade ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
                    {c.semOS} sem OS
                  </span>
                )}
              </button>
            ))}
            {cityFilter !== 'todas' && (
              <button
                onClick={() => setCityFilter('todas')}
                className="text-xs px-2.5 py-1 text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                Limpar filtro
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search & Filter Bar - 2-tier robust responsive layout */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-3.5 sm:p-4 space-y-3">
        {/* Tier 1: Search Input & Controls (Cidades + Toggle Duplicados) */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          {/* Search Input - Amplo e flexível */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, código, protocolo, serial, parecer..."
              className="w-full pl-9 pr-8 py-2 sm:py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm px-1"
                title="Limpar busca"
              >
                ×
              </button>
            )}
          </div>

          {/* Controls: Seletor de Cidades e Toggle de Duplicados */}
          <div className="flex items-center gap-2 shrink-0">
            {citiesList.length > 0 && (
              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium shrink-0 flex-1 sm:flex-initial">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  className="bg-transparent text-slate-800 border-none outline-none cursor-pointer pr-1 w-full sm:w-auto text-xs"
                >
                  <option value="todas">Todas as Cidades ({data?.orders.length || 0})</option>
                  {citiesList.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Toggle para exibir ou manter oculto os cadastros duplicados (por padrão oculto) */}
            {summary.totalDuplicados > 0 && (
              <button
                onClick={() => setShowDuplicates((prev) => !prev)}
                className={`flex items-center justify-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer select-none shrink-0 ${
                  showDuplicates
                    ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs hover:bg-amber-200'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                }`}
                title={showDuplicates ? 'Clique para ocultar duplicados' : 'Clique para exibir cadastros duplicados'}
              >
                {showDuplicates ? (
                  <>
                    <Eye className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span className="hidden sm:inline">Exibindo Duplicados</span>
                    <span className="sm:hidden">Duplicados</span>
                    <span className="bg-amber-200/80 text-amber-900 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                      {summary.totalDuplicados}
                    </span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="hidden sm:inline">Ocultando Duplicados</span>
                    <span className="sm:hidden">Ocultos</span>
                    <span className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                      {summary.totalDuplicados}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Tier 2: Filter Pills Row - Scroll horizontal suave em telas menores / alinhamento perfeito em desktop */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 w-full">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 mr-1 hidden md:inline">
              Filtrar Status:
            </span>
            {[
              { id: 'todos', label: 'Todos', count: summary.totalOrders },
              { id: 'recuperado', label: 'Recuperados', count: summary.recuperados },
              { id: 'sem_os', label: 'Sem OS (Em Risco)', count: summary.semOS },
              { id: 'pendente', label: 'Não Recuperados', count: summary.pendentes },
              { id: 'em_andamento', label: 'Em Aberto', count: summary.emAndamento },
              { id: 'cancelamento_abortado', label: 'Desistiram', count: summary.cancelamentoAbortado },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`text-xs px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition cursor-pointer select-none flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-slate-900 text-white font-semibold shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    statusFilter === tab.id
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-slate-500 shrink-0" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
              Relação de Ordens de Retirada ({filteredOrders.length})
            </h3>
          </div>
          <span className="text-[10px] sm:text-[11px] text-slate-500">
            Clique na linha para expandir e ler o parecer técnico completo
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
            <span>Carregando dados de equipamentos...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Nenhuma ordem de retirada encontrada para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[780px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider select-none">
                  <th className="py-2.5 px-3 w-8"></th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Localidade</th>
                  <th className="py-2.5 px-3">Nº Atendimento / Data</th>
                  <th className="py-2.5 px-3">Equipamento / Serial</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3">Parecer Técnico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => {
                  const isExpanded = expandedId === order.id;
                  return (
                    <React.Fragment key={order.id}>
                      <tr
                        onClick={() => toggleExpand(order.id)}
                        className={`transition cursor-pointer ${
                          order.statusRecuperacao === 'sem_os'
                            ? isExpanded
                              ? 'bg-amber-100/70 border-l-4 border-l-amber-500'
                              : 'bg-amber-50/40 hover:bg-amber-100/50 border-l-4 border-l-amber-400'
                            : isExpanded
                            ? 'bg-blue-50/60'
                            : 'hover:bg-blue-50/40'
                        }`}
                      >
                        {/* Expand Icon */}
                        <td className="py-3 px-3 text-center text-slate-400">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-blue-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </td>

                        {/* Cliente */}
                        <td className="py-3 px-3 font-medium text-slate-900">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span>{order.nomeCliente}</span>
                            {order.ehDuplicado && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-0.5">
                                <AlertCircle className="w-3 h-3 text-amber-600" />
                                Duplicata RBX
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Cód: {order.codigoCliente} {order.contrato ? `• Contrato: ${order.contrato}` : ''}
                          </div>
                        </td>

                        {/* Localidade */}
                        <td className="py-3 px-3 text-slate-700">
                          <div className="font-semibold text-slate-800">{order.cidade}</div>
                          <div className="text-[11px] text-slate-500">{order.bairro}</div>
                        </td>

                        {/* Atendimento & Data */}
                        <td className="py-3 px-3 text-slate-700">
                          {order.statusRecuperacao === 'sem_os' ? (
                            <>
                              <div className="font-mono font-bold text-amber-700 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>Sem OS Aberta</span>
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Bloqueio/Canc: {formatDate(order.dataAbertura)}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="font-mono font-semibold text-slate-800">
                                #{order.id}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {formatDate(order.dataEncerramento || order.dataAbertura)}
                              </div>
                            </>
                          )}
                        </td>

                        {/* Equipamento */}
                        <td className="py-3 px-3 text-slate-800">
                          <div className="font-medium text-slate-900 line-clamp-1 max-w-xs">
                            {order.equipamentoIdentificado || 'Equipamento em Comodato'}
                          </div>
                          {order.serialMac && order.serialMac !== '-' && (
                            <div className="text-[10px] font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded inline-block mt-0.5">
                              {order.serialMac}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 text-center">
                          {getStatusBadge(order.statusRecuperacao)}
                        </td>

                        {/* Parecer Técnico */}
                        <td className="py-3 px-3 text-slate-600 max-w-xs">
                          {order.statusRecuperacao === 'sem_os' ? (
                            <div className="line-clamp-2 text-[11px] font-medium text-amber-800">
                              Cancelou ({order.causa || 'Inadimplência'}) - Nenhuma OS de retirada aberta
                            </div>
                          ) : (
                            <div className="line-clamp-2 text-[11px] italic text-slate-700">
                              {order.solucao ? `"${order.solucao}"` : order.causa || 'Sem parecer registrado'}
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80 border-b border-slate-200">
                          <td colSpan={7} className="p-4 px-6">
                            {order.statusRecuperacao === 'sem_os' ? (
                              <div className="space-y-3 bg-amber-50/90 border border-amber-300 rounded-lg p-4 shadow-2xs">
                                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                                  <AlertTriangle className="w-4.5 h-4.5 text-amber-600 shrink-0" />
                                  <span>Ponto Cego Identificado: Cancelamento de Contrato sem Ordem de Recolhimento</span>
                                </div>
                                <p className="text-slate-700 text-xs leading-relaxed">
                                  Este cliente sofreu cancelamento de contrato (motivo: <strong>{order.causa || 'Inadimplência'}</strong>) no período de competência, porém <strong>nenhuma OS de retirada de equipamento foi aberta no RBX</strong>. O aparelho (ONT/Roteador em comodato) permanece com o cliente sem qualquer chamado de busca agendado para o time de campo.
                                </p>
                                <div className="flex flex-wrap items-center gap-2.5 pt-2 text-[11px] text-amber-950 font-medium">
                                  <span className="bg-white px-2.5 py-1 rounded border border-amber-200 shadow-2xs">
                                    Código Cliente RBX: <strong className="font-mono">{order.codigoCliente}</strong>
                                  </span>
                                  <span className="bg-white px-2.5 py-1 rounded border border-amber-200 shadow-2xs">
                                    Contrato: <strong className="font-mono">{order.contrato || 'N/I'}</strong>
                                  </span>
                                  <span className="bg-white px-2.5 py-1 rounded border border-amber-200 shadow-2xs">
                                    Data de Bloqueio/Cancelamento: <strong>{formatDate(order.dataAbertura)}</strong>
                                  </span>
                                  <span className="bg-white px-2.5 py-1 rounded border border-amber-200 shadow-2xs text-amber-800">
                                    Ação recomendada: <strong>Abrir chamado de Retirada de Equipamento no RBX</strong>
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {order.ehDuplicado && (
                                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span>
                                      <strong>Cadastro Duplo Identificado no RBX:</strong> Este cliente possui variações de formatação de código no sistema (com e sem pontuação). Por padrão, o sistema mantém as duplicatas <strong>ocultas</strong> para não duplicar OSs nem distorcer as taxas operacionais.
                                    </span>
                                  </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                  {/* Left Column: Solution & Cause */}
                                  <div className="space-y-2 bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                                    <div className="flex items-center gap-1.5 text-slate-800 font-bold border-b border-slate-100 pb-1.5">
                                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                                      <span>Parecer do Técnico na Baixa (Solução)</span>
                                    </div>
                                    <div className="text-slate-700 whitespace-pre-line bg-slate-50 p-2.5 rounded border border-slate-200/60 font-mono text-[11px] leading-relaxed">
                                      {order.solucao || 'Nenhum texto de solução cadastrado no chamado.'}
                                    </div>
                                    <div className="text-[11px] text-slate-500 pt-1 flex items-center justify-between">
                                      <span>Causa registrada: <strong>{order.causa || 'Não informada'}</strong></span>
                                      <span>Tópico: <strong>{order.topico}</strong></span>
                                    </div>
                                  </div>

                                  {/* Right Column: Assunto / Comodato Equipments */}
                                  <div className="space-y-2 bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                                    <div className="flex items-center gap-1.5 text-slate-800 font-bold border-b border-slate-100 pb-1.5">
                                      <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
                                      <span>Histórico & Equipamentos em Comodato (Assunto)</span>
                                    </div>
                                    <div className="text-slate-700 whitespace-pre-line bg-slate-50 p-2.5 rounded border border-slate-200/60 text-[11px] leading-relaxed max-h-48 overflow-y-auto font-mono">
                                      {order.assunto || 'Sem detalhes no assunto.'}
                                    </div>
                                    <div className="text-[11px] text-slate-500 pt-1 flex items-center justify-between">
                                      <span>Abertura por: <strong>{order.usuarioAbertura || 'Sistema'}</strong></span>
                                      <span>Protocolo: <strong className="font-mono">{order.protocolo}</strong></span>
                                    </div>
                                  </div>
                                </div>

                                {/* Flows Timeline (if ticket has multiple flows in RBX) */}
                                {(() => {
                                  const flows = parseFlows(order.assunto);
                                  if (flows.length === 0) return null;
                                  return (
                                    <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                                      <div className="flex items-center gap-1.5 text-slate-800 font-bold border-b border-slate-100 pb-1.5 mb-2.5">
                                        <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
                                        <span>Histórico de Fluxos e Tramitações no RBX ({flows.length} etapas registradas)</span>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                        {flows.map((flow, idx) => (
                                          <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 text-xs space-y-1">
                                            <div className="flex items-center justify-between font-semibold text-slate-900 pb-1 border-b border-slate-200/60">
                                              <span className="flex items-center gap-1.5">
                                                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center text-[10px] font-bold">
                                                  {idx + 1}
                                                </span>
                                                {flow.topico}
                                              </span>
                                              <span className="text-[10px] text-slate-500 font-normal">
                                                {flow.abertura} {flow.encerramento ? `➔ ${flow.encerramento}` : ''}
                                              </span>
                                            </div>
                                            {flow.causa && (
                                              <div className="text-[11px] text-slate-700">
                                                Desfecho: <strong>{flow.causa}</strong> {flow.usuario ? `• Operador: ${flow.usuario}` : ''}
                                              </div>
                                            )}
                                            {flow.detalhes && (
                                              <div className="text-[10px] text-slate-600 font-mono bg-white p-1.5 rounded border border-slate-200/60 leading-relaxed">
                                                {flow.detalhes}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
