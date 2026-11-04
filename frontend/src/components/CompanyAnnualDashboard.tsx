import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  UserMinus,
  Activity,
  Calendar,
  RefreshCw,
  BarChart3,
  MapPin,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  FileText,
  DollarSign,
  Percent
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { API_BASE } from '../config/api';
import type { EmpresaVisaoAnualResponse, VisaoAnualMes } from '../types';

interface CompanyAnnualDashboardProps {
  initialYear?: string;
}

export const CompanyAnnualDashboard: React.FC<CompanyAnnualDashboardProps> = ({
  initialYear = '2026'
}) => {
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [data, setData] = useState<EmpresaVisaoAnualResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const loadData = useCallback(async (year: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/empresa/visao-anual?year=${year}`);
      if (!res.ok) {
        throw new Error('Falha ao carregar visão anual do banco de dados');
      }
      const json: EmpresaVisaoAnualResponse = await res.json();
      setData(json);
    } catch (err: any) {
      console.error('Erro na visão anual:', err);
      setError(err.message || 'Erro de conexão com o backend local');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(selectedYear);
  }, [selectedYear, loadData]);

  const kpis = data?.kpis;
  const meses = data?.meses || [];
  const topCidades = data?.topCidadesInstalacoes || [];
  const topCidadesSuspensos = data?.topCidadesSuspensos || [];
  const topCidadesCancelamentos = data?.topCidadesCancelamentos || [];
  const topMotivos = data?.topMotivosCancelamento || [];

  // Diagnóstico de saúde do provedor com base no Churn Médio Anual
  const getChurnHealth = (churn: number) => {
    if (churn <= 1.0) {
      return {
        label: 'Excelente (Fidelização Alta)',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        dot: 'bg-emerald-500',
        desc: 'Muito abaixo da média nacional de telecomunicações (1.8% a 2.5% a.m.). A base demonstra forte retenção.'
      };
    }
    if (churn <= 1.8) {
      return {
        label: 'Saudável (Dentro da Meta)',
        color: 'text-blue-700 bg-blue-50 border-blue-200',
        dot: 'bg-blue-500',
        desc: 'Alinhado com as boas práticas do setor para provedores regionais.'
      };
    }
    return {
      label: 'Atenção Necessária',
      color: 'text-amber-700 bg-amber-50 border-amber-200',
      dot: 'bg-amber-500',
      desc: 'Taxa acima do recomendado. Recomenda-se ações de retenção preventiva e revisão dos motivos de saída.'
    };
  };

  const churnHealth = getChurnHealth(kpis?.churnMedioAnual || 0);

  // Variação da base de contratos (Jan até Out)
  const baseInicial = meses.length > 0 ? meses[0].baseAtiva : 7849;
  const baseAtual = kpis?.baseAtual || 8252;
  const crescimentoAbsoluto = baseAtual - baseInicial;
  const crescimentoPercentual = baseInicial > 0 ? ((crescimentoAbsoluto / baseInicial) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Header do Painel de Saúde da Empresa */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-2.5 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl shadow-xs shrink-0">
            <Activity className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Saúde Operacional & KPIs Anuais ({selectedYear})
              </h2>
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                100% Banco Local (PostgreSQL)
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Evolução mês a mês das ativações, cancelamentos, retenção, inadimplência e crescimento líquido da base
            </p>
          </div>
        </div>

        {/* Controles de Ano e Recarregar */}
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer text-slate-800 font-bold"
            >
              <option value="2026">Ano 2026 (Consolidado)</option>
              <option value="2025">Ano 2025</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => loadData(selectedYear)}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition cursor-pointer"
            title="Recarregar indicadores anuais do banco"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
          {error}
        </div>
      )}

      {/* 2. Grid de KPIs Executivos Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Base de Contratos Ativos */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Base de Contratos Ativos
              </span>
              <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                <Users className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {loading ? '...' : (kpis?.baseAtual || 0).toLocaleString('pt-BR')}
              </span>
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                +{crescimentoPercentual}% no ano
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              <strong>{(kpis?.clientesUnicosAtuais || 0).toLocaleString('pt-BR')}</strong> clientes únicos (CPFs/CNPJs)
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 text-[11px]">
              Jan ({baseInicial}) → Out ({baseAtual})
            </span>
            <span className="font-bold text-emerald-700 text-[11px] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              +{crescimentoAbsoluto} novos
            </span>
          </div>
        </div>

        {/* KPI 2: Saldo Líquido Anual Acumulado (Instalações - Cancelados - Suspensos) */}
        {(() => {
          const saldoAnual = kpis?.saldoLiquidoAnual || 0;
          const isPos = saldoAnual >= 0;
          return (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Saldo Líquido Real ({selectedYear})
                  </span>
                  <div className={`p-2 rounded-lg ${isPos ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    {isPos ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </div>
                </div>

                <div className="mt-2 flex items-baseline gap-2">
                  <span className={`text-3xl font-black tracking-tight ${isPos ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {loading ? '...' : `${isPos ? '+' : ''}${saldoAnual.toLocaleString('pt-BR')}`}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {isPos ? 'adições líquidas' : 'retração líquida'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Instalações concl. − cancelamentos − suspensos
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px]">
                  Média mensal:
                </span>
                <strong className={`${isPos ? 'text-emerald-800' : 'text-rose-700'} text-[11px] font-bold`}>
                  {isPos ? '+' : ''}{(saldoAnual / (meses.length || 1)).toFixed(1)} / mês
                </strong>
              </div>
            </div>
          );
        })()}

        {/* KPI 3: Instalações vs Cancelamentos */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Ativações vs Rescisões
              </span>
              <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <div>
                <span className="text-2xl font-black text-blue-700 tracking-tight">
                  {loading ? '...' : (kpis?.totalInstalacoesAnual || 0).toLocaleString('pt-BR')}
                </span>
                <span className="block text-[10px] uppercase font-bold text-slate-400">Instalações</span>
              </div>
              <span className="text-slate-300 font-bold text-lg">/</span>
              <div>
                <span className="text-2xl font-black text-rose-600 tracking-tight">
                  {loading ? '...' : (kpis?.totalCancelamentosAnual || 0).toLocaleString('pt-BR')}
                </span>
                <span className="block text-[10px] uppercase font-bold text-slate-400">Cancelamentos</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-[11px]">
            <span className="text-slate-500">
              Proporção de Ganho:
            </span>
            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {kpis?.totalCancelamentosAnual && kpis.totalCancelamentosAnual > 0 
                ? `${((kpis.totalInstalacoesAnual / kpis.totalCancelamentosAnual)).toFixed(1)}x mais entradas`
                : 'Expansão total'}
            </span>
          </div>
        </div>

        {/* KPI 4: Taxa Média de Churn Mensal */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Taxa Média de Churn Mensal
              </span>
              <div className={`p-2 rounded-lg ${churnHealth.color}`}>
                <Percent className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {loading ? '...' : `${kpis?.churnMedioAnual || 0}%`}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                ao mês
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Retenção média da base: <strong className="text-slate-800">{kpis?.taxaRetencaoAnual || 0}%</strong>
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
              <span className={`w-2 h-2 rounded-full ${churnHealth.dot}`} />
              {churnHealth.label}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Indicadores Secundários: Contratos Suspensos e MRR Cancelado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Bloco 1: Contratos Suspensos (Banco Local) */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 shadow-2xs flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-600 text-white rounded-xl shadow-2xs shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-amber-950">
                  Total de Contratos Suspensos no Ano (Soma Geral)
                </h4>
                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                  Coortes Mensais
                </span>
              </div>
              <p className="text-xs text-amber-900/80 mt-1 leading-relaxed">
                Soma de <strong>{(kpis?.totalSuspensosAtual || 0).toLocaleString('pt-BR')}</strong> contratos que permanecem suspensos nas coortes de bloqueio ao longo de {selectedYear}
                {kpis?.mrrSuspensosTotal ? ` (${formatCurrency(kpis.mrrSuspensosTotal)} inadimplentes acumulados)` : ''}.
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-2xl font-black text-amber-900 block font-mono">
              {(kpis?.totalSuspensosAtual || 0).toLocaleString('pt-BR')}
            </span>
            <span className="text-[10px] uppercase font-bold text-amber-700">Soma Geral</span>
          </div>
        </div>

        {/* Bloco 2: Receita Recorrente Perdida em Churn (MRR) */}
        <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 shadow-2xs flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-2xs shrink-0 mt-0.5">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-950">
                Receita Recorrente Perdida em Cancelamentos (MRR)
              </h4>
              <p className="text-xs text-rose-900/80 mt-1 leading-relaxed">
                Total acumulado de <strong>{formatCurrency(kpis?.mrrCanceladoTotal || 0)}</strong> em mensalidades rescindidas ao longo do ano.
                A média mensal perdida foi de aproximadamente <strong>{formatCurrency((kpis?.mrrCanceladoTotal || 0) / (meses.length || 1))}</strong>/mês.
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-2xl font-black text-rose-900 block font-mono">
              {formatCurrency(kpis?.mrrCanceladoTotal || 0)}
            </span>
            <span className="text-[10px] uppercase font-bold text-rose-700">MRR Anual</span>
          </div>
        </div>
      </div>

      {/* 4. Gráficos Principais de Evolução e Crescimento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Instalações vs Cancelamentos vs Suspensos vs Saldo Líquido */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <span>Balanço Líquido (Instalações vs Cancelamentos vs Suspensos)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Comparativo mensal incluindo a sangria de contratos suspensos por inadimplência
              </p>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={meses}
                margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="mesLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as VisaoAnualMes;
                      const isPos = item.saldoLiquido >= 0;
                      return (
                        <div className="bg-slate-900 text-white text-xs rounded-xl p-3 shadow-lg border border-slate-800 space-y-1.5 min-w-[200px]">
                          <p className="font-bold text-slate-100 border-b border-slate-800 pb-1 flex items-center justify-between">
                            <span>{item.mesLabel}</span>
                            <span className="font-normal text-[10px] text-slate-400">Competência {item.mes}</span>
                          </p>
                          <div className="flex items-center justify-between text-blue-300">
                            <span>Instalações:</span>
                            <strong>{item.instalacoesSucesso}</strong>
                          </div>
                          <div className="flex items-center justify-between text-rose-300">
                            <span>Cancelamentos:</span>
                            <strong>{item.totalCancelamentos}</strong>
                          </div>
                          <div className="flex items-center justify-between text-amber-300">
                            <span>Suspensos:</span>
                            <strong>{item.totalSuspensos}</strong>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-800 font-bold">
                            <span className="text-slate-300">Saldo Líquido Real:</span>
                            <strong className={isPos ? 'text-emerald-400' : 'text-rose-400'}>
                              {isPos ? `+${item.saldoLiquido}` : item.saldoLiquido}
                            </strong>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend 
                  verticalAlign="top" 
                  align="right" 
                  wrapperStyle={{ fontSize: 11, paddingBottom: 10 }} 
                />
                <Bar 
                  dataKey="instalacoesSucesso" 
                  name="Instalações" 
                  fill="#3b82f6" 
                  radius={[4, 4, 0, 0]} 
                />
                <Bar 
                  dataKey="totalCancelamentos" 
                  name="Cancelamentos" 
                  fill="#f43f5e" 
                  radius={[4, 4, 0, 0]} 
                />
                <Bar 
                  dataKey="totalSuspensos" 
                  name="Suspensos" 
                  fill="#f59e0b" 
                  radius={[4, 4, 0, 0]} 
                />
                <Line 
                  type="monotone" 
                  dataKey="saldoLiquido" 
                  name="Saldo Líquido Real" 
                  stroke="#10b981" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#10b981' }} 
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Evolução da Base de Contratos Ativos */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Evolução da Base de Contratos Ativos</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Crescimento cumulativo da base ativa do provedor ao longo do ano de 2026
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
              +{crescimentoPercentual}% no ano
            </span>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={meses}
                margin={{ top: 10, right: 10, left: -5, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorBase" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="mesLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis domain={['dataMin - 300', 'dataMax + 200']} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as VisaoAnualMes;
                      return (
                        <div className="bg-slate-900 text-white text-xs rounded-xl p-3 shadow-lg border border-slate-800 space-y-1">
                          <p className="font-bold text-slate-100">{item.mesLabel} ({item.mes})</p>
                          <p className="text-emerald-300 font-bold text-sm">
                            {item.baseAtiva.toLocaleString('pt-BR')} Contratos Ativos
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Saldo no mês: +{item.saldoLiquido} contratos
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="baseAtiva" 
                  name="Contratos Ativos" 
                  stroke="#10b981" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorBase)" 
                  dot={{ r: 4, fill: '#10b981' }} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. Gráfico 3: Taxa de Churn Mensal (%) & MRR Cancelado */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-600" />
              <span>Taxa de Churn Mensal (%) e MRR Perdido</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Percentual de cancelamento sobre a base ativa e valor financeiro de mensalidades perdidas
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
            <span className="font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg">
              Tendência de Queda: 1.05% (Jan) → 0.20% (Out)
            </span>
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={meses}
              margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="mesLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                domain={[0, 1.5]} 
                tick={{ fontSize: 11, fill: '#e11d48' }} 
                unit="%" 
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload as VisaoAnualMes;
                    return (
                      <div className="bg-slate-900 text-white text-xs rounded-xl p-3 shadow-lg border border-slate-800 space-y-1.5 min-w-[180px]">
                        <p className="font-bold text-slate-100">{item.mesLabel}</p>
                        <div className="flex items-center justify-between text-rose-300 font-bold">
                          <span>Taxa de Churn:</span>
                          <span>{item.churnRate}%</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span>Rescisões:</span>
                          <span>{item.totalCancelamentos}</span>
                        </div>
                        <div className="flex items-center justify-between text-amber-300">
                          <span>MRR Perdido:</span>
                          <span>{formatCurrency(item.mrrCancelado)}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend 
                verticalAlign="top" 
                align="right" 
                wrapperStyle={{ fontSize: 11, paddingBottom: 10 }} 
              />
              <Bar 
                yAxisId="left" 
                dataKey="mrrCancelado" 
                name="MRR Perdido (R$)" 
                fill="#fecdd3" 
                radius={[4, 4, 0, 0]} 
              />
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="churnRate" 
                name="Taxa de Churn (%)" 
                stroke="#e11d48" 
                strokeWidth={2.5} 
                dot={{ r: 4, fill: '#e11d48' }} 
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 6. Rankings Geográficos por Praça: Instalações, Suspensos e Cancelamentos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Bloco 1: Top Cidades com Mais Instalações */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span>Top Cidades em Novas Instalações</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Praças que mais geraram novos clientes em {selectedYear}
                </p>
              </div>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Top 6 Praças
              </span>
            </div>

            <div className="space-y-3.5">
              {topCidades.map((c, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-800 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      {c.cidade}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[11px]">{c.percentual}%</span>
                      <strong className="text-blue-700 font-bold">{c.total} ativações</strong>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(c.percentual * 2.2, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bloco 2: Top Cidades em Contratos Suspensos */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Top Cidades em Contratos Suspensos</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Praças com maior inadimplência suspensa em {selectedYear}
                </p>
              </div>
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Top 6 Praças
              </span>
            </div>

            <div className="space-y-3.5">
              {topCidadesSuspensos.map((c, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-800 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      {c.cidade}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[11px]">{c.percentual}%</span>
                      <strong className="text-amber-700 font-bold">{c.total} suspensões</strong>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(c.percentual * 2.5, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bloco 3: Top Cidades em Cancelamentos */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <UserMinus className="w-4 h-4 text-rose-600" />
                  <span>Top Cidades em Cancelamentos</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Praças com maior volume de rescisões em {selectedYear}
                </p>
              </div>
              <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                Top 6 Praças
              </span>
            </div>

            <div className="space-y-3.5">
              {topCidadesCancelamentos.map((c, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-800 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      {c.cidade}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[11px]">{c.percentual}%</span>
                      <strong className="text-rose-700 font-bold">{c.total} rescisões</strong>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-rose-500 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(c.percentual * 2.5, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 6.1 Principais Motivos de Cancelamento */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-700" />
              <span>Principais Motivos de Cancelamento no Ano</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Causas registradas no RBX das {kpis?.totalCancelamentosAnual || 482} rescisões de contrato
            </p>
          </div>
          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            Top 6 Motivos
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3.5">
          {topMotivos.map((m, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-800 flex items-center gap-2 truncate">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                    #{idx + 1}
                  </span>
                  <span className="truncate" title={m.motivo}>{m.motivo}</span>
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-500 text-[11px]">{m.percentual}%</span>
                  <strong className="text-slate-700 font-bold">{m.total} rescisões</strong>
                </div>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-slate-600 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(m.percentual * 2.5, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 7. Tabela Analítica Consolidada Mês a Mês */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-700" />
              <span>Demonstrativo Mensal de Performance (Ano {selectedYear})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Auditoria dos números consolidados direto do banco de dados local
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Competência</th>
                <th className="py-3 px-4 text-center">Instalações</th>
                <th className="py-3 px-4 text-center">Suspensos</th>
                <th className="py-3 px-4 text-center">Cancelamentos</th>
                <th className="py-3 px-4 text-center">Saldo Líquido Real</th>
                <th className="py-3 px-4 text-center">Base Ativa</th>
                <th className="py-3 px-4 text-center">Taxa de Churn</th>
                <th className="py-3 px-4 text-right">MRR Cancelado</th>
                <th className="py-3 px-4 text-center">Diagnóstico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {meses.map((m) => {
                const isPos = m.saldoLiquido >= 0;
                return (
                  <tr key={m.mes} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                      {m.mesLabel} <span className="text-slate-400 font-normal text-[10px]">({m.mes})</span>
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-blue-700">
                      {m.instalacoesSucesso}
                    </td>
                    <td className="py-3 px-4 text-center font-medium text-amber-800 font-mono">
                      {m.totalSuspensos.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-rose-600">
                      {m.totalCancelamentos}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[11px] ${
                        isPos ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}>
                        {isPos ? `+${m.saldoLiquido}` : m.saldoLiquido}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800 font-mono">
                      {m.baseAtiva.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-slate-700">
                      {m.churnRate}%
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-700 font-mono">
                      {formatCurrency(m.mrrCancelado)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {m.saldoLiquido >= 40 ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Forte Expansão
                        </span>
                      ) : m.saldoLiquido > 0 ? (
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          Crescimento Moderado
                        </span>
                      ) : m.saldoLiquido === 0 ? (
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          Estável (Neutro)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          Retração Líquida
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Linha de Totais / Médias no Rodapé */}
            <tfoot>
              <tr className="bg-slate-100/80 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
                <td className="py-3 px-4 uppercase text-[11px] tracking-wider">
                  Total / Média ({selectedYear})
                </td>
                <td className="py-3 px-4 text-center text-blue-800">
                  {kpis?.totalInstalacoesAnual}
                </td>
                <td className="py-3 px-4 text-center text-amber-900 font-mono">
                  {kpis?.totalSuspensosAtual.toLocaleString('pt-BR')}
                </td>
                <td className="py-3 px-4 text-center text-rose-700">
                  {kpis?.totalCancelamentosAnual}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                    (kpis?.saldoLiquidoAnual || 0) >= 0 ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                  }`}>
                    {(kpis?.saldoLiquidoAnual || 0) >= 0 ? `+${kpis?.saldoLiquidoAnual}` : kpis?.saldoLiquidoAnual}
                  </span>
                </td>
                <td className="py-3 px-4 text-center font-mono">
                  {kpis?.baseAtual.toLocaleString('pt-BR')} (Atual)
                </td>
                <td className="py-3 px-4 text-center text-slate-800">
                  {kpis?.churnMedioAnual}% (Méd)
                </td>
                <td className="py-3 px-4 text-right font-mono text-slate-900">
                  {formatCurrency(kpis?.mrrCanceladoTotal || 0)}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                    (kpis?.saldoLiquidoAnual || 0) >= 0 ? 'text-emerald-800 bg-emerald-100' : 'text-amber-800 bg-amber-100'
                  }`}>
                    {(kpis?.saldoLiquidoAnual || 0) >= 0 ? 'Saúde Ótima' : 'Alerta Sangria'}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
