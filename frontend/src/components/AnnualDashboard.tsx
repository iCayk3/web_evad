import { useState, useEffect } from 'react';
import type { AnnualAnalyticsData } from '../types';
import { API_BASE } from '../config/api';
import { KPICards } from './KPICards';
import { BreakdownTable } from './BreakdownTable';
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
} from 'recharts';
import {
  Printer,
  Calendar,
  RefreshCw,
  TrendingUp,
  Layers,
  MapPin,
  CalendarDays,
  AlertCircle,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';

interface AnnualDashboardProps {
  initialYear?: string;
}

export function AnnualDashboard({ initialYear = '2026' }: AnnualDashboardProps) {
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [data, setData] = useState<AnnualAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'evolution' | 'cycle' | 'plan' | 'city' | 'all'>('evolution');

  const fetchAnnualData = async (year: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/analytics/annual?year=${year}`);
      if (!res.ok) throw new Error('Falha ao carregar dados anuais');
      const json: AnnualAnalyticsData = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados anuais');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnualData(selectedYear);
  }, [selectedYear]);

  useEffect(() => {
    setSelectedYear(initialYear);
  }, [initialYear]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Printable Header (Visible only when printing) */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              EVAD • Relatório Executivo Anual de Coortes e Retenção
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              ISP ERP Analytics • Sol Provedor de Internet • Exercício: <strong className="text-slate-900">{selectedYear}</strong>
            </p>
          </div>
          <div className="text-right text-[10px] text-slate-500">
            <div>Emissão: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</div>
            <div>Sistema: EVAD Intelligence v2.0</div>
          </div>
        </div>
      </div>

      {/* Control Bar (Hidden on print) */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs no-print">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-slate-100 rounded-md text-slate-700">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Consolidado & Evolução Anual ({selectedYear})</h2>
            <p className="text-xs text-slate-500">
              Trajetória acumulada das coortes, taxa de recuperação e desfechos anuais
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Year Selector */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none cursor-pointer"
            >
              {data?.availableYears && data.availableYears.length > 0 ? (
                data.availableYears.map((y) => (
                  <option key={y} value={y}>
                    Ano {y}
                  </option>
                ))
              ) : (
                <option value={selectedYear}>Ano {selectedYear}</option>
              )}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchAnnualData(selectedYear)}
            disabled={loading}
            className="p-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-md transition"
            title="Recarregar Dados Anuais"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Print PDF Button */}
          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-medium shadow-xs transition"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Imprimir Relatório Anual (PDF)</span>
          </button>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && !data && (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-500">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-400" />
          <p className="text-xs font-medium">Consolidando métricas e histórico anual...</p>
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
          {/* Annual Summary KPI Cards */}
          <KPICards data={data.summary} />

          {/* Navigation Sub-Tabs (Hidden on print) */}
          <div className="flex border-b border-slate-200 space-x-4 no-print text-xs">
            <button
              onClick={() => setActiveTab('evolution')}
              className={`py-2 px-1 border-b-2 font-medium flex items-center space-x-1.5 transition ${
                activeTab === 'evolution'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Evolução Mês a Mês (12 Meses)</span>
            </button>
            <button
              onClick={() => setActiveTab('cycle')}
              className={`py-2 px-1 border-b-2 font-medium flex items-center space-x-1.5 transition ${
                activeTab === 'cycle'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Consolidado por Ciclo</span>
            </button>
            <button
              onClick={() => setActiveTab('plan')}
              className={`py-2 px-1 border-b-2 font-medium flex items-center space-x-1.5 transition ${
                activeTab === 'plan'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Consolidado por Plano ({data.byPlan.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('city')}
              className={`py-2 px-1 border-b-2 font-medium flex items-center space-x-1.5 transition ${
                activeTab === 'city'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>Consolidado por Cidade ({data.byCity.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`py-2 px-1 border-b-2 font-medium flex items-center space-x-1.5 transition ${
                activeTab === 'all'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Visão Executiva Completa</span>
            </button>
          </div>

          {/* 1. Monthly Evolution Table (Jan to Dec) */}
          {(activeTab === 'evolution' || activeTab === 'all') && (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs break-inside-avoid">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
                    <span>Evolução Mensal das Coortes ({selectedYear})</span>
                    <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-normal">
                      12 Meses
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Acompanhamento temporal do volume de bloqueios, taxa de recuperação e churn acumulado
                  </p>
                </div>
              </div>

              {/* Annual Trend Chart (Composed Bars + Retention Rate Line) */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={(data?.monthlyEvolution || []).map((m) => ({
                        mes: m.monthLabel.split('/')[0],
                        fullLabel: m.monthLabel,
                        hasData: m.hasData,
                        bloqueados: m.totalBlocked,
                        recuperados: m.returnedCount,
                        suspensos: m.suspendedCount || 0,
                        churn: m.churnedCount,
                        taxaRetorno: m.hasData && m.totalBlocked > 0 ? m.returnedRate : null,
                      }))}
                      margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#475569' }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#475569' }} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: '#047857' }} unit="%" />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const item = payload[0].payload;
                            if (!item.hasData) {
                              return (
                                <div className="bg-slate-900 text-white text-xs rounded-lg p-2.5 shadow-lg">
                                  <p className="font-bold text-slate-100">{item.fullLabel}</p>
                                  <p className="text-slate-400 text-[11px] mt-1">Sem dados importados</p>
                                </div>
                              );
                            }
                            return (
                              <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl space-y-1 border border-slate-700">
                                <p className="font-bold text-slate-100">{item.fullLabel}</p>
                                <p className="text-slate-300">Bloqueados: <strong className="text-white">{item.bloqueados}</strong></p>
                                <p className="text-emerald-400 font-semibold">Recuperados: {item.recuperados} ({item.taxaRetorno}%)</p>
                                <p className="text-amber-400">Suspensos: {item.suspensos}</p>
                                <p className="text-rose-400">Churn: {item.churn}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar yAxisId="left" dataKey="bloqueados" name="Total Bloqueados" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="left" dataKey="recuperados" name="Voltaram à Base" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="taxaRetorno" name="Taxa de Retorno (%)" stroke="#047857" strokeWidth={2.5} dot={{ r: 3, fill: '#047857' }} connectNulls={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Mês</th>
                      <th className="py-3 px-3 text-right">Bloqueados</th>
                      <th className="py-3 px-3 text-right">MRR Bloqueado</th>
                      <th className="py-3 px-4 text-left">Recuperados (%)</th>
                      <th className="py-3 px-3 text-center">Suspensos</th>
                      <th className="py-3 px-3 text-center">Churn (C)</th>
                      <th className="py-3 px-3 text-right">Ainda Bloq.</th>
                      <th className="py-3 px-4 text-right">Dias Médios</th>
                      <th className="py-3 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.monthlyEvolution.map((m) => {
                      if (!m.hasData) {
                        return (
                          <tr key={m.monthKey} className="text-slate-300">
                            <td className="py-2.5 px-4 font-medium text-slate-400">{m.monthLabel}</td>
                            <td className="py-2.5 px-3 text-right">—</td>
                            <td className="py-2.5 px-3 text-right">—</td>
                            <td className="py-2.5 px-4 text-slate-400 text-xs italic">Sem coorte registrada</td>
                            <td className="py-2.5 px-3 text-center">—</td>
                            <td className="py-2.5 px-3 text-center">—</td>
                            <td className="py-2.5 px-3 text-right">—</td>
                            <td className="py-2.5 px-4 text-right">—</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="text-[10px] bg-slate-50 text-slate-400 px-2 py-0.5 rounded border border-slate-100">
                                Aguardando
                              </span>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={m.monthKey} className="hover:bg-slate-50/70 transition-colors font-medium">
                          <td className="py-2.5 px-4 text-slate-900 font-semibold flex items-center space-x-1.5">
                            <span>{m.monthLabel}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-800">
                            {m.totalBlocked.toLocaleString('pt-BR')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                            R$ {m.totalMrrBlocked.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-emerald-700 w-12 text-right">
                                {m.returnedRate.toFixed(1)}%
                              </span>
                              <div className="flex-1 min-w-[70px] bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-emerald-500 h-1.5 rounded-full"
                                  style={{ width: `${Math.min(100, Math.max(0, m.returnedRate))}%` }}
                                />
                              </div>
                              <span className="text-[11px] text-slate-400">
                                ({m.returnedCount})
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700">
                              {m.suspendedRate !== undefined ? m.suspendedRate.toFixed(1) : ((m.suspendedCount || 0) / (m.totalBlocked || 1) * 100).toFixed(1)}% ({m.suspendedCount || 0})
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700">
                              {m.churnRate.toFixed(1)}% ({m.churnedCount})
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-700">
                            {m.stillBlockedCount}
                          </td>
                          <td className="py-2.5 px-4 text-right text-slate-800 font-medium">
                            {m.avgDaysToReturn > 0 ? `${m.avgDaysToReturn.toFixed(1)} d` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center space-x-1 text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium border border-emerald-100">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Auditado</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100/90 border-t-2 border-slate-300 font-semibold text-slate-900 text-xs">
                      <td className="py-3 px-4">Total Anual ({selectedYear})</td>
                      <td className="py-3 px-3 text-right">{data.summary.totalBlocked.toLocaleString('pt-BR')}</td>
                      <td className="py-3 px-3 text-right font-mono">
                        R$ {data.summary.totalMrrBlocked.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-emerald-800 w-12 text-right">
                            {data.summary.returnedRate.toFixed(1)}%
                          </span>
                          <span className="text-slate-500 font-normal">
                            ({data.summary.returnedCount.toLocaleString('pt-BR')} clientes)
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-amber-800">
                        {data.summary.suspendedRate?.toFixed(1) ?? '0.0'}% ({data.summary.suspendedCount ?? 0})
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-rose-800">
                        {data.summary.churnRate.toFixed(1)}% ({data.summary.churnedCount})
                      </td>
                      <td className="py-3 px-3 text-right">{data.summary.stillBlockedCount}</td>
                      <td className="py-3 px-4 text-right">
                        {data.summary.avgDaysToReturn > 0 ? `${data.summary.avgDaysToReturn.toFixed(1)} d` : '—'}
                      </td>
                      <td className="py-3 px-3 text-center font-normal text-slate-400">Consolidado</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 2. Ciclos Anuais */}
          {(activeTab === 'cycle' || activeTab === 'all') && (
            <div className="space-y-3">
              <BreakdownTable
                title="Consolidado Anual por Ciclo de Vencimento"
                subtitle={`Distribuição dos bloqueios e recuperação nos Ciclos 10, 20 e 30 no ano de ${selectedYear}`}
                dimensionName="Ciclo de Faturamento"
                items={data.byCycle}
              />
            </div>
          )}

          {/* 3. Planos Anuais */}
          {(activeTab === 'plan' || activeTab === 'all') && (
            <div className="space-y-3">
              <BreakdownTable
                title="Consolidado Anual por Plano de Acesso"
                subtitle={`Ranking de planos por volume anual de bloqueios, MRR e efetividade de retenção em ${selectedYear}`}
                dimensionName="Plano"
                items={data.byPlan}
              />
            </div>
          )}

          {/* 4. Cidades Anuais */}
          {(activeTab === 'city' || activeTab === 'all') && (
            <div className="space-y-3">
              <BreakdownTable
                title="Consolidado Anual por Cidade / Praça"
                subtitle={`Comportamento de inadimplência e taxa de resolução por município em ${selectedYear}`}
                dimensionName="Cidade"
                items={data.byCity}
              />
            </div>
          )}

          {/* Printable Footer (Visible only when printing) */}
          <div className="hidden print:block pt-6 border-t border-slate-300 text-center text-[10px] text-slate-500">
            Relatório gerado automaticamente pelo EVAD • Inteligência de Retenção e Indicadores RBX • Confidencial
          </div>
        </>
      )}
    </div>
  );
}
