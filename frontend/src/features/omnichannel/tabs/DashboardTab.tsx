import React, { useState, useEffect } from 'react';
import {
  Users,
  PhoneCall,
  Clock,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  TrendingUp,
  RotateCcw,
  Sparkles,
  Bot,
  UserCheck,
  Calendar,
  Layers,
  BarChart3,
  Flame,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  ChevronRight,
  ExternalLink,
  Timer,
  X,
  Tag,
  Search,
  ArrowUpDown,
  Filter,
  FileText,
  ChevronDown,
} from 'lucide-react';
import { omnichannelApi } from '../api/omnichannel.api.ts';
import {
  OmnichannelOverviewMetrics,
  RecurrenceSummary,
  RbxCorrelationResult,
  RecurrenceClientItem,
} from '../types/omnichannel.types.ts';
import { RecurrenceDetailsModal } from '../components/RecurrenceDetailsModal.tsx';
import { AgentEfficiencyModal } from '../components/AgentEfficiencyModal.tsx';
import { RbxCorrelationModal } from '../components/RbxCorrelationModal.tsx';
import { ExecutiveReportModal } from '../components/ExecutiveReportModal.tsx';

interface DashboardTabProps {
  selectedBatchId?: string;
  selectedBatchFileName?: string;
  onOpenImport: () => void;
  onGoToReviews: () => void;
  onGoToDetailsWithClassification?: (classification: string) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  selectedBatchId,
  selectedBatchFileName,
  onOpenImport,
  onGoToReviews,
  onGoToDetailsWithClassification,
}) => {
  const [metrics, setMetrics] = useState<OmnichannelOverviewMetrics | null>(null);
  const [recurrence, setRecurrence] = useState<RecurrenceSummary | null>(null);
  const [correlation, setCorrelation] = useState<RbxCorrelationResult | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [windowHours, setWindowHours] = useState<number>(24);
  const [isCustomWindow, setIsCustomWindow] = useState(false);
  const [customWindowStart, setCustomWindowStart] = useState<string>('');
  const [customWindowEnd, setCustomWindowEnd] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [isAgentFilterOpen, setIsAgentFilterOpen] = useState(false);
  const [agentSearch, setAgentSearch] = useState('');
  const agentDropdownRef = React.useRef<HTMLDivElement>(null);
  const [isAllClosuresModalOpen, setIsAllClosuresModalOpen] = useState(false);

  // Classifications UX State
  const [classificationSortBy, setClassificationSortBy] = useState<'count' | 'avgTma'>('count');
  const [classificationSearch, setClassificationSearch] = useState('');
  const [isAllClassificationsModalOpen, setIsAllClassificationsModalOpen] = useState(false);

  // Modals state
  const [selectedClientForDetails, setSelectedClientForDetails] = useState<RecurrenceClientItem | null>(null);
  const [isAgentEfficiencyModalOpen, setIsAgentEfficiencyModalOpen] = useState(false);
  const [isCorrelationModalOpen, setIsCorrelationModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const formatSeconds = (sec?: number | null) => {
    if (!sec || sec <= 0) return '00:00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const agentFilter = selectedAgents.length > 0 ? selectedAgents.join(',') : undefined;
      const [overviewRes, recRes, corrRes] = await Promise.all([
        omnichannelApi.getOverview({
          batchId: selectedBatchId || undefined,
          agent: agentFilter,
          department: selectedDept || undefined,
        }),
        omnichannelApi.getRecurrence({
          batchId: selectedBatchId || undefined,
          agent: agentFilter,
          department: selectedDept || undefined,
          limit: 10,
        }),
        omnichannelApi.getCrossRbx({
          batchId: selectedBatchId || undefined,
          agent: agentFilter,
          department: selectedDept || undefined,
          windowHours: isCustomWindow && (customWindowStart || customWindowEnd) ? 720 : windowHours,
          customWindowStart: isCustomWindow && customWindowStart ? customWindowStart : undefined,
          customWindowEnd: isCustomWindow && customWindowEnd ? customWindowEnd : undefined,
        }),
      ]);

      setMetrics(overviewRes.metrics);
      setRecurrence(recRes.recurrence);
      setCorrelation(corrRes.correlation);
    } catch (err) {
      console.error('[DashboardTab] Error loading metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedBatchId, selectedDept, selectedAgents, windowHours]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(event.target as Node)) {
        setIsAgentFilterOpen(false);
      }
    };
    if (isAgentFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAgentFilterOpen]);

  if (loading && !metrics) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-xs font-medium">Carregando métricas analíticas e cruzamentos...</p>
      </div>
    );
  }

  const vol = metrics?.volume;
  const eff = metrics?.efficiency;
  const sat = metrics?.satisfaction;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Filter Bar */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Filter Setor */}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Filtrar Setor:</span>
          </div>
          <div className="flex items-center gap-1.5">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="">Todos os Departamentos</option>
              {(metrics?.availableDepartments || metrics?.departments || []).map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name} ({d.total})
                </option>
              ))}
            </select>
            {selectedDept && (
              <button
                onClick={() => setSelectedDept('')}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer text-xs font-semibold flex items-center gap-1"
                title="Limpar filtro de setor"
              >
                <span className="text-[11px] underline">Limpar</span>
              </button>
            )}
          </div>

          <div className="h-4 w-px bg-slate-200 mx-1 hidden md:block" />

          {/* Filter Atendente Multi-Select */}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Users className="w-4 h-4 text-blue-600" />
            <span>Colaboradores:</span>
          </div>
          <div className="relative" ref={agentDropdownRef}>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsAgentFilterOpen(!isAgentFilterOpen)}
                className={`px-3 py-1.5 bg-slate-50 border rounded-xl text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer flex items-center gap-2 transition ${
                  selectedAgents.length > 0
                    ? 'border-blue-300 bg-blue-50/70 text-blue-900 font-semibold'
                    : 'border-slate-200'
                }`}
                title="Filtrar um ou mais colaboradores na operação"
              >
                <span>
                  {selectedAgents.length === 0
                    ? 'Todos os Colaboradores'
                    : selectedAgents.length === 1
                    ? selectedAgents[0]
                    : `${selectedAgents.length} colaboradores selecionados`}
                </span>
                {selectedAgents.length > 1 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                    {selectedAgents.length}
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isAgentFilterOpen ? 'rotate-180' : ''}`} />
              </button>

              {selectedAgents.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedAgents([])}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer text-xs font-semibold flex items-center gap-0.5"
                  title="Limpar seleção de colaboradores"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="text-[11px] underline">Limpar</span>
                </button>
              )}
            </div>

            {/* Popover de Seleção com Checkboxes */}
            {isAgentFilterOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 p-3 space-y-2.5 animate-fadeIn">
                {(() => {
                  const availableList = metrics?.availableAgents || metrics?.attributions?.map((a) => ({ name: a.agentName, total: a.totalContacts })) || [];
                  const filtered = availableList.filter((ag) =>
                    ag.name.toLowerCase().includes(agentSearch.toLowerCase())
                  );

                  return (
                    <>
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 pb-1.5 border-b border-slate-100">
                        <span>Filtrar Colaboradores</span>
                        <span className="text-[11px] font-medium text-slate-500">
                          {selectedAgents.length} de {availableList.length} ativos
                        </span>
                      </div>

                      {/* Busca rápida */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                        <input
                          type="text"
                          placeholder="Buscar colaborador..."
                          value={agentSearch}
                          onChange={(e) => setAgentSearch(e.target.value)}
                          className="w-full pl-8 pr-2.5 py-1 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 bg-slate-50"
                        />
                      </div>

                      {/* Ações rápidas */}
                      <div className="flex items-center justify-between text-[11px] pt-0.5 text-slate-600">
                        <button
                          type="button"
                          onClick={() => setSelectedAgents(availableList.map((a) => a.name))}
                          className="text-blue-600 hover:underline font-semibold cursor-pointer"
                        >
                          Marcar Todos
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => setSelectedAgents([])}
                          className="text-slate-500 hover:underline cursor-pointer"
                        >
                          Desmarcar Todos
                        </button>
                      </div>

                      {/* Lista de Colaboradores com Checkboxes */}
                      <div className="max-h-56 overflow-y-auto space-y-1 pr-1 divide-y divide-slate-50">
                        {filtered.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-4">Nenhum colaborador encontrado.</p>
                        ) : (
                          filtered.map((ag) => {
                            const isSelected = selectedAgents.includes(ag.name);
                            return (
                              <label
                                key={ag.name}
                                className={`flex items-center justify-between p-1.5 rounded-xl transition cursor-pointer text-xs ${
                                  isSelected
                                    ? 'bg-blue-50/70 text-blue-900 font-semibold'
                                    : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate pr-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {
                                      setSelectedAgents((prev) =>
                                        prev.includes(ag.name)
                                          ? prev.filter((a) => a !== ag.name)
                                          : [...prev, ag.name]
                                      );
                                    }}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                  <span className="truncate" title={ag.name}>
                                    {ag.name}
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                  {ag.total}
                                </span>
                              </label>
                            );
                          })
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 text-[10px]">
                          {selectedAgents.length === 0 ? 'Exibindo todos' : `${selectedAgents.length} filtrados`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsAgentFilterOpen(false)}
                          className="px-3 py-1 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition cursor-pointer text-xs"
                        >
                          Concluir
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-slate-200 mx-1 hidden md:block" />

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>Janela RBX:</span>
          </div>
          <div className="flex rounded-xl bg-slate-100 p-0.5 text-[11px] font-semibold items-center flex-wrap gap-0.5">
            {[
              { label: '±12h', hours: 12 },
              { label: '±24h', hours: 24 },
              { label: '±48h', hours: 48 },
              { label: '7 Dias', hours: 168 },
              { label: '30 Dias', hours: 720 },
            ].map(({ label, hours }) => (
              <button
                key={hours}
                onClick={() => {
                  setWindowHours(hours);
                  setIsCustomWindow(false);
                  setCustomWindowStart('');
                  setCustomWindowEnd('');
                }}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  windowHours === hours && !isCustomWindow
                    ? 'bg-white text-slate-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setIsCustomWindow(true)}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ml-0.5 ${
                isCustomWindow
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Personalizado
            </button>
            {isCustomWindow && (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  loadData();
                }}
                className="flex items-center gap-1.5 ml-2 bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-2xs text-[11px] flex-wrap"
              >
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 text-[10px] font-medium">De:</span>
                  <input
                    type="datetime-local"
                    className="px-1.5 py-0.5 text-[10px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 font-mono"
                    value={customWindowStart}
                    onChange={(e) => setCustomWindowStart(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 text-[10px] font-medium">Até:</span>
                  <input
                    type="datetime-local"
                    className="px-1.5 py-0.5 text-[10px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 font-mono"
                    value={customWindowEnd}
                    onChange={(e) => setCustomWindowEnd(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="px-2.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-[10px] transition cursor-pointer"
                >
                  Filtrar
                </button>
                {(customWindowStart || customWindowEnd) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomWindowStart('');
                      setCustomWindowEnd('');
                      setIsCustomWindow(false);
                      setWindowHours(24);
                    }}
                    className="text-slate-400 hover:text-rose-600 p-0.5 text-[11px] font-bold"
                    title="Limpar janela personalizada"
                  >
                    ✕
                  </button>
                )}
              </form>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            title="Gerar e exportar Relatório Executivo em PDF formatado"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Relatório Executivo (PDF)</span>
          </button>

          <button
            onClick={loadData}
            className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
            title="Atualizar indicadores"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 1. Volume & Resolution Coverage Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <PhoneCall className="w-3.5 h-3.5 text-blue-600" />
            Volume & Resolução de Identidade RBX
          </h3>
          {vol && (vol.suggestedMatches > 0 || vol.ambiguousMatches > 0) && (
            <button
              onClick={onGoToReviews}
              className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 hover:underline"
            >
              <span>{vol.suggestedMatches + vol.ambiguousMatches} aguardando revisão</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Total Atendimentos */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-medium text-slate-500 block">Total Atendimentos</span>
            <div className="text-2xl font-bold text-slate-900">{vol?.totalContacts || 0}</div>
            <div className="text-[11px] text-slate-500">{vol?.distinctPhones || 0} telefones únicos</div>
          </div>

          {/* Clientes Vinculados */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-medium text-slate-500 block">Clientes RBX Identificados</span>
            <div className="text-2xl font-bold text-blue-600">{vol?.distinctClients || 0}</div>
            <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>{vol?.matchCoverageRate || 0}% de cobertura</span>
            </div>
          </div>

          {/* Confirmados por Telefone */}
          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100/80 shadow-xs space-y-1">
            <span className="text-[11px] font-medium text-emerald-800 block">Confirmados (Telefone)</span>
            <div className="text-2xl font-bold text-emerald-900">{vol?.confirmedMatches || 0}</div>
            <div className="text-[11px] text-emerald-700">Vínculo exato automático</div>
          </div>

          {/* Ambíguos / Não encontrados */}
          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100/80 shadow-xs space-y-1">
            <span className="text-[11px] font-medium text-amber-800 block">Ambíguos / Não Encontrados</span>
            <div className="text-2xl font-bold text-amber-900">
              {(vol?.ambiguousMatches || 0) + (vol?.unmatchedContacts || 0)}
            </div>
            <div className="text-[11px] text-amber-700">
              {vol?.ambiguousMatches || 0} múltiplos / {vol?.unmatchedContacts || 0} sem cadastro
            </div>
          </div>
        </div>
      </div>

      {/* 2. Operational Efficiency KPIs (TMT · TMA · TME · TMR) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            Eficiência Operacional (TMT · TMA · TME · TMR)
          </h3>
          <button
            onClick={() => setIsAgentEfficiencyModalOpen(true)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline cursor-pointer"
          >
            <span>Ver eficiência por atendente</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Tempo Médio Total (TMT) - Clicável */}
          <div
            onClick={() => setIsAgentEfficiencyModalOpen(true)}
            className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/50 border border-blue-200/90 shadow-xs hover:border-blue-400 hover:shadow-md transition cursor-pointer space-y-1 group relative overflow-hidden"
            title="Clique para detalhar o tempo médio de cada atendente"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-900 block">Tempo Médio Total (TMT)</span>
              <ExternalLink className="w-3.5 h-3.5 text-blue-500 group-hover:text-blue-700 transition" />
            </div>
            <div className="text-2xl font-bold text-blue-950 font-mono">
              {formatSeconds(eff?.overallAvgTotalTimeSeconds)}
            </div>
            <div className="flex items-center justify-between text-[10px] text-blue-700 font-medium">
              <span>Espera + Atendimento</span>
              <span className="underline font-bold group-hover:text-blue-900">Ver equipe</span>
            </div>
          </div>

          {/* Card 2: TMA Geral */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-medium text-slate-500 block">TMA Médio Geral</span>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {formatSeconds(eff?.overallAvgTmaSeconds)}
            </div>
            <div className="text-[11px] text-slate-500">Tempo de atendimento</div>
          </div>

          {/* Card 3: TME Geral */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-medium text-slate-500 block">TME Médio (Espera)</span>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {formatSeconds(eff?.overallAvgTmeSeconds)}
            </div>
            <div className="text-[11px] text-slate-500">Espera na fila até atendimento</div>
          </div>

          {/* Card 4: TMR 1ª Resposta */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-medium text-slate-500 block">TMR 1ª Resposta</span>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {formatSeconds(eff?.overallAvgTmrFirstSeconds)}
            </div>
            <div className="text-[11px] text-slate-500">Agilidade inicial do atendente</div>
          </div>

          {/* Card 5: Espera Alta (> 5min) */}
          <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100 shadow-xs space-y-1">
            <span className="text-[11px] font-medium text-rose-800 block">Espera Excessiva (&gt; 5min)</span>
            <div className="text-2xl font-bold text-rose-900">{eff?.contactsWithHighWaitTime || 0}</div>
            <div className="text-[11px] text-rose-700 font-medium">
              {eff?.highWaitTimeRate || 0}% dos atendimentos
            </div>
          </div>
        </div>
      </div>

      {/* 3. Cross Reference RBX & Recurrence Summary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* RBX Correlation Box */}
        <div
          onClick={() => setIsCorrelationModalOpen(true)}
          className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4 hover:border-blue-300 hover:shadow-md transition cursor-pointer group"
          title="Clique para ver a lista total detalhada de cruzamento com chamados RBX"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition">
                    Cruzamento de Protocolos RBX
                  </h4>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition" />
                </div>
                <p className="text-[11px] text-slate-400">
                  {customWindowStart && customWindowEnd
                    ? 'Janela personalizada ativa'
                    : `Janela temporal dinâmica de ±${windowHours === 168 ? '7 dias' : windowHours === 720 ? '30 dias' : `${windowHours}h`}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
                {correlation?.correlationRate || 0}% correlacionados
              </span>
              <span className="hidden sm:inline-block text-[11px] font-semibold text-blue-600 underline">
                Ver lista completa
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-slate-50">
              <span className="text-[11px] text-slate-500 block">Com chamado no RBX</span>
              <span className="text-lg font-bold text-slate-800">
                {correlation?.correlatedContactsCount || 0}{' '}
                <span className="text-xs font-normal text-slate-400">
                  / {correlation?.totalLinkedContacts || 0} contatos
                </span>
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50">
              <span className="text-[11px] text-slate-500 block">Sem chamado no RBX</span>
              <span className="text-lg font-bold text-slate-800">
                {correlation?.contactsWithoutCorrelatedTicket || 0}
              </span>
            </div>
          </div>

          {/* Top Correlated Causes */}
          <div>
            <span className="text-xs font-semibold text-slate-700 block mb-2">
              Top Causas Correlacionadas no RBX:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(correlation?.topCorrelatedCauses || []).map((c, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-medium flex items-center gap-1"
                >
                  <span>{c.cause}</span>
                  <span className="font-bold text-blue-600">({c.count})</span>
                </span>
              ))}
              {(!correlation?.topCorrelatedCauses || correlation.topCorrelatedCauses.length === 0) && (
                <span className="text-xs text-slate-400 italic">Nenhuma causa associada no período</span>
              )}
            </div>
          </div>

          {/* High Risk Cases */}
          {correlation?.highRiskClients && correlation.highRiskClients.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-slate-700 block mb-2 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                Clientes com Alto Volume (Contato + Protocolo):
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {(correlation?.highRiskClients || []).slice(0, 4).map((cli, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <div className="truncate max-w-[200px]">
                      <span className="font-semibold text-slate-800">{cli.clientName}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">#{cli.clientId}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        {cli.contactCount} contatos · {cli.ticketCount} OS
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recurrence Ranking Widget */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Recorrência de Clientes</h4>
                <p className="text-[11px] text-slate-400">Clientes com múltiplos chamados na carga</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                {recurrence?.clientsWithTwoPlus || 0} com 2+
              </span>
              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[11px] font-semibold">
                {recurrence?.clientsWithThreePlus || 0} com 3+
              </span>
            </div>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {(recurrence?.topClients || []).map((c, i) => (
              <div
                key={i}
                onClick={() => setSelectedClientForDetails(c)}
                className="p-2.5 rounded-2xl bg-slate-50/70 border border-slate-100 hover:bg-blue-50/50 hover:border-blue-200 transition flex items-center justify-between text-xs cursor-pointer group"
                title="Clique para ver os atendimentos detalhados deste cliente"
              >
                <div className="space-y-0.5 truncate max-w-[220px]">
                  <p className="font-bold text-slate-800 truncate group-hover:text-blue-600 transition">
                    {c.customerName}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
                    <span>{c.phoneDisplay}</span>
                    <span className="text-[10px] text-slate-400">· {c.distinctDays} dias ativos</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800 group-hover:bg-blue-600 group-hover:text-white transition">
                    {c.totalContacts}x
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition" />
                </div>
              </div>
            ))}

            {(!recurrence?.topClients || recurrence.topClients.length === 0) && (
              <div className="py-8 text-center text-slate-400 text-xs italic">
                Nenhum cliente recorrente detectado com os filtros atuais.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Secondary Row: Departments, Attributions, Closures & Classifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* 1. Departamentos */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            Distribuição por Departamento
          </h4>
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {(metrics?.departments || []).map((d, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700">{d.name}</span>
                  <span className="text-slate-500 font-medium">
                    {d.total} ({d.percentage}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, d.percentage)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>TMA: {formatSeconds(d.avgTmaSeconds)}</span>
                  <span>TME: {formatSeconds(d.avgTmeSeconds)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Atendimentos por Atribuição (Atendentes) */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                Atribuições (Atendentes)
              </h4>
              <button
                onClick={() => setIsAgentEfficiencyModalOpen(true)}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>Ver TMT</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              {selectedDept ? `Setor: ${selectedDept}` : 'Todos os departamentos'} · {metrics?.attributions?.length || 0} atendentes
            </p>

            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {(metrics?.attributions || []).slice(0, 5).map((agent, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-700 truncate max-w-[150px]" title={agent.agentName}>
                      {agent.agentName}
                    </span>
                    <span className="text-slate-500 font-medium">
                      {agent.totalContacts} ({agent.percentage}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, agent.percentage)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>TMA: {formatSeconds(agent.avgTmaSeconds)}</span>
                    <span className="text-slate-600 font-semibold">TMT: {formatSeconds(agent.avgTotalTimeSeconds)}</span>
                  </div>
                </div>
              ))}

              {(!metrics?.attributions || metrics.attributions.length === 0) && (
                <div className="py-8 text-center text-slate-400 text-xs italic">
                  Nenhuma atribuição de atendente registrada no filtro atual.
                </div>
              )}
            </div>
          </div>

          {metrics?.attributions && metrics.attributions.length > 5 && (
            <button
              onClick={() => setIsAgentEfficiencyModalOpen(true)}
              className="w-full mt-2 py-1.5 text-center text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50/60 hover:bg-blue-100/70 rounded-xl transition cursor-pointer"
            >
              + {metrics.attributions.length - 5} atendentes (Ver lista completa)
            </button>
          )}
        </div>

        {/* 3. Tipos de Encerramento */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-emerald-600" />
                Tipos de Encerramento
              </h4>
              {metrics?.closures && metrics.closures.length > 4 && (
                <button
                  onClick={() => setIsAllClosuresModalOpen(true)}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Ver todos ({metrics.closures.length})</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-400">
              Ranking dos encerramentos mais frequentes na operação
            </p>

            {/* Destaque do Tipo Mais Utilizado */}
            {metrics?.closures && metrics.closures.length > 0 && (
              <div className="p-2.5 rounded-2xl bg-gradient-to-r from-emerald-50/70 to-teal-50/50 border border-emerald-100 flex items-center justify-between text-xs">
                <div className="truncate max-w-[170px]">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block tracking-wider">
                    🏆 Mais Utilizado
                  </span>
                  <span className="font-bold text-slate-800 truncate block" title={metrics.closures[0].type}>
                    {metrics.closures[0].type}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-extrabold text-emerald-700">
                    {metrics.closures[0].percentage}%
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    ({metrics.closures[0].total} contatos)
                  </span>
                </div>
              </div>
            )}

            {/* Lista dos mais utilizados com barras de progresso */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {(metrics?.closures || []).slice(0, 4).map((c, i) => {
                const isMass = c.type.toLowerCase().includes('massa');
                const isResolved = c.type.toLowerCase().includes('resolv') || c.type.toLowerCase().includes('atendido');
                const isTimeout = c.type.toLowerCase().includes('inatividade') || c.type.toLowerCase().includes('timeout');

                let barColor = 'bg-blue-600';
                if (isResolved) barColor = 'bg-emerald-500';
                else if (isMass) barColor = 'bg-amber-500';
                else if (isTimeout) barColor = 'bg-purple-500';

                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-700 truncate max-w-[160px]" title={c.type}>
                        <span className="font-mono text-slate-400 mr-1 text-[10px]">#{i + 1}</span>
                        {c.type}
                      </span>
                      <span className="text-slate-600 font-semibold shrink-0">
                        {c.total} ({c.percentage}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full ${barColor} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(100, c.percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {(!metrics?.closures || metrics.closures.length === 0) && (
                <div className="py-6 text-center text-slate-400 text-xs italic">
                  Nenhum tipo de encerramento registrado.
                </div>
              )}
            </div>
          </div>

          {/* Automação vs Humano TMA */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-slate-50">
              <span className="text-[10px] text-slate-500 block">TMA Humano</span>
              <span className="font-mono font-bold text-slate-800">
                {formatSeconds(eff?.humanAvgTmaSeconds)}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-slate-50">
              <span className="text-[10px] text-slate-500 block">TMA Automação</span>
              <span className="font-mono font-bold text-slate-800">
                {formatSeconds(eff?.automationAvgTmaSeconds)}
              </span>
            </div>
          </div>
        </div>

        {/* 4. Pesquisa de Satisfação & Operação */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Pesquisa de Satisfação
              </h4>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {sat?.responseRate !== undefined ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(sat.responseRate) : 0}% retorno
              </span>
            </div>

            <p className="text-[11px] text-slate-400">
              Adesão dos clientes ao encerramento com pesquisa
            </p>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                <span className="text-base font-extrabold text-emerald-800 block">
                  {sat?.answered || 0}
                </span>
                <span className="text-[10px] font-semibold text-emerald-700">Respondidas</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-base font-extrabold text-slate-700 block">
                  {sat?.notSent || 0}
                </span>
                <span className="text-[10px] font-medium text-slate-500">Não Enviadas</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-rose-50/70 border border-rose-100">
                <span className="text-base font-extrabold text-rose-800 block">
                  {sat?.expired || 0}
                </span>
                <span className="text-[10px] font-semibold text-rose-700">Expiradas</span>
              </div>
            </div>
          </div>

          {/* Automação vs Humano TMA */}
          <div className="pt-3 border-t border-slate-100 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Tempo Médio de Atendimento (TMA)
            </span>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-500 block">Humano</span>
                <span className="font-mono font-bold text-slate-800">
                  {formatSeconds(eff?.humanAvgTmaSeconds)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-500 block">Automação</span>
                <span className="font-mono font-bold text-slate-800">
                  {formatSeconds(eff?.automationAvgTmaSeconds)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Painel Destacado: Top Motivos e Classificações de Atendimento */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Top Motivos / Classificações de Atendimento</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                  {metrics?.classifications.length || 0} motivos categorizados
                </span>
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Detalhamento de volumetria e TMA por assunto. Clique em qualquer motivo para filtrá-lo no Detalhamento.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Seletor de ordenação */}
            <div className="flex items-center p-1 bg-slate-100/80 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setClassificationSortBy('count')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  classificationSortBy === 'count'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Ordenar por maior número de atendimentos"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Por Volume</span>
              </button>
              <button
                onClick={() => setClassificationSortBy('avgTma')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  classificationSortBy === 'avgTma'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Ordenar por maior tempo médio de atendimento (Gargalos)"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Por Duração (TMA)</span>
              </button>
            </div>

            {/* Modal de ver todos */}
            {metrics?.classifications && metrics.classifications.length > 8 && (
              <button
                onClick={() => setIsAllClassificationsModalOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50/60 hover:bg-blue-100/70 transition flex items-center gap-1 cursor-pointer"
              >
                <span>Ver Todos ({metrics.classifications.length})</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Grid rico de motivos */}
        {(() => {
          const sortedList = [...(metrics?.classifications || [])].sort((a, b) => {
            if (classificationSortBy === 'avgTma') {
              return b.avgTmaSeconds - a.avgTmaSeconds;
            }
            return b.count - a.count;
          });

          const maxCount = sortedList.length > 0 ? Math.max(...sortedList.map((c) => c.count)) : 1;
          const displayList = sortedList.slice(0, 8);

          if (displayList.length === 0) {
            return (
              <div className="py-12 text-center text-slate-400 text-xs italic">
                Nenhum motivo ou classificação registrado nos atendimentos selecionados.
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {displayList.map((cl, i) => {
                const percentage = cl.percentage ?? (maxCount > 0 ? Math.round((cl.count / maxCount) * 100) : 0);
                const isHighTma = cl.avgTmaSeconds > 900; // > 15 min
                const isLowTma = cl.avgTmaSeconds > 0 && cl.avgTmaSeconds < 300; // < 5 min

                return (
                  <div
                    key={i}
                    onClick={() => onGoToDetailsWithClassification?.(cl.name)}
                    className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/70 hover:bg-blue-50/40 hover:border-blue-300 transition space-y-2 cursor-pointer group"
                    title={`Clique para filtrar "${cl.name}" na aba Detalhamento`}
                  >
                    <div className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-5 h-5 rounded-md bg-white border border-slate-200 text-slate-500 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                          #{i + 1}
                        </span>
                        <span className="font-bold text-slate-800 truncate group-hover:text-blue-600 transition" title={cl.name}>
                          {cl.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-extrabold text-slate-900 font-mono">
                          {cl.count} <span className="text-[10px] font-normal text-slate-500">atend.</span>
                        </span>
                        {cl.percentage !== undefined && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-200/80 text-slate-700">
                            {cl.percentage}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Barra de progresso visual */}
                    <div className="h-1.5 w-full rounded-full bg-slate-200/80 overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-500 group-hover:bg-blue-600"
                        style={{ width: `${Math.min(100, (cl.count / maxCount) * 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-500 font-medium">TMA Médio:</span>
                        <span
                          className={`font-mono font-bold px-1.5 py-0.2 rounded-md ${
                            isHighTma
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : isLowTma
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'text-slate-700'
                          }`}
                        >
                          {formatSeconds(cl.avgTmaSeconds)}
                        </span>
                        {isHighTma && (
                          <span className="text-[10px] font-bold text-amber-700">⚠️ Gargalo</span>
                        )}
                      </div>

                      <span className="text-[11px] font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                        <Filter className="w-3 h-3" />
                        <span>Ver no Detalhamento</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Recurrence Client Details Modal */}
      <RecurrenceDetailsModal
        client={selectedClientForDetails}
        batchId={selectedBatchId}
        isOpen={!!selectedClientForDetails}
        onClose={() => setSelectedClientForDetails(null)}
      />

      {/* Agent Efficiency Modal */}
      {isAgentEfficiencyModalOpen && (
        <AgentEfficiencyModal
          isOpen={isAgentEfficiencyModalOpen}
          onClose={() => setIsAgentEfficiencyModalOpen(false)}
          attributions={metrics?.attributions}
          department={selectedDept}
          overallAvgTotalTimeSeconds={eff?.overallAvgTotalTimeSeconds}
          overallAvgTmaSeconds={eff?.overallAvgTmaSeconds}
          overallAvgTmeSeconds={eff?.overallAvgTmeSeconds}
        />
      )}

      {/* RBX Correlation Full Modal */}
      {isCorrelationModalOpen && (
        <RbxCorrelationModal
          isOpen={isCorrelationModalOpen}
          onClose={() => setIsCorrelationModalOpen(false)}
          correlation={correlation}
          department={selectedDept}
          windowHours={windowHours}
          customWindowStart={customWindowStart}
          customWindowEnd={customWindowEnd}
        />
      )}

      {/* All Closure Types Detailed Modal */}
      {isAllClosuresModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Detalhamento dos Tipos de Encerramento
                  </h3>
                  <p className="text-xs text-slate-400">
                    Distribuição e ranking completo de encerramentos na operação ({metrics?.closures?.length || 0} tipos)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAllClosuresModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {(metrics?.closures || []).map((c, i) => {
                const isMass = c.type.toLowerCase().includes('massa');
                const isResolved = c.type.toLowerCase().includes('resolv') || c.type.toLowerCase().includes('atendido');
                const isTimeout = c.type.toLowerCase().includes('inatividade') || c.type.toLowerCase().includes('timeout');

                let barColor = 'bg-blue-600';
                if (isResolved) barColor = 'bg-emerald-500';
                else if (isMass) barColor = 'bg-amber-500';
                else if (isTimeout) barColor = 'bg-purple-500';

                return (
                  <div key={i} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-400">#{i + 1}</span>
                        <span className="font-bold text-slate-800">{c.type}</span>
                        {i === 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                            Mais Utilizado
                          </span>
                        )}
                        {isMass && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            Em Massa
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-slate-900">{c.total} contatos</span>
                        <span className="text-slate-400 text-[11px] ml-1.5">({c.percentage}%)</span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full ${barColor} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(100, c.percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsAllClosuresModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Todas as Classificações / Motivos */}
      {isAllClassificationsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Todas as Classificações / Motivos ({metrics?.classifications.length || 0})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Lista completa com volume, porcentagem da operação e tempo médio de atendimento
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAllClassificationsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Barra de Busca e Ordenação no Modal */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrar por nome do motivo..."
                  value={classificationSearch}
                  onChange={(e) => setClassificationSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-semibold shrink-0">
                <button
                  onClick={() => setClassificationSortBy('count')}
                  className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                    classificationSortBy === 'count' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Volume
                </button>
                <button
                  onClick={() => setClassificationSortBy('avgTma')}
                  className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                    classificationSortBy === 'avgTma' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  TMA
                </button>
              </div>
            </div>

            {/* Lista com Scroll */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              {(() => {
                const filtered = (metrics?.classifications || [])
                  .filter((c) =>
                    !classificationSearch || c.name.toLowerCase().includes(classificationSearch.toLowerCase())
                  )
                  .sort((a, b) => {
                    if (classificationSortBy === 'avgTma') {
                      return b.avgTmaSeconds - a.avgTmaSeconds;
                    }
                    return b.count - a.count;
                  });

                const maxCount = filtered.length > 0 ? Math.max(...filtered.map((c) => c.count)) : 1;

                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400 text-xs italic">
                      Nenhuma classificação corresponde ao termo pesquisado.
                    </div>
                  );
                }

                return filtered.map((c, i) => {
                  const isHighTma = c.avgTmaSeconds > 900;
                  return (
                    <div
                      key={i}
                      className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs hover:bg-blue-50/40 hover:border-blue-200 transition group"
                    >
                      <div className="space-y-1 truncate max-w-[280px]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-400 text-[11px] font-bold">#{i + 1}</span>
                          <span className="font-bold text-slate-800 truncate" title={c.name}>
                            {c.name}
                          </span>
                        </div>
                        <div className="h-1.5 w-44 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${Math.min(100, (c.count / maxCount) * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="font-mono font-bold text-slate-900 block">{c.count} atend.</span>
                          <span className="text-[10px] text-slate-500">
                            TMA: <strong className={isHighTma ? 'text-amber-700' : 'text-slate-700'}>{formatSeconds(c.avgTmaSeconds)}</strong>
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            setIsAllClassificationsModalOpen(false);
                            onGoToDetailsWithClassification?.(c.name);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white font-semibold text-xs transition flex items-center gap-1 cursor-pointer"
                          title={`Filtrar ${c.name} no Detalhamento`}
                        >
                          <Filter className="w-3 h-3" />
                          <span>Filtrar</span>
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsAllClassificationsModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Executive Report Modal */}
      <ExecutiveReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        metrics={metrics}
        correlation={correlation}
        periodLabel={
          isCustomWindow && (customWindowStart || customWindowEnd)
            ? `${customWindowStart || ''} até ${customWindowEnd || ''}`
            : selectedBatchFileName
            ? selectedBatchFileName
            : `Últimos ${windowHours}h`
        }
        batchFileName={selectedBatchFileName}
        selectedAgents={selectedAgents}
      />
    </div>
  );
};

