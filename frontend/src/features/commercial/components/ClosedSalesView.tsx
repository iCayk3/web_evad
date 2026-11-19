import React, { useState, useMemo } from 'react';
import {
  Award,
  DollarSign,
  TrendingUp,
  FileCheck,
  AlertTriangle,
  Search,
  Filter,
  FileDown,
  User,
  Users,
  CheckCircle2,
  HelpCircle,
  ArrowUpDown,
  Calendar,
  Layers,
  ChevronRight,
  Info,
  ExternalLink,
} from 'lucide-react';
import { CommercialDashboardDto } from '../types.ts';
import { exportClosedSalesToPdf } from '../exportCommercialPdf.ts';
import { useAuth } from '../../../context/AuthContext.tsx';
import { ContractDetailModal } from './ContractDetailModal.tsx';

interface ClosedSalesViewProps {
  dashboard: CommercialDashboardDto;
  salesRecords: any[];
  loadingRecords?: boolean;
  periodLabel?: string;
  onRefresh?: () => void;
  hideInactive?: boolean;
  hideThirdParty?: boolean;
  hideUnassigned?: boolean;
}

export const ClosedSalesView: React.FC<ClosedSalesViewProps> = ({
  dashboard,
  salesRecords,
  loadingRecords = false,
  periodLabel = 'Período Selecionado',
  hideInactive = false,
  hideThirdParty = false,
  hideUnassigned: propHideUnassigned,
}) => {
  const { user } = useAuth();
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortField, setSortField] = useState<'date' | 'monthlyValue' | 'clientName'>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);
  const [includeClientListInPdf, setIncludeClientListInPdf] = useState<boolean>(false);
  const [selectedContractForModal, setSelectedContractForModal] = useState<string | null>(null);

  // Controle de Ocultar / Mostrar "Não Atribuído"
  const [localHideUnassigned, setLocalHideUnassigned] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rbxhub_hide_unassigned_sales') === 'true';
    } catch {
      return false;
    }
  });

  const hideUnassigned = propHideUnassigned !== undefined ? propHideUnassigned : localHideUnassigned;
  const effectiveHideUnassigned = hideUnassigned;
  const effectiveHideInactive = hideInactive;
  const effectiveHideThirdParty = hideThirdParty;

  const handleToggleHideUnassigned = (val: boolean) => {
    setLocalHideUnassigned(val);
    try {
      localStorage.setItem('rbxhub_hide_unassigned_sales', String(val));
    } catch {
      // ignore
    }
    if (val && selectedSellerFilter === '__unassigned__') {
      setSelectedSellerFilter('all');
    }
  };

  const isUnassignedRecord = (r: any) => {
    const s = (r.seller || '').trim().toLowerCase();
    return !s || s === 'não atribuído' || s === 'nao atribuido' || s === 'sem vendedor';
  };

  const isResidualRecord = (r: any) => {
    const val = Number(r.monthlyValue) || 0;
    return val > 0 && val < 10.0;
  };

  // Identificação e agregação de vendas "Não Atribuído" (sempre calculado sobre a base total para auditoria)
  const unassignedSales = useMemo(() => {
    return salesRecords.filter(isUnassignedRecord);
  }, [salesRecords]);

  const unassignedTotalValue = useMemo(() => {
    return unassignedSales.reduce((acc, r) => acc + (Number(r.monthlyValue) || 0), 0);
  }, [unassignedSales]);

  // Identificação de contratos com valor residual (< R$ 10,00) para governança e auditoria
  const residualSales = useMemo(() => {
    return salesRecords.filter(isResidualRecord);
  }, [salesRecords]);

  const residualTotalValue = useMemo(() => {
    return residualSales.reduce((acc, r) => acc + (Number(r.monthlyValue) || 0), 0);
  }, [residualSales]);

  // Registros efetivos para cálculo de KPIs, performance e tabela (respeita filtros de auditoria)
  const effectiveRecords = useMemo(() => {
    let list = salesRecords;
    if (effectiveHideUnassigned) {
      list = list.filter((r) => !isUnassignedRecord(r));
    }
    if (effectiveHideInactive) {
      list = list.filter((r) => {
        const type = r.sellerType || dashboard.sellersClassification?.[(r.seller || '').trim()];
        return type !== 'inactive';
      });
    }
    if (effectiveHideThirdParty) {
      list = list.filter((r) => {
        const type = r.sellerType || dashboard.sellersClassification?.[(r.seller || '').trim()];
        return type !== 'third_party';
      });
    }
    // Validação estrita de tecnologia: apenas Fibra Óptica GPON
    list = list.filter((r) => {
      if (r.technology) {
        const norm = String(r.technology).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
        if (norm !== 'fibra optica gpon') return false;
      }
      return true;
    });
    return list;
  }, [salesRecords, effectiveHideUnassigned, effectiveHideInactive, effectiveHideThirdParty, dashboard.sellersClassification]);

  // 1. Métricas Globais de Vendas Fechadas (calculadas sobre os registros efetivos)
  const totalMonthly = useMemo(() => {
    return effectiveRecords.reduce((acc, r) => acc + (Number(r.monthlyValue) || 0), 0);
  }, [effectiveRecords]);

  const totalAdhesion = useMemo(() => {
    return effectiveRecords.reduce((acc, r) => acc + (Number(r.adhesionValue) || 0), 0);
  }, [effectiveRecords]);

  const totalContracts = effectiveRecords.length;
  const avgTicket = totalContracts > 0 ? totalMonthly / totalContracts : 0;
  const unassignedPercentage = salesRecords.length > 0 ? (unassignedSales.length / salesRecords.length) * 100 : 0;

  // Atendente destaque (maior faturamento)
  const topSellerHighlight = useMemo(() => {
    if (!dashboard.topSellers || dashboard.topSellers.length === 0) return null;
    return dashboard.topSellers.find(
      (s) => s.name.toLowerCase() !== 'não atribuído' && s.name.toLowerCase() !== 'nao atribuido'
    ) || dashboard.topSellers[0];
  }, [dashboard.topSellers]);

  // Agrupamento detalhado por atendente
  const sellersRanking = useMemo(() => {
    const map: Record<
      string,
      {
        name: string;
        count: number;
        monthlyValue: number;
        adhesionValue: number;
        ticketAverage: number;
        sharePercent: number;
        sellerType: 'active' | 'inactive' | 'third_party' | 'unassigned';
      }
    > = {};

    for (const r of effectiveRecords) {
      const rawName = (r.seller || 'Não atribuído').trim();
      if (!map[rawName]) {
        const resolvedType =
          r.sellerType ||
          dashboard.sellersClassification?.[rawName] ||
          (isUnassignedRecord(r) ? 'unassigned' : 'active');

        map[rawName] = {
          name: rawName,
          count: 0,
          monthlyValue: 0,
          adhesionValue: 0,
          ticketAverage: 0,
          sharePercent: 0,
          sellerType: resolvedType,
        };
      }
      map[rawName].count++;
      map[rawName].monthlyValue += Number(r.monthlyValue) || 0;
      map[rawName].adhesionValue += Number(r.adhesionValue) || 0;
    }

    return Object.values(map)
      .map((item) => ({
        ...item,
        ticketAverage: item.count > 0 ? item.monthlyValue / item.count : 0,
        sharePercent: totalMonthly > 0 ? (item.monthlyValue / totalMonthly) * 100 : 0,
      }))
      .sort((a, b) => b.monthlyValue - a.monthlyValue);
  }, [effectiveRecords, totalMonthly, dashboard.sellersClassification]);

  // Filtragem e ordenação da tabela de extrato
  const filteredRecords = useMemo(() => {
    return effectiveRecords.filter((r) => {
      // Filtro de vendedor selecionado
      if (selectedSellerFilter !== 'all') {
        const s = (r.seller || 'Não atribuído').trim().toLowerCase();
        if (selectedSellerFilter === '__unassigned__') {
          if (s !== 'não atribuído' && s !== 'nao atribuido' && s !== 'sem vendedor' && s !== '') {
            return false;
          }
        } else if (selectedSellerFilter === '__residual__') {
          if (!isResidualRecord(r)) {
            return false;
          }
        } else if (s !== selectedSellerFilter.toLowerCase()) {
          return false;
        }
      }

      // Busca textual
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const clientName = (r.name || '').toLowerCase();
        const contractNum = String(r.id || '').toLowerCase();
        const plan = (r.planDescription || r.detail || '').toLowerCase();
        const seller = (r.seller || '').toLowerCase();
        const channel = (r.salesChannel || '').toLowerCase();
        return (
          clientName.includes(term) ||
          contractNum.includes(term) ||
          plan.includes(term) ||
          seller.includes(term) ||
          channel.includes(term)
        );
      }

      return true;
    }).sort((a, b) => {
      if (sortField === 'date') {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        return sortAsc ? dateA - dateB : dateB - dateA;
      }
      if (sortField === 'monthlyValue') {
        const valA = Number(a.monthlyValue) || 0;
        const valB = Number(b.monthlyValue) || 0;
        return sortAsc ? valA - valB : valB - valA;
      }
      if (sortField === 'clientName') {
        const nameA = String(a.name || '').toLowerCase();
        const nameB = String(b.name || '').toLowerCase();
        return sortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }
      return 0;
    });
  }, [effectiveRecords, selectedSellerFilter, searchTerm, sortField, sortAsc]);

  const handleExportPdf = () => {
    try {
      setExportingPdf(true);
      exportClosedSalesToPdf({
        records: filteredRecords,
        user,
        periodLabel,
        totalMonthlyValue: totalMonthly,
        totalAdhesionValue: totalAdhesion,
        totalSalesCount: dashboard.kpis?.closedSalesCount || totalContracts,
        totalContractsCount: totalContracts,
        unassignedCount: unassignedSales.length,
        unassignedTotalValue: unassignedTotalValue,
        residualSalesCount: residualSales.length,
        residualTotalValue: residualTotalValue,
        sellersRanking: sellersRanking,
        topSellerHighlight: topSellerHighlight,
        timeSeries: dashboard.timeSeries,
        includeClientList: includeClientListInPdf,
        filters: {
          seller:
            selectedSellerFilter === 'all'
              ? undefined
              : selectedSellerFilter === '__unassigned__'
              ? 'Não Atribuído (Auditoria)'
              : selectedSellerFilter === '__residual__'
              ? 'Valor Residual (< R$ 10,00)'
              : selectedSellerFilter,
          search: searchTerm.trim() || undefined,
          hideUnassigned: effectiveHideUnassigned,
          hideInactive: effectiveHideInactive,
          hideThirdParty: effectiveHideThirdParty,
        },
      });
    } catch (err) {
      console.error('Erro ao gerar PDF de vendas fechadas:', err);
      alert('Ocorreu um erro ao gerar o relatório em PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Barra de Ações da Aba com Botão de Exportação PDF */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Award className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Relatório & Gestão de Vendas Fechadas
              </h3>
              <p className="text-xs text-slate-500">
                Contratos confirmados no período ({periodLabel}) com faturamento consolidado e performance por atendente
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 hover:text-slate-900 font-medium bg-slate-50 hover:bg-slate-100/80 px-3.5 py-2 rounded-xl border border-slate-200 transition shadow-2xs">
            <input
              type="checkbox"
              checked={includeClientListInPdf}
              onChange={(e) => setIncludeClientListInPdf(e.target.checked)}
              className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary cursor-pointer w-4 h-4"
            />
            <span>Incluir lista completa de clientes</span>
          </label>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exportingPdf || salesRecords.length === 0}
            className="px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:bg-[#002f9f] transition shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="w-4 h-4" />
            <span>{exportingPdf ? 'Gerando Relatório...' : 'Exportar Relatório PDF'}</span>
          </button>
        </div>
      </div>

      {/* 2. Faixa de KPIs no Topo */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${residualSales.length > 0 ? 'lg:grid-cols-3 xl:grid-cols-6' : 'lg:grid-cols-5'} gap-4`}>
        {/* Faturamento Mensal (MRR) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Receita Mensal (MRR)</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 tracking-tight">
            R$ {totalMonthly.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Faturamento recorrente adicionado</span>
          </div>
        </div>

        {/* Faturamento em Taxa de Adesão */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Total de Adesões</span>
            <span className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 tracking-tight">
            R$ {totalAdhesion.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            Taxas de ativação e instalação
          </div>
        </div>

        {/* Total de Contratos Fechados */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Contratos Fechados</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-brand-primary">
              <FileCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 tracking-tight">
            {totalContracts}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            Vendas confirmadas e assinadas
          </div>
        </div>

        {/* Ticket Médio Geral */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Ticket Médio Geral</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 tracking-tight">
            R$ {avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            Média por contrato fechado
          </div>
        </div>

        {/* Vendas Não Atribuídas (Auditoria) */}
        <div
          onClick={() => {
            if (hideUnassigned) {
              handleToggleHideUnassigned(false);
              setSelectedSellerFilter('__unassigned__');
            } else {
              setSelectedSellerFilter(selectedSellerFilter === '__unassigned__' ? 'all' : '__unassigned__');
            }
          }}
          className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            hideUnassigned
              ? 'bg-slate-50/80 border-slate-200 opacity-60 hover:opacity-100'
              : selectedSellerFilter === '__unassigned__'
              ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-400/40'
              : 'bg-white border-slate-200/90 hover:border-amber-200 hover:bg-amber-50/30'
          }`}
          title={hideUnassigned ? 'Ocultado da visão. Clique para reexibir e auditar' : 'Clique para filtrar apenas vendas sem vendedor associado'}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
              <span>Não Atribuídos</span>
              <span className={`w-1.5 h-1.5 rounded-full ${hideUnassigned ? 'bg-slate-400' : 'bg-amber-500'}`} />
            </span>
            <span className={`p-1.5 rounded-lg ${hideUnassigned ? 'bg-slate-200 text-slate-500' : 'bg-amber-100/70 text-amber-700'}`}>
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-bold text-amber-950 tracking-tight">
            {hideUnassigned ? (
              <span className="text-slate-400 text-sm font-semibold">
                Oculto <span className="text-xs font-normal">({unassignedSales.length})</span>
              </span>
            ) : (
              <>
                {unassignedSales.length}{' '}
                <span className="text-xs font-semibold text-amber-700">
                  ({unassignedPercentage.toFixed(1)}%)
                </span>
              </>
            )}
          </div>
          <div className="text-[11px] text-amber-800 font-medium mt-1">
            {hideUnassigned ? (
              <span className="text-slate-400">Subtraído dos indicadores</span>
            ) : (
              `R$ ${unassignedTotalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em auditoria`
            )}
          </div>
        </div>

        {/* 6. Contratos com Valor Residual (< R$ 10) (Auditoria e Governança) */}
        {residualSales.length > 0 && (
          <div
            onClick={() => {
              setSelectedSellerFilter(selectedSellerFilter === '__residual__' ? 'all' : '__residual__');
            }}
            className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
              selectedSellerFilter === '__residual__'
                ? 'bg-orange-50/95 border-orange-400 ring-2 ring-orange-400/40'
                : 'bg-white border-slate-200/90 hover:border-orange-300 hover:bg-orange-50/30'
            }`}
            title="Clique para auditar contratos com mensalidade inferior a R$ 10,00 (possível erro no desconto do RBXSoft)"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold text-orange-950 flex items-center gap-1.5">
                <span>Valor Residual (&lt; R$ 10)</span>
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              </span>
              <span className="p-1.5 rounded-lg bg-orange-100/80 text-orange-700">
                <AlertTriangle className="w-4 h-4" />
              </span>
            </div>
            <div className="text-xl font-bold text-orange-950 tracking-tight">
              {residualSales.length}{' '}
              <span className="text-xs font-semibold text-orange-700">
                {residualSales.length === 1 ? 'sob análise' : 'sob análise'}
              </span>
            </div>
            <div className="text-[11px] text-orange-800 font-medium mt-1 flex items-center justify-between">
              <span>R$ {residualTotalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} mensais</span>
              <span className="underline font-bold text-[10px]">
                {selectedSellerFilter === '__residual__' ? 'Remover' : 'Auditar'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Banner de Diagnóstico quando filtrando por Valor Residual */}
      {selectedSellerFilter === '__residual__' && residualSales.length > 0 && (
        <div className="bg-gradient-to-r from-orange-50/90 via-white to-orange-50/50 p-5 rounded-2xl border border-orange-300/80 shadow-2xs animate-in fade-in duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-orange-100 text-orange-800 mt-0.5 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Auditoria de Governança: Contratos com Valor Residual (&lt; R$ 10,00)</span>
                  <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold">
                    {residualSales.length} {residualSales.length === 1 ? 'contrato detectado' : 'contratos detectados'}
                  </span>
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                  Estes contratos possuem valor mensal positivo porém residual (ex: R$ 0,99). Geralmente decorrem de descontos fixos digitados com centavos a menos no RBXSoft (ex: desconto de R$ 109,00 sobre um plano de R$ 109,99 em pontos de órgãos públicos ou permutas). Ao ajustar o desconto no ERP para o valor integral, o contrato é automaticamente zerado no próximo sincronismo.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSellerFilter('all')}
              className="px-3 py-1.5 rounded-xl border border-orange-300 bg-white text-orange-800 hover:bg-orange-50 text-xs font-bold transition shrink-0 cursor-pointer self-start md:self-center"
            >
              Limpar Filtro
            </button>
          </div>
        </div>
      )}

      {/* 3. Card de Diagnóstico Explicativo de Vendas "Não Atribuído" */}
      {unassignedSales.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50/80 via-white to-amber-50/40 p-5 rounded-2xl border border-amber-200/80 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-800 mt-0.5 shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Diagnóstico de Auditoria: Vendas com Status "Não Atribuído"</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                    {unassignedSales.length} contratos
                  </span>
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed max-w-4xl">
                  Estes contratos foram emitidos e confirmados no <strong>RBXSoft</strong> sem que o atributo{' '}
                  <code className="px-1.5 py-0.5 rounded bg-amber-100/70 text-amber-900 font-mono text-[11px]">
                    Vendedor
                  </code>{' '}
                  tenha sido associado no momento do lançamento no ERP. Esse cenário ocorre frequentemente em:
                  vendas originadas via <strong>SAC ou Autoatendimento no Portal</strong>, migrações internas de tecnologia,
                  ou contratos criados diretamente no faturamento sem indicação de operador comercial.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (hideUnassigned) {
                    handleToggleHideUnassigned(false);
                  }
                  setSelectedSellerFilter(
                    selectedSellerFilter === '__unassigned__' ? 'all' : '__unassigned__'
                  );
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
                  selectedSellerFilter === '__unassigned__'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white border border-amber-300 text-amber-900 hover:bg-amber-100/60 shadow-2xs'
                }`}
              >
                <span>{selectedSellerFilter === '__unassigned__' ? 'Remover Filtro' : 'Auditar na Tabela'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {/* Seletor Discreto logo abaixo do botão Auditar Tabela */}
              <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-amber-900/90 hover:text-amber-950 font-medium bg-amber-100/40 hover:bg-amber-100/70 px-2.5 py-1 rounded-lg border border-amber-200/60 transition">
                <input
                  type="checkbox"
                  checked={hideUnassigned}
                  onChange={(e) => handleToggleHideUnassigned(e.target.checked)}
                  className="rounded border-amber-400 text-amber-600 focus:ring-amber-500 cursor-pointer w-3.5 h-3.5"
                />
                <span>Ocultar "Não Atribuído" dos dados</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* 4. Grid de Cards Executivos por Atendente */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-primary" />
            <h4 className="text-sm font-bold text-slate-900">Performance Individual por Atendente</h4>
            <span className="text-xs text-slate-500">
              ({sellersRanking.length} {sellersRanking.length === 1 ? 'profissional' : 'profissionais'} com vendas fechadas)
            </span>
            {hideUnassigned && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100/80 text-amber-900 border border-amber-200">
                Não Atribuídos Ocultados
              </span>
            )}
          </div>

          {selectedSellerFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedSellerFilter('all')}
              className="text-xs text-brand-primary hover:underline font-semibold cursor-pointer"
            >
              Limpar filtro de atendente (Ver Todos)
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sellersRanking.map((seller, idx) => {
            const isUnassigned =
              seller.name.toLowerCase() === 'não atribuído' ||
              seller.name.toLowerCase() === 'nao atribuido' ||
              seller.name.toLowerCase() === 'sem vendedor';

            const isSelected =
              (isUnassigned && selectedSellerFilter === '__unassigned__') ||
              (!isUnassigned && selectedSellerFilter.toLowerCase() === seller.name.toLowerCase());

            const sellerType =
              seller.sellerType ||
              dashboard.sellersClassification?.[seller.name] ||
              (isUnassigned ? 'unassigned' : 'active');

            const badgeColor =
              idx === 0
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : idx === 1
                ? 'bg-slate-200 text-slate-700 border-slate-300'
                : idx === 2
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : 'bg-slate-100 text-slate-600 border-slate-200';

            return (
              <div
                key={seller.name}
                onClick={() =>
                  setSelectedSellerFilter(
                    isSelected
                      ? 'all'
                      : isUnassigned
                      ? '__unassigned__'
                      : seller.name
                  )
                }
                className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs relative flex flex-col justify-between ${
                  isSelected
                    ? 'bg-blue-50/80 border-brand-primary ring-2 ring-brand-primary/30 shadow-xs'
                    : isUnassigned
                    ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300 hover:bg-amber-50/60'
                    : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="relative group/avatar">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs transition-all ${
                            sellerType === 'inactive'
                              ? 'bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs'
                              : sellerType === 'third_party'
                              ? 'bg-slate-200 text-slate-700 border border-slate-300 shadow-2xs'
                              : isUnassigned
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-brand-primary/10 text-brand-primary'
                          }`}
                        >
                          {sellerType === 'inactive' || sellerType === 'third_party' ? (
                            <Info className="w-4 h-4 shrink-0" />
                          ) : isUnassigned ? (
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                          ) : (
                            seller.name.slice(0, 2).toUpperCase()
                          )}
                        </div>

                        {/* Pop-up simples exibido no hover */}
                        {(sellerType === 'inactive' || sellerType === 'third_party') && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/avatar:flex flex-col items-center z-50 pointer-events-none drop-shadow-md animate-in fade-in zoom-in-95 duration-150">
                            <div className="bg-slate-900 text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap shadow-sm">
                              {sellerType === 'inactive' ? 'Ex-colaborador / Inativo' : 'Terceiros'}
                            </div>
                            <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1" />
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-xs font-bold text-slate-900 leading-tight">
                          {seller.name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {seller.count} {seller.count === 1 ? 'contrato' : 'contratos'}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}
                    >
                      #{idx + 1}
                    </span>
                  </div>

                  {/* Valores Financeiros */}
                  <div className="space-y-1.5 py-2 border-t border-b border-slate-100 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-[11px]">Total Vendido:</span>
                      <span className="font-bold text-slate-900 font-mono">
                        R$ {seller.monthlyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {seller.adhesionValue > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[11px]">Adesão:</span>
                        <span className="font-semibold text-teal-700 font-mono text-[11px]">
                          +R$ {seller.adhesionValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-[11px]">Ticket Médio:</span>
                      <span className="font-semibold text-slate-700 font-mono text-[11px]">
                        R$ {seller.ticketAverage.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Barra de Progresso de Participação */}
                <div className="mt-3 pt-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium mb-1">
                    <span>Participação</span>
                    <span className="font-bold text-slate-800">{seller.sharePercent.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isUnassigned ? 'bg-amber-400' : 'bg-brand-primary'
                      }`}
                      style={{ width: `${Math.min(seller.sharePercent, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Tabela de Extrato de Vendas Fechadas */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Extrato Analítico de Contratos Fechados</h4>
            <p className="text-xs text-slate-500">
              {filteredRecords.length} {filteredRecords.length === 1 ? 'contrato exibido' : 'contratos exibidos'}
              {selectedSellerFilter !== 'all' && (
                <span className="ml-1 font-semibold text-brand-primary">
                  • Filtrado por:{' '}
                  {selectedSellerFilter === '__unassigned__'
                    ? 'Não Atribuído'
                    : selectedSellerFilter === '__residual__'
                    ? 'Valor Residual (< R$ 10,00)'
                    : selectedSellerFilter}
                </span>
              )}
              {hideUnassigned && (
                <span className="ml-1 font-semibold text-amber-700">
                  • Não atribuídos ocultados ({unassignedSales.length})
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar contrato, cliente ou plano..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary bg-slate-50/50"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => {
                  if (sortField === 'date') setSortAsc(!sortAsc);
                  else {
                    setSortField('date');
                    setSortAsc(false);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  sortField === 'date'
                    ? 'bg-white shadow-2xs text-brand-primary font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Data
              </button>
              <button
                type="button"
                onClick={() => {
                  if (sortField === 'monthlyValue') setSortAsc(!sortAsc);
                  else {
                    setSortField('monthlyValue');
                    setSortAsc(false);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  sortField === 'monthlyValue'
                    ? 'bg-white shadow-2xs text-brand-primary font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Valor
              </button>
            </div>
          </div>
        </div>

        {/* Tabela de Vendas */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Contrato</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Plano Contratado</th>
                <th className="py-3 px-4">Atendente / Vendedor</th>
                <th className="py-3 px-4 text-right">Valor Mensal</th>
                <th className="py-3 px-4 text-right">Adesão</th>
                <th className="py-3 px-4">Assinatura</th>
                <th className="py-3 px-4">Canal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingRecords ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Carregando extrato de vendas...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Nenhum contrato encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((c) => {
                  const isUnassigned =
                    !c.seller ||
                    c.seller.toLowerCase() === 'não atribuído' ||
                    c.seller.toLowerCase() === 'nao atribuido' ||
                    c.seller.toLowerCase() === 'sem vendedor';

                  const formattedDate = c.date
                    ? c.date.slice(0, 10).split('-').reverse().join('/')
                    : '-';

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/80 transition-colors duration-100"
                    >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setSelectedContractForModal(String(c.id))}
                          className="font-mono font-bold text-brand-primary hover:text-blue-700 hover:underline inline-flex items-center gap-1 group cursor-pointer transition text-xs"
                          title="Clique para ver a ficha completa do contrato no RBXSoft"
                        >
                          <span>#{c.id}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-brand-primary opacity-60 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {c.name}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {c.planDescription || c.detail?.split('—')[0]?.trim() || 'Plano Padrão'}
                      </td>
                      <td className="py-3 px-4">
                        {isUnassigned ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100/80 text-amber-900 font-semibold text-[11px] border border-amber-200/80">
                            <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                            <span>Não Atribuído</span>
                          </span>
                        ) : (() => {
                          const sType =
                            c.sellerType ||
                            dashboard.sellersClassification?.[c.seller] ||
                            'active';
                          if (sType === 'inactive') {
                            return (
                              <span className="font-semibold text-slate-800 flex items-center gap-1.5" title="Ex-colaborador / Inativo">
                                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                <span>{c.seller}</span>
                                <span className="text-[10px] text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded font-medium border border-rose-200">
                                  Inativo
                                </span>
                              </span>
                            );
                          }
                          if (sType === 'third_party') {
                            return (
                              <span className="font-semibold text-slate-800 flex items-center gap-1.5" title="Terceiros">
                                <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                                <span>{c.seller}</span>
                                <span className="text-[10px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded font-medium border border-slate-200">
                                  Terceiros
                                </span>
                              </span>
                            );
                          }
                          return (
                            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                              <span>{c.seller}</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {isResidualRecord(c) ? (
                          <div className="flex flex-col items-end">
                            <span
                              className="text-orange-700 bg-orange-100/80 border border-orange-300/80 px-1.5 py-0.5 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-help"
                              title="Valor mensal inferior a R$ 10,00. Possível erro de centavos no desconto fixo do RBXSoft."
                            >
                              <AlertTriangle className="w-3 h-3 text-orange-600 shrink-0" />
                              <span>
                                R$ {(Number(c.monthlyValue) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </span>
                            <span className="text-[9px] text-orange-600 font-sans font-semibold mt-0.5">
                              Valor Residual (&lt; R$ 10)
                            </span>
                          </div>
                        ) : (
                          <span>
                            R$ {(Number(c.monthlyValue) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {c.adhesionValue && Number(c.adhesionValue) > 0 ? (
                          <span className="text-teal-700 font-semibold">
                            R$ {Number(c.adhesionValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-slate-400">R$ 0,00</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        {formattedDate}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {c.salesChannel || 'Direto'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Ficha Detalhada do Contrato */}
      <ContractDetailModal
        contractNumber={selectedContractForModal}
        onClose={() => setSelectedContractForModal(null)}
      />
    </div>
  );
};
