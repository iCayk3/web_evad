import React, { useState } from 'react';
import {
  Users,
  Award,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  Sparkles,
  ChevronRight,
  BarChart3,
  Calendar,
  Layers,
  MapPin,
  Wifi,
  ExternalLink,
  Table as TableIcon,
  BarChart2,
  FileCheck,
  Scale,
  Building2,
} from 'lucide-react';
import { CommercialDashboardDto, SalesMonthlyPoint, SalesTimeSeriesPoint } from '../types.ts';
import { AccessibleTable, Column } from '../../../components/common/AccessibleTable.tsx';
import { formatDateBR } from '../utils.ts';

interface CommercialDashboardViewProps {
  dashboard: CommercialDashboardDto;
  onOpenDrilldown: (metricId: string, metricName: string) => void;
}

export const CommercialDashboardView: React.FC<CommercialDashboardViewProps> = ({
  dashboard,
  onOpenDrilldown,
}) => {
  const kpis = dashboard?.kpis || ({} as any);
  const topPlans = dashboard?.topPlans || [];
  const topSellers = dashboard?.topSellers || [];
  const salesByRegion = dashboard?.salesByRegion || [];
  const salesByCity = dashboard?.salesByCity || [];
  const salesByTechnology = dashboard?.salesByTechnology || [];
  const cancellationsByReason = dashboard?.cancellationsByReason || [];
  const timeSeries = dashboard?.timeSeries || [];
  const funnel = dashboard?.funnel || [];

  const regionList = salesByRegion || (salesByCity ? salesByCity.map(c => ({ region: c.city, count: c.count, value: c.value })) : []);

  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [hoveredMonth, setHoveredMonth] = useState<SalesMonthlyPoint | null>(null);
  const [hoveredDay, setHoveredDay] = useState<SalesTimeSeriesPoint | null>(null);
  const [groupSortBy, setGroupSortBy] = useState<'count' | 'value'>('count');

  const rawGroupList = dashboard.salesByGroup || [];
  const groupList = [...rawGroupList].sort((a, b) => {
    if (groupSortBy === 'value') {
      return b.value - a.value;
    }
    return b.count - a.count;
  });

  const closedSales = kpis.closedSalesCount ?? 0;
  const cancellations = kpis.cancellationsCount ?? 0;
  const netAdditions = kpis.netAdditions ?? (closedSales - cancellations);
  const churnRatio = kpis.churnRatioPercent ?? (closedSales > 0 ? Math.round((cancellations / closedSales) * 1000) / 10 : (cancellations > 0 ? 100 : 0));

  const isYearView = dashboard.period?.type === 'year';
  const monthlySeries = dashboard.monthlySeries || [];
  const maxMonthlyValue = Math.max(
    ...monthlySeries.map((m) => Math.max(m.leads, m.sales, m.contracts ?? 0, m.cancellations)),
    5
  );

  const maxTimeSeriesValue = Math.max(
    ...timeSeries.map((t) => Math.max(t.leads, t.sales, t.contracts ?? 0, t.cancellations)),
    5
  );

  const monthlyColumns: Column<SalesMonthlyPoint>[] = [
    { key: 'fullLabel', header: 'Mês / Ano', sortable: true },
    {
      key: 'leads',
      header: 'Novos Leads',
      sortable: true,
      align: 'right',
      render: (item) => <span className="font-semibold text-brand-primary">+{item.leads}</span>,
    },
    {
      key: 'sales',
      header: 'Vendas Fechadas',
      sortable: true,
      align: 'right',
      render: (item) => <span className="font-semibold text-emerald-600">{item.sales}</span>,
    },
    {
      key: 'contracts',
      header: 'Novos Contratos',
      sortable: true,
      align: 'right',
      render: (item) => <span className="font-semibold text-indigo-600">{item.contracts ?? 0}</span>,
    },
    {
      key: 'cancellations',
      header: 'Cancelamentos',
      sortable: true,
      align: 'right',
      render: (item) => <span className="font-semibold text-rose-600">{item.cancellations}</span>,
    },
    {
      key: 'netAdditions',
      header: 'Adição Líquida',
      sortable: true,
      align: 'right',
      render: (item) => (
        <span
          className={`font-semibold px-2 py-0.5 rounded-full text-xs ${
            item.netAdditions >= 0
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-50 text-rose-700'
          }`}
        >
          {item.netAdditions >= 0 ? `+${item.netAdditions}` : item.netAdditions}
        </span>
      ),
    },
  ];

  const dailyColumns: Column<SalesTimeSeriesPoint>[] = [
    {
      key: 'date',
      header: 'Data',
      sortable: true,
      render: (item) => <span className="font-mono text-slate-600">{formatDateBR(item.date)}</span>,
    },
    {
      key: 'leads',
      header: 'Novos Leads',
      sortable: true,
      align: 'right',
      render: (item) => <span className="font-semibold text-brand-primary">+{item.leads}</span>,
    },
    {
      key: 'sales',
      header: 'Vendas Fechadas',
      sortable: true,
      align: 'right',
      render: (item) => <span className="font-semibold text-emerald-600">{item.sales}</span>,
    },
    {
      key: 'contracts',
      header: 'Novos Contratos',
      sortable: true,
      align: 'right',
      render: (item) => <span className="font-semibold text-indigo-600">{item.contracts ?? 0}</span>,
    },
    {
      key: 'cancellations',
      header: 'Cancelamentos',
      sortable: true,
      align: 'right',
      render: (item) => <span className="font-semibold text-rose-600">{item.cancellations}</span>,
    },
    {
      key: 'net',
      header: 'Saldo Diário',
      sortable: true,
      align: 'right',
      render: (item) => {
        const net = (item.sales || item.contracts) - item.cancellations;
        return (
          <span
            className={`font-semibold px-2 py-0.5 rounded-full text-xs ${
              net >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}
          >
            {net >= 0 ? `+${net}` : net}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Grade com os Cards de Indicadores Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* 1. Novos Leads */}
        <div
          onClick={() =>
            onOpenDrilldown(
              'novos_leads_periodo',
              isYearView ? 'Novos Leads (Mês Atual)' : 'Novos Leads no Período'
            )
          }
          className="group bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-brand-primary/40 transition-all cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isYearView ? 'Novos Leads (Mês Atual)' : 'Novos Leads'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-brand-primary flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{kpis.newLeadsCount}</span>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
              +{kpis.newLeadsDiffPercent}%
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>{isYearView ? 'Inclusão no mês corrente' : 'Inclusão no período'}</span>
            <span className="text-brand-primary font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition">
              Ver registros <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* 2. Vendas Fechadas (Novas Vendas) */}
        <div
          onClick={() => onOpenDrilldown('vendas_fechadas', 'Vendas Fechadas (Novas Vendas)')}
          className="group bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-brand-primary/40 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vendas Fechadas</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{kpis.closedSalesCount}</span>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                +{kpis.closedSalesDiffPercent}%
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Entradas brutas confirmadas</p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Novas adesões no período</span>
            <span className="text-brand-primary font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition">
              Ver registros <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* 3. Cancelamentos no Período (Evasão) */}
        <div
          onClick={() => onOpenDrilldown('cancelamentos_periodo', 'Cancelamentos Contratuais no Período')}
          className="group bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-rose-300 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cancelamentos</span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-rose-600">{kpis.cancellationsCount}</span>
              <span className="text-xs font-medium text-slate-400">contratos evadidos</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Saídas contratuais do período</p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Motivos & concorrência</span>
            <span className="text-brand-primary font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition">
              Ver registros <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* 4. Card Corporativo: Balanço Comercial & Churn (Visão Executiva do Saldo Líquido) */}
        <div
          onClick={() => onOpenDrilldown('cancelamentos_periodo', 'Cancelamentos & Churn de Carteira')}
          className="group bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-brand-primary/40 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Balanço & Churn
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    netAdditions > 0
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                      : netAdditions === 0
                      ? 'bg-slate-100 text-slate-700 border border-slate-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                  }`}
                >
                  {netAdditions > 0 ? 'Expansão Líquida' : netAdditions === 0 ? 'Equilíbrio' : 'Déficit Líquido'}
                </span>
              </div>
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  netAdditions >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                }`}
              >
                <Scale className="w-4 h-4" />
              </div>
            </div>

            {/* Saldo Líquido em Destaque */}
            <div className="mt-3 flex items-baseline gap-2">
              <span
                className={`text-2xl font-bold tracking-tight ${
                  netAdditions > 0 ? 'text-emerald-700' : netAdditions === 0 ? 'text-slate-700' : 'text-rose-600'
                }`}
              >
                {netAdditions > 0 ? `+${netAdditions}` : netAdditions}
              </span>
              <span className="text-xs font-medium text-slate-500">
                {Math.abs(netAdditions) === 1 ? 'contrato líquido' : 'contratos líquidos'}
              </span>
            </div>

            {/* Comparativo de Equação: Vendas - Cancelamentos */}
            <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Vendas (Entradas):</span>
                <span className="font-semibold text-emerald-600 font-mono">+{closedSales}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Cancelamentos (Saídas):</span>
                <span className="font-semibold text-rose-600 font-mono">-{cancellations}</span>
              </div>

              {/* Barra Proporcional de Retenção vs Erosão */}
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex mt-1">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{
                    width: `${closedSales + cancellations > 0 ? Math.round((closedSales / (closedSales + cancellations)) * 100) : 50}%`,
                  }}
                  title={`Vendas: ${closedSales}`}
                />
                <div
                  className="bg-rose-500 h-full transition-all duration-500"
                  style={{
                    width: `${closedSales + cancellations > 0 ? Math.round((cancellations / (closedSales + cancellations)) * 100) : 50}%`,
                  }}
                  title={`Cancelamentos: ${cancellations}`}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                <span>Evasão vs Vendas:</span>
                <span
                  className={`font-bold ${
                    churnRatio <= 30 ? 'text-emerald-600' : churnRatio <= 60 ? 'text-amber-600' : 'text-rose-600'
                  }`}
                >
                  {churnRatio}%
                </span>
              </div>
            </div>
          </div>

          {/* Rodapé Estratégico Corporativo */}
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 truncate text-[10px]" title="Reposição líquida real da carteira de clientes">
              {netAdditions >= 0 ? 'Ganhos superam perdas' : 'Evasão supera vendas'}
            </span>
            <span className="text-brand-primary font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition shrink-0">
              Ver Churn <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* 3. Contratos Confirmados (Total emitidos no período) */}
        <div
          onClick={() => onOpenDrilldown('contratos_confirmados', 'Contratos Confirmados no Período')}
          className="group bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-brand-primary/40 transition-all cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contratos Confirmados</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{kpis.confirmedContractsCount ?? kpis.closedSalesCount}</span>
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
              +{kpis.confirmedContractsDiffPercent ?? 10.5}%
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Total assinados no período</span>
            <span className="text-brand-primary font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition">
              Ver registros <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* 3. Ticket Médio Mensal */}
        <div
          onClick={() => onOpenDrilldown('vendas_fechadas', 'Ticket Médio de Mensalidades')}
          className="group bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-brand-primary/40 transition-all cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ticket Médio Mensal</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              R$ {kpis.averageTicketMonthly.toFixed(2)}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Adesão média: R$ {kpis.averageAdhesionValue.toFixed(2)}</span>
            <span className="text-brand-primary font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition">
              Ver registros <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* 4. Conversão Rastreável */}
        <div
          onClick={() => onOpenDrilldown('conversao_rastreavel', 'Conversão Rastreável Lead → Contrato')}
          className="group bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-brand-primary/40 transition-all cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Conversão Rastreável</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {kpis.conversionRatePercent.toFixed(1)}%
            </span>
            <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
              {kpis.traceableConversionsCount} vendas
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Chave oficial prospect</span>
            <span className="text-brand-primary font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition">
              Ver registros <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* 5. Leads por Etapa (Fotografia Atual) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm space-y-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Funil Atual (Snapshot)</span>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-blue-50/70 border border-blue-100">
              <div className="font-bold text-blue-900">{kpis.leadsByStage.new}</div>
              <div className="text-[10px] text-blue-600 font-medium">Novos</div>
            </div>
            <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-100">
              <div className="font-bold text-amber-900">{kpis.leadsByStage.proposal}</div>
              <div className="text-[10px] text-amber-600 font-medium">Proposta</div>
            </div>
            <div className="p-2 rounded-xl bg-orange-50/70 border border-orange-100">
              <div className="font-bold text-orange-900">{kpis.leadsByStage.negotiation}</div>
              <div className="text-[10px] text-orange-600 font-medium">Negociação</div>
            </div>
          </div>
        </div>

        {/* 9. Leads sem Próximo Contato / Vencidos */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm space-y-3 sm:col-span-1 lg:col-span-1 xl:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ações Vencidas / Sem Ação</span>
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-red-700">{kpis.leadsWithoutNextContactCount}</span>
            <span className="text-xs font-medium text-slate-500">leads requerem ação</span>
          </div>
          <p className="text-[11px] text-slate-400">Aging de oportunidades paradas</p>
        </div>

        {/* 10. Atividades Comerciais Abertas (Tipo C) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm space-y-3 sm:col-span-1 lg:col-span-1 xl:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Atividades Comerciais</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{kpis.openActivitiesCount}</span>
            <span className="text-xs font-medium text-slate-500">chamados Tipo C ativos</span>
          </div>
          <p className="text-[11px] text-slate-400">Atendimentos em andamento</p>
        </div>
      </div>

      {/* Evolução de Vendas, Leads e Cancelamentos (Mensal para Ano ou Diária para outros períodos) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 tracking-tight">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-brand-primary flex items-center justify-center">
                <TrendingUp className="w-4 h-4" strokeWidth={2} />
              </div>
              <span>
                {isYearView
                  ? `Evolução Mensal de Vendas & Desempenho Comercial (${dashboard.period?.label || 'Ano Corrente'})`
                  : `Evolução Diária: Leads, Vendas & Cancelamentos (${dashboard.period?.label || 'Período'})`}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isYearView
                ? 'Demonstrativo mês a mês de novos leads, contratos fechados e cancelamentos do ano corrente'
                : 'Comportamento diário e consistência de fechamento no período'}
            </p>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            {/* Botão de Alternância Gráfico / Tabela */}
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'chart' ? 'table' : 'chart')}
              className="w-8 h-8 rounded-xl bg-slate-100/90 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors border border-slate-200/80 shadow-2xs cursor-pointer"
              title={viewMode === 'chart' ? 'Visualizar em tabela' : 'Visualizar em gráfico'}
              aria-label={viewMode === 'chart' ? 'Visualizar em tabela' : 'Visualizar em gráfico'}
            >
              {viewMode === 'chart' ? (
                <TableIcon className="w-4 h-4" />
              ) : (
                <BarChart2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Legenda em pílulas elegantes */}
        <div className="flex flex-wrap items-center justify-end gap-4 text-xs text-slate-600 pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-primary" />
            <span className="text-slate-600 font-medium">Novos Leads</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-600 font-medium">Vendas Fechadas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
            <span className="text-slate-600 font-medium">Novos Contratos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-slate-600 font-medium">Cancelamentos</span>
          </div>
        </div>

        {/* Conteúdo: Gráfico ou Tabela */}
        {viewMode === 'chart' ? (
          <div className="relative pt-2">
            {/* Tooltip Flutuante para Mês (Filtro de Ano) */}
            {isYearView && hoveredMonth && (
              <div className="absolute top-0 right-2 z-20 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl p-3.5 shadow-xl text-xs space-y-1.5 animate-in fade-in zoom-in-95 duration-150 min-w-[210px]">
                <div className="font-bold text-slate-900 pb-1.5 border-b border-slate-100 flex items-center justify-between gap-4">
                  <span>{hoveredMonth.fullLabel}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      hoveredMonth.netAdditions >= 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    Saldo: {hoveredMonth.netAdditions >= 0 ? `+${hoveredMonth.netAdditions}` : hoveredMonth.netAdditions}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 text-brand-primary font-semibold">
                  <span>Novos Leads:</span>
                  <span className="font-mono">+{hoveredMonth.leads}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-emerald-600 font-semibold">
                  <span>Vendas Fechadas:</span>
                  <span className="font-mono">{hoveredMonth.sales}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-indigo-600 font-semibold">
                  <span>Novos Contratos:</span>
                  <span className="font-mono">{hoveredMonth.contracts ?? 0}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-rose-600 font-semibold">
                  <span>Cancelamentos:</span>
                  <span className="font-mono">{hoveredMonth.cancellations}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-slate-600 font-semibold pt-1 border-t border-slate-100 text-[11px]">
                  <span>Adição Líquida:</span>
                  <span
                    className={`font-mono font-bold ${
                      hoveredMonth.netAdditions >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {hoveredMonth.netAdditions >= 0 ? `+${hoveredMonth.netAdditions}` : hoveredMonth.netAdditions} contratos
                  </span>
                </div>
              </div>
            )}

            {/* Tooltip Flutuante para Dia (Outros Filtros) */}
            {!isYearView && hoveredDay && (
              <div className="absolute top-0 right-2 z-20 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl p-3.5 shadow-xl text-xs space-y-1.5 animate-in fade-in zoom-in-95 duration-150 min-w-[210px]">
                <div className="font-bold text-slate-900 pb-1.5 border-b border-slate-100 flex items-center justify-between gap-4">
                  <span>Data: {formatDateBR(hoveredDay.date)}</span>
                  {(() => {
                    const dayNet = (hoveredDay.sales || hoveredDay.contracts) - hoveredDay.cancellations;
                    return (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          dayNet >= 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        Saldo: {dayNet >= 0 ? `+${dayNet}` : dayNet}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex items-center justify-between gap-4 text-brand-primary font-semibold">
                  <span>Novos Leads:</span>
                  <span className="font-mono">+{hoveredDay.leads}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-emerald-600 font-semibold">
                  <span>Vendas Fechadas:</span>
                  <span className="font-mono">{hoveredDay.sales}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-indigo-600 font-semibold">
                  <span>Novos Contratos:</span>
                  <span className="font-mono">{hoveredDay.contracts ?? 0}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-rose-600 font-semibold">
                  <span>Cancelamentos:</span>
                  <span className="font-mono">{hoveredDay.cancellations}</span>
                </div>
              </div>
            )}

            {/* Gráfico Visual: Barras Mensais (quando Ano) ou Diárias */}
            {isYearView ? (
              <div className="grid grid-cols-12 gap-1.5 sm:gap-3 items-end h-56 pt-8 pb-3 border-b border-slate-100">
                {monthlySeries.map((m) => {
                  const hLeads = Math.max((m.leads / maxMonthlyValue) * 100, m.leads > 0 ? 8 : 2);
                  const hSales = Math.max((m.sales / maxMonthlyValue) * 100, m.sales > 0 ? 8 : 2);
                  const hContracts = Math.max(((m.contracts ?? 0) / maxMonthlyValue) * 100, (m.contracts ?? 0) > 0 ? 8 : 2);
                  const hCancels = Math.max((m.cancellations / maxMonthlyValue) * 100, m.cancellations > 0 ? 8 : 2);

                  return (
                    <div
                      key={m.month}
                      onMouseEnter={() => setHoveredMonth(m)}
                      onMouseLeave={() => setHoveredMonth(null)}
                      className="flex flex-col items-center h-full justify-end group cursor-pointer"
                    >
                      <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-full">
                        {/* Barra Leads */}
                        <div
                          style={{ height: `${hLeads}%` }}
                          className="w-1.5 sm:w-2.5 bg-brand-primary rounded-t-lg rounded-b-xs transition-all duration-200 group-hover:brightness-110"
                        />
                        {/* Barra Vendas */}
                        <div
                          style={{ height: `${hSales}%` }}
                          className="w-1.5 sm:w-2.5 bg-emerald-500 rounded-t-lg rounded-b-xs transition-all duration-200 group-hover:brightness-110"
                        />
                        {/* Barra Novos Contratos */}
                        <div
                          style={{ height: `${hContracts}%` }}
                          className="w-1.5 sm:w-2.5 bg-indigo-600 rounded-t-lg rounded-b-xs transition-all duration-200 group-hover:brightness-110"
                        />
                        {/* Barra Cancelamentos */}
                        <div
                          style={{ height: `${hCancels}%` }}
                          className="w-1 sm:w-2 bg-rose-500 rounded-t-lg rounded-b-xs transition-all duration-200 group-hover:brightness-110"
                        />
                      </div>
                      <span className="text-[11px] text-slate-500 font-semibold mt-2.5 group-hover:text-brand-primary transition-colors">
                        {m.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="pt-4 border-t border-slate-100 flex items-end gap-3 h-52 overflow-x-auto">
                {timeSeries.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                    Nenhum registro no período selecionado
                  </div>
                ) : (
                  timeSeries.map((point) => {
                    const leadsH = Math.max((point.leads / maxTimeSeriesValue) * 100, point.leads > 0 ? 8 : 2);
                    const salesH = Math.max((point.sales / maxTimeSeriesValue) * 100, point.sales > 0 ? 8 : 2);
                    const contractsH = Math.max(((point.contracts ?? 0) / maxTimeSeriesValue) * 100, (point.contracts ?? 0) > 0 ? 8 : 2);
                    const cancelsH = Math.max((point.cancellations / maxTimeSeriesValue) * 100, point.cancellations > 0 ? 8 : 2);

                    return (
                      <div
                        key={point.date}
                        onMouseEnter={() => setHoveredDay(point)}
                        onMouseLeave={() => setHoveredDay(null)}
                        className="flex-1 min-w-[55px] flex flex-col items-center gap-2 h-full justify-end group cursor-pointer"
                      >
                        <div className="w-full flex items-end justify-center gap-0.5 h-36">
                          {/* Barra Leads */}
                          <div
                            style={{ height: `${leadsH}%` }}
                            className="w-2 bg-brand-primary rounded-t group-hover:brightness-110 transition-all"
                            title={`Leads: ${point.leads}`}
                          />
                          {/* Barra Vendas */}
                          <div
                            style={{ height: `${salesH}%` }}
                            className="w-2 bg-emerald-500 rounded-t group-hover:brightness-110 transition-all"
                            title={`Vendas: ${point.sales}`}
                          />
                          {/* Barra Novos Contratos */}
                          <div
                            style={{ height: `${contractsH}%` }}
                            className="w-2 bg-indigo-600 rounded-t group-hover:brightness-110 transition-all"
                            title={`Novos Contratos: ${point.contracts ?? 0}`}
                          />
                          {/* Barra Cancelamentos */}
                          <div
                            style={{ height: `${cancelsH}%` }}
                            className="w-1.5 bg-rose-500 rounded-t group-hover:brightness-110 transition-all"
                            title={`Cancelamentos: ${point.cancellations}`}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 group-hover:text-brand-primary transition-colors">
                          {formatDateBR(point.date).slice(0, 5)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="pt-2">
            {isYearView ? (
              <AccessibleTable
                columns={monthlyColumns}
                data={monthlySeries}
                caption="Demonstrativo mensal de novos leads, vendas fechadas e cancelamentos"
                keyExtractor={(item) => item.month}
              />
            ) : (
              <AccessibleTable
                columns={dailyColumns}
                data={timeSeries}
                caption="Demonstrativo diário de novos leads, vendas fechadas e cancelamentos"
                keyExtractor={(item) => item.date}
              />
            )}
          </div>
        )}
      </div>

      {/* Rankings: Top 10 Planos e Top 10 Vendedores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Planos */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Top 10 Planos Mais Assinados</h3>
            <span className="text-xs text-slate-400 font-semibold">{topPlans.length} planos</span>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {topPlans.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                Nenhum plano assinado no período selecionado
              </div>
            ) : (
              topPlans.map((plan, idx) => (
              <div key={plan.name} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 text-center font-bold text-slate-400">#{idx + 1}</span>
                  <div className="truncate font-semibold text-slate-800" title={plan.name}>
                    {plan.name}
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 font-mono">
                  <span className="text-slate-500">{plan.count} assinaturas</span>
                  <span className="font-bold text-slate-900">R$ {plan.value.toFixed(2)}</span>
                  <span className="w-12 text-right text-emerald-600 font-semibold">
                    {plan.sharePercent.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))
            )}
          </div>
        </div>

        {/* Top Vendedores */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Top Vendas por Vendedor</h3>
            <span className="text-xs text-slate-400 font-semibold">{topSellers.length} consultores</span>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {topSellers.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                Nenhum consultor com vendas no período selecionado
              </div>
            ) : (
              topSellers.map((seller, idx) => (
              <div key={seller.name} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 text-center font-bold text-slate-400">#{idx + 1}</span>
                  <div className="truncate font-semibold text-slate-800" title={seller.name}>
                    {seller.name}
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 font-mono">
                  <span className="text-slate-500">{seller.count} vendas</span>
                  <span className="font-bold text-slate-900">R$ {seller.value.toFixed(2)}</span>
                  <span className="w-12 text-right text-brand-primary font-semibold">
                    {seller.sharePercent.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))
            )}
          </div>
        </div>
      </div>

      {/* Cruzamentos Analíticos: Grupo de Clientes, Região & Tecnologia */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Vendas por Grupo de Clientes */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-primary" /> Vendas por Grupo
            </h3>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px] self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setGroupSortBy('count')}
                className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  groupSortBy === 'count'
                    ? 'bg-white text-brand-primary shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Classificar por quantidade de vendas"
              >
                Qtd
              </button>
              <button
                type="button"
                onClick={() => setGroupSortBy('value')}
                className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  groupSortBy === 'value'
                    ? 'bg-white text-brand-primary shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Classificar por valor faturado"
              >
                R$
              </button>
            </div>
          </div>

          <div className="space-y-2.5 text-xs max-h-80 overflow-y-auto pr-1">
            {groupList.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                Nenhum grupo de cliente no período selecionado
              </div>
            ) : (
              groupList.map((g) => (
                <div key={g.group} className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 space-y-1.5 hover:bg-blue-50/30 transition">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 truncate" title={g.group}>
                      {g.group}
                    </span>
                    <span className="font-bold text-brand-primary text-xs shrink-0">
                      {g.sharePercent.toFixed(1)}%
                    </span>
                  </div>
                  {/* Barra de progresso de participação */}
                  <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-brand-primary h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(Math.max(g.sharePercent, 3), 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-0.5">
                    <span>{g.count} {g.count === 1 ? 'venda' : 'vendas'}</span>
                    <span className="text-slate-400">TM: R$ {g.ticketAverage.toFixed(2)}</span>
                    <span className="font-bold text-slate-900">R$ {g.value.toFixed(2)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 2. Vendas por Região */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-brand-primary" /> Vendas por Região
          </h3>
          <div className="space-y-2 text-xs max-h-80 overflow-y-auto pr-1">
            {regionList.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                Nenhuma região encontrada no período
              </div>
            ) : (
              regionList.map((r) => (
                <div key={r.region} className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                  <span className="font-semibold text-slate-800 truncate" title={r.region}>{r.region}</span>
                  <div className="flex items-center gap-3 font-mono shrink-0">
                    <span className="text-slate-500">{r.count} contratos</span>
                    <span className="font-bold text-slate-900">R$ {r.value.toFixed(2)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. Vendas por Tecnologia */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Wifi className="w-4 h-4 text-emerald-600" /> Vendas por Tecnologia
          </h3>
          <div className="space-y-2 text-xs max-h-80 overflow-y-auto pr-1">
            {salesByTechnology.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                Nenhuma tecnologia encontrada no período
              </div>
            ) : (
              salesByTechnology.map((t) => (
                <div key={t.technology} className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                  <span className="font-semibold text-slate-800 truncate" title={t.technology}>{t.technology}</span>
                  <div className="flex items-center gap-3 font-mono shrink-0">
                    <span className="text-slate-500">{t.count} contratos</span>
                    <span className="font-bold text-slate-900">R$ {t.value.toFixed(2)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
