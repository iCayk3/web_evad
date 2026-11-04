import React, { useState, useEffect, useCallback } from 'react';
import { 
  Radio, 
  RefreshCw, 
  Search, 
  Clock, 
  UserX, 
  Wifi, 
  Server, 
  ChevronLeft, 
  ChevronRight, 
  FileText,
  Activity,
  Zap,
  ArrowUpRight,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { API_BASE } from '../config/api';

interface AutenticacaoRow {
  id: string;
  codigoCliente: string;
  nomeCliente: string;
  numeroContrato: string;
  nas: string;
  porta: string;
  usuario: string;
  mac: string;
  observacao: string;
  ehCentralAssinante: boolean;
  dataAssinatura?: string;
  dataInicio?: string;
  situacaoCodigo: string;
  situacaoDescricao: string;
  dataUltimaOperacao?: string;
  criadoAteJaneiro2026: boolean;
  ativoEmJaneiro2026: boolean;
  origemUpgrade: boolean;
  contratoAnterior: string;
  situacaoEmJaneiro: string;
  grupoCliente?: string;
  ehGrupoExcluido?: boolean;
  sincronizadoEm?: string;
}

interface ResumoAutenticacoes {
  mesCompetencia?: string;
  totalAutenticacoes: number;
  centralAssinante: number;
  gruposExcluidos?: number;
  pppoeTotal: number;
  pppoeAteJan2026: number;
  pppoeAteMes?: number;
  baseConexoesGrafanaJan?: number;
  baseConexoesGrafanaMes?: number;
  contratosAtivos?: number;
  clientesUnicos?: number;
  grafanaDetalhamento?: {
    ativosContinuos: number;
    upgradesPosteriores: number;
    bloqueadosConectados: number;
  };
  statusJan: {
    ativos: number;
    bloqueados: number;
    suspensos: number;
    cancelados: number;
    outros: number;
  };
  sincronizadoEm?: string;
}

export const AutenticacoesDashboard: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState('2026-10');
  const [resumo, setResumo] = useState<ResumoAutenticacoes | null>(null);

  const getMonthShort = (m: string) => {
    switch (m) {
      case '2026-10': return 'Out/26';
      case '2026-09': return 'Set/26';
      case '2026-08': return 'Ago/26';
      case '2026-07': return 'Jul/26';
      case '2026-06': return 'Jun/26';
      case '2026-05': return 'Mai/26';
      case '2026-04': return 'Abr/26';
      case '2026-03': return 'Mar/26';
      case '2026-02': return 'Fev/26';
      default: return 'Jan/26';
    }
  };
  const [items, setItems] = useState<AutenticacaoRow[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [apenasPPPoE, setApenasPPPoE] = useState(true);
  const [apenasAtivosGrafana, setApenasAtivosGrafana] = useState(false);
  const [apenasJaneiro, setApenasJaneiro] = useState(false);
  const [apenasUpgrades, setApenasUpgrades] = useState(false);
  const [statusFilter, setStatusFilter] = useState('TODOS');

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  // Carregar Resumo (KPIs)
  const fetchResumo = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/rbx/autenticacoes/resumo?month=${selectedMonth}`);
      if (res.ok) {
        const data = await res.json();
        setResumo(data);
      }
    } catch (e) {
      console.error('Erro ao buscar resumo de autenticações:', e);
    }
  }, [selectedMonth]);

  // Carregar Listagem Paginada
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        month: selectedMonth,
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        apenas_pppoe: apenasPPPoE ? 'true' : 'false',
        apenas_janeiro: apenasJaneiro ? 'true' : 'false',
        apenas_ativos_jan: apenasAtivosGrafana ? 'true' : 'false',
        apenas_upgrades: apenasUpgrades ? 'true' : 'false',
      });
      if (search.trim()) params.append('q', search.trim());
      if (statusFilter !== 'TODOS') params.append('status', statusFilter);

      const res = await fetch(`${API_BASE}/api/rbx/autenticacoes?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setTotalItems(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (e) {
      console.error('Erro ao buscar listagem de autenticações:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, currentPage, itemsPerPage, apenasPPPoE, apenasJaneiro, apenasAtivosGrafana, apenasUpgrades, statusFilter, search]);

  useEffect(() => {
    fetchResumo();
  }, [fetchResumo]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Resetar página ao mudar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [search, apenasPPPoE, apenasJaneiro, apenasAtivosGrafana, apenasUpgrades, statusFilter, itemsPerPage]);

  // Sincronizar com RBX
  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/rbx/autenticacoes/sync?month=${selectedMonth}`, { method: 'POST' });
      if (res.ok) {
        setSyncMessage({ text: 'Base de autenticações e histórico sincronizados com sucesso!', type: 'success' });
        await fetchResumo();
        await fetchItems();
      } else {
        const err = await res.json();
        setSyncMessage({ text: err.error || 'Erro ao sincronizar com RBX', type: 'error' });
      }
    } catch (e) {
      setSyncMessage({ text: 'Falha na comunicação com o servidor.', type: 'error' });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('pt-BR');
    } catch {
      return '-';
    }
  };

  const getStatusBadge = (codigo: string, descricao: string) => {
    switch (codigo) {
      case 'A':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">Ativo</span>;
      case 'B':
      case 'P':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Bloqueado</span>;
      case 'S':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">Suspenso</span>;
      case 'C':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">Cancelado</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">{descricao || 'Outro'}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* 1. Cabeçalho Executivo */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Base & Autenticações de Clientes (RBX)
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Auditoria de credenciais PPPoE, Upgrades/Transferências e batimento com a base de 7.500 clientes do Grafana/Zabbix.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de Competência */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer text-slate-800 font-bold"
            >
              <option value="2026-10">Outubro / 2026</option>
              <option value="2026-09">Setembro / 2026</option>
              <option value="2026-08">Agosto / 2026</option>
              <option value="2026-07">Julho / 2026</option>
              <option value="2026-06">Junho / 2026</option>
              <option value="2026-05">Maio / 2026</option>
              <option value="2026-04">Abril / 2026</option>
              <option value="2026-03">Março / 2026</option>
              <option value="2026-02">Fevereiro / 2026</option>
              <option value="2026-01">Janeiro / 2026</option>
            </select>
          </div>

          {resumo?.sincronizadoEm && (
            <div className="text-right hidden sm:block">
              <div className="text-[10px] uppercase font-bold text-slate-400">Última Sincronização</div>
              <div className="text-xs font-semibold text-slate-700 font-mono">
                {new Date(resumo.sincronizadoEm).toLocaleString('pt-BR')}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{syncing ? 'Sincronizando RBX...' : 'Sincronizar com RBX'}</span>
          </button>
        </div>
      </div>

      {syncMessage && (
        <div className={`p-4 rounded-xl text-xs font-semibold border ${
          syncMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          {syncMessage.text}
        </div>
      )}

      {/* 2. Cards KPIs Analíticos (5 Colunas) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Bruto */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Total no RBX
            </span>
            <div className="p-1.5 bg-slate-100 text-slate-700 rounded-lg">
              <Server className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {resumo?.totalAutenticacoes?.toLocaleString('pt-BR') || '0'}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">cadastros</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500 truncate">
            Base completa de autenticações
          </div>
        </div>

        {/* Card 2: Central do Assinante e Grupos Excluídos */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Descartadas (Web/Testes)
            </span>
            <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
              <UserX className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {((resumo?.centralAssinante || 0) + (resumo?.gruposExcluidos || 0)).toLocaleString('pt-BR')}
            </span>
            <span className="text-[11px] text-amber-600 font-semibold">descartadas</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 leading-tight truncate">
            <span>{resumo?.centralAssinante?.toLocaleString('pt-BR') || 0} Web + {resumo?.gruposExcluidos || 0} Testes/Sol</span>
          </div>
        </div>

        {/* Card 3: Autenticações Reais PPPoE */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              PPPoE Assinantes
            </span>
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <Wifi className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {resumo?.pppoeTotal?.toLocaleString('pt-BR') || '0'}
            </span>
            <span className="text-[11px] text-emerald-700 font-semibold">clientes reais</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 truncate">
            Sem testes/cortesias internas
          </div>
        </div>

        {/* Card 4: ⭐ Base de Contratos Ativos (DESTAQUE) */}
        <div className="bg-white border-2 border-emerald-500/60 rounded-xl p-4 shadow-xs relative overflow-hidden bg-gradient-to-br from-emerald-50/40 via-white to-emerald-50/20 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
              <Zap className="w-3 h-3 text-emerald-600 fill-emerald-500" />
              Contratos Ativos ({getMonthShort(selectedMonth)})
            </span>
            <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-950 tracking-tight">
              {(resumo?.contratosAtivos || resumo?.baseConexoesGrafanaMes || 0).toLocaleString('pt-BR')}
            </span>
            <span className="text-[11px] text-emerald-700 font-bold">contratos</span>
          </div>
          <div className="mt-2 pt-2 border-t border-emerald-100 text-[10px] text-slate-600 leading-tight flex flex-col gap-0.5">
            <div className="flex justify-between">
              <span>Clientes únicos:</span>
              <strong className="text-slate-800">{resumo?.clientesUnicos?.toLocaleString('pt-BR') || 0}</strong>
            </div>
            <div className="flex justify-between">
              <span>Logins PPPoE:</span>
              <strong className="text-emerald-700">{resumo?.baseConexoesGrafanaMes?.toLocaleString('pt-BR') || 0}</strong>
            </div>
            <div className="mt-1 text-[9px] text-emerald-800 font-semibold truncate bg-emerald-100/60 px-1.5 py-0.5 rounded">
              Exclui suspensos, bloqueados e cancelados
            </div>
          </div>
        </div>

        {/* Card 5: Base com Contratos <= Mês */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
              Contratos ≤ {getMonthShort(selectedMonth)}
            </span>
            <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
              <Activity className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-indigo-950 tracking-tight">
              {(resumo?.pppoeAteMes || resumo?.pppoeAteJan2026 || 0).toLocaleString('pt-BR')}
            </span>
            <span className="text-[11px] text-indigo-600 font-semibold">contratos</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-600 flex justify-between">
            <span>Ativos: <strong className="text-emerald-700">{resumo?.statusJan?.ativos || 0}</strong></span>
            <span>Susp: <strong className="text-sky-700">{resumo?.statusJan?.suspensos || 0}</strong></span>
            <span>Canc: <strong className="text-rose-700">{resumo?.statusJan?.cancelados || 0}</strong></span>
          </div>
        </div>
      </div>

      {/* 3. Tabela de Auditoria e Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* Barra de Filtros */}
        <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por login PPPoE, cliente, contrato, MAC, NAS..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-slate-800 transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Toggle Base Grafana 7.5k */}
            <button
              type="button"
              onClick={() => {
                setApenasAtivosGrafana(!apenasAtivosGrafana);
                if (!apenasAtivosGrafana) {
                  setApenasJaneiro(false);
                  setApenasUpgrades(false);
                }
              }}
              className={`px-3 py-1.5 rounded-lg border font-bold transition flex items-center gap-1.5 cursor-pointer ${
                apenasAtivosGrafana
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                  : 'bg-white border-emerald-300 text-emerald-800 hover:bg-emerald-50'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{apenasAtivosGrafana ? '✓ Base Ativa Grafana (7.5k)' : 'Filtrar Base Grafana (7.5k)'}</span>
            </button>

            {/* Toggle Upgrades */}
            <button
              type="button"
              onClick={() => setApenasUpgrades(!apenasUpgrades)}
              className={`px-3 py-1.5 rounded-lg border font-bold transition flex items-center gap-1.5 cursor-pointer ${
                apenasUpgrades
                  ? 'bg-purple-600 border-purple-600 text-white shadow-xs'
                  : 'bg-white border-purple-200 text-purple-700 hover:bg-purple-50'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{apenasUpgrades ? '✓ Apenas Upgrades/Transferências' : 'Upgrades / Transferências'}</span>
            </button>

            {/* Toggle Contratos <= Jan/2026 */}
            <button
              type="button"
              onClick={() => {
                setApenasJaneiro(!apenasJaneiro);
                if (!apenasJaneiro) setApenasAtivosGrafana(false);
              }}
              className={`px-3 py-1.5 rounded-lg border font-bold transition flex items-center gap-1.5 cursor-pointer ${
                apenasJaneiro
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>{apenasJaneiro ? `Contratos ≤ ${getMonthShort(selectedMonth)}` : 'Todos Contratos'}</span>
            </button>

            {/* Toggle Central */}
            <button
              type="button"
              onClick={() => setApenasPPPoE(!apenasPPPoE)}
              className={`px-3 py-1.5 rounded-lg border font-bold transition flex items-center gap-1.5 cursor-pointer ${
                apenasPPPoE
                  ? 'bg-slate-100 border-slate-300 text-slate-800'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Wifi className="w-3.5 h-3.5 text-slate-600" />
              <span>{apenasPPPoE ? 'PPPoE (Sem Central)' : 'Com Central'}</span>
            </button>

            {/* Filtro por Situação */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white text-slate-700 cursor-pointer focus:outline-hidden"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="A">Ativo (A)</option>
              <option value="B">Bloqueado (B)</option>
              <option value="S">Suspenso (S)</option>
              <option value="C">Cancelado (C)</option>
            </select>
          </div>
        </div>

        {/* Tabela de Dados */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-500 space-y-2">
              <RefreshCw className="w-6 h-6 text-slate-400 animate-spin mx-auto" />
              <p>Carregando registros de autenticações...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500 space-y-2">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700">Nenhuma autenticação encontrada para os filtros selecionados.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Login / Usuário</th>
                  <th className="py-3 px-4">Contrato</th>
                  <th className="py-3 px-4">Cliente / Nome</th>
                  <th className="py-3 px-4">NAS / Concentrador</th>
                  <th className="py-3 px-4">Situação RBX</th>
                  <th className="py-3 px-4">Condição em {getMonthShort(selectedMonth)}</th>
                  <th className="py-3 px-4">Assinatura / Início</th>
                  <th className="py-3 px-4">MAC</th>
                  <th className="py-3 px-4">Observação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {items.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 align-top font-mono text-slate-500 font-semibold">
                      #{row.id}
                    </td>
                    <td className="py-3 px-4 align-top">
                      <div className="font-bold text-slate-900 font-mono text-[12px]">{row.usuario}</div>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {row.ehCentralAssinante && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold uppercase">
                            Central Assinante
                          </span>
                        )}
                        {row.ativoEmJaneiro2026 && (
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold uppercase flex items-center gap-0.5">
                            <Zap className="w-2.5 h-2.5" /> Grafana {getMonthShort(selectedMonth)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 align-top font-mono">
                      <div className="font-bold text-indigo-700">
                        {row.numeroContrato && row.numeroContrato !== '0' ? `#${row.numeroContrato}` : '-'}
                      </div>
                      {row.origemUpgrade && (
                        <div className="mt-0.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[9px] font-bold">
                          <ArrowUpRight className="w-2.5 h-2.5" />
                          <span>Upgrade {row.contratoAnterior ? `(ex: #${row.contratoAnterior})` : ''}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 align-top">
                      <div className="font-semibold text-slate-800">{row.nomeCliente || '-'}</div>
                      <div className="text-[10px] text-slate-400">Cód. #{row.codigoCliente}</div>
                    </td>
                    <td className="py-3 px-4 align-top text-slate-600">
                      <div className="font-mono text-[11px] font-semibold text-slate-700">{row.nas || '-'}</div>
                      <div className="text-[10px] text-slate-400">Porta: {row.porta || '-'}</div>
                    </td>
                    <td className="py-3 px-4 align-top">
                      {getStatusBadge(row.situacaoCodigo, row.situacaoDescricao)}
                    </td>
                    <td className="py-3 px-4 align-top">
                      {row.situacaoEmJaneiro ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          row.ativoEmJaneiro2026 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {row.situacaoEmJaneiro}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 align-top text-slate-600 font-mono text-[11px]">
                      {formatDate(row.dataAssinatura || row.dataInicio)}
                    </td>
                    <td className="py-3 px-4 align-top font-mono text-[11px] text-slate-500">
                      {row.mac || '-'}
                    </td>
                    <td className="py-3 px-4 align-top text-slate-500 max-w-xs truncate" title={row.observacao}>
                      {row.observacao || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginação */}
        {totalItems > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>Exibir</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>por página</span>
              <span className="text-slate-400 ml-2">|</span>
              <span className="text-slate-500 ml-2">
                Mostrando <strong>{((currentPage - 1) * itemsPerPage) + 1}</strong> a <strong>{Math.min(currentPage * itemsPerPage, totalItems)}</strong> de <strong>{totalItems.toLocaleString('pt-BR')}</strong> autenticações
              </span>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>

              <span className="px-3 py-1 font-bold text-slate-800">
                Página {currentPage} de {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
              >
                <span>Próximo</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
