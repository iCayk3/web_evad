import React, { useState, useEffect } from 'react';
import {
  Search,
  Loader2,
  Calendar,
  Phone,
  User,
  Clock,
  FileText,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  Users,
  Bot,
  Filter,
  X,
  RefreshCw,
  Sparkles,
  Tag,
  BarChart3,
  Flame,
  Zap,
} from 'lucide-react';
import { omnichannelApi } from '../api/omnichannel.api.ts';
import { ContactFact, OmnichannelOverviewMetrics } from '../types/omnichannel.types.ts';

interface DetailsTabProps {
  selectedBatchId?: string;
  initialClassification?: string;
  onClearInitialClassification?: () => void;
}

type SortField =
  | 'started_at'
  | 'conversation_id'
  | 'name_normalized'
  | 'department'
  | 'agent_display'
  | 'closure_type'
  | 'classification'
  | 'handle_time_seconds'
  | 'wait_time_seconds'
  | 'match_status';

export const DetailsTab: React.FC<DetailsTabProps> = ({
  selectedBatchId,
  initialClassification,
  onClearInitialClassification,
}) => {
  const [contacts, setContacts] = useState<ContactFact[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filter options metadata
  const [filterMeta, setFilterMeta] = useState<OmnichannelOverviewMetrics | null>(null);

  // Pagination and Filters
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedClosure, setSelectedClosure] = useState('');
  const [selectedClassification, setSelectedClassification] = useState(initialClassification || '');

  // Sorting
  const [sortBy, setSortBy] = useState<SortField>('started_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Sync initialClassification
  useEffect(() => {
    if (initialClassification !== undefined) {
      setSelectedClassification(initialClassification);
      setPage(1);
    }
  }, [initialClassification]);

  // Load filter metadata (departments, agents, closures, classifications)
  useEffect(() => {
    omnichannelApi
      .getOverview({ batchId: selectedBatchId })
      .then((res) => {
        if (res.success) {
          setFilterMeta(res.metrics);
        }
      })
      .catch((err) => console.error('[DetailsTab] Error loading filter meta:', err));
  }, [selectedBatchId]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 450);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [selectedAgent, selectedDept, selectedClosure, selectedClassification, limit, sortBy, sortDir]);

  useEffect(() => {
    loadContacts();
  }, [selectedBatchId, page, limit, debouncedSearch, selectedAgent, selectedDept, selectedClosure, selectedClassification, sortBy, sortDir]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      const res = await omnichannelApi.getContacts({
        batchId: selectedBatchId,
        agent: selectedAgent || undefined,
        department: selectedDept || undefined,
        closureType: selectedClosure || undefined,
        classification: selectedClassification || undefined,
        limit,
        offset,
        search: debouncedSearch || undefined,
        sortBy,
        sortDir,
      });

      if (res.success) {
        setContacts(res?.contacts || []);
        setTotalCount(res?.totalCount || 0);
      }
    } catch (err) {
      console.error('[DetailsTab] Failed to load contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir(field === 'started_at' ? 'desc' : 'asc');
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setSelectedAgent('');
    setSelectedDept('');
    setSelectedClosure('');
    setSelectedClassification('');
    onClearInitialClassification?.();
    setSortBy('started_at');
    setSortDir('desc');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    debouncedSearch || selectedAgent || selectedDept || selectedClosure || selectedClassification || sortBy !== 'started_at'
  );

  const formatSeconds = (sec?: number | null) => {
    if (!sec || sec <= 0) return '00:00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const getMatchStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Confirmado
          </span>
        );
      case 'name_suggested':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
            <FileText className="w-3 h-3 text-blue-600" />
            Sugerido
          </span>
        );
      case 'ambiguous':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Ambíguo
          </span>
        );
      case 'unmatched':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
            <HelpCircle className="w-3 h-3 text-slate-400" />
            Não Encontrado
          </span>
        );
    }
  };

  const getClosureBadge = (type?: string | null) => {
    if (!type) {
      return <span className="text-[11px] text-slate-400 italic">Não informado</span>;
    }
    const lower = type.toLowerCase();
    const isMass = lower.includes('massa');
    const isResolved = lower.includes('resolv') || lower.includes('atendido');
    const isTimeout = lower.includes('inatividade') || lower.includes('timeout');

    if (isMass) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 truncate block max-w-[150px]" title={type}>
          {type}
        </span>
      );
    }
    if (isResolved) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 truncate block max-w-[150px]" title={type}>
          {type}
        </span>
      );
    }
    if (isTimeout) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200 truncate block max-w-[150px]" title={type}>
          {type}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 truncate block max-w-[150px]" title={type}>
        {type}
      </span>
    );
  };

  const totalPages = Math.ceil(totalCount / limit);

  const renderSortIndicator = (field: SortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
    );
  };

  // Derived Insights for DetailsTab
  const topClassification =
    filterMeta?.classifications && filterMeta.classifications.length > 0
      ? [...filterMeta.classifications].sort((a, b) => b.count - a.count)[0]
      : null;

  const topTmaClassification =
    filterMeta?.classifications && filterMeta.classifications.length > 0
      ? [...filterMeta.classifications].sort((a, b) => b.avgTmaSeconds - a.avgTmaSeconds)[0]
      : null;

  const totalContactsVolume = filterMeta?.volume?.totalContacts || totalCount || 1;
  const totalClassifiedSum = (filterMeta?.classifications || []).reduce((acc, c) => acc + c.count, 0);
  const classificationCoverageRate = Math.min(
    100,
    Math.round((totalClassifiedSum / totalContactsVolume) * 100)
  );
  const overallAvgTma = filterMeta?.efficiency?.overallAvgTmaSeconds || 0;

  return (
    <div className="space-y-5 animate-fadeIn pb-12">
      {/* Cards de Insights Analíticos no Topo do Detalhamento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Motivo Mais Frequente */}
        <div
          onClick={() => {
            if (topClassification) {
              setSelectedClassification(topClassification.name);
            }
          }}
          className={`p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5 transition ${
            topClassification ? 'hover:border-amber-300 hover:bg-amber-50/20 cursor-pointer' : ''
          }`}
          title={topClassification ? `Filtrar por ${topClassification.name}` : undefined}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
              Motivo Mais Frequente
            </span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800">
              #1 Volume
            </span>
          </div>
          <div className="text-lg font-extrabold text-slate-900 truncate" title={topClassification?.name || '—'}>
            {topClassification?.name || 'Não classificado'}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>
              {topClassification ? `${topClassification.count} contatos` : 'Sem dados'}
            </span>
            {topClassification && (
              <span className="font-bold text-amber-600">
                {topClassification.percentage ?? Math.round((topClassification.count / totalContactsVolume) * 100)}% do total
              </span>
            )}
          </div>
        </div>

        {/* 2. Maior Duração Média (Gargalo TMA) */}
        <div
          onClick={() => {
            if (topTmaClassification) {
              setSelectedClassification(topTmaClassification.name);
            }
          }}
          className={`p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5 transition ${
            topTmaClassification ? 'hover:border-rose-300 hover:bg-rose-50/20 cursor-pointer' : ''
          }`}
          title={topTmaClassification ? `Filtrar por ${topTmaClassification.name}` : undefined}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-rose-500" />
              Maior Duração (Gargalo)
            </span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-800">
              TMA Crítico
            </span>
          </div>
          <div className="text-lg font-extrabold text-rose-700 font-mono">
            {topTmaClassification ? formatSeconds(topTmaClassification.avgTmaSeconds) : '—'}
          </div>
          <div className="text-[11px] text-slate-500 truncate" title={topTmaClassification?.name || '—'}>
            {topTmaClassification ? topTmaClassification.name : 'Nenhum gargalo'}
          </div>
        </div>

        {/* 3. Taxa de Contatos Classificados */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-blue-600" />
              Taxa de Classificados
            </span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-100 text-blue-800">
              {filterMeta?.classifications?.length || 0} tags
            </span>
          </div>
          <div className="text-lg font-extrabold text-blue-600">
            {classificationCoverageRate}%
          </div>
          <div className="text-[11px] text-slate-500">
            {totalClassifiedSum} ocorrências de motivos mapeadas
          </div>
        </div>

        {/* 4. TMA Geral da Amostra */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              TMA Médio Geral
            </span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
              Operação
            </span>
          </div>
          <div className="text-lg font-extrabold text-emerald-700 font-mono">
            {formatSeconds(overallAvgTma)}
          </div>
          <div className="text-[11px] text-slate-500">
            Duração média por atendimento completo
          </div>
        </div>
      </div>

      {/* Top Filter and Search Bar */}
      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por telefone, cliente, protocolo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs text-slate-800"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500 font-medium">
              Mostrando <span className="font-bold text-slate-800">{contacts.length}</span> de{' '}
              <span className="font-bold text-slate-800">{totalCount}</span> atendimentos
            </div>

            {/* Limit Selector */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Linhas:</span>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Filter Dropdowns Row */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 text-xs">
          {/* Classificação / Motivo Filter */}
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-amber-500" />
            <select
              value={selectedClassification}
              onChange={(e) => setSelectedClassification(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer max-w-[220px]"
            >
              <option value="">Todos os Motivos / Tags</option>
              {(filterMeta?.classifications || []).map((cl) => (
                <option key={cl.name} value={cl.name}>
                  {cl.name} ({cl.count})
                </option>
              ))}
            </select>
          </div>

          {/* Atendente Filter */}
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer max-w-[200px]"
            >
              <option value="">Todos os Atendentes</option>
              {(filterMeta?.availableAgents || filterMeta?.attributions?.map(a => ({ name: a.agentName, total: a.totalContacts })) || []).map((ag) => (
                <option key={ag.name} value={ag.name}>
                  {ag.name} ({ag.total})
                </option>
              ))}
            </select>
          </div>

          {/* Departamento Filter */}
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer max-w-[200px]"
            >
              <option value="">Todos os Setores</option>
              {(filterMeta?.availableDepartments || filterMeta?.departments || []).map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name} ({d.total})
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de Encerramento Filter */}
          <div className="flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-emerald-600" />
            <select
              value={selectedClosure}
              onChange={(e) => setSelectedClosure(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer max-w-[210px]"
            >
              <option value="">Todos os Encerramentos</option>
              {(filterMeta?.closures || []).map((c) => (
                <option key={c.type} value={c.type}>
                  {c.type} ({c.total})
                </option>
              ))}
            </select>
          </div>

          {/* Active Classification Chip */}
          {selectedClassification && (
            <span className="px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-1.5 animate-fadeIn">
              <Tag className="w-3 h-3 text-amber-600" />
              <span className="truncate max-w-[140px]">{selectedClassification}</span>
              <button
                onClick={() => {
                  setSelectedClassification('');
                  onClearInitialClassification?.();
                }}
                className="p-0.5 hover:bg-amber-200/50 rounded-full cursor-pointer"
                title="Remover filtro de classificação"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="ml-auto px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer flex items-center gap-1"
              title="Limpar todos os filtros da listagem"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Table with Column Headers for Sorting */}
      <div className="bg-white border border-slate-200/80 rounded-3xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 select-none">
              <tr>
                {/* Protocolo & Data */}
                <th
                  onClick={() => handleSort('started_at')}
                  className="p-4 cursor-pointer hover:bg-slate-100/70 transition group"
                  title="Ordenar por Data de Abertura"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Protocolo & Data</span>
                    {renderSortIndicator('started_at')}
                  </div>
                </th>

                {/* Contato / Cliente */}
                <th
                  onClick={() => handleSort('name_normalized')}
                  className="p-4 cursor-pointer hover:bg-slate-100/70 transition group"
                  title="Ordenar por Nome do Cliente"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Contato (ISPCHAT)</span>
                    {renderSortIndicator('name_normalized')}
                  </div>
                </th>

                {/* Setor */}
                <th
                  onClick={() => handleSort('department')}
                  className="p-4 cursor-pointer hover:bg-slate-100/70 transition group"
                  title="Ordenar por Setor"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Setor</span>
                    {renderSortIndicator('department')}
                  </div>
                </th>

                {/* Atendente */}
                <th
                  onClick={() => handleSort('agent_display')}
                  className="p-4 cursor-pointer hover:bg-slate-100/70 transition group"
                  title="Ordenar por Atendente"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Atendente</span>
                    {renderSortIndicator('agent_display')}
                  </div>
                </th>

                {/* Tipo de Encerramento */}
                <th
                  onClick={() => handleSort('closure_type')}
                  className="p-4 cursor-pointer hover:bg-slate-100/70 transition group"
                  title="Ordenar por Tipo de Encerramento"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Encerramento</span>
                    {renderSortIndicator('closure_type')}
                  </div>
                </th>

                {/* Classificação / Tags */}
                <th
                  onClick={() => handleSort('classification')}
                  className="p-4 cursor-pointer hover:bg-slate-100/70 transition group"
                  title="Ordenar por Motivo / Classificação"
                >
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-amber-500" />
                    <span>Classificação (Tags)</span>
                    {renderSortIndicator('classification')}
                  </div>
                </th>

                {/* TMA */}
                <th
                  onClick={() => handleSort('handle_time_seconds')}
                  className="p-4 cursor-pointer hover:bg-slate-100/70 transition group text-center"
                  title="Ordenar por Tempo de Atendimento (TMA)"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>TMA (Atend.)</span>
                    {renderSortIndicator('handle_time_seconds')}
                  </div>
                </th>

                {/* TME */}
                <th
                  onClick={() => handleSort('wait_time_seconds')}
                  className="p-4 cursor-pointer hover:bg-slate-100/70 transition group text-center"
                  title="Ordenar por Tempo de Espera (TME)"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>TME (Espera)</span>
                    {renderSortIndicator('wait_time_seconds')}
                  </div>
                </th>

                {/* Vínculo RBX */}
                <th
                  onClick={() => handleSort('match_status')}
                  className="p-4 cursor-pointer hover:bg-slate-100/70 transition group text-right"
                  title="Ordenar por Status de Vínculo com RBX"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Vínculo RBX</span>
                    {renderSortIndicator('match_status')}
                  </div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-16 text-center text-slate-400">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto mb-2 text-blue-600" />
                    <p className="font-medium text-xs">Carregando dados detalhados dos atendimentos...</p>
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-16 text-center text-slate-400 space-y-2">
                    <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="font-bold text-slate-700 text-sm">Nenhum atendimento encontrado</p>
                    <p className="text-xs text-slate-400">
                      Tente alterar os termos de busca ou remover os filtros aplicados.
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={handleClearFilters}
                        className="mt-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                      >
                        Limpar Todos os Filtros
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => {
                  const waitSeconds = contact.wait_time_seconds || 0;
                  const handleSeconds = contact.handle_time_seconds || 0;
                  const isHighWait = waitSeconds > 300; // > 5 min

                  return (
                    <tr key={contact.id} className="hover:bg-slate-50/70 transition">
                      {/* Protocolo & Data */}
                      <td className="p-4">
                        <div className="font-mono font-bold text-slate-800 flex items-center gap-1.5">
                          <span>#{contact.protocol_number || contact.conversation_id}</span>
                        </div>
                        {contact.protocol_number && contact.protocol_number !== contact.conversation_id && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            ID: {contact.conversation_id}
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>
                            {contact.started_at
                              ? new Date(contact.started_at).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </span>
                        </div>
                      </td>

                      {/* Contato / Cliente */}
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 truncate max-w-[200px]" title={contact.name_normalized || contact.name_masked || 'Cliente'}>
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{contact.name_normalized || contact.name_masked || 'Sem nome informado'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-500 font-mono text-[11px] mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{contact.phone_masked || '—'}</span>
                        </div>
                      </td>

                      {/* Setor */}
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 text-slate-700">
                          {contact.department || 'Automação'}
                        </span>
                      </td>

                      {/* Atendente */}
                      <td className="p-4">
                        {contact.agent_display ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {contact.agent_display.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-semibold text-slate-800 text-xs truncate max-w-[130px]" title={contact.agent_display}>
                              {contact.agent_display}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Automação / Fila</span>
                        )}
                      </td>

                      {/* Tipo de Encerramento */}
                      <td className="p-4">
                        {getClosureBadge(contact.closure_type)}
                        {((contact.messages_received ?? 0) > 0 || (contact.messages_sent ?? 0) > 0) && (
                          <div
                            className="flex items-center gap-1 text-[10px] text-slate-500 mt-1"
                            title={`Mensagens: ${contact.messages_received || 0} recebidas, ${contact.messages_sent || 0} enviadas, ${contact.messages_internal || 0} internas`}
                          >
                            <span className="font-medium bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                              💬 {contact.messages_received || 0}↓ / {contact.messages_sent || 0}↑
                            </span>
                          </div>
                        )}
                        {contact.description && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[150px] mt-0.5" title={contact.description}>
                            📝 {contact.description}
                          </div>
                        )}
                      </td>

                      {/* Classificação (Tags) */}
                      <td className="p-4">
                        {(() => {
                          if (!contact.classification) {
                            return <span className="text-[11px] text-slate-400 italic">Sem classificação</span>;
                          }
                          let tags: string[] = [];
                          try {
                            if (contact.classification.startsWith('[')) {
                              tags = JSON.parse(contact.classification);
                            } else {
                              tags = contact.classification.split(',').map((s) => s.trim()).filter(Boolean);
                            }
                          } catch {
                            tags = [contact.classification];
                          }
                          if (!tags || tags.length === 0) {
                            return <span className="text-[11px] text-slate-400 italic">Sem classificação</span>;
                          }
                          return (
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {tags.slice(0, 2).map((t, idx) => (
                                <span
                                  key={idx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedClassification(t);
                                  }}
                                  className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200/80 hover:bg-amber-100 transition cursor-pointer truncate max-w-[140px]"
                                  title={`Filtrar por "${t}"`}
                                >
                                  {t}
                                </span>
                              ))}
                              {tags.length > 2 && (
                                <span
                                  className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600"
                                  title={tags.slice(2).join(', ')}
                                >
                                  +{tags.length - 2}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* TMA (Atendimento) */}
                      <td className="p-4 text-center">
                        <div
                          className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md inline-block ${
                            handleSeconds > 900
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-slate-50 text-slate-700'
                          }`}
                          title={`Tempo de Atendimento: ${handleSeconds}s`}
                        >
                          {formatSeconds(contact.handle_time_seconds)}
                        </div>
                      </td>

                      {/* TME (Espera) com destaque visual */}
                      <td className="p-4 text-center">
                        <div
                          className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md inline-block ${
                            isHighWait
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-50 text-slate-700'
                          }`}
                          title={isHighWait ? `Espera excessiva: ${waitSeconds}s (> 5min)` : `Tempo de Espera: ${waitSeconds}s`}
                        >
                          {formatSeconds(contact.wait_time_seconds)}
                          {isHighWait && <span className="ml-1 text-[10px] text-rose-600 font-extrabold">!</span>}
                        </div>
                      </td>

                      {/* Vínculo RBX */}
                      <td className="p-4 text-right">
                        <div className="space-y-1 inline-flex flex-col items-end">
                          {contact.rbx_client_id ? (
                            <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                              RBX: #{contact.rbx_client_id}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Não vinculado</span>
                          )}
                          <div>{getMatchStatusBadge(contact.match_status)}</div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200/80 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(1)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Primeira página"
              >
                ««
              </button>
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                Anterior
              </button>
            </div>

            <div className="text-xs font-medium text-slate-500">
              Página <span className="font-bold text-slate-900">{page}</span> de{' '}
              <span className="font-bold text-slate-900">{totalPages}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                Próxima
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(totalPages)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Última página"
              >
                »»
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
