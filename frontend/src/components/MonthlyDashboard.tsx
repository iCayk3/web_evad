import { useState, useEffect } from 'react';
import type { MonthlyAnalyticsData } from '../types';
import { API_BASE } from '../config/api';
import { KPICards } from './KPICards';
import { BreakdownTable } from './BreakdownTable';
import { ExecutiveDecisionCharts } from './ExecutiveDecisionCharts';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Printer, Calendar, RefreshCw, Layers, MapPin, CalendarDays, BarChart3, AlertCircle, FileText, X, Compass } from 'lucide-react';
import { ExecutivePrintReport } from './ExecutivePrintReport';

interface MonthlyDashboardProps {
  initialMonth?: string;
  viewMode?: 'pure' | 'all';
  onMonthChange?: (month: string) => void;
}

const MONTH_NAMES: Record<string, string> = {
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

function formatMonthLabel(key: string): string {
  const parts = key.split('-');
  if (parts.length === 2 && MONTH_NAMES[parts[1]]) {
    return `${MONTH_NAMES[parts[1]]} / ${parts[0]}`;
  }
  return key;
}

export function MonthlyDashboard({ initialMonth = '2026-01', viewMode = 'pure', onMonthChange }: MonthlyDashboardProps) {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [data, setData] = useState<MonthlyAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'cycle' | 'plan' | 'city' | 'neighborhood'>('all');

  const fetchMonthlyData = async (month: string, mode: 'pure' | 'all' = viewMode) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/analytics/monthly?month=${month}&view=${mode}`);
      if (!res.ok) throw new Error('Falha ao carregar dados analíticos mensais');
      const json: MonthlyAnalyticsData = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados mensais');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyData(selectedMonth, viewMode);
  }, [selectedMonth, viewMode]);

  useEffect(() => {
    setSelectedMonth(initialMonth);
  }, [initialMonth]);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handleMonthSelect = (m: string) => {
    setSelectedMonth(m);
    if (onMonthChange) onMonthChange(m);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      {/* 1. Folha Executiva Exclusiva para Impressão A4 (Renderiza APENAS no Print) */}
      <div className="hidden print:block">
        {data && <ExecutivePrintReport data={data} selectedMonth={selectedMonth} />}
      </div>

      {/* 2. Conteúdo Interativo em Tela (Ocultado no Print) */}
      <div className="space-y-6 print:hidden">
        {/* Control Bar */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs no-print">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-100 rounded-md text-slate-700">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Dashboard & KPIs Mensais</h2>
              <p className="text-xs text-slate-500">
                Desempenho da coorte de {data?.monthLabel || selectedMonth} segmentado por plano, cidade e vencimento
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            {/* Month Selector */}
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthSelect(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none cursor-pointer"
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

            {/* Refresh Button */}
            <button
              onClick={() => fetchMonthlyData(selectedMonth)}
              disabled={loading}
              className="p-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-md transition cursor-pointer"
              title="Recarregar Indicadores"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Preview Button */}
            <button
              onClick={() => setIsPreviewOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-medium transition cursor-pointer shadow-2xs"
              title="Visualizar a folha de impressão executiva A4"
            >
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              <span>Prévia Executiva</span>
            </button>

            {/* Print PDF Button */}
            <button
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold shadow-xs transition cursor-pointer"
              title="Imprimir ou Salvar em PDF na folha A4 executiva"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir Relatório (PDF)</span>
            </button>
          </div>
        </div>

      {/* Loading & Error States */}
      {loading && !data && (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-500">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-400" />
          <p className="text-xs font-medium">Carregando métricas e segmentações...</p>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg flex items-center space-x-2 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {data && (
        <>
          {/* Executive KPI Cards */}
          <KPICards data={data.summary} />

          {/* Central de Gráficos e Tomada de Decisão Executiva */}
          <ExecutiveDecisionCharts data={data.summary} />

          {/* View Tab Filter (Hidden on print) */}
          <div className="flex border-b border-slate-200 space-x-4 no-print text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`py-2 px-1 border-b-2 font-medium flex items-center space-x-1.5 transition ${
                activeTab === 'all'
                  ? 'border-slate-900 text-slate-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Visão Completa</span>
            </button>
            <button
              onClick={() => setActiveTab('cycle')}
              className={`py-2 px-1 border-b-2 font-medium flex items-center space-x-1.5 transition ${
                activeTab === 'cycle'
                  ? 'border-slate-900 text-slate-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Por Vencimento / Ciclo ({data.byCycle.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('plan')}
              className={`py-2 px-1 border-b-2 font-medium flex items-center space-x-1.5 transition ${
                activeTab === 'plan'
                  ? 'border-slate-900 text-slate-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Por Plano de Acesso ({data.byPlan.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('city')}
              className={`py-2 px-1 border-b-2 font-medium flex items-center space-x-1.5 transition ${
                activeTab === 'city'
                  ? 'border-slate-900 text-slate-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>Por Cidade ({data.byCity.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('neighborhood')}
              className={`py-2 px-1 border-b-2 font-medium flex items-center space-x-1.5 transition ${
                activeTab === 'neighborhood'
                  ? 'border-slate-900 text-slate-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              <span>Por Bairro / Vila ({data.byNeighborhood?.length || 0})</span>
            </button>
          </div>

          {/* 1. Ciclos de Vencimento */}
          {(activeTab === 'all' || activeTab === 'cycle') && (
            <div className="space-y-4">
              {activeTab === 'cycle' && data.byCycle.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                  <h4 className="text-xs font-bold text-slate-900 mb-0.5">
                    Comparativo Visual por Ciclo de Vencimento
                  </h4>
                  <p className="text-[11px] text-slate-500 mb-3">
                    Volume de clientes bloqueados vs recuperados e inadimplentes por ciclo de cobrança
                  </p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.byCycle.map((c) => ({
                          name: c.name.replace(' (Venc. Dia ', ' (Dia ').replace(')', ')'),
                          fullName: c.name,
                          total: c.totalBlocked,
                          voltaram: c.returnedCount,
                          suspensos: c.suspendedCount,
                          rate: c.returnedRate,
                          mrr: c.totalMrr,
                        }))}
                        margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#334155' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const item = payload[0].payload;
                              return (
                                <div className="bg-slate-900 text-white text-xs rounded-lg p-2.5 shadow-xl space-y-1">
                                  <p className="font-bold text-slate-100">{item.fullName}</p>
                                  <p className="text-slate-300">Total Bloqueados: <strong className="text-white">{item.total}</strong></p>
                                  <p className="text-emerald-400 font-semibold">Voltaram: {item.voltaram} ({item.rate}%)</p>
                                  <p className="text-amber-400">Suspensos: {item.suspensos}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar dataKey="total" name="Total Bloqueados" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="voltaram" name="Voltaram à Base" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="suspensos" name="Ainda Suspensos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <BreakdownTable
                title="Desempenho por Ciclo de Vencimento"
                subtitle="Análise dos ciclos de faturamento da empresa (Ciclo 10, Ciclo 20 e Ciclo 30)"
                dimensionName="Ciclo de Faturamento"
                items={data.byCycle}
              />
            </div>
          )}

          {/* 2. Planos de Acesso */}
          {(activeTab === 'all' || activeTab === 'plan') && (
            <div className="space-y-4">
              {activeTab === 'plan' && data.byPlan.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                  <h4 className="text-xs font-bold text-slate-900 mb-0.5">
                    Top 6 Planos Mais Impactados por Bloqueio
                  </h4>
                  <p className="text-[11px] text-slate-500 mb-3">
                    Volume e taxa de regularização por velocidade / tecnologia de plano
                  </p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.byPlan.slice(0, 6).map((p) => ({
                          name: p.name.length > 15 ? p.name.substring(0, 14) + '…' : p.name,
                          fullName: p.name,
                          total: p.totalBlocked,
                          voltaram: p.returnedCount,
                          suspensos: p.suspendedCount,
                          rate: p.returnedRate,
                        }))}
                        margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#334155' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const item = payload[0].payload;
                              return (
                                <div className="bg-slate-900 text-white text-xs rounded-lg p-2.5 shadow-xl space-y-1">
                                  <p className="font-bold text-slate-100">{item.fullName}</p>
                                  <p className="text-slate-300">Total Bloqueados: <strong className="text-white">{item.total}</strong></p>
                                  <p className="text-emerald-400 font-semibold">Voltaram: {item.voltaram} ({item.rate}%)</p>
                                  <p className="text-amber-400">Suspensos: {item.suspensos}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar dataKey="total" name="Total Bloqueados" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="voltaram" name="Voltaram à Base" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="suspensos" name="Ainda Suspensos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <BreakdownTable
                title="Desempenho por Plano de Acesso"
                subtitle="Volume de bloqueios, MRR e taxa de retenção por velocidade / tecnologia de plano"
                dimensionName="Plano"
                items={data.byPlan}
              />
            </div>
          )}

          {/* 3. Cidades / Praças */}
          {(activeTab === 'all' || activeTab === 'city') && (
            <div className="space-y-4">
              {activeTab === 'city' && data.byCity.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                  <h4 className="text-xs font-bold text-slate-900 mb-0.5">
                    Top 6 Cidades com Mais Bloqueios
                  </h4>
                  <p className="text-[11px] text-slate-500 mb-3">
                    Volume e taxa de regularização por praça de operação geográfica
                  </p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.byCity.slice(0, 6).map((c) => ({
                          name: c.name.toLowerCase().includes('boa vista') ? 'Boa Vista (Distrito)' : (c.name.length > 15 ? c.name.substring(0, 14) + '…' : c.name),
                          fullName: c.name.toLowerCase().includes('boa vista') ? 'Boa Vista (Distrito de Quatipuru)' : c.name,
                          total: c.totalBlocked,
                          voltaram: c.returnedCount,
                          suspensos: c.suspendedCount,
                          rate: c.returnedRate,
                        }))}
                        margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#334155' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const item = payload[0].payload;
                              return (
                                <div className="bg-slate-900 text-white text-xs rounded-lg p-2.5 shadow-xl space-y-1">
                                  <p className="font-bold text-slate-100">{item.fullName}</p>
                                  <p className="text-slate-300">Total Bloqueados: <strong className="text-white">{item.total}</strong></p>
                                  <p className="text-emerald-400 font-semibold">Voltaram: {item.voltaram} ({item.rate}%)</p>
                                  <p className="text-amber-400">Suspensos: {item.suspensos}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar dataKey="total" name="Total Bloqueados" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="voltaram" name="Voltaram à Base" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="suspensos" name="Ainda Suspensos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <BreakdownTable
                title="Desempenho por Cidade / Praça de Operação"
                subtitle="Eficiência de recuperação de carteira e churn distribuído por localidade geográfica"
                dimensionName="Cidade"
                items={data.byCity}
              />
            </div>
          )}

          {/* 4. Bairros / Vilas */}
          {(activeTab === 'all' || activeTab === 'neighborhood') && (
            <div className="space-y-4">
              <BreakdownTable
                title="Desempenho por Bairro / Vila"
                subtitle="Comportamento da carteira, inadimplência e taxa de recuperação detalhada por bairro/vila e cidade"
                dimensionName="Bairro / Vila"
                items={data.byNeighborhood || []}
              />
            </div>
          )}
        </>
      )}
      </div>

      {/* 3. Modal de Pré-visualização da Folha A4 Executiva */}
      {isPreviewOpen && data && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto no-print">
          <div className="bg-slate-100 rounded-xl max-w-4xl w-full max-h-[95vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-sky-400" />
                <span className="text-sm font-bold">Prévia da Folha A4 • Relatório Executivo de Inadimplência & Recuperação</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Imprimir Agora (PDF)</span>
                </button>
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition cursor-pointer"
                  title="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - Sheet View simulating actual A4 Paper */}
            <div className="p-3 sm:p-6 overflow-y-auto flex justify-center bg-slate-300/80">
              <div className="bg-white shadow-2xl rounded-sm max-w-[780px] w-full border border-slate-300 transform transition">
                <ExecutivePrintReport data={data} selectedMonth={selectedMonth} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
