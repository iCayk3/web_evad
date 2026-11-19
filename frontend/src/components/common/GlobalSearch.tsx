import React, { useState, useEffect, useRef } from 'react';
import { Search, User, Ticket, AlertTriangle, X, ArrowRight } from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import { Badge } from './Badge.tsx';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTicket: (ticketId: number) => void;
  onSelectClient: (clientId: number) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  isOpen,
  onClose,
  onSelectTicket,
  onSelectClient,
}) => {
  const [query, setQuery] = useState('');
  const [tickets, setTickets] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setTickets([]);
      setClients([]);
    }
  }, [isOpen]);

  // Busca debounced
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setTickets([]);
      setClients([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [ticketsRes, clientsRes] = await Promise.all([
          apiFetch<{ tickets: any[] }>(`/api/atendimentos?search=${encodeURIComponent(query)}`),
          apiFetch<{ clients: any[] }>(`/api/clientes?search=${encodeURIComponent(query)}`),
        ]);
        setTickets(ticketsRes.tickets.slice(0, 5));
        setClients(clientsRes.clients.slice(0, 5));
      } catch (e) {
        console.error('Erro na busca global:', e);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-signature border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Busca global de clientes e atendimentos"
      >
        <div className="flex items-center px-5 py-4 border-b border-slate-100 bg-white">
          <Search className="w-5 h-5 text-brand-primary mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent border-none text-slate-800 placeholder-slate-400 focus:outline-none text-sm font-medium"
            placeholder="Buscar por cliente, documento, protocolo ou assunto..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
          />
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Fechar busca"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[28rem] overflow-y-auto p-5 space-y-5 bg-[#F4F6F9]">
          {loading && (
            <div className="py-12 text-center text-slate-500 text-xs">
              <div className="inline-block animate-spin w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full mr-2" />
              Buscando no banco de dados do RBXSoft...
            </div>
          )}

          {!loading && query.length >= 2 && tickets.length === 0 && clients.length === 0 && (
            <div className="py-12 text-center text-slate-500 text-xs bg-white rounded-2xl border border-slate-100">
              Nenhum registro encontrado para "{query}".
            </div>
          )}

          {!loading && query.length < 2 && (
            <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-100 p-6">
              Digite ao menos 2 caracteres para pesquisar instantaneamente chamados e clientes.
            </div>
          )}

          {/* Seção Clientes */}
          {clients.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-2.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-brand-primary" />
                <span>Clientes Encontrados ({clients.length})</span>
              </div>
              <div className="space-y-1.5">
                {clients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onSelectClient(c.id);
                      onClose();
                    }}
                    className="w-full text-left p-3.5 rounded-2xl bg-white hover:bg-blue-50/40 border border-slate-100 hover:border-brand-primary/30 flex items-center justify-between transition-all duration-150 group shadow-2xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 group-hover:text-brand-primary transition-colors text-xs">
                        {c.name}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {c.document} • {c.city}/{c.neighborhood} • {c.plan}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.indicators?.hasOpenTicket && (
                        <Badge variant="risk" className="text-[10px]">
                          Chamado Aberto
                        </Badge>
                      )}
                      <Badge variant={c.status === 'Ativo' ? 'ok' : 'overdue'} className="text-[10px]">
                        {c.status}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Seção Atendimentos */}
          {tickets.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-2.5 flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5 text-brand-primary" />
                <span>Atendimentos Encontrados ({tickets.length})</span>
              </div>
              <div className="space-y-1.5">
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      onSelectTicket(t.id);
                      onClose();
                    }}
                    className="w-full text-left p-3.5 rounded-2xl bg-white hover:bg-blue-50/40 border border-slate-100 hover:border-brand-primary/30 flex items-center justify-between transition-all duration-150 group shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-brand-primary">
                          {t.protocol}
                        </span>
                        <span className="text-slate-900 font-semibold text-xs truncate">
                          {t.clientName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {t.topicName} • Técnico: {t.technicianName}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.isOverdue && (
                        <Badge variant="overdue" pulse className="text-[10px]">
                          SLA Vencido
                        </Badge>
                      )}
                      {t.isAtRisk && (
                        <Badge variant="risk" pulse className="text-[10px]">
                          SLA em Risco
                        </Badge>
                      )}
                      <Badge variant="neutral" className="text-[10px]">
                        {t.status}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-white border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
          <span>Use <strong>Tab</strong> para navegar e <strong>ESC</strong> para fechar</span>
          <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">Ctrl + K</span>
        </div>
      </div>
    </div>
  );
};
