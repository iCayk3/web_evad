import React, { useEffect, useState } from 'react';
import {
  X,
  User,
  Phone,
  Layers,
  Clock,
  Sparkles,
  ExternalLink,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Tag,
  Hash,
  ShieldCheck,
  RefreshCw,
  FileText,
  Timer,
  Zap,
} from 'lucide-react';
import { omnichannelApi } from '../api/omnichannel.api.ts';
import {
  RecurrenceClientItem,
  ClientInteractionContact,
  ClientRbxTicket,
} from '../types/omnichannel.types.ts';

interface RecurrenceDetailsModalProps {
  client: RecurrenceClientItem | null;
  batchId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const RecurrenceDetailsModal: React.FC<RecurrenceDetailsModalProps> = ({
  client,
  batchId,
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<ClientInteractionContact[]>([]);
  const [rbxTickets, setRbxTickets] = useState<ClientRbxTicket[]>([]);
  const [activeTab, setActiveTab] = useState<'contacts' | 'rbx'>('contacts');

  useEffect(() => {
    if (!isOpen || !client) return;

    const loadInteractions = async () => {
      setLoading(true);
      try {
        const res = await omnichannelApi.getClientInteractions({
          batchId,
          clientKey: client.key,
          rbxClientId: client.rbxClientId || undefined,
          phoneMasked: client.phoneDisplay || undefined,
        });
        setContacts(res.contacts || []);
        setRbxTickets(res.rbxTickets || []);
      } catch (err) {
        console.error('[RecurrenceDetailsModal] Error loading client interactions:', err);
      } finally {
        setLoading(false);
      }
    };

    loadInteractions();
  }, [isOpen, client, batchId]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !client) return null;

  const formatSeconds = (sec?: number | null) => {
    if (!sec || sec <= 0) return '00:00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const formatDateOnly = (isoStr?: string) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr.slice(0, 10);
      return d.toLocaleDateString('pt-BR');
    } catch {
      return isoStr;
    }
  };

  const getDeptBadgeClass = (dept?: string | null) => {
    const d = (dept || '').toLowerCase();
    if (d.includes('suporte')) return 'bg-blue-50 text-blue-700 border-blue-200/80';
    if (d.includes('financeiro')) return 'bg-amber-50 text-amber-700 border-amber-200/80';
    if (d.includes('comercial')) return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
    return 'bg-purple-50 text-purple-700 border-purple-200/80';
  };

  // Aggregated KPIs for the client
  const totalHandleSeconds = contacts.reduce((acc, c) => acc + (c.handleTimeSeconds || 0), 0);
  const avgHandleSeconds = contacts.length > 0 ? Math.round(totalHandleSeconds / contacts.length) : 0;
  const totalWaitSeconds = contacts.reduce((acc, c) => acc + (c.waitTimeSeconds || 0), 0);
  const avgWaitSeconds = contacts.length > 0 ? Math.round(totalWaitSeconds / contacts.length) : 0;
  const csatAnswered = contacts.filter((c) =>
    (c.satisfactionStatus || '').toLowerCase().includes('respondida')
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header (Compact & Clear) */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-amber-50/20 to-blue-50/20">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0 font-bold text-base">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                  {client.customerName}
                </h2>
                {client.rbxClientId ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
                    <ShieldCheck className="w-3 h-3 text-blue-600" />
                    RBX #{client.rbxClientId}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                    Sem vínculo RBX
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900">
                  {client.totalContacts} atendimentos
                </span>
              </div>

              <div className="flex items-center gap-3.5 mt-0.5 text-xs text-slate-500 flex-wrap">
                <span className="flex items-center gap-1 font-mono text-slate-600 font-semibold">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {client.phoneDisplay}
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {client.distinctDays} dias distintos de contato
                </span>
                <span className="text-slate-400 text-[11px]">
                  ({formatDateOnly(client.firstContactAt)} a {formatDateOnly(client.lastContactAt)})
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer shrink-0 ml-2"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Summary Strip: Sectors + Client KPIs + Navigation Tabs */}
        <div className="px-6 py-2.5 bg-slate-50/80 border-b border-slate-200/70 flex items-center justify-between gap-3 flex-wrap text-xs">
          {/* Sectors and Client Average KPIs */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">
                Setores:
              </span>
              {client.departments && client.departments.length > 0 ? (
                client.departments.map((dept, idx) => (
                  <span
                    key={idx}
                    className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${getDeptBadgeClass(
                      dept
                    )}`}
                  >
                    {dept}
                  </span>
                ))
              ) : (
                <span className="text-slate-400 italic text-[11px]">Não informado</span>
              )}
            </div>

            {contacts.length > 0 && (
              <>
                <div className="h-3.5 w-px bg-slate-200 hidden sm:block" />

                {/* Inline Mini-KPIs */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200/80 text-[11px] font-medium text-slate-700 shadow-2xs"
                    title="Tempo Médio de Atendimento acumulado deste cliente"
                  >
                    <Clock className="w-3 h-3 text-blue-600" />
                    <span className="text-slate-400 text-[10px]">TMA Médio:</span>
                    <strong className="font-mono text-slate-900">{formatSeconds(avgHandleSeconds)}</strong>
                  </div>

                  <div
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200/80 text-[11px] font-medium text-slate-700 shadow-2xs"
                    title="Tempo Médio de Espera acumulado em fila"
                  >
                    <Timer className="w-3 h-3 text-amber-500" />
                    <span className="text-slate-400 text-[10px]">TME Médio:</span>
                    <strong
                      className={`font-mono ${
                        avgWaitSeconds > 300 ? 'text-rose-600' : 'text-slate-900'
                      }`}
                    >
                      {formatSeconds(avgWaitSeconds)}
                    </strong>
                  </div>

                  {csatAnswered > 0 && (
                    <div
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800 shadow-2xs"
                      title="Avaliações de satisfação respondidas"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{csatAnswered} CSAT respondidas</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex rounded-xl bg-slate-200/80 p-0.5 text-xs font-semibold shrink-0">
            <button
              onClick={() => setActiveTab('contacts')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'contacts'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Atendimentos ({contacts.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('rbx')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'rbx'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Protocolos RBX ({rbxTickets.length})</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content (Optimized Density) */}
        <div className="p-4 sm:p-5 overflow-y-auto max-h-[calc(92vh-155px)] space-y-2.5 bg-slate-50/50">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-xs font-medium">Carregando histórico completo de atendimentos...</p>
            </div>
          ) : activeTab === 'contacts' ? (
            /* Contact Facts List: Compact 2-Line Architecture */
            <div className="space-y-2">
              {contacts.map((contact, i) => (
                <div
                  key={contact.id || i}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-blue-300 hover:shadow-xs transition-all space-y-2.5"
                >
                  {/* Row 1: Identification, Department, Timing Pill Group, ID & Status */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                        #{i + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {formatDate(contact.startedAt)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${getDeptBadgeClass(
                          contact.department
                        )}`}
                      >
                        {contact.department || 'Automação / Sem Setor'}
                      </span>

                      {/* Integrated Time Indicators Strip */}
                      <div className="flex items-center gap-1.5 ml-1 flex-wrap">
                        <div
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50/80 border border-blue-200/70 text-blue-950 text-[11px] font-semibold"
                          title="TMA: Duração efetiva do atendimento"
                        >
                          <span className="text-[10px] text-blue-600 font-medium">TMA</span>
                          <span className="font-mono font-bold">
                            {formatSeconds(contact.handleTimeSeconds)}
                          </span>
                        </div>

                        <div
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${
                            (contact.waitTimeSeconds || 0) > 300
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200/70'
                          }`}
                          title="TME: Tempo de espera em fila antes de ser atendido"
                        >
                          <span className="text-[10px] text-slate-400 font-medium">TME</span>
                          <span className="font-mono font-bold">
                            {formatSeconds(contact.waitTimeSeconds)}
                          </span>
                        </div>

                        <div
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 text-slate-700 border border-slate-200/70 text-[11px] font-semibold"
                          title="Tempo até a primeira resposta do atendente"
                        >
                          <span className="text-[10px] text-slate-400 font-medium">1ª Resp</span>
                          <span className="font-mono font-bold">
                            {formatSeconds(contact.firstResponseSeconds)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right side: Conversation ID & Status */}
                    <div className="flex items-center gap-2">
                      {contact.conversationId && (
                        <span className="font-mono text-[11px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/60">
                          ID: {contact.conversationId}
                        </span>
                      )}
                      {contact.status && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            contact.status.toLowerCase().includes('finaliz') ||
                            contact.status.toLowerCase().includes('conclu')
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                              : 'bg-slate-100 text-slate-700 border border-slate-200/60'
                          }`}
                        >
                          {contact.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Classifications tags, Desfecho & CSAT badge */}
                  <div className="flex items-center justify-between text-xs text-slate-600 gap-2 flex-wrap pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {contact.classification ? (
                        (() => {
                          try {
                            const tags = JSON.parse(contact.classification);
                            if (Array.isArray(tags) && tags.length > 0) {
                              return tags.map((t, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-md bg-blue-50/80 text-blue-700 text-[10px] font-semibold border border-blue-200/50"
                                >
                                  {String(t)}
                                </span>
                              ));
                            }
                          } catch {}
                          return (
                            <span className="text-[11px] text-slate-700 font-medium px-2 py-0.5 bg-slate-50 rounded-md border border-slate-200/60">
                              {contact.classification}
                            </span>
                          );
                        })()
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Sem classificação</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {contact.closureType && (
                        <span className="text-[11px] text-slate-500">
                          Desfecho:{' '}
                          <strong className="text-slate-800 font-semibold">{contact.closureType}</strong>
                        </span>
                      )}
                      {contact.satisfactionStatus && (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            contact.satisfactionStatus.toLowerCase().includes('respondida')
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : contact.satisfactionStatus.toLowerCase().includes('expirada')
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {contact.satisfactionStatus.toLowerCase().includes('respondida') && (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          )}
                          {contact.satisfactionStatus.toLowerCase().includes('expirada') && (
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                          )}
                          <span>CSAT: {contact.satisfactionStatus}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {contacts.length === 0 && (
                <div className="py-16 text-center text-slate-400 text-xs italic bg-white rounded-2xl border border-slate-200/60">
                  Nenhum registro de contato encontrado para este cliente na carga.
                </div>
              )}
            </div>
          ) : (
            /* RBX Tickets List: Compact Architecture */
            <div className="space-y-2">
              {rbxTickets.map((ticket, i) => (
                <div
                  key={ticket.id || i}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-blue-300 hover:shadow-xs transition-all space-y-2"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-900 font-mono text-xs font-bold border border-blue-200/60">
                        OS #{ticket.id} · Protocolo {ticket.protocol}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {ticket.type || 'Atendimento'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          ticket.status.toLowerCase().includes('conclu')
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {ticket.status}
                      </span>
                      <div className="text-[11px] text-slate-500 font-mono">
                        <span>Abertura: {formatDate(ticket.openedAt)}</span>
                        {ticket.concludedAt && (
                          <span className="text-slate-400"> • Conclusão: {formatDate(ticket.concludedAt)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-700 pt-1.5 border-t border-slate-100 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Tópico:</span>
                      <span className="font-semibold text-slate-800 px-2 py-0.5 bg-slate-50 rounded-md border border-slate-200/60">
                        {ticket.topic}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Causa:</span>
                      <span className="font-semibold text-slate-800 px-2 py-0.5 bg-slate-50 rounded-md border border-slate-200/60">
                        {ticket.cause}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {rbxTickets.length === 0 && (
                <div className="py-16 text-center text-slate-400 text-xs italic bg-white rounded-2xl border border-slate-200/60">
                  Nenhum chamado cadastrado no RBXSoft para este cliente.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Footer (Compact) */}
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/80">
          <span className="text-[11px] text-slate-500 font-medium">
            Exibindo histórico consolidado de atendimentos ({contacts.length}) e chamados RBX ({rbxTickets.length})
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
