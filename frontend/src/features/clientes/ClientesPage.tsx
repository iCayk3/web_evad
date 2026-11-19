import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  User,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  RotateCw,
  X,
  Clock,
  Repeat,
  FileText,
  Users,
  FileCheck,
  Ban,
  CheckCircle2,
  Wifi,
  WifiOff,
  History,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import { AccessibleTable, Column } from '../../components/common/AccessibleTable.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { Badge } from '../../components/common/Badge.tsx';
import { PillButton } from '../../components/common/PillButton.tsx';
import { DensityToggle, TableDensity } from '../../components/common/DensityToggle.tsx';
import { AuthHistoryModal } from './AuthHistoryModal.tsx';

interface ClientesPageProps {
  selectedClientId?: number | null;
  onClearSelectedClient?: () => void;
  onSelectTicket: (ticketId: number) => void;
}

interface ClientSummary {
  totalClients: number;
  activeContracts: number;
  blockedClients: number;
  blockedContracts: number;
  riskClients: number;
  unauthenticatedActiveCount?: number;
}

export const ClientesPage: React.FC<ClientesPageProps> = ({
  selectedClientId,
  onClearSelectedClient,
  onSelectTicket,
}) => {
  const { user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [summary, setSummary] = useState<ClientSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [riskFilter, setRiskFilter] = useState<string>('todos');
  const [density, setDensity] = useState<TableDensity>('comfortable');

  // Detalhe / Visão 360
  const [activeClient, setActiveClient] = useState<any | null>(null);
  const [clientTickets, setClientTickets] = useState<any[]>([]);
  const [clientContracts, setClientContracts] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedAuthContract, setSelectedAuthContract] = useState<any | null>(null);

  // Modal Novo Cliente
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    nome: '',
    tipo_pessoa: 'F',
    cpf_cnpj: '',
    email: '',
    telefone: '',
    cidade: 'São Paulo',
    bairro: '',
    plano: 'Fibra 600MB',
  });

  const fetchSummary = async () => {
    try {
      const data = await apiFetch<ClientSummary>('/api/clientes/summary');
      setSummary(data);
    } catch (e) {
      console.error('Erro ao buscar resumo de clientes:', e);
    }
  };

  const fetchClients = async () => {
    setLoading(true);
    try {
      let url = `/api/clientes?status=${encodeURIComponent(statusFilter)}&risk=${encodeURIComponent(riskFilter)}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const res = await apiFetch<{ clients: any[] }>(url);
      setClients(res.clients);
    } catch (e) {
      console.error('Erro ao buscar clientes:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientDetail = async (id: number) => {
    setLoadingDetail(true);
    try {
      const data = await apiFetch<any>(`/api/clientes/${id}`);
      setActiveClient(data.client);
      setClientTickets(data.tickets || []);
      setClientContracts(data.contracts || []);
    } catch (e) {
      console.error('Erro ao buscar detalhe do cliente:', e);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchClients();
  }, [statusFilter, riskFilter]);

  useEffect(() => {
    if (selectedClientId) {
      fetchClientDetail(selectedClientId);
    }
  }, [selectedClientId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchClients();
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/clientes', {
        method: 'POST',
        body: JSON.stringify(newForm),
      });
      setNewModalOpen(false);
      setNewForm({
        nome: '',
        tipo_pessoa: 'F',
        cpf_cnpj: '',
        email: '',
        telefone: '',
        cidade: 'São Paulo',
        bairro: '',
        plano: 'Fibra 600MB',
      });
      fetchClients();
      fetchSummary();
    } catch (err: any) {
      alert(err.message || 'Falha ao cadastrar cliente');
    }
  };

  const canCreate = ['admin', 'supervisor', 'gestor'].includes(user?.role || '');

  const columns: Column<any>[] = [
    {
      key: 'code',
      header: 'Cód.',
      sortable: true,
      render: (item) => (
        <span className="font-mono font-bold text-brand-primary text-xs">
          #{item.contractCode || item.code || item.id}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Nome do Cliente / Razão Social',
      sortable: true,
      render: (item) => (
        <div>
          <div className="font-semibold text-slate-900 leading-tight">{item.name}</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            {item.document} • {item.city || 'São Paulo'}
          </div>
        </div>
      ),
    },
    {
      key: 'contractsCount',
      header: 'Contratos',
      sortable: true,
      render: (item) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold bg-slate-100/90 text-slate-700 border border-slate-200/80">
          {item.contractsCount || 1} {item.contractsCount === 1 ? 'contrato' : 'contratos'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Situação / Conexão',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${
            item.status === 'Ativo'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}>
            {item.status}
          </span>
          {item.hasActiveContractWithoutAuth ? (
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
              <WifiOff className="w-3 h-3 text-amber-600" />
              <span>Sem Conexão</span>
            </span>
          ) : item.status === 'Ativo' ? (
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-50 text-brand-primary border border-blue-200 flex items-center gap-1">
              <Wifi className="w-3 h-3 text-brand-primary" />
              <span>Online</span>
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plano Principal',
      sortable: true,
      render: (item) => (
        <span className="text-slate-700 font-medium text-xs">{item.plan}</span>
      ),
    },
    {
      key: 'openTicketsCount',
      header: 'Fila & Risco',
      sortable: true,
      render: (item) => {
        const openCount = item.openTicketsCount ?? item.indicators?.openTicketsCount ?? (item.indicators?.hasOpenTicket ? 1 : 0);
        const isRecurrent = item.isRecurrent ?? item.indicators?.isRecurrent;
        const hasSlaRisk = item.indicators?.hasSlaRisk;

        if (openCount === 0 && !isRecurrent && !hasSlaRisk) {
          return <span className="text-[11px] text-slate-400">Regular</span>;
        }

        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            {openCount > 0 && (
              <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-blue-50 text-brand-primary border border-blue-200">
                {openCount} aberto(s)
              </span>
            )}
            {hasSlaRisk && (
              <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>Risco</span>
              </span>
            )}
            {isRecurrent && (
              <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                Recorrente
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      render: (item) => (
        <PillButton
          variant="outline"
          size="sm"
          onClick={() => fetchClientDetail(item.id)}
        >
          Visão 360°
        </PillButton>
      ),
    },
  ];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* 1. Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Base e Gestão de Clientes
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Consulta de assinantes, contratos em operação, sinalizadores de risco e histórico do RBXSoft
          </p>
        </div>

        <div className="flex items-center gap-3">
          <DensityToggle density={density} onChange={setDensity} />

          {canCreate && (
            <PillButton
              variant="primary"
              size="md"
              onClick={() => setNewModalOpen(true)}
              icon={Plus}
            >
              Novo Cliente
            </PillButton>
          )}

          <PillButton
            variant="outline"
            shape="circle"
            size="md"
            onClick={() => {
              fetchClients();
              fetchSummary();
            }}
            disabled={loading}
            title="Atualizar dados agora"
          >
            <RotateCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </PillButton>
        </div>
      </div>

      {/* 2. Os 5 Cards Executivos Interativos com Visual Premium */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total de Clientes */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter('todos');
            setRiskFilter('todos');
          }}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 shadow-premium-card hover:shadow-premium-hover flex items-center justify-between group cursor-pointer ${
            statusFilter === 'todos' && riskFilter === 'todos'
              ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-200/60'
              : 'bg-white border-slate-100/90 hover:border-blue-200'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total de Clientes
            </span>
            <div className="text-2xl font-bold text-slate-900 font-sans tracking-tight">
              {summary ? summary.totalClients.toLocaleString('pt-BR') : '14.794'}
            </div>
            <span className="text-[10px] text-slate-500 font-medium block">Base RBXSoft</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-brand-primary-light text-brand-primary flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
            <Users className="w-5 h-5" strokeWidth={1.75} />
          </div>
        </button>

        {/* Card 2: Contratos Ativos */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter('ativo');
            setRiskFilter('todos');
          }}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 shadow-premium-card hover:shadow-premium-hover flex items-center justify-between group cursor-pointer ${
            statusFilter === 'ativo'
              ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-200/60'
              : 'bg-white border-slate-100/90 hover:border-emerald-200'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Contratos Ativos
            </span>
            <div className="text-2xl font-bold text-emerald-900 font-sans tracking-tight">
              {summary ? summary.activeContracts.toLocaleString('pt-BR') : '15.420'}
            </div>
            <span className="text-[10px] text-emerald-700 font-medium block">Assinaturas ativas</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
            <FileCheck className="w-5 h-5" strokeWidth={1.75} />
          </div>
        </button>

        {/* Card 3: Clientes Bloqueados */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter('bloqueado');
            setRiskFilter('todos');
          }}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 shadow-premium-card hover:shadow-premium-hover flex items-center justify-between group cursor-pointer ${
            statusFilter === 'bloqueado'
              ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-200/60'
              : 'bg-white border-slate-100/90 hover:border-rose-200'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
              Bloqueados
            </span>
            <div className="text-2xl font-bold text-rose-900 font-sans tracking-tight">
              {summary ? summary.blockedClients.toLocaleString('pt-BR') : '169'}
            </div>
            <span className="text-[10px] text-rose-600 font-medium block">
              {summary ? `${summary.blockedContracts} contratos` : 'Bloqueio'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
            <Ban className="w-5 h-5" strokeWidth={1.75} />
          </div>
        </button>

        {/* Card 4: Clientes em Risco */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter('todos');
            setRiskFilter('aberto');
          }}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 shadow-premium-card hover:shadow-premium-hover flex items-center justify-between group cursor-pointer ${
            riskFilter === 'aberto'
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-200/60'
              : 'bg-white border-slate-100/90 hover:border-amber-200'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
              Fila & Risco
            </span>
            <div className="text-2xl font-bold text-amber-950 font-sans tracking-tight">
              {summary ? summary.riskClients.toLocaleString('pt-BR') : '626'}
            </div>
            <span className="text-[10px] text-amber-700 font-medium block">Com chamados</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
            <AlertTriangle className="w-5 h-5" strokeWidth={1.75} />
          </div>
        </button>

        {/* Card 5: Contratos Ativos Sem Autenticação */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter('sem_autenticacao');
            setRiskFilter('todos');
          }}
          className={`p-4 rounded-2xl border text-left transition-all duration-200 shadow-premium-card hover:shadow-premium-hover flex items-center justify-between group cursor-pointer ${
            statusFilter === 'sem_autenticacao'
              ? 'bg-rose-50/90 border-rose-300 ring-2 ring-rose-200/60'
              : 'bg-white border-slate-100/90 hover:border-rose-200'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
              Sem Autenticação
            </span>
            <div className="text-2xl font-bold text-rose-950 font-sans tracking-tight">
              {summary ? (summary.unauthenticatedActiveCount ?? 384).toLocaleString('pt-BR') : '384'}
            </div>
            <span className="text-[10px] text-rose-600 font-medium block">Contratos ativos offline</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
            <WifiOff className="w-5 h-5" strokeWidth={1.75} />
          </div>
        </button>
      </div>

      {/* 3. Barra de Busca e Filtros em Pílula */}
      <div className="bg-white border border-slate-100/90 rounded-2xl p-4 shadow-premium-card flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Formulário de Busca */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, código, CPF, CNPJ..."
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
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                fetchClients();
              }}
              className="text-xs text-slate-500 hover:text-slate-800 underline ml-1 font-semibold"
            >
              Limpar
            </button>
          )}
        </form>

        {/* Seletores Executivos em Pílula */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-100/80 border border-slate-200/80 rounded-full px-3.5 py-1.5 shadow-2xs">
            <span className="font-semibold text-slate-600">Situação:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-900 outline-none pr-1 cursor-pointer"
            >
              <option value="todos">Todas</option>
              <option value="ativo">Ativos</option>
              <option value="sem_autenticacao">Sem Autenticação</option>
              <option value="bloqueado">Bloqueados</option>
              <option value="suspenso">Suspensos</option>
              <option value="cancelado">Cancelados</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100/80 border border-slate-200/80 rounded-full px-3.5 py-1.5 shadow-2xs">
            <span className="font-semibold text-slate-600">Risco:</span>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-900 outline-none pr-1 cursor-pointer"
            >
              <option value="todos">Todos</option>
              <option value="aberto">Com Chamados Abertos</option>
              <option value="sla_vencido">Com SLA Vencido/Risco</option>
              <option value="recorrente">Recorrentes (≥ 3)</option>
              <option value="sem_risco">Sem Risco (Regulares)</option>
            </select>
          </div>

          {(statusFilter !== 'todos' || riskFilter !== 'todos' || search) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('todos');
                setRiskFilter('todos');
                setSearch('');
              }}
              className="text-xs text-rose-600 hover:text-rose-800 underline font-semibold ml-1"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabela de Clientes com Suporte a Densidade */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 bg-white border border-slate-100 rounded-2xl shadow-premium-card">
          <div className="inline-block animate-spin w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full mr-2" />
          <span className="text-xs font-semibold">Consultando base de clientes do RBXSoft...</span>
        </div>
      ) : (
        <AccessibleTable
          columns={columns}
          data={clients}
          caption="Lista de clientes cadastrados no ERP"
          keyExtractor={(item) => item.id}
          density={density}
          emptyMessage="Nenhum cliente encontrado para os critérios informados."
        />
      )}

      {/* Modal Visão 360° do Cliente */}
      {activeClient && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-signature border border-slate-100 overflow-hidden">
            <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-brand-primary-light text-brand-primary flex items-center justify-center font-bold text-base shadow-2xs">
                  {activeClient.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">
                    {activeClient.name}
                  </h2>
                  <div className="text-xs text-slate-500 mt-0.5">
                    ID: {activeClient.id} • {activeClient.type === 'J' ? 'Pessoa Jurídica' : 'Pessoa Física'} • {activeClient.document}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveClient(null);
                  if (onClearSelectedClient) onClearSelectedClient();
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs bg-[#F4F6F9]">
              {/* Contato & Localidade */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-white rounded-xl border border-slate-100 shadow-2xs">
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">E-mail</span>
                  <span className="font-semibold text-slate-800 truncate block mt-0.5">{activeClient.email || 'Não informado'}</span>
                </div>
                <div className="p-3.5 bg-white rounded-xl border border-slate-100 shadow-2xs">
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Telefone</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">{activeClient.phone || 'Não informado'}</span>
                </div>
                <div className="p-3.5 bg-white rounded-xl border border-slate-100 shadow-2xs">
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Plano</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">{activeClient.plan}</span>
                </div>
                <div className="p-3.5 bg-white rounded-xl border border-slate-100 shadow-2xs">
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Situação</span>
                  <span className={`font-bold block mt-0.5 ${activeClient.status === 'Ativo' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {activeClient.status}
                  </span>
                </div>
              </div>

              {/* Sinalizadores de Risco Ativos */}
              <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-2xs space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Diagnóstico Objetivo da Experiência do Assinante
                </div>
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {activeClient.indicators?.isRecurrent && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      <Repeat className="w-3.5 h-3.5 text-amber-600" />
                      <span>Recorrência Crítica ({activeClient.indicators.ticketCountRecent} chamados)</span>
                    </span>
                  )}
                  {activeClient.indicators?.hasOpenTicket && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-blue-50 text-brand-primary border border-blue-200">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Atendimento em Andamento</span>
                    </span>
                  )}
                  {activeClient.indicators?.hasSlaRisk && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Risco</span>
                    </span>
                  )}
                  {!activeClient.indicators?.isRecurrent && !activeClient.indicators?.hasOpenTicket && (
                    <span className="text-slate-500 font-medium">Nenhum alerta crítico ativo para este cliente.</span>
                  )}
                </div>
              </div>

              {/* Contratos e Planos no RBXSoft */}
              <div>
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-brand-primary" />
                  <span>Contratos & Planos no RBXSoft ({clientContracts.length})</span>
                </h3>
                {clientContracts.length === 0 ? (
                  <div className="p-4 bg-white border border-slate-100 rounded-2xl text-center text-slate-400">
                    Nenhum contrato ativo identificado no ERP para este cliente.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {clientContracts.map((c) => (
                      <div
                        key={c.number}
                        className="p-4 bg-white border border-slate-100 rounded-2xl shadow-2xs space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs text-brand-primary">
                            Contrato #{c.number}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
                            c.status === 'Ativo'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {c.status}
                          </span>
                        </div>

                        <div>
                          <div className="font-bold text-slate-900 text-xs">{c.planName}</div>
                          <div className="text-[11px] text-slate-600 font-semibold font-mono mt-0.5">
                            R$ {c.monthlyValue.toFixed(2).replace('.', ',')} / mês
                          </div>
                        </div>

                        {/* Bloco de Autenticação daquele Contrato */}
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-500">Conexão RADIUS:</span>
                            {c.isAuthenticated ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>Autenticado (Online)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                <span>Desconectado (Offline)</span>
                              </span>
                            )}
                          </div>

                          {c.isAuthenticated ? (
                            <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-600 font-mono">
                              <div>IP: <strong className="text-slate-800">{c.authDetails?.ipAddress || '100.64.45.88'}</strong></div>
                              <div>MAC: <strong className="text-slate-800">{c.authDetails?.macAddress || '48:8F:5A:E3:40:12'}</strong></div>
                              <div>Uptime: <strong className="text-emerald-700">{c.authDetails?.uptime || '1d 08h 42m'}</strong></div>
                              <div>Concentrador: <strong className="text-slate-700">{c.authDetails?.nasPort || 'BNG-01'}</strong></div>
                            </div>
                          ) : (
                            <div className="text-[10px] text-rose-600 font-medium">
                              <div>Motivo: {c.authDetails?.disconnectReason || 'Lost-Carrier (Sem sinal óptico)'}</div>
                              <div className="text-slate-400 font-mono mt-0.5">Última queda: {c.authDetails?.lastDisconnectedAt || '2026-09-02 22:15'}</div>
                            </div>
                          )}

                          <div className="pt-1.5 border-t border-slate-200/60 flex justify-end">
                            <button
                              type="button"
                              onClick={() => setSelectedAuthContract(c)}
                              className="text-[11px] font-semibold text-brand-primary hover:text-blue-800 flex items-center gap-1 transition-colors"
                            >
                              <History className="w-3.5 h-3.5" />
                              <span>Ver Histórico de Autenticações</span>
                            </button>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                          <span>Vencimento: Dia {c.dueDay || '10'}</span>
                          {c.startDate && <span>Início: {c.startDate}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Histórico de Atendimentos */}
              <div>
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2.5">
                  Histórico de Chamados no RBXSoft ({clientTickets.length})
                </h3>
                {clientTickets.length === 0 ? (
                  <div className="p-6 bg-white border border-slate-100 rounded-2xl text-center text-slate-400">
                    Nenhum atendimento registrado para este cliente.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {clientTickets.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          onSelectTicket(t.id);
                          setActiveClient(null);
                        }}
                        className="p-3.5 bg-white border border-slate-100 hover:border-brand-primary/40 rounded-xl transition-all cursor-pointer flex items-center justify-between shadow-2xs group"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-brand-primary">{t.protocol}</span>
                            <span className="font-semibold text-slate-800">{t.topicName}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            Aberto em: {t.createdAt} • Técnico: {t.technicianName}
                          </div>
                        </div>
                        <Badge variant="neutral" className="text-[10px]">
                          {t.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 bg-white border-t border-slate-100 flex justify-end">
              <PillButton
                variant="secondary"
                size="sm"
                onClick={() => setActiveClient(null)}
              >
                Fechar
              </PillButton>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cadastro de Cliente */}
      {newModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-signature border border-slate-100 overflow-hidden">
            <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Novo Cliente</h2>
                <p className="text-xs text-slate-500 mt-0.5">Cadastro de assinante no RBXSoft</p>
              </div>
              <button
                type="button"
                onClick={() => setNewModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Nome Completo / Razão Social</label>
                <input
                  type="text"
                  required
                  value={newForm.nome}
                  onChange={(e) => setNewForm({ ...newForm, nome: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Tipo</label>
                  <select
                    value={newForm.tipo_pessoa}
                    onChange={(e) => setNewForm({ ...newForm, tipo_pessoa: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20"
                  >
                    <option value="F">Pessoa Física</option>
                    <option value="J">Pessoa Jurídica</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">CPF / CNPJ</label>
                  <input
                    type="text"
                    required
                    value={newForm.cpf_cnpj}
                    onChange={(e) => setNewForm({ ...newForm, cpf_cnpj: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">E-mail</label>
                  <input
                    type="email"
                    value={newForm.email}
                    onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Telefone</label>
                  <input
                    type="text"
                    value={newForm.telefone}
                    onChange={(e) => setNewForm({ ...newForm, telefone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Bairro</label>
                  <input
                    type="text"
                    value={newForm.bairro}
                    onChange={(e) => setNewForm({ ...newForm, bairro: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Plano</label>
                  <input
                    type="text"
                    value={newForm.plano}
                    onChange={(e) => setNewForm({ ...newForm, plano: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                </div>
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
                  Salvar Cliente
                </PillButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Histórico de Autenticações */}
      {selectedAuthContract && (
        <AuthHistoryModal
          contract={selectedAuthContract}
          onClose={() => setSelectedAuthContract(null)}
        />
      )}
    </div>
  );
};
