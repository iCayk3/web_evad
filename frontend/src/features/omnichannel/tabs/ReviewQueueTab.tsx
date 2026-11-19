import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Check,
  X,
  Sparkles,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  ShieldAlert,
  Link2,
  Users,
  CheckSquare,
  Square,
} from 'lucide-react';
import { omnichannelApi } from '../api/omnichannel.api.ts';
import { ReviewItem } from '../types/omnichannel.types.ts';

interface ReviewQueueTabProps {
  selectedBatchId?: string;
  onRefreshStats: () => void;
}

export const ReviewQueueTab: React.FC<ReviewQueueTabProps> = ({ selectedBatchId, onRefreshStats }) => {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [totalSuggested, setTotalSuggested] = useState(0);
  const [totalAmbiguous, setTotalAmbiguous] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'name_suggested' | 'ambiguous'>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [batchApproving, setBatchApproving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Multi-select & Batch Decision State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeTargetClientId, setMergeTargetClientId] = useState('');
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const res = await omnichannelApi.getReviewQueue({
        batchId: selectedBatchId || undefined,
        limit: 100,
      });
      setItems(res?.items || []);
      setTotalSuggested(res.totalSuggested);
      setTotalAmbiguous(res.totalAmbiguous);
    } catch (err: any) {
      console.error('[ReviewQueueTab] Erro ao carregar fila de revisão:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [selectedBatchId]);

  const handleDecision = async (factId: string, newStatus: 'confirmed' | 'unmatched', clientId?: string) => {
    setProcessingId(factId);
    setFeedbackMsg(null);
    try {
      await omnichannelApi.applyReviewDecision({
        factId,
        newStatus,
        selectedRbxClientId: clientId,
        reason: newStatus === 'confirmed' ? 'Aprovado manualmente pelo supervisor' : 'Rejeitado pelo supervisor',
      });
      setItems((prev) => prev.filter((i) => i.id !== factId));
      if (newStatus === 'confirmed') {
        setFeedbackMsg({ type: 'success', text: 'Vínculo confirmado com sucesso.' });
      } else {
        setFeedbackMsg({ type: 'success', text: 'Atendimento marcado como não identificado.' });
      }
      onRefreshStats();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Falha ao gravar decisão.' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleBatchApproveAll = async () => {
    if (!selectedBatchId && safeItems.length === 0) return;
    const batchIdToUse = selectedBatchId || (items[0]?.batch_id ?? '');
    if (!batchIdToUse) return;

    if (!window.confirm(`Deseja aprovar em lote todos os vínculos com sugestão por nome (≥ 90% similaridade)?`)) {
      return;
    }

    setBatchApproving(true);
    setFeedbackMsg(null);
    try {
      const res = await omnichannelApi.batchApproveSuggested(
        batchIdToUse,
        'Aprovação em lote autorizada pelo supervisor'
      );
      setFeedbackMsg({
        type: 'success',
        text: `${res.approvedCount} vínculos sugeridos por nome foram confirmados com sucesso.`,
      });
      await loadQueue();
      onRefreshStats();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Falha na aprovação em lote.' });
    } finally {
      setBatchApproving(false);
    }
  };

  const safeItems = Array.isArray(items) ? items : [];
  const filteredItems = safeItems.filter((i) => {
    if (filterType === 'name_suggested') return i.match_status === 'name_suggested';
    if (filterType === 'ambiguous') return i.match_status === 'ambiguous';
    return true;
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApproveSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Deseja aprovar e confirmar os ${selectedIds.size} vínculos selecionados?`)) return;

    setBatchActionLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await omnichannelApi.batchDecision({
        factIds: Array.from(selectedIds),
        action: 'confirm',
        reason: 'Aprovação em lote autorizada pelo supervisor',
      });
      setFeedbackMsg({
        type: 'success',
        text: `${res.affectedCount} vínculos foram confirmados com sucesso!`,
      });
      setSelectedIds(new Set());
      await loadQueue();
      onRefreshStats();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Falha ao aprovar selecionados.' });
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleUnmatchSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Deseja marcar os ${selectedIds.size} atendimentos selecionados como Não Identificado?`)) return;

    setBatchActionLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await omnichannelApi.batchDecision({
        factIds: Array.from(selectedIds),
        action: 'unmatch',
        reason: 'Descarte/Não identificado em lote por seleção manual',
      });
      setFeedbackMsg({
        type: 'success',
        text: `${res.affectedCount} atendimentos foram marcados como não identificados.`,
      });
      setSelectedIds(new Set());
      await loadQueue();
      onRefreshStats();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Falha ao descartar selecionados.' });
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleMergeAmbiguous = async () => {
    if (!mergeTargetClientId.trim()) {
      alert('Por favor, informe o Código/ID do Cliente RBX para a unificação.');
      return;
    }

    setBatchActionLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await omnichannelApi.batchDecision({
        factIds: Array.from(selectedIds),
        action: 'confirm',
        targetClientId: mergeTargetClientId.trim(),
        reason: `Unificação em lote vinculada ao Cliente RBX #${mergeTargetClientId.trim()}`,
      });
      setFeedbackMsg({
        type: 'success',
        text: `${res.affectedCount} atendimentos foram unificados e confirmados para o Cliente #${mergeTargetClientId.trim()}!`,
      });
      setIsMergeModalOpen(false);
      setMergeTargetClientId('');
      setSelectedIds(new Set());
      await loadQueue();
      onRefreshStats();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Falha ao unificar ambíguos.' });
    } finally {
      setBatchActionLoading(false);
    }
  };

  // Coleta sugestões de clientes RBX dos itens atualmente selecionados
  const suggestedClientsInSelection = Array.from(
    new Set(
      items
        .filter((i) => selectedIds.has(i.id) && i.rbx_client_id)
        .map((i) => i.rbx_client_id!)
    )
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header Banner with Actions */}
      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold text-slate-800">Fila de Revisão de Vínculos</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              {totalSuggested + totalAmbiguous} pendentes
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Revise atendimentos com similaridade de nome alta ou selecione múltiplos para aprovação rápida e unificação
          </p>
        </div>

        <div className="flex items-center gap-3">
          {totalSuggested > 0 && (
            <button
              onClick={handleBatchApproveAll}
              disabled={batchApproving}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              {batchApproving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Aprovando em lote...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Aprovar Todos Sugeridos ({totalSuggested})</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={loadQueue}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            title="Atualizar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating or Highlighted Batch Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-blue-900 to-indigo-900 text-white shadow-xl flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center font-bold text-xs">
              {selectedIds.size}
            </div>
            <div>
              <span className="font-bold text-sm block">
                {selectedIds.size} de {filteredItems.length} atendimentos selecionados
              </span>
              <span className="text-[11px] text-blue-200">
                Escolha a ação desejada para aplicar em todos simultaneamente
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Aprovar Selecionados */}
            <button
              disabled={batchActionLoading}
              onClick={handleApproveSelected}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
              title="Aprovar e confirmar todos os selecionados"
            >
              <Check className="w-4 h-4" />
              <span>Aprovar Selecionados ({selectedIds.size})</span>
            </button>

            {/* Unir Ambíguos */}
            <button
              disabled={batchActionLoading}
              onClick={() => {
                if (suggestedClientsInSelection.length === 1) {
                  setMergeTargetClientId(suggestedClientsInSelection[0]);
                }
                setIsMergeModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
              title="Vincular todos os selecionados a um mesmo Cliente RBX"
            >
              <Link2 className="w-4 h-4" />
              <span>Unir Ambíguos em 1 Cliente</span>
            </button>

            {/* Marcar como Não Encontrado */}
            <button
              disabled={batchActionLoading}
              onClick={handleUnmatchSelected}
              className="px-3 py-2 rounded-xl bg-white/15 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              title="Marcar todos como não identificados"
            >
              <X className="w-3.5 h-3.5" />
              <span>Não Encontrado</span>
            </button>

            {/* Desmarcar */}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-2.5 py-2 rounded-xl text-blue-200 hover:text-white hover:bg-white/10 text-xs font-semibold transition cursor-pointer"
            >
              Desmarcar
            </button>
          </div>
        </div>
      )}

      {feedbackMsg && (
        <div
          className={`p-4 rounded-2xl text-xs font-medium border flex items-center gap-2 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => {
            setFilterType('all');
            setSelectedIds(new Set());
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            filterType === 'all' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Todos ({safeItems.length})
        </button>
        <button
          onClick={() => {
            setFilterType('name_suggested');
            setSelectedIds(new Set());
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
            filterType === 'name_suggested'
              ? 'bg-blue-600 text-white'
              : 'text-blue-700 bg-blue-50 hover:bg-blue-100/60'
          }`}
        >
          <span>Sugeridos por Nome</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/30 font-bold">
            {totalSuggested}
          </span>
        </button>
        <button
          onClick={() => {
            setFilterType('ambiguous');
            setSelectedIds(new Set());
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
            filterType === 'ambiguous'
              ? 'bg-amber-600 text-white'
              : 'text-amber-700 bg-amber-50 hover:bg-amber-100/60'
          }`}
        >
          <span>Ambíguos / Múltiplos</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/30 font-bold">
            {totalAmbiguous}
          </span>
        </button>
      </div>

      {/* Table of Review Items */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center space-y-2 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
            <p className="text-xs">Carregando fila de revisão...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center space-y-2 text-slate-400">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto stroke-1" />
            <p className="text-sm font-bold text-slate-700">Nenhum atendimento pendente de revisão</p>
            <p className="text-xs text-slate-400">
              Todos os vínculos do lote selecionado estão confirmados ou resolvidos.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 select-none">
                <tr>
                  <th className="px-4 py-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      title="Selecionar todos os itens desta visualização"
                    />
                  </th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Cliente (ISPCHAT)</th>
                  <th className="px-4 py-3">Cliente Sugerido (RBX)</th>
                  <th className="px-4 py-3 text-center">Similaridade</th>
                  <th className="px-4 py-3">Tipo de Vínculo</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3 text-right">Ações de Decisão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredItems.map((item) => {
                  const isSuggested = item.match_status === 'name_suggested';
                  const isProcessing = processingId === item.id;
                  const isSelected = selectedIds.has(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`transition ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50/60'}`}
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectItem(item.id)}
                          className="w-4 h-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">{item.phone_masked}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">
                        {item.name_masked || item.name_normalized || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {item.rbx_client_id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-800">Cliente #{item.rbx_client_id}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Múltiplos cadastros</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.match_confidence ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                            {Math.round(item.match_confidence * 100)}%
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isSuggested ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-1 w-fit">
                            <Sparkles className="w-3 h-3 text-emerald-600" />
                            Nome Sugerido
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-1 w-fit">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Ambíguo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                        {item.started_at ? item.started_at.slice(0, 16).replace('T', ' ') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            disabled={isProcessing || batchActionLoading}
                            onClick={() =>
                              handleDecision(item.id, 'confirmed', item.rbx_client_id || undefined)
                            }
                            className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 font-semibold text-xs flex items-center gap-1 transition cursor-pointer disabled:opacity-40"
                            title="Confirmar vínculo com o cliente sugerido"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Confirmar</span>
                          </button>

                          <button
                            disabled={isProcessing || batchActionLoading}
                            onClick={() => handleDecision(item.id, 'unmatched')}
                            className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 font-semibold text-xs flex items-center gap-1 transition cursor-pointer disabled:opacity-40"
                            title="Descartar vínculo (deixar como não identificado)"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Descartar</span>
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

      {/* Modal: Unir Ambíguos em 1 Cliente RBX */}
      {isMergeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Link2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Unir Ambíguos em 1 Cliente</h3>
                  <p className="text-xs text-slate-500">
                    Vincular os {selectedIds.size} atendimentos selecionados
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMergeModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Informe o código do cliente no RBXSoft ISP para o qual todos os <strong>{selectedIds.size}</strong> atendimentos serão vinculados como <strong>Confirmados</strong>:
              </p>

              {/* Sugestões rápidas encontradas entre os itens selecionados */}
              {suggestedClientsInSelection.length > 0 && (
                <div className="space-y-1.5 p-3 rounded-2xl bg-blue-50/70 border border-blue-100">
                  <span className="text-[11px] font-bold text-blue-900 block">
                    💡 Clientes Sugeridos nos Atendimentos Selecionados:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedClientsInSelection.map((cid) => (
                      <button
                        key={cid}
                        type="button"
                        onClick={() => setMergeTargetClientId(cid)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
                          mergeTargetClientId === cid
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-100/50'
                        }`}
                      >
                        Cliente #{cid}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Código / ID do Cliente RBX:
                </label>
                <input
                  type="text"
                  placeholder="Ex: 10423"
                  value={mergeTargetClientId}
                  onChange={(e) => setMergeTargetClientId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <span className="text-[11px] text-slate-400">
                  Ao confirmar, os {selectedIds.size} registros serão atualizados para status Confirmado com este cliente.
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!mergeTargetClientId.trim() || batchActionLoading}
                onClick={handleMergeAmbiguous}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {batchActionLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Unificando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Unir e Confirmar</span>
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
