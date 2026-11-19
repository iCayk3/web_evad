import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CommercialDashboardDto, LeadDto } from './types.ts';
import { exportCancellationsToPdf, ExportCancellationsPdfOptions } from './exportCancellationsPdf.ts';
import { formatDateBR } from './utils.ts';
import {
  renderPdfHeader,
  renderPdfFooter,
  renderPdfFiltersBanner,
  renderPdfKpiCard,
  renderPdfProgressBar,
  renderPdfExecutiveCallout,
  renderPdfMiniBarChart,
  PdfKpiCardConfig,
} from './pdfUtils.ts';

export { exportCancellationsToPdf };
export type { ExportCancellationsPdfOptions };

function isUnassigned(val?: string | null): boolean {
  if (!val) return true;
  const clean = val.trim().toLowerCase();
  return (
    clean === 'não atribuído' ||
    clean === 'nao atribuido' ||
    clean === 'não informada' ||
    clean === 'nao informada' ||
    clean === 'não informado' ||
    clean === 'nao informado' ||
    clean === 'sem vendedor' ||
    clean === 'não atribuída' ||
    clean === 'nao atribuida' ||
    clean === '-' ||
    clean === 'n/a'
  );
}

interface BaseExportOptions {
  user?: {
    fullName?: string;
    username?: string;
    role?: string;
  } | null;
  periodLabel?: string;
  activeFilters?: {
    seller?: string;
    city?: string;
    group?: string;
    excludedPlansCount?: number;
    totalPlansCount?: number;
    excludedPlans?: string[];
    excludedReasonsCount?: number;
    totalReasonsCount?: number;
    excludedReasons?: string[];
    hideInactiveSellers?: boolean;
    hideThirdPartySellers?: boolean;
    hideUnassignedSellers?: boolean;
  };
  includeClientDetails?: boolean;
  clientRecords?: any[];
}

/**
 * 1. Exporta Relatório Executivo da Dashboard Comercial
 * - Anual: Página 1 Consolidada + 1 Página Executiva por Mês (12 meses)
 * - Não-Anual (30d, 7d, mês, custom): Relatório Executivo Espelho da Tela em 2 Páginas
 * - Gráficos vetoriais de barras de vendas vs cancelamentos e barras de progresso de share %
 */
export function exportExecutiveDashboardToPdf({
  dashboard,
  user,
  periodLabel = 'Período Selecionado',
  activeFilters,
  includeClientDetails = false,
  clientRecords = [],
}: BaseExportOptions & {
  dashboard: CommercialDashboardDto;
  includeClientDetails?: boolean;
  clientRecords?: any[];
}): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = 297;
  const marginX = 14;

  const periodType = dashboard.period?.type;
  const isYearView =
    periodType === 'year' ||
    (periodLabel.toLowerCase().includes('ano corrente') &&
      periodType !== '30d' &&
      periodType !== '7d' &&
      periodType !== 'month' &&
      periodType !== 'today' &&
      periodType !== 'custom');

  const startDateBR = formatDateBR(dashboard.period?.start);
  const endDateBR = formatDateBR(dashboard.period?.end);
  const dateRangeStr =
    startDateBR && endDateBR
      ? startDateBR === endDateBR
        ? startDateBR
        : `${startDateBR} a ${endDateBR}`
      : periodLabel || 'Período Selecionado';

  let reportMainTitle = 'Relatório Executivo de Inteligência Comercial';
  let reportSubtitle = 'Visão Executiva de Vendas, Receita e Performance';
  let headerPeriodContext = periodLabel;

  if (isYearView) {
    reportMainTitle = 'Relatório Executivo Anual de Inteligência Comercial';
    reportSubtitle = `Consolidado Anual de Vendas, Receita Recorrente e Churn (${dateRangeStr})`;
    headerPeriodContext = `Ano Corrente (${dateRangeStr})`;
  } else if (periodType === 'month' || periodLabel.toLowerCase().includes('mês')) {
    reportMainTitle = 'Relatório Executivo Mensal de Inteligência Comercial';
    reportSubtitle = `Demonstrativo Comercial Mensal (${dateRangeStr})`;
    headerPeriodContext = `Mês Atual (${dateRangeStr})`;
  } else if (periodType === '30d' || periodLabel.toLowerCase().includes('30 dias')) {
    reportMainTitle = 'Relatório Executivo Comercial — Últimos 30 Dias';
    reportSubtitle = `Desempenho Comercial Consolidado (${dateRangeStr})`;
    headerPeriodContext = `Últimos 30 Dias (${dateRangeStr})`;
  } else if (periodType === '7d' || periodLabel.toLowerCase().includes('7 dias')) {
    reportMainTitle = 'Relatório Executivo Comercial — Últimos 7 Dias';
    reportSubtitle = `Acompanhamento Semanal de Vendas e Conversões (${dateRangeStr})`;
    headerPeriodContext = `Últimos 7 Dias (${dateRangeStr})`;
  } else if (periodType === 'today' || periodLabel.toLowerCase().includes('hoje')) {
    reportMainTitle = 'Relatório Executivo Diário — Vendas de Hoje';
    reportSubtitle = `Posição Comercial em Tempo Real (${dateRangeStr})`;
    headerPeriodContext = `Hoje (${dateRangeStr})`;
  } else if (periodType === 'custom' || periodLabel.toLowerCase().includes('personalizado')) {
    reportMainTitle = 'Relatório Executivo Comercial — Período Personalizado';
    reportSubtitle = `Intervalo Customizado: ${dateRangeStr} • Análise Executiva de Vendas`;
    headerPeriodContext = `Período Personalizado (${dateRangeStr})`;
  } else {
    reportSubtitle = `Período: ${dateRangeStr} • Indicadores Executivos e Desempenho`;
    headerPeriodContext = `${periodLabel} (${dateRangeStr})`;
  }

  // Prepara tokens de filtros
  const filterTokens: string[] = [];
  if (activeFilters?.seller && activeFilters.seller !== 'all') {
    filterTokens.push(`Vendedor: ${activeFilters.seller}`);
  }
  if (activeFilters?.city && activeFilters.city !== 'all') {
    filterTokens.push(`Região: ${activeFilters.city}`);
  }
  if (activeFilters?.group && activeFilters.group !== 'all') {
    filterTokens.push(`Grupo: ${activeFilters.group}`);
  }
  if (activeFilters?.excludedPlansCount && activeFilters.excludedPlansCount > 0) {
    const activeCount = activeFilters.totalPlansCount
      ? activeFilters.totalPlansCount - activeFilters.excludedPlansCount
      : 0;
    filterTokens.push(
      `Planos: ${activeCount > 0 ? `${activeCount}/` : ''}${activeFilters.totalPlansCount || ''} ativos (${activeFilters.excludedPlansCount} excluídos)`
    );
  }
  if (activeFilters?.excludedReasonsCount && activeFilters.excludedReasonsCount > 0) {
    const activeCount = activeFilters.totalReasonsCount
      ? activeFilters.totalReasonsCount - activeFilters.excludedReasonsCount
      : 0;
    filterTokens.push(
      `Motivos Cancel.: ${activeCount > 0 ? `${activeCount}/` : ''}${activeFilters.totalReasonsCount || ''} ativos (${activeFilters.excludedReasonsCount} excluídos)`
    );
  }
  if (activeFilters?.hideUnassignedSellers) {
    filterTokens.push('Não Atribuídos: Ocultados');
  }
  if (activeFilters?.hideInactiveSellers) {
    filterTokens.push('Ex-colaboradores: Ocultados');
  }
  if (activeFilters?.hideThirdPartySellers) {
    filterTokens.push('Terceiros: Ocultados');
  }

  // =========================================================================
  // PÁGINA 1: CONSOLIDADO GERAL / EXECUTIVO (ESPELHO DA TELA)
  // =========================================================================
  renderPdfHeader(
    doc,
    reportMainTitle,
    reportSubtitle,
    pageWidth,
    marginX,
    user,
    headerPeriodContext
  );

  const startYPage1 = renderPdfFiltersBanner(doc, filterTokens, pageWidth, marginX, 29);

  // KPIs Executivos
  const closedSales = dashboard.kpis.closedSalesCount || 0;
  const cancellations = dashboard.kpis.cancellationsCount || 0;
  const netAdditions = dashboard.kpis.netAdditions ?? (closedSales - cancellations);
  const churnRatio = dashboard.kpis.churnRatioPercent ?? (closedSales > 0 ? Number(((cancellations / closedSales) * 100).toFixed(1)) : 0);

  const kpis: PdfKpiCardConfig[] = [
    {
      label: 'Novos Leads',
      value: String(dashboard.kpis.newLeadsCount || 0),
      sub: `${dashboard.kpis.newLeadsDiffPercent ? `+${dashboard.kpis.newLeadsDiffPercent}%` : 'Captação no período'}`,
      bg: [238, 242, 255],
      text: [67, 56, 202],
      border: [224, 231, 255],
    },
    {
      label: 'Vendas Fechadas',
      value: String(closedSales),
      sub: `${dashboard.kpis.closedSalesDiffPercent ? `+${dashboard.kpis.closedSalesDiffPercent}%` : 'Contratos fechados'}`,
      bg: [236, 253, 245],
      text: [5, 150, 105],
      border: [209, 250, 229],
    },
    {
      label: 'Cancelamentos (Churn)',
      value: String(cancellations),
      sub: `${churnRatio}% taxa de evasão`,
      bg: [255, 241, 242],
      text: [225, 29, 72],
      border: [254, 205, 211],
    },
    {
      label: 'Balanço Líquido (Net Adds)',
      value: `${netAdditions >= 0 ? `+${netAdditions}` : netAdditions}`,
      sub: netAdditions >= 0 ? 'Crescimento de base' : 'Retração de base',
      bg: netAdditions >= 0 ? [240, 253, 244] : [254, 242, 242],
      text: netAdditions >= 0 ? [22, 101, 52] : [185, 28, 28],
      border: netAdditions >= 0 ? [187, 247, 208] : [254, 202, 202],
    },
    {
      label: 'Faturamento Mensal (MRR)',
      value: `R$ ${(dashboard.kpis.totalMonthlyValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: 'Receita recorrente adicionada',
      bg: [240, 253, 250],
      text: [13, 148, 136],
      border: [204, 251, 241],
    },
    {
      label: 'Ticket Médio',
      value: `R$ ${(dashboard.kpis.averageTicketMonthly || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: 'Média por novo contrato',
      bg: [255, 251, 235],
      text: [180, 83, 9],
      border: [254, 243, 199],
    },
  ];

  const cardGap = 2.8;
  const cardWidth = (pageWidth - 2 * marginX - (kpis.length - 1) * cardGap) / kpis.length;
  const cardHeight = 15.5;
  const cardY = startYPage1;

  kpis.forEach((kpi, idx) => {
    const x = marginX + idx * (cardWidth + cardGap);
    renderPdfKpiCard(doc, x, cardY, cardWidth, cardHeight, kpi);
  });

  const tableStartY = cardY + cardHeight + 4;
  const tableMaxRows = 10;

  if (isYearView) {
    // =========================================================================
    // PÁGINA 1: VISÃO GERENCIAL ANUAL CONSOLIDADA
    // =========================================================================

    // 1. Tabela Esquerda: Demonstrativo Consolidado dos 12 Meses do Ano
    const monthlyList = dashboard.monthlySeries || [];
    let totSales = 0;
    let totCancels = 0;
    let totRevenue = 0;

    const monthlySummaryRows = monthlyList.map((m) => {
      const mSales = m.sales > 0 ? m.sales : m.contracts;
      const mCancels = m.cancellations || 0;
      const mNet = m.netAdditions ?? (mSales - mCancels);
      const mRev = m.revenue || 0;
      totSales += mSales;
      totCancels += mCancels;
      totRevenue += mRev;

      return [
        m.label,
        String(mSales),
        String(mCancels),
        `${mNet >= 0 ? `+${mNet}` : mNet}`,
        `R$ ${mRev.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ];
    });

    const totNet = totSales - totCancels;
    monthlySummaryRows.push([
      'TOTAL ACUMULADO',
      String(totSales),
      String(totCancels),
      `${totNet >= 0 ? `+${totNet}` : totNet}`,
      `R$ ${totRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    ]);

    autoTable(doc, {
      startY: tableStartY,
      margin: { left: marginX, right: pageWidth / 2 + 2.5 },
      head: [['Mês Ref.', 'Vendas', 'Cancel.', 'Saldo Líq.', 'Receita Adicionada']],
      body: monthlySummaryRows,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 5.6, cellPadding: 0.9 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.0, cellPadding: 1.1 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 26, fontStyle: 'bold' },
        1: { cellWidth: 22, halign: 'right' },
        2: { cellWidth: 22, halign: 'right' },
        3: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
        4: { cellWidth: 38, halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.row.index === monthlySummaryRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.textColor = [15, 23, 42];
        }
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const rawVal = data.cell.text?.[0] || '';
          if (rawVal.startsWith('+')) {
            doc.setTextColor(22, 101, 52);
          } else if (rawVal.startsWith('-')) {
            doc.setTextColor(185, 28, 28);
          }
        }
      },
    });

    const leftPage1FinalY = (doc as any).lastAutoTable?.finalY || tableStartY + 45;

    // 2. Tabela Direita: Top 10 Consultores / Vendedores do Ano
    const cleanTopSellers = (dashboard.topSellers || []).filter((s) => !isUnassigned(s.name)).slice(0, 10);
    const sellerRows = cleanTopSellers.map((s, idx) => [
      `#${idx + 1}`,
      s.name,
      String(s.count),
      `R$ ${s.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `${s.sharePercent.toFixed(1)}%`,
    ]);

    autoTable(doc, {
      startY: tableStartY,
      margin: { left: pageWidth / 2 + 2.5, right: marginX },
      head: [['#', 'Top Consultores / Vendedores do Ano', 'Vendas', 'Total R$', 'Share (%)']],
      body: sellerRows.length > 0 ? sellerRows : [['-', 'Nenhum atendente no período', '-', '-', '-']],
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 6.2, cellPadding: 1.1 },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.6, cellPadding: 1.3 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 9, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 46 },
        2: { cellWidth: 17, halign: 'right' },
        3: { cellWidth: 32, halign: 'right' },
        4: { cellWidth: 28, halign: 'right' },
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const rawShare = cleanTopSellers[data.row.index]?.sharePercent || 0;
          if (rawShare > 0) {
            const textStr = `${rawShare.toFixed(1)}%`;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.2);
            const textWidth = doc.getTextWidth(textStr);
            const paddingRight = 1.2;
            const textStartX = data.cell.x + data.cell.width - paddingRight - textWidth;

            const barStartX = data.cell.x + 1.5;
            const barEndX = textStartX - 1.8;
            const barWidth = Math.max(barEndX - barStartX, 2.0);

            const barHeight = 1.0;
            const barY = data.cell.y + (data.cell.height - barHeight) / 2;

            renderPdfProgressBar(
              doc,
              barStartX,
              barY,
              barWidth,
              barHeight,
              rawShare,
              [5, 150, 105]
            );
          }
        }
      },
    });

    const rightPage1FinalY = (doc as any).lastAutoTable?.finalY || tableStartY + 45;
    const lastTableY = Math.max(leftPage1FinalY, rightPage1FinalY);

    // 3. Mini-Gráfico Vetorial de Barras Comparativas dos 12 Meses com Saldo Líquido
    const annualChartY = lastTableY + 3.0;
    const annualPoints = monthlyList.map((m) => {
      const effectiveSales = m.sales > 0 ? m.sales : m.contracts;
      const cancels = m.cancellations || 0;
      const net = m.netAdditions ?? (effectiveSales - cancels);
      return {
        label: m.label,
        sales: effectiveSales,
        cancels: cancels,
        net: net,
      };
    });

    renderPdfMiniBarChart(
      doc,
      marginX,
      annualChartY,
      pageWidth - 2 * marginX,
      44,
      annualPoints,
      {
        title: `Evolução Mensal Consolidada do Ano (${dateRangeStr}) — Vendas Fechadas vs Cancelamentos & Saldo Líquido`,
        salesColor: [5, 150, 105],
        cancelColor: [225, 29, 72],
        salesLabel: 'Vendas Fechadas',
        cancelLabel: 'Cancelamentos',
        showYAxis: true,
        showNetBadge: true,
      }
    );

    // 4. Síntese Executiva Gerencial do Ano (Callout)
    const annualCalloutY = annualChartY + 44 + 3.0;

    let bestMonth = monthlyList[0];
    let bestNet = -Infinity;
    monthlyList.forEach((m) => {
      const net = m.netAdditions ?? ((m.sales > 0 ? m.sales : m.contracts) - (m.cancellations || 0));
      if (net > bestNet) {
        bestNet = net;
        bestMonth = m;
      }
    });

    const topSeller = cleanTopSellers[0];
    const cleanGroupsYear = (dashboard.salesByGroup || []).filter((g) => !isUnassigned(g.group));
    const topGroup = cleanGroupsYear[0];
    const expansionText = netAdditions >= 0
      ? `crescimento líquido consolidado de +${netAdditions} novos contratos`
      : `retração líquida de ${netAdditions} contratos`;

    const annualSummaryText = [
      `• Desempenho e Governança Anual: O exercício encerrou com ${closedSales} novas vendas e ${cancellations} cancelamentos (${churnRatio}% de evasão anual), consolidando um ${expansionText}.`,
      `• Receita e Eficiência: Faturamento mensal recorrente adicionado (MRR) de R$ ${(dashboard.kpis.totalMonthlyValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, com ticket médio anual de R$ ${(dashboard.kpis.averageTicketMonthly || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
      `• Destaques Gerenciais: Pico de performance líquida em ${bestMonth ? bestMonth.fullLabel : 'período'} (+${bestNet >= 0 ? bestNet : 0} conexões líquidas).${topSeller ? ` Consultor(a) destaque: ${topSeller.name} (${topSeller.count} vendas / R$ ${topSeller.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).` : ''}${topGroup ? ` Principal segmento: ${topGroup.group} (${topGroup.sharePercent.toFixed(1)}% do share comercial).` : ''}`,
    ].join('\n');

    renderPdfExecutiveCallout(
      doc,
      marginX,
      annualCalloutY,
      pageWidth - 2 * marginX,
      16,
      'Síntese Executiva & Governança Comercial Anual',
      annualSummaryText,
      [37, 99, 235]
    );
  } else {
    // =========================================================================
    // PÁGINA 1: VISÃO EXECUTIVA PADRÃO (NÃO-ANUAL)
    // =========================================================================

    // Tabela 1: Vendas por Grupo de Clientes (Esquerda) com barra visual de Share %
    const cleanGroups = (dashboard.salesByGroup || []).filter((g) => !isUnassigned(g.group)).slice(0, tableMaxRows);
    const groupRows = cleanGroups.map((g, idx) => [
      `#${idx + 1}`,
      g.group,
      String(g.count),
      `R$ ${g.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `${g.sharePercent.toFixed(1)}%`,
    ]);

    autoTable(doc, {
      startY: tableStartY,
      margin: { left: marginX, right: pageWidth / 2 + 2.5 },
      head: [['#', 'Grupo de Clientes', 'Vendas', 'Total R$', 'Share (%)']],
      body: groupRows.length > 0 ? groupRows : [['-', 'Nenhum grupo no período', '-', '-', '-']],
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 6.4, cellPadding: 1.2 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.8, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 9, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 46 },
        2: { cellWidth: 17, halign: 'right' },
        3: { cellWidth: 32, halign: 'right' },
        4: { cellWidth: 26.5, halign: 'right' },
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const rawShare = cleanGroups[data.row.index]?.sharePercent || 0;
          if (rawShare > 0) {
            const textStr = `${rawShare.toFixed(1)}%`;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.4);
            const textWidth = doc.getTextWidth(textStr);
            const paddingRight = 1.2;
            const textStartX = data.cell.x + data.cell.width - paddingRight - textWidth;

            const barStartX = data.cell.x + 1.5;
            const barEndX = textStartX - 1.8;
            const barWidth = Math.max(barEndX - barStartX, 2.0);

            const barHeight = 1.0;
            const barY = data.cell.y + (data.cell.height - barHeight) / 2;

            renderPdfProgressBar(
              doc,
              barStartX,
              barY,
              barWidth,
              barHeight,
              rawShare,
              [37, 99, 235]
            );
          }
        }
      },
    });

    const leftPage1FinalY = (doc as any).lastAutoTable?.finalY || tableStartY + 35;

    // Tabela 2: Top Consultores / Vendedores (Direita) com barra visual de Share %
    const cleanTopSellers = (dashboard.topSellers || []).filter((s) => !isUnassigned(s.name)).slice(0, tableMaxRows);
    const sellerRows = cleanTopSellers.map((s, idx) => [
      `#${idx + 1}`,
      s.name,
      String(s.count),
      `R$ ${s.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `${s.sharePercent.toFixed(1)}%`,
    ]);

    autoTable(doc, {
      startY: tableStartY,
      margin: { left: pageWidth / 2 + 2.5, right: marginX },
      head: [['#', 'Top Consultores / Atendentes', 'Vendas', 'Total R$', 'Share (%)']],
      body: sellerRows.length > 0 ? sellerRows : [['-', 'Nenhum atendente no período', '-', '-', '-']],
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 6.4, cellPadding: 1.2 },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.8, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 9, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 46 },
        2: { cellWidth: 17, halign: 'right' },
        3: { cellWidth: 32, halign: 'right' },
        4: { cellWidth: 26.5, halign: 'right' },
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const rawShare = cleanTopSellers[data.row.index]?.sharePercent || 0;
          if (rawShare > 0) {
            const textStr = `${rawShare.toFixed(1)}%`;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.4);
            const textWidth = doc.getTextWidth(textStr);
            const paddingRight = 1.2;
            const textStartX = data.cell.x + data.cell.width - paddingRight - textWidth;

            const barStartX = data.cell.x + 1.5;
            const barEndX = textStartX - 1.8;
            const barWidth = Math.max(barEndX - barStartX, 2.0);

            const barHeight = 1.0;
            const barY = data.cell.y + (data.cell.height - barHeight) / 2;

            renderPdfProgressBar(
              doc,
              barStartX,
              barY,
              barWidth,
              barHeight,
              rawShare,
              [5, 150, 105]
            );
          }
        }
      },
    });

    const rightPage1FinalY = (doc as any).lastAutoTable?.finalY || tableStartY + 35;
    const lastTableY = Math.max(leftPage1FinalY, rightPage1FinalY, tableStartY + 38);
    const chartY = lastTableY + 3.5;

    // Mini-Gráfico Vetorial de Evolução Temporal no Rodapé da Página 1
    if (chartY <= 158 && dashboard.timeSeries && dashboard.timeSeries.length > 0) {
      const seriesToUse = dashboard.timeSeries.length > 31
        ? dashboard.timeSeries.slice(-31)
        : dashboard.timeSeries;
      const timePoints = seriesToUse.map((pt) => ({
        label: formatDateBR(pt.date).slice(0, 5),
        sales: pt.sales || pt.contracts || 0,
        cancels: pt.cancellations || 0,
      }));

      renderPdfMiniBarChart(
        doc,
        marginX,
        chartY,
        pageWidth - 2 * marginX,
        48,
        timePoints,
        {
          title: `Evolução Comparativa Diária: Vendas Fechadas vs Cancelamentos (${dateRangeStr})`,
          salesColor: [5, 150, 105],
          cancelColor: [225, 29, 72],
          salesLabel: 'Vendas',
          cancelLabel: 'Cancel.',
          showYAxis: true,
        }
      );
    }
  }

  // =========================================================================
  // RELATÓRIO ANUAL: 1 PÁGINA EXECUTIVA POR MÊS (12 PÁGINAS)
  // =========================================================================
  if (isYearView && dashboard.monthlySeries && dashboard.monthlySeries.length > 0) {
    dashboard.monthlySeries.forEach((m) => {
      doc.addPage();

      // Cabeçalho da página mensal
      renderPdfHeader(
        doc,
        `Demonstrativo Mensal — ${m.fullLabel}`,
        `Visão Executiva Consolidada de ${m.label}`,
        pageWidth,
        marginX,
        user,
        periodLabel
      );

      const mStartY = renderPdfFiltersBanner(doc, filterTokens, pageWidth, marginX, 29);

      // 5 KPIs Mensais em destaque
      const effectiveSales = m.sales > 0 ? m.sales : m.contracts;
      const mRevenue = m.revenue || 0;
      const mAvgTicket = m.avgTicket || (effectiveSales > 0 ? mRevenue / effectiveSales : 0);
      const mCancels = m.cancellations;
      const mNet = m.netAdditions;
      const mChurnRate = m.churnRatioPercent || (effectiveSales > 0 ? Number(((mCancels / effectiveSales) * 100).toFixed(1)) : 0);

      const momSales = m.momComparison?.salesDiffPercent;
      const momRevenue = m.momComparison?.revenueDiffPercent;
      const momCancels = m.momComparison?.cancellationsDiffPercent;
      const momNet = m.momComparison?.netDiff;

      const monthlyKpis: PdfKpiCardConfig[] = [
        {
          label: 'Vendas do Mês',
          value: `${effectiveSales} vendas`,
          sub: momSales !== null && momSales !== undefined
            ? `${momSales >= 0 ? '+' : ''}${momSales.toFixed(1)}% vs mês ant.`
            : 'Mês inicial do ciclo',
          bg: [236, 253, 245],
          text: [5, 150, 105],
          border: [209, 250, 229],
        },
        {
          label: 'Faturamento (MRR)',
          value: `R$ ${mRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          sub: momRevenue !== null && momRevenue !== undefined
            ? `${momRevenue >= 0 ? '+' : ''}${momRevenue.toFixed(1)}% vs mês ant.`
            : 'Mês inicial do ciclo',
          bg: [240, 253, 250],
          text: [13, 148, 136],
          border: [204, 251, 241],
        },
        {
          label: 'Ticket Médio',
          value: `R$ ${mAvgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          sub: 'Média por contrato fechado',
          bg: [255, 251, 235],
          text: [180, 83, 9],
          border: [254, 243, 199],
        },
        {
          label: 'Cancelamentos (Churn)',
          value: `${mCancels} cancelados`,
          sub: `${mChurnRate.toFixed(1)}% taxa | ${momCancels !== null && momCancels !== undefined ? `${momCancels >= 0 ? '+' : ''}${momCancels.toFixed(1)}% MoM` : 'Base inicial'}`,
          bg: [255, 241, 242],
          text: [225, 29, 72],
          border: [254, 205, 211],
        },
        {
          label: 'Saldo Líquido (Net Adds)',
          value: `${mNet >= 0 ? `+${mNet}` : mNet} contratos`,
          sub: momNet !== null && momNet !== undefined
            ? `${momNet >= 0 ? '+' : ''}${momNet} vs mês ant.`
            : 'Resultado líquido',
          bg: mNet >= 0 ? [240, 253, 244] : [254, 242, 242],
          text: mNet >= 0 ? [22, 101, 52] : [185, 28, 28],
          border: mNet >= 0 ? [187, 247, 208] : [254, 202, 202],
        },
      ];

      const mCardGap = 3.0;
      const mCardWidth = (pageWidth - 2 * marginX - (monthlyKpis.length - 1) * mCardGap) / monthlyKpis.length;
      const mCardHeight = 15.5;
      const mCardY = mStartY;

      monthlyKpis.forEach((kpi, idx) => {
        const x = marginX + idx * (mCardWidth + mCardGap);
        renderPdfKpiCard(doc, x, mCardY, mCardWidth, mCardHeight, kpi);
      });

      const mTableStartY = mCardY + mCardHeight + 4.5;

      // Bloco Esquerdo: Vendas por Grupo de Clientes do Mês com barra de Share %
      const mCleanGroups = (m.salesByGroup || []).filter((g) => !isUnassigned(g.group)).slice(0, 10);
      const mGroupRows = mCleanGroups.map((g, idx) => [
        `#${idx + 1}`,
        g.group,
        String(g.count),
        `R$ ${g.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `${g.sharePercent.toFixed(1)}%`,
      ]);

      autoTable(doc, {
        startY: mTableStartY,
        margin: { left: marginX, right: pageWidth / 2 + 2.5 },
        head: [['#', 'Vendas por Grupo de Clientes', 'Vendas', 'Total R$', 'Share (%)']],
        body: mGroupRows.length > 0 ? mGroupRows : [['-', 'Sem movimentação no grupo', '-', '-', '-']],
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 6.4, cellPadding: 1.2 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.8, cellPadding: 1.5 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 9, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 46 },
          2: { cellWidth: 17, halign: 'right' },
          3: { cellWidth: 32, halign: 'right' },
          4: { cellWidth: 26.5, halign: 'right' },
        },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 4) {
            const rawShare = mCleanGroups[data.row.index]?.sharePercent || 0;
            if (rawShare > 0) {
              const textStr = `${rawShare.toFixed(1)}%`;
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(6.4);
              const textWidth = doc.getTextWidth(textStr);
              const paddingRight = 1.2;
              const textStartX = data.cell.x + data.cell.width - paddingRight - textWidth;

              const barStartX = data.cell.x + 1.5;
              const barEndX = textStartX - 1.8;
              const barWidth = Math.max(barEndX - barStartX, 2.0);

              const barHeight = 1.0;
              const barY = data.cell.y + (data.cell.height - barHeight) / 2;

              renderPdfProgressBar(
                doc,
                barStartX,
                barY,
                barWidth,
                barHeight,
                rawShare,
                [37, 99, 235]
              );
            }
          }
        },
      });

      const mLeftTableFinalY = (doc as any).lastAutoTable?.finalY || mTableStartY + 35;

      // Bloco Direito: Top Atendentes e Planos do Mês
      const mCleanSellers = (m.topSellers || []).filter((s) => !isUnassigned(s.name)).slice(0, 10);
      const mSellerRows = mCleanSellers.map((s, idx) => [
        `#${idx + 1}`,
        s.name,
        String(s.count),
        `R$ ${s.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `${s.sharePercent.toFixed(1)}%`,
      ]);

      autoTable(doc, {
        startY: mTableStartY,
        margin: { left: pageWidth / 2 + 2.5, right: marginX },
        head: [['#', 'Top Atendentes do Mês', 'Vendas', 'Total R$', 'Share (%)']],
        body: mSellerRows.length > 0 ? mSellerRows : [['-', 'Sem vendas atribuídas no mês', '-', '-', '-']],
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 6.4, cellPadding: 1.2 },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.8, cellPadding: 1.5 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 9, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 46 },
          2: { cellWidth: 17, halign: 'right' },
          3: { cellWidth: 32, halign: 'right' },
          4: { cellWidth: 26.5, halign: 'right' },
        },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 4) {
            const rawShare = mCleanSellers[data.row.index]?.sharePercent || 0;
            if (rawShare > 0) {
              const textStr = `${rawShare.toFixed(1)}%`;
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(6.4);
              const textWidth = doc.getTextWidth(textStr);
              const paddingRight = 1.2;
              const textStartX = data.cell.x + data.cell.width - paddingRight - textWidth;

              const barStartX = data.cell.x + 1.5;
              const barEndX = textStartX - 1.8;
              const barWidth = Math.max(barEndX - barStartX, 2.0);

              const barHeight = 1.0;
              const barY = data.cell.y + (data.cell.height - barHeight) / 2;

              renderPdfProgressBar(
                doc,
                barStartX,
                barY,
                barWidth,
                barHeight,
                rawShare,
                [5, 150, 105]
              );
            }
          }
        },
      });

      // Box de Síntese Executiva do Mês no rodapé da página mensal
      const mRightTableFinalY = (doc as any).lastAutoTable?.finalY || mTableStartY + 35;
      const lastTableY = Math.max(mLeftTableFinalY, mRightTableFinalY, mTableStartY + 38);
      const calloutY = Math.min(lastTableY + 4, 178);

      const topGroup = mCleanGroups[0];
      const topSeller = mCleanSellers[0];
      const summaryText =
        `O mês encerrou com ${effectiveSales} vendas fechadas e ${mCancels} cancelamentos, resultando em saldo líquido de ${mNet >= 0 ? `+${mNet}` : mNet} contratos. ` +
        (topGroup ? `Segmento líder: "${topGroup.group}" (${topGroup.sharePercent.toFixed(1)}% das vendas). ` : '') +
        (topSeller ? `Destaque operacional: consultor "${topSeller.name}" com ${topSeller.count} vendas (R$ ${topSeller.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).` : '');

      renderPdfExecutiveCallout(
        doc,
        marginX,
        calloutY,
        pageWidth - 2 * marginX,
        15,
        `Síntese Executiva — ${m.fullLabel}`,
        summaryText,
        [37, 99, 235]
      );
    });
  } else if (!isYearView) {
    // =========================================================================
    // RELATÓRIO NÃO-ANUAL (30 DIAS, 7 DIAS, MÊS, PERSONALIZADO):
    // PÁGINA 2 EXECUTIVA COM PLANOS, REGIÕES, EVOLUÇÃO E SÍNTESE
    // =========================================================================
    doc.addPage();
    renderPdfHeader(
      doc,
      'Detalhamento Comercial & Segmentações',
      `Distribuição por Planos, Tecnologia, Região e Dinâmica do Período (${dateRangeStr})`,
      pageWidth,
      marginX,
      user,
      headerPeriodContext
    );

    const p2StartY = renderPdfFiltersBanner(doc, filterTokens, pageWidth, marginX, 29);

    // Tabela 1: Top Planos Comercializados (Esquerda) com barra visual de Share %
    const validPlans = (dashboard.topPlans || [])
      .filter((p) => !isUnassigned(p.name))
      .slice(0, 10);

    const planRows = validPlans.map((p, idx) => [
      `#${idx + 1}`,
      p.name,
      String(p.count),
      `R$ ${p.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `${p.sharePercent.toFixed(1)}%`,
    ]);

    autoTable(doc, {
      startY: p2StartY,
      margin: { left: marginX, right: pageWidth / 2 + 2.5 },
      head: [['#', 'Top Planos Comercializados', 'Vendas', 'Total R$', 'Share (%)']],
      body: planRows.length > 0 ? planRows : [['-', 'Nenhum plano comercializado', '-', '-', '-']],
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 6.4, cellPadding: 1.2 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.8, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 9, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 46 },
        2: { cellWidth: 17, halign: 'right' },
        3: { cellWidth: 32, halign: 'right' },
        4: { cellWidth: 26.5, halign: 'right' },
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const rawShare = validPlans[data.row.index]?.sharePercent || 0;
          if (rawShare > 0) {
            const textStr = `${rawShare.toFixed(1)}%`;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.4);
            const textWidth = doc.getTextWidth(textStr);
            const paddingRight = 1.2;
            const textStartX = data.cell.x + data.cell.width - paddingRight - textWidth;

            const barStartX = data.cell.x + 1.5;
            const barEndX = textStartX - 1.8;
            const barWidth = Math.max(barEndX - barStartX, 2.0);

            const barHeight = 1.0;
            const barY = data.cell.y + (data.cell.height - barHeight) / 2;

            renderPdfProgressBar(
              doc,
              barStartX,
              barY,
              barWidth,
              barHeight,
              rawShare,
              [37, 99, 235]
            );
          }
        }
      },
    });

    const leftTableFinalY = (doc as any).lastAutoTable?.finalY || p2StartY + 35;

    // Tabela 2: Vendas por Tecnologia & Região (Direita) - Exclui 'Não informada' e 'Não atribuído'
    const validTech = (dashboard.salesByTechnology || []).filter((t) => !isUnassigned(t.technology));
    const validRegions = (dashboard.salesByRegion || []).filter((r) => !isUnassigned(r.region));

    const techRows = validTech.map((t) => [
      'Tecnologia',
      t.technology,
      String(t.count),
      `R$ ${t.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    ]);

    const maxRegionRows = Math.max(10 - techRows.length, 4);
    const regionRows = validRegions.slice(0, maxRegionRows).map((r) => [
      'Região',
      r.region,
      String(r.count),
      `R$ ${r.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    ]);

    const combinedSegmentRows = [...techRows, ...regionRows];

    autoTable(doc, {
      startY: p2StartY,
      margin: { left: pageWidth / 2 + 2.5, right: marginX },
      head: [['Segmento', 'Identificação', 'Contratos', 'Faturamento R$']],
      body: combinedSegmentRows.length > 0 ? combinedSegmentRows : [['-', 'Nenhum segmento registrado', '-', '-']],
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 6.4, cellPadding: 1.2 },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.8, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 22, fontStyle: 'bold' },
        1: { cellWidth: 50 },
        2: { cellWidth: 22, halign: 'right' },
        3: { cellWidth: 36.5, halign: 'right' },
      },
    });

    const rightTableFinalY = (doc as any).lastAutoTable?.finalY || p2StartY + 35;
    const tablesBottomY = Math.max(leftTableFinalY, rightTableFinalY, p2StartY + 38);
    const midSectionY = tablesBottomY + 4.5;

    let nextSectionY = midSectionY;

    // Seção Dinâmica Temporal:
    // Se o período for curto (<= 10 pontos), exibe tabela dia a dia completa
    if (dashboard.timeSeries && dashboard.timeSeries.length > 0 && dashboard.timeSeries.length <= 10) {
      const dailyRows = dashboard.timeSeries.map((pt) => {
        const salesCount = pt.sales || pt.contracts || 0;
        const net = salesCount - (pt.cancellations || 0);
        return [
          formatDateBR(pt.date),
          String(pt.leads || 0),
          String(salesCount),
          String(pt.cancellations || 0),
          `${net >= 0 ? `+${net}` : net}`,
        ];
      });

      autoTable(doc, {
        startY: midSectionY,
        margin: { left: marginX, right: marginX },
        head: [['Data', 'Novos Leads', 'Vendas Fechadas', 'Cancelamentos (Churn)', 'Balanço Líquido (Net Adds)']],
        body: dailyRows,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 6.6, cellPadding: 1.4 },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      nextSectionY = Math.max((doc as any).lastAutoTable?.finalY || 0, midSectionY + 25);
    } else if (dashboard.timeSeries && dashboard.timeSeries.length > 10) {
      // Períodos mais longos (ex: 30 dias ou personalizado):
      // Painel Executivo de Destaques Temporais do Período
      const totalDays = dashboard.timeSeries.length;
      const avgSalesPerDay = (closedSales / totalDays).toFixed(1);
      const avgCancelsPerDay = (cancellations / totalDays).toFixed(1);

      let peakPoint = dashboard.timeSeries[0];
      for (const pt of dashboard.timeSeries) {
        if ((pt.sales || pt.contracts || 0) > (peakPoint.sales || peakPoint.contracts || 0)) {
          peakPoint = pt;
        }
      }
      const peakSalesCount = peakPoint ? (peakPoint.sales || peakPoint.contracts || 0) : 0;
      const peakDateStr = peakPoint ? formatDateBR(peakPoint.date) : '-';

      const temporalCards: PdfKpiCardConfig[] = [
        { label: 'Total de Dias no Intervalo', value: `${totalDays} dias analisados`, bg: [241, 245, 249], text: [51, 65, 85], border: [226, 232, 240] },
        { label: 'Ritmo Médio de Vendas', value: `${avgSalesPerDay} vendas/dia`, bg: [236, 253, 245], text: [5, 150, 105], border: [209, 250, 229] },
        { label: 'Ritmo Médio de Cancelamentos', value: `${avgCancelsPerDay} churn/dia`, bg: [255, 241, 242], text: [225, 29, 72], border: [254, 205, 211] },
        { label: 'Pico de Vendas no Período', value: `${peakSalesCount} vendas (${peakDateStr})`, bg: [238, 242, 255], text: [67, 56, 202], border: [224, 231, 255] },
      ];

      const tCardGap = 3.5;
      const tCardWidth = (pageWidth - 2 * marginX - (temporalCards.length - 1) * tCardGap) / temporalCards.length;
      const tCardHeight = 14.5;

      temporalCards.forEach((tc, idx) => {
        const x = marginX + idx * (tCardWidth + tCardGap);
        renderPdfKpiCard(doc, x, midSectionY, tCardWidth, tCardHeight, tc);
      });

      nextSectionY = midSectionY + tCardHeight;
    }

    // Box de Síntese Executiva do Período no Rodapé
    const calloutY = Math.min(nextSectionY + 4.0, 178);
    const calloutHeight = 15.5;

    const topGroup = (dashboard.salesByGroup || []).find((g) => !isUnassigned(g.group));
    const topSeller = (dashboard.topSellers || []).find((s) => !isUnassigned(s.name));
    const topPlan = validPlans[0];
    const summaryText =
      `O período selecionado (${dateRangeStr}) encerrou com ${closedSales} contratos fechados e ${cancellations} cancelamentos, totalizando um saldo líquido de ${netAdditions >= 0 ? `+${netAdditions}` : netAdditions} conexões (taxa de churn de ${churnRatio}%). ` +
      (topGroup ? `Segmento líder: "${topGroup.group}" (${topGroup.sharePercent.toFixed(1)}% do faturamento). ` : '') +
      (topSeller ? `Consultor destaque: "${topSeller.name}" (${topSeller.count} vendas). ` : '') +
      (topPlan ? `Plano com maior volume: "${topPlan.name}" (${topPlan.count} assinaturas). ` : '') +
      `Faturamento mensal adicionado (MRR): R$ ${(dashboard.kpis.totalMonthlyValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} com ticket médio de R$ ${(dashboard.kpis.averageTicketMonthly || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`;

    renderPdfExecutiveCallout(
      doc,
      marginX,
      calloutY,
      pageWidth - 2 * marginX,
      calloutHeight,
      `Síntese Executiva do Período — ${dateRangeStr}`,
      summaryText,
      [37, 99, 235]
    );
  }

  // =========================================================================
  // ANEXO OPCIONAL: LISTA DETALHADA DE CLIENTES (APENAS SE SOLICITADO)
  // =========================================================================
  if (includeClientDetails && clientRecords && clientRecords.length > 0) {
    doc.addPage();
    renderPdfHeader(
      doc,
      'Anexo — Detalhamento Operacional de Vendas',
      'Relação Nominal de Contratos Fechados no Período',
      pageWidth,
      marginX,
      user,
      headerPeriodContext
    );

    const clientRows = clientRecords.map((r) => [
      r.id || '-',
      r.name || '-',
      r.planDescription || r.detail?.split('—')[0]?.trim() || 'Plano Padrão',
      r.seller || 'Não atribuído',
      `R$ ${(Number(r.monthlyValue) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      r.date ? r.date.slice(0, 10).split('-').reverse().join('/') : '-',
      r.group || r.city || 'Geral',
    ]);

    autoTable(doc, {
      startY: 32,
      margin: { left: marginX, right: marginX },
      head: [['Contrato', 'Cliente', 'Plano', 'Consultor', 'Mensalidade', 'Assinatura', 'Grupo / Região']],
      body: clientRows,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 6.8, cellPadding: 1.6 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
  }

  // Numeração de páginas e rodapé institucional em todas as páginas
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    renderPdfFooter(doc, i, totalPages, pageWidth, marginX);
  }

  const cleanPeriod = (periodLabel || 'Periodo').replace(/[^a-zA-Z0-9_-]/g, '_');
  const finalFileName = `Relatorio_Executivo_Comercial_${cleanPeriod}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(finalFileName);
}

/**
 * 2. Exporta Relatório de Funil & Carteira de Leads
 */
export function exportLeadsToPdf({
  leads,
  user,
  periodLabel = 'Período Selecionado',
}: BaseExportOptions & { leads: LeadDto[] }): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = 297;
  const marginX = 14;

  renderPdfHeader(
    doc,
    'Relatório Gerencial de Funil & Carteira de Leads',
    'Relação de Prospects, Contatos e Estágio Atual',
    pageWidth,
    marginX,
    user,
    periodLabel
  );

  const stageCounts: Record<string, number> = {
    new: 0,
    qualified: 0,
    proposal: 0,
    negotiation: 0,
    won: 0,
    lost: 0,
  };
  leads.forEach((l) => {
    if (stageCounts[l.stage] !== undefined) stageCounts[l.stage]++;
  });

  const kpis: PdfKpiCardConfig[] = [
    { label: 'Total de Leads', value: `${leads.length} leads`, sub: 'Base consolidada', bg: [238, 242, 255], text: [67, 56, 202], border: [224, 231, 255] },
    { label: 'Em Negociação', value: `${stageCounts.negotiation} leads`, sub: 'Etapa avançada', bg: [255, 251, 235], text: [180, 83, 9], border: [254, 243, 199] },
    { label: 'Ganhos / Won', value: `${stageCounts.won} leads`, sub: 'Convertidos em vendas', bg: [236, 253, 245], text: [5, 150, 105], border: [209, 250, 229] },
    { label: 'Perdidos / Lost', value: `${stageCounts.lost} leads`, sub: 'Não convertidos', bg: [254, 242, 242], text: [225, 29, 72], border: [254, 205, 211] },
  ];

  const cardWidth = 64.5;
  const cardHeight = 14.5;
  const cardY = 30;

  kpis.forEach((kpi, idx) => {
    const x = marginX + idx * (cardWidth + 3.2);
    renderPdfKpiCard(doc, x, cardY, cardWidth, cardHeight, kpi);
  });

  const stageLabels: Record<string, string> = {
    new: 'Novo',
    qualified: 'Qualificado',
    proposal: 'Proposta',
    negotiation: 'Negociação',
    won: 'Ganho (Won)',
    lost: 'Perdido (Lost)',
  };

  const rows = leads.map((l) => [
    l.code || String(l.id),
    l.name,
    l.phone || '-',
    l.email || '-',
    `${l.city || '-'}/${l.state || '-'}`,
    l.owner || 'Não atribuído',
    stageLabels[l.stage] || l.stage,
    l.createdAt ? l.createdAt.slice(0, 10).split('-').reverse().join('/') : '-',
  ]);

  autoTable(doc, {
    startY: 48,
    margin: { left: marginX, right: marginX },
    head: [['ID', 'Nome do Lead', 'Telefone', 'E-mail', 'Cidade/UF', 'Responsável', 'Estágio', 'Data Criação']],
    body: rows.length > 0 ? rows : [['-', 'Nenhum lead encontrado', '-', '-', '-', '-', '-', '-']],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    renderPdfFooter(doc, i, totalPages, pageWidth, marginX);
  }

  const finalFileName = `Relatorio_Carteira_Leads_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(finalFileName);
}

export interface SellerRankingItemForExport {
  name: string;
  count: number;
  monthlyValue: number;
  adhesionValue?: number;
  ticketAverage: number;
  sharePercent: number;
  sellerType?: 'active' | 'inactive' | 'third_party' | 'unassigned';
}

export interface ExportClosedSalesPdfOptions {
  records: any[];
  user?: {
    fullName?: string;
    username?: string;
    role?: string;
  } | null;
  periodLabel?: string;
  totalMonthlyValue: number;
  totalAdhesionValue: number;
  totalSalesCount?: number;
  totalContractsCount?: number;
  unassignedCount?: number;
  unassignedTotalValue?: number;
  residualSalesCount?: number;
  residualTotalValue?: number;
  sellersRanking?: SellerRankingItemForExport[];
  topSellers?: any[];
  topSellerHighlight?: {
    name: string;
    count?: number;
    monthlyValue?: number;
    value?: number;
    sharePercent?: number;
  } | null;
  timeSeries?: Array<{
    date: string;
    sales?: number;
    contracts?: number;
    cancellations?: number;
  }>;
  includeClientList?: boolean;
  filters?: {
    seller?: string;
    search?: string;
    hideUnassigned?: boolean;
    hideInactive?: boolean;
    hideThirdParty?: boolean;
  };
}

/**
 * 3. Exporta Relatório Executivo de Vendas Fechadas e Performance de Atendentes (Espelho da tela ClosedSalesView)
 */
export function exportClosedSalesToPdf({
  records,
  topSellers,
  user,
  periodLabel = 'Período Selecionado',
  totalMonthlyValue,
  totalAdhesionValue,
  totalSalesCount,
  totalContractsCount,
  unassignedCount,
  unassignedTotalValue,
  residualSalesCount,
  residualTotalValue,
  sellersRanking,
  topSellerHighlight,
  timeSeries,
  includeClientList = false,
  filters,
}: ExportClosedSalesPdfOptions): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = 297;
  const marginX = 14;

  // 1. Cabeçalho Corporativo RBX Hub Signature
  renderPdfHeader(
    doc,
    'Relatório Executivo de Vendas & Performance Comercial',
    'Demonstrativo de Receita Recorrente (MRR), Adesões e Produtividade por Colaborador',
    pageWidth,
    marginX,
    user,
    periodLabel
  );

  // 2. Banner de Filtros
  const filterTokens: string[] = [`Período: ${periodLabel}`];
  if (filters?.seller) filterTokens.push(`Colaborador: ${filters.seller}`);
  if (filters?.search) filterTokens.push(`Busca: "${filters.search}"`);
  if (filters?.hideUnassigned) filterTokens.push('Não Atribuídos: Ocultados da visão');
  if (filters?.hideInactive) filterTokens.push('Ex-colaboradores: Ocultados');
  if (filters?.hideThirdParty) filterTokens.push('Terceiros: Ocultados');
  if (residualSalesCount && residualSalesCount > 0) {
    filterTokens.push(`Valor Residual (< R$ 10): ${residualSalesCount} contratos`);
  }
  if (!includeClientList) {
    filterTokens.push('Visão Executiva (Extrato de clientes ocultado)');
  }

  const startY = renderPdfFiltersBanner(doc, filterTokens, pageWidth, marginX, 29);

  // 3. Cálculos e Auditoria
  const resolvedTotalContracts = totalContractsCount !== undefined ? totalContractsCount : records.length;
  const resolvedTotalSales = totalSalesCount !== undefined ? totalSalesCount : resolvedTotalContracts;

  const resolvedUnassignedCount =
    unassignedCount !== undefined
      ? unassignedCount
      : records.filter(
          (r) =>
            !r.seller ||
            r.seller.toLowerCase().includes('não atribu') ||
            r.seller.toLowerCase().includes('nao atribu') ||
            r.seller.toLowerCase().includes('sem vendedor')
        ).length;

  const resolvedUnassignedValue =
    unassignedTotalValue !== undefined
      ? unassignedTotalValue
      : records
          .filter(
            (r) =>
              !r.seller ||
              r.seller.toLowerCase().includes('não atribu') ||
              r.seller.toLowerCase().includes('nao atribu') ||
              r.seller.toLowerCase().includes('sem vendedor')
          )
          .reduce((acc, r) => acc + (Number(r.monthlyValue) || 0), 0);

  const unassignedPct =
    resolvedTotalContracts > 0 ? (resolvedUnassignedCount / resolvedTotalContracts) * 100 : 0;
  const avgTicket = resolvedTotalContracts > 0 ? totalMonthlyValue / resolvedTotalContracts : 0;

  // Monta lista de vendedores (ou utiliza sellersRanking fornecido)
  let effectiveSellers: SellerRankingItemForExport[] = [];
  if (sellersRanking && sellersRanking.length > 0) {
    effectiveSellers = sellersRanking;
  } else if (topSellers && topSellers.length > 0) {
    effectiveSellers = topSellers.map((s) => ({
      name: s.name,
      count: s.count,
      monthlyValue: s.value || s.monthlyValue || 0,
      adhesionValue: s.adhesionValue || 0,
      ticketAverage: s.ticketAverage || 0,
      sharePercent: s.sharePercent || 0,
      sellerType: s.sellerType || 'active',
    }));
  } else {
    const sMap: Record<string, SellerRankingItemForExport> = {};
    for (const r of records) {
      const sName = (r.seller || 'Não atribuído').trim();
      if (!sMap[sName]) {
        const isUn =
          !sName ||
          sName.toLowerCase().includes('não atribu') ||
          sName.toLowerCase().includes('nao atribu');
        sMap[sName] = {
          name: sName,
          count: 0,
          monthlyValue: 0,
          adhesionValue: 0,
          ticketAverage: 0,
          sharePercent: 0,
          sellerType: isUn ? 'unassigned' : 'active',
        };
      }
      sMap[sName].count++;
      sMap[sName].monthlyValue += Number(r.monthlyValue) || 0;
      sMap[sName].adhesionValue = (sMap[sName].adhesionValue || 0) + (Number(r.adhesionValue) || 0);
    }
    effectiveSellers = Object.values(sMap)
      .map((item) => ({
        ...item,
        ticketAverage: item.count > 0 ? item.monthlyValue / item.count : 0,
        sharePercent: totalMonthlyValue > 0 ? (item.monthlyValue / totalMonthlyValue) * 100 : 0,
      }))
      .sort((a, b) => b.monthlyValue - a.monthlyValue);
  }

  // 4. Faixa de 6 Cards Executivos de Vendas Fechadas (Idênticos à tela ClosedSalesView)
  const kpis: PdfKpiCardConfig[] = [
    {
      label: 'Receita Mensal (MRR)',
      value: `R$ ${totalMonthlyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: 'Faturamento recorrente adicionado',
      bg: [236, 253, 245],
      text: [5, 150, 105],
      border: [209, 250, 229],
    },
    {
      label: 'Total de Adesões',
      value: `R$ ${totalAdhesionValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: 'Taxas de instalação / habilitação',
      bg: [240, 253, 250],
      text: [13, 148, 136],
      border: [204, 251, 241],
    },
    {
      label: 'Total de Vendas',
      value: `${resolvedTotalSales} vendas`,
      sub: 'Volume total de negociações',
      bg: [239, 246, 255],
      text: [30, 64, 175],
      border: [219, 234, 254],
    },
    {
      label: 'Contratos Fechados',
      value: `${resolvedTotalContracts} contratos`,
      sub: 'Vendas confirmadas e ativas',
      bg: [238, 242, 255],
      text: [67, 56, 202],
      border: [224, 231, 255],
    },
    {
      label: 'Ticket Médio Geral',
      value: `R$ ${avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: 'Média por contrato fechado',
      bg: [255, 251, 235],
      text: [180, 83, 9],
      border: [254, 243, 199],
    },
    {
      label: 'Não Atribuídos (Auditoria)',
      value: `${resolvedUnassignedCount} (${unassignedPct.toFixed(1)}%)`,
      sub: `R$ ${resolvedUnassignedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} auditados`,
      bg: resolvedUnassignedCount > 0 ? [254, 242, 242] : [248, 250, 252],
      text: resolvedUnassignedCount > 0 ? [185, 28, 28] : [100, 116, 139],
      border: resolvedUnassignedCount > 0 ? [254, 205, 211] : [226, 232, 240],
    },
  ];

  const cardGap = 2.8;
  const cardWidth = (pageWidth - 2 * marginX - 5 * cardGap) / 6;
  const cardHeight = 14.5;
  const cardY = startY;

  kpis.forEach((kpi, idx) => {
    const x = marginX + idx * (cardWidth + cardGap);
    renderPdfKpiCard(doc, x, cardY, cardWidth, cardHeight, kpi);
  });

  // 5. Seção Central da Página 1: Tabela de Vendedores (Esquerda, até 15 operadores) + TOP 3 Performers (Direita, #1, #2, #3)
  const sectionStartY = cardY + cardHeight + 3.5;
  const leftTableWidth = 180;
  const rightColX = marginX + leftTableWidth + 3.0; // 14 + 180 + 3 = 197mm
  const rightColWidth = pageWidth - marginX - rightColX; // 297 - 14 - 197 = 86mm

  // --- COLUNA DIREITA: Cards dos 3 Primeiros Colocados (#1, #2, #3 empilhados verticalmente) ---
  const top3Sellers = effectiveSellers
    .filter(
      (s) =>
        !s.name.toLowerCase().includes('não atribu') &&
        !s.name.toLowerCase().includes('nao atribu') &&
        !s.name.toLowerCase().includes('sem vendedor')
    )
    .slice(0, 3);

  while (top3Sellers.length < 3 && effectiveSellers[top3Sellers.length]) {
    top3Sellers.push(effectiveSellers[top3Sellers.length]);
  }

  const top3CardHeight = 16.0;
  const top3CardGap = 2.5;

  const top3Configs = [
    {
      badge: '#1',
      badgeBg: [254, 243, 199] as [number, number, number],
      badgeText: [180, 83, 9] as [number, number, number],
      accent: [217, 119, 6] as [number, number, number],
      border: [252, 211, 77] as [number, number, number],
      title: 'TOP 1 • LÍDER DE VENDAS',
    },
    {
      badge: '#2',
      badgeBg: [241, 245, 249] as [number, number, number],
      badgeText: [51, 65, 85] as [number, number, number],
      accent: [100, 116, 139] as [number, number, number],
      border: [203, 213, 225] as [number, number, number],
      title: 'TOP 2 • DESTAQUE COMERCIAL',
    },
    {
      badge: '#3',
      badgeBg: [255, 237, 213] as [number, number, number],
      badgeText: [194, 65, 12] as [number, number, number],
      accent: [234, 88, 12] as [number, number, number],
      border: [254, 215, 170] as [number, number, number],
      title: 'TOP 3 • ALTA PERFORMANCE',
    },
  ];

  top3Configs.forEach((cfg, idx) => {
    const s = top3Sellers[idx];
    const cY = sectionStartY + idx * (top3CardHeight + top3CardGap);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(cfg.border[0], cfg.border[1], cfg.border[2]);
    doc.roundedRect(rightColX, cY, rightColWidth, top3CardHeight, 1.6, 1.6, 'FD');

    // Tarja lateral de ranking
    doc.setFillColor(cfg.accent[0], cfg.accent[1], cfg.accent[2]);
    doc.roundedRect(rightColX, cY, 2.0, top3CardHeight, 1, 1, 'F');

    // Badge (#1, #2, #3)
    doc.setFillColor(cfg.badgeBg[0], cfg.badgeBg[1], cfg.badgeBg[2]);
    doc.roundedRect(rightColX + rightColWidth - 12, cY + 2.0, 9.5, 4.2, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(cfg.badgeText[0], cfg.badgeText[1], cfg.badgeText[2]);
    doc.text(cfg.badge, rightColX + rightColWidth - 7.25, cY + 5.1, { align: 'center' });

    // Título de Destaque
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(cfg.badgeText[0], cfg.badgeText[1], cfg.badgeText[2]);
    doc.text(cfg.title, rightColX + 4.2, cY + 4.5);

    // Nome do Vendedor
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.0);
    doc.setTextColor(15, 23, 42);
    const rawName = s ? s.name : 'Sem operador registrado';
    const sName = rawName.length > 22 ? `${rawName.slice(0, 20)}...` : rawName;
    doc.text(sName, rightColX + 4.2, cY + 9.0);

    // Linha com Métricas
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(71, 85, 105);
    const countStr = s ? `${s.count} contr.` : '0 contr.';
    const mrrStr = s
      ? `R$ ${s.monthlyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : 'R$ 0,00';
    const shareStr = s ? `${s.sharePercent.toFixed(1)}%` : '0.0%';
    doc.text(`${countStr}  •  MRR: ${mrrStr}  •  ${shareStr}`, rightColX + 4.2, cY + 13.5);
  });

  // --- COLUNA ESQUERDA: Tabela de Performance de Vendedores (Até 15 operadores sem desalinhamento) ---
  const maxDisplaySellers = 15;
  const displaySellers = effectiveSellers.slice(0, maxDisplaySellers);
  const remainingSellers = effectiveSellers.slice(maxDisplaySellers);

  const sellerRows = displaySellers.map((s, idx) => {
    const isUnassigned =
      s.name.toLowerCase().includes('não atribu') ||
      s.name.toLowerCase().includes('nao atribu') ||
      s.name.toLowerCase().includes('sem vendedor');
    const displayName = isUnassigned
      ? 'Não Atribuído (Auditoria)'
      : s.sellerType === 'inactive'
      ? `${s.name} (Inativo)`
      : s.sellerType === 'third_party'
      ? `${s.name} (Terceiro)`
      : s.name;

    const sellerTypeLabel = isUnassigned
      ? 'Auditoria'
      : s.sellerType === 'inactive'
      ? 'Inativo'
      : s.sellerType === 'third_party'
      ? 'Terceiro'
      : 'Ativo';

    return [
      `#${idx + 1}`,
      displayName,
      sellerTypeLabel,
      String(s.count),
      `R$ ${s.monthlyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `R$ ${(s.adhesionValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `R$ ${s.ticketAverage.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `${s.sharePercent.toFixed(1)}%`,
    ];
  });

  const allRowShares = displaySellers.map((s) => s.sharePercent);

  if (remainingSellers.length > 0) {
    const remCount = remainingSellers.reduce((acc, s) => acc + s.count, 0);
    const remVal = remainingSellers.reduce((acc, s) => acc + s.monthlyValue, 0);
    const remAdh = remainingSellers.reduce((acc, s) => acc + (s.adhesionValue || 0), 0);
    const remAvg = remCount > 0 ? remVal / remCount : 0;
    const remShare = totalMonthlyValue > 0 ? (remVal / totalMonthlyValue) * 100 : 0;
    sellerRows.push([
      '+',
      `Outros colaboradores (${remainingSellers.length})`,
      'Equipe',
      String(remCount),
      `R$ ${remVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `R$ ${remAdh.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `R$ ${remAvg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `${remShare.toFixed(1)}%`,
    ]);
    allRowShares.push(remShare);
  }

  autoTable(doc, {
    startY: sectionStartY,
    margin: { left: marginX, right: pageWidth - marginX - leftTableWidth },
    head: [['#', 'Colaborador / Vendedor', 'Vínculo', 'Contr.', 'Faturamento (MRR)', 'Adesão', 'Ticket Médio', 'Share (%)']],
    body: sellerRows.length > 0 ? sellerRows : [['-', 'Nenhum atendente registrado', '-', '-', '-', '-', '-', '-']],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 5.6, cellPadding: 0.9 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.0, cellPadding: 1.1 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 7.5, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 51 },
      2: { cellWidth: 16.5, halign: 'center' },
      3: { cellWidth: 14, halign: 'right' },
      4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 20, halign: 'right' },
      7: { cellWidth: 23, halign: 'right' },
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 7) {
        const rawShare = allRowShares[data.row.index] || 0;
        if (rawShare > 0) {
          const textStr = `${rawShare.toFixed(1)}%`;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.6);
          const textWidth = doc.getTextWidth(textStr);
          // O texto na célula está alinhado à direita com cellPadding de ~0.9mm
          const paddingRight = 1.0;
          const textStartX = data.cell.x + data.cell.width - paddingRight - textWidth;

          // A linha/barra para antes do número, garantindo respiro limpo sem colisão
          const barStartX = data.cell.x + 1.2;
          const barEndX = textStartX - 1.8;
          const barWidth = Math.max(barEndX - barStartX, 2.0);

          const barHeight = 1.0;
          const barY = data.cell.y + (data.cell.height - barHeight) / 2;

          renderPdfProgressBar(
            doc,
            barStartX,
            barY,
            barWidth,
            barHeight,
            rawShare,
            [5, 150, 105]
          );
        }
      }
    },
  });

  const lastSectionY = Math.max((doc as any).lastAutoTable?.finalY || 0, sectionStartY + 53.0);

  // 6. Gráfico de Evolução Diária de Vendas (ABAIXO DA TABELA, em largura total ampliada e com EIXO Y)
  const chartY = lastSectionY + 3.0;
  const chartHeight = 52;
  const chartWidth = pageWidth - 2 * marginX;

  let chartPoints: Array<{ label: string; sales: number; cancels?: number }> = [];
  if (timeSeries && timeSeries.length > 0) {
    const seriesToUse = timeSeries.length > 31 ? timeSeries.slice(-31) : timeSeries;
    chartPoints = seriesToUse.map((pt) => ({
      label: formatDateBR(pt.date).slice(0, 5),
      sales: pt.sales || pt.contracts || 0,
      cancels: pt.cancellations,
    }));
  } else {
    const dateCountMap: Record<string, number> = {};
    for (const r of records) {
      if (r.date) {
        const dStr = r.date.slice(0, 10);
        dateCountMap[dStr] = (dateCountMap[dStr] || 0) + 1;
      }
    }
    chartPoints = Object.entries(dateCountMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-31)
      .map(([d, cnt]) => ({
        label: formatDateBR(d).slice(0, 5),
        sales: cnt,
      }));
  }

  renderPdfMiniBarChart(
    doc,
    marginX,
    chartY,
    chartWidth,
    chartHeight,
    chartPoints,
    {
      title: `Evolução Diária de Vendas Fechadas — Fluxo Contínuo (${periodLabel})`,
      salesColor: [37, 99, 235],
      cancelColor: [225, 29, 72],
      showYAxis: true,
    }
  );

  // 7. Card Compacto de Síntese Executiva & Governança Comercial
  const calloutY = chartY + chartHeight + 3.0;
  const calloutHeight = 15.5;
  const calloutWidth = pageWidth - 2 * marginX;

  const top1 = top3Sellers[0];
  const top1SharePct = (top1 ? top1.sharePercent || 0 : 0).toFixed(1);
  const synthesisText = [
    `Operação adicionou R$ ${totalMonthlyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} em MRR (${resolvedTotalContracts} contratos, ticket médio R$ ${avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`,
    top1 ? `Líder: ${top1.name} com ${top1SharePct}% da captação total do período.` : '',
    resolvedUnassignedCount > 0
      ? `Auditoria ERP: ${resolvedUnassignedCount} contratos (${unassignedPct.toFixed(1)}%) sem vendedor no RBXSoft (R$ ${resolvedUnassignedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`
      : 'Governança: 100% dos contratos emitidos com vendedor devidamente cadastrado no ERP.',
  ].filter(Boolean).join(' ');

  renderPdfExecutiveCallout(
    doc,
    marginX,
    calloutY,
    calloutWidth,
    calloutHeight,
    'Síntese Executiva & Governança Comercial',
    synthesisText,
    [37, 99, 235]
  );

  // =========================================================================
  // PÁGINA 2+: EXTRATO ANALÍTICO OPERACIONAL DE CONTRATOS FECHADOS (SE SELECIONADO)
  // =========================================================================
  if (includeClientList && records && records.length > 0) {
    doc.addPage();

    renderPdfHeader(
      doc,
      'Extrato Operacional de Contratos Fechados',
      `Detalhamento Individual de Contratos Confirmados e Assinados (${periodLabel})`,
      pageWidth,
      marginX,
      user,
      periodLabel
    );

    const contractRows = records.map((r) => {
      const formattedSignDate = r.date
        ? r.date.slice(0, 10).split('-').reverse().join('/')
        : '-';
      const isUnassigned =
        !r.seller ||
        r.seller.toLowerCase().includes('não atribu') ||
        r.seller.toLowerCase().includes('nao atribu') ||
        r.seller.toLowerCase().includes('sem vendedor');

      return [
        String(r.id || r.number || '-'),
        r.name || r.clientName || 'Cliente',
        r.planDescription || r.plan || r.detail?.split('—')[0]?.trim() || 'Plano de Fibra',
        isUnassigned ? '[Não Atribuído]' : r.seller,
        `R$ ${(Number(r.monthlyValue) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        r.adhesionValue ? `R$ ${Number(r.adhesionValue).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ 0,00',
        formattedSignDate,
        r.salesChannel || 'Direto',
        r.city || r.group || 'Geral',
      ];
    });

    autoTable(doc, {
      startY: 30,
      margin: { left: marginX, right: marginX },
      head: [['Contrato', 'Cliente', 'Plano Contratado', 'Colaborador / Vendedor', 'Mensalidade (MRR)', 'Adesão', 'Data Assinatura', 'Canal', 'Região / Grupo']],
      body: contractRows.length > 0 ? contractRows : [['-', 'Nenhum contrato fechado no período', '-', '-', '-', '-', '-', '-', '-']],
      foot: [[
        'Total:',
        `${records.length} contratos`,
        '-',
        '-',
        `R$ ${totalMonthlyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `R$ ${totalAdhesionValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        '-',
        '-',
        '-',
      ]],
      footStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.2,
      },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 6.8, cellPadding: 1.8 },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 24, fontStyle: 'bold', textColor: [37, 99, 235] },
        1: { cellWidth: 52 },
        2: { cellWidth: 46 },
        3: { cellWidth: 42 },
        4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
        5: { cellWidth: 24, halign: 'right' },
        6: { cellWidth: 22, halign: 'center' },
        7: { cellWidth: 16, halign: 'center' },
        8: { cellWidth: 15, halign: 'center' },
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const cellText = String(data.cell.raw || '');
          if (cellText === '[Não Atribuído]') {
            doc.setTextColor(225, 29, 72);
          }
        }
      },
    });
  }

  // Rodapé em todas as páginas com numeração
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    renderPdfFooter(doc, i, totalPages, pageWidth, marginX);
  }

  const finalFileName = `Relatorio_Vendas_Fechadas_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(finalFileName);
}
