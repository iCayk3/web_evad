import { jsPDF } from 'jspdf';

export interface PdfUserContext {
  fullName?: string;
  username?: string;
  role?: string;
}

export interface PdfKpiCardConfig {
  label: string;
  value: string;
  sub?: string;
  badge?: string;
  badgeColor?: [number, number, number];
  bg: [number, number, number];
  text: [number, number, number];
  border?: [number, number, number];
}

/**
 * 1. Cabeçalho Corporativo RBX Hub Signature Dark (#0A1938)
 */
export function renderPdfHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  pageWidth: number,
  marginX: number,
  user?: PdfUserContext | null,
  periodContext: string = 'Período Selecionado'
): void {
  // Fundo institucional Signature Dark
  doc.setFillColor(10, 25, 56); // #0A1938
  doc.rect(0, 0, pageWidth, 26, 'F');

  // Faixa de destaque visual azul (#2563EB)
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 25, pageWidth, 1.2, 'F');

  // Marca RBX Hub e Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('RBX Hub', marginX, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(226, 232, 240);
  doc.text(`— ${title}`, marginX + 24, 11);

  doc.setFontSize(8);
  doc.setTextColor(147, 197, 253);
  doc.text(`${subtitle} • RBXSoft ISP (${periodContext})`, marginX, 18);

  // Metadados de Emissão à Direita
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const formattedDate = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} às ${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}`;
  const operatorName = user?.fullName || user?.username || 'Diretoria / Gestão Comercial';
  const operatorRole = (user?.role || 'comercial').toUpperCase();

  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`Emissão: ${formattedDate}`, pageWidth - marginX, 11, { align: 'right' });

  doc.setTextColor(203, 213, 225);
  doc.text(`Emitido por: ${operatorName} (${operatorRole})`, pageWidth - marginX, 18, {
    align: 'right',
  });
}

/**
 * 2. Rodapé Institucional com Numeração Dinâmica
 */
export function renderPdfFooter(
  doc: jsPDF,
  pageNum: number,
  totalPages: number,
  pageWidth: number,
  marginX: number
): void {
  const footerY = 203;
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, footerY - 2, pageWidth - marginX, footerY - 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184);
  doc.text('RBX Hub • Documento Executivo de Inteligência Comercial — Uso Interno e Diretoria', marginX, footerY + 2);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - marginX, footerY + 2, { align: 'right' });
}

/**
 * 3. Faixa de Filtros Ativos
 */
export function renderPdfFiltersBanner(
  doc: jsPDF,
  tokens: string[],
  pageWidth: number,
  marginX: number,
  startY: number = 29
): number {
  if (!tokens || tokens.length === 0) return startY;

  const bannerHeight = 6.2;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, startY, pageWidth - 2 * marginX, bannerHeight, 1.2, 1.2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(30, 41, 59);
  doc.text('Filtros Ativos:', marginX + 3, startY + 4.2);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(tokens.join('   •   '), marginX + 22, startY + 4.2);

  return startY + bannerHeight + 2.5;
}

/**
 * 4. Renderiza um Card de KPI Individual com Visual Tailwind Moderno
 */
export function renderPdfKpiCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  card: PdfKpiCardConfig
): void {
  doc.setFillColor(card.bg[0], card.bg[1], card.bg[2]);
  if (card.border) {
    doc.setDrawColor(card.border[0], card.border[1], card.border[2]);
    doc.roundedRect(x, y, width, height, 1.8, 1.8, 'FD');
  } else {
    doc.roundedRect(x, y, width, height, 1.8, 1.8, 'F');
  }

  // Rótulo superior
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text(card.label.toUpperCase(), x + 3.2, y + 4.5);

  // Valor principal em destaque
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(card.text[0], card.text[1], card.text[2]);
  doc.text(card.value, x + 3.2, y + 10.0);

  // Subtítulo ou badge opcional
  if (card.sub) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(100, 116, 139);
    doc.text(card.sub, x + 3.2, y + 14.0);
  }
}

/**
 * 5. Barra de Progresso / Share % Proporcional
 */
export function renderPdfProgressBar(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  percent: number,
  fillColor: [number, number, number] = [37, 99, 235],
  bgColor: [number, number, number] = [226, 232, 240]
): void {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = Math.min(height / 2, 0.8);
  // Barra de fundo
  doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
  doc.roundedRect(x, y, width, height, radius, radius, 'F');

  // Preenchimento proporcional
  if (clamped > 0) {
    const fillWidth = (width * clamped) / 100;
    doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
    doc.roundedRect(x, y, Math.max(fillWidth, 0.8), height, radius, radius, 'F');
  }
}

/**
 * 6. Container de Síntese Executiva / Callout
 */
export function renderPdfExecutiveCallout(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  text: string,
  accentColor: [number, number, number] = [37, 99, 235]
): void {
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(x, y, width, height, 2, 2, 'FD');

  // Tarja lateral de acento
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.roundedRect(x, y, 2, height, 1, 1, 'F');

  // Título do Callout
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(title, x + 5, y + 4.8);

  // Texto descritivo
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  doc.text(doc.splitTextToSize(text, width - 10), x + 5, y + 9.5);
}

/**
 * 7. Mini Gráfico Vetorial de Barras para Séries Temporais ou Rankings
 */
export function renderPdfMiniBarChart(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  points: Array<{ label: string; sales: number; cancels?: number; net?: number }>,
  options: {
    title: string;
    maxVal?: number;
    salesColor?: [number, number, number];
    cancelColor?: [number, number, number];
    salesLabel?: string;
    cancelLabel?: string;
    showYAxis?: boolean;
    showNetBadge?: boolean;
  }
): void {
  // Container de fundo
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(x, y, width, height, 1.8, 1.8, 'FD');

  // Título do mini gráfico
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(options.title, x + 3.5, y + 4.8);

  // Legenda
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  const sColor = options.salesColor || [5, 150, 105];
  const cColor = options.cancelColor || [225, 29, 72];
  const sLabel = options.salesLabel || 'Vendas';
  const cLabel = options.cancelLabel || 'Cancel.';

  const hasCancels = points.some((p) => p.cancels !== undefined);
  const showNet = options.showNetBadge && points.some((p) => p.net !== undefined);

  if (showNet) {
    const nLabel = 'Saldo Líq. (Tag)';
    const nWidth = doc.getTextWidth(nLabel);
    const cWidth = doc.getTextWidth(cLabel);
    const sWidth = doc.getTextWidth(sLabel);

    const nTextX = x + width - 4 - nWidth;
    const nRectX = nTextX - 3.5;
    const cTextX = nRectX - 5 - cWidth;
    const cRectX = cTextX - 3.5;
    const sTextX = cRectX - 5 - sWidth;
    const sRectX = sTextX - 3.5;

    doc.setFillColor(sColor[0], sColor[1], sColor[2]);
    doc.rect(sRectX, y + 2.5, 2.5, 2.5, 'F');
    doc.setTextColor(71, 85, 105);
    doc.text(sLabel, sTextX, y + 4.6);

    doc.setFillColor(cColor[0], cColor[1], cColor[2]);
    doc.rect(cRectX, y + 2.5, 2.5, 2.5, 'F');
    doc.text(cLabel, cTextX, y + 4.6);

    doc.setFillColor(16, 185, 129);
    doc.rect(nRectX, y + 2.5, 2.5, 2.5, 'F');
    doc.text(nLabel, nTextX, y + 4.6);
  } else if (hasCancels) {
    const cWidth = doc.getTextWidth(cLabel);
    const sWidth = doc.getTextWidth(sLabel);
    const cTextX = x + width - 4 - cWidth;
    const cRectX = cTextX - 3.5;
    const sTextX = cRectX - 5 - sWidth;
    const sRectX = sTextX - 3.5;

    doc.setFillColor(sColor[0], sColor[1], sColor[2]);
    doc.rect(sRectX, y + 2.5, 2.5, 2.5, 'F');
    doc.setTextColor(71, 85, 105);
    doc.text(sLabel, sTextX, y + 4.6);

    doc.setFillColor(cColor[0], cColor[1], cColor[2]);
    doc.rect(cRectX, y + 2.5, 2.5, 2.5, 'F');
    doc.text(cLabel, cTextX, y + 4.6);
  } else {
    const sWidth = doc.getTextWidth(sLabel);
    const sTextX = x + width - 4 - sWidth;
    const sRectX = sTextX - 3.5;

    doc.setFillColor(sColor[0], sColor[1], sColor[2]);
    doc.rect(sRectX, y + 2.5, 2.5, 2.5, 'F');
    doc.setTextColor(71, 85, 105);
    doc.text(sLabel, sTextX, y + 4.6);
  }

  // Área dos gráficos (com ou sem recuo para Eixo Y)
  const chartTop = y + 7.5;
  const chartBottom = y + height - 5.5;
  const chartHeight = chartBottom - chartTop;
  const yAxisWidth = options.showYAxis ? 8.5 : 0;
  const chartLeft = x + 3.5 + yAxisWidth;
  const chartRight = x + width - 4;
  const chartWidth = chartRight - chartLeft;

  // Linha base inferior
  doc.setDrawColor(203, 213, 225);
  doc.line(chartLeft, chartBottom, chartRight, chartBottom);

  if (!points || points.length === 0) {
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('Sem movimentação no intervalo', x + width / 2, y + height / 2, { align: 'center' });
    return;
  }

  const rawMax = Math.max(...points.map((p) => Math.max(p.sales, p.cancels || 0)), 1);
  const maxVal = options.maxVal || rawMax;
  const scaleMax = maxVal <= 4 ? Math.max(Math.ceil(maxVal), 2) : Math.ceil(maxVal / 5) * 5;

  // Renderização do Eixo Y e Linhas de Grade Sutis
  if (options.showYAxis) {
    // Linha vertical do Eixo Y
    doc.setDrawColor(203, 213, 225);
    doc.line(chartLeft, chartTop, chartLeft, chartBottom);

    const midVal = Math.round(scaleMax / 2);
    const yTicks = [
      { val: scaleMax, yPos: chartTop },
      { val: midVal, yPos: chartBottom - (midVal / scaleMax) * chartHeight },
      { val: 0, yPos: chartBottom },
    ];

    yTicks.forEach((tick) => {
      // Linha de grade horizontal tracejada suave
      if (tick.val > 0) {
        doc.setDrawColor(241, 245, 249);
        doc.setLineDashPattern([1.5, 1.5], 0);
        doc.line(chartLeft, tick.yPos, chartRight, tick.yPos);
        doc.setLineDashPattern([], 0);
      }

      // Rótulo numérico à esquerda do Eixo Y
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(148, 163, 184);
      doc.text(String(tick.val), chartLeft - 1.5, tick.yPos + 1.2, { align: 'right' });
    });
  }

  const barSlotWidth = chartWidth / points.length;
  const barWidth = Math.max(1.0, Math.min(barSlotWidth * 0.38, 3.8));

  const labelStep = points.length <= 12 ? 1 : points.length <= 22 ? 2 : points.length <= 32 ? 3 : Math.ceil(points.length / 10);

  points.forEach((p, idx) => {
    const slotX = chartLeft + idx * barSlotWidth + barSlotWidth / 2;

    // Barra de Vendas
    const sH = (p.sales / scaleMax) * chartHeight;
    doc.setFillColor(sColor[0], sColor[1], sColor[2]);
    doc.roundedRect(slotX - barWidth - 0.3, chartBottom - sH, barWidth, sH, 0.4, 0.4, 'F');

    // Valor numérico no topo da barra de vendas quando houver altura suficiente e não estiver usando net badges com conflito
    if (!showNet && chartHeight >= 30 && p.sales > 0 && sH > 4.5 && (idx % labelStep === 0 || p.sales >= maxVal)) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.8);
      doc.setTextColor(sColor[0], sColor[1], sColor[2]);
      doc.text(String(p.sales), slotX - barWidth / 2 - 0.3, chartBottom - sH - 1.0, { align: 'center' });
    }

    // Barra de Cancelamentos (se houver)
    let cH = 0;
    if (p.cancels !== undefined) {
      cH = ((p.cancels || 0) / scaleMax) * chartHeight;
      doc.setFillColor(cColor[0], cColor[1], cColor[2]);
      doc.roundedRect(slotX + 0.3, chartBottom - cH, barWidth, cH, 0.4, 0.4, 'F');
    }

    // Badge / Tag de Saldo Líquido no topo do par de barras
    if (showNet && p.net !== undefined) {
      const topOfBars = chartBottom - Math.max(sH, cH);
      const badgeY = Math.max(chartTop + 0.8, topOfBars - 3.8);
      const isPositive = p.net > 0;
      const isNegative = p.net < 0;
      const badgeText = isPositive ? `+${p.net}` : `${p.net}`;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.6);
      const bTextW = doc.getTextWidth(badgeText);
      const bW = Math.max(bTextW + 1.8, 5.2);
      const bH = 2.6;
      const bX = slotX - bW / 2;

      if (isPositive) {
        doc.setFillColor(220, 252, 231);
        doc.setDrawColor(187, 247, 208);
        doc.setTextColor(22, 101, 52);
      } else if (isNegative) {
        doc.setFillColor(254, 226, 226);
        doc.setDrawColor(254, 202, 202);
        doc.setTextColor(153, 27, 27);
      } else {
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(226, 232, 240);
        doc.setTextColor(100, 116, 139);
      }

      doc.roundedRect(bX, badgeY, bW, bH, 0.5, 0.5, 'FD');
      doc.text(badgeText, slotX, badgeY + 1.9, { align: 'center' });
    }

    // Rótulo inferior da data (garante visualização limpa e inclusão da última data)
    if (idx % labelStep === 0 || idx === points.length - 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(100, 116, 139);
      doc.text(p.label, slotX, chartBottom + 3.8, { align: 'center' });
    }
  });
}
