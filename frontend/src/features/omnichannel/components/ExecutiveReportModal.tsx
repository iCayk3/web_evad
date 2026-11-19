import React, { useState } from 'react';
import {
  X,
  Printer,
  Download,
  FileText,
  Edit3,
  Check,
  RotateCcw,
  Loader2,
  Sparkles,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  OmnichannelOverviewMetrics,
  RbxCorrelationResult,
} from '../types/omnichannel.types.ts';
import { ExecutiveReportDocument } from './ExecutiveReportDocument.tsx';

interface ExecutiveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  metrics: OmnichannelOverviewMetrics | null;
  correlation: RbxCorrelationResult | null;
  periodLabel?: string;
  batchFileName?: string;
  selectedAgents?: string[];
}

export const ExecutiveReportModal: React.FC<ExecutiveReportModalProps> = ({
  isOpen,
  onClose,
  metrics,
  correlation,
  periodLabel = 'Período Corrente',
  batchFileName,
  selectedAgents,
}) => {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [customSummaryText, setCustomSummaryText] = useState('');
  const [customRecommendationsText, setCustomRecommendationsText] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);

  if (!isOpen) return null;

  // Imprimir diretamente via navegador (Gera PDF vetorial perfeito nativo com Ctrl+P)
  const handlePrintNative = () => {
    window.print();
  };

  // Download automático via jsPDF + html2canvas
  const handleDownloadDirectPdf = async () => {
    const reportElement = document.getElementById('executive-report-printable');
    if (!reportElement) return;

    try {
      setIsGeneratingPdf(true);
      setGenerationProgress('Processando páginas em alta definição...');

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pages = reportElement.querySelectorAll<HTMLElement>('.report-page');
      const totalPages = pages.length;

      for (let i = 0; i < totalPages; i++) {
        setGenerationProgress(`Renderizando página ${i + 1} de ${totalPages}...`);
        const page = pages[i];

        const canvas = await html2canvas(page, {
          scale: 2, // 2x para nitidez cristalina em telas retina e impressão
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgWidth = 210; // A4 largura em mm
        const pageHeight = 297; // A4 altura em mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (i > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(pageHeight, imgHeight));
      }

      setGenerationProgress('Finalizando arquivo PDF...');
      const fileNameClean = (periodLabel || 'Relatorio_Mensal')
        .replace(/[^a-zA-Z0-9_-]/g, '_');
      pdf.save(`Relatorio_Executivo_Omnichannel_${fileNameClean}.pdf`);
    } catch (err) {
      console.error('[ExecutiveReportModal] Erro ao gerar PDF:', err);
      alert('Houve uma falha ao gerar o PDF diretamente. Você também pode utilizar a opção "Salvar PDF Vetorial".');
    } finally {
      setIsGeneratingPdf(false);
      setGenerationProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn overflow-hidden report-modal-backdrop">
      <div className="bg-white rounded-3xl max-w-5xl w-full h-[92vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden report-modal-container">
        {/* Top Control Bar (não será impressa) */}
        <div className="no-print p-4 sm:px-6 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                Relatório Executivo Omnichannel · Exportador em PDF
              </h3>
              <p className="text-[11px] text-slate-400">
                Pré-visualização fiel para a gestão · Padrão editorial A4 ({periodLabel})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão de Edição de Notas */}
            <button
              onClick={() => setIsEditingNotes(!isEditingNotes)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                isEditingNotes
                  ? 'bg-amber-500 text-amber-950 font-bold shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
              title="Personalizar texto da leitura gerencial e recomendações antes de emitir"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditingNotes ? 'Concluir Edição' : 'Personalizar Texto'}</span>
            </button>

            {/* Imprimir / Salvar Vetorial (Nativo) */}
            <button
              onClick={handlePrintNative}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              title="Imprimir ou Salvar em PDF Vetorial de alta nitidez pelo navegador"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Salvar PDF Vetorial</span>
            </button>

            {/* Download Direto */}
            <button
              disabled={isGeneratingPdf}
              onClick={handleDownloadDirectPdf}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
              title="Download em 1 clique do PDF gerado"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Baixando...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar PDF</span>
                </>
              )}
            </button>

            {/* Fechar */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ml-1"
              title="Fechar visualizador"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de progresso ao gerar PDF */}
        {generationProgress && (
          <div className="no-print bg-blue-50 border-b border-blue-200 px-6 py-2 flex items-center gap-2 text-xs font-semibold text-blue-900 animate-fadeIn">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
            <span>{generationProgress}</span>
          </div>
        )}

        {/* Gaveta de Edição de Texto Customizado */}
        {isEditingNotes && (
          <div className="no-print p-4 bg-amber-50/90 border-b border-amber-200 space-y-3 text-xs text-amber-950 animate-fadeIn max-h-56 overflow-y-auto">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5 text-amber-900">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Personalizar "Leitura Gerencial" (Seção 1):
                </span>
                {customSummaryText && (
                  <button
                    onClick={() => setCustomSummaryText('')}
                    className="text-[11px] text-amber-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restaurar texto automático</span>
                  </button>
                )}
              </div>
              <textarea
                rows={2}
                placeholder="Digite aqui observações gerenciais personalizadas para a diretoria..."
                value={customSummaryText}
                onChange={(e) => setCustomSummaryText(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white border border-amber-300 text-xs text-slate-800 focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div className="space-y-1.5 pt-1 border-t border-amber-200/80">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5 text-amber-900">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Personalizar Recomendações Estratégicas (1 item por linha):
                </span>
                {customRecommendationsText && (
                  <button
                    onClick={() => setCustomRecommendationsText('')}
                    className="text-[11px] text-amber-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restaurar padrão</span>
                  </button>
                )}
              </div>
              <textarea
                rows={2}
                placeholder="Digite recomendações estratégicas, uma por linha..."
                value={customRecommendationsText}
                onChange={(e) => setCustomRecommendationsText(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white border border-amber-300 text-xs text-slate-800 focus:ring-2 focus:ring-amber-500/20 font-mono text-[11px]"
              />
            </div>
          </div>
        )}

        {/* Scrollable Viewport com páginas em formato folha A4 */}
        <div className="flex-1 bg-slate-300/80 overflow-y-auto overflow-x-auto p-4 sm:p-8 flex flex-col items-center report-scroll-viewport">
          <div className="w-[210mm] min-w-[210mm]">
            <ExecutiveReportDocument
              metrics={metrics}
              correlation={correlation}
              periodLabel={periodLabel}
              batchFileName={batchFileName}
              selectedAgents={selectedAgents}
              executiveSummaryText={customSummaryText || undefined}
              recommendationsText={
                customRecommendationsText.trim()
                  ? customRecommendationsText.split('\n').filter(Boolean)
                  : undefined
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};

