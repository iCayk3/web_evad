import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  Mail,
  MapPin,
  Calendar,
  User,
  Clock,
  Award,
  Plus,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { apiFetch } from '../../../lib/api.ts';
import { LeadDto, LeadStage, CommercialActivityDto } from '../types.ts';
import { formatDateBR } from '../utils.ts';

interface LeadDetailDrawerProps {
  leadId: number | null;
  onClose: () => void;
  onOpenCreateContract: (lead: LeadDto) => void;
  onLeadUpdated: () => void;
}

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({
  leadId,
  onClose,
  onOpenCreateContract,
  onLeadUpdated,
}) => {
  const [data, setData] = useState<{
    lead: LeadDto;
    contacts: any[];
    activities: CommercialActivityDto[];
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);
  const [newOccurrenceText, setNewOccurrenceText] = useState<string>('');
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);

  const loadData = () => {
    if (!leadId) return;
    setLoading(true);
    apiFetch<{ lead: LeadDto; contacts: any[]; activities: CommercialActivityDto[] }>(
      `sales/leads/${leadId}`
    )
      .then((res) => {
        setData(res);
        if (res.activities?.length > 0) {
          setActiveTicketId(res.activities[0].id);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [leadId]);

  if (!leadId) return null;

  const handleStageChange = async (newStage: LeadStage) => {
    if (!data) return;
    let lossReason: string | undefined = undefined;
    if (newStage === 'lost') {
      const reason = prompt('Informe o motivo da perda do lead (ex: Preço, Concorrência, Sem viabilidade):');
      if (!reason) return;
      lossReason = reason;
    }

    try {
      setUpdating(true);
      await apiFetch(`sales/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: newStage, lossReason }),
      });
      loadData();
      onLeadUpdated();
    } catch (err: any) {
      alert(`Falha ao alterar etapa: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleAddOccurrence = async (ticketId: number) => {
    if (!newOccurrenceText.trim()) return;
    try {
      setUpdating(true);
      await apiFetch(`sales/activities/${ticketId}/occurrences`, {
        method: 'POST',
        body: JSON.stringify({ text: newOccurrenceText.trim() }),
      });
      setNewOccurrenceText('');
      loadData();
    } catch (err: any) {
      alert(`Erro ao registrar ocorrência: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const stageLabels: Record<LeadStage, { label: string; color: string }> = {
    new: { label: 'Novo Lead', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    qualified: { label: 'Qualificado', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    proposal: { label: 'Proposta Enviada', color: 'bg-amber-100 text-amber-800 border-amber-200' },
    negotiation: { label: 'Em Negociação', color: 'bg-orange-100 text-orange-800 border-orange-200' },
    won: { label: 'Venda Fechada (Ganho)', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    lost: { label: 'Perdido', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  };

  const lead = data?.lead;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white shadow-2xl h-full flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
        {/* Cabeçalho */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/70">
          <div className="space-y-1.5 flex-1 pr-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-slate-400 font-bold">#{lead?.code || leadId}</span>
              {lead && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    stageLabels[lead.stage]?.color
                  }`}
                >
                  {stageLabels[lead.stage]?.label}
                </span>
              )}
              {lead?.isNextActionOverdue && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">
                  <AlertCircle className="w-3 h-3 text-red-500" /> Próxima Ação Vencida
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900">{lead?.name || 'Carregando lead...'}</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {lead?.city}/{lead?.state}
              </span>
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Responsável: <strong className="text-slate-700">{lead?.owner}</strong>
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                Origem: {lead?.source}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200/80 flex items-center justify-center text-slate-400 hover:text-slate-600 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Ação Primária Comercial */}
        {lead && (
          <div className="p-4 bg-gradient-to-r from-blue-900/10 via-slate-50 to-amber-500/10 border-b border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Mudar Etapa:</span>
              <select
                value={lead.stage}
                disabled={updating}
                onChange={(e) => handleStageChange(e.target.value as LeadStage)}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              >
                <option value="new">1. Novo Lead</option>
                <option value="qualified">2. Qualificado</option>
                <option value="proposal">3. Proposta Enviada</option>
                <option value="negotiation">4. Em Negociação</option>
                <option value="won" disabled>5. Ganho (Requer Contrato)</option>
                <option value="lost">6. Perdido</option>
              </select>
            </div>

            {lead.stage === 'won' ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Venda Fechada
              </div>
            ) : (
              <button
                onClick={() => onOpenCreateContract(lead)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-primary hover:bg-[#002f9f] shadow-md flex items-center gap-1.5 transition"
              >
                <Award className="w-4 h-4 text-amber-300" />
                Fechar Venda & Emitir Contrato
              </button>
            )}
          </div>
        )}

        {/* Conteúdo com Scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
              <p className="text-sm font-medium">Buscando perfil e ocorrências no RBXSoft...</p>
            </div>
          ) : lead ? (
            <>
              {/* Contatos do Prospect */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Contatos Vinculados ({data?.contacts?.length || 0})
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{lead.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 font-medium">Principal</span>
                    </div>
                    {lead.phone && (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Phone className="w-3.5 h-3.5 text-slate-400" /> {lead.phone}
                      </div>
                    )}
                    {lead.email && (
                      <div className="flex items-center gap-1.5 text-slate-600 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400" /> {lead.email}
                      </div>
                    )}
                  </div>

                  {data?.contacts?.map((c) => (
                    <div key={c.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{c.nome}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200 text-slate-700 font-medium">{c.tipo || c.cargo}</span>
                      </div>
                      {c.telefone && (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Phone className="w-3.5 h-3.5 text-slate-400" /> {c.telefone}
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center gap-1.5 text-slate-600 truncate">
                          <Mail className="w-3.5 h-3.5 text-slate-400" /> {c.email}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Atividades Comerciais e Ocorrências */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Timeline de Atividades Comerciais ({data?.activities?.length || 0})
                  </h4>
                </div>

                {data?.activities?.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-slate-300 rounded-xl text-slate-400 text-xs">
                    Nenhum atendimento comercial registrado para este lead.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data?.activities?.map((act) => (
                      <div key={act.id} className="border border-slate-200 rounded-2xl p-4 bg-white shadow-sm space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <span className="font-semibold text-slate-900">{act.topicName}</span>
                            <span className="font-mono text-slate-400 ml-2">({act.protocol})</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            act.status === 'Concluído' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {act.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{act.description}</p>

                        {/* Ocorrências registradas */}
                        {act.occurrences?.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-slate-100">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">Ocorrências Oficiais:</span>
                            {act.occurrences.map((occ) => (
                              <div key={occ.id} className="p-2.5 rounded-xl bg-slate-50 text-xs space-y-1">
                                <div className="flex items-center justify-between text-[11px] text-slate-400">
                                  <span className="font-semibold text-slate-700">{occ.author}</span>
                                  <span className="font-mono">{formatDateBR(occ.createdAt)}</span>
                                </div>
                                <p className="text-slate-800">{occ.text}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Campo para adicionar nova ocorrência */}
                        {act.status !== 'Concluído' && (
                          <div className="pt-2 flex gap-2">
                            <input
                              type="text"
                              value={activeTicketId === act.id ? newOccurrenceText : ''}
                              onChange={(e) => {
                                setActiveTicketId(act.id);
                                setNewOccurrenceText(e.target.value);
                              }}
                              placeholder="Adicionar nova ocorrência oficial..."
                              className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                            />
                            <button
                              onClick={() => handleAddOccurrence(act.id)}
                              disabled={updating || !newOccurrenceText.trim() || activeTicketId !== act.id}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1 transition"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Registrar
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
