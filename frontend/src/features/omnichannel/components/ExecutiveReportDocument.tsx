import React from 'react';
import {
  OmnichannelOverviewMetrics,
  RbxCorrelationResult,
} from '../types/omnichannel.types.ts';

export interface ExecutiveReportDocumentProps {
  metrics: OmnichannelOverviewMetrics | null;
  correlation: RbxCorrelationResult | null;
  periodLabel?: string;
  batchFileName?: string;
  executiveSummaryText?: string;
  recommendationsText?: string[];
  issuedAt?: string;
  issuedBy?: string;
  selectedAgents?: string[];
}

export const ExecutiveReportDocument: React.FC<ExecutiveReportDocumentProps> = ({
  metrics,
  correlation,
  periodLabel = 'Período Corrente da Carga',
  batchFileName,
  executiveSummaryText,
  recommendationsText,
  issuedAt = new Date().toLocaleString('pt-BR'),
  issuedBy = 'Gestão de Atendimento & Operações',
  selectedAgents,
}) => {
  const vol = metrics?.volume;
  const eff = metrics?.efficiency;
  const sat = metrics?.satisfaction;
  const closures = metrics?.closures || [];
  const classifications = metrics?.classifications || [];
  const attributions = metrics?.attributions || [];

  const totalContacts = vol?.totalContacts || 0;
  const confirmedMatches = vol?.confirmedMatches || 0;
  const unregisteredContacts = (vol?.ambiguousMatches || 0) + (vol?.unmatchedContacts || 0);
  const formalizationRate = totalContacts > 0 ? (confirmedMatches / totalContacts) * 100 : (vol?.matchCoverageRate || 0);
  const unformalizedRate = Math.max(0, 100 - formalizationRate);
  const totalAgentsCount =
    selectedAgents && selectedAgents.length > 0
      ? selectedAgents.length
      : (attributions.length || (metrics?.availableAgents?.length ?? 0));

  const formatPercent = (val?: number | null, maxDecimals: number = 2) => {
    if (val === undefined || val === null || isNaN(val)) return '0%';
    return (
      new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: maxDecimals,
      }).format(val) + '%'
    );
  };

  const formatSeconds = (sec?: number | null) => {
    if (!sec || sec <= 0) return '00:00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) {
      return `${h}h ${m}m ${s}s`;
    }
    return `${m}m ${s}s`;
  };

  // Top colaborador chat e rbx
  const sortedByChat = [...attributions].sort((a, b) => b.totalContacts - a.totalContacts);
  const topChatAgent = sortedByChat[0];

  // Top motivo e gargalo
  const sortedClassifications = [...classifications].sort((a, b) => b.count - a.count);
  const topClassification = sortedClassifications[0];
  const sortedByTma = [...classifications].sort((a, b) => b.avgTmaSeconds - a.avgTmaSeconds);
  const topTmaClassification = sortedByTma[0];

  // Texto padrão da leitura gerencial caso não seja customizado
  const defaultExecutiveSummary =
    executiveSummaryText ||
    `No período analisado (${periodLabel}), a operação registrou ${totalContacts.toLocaleString('pt-BR')} atendimentos via Chat, sendo o principal canal de contato com os clientes. Destes, ${confirmedMatches.toLocaleString('pt-BR')} foram devidamente identificados e formalizados no RBXSoft ISP (${formatPercent(formalizationRate)} de cobertura), enquanto ${unregisteredContacts.toLocaleString('pt-BR')} atendimentos (${formatPercent(unformalizedRate)}) correspondem a ocorrências não vinculadas (contatos em massa, solicitações pontuais de informação ou desistências por inatividade antes da identificação).`;

  // Recomendações padrões
  const defaultRecommendations = recommendationsText || [
    'Manter o rigor no registro e encerramento dos atendimentos para assegurar a rastreabilidade integral da jornada do cliente no RBXSoft.',
    'Sustentar o ganho de cobertura cadastral alcançado no período, promovendo a unificação ativa de números múltiplos e cadastros ambíguos.',
    'Monitorar o Tempo Médio de Espera (TME) nos horários de maior fluxo, preservando a experiência do cliente dentro da faixa operacional recomendada.',
    'Aprimorar o diagnóstico remoto nas categorias de maior complexidade técnica, reduzindo a dependência de abertura de ordens de serviço presenciais.',
  ];

  return (
    <div id="executive-report-printable" className="text-slate-900 font-sans text-[11px] leading-relaxed space-y-8 print:space-y-0">
      {/* ========================================================
          PÁGINA 1: CABEÇALHO, VISÃO GERAL & ATENDIMENTOS NÃO REGISTRADOS
      ======================================================== */}
      <section className="report-page p-10 min-h-[297mm] bg-white shadow-xl rounded-xs flex flex-col justify-between border border-slate-200/90 print:border-none print:shadow-none print:rounded-none page-break">
        <div className="space-y-6">
          {/* Header Institucional */}
          <div className="flex items-start justify-between border-b-2 border-blue-900 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-900 text-white flex items-center justify-center font-black text-xl shadow-xs">
                RBX
              </div>
              <div>
                <h1 className="text-lg font-black text-blue-950 uppercase tracking-tight">
                  Relatório Executivo de Atendimentos
                </h1>
                <p className="text-xs font-semibold text-slate-600">
                  Equipe de Suporte Técnico & Atendimento — ISPCHAT × RBXSoft ISP
                </p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Ref.: {periodLabel} {batchFileName ? `· Arquivo: ${batchFileName}` : ''}
                </p>
              </div>
            </div>

            <div className="text-right text-[10px] text-slate-500 space-y-0.5">
              <span className="font-bold text-slate-700 block">RBXAnalist Intelligence</span>
              <span>Emissão: {issuedAt}</span>
              <span className="block text-slate-400">Emissor: {issuedBy}</span>
            </div>
          </div>

          {/* 1. Visão Geral da Operação */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-blue-900 text-white font-bold flex items-center justify-center text-xs">
                1
              </span>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-blue-950">
                Visão Geral da Operação
              </h2>
            </div>

            <p className="text-slate-700 text-justify">
              {defaultExecutiveSummary}
            </p>

            {/* Tabela de Indicadores Macro */}
            <table className="w-full text-left border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold uppercase text-[10px] border-b border-slate-300">
                  <th className="p-2 border-r border-slate-200">Indicador Operacional</th>
                  <th className="p-2 text-right border-r border-slate-200 w-28">Resultado</th>
                  <th className="p-2 text-right w-28">Participação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                <tr className="hover:bg-slate-50/50">
                  <td className="p-2 border-r border-slate-200 font-medium">
                    Colaboradores ativos na operação
                    {selectedAgents && selectedAgents.length > 0 && (
                      <span className="text-blue-900 font-bold text-[10px] ml-1.5 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                        ({selectedAgents.length} {selectedAgents.length === 1 ? 'colaborador selecionado' : 'colaboradores selecionados'})
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-right font-bold border-r border-slate-200">{totalAgentsCount}</td>
                  <td className="p-2 text-right text-slate-400">
                    {selectedAgents && selectedAgents.length > 0 && metrics?.availableAgents?.length
                      ? `${formatPercent((totalAgentsCount / metrics.availableAgents.length) * 100)} da equipe`
                      : '—'}
                  </td>
                </tr>
                <tr className="bg-blue-50/30 hover:bg-blue-50/50">
                  <td className="p-2 border-r border-slate-200 font-bold text-blue-950">
                    Total de Atendimentos no Chat (ISPCHAT)
                  </td>
                  <td className="p-2 text-right font-black text-blue-950 border-r border-slate-200">
                    {totalContacts.toLocaleString('pt-BR')}
                  </td>
                  <td className="p-2 text-right font-bold text-blue-950">100%</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="p-2 border-r border-slate-200 font-medium text-emerald-900">
                    Atendimentos formalizados e identificados no RBX
                  </td>
                  <td className="p-2 text-right font-bold text-emerald-800 border-r border-slate-200">
                    {confirmedMatches.toLocaleString('pt-BR')}
                  </td>
                  <td className="p-2 text-right font-bold text-emerald-700">≈ {formatPercent(formalizationRate)}</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="p-2 border-r border-slate-200 font-medium text-amber-900">
                    Atendimentos não registrados individualmente no RBX
                  </td>
                  <td className="p-2 text-right font-bold text-amber-800 border-r border-slate-200">
                    {unregisteredContacts.toLocaleString('pt-BR')}
                  </td>
                  <td className="p-2 text-right font-bold text-amber-700">≈ {formatPercent(unformalizedRate)}</td>
                </tr>
              </tbody>
            </table>

            {/* Box Leitura Gerencial */}
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-950 space-y-1">
              <span className="text-[10px] uppercase font-black tracking-wider text-blue-900 block flex items-center gap-1.5">
                <span>📌 Leitura Gerencial</span>
              </span>
              <p className="text-[10.5px] leading-relaxed text-blue-900">
                A taxa de formalização no RBX Soft alcançou <strong>{formatPercent(formalizationRate)}</strong> da volumetria total. O cruzamento exato por telefone e identificação por similaridade possibilitou mitigar divergências operacionais, reduzindo drasticamente os contatos órfãos sem rastreabilidade de ticket.
              </p>
            </div>
          </div>

          {/* 2. Atendimentos Não Registrados no RBX */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-blue-900 text-white font-bold flex items-center justify-center text-xs">
                2
              </span>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-blue-950">
                Detalhamento dos Atendimentos Não Registrados no RBX
              </h2>
            </div>

            <p className="text-slate-700">
              A análise da amostra não vinculada revela a concentração nos seguintes perfis de encerramento na plataforma:
            </p>

            <table className="w-full text-left border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold uppercase text-[10px] border-b border-slate-300">
                  <th className="p-2 border-r border-slate-200">Motivo / Tipo de Encerramento</th>
                  <th className="p-2 text-right border-r border-slate-200 w-28">Volume Registrado</th>
                  <th className="p-2 text-right w-28">Participação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {closures.slice(0, 5).map((cl, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-2 border-r border-slate-200 font-medium">{cl.type}</td>
                    <td className="p-2 text-right font-mono font-bold border-r border-slate-200">
                      {cl.total.toLocaleString('pt-BR')}
                    </td>
                    <td className="p-2 text-right font-mono">{formatPercent(cl.percentage)}</td>
                  </tr>
                ))}
                {closures.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-slate-400 italic">
                      Nenhum encerramento registrado no período selecionado.
                    </td>
                  </tr>
                )}
                <tr className="bg-slate-50 font-bold border-t border-slate-300">
                  <td className="p-2 border-r border-slate-200">Total Analisado</td>
                  <td className="p-2 text-right font-mono border-r border-slate-200">
                    {closures.reduce((acc, c) => acc + c.total, 0).toLocaleString('pt-BR')}
                  </td>
                  <td className="p-2 text-right font-mono">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Rodapé Página 1 */}
        <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-[9px] text-slate-400">
          <span>RBXAnalist · Relatório Mensal Executivo</span>
          <span>Página 1 de 3</span>
        </div>
      </section>

      {/* ========================================================
          PÁGINA 2: OCORRÊNCIAS, GARGALOS & PRODUTIVIDADE
      ======================================================== */}
      <section className="report-page p-10 min-h-[297mm] bg-white shadow-xl rounded-xs flex flex-col justify-between border border-slate-200/90 print:border-none print:shadow-none print:rounded-none page-break">
        <div className="space-y-6">
          {/* Subcabeçalho de Continuação */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-[10px] text-slate-500">
            <span className="font-bold text-slate-700">Relatório Executivo Omnichannel · {periodLabel}</span>
            <span>Seções 3 e 4</span>
          </div>

          {/* 3. Distribuição por Tipo de Ocorrência (Classificações) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-blue-900 text-white font-bold flex items-center justify-center text-xs">
                3
              </span>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-blue-950">
                Distribuição por Tipo de Ocorrência (Classificações)
              </h2>
            </div>

            <p className="text-slate-700">
              Com base nos atendimentos classificados e correlacionados, apresenta-se o ranking dos principais motivos operacionais e o tempo médio despendido:
            </p>

            <table className="w-full text-left border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold uppercase text-[10px] border-b border-slate-300">
                  <th className="p-2 border-r border-slate-200">Tipo de Ocorrência / Assunto</th>
                  <th className="p-2 text-right border-r border-slate-200 w-24">Registrados</th>
                  <th className="p-2 text-right border-r border-slate-200 w-24">% do Total</th>
                  <th className="p-2 text-right w-24">TMA Médio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {classifications.slice(0, 8).map((cl, idx) => {
                  const isHighTma = cl.avgTmaSeconds > 900;
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-2 border-r border-slate-200 font-medium">
                        <span className="font-mono text-slate-400 text-[9px] mr-1.5">#{idx + 1}</span>
                        {cl.name}
                      </td>
                      <td className="p-2 text-right font-mono font-bold border-r border-slate-200">
                        {cl.count.toLocaleString('pt-BR')}
                      </td>
                      <td className="p-2 text-right font-mono border-r border-slate-200">
                        {cl.percentage !== undefined ? formatPercent(cl.percentage) : '—'}
                      </td>
                      <td className={`p-2 text-right font-mono font-bold ${isHighTma ? 'text-amber-800' : 'text-slate-700'}`}>
                        {formatSeconds(cl.avgTmaSeconds)}
                      </td>
                    </tr>
                  );
                })}
                {classifications.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-400 italic">
                      Nenhuma classificação registrada no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Box Insight Operacional */}
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950 space-y-1">
              <span className="text-[10px] uppercase font-black tracking-wider text-amber-900 block">
                💡 Insight de Ocorrências & Gargalos
              </span>
              <p className="text-[10.5px] leading-relaxed text-amber-900">
                {topClassification
                  ? `A categoria "${topClassification.name}" é a mais representativa da operação, concentrando ${topClassification.count} atendimentos.`
                  : 'A distribuição de motivos demonstra equilíbrio entre as filas de suporte e relacionamento.'}{' '}
                {topTmaClassification && topTmaClassification.avgTmaSeconds > 600
                  ? `Por outro lado, o assunto "${topTmaClassification.name}" representa o principal gargalo em duração, com TMA médio de ${formatSeconds(topTmaClassification.avgTmaSeconds)}, exigindo investigação técnica aprofundada.`
                  : 'Os tempos médios mantiveram-se dentro da margem padrão de resolução remota.'}
              </p>
            </div>
          </div>

          {/* 4. Produtividade por Colaborador */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-blue-900 text-white font-bold flex items-center justify-center text-xs">
                  4
                </span>
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-blue-950">
                  Produtividade & Desempenho por Colaborador
                </h2>
              </div>
              {selectedAgents && selectedAgents.length > 0 && (
                <span className="text-[10px] font-semibold text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  Filtro: {selectedAgents.length} {selectedAgents.length === 1 ? 'colaborador' : 'colaboradores'}
                </span>
              )}
            </div>

            <table className="w-full text-left border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold uppercase text-[10px] border-b border-slate-300">
                  <th className="p-2 border-r border-slate-200">Colaborador (Atendente)</th>
                  <th className="p-2 text-right border-r border-slate-200 w-24">Volume Chat</th>
                  <th className="p-2 text-right border-r border-slate-200 w-24">% Volume</th>
                  <th className="p-2 text-right border-r border-slate-200 w-24">TMA Médio</th>
                  <th className="p-2 text-right w-24">TMT Médio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {attributions.slice(0, 8).map((agent, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-2 border-r border-slate-200 font-medium">
                      <span>{agent.agentName}</span>
                    </td>
                    <td className="p-2 text-right font-mono font-bold border-r border-slate-200">
                      {agent.totalContacts.toLocaleString('pt-BR')}
                    </td>
                    <td className="p-2 text-right font-mono border-r border-slate-200">
                      {formatPercent(agent.percentage)}
                    </td>
                    <td className="p-2 text-right font-mono border-r border-slate-200">
                      {formatSeconds(agent.avgTmaSeconds)}
                    </td>
                    <td className="p-2 text-right font-mono font-bold text-slate-700">
                      {formatSeconds(agent.avgTotalTimeSeconds)}
                    </td>
                  </tr>
                ))}
                {attributions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                      Nenhum atendente registrado no filtro ativo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Destaques da Equipe */}
            {topChatAgent && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-900 block">🏆 Destaque de Volume no Período:</span>
                  <span>
                    <strong>{topChatAgent.agentName}</strong> liderou a operação com{' '}
                    <strong>{topChatAgent.totalContacts}</strong> atendimentos realizados ({formatPercent(topChatAgent.percentage)} do total geral).
                  </span>
                </div>
                <div className="text-right font-mono">
                  <span className="text-[10px] text-slate-400 block">TMA do Colaborador</span>
                  <span className="font-bold text-blue-900">{formatSeconds(topChatAgent.avgTmaSeconds)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rodapé Página 2 */}
        <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-[9px] text-slate-400">
          <span>RBXAnalist · Relatório Mensal Executivo</span>
          <span>Página 2 de 3</span>
        </div>
      </section>

      {/* ========================================================
          PÁGINA 3: TEMPOS, SATISFAÇÃO & RECOMENDAÇÕES ESTRATÉGICAS
      ======================================================== */}
      <section className="report-page p-10 min-h-[297mm] bg-white shadow-xl rounded-xs flex flex-col justify-between border border-slate-200/90 print:border-none print:shadow-none print:rounded-none page-break">
        <div className="space-y-6">
          {/* Subcabeçalho de Continuação */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-[10px] text-slate-500">
            <span className="font-bold text-slate-700">Relatório Executivo Omnichannel · {periodLabel}</span>
            <span>Seções 5, 6 e 7</span>
          </div>

          {/* 5. Indicadores de Eficiência de Tempo */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-blue-900 text-white font-bold flex items-center justify-center text-xs">
                5
              </span>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-blue-950">
                Indicadores de Tempo & Eficiência Operacional
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">TMA Médio Geral</span>
                <span className="text-base font-black text-slate-900 font-mono">
                  {formatSeconds(eff?.overallAvgTmaSeconds)}
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">Duração por contato</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">TME Médio (Espera)</span>
                <span className="text-base font-black text-slate-900 font-mono">
                  {formatSeconds(eff?.overallAvgTmeSeconds)}
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">Tempo em fila</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">TMR (1ª Resposta)</span>
                <span className="text-base font-black text-slate-900 font-mono">
                  {formatSeconds(eff?.overallAvgTmrFirstSeconds)}
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">Agilidade do operador</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-emerald-900 uppercase block">TMA Atendimento Humano</span>
                  <span className="text-xs text-emerald-800">Interações diretas com operadores</span>
                </div>
                <span className="text-sm font-black text-emerald-950 font-mono">
                  {formatSeconds(eff?.humanAvgTmaSeconds)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-blue-900 uppercase block">TMA Automação / URA</span>
                  <span className="text-xs text-blue-800">Resoluções via bot e triagem</span>
                </div>
                <span className="text-sm font-black text-blue-950 font-mono">
                  {formatSeconds(eff?.automationAvgTmaSeconds)}
                </span>
              </div>
            </div>
          </div>

          {/* 6. Pesquisa de Satisfação & Encerramentos */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-blue-900 text-white font-bold flex items-center justify-center text-xs">
                6
              </span>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-blue-950">
                Adesão à Pesquisa de Satisfação
              </h2>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white grid grid-cols-4 gap-2 text-center">
              <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                <span className="text-[10px] text-emerald-950 uppercase font-bold block">Taxa Efetiva de Resposta</span>
                <span className="text-base font-black text-emerald-700">{formatPercent(sat?.responseRate)}</span>
                <span className="text-[9px] text-emerald-600 block mt-0.5">Sobre pesquisas enviadas</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Respondidas</span>
                <span className="text-base font-black text-slate-900">{(sat?.answered || 0).toLocaleString('pt-BR')}</span>
                <span className="text-[9px] text-slate-400 block mt-0.5">Avaliações concluídas</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Expiradas</span>
                <span className="text-base font-bold text-rose-700">{(sat?.expired || 0).toLocaleString('pt-BR')}</span>
                <span className="text-[9px] text-slate-400 block mt-0.5">Sem retorno do cliente</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Não Enviadas</span>
                <span className="text-base font-bold text-slate-600">{(sat?.notSent || 0).toLocaleString('pt-BR')}</span>
                <span className="text-[9px] text-slate-400 block mt-0.5">URA / Quedas / Desvios</span>
              </div>
            </div>

            {/* Box Análise de Satisfação */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-800 block">
                📊 Análise da Amostra de Satisfação
              </span>
              <p className="text-[10.5px] leading-relaxed text-slate-600">
                {sat && ((sat.answered || 0) > 0 || (sat.expired || 0) > 0) ? (
                  <>
                    Foram disparadas <strong>{((sat.answered || 0) + (sat.expired || 0)).toLocaleString('pt-BR')} pesquisas de satisfação</strong> aos clientes após o encerramento do chat. Destas, <strong>{(sat.answered || 0).toLocaleString('pt-BR')} foram concluídas</strong> com avaliação, representando uma <strong>taxa efetiva de retorno de {formatPercent(sat.responseRate)}</strong>. Um contingente de <strong>{(sat.notSent || 0).toLocaleString('pt-BR')} atendimentos</strong> foi encerrado sem acionamento de pesquisa (desistências prévias na URA, ocorrências em massa ou contatos informativos sem formulário).
                  </>
                ) : (
                  <>Nenhuma pesquisa de satisfação registrada para o filtro e período selecionados.</>
                )}
              </p>
            </div>
          </div>

          {/* 7. Oportunidades de Melhoria & Recomendações Estratégicas */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-blue-900 text-white font-bold flex items-center justify-center text-xs">
                7
              </span>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-blue-950">
                Oportunidades de Melhoria & Recomendações para a Gestão
              </h2>
            </div>

            <div className="space-y-2">
              {defaultRecommendations.map((rec, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-900 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-[10.5px] text-slate-800 leading-snug">
                    {rec}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Assinatura / Validação da Gestão */}
          <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-[10px] text-slate-600">
            <div>
              <div className="border-b border-slate-300 w-48 mx-auto mb-1"></div>
              <span className="font-bold text-slate-800 block">Supervisão de Operações</span>
              <span>ISPCHAT × Atendimento RBX</span>
            </div>
            <div>
              <div className="border-b border-slate-300 w-48 mx-auto mb-1"></div>
              <span className="font-bold text-slate-800 block">Gestão Operacional</span>
              <span>RBXSoft ISP</span>
            </div>
          </div>
        </div>

        {/* Rodapé Página 3 */}
        <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-[9px] text-slate-400">
          <span>RBXAnalist · Relatório Mensal Executivo</span>
          <span>Página 3 de 3</span>
        </div>
      </section>
    </div>
  );
};
