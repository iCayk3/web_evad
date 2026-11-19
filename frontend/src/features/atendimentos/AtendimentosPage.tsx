import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Filter,
  AlertTriangle,
  Clock,
  CheckCircle,
  RotateCw,
  X,
  Tag,
  ChevronDown,
  Sparkles,
  NotebookTabs,
  FileDown,
  CheckSquare,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import { AccessibleTable, Column } from '../../components/common/AccessibleTable.tsx';
import { AtendimentoDetailModal } from './AtendimentoDetailModal.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { Badge } from '../../components/common/Badge.tsx';
import { PillButton } from '../../components/common/PillButton.tsx';
import { DensityToggle, TableDensity } from '../../components/common/DensityToggle.tsx';
import { exportTicketsToPdf } from './exportPdf.ts';

interface AtendimentosPageProps {
  selectedTicketId?: number | null;
  onClearSelectedTicket?: () => void;
}

export const AtendimentosPage: React.FC<AtendimentosPageProps> = ({
  selectedTicketId,
  onClearSelectedTicket,
}) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [ticketType, setTicketType] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState('');
  const [slaFilter, setSlaFilter] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [availableTopics, setAvailableTopics] = useState<Array<{ name: string; count: number }>>([]);
  const [topicDropdownOpen, setTopicDropdownOpen] = useState(false);
  const [topicSearch, setTopicSearch] = useState('');
  const [hoveredTopic, setHoveredTopic] = useState<string | null>(null);
  const [activeTicketId, setActiveTicketId] = useState<number | null>(selectedTicketId || null);
  const [density, setDensity] = useState<TableDensity>('comfortable');
  const [selectedTicketIds, setSelectedTicketIds] = useState<(string | number)[]>([]);

  const handleExportPdf = (onlySelected = true) => {
    let ticketsToExport: any[] = [];
    if (onlySelected && selectedTicketIds.length > 0) {
      const selectedSet = new Set(selectedTicketIds);
      ticketsToExport = tickets.filter((t) => selectedSet.has(t.id));
    } else {
      ticketsToExport = tickets;
    }

    if (ticketsToExport.length === 0) {
      alert('Nenhum atendimento selecionado para exportação.');
      return;
    }

    exportTicketsToPdf({
      tickets: ticketsToExport,
      user,
      filters: {
        type: ticketType || undefined,
        search: search || undefined,
        status: statusFilter || undefined,
        slaFilter: slaFilter || undefined,
        topics: selectedTopics.length > 0 ? selectedTopics : undefined,
      },
    });
  };

  const handleClearSelection = () => {
    setSelectedTicketIds([]);
  };

  const handleSelectAllVisible = () => {
    setSelectedTicketIds(tickets.map((t) => t.id));
  };

  const toggleTopic = (topicName: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topicName) ? prev.filter((t) => t !== topicName) : [...prev, topicName]
    );
  };

  // Modal Novo Atendimento
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [meta, setMeta] = useState<any | null>(null);
  const [newForm, setNewForm] = useState({
    id_cliente: 101,
    nome_cliente: 'Supermercado Progresso Ltda',
    id_tecnico: 1,
    id_topico: 1,
    id_causa: 1,
    id_fluxo: 1,
    id_grupo_sla: 2,
    descricao: '',
  });

  useEffect(() => {
    if (selectedTicketId) {
      setActiveTicketId(selectedTicketId);
    }
  }, [selectedTicketId]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      let url = '/api/atendimentos?';
      const params = new URLSearchParams();
      if (ticketType) params.append('type', ticketType);
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (slaFilter) params.append('slaFilter', slaFilter);
      if (selectedTopics.length > 0) {
        params.append('topics', selectedTopics.join(','));
      }
      url += params.toString();

      const res = await apiFetch<{ tickets: any[]; availableTopics?: Array<{ name: string; count: number }> }>(url);
      setTickets(res.tickets || []);
      if (res.availableTopics && res.availableTopics.length > 0) {
        setAvailableTopics(res.availableTopics);
      }
    } catch (e) {
      console.error('Erro ao buscar atendimentos:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeta = async () => {
    try {
      const data = await apiFetch('/api/atendimentos/meta');
      setMeta(data);
    } catch (e) {
      console.error('Erro ao buscar metadados de atendimento:', e);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, slaFilter, selectedTopics, ticketType]);

  useEffect(() => {
    fetchMeta();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTickets();
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/atendimentos', {
        method: 'POST',
        body: JSON.stringify(newForm),
      });
      setNewModalOpen(false);
      setNewForm({
        id_cliente: 101,
        nome_cliente: 'Supermercado Progresso Ltda',
        id_tecnico: 1,
        id_topico: 1,
        id_causa: 1,
        id_fluxo: 1,
        id_grupo_sla: 2,
        descricao: '',
      });
      fetchTickets();
    } catch (err: any) {
      alert(err.message || 'Falha ao criar atendimento');
    }
  };

  const canCreate = ['admin', 'supervisor'].includes(user?.role || '');

  const columns: Column<any>[] = [
    {
      key: 'protocol',
      header: 'Protocolo',
      sortable: true,
      render: (item) => (
        <span className="font-mono font-bold text-brand-primary text-xs">
          {item.protocol}
        </span>
      ),
    },
    {
      key: 'clientName',
      header: 'Assinante',
      sortable: true,
      render: (item) => {
        const clientCode = item.clientId ? `#${item.clientId}` : (item.clientCode ? `#${item.clientCode}` : '—');
        const clientName = item.clientName && !item.clientName.startsWith('Cliente #')
          ? item.clientName
          : (item.nome || item.name || '—');

        return (
          <div>
            <div className="font-mono font-bold text-xs text-brand-primary">
              {clientCode}
            </div>
            <div className="text-xs font-semibold text-slate-800 leading-tight mt-0.5 truncate max-w-[240px]" title={clientName}>
              {clientName}
            </div>
          </div>
        );
      },
    },
    {
      key: 'topicName',
      header: 'Tópico / Causa',
      sortable: true,
      render: (item) => (
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-800 font-medium leading-tight">{item.topicName}</span>
            {item.type && (
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                  item.type === 'Comercial'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                    : item.type === 'Adm/Fin'
                    ? 'bg-purple-50 text-purple-700 border border-purple-200/60'
                    : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                }`}
              >
                {item.type}
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{item.causeName}</div>
        </div>
      ),
    },
    {
      key: 'technicianName',
      header: 'Técnico',
      sortable: true,
      render: (item) => (
        <span className="text-slate-700 font-medium">{item.technicianName}</span>
      ),
    },
    {
      key: 'status',
      header: 'Situação',
      sortable: true,
      render: (item) => {
        if (item.status === 'Aberto') return <Badge variant="primary">{item.status}</Badge>;
        if (item.status === 'Em Andamento') return <Badge variant="secondary">{item.status}</Badge>;
        if (item.status === 'Concluído') return <Badge variant="ok">{item.status}</Badge>;
        return <Badge variant="neutral">{item.status}</Badge>;
      },
    },
    {
      key: 'slaStatus',
      header: 'Condição SLA',
      sortable: true,
      render: (item) => {
        if (item.isOverdue) {
          return (
            <Badge variant="overdue" pulse>
              Vencido
            </Badge>
          );
        }
        if (item.isAtRisk) {
          return (
            <Badge variant="risk" pulse>
              Em Risco (&lt;60m)
            </Badge>
          );
        }
        if (item.status === 'Concluído') {
          return (
            <Badge variant="neutral">
              Finalizado
            </Badge>
          );
        }
        return (
          <Badge variant="ok">
            No Prazo
          </Badge>
        );
      },
    },
    {
      key: 'createdAt',
      header: 'Abertura',
      sortable: true,
      render: (item) => (
        <span className="text-[11px] text-slate-500 font-mono">{item.createdAt}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      render: (item) => (
        <button
          type="button"
          onClick={() => setActiveTicketId(item.id)}
          className="w-8 h-8 rounded-lg bg-slate-100/90 hover:bg-slate-200 text-slate-600 hover:text-brand-primary flex items-center justify-center transition-colors border border-slate-200/80 shadow-2xs"
          title="Ver detalhes do chamado"
          aria-label="Ver detalhes do chamado"
        >
          <NotebookTabs className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Topo da Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Fila Operacional de Atendimentos
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Acompanhamento, despacho e checklist com monitoramento de SLA em tempo real
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Alternador de Densidade Solicitado pelo Usuário */}
          <DensityToggle density={density} onChange={setDensity} />

          {/* Botão de Exportar para PDF */}
          <PillButton
            variant="outline"
            size="md"
            onClick={() => handleExportPdf(selectedTicketIds.length > 0)}
            disabled={tickets.length === 0}
            icon={FileDown}
            title={selectedTicketIds.length > 0 ? `Exportar ${selectedTicketIds.length} selecionado(s) para PDF` : 'Exportar atendimentos para PDF'}
          >
            {selectedTicketIds.length > 0 ? `Exportar PDF (${selectedTicketIds.length})` : 'Exportar PDF'}
          </PillButton>

          {canCreate && (
            <PillButton
              variant="primary"
              size="md"
              onClick={() => setNewModalOpen(true)}
              icon={Plus}
            >
              Novo Atendimento
            </PillButton>
          )}

          <PillButton
            variant="outline"
            shape="circle"
            size="md"
            onClick={fetchTickets}
            disabled={loading}
            title="Atualizar fila"
          >
            <RotateCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </PillButton>
        </div>
      </div>

      {/* Barra de Filtros e Busca em Formato Pílula */}
      <div className="bg-white border border-slate-100/90 rounded-2xl p-4 shadow-premium-card flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por protocolo, cliente ou termo..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/80 rounded-full focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
            />
          </div>
          <PillButton
            type="submit"
            variant="secondary"
            size="sm"
          >
            Buscar
          </PillButton>
        </form>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Seletor de Tipo / Setor de Atendimento em Pílula (idêntico ao Painel de Gestão) */}
          <div className="inline-flex bg-slate-100/80 p-1 rounded-full border border-slate-200/60 text-xs font-medium shadow-2xs">
            <button
              type="button"
              onClick={() => setTicketType('')}
              className={`px-3 py-1 rounded-full transition-all duration-150 ${
                ticketType === ''
                  ? 'bg-white text-brand-primary shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Todos os setores"
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setTicketType('Técnico')}
              className={`px-3 py-1 rounded-full transition-all duration-150 ${
                ticketType === 'Técnico'
                  ? 'bg-white text-brand-primary shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Técnico
            </button>
            <button
              type="button"
              onClick={() => setTicketType('Comercial')}
              className={`px-3 py-1 rounded-full transition-all duration-150 ${
                ticketType === 'Comercial'
                  ? 'bg-white text-brand-primary shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Comercial
            </button>
            <button
              type="button"
              onClick={() => setTicketType('Adm/Fin')}
              className={`px-3 py-1 rounded-full transition-all duration-150 ${
                ticketType === 'Adm/Fin'
                  ? 'bg-white text-brand-primary shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Adm/Fin
            </button>
          </div>

          {/* Filtro de Status em Pílula */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-1.5 px-3.5 border border-slate-200 rounded-full text-xs text-slate-700 bg-white shadow-2xs font-medium outline-none cursor-pointer"
          >
            <option value="">Todas as Situações</option>
            <option value="Aberto">Aberto</option>
            <option value="Em Andamento">Em Andamento</option>
            <option value="Pendente">Pendente</option>
            <option value="Concluído">Concluído</option>
          </select>

          {/* Filtro de SLA em Pílula */}
          <select
            value={slaFilter}
            onChange={(e) => setSlaFilter(e.target.value)}
            className="py-1.5 px-3.5 border border-slate-200 rounded-full text-xs text-slate-700 bg-white shadow-2xs font-medium outline-none cursor-pointer"
          >
            <option value="">Todos os SLAs</option>
            <option value="overdue">SLA Vencido</option>
            <option value="risk">SLA em Risco</option>
            <option value="ok">SLA no Prazo</option>
          </select>

          {/* Multi-seletor de Tópicos */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setTopicDropdownOpen(!topicDropdownOpen)}
              className={`flex items-center gap-1.5 py-1.5 px-3.5 rounded-full text-xs font-medium transition-colors border shadow-2xs ${
                selectedTopics.length > 0
                  ? 'bg-brand-primary-light border-blue-300 text-brand-primary font-bold'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Tag className="w-3.5 h-3.5 text-brand-primary" />
              <span>
                {selectedTopics.length === 0
                  ? 'Tópicos'
                  : `${selectedTopics.length} Tópico(s)`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {topicDropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 p-3 text-xs animate-in fade-in zoom-in-95 duration-150">
                <div className="p-1 mb-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                    Tipos de Chamado / Tópicos
                  </span>
                  {selectedTopics.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedTopics([])}
                      className="text-[11px] text-rose-600 hover:underline font-semibold"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={topicSearch}
                    onChange={(e) => setTopicSearch(e.target.value)}
                    placeholder="Filtrar tópicos..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-brand-primary outline-none"
                  />
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                  {availableTopics
                    .filter((t) =>
                      t.name.toLowerCase().includes(topicSearch.toLowerCase())
                    )
                    .map((t) => {
                      const isSelected = selectedTopics.includes(t.name);
                      return (
                        <label
                          key={t.name}
                          onMouseEnter={() => setHoveredTopic(t.name)}
                          onMouseLeave={() => setHoveredTopic(null)}
                          className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-xl cursor-pointer select-none transition-colors"
                          title={t.name}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTopic(t.name)}
                            className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary shrink-0"
                          />
                          <span className="flex-1 truncate text-slate-700 font-medium">
                            {t.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">
                            {t.count}
                          </span>
                        </label>
                      );
                    })}
                </div>

                <div className="pt-2.5 mt-2 border-t border-slate-100">
                  {hoveredTopic ? (
                    <div className="p-2.5 mb-2 bg-slate-900 text-white text-[11px] rounded-xl shadow-md border border-slate-700 animate-in fade-in duration-100 flex items-start gap-1.5 leading-snug">
                      <Tag className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <div className="flex-1 break-words font-medium">
                        {hoveredTopic}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 px-1 mb-2 italic">
                      Dica: passe o cursor sobre um item para ver o nome completo
                    </div>
                  )}

                  <div className="flex justify-end">
                    <PillButton
                      size="sm"
                      onClick={() => setTopicDropdownOpen(false)}
                    >
                      Pronto
                    </PillButton>
                  </div>
                </div>
              </div>
            )}
          </div>

          {(statusFilter || slaFilter || search || selectedTopics.length > 0 || ticketType) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('');
                setSlaFilter('');
                setSearch('');
                setSelectedTopics([]);
                setTicketType('');
              }}
              className="text-slate-500 hover:text-slate-700 underline text-xs ml-1 font-semibold"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Badges de Tópicos Selecionados */}
      {selectedTopics.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-blue-50/70 border border-blue-200/60 rounded-2xl">
          <span className="text-xs font-bold text-blue-950 mr-1 flex items-center gap-1">
            <Tag className="w-3.5 h-3.5 text-brand-primary" />
            Tópicos filtrados ({selectedTopics.length}):
          </span>
          {selectedTopics.map((top) => (
            <Badge key={top} variant="primary" className="bg-white">
              <span>{top}</span>
              <button
                type="button"
                onClick={() => toggleTopic(top)}
                className="hover:text-rose-600 ml-1 text-slate-400"
                title={`Remover ${top}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          <button
            type="button"
            onClick={() => setSelectedTopics([])}
            className="text-xs text-blue-700 hover:text-rose-600 underline ml-2 font-semibold"
          >
            Limpar todos
          </button>
        </div>
      )}

      {/* Barra Dinâmica de Ações para Atendimentos Selecionados */}
      {selectedTicketIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-800 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>
                  {selectedTicketIds.length}{' '}
                  {selectedTicketIds.length === 1
                    ? 'atendimento selecionado'
                    : 'atendimentos selecionados'}
                </span>
                <span className="text-slate-400 font-normal">
                  de {tickets.length} exibidos
                </span>
              </div>
              {selectedTicketIds.length < tickets.length && (
                <button
                  type="button"
                  onClick={handleSelectAllVisible}
                  className="text-[11px] text-blue-300 hover:text-white underline font-medium transition-colors"
                >
                  Selecionar todos os {tickets.length} chamados da lista
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <PillButton
              variant="primary"
              size="sm"
              onClick={() => handleExportPdf(true)}
              icon={FileDown}
            >
              Exportar para PDF ({selectedTicketIds.length})
            </PillButton>
            <button
              type="button"
              onClick={handleClearSelection}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors border border-slate-700/60 cursor-pointer"
            >
              Limpar Seleção
            </button>
          </div>
        </div>
      )}

      {/* Tabela Acessível da Fila com Suporte a Densidade e Seleção Múltipla */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 bg-white border border-slate-100 rounded-2xl shadow-premium-card">
          <div className="inline-block animate-spin w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full mr-2" />
          <span className="text-xs font-semibold">Carregando fila de atendimentos do RBXSoft...</span>
        </div>
      ) : (
        <AccessibleTable
          columns={columns}
          data={tickets}
          caption="Fila operacional de atendimentos técnicos do provedor"
          keyExtractor={(item) => item.id}
          density={density}
          selectable={true}
          selectedKeys={selectedTicketIds}
          onSelectionChange={setSelectedTicketIds}
          emptyMessage="Nenhum atendimento encontrado para os filtros selecionados."
        />
      )}

      {/* Modal de Detalhe do Atendimento */}
      <AtendimentoDetailModal
        ticketId={activeTicketId}
        onClose={() => {
          setActiveTicketId(null);
          if (onClearSelectedTicket) onClearSelectedTicket();
        }}
      />

      {/* Modal de Abertura de Novo Atendimento */}
      {newModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-signature border border-slate-100 overflow-hidden">
            <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Novo Atendimento Técnico</h2>
                <p className="text-xs text-slate-500 mt-0.5">Abertura vinculada ao RBXSoft com SLA de 4h</p>
              </div>
              <button
                type="button"
                onClick={() => setNewModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Cliente Associado</label>
                <select
                  value={newForm.id_cliente}
                  onChange={(e) => setNewForm({ ...newForm, id_cliente: Number(e.target.value) })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20"
                >
                  <option value={101}>Supermercado Progresso Ltda (101)</option>
                  <option value={102}>Eduardo Fontes de Miranda (102)</option>
                  <option value={103}>Clínica Odontológica Sorriso Fácil (103)</option>
                  <option value={104}>Beatriz Siqueira Campos (104)</option>
                  <option value={105}>Hospital Samaritano Zona Norte (105)</option>
                  <option value={106}>Juliana Marcondes Nogueira (106)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Tópico</label>
                  <select
                    value={newForm.id_topico}
                    onChange={(e) => setNewForm({ ...newForm, id_topico: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20"
                  >
                    {meta?.topicos?.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Causa Prevista</label>
                  <select
                    value={newForm.id_causa}
                    onChange={(e) => setNewForm({ ...newForm, id_causa: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20"
                  >
                    {meta?.causas?.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Técnico Responsável</label>
                  <select
                    value={newForm.id_tecnico}
                    onChange={(e) => setNewForm({ ...newForm, id_tecnico: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20"
                  >
                    {meta?.tecnicos?.map((tech: any) => (
                      <option key={tech.id} value={tech.id}>{tech.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Grupo de SLA</label>
                  <select
                    value={newForm.id_grupo_sla}
                    onChange={(e) => setNewForm({ ...newForm, id_grupo_sla: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20"
                  >
                    {meta?.gruposSla?.map((g: any) => (
                      <option key={g.id} value={g.id}>{g.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Descrição do Problema</label>
                <textarea
                  required
                  rows={3}
                  value={newForm.descricao}
                  onChange={(e) => setNewForm({ ...newForm, descricao: e.target.value })}
                  placeholder="Relato do cliente, sintomas observados e testes prévios realizados..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100">
                <PillButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNewModalOpen(false)}
                >
                  Cancelar
                </PillButton>
                <PillButton
                  type="submit"
                  variant="primary"
                  size="sm"
                >
                  Confirmar Abertura
                </PillButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
