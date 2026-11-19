import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  UploadCloud,
  ChevronRight,
  Filter,
  RefreshCw,
  AlertTriangle,
  X,
  Trash2,
  ShieldCheck,
  CheckSquare,
  Square,
  Info,
} from 'lucide-react';
import { omnichannelApi } from '../api/omnichannel.api.ts';
import { ImportBatch, BatchError } from '../types/omnichannel.types.ts';

interface ImportBatchesTabProps {
  onOpenImport: () => void;
  selectedBatchId?: string;
  selectedBatchIds?: string[];
  onSelectBatch?: (batchId?: string) => void;
  onSelectBatches?: (batchIds: string[]) => void;
  onBatchDeleted?: (batchId: string) => void;
  onApplyAndGoToDashboard?: () => void;
}

export const ImportBatchesTab: React.FC<ImportBatchesTabProps> = ({
  onOpenImport,
  selectedBatchId,
  selectedBatchIds,
  onSelectBatch,
  onSelectBatches,
  onBatchDeleted,
  onApplyAndGoToDashboard,
}) => {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [inspectingBatch, setInspectingBatch] = useState<ImportBatch | null>(null);
  const [batchErrors, setBatchErrors] = useState<BatchError[]>([]);
  const [loadingErrors, setLoadingErrors] = useState(false);

  // Exclusão de lote
  const [batchToDelete, setBatchToDelete] = useState<ImportBatch | null>(null);
  const [preserveMappings, setPreserveMappings] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);

  const loadBatches = async () => {
    setLoading(true);
    try {
      const res = await omnichannelApi.listBatches();
      setBatches(res?.batches || []);
    } catch (err) {
      console.error('[ImportBatchesTab] Erro ao listar lotes:', err);
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const handleInspect = async (batch: ImportBatch) => {
    setInspectingBatch(batch);
    setLoadingErrors(true);
    try {
      const res = await omnichannelApi.getBatchDetails(batch.id);
      setBatchErrors(res?.errors || []);
    } catch {
      setBatchErrors([]);
    } finally {
      setLoadingErrors(false);
    }
  };

  const handleOpenDeleteModal = (batch: ImportBatch) => {
    setBatchToDelete(batch);
    setPreserveMappings(true);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!batchToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await omnichannelApi.deleteBatch(batchToDelete.id, preserveMappings);
      if (selectedBatchId === batchToDelete.id) {
        if (onSelectBatch) onSelectBatch(undefined);
        if (onSelectBatches && selectedBatchIds) {
          onSelectBatches(selectedBatchIds.filter((id) => id !== batchToDelete.id));
        }
      }
      if (onBatchDeleted) {
        onBatchDeleted(batchToDelete.id);
      }
      setDeleteSuccessMessage(res.message);
      setTimeout(() => setDeleteSuccessMessage(null), 6000);
      setBatchToDelete(null);
      await loadBatches();
    } catch (err: any) {
      setDeleteError(err.message || 'Erro ao excluir o lote.');
    } finally {
      setDeleting(false);
    }
  };

  const formatBytes = (bytes?: number | null) => {
    if (typeof bytes !== 'number' || isNaN(bytes) || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const safeBatches = Array.isArray(batches) ? batches : [];
  const safeErrors = Array.isArray(batchErrors) ? batchErrors : [];

  // Multi-selection management
  const effectiveSelectedIds: string[] = selectedBatchIds !== undefined
    ? selectedBatchIds
    : selectedBatchId
    ? [selectedBatchId]
    : [];

  const handleToggleBatch = (id: string) => {
    const isCurrentlySelected = effectiveSelectedIds.includes(id);
    let nextIds: string[];
    if (isCurrentlySelected) {
      nextIds = effectiveSelectedIds.filter((item) => item !== id);
    } else {
      nextIds = [...effectiveSelectedIds, id];
    }

    if (onSelectBatches) {
      onSelectBatches(nextIds);
    }
    if (onSelectBatch) {
      onSelectBatch(nextIds.length === 1 ? nextIds[0] : nextIds.length === 0 ? undefined : nextIds.join(','));
    }
  };

  const handleSelectAll = () => {
    const allIds = safeBatches.map((b) => b.id);
    const areAllSelected = allIds.length > 0 && allIds.every((id) => effectiveSelectedIds.includes(id));
    const nextIds = areAllSelected ? [] : allIds;

    if (onSelectBatches) {
      onSelectBatches(nextIds);
    }
    if (onSelectBatch) {
      onSelectBatch(nextIds.length === 1 ? nextIds[0] : nextIds.length === 0 ? undefined : nextIds.join(','));
    }
  };

  const isAllSelected = safeBatches.length > 0 && safeBatches.every((b) => effectiveSelectedIds.includes(b.id));
  const isPartiallySelected = effectiveSelectedIds.length > 0 && !isAllSelected;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Banner */}
      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-800">Histórico de Cargas & Relatórios</h3>
          <p className="text-xs text-slate-500">
            Acompanhe o processamento de planilhas importadas, filtre múltiplos lotes simultaneamente e gerencie dados
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenImport}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md flex items-center gap-2 transition cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Importar Nova Planilha</span>
          </button>

          <button
            onClick={loadBatches}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            title="Atualizar lotes"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Multi-select Action Bar */}
      {effectiveSelectedIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 px-5 py-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-xs font-bold">
              {effectiveSelectedIds.length} {effectiveSelectedIds.length === 1 ? 'relatório marcado para filtro' : 'relatórios marcados para filtro simultâneo'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onApplyAndGoToDashboard && (
              <button
                onClick={onApplyAndGoToDashboard}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>Aplicar no Painel</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => {
                if (onSelectBatches) onSelectBatches([]);
                if (onSelectBatch) onSelectBatch(undefined);
              }}
              className="px-3 py-2 rounded-xl bg-white hover:bg-blue-100/50 text-blue-700 text-xs font-semibold border border-blue-200 transition cursor-pointer"
            >
              Desmarcar Todos
            </button>
          </div>
        </div>
      )}

      {deleteSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-5 py-3.5 rounded-2xl text-xs flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-medium">{deleteSuccessMessage}</span>
          </div>
          <button
            onClick={() => setDeleteSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 p-1 rounded-lg hover:bg-emerald-100/50 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Batches Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
            Carregando histórico de lotes...
          </div>
        ) : safeBatches.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Nenhum lote importado ainda</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Realize sua primeira importação do relatório ISPCHAT (.xlsx ou .csv) para calcular as métricas.
            </p>
            <button
              onClick={onOpenImport}
              className="mt-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-xs"
            >
              Importar Agora
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="w-12 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isPartiallySelected;
                      }}
                      onChange={handleSelectAll}
                      title="Selecionar / Desmarcar todos os relatórios"
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3">Arquivo / Lote</th>
                  <th className="px-4 py-3">Data da Carga</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Linhas Totais</th>
                  <th className="px-4 py-3 text-center">Aceitas / Rejeitadas</th>
                  <th className="px-4 py-3">Vínculos RBX</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {safeBatches.map((b) => {
                  const isSelected = effectiveSelectedIds.includes(b.id);

                  return (
                    <tr
                      key={b.id}
                      className={`hover:bg-slate-50/70 transition ${isSelected ? 'bg-blue-50/40' : ''}`}
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleBatch(b.id)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-800 flex items-center gap-1.5">
                            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                            <span>{b.file_name || b.fileName || 'Arquivo sem nome'}</span>
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            {formatBytes(b.file_size ?? b.fileSize)} · ID: {b.id ? b.id.slice(0, 8) : '—'}...
                          </p>
                          {(b.detected_period_start || b.detectedPeriodStart) && (
                            <p className="text-[10px] text-blue-600 font-medium">
                              📅 {String(b.detected_period_start || b.detectedPeriodStart).slice(0, 10)} até {String(b.detected_period_end || b.detectedPeriodEnd || '').slice(0, 10)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                        {b.created_at ? b.created_at.slice(0, 16).replace('T', ' ') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {b.status === 'completed' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Concluído
                          </span>
                        )}
                        {b.status === 'processing' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1 w-fit">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Processando
                          </span>
                        )}
                        {b.status === 'queued' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Na Fila
                          </span>
                        )}
                        {b.status === 'failed' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Falhou
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-800">{b.total_rows ?? b.totalRows ?? 0}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold text-emerald-600">{b.accepted_rows ?? b.acceptedRows ?? 0}</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className={`font-semibold ${(b.rejected_rows ?? b.rejectedRows ?? 0) > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          {b.rejected_rows ?? b.rejectedRows ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className="text-emerald-700 font-bold">{b.match_confirmed ?? b.matchConfirmed ?? 0} conf.</span>
                          <span className="text-slate-300">·</span>
                          <span className="text-blue-700 font-medium">{b.match_name_suggested ?? b.matchNameSuggested ?? 0} sug.</span>
                          <span className="text-slate-300">·</span>
                          <span className="text-amber-700 font-medium">{b.match_ambiguous ?? b.matchAmbiguous ?? 0} amb.</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleBatch(b.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600'
                            }`}
                          >
                            {isSelected ? 'Filtro Ativo' : 'Adicionar ao Filtro'}
                          </button>

                          <button
                            onClick={() => handleInspect(b)}
                            className="p-1.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                            title="Ver detalhes do lote"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleOpenDeleteModal(b)}
                            className="p-1.5 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50/80 transition cursor-pointer"
                            title={b.status === 'processing' ? 'Excluir / cancelar lote travado' : 'Excluir carga e dados vinculados'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Batch Details Inspection Modal */}
      {inspectingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">Detalhes da Carga</h3>
                <p className="text-xs text-slate-500">{inspectingBatch.file_name || inspectingBatch.fileName}</p>
              </div>
              <button
                onClick={() => setInspectingBatch(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 space-y-1">
                  <span className="text-[11px] text-slate-400">Hash SHA-256</span>
                  <p className="font-mono text-[10px] text-slate-700 break-all">{inspectingBatch.file_hash || inspectingBatch.fileHash}</p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 space-y-1">
                  <span className="text-[11px] text-slate-400">Período Detectado</span>
                  <p className="font-medium text-slate-700">
                    {(inspectingBatch.detected_period_start || inspectingBatch.detectedPeriodStart)
                      ? `${String(inspectingBatch.detected_period_start || inspectingBatch.detectedPeriodStart).slice(0, 10)} até ${String(inspectingBatch.detected_period_end || inspectingBatch.detectedPeriodEnd || '').slice(0, 10)}`
                      : 'Não identificado'}
                  </p>
                </div>
              </div>

              {(inspectingBatch.error_message || inspectingBatch.errorMessage) && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
                  <p className="font-bold">Mensagem de Erro:</p>
                  <p className="mt-0.5">{inspectingBatch.error_message || inspectingBatch.errorMessage}</p>
                </div>
              )}

              {/* Error Rows Table */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Linhas Rejeitadas na Validação ({safeErrors.length})</span>
                </h4>
                {loadingErrors ? (
                  <p className="text-slate-400 py-4 text-center">Carregando erros...</p>
                ) : safeErrors.length === 0 ? (
                  <p className="text-slate-400 italic py-2">Nenhum erro de validação registrado neste lote.</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2">Linha</th>
                          <th className="px-3 py-2">Campo</th>
                          <th className="px-3 py-2">Código</th>
                          <th className="px-3 py-2">Motivo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {safeErrors.map((err, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 font-mono font-bold text-slate-800">{err.row_number}</td>
                            <td className="px-3 py-2 text-slate-600">{err.field_name || '—'}</td>
                            <td className="px-3 py-2 font-mono text-[10px] text-amber-700">{err.error_code}</td>
                            <td className="px-3 py-2 text-rose-600">{err.error_message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <button
                onClick={() => {
                  const b = inspectingBatch;
                  setInspectingBatch(null);
                  handleOpenDeleteModal(b);
                }}
                disabled={inspectingBatch.status === 'processing'}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 border border-rose-200/80 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir Carga...</span>
              </button>

              <button
                onClick={() => setInspectingBatch(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Batch Confirmation Modal */}
      {batchToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden animate-scaleIn">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-xs">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Excluir Carga de Atendimentos</h3>
                  <p className="text-xs text-slate-500">Ação permanente para os registros deste arquivo</p>
                </div>
              </div>
              <button
                onClick={() => !deleting && setBatchToDelete(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/80 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {deleteError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{deleteError}</span>
                </div>
              )}

              {batchToDelete.status === 'processing' && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                  <span className="text-[11px] leading-relaxed">
                    <strong>Lote travado em processamento:</strong> A exclusão cancelará o processo e removerá do banco de dados todos os registros parciais deste lote, liberando o arquivo para importações futuras.
                  </span>
                </div>
              )}

              {/* Batch Info Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Arquivo:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[260px]">{batchToDelete.file_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Data da carga:</span>
                  <span className="text-slate-700">{batchToDelete.created_at?.slice(0, 16).replace('T', ' ')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Atendimentos a remover:</span>
                  <span className="font-bold text-rose-600">{batchToDelete.accepted_rows} registros</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Clientes confirmados no RBX:</span>
                  <span className="font-bold text-emerald-600">{batchToDelete.match_confirmed} confirmados</span>
                </div>
              </div>

              {/* Preservation Switch / Option */}
              <div
                onClick={() => setPreserveMappings(!preserveMappings)}
                className={`p-4 rounded-2xl border transition cursor-pointer flex items-start gap-3.5 ${
                  preserveMappings
                    ? 'bg-blue-50/50 border-blue-200 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <div className="mt-0.5 text-blue-600 flex-shrink-0">
                  {preserveMappings ? (
                    <CheckSquare className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span>Preservar inteligência de mapeamento de clientes</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                      Recomendado
                    </span>
                  </p>
                  <p className="text-slate-500 leading-relaxed text-[11px]">
                    Os atendimentos deste arquivo serão totalmente removidos. Porém, os vínculos confirmados (telefone/nome ↔ cliente RBX) ficarão gravados na base de inteligência. Em futuras cargas de novas planilhas, esses clientes serão reconhecidos automaticamente sem retrabalho manual.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/70 text-amber-800 text-[11px] flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  O hash do arquivo será liberado do banco, permitindo reimportar este relatório a qualquer momento se desejar. Caso este lote esteja selecionado como filtro no painel, ele será desmarcado automaticamente.
                </span>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
              <button
                disabled={deleting}
                onClick={() => setBatchToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>

              <button
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-md flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Excluindo lote...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir Definitivamente</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
