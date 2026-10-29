import React, { useMemo } from 'react';
import type { EquipamentoItem, EquipamentoSummary } from '../types';

interface EquipmentPrintReportProps {
  orders: EquipamentoItem[];
  summary: EquipamentoSummary;
  selectedMonth: string;
  hardwareUnitValue?: number;
}

// Normalização ortográfica das praças do provedor
const formatCityName = (cityName: string): string => {
  if (!cityName) return 'Não Informado';
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

export const EquipmentPrintReport: React.FC<EquipmentPrintReportProps> = ({
  orders,
  selectedMonth,
  hardwareUnitValue,
}) => {
  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatNumber = (val: number) => {
    return val.toLocaleString('pt-BR');
  };

  // Mês e Ano de competência
  const [yearStr, monthNumStr] = (selectedMonth || '2026-01').split('-');
  const monthNum = parseInt(monthNumStr || '1', 10);
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const monthName = monthNames[monthNum - 1] || 'Janeiro';

  // Custo médio estimado de reposição de hardware comodatado (ONT GPON / Roteador Dual Band)
  const HARDWARE_UNIT_VALUE = hardwareUnitValue && hardwareUnitValue > 0 ? hardwareUnitValue : 220.0;

  // Filtragem estrita dos contratos NÃO RETORNADOS (os que estão sob risco patrimonial)
  const nonReturnedOrders = useMemo(() => {
    return orders.filter(
      (o) => !o.ehDuplicado && (o.statusDesfecho === 'churned' || o.statusDesfecho === 'suspended')
    );
  }, [orders]);

  // Contratos que retornaram à base mas tiveram OS aberta no período
  const returnedOrdersWithOS = useMemo(() => {
    return orders.filter((o) => !o.ehDuplicado && o.statusDesfecho === 'returned');
  }, [orders]);

  // Totalizadores consolidados
  const totalNonReturned = nonReturnedOrders.length;
  const churnCount = nonReturnedOrders.filter((o) => o.statusDesfecho === 'churned').length;
  const suspendedCount = nonReturnedOrders.filter((o) => o.statusDesfecho === 'suspended').length;

  let recoveredCount = 0;
  let attemptingCount = 0;
  let lostCount = 0;
  let activeRecoveryCount = 0;
  let withoutOSCount = 0;

  nonReturnedOrders.forEach((o) => {
    const s = o.statusFinal || o.statusManual || o.statusRecuperacao;
    if (s === 'recuperado') recoveredCount++;
    else if (s === 'tentando' || s === 'pendente' || s === 'em_andamento') attemptingCount++;
    else if (s === 'perdido') lostCount++;
    else if (s === 'ativo_cobranca' || s === 'cancelamento_abortado') activeRecoveryCount++;
    else if (s === 'sem_os') withoutOSCount++;
  });

  const recoveryRate = totalNonReturned > 0 ? (recoveredCount / totalNonReturned) * 100 : 0;
  const osEffectivenessRate = (recoveredCount + attemptingCount + lostCount) > 0
    ? (recoveredCount / (recoveredCount + attemptingCount + lostCount)) * 100
    : 0;

  // Estimativas patrimoniais
  const totalHardwareRiskValue = totalNonReturned * HARDWARE_UNIT_VALUE;
  const recoveredValue = recoveredCount * HARDWARE_UNIT_VALUE;
  const withoutOSValue = withoutOSCount * HARDWARE_UNIT_VALUE;
  const lostValue = lostCount * HARDWARE_UNIT_VALUE;

  // Agrupamento por Cidade
  const cityStats = useMemo(() => {
    const map = new Map<string, {
      cidade: string;
      total: number;
      recuperados: number;
      tentando: number;
      semOS: number;
      perdidos: number;
      ativoCobranca: number;
      taxa: number;
    }>();

    nonReturnedOrders.forEach((o) => {
      const cidade = formatCityName(o.cidade);
      if (!map.has(cidade)) {
        map.set(cidade, {
          cidade,
          total: 0,
          recuperados: 0,
          tentando: 0,
          semOS: 0,
          perdidos: 0,
          ativoCobranca: 0,
          taxa: 0,
        });
      }
      const item = map.get(cidade)!;
      item.total++;
      const s = o.statusFinal || o.statusManual || o.statusRecuperacao;
      if (s === 'recuperado') item.recuperados++;
      else if (s === 'tentando' || s === 'pendente' || s === 'em_andamento') item.tentando++;
      else if (s === 'perdido') item.perdidos++;
      else if (s === 'ativo_cobranca' || s === 'cancelamento_abortado') item.ativoCobranca++;
      else if (s === 'sem_os') item.semOS++;
    });

    const list = Array.from(map.values()).map((c) => ({
      ...c,
      taxa: c.total > 0 ? Math.round((c.recuperados / c.total) * 1000) / 10 : 0,
    }));

    return list.sort((a, b) => b.total - a.total);
  }, [nonReturnedOrders]);

  // Casos Críticos e Auditoria (chamados reais + clientes auditados)
  const criticalAuditCases = useMemo(() => {
    return nonReturnedOrders
      .filter((o) => o.statusRecuperacao !== 'sem_os' || o.statusManual || o.observacaoManual)
      .slice(0, 10);
  }, [nonReturnedOrders]);

  // Geometria Donut SVG
  const radius = 38;
  const circumference = 2 * Math.PI * radius; // ~238.76
  const recOffset = circumference - (recoveryRate / 100) * circumference;

  return (
    <div className="executive-print-sheet bg-white text-slate-800 p-4 font-sans text-xs select-none">
      {/* ========================================================================= */}
      {/* 1. CABEÇALHO EXECUTIVO                                                    */}
      {/* ========================================================================= */}
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3 mb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-slate-900 text-white font-black px-2 py-0.5 rounded text-[10px] tracking-wider uppercase">
              Auditoria de Hardware
            </span>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              Controle de Patrimônio ISP
            </span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-tight mt-1">
            Relatório Executivo de Recuperação de Equipamentos
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            Eficácia de recolhimento de roteadores e ONTs dos clientes não retornados na competência
          </p>
        </div>
        <div className="text-right">
          <div className="inline-block bg-sky-100 text-sky-900 font-bold px-2.5 py-0.5 rounded text-[11px] tracking-wide">
            Competência: {monthName} / {yearStr}
          </div>
          <div className="text-[9.5px] text-slate-400 mt-1">
            Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-[9.5px] font-semibold text-slate-600">
            Provedor: Sol Telecom • Gestão de Ativos & Hardware
          </div>
          <div className="text-[9px] text-slate-500 font-mono mt-0.5">
            Ref. Custo Unitário: <strong>{formatCurrency(HARDWARE_UNIT_VALUE)}/aparelho</strong>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CARDS DE KPIS EXECUTIVOS (2 LINHAS DE 3 CARDS)                         */}
      {/* ========================================================================= */}
      <div className="print-section print-avoid-break grid grid-cols-3 gap-2.5 mb-3.5">
        {/* Card 1: Total Não Retornados em Risco */}
        <div className="bg-slate-50/80 border border-slate-200 rounded p-2.5 relative">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">
              Hardware em Risco (Não Retornados)
            </span>
            <span className="bg-slate-200 text-slate-800 text-[8.5px] font-bold px-1.5 py-0.2 rounded">
              100% Inadimplentes
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1.5 leading-none">
            {formatNumber(totalNonReturned)} <span className="text-xs font-normal text-slate-500">aparelhos</span>
          </div>
          <div className="text-[8.5px] font-semibold text-slate-700 mt-1.5 flex justify-between">
            <span>Patrimônio Estimado:</span>
            <span>{formatCurrency(totalHardwareRiskValue)}</span>
          </div>
          <div className="text-[8px] text-slate-400 mt-0.5">
            {churnCount} Cancelados (Churn) • {suspendedCount} Suspensos
          </div>
        </div>

        {/* Card 2: Equipamentos Recuperados */}
        <div className="bg-emerald-50/50 border-l-4 border-l-emerald-500 border border-slate-200 rounded p-2.5 relative">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-emerald-900 uppercase tracking-wider">
              Equipamentos Recuperados
            </span>
            <span className="bg-emerald-100 text-emerald-800 text-[8.5px] font-bold px-1.5 py-0.2 rounded">
              {recoveryRate.toFixed(1)}% Taxa Geral
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1.5 leading-none">
            {formatNumber(recoveredCount)} <span className="text-xs font-normal text-emerald-600">recolhidos</span>
          </div>
          <div className="text-[8.5px] font-semibold text-emerald-800 mt-1.5 flex justify-between">
            <span>Patrimônio Salvo:</span>
            <span>{formatCurrency(recoveredValue)}</span>
          </div>
          <div className="text-[8px] text-emerald-600/80 mt-0.5">
            Eficácia de campo: {osEffectivenessRate.toFixed(1)}% quando técnico vai à residência
          </div>
        </div>

        {/* Card 3: Ponto Cego (Sem OS Aberta) */}
        <div className="bg-amber-50/50 border-l-4 border-l-amber-500 border border-slate-200 rounded p-2.5 relative">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-amber-900 uppercase tracking-wider">
              Sem OS no RBX (Ponto Cego)
            </span>
            <span className="bg-amber-100 text-amber-800 text-[8.5px] font-bold px-1.5 py-0.2 rounded">
              {totalNonReturned > 0 ? ((withoutOSCount / totalNonReturned) * 100).toFixed(1) : 0}% da Base em Risco
            </span>
          </div>
          <div className="text-2xl font-black text-amber-700 mt-1.5 leading-none">
            {formatNumber(withoutOSCount)} <span className="text-xs font-normal text-amber-600">com o cliente</span>
          </div>
          <div className="text-[8.5px] font-semibold text-amber-800 mt-1.5 flex justify-between">
            <span>Risco Descoberto:</span>
            <span>{formatCurrency(withoutOSValue)}</span>
          </div>
          <div className="text-[8px] text-amber-700/80 mt-0.5">
            Contratos inadimplentes/churn sem chamado de retirada no RBX
          </div>
        </div>

        {/* Card 4: Tentando Recuperação */}
        <div className="bg-blue-50/40 border-l-4 border-l-blue-500 border border-slate-200 rounded p-2.5 relative">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-blue-900 uppercase tracking-wider">
              Tentando / Em Andamento
            </span>
            <span className="bg-blue-100 text-blue-800 text-[8.5px] font-bold px-1.5 py-0.2 rounded">
              Em Campo
            </span>
          </div>
          <div className="text-2xl font-black text-blue-700 mt-1.5 leading-none">
            {formatNumber(attemptingCount)} <span className="text-xs font-normal text-blue-600">em rota</span>
          </div>
          <div className="text-[8.5px] font-semibold text-blue-800 mt-1.5 flex justify-between">
            <span>Valor em Recolhimento:</span>
            <span>{formatCurrency(attemptingCount * HARDWARE_UNIT_VALUE)}</span>
          </div>
          <div className="text-[8px] text-blue-600/80 mt-0.5">
            Chamados com agendamento técnico ou cliente ausente
          </div>
        </div>

        {/* Card 5: Extraviados / Perdidos */}
        <div className="bg-rose-50/40 border-l-4 border-l-rose-500 border border-slate-200 rounded p-2.5 relative">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-rose-900 uppercase tracking-wider">
              Extraviados / Perdidos
            </span>
            <span className="bg-rose-100 text-rose-800 text-[8.5px] font-bold px-1.5 py-0.2 rounded">
              Insucesso
            </span>
          </div>
          <div className="text-2xl font-black text-rose-700 mt-1.5 leading-none">
            {formatNumber(lostCount)} <span className="text-xs font-normal text-rose-600">aparelhos</span>
          </div>
          <div className="text-[8.5px] font-semibold text-rose-800 mt-1.5 flex justify-between">
            <span>Perda Confirmada:</span>
            <span>{formatCurrency(lostValue)}</span>
          </div>
          <div className="text-[8px] text-rose-600/80 mt-0.5">
            Casa desocupada / cliente mudou sem devolver hardware
          </div>
        </div>

        {/* Card 6: Revertidos pela Cobrança */}
        <div className="bg-purple-50/40 border-l-4 border-l-purple-500 border border-slate-200 rounded p-2.5 relative">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-purple-900 uppercase tracking-wider">
              Voltou Ativo (Cobrança)
            </span>
            <span className="bg-purple-100 text-purple-800 text-[8.5px] font-bold px-1.5 py-0.2 rounded">
              Reativado
            </span>
          </div>
          <div className="text-2xl font-black text-purple-700 mt-1.5 leading-none">
            {formatNumber(activeRecoveryCount)} <span className="text-xs font-normal text-purple-600">ativos</span>
          </div>
          <div className="text-[8.5px] font-semibold text-purple-800 mt-1.5 flex justify-between">
            <span>Hardware Mantido:</span>
            <span>{formatCurrency(activeRecoveryCount * HARDWARE_UNIT_VALUE)}</span>
          </div>
          <div className="text-[8px] text-purple-600/80 mt-0.5">
            Negociou débito e manteve conexão ativa (+{returnedOrdersWithOS.length} com OS cancelada)
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. DIAGNÓSTICO VISUAL: FUNIL DE RECOLHIMENTO & DONUT DE PATRIMÔNIO         */}
      {/* ========================================================================= */}
      <div className="print-section print-avoid-break grid grid-cols-2 gap-3 mb-3.5">
        {/* Painel Esquerdo: Funil Operacional de Recuperação */}
        <div className="border border-slate-200 rounded p-3 bg-white">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2">
            <span className="font-bold text-slate-900 uppercase text-[10px]">
              Funil de Efetividade da Operação Técnica
            </span>
            <span className="text-[9px] text-slate-400 font-semibold">Fluxo de Recolhimento</span>
          </div>

          <div className="space-y-2 mt-1">
            {/* Etapa 1 */}
            <div>
              <div className="flex justify-between text-[9px] font-bold text-slate-700 mb-0.5">
                <span>1. Contratos Inadimplentes que Não Voltaram</span>
                <span>{totalNonReturned} (100%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div className="bg-slate-800 h-3 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>

            {/* Etapa 2 */}
            <div>
              <div className="flex justify-between text-[9px] font-bold text-blue-900 mb-0.5">
                <span>2. Ordens de Retirada Abertas no RBX</span>
                <span>
                  {recoveredCount + attemptingCount + lostCount} (
                  {totalNonReturned > 0
                    ? (((recoveredCount + attemptingCount + lostCount) / totalNonReturned) * 100).toFixed(1)
                    : 0}
                  %)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-blue-600 h-3 rounded-full"
                  style={{
                    width: `${totalNonReturned > 0 ? ((recoveredCount + attemptingCount + lostCount) / totalNonReturned) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Etapa 3 */}
            <div>
              <div className="flex justify-between text-[9px] font-bold text-emerald-900 mb-0.5">
                <span>3. Equipamentos Recolhidos com Sucesso</span>
                <span>
                  {recoveredCount} ({recoveryRate.toFixed(1)}% do total • {osEffectivenessRate.toFixed(1)}% das OS)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-emerald-500 h-3 rounded-full"
                  style={{ width: `${Math.min(recoveryRate, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded p-2 mt-2.5 text-[9px] text-slate-600 leading-relaxed">
            <strong>Conclusão Técnica:</strong> A equipe de campo possui alta taxa de êxito (
            <strong>{osEffectivenessRate.toFixed(1)}%</strong>) quando o chamado é aberto. O gargalo
            crítico é que <strong>{withoutOSCount} clientes ({totalNonReturned > 0 ? ((withoutOSCount / totalNonReturned) * 100).toFixed(1) : 0}%)</strong> permanecem
            sem OS de retirada gerada no RBX.
          </div>
        </div>

        {/* Painel Direito: Gráfico Donut de Destino do Hardware */}
        <div className="border border-slate-200 rounded p-3 bg-white flex flex-col justify-between">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2">
            <span className="font-bold text-slate-900 uppercase text-[10px]">
              Destino do Hardware em Risco
            </span>
            <span className="text-[9px] text-slate-400 font-semibold">Distribuição do Lote</span>
          </div>

          <div className="flex items-center justify-around py-1">
            {/* SVG Donut */}
            <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
              <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke="#f1f5f9"
                  strokeWidth="14"
                  fill="transparent"
                />
                {/* Segmento Sem OS (Âmbar) */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke="#f59e0b"
                  strokeWidth="14"
                  strokeDasharray={circumference}
                  strokeDashoffset={0}
                  fill="transparent"
                />
                {/* Segmento Recuperados (Verde) */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke="#10b981"
                  strokeWidth="14"
                  strokeDasharray={circumference}
                  strokeDashoffset={recOffset}
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-black text-slate-900 leading-none">
                  {recoveryRate.toFixed(1)}%
                </span>
                <span className="text-[7.5px] font-bold text-emerald-700 uppercase">Recuperado</span>
              </div>
            </div>

            {/* Legenda do Donut */}
            <div className="space-y-1.5 text-[9px] font-semibold text-slate-700">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500 shrink-0"></span>
                <span>Recuperados: <strong>{recoveredCount}</strong> ({recoveryRate.toFixed(1)}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-amber-500 shrink-0"></span>
                <span>Sem OS Aberta: <strong>{withoutOSCount}</strong> ({totalNonReturned > 0 ? ((withoutOSCount / totalNonReturned) * 100).toFixed(1) : 0}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-blue-500 shrink-0"></span>
                <span>Tentando Recolher: <strong>{attemptingCount}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-rose-500 shrink-0"></span>
                <span>Extraviados/Perdidos: <strong>{lostCount}</strong></span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-1.5 flex justify-between text-[8.5px] text-slate-500">
            <span>Aparelhos auditados: <strong>{totalNonReturned}</strong></span>
            <span>Retornaram e mantiveram hardware: <strong>+{returnedOrdersWithOS.length}</strong></span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. TABELA EXECUTIVA POR PRAÇA / CIDADE                                    */}
      {/* ========================================================================= */}
      <div className="print-section print-avoid-break mb-3.5">
        <div className="flex justify-between items-center mb-1.5">
          <span className="font-bold text-slate-900 uppercase text-[10px]">
            Desempenho e Exposição Patrimonial por Cidade / Praça
          </span>
          <span className="text-[8.5px] text-slate-500">
            Ordenado pelo volume de contratos não retornados
          </span>
        </div>

        <div className="border border-slate-200 rounded overflow-hidden">
          <table className="w-full text-left text-[9px] border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[8px] tracking-wider">
                <th className="py-1.5 px-2">Cidade / Praça</th>
                <th className="py-1.5 px-2 text-right">Não Retornados</th>
                <th className="py-1.5 px-2 text-right text-emerald-800">Recuperados</th>
                <th className="py-1.5 px-2 text-right text-blue-800">Tentando</th>
                <th className="py-1.5 px-2 text-right text-amber-800">Sem OS</th>
                <th className="py-1.5 px-2 text-right text-rose-800">Perdidos</th>
                <th className="py-1.5 px-2 text-right">Taxa Recuperação</th>
                <th className="py-1.5 px-2 text-right">Risco Patrimonial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cityStats.map((c, i) => {
                const isBoaVista = c.cidade.toLowerCase().includes('boa vista');
                return (
                  <tr key={c.cidade} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="py-1 px-2 font-bold text-slate-900">
                      <div className="flex items-center space-x-1">
                        <span>{c.cidade}</span>
                        {isBoaVista && (
                          <span className="text-[6.5px] bg-sky-100 text-sky-800 border border-sky-300 font-bold px-1 py-0.2 rounded whitespace-nowrap">
                            Distrito de Quatipuru
                          </span>
                        )}
                      </div>
                    </td>
                  <td className="py-1 px-2 text-right font-semibold">{c.total}</td>
                  <td className="py-1 px-2 text-right font-bold text-emerald-700">{c.recuperados}</td>
                  <td className="py-1 px-2 text-right text-blue-700">{c.tentando}</td>
                  <td className="py-1 px-2 text-right font-bold text-amber-700">{c.semOS}</td>
                  <td className="py-1 px-2 text-right text-rose-700">{c.perdidos}</td>
                  <td className="py-1 px-2 text-right font-extrabold text-slate-800">
                    <span className={c.taxa >= 50 ? 'text-emerald-700' : c.taxa > 0 ? 'text-amber-700' : 'text-slate-400'}>
                      {c.taxa.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-1 px-2 text-right font-mono text-[8.5px] text-slate-700">
                    {formatCurrency(c.total * HARDWARE_UNIT_VALUE)}
                  </td>
                </tr>
              );
            })}
              <tr className="bg-slate-100 font-bold border-t border-slate-300 text-slate-900">
                <td className="py-1.5 px-2 uppercase">Total Geral</td>
                <td className="py-1.5 px-2 text-right">{totalNonReturned}</td>
                <td className="py-1.5 px-2 text-right text-emerald-800">{recoveredCount}</td>
                <td className="py-1.5 px-2 text-right text-blue-800">{attemptingCount}</td>
                <td className="py-1.5 px-2 text-right text-amber-800">{withoutOSCount}</td>
                <td className="py-1.5 px-2 text-right text-rose-800">{lostCount}</td>
                <td className="py-1.5 px-2 text-right text-emerald-800">{recoveryRate.toFixed(1)}%</td>
                <td className="py-1.5 px-2 text-right font-mono text-[9px]">
                  {formatCurrency(totalHardwareRiskValue)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. AUDITORIA DOS CHAMADOS TÉCNICOS & CASOS CRÍTICOS                        */}
      {/* ========================================================================= */}
      {criticalAuditCases.length > 0 && (
        <div className="print-section print-avoid-break mb-3.5">
          <div className="flex justify-between items-center mb-1.5">
            <span className="font-bold text-slate-900 uppercase text-[10px]">
              Amostra de Auditoria Operacional & Ordens de Recolhimento
            </span>
            <span className="text-[8.5px] text-slate-500">
              Registros com OS executada, equipamentos serializados ou notas da auditoria
            </span>
          </div>

          <div className="border border-slate-200 rounded overflow-hidden">
            <table className="w-full text-left text-[8.5px] border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[7.5px] tracking-wider">
                  <th className="py-1 px-2">Cliente / Cód</th>
                  <th className="py-1 px-2">Praça</th>
                  <th className="py-1 px-2">Status Coorte</th>
                  <th className="py-1 px-2">Nº OS / Data</th>
                  <th className="py-1 px-2">Equipamento / Serial</th>
                  <th className="py-1 px-2 text-center">Situação Final</th>
                  <th className="py-1 px-2">Parecer Técnico / Nota Auditoria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {criticalAuditCases.map((o) => {
                  const s = o.statusFinal || o.statusManual || o.statusRecuperacao;
                  return (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="py-1 px-2 font-bold text-slate-900">
                        {o.nomeCliente}
                        <span className="block text-[7.5px] text-slate-400 font-mono">Cód: {o.codigoCliente}</span>
                      </td>
                      <td className="py-1 px-2 text-slate-700 font-medium">{o.cidade}</td>
                      <td className="py-1 px-2">
                        {o.statusDesfecho === 'churned' ? (
                          <span className="text-rose-700 font-bold">CANCELADO</span>
                        ) : (
                          <span className="text-amber-700 font-bold">SUSPENSO</span>
                        )}
                      </td>
                      <td className="py-1 px-2 font-mono text-[8px] text-slate-600">
                        {o.statusRecuperacao === 'sem_os' ? 'Sem OS' : `#${o.id}`}
                      </td>
                      <td className="py-1 px-2 text-slate-700 truncate max-w-[150px]">
                        {o.equipamentoIdentificado || 'Comodato Padrão'}
                        {o.serialMac && o.serialMac !== '-' && (
                          <span className="block text-[7.5px] text-slate-400 font-mono">{o.serialMac}</span>
                        )}
                      </td>
                      <td className="py-1 px-2 text-center">
                        {s === 'recuperado' && (
                          <span className="bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-bold text-[8px]">
                            RECUPERADO
                          </span>
                        )}
                        {s === 'tentando' && (
                          <span className="bg-blue-100 text-blue-800 px-1 py-0.2 rounded font-bold text-[8px]">
                            TENTANDO
                          </span>
                        )}
                        {s === 'sem_os' && (
                          <span className="bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-bold text-[8px]">
                            SEM OS
                          </span>
                        )}
                        {s === 'perdido' && (
                          <span className="bg-rose-100 text-rose-800 px-1 py-0.2 rounded font-bold text-[8px]">
                            PERDIDO
                          </span>
                        )}
                        {s === 'ativo_cobranca' && (
                          <span className="bg-purple-100 text-purple-800 px-1 py-0.2 rounded font-bold text-[8px]">
                            VOLTOU ATIVO
                          </span>
                        )}
                      </td>
                      <td className="py-1 px-2 text-slate-600 max-w-[220px] truncate">
                        {o.observacaoManual ? (
                          <span className="font-semibold text-indigo-700">Nota: "{o.observacaoManual}"</span>
                        ) : (
                          o.solucao || o.causa || o.assunto || '-'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. DIAGNÓSTICO AUTOMATIZADO & RECOMENDAÇÕES ESTRATÉGICAS                   */}
      {/* ========================================================================= */}
      <div className="print-section print-avoid-break bg-slate-50 border border-slate-200 rounded p-3 mb-2">
        <div className="font-bold text-slate-900 uppercase text-[9.5px] mb-1.5 flex items-center justify-between">
          <span>Diagnóstico Executivo & Recomendações Estratégicas</span>
          <span className="text-[8px] text-slate-500 font-normal">Ações prioritárias para a Gestão de Ativos</span>
        </div>

        <div className="grid grid-cols-3 gap-2.5 text-[8.5px] text-slate-700 leading-relaxed">
          <div className="bg-white p-2 border border-slate-200 rounded">
            <strong className="block text-amber-900 font-bold mb-0.5">
              1. Eliminação do Ponto Cego de OSs:
            </strong>
            Existem <strong>{withoutOSCount} aparelhos ({formatCurrency(withoutOSValue)})</strong> em residências de clientes
            suspensos ou cancelados sem chamado aberto. Recomenda-se gerar ordens de retirada em lote imediatamente no RBX.
          </div>

          <div className="bg-white p-2 border border-slate-200 rounded">
            <strong className="block text-emerald-900 font-bold mb-0.5">
              2. Eficácia Técnica Confirmada:
            </strong>
            A taxa de recuperação quando a equipe vai ao endereço é de <strong>{osEffectivenessRate.toFixed(1)}%</strong>. O
            impedimento para atingir maior volume não é a recusa do cliente, mas sim a ausência do agendamento de campo.
          </div>

          <div className="bg-white p-2 border border-slate-200 rounded">
            <strong className="block text-blue-900 font-bold mb-0.5">
              3. Rota Concentrada por Praça:
            </strong>
            {cityStats.length > 0 ? (
              <>
                A cidade de <strong>{cityStats[0].cidade}</strong> concentra{' '}
                <strong>{cityStats[0].total} aparelhos ({cityStats[0].semOS} sem OS)</strong>. Uma força-tarefa dedicada nesta
                praça pode recuperar até <strong>{formatCurrency(cityStats[0].total * HARDWARE_UNIT_VALUE)}</strong> em estoque.
              </>
            ) : (
              'Manter o acompanhamento mensal contínuo das rotas de retirada.'
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. RODAPÉ DE VALIDAÇÃO                                                    */}
      {/* ========================================================================= */}
      <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-[8px] text-slate-400">
        <div>
          EVAD Analytics • Relatório de Gestão Patrimonial e Recuperação de Equipamentos
        </div>
        <div className="font-mono">
          Documento Oficial • Sol Telecom
        </div>
      </div>
    </div>
  );
};
