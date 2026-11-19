import React from 'react';
import {
  AlertCircle,
  Clock,
  Award,
  ChevronRight,
  User,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { LeadDto, LeadStage } from '../types.ts';
import { formatDateBR } from '../utils.ts';

interface LeadsTableViewProps {
  leads: LeadDto[];
  onSelectLead: (leadId: number) => void;
  onOpenCreateContract: (lead: LeadDto) => void;
}

const STAGE_LABELS: Record<LeadStage, { label: string; bg: string; text: string }> = {
  new: { label: 'Novo Lead', bg: 'bg-blue-100', text: 'text-blue-800' },
  qualified: { label: 'Qualificado', bg: 'bg-indigo-100', text: 'text-indigo-800' },
  proposal: { label: 'Proposta Enviada', bg: 'bg-amber-100', text: 'text-amber-800' },
  negotiation: { label: 'Em Negociação', bg: 'bg-orange-100', text: 'text-orange-800' },
  won: { label: 'Venda Fechada', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  lost: { label: 'Perdido', bg: 'bg-slate-100', text: 'text-slate-700' },
};

export const LeadsTableView: React.FC<LeadsTableViewProps> = ({
  leads,
  onSelectLead,
  onOpenCreateContract,
}) => {
  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
        Nenhum lead encontrado com os filtros selecionados.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-3 px-4">Lead / Nome</th>
              <th className="py-3 px-3">Código</th>
              <th className="py-3 px-3">Cidade / UF</th>
              <th className="py-3 px-3">Responsável</th>
              <th className="py-3 px-3">Etapa Atual</th>
              <th className="py-3 px-3">Origem</th>
              <th className="py-3 px-3">Próximo Contato</th>
              <th className="py-3 px-3 text-right">Valor Estimado</th>
              <th className="py-3 px-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {leads.map((lead) => {
              const stageConfig = STAGE_LABELS[lead.stage] || STAGE_LABELS.new;

              return (
                <tr
                  key={lead.id}
                  onClick={() => onSelectLead(lead.id)}
                  className="hover:bg-blue-50/40 transition cursor-pointer group"
                >
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900 group-hover:text-brand-primary transition">
                      {lead.name}
                    </div>
                    {lead.phone && <div className="text-[11px] text-slate-400">{lead.phone}</div>}
                  </td>

                  <td className="py-3 px-3 font-mono font-medium text-slate-500">
                    #{lead.code}
                  </td>

                  <td className="py-3 px-3 text-slate-700">
                    {lead.city}/{lead.state}
                  </td>

                  <td className="py-3 px-3 font-medium text-slate-800">
                    {lead.owner}
                  </td>

                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${stageConfig.bg} ${stageConfig.text}`}
                    >
                      {stageConfig.label}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-slate-500 truncate max-w-[120px]">
                    {lead.source}
                  </td>

                  <td className="py-3 px-3">
                    {lead.nextActionAt ? (
                      <div className="flex items-center gap-1.5">
                        {lead.isNextActionOverdue && (
                          <span title="Ação vencida">
                            <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          </span>
                        )}
                        <span
                          className={`font-mono text-[11px] ${
                            lead.isNextActionOverdue ? 'text-red-700 font-bold' : 'text-slate-600'
                          }`}
                        >
                          {formatDateBR(lead.nextActionAt)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-300 italic text-[11px]">Não agendado</span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-right font-semibold text-slate-800 font-mono">
                    {lead.estimatedValue ? `R$ ${lead.estimatedValue.toFixed(2)}` : '—'}
                  </td>

                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {lead.stage === 'negotiation' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenCreateContract(lead);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center gap-1 shadow-xs transition"
                          title="Emitir Contrato Assistido"
                        >
                          <Award className="w-3 h-3" />
                          Fechar
                        </button>
                      )}
                      {lead.stage === 'won' && (
                        <span className="text-emerald-700 font-bold text-[10px] flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> Ganho
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-primary transition" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
