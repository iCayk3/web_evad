import React from 'react';
import {
  Clock,
  User,
  MapPin,
  AlertCircle,
  Award,
  ChevronRight,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { LeadDto, LeadStage } from '../types.ts';

interface LeadsKanbanViewProps {
  leads: LeadDto[];
  onSelectLead: (leadId: number) => void;
  onOpenCreateContract: (lead: LeadDto) => void;
  onAdvanceStage: (leadId: number, nextStage: LeadStage) => void;
}

const STAGES_CONFIG: Array<{
  id: LeadStage;
  label: string;
  color: string;
  borderColor: string;
  badgeBg: string;
}> = [
  { id: 'new', label: '1. Novos Leads', color: 'text-blue-700', borderColor: 'border-blue-300', badgeBg: 'bg-blue-50' },
  { id: 'qualified', label: '2. Qualificados', color: 'text-indigo-700', borderColor: 'border-indigo-300', badgeBg: 'bg-indigo-50' },
  { id: 'proposal', label: '3. Proposta Enviada', color: 'text-amber-700', borderColor: 'border-amber-300', badgeBg: 'bg-amber-50' },
  { id: 'negotiation', label: '4. Em Negociação', color: 'text-orange-700', borderColor: 'border-orange-300', badgeBg: 'bg-orange-50' },
  { id: 'won', label: '5. Venda Fechada (Ganho)', color: 'text-emerald-700', borderColor: 'border-emerald-300', badgeBg: 'bg-emerald-50' },
  { id: 'lost', label: '6. Perdidos', color: 'text-slate-600', borderColor: 'border-slate-300', badgeBg: 'bg-slate-100' },
];

const NEXT_STAGE_MAP: Partial<Record<LeadStage, LeadStage>> = {
  new: 'qualified',
  qualified: 'proposal',
  proposal: 'negotiation',
};

export const LeadsKanbanView: React.FC<LeadsKanbanViewProps> = ({
  leads,
  onSelectLead,
  onOpenCreateContract,
  onAdvanceStage,
}) => {
  return (
    <div className="flex gap-4 overflow-x-auto pb-6 pt-2 items-start min-h-[600px]">
      {STAGES_CONFIG.map((stage) => {
        const columnLeads = leads.filter((l) => l.stage === stage.id);
        const columnTotalValue = columnLeads.reduce((acc, curr) => acc + (curr.estimatedValue || 0), 0);

        return (
          <div
            key={stage.id}
            className="w-80 shrink-0 bg-slate-100/70 rounded-2xl p-3 border border-slate-200/90 flex flex-col max-h-[calc(100vh-240px)] shadow-sm"
          >
            {/* Cabeçalho da Coluna */}
            <div className="p-2.5 pb-3 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={`font-bold text-xs ${stage.color}`}>{stage.label}</h3>
                  <span className="w-5 h-5 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center justify-center shadow-xs">
                    {columnLeads.length}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
                  R$ {columnTotalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Lista de Cards da Coluna */}
            <div className="flex-1 overflow-y-auto space-y-3 pt-3 pr-1">
              {columnLeads.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 font-medium">
                  Sem leads nesta etapa
                </div>
              ) : (
                columnLeads.map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => onSelectLead(lead.id)}
                    className="group bg-white rounded-xl p-3.5 border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-primary/40 transition-all cursor-pointer space-y-2.5 relative"
                  >
                    {/* Alerta de Ação Vencida */}
                    {lead.isNextActionOverdue && (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-50 text-red-700 text-[10px] font-bold border border-red-200">
                        <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                        <span>Próximo contato vencido</span>
                      </div>
                    )}

                    {/* Título e Valor */}
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-xs text-slate-900 group-hover:text-brand-primary transition truncate" title={lead.name}>
                        {lead.name}
                      </h4>
                      {lead.estimatedValue ? (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                          R$ {lead.estimatedValue.toFixed(2)}
                        </span>
                      ) : null}
                    </div>

                    {/* Metadados */}
                    <div className="space-y-1 text-[11px] text-slate-500">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{lead.city}/{lead.state}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{lead.owner}</span>
                      </div>
                      {lead.nextActionAt && (
                        <div className="flex items-center gap-1 text-slate-600 font-medium">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{lead.nextActionAt.slice(0, 16).replace('T', ' ')}</span>
                        </div>
                      )}
                    </div>

                    {/* Badges e Ações Rápidas */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 font-mono">#{lead.code}</span>

                      {/* Botão de Fechar Venda na Negociação */}
                      {lead.stage === 'negotiation' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenCreateContract(lead);
                          }}
                          className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 shadow-xs transition"
                        >
                          <Award className="w-3 h-3" />
                          Fechar Venda
                        </button>
                      )}

                      {/* Botão de Avançar Etapa */}
                      {NEXT_STAGE_MAP[lead.stage] && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAdvanceStage(lead.id, NEXT_STAGE_MAP[lead.stage]!);
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-0.5 transition"
                          title="Avançar etapa"
                        >
                          <span>Avançar</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}

                      {lead.stage === 'won' && (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Contrato Ativo
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
