import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportPdfOptions {
  tickets: any[];
  user?: {
    fullName?: string;
    username?: string;
    role?: string;
  } | null;
  filters?: {
    type?: string;
    search?: string;
    status?: string;
    slaFilter?: string;
    topics?: string[];
  };
}

export function exportTicketsToPdf({ tickets, user, filters }: ExportPdfOptions): void {
  if (!tickets || tickets.length === 0) {
    alert('Nenhum atendimento selecionado para exportação.');
    return;
  }

  // Cria documento em orientação Paisagem (Landscape) para layout tabular detalhado
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const marginX = 14;

  // 1. Cabeçalho Corporativo RBX Hub (Signature Dark #0A1938)
  doc.setFillColor(10, 25, 56); // #0A1938
  doc.rect(0, 0, pageWidth, 26, 'F');

  // Faixa de destaque visual azul na base do banner
  doc.setFillColor(37, 99, 235); // #2563EB
  doc.rect(0, 25, pageWidth, 1.2, 'F');

  // Marca e Título Principal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('RBX Hub', marginX, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(226, 232, 240);
  doc.text('— Relatório Operacional de Atendimentos', marginX + 24, 11);

  doc.setFontSize(8);
  doc.setTextColor(147, 197, 253); // #93C5FD
  doc.text('Fila Operacional, Monitoramento de SLAs e Governança • RBXSoft ISP', marginX, 18);

  // Metadados do documento (Data, Hora e Emissor) à direita
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const formattedDate = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} às ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const operatorName = user?.fullName || user?.username || 'Operador';
  const operatorRole = (user?.role || 'operador').toUpperCase();

  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`Emissão: ${formattedDate}`, pageWidth - marginX, 11, { align: 'right' });

  doc.setTextColor(203, 213, 225);
  doc.text(`Emitido por: ${operatorName} (${operatorRole})`, pageWidth - marginX, 18, { align: 'right' });

  // 2. Quadro de Métricas Executivas (KPIs dos Selecionados)
  let okCount = 0;
  let riskCount = 0;
  let overdueCount = 0;
  let concludedCount = 0;

  for (const t of tickets) {
    if (t.status === 'Concluído') {
      concludedCount++;
    }
    if (t.isOverdue || t.slaStatus === 'OVERDUE' || t.slaStatus === 'vencido') {
      overdueCount++;
    } else if (t.isAtRisk || t.slaStatus === 'RISK' || t.slaStatus === 'risco') {
      riskCount++;
    } else if (t.status !== 'Concluído') {
      okCount++;
    }
  }

  const kpis = [
    { label: 'Total Selecionado', value: tickets.length, bg: [15, 23, 42], text: [255, 255, 255] },
    { label: 'No Prazo', value: okCount, bg: [236, 253, 245], text: [5, 150, 105], border: [167, 243, 208] },
    { label: 'Em Risco (<60m)', value: riskCount, bg: [254, 243, 199], text: [217, 119, 6], border: [253, 230, 138] },
    { label: 'SLA Vencido', value: overdueCount, bg: [255, 228, 230], text: [225, 29, 72], border: [254, 205, 211] },
    { label: 'Concluídos', value: concludedCount, bg: [241, 245, 249], text: [71, 85, 105], border: [226, 232, 240] },
  ];

  const cardWidth = 51.5;
  const cardHeight = 13.5;
  const cardY = 30;

  kpis.forEach((kpi, idx) => {
    const x = marginX + idx * (cardWidth + 2.8);

    doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
    if (kpi.border) {
      doc.setDrawColor(kpi.border[0], kpi.border[1], kpi.border[2]);
      doc.roundedRect(x, cardY, cardWidth, cardHeight, 1.8, 1.8, 'FD');
    } else {
      doc.roundedRect(x, cardY, cardWidth, cardHeight, 1.8, 1.8, 'F');
    }

    // Label do KPI
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(kpi.text[0], kpi.text[1], kpi.text[2]);
    doc.text(kpi.label.toUpperCase(), x + 4, cardY + 5);

    // Valor do KPI
    doc.setFontSize(11);
    doc.text(String(kpi.value), x + 4, cardY + 10.5);
  });

  // Linha informativa de filtros aplicados
  let filterY = 47.5;
  const filterParts: string[] = [];
  if (filters?.type) filterParts.push(`Setor: ${filters.type}`);
  if (filters?.status) filterParts.push(`Situação: ${filters.status}`);
  if (filters?.slaFilter) {
    const slaName = filters.slaFilter === 'overdue' ? 'SLA Vencido' : filters.slaFilter === 'risk' ? 'SLA em Risco' : 'SLA no Prazo';
    filterParts.push(`Filtro SLA: ${slaName}`);
  }
  if (filters?.topics && filters.topics.length > 0) {
    filterParts.push(`Tópicos (${filters.topics.length}): ${filters.topics.join(', ')}`);
  }
  if (filters?.search) filterParts.push(`Busca: "${filters.search}"`);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const filterSummary = filterParts.length > 0
    ? `Critérios de filtro: ${filterParts.join('  •  ')}`
    : `Exibindo ${tickets.length} chamados selecionados sem filtros adicionais`;
  doc.text(filterSummary, marginX, filterY);

  // 3. Montagem dos Dados da Tabela
  const tableRows = tickets.map((t) => {
    const clientCode = t.clientId ? `#${t.clientId}` : (t.clientCode ? `#${t.clientCode}` : '—');
    const clientName = t.clientName || t.nome || t.name || 'Cliente não identificado';
    const subscriberInfo = `${clientCode}\n${clientName}`;

    let slaLabel = 'No Prazo';
    if (t.isOverdue || t.slaStatus === 'OVERDUE' || t.slaStatus === 'vencido') {
      slaLabel = 'SLA Vencido';
    } else if (t.isAtRisk || t.slaStatus === 'RISK' || t.slaStatus === 'risco') {
      slaLabel = 'Em Risco (<60m)';
    } else if (t.status === 'Concluído') {
      slaLabel = 'Finalizado';
    }

    const sectorTag = t.type ? ` [${t.type}]` : '';
    const topicAndCause = `${t.topicName || 'Geral'}${sectorTag}\n(${t.causeName || 'Em apuração'})`;
    const openAndDue = `Aber: ${t.createdAt || '—'}\nPrev: ${t.slaDueAt || '—'}`;

    return [
      t.protocol || `#${t.id}`,
      subscriberInfo,
      topicAndCause,
      t.status || 'Aberto',
      slaLabel,
      t.technicianName || t.assignedTechnicianName || 'Não atribuído',
      openAndDue,
    ];
  });

  // 4. Renderização da Tabela via AutoTable
  autoTable(doc, {
    startY: 50.5,
    head: [[
      'Protocolo',
      'Assinante / Cliente',
      'Tópico & Causa',
      'Situação',
      'Condição SLA',
      'Técnico Designado',
      'Abertura & Limite',
    ]],
    body: tableRows,
    theme: 'grid',
    margin: { left: marginX, right: marginX, top: 12, bottom: 15 },
    headStyles: {
      fillColor: [15, 23, 42], // #0F172A
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 7.8,
      textColor: [30, 41, 59],
      cellPadding: 2.8,
      valign: 'top',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // #F8FAFC
    },
    columnStyles: {
      0: { cellWidth: 30, fontStyle: 'bold' }, // Protocolo
      1: { cellWidth: 62 }, // Assinante / Cliente
      2: { cellWidth: 52 }, // Tópico & Causa
      3: { cellWidth: 25 }, // Situação
      4: { cellWidth: 30, fontStyle: 'bold' }, // Condição SLA
      5: { cellWidth: 35 }, // Técnico
      6: { cellWidth: 35, fontSize: 7.2 }, // Abertura & Limite
    },
    didParseCell: (data) => {
      // Destaque colorido condicional na coluna de Condição SLA
      if (data.section === 'body' && data.column.index === 4) {
        const text = String(data.cell.raw);
        if (text.includes('Vencido')) {
          data.cell.styles.textColor = [225, 29, 72]; // Rose / Vermelho
          data.cell.styles.fillColor = [255, 241, 242];
        } else if (text.includes('Risco')) {
          data.cell.styles.textColor = [217, 119, 6]; // Âmbar / Laranja
          data.cell.styles.fillColor = [254, 243, 199];
        } else if (text.includes('No Prazo')) {
          data.cell.styles.textColor = [5, 150, 105]; // Verde
          data.cell.styles.fillColor = [240, 253, 244];
        }
      }

      // Protocolo com estilo mono em azul
      if (data.section === 'body' && data.column.index === 0) {
        data.cell.styles.textColor = [37, 99, 235];
      }
    },
    didDrawPage: (data) => {
      // Rodapé oficial em todas as páginas
      const currentPage = data.pageNumber;
      const totalPages = (doc as any).internal.getNumberOfPages();

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(marginX, pageHeight - 10, pageWidth - marginX, pageHeight - 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);

      doc.text(
        'RBX Hub • Documento oficial de controle operacional e cumprimento de SLAs — Uso interno restrito.',
        marginX,
        pageHeight - 6
      );

      doc.text(
        `Página ${currentPage} de ${totalPages}`,
        pageWidth - marginX,
        pageHeight - 6,
        { align: 'right' }
      );
    },
  });

  // Salva e inicia download automático do PDF
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  doc.save(`RBX_Relatorio_Atendimentos_${timestamp}.pdf`);
}
