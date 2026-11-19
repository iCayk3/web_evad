import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
import { formatDateBR } from './utils.ts';

export interface CancellationRecordForExport {
  id: string; // Número do contrato
  clientId?: number | string;
  name: string; // Nome do cliente
  city?: string;
  group?: string;
  region?: string;
  state?: string;
  plan?: string;
  monthlyValue?: number;
  date?: string; // Data cancelamento
  reason?: string;
  competitor?: string;
  seller?: string;
}

export interface ExportCancellationsPdfOptions {
  records: CancellationRecordForExport[];
  user?: {
    fullName?: string;
    username?: string;
    role?: string;
  } | null;
  periodLabel?: string;
  filters?: {
    search?: string;
    city?: string;
    reason?: string;
    excludedReasons?: string[];
    seller?: string;
    hideUnassigned?: boolean;
    hideInactive?: boolean;
    hideThirdParty?: boolean;
  };
  timeSeries?: Array<{ date: string; cancellations: number }>;
  includeClientList?: boolean;
}

export function exportCancellationsToPdf({
  records,
  user,
  periodLabel = 'Período Selecionado',
  filters,
  timeSeries,
  includeClientList = false,
}: ExportCancellationsPdfOptions): void {
  if (!records || records.length === 0) {
    alert('Nenhum cliente cancelado para exportação.');
    return;
  }

  // Cria documento em orientação Paisagem (Landscape) A4
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const marginX = 14;

  // 1. Cabeçalho Corporativo RBX Hub Signature Dark
  renderPdfHeader(
    doc,
    'Relatório Executivo de Cancelamentos & Churn',
    'Diagnóstico de Evasão Contratual, Motivos e Análise Territorial',
    pageWidth,
    marginX,
    user,
    periodLabel
  );

  // 2. Quadro de Métricas Executivas
  let totalMonthlyLoss = 0;
  const reasonMap: Record<string, { count: number; loss: number }> = {};
  const cityMap: Record<string, { count: number; loss: number }> = {};
  const dateMap: Record<string, number> = {};

  for (const r of records) {
    const val = Number(r.monthlyValue) || 0;
    totalMonthlyLoss += val;

    const rKey = r.reason || 'Não informado';
    if (!reasonMap[rKey]) reasonMap[rKey] = { count: 0, loss: 0 };
    reasonMap[rKey].count++;
    reasonMap[rKey].loss += val;

    const cKey = r.city || r.region || 'Não informada';
    if (!cityMap[cKey]) cityMap[cKey] = { count: 0, loss: 0 };
    cityMap[cKey].count++;
    cityMap[cKey].loss += val;

    if (r.date) {
      const dKey = r.date.slice(0, 10);
      dateMap[dKey] = (dateMap[dKey] || 0) + 1;
    }
  }

  // Ordena motivos e cidades
  const sortedReasons = Object.entries(reasonMap)
    .map(([reason, data]) => ({
      reason,
      count: data.count,
      loss: data.loss,
      share: (data.count / (records.length || 1)) * 100,
    }))
    .sort((a, b) => b.count - a.count);

  const sortedCities = Object.entries(cityMap)
    .map(([city, data]) => ({
      city,
      count: data.count,
      loss: data.loss,
      share: (data.count / (records.length || 1)) * 100,
    }))
    .sort((a, b) => b.count - a.count);

  const topReason = sortedReasons[0];
  const topCity = sortedCities[0];

  // 3. Faixa de Filtros Aplicados
  const filterTokens: string[] = [`Período: ${periodLabel}`];
  if (filters?.seller && filters.seller !== 'all') filterTokens.push(`Colaborador: ${filters.seller}`);
  if (filters?.city) filterTokens.push(`Região/Grupo: ${filters.city}`);
  if (filters?.reason) filterTokens.push(`Motivo: ${filters.reason}`);
  if (filters?.search) filterTokens.push(`Busca: "${filters.search}"`);
  if (filters?.excludedReasons && filters.excludedReasons.length > 0) {
    filterTokens.push(`Motivos Desconsiderados (${filters.excludedReasons.length}): ${filters.excludedReasons.join(', ')}`);
  }
  if (filters?.hideInactive) filterTokens.push('Ex-colaboradores: Ocultados');
  if (filters?.hideThirdParty) filterTokens.push('Terceiros: Ocultados');
  if (!includeClientList) filterTokens.push('Visão Executiva (Extrato de clientes ocultado)');

  const startY = renderPdfFiltersBanner(doc, filterTokens, pageWidth, marginX, 29);

  // 4. Quatro Cards de Indicadores de Churn (Idênticos à tela)
  const kpis: PdfKpiCardConfig[] = [
    {
      label: 'Total Cancelados',
      value: `${records.length} contratos`,
      sub: filters?.excludedReasons?.length
        ? `Cálculo com ${filters.excludedReasons.length} motivos desconsiderados`
        : 'Evasão total no período',
      bg: [255, 241, 242],
      text: [225, 29, 72],
      border: [254, 205, 211],
    },
    {
      label: 'Evasão Mensal (MRR)',
      value: `R$ ${totalMonthlyLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: 'Perda recorrente de receita',
      bg: [255, 247, 237],
      text: [194, 65, 12],
      border: [254, 215, 170],
    },
    {
      label: 'Principal Motivo',
      value: topReason ? (topReason.reason.length > 22 ? `${topReason.reason.slice(0, 20)}...` : topReason.reason) : 'N/A',
      sub: topReason ? `${topReason.count} contratos (${topReason.share.toFixed(1)}% do churn)` : 'Sem dados',
      bg: [238, 242, 255],
      text: [67, 56, 202],
      border: [224, 231, 255],
    },
    {
      label: 'Maior Impacto Regional',
      value: topCity ? (topCity.city.length > 22 ? `${topCity.city.slice(0, 20)}...` : topCity.city) : 'N/A',
      sub: topCity ? `${topCity.count} cancelamentos (${topCity.share.toFixed(1)}%)` : 'Sem dados',
      bg: [241, 245, 249],
      text: [51, 65, 85],
      border: [226, 232, 240],
    },
  ];

  const cardWidth = 64.5;
  const cardHeight = 15.5;
  const cardY = startY;

  kpis.forEach((kpi, idx) => {
    const x = marginX + idx * (cardWidth + 3.2);
    renderPdfKpiCard(doc, x, cardY, cardWidth, cardHeight, kpi);
  });

  // 5. Grid de 2 Colunas: Motivos de Cancelamento (Esquerda) vs Perda Territorial (Direita)
  const tableStartY = cardY + cardHeight + 4.5;
  const maxDiagnosticRows = 5;

  // Tabela Esquerda: Motivos de Cancelamento com Barra de Impacto
  const reasonRows = sortedReasons.slice(0, maxDiagnosticRows).map((r, idx) => [
    `#${idx + 1}`,
    r.reason,
    String(r.count),
    `R$ ${r.loss.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `${r.share.toFixed(1)}%`,
  ]);

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: marginX, right: pageWidth / 2 + 2.5 },
    head: [['#', 'Motivo do Cancelamento', 'Contratos', 'Perda R$', 'Share (%)']],
    body: reasonRows.length > 0 ? reasonRows : [['-', 'Nenhum motivo registrado', '-', '-', '-']],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7.2, cellPadding: 2.0 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 46 },
      2: { cellWidth: 18, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 26, halign: 'right' },
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const rawShare = sortedReasons[data.row.index]?.share || 0;
        if (rawShare > 0) {
          const textStr = `${rawShare.toFixed(1)}%`;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.2);
          const textWidth = doc.getTextWidth(textStr);
          const paddingRight = 2.0;
          const textStartX = data.cell.x + data.cell.width - paddingRight - textWidth;

          const barStartX = data.cell.x + 2.0;
          const barEndX = textStartX - 2.0;
          const barWidth = Math.max(barEndX - barStartX, 2.0);

          const barHeight = 1.2;
          const barY = data.cell.y + (data.cell.height - barHeight) / 2;

          renderPdfProgressBar(
            doc,
            barStartX,
            barY,
            barWidth,
            barHeight,
            rawShare,
            [225, 29, 72]
          );
        }
      }
    },
  });

  // Tabela Direita: Cidades / Regiões Mais Afetadas com Barra de Impacto
  const cityRows = sortedCities.slice(0, maxDiagnosticRows).map((c, idx) => [
    `#${idx + 1}`,
    c.city,
    String(c.count),
    `R$ ${c.loss.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `${c.share.toFixed(1)}%`,
  ]);

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: pageWidth / 2 + 2.5, right: marginX },
    head: [['#', 'Município / Região', 'Contratos', 'Perda R$', 'Impacto (%)']],
    body: cityRows.length > 0 ? cityRows : [['-', 'Sem dados territoriais', '-', '-', '-']],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7.2, cellPadding: 2.0 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 46 },
      2: { cellWidth: 18, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 26, halign: 'right' },
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const rawShare = sortedCities[data.row.index]?.share || 0;
        if (rawShare > 0) {
          const textStr = `${rawShare.toFixed(1)}%`;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.2);
          const textWidth = doc.getTextWidth(textStr);
          const paddingRight = 2.0;
          const textStartX = data.cell.x + data.cell.width - paddingRight - textWidth;

          const barStartX = data.cell.x + 2.0;
          const barEndX = textStartX - 2.0;
          const barWidth = Math.max(barEndX - barStartX, 2.0);

          const barHeight = 1.2;
          const barY = data.cell.y + (data.cell.height - barHeight) / 2;

          renderPdfProgressBar(
            doc,
            barStartX,
            barY,
            barWidth,
            barHeight,
            rawShare,
            [194, 65, 12]
          );
        }
      }
    },
  });

  // 6. Gráfico de Evolução Diária de Cancelamentos com Eixo Y e Gridlines
  const lastDiagTableY = Math.max((doc as any).lastAutoTable?.finalY || 0, tableStartY + 35);
  const chartY = lastDiagTableY + 3.0;
  const chartHeight = 50;

  const rawSeries = timeSeries && timeSeries.length > 0
    ? (timeSeries.length > 31 ? timeSeries.slice(-31) : timeSeries).map((pt) => ({
        label: formatDateBR(pt.date).slice(0, 5),
        sales: pt.cancellations,
      }))
    : Object.entries(dateMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-31)
        .map(([date, cancels]) => ({
          label: formatDateBR(date).slice(0, 5),
          sales: cancels, // renderizado como barra única de volume de churn
        }));

  const datePoints = rawSeries;

  if (datePoints.length > 0) {
    renderPdfMiniBarChart(
      doc,
      marginX,
      chartY,
      pageWidth - 2 * marginX,
      chartHeight,
      datePoints,
      {
        title: 'Evolução Diária de Cancelamentos (Identificação de Picos de Churn)',
        salesColor: [225, 29, 72],
        salesLabel: 'Cancelamento',
        showYAxis: true,
      }
    );
  }

  // 7. Box de Síntese Executiva & Recomendações Estratégicas de Retenção
  const calloutY = chartY + chartHeight + 3.0;
  const calloutHeight = 15.5;

  const retentionSummary =
    `O período registrou a perda de ${records.length} contratos com impacto financeiro mensal de R$ ${totalMonthlyLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. ` +
    (topReason ? `Principal causa identificada: "${topReason.reason}" respondendo por ${topReason.share.toFixed(1)}% dos casos. ` : '') +
    (topCity ? `Região mais vulnerável: "${topCity.city}" (${topCity.count} cancelamentos). ` : '') +
    `Recomendação imediata: Implementar contato ativo preventivo nos primeiros 90 dias e auditar motivos técnicos de instabilidade na região crítica.`;

  renderPdfExecutiveCallout(
    doc,
    marginX,
    calloutY,
    pageWidth - 2 * marginX,
    calloutHeight,
    'Diagnóstico Estratégico de Churn & Recomendações de Retenção',
    retentionSummary,
    [225, 29, 72]
  );

  // =========================================================================
  // PÁGINA 2+: EXTRATO DETALHADO DE CONTRATOS CANCELADOS (CONDICIONAL)
  // =========================================================================
  if (includeClientList) {
    doc.addPage();
    renderPdfHeader(
      doc,
      'Extrato Operacional de Cancelamentos',
      'Relação Nominal de Assinaturas Rescindidas no Período',
      pageWidth,
      marginX,
      user,
      periodLabel
    );

  const tableRows = records.map((r) => {
    const clientCode = r.clientId ? `#${r.clientId}` : '';
    const subscriberInfo = clientCode ? `${clientCode}\n${r.name}` : r.name;
    const planInfo = r.plan || 'Plano Padrão';
    const valueStr = r.monthlyValue
      ? `R$ ${Number(r.monthlyValue).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : 'R$ 0,00';
    const regionGroup = r.group || r.city || 'Geral';
    const reasonText = r.reason || 'Não informado no RBX';
    const competitorText = r.competitor && r.competitor !== 'N/A' && r.competitor !== '—' ? r.competitor : 'Não apurado';
    const sellerText = r.seller || 'Não atribuído';
    const dateStr = r.date ? formatDateBR(r.date).slice(0, 10) : '—';

    return [
      r.id || '—',
      subscriberInfo,
      regionGroup,
      planInfo,
      valueStr,
      dateStr,
      reasonText,
      competitorText,
      sellerText,
    ];
  });

  autoTable(doc, {
    startY: 30,
    head: [[
      'Contrato',
      'Assinante / Código',
      'Região / Grupo',
      'Plano Cancelado',
      'Mensalidade',
      'Data Canc.',
      'Motivo do Cancelamento',
      'Concorrência',
      'Responsável',
    ]],
    body: tableRows,
    theme: 'grid',
    margin: { left: marginX, right: marginX, top: 12, bottom: 15 },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left',
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 7.0,
      textColor: [30, 41, 59],
      cellPadding: 2.0,
      valign: 'top',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: 'bold', textColor: [37, 99, 235] },
      1: { cellWidth: 46 },
      2: { cellWidth: 28 },
      3: { cellWidth: 38 },
      4: { cellWidth: 24, fontStyle: 'bold', halign: 'right' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 38, textColor: [190, 18, 60] },
      7: { cellWidth: 26 },
      8: { cellWidth: 27 },
    },
  });
  }

  // Numeração oficial e rodapé institucional em todas as páginas
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    renderPdfFooter(doc, i, totalPages, pageWidth, marginX);
  }

  const safePeriod = periodLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');
  doc.save(`Relatorio_Cancelamentos_Churn_${safePeriod}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
