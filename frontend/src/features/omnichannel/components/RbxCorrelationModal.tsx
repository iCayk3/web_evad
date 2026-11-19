import React, { useEffect, useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Phone,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  FileText,
  HelpCircle,
  Tag,
  ArrowRight,
  Users,
  User,
  Bot,
  ArrowUpDown,
  Filter,
  Check,
  PhoneCall,
  Timer,
  Wrench,
  Flame,
  LayoutGrid,
  List,
  CheckCircle,
} from 'lucide-react';
import {
  RbxCorrelationResult,
  RbxCorrelatedItem,
  RbxCorrelatedTicketSummary,
} from '../types/omnichannel.types.ts';

interface RbxCorrelationModalProps {
  isOpen: boolean;
  onClose: () => void;
  correlation: RbxCorrelationResult | null;
  department?: string;
  windowHours: number;
  customWindowStart?: string;
  customWindowEnd?: string;
}

type FilterTab = 'all' | 'correlated' | 'uncorrelated';
type ViewMode = 'grouped' | 'flat';
type SortOption =
  | 'date_desc'
  | 'date_asc'
  | 'name_asc'
  | 'name_desc'
  | 'contacts_desc'
  | 'tickets_desc';

interface ClientGroup {
  clientKey: string;
  clientId: string;
  clientName: string;
  phoneDisplay: string;
  hasTicket: boolean;
  contacts: RbxCorrelatedItem[];
  tickets: RbxCorrelatedTicketSummary[];
  allAgents: string[];
  departments: string[];
  latestContactAt: string;
  firstContactAt: string;
}

export const RbxCorrelationModal: React.FC<RbxCorrelationModalProps> = ({
  isOpen,
  onClose,
  correlation,
  department,
  windowHours,
  customWindowStart,
  customWindowEnd,
}) => {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});

  const pageSize = viewMode === 'grouped' ? 12 : 20;

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

  // Reset page when filter, tab, view mode or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, viewMode, sortBy]);

  const rawList = correlation?.detailedList || [];

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr.includes('T') ? isoStr : isoStr.replace(' ', 'T'));
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const formatSeconds = (sec?: number | null) => {
    if (!sec || sec <= 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return `${h}h ${remM > 0 ? `${remM}m` : ''}`;
    }
    return `${m}m ${s > 0 ? `${s}s` : ''}`;
  };

  const formatClientDisplayName = (name?: string | null): string => {
    if (!name || !name.trim()) return 'Cliente não identificado';
    const clean = name.trim().replace(/\s+/g, ' ');
    const parts = clean.split(' ');
    if (parts.length <= 2) return clean;
    const firstName = parts[0];
    const lastPart = parts[parts.length - 1];
    const suffixes = ['JUNIOR', 'JR', 'JR.', 'FILHO', 'NETO', 'SOBRINHO'];
    let lastName = lastPart;
    let middleEndIndex = parts.length - 1;
    if (parts.length > 2 && suffixes.includes(lastPart.toUpperCase())) {
      lastName = `${parts[parts.length - 2]} ${lastPart}`;
      middleEndIndex = parts.length - 2;
    }
    const middleParts = parts.slice(1, middleEndIndex);
    if (middleParts.length === 0) return `${firstName} ${lastName}`;
    const middleMasked = middleParts
      .map((p) => {
        const lower = p.toLowerCase();
        if (['de', 'da', 'do', 'das', 'dos', 'e'].includes(lower)) return lower;
        return `${p[0].toUpperCase()}.`;
      })
      .join(' ');
    return `${firstName} ${middleMasked} ${lastName}`;
  };

  const getFormattedTicketStatus = (status?: string | null, concludedAt?: string | null): string => {
    if (!status) return concludedAt ? 'Concluído' : 'Aberto';
    const s = status.trim();
    const upper = s.toUpperCase();
    if (upper === 'C' || upper === 'CONCLUIDO' || upper === 'CONCLUÍDO' || upper === 'FINALIZADO') return 'Concluído';
    if (upper === 'E' || upper === 'A' || upper === 'EM ANDAMENTO' || upper === 'ANDAMENTO' || upper === 'EXECUCAO' || upper === 'EXECUÇÃO') return 'Em Andamento';
    if (upper === 'P' || upper === 'PENDENTE') return 'Pendente';
    if (upper === 'B' || upper === 'CANCELADO') return 'Cancelado';
    if (concludedAt) return 'Concluído';
    return s;
  };

  const getFormattedTicketType = (type?: string | null): string => {
    if (!type) return 'Técnico';
    const t = type.trim();
    const upper = t.toUpperCase();
    if (upper === 'T' || upper === 'TECNICO' || upper === 'TÉCNICO') return 'Técnico';
    if (upper === 'C' || upper === 'COMERCIAL') return 'Comercial';
    if (upper === 'A' || upper === 'F' || upper === 'ADM' || upper === 'FIN' || upper === 'ADM/FIN' || upper === 'FINANCEIRO' || upper === 'ADMINISTRATIVO') return 'Administrativo / Financeiro';
    if (upper === 'O' || upper === 'OPERACIONAL') return 'Operacional';
    return t;
  };

  const getStatusBadge = (status?: string | null) => {
    const s = (status || '').toUpperCase();
    if (s.includes('CONCLU') || s.includes('FINALIZ') || s === 'C') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
    }
    if (s.includes('ANDAMENTO') || s.includes('EXECU') || s === 'E' || s === 'A') {
      return 'bg-blue-50 text-blue-700 border-blue-200/80';
    }
    if (s.includes('ABERTO') || s.includes('PENDENTE') || s === 'P') {
      return 'bg-amber-50 text-amber-700 border-amber-200/80';
    }
    if (s.includes('CANCEL') || s === 'B') {
      return 'bg-rose-50 text-rose-700 border-rose-200/80';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const formatTimeDiff = (diffMinutes?: number | null) => {
    if (diffMinutes === undefined || diffMinutes === null) return null;
    const isNegative = diffMinutes < 0;
    const absDiff = Math.abs(diffMinutes);
    const hours = Math.floor(absDiff / 60);
    const mins = absDiff % 60;

    let timeStr = '';
    if (hours > 0) {
      timeStr = `${hours}h ${mins > 0 ? `${mins}m` : ''}`;
    } else {
      timeStr = `${mins}m`;
    }

    if (absDiff === 0) return 'Aberto no mesmo momento';
    if (isNegative) {
      return `Aberto ${timeStr} antes do contato`;
    }
    return `Aberto ${timeStr} após o contato`;
  };

  const filteredList = useMemo(() => {
    return rawList.filter((item) => {
      // Filter by tab
      if (activeTab === 'correlated' && !item.hasTicket) return false;
      if (activeTab === 'uncorrelated' && item.hasTicket) return false;

      // Filter by search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchName = item.clientName.toLowerCase().includes(query);
        const matchPhone = item.phoneDisplay.toLowerCase().includes(query);
        const matchProtocol = (item.ticketProtocol || '').toLowerCase().includes(query);
        const matchConv = (item.conversationId || '').toLowerCase().includes(query);
        const matchNumber = String(item.ticketNumber || '').includes(query);
        const matchTopic = (item.ticketTopic || '').toLowerCase().includes(query);
        const matchCause = (item.ticketCause || '').toLowerCase().includes(query);
        const matchDept = (item.department || '').toLowerCase().includes(query);
        const matchAgent = (item.agents || []).some((a) => a.toLowerCase().includes(query));
        return (
          matchName ||
          matchPhone ||
          matchProtocol ||
          matchConv ||
          matchNumber ||
          matchTopic ||
          matchCause ||
          matchDept ||
          matchAgent
        );
      }

      return true;
    });
  }, [rawList, activeTab, searchTerm]);

  // Client Grouping
  const clientGroups = useMemo(() => {
    const map = new Map<string, ClientGroup>();

    for (const item of filteredList) {
      const key = item.rbxClientId ? `id:${item.rbxClientId}` : `phone:${item.phoneDisplay || item.factId}`;
      let group = map.get(key);
      if (!group) {
        group = {
          clientKey: key,
          clientId: item.rbxClientId,
          clientName: formatClientDisplayName(item.clientName),
          phoneDisplay: item.phoneDisplay,
          hasTicket: false,
          contacts: [],
          tickets: [],
          allAgents: [],
          departments: [],
          latestContactAt: item.startedAt,
          firstContactAt: item.startedAt,
        };
        map.set(key, group);
      }

      group.contacts.push(item);

      if (item.hasTicket) {
        group.hasTicket = true;
      }

      // Collect tickets
      if (item.clientTickets && item.clientTickets.length > 0) {
        for (const t of item.clientTickets) {
          const tId = t.protocol || t.number;
          if (tId && !group.tickets.some((existing) => (existing.protocol || existing.number) === tId)) {
            group.tickets.push(t);
          }
        }
      } else if (item.hasTicket && (item.ticketProtocol || item.ticketNumber)) {
        const tId = item.ticketProtocol || item.ticketNumber;
        if (tId && !group.tickets.some((existing) => (existing.protocol || existing.number) === tId)) {
          group.tickets.push({
            protocol: item.ticketProtocol,
            number: item.ticketNumber,
            openedAt: item.ticketOpenedAt,
            concludedAt: item.ticketConcludedAt,
            isConcluded: Boolean(item.isTicketConcluded),
            topic: item.ticketTopic,
            cause: item.ticketCause,
            status: item.ticketStatus,
            type: item.ticketType,
          });
        }
      }

      // Collect all agents
      if (item.agents && item.agents.length > 0) {
        for (const ag of item.agents) {
          if (ag && !group.allAgents.includes(ag)) {
            group.allAgents.push(ag);
          }
        }
      }

      // Collect departments
      if (item.department && !group.departments.includes(item.department)) {
        group.departments.push(item.department);
      }

      // Update dates
      if (new Date(item.startedAt).getTime() > new Date(group.latestContactAt).getTime()) {
        group.latestContactAt = item.startedAt;
      }
      if (new Date(item.startedAt).getTime() < new Date(group.firstContactAt).getTime()) {
        group.firstContactAt = item.startedAt;
      }
    }

    const list = Array.from(map.values());

    // Sort grouped list
    list.sort((a, b) => {
      if (sortBy === 'name_asc') return a.clientName.localeCompare(b.clientName);
      if (sortBy === 'name_desc') return b.clientName.localeCompare(a.clientName);
      if (sortBy === 'contacts_desc') return b.contacts.length - a.contacts.length;
      if (sortBy === 'tickets_desc') return b.tickets.length - a.tickets.length;
      if (sortBy === 'date_asc') return new Date(a.latestContactAt).getTime() - new Date(b.latestContactAt).getTime();
      return new Date(b.latestContactAt).getTime() - new Date(a.latestContactAt).getTime();
    });

    return list;
  }, [filteredList, sortBy]);

  // Flat sorted list
  const sortedFlatList = useMemo(() => {
    const list = [...filteredList];
    list.sort((a, b) => {
      if (sortBy === 'name_asc') return a.clientName.localeCompare(b.clientName);
      if (sortBy === 'name_desc') return b.clientName.localeCompare(a.clientName);
      if (sortBy === 'date_asc') return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
      if (sortBy === 'tickets_desc') return (b.hasTicket ? 1 : 0) - (a.hasTicket ? 1 : 0);
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    });
    return list;
  }, [filteredList, sortBy]);

  const totalItems = viewMode === 'grouped' ? clientGroups.length : sortedFlatList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return clientGroups.slice(start, start + pageSize);
  }, [clientGroups, currentPage, pageSize]);

  const paginatedFlatList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedFlatList.slice(start, start + pageSize);
  }, [sortedFlatList, currentPage, pageSize]);

  const toggleClientExpansion = (clientKey: string) => {
    setExpandedClients((prev) => ({
      ...prev,
      [clientKey]: prev[clientKey] === undefined ? false : !prev[clientKey],
    }));
  };

  const isClientExpanded = (clientKey: string) => {
    // Default open if not explicitly collapsed
    return expandedClients[clientKey] !== false;
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    for (const g of paginatedGroups) {
      next[g.clientKey] = true;
    }
    setExpandedClients(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    for (const g of paginatedGroups) {
      next[g.clientKey] = false;
    }
    setExpandedClients(next);
  };

  if (!isOpen || !correlation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-slate-50 via-blue-50/25 to-indigo-50/25">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Cruzamento Detalhado: Atendimentos × Chamados RBX
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
                  <Layers className="w-3 h-3 text-blue-600" />
                  {department || 'Todos os Departamentos'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                  {correlation.correlationRate}% correlacionados
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Auditoria analítica e cruzamento de cada atendimento omnichannel com ordens de serviço e chamados abertos no RBX.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer shrink-0"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info & Metrics Bar */}
        <div className="px-6 py-3 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Janela Ativa:
            </span>
            {customWindowStart && customWindowEnd ? (
              <span className="px-2.5 py-1 rounded-lg bg-blue-100/80 text-blue-800 font-semibold text-[11px] flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-600" />
                {formatDate(customWindowStart)} até {formatDate(customWindowEnd)}
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-lg bg-slate-200/80 text-slate-800 font-semibold text-[11px] flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                ±{windowHours}h do atendimento
              </span>
            )}

            <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

            <span className="text-slate-500">
              Total analisado:{' '}
              <strong className="text-slate-800">{correlation.totalLinkedContacts}</strong> contatos
            </span>
            <span className="text-emerald-700">
              · Com chamado:{' '}
              <strong>{correlation.correlatedContactsCount}</strong>
            </span>
            <span className="text-slate-500">
              · Sem chamado:{' '}
              <strong>{correlation.contactsWithoutCorrelatedTicket}</strong>
            </span>
          </div>

          {/* Navigation Filter Tabs */}
          <div className="flex rounded-xl bg-slate-200/70 p-0.5 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({rawList.length})
            </button>
            <button
              onClick={() => setActiveTab('correlated')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                activeTab === 'correlated'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Com RBX ({correlation.correlatedContactsCount})</span>
            </button>
            <button
              onClick={() => setActiveTab('uncorrelated')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                activeTab === 'uncorrelated'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>Sem Chamado ({correlation.contactsWithoutCorrelatedTicket})</span>
            </button>
          </div>
        </div>

        {/* Toolbar: Search, Grouping Mode & Sorting */}
        <div className="px-6 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-2.5 flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por cliente, atendente, telefone, protocolo, OS, assunto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* View Mode Toggle: Agrupado por Cliente vs Lista Linear */}
            <div className="flex items-center rounded-xl bg-slate-100 p-0.5 text-xs font-medium border border-slate-200/80 shrink-0">
              <button
                onClick={() => setViewMode('grouped')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'grouped'
                    ? 'bg-white text-blue-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Agrupar múltiplos chamados e atendimentos do mesmo cliente"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Agrupar por Cliente</span>
              </button>
              <button
                onClick={() => setViewMode('flat')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'flat'
                    ? 'bg-white text-blue-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Exibir atendimentos individualmente"
              >
                <List className="w-3.5 h-3.5" />
                <span>Lista por Atendimento</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Sort selector */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[11px] font-medium text-slate-500 hidden sm:inline">Ordenar:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-700 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="date_desc">Data (Mais recentes)</option>
                <option value="date_asc">Data (Mais antigos)</option>
                <option value="name_asc">Nome do Cliente (A → Z)</option>
                <option value="name_desc">Nome do Cliente (Z → A)</option>
                {viewMode === 'grouped' && (
                  <>
                    <option value="contacts_desc">Mais Atendimentos</option>
                    <option value="tickets_desc">Mais Chamados RBX</option>
                  </>
                )}
              </select>
            </div>

            {viewMode === 'grouped' && (
              <div className="hidden md:flex items-center gap-1 text-[11px]">
                <button
                  onClick={expandAll}
                  className="px-2 py-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                >
                  Expandir
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={collapseAll}
                  className="px-2 py-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                >
                  Recolher
                </button>
              </div>
            )}

            <div className="text-xs text-slate-500 font-medium">
              {viewMode === 'grouped' ? (
                <span>
                  <strong className="text-slate-800">{clientGroups.length}</strong> clientes (
                  {filteredList.length} contatos)
                </span>
              ) : (
                <span>
                  <strong className="text-slate-800">{filteredList.length}</strong> atendimentos
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3.5">
          {viewMode === 'grouped' ? (
            // GROUPED BY CLIENT VIEW
            paginatedGroups.length > 0 ? (
              paginatedGroups.map((group) => {
                const expanded = isClientExpanded(group.clientKey);
                return (
                  <div
                    key={group.clientKey}
                    className={`rounded-2xl border transition-all ${
                      group.hasTicket
                        ? 'bg-white border-blue-100 shadow-xs hover:border-blue-300'
                        : 'bg-slate-50/50 border-slate-200/80 hover:bg-slate-50'
                    }`}
                  >
                    {/* Client Header Card */}
                    <div
                      onClick={() => toggleClientExpansion(group.clientKey)}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900 tracking-tight">
                            {group.clientName}
                          </span>
                          {group.clientId && (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
                              #{group.clientId}
                            </span>
                          )}
                          {group.departments.map((dept, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                            >
                              {dept}
                            </span>
                          ))}
                          {group.hasTicket ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {group.tickets.length > 0
                                ? `${group.tickets.length} ${group.tickets.length === 1 ? 'Chamado Correlacionado' : 'Chamados Correlacionados'}`
                                : 'Chamado Correlacionado'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                              <HelpCircle className="w-3 h-3 text-slate-400" />
                              Sem chamado no RBX
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {group.phoneDisplay || 'Telefone não informado'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            Último contato: {formatDate(group.latestContactAt)}
                          </span>
                          {group.allAgents.length > 0 && (
                            <span className="flex items-center gap-1 text-slate-600">
                              <Users className="w-3 h-3 text-blue-500" />
                              Atendente(s):{' '}
                              <strong className="text-slate-700">{group.allAgents.join(', ')}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                        <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-700">
                          {group.contacts.length}{' '}
                          {group.contacts.length === 1 ? 'atendimento' : 'atendimentos'}
                        </span>
                        {group.tickets.length > 0 && (
                          <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {group.tickets.length}{' '}
                            {group.tickets.length === 1 ? 'chamado RBX' : 'chamados RBX'}
                          </span>
                        )}
                        <button
                          type="button"
                          className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition"
                        >
                          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Group Body */}
                    {expanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Left Column: Atendimentos Omnichannel */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                <PhoneCall className="w-3.5 h-3.5 text-blue-600" />
                                Atendimentos Omnichannel ({group.contacts.length})
                              </span>
                            </div>

                            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                              {group.contacts.map((c, cIdx) => (
                                <div
                                  key={c.factId || cIdx}
                                  className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-2 text-xs"
                                >
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-bold text-slate-800">
                                        Prot. #{c.conversationId || '—'}
                                      </span>
                                      {c.isProtocolConcluded ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                          <Check className="w-2.5 h-2.5" />
                                          Protocolo Encerrado
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                          <Clock className="w-2.5 h-2.5" />
                                          Protocolo Em Aberto
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[11px] text-slate-500">
                                      {formatDate(c.startedAt)}
                                    </span>
                                  </div>

                                  {/* Agents who participated */}
                                  <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg">
                                    {c.agents && c.agents.length > 0 ? (
                                      <>
                                        <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                        <span className="font-semibold text-slate-700">Atendentes:</span>
                                        {c.agents.map((ag, aIdx) => {
                                          const isCloser = c.closerAgent && c.closerAgent === ag;
                                          return (
                                            <span
                                              key={aIdx}
                                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                                                isCloser
                                                  ? 'bg-blue-50 text-blue-800 border-blue-200 font-bold'
                                                  : 'bg-white text-slate-700 border-slate-200'
                                              }`}
                                              title={isCloser ? 'Atendente finalizador' : undefined}
                                            >
                                              {ag}
                                              {isCloser && (
                                                <span className="text-[9px] text-blue-600 bg-blue-100 px-1 rounded-sm">
                                                  Finalizou
                                                </span>
                                              )}
                                              {aIdx < (c.agents?.length || 0) - 1 && (
                                                <span className="text-slate-300">➔</span>
                                              )}
                                            </span>
                                          );
                                        })}
                                      </>
                                    ) : (
                                      <>
                                        <Bot className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                        <span className="font-medium text-slate-600">
                                          {c.isAutomation ? 'Atendimento Automatizado (Bot)' : 'Sem atendente atribuído'}
                                        </span>
                                      </>
                                    )}
                                  </div>

                                  {/* Contact Metrics & Closure info */}
                                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-0.5">
                                    <div>
                                      <span className="text-slate-400 block text-[10px] uppercase font-bold">
                                        Tempo de Atendimento
                                      </span>
                                      <span className="font-medium">
                                        TMA: <strong>{formatSeconds(c.handleTimeSeconds)}</strong> · TME:{' '}
                                        {formatSeconds(c.waitTimeSeconds)}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 block text-[10px] uppercase font-bold">
                                        Tipo de Encerramento
                                      </span>
                                      <span className="font-medium text-slate-700 truncate block">
                                        {c.closureType || 'Encerramento manual'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Classifications */}
                                  {c.classification && c.classification.length > 0 && (
                                    <div className="flex items-center gap-1 flex-wrap pt-1">
                                      <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                                      {c.classification.map((tag, tIdx) => (
                                        <span
                                          key={tIdx}
                                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100"
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Right Column: Chamados RBX Correlacionados */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                <Wrench className="w-3.5 h-3.5 text-emerald-600" />
                                Chamados RBX Correlacionados ({group.tickets.length})
                              </span>
                            </div>

                            {group.tickets.length > 0 ? (
                              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                                {group.tickets.map((t, tIdx) => {
                                  const formattedStatus = getFormattedTicketStatus(t.status, t.concludedAt);
                                  const formattedType = getFormattedTicketType(t.type);
                                  return (
                                    <div
                                      key={tIdx}
                                      className="p-3 rounded-xl bg-white border border-blue-100 shadow-xs space-y-2 text-xs"
                                    >
                                      <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono font-bold text-slate-900">
                                            OS #{t.number || '—'}
                                          </span>
                                          <span className="font-mono text-[11px] text-slate-500">
                                            Prot: {t.protocol || 'Sem protocolo'}
                                          </span>
                                        </div>

                                        {t.isConcluded ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                            Protocolo Encerrado
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                            <Clock className="w-3 h-3 text-amber-600" />
                                            Protocolo Em Aberto
                                          </span>
                                        )}
                                      </div>

                                      {/* Status & Type Details */}
                                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded-lg">
                                        <div>
                                          <span className="text-slate-400 block text-[10px] uppercase font-bold">
                                            Status & Tipo
                                          </span>
                                          <div className="flex items-center gap-1.5 mt-0.5">
                                            <span
                                              className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadge(
                                                formattedStatus
                                              )}`}
                                            >
                                              {formattedStatus}
                                            </span>
                                            <span className="text-[10px] font-semibold text-slate-600">
                                              {formattedType}
                                            </span>
                                          </div>
                                        </div>

                                        <div>
                                          <span className="text-slate-400 block text-[10px] uppercase font-bold">
                                            Abertura / Encerramento
                                          </span>
                                          <span className="text-[10px] text-slate-700 block mt-0.5">
                                            Aberta: {formatDate(t.openedAt)}
                                          </span>
                                          {t.concludedAt && (
                                            <span className="text-[10px] text-emerald-700 font-semibold block">
                                              Encerrada: {formatDate(t.concludedAt)}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Topic & Cause */}
                                      <div className="text-[11px] space-y-0.5">
                                        <div className="flex items-start gap-1">
                                          <span className="font-semibold text-slate-500">Assunto:</span>
                                          <span className="font-medium text-slate-800">
                                            {t.topic || 'Sem assunto especificado'}
                                          </span>
                                        </div>
                                        <div className="flex items-start gap-1">
                                          <span className="font-semibold text-blue-600">Causa:</span>
                                          <span className="font-medium text-blue-800">
                                            {t.cause || 'Sem causa vinculada'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              // Useful "Sem Chamado" details card inside grouped view
                              <div className="p-4 rounded-xl bg-slate-100/70 border border-dashed border-slate-300 text-xs text-slate-600 space-y-2">
                                <div className="flex items-center gap-2 text-slate-700 font-semibold">
                                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                  <span>Nenhum chamado no RBX nesta janela</span>
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                  Este cliente realizou atendimento(s) via Omnichannel sem necessidade de abertura de OS técnica ou financeira no RBX.
                                </p>
                                <div className="pt-2 border-t border-slate-200 text-[11px] space-y-1 text-slate-500">
                                  <div>
                                    • <strong>Resolução no Chat:</strong> Tratamento em Primeiro Contato (FCR) pelo suporte.
                                  </div>
                                  <div>
                                    • <strong>Atendente(s) Responsável(is):</strong>{' '}
                                    {group.allAgents.length > 0 ? group.allAgents.join(', ') : 'Automação / Bot'}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Sparkles className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-medium">Nenhum registro corresponde aos filtros selecionados.</p>
              </div>
            )
          ) : (
            // FLAT ATENDIMENTOS VIEW
            paginatedFlatList.length > 0 ? (
              paginatedFlatList.map((item, idx) => {
                const formattedTicketStatus = getFormattedTicketStatus(item.ticketStatus, item.ticketConcludedAt);
                const formattedTicketType = getFormattedTicketType(item.ticketType);
                return (
                  <div
                    key={item.factId || idx}
                    className={`p-4 rounded-2xl border transition-all ${
                      item.hasTicket
                        ? 'bg-white border-blue-100 hover:border-blue-300 hover:shadow-sm'
                        : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-50'
                    }`}
                  >
                    {/* Header: Client & Protocols */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900 tracking-tight">
                            {formatClientDisplayName(item.clientName)}
                          </span>
                          {item.rbxClientId && (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
                              #{item.rbxClientId}
                            </span>
                          )}
                          {item.department && (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {item.department}
                            </span>
                          )}
                          {item.hasTicket ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Chamado Correlacionado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                              <HelpCircle className="w-3 h-3 text-slate-400" />
                              Sem chamado no RBX
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {item.phoneDisplay || 'Telefone não informado'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            Atendimento: {formatDate(item.startedAt)}
                          </span>
                          <span className="font-mono text-slate-700">
                            Prot. Chat: <strong>#{item.conversationId}</strong>
                          </span>
                          {item.isProtocolConcluded ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Check className="w-2.5 h-2.5" />
                              Protocolo Encerrado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-2.5 h-2.5" />
                              Protocolo Em Aberto
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Correlation time diff pill */}
                      {item.hasTicket && item.timeDiffMinutes !== null && item.timeDiffMinutes !== undefined && (
                        <div className="shrink-0">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                            <Clock className="w-3 h-3 text-blue-600" />
                            {formatTimeDiff(item.timeDiffMinutes)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Participating agents banner */}
                    <div className="mt-2.5 flex items-center gap-2 flex-wrap text-xs bg-slate-50 p-2 rounded-xl">
                      {item.agents && item.agents.length > 0 ? (
                        <>
                          <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="font-semibold text-slate-700">
                            Atendentes ({item.agents.length}):
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.agents.map((ag, aIdx) => {
                              const isCloser = item.closerAgent && item.closerAgent === ag;
                              return (
                                <span
                                  key={aIdx}
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium border ${
                                    isCloser
                                      ? 'bg-blue-50 text-blue-800 border-blue-200 font-bold'
                                      : 'bg-white text-slate-700 border-slate-200'
                                  }`}
                                  title={isCloser ? 'Atendente que finalizou o contato' : undefined}
                                >
                                  {ag}
                                  {isCloser && (
                                    <span className="text-[10px] text-blue-700 bg-blue-100 px-1 py-0.2 rounded font-bold">
                                      Finalizador
                                    </span>
                                  )}
                                  {aIdx < (item.agents?.length || 0) - 1 && (
                                    <span className="text-slate-300">➔</span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <>
                          <Bot className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="font-medium text-slate-600">
                            {item.isAutomation
                              ? 'Atendimento Automatizado (Bot / URA Digital)'
                              : 'Atendente não informado'}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Ticket Details if correlated */}
                    {item.hasTicket ? (
                      <div className="mt-3 pt-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            OS / Protocolo RBX
                          </span>
                          <span className="font-bold font-mono text-slate-800 block truncate">
                            #{item.ticketNumber || '—'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono block truncate">
                            {item.ticketProtocol || 'Sem protocolo'}
                          </span>
                          <div className="mt-1">
                            {item.isTicketConcluded ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                Protocolo Encerrado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-2.5 h-2.5 text-amber-600" />
                                Protocolo Em Aberto
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Status & Tipo
                          </span>
                          <div className="mt-0.5">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadge(
                                formattedTicketStatus
                              )}`}
                            >
                              {formattedTicketStatus}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-700 font-semibold block truncate mt-1">
                            Tipo: {formattedTicketType}
                          </span>
                          {item.ticketConcludedAt && (
                            <span className="text-[10px] text-emerald-700 font-medium block truncate mt-0.5">
                              Fim: {formatDate(item.ticketConcludedAt)}
                            </span>
                          )}
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 sm:col-span-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Assunto / Causa
                          </span>
                          <span className="font-semibold text-slate-800 block truncate">
                            {item.ticketTopic || 'Sem assunto especificado'}
                          </span>
                          <span className="text-[11px] text-blue-700 block truncate font-medium">
                            Causa: {item.ticketCause || 'Sem causa vinculada'}
                          </span>
                          {item.ticketOpenedAt && (
                            <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                              Abertura OS: {formatDate(item.ticketOpenedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      // Rich Details for "Sem Chamado" in Flat View
                      <div className="mt-3 p-3.5 rounded-xl bg-slate-100/70 border border-slate-200 text-xs space-y-2.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 font-bold text-slate-700">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>Detalhes do Atendimento Resolvido no Omnichannel</span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-medium">
                            Tipo de Encerramento: <strong>{item.closureType || 'Encerramento manual'}</strong>
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                          <div className="p-2 rounded-lg bg-white border border-slate-200">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Métricas de Tempo
                            </span>
                            <span className="text-slate-700 font-medium block mt-0.5">
                              TMA: <strong>{formatSeconds(item.handleTimeSeconds)}</strong>
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              TME (Espera): {formatSeconds(item.waitTimeSeconds)}
                            </span>
                          </div>

                          <div className="p-2 rounded-lg bg-white border border-slate-200 sm:col-span-2">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Classificações & Motivos
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              {item.classification && item.classification.length > 0 ? (
                                item.classification.map((cls, cIdx) => (
                                  <span
                                    key={cIdx}
                                    className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                                  >
                                    {cls}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">
                                  Nenhuma classificação atribuída
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200/80 text-[11px] text-emerald-800 flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>
                            {item.isAutomation
                              ? 'Atendimento resolvido diretamente por fluxo de autoatendimento / bot sem necessidade de OS no RBX.'
                              : 'Atendimento solucionado diretamente no chat pelo suporte humano sem abertura de chamado no RBX (Resolução em Primeiro Contato - FCR).'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Sparkles className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-medium">Nenhum atendimento corresponde aos filtros selecionados.</p>
              </div>
            )
          )}
        </div>

        {/* Footer & Pagination */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>
              Página <strong className="text-slate-800">{currentPage}</strong> de{' '}
              <strong className="text-slate-800">{totalPages}</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span>
              Exibindo{' '}
              <strong className="text-slate-800">
                {viewMode === 'grouped' ? paginatedGroups.length : paginatedFlatList.length}
              </strong>{' '}
              de <strong className="text-slate-800">{totalItems}</strong> {viewMode === 'grouped' ? 'clientes' : 'atendimentos'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-medium transition cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-medium transition cursor-pointer flex items-center gap-1"
            >
              <span>Próxima</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="ml-2 px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-medium transition cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
