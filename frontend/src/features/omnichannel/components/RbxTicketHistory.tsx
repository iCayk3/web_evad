import React from 'react';
import { HealthTicket } from '../types/customer-health.types.ts';

const timestamp = (value: string) => new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

function Field({ label, value }: { label: string; value?: string }) {
  return <div className="min-w-0"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{value || 'Não informado pelo RBX'}</dd></div>;
}

export function RbxTicketHistory({ ticket }: { ticket: HealthTicket }) {
  const status = ticket.status || 'Não informado pelo RBX';
  const statusColor = status === 'Concluído' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
    status === 'Pendente' ? 'border-amber-200 bg-amber-50 text-amber-800' :
      ['Aberto', 'Em andamento'].includes(status) ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-100 text-slate-700';
  return <article aria-label={`Atendimento RBX ${ticket.protocol}`}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><p className="text-xs font-semibold text-blue-700">ATENDIMENTO RBX</p><h4 className="mt-1 break-all font-semibold text-slate-900">Protocolo {ticket.protocol}</h4>{ticket.number && ticket.number !== ticket.protocol && <p className="mt-1 text-xs text-slate-500">Atendimento nº {ticket.number}</p>}</div>
      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusColor}`}>Situação: {status}</span>
    </div>
    {ticket.subject && <p className="mt-3 whitespace-pre-wrap break-words text-sm font-semibold text-slate-900">{ticket.subject}</p>}
    <dl className="mt-4 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
      <Field label="Tópico" value={ticket.topic}/><Field label="Causa identificada" value={ticket.cause}/>
      <Field label="Motivo do atendimento" value={ticket.reason}/><Field label="Tipo de atendimento" value={ticket.type}/>
      <Field label="Responsável" value={ticket.responsible}/><Field label="Setor" value={ticket.department}/>
      <Field label="Abertura" value={timestamp(ticket.openedAt)}/>
      <Field label="Conclusão" value={ticket.concludedAt ? timestamp(ticket.concludedAt) : ticket.status === 'Concluído' ? 'Data não informada pelo RBX' : 'Sem conclusão registrada'}/>
      {ticket.dueAt && <Field label="Prazo de SLA informado" value={timestamp(ticket.dueAt)}/>}
    </dl>
    <details className="mt-4 border-t border-slate-100 pt-3"><summary className="cursor-pointer rounded-lg text-sm font-semibold text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">Descrição e solução do atendimento</summary><dl className="mt-3 space-y-4 rounded-xl bg-slate-50 p-3"><Field label="Descrição / observações" value={ticket.description || ticket.subject}/><Field label="Solução registrada" value={ticket.solution}/></dl></details>
  </article>;
}
