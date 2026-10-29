import React, { useMemo } from 'react';
import type { MonthlyAnalyticsData, BreakdownItem, ClientRecord } from '../types';

interface ExecutivePrintReportProps {
  data: MonthlyAnalyticsData;
  selectedMonth: string;
}

// Dicionário de padronização ortográfica e acentuação das praças do provedor
const formatCityName = (cityName: string): string => {
  const norm = cityName.toLowerCase().trim();
  if (norm.includes('pirabas')) return 'São João de Pirabas';
  if (norm.includes('magalhaes') || norm.includes('magalhães')) return 'Magalhães Barata';
  if (norm.includes('maracana') || norm.includes('maracanã')) return 'Maracanã';
  if (norm.includes('santarem') || norm.includes('santarém')) return 'Santarém Novo';
  if (norm.includes('salinopolis') || norm.includes('salinópolis')) return 'Salinópolis';
  if (norm.includes('quatipuru')) return 'Quatipuru';
  if (norm.includes('primavera')) return 'Primavera';
  if (norm.includes('marapanim')) return 'Marapanim';
  if (norm.includes('boa vista')) return 'Boa Vista';
  return cityName;
};

export const ExecutivePrintReport: React.FC<ExecutivePrintReportProps> = ({ data, selectedMonth }) => {
  const summary = data.summary;
  const byCycle = data.byCycle || [];
  const byPlan = data.byPlan || [];
  const byCity = data.byCity || [];
  const byNeighborhood = data.byNeighborhood || [];

  const topBairrosMap = useMemo(() => {
    const map = new Map<string, BreakdownItem[]>();
    byNeighborhood.forEach((item) => {
      const cityKey = formatCityName(item.city || '');
      if (!cityKey) return;
      if (!map.has(cityKey)) {
        map.set(cityKey, []);
      }
      map.get(cityKey)!.push(item);
    });

    const result: Record<string, string> = {};
    for (const [cityKey, items] of map.entries()) {
      const sorted = [...items].sort((a, b) => b.totalBlocked - a.totalBlocked);
      const topNames = sorted.slice(0, 4).map((i) => i.name);
      result[cityKey] = topNames.join(', ');
    }
    return result;
  }, [byNeighborhood]);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatNumber = (val: number) => {
    return val.toLocaleString('pt-BR');
  };

  // Mês e Ano de competência
  const [, monthNumStr] = selectedMonth.split('-');
  const monthNum = parseInt(monthNumStr || '1', 10);
  const nextMonthNum = monthNum === 12 ? 1 : monthNum + 1;
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const monthName = monthNames[monthNum - 1] || 'Janeiro';

  // Cálculos consolidados da coorte
  const totalBlocked = summary.totalBlocked || 0;
  const returnedCount = summary.returnedCount || 0;
  const pendingCount = totalBlocked - returnedCount;
  const returnedRate = summary.returnedRate || (totalBlocked > 0 ? (returnedCount / totalBlocked) * 100 : 0);
  const pendingRate = totalBlocked > 0 ? (pendingCount / totalBlocked) * 100 : 0;

  const totalMrr = summary.totalMrrBlocked || 0;
  const returnedMrr = summary.returnedMrr || 0;
  const pendingMrr = totalMrr - returnedMrr;
  const returnedMrrRate = totalMrr > 0 ? (returnedMrr / totalMrr) * 100 : 0;
  const pendingMrrRate = totalMrr > 0 ? (pendingMrr / totalMrr) * 100 : 0;

  // Clientes únicos no arquivo
  const uniqueClients = summary.clients ? new Set(summary.clients.map((c: ClientRecord) => c.rbxCode)).size : totalBlocked;
  const uniqueReturned = summary.clients ? new Set(summary.clients.filter((c: ClientRecord) => c.status === 'returned').map((c: ClientRecord) => c.rbxCode)).size : returnedCount;
  const uniquePending = uniqueClients - uniqueReturned;

  // 1. Ciclos ordenados por vencimento (10, 20, 30)
  const cycleSortOrder = (name: string) => {
    if (name.includes('10')) return 1;
    if (name.includes('20')) return 2;
    if (name.includes('30')) return 3;
    return 4;
  };

  const sortedCycles = [...byCycle].sort((a, b) => cycleSortOrder(a.name) - cycleSortOrder(b.name));

  const getCycleSubtitle = (name: string) => {
    if (name.includes('10')) return `(Bloqueios de 16/${monthNumStr} a 19/${monthNumStr})`;
    if (name.includes('20')) return `(Bloqueios de 26/${monthNumStr} a 29/${monthNumStr})`;
    if (name.includes('30')) return `(Bloqueios de 06/${String(nextMonthNum).padStart(2, '0')} a 09/${String(nextMonthNum).padStart(2, '0')})`;
    return '';
  };

  const getCycleShortLabel = (name: string) => {
    if (name.includes('10')) return `Venc. 10/${monthNumStr}`;
    if (name.includes('20')) return `Venc. 20/${monthNumStr}`;
    if (name.includes('30')) return `Venc. 30/${monthNumStr}`;
    return name;
  };

  // 2. TODOS os Planos de Acesso (sem truncamento, ordenados por volume de bloqueio)
  const allPlans = useMemo(() => {
    return [...byPlan].sort((a, b) => b.totalBlocked - a.totalBlocked);
  }, [byPlan]);

  // 3. TODAS as Cidades do Sistema (com normalização de grafias/acentos e consolidação de totais)
  const allCities = useMemo(() => {
    const map = new Map<string, BreakdownItem>();
    byCity.forEach((c) => {
      const canonicalName = formatCityName(c.name);
      const existing = map.get(canonicalName);
      if (!existing) {
        map.set(canonicalName, { ...c, name: canonicalName });
      } else {
        existing.totalBlocked += c.totalBlocked;
        existing.returnedCount += c.returnedCount;
        existing.churnedCount += c.churnedCount;
        existing.suspendedCount += c.suspendedCount;
        existing.stillBlockedCount += c.stillBlockedCount;
        existing.totalMrr += c.totalMrr;
        existing.returnedMrr += c.returnedMrr;
        existing.churnedMrr += c.churnedMrr;
        existing.suspendedMrr += c.suspendedMrr;
        existing.stillBlockedMrr += c.stillBlockedMrr;
        if (existing.totalBlocked > 0) {
          existing.returnedRate = Math.round((existing.returnedCount / existing.totalBlocked) * 1000) / 10;
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.totalBlocked - a.totalBlocked);
  }, [byCity]);

  // Top 5 cidades para o gráfico horizontal
  const top5Cities = allCities.slice(0, 5);
  const maxTopCityBlocked = top5Cities.length > 0 ? top5Cities[0].totalBlocked : 1;

  // Situação Cadastral no Provedor
  const suspendedCount = summary.suspendedCount || 0;
  const suspendedMrr = summary.suspendedMrr || 0;
  const churnedCount = summary.churnedCount || 0;
  const churnedMrr = summary.churnedMrr || 0;
  const blockedCount = summary.stillBlockedCount || 0;
  const blockedMrr = summary.stillBlockedMrr || 0;
  const otherCount = summary.otherCount || 0;
  const otherMrr = summary.otherMrr || 0;

  // Diagnóstico automático e recomendações estratégicas
  let lowestRecoveryCycle: BreakdownItem | null = null;
  let highestVolumeCycle: BreakdownItem | null = null;

  sortedCycles.forEach((c) => {
    if (!lowestRecoveryCycle || c.returnedRate < (lowestRecoveryCycle as BreakdownItem).returnedRate) {
      lowestRecoveryCycle = c;
    }
    if (!highestVolumeCycle || c.totalBlocked > (highestVolumeCycle as BreakdownItem).totalBlocked) {
      highestVolumeCycle = c;
    }
  });

  const highestPendingCity = [...allCities].sort(
    (a, b) => (b.totalMrr - b.returnedMrr) - (a.totalMrr - a.returnedMrr)
  )[0];

  // Geometria do Gráfico Donut (SVG)
  const radius = 38;
  const circumference = 2 * Math.PI * radius; // ~238.76
  const strokeDashoffset = circumference - (returnedMrrRate / 100) * circumference;

  // Escala para o gráfico de barras por ciclo
  const maxCycleVal = Math.max(...sortedCycles.map((c) => c.totalBlocked), 100);

  return (
    <div className="executive-print-sheet bg-white text-slate-800 p-4 font-sans text-xs select-none">
      {/* ========================================================================= */}
      {/* 1. CABEÇALHO EXECUTIVO                                                    */}
      {/* ========================================================================= */}
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3 mb-3.5">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-tight">
            Relatório Executivo de Inadimplência & Recuperação
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            Análise de Bloqueios e Eficácia de Regularização por Vencimento
          </p>
        </div>
        <div className="text-right">
          <div className="inline-block bg-sky-100 text-sky-900 font-bold px-2.5 py-0.5 rounded text-[11px] tracking-wide">
            Faturamento {monthName} / Vencimento {monthName}
          </div>
          <div className="text-[9.5px] text-slate-400 mt-1">
            Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-[9.5px] font-semibold text-slate-600">
            Provedor: Sol Telecom • Gestão de Acessos ISP
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CARDS DE KPIS EXECUTIVOS (2 LINHAS DE 3 CARDS)                         */}
      {/* ========================================================================= */}
      <div className="print-section print-avoid-break grid grid-cols-3 gap-2.5 mb-3.5">
        {/* Card 1: Total Bloqueios */}
        <div className="bg-slate-50/80 border border-slate-200 rounded p-2.5 relative">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Total de Bloqueios</span>
            <span className="bg-sky-100 text-sky-800 text-[8.5px] font-bold px-1.5 py-0.2 rounded">100% Base</span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1.5 leading-none">{formatNumber(totalBlocked)}</div>
          <div className="text-[8.5px] text-slate-500 mt-1.5">{formatNumber(uniqueClients)} clientes únicos no arquivo</div>
        </div>

        {/* Card 2: Voltaram (Ativo) */}
        <div className="bg-emerald-50/50 border-l-4 border-l-emerald-500 border border-slate-200 rounded p-2.5 relative">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-emerald-900 uppercase tracking-wider">Voltaram (Status Ativo)</span>
            <span className="bg-emerald-100 text-emerald-800 text-[8.5px] font-bold px-1.5 py-0.2 rounded">
              {returnedRate.toFixed(1)}% Retorno
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1.5 leading-none">{formatNumber(returnedCount)}</div>
          <div className="text-[8.5px] text-slate-500 mt-1.5">{formatNumber(uniqueReturned)} clientes regularizados</div>
        </div>

        {/* Card 3: Inadimplentes (Não Voltaram) */}
        <div className="bg-rose-50/50 border-l-4 border-l-rose-500 border border-slate-200 rounded p-2.5 relative">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-rose-900 uppercase tracking-wider">Inadimplentes (Não Voltaram)</span>
            <span className="bg-rose-100 text-rose-800 text-[8.5px] font-bold px-1.5 py-0.2 rounded">
              {pendingRate.toFixed(1)}% Pendente
            </span>
          </div>
          <div className="text-2xl font-black text-rose-700 mt-1.5 leading-none">{formatNumber(pendingCount)}</div>
          <div className="text-[8.5px] text-slate-500 mt-1.5">{formatNumber(uniquePending)} clientes pendentes</div>
        </div>

        {/* Card 4: Faturamento em Risco */}
        <div className="bg-slate-50/80 border-l-4 border-l-slate-700 border border-slate-200 rounded p-2.5 relative">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-slate-700 uppercase tracking-wider">Faturamento em Risco</span>
            <span className="bg-slate-200 text-slate-800 text-[8.5px] font-bold px-1.5 py-0.2 rounded">Total Mensal</span>
          </div>
          <div className="text-lg font-black text-slate-900 mt-1.5 leading-none">{formatCurrency(totalMrr)}</div>
          <div className="text-[8.5px] text-slate-500 mt-1.5">Total das mensalidades bloqueadas</div>
        </div>

        {/* Card 5: Faturamento Recuperado */}
        <div className="bg-emerald-50/50 border-l-4 border-l-emerald-600 border border-slate-200 rounded p-2.5 relative">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-emerald-900 uppercase tracking-wider">Faturamento Recuperado</span>
            <span className="bg-emerald-100 text-emerald-800 text-[8.5px] font-bold px-1.5 py-0.2 rounded">
              {returnedMrrRate.toFixed(1)}% Caixa
            </span>
          </div>
          <div className="text-lg font-black text-emerald-700 mt-1.5 leading-none">{formatCurrency(returnedMrr)}</div>
          <div className="text-[8.5px] text-slate-500 mt-1.5">Receita reabilitada com sucesso</div>
        </div>

        {/* Card 6: Inadimplência em Aberto */}
        <div className="bg-rose-50/50 border-l-4 border-l-rose-600 border border-slate-200 rounded p-2.5 relative">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-rose-900 uppercase tracking-wider">Inadimplência em Aberto</span>
            <span className="bg-rose-100 text-rose-800 text-[8.5px] font-bold px-1.5 py-0.2 rounded">
              {pendingMrrRate.toFixed(1)}% A Receber
            </span>
          </div>
          <div className="text-lg font-black text-rose-700 mt-1.5 leading-none">{formatCurrency(pendingMrr)}</div>
          <div className="text-[8.5px] text-slate-500 mt-1.5">Prejuízo potencial / cobrança ativa</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. TRIO DE GRÁFICOS VISUAIS EM SVG (ALTA RESOLUÇÃO VETORIAL)               */}
      {/* ========================================================================= */}
      <div className="print-section print-avoid-break grid grid-cols-3 gap-2.5 mb-3.5 border border-slate-200 rounded-md p-2.5 bg-slate-50/40">
        {/* Gráfico 1: Barras Agrupadas por Vencimento */}
        <div>
          <div className="text-[9.5px] font-bold text-slate-700 uppercase tracking-wider mb-1 text-center">
            Recuperação por Vencimento da Fatura
          </div>
          <div className="flex items-end justify-center space-x-5 h-24 pt-3 pb-1 border-b border-slate-200">
            {sortedCycles.map((cycle) => {
              const bHeight = Math.max(14, Math.round((cycle.totalBlocked / maxCycleVal) * 65));
              const rHeight = Math.max(10, Math.round((cycle.returnedCount / maxCycleVal) * 65));
              return (
                <div key={cycle.name} className="flex flex-col items-center">
                  <div className="flex items-end space-x-1">
                    {/* Barra Bloqueados */}
                    <div className="flex flex-col items-center">
                      <span className="text-[8px] font-bold text-slate-700 mb-0.5">{cycle.totalBlocked}</span>
                      <div
                        style={{ height: `${bHeight}px` }}
                        className="w-4 bg-slate-400 rounded-t"
                      />
                    </div>
                    {/* Barra Voltaram */}
                    <div className="flex flex-col items-center">
                      <span className="text-[8px] font-bold text-emerald-700 mb-0.5">{cycle.returnedCount}</span>
                      <div
                        style={{ height: `${rHeight}px` }}
                        className="w-4 bg-emerald-500 rounded-t"
                      />
                    </div>
                  </div>
                  <span className="text-[8.5px] font-semibold text-slate-700 mt-1 whitespace-nowrap">
                    {getCycleShortLabel(cycle.name)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-center space-x-4 mt-1.5 text-[8.5px] text-slate-500">
            <span className="flex items-center"><span className="w-2.5 h-2 bg-slate-400 rounded-xs mr-1 inline-block" /> Bloqueados</span>
            <span className="flex items-center"><span className="w-2.5 h-2 bg-emerald-500 rounded-xs mr-1 inline-block" /> Voltaram</span>
          </div>
        </div>

        {/* Gráfico 2: Composição do Faturamento (Donut SVG) */}
        <div>
          <div className="text-[9.5px] font-bold text-slate-700 uppercase tracking-wider mb-1 text-center">
            Composição do Faturamento
          </div>
          <div className="flex items-center justify-center space-x-2.5 h-24">
            <div className="relative flex items-center justify-center">
              <svg className="w-20 h-20 -rotate-90 transform" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke="#fda4af"
                  strokeWidth="13"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke="#10b981"
                  strokeWidth="13"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute text-center">
                <div className="text-[11px] font-black text-slate-900 leading-none">{returnedMrrRate.toFixed(1)}%</div>
                <div className="text-[7.5px] text-emerald-700 font-bold uppercase mt-0.5">Recuperado</div>
              </div>
            </div>

            <div className="text-[8.5px] space-y-1">
              <div className="font-bold text-slate-900 border-b border-slate-200 pb-0.5">
                TOTAL: {formatCurrency(totalMrr)}
              </div>
              <div>
                <span className="text-emerald-700 font-bold">● Recuperado: {returnedMrrRate.toFixed(1)}%</span>
                <div className="text-slate-600 font-medium">{formatCurrency(returnedMrr)}</div>
              </div>
              <div>
                <span className="text-rose-700 font-bold">● Em Aberto: {pendingMrrRate.toFixed(1)}%</span>
                <div className="text-slate-600 font-medium">{formatCurrency(pendingMrr)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico 3: Top 5 Cidades (Barras Horizontais) */}
        <div>
          <div className="text-[9.5px] font-bold text-slate-700 uppercase tracking-wider mb-1 text-center">
            Top 5 Cidades (Bloqueios e % Retorno)
          </div>
          <div className="space-y-1.5 h-24 pt-1">
            {top5Cities.map((city) => {
              const pct = Math.round((city.totalBlocked / maxTopCityBlocked) * 100);
              return (
                <div key={city.name} className="flex items-center text-[8.5px]">
                  <span className="w-24 truncate text-slate-700 font-medium">{city.name}</span>
                  <div className="flex-1 bg-slate-100 rounded-xs h-3 ml-1 relative overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className="bg-blue-600 h-full rounded-xs flex items-center justify-end pr-1 text-[7.5px] text-white font-bold"
                    >
                      {pct > 35 ? `${city.totalBlocked} (${city.returnedRate.toFixed(0)}%)` : ''}
                    </div>
                  </div>
                  {pct <= 35 && (
                    <span className="text-[7.5px] text-slate-600 font-semibold ml-1 whitespace-nowrap">
                      {city.totalBlocked} ({city.returnedRate.toFixed(0)}%)
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. TABELA 1: DETALHAMENTO POR VENCIMENTO DE FATURA (RÉGUA DE BLOQUEIO)     */}
      {/* ========================================================================= */}
      <div className="print-section print-avoid-break mb-3">
        <div className="flex items-center space-x-1.5 mb-1 section-title">
          <span className="w-1.5 h-3.5 bg-blue-600 rounded-xs inline-block" />
          <h2 className="text-[10px] font-bold text-slate-900 uppercase tracking-wide">
            1. Detalhamento por Vencimento de Fatura (Régua de Bloqueio)
          </h2>
        </div>
        <table className="w-full text-[8.5px] border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-left">
              <th className="py-1 px-1.5">VENCIMENTO • PERÍODO DE BLOQUEIO</th>
              <th className="py-1 px-1.5 text-right">TOTAL BLOQUEADOS</th>
              <th className="py-1 px-1.5 text-right text-emerald-800">VOLTARAM (ATIVOS)</th>
              <th className="py-1 px-1.5 text-right text-rose-800">NÃO VOLTARAM</th>
              <th className="py-1 px-1.5 text-right">TAXA DE RETORNO</th>
              <th className="py-1 px-1.5 text-right">FATURAMENTO BLOQUEADO</th>
              <th className="py-1 px-1.5 text-right">VALOR RECUPERADO</th>
              <th className="py-1 px-1.5 text-right">VALOR PENDENTE</th>
            </tr>
          </thead>
          <tbody>
            {sortedCycles.map((cycle) => {
              const pendingVal = cycle.totalMrr - cycle.returnedMrr;
              const pendingC = cycle.totalBlocked - cycle.returnedCount;
              return (
                <tr key={cycle.name} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="py-0.5 px-1.5 font-semibold text-slate-800">
                    <div>{cycle.name.replace(' (Venc. Dia ', ' (Dia ').replace(')', ')')}</div>
                    <div className="text-[7.5px] font-normal text-slate-400">{getCycleSubtitle(cycle.name)}</div>
                  </td>
                  <td className="py-0.5 px-1.5 text-right font-medium">{formatNumber(cycle.totalBlocked)}</td>
                  <td className="py-0.5 px-1.5 text-right font-bold text-emerald-700">{formatNumber(cycle.returnedCount)}</td>
                  <td className="py-0.5 px-1.5 text-right font-bold text-rose-700">{formatNumber(pendingC)}</td>
                  <td className="py-0.5 px-1.5 text-right font-bold text-slate-900">{cycle.returnedRate.toFixed(1)}%</td>
                  <td className="py-0.5 px-1.5 text-right font-mono">{formatCurrency(cycle.totalMrr)}</td>
                  <td className="py-0.5 px-1.5 text-right font-mono text-emerald-700 font-semibold">{formatCurrency(cycle.returnedMrr)}</td>
                  <td className="py-0.5 px-1.5 text-right font-mono text-rose-700 font-semibold">{formatCurrency(pendingVal)}</td>
                </tr>
              );
            })}
            <tr className="bg-slate-100/90 font-bold border-t-2 border-slate-300 text-slate-900">
              <td className="py-1 px-1.5 uppercase font-black">Total Consolidado</td>
              <td className="py-1 px-1.5 text-right font-black">{formatNumber(totalBlocked)}</td>
              <td className="py-1 px-1.5 text-right font-black text-emerald-800">{formatNumber(returnedCount)}</td>
              <td className="py-1 px-1.5 text-right font-black text-rose-800">{formatNumber(pendingCount)}</td>
              <td className="py-1 px-1.5 text-right font-black text-slate-900">{returnedRate.toFixed(1)}%</td>
              <td className="py-1 px-1.5 text-right font-mono font-black">{formatCurrency(totalMrr)}</td>
              <td className="py-1 px-1.5 text-right font-mono font-black text-emerald-800">{formatCurrency(returnedMrr)}</td>
              <td className="py-1 px-1.5 text-right font-mono font-black text-rose-800">{formatCurrency(pendingMrr)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* 5. TABELA 2: DISTRIBUIÇÃO POR PLANO DE ACESSO (TODOS OS PLANOS)           */}
      {/* ========================================================================= */}
      <div className="print-section print-avoid-break mb-3">
        <div className="flex items-center space-x-1.5 mb-1 section-title">
          <span className="w-1.5 h-3.5 bg-blue-600 rounded-xs inline-block" />
          <h2 className="text-[10px] font-bold text-slate-900 uppercase tracking-wide">
            2. Distribuição por Plano de Acesso ({allPlans.length} Planos Cadastrados)
          </h2>
        </div>
        <table className="w-full text-[8.5px] border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-left">
              <th className="py-1 px-1.5">PLANO DE ACESSO</th>
              <th className="py-1 px-1.5 text-right">PREÇO MÉDIO</th>
              <th className="py-1 px-1.5 text-right">BLOQUEIOS</th>
              <th className="py-1 px-1.5 text-right text-emerald-800">VOLTARAM (ATIVO)</th>
              <th className="py-1 px-1.5 text-right text-rose-800">PENDENTES</th>
              <th className="py-1 px-1.5 text-right">% RETORNO</th>
              <th className="py-1 px-1.5 text-right">FATURAMENTO PENDENTE</th>
            </tr>
          </thead>
          <tbody>
            {allPlans.map((p) => {
              const pendCount = p.totalBlocked - p.returnedCount;
              const pendVal = p.totalMrr - p.returnedMrr;
              const avgPrice = p.totalBlocked > 0 ? p.totalMrr / p.totalBlocked : 0;
              return (
                <tr key={p.name} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="py-0.5 px-1.5 font-medium text-slate-800" title={p.name}>
                    {p.name}
                  </td>
                  <td className="py-0.5 px-1.5 text-right text-slate-600 font-mono">{formatCurrency(avgPrice)}</td>
                  <td className="py-0.5 px-1.5 text-right font-medium">{formatNumber(p.totalBlocked)}</td>
                  <td className="py-0.5 px-1.5 text-right text-emerald-700 font-bold">{formatNumber(p.returnedCount)}</td>
                  <td className="py-0.5 px-1.5 text-right text-rose-700 font-bold">{formatNumber(pendCount)}</td>
                  <td className="py-0.5 px-1.5 text-right font-semibold text-slate-900">{p.returnedRate.toFixed(1)}%</td>
                  <td className="py-0.5 px-1.5 text-right font-mono text-rose-700 font-semibold">{formatCurrency(pendVal)}</td>
                </tr>
              );
            })}
            <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
              <td className="py-1 px-1.5 uppercase font-black">TOTAL ({allPlans.length} PLANOS)</td>
              <td className="py-1 px-1.5 text-right font-mono">—</td>
              <td className="py-1 px-1.5 text-right font-black">{formatNumber(totalBlocked)}</td>
              <td className="py-1 px-1.5 text-right font-black text-emerald-800">{formatNumber(returnedCount)}</td>
              <td className="py-1 px-1.5 text-right font-black text-rose-800">{formatNumber(pendingCount)}</td>
              <td className="py-1 px-1.5 text-right font-black">{returnedRate.toFixed(1)}%</td>
              <td className="py-1 px-1.5 text-right font-mono font-black text-rose-800">{formatCurrency(pendingMrr)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Rodapé da Página 1 */}
      <div className="flex justify-between items-center text-[8px] text-slate-400 pt-1.5 border-t border-slate-200 mt-2 mb-2">
        <div>Relatório Gerencial de Inadimplência • Módulo de Bloqueios & Cobrança ISP</div>
        <div>Sol Provedor de Internet • Documento Confidencial • Página 1 de 2</div>
      </div>

      {/* ========================================================================= */}
      {/* QUEBRA DE PÁGINA: INÍCIO DA PÁGINA 2                                       */}
      {/* ========================================================================= */}
      <div className="print-page-break my-5 border-t-2 border-dashed border-slate-300 print:border-none print:my-0 print:p-0 relative">
        <div className="print:hidden text-center -mt-2.5 mb-4">
          <span className="bg-slate-200 text-slate-700 font-bold text-[9.5px] px-2.5 py-0.5 rounded shadow-2xs">
            Início da Página 2 (A4)
          </span>
        </div>
      </div>

      {/* Cabeçalho de Continuação da Página 2 */}
      <div className="flex justify-between items-center pb-1.5 mb-3 border-b border-slate-200 text-[8.5px] text-slate-500">
        <span className="font-bold text-slate-700 uppercase tracking-wide">
          Sol Telecom • Relatório Executivo de Inadimplência & Recuperação
        </span>
        <span className="font-semibold text-slate-600">
          Competência: {monthName} • Página 2 de 2
        </span>
      </div>

      {/* ========================================================================= */}
      {/* 6. TABELA 3: SITUAÇÃO CADASTRAL NO PROVEDOR                                */}
      {/* ========================================================================= */}
      <div className="print-section print-avoid-break mb-3">
        <div className="flex items-center space-x-1.5 mb-1 section-title">
          <span className="w-1.5 h-3.5 bg-blue-600 rounded-xs inline-block" />
          <h2 className="text-[10px] font-bold text-slate-900 uppercase tracking-wide">
            3. Situação Cadastral no Provedor
          </h2>
        </div>
        <table className="w-full text-[8.5px] border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-left">
              <th className="py-1 px-1.5">SITUAÇÃO ATUAL NO RBX</th>
              <th className="py-1 px-1.5 text-right">CONTRATOS</th>
              <th className="py-1 px-1.5 text-right">% DA BASE</th>
              <th className="py-1 px-1.5 text-right">FATURAMENTO (MRR)</th>
              <th className="py-1 px-1.5 text-center">CLASSIFICAÇÃO</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100 hover:bg-slate-50/50">
              <td className="py-1 px-1.5 font-medium text-slate-800">Ativo (Recuperado)</td>
              <td className="py-1 px-1.5 text-right font-semibold text-slate-900">{formatNumber(returnedCount)}</td>
              <td className="py-1 px-1.5 text-right font-medium">{totalBlocked > 0 ? ((returnedCount / totalBlocked) * 100).toFixed(1) : '0'}%</td>
              <td className="py-1 px-1.5 text-right font-mono text-emerald-700 font-semibold">{formatCurrency(returnedMrr)}</td>
              <td className="py-1 px-1.5 text-center">
                <span className="bg-emerald-100 text-emerald-800 text-[7.5px] font-bold px-1.5 py-0.2 rounded">Regularizado</span>
              </td>
            </tr>
            <tr className="border-b border-slate-100 hover:bg-slate-50/50">
              <td className="py-1 px-1.5 font-medium text-slate-800">Bloqueado</td>
              <td className="py-1 px-1.5 text-right font-semibold text-slate-900">{formatNumber(blockedCount)}</td>
              <td className="py-1 px-1.5 text-right font-medium">{totalBlocked > 0 ? ((blockedCount / totalBlocked) * 100).toFixed(1) : '0'}%</td>
              <td className="py-1 px-1.5 text-right font-mono text-slate-700 font-semibold">{formatCurrency(blockedMrr)}</td>
              <td className="py-1 px-1.5 text-center">
                <span className="bg-slate-100 text-slate-800 text-[7.5px] font-bold px-1.5 py-0.2 rounded">Inadimplente</span>
              </td>
            </tr>
            <tr className="border-b border-slate-100 hover:bg-slate-50/50">
              <td className="py-1 px-1.5 font-medium text-slate-800">Suspenso</td>
              <td className="py-1 px-1.5 text-right font-semibold text-slate-900">{formatNumber(suspendedCount)}</td>
              <td className="py-1 px-1.5 text-right font-medium">{totalBlocked > 0 ? ((suspendedCount / totalBlocked) * 100).toFixed(1) : '0'}%</td>
              <td className="py-1 px-1.5 text-right font-mono text-amber-700 font-semibold">{formatCurrency(suspendedMrr)}</td>
              <td className="py-1 px-1.5 text-center">
                <span className="bg-amber-100 text-amber-800 text-[7.5px] font-bold px-1.5 py-0.2 rounded">Suspensão</span>
              </td>
            </tr>
            <tr className="border-b border-slate-100 hover:bg-slate-50/50">
              <td className="py-1 px-1.5 font-medium text-slate-800">Cancelado (Churn)</td>
              <td className="py-1 px-1.5 text-right font-semibold text-slate-900">{formatNumber(churnedCount)}</td>
              <td className="py-1 px-1.5 text-right font-medium">{totalBlocked > 0 ? ((churnedCount / totalBlocked) * 100).toFixed(2) : '0'}%</td>
              <td className="py-1 px-1.5 text-right font-mono text-rose-700 font-semibold">{formatCurrency(churnedMrr)}</td>
              <td className="py-1 px-1.5 text-center">
                <span className="bg-rose-100 text-rose-800 text-[7.5px] font-bold px-1.5 py-0.2 rounded">Churn</span>
              </td>
            </tr>
            {otherCount > 0 && (
              <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="py-1 px-1.5 font-medium text-slate-800">Transferido / Outro</td>
                <td className="py-1 px-1.5 text-right font-semibold text-slate-900">{formatNumber(otherCount)}</td>
                <td className="py-1 px-1.5 text-right font-medium">{totalBlocked > 0 ? ((otherCount / totalBlocked) * 100).toFixed(2) : '0'}%</td>
                <td className="py-1 px-1.5 text-right font-mono text-slate-500 font-semibold">{formatCurrency(otherMrr)}</td>
                <td className="py-1 px-1.5 text-center">
                  <span className="bg-cyan-100 text-cyan-800 text-[7.5px] font-bold px-1.5 py-0.2 rounded">Transferido</span>
                </td>
              </tr>
            )}
            <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
              <td className="py-1 px-1.5 uppercase font-black">TOTAL CADASTRAL</td>
              <td className="py-1 px-1.5 text-right font-black">{formatNumber(totalBlocked + otherCount)}</td>
              <td className="py-1 px-1.5 text-right font-black">100,0%</td>
              <td className="py-1 px-1.5 text-right font-mono font-black">{formatCurrency(totalMrr + otherMrr)}</td>
              <td className="py-1 px-1.5 text-center font-black">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* 7. TABELA 4: DESEMPENHO REGIONAL POR CIDADE (TODAS AS CIDADES)             */}
      {/* ========================================================================= */}
      <div className="print-section print-avoid-break mb-3">
        <div className="flex items-center space-x-1.5 mb-1 section-title">
          <span className="w-1.5 h-3.5 bg-blue-600 rounded-xs inline-block" />
          <h2 className="text-[10px] font-bold text-slate-900 uppercase tracking-wide">
            4. Desempenho Regional por Cidade ({allCities.length} Cidades Cadastradas)
          </h2>
        </div>
        <table className="w-full text-[8.5px] border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-left">
              <th className="py-1 px-1.5">CIDADE</th>
              <th className="py-1 px-1.5 text-right">TOTAL BLOQUEIOS</th>
              <th className="py-1 px-1.5 text-right text-emerald-800">VOLTARAM (ATIVOS)</th>
              <th className="py-1 px-1.5 text-right text-rose-800">NÃO VOLTARAM</th>
              <th className="py-1 px-1.5 text-right">TAXA DE RETORNO</th>
              <th className="py-1 px-1.5 text-right">FATURAMENTO BLOQUEADO</th>
              <th className="py-1 px-1.5 text-right">VALOR RECUPERADO</th>
              <th className="py-1 px-1.5 text-right">VALOR PENDENTE</th>
            </tr>
          </thead>
          <tbody>
            {allCities.map((city) => {
              const pendVal = city.totalMrr - city.returnedMrr;
              const pendC = city.totalBlocked - city.returnedCount;
              const isBoaVista = city.name.toLowerCase().includes('boa vista');
              const bairrosStr = topBairrosMap[city.name];

              return (
                <tr key={city.name} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="py-0.5 px-1.5 font-semibold text-slate-800">
                    <div className="flex items-center space-x-1">
                      <span>{city.name}</span>
                      {isBoaVista && (
                        <span className="text-[6.5px] bg-sky-100 text-sky-800 border border-sky-300 font-bold px-1 py-0.2 rounded whitespace-nowrap">
                          Distrito de Quatipuru
                        </span>
                      )}
                    </div>
                    {bairrosStr && (
                      <div className="text-[6.8px] text-slate-500 font-normal leading-tight mt-0.5">
                        <span className="text-slate-400">Vilas/Bairros:</span> {bairrosStr}
                      </div>
                    )}
                  </td>
                  <td className="py-0.5 px-1.5 text-right font-medium">{formatNumber(city.totalBlocked)}</td>
                  <td className="py-0.5 px-1.5 text-right font-bold text-emerald-700">{formatNumber(city.returnedCount)}</td>
                  <td className="py-0.5 px-1.5 text-right font-bold text-rose-700">{formatNumber(pendC)}</td>
                  <td className="py-0.5 px-1.5 text-right font-bold text-slate-900">{city.returnedRate.toFixed(1)}%</td>
                  <td className="py-0.5 px-1.5 text-right font-mono text-slate-700">{formatCurrency(city.totalMrr)}</td>
                  <td className="py-0.5 px-1.5 text-right font-mono text-emerald-700 font-semibold">{formatCurrency(city.returnedMrr)}</td>
                  <td className="py-0.5 px-1.5 text-right font-mono text-rose-700 font-semibold">{formatCurrency(pendVal)}</td>
                </tr>
              );
            })}
            <tr className="bg-slate-100/90 font-black border-t-2 border-slate-300 text-slate-900">
              <td className="py-1 px-1.5 uppercase font-black">TOTAL GERAL ({allCities.length} CIDADES)</td>
              <td className="py-1 px-1.5 text-right font-black">{formatNumber(totalBlocked)}</td>
              <td className="py-1 px-1.5 text-right font-black text-emerald-800">{formatNumber(returnedCount)}</td>
              <td className="py-1 px-1.5 text-right font-black text-rose-800">{formatNumber(pendingCount)}</td>
              <td className="py-1 px-1.5 text-right font-black">{returnedRate.toFixed(1)}%</td>
              <td className="py-1 px-1.5 text-right font-mono font-black">{formatCurrency(totalMrr)}</td>
              <td className="py-1 px-1.5 text-right font-mono font-black text-emerald-800">{formatCurrency(returnedMrr)}</td>
              <td className="py-1 px-1.5 text-right font-mono font-black text-rose-800">{formatCurrency(pendingMrr)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* 8. BOX FINAL: DIAGNÓSTICO E RECOMENDAÇÕES ESTRATÉGICAS PARA COBRANÇA       */}
      {/*    (SEMPRE NO FINAL DO PDF, ANTES DO RODAPÉ)                               */}
      {/* ========================================================================= */}
      <div className="recommendations-box print-avoid-break bg-sky-50/70 border border-sky-200 rounded p-3 text-[8.5px] leading-relaxed text-slate-700 mb-3">
        <div className="font-bold text-sky-950 uppercase text-[9px] mb-1.5 flex items-center space-x-1.5">
          <span className="w-1.5 h-3.5 bg-sky-600 rounded-xs inline-block" />
          <span>Diagnóstico e Recomendações Estratégicas para Cobrança</span>
        </div>
        <ul className="space-y-1.5 list-disc pl-4">
          {lowestRecoveryCycle && (
            <li>
              <strong>Atenção Prioritária no {(lowestRecoveryCycle as BreakdownItem).name.replace(' (Venc. Dia ', ' (Dia ').replace(')', ')')}:</strong> Menor taxa de recuperação ({((lowestRecoveryCycle as BreakdownItem).returnedRate).toFixed(1)}%) com {formatCurrency((lowestRecoveryCycle as BreakdownItem).totalMrr - (lowestRecoveryCycle as BreakdownItem).returnedMrr)} pendentes. Exige cobrança ativa e negociação antes do cancelamento definitivo.
            </li>
          )}
          {highestVolumeCycle && (
            <li>
              <strong>Volume Concentrado no {(highestVolumeCycle as BreakdownItem).name.replace(' (Venc. Dia ', ' (Dia ').replace(')', ')')}:</strong> Expressivo volume ({formatNumber((highestVolumeCycle as BreakdownItem).totalBlocked)} bloqueios / {formatCurrency((highestVolumeCycle as BreakdownItem).totalMrr)}). Automação de régua prévia reduz impactos no suporte.
            </li>
          )}
          {highestPendingCity && (
            <li>
              <strong>Foco Regional:</strong> A praça ({highestPendingCity.name}) concentra a maior fatia de inadimplência pendente ({formatCurrency(highestPendingCity.totalMrr - highestPendingCity.returnedMrr)}).
            </li>
          )}
        </ul>
      </div>

      {/* ========================================================================= */}
      {/* 9. RODAPÉ DE AUDITORIA & CONFIDENCIALIDADE                                 */}
      {/* ========================================================================= */}
      <div className="flex justify-between items-center text-[8px] text-slate-400 pt-1.5 border-t border-slate-200">
        <div>Relatório Gerencial de Inadimplência • Módulo de Bloqueios & Cobrança ISP</div>
        <div>Sol Provedor de Internet • Documento Confidencial • Página 2 de 2</div>
      </div>
    </div>
  );
};
