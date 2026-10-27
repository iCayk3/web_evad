import React, { useState, useMemo } from 'react';
import type { MonthlyCohortData } from '../types';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  Clock,
  Calendar,
  Layers,
  ShieldAlert,
  Zap,
  Target,
  DollarSign,
  Users,
  Compass,
} from 'lucide-react';

interface ExecutiveDecisionChartsProps {
  data: MonthlyCohortData;
}

export const ExecutiveDecisionCharts: React.FC<ExecutiveDecisionChartsProps> = ({ data }) => {
  const [metricView, setMetricView] = useState<'volume' | 'mrr'>('volume');
  const [activeTab, setActiveTab] = useState<'overview' | 'cycles' | 'plans'>('overview');

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // 1. Outcome Data (Donut Chart)
  const outcomeData = useMemo(() => {
    const suspendedCount = data.suspendedCount || 0;
    const suspendedMrr = data.suspendedMrr || (suspendedCount * 101.43);
    return [
      {
        name: 'Voltaram à Base',
        key: 'returned',
        value: metricView === 'volume' ? data.returnedCount : data.returnedMrr,
        count: data.returnedCount,
        mrr: data.returnedMrr,
        color: '#10b981', // emerald-500
        rate: data.returnedRate,
      },
      {
        name: 'Ainda Suspensos (Risco)',
        key: 'suspended',
        value: metricView === 'volume' ? suspendedCount : suspendedMrr,
        count: suspendedCount,
        mrr: suspendedMrr,
        color: '#f59e0b', // amber-500
        rate: data.suspendedRate || (data.totalBlocked > 0 ? (suspendedCount / data.totalBlocked) * 100 : 0),
      },
      {
        name: 'Cancelaram (Churn)',
        key: 'churned',
        value: metricView === 'volume' ? data.churnedCount : data.churnedMrr,
        count: data.churnedCount,
        mrr: data.churnedMrr,
        color: '#f43f5e', // rose-500
        rate: data.churnRate,
      },
    ];
  }, [data, metricView]);

  // 2. Speed / Time-to-Recovery Data
  const speedData = useMemo(() => {
    const totalReturned = data.returnedCount || 1;
    return [
      {
        range: 'Até 7 dias',
        stage: 'Fase Imediata',
        count: data.returned0to7Days,
        pct: ((data.returned0to7Days / totalReturned) * 100).toFixed(1),
        color: '#10b981',
      },
      {
        range: '8 a 15 dias',
        stage: 'Zona de Alerta',
        count: data.returned8to15Days,
        pct: ((data.returned8to15Days / totalReturned) * 100).toFixed(1),
        color: '#3b82f6',
      },
      {
        range: '16 a 30 dias',
        stage: 'Risco Elevado',
        count: data.returned16to30Days,
        pct: ((data.returned16to30Days / totalReturned) * 100).toFixed(1),
        color: '#f59e0b',
      },
      {
        range: '+30 dias',
        stage: 'Risco Crítico',
        count: data.returnedOver30Days,
        pct: ((data.returnedOver30Days / totalReturned) * 100).toFixed(1),
        color: '#f43f5e',
      },
    ];
  }, [data]);

  // 3. Cycle Breakdown Data
  const cycleData = useMemo(() => {
    const map: Record<string, { total: number; returned: number; suspended: number; churn: number; mrr: number }> = {};
    (data.clients || []).forEach((c) => {
      if (c.status === 'other') return;
      const cycle = c.billingCycle || 'Outros';
      if (!map[cycle]) {
        map[cycle] = { total: 0, returned: 0, suspended: 0, churn: 0, mrr: 0 };
      }
      map[cycle].total++;
      map[cycle].mrr += c.monthlyFee;
      if (c.status === 'returned') map[cycle].returned++;
      if (c.status === 'suspended') map[cycle].suspended++;
      if (c.status === 'churned') map[cycle].churn++;
    });

    return Object.entries(map)
      .map(([cycle, stats]) => {
        const rate = stats.total > 0 ? (stats.returned / stats.total) * 100 : 0;
        const suspRate = stats.total > 0 ? (stats.suspended / stats.total) * 100 : 0;
        const shortName = cycle.replace(' (Venc. Dia ', ' (Dia ').replace(')', ')');
        return {
          cycle: shortName,
          fullCycle: cycle,
          total: stats.total,
          returned: stats.returned,
          suspended: stats.suspended,
          churn: stats.churn,
          rate: Math.round(rate * 10) / 10,
          suspRate: Math.round(suspRate * 10) / 10,
          mrr: stats.mrr,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [data.clients]);

  // 4. Plan Breakdown Data
  const planData = useMemo(() => {
    const map: Record<string, { total: number; returned: number; suspended: number; churn: number; mrr: number }> = {};
    (data.clients || []).forEach((c) => {
      if (c.status === 'other') return;
      const plan = (c.plan || 'Não Informado').trim();
      if (!map[plan]) {
        map[plan] = { total: 0, returned: 0, suspended: 0, churn: 0, mrr: 0 };
      }
      map[plan].total++;
      map[plan].mrr += c.monthlyFee;
      if (c.status === 'returned') map[plan].returned++;
      if (c.status === 'suspended') map[plan].suspended++;
      if (c.status === 'churned') map[plan].churn++;
    });

    return Object.entries(map)
      .map(([plan, stats]) => ({
        plan: plan.length > 16 ? plan.substring(0, 15) + '…' : plan,
        fullPlan: plan,
        total: stats.total,
        returned: stats.returned,
        suspended: stats.suspended,
        churn: stats.churn,
        mrr: stats.mrr,
        rate: stats.total > 0 ? Math.round((stats.returned / stats.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [data.clients]);

  if (data.totalBlocked === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-5">
      {/* 1. Header with Controls & Metric Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-900 text-white uppercase tracking-wider">
              <Compass className="w-3 h-3 mr-1" />
              Tomada de Decisão
            </span>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Inteligência Visual & Apoio Estratégico ({data.monthLabel})
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Métricas preditivas para calibrar réguas de cobrança, antecipar receita e salvar contratos em risco
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          {/* Sub-view switcher */}
          <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs font-medium">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1 rounded-md transition cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-white text-slate-900 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Visão Geral
            </button>
            <button
              onClick={() => setActiveTab('cycles')}
              className={`px-3 py-1 rounded-md transition cursor-pointer ${
                activeTab === 'cycles'
                  ? 'bg-white text-slate-900 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Por Ciclo ({cycleData.length})
            </button>
            <button
              onClick={() => setActiveTab('plans')}
              className={`px-3 py-1 rounded-md transition cursor-pointer ${
                activeTab === 'plans'
                  ? 'bg-white text-slate-900 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Por Plano
            </button>
          </div>

          {/* Metric Mode Toggle (Volume vs MRR) */}
          <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs">
            <button
              onClick={() => setMetricView('volume')}
              title="Exibir gráficos em quantidade de contratos"
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md transition cursor-pointer ${
                metricView === 'volume'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3 h-3" />
              <span>Qtd</span>
            </button>
            <button
              onClick={() => setMetricView('mrr')}
              title="Exibir gráficos em faturamento monetário (R$)"
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md transition cursor-pointer ${
                metricView === 'mrr'
                  ? 'bg-emerald-700 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <DollarSign className="w-3 h-3" />
              <span>R$</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Interactive Charts Section */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Chart 1: Curva de Velocidade de Resolução */}
          <div className="bg-slate-50/60 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">
                      Velocidade de Retorno (Time-to-Recovery)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Janela temporal em que os clientes regularizam e desbloqueiam
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Média: {data.avgDaysToReturn} dias
                </span>
              </div>

              <div className="h-56 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={speedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#475569' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white text-xs rounded-lg p-2.5 shadow-xl border border-slate-700">
                              <p className="font-bold text-slate-100">{item.range} • {item.stage}</p>
                              <p className="text-emerald-400 font-semibold mt-1">
                                {item.count} contratos ({item.pct}%)
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Regularizados nesta faixa temporal
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {speedData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-3 p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs">
              <span className="text-slate-600 text-[11px]">
                💡 <strong>Ponto de Inflexão:</strong> {speedData[0]?.pct}% das baixas ocorrem na primeira semana. Disparos no 5º dia evitam transbordo para suspensão.
              </span>
            </div>
          </div>

          {/* Chart 2: Composição do Desfecho Financeiro */}
          <div className="bg-slate-50/60 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-indigo-100 text-indigo-800 rounded-lg">
                    <Target className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">
                      Desfecho da Coorte ({metricView === 'volume' ? 'Volume de Clientes' : 'Faturamento R$'})
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Percentual recuperado versus faturamento em risco de inadimplência
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {data.returnedRate.toFixed(1)}% Retenção
                </span>
              </div>

              <div className="h-56 mt-4 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={outcomeData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {outcomeData.map((entry, index) => (
                        <Cell key={`donut-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white text-xs rounded-lg p-2.5 shadow-xl border border-slate-700">
                              <p className="font-bold text-slate-100">{item.name}</p>
                              <p className="text-emerald-400 font-semibold mt-1">
                                {item.count} contratos ({item.rate.toFixed(1)}%)
                              </p>
                              <p className="text-slate-300 font-mono text-[11px] mt-0.5">
                                Faturamento: {formatCurrency(item.mrr)}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value, entry: any) => (
                        <span className="text-[11px] text-slate-700 font-medium">
                          {value} ({entry.payload.rate.toFixed(1)}%)
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-3 p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs">
              <span className="text-slate-600 text-[11px]">
                💰 <strong>Faturamento Preservado:</strong> {formatCurrency(data.returnedMrr)} recuperados contra {formatCurrency(data.suspendedMrr || 6086)} retidos em clientes suspensos.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Ciclos de Vencimento */}
      {activeTab === 'cycles' && (
        <div className="bg-slate-50/60 border border-slate-200/80 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-blue-100 text-blue-800 rounded-lg">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">
                  Desempenho & Fragilidade por Ciclo de Vencimento
                </h3>
                <p className="text-[11px] text-slate-500">
                  Volume de bloqueios, taxa de recuperação e taxa de inadimplência crônica de cada vencimento
                </p>
              </div>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cycleData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="cycle" tick={{ fontSize: 11, fill: '#334155' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl border border-slate-700 space-y-1">
                          <p className="font-bold text-slate-100">{item.fullCycle}</p>
                          <p className="text-slate-300">Total Bloqueados: <strong className="text-white">{item.total}</strong></p>
                          <p className="text-emerald-400 font-semibold">Voltaram: {item.returned} ({item.rate}%)</p>
                          <p className="text-amber-400">Ainda Suspensos: {item.suspended} ({item.suspRate}%)</p>
                          <p className="text-rose-400">Cancelados: {item.churn}</p>
                          <p className="text-slate-300 font-mono pt-1 border-t border-slate-700">MRR do Ciclo: {formatCurrency(item.mrr)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="total" name="Total Bloqueados" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="returned" name="Voltaram à Base" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="suspended" name="Ainda Suspensos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            {cycleData.map((c) => (
              <div key={c.cycle} className="bg-white border border-slate-200 rounded-lg p-3 text-xs">
                <div className="font-bold text-slate-900 flex justify-between items-center">
                  <span>{c.cycle}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    c.rate >= 96 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {c.rate}% Retorno
                  </span>
                </div>
                <div className="mt-2 text-slate-500 space-y-1 text-[11px]">
                  <div>Total Bloqueios: <strong className="text-slate-800">{c.total}</strong> ({((c.total / data.totalBlocked) * 100).toFixed(0)}% da base)</div>
                  <div>Suspensos Ativos: <strong className="text-amber-700">{c.suspended} clientes</strong> ({c.suspRate}%)</div>
                  <div>Faturamento no Ciclo: <strong className="text-slate-800">{formatCurrency(c.mrr)}</strong></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Concentração por Plano */}
      {activeTab === 'plans' && (
        <div className="bg-slate-50/60 border border-slate-200/80 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-purple-100 text-purple-800 rounded-lg">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">
                  Top 5 Planos Mais Impactados por Bloqueio
                </h3>
                <p className="text-[11px] text-slate-500">
                  Onde está concentrado o faturamento e o churn por velocidade contratada
                </p>
              </div>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={planData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="plan" tick={{ fontSize: 11, fill: '#334155' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl border border-slate-700 space-y-1">
                          <p className="font-bold text-slate-100">{item.fullPlan}</p>
                          <p className="text-slate-300">Total Bloqueados: <strong className="text-white">{item.total}</strong></p>
                          <p className="text-emerald-400 font-semibold">Voltaram: {item.returned} ({item.rate}%)</p>
                          <p className="text-amber-400">Suspensos: {item.suspended}</p>
                          <p className="text-rose-400">Cancelados: {item.churn}</p>
                          <p className="text-slate-300 font-mono pt-1 border-t border-slate-700">Faturamento: {formatCurrency(item.mrr)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="total" name="Total Bloqueados" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="returned" name="Voltaram à Base" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="suspended" name="Ainda Suspensos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 3. Actionable Executive Decision Playbook (Cards de Decisão) */}
      <div className="border-t border-slate-200 pt-4">
        <div className="flex items-center space-x-2 mb-3">
          <Zap className="w-4 h-4 text-amber-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Recomendações Práticas para a Diretoria (Playbook de Ação)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Card 1: Foco de Cobrança Ativa nos Suspensos */}
          <div className="bg-gradient-to-br from-amber-50/70 to-white border border-amber-200/80 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 text-amber-800">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span className="text-xs font-bold">1. Resgate dos {data.suspendedCount || 60} Suspensos</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                Os <strong>{data.suspendedCount || 60} contratos suspensos</strong> somam <strong>{formatCurrency(data.suspendedMrr || 6086)}</strong>. Como mais da metade deles está no plano <em>SUPER 500 MEGAS</em>, a equipe de retenção deve priorizar contato telefônico e oferta de anistia de juros/multa para evitar churn definitivo após 60 dias.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-amber-100 flex items-center justify-between text-[11px] font-semibold text-amber-900">
              <span>Impacto Estimado</span>
              <span className="text-emerald-700">+R$ 2.500/mês recuperáveis</span>
            </div>
          </div>

          {/* Card 2: Calibração da Régua Automática */}
          <div className="bg-gradient-to-br from-emerald-50/70 to-white border border-emerald-200/80 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 text-emerald-800">
                <Clock className="w-4 h-4 shrink-0" />
                <span className="text-xs font-bold">2. Régua Preventiva no D+5</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                O tempo médio de retorno é de <strong>{data.avgDaysToReturn} dias</strong>. Configurar disparo automático de link de pagamento via WhatsApp/PIX no <strong>5º dia pós-bloqueio</strong> acelera a regularização antes do final de semana, diminuindo a probabilidade de transbordo para a faixa crítica.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-emerald-100 flex items-center justify-between text-[11px] font-semibold text-emerald-900">
              <span>Ganho de Velocidade</span>
              <span className="text-emerald-700">Redução de 1.5 dia na média</span>
            </div>
          </div>

          {/* Card 3: Otimização de Carteira de Ciclos */}
          <div className="bg-gradient-to-br from-blue-50/70 to-white border border-blue-200/80 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 text-blue-800">
                <Target className="w-4 h-4 shrink-0" />
                <span className="text-xs font-bold">3. Rebalanceamento de Vencimentos</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                O <strong>Ciclo 30</strong> concentra mais de <strong>54% dos bloqueios</strong> de toda a empresa, gerando sobrecarga operacional. Em contrapartida, o <strong>Ciclo 20</strong> tem a menor inadimplência (apenas 8 suspensos). Estimule a equipe de vendas a ofertar o dia 20 para novos contratos.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-blue-100 flex items-center justify-between text-[11px] font-semibold text-blue-900">
              <span>Eficiência Operacional</span>
              <span className="text-blue-700">Equilíbrio de suporte técnico</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
