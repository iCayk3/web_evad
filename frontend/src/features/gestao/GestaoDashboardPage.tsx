import React, { useState, useEffect } from 'react';
import {
  RotateCw,
  Filter,
  Flame,
  Clock,
  Users,
  AlertCircle,
  Tag,
  X,
  ChevronDown,
  Search,
  Check,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import { MetricCardsGrid } from './MetricCardsGrid.tsx';
import { TimeSeriesWidget } from './TimeSeriesWidget.tsx';
import { QueueDistributionWidget } from './QueueDistributionWidget.tsx';
import { TopRankingsWidget } from './TopRankingsWidget.tsx';
import { CrossMatrixWidget } from './CrossMatrixWidget.tsx';
import { DrillDownDrawer } from './DrillDownDrawer.tsx';
import { Card } from '../../components/common/Card.tsx';
import { Badge } from '../../components/common/Badge.tsx';
import { PillButton } from '../../components/common/PillButton.tsx';

interface GestaoDashboardPageProps {
  onSelectTicket: (ticketId: number) => void;
  onNavigateToSettings?: () => void;
}

export const GestaoDashboardPage: React.FC<GestaoDashboardPageProps> = ({
  onSelectTicket,
  onNavigateToSettings,
}) => {
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('7d');
  const [ticketType, setTicketType] = useState<string>('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [topicDropdownOpen, setTopicDropdownOpen] = useState(false);
  const [topicSearch, setTopicSearch] = useState('');
  const [hoveredTopic, setHoveredTopic] = useState<string | null>(null);
  const [overviewData, setOverviewData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drill-down state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/analytics/overview?period=${period}`;
      if (ticketType) {
        url += `&type=${encodeURIComponent(ticketType)}`;
      }
      if (selectedTopics.length > 0) {
        url += `&topics=${encodeURIComponent(selectedTopics.join(','))}`;
      }
      const data = await apiFetch<any>(url);
      setOverviewData(data);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar indicadores analíticos do RBXSoft');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [period, ticketType, selectedTopics]);

  const toggleTopic = (topicName: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topicName) ? prev.filter((t) => t !== topicName) : [...prev, topicName]
    );
  };

  const handleOpenDrillDown = (metricId: string, cellKey?: string) => {
    setSelectedMetricId(metricId);
    setSelectedCellKey(cellKey || null);
    setDrawerOpen(true);
  };

  const activeFiltersCount =
    (period !== '7d' ? 1 : 0) + (ticketType ? 1 : 0) + selectedTopics.length;

  return (
    <div className="p-6 md:p-8 space-y-7 max-w-[1600px] mx-auto">
      {/* 1. Barra de Cabeçalho e Controles em Pílula */}
      <div className="bg-white border border-slate-100/90 rounded-2xl p-5 shadow-premium-card flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Painel de Gestão
            </h1>
            <Badge variant="primary" className="text-[11px] py-0.5 px-2.5">
              Tempo Real
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Indicadores de atendimento, conformidade de SLA e carga da operação
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Período em Pílula */}
          <div className="inline-flex bg-slate-100/80 p-1 rounded-full border border-slate-200/60 text-xs font-medium shadow-2xs">
            <button
              type="button"
              onClick={() => setPeriod('today')}
              className={`px-3.5 py-1 rounded-full transition-all duration-150 ${
                period === 'today'
                  ? 'bg-white text-brand-primary shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setPeriod('7d')}
              className={`px-3.5 py-1 rounded-full transition-all duration-150 ${
                period === '7d'
                  ? 'bg-white text-brand-primary shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 Dias
            </button>
            <button
              type="button"
              onClick={() => setPeriod('30d')}
              className={`px-3.5 py-1 rounded-full transition-all duration-150 ${
                period === '30d'
                  ? 'bg-white text-brand-primary shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30 Dias
            </button>
          </div>

          {/* Seletor de Tipo de Atendimento em Pílula */}
          <div className="inline-flex bg-slate-100/80 p-1 rounded-full border border-slate-200/60 text-xs font-medium shadow-2xs">
            <button
              type="button"
              onClick={() => setTicketType('')}
              className={`px-3 py-1 rounded-full transition-all duration-150 ${
                ticketType === ''
                  ? 'bg-white text-brand-primary shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Todos os setores"
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setTicketType('Técnico')}
              className={`px-3 py-1 rounded-full transition-all duration-150 ${
                ticketType === 'Técnico'
                  ? 'bg-white text-brand-primary shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Técnico
            </button>
            <button
              type="button"
              onClick={() => setTicketType('Comercial')}
              className={`px-3 py-1 rounded-full transition-all duration-150 ${
                ticketType === 'Comercial'
                  ? 'bg-white text-brand-primary shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Comercial
            </button>
            <button
              type="button"
              onClick={() => setTicketType('Adm/Fin')}
              className={`px-3 py-1 rounded-full transition-all duration-150 ${
                ticketType === 'Adm/Fin'
                  ? 'bg-white text-brand-primary shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Adm/Fin
            </button>
          </div>

          {/* Multi-Seletor de Tópicos em Formato Pílula */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setTopicDropdownOpen(!topicDropdownOpen)}
              className={`flex items-center gap-1.5 py-1.5 px-3.5 rounded-full text-xs font-semibold transition-all duration-150 border shadow-2xs ${
                selectedTopics.length > 0
                  ? 'bg-brand-primary-light border-blue-300 text-brand-primary'
                  : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Tag className="w-3.5 h-3.5 text-brand-primary" />
              <span>
                {selectedTopics.length === 0
                  ? 'Filtrar Tópicos'
                  : `${selectedTopics.length} Selecionados`}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {topicDropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 p-3 text-xs animate-in fade-in zoom-in-95 duration-150">
                <div className="p-1 mb-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                    Tópicos de Demanda
                  </span>
                  {selectedTopics.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedTopics([])}
                      className="text-[11px] text-rose-600 hover:underline font-semibold"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={topicSearch}
                    onChange={(e) => setTopicSearch(e.target.value)}
                    placeholder="Buscar tópico..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-brand-primary outline-none"
                  />
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                  {overviewData?.availableTopics
                    ?.filter((t: any) =>
                      t.name.toLowerCase().includes(topicSearch.toLowerCase())
                    )
                    .map((t: any) => {
                      const isSelected = selectedTopics.includes(t.name);
                      return (
                        <label
                          key={t.name}
                          onMouseEnter={() => setHoveredTopic(t.name)}
                          onMouseLeave={() => setHoveredTopic(null)}
                          className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-xl cursor-pointer select-none transition-colors"
                          title={t.name}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTopic(t.name)}
                            className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary shrink-0"
                          />
                          <span className="flex-1 truncate text-slate-700 font-medium">
                            {t.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">
                            {t.count}
                          </span>
                        </label>
                      );
                    })}
                </div>

                <div className="pt-2.5 mt-2 border-t border-slate-100">
                  {hoveredTopic ? (
                    <div className="p-2.5 mb-2 bg-slate-900 text-white text-[11px] rounded-xl shadow-md border border-slate-700 animate-in fade-in duration-100 flex items-start gap-1.5 leading-snug">
                      <Tag className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <div className="flex-1 break-words font-medium">
                        {hoveredTopic}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 px-1 mb-2 italic">
                      Dica: passe o cursor sobre um item para ver o nome completo
                    </div>
                  )}

                  <div className="flex justify-end">
                    <PillButton
                      size="sm"
                      onClick={() => setTopicDropdownOpen(false)}
                    >
                      Aplicar
                    </PillButton>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Botão Atualizar Manual em Pílula */}
          <PillButton
            size="sm"
            onClick={fetchOverview}
            disabled={loading}
            icon={RotateCw}
          >
            {loading ? 'Atualizando...' : 'Atualizar'}
          </PillButton>
        </div>
      </div>

      {/* Badges de Filtros Ativos em Pílula */}
      {(ticketType || selectedTopics.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 p-3.5 bg-blue-50/70 border border-blue-200/60 rounded-2xl text-xs shadow-2xs">
          <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5 mr-1">
            <Filter className="w-3.5 h-3.5 text-brand-primary" />
            Filtros Ativos:
          </span>

          {ticketType && (
            <Badge variant="primary" className="bg-white">
              <span>Setor: <strong>{ticketType}</strong></span>
              <button
                type="button"
                onClick={() => setTicketType('')}
                className="hover:text-rose-600 ml-1 text-slate-400"
                title="Remover filtro de setor"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {selectedTopics.map((top) => (
            <Badge key={top} variant="primary" className="bg-white">
              <span>{top}</span>
              <button
                type="button"
                onClick={() => toggleTopic(top)}
                className="hover:text-rose-600 ml-1 text-slate-400"
                title={`Remover ${top}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}

          <button
            type="button"
            onClick={() => {
              setTicketType('');
              setSelectedTopics([]);
            }}
            className="text-xs text-blue-700 hover:text-rose-600 underline ml-2 font-semibold"
          >
            Limpar todos
          </button>
        </div>
      )}

      {/* 2. Destaque Visual Premium: Cartão de Assinatura Executivo + Ações Rápidas */}
      {overviewData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
          {/* Cartão de Assinatura Executivo (Signature Dark Card) */}
          <Card variant="signature" className="p-7 flex flex-col justify-between lg:col-span-1 min-h-[220px]">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-200 uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Conformidade Geral de SLA</span>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>

              <div className="space-y-1">
                <div className="text-4xl font-extrabold text-white tracking-tight font-sans">
                  {overviewData.cards?.taxa_cumprimento_sla?.value || '95.2%'}
                </div>
                <div className="text-xs text-slate-300 font-medium leading-relaxed">
                  Taxa global de chamados atendidos dentro da meta de tolerância do provedor.
                </div>
              </div>
            </div>

            <div className="pt-5 mt-4 border-t border-white/10 flex items-center justify-between">
              <div className="text-[11px] text-slate-300">
                Abertos: <strong className="text-white font-mono">{overviewData.cards?.atendimentos_abertos?.value || 0}</strong>
              </div>
              <button
                type="button"
                onClick={() => handleOpenDrillDown('sla_em_risco')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-[#0A1938] hover:bg-blue-50 text-xs font-bold shadow-sm transition-transform hover:scale-105"
              >
                <span>Ver Fila Crítica</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </Card>

          {/* Ações Operacionais Rápidas em Pílula / Cartões Arredondados */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => handleOpenDrillDown('sla_vencido')}
              className="p-5 bg-white rounded-2xl border border-slate-100/90 shadow-premium-card hover:shadow-premium-hover hover:border-rose-200 transition-all flex flex-col justify-between group text-left"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Flame className="w-5 h-5" />
                </div>
                <Badge variant="overdue" className="text-[10px]">
                  Urgente
                </Badge>
              </div>
              <div className="mt-4">
                <div className="text-sm font-bold text-slate-900 group-hover:text-rose-600 transition-colors">
                  Chamados Vencidos
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Estourados que exigem ação imediata
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs font-semibold text-rose-600 flex items-center justify-between">
                <span>Ver Lista</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleOpenDrillDown('sla_em_risco')}
              className="p-5 bg-white rounded-2xl border border-slate-100/90 shadow-premium-card hover:shadow-premium-hover hover:border-amber-200 transition-all flex flex-col justify-between group text-left"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <Badge variant="risk" className="text-[10px]">
                  Atenção
                </Badge>
              </div>
              <div className="mt-4">
                <div className="text-sm font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                  Prazo em Risco
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Faltando &lt; 60 min para o limite
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs font-semibold text-amber-600 flex items-center justify-between">
                <span>Ver Lista</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleOpenDrillDown('clientes_com_recorrencia')}
              className="p-5 bg-white rounded-2xl border border-slate-100/90 shadow-premium-card hover:shadow-premium-hover hover:border-blue-200 transition-all flex flex-col justify-between group text-left"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-brand-primary flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <Badge variant="primary" className="text-[10px]">
                  Fidelização
                </Badge>
              </div>
              <div className="mt-4">
                <div className="text-sm font-bold text-slate-900 group-hover:text-brand-primary transition-colors">
                  Clientes Recorrentes
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  3 ou mais chamados recentes
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs font-semibold text-brand-primary flex items-center justify-between">
                <span>Ver Lista</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 3. Feedback de Erro */}
      {error && (
        <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-rose-900 text-sm mb-0.5">Falha de Sincronização com o RBXSoft</strong>
              <span className="text-rose-700 leading-relaxed">{error}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onNavigateToSettings && (
              <PillButton
                variant="outline"
                size="sm"
                onClick={onNavigateToSettings}
              >
                Ajustar Configurações
              </PillButton>
            )}
            <PillButton
              variant="danger"
              size="sm"
              onClick={fetchOverview}
            >
              Tentar Novamente
            </PillButton>
          </div>
        </div>
      )}

      {/* 4. Grade de KPIs Oficiais */}
      {overviewData && (
        <MetricCardsGrid
          cards={overviewData.cards}
          onCardClick={(metricId) => handleOpenDrillDown(metricId)}
        />
      )}

      {/* 5. Séries Temporais e Distribuição da Fila */}
      {overviewData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TimeSeriesWidget data={overviewData.timeSeries} />
          <QueueDistributionWidget distribution={overviewData.queueDistribution} />
        </div>
      )}

      {/* 6. Matriz de Cruzamento: Tópico × Criticidade SLA */}
      {overviewData && (
        <CrossMatrixWidget
          matrix={overviewData.crossMatrix}
          onCellClick={(cellKey) => handleOpenDrillDown('matriz_cruzamento', cellKey)}
        />
      )}

      {/* 7. Top Rankings e Carga por Técnico */}
      {overviewData && (
        <TopRankingsWidget
          topTopics={overviewData.topTopics}
          topCauses={overviewData.topCauses}
          technicianWorkload={overviewData.technicianWorkload}
        />
      )}

      {/* 8. Drawer de Drill-Down Lateral */}
      <DrillDownDrawer
        isOpen={drawerOpen}
        metricId={selectedMetricId}
        cellKey={selectedCellKey}
        period={period}
        type={ticketType}
        topics={selectedTopics}
        onClose={() => setDrawerOpen(false)}
        onSelectTicket={onSelectTicket}
      />
    </div>
  );
};
