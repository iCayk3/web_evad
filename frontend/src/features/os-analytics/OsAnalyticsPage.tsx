import React, { useState, useEffect, useMemo } from 'react';
import {
  Wrench,
  RotateCw,
  TrendingUp,
  CheckCircle2,
  Ban,
  Clock,
  AlertCircle,
  ShieldCheck,
  History,
  Users,
  Search,
  ChevronDown,
  X,
  Check,
  Award,
  Filter,
  BarChart2,
  FileText,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  AlertTriangle,
  ExternalLink,
  MapPin,
  Laptop,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import {
  OsAnalyticsOverviewDto,
  OsPeriodType,
  OsTicketDto,
  OsTechnicianWorkload,
  OsAbortedTicketDetail,
} from './types.ts';
import { OsDetailModal } from './components/OsDetailModal.tsx';

export const OsAnalyticsPage: React.FC = () => {
  // Aba Ativa (Layout Enxuto: Visão Geral vs OS Abortadas)
  const [activeTab, setActiveTab] = useState<'visao_geral' | 'abortadas'>('visao_geral');

  // Estados de Filtros Rápidos
  const [period, setPeriod] = useState<OsPeriodType>('7d');
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Seleção de Técnicos (Multi-select)
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([]);
  const [techDropdownOpen, setTechDropdownOpen] = useState(false);
  const [techSearch, setTechSearch] = useState('');

  // Dados Principais
  const [overview, setOverview] = useState<OsAnalyticsOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados da Listagem Analítica de OS
  const [ticketList, setTicketList] = useState<OsTicketDto[]>([]);
  const [totalTickets, setTotalTickets] = useState(0);
  const [listPage, setListPage] = useState(1);
  const [listLoading, setListLoading] = useState(false);
  const [listSearch, setListSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [flowTypeFilter, setFlowTypeFilter] = useState<string>('all');
  const [localityFilter, setLocalityFilter] = useState<string>('all');

  // Filtro de Busca na Tabela de Abortadas
  const [abortedSearch, setAbortedSearch] = useState('');
  const [abortedMotiveFilter, setAbortedMotiveFilter] = useState<string>('all');

  // Modal de Detalhe / Ocorrências
  const [selectedTicket, setSelectedTicket] = useState<OsTicketDto | null>(null);

  // Estado de Hover na Evolução Temporal
  const [hoveredPoint, setHoveredPoint] = useState<{
    label: string;
    abertas: number;
    concluidas: number;
    canceladas: number;
  } | null>(null);

  // Carrega Overview e KPIs
  const loadOverview = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      let url = `/api/os-analytics/overview?period=${period}`;
      if (period === 'custom' && customStart && customEnd) {
        url += `&startDate=${customStart}&endDate=${customEnd}`;
      }
      if (selectedTechnicians.length > 0) {
        url += `&technicians=${encodeURIComponent(selectedTechnicians.join(','))}`;
      }
      if (flowTypeFilter && flowTypeFilter !== 'all') {
        url += `&flowType=${encodeURIComponent(flowTypeFilter)}`;
      }
      if (localityFilter && localityFilter !== 'all') {
        url += `&locality=${encodeURIComponent(localityFilter)}`;
      }

      const data = await apiFetch<OsAnalyticsOverviewDto>(url);
      setOverview(data);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar indicadores de OS');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Carrega Listagem de OS para a Tabela
  const loadTicketList = async () => {
    setListLoading(true);
    try {
      let url = `/api/os-analytics/list?period=${period}&page=${listPage}&limit=15`;
      if (period === 'custom' && customStart && customEnd) {
        url += `&startDate=${customStart}&endDate=${customEnd}`;
      }
      if (selectedTechnicians.length > 0) {
        url += `&technicians=${encodeURIComponent(selectedTechnicians.join(','))}`;
      }
      if (statusFilter && statusFilter !== 'all') {
        url += `&status=${encodeURIComponent(statusFilter)}`;
      }
      if (flowTypeFilter && flowTypeFilter !== 'all') {
        url += `&flowType=${encodeURIComponent(flowTypeFilter)}`;
      }
      if (localityFilter && localityFilter !== 'all') {
        url += `&locality=${encodeURIComponent(localityFilter)}`;
      }
      if (listSearch.trim() !== '') {
        url += `&search=${encodeURIComponent(listSearch.trim())}`;
      }

      const res = await apiFetch<{ tickets: OsTicketDto[]; total: number }>(url);
      setTicketList(res.tickets || []);
      setTotalTickets(res.total || 0);
    } catch (err) {
      console.error('Erro ao carregar lista de OS:', err);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [period, customStart, customEnd, selectedTechnicians, flowTypeFilter, localityFilter]);

  useEffect(() => {
    loadTicketList();
  }, [period, customStart, customEnd, selectedTechnicians, statusFilter, flowTypeFilter, localityFilter, listPage, listSearch]);

  // Técnicos Filtrados no Dropdown
  const filteredTechnicians = useMemo(() => {
    if (!overview?.availableTechnicians) return [];
    if (!techSearch.trim()) return overview.availableTechnicians;
    const term = techSearch.toLowerCase().trim();
    return overview.availableTechnicians.filter((t) => t.name.toLowerCase().includes(term));
  }, [overview?.availableTechnicians, techSearch]);

  const toggleTechnician = (techName: string) => {
    setSelectedTechnicians((prev) =>
      prev.includes(techName) ? prev.filter((n) => n !== techName) : [...prev, techName]
    );
    setListPage(1);
  };

  const selectAllTechnicians = () => {
    setSelectedTechnicians([]);
    setListPage(1);
  };

  // Top 3 Técnicos
  const top3Technicians = useMemo(() => {
    if (!overview?.techniciansRanking) return [];
    return overview.techniciansRanking.slice(0, 3);
  }, [overview?.techniciansRanking]);

  // Max value para o gráfico de evolução
  const maxEvolutionValue = useMemo(() => {
    if (!overview?.evolution || overview.evolution.length === 0) return 5;
    return Math.max(
      ...overview.evolution.map((p) => Math.max(p.abertas, p.concluidas, p.canceladas)),
      5
    );
  }, [overview?.evolution]);

  // Lista de OS Abortadas filtradas internamente
  const filteredAbortedRecords = useMemo(() => {
    if (!overview?.abortedAnalysis?.records) return [];
    let list = overview.abortedAnalysis.records;

    if (abortedMotiveFilter !== 'all') {
      list = list.filter((r) => r.classifiedMotive === abortedMotiveFilter);
    }

    if (abortedSearch.trim() !== '') {
      const term = abortedSearch.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.protocol.toLowerCase().includes(term) ||
          r.clientName.toLowerCase().includes(term) ||
          r.technicianName.toLowerCase().includes(term) ||
          r.justificationText.toLowerCase().includes(term)
      );
    }

    return list;
  }, [overview?.abortedAnalysis?.records, abortedMotiveFilter, abortedSearch]);

  // Abre modal a partir de um registro abortado
  const handleOpenFromAborted = (rec: OsAbortedTicketDetail) => {
    const fullTicket: OsTicketDto = {
      id: rec.id,
      protocol: rec.protocol,
      clientId: rec.clientId,
      clientName: rec.clientName,
      technicianId: 0,
      technicianName: rec.technicianName,
      topicId: 0,
      topicName: rec.topicName,
      causeId: 0,
      causeName: rec.causeName,
      flowId: 0,
      flowName: 'Atendimento Técnico de Campo',
      status: 'Cancelado',
      type: 'Técnico',
      createdAt: rec.createdAt,
      slaDueAt: rec.cancelledAt,
      concludedAt: rec.cancelledAt,
      slaStatus: 'NOT_APPLICABLE',
      isOverdue: false,
      concludedWithinSla: null,
      description: rec.justificationText,
      solution: rec.solution || rec.justificationText,
      ocorrencias: rec.occurrences,
    };
    setSelectedTicket(fullTicket);
  };

  return (
    <div className="p-5 md:p-7 space-y-6 max-w-[1600px] mx-auto text-slate-800">
      {/* 1. Barra Superior Enxuta de Cabeçalho e Filtros Rápidos */}
      <div className="bg-white border border-slate-100/90 rounded-2xl p-4 md:p-5 shadow-premium-card flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-brand-primary flex items-center justify-center shrink-0 border border-blue-100">
            <Wrench className="w-5 h-5" strokeWidth={2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
                Análise de OS
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-brand-primary border border-blue-200/70">
                Tempo Real
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Produtividade, status operacional e evolução das Ordens de Serviço
            </p>
          </div>
        </div>

        {/* Controles de Filtro Enxutos */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de Período em Pílula */}
          <div className="inline-flex bg-slate-100/90 p-1 rounded-full border border-slate-200/60 text-xs font-medium shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setPeriod('today');
                setListPage(1);
              }}
              className={`px-3 py-1 rounded-full transition-all duration-150 ${
                period === 'today'
                  ? 'bg-white text-brand-primary shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => {
                setPeriod('7d');
                setListPage(1);
              }}
              className={`px-3 py-1 rounded-full transition-all duration-150 ${
                period === '7d'
                  ? 'bg-white text-brand-primary shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7D
            </button>
            <button
              type="button"
              onClick={() => {
                setPeriod('month');
                setListPage(1);
              }}
              className={`px-3 py-1 rounded-full transition-all duration-150 ${
                period === 'month'
                  ? 'bg-white text-brand-primary shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mês
            </button>
            <button
              type="button"
              onClick={() => {
                setPeriod('custom');
                setListPage(1);
              }}
              className={`px-3 py-1 rounded-full transition-all duration-150 ${
                period === 'custom'
                  ? 'bg-white text-brand-primary shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Custom
            </button>
          </div>

          {/* Inputs de Data para Período Personalizado */}
          {period === 'custom' && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1 text-xs shadow-2xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => {
                  setCustomStart(e.target.value);
                  setListPage(1);
                }}
                className="bg-transparent text-slate-700 text-xs focus:outline-hidden"
              />
              <span className="text-slate-400">até</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => {
                  setCustomEnd(e.target.value);
                  setListPage(1);
                }}
                className="bg-transparent text-slate-700 text-xs focus:outline-hidden"
              />
            </div>
          )}

          {/* Dropdown Multi-Seleção de Técnicos */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setTechDropdownOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/90 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
            >
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {selectedTechnicians.length === 0
                  ? 'Técnicos (Todos)'
                  : `Técnicos (${selectedTechnicians.length})`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {techDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 z-30 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800">Filtrar Técnicos</span>
                  {selectedTechnicians.length > 0 && (
                    <button
                      type="button"
                      onClick={selectAllTechnicians}
                      className="text-[11px] text-brand-primary hover:underline font-semibold"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar técnico..."
                    value={techSearch}
                    onChange={(e) => setTechSearch(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-primary"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 pt-1">
                  <button
                    type="button"
                    onClick={selectAllTechnicians}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-50 text-left transition-colors font-medium text-slate-800"
                  >
                    <span>Todos os técnicos</span>
                    {selectedTechnicians.length === 0 && (
                      <Check className="w-3.5 h-3.5 text-brand-primary" />
                    )}
                  </button>

                  {filteredTechnicians.map((t) => {
                    const isSelected = selectedTechnicians.includes(t.name);
                    return (
                      <button
                        key={t.id || t.name}
                        type="button"
                        onClick={() => toggleTechnician(t.name)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-50 text-left transition-colors"
                      >
                        <span className="truncate pr-2 text-slate-700">{t.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-slate-400">({t.count})</span>
                          <div
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                              isSelected
                                ? 'bg-brand-primary border-brand-primary text-white'
                                : 'border-slate-300'
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Botão de Atualização Enxuto */}
          <button
            type="button"
            onClick={() => loadOverview(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/90 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs disabled:opacity-60"
            title="Atualizar dados"
          >
            <RotateCw className={`w-3.5 h-3.5 text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* 2. Abas Enxutas de Navegação Interna: Visão Geral vs Análise de Abortadas */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200/60 text-xs font-semibold shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('visao_geral')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'visao_geral'
                ? 'bg-white text-brand-primary shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Visão Geral
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('abortadas')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'abortadas'
                ? 'bg-white text-rose-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Ban className="w-3.5 h-3.5 text-rose-500" />
            <span>OS Abortadas & Ocorrências</span>
            {overview?.abortedAnalysis?.totalAborted !== undefined && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-800 font-mono font-bold">
                {overview.abortedAnalysis.totalAborted}
              </span>
            )}
          </button>
        </div>

        <div className="text-[11px] text-slate-400 font-mono hidden sm:block">
          Última sincronização: {overview?.updatedAt ? overview.updatedAt.slice(11, 19) : '-'}
        </div>
      </div>

      {/* ============================================================== */}
      {/* ABA 1: VISÃO GERAL (Dashboard Operacional & Produtividade)      */}
      {/* ============================================================== */}
      {activeTab === 'visao_geral' && (
        <>
          {/* Grid de Cards de KPI Executivos */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
            {/* Card 1: Total de OS */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100/90 shadow-premium-card relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Total de OS</span>
                <Layers className="w-4 h-4 text-blue-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 tracking-tight font-mono">
                {overview?.cards.totalOs.value ?? '-'}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px]">
                {overview?.cards.totalOs.changePercent !== null &&
                overview?.cards.totalOs.changePercent !== undefined ? (
                  <span
                    className={`inline-flex items-center font-semibold ${
                      overview.cards.totalOs.changePercent >= 0 ? 'text-emerald-600' : 'text-slate-500'
                    }`}
                  >
                    {overview.cards.totalOs.changePercent >= 0 ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {overview.cards.totalOs.changePercent}% vs ant.
                  </span>
                ) : (
                  <span className="text-slate-400">Período ativo</span>
                )}
              </div>
            </div>

            {/* Card 2: Concluídas */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100/90 shadow-premium-card relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Concluídas</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-700 tracking-tight font-mono">
                {overview?.cards.concludedOs.value ?? '-'}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                <span className="px-1.5 py-0.2 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {overview?.cards.concludedOs.rate ?? 0}% taxa
                </span>
              </div>
            </div>

            {/* Card 3: Abortadas / Canceladas (Clicável para alternar aba) */}
            <div
              onClick={() => setActiveTab('abortadas')}
              className="bg-white rounded-2xl p-4 border border-slate-100/90 shadow-premium-card relative overflow-hidden cursor-pointer hover:border-rose-200 transition-colors group"
            >
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium group-hover:text-rose-600">
                <span>Abortadas</span>
                <Ban className="w-4 h-4 text-rose-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-rose-700 tracking-tight font-mono">
                {overview?.cards.cancelledOs.value ?? '-'}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                <span className="px-1.5 py-0.2 rounded font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  {overview?.cards.cancelledOs.rate ?? 0}% taxa
                </span>
                <span className="text-[10px] text-rose-600 font-semibold underline ml-auto">
                  Analisar
                </span>
              </div>
            </div>

            {/* Card 4: Fila / Pendentes */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100/90 shadow-premium-card relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Fila / Pendentes</span>
                <AlertCircle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-amber-700 tracking-tight font-mono">
                {overview?.cards.pendingOs.value ?? '-'}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                <span>{overview?.cards.openOs.value ?? 0} em andamento</span>
              </div>
            </div>

            {/* Card 5: TMA Médio */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100/90 shadow-premium-card relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>TMA Médio</span>
                <Clock className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 tracking-tight font-mono">
                {overview?.cards.avgResolutionTimeHours.formatted ?? '-'}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Tempo de conclusão</div>
            </div>

            {/* Card 6: Cumprimento SLA */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100/90 shadow-premium-card relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Cumprimento SLA</span>
                <ShieldCheck className="w-4 h-4 text-teal-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-teal-700 tracking-tight font-mono">
                {overview?.cards.slaComplianceRate.formatted ?? '-'}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                <span>{overview?.cards.totalMovements.value ?? 0} movimentações</span>
              </div>
            </div>
          </div>

          {/* Banner de Inteligência dos Fluxos: Resolução Remota vs Campo e Etapas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-linear-to-r from-blue-50/60 via-slate-50 to-emerald-50/60 p-3.5 rounded-2xl border border-slate-200/70 shadow-2xs">
            <div className="flex items-center gap-3 bg-white/85 p-3 rounded-xl border border-sky-100 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                <Laptop className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Soluções Remotas
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-lg font-bold text-slate-900 font-mono">
                    {overview?.cards.remoteResolutions?.value ?? 0}
                  </span>
                  <span className="text-xs font-semibold text-sky-700">
                    ({overview?.cards.remoteResolutions?.rate ?? 0}% das baixas)
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">Sem necessidade de deslocamento</div>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white/85 p-3 rounded-xl border border-emerald-100 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Wrench className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Atendimentos em Campo
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-lg font-bold text-slate-900 font-mono">
                    {overview?.cards.fieldWork?.value ?? 0}
                  </span>
                  <span className="text-xs font-semibold text-emerald-700">
                    ({overview?.cards.fieldWork?.rate ?? 0}% presencial)
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">Reparos técnicos e infraestrutura</div>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white/85 p-3 rounded-xl border border-indigo-100 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Média de Etapas / Ciclo
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-lg font-bold text-slate-900 font-mono">
                    {overview?.cards.totalFlows?.avgPerOs ?? 0}
                  </span>
                  <span className="text-xs font-semibold text-indigo-700">
                    etapas/OS
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {overview?.cards.totalFlows?.value ?? 0} fluxos finalizados no total
                </div>
              </div>
            </div>
          </div>

          {/* Bloco Gráfico 1: Evolução Diária & Distribuição por Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Gráfico de Evolução Diária */}
            <div className="lg:col-span-2 bg-white border border-slate-100/90 rounded-2xl p-5 shadow-premium-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-brand-primary flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Evolução Diária de OS</h2>
                    <p className="text-[11px] text-slate-400">
                      Volume de demandas, conclusões e cancelamentos
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[11px]">
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="text-slate-600 font-medium">Abertas</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-slate-600 font-medium">Concluídas</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-slate-600 font-medium">Canceladas</span>
                  </div>
                </div>
              </div>

              <div className="relative pt-2">
                {hoveredPoint && (
                  <div className="absolute top-0 right-2 z-20 bg-slate-900 text-white rounded-xl px-3 py-2 text-xs shadow-lg space-y-0.5 pointer-events-none animate-in fade-in duration-100">
                    <div className="font-bold border-b border-slate-700 pb-1 text-slate-300">
                      Data: {hoveredPoint.label}
                    </div>
                    <div className="flex items-center justify-between gap-3 text-blue-300">
                      <span>Abertas:</span>
                      <span className="font-mono font-bold">+{hoveredPoint.abertas}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-emerald-300">
                      <span>Concluídas:</span>
                      <span className="font-mono font-bold">{hoveredPoint.concluidas}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-rose-300">
                      <span>Canceladas:</span>
                      <span className="font-mono font-bold">{hoveredPoint.canceladas}</span>
                    </div>
                  </div>
                )}

                <div className="h-52 flex items-end gap-2 pt-6 pb-2 border-b border-slate-100">
                  {overview?.evolution.map((pt) => {
                    const hAbertas = Math.max((pt.abertas / maxEvolutionValue) * 100, 4);
                    const hConcluidas = Math.max((pt.concluidas / maxEvolutionValue) * 100, 4);
                    const hCanceladas = Math.max((pt.canceladas / maxEvolutionValue) * 100, 4);

                    return (
                      <div
                        key={pt.date}
                        onMouseEnter={() => setHoveredPoint(pt)}
                        onMouseLeave={() => setHoveredPoint(null)}
                        className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                      >
                        <div className="w-full flex items-end justify-center gap-1 h-full">
                          <div
                            style={{ height: `${hAbertas}%` }}
                            className="w-2.5 sm:w-3 bg-blue-500 rounded-t-md transition-all group-hover:brightness-110"
                          />
                          <div
                            style={{ height: `${hConcluidas}%` }}
                            className="w-2.5 sm:w-3 bg-emerald-500 rounded-t-md transition-all group-hover:brightness-110"
                          />
                          <div
                            style={{ height: `${hCanceladas}%` }}
                            className="w-2.5 sm:w-3 bg-rose-500 rounded-t-md transition-all group-hover:brightness-110"
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 mt-2 truncate w-full text-center group-hover:text-slate-900 group-hover:font-semibold">
                          {pt.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Distribuição por Status */}
            <div className="bg-white border border-slate-100/90 rounded-2xl p-5 shadow-premium-card flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <BarChart2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Distribuição por Status</h2>
                    <p className="text-[11px] text-slate-400">Composição percentual das OS</p>
                  </div>
                </div>

                <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-100 mb-5">
                  {overview?.statusDistribution.map((item) => (
                    <div
                      key={item.status}
                      style={{
                        width: `${Math.max(item.percentage, 1)}%`,
                        backgroundColor: item.color,
                      }}
                      title={`${item.status}: ${item.count} (${item.percentage}%)`}
                      className="h-full transition-all duration-300"
                    />
                  ))}
                </div>

                <div className="space-y-3">
                  {overview?.statusDistribution.map((item) => (
                    <div key={item.status} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-medium text-slate-700">{item.status}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900 font-mono">{item.count}</span>
                        <span className="text-slate-400 font-mono w-12 text-right">
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Vazão Operacional:</span>
                <span className="font-bold text-emerald-600">
                  {overview?.cards.concludedOs.rate ?? 0}% Conclusão
                </span>
              </div>
            </div>
          </div>

          {/* Bloco 2: Produtividade & Ranking por Técnico */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                  Produtividade por Técnico
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                {overview?.techniciansRanking.length || 0} técnico(s) ativo(s)
              </span>
            </div>

            {/* Cards dos Top 3 Técnicos */}
            {top3Technicians.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {top3Technicians.map((tech, idx) => {
                  const medalColors = [
                    'from-amber-400 to-amber-600 text-white',
                    'from-slate-300 to-slate-500 text-white',
                    'from-amber-700 to-amber-900 text-white',
                  ];
                  const medalLabels = ['1º Lugar', '2º Lugar', '3º Lugar'];

                  return (
                    <div
                      key={tech.name}
                      className="bg-white border border-slate-100/90 rounded-2xl p-4 shadow-premium-card flex items-center justify-between relative overflow-hidden"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl bg-gradient-to-br ${medalColors[idx]} flex items-center justify-center font-bold text-xs shadow-xs shrink-0`}
                        >
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 truncate max-w-[150px]">
                            {tech.name}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {medalLabels[idx]} • {tech.total} OS
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-bold text-emerald-600 font-mono">
                          {tech.concluded} Concluídas
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {tech.conclusionRate}% taxa • TMA {tech.avgTimeHours}h
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tabela Completa de Produtividade dos Técnicos */}
            <div className="bg-white border border-slate-100/90 rounded-2xl overflow-hidden shadow-premium-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-4">Técnico</th>
                      <th className="py-3 px-4 text-center">Total OS</th>
                      <th className="py-3 px-4 text-center">Concluídas</th>
                      <th className="py-3 px-4 text-center">Fila / Pendentes</th>
                      <th className="py-3 px-4 text-center">Abortadas</th>
                      <th className="py-3 px-4 text-center">TMA Médio</th>
                      <th className="py-3 px-4 text-center">SLA %</th>
                      <th className="py-3 px-4 text-right">Taxa Conclusão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {overview?.techniciansRanking.map((t) => (
                      <tr key={t.name} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">{t.name}</td>
                        <td className="py-3 px-4 text-center font-mono">{t.total}</td>
                        <td className="py-3 px-4 text-center font-mono text-emerald-600 font-bold">
                          {t.concluded}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-amber-600">{t.pending}</td>
                        <td className="py-3 px-4 text-center font-mono text-rose-600">{t.cancelled}</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-600">
                          {t.avgTimeHours > 0 ? `${t.avgTimeHours}h` : '-'}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-700">{t.slaRate}%</td>
                        <td className="py-3 px-4 text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {t.conclusionRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Bloco 3: Diagnóstico Operacional (Tópicos & Causas) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Tópicos */}
            <div className="bg-white border border-slate-100/90 rounded-2xl p-5 shadow-premium-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-brand-primary flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Demandas por Tópico</h2>
                  <p className="text-[11px] text-slate-400">Serviços com maior volume operacional</p>
                </div>
              </div>

              <div className="space-y-3">
                {overview?.topTopics.map((topic) => (
                  <div key={topic.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 truncate pr-2">{topic.name}</span>
                      <div className="flex items-center gap-2 font-mono shrink-0">
                        <span className="font-bold text-slate-900">{topic.count}</span>
                        <span className="text-[11px] text-slate-400">({topic.percentage}%)</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        style={{ width: `${Math.max(topic.percentage, 2)}%` }}
                        className="h-full bg-brand-primary rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Causas Raiz */}
            <div className="bg-white border border-slate-100/90 rounded-2xl p-5 shadow-premium-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Causas Raiz de Chamados</h2>
                  <p className="text-[11px] text-slate-400">Principais motivos apurados em campo</p>
                </div>
              </div>

              <div className="space-y-3">
                {overview?.topCauses.map((cause) => (
                  <div key={cause.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 truncate pr-2">{cause.name}</span>
                      <div className="flex items-center gap-2 font-mono shrink-0">
                        <span className="font-bold text-slate-900">{cause.count}</span>
                        <span className="text-[11px] text-slate-400">({cause.percentage}%)</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        style={{ width: `${Math.max(cause.percentage, 2)}%` }}
                        className="h-full bg-amber-500 rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bloco 4: Tabela Analítica de Ordens de Serviço */}
          <div className="bg-white border border-slate-100/90 rounded-2xl p-5 shadow-premium-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-primary" />
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                  Listagem Analítica de Ordens de Serviço
                </h2>
                <span className="text-xs text-slate-400 font-mono">({totalTickets} registros)</span>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar OS ou cliente..."
                    value={listSearch}
                    onChange={(e) => {
                      setListSearch(e.target.value);
                      setListPage(1);
                    }}
                    className="pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-brand-primary w-48 sm:w-60"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setListPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden"
                >
                  <option value="all">Todos os Status</option>
                  <option value="Concluído">Concluído</option>
                  <option value="Em Andamento">Em Andamento</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Cancelado">Abortada</option>
                </select>

                <select
                  value={flowTypeFilter}
                  onChange={(e) => {
                    setFlowTypeFilter(e.target.value);
                    setListPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden"
                >
                  <option value="all">Todos os Fluxos</option>
                  <option value="Solução Remota">Solução Remota</option>
                  <option value="Presencial / Campo">Presencial / Campo</option>
                  <option value="Triagem / Roteamento">Triagem / Roteamento</option>
                  <option value="Comercial / Apoio">Comercial / Apoio</option>
                  <option value="Supervisão / Feedback">Supervisão / Feedback</option>
                </select>

                <select
                  value={localityFilter}
                  onChange={(e) => {
                    setLocalityFilter(e.target.value);
                    setListPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden max-w-[150px] truncate"
                >
                  <option value="all">Todas as Regiões</option>
                  {overview?.availableLocalities && overview.availableLocalities.length > 0 ? (
                    overview.availableLocalities.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="São José dos Pinhais (SJP)">São José dos Pinhais (SJP)</option>
                      <option value="Magalhães Barata (MGB)">Magalhães Barata (MGB)</option>
                      <option value="Quatipuru (QT)">Quatipuru (QT)</option>
                      <option value="Boa Vista (BV)">Boa Vista (BV)</option>
                      <option value="Primavera (PMV)">Primavera (PMV)</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-3">Protocolo</th>
                    <th className="py-2.5 px-3">Cliente</th>
                    <th className="py-2.5 px-3">Técnico</th>
                    <th className="py-2.5 px-3">Tópico</th>
                    <th className="py-2.5 px-3">Fluxo & Região</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Abertura</th>
                    <th className="py-2.5 px-3">SLA</th>
                    <th className="py-2.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {listLoading ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-brand-primary" />
                        Carregando Ordens de Serviço...
                      </td>
                    </tr>
                  ) : ticketList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        Nenhuma Ordem de Serviço encontrada com os filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    ticketList.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {ticket.protocol}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800 truncate max-w-[200px]">
                          {ticket.clientName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 truncate max-w-[150px]">
                          {ticket.technicianName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 truncate max-w-[180px]">
                          {ticket.topicName}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col gap-1 items-start">
                            {ticket.hasRemoteSolution ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                                <Laptop className="w-2.5 h-2.5" />
                                Solução Remota
                              </span>
                            ) : ticket.hasFieldWork ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Wrench className="w-2.5 h-2.5" />
                                Campo
                              </span>
                            ) : ticket.flowCategory && ticket.flowCategory !== 'Outro' ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                                {ticket.flowCategory}
                              </span>
                            ) : null}
                            {ticket.primaryLocality && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 font-medium truncate max-w-[130px]">
                                <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                {ticket.primaryLocality}
                              </span>
                            )}
                            {ticket.flowCount && ticket.flowCount > 1 ? (
                              <span className="text-[9px] font-mono font-semibold text-blue-600 bg-blue-50 px-1 py-0.2 rounded border border-blue-100">
                                {ticket.flowCount} etapas
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              ticket.status === 'Concluído'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : ticket.status === 'Em Andamento' || ticket.status === 'Aberto'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : ticket.status === 'Pendente'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {ticket.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {ticket.createdAt ? ticket.createdAt.slice(0, 16) : '-'}
                        </td>
                        <td className="py-2.5 px-3">
                          {ticket.isOverdue ? (
                            <span className="text-[11px] font-bold text-rose-600">Vencido</span>
                          ) : (
                            <span className="text-[11px] text-emerald-600">No Prazo</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedTicket(ticket)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-brand-primary border border-slate-200 transition-colors shadow-2xs"
                          >
                            Ver OS
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalTickets > 15 && (
              <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                <span>
                  Mostrando {Math.min((listPage - 1) * 15 + 1, totalTickets)} a{' '}
                  {Math.min(listPage * 15, totalTickets)} de {totalTickets} OS
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setListPage((p) => Math.max(1, p - 1))}
                    disabled={listPage === 1}
                    className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 disabled:opacity-50 hover:bg-slate-100 transition-colors"
                  >
                    Anterior
                  </button>
                  <span className="px-2 font-mono font-bold text-slate-800">{listPage}</span>
                  <button
                    type="button"
                    onClick={() => setListPage((p) => p + 1)}
                    disabled={listPage * 15 >= totalTickets}
                    className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 disabled:opacity-50 hover:bg-slate-100 transition-colors"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ============================================================== */}
      {/* ABA 2: ANÁLISE DE OS ABORTADAS & OCORRÊNCIAS                   */}
      {/* ============================================================== */}
      {activeTab === 'abortadas' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Cards de Síntese de Abortamento */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-2xl p-4 border border-slate-100/90 shadow-premium-card">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Total de OS Abortadas</span>
                <Ban className="w-4 h-4 text-rose-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-rose-700 tracking-tight font-mono">
                {overview?.abortedAnalysis.totalAborted ?? 0}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                Cancelamentos no período
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-100/90 shadow-premium-card">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Taxa de Abortamento</span>
                <TrendingUp className="w-4 h-4 text-rose-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 tracking-tight font-mono">
                {overview?.abortedAnalysis.abortedRate ?? 0}%
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                Sobre o total de demandas
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-100/90 shadow-premium-card">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Tempo Médio até Cancelar</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 tracking-tight font-mono">
                {overview?.abortedAnalysis.avgTimeUntilAbortHours ?? 0}h
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                Horas entre abertura e baixa
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-100/90 shadow-premium-card">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Motivo Predominante</span>
                <AlertCircle className="w-4 h-4 text-brand-primary" />
              </div>
              <div className="mt-2 text-sm font-bold text-slate-900 tracking-tight truncate">
                {overview?.abortedAnalysis.motivesSummary[0]?.motive ?? 'N/D'}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {overview?.abortedAnalysis.motivesSummary[0]?.count ?? 0} ocorrência(s)
              </div>
            </div>
          </div>

          {/* Gráficos de Motivos & Técnicos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Motivos Classificados a partir das Ocorrências da API */}
            <div className="bg-white border border-slate-100/90 rounded-2xl p-5 shadow-premium-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Motivos de Abortamento</h2>
                  <p className="text-[11px] text-slate-400">
                    Classificação analítica a partir das ocorrências da API RBXSoft
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {overview?.abortedAnalysis.motivesSummary.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Nenhuma OS abortada no período selecionado.
                  </div>
                ) : (
                  overview?.abortedAnalysis.motivesSummary.map((item) => (
                    <div key={item.motive} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">{item.motive}</span>
                        <div className="flex items-center gap-2 font-mono shrink-0">
                          <span className="font-bold text-slate-900">{item.count}</span>
                          <span className="text-[11px] text-slate-400">({item.percentage}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          style={{ width: `${Math.max(item.percentage, 2)}%` }}
                          className="h-full bg-rose-500 rounded-full"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Ranking de Técnicos com Mais OS Abortadas */}
            <div className="bg-white border border-slate-100/90 rounded-2xl p-5 shadow-premium-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Abortamentos por Técnico</h2>
                  <p className="text-[11px] text-slate-400">
                    Técnicos com maior incidência de cancelamentos no período
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {overview?.abortedAnalysis.technicianAbortedRanking.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Nenhum cancelamento associado a técnicos no período.
                  </div>
                ) : (
                  overview?.abortedAnalysis.technicianAbortedRanking.map((item) => (
                    <div key={item.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">{item.name}</span>
                        <div className="flex items-center gap-2 font-mono shrink-0">
                          <span className="font-bold text-rose-700">{item.count} OS</span>
                          <span className="text-[11px] text-slate-400">({item.percentage}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          style={{ width: `${Math.max(item.percentage, 2)}%` }}
                          className="h-full bg-amber-500 rounded-full"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Tabela Detalhada de OS Abortadas & Ocorrências */}
          <div className="bg-white border border-slate-100/90 rounded-2xl p-5 shadow-premium-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Ban className="w-4 h-4 text-rose-600" />
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                  Ordens de Serviço Abortadas & Justificativas
                </h2>
                <span className="text-xs text-slate-400 font-mono">
                  ({filteredAbortedRecords.length} registros)
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar protocolo, cliente ou texto..."
                    value={abortedSearch}
                    onChange={(e) => setAbortedSearch(e.target.value)}
                    className="pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-brand-primary w-48 sm:w-64"
                  />
                </div>

                <select
                  value={abortedMotiveFilter}
                  onChange={(e) => setAbortedMotiveFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden"
                >
                  <option value="all">Todos os Motivos</option>
                  {overview?.abortedAnalysis.motivesSummary.map((m) => (
                    <option key={m.motive} value={m.motive}>
                      {m.motive} ({m.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-3">Protocolo</th>
                    <th className="py-2.5 px-3">Cliente</th>
                    <th className="py-2.5 px-3">Técnico</th>
                    <th className="py-2.5 px-3">Motivo Classificado</th>
                    <th className="py-2.5 px-3">Justificativa da Ocorrência</th>
                    <th className="py-2.5 px-3 text-center">Tempo até Cancelar</th>
                    <th className="py-2.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredAbortedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Nenhuma Ordem de Serviço abortada encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredAbortedRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {rec.protocol}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 truncate max-w-[180px]">
                          {rec.clientName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 truncate max-w-[140px]">
                          {rec.technicianName}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            {rec.classifiedMotive}
                          </span>
                        </td>
                        <td
                          className="py-2.5 px-3 text-slate-700 truncate max-w-[280px]"
                          title={rec.justificationText.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim()}
                        >
                          {rec.justificationText.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim()}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                          {rec.durationHours > 0 ? `${rec.durationHours}h` : '< 1h'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenFromAborted(rec)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-brand-primary border border-slate-200 transition-colors shadow-2xs"
                          >
                            Ocorrências
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhe e Ocorrências da OS */}
      {selectedTicket && (
        <OsDetailModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
      )}
    </div>
  );
};
