import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  PhoneCall,
  UserCheck,
  Layers,
  Clock,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { omnichannelApi } from '../api/omnichannel.api.ts';
import { PreviewData, ImportBatch } from '../types/omnichannel.types.ts';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportCompleted: (batch: ImportBatch) => void;
}

type Step = 'upload' | 'preview' | 'processing' | 'success';

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImportCompleted }) => {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [tempFilePath, setTempFilePath] = useState<string>('');
  const [activeBatch, setActiveBatch] = useState<ImportBatch | null>(null);
  const [pollIntervalId, setPollIntervalId] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalId) clearInterval(pollIntervalId);
    };
  }, [pollIntervalId]);

  if (!isOpen) return null;

  const handleFileChange = async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.csv')) {
      setErrorMsg('Formato inválido. Por favor, envie um arquivo .xlsx ou .csv.');
      return;
    }

    if (selectedFile.size > 20 * 1024 * 1024) {
      setErrorMsg('O arquivo excede o limite máximo permitido de 20 MB.');
      return;
    }

    setFile(selectedFile);
    setErrorMsg(null);
    setLoadingPreview(true);

    try {
      const res = await omnichannelApi.uploadPreview(selectedFile);
      const previewData = (res && res.preview) ? res.preview : (res as any);
      setPreview(previewData);
      setTempFilePath(res.tempFilePath || (res as any)?.temp_file_path || '');
      setStep('preview');
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao processar prévia da planilha.');
      setFile(null);
      setPreview(null);
      setStep('upload');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = async () => {
    if (!file && !tempFilePath) return;

    setErrorMsg(null);
    setStep('processing');

    try {
      let res: { batchId: string; status: string; message: string };
      if (tempFilePath) {
        res = await omnichannelApi.confirmImport(tempFilePath, file ? file.name : '');
      } else if (file) {
        // Fallback: upload direto multipart se tempFilePath não estiver disponível
        res = await omnichannelApi.directImport(file);
      } else {
        throw new Error('Nenhum arquivo ou caminho temporário selecionado.');
      }

      // Start real-time polling
      const batchId = res.batchId;
      const interval = setInterval(async () => {
        try {
          const statusRes = await omnichannelApi.getBatchStatus(batchId);
          const b = statusRes.batch || (statusRes as any);
          setActiveBatch(b);

          if (b && (b.status === 'completed' || (b.status as any) === 'concluido')) {
            clearInterval(interval);
            setStep('success');
            onImportCompleted(b);
          } else if (b && b.status === 'failed') {
            clearInterval(interval);
            setErrorMsg(b.error_message || b.errorMessage || 'Erro durante o processamento do lote.');
          }
        } catch {
          // Retry on next tick
        }
      }, 1200);

      setPollIntervalId(interval);
    } catch (err: any) {
      setStep('preview');
      setErrorMsg(err.message || 'Falha ao iniciar a importação.');
    }
  };

  const handleReset = () => {
    if (pollIntervalId) clearInterval(pollIntervalId);
    setStep('upload');
    setFile(null);
    setPreview(null);
    setTempFilePath('');
    setActiveBatch(null);
    setErrorMsg(null);
  };

  // Calculations for progress
  const totalRows = activeBatch?.total_rows ?? (activeBatch as any)?.totalRows ?? preview?.totalRowsEstimated ?? (preview as any)?.total_rows_estimated ?? 0;
  const processedRows = (activeBatch?.accepted_rows ?? (activeBatch as any)?.acceptedRows ?? 0) + (activeBatch?.rejected_rows ?? (activeBatch as any)?.rejectedRows ?? 0);
  const progressPct = totalRows > 0 ? Math.min(100, Math.round((processedRows / totalRows) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden transition-all">
        {/* Modal Top Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {step === 'processing' ? 'Processando Relatório ISPCHAT' : 'Importar Relatório ISPCHAT'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Resolução automática de identidades com clientes e protocolos RBXSoft
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (step === 'processing') {
                if (window.confirm('O processamento continuará em segundo plano. Deseja fechar a janela?')) {
                  onClose();
                }
              } else {
                onClose();
              }
            }}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Timeline */}
        <div className="px-6 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                step === 'upload'
                  ? 'bg-blue-600 text-white'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {step !== 'upload' ? '✓' : '1'}
            </span>
            <span className={step === 'upload' ? 'text-slate-800' : 'text-slate-500'}>Arquivo & Hash</span>
          </div>

          <div className="h-0.5 w-8 bg-slate-200" />

          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                step === 'preview'
                  ? 'bg-blue-600 text-white'
                  : ['processing', 'success'].includes(step)
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              {['processing', 'success'].includes(step) ? '✓' : '2'}
            </span>
            <span className={step === 'preview' ? 'text-slate-800' : 'text-slate-500'}>
              Validação & Colunas
            </span>
          </div>

          <div className="h-0.5 w-8 bg-slate-200" />

          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                step === 'processing'
                  ? 'bg-blue-600 text-white animate-pulse'
                  : step === 'success'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              {step === 'success' ? '✓' : '3'}
            </span>
            <span className={step === 'processing' ? 'text-blue-600 font-bold' : 'text-slate-500'}>
              Ingestão & Cruzamento
            </span>
          </div>

          <div className="h-0.5 w-8 bg-slate-200" />

          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                step === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
              }`}
            >
              4
            </span>
            <span className={step === 'success' ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
              Conclusão
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Aviso no Processamento</p>
                <p className="text-rose-700">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* STEP 1: UPLOAD */}
          {step === 'upload' && !loadingPreview && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition flex flex-col items-center justify-center gap-4 ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
                  : 'border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/20'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              <div className="w-20 h-20 rounded-3xl bg-white shadow-lg border border-slate-100 flex items-center justify-center text-blue-600">
                <FileSpreadsheet className="w-10 h-10" />
              </div>
              <div className="space-y-1.5">
                <p className="text-base font-bold text-slate-800">
                  Arraste e solte o arquivo aqui ou <span className="text-blue-600 underline">procure no computador</span>
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Suporta arquivos .xlsx e .csv de qualquer período exportados do ISPCHAT com até 20 MB
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                <span className="px-3 py-1 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Criptografia AES-256 (LGPD)
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Detecção Automática de 20 Colunas
                </span>
              </div>
            </div>
          )}

          {loadingPreview && (
            <div className="py-20 text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100 animate-ping opacity-30" />
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800">Lendo Planilha e Extraindo Metadados...</p>
                <p className="text-xs text-slate-400">
                  Calculando hash SHA-256 e mapeando colunas canônicas
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & VERIFICATION */}
          {step === 'preview' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100">
                  <span className="text-[11px] font-medium text-blue-700 block">Colunas Reconhecidas</span>
                  <span className="text-xl font-black text-blue-950 flex items-center gap-1.5 mt-0.5">
                    <CheckCircle2 className="w-5 h-5 text-blue-600" />
                    {preview?.detectedColumnsCount ?? (preview as any)?.detected_columns_count ?? 0} colunas
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-medium text-slate-500 block">Volume Total Estimado</span>
                  <span className="text-xl font-black text-slate-800 mt-0.5 block">
                    {preview?.totalRowsEstimated ?? (preview as any)?.total_rows_estimated ?? 0} linhas
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                  <span className="text-[11px] font-medium text-emerald-700 block">Amostra Carregada</span>
                  <span className="text-xl font-black text-emerald-950 mt-0.5 block">
                    {(preview?.previewRows || (preview as any)?.preview_rows || []).length} linhas
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
                  <span className="text-[11px] font-medium text-amber-700 block">Arquivo</span>
                  <span className="text-xs font-bold text-amber-950 truncate mt-1 block" title={file?.name}>
                    {file?.name || 'Arquivo selecionado'}
                  </span>
                </div>
              </div>

              {/* Table Preview */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Prévia das primeiras linhas para conferência</span>
                  <span className="text-slate-500 font-normal">Colunas mapeadas automaticamente</span>
                </div>
                <div className="max-h-60 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Protocolo / ID</th>
                        <th className="px-3 py-2">Telefone</th>
                        <th className="px-3 py-2">Cliente</th>
                        <th className="px-3 py-2">Atendente</th>
                        <th className="px-3 py-2">Setor</th>
                        <th className="px-3 py-2">Data Início</th>
                        <th className="px-3 py-2">TMA</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {(preview?.previewRows || (preview as any)?.preview_rows || []).map((r: any, idx: number) => {
                        const c = r.canonicalData || r;
                        const proto = c.protocol_number || c.conversation_id || c.protocolNumber || c.conversationId || `Linha ${r.rowNumber || idx + 1}`;
                        const convId = c.conversation_id || c.conversationId;
                        return (
                          <tr key={idx} className="hover:bg-blue-50/30 transition">
                            <td className="px-3 py-2 text-slate-400 font-mono text-[11px]">{r.rowNumber || idx + 1}</td>
                            <td className="px-3 py-2">
                              <span className="font-semibold font-mono text-slate-800">#{proto}</span>
                              {convId && proto !== convId && (
                                <span className="block text-[10px] text-slate-400 font-mono">ID {convId}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-600">{c.phone_number || c.phoneMasked || r.phoneMasked || '—'}</td>
                            <td className="px-3 py-2 font-medium truncate max-w-[140px]" title={c.customer_name || c.nameMasked || r.nameMasked}>
                              {c.customer_name || c.nameMasked || r.nameMasked || '—'}
                            </td>
                            <td className="px-3 py-2 truncate max-w-[120px]">{c.closed_by || (c.is_automation ? 'Automação' : '—')}</td>
                            <td className="px-3 py-2 text-slate-500">{c.department || (c.is_automation ? 'Automação' : '—')}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                              {c.started_at ? String(c.started_at).slice(0, 16).replace('T', ' ') : '—'}
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px] text-slate-600">
                              {c.tma || '—'}
                            </td>
                            <td className="px-3 py-2">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                {c.status || 'FINALIZADO'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: HIGH-TECH LIVE INGESTION DASHBOARD (Inspired by CRM) */}
          {step === 'processing' && (
            <div className="space-y-6 py-4 animate-fadeIn">
              {/* Animated Live Status Card */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-900 to-slate-900 text-white shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">Processamento Assíncrono em Andamento</h3>
                      <p className="text-xs text-blue-200">
                        {totalRows > 0
                          ? `Analisando e vinculando ${processedRows} de ${totalRows} atendimentos...`
                          : 'Carregando linhas e preparando fila...'}
                      </p>
                    </div>
                  </div>

                  <span className="text-2xl font-black text-blue-300 font-mono">
                    {progressPct}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mt-6 space-y-2 relative z-10">
                  <div className="h-3 w-full rounded-full bg-slate-800/80 overflow-hidden border border-white/10 p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${Math.max(5, progressPct)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                    <span>{processedRows} linhas gravadas em SQLite</span>
                    <span>{totalRows - processedRows} restantes</span>
                  </div>
                </div>
              </div>

              {/* Real-time Counter Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
                  <span className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Vínculo Telefone
                  </span>
                  <span className="text-2xl font-black text-emerald-950 mt-1 block">
                    {activeBatch?.match_confirmed ?? (activeBatch as any)?.matchConfirmed ?? 0}
                  </span>
                  <span className="text-[10px] text-emerald-700">Confirmados direto no RBX</span>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80">
                  <span className="text-[11px] font-semibold text-blue-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    Sugestão por Nome
                  </span>
                  <span className="text-2xl font-black text-blue-950 mt-1 block">
                    {activeBatch?.match_name_suggested ?? (activeBatch as any)?.matchNameSuggested ?? 0}
                  </span>
                  <span className="text-[10px] text-blue-700">Similaridade Jaro-Winkler ≥ 90%</span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80">
                  <span className="text-[11px] font-semibold text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Casos Ambíguos
                  </span>
                  <span className="text-2xl font-black text-amber-950 mt-1 block">
                    {activeBatch?.match_ambiguous ?? (activeBatch as any)?.matchAmbiguous ?? 0}
                  </span>
                  <span className="text-[10px] text-amber-700">Múltiplos clientes encontrados</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    Sem Cadastro RBX
                  </span>
                  <span className="text-2xl font-black text-slate-800 mt-1 block">
                    {activeBatch?.match_unmatched ?? (activeBatch as any)?.matchUnmatched ?? 0}
                  </span>
                  <span className="text-[10px] text-slate-500">Telefone e nome novos</span>
                </div>
              </div>

              {/* Informative Guidance */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3 text-xs text-slate-600">
                <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-800">Processamento em Lote Otimizado</p>
                  <p className="text-slate-500">
                    O pipeline executa transações agrupadas sem bloquear o servidor. Você pode fechar este modal a qualquer momento que a carga continuará sendo executada no backend.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS SUMMARY */}
          {step === 'success' && activeBatch && (
            <div className="py-8 text-center space-y-5 animate-fadeIn">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto shadow-md">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900">Relatório Importado com Sucesso!</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Todas as {activeBatch.total_rows ?? (activeBatch as any)?.totalRows ?? 0} linhas foram processadas e indexadas para análise gerencial.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto text-left">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 block">Aceitas</span>
                  <span className="text-lg font-bold text-emerald-600">{activeBatch.accepted_rows ?? (activeBatch as any)?.acceptedRows ?? 0}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 block">Confirmadas</span>
                  <span className="text-lg font-bold text-blue-600">{activeBatch.match_confirmed ?? (activeBatch as any)?.matchConfirmed ?? 0}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 block">Revisão</span>
                  <span className="text-lg font-bold text-amber-600">
                    {(activeBatch.match_name_suggested ?? (activeBatch as any)?.matchNameSuggested ?? 0) + (activeBatch.match_ambiguous ?? (activeBatch as any)?.matchAmbiguous ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          {step === 'processing' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                Continuar em Segundo Plano
              </button>
              <div className="flex items-center gap-2 text-xs font-medium text-blue-700">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>Atualizando status em tempo real...</span>
              </div>
            </>
          ) : step === 'success' ? (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition cursor-pointer"
              >
                Ver no Dashboard
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={step === 'preview' ? handleReset : onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                {step === 'preview' ? 'Voltar' : 'Cancelar'}
              </button>

              {step === 'preview' && (
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 transition hover:scale-[1.02] cursor-pointer"
                >
                  <span>Iniciar Processamento do Lote</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
