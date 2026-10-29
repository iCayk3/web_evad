import React, { useState, useEffect, useMemo } from 'react';
import {
  PackageCheck,
  RefreshCw,
  MapPin,
  Calendar,
  Layers,
  Printer,
  X,
  TrendingUp,
  DollarSign,
  Settings,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { API_BASE } from '../config/api';
import type { EquipamentoAnnualResponse } from '../types';

interface EquipmentAnnualDashboardProps {
  initialYear?: string;
  onNavigateToMonth?: (monthKey: string) => void;
  onSwitchToMonthly?: () => void;
}

export const EquipmentAnnualDashboard: React.FC<EquipmentAnnualDashboardProps> = ({
  initialYear = '2026',
  onNavigateToMonth,
  onSwitchToMonthly,
}) => {
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [data, setData] = useState<EquipamentoAnnualResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'graficos' | 'meses' | 'cidades' | 'motivos'>('graficos');

  // Preço de referência unitário do equipamento (persistido localmente)
  const [hardwareUnitPrice, setHardwareUnitPrice] = useState<number>(() => {
    const saved = localStorage.getItem('evad_hardware_unit_price');
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 220; // Padrão R$ 220,00 por aparelho
  });
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [tempPriceInput, setTempPriceInput] = useState<string>(() => hardwareUnitPrice.toString());

  const handleSavePrice = (newVal: number) => {
    if (isNaN(newVal) || newVal <= 0) return;
    setHardwareUnitPrice(newVal);
    localStorage.setItem('evad_hardware_unit_price', newVal.toString());
    setIsPriceModalOpen(false);
  };

  const fetchAnnualEquipment = async (year: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/equipamentos/annual?year=${year}`);
      if (!res.ok) throw new Error('Falha ao consultar indicadores anuais de equipamentos');
      const json: EquipamentoAnnualResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnualEquipment(selectedYear);
  }, [selectedYear]);

  const summary = data?.summary;
  const byMonth = data?.byMonth || [];
  const byCity = data?.byCity || [];
  const byCause = data?.byCause || [];

  // Cálculos patrimoniais
  const totalOrders = summary?.totalOrders || 0;
  const totalRecuperados = summary?.recuperados || 0;
  const totalTentando = summary?.tentando || 0;
  const totalSemOS = summary?.semOS || 0;
  const totalPerdidos = summary?.perdidos || 0;

  const totalPatrimonioRisco = totalOrders * hardwareUnitPrice;
  const totalPatrimonioRecuperado = totalRecuperados * hardwareUnitPrice;
  const totalPatrimonioPendente = (totalOrders - totalRecuperados) * hardwareUnitPrice;
  const totalPatrimonioSemOS = totalSemOS * hardwareUnitPrice;

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatNumber = (val: number) => {
    return val.toLocaleString('pt-BR');
  };

  const chartMonthlyData = useMemo(() => {
    return byMonth.map((m) => {
      const shortName = m.monthLabel.split(' / ')[0] || m.monthKey;
      return {
        monthKey: m.monthKey,
        name: shortName,
        total: m.total,
        recuperados: m.recuperados,
        tentando: m.tentando,
        semOS: m.semOS,
        perdidos: m.perdidos,
        taxa: m.taxaRecuperacao,
        valorRecuperado: m.recuperados * hardwareUnitPrice,
        valorPendente: (m.total - m.recuperados) * hardwareUnitPrice,
        valorTotal: m.total * hardwareUnitPrice,
      };
    });
  }, [byMonth, hardwareUnitPrice]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. CABEÇALHO EXECUTIVO DE IMPRESSÃO (Aparece estritamente no PDF / Print)   */}
      {/* ========================================================================= */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-5">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              Sol Telecom • Relatório Anual de Gestão de Equipamentos & Proteção Patrimonial
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Consolidação Anual de Retiradas de Hardware (ONUs/Roteadores) • Exercício: <strong>{selectedYear}</strong> • Custo Ref: <strong>{formatCurrency(hardwareUnitPrice)}/aparelho</strong>
            </p>
          </div>
          <div className="text-right text-[10px] text-slate-500">
            <div>Emissão: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</div>
            <div>Sistema: EVAD Intelligence v2.0</div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. BARRA DE CONTROLE & NAVEGAÇÃO SUPERIOR (Oculta na Impressão)           */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 no-print">
        <div className="shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
              <Layers className="w-3 h-3 text-emerald-600" />
              Consolidado Anual
            </span>
            <span className="text-xs text-slate-400">• Gestão de Hardware ISP</span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            Dashboard Anual de Equipamentos & KPIs ({selectedYear})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhamento integral de aparelhos em risco, efetividade das OSs de retirada, pontos cegos e preservação patrimonial no ano
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto xl:justify-end">
          {/* Seletor de Ano */}
          {data?.availableYears && data.availableYears.length > 0 && (
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <label htmlFor="year-select" className="text-slate-500 font-medium">Ano:</label>
              <select
                id="year-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-transparent font-bold text-slate-900 border-none outline-none cursor-pointer"
              >
                {data.availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Configuração de Preço do Hardware */}
          <button
            type="button"
            onClick={() => {
              setTempPriceInput(hardwareUnitPrice.toString());
              setIsPriceModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition cursor-pointer"
            title="Alterar valor de referência unitário do equipamento comodatado"
          >
            <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
            <span>Ref: {formatCurrency(hardwareUnitPrice)}</span>
            <Settings className="h-3 w-3 text-slate-400 ml-0.5" />
          </button>

          {/* Botão para voltar à auditoria mensal */}
          {onSwitchToMonthly && (
            <button
              type="button"
              onClick={onSwitchToMonthly}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
              title="Voltar para a auditoria mensal detalhada cliente a cliente"
            >
              <PackageCheck className="h-3.5 w-3.5 text-blue-600" />
              <span>Ver Mês Específico</span>
            </button>
          )}

          {/* Botão de Impressão Executiva */}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            title="Imprimir relatório executivo anual completo ou salvar em PDF"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Imprimir Relatório (PDF)</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 shadow-xs space-y-3">
          <RefreshCw className="h-7 w-7 text-blue-600 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Consolidando dados anuais de equipamentos de {selectedYear}...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-800 text-sm flex items-center space-x-3">
          <AlertTriangle className="h-6 w-6 text-rose-600 shrink-0" />
          <div>
            <p className="font-bold">Não foi possível carregar o consolidado anual:</p>
            <p className="text-xs text-rose-700 mt-0.5">{error}</p>
          </div>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* 3. CARDS DE KPIS EXECUTIVOS ANUAIS                                        */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. Total de Aparelhos em Risco */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Aparelhos no Ano</span>
                <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                  {formatNumber(totalOrders)}
                </div>
                <div className="text-[11px] font-mono font-semibold text-slate-600 mt-0.5">
                  {formatCurrency(totalPatrimonioRisco)}
                </div>
              </div>
              <div className="text-[10px] text-slate-400 mt-2 border-t border-slate-100 pt-1.5">
                Exposição total de hardware
              </div>
            </div>

            {/* 2. Recuperados (Patrimônio Salvo) */}
            <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between bg-gradient-to-br from-emerald-50/40 to-white">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Recuperados</span>
                  <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full">
                    {summary?.taxaRecuperacao || 0}%
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
                  {formatNumber(totalRecuperados)}
                </div>
                <div className="text-[11px] font-mono font-bold text-emerald-700 mt-0.5">
                  {formatCurrency(totalPatrimonioRecuperado)}
                </div>
              </div>
              <div className="text-[10px] text-emerald-800 font-semibold mt-2 border-t border-emerald-100 pt-1.5">
                Patrimônio resgatado e em estoque
              </div>
            </div>

            {/* 3. Pontos Cegos Anuais (Sem OS Aberta) */}
            <div className="bg-white border border-amber-200 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between bg-gradient-to-br from-amber-50/40 to-white">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Sem OS Aberta</span>
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded">
                    Ponto Cego
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-amber-700 mt-1">
                  {formatNumber(totalSemOS)}
                </div>
                <div className="text-[11px] font-mono font-bold text-amber-700 mt-0.5">
                  {formatCurrency(totalPatrimonioSemOS)}
                </div>
              </div>
              <div className="text-[10px] text-amber-800 font-medium mt-2 border-t border-amber-100 pt-1.5">
                Cancelados/suspensos sem chamado
              </div>
            </div>

            {/* 4. Em Campo / Tentando */}
            <div className="bg-white border border-blue-200 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between bg-gradient-to-br from-blue-50/30 to-white">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Em Campo / OS</span>
                  <span className="text-[10px] font-bold text-blue-600">Andamento</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-blue-700 mt-1">
                  {formatNumber(totalTentando)}
                </div>
                <div className="text-[11px] font-mono font-semibold text-blue-700 mt-0.5">
                  {formatCurrency(totalTentando * hardwareUnitPrice)}
                </div>
              </div>
              <div className="text-[10px] text-slate-500 mt-2 border-t border-blue-100 pt-1.5">
                Ordens de retirada abertas no RBX
              </div>
            </div>

            {/* 5. Extraviados / Perdidos */}
            <div className="bg-white border border-rose-200 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between bg-gradient-to-br from-rose-50/30 to-white">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Extraviados</span>
                  <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-1 py-0.2 rounded">Perdidos</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-rose-700 mt-1">
                  {formatNumber(totalPerdidos)}
                </div>
                <div className="text-[11px] font-mono font-semibold text-rose-700 mt-0.5">
                  {formatCurrency(totalPerdidos * hardwareUnitPrice)}
                </div>
              </div>
              <div className="text-[10px] text-slate-500 mt-2 border-t border-rose-100 pt-1.5">
                Mudança / recusa / irrecuperáveis
              </div>
            </div>

            {/* 6. Eficácia de Campo das OSs */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Eficácia das OSs</span>
                <div className="text-xl sm:text-2xl font-black text-indigo-700 mt-1">
                  {summary?.taxaEfetividadeOS || 0}%
                </div>
                <div className="text-[11px] font-semibold text-slate-600 mt-0.5">
                  Sucesso das ordens
                </div>
              </div>
              <div className="text-[10px] text-slate-400 mt-2 border-t border-slate-100 pt-1.5">
                Recuperados ÷ OSs executadas
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 4. TABS INTERNAS DE NAVEGAÇÃO DA VISÃO ANUAL                              */}
          {/* ========================================================================= */}
          <div className="bg-slate-100 p-1 rounded-xl inline-flex space-x-1 text-xs font-semibold no-print">
            <button
              onClick={() => setActiveTab('graficos')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeTab === 'graficos'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Evolução Mensal (Gráficos)
            </button>
            <button
              onClick={() => setActiveTab('meses')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeTab === 'meses'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tabela Comparativa Mês a Mês ({byMonth.length})
            </button>
            <button
              onClick={() => setActiveTab('cidades')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeTab === 'cidades'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Desempenho por Cidade / Praça ({byCity.length})
            </button>
            <button
              onClick={() => setActiveTab('motivos')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeTab === 'motivos'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Motivos & Soluções ({byCause.length})
            </button>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: GRÁFICOS DE EVOLUÇÃO MENSAL                                        */}
          {/* ========================================================================= */}
          {(activeTab === 'graficos' || activeTab === 'meses') && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Gráfico 1: Volume de Aparelhos e Taxa de Recuperação */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
                  <div className="mb-3">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <span>Volume de Aparelhos & Taxa de Recuperação Mensal</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Evolução de equipamentos recuperados, em campo e sem OS ao longo de {selectedYear}
                    </p>
                  </div>

                  <div className="h-64 sm:h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartMonthlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#475569' }} />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          domain={[0, 100]}
                          tick={{ fontSize: 11, fill: '#059669' }}
                          unit="%"
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload || !payload.length) return null;
                            const d = payload[0].payload;
                            return (
                              <div className="bg-slate-900 text-white text-xs rounded-xl p-3 shadow-xl space-y-1.5 border border-slate-800">
                                <p className="font-bold text-slate-100 text-sm border-b border-slate-800 pb-1">
                                  {label} / {selectedYear}
                                </p>
                                <p className="text-slate-300">Total Aparelhos: <strong className="text-white">{d.total}</strong></p>
                                <p className="text-emerald-400 font-semibold">Recuperados: {d.recuperados} ({d.taxa}%)</p>
                                <p className="text-blue-400">Em Campo / OS: {d.tentando}</p>
                                <p className="text-amber-400">Sem OS (Ponto Cego): {d.semOS}</p>
                                {d.perdidos > 0 && <p className="text-rose-400">Extraviados: {d.perdidos}</p>}
                                <div className="border-t border-slate-800 pt-1 text-[11px] text-slate-400">
                                  Patrimônio Salvo: <strong className="text-emerald-300">{formatCurrency(d.valorRecuperado)}</strong>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                        <Bar yAxisId="left" dataKey="recuperados" name="Recuperados" stackId="a" fill="#10b981" />
                        <Bar yAxisId="left" dataKey="tentando" name="Em Campo / OS" stackId="a" fill="#3b82f6" />
                        <Bar yAxisId="left" dataKey="semOS" name="Sem OS (Ponto Cego)" stackId="a" fill="#f59e0b" />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="taxa"
                          name="% Recuperação"
                          stroke="#059669"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: '#059669' }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico 2: Exposição Patrimonial em R$ (Salvo vs Em Risco) */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
                  <div className="mb-3">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <span>Evolução do Valor Patrimonial Salvo vs Em Risco (R$)</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Baseado no custo de referência de {formatCurrency(hardwareUnitPrice)} por aparelho comodatado
                    </p>
                  </div>

                  <div className="h-64 sm:h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartMonthlyData} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                        <YAxis
                          tick={{ fontSize: 10, fill: '#475569' }}
                          tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload || !payload.length) return null;
                            const d = payload[0].payload;
                            return (
                              <div className="bg-slate-900 text-white text-xs rounded-xl p-3 shadow-xl space-y-1.5 border border-slate-800">
                                <p className="font-bold text-slate-100 text-sm border-b border-slate-800 pb-1">
                                  {label} / {selectedYear}
                                </p>
                                <p className="text-emerald-400 font-bold">
                                  Salvo (Recuperado): {formatCurrency(d.valorRecuperado)} ({d.recuperados} un.)
                                </p>
                                <p className="text-amber-400 font-bold">
                                  Pendente / Em Risco: {formatCurrency(d.valorPendente)} ({d.total - d.recuperados} un.)
                                </p>
                                <div className="border-t border-slate-800 pt-1 text-[11px] text-slate-400">
                                  Total do Mês: <strong>{formatCurrency(d.valorTotal)}</strong>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                        <Bar dataKey="valorRecuperado" name="Valor Salvo (R$)" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="valorPendente" name="Valor Pendente (R$)" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: TABELA COMPARATIVA MÊS A MÊS (JANEIRO A DEZEMBRO)                  */}
          {/* ========================================================================= */}
          {(activeTab === 'meses' || activeTab === 'graficos') && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span>Consolidado Mês a Mês do Ano ({selectedYear})</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Resumo analítico de cada mês com detalhamento de aparelhos em risco, resgatados e valores salvos
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  {byMonth.length} meses auditados
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-3">Mês de Competência</th>
                      <th className="py-2.5 px-3 text-right">Aparelhos</th>
                      <th className="py-2.5 px-4">Recuperados (%)</th>
                      <th className="py-2.5 px-3 text-right">Em Campo (OS)</th>
                      <th className="py-2.5 px-3 text-right">Sem OS (Ponto Cego)</th>
                      <th className="py-2.5 px-3 text-right">Perdidos</th>
                      <th className="py-2.5 px-3 text-right">Patrimônio Salvo</th>
                      <th className="py-2.5 px-3 text-right">Patrimônio Pendente</th>
                      <th className="py-2.5 px-3 text-center no-print">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {byMonth.map((m) => {
                      const valRecuperado = m.recuperados * hardwareUnitPrice;
                      const valPendente = (m.total - m.recuperados) * hardwareUnitPrice;
                      return (
                        <tr key={m.monthKey} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {m.monthLabel}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                            {formatNumber(m.total)}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-emerald-800 w-12 text-right">
                                {m.taxaRecuperacao.toFixed(1)}%
                              </span>
                              <div className="flex-1 min-w-[60px] max-w-[100px] bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-emerald-500 h-1.5 rounded-full"
                                  style={{ width: `${Math.min(100, Math.max(0, m.taxaRecuperacao))}%` }}
                                />
                              </div>
                              <span className="text-[11px] text-slate-400">
                                ({m.recuperados})
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right text-blue-700 font-semibold">
                            {m.tentando}
                          </td>
                          <td className="py-2.5 px-3 text-right text-amber-700 font-semibold">
                            {m.semOS}
                          </td>
                          <td className="py-2.5 px-3 text-right text-rose-700 font-semibold">
                            {m.perdidos}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                            {formatCurrency(valRecuperado)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {formatCurrency(valPendente)}
                          </td>
                          <td className="py-2.5 px-3 text-center no-print">
                            {onNavigateToMonth && (
                              <button
                                type="button"
                                onClick={() => onNavigateToMonth(m.monthKey)}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition cursor-pointer"
                                title={`Abrir auditoria detalhada de ${m.monthLabel}`}
                              >
                                <span>Auditar Mês</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100/90 border-t-2 border-slate-300 font-black text-slate-900 text-xs">
                      <td className="py-3 px-3 uppercase">Total Consolidado ({selectedYear})</td>
                      <td className="py-3 px-3 text-right font-black">{formatNumber(totalOrders)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-black text-emerald-800 w-12 text-right">
                            {(summary?.taxaRecuperacao || 0).toFixed(1)}%
                          </span>
                          <span className="text-slate-500 font-normal">
                            ({formatNumber(totalRecuperados)} aparelhos)
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right text-blue-800 font-black">{formatNumber(totalTentando)}</td>
                      <td className="py-3 px-3 text-right text-amber-800 font-black">{formatNumber(totalSemOS)}</td>
                      <td className="py-3 px-3 text-right text-rose-800 font-black">{formatNumber(totalPerdidos)}</td>
                      <td className="py-3 px-3 text-right font-mono font-black text-emerald-800">{formatCurrency(totalPatrimonioRecuperado)}</td>
                      <td className="py-3 px-3 text-right font-mono font-black text-slate-900">{formatCurrency(totalPatrimonioPendente)}</td>
                      <td className="py-3 px-3 text-center no-print">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: DESEMPENHO REGIONAL POR CIDADE / PRAÇA                             */}
          {/* ========================================================================= */}
          {activeTab === 'cidades' && (
            <div className="space-y-4">
              {/* Grid das principais cidades */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {byCity.map((c) => {
                  const isBoaVista = c.cidade.toLowerCase().includes('boa vista');
                  const valSalvo = c.recuperados * hardwareUnitPrice;
                  return (
                    <div
                      key={c.cidade}
                      className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">{c.cidade}</span>
                            {isBoaVista && (
                              <span className="text-[9px] bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.2 rounded font-medium">
                                Distrito de Quatipuru
                              </span>
                            )}
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            c.taxaRecuperacao >= 40
                              ? 'bg-emerald-100 text-emerald-800'
                              : c.taxaRecuperacao > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {c.taxaRecuperacao.toFixed(1)}%
                          </span>
                        </div>

                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden my-2">
                          <div
                            className="bg-emerald-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(0, c.taxaRecuperacao))}%` }}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                          <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                            <div className="text-[10px] text-slate-500">Total</div>
                            <div className="font-bold text-slate-800">{c.total}</div>
                          </div>
                          <div className="bg-emerald-50 p-1.5 rounded border border-emerald-100">
                            <div className="text-[10px] text-emerald-700">Recup.</div>
                            <div className="font-bold text-emerald-800">{c.recuperados}</div>
                          </div>
                          <div className="bg-amber-50 p-1.5 rounded border border-amber-100">
                            <div className="text-[10px] text-amber-700">Sem OS</div>
                            <div className="font-bold text-amber-800">{c.semOS}</div>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-2.5 mt-3 flex justify-between items-center text-xs">
                        <span className="text-[11px] text-slate-400">Patrimônio Salvo:</span>
                        <strong className="text-emerald-700 font-mono text-[11px]">{formatCurrency(valSalvo)}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tabela Regional Detalhada */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs mt-4">
                <div className="p-4 border-b border-slate-200">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span>Tabela Regional de Desempenho por Cidade no Ano</span>
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-3">Praça / Cidade</th>
                        <th className="py-2.5 px-3 text-right">Aparelhos</th>
                        <th className="py-2.5 px-4">Recuperados (%)</th>
                        <th className="py-2.5 px-3 text-right">Em Campo (OS)</th>
                        <th className="py-2.5 px-3 text-right">Sem OS Aberta</th>
                        <th className="py-2.5 px-3 text-right">Perdidos</th>
                        <th className="py-2.5 px-3 text-right">Patrimônio Salvo</th>
                        <th className="py-2.5 px-3 text-right">Patrimônio em Risco</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {byCity.map((c) => {
                        const isBoaVista = c.cidade.toLowerCase().includes('boa vista');
                        const valSalvo = c.recuperados * hardwareUnitPrice;
                        const valRisco = (c.total - c.recuperados) * hardwareUnitPrice;
                        return (
                          <tr key={c.cidade} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              <div className="flex items-center gap-1.5">
                                <span>{c.cidade}</span>
                                {isBoaVista && (
                                  <span className="text-[9px] bg-sky-50 text-sky-800 border border-sky-200 px-1 py-0.2 rounded font-medium">
                                    Distrito de Quatipuru
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-slate-800">{c.total}</td>
                            <td className="py-2.5 px-4">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-emerald-800 w-12 text-right">
                                  {c.taxaRecuperacao.toFixed(1)}%
                                </span>
                                <div className="flex-1 min-w-[60px] max-w-[90px] bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-emerald-500 h-1.5 rounded-full"
                                    style={{ width: `${Math.min(100, Math.max(0, c.taxaRecuperacao))}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-slate-400">({c.recuperados})</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right text-blue-700 font-semibold">{c.tentando}</td>
                            <td className="py-2.5 px-3 text-right text-amber-700 font-semibold">{c.semOS}</td>
                            <td className="py-2.5 px-3 text-right text-rose-700 font-semibold">{c.perdidos}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">{formatCurrency(valSalvo)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">{formatCurrency(valRisco)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: MOTIVOS & SOLUÇÕES DE BAIXA REGISTRADOS NO RBX                     */}
          {/* ========================================================================= */}
          {activeTab === 'motivos' && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
              <div className="border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Principais Desfechos, Soluções & Causas Registradas no RBX ({selectedYear})</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Frequência dos registros inseridos pelos técnicos e operadores nas ordens de serviço de retirada
                </p>
              </div>

              {byCause.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-6 text-center">Nenhum detalhe de encerramento registrado.</p>
              ) : (
                <div className="space-y-3">
                  {byCause.map((cause, idx) => {
                    const share = totalOrders > 0 ? ((cause.total / totalOrders) * 100).toFixed(1) : '0';
                    return (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                          <span className="text-slate-800 break-words max-w-[80%]">{cause.motivo}</span>
                          <span className="text-slate-600 font-mono font-bold">
                            {cause.total} ocorrências ({share}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(0, parseFloat(share)) * 2)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* RECOMENDAÇÃO ESTRATÉGICA ANUAL DE PRESERVAÇÃO PATRIMONIAL                 */}
          {/* ========================================================================= */}
          <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-4 text-xs leading-relaxed text-slate-700 shadow-2xs">
            <div className="font-bold text-sky-950 uppercase text-[11px] mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-3.5 bg-sky-600 rounded-xs inline-block" />
              <span>Diagnóstico Executivo & Recomendações Patrimoniais ({selectedYear})</span>
            </div>
            <ul className="space-y-1.5 list-disc pl-4 text-slate-700">
              <li>
                <strong>Pontos Cegos como Prioridade Máxima:</strong> Existem <strong>{formatNumber(totalSemOS)} clientes cancelados ou suspensos sem chamado de retirada no RBX</strong>, representando <strong>{formatCurrency(totalPatrimonioSemOS)}</strong> em aparelhos parados nas residências. A abertura em lote de chamados de recolhimento é a medida de maior retorno imediato.
              </li>
              <li>
                <strong>Patrimônio Preservado:</strong> A operação já assegurou o retorno de <strong>{formatNumber(totalRecuperados)} equipamentos ({summary?.taxaRecuperacao}%)</strong>, salvando <strong>{formatCurrency(totalPatrimonioRecuperado)}</strong> que não precisaram ser reinvestidos na compra de novos ativos.
              </li>
              <li>
                <strong>Foco nas Praças com Maior Volume:</strong> {byCity.length > 0 && (
                  <span>A praça de <strong>{byCity[0].cidade}</strong> lidera o volume com {byCity[0].total} aparelhos ({formatCurrency(byCity[0].total * hardwareUnitPrice)} em risco). O agendamento de rotas dedicadas por bairro reduz custos logísticos de coleta.</span>
                )}
              </li>
            </ul>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* MODAL PARA DEFINIÇÃO DO VALOR UNITÁRIO DO HARDWARE                        */}
      {/* ========================================================================= */}
      {isPriceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in no-print">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Valor de Referência do Hardware</h3>
                  <p className="text-[11px] text-slate-500">Custo médio por ONU/Roteador</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPriceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Valor Unitário Médio (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                  R$
                </span>
                <input
                  type="number"
                  step="5"
                  min="10"
                  max="5000"
                  value={tempPriceInput}
                  onChange={(e) => setTempPriceInput(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm font-bold text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="220"
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Esse valor é multiplicado pela quantidade de aparelhos para calcular o <strong>Patrimônio em Risco</strong> e o <strong>Valor Salvo</strong> em todo o sistema.
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsPriceModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-semibold rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSavePrice(parseFloat(tempPriceInput))}
                className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs cursor-pointer"
              >
                Salvar Valor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
