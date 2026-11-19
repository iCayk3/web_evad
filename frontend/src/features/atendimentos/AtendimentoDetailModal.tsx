import React, { useEffect, useState } from 'react';
import {
  X,
  Clock,
  AlertTriangle,
  CheckCircle,
  User,
  Calendar,
  CheckSquare,
  MessageSquare,
  Tag,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import { Badge } from '../../components/common/Badge.tsx';
import { PillButton } from '../../components/common/PillButton.tsx';

interface AtendimentoDetailModalProps {
  ticketId: number | null;
  onClose: () => void;
}

export const AtendimentoDetailModal: React.FC<AtendimentoDetailModalProps> = ({
  ticketId,
  onClose,
}) => {
  const [ticket, setTicket] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchDetail = () => {
    if (!ticketId) return;
    setLoading(true);
    setErrorMessage(null);
    apiFetch<any>(`/api/atendimentos/${ticketId}`)
      .then((data) => setTicket(data))
      .catch((e) => {
        console.error('Erro ao buscar detalhes do atendimento:', e);
        setErrorMessage(e.message || 'Falha ao carregar detalhes do atendimento');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (ticketId) {
      fetchDetail();
    } else {
      setTicket(null);
      setErrorMessage(null);
    }
  }, [ticketId]);

  if (!ticketId) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-signature border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes do Atendimento"
      >
        {/* Topo do Modal */}
        <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-brand-primary bg-brand-primary-light px-3 py-1 rounded-full border border-blue-200/80">
              {ticket?.protocol || `ATD-${ticketId}`}
            </span>
            {ticket?.type && (
              <span
                className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${
                  ticket.type === 'Comercial'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : ticket.type === 'Adm/Fin'
                    ? 'bg-purple-50 text-purple-800 border-purple-200'
                    : 'bg-blue-50 text-blue-800 border-blue-200'
                }`}
              >
                {ticket.type}
              </span>
            )}
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                {ticket?.clientName || 'Carregando...'}
              </h2>
              <div className="text-xs text-slate-500 mt-0.5">
                Técnico: <strong className="text-slate-700">{ticket?.technicianName || 'Não atribuído'}</strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-500 text-xs">
            <div className="inline-block animate-spin w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full mr-2" />
            Carregando detalhes do atendimento no RBXSoft...
          </div>
        ) : errorMessage ? (
          <div className="py-12 px-6 text-center space-y-3">
            <div className="text-rose-600 font-semibold text-xs">
              {errorMessage}
            </div>
            <PillButton
              variant="primary"
              size="sm"
              onClick={fetchDetail}
            >
              Tentar Novamente
            </PillButton>
          </div>
        ) : !ticket ? (
          <div className="py-20 text-center text-rose-500 text-xs">
            Atendimento não encontrado no ERP.
          </div>
        ) : (
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs bg-[#F4F6F9]">
            {/* Faixa de Status & SLA */}
            <div className="p-5 rounded-2xl border border-slate-100 bg-white shadow-2xs flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Situação Atual
                </div>
                <div className="mt-1">
                  <Badge variant="primary">{ticket.status}</Badge>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Data de Abertura
                </div>
                <div className="text-xs font-semibold text-slate-700 font-mono mt-1">
                  {ticket.createdAt}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Previsão Contratual SLA
                </div>
                <div className="text-xs font-semibold text-slate-700 font-mono mt-1">
                  {ticket.slaDueAt}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Condição de SLA
                </div>
                <div className="mt-1">
                  {ticket.isOverdue ? (
                    <Badge variant="overdue" pulse>
                      SLA Vencido
                    </Badge>
                  ) : ticket.isAtRisk ? (
                    <Badge variant="risk" pulse>
                      Em Risco (&lt; 60m)
                    </Badge>
                  ) : (
                    <Badge variant="ok">
                      No Prazo
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Metadados Operacionais */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 bg-white rounded-xl border border-slate-100 shadow-2xs">
                <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Tópico</span>
                <span className="font-semibold text-slate-800 block mt-0.5">{ticket.topicName}</span>
              </div>
              <div className="p-3.5 bg-white rounded-xl border border-slate-100 shadow-2xs">
                <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Causa</span>
                <span className="font-semibold text-slate-800 block mt-0.5">{ticket.causeName}</span>
              </div>
              <div className="p-3.5 bg-white rounded-xl border border-slate-100 shadow-2xs">
                <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Fluxo</span>
                <span className="font-semibold text-slate-800 block mt-0.5">{ticket.flowName}</span>
              </div>
              <div className="p-3.5 bg-white rounded-xl border border-slate-100 shadow-2xs">
                <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Grupo SLA</span>
                <span className="font-semibold text-slate-800 block mt-0.5">{ticket.slaGroupName}</span>
              </div>
            </div>

            {/* Descrição */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                Descrição da Demanda
              </h3>
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                {ticket.description || 'Nenhum detalhe adicional fornecido.'}
              </div>
            </div>

            {/* Checklist Operacional */}
            {ticket.checklist && ticket.checklist.length > 0 && (
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-brand-primary" />
                  <span>Checklist Técnico de Campo</span>
                </h3>
                <div className="space-y-1.5">
                  {ticket.checklist.map((chk: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 text-xs border border-slate-100/60"
                    >
                      <input
                        type="checkbox"
                        disabled
                        checked={chk.concluido}
                        className="rounded text-brand-primary border-slate-300 w-4 h-4"
                      />
                      <span className={chk.concluido ? 'line-through text-slate-400' : 'text-slate-800 font-medium'}>
                        {chk.item || chk.descricao}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ocorrências */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-brand-primary" />
                <span>Histórico de Ocorrências</span>
              </h3>
              {ticket.ocorrencias && ticket.ocorrencias.length > 0 ? (
                <div className="space-y-2">
                  {ticket.ocorrencias.map((oc: any) => (
                    <div key={oc.id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1">
                      <div className="flex justify-between text-slate-500 text-[10px]">
                        <span className="font-bold text-slate-700">{oc.autor}</span>
                        <span className="font-mono">{oc.data}</span>
                      </div>
                      <p className="text-slate-800 leading-relaxed">{oc.texto}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-400 text-center">
                  Nenhuma ocorrência registrada para este atendimento.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="p-5 bg-white border-t border-slate-100 flex justify-end">
          <PillButton
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            Fechar
          </PillButton>
        </div>
      </div>
    </div>
  );
};
