import React, { useState, useEffect, useCallback } from 'react';
import { 
  MapPin, 
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  UserMinus,
  Search,
  FileText,
  Clock,
  Info,
  Wrench,
  Maximize2,
  X,
  Copy,
  Check,
  ExternalLink,
  LayoutGrid,
  Table,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { API_BASE } from '../config/api';
import type { 
  EmpresaIndicadoresResponse, 
  InstalacaoItem, 
  CanceladoItem, 
  InadimplenteItem 
} from '../types';

interface CompanyDashboardProps {
  onNavigateToRecuperados?: () => void;
  rbxStatus?: string;
  selectedMonth?: string;
  syncTrigger?: number;
}

export const CompanyDashboard: React.FC<CompanyDashboardProps> = ({
  selectedMonth: selectedMonthProp = '2026-10',
  syncTrigger = 0,
}) => {
  const selectedMonth = selectedMonthProp;
  const [indicadores, setIndicadores] = useState<EmpresaIndicadoresResponse | null>(null);
  const [instalacoes, setInstalacoes] = useState<InstalacaoItem[]>([]);
  const [cancelamentos, setCancelamentos] = useState<CanceladoItem[]>([]);
  const [inadimplentes, setInadimplentes] = useState<InadimplenteItem[]>([]);
  
  const [activeTab, setActiveTab] = useState<'instalacoes' | 'cancelamentos' | 'inadimplentes'>('instalacoes');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedOSModal, setSelectedOSModal] = useState<InstalacaoItem | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  // Por padrão agora inicia no modo tabela conforme solicitado pelo usuário
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const getMonthName = (m: string) => {
    const map: Record<string, string> = {
      '2026-01': 'Janeiro',
      '2026-02': 'Fevereiro',
      '2026-03': 'Março',
      '2026-04': 'Abril',
      '2026-05': 'Maio',
      '2026-06': 'Junho',
      '2026-07': 'Julho',
      '2026-08': 'Agosto',
      '2026-09': 'Setembro',
      '2026-10': 'Outubro',
      '2026-11': 'Novembro',
      '2026-12': 'Dezembro',
      '2025-12': 'Dez/2025',
    };
    return map[m] || m;
  };

  // Resetar página ao alternar abas, busca, mês ou modo de visão
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, selectedMonth, viewMode]);

  const parseAssunto = (raw: string) => {
    if (!raw) return { main: 'Sem assunto informado.', metadata: '' };
    const idx = raw.indexOf('/#');
    if (idx !== -1) {
      const main = raw.substring(0, idx).trim();
      const metadata = raw.substring(idx).trim();
      return {
        main: main || 'Sem descrição inicial informada.',
        metadata
      };
    }
    return { main: raw.trim(), metadata: '' };
  };

  const copyToClipboard = (text: string, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  // Carrega dados salvos no banco de dados (evita consultas desnecessárias na API)
  const loadDatabaseData = useCallback(async (month: string) => {
    setLoading(true);
    try {
      // 1. Indicadores consolidados
      const resInd = await fetch(`${API_BASE}/api/empresa/indicadores?month=${month}`);
      if (resInd.ok) {
        const dataInd = await resInd.json();
        setIndicadores(dataInd);
      }

      // 2. Instalações
      const resInst = await fetch(`${API_BASE}/api/empresa/instalacoes?month=${month}`);
      if (resInst.ok) {
        const dataInst = await resInst.json();
        setInstalacoes(dataInst.instalacoes || []);
      }

      // 3. Cancelamentos Gerais
      const resCanc = await fetch(`${API_BASE}/api/empresa/cancelamentos?month=${month}`);
      if (resCanc.ok) {
        const dataCanc = await resCanc.json();
        setCancelamentos(dataCanc.cancelamentos || []);
      }

      // 4. Inadimplentes (Bloqueados e Suspensos)
      const resInad = await fetch(`${API_BASE}/api/empresa/inadimplentes?month=${month}`);
      if (resInad.ok) {
        const dataInad = await resInad.json();
        setInadimplentes(dataInad.inadimplentes || []);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do banco de dados:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDatabaseData(selectedMonth);
  }, [selectedMonth, loadDatabaseData, syncTrigger]);

  // Filtros de busca na tabela ativa
  const filteredInstalacoes = instalacoes.filter((i) => {
    const term = searchTerm.toLowerCase();
    return (
      i.numero.toLowerCase().includes(term) ||
      i.protocolo.toLowerCase().includes(term) ||
      i.codigoCliente.toLowerCase().includes(term) ||
      (i.contrato && i.contrato.toLowerCase().includes(term)) ||
      i.nomeCliente.toLowerCase().includes(term) ||
      i.topico.toLowerCase().includes(term) ||
      i.causa.toLowerCase().includes(term) ||
      (i.assunto && i.assunto.toLowerCase().includes(term)) ||
      (i.solucao && i.solucao.toLowerCase().includes(term)) ||
      (i.cidade && i.cidade.toLowerCase().includes(term)) ||
      (i.bairro && i.bairro.toLowerCase().includes(term))
    );
  });

  const filteredCancelamentos = cancelamentos.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.numeroContrato.toLowerCase().includes(term) ||
      c.codigoCliente.toLowerCase().includes(term) ||
      c.nomeCliente.toLowerCase().includes(term) ||
      c.motivoCancelamento.toLowerCase().includes(term) ||
      c.plano.toLowerCase().includes(term) ||
      c.cidade.toLowerCase().includes(term)
    );
  });

  const filteredInadimplentes = inadimplentes.filter((inad) => {
    const term = searchTerm.toLowerCase();
    return (
      inad.contrato.toLowerCase().includes(term) ||
      inad.codigoRbx.toLowerCase().includes(term) ||
      inad.nome.toLowerCase().includes(term) ||
      inad.cidade.toLowerCase().includes(term) ||
      inad.statusDesfecho.toLowerCase().includes(term)
    );
  });

  // Paginação para Instalações
  const totalInstalacoes = filteredInstalacoes.length;
  const totalPagesInstalacoes = Math.ceil(totalInstalacoes / itemsPerPage) || 1;
  const validPageInstalacoes = Math.min(Math.max(currentPage, 1), totalPagesInstalacoes);
  const startIdxInst = (validPageInstalacoes - 1) * itemsPerPage;
  const endIdxInst = Math.min(startIdxInst + itemsPerPage, totalInstalacoes);
  const paginatedInstalacoes = filteredInstalacoes.slice(startIdxInst, endIdxInst);

  // Paginação para Cancelamentos
  const totalCancelamentos = filteredCancelamentos.length;
  const totalPagesCancelamentos = Math.ceil(totalCancelamentos / itemsPerPage) || 1;
  const validPageCancelamentos = Math.min(Math.max(currentPage, 1), totalPagesCancelamentos);
  const startIdxCanc = (validPageCancelamentos - 1) * itemsPerPage;
  const endIdxCanc = Math.min(startIdxCanc + itemsPerPage, totalCancelamentos);
  const paginatedCancelamentos = filteredCancelamentos.slice(startIdxCanc, endIdxCanc);

  // Paginação para Inadimplentes
  const totalInadimplentes = filteredInadimplentes.length;
  const totalPagesInadimplentes = Math.ceil(totalInadimplentes / itemsPerPage) || 1;
  const validPageInadimplentes = Math.min(Math.max(currentPage, 1), totalPagesInadimplentes);
  const startIdxInad = (validPageInadimplentes - 1) * itemsPerPage;
  const endIdxInad = Math.min(startIdxInad + itemsPerPage, totalInadimplentes);
  const paginatedInadimplentes = filteredInadimplentes.slice(startIdxInad, endIdxInad);

  const renderPagination = (
    total: number,
    current: number,
    totalPages: number,
    start: number,
    end: number,
    label: string
  ) => {
    if (total === 0) return null;

    const getPageNumbers = () => {
      const delta = 2;
      const range: (number | string)[] = [];
      const left = current - delta;
      const right = current + delta;

      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= left && i <= right)) {
          range.push(i);
        } else if (range[range.length - 1] !== '...') {
          range.push('...');
        }
      }
      return range;
    };

    return (
      <div className="px-4 py-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs rounded-b-xl">
        <div className="flex items-center gap-3 text-slate-500">
          <span>
            Mostrando <strong className="text-slate-800">{total > 0 ? start + 1 : 0}</strong> a{' '}
            <strong className="text-slate-800">{end}</strong> de{' '}
            <strong className="text-slate-800">{total}</strong> {label}
          </span>

          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-slate-400">Por página:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-slate-400 cursor-pointer font-medium"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={current <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="px-2.5 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer font-medium"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Anterior</span>
          </button>

          <div className="hidden sm:flex items-center gap-1 px-1">
            {getPageNumbers().map((p, idx) => (
              typeof p === 'number' ? (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  className={`w-7 h-7 rounded text-xs font-semibold transition cursor-pointer ${
                    current === p
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-200'
                  }`}
                >
                  {p}
                </button>
              ) : (
                <span key={idx} className="px-1 text-slate-400">...</span>
              )
            ))}
          </div>

          <button
            type="button"
            disabled={current >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="px-2.5 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer font-medium"
          >
            <span>Próximo</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const totalCanceladoMrr = cancelamentos.reduce((acc, c) => acc + (c.valorMensalidade || 0), 0);

  const taxaSucessoInstalacao = indicadores && indicadores.totalInstalacoes > 0
    ? ((indicadores.instalacoesSucesso / indicadores.totalInstalacoes) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* 1. Banner de Orientação para Ajuste de Regras pelo Usuário */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-50 text-blue-700 rounded-lg shrink-0 mt-0.5">
                <Info className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-slate-800">
                  Base Operacional ({getMonthName(selectedMonth)}) — Validação dos Tópicos e Causas
                </p>
                <p className="text-slate-500 mt-0.5 leading-relaxed">
                  Os dados abaixo foram consultados diretamente na API do RBX e salvos no PostgreSQL para evitar tráfego excessivo. 
                  Consulte as tabelas detalhadas abaixo para conferir os tópicos e causas encontrados e nos indicar regras ou exceções de fluxos.
                </p>
              </div>
            </div>

            {indicadores?.atualizadoEm && (
              <div className="text-[11px] text-slate-400 shrink-0 flex items-center gap-1.5 self-start md:self-auto">
                <Clock className="w-3.5 h-3.5" />
                <span>Última carga: {formatDate(indicadores.atualizadoEm)}</span>
              </div>
            )}
          </div>

          {/* 3. Cards KPIs Principais do Mês Selecionado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Instalações */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Instalações ({getMonthName(selectedMonth)})
                  </span>
                  <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                    <UserPlus className="w-4 h-4" />
                  </div>
                </div>

                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900 tracking-tight">
                    {loading ? '...' : (indicadores?.totalInstalacoes || instalacoes.length)}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    chamados
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-600">
                  Sucesso: <strong className="text-emerald-700">{indicadores?.instalacoesSucesso || 0}</strong>
                </span>
                <span className="font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px]">
                  {taxaSucessoInstalacao}% Efetividade
                </span>
              </div>
            </div>

            {/* Card 2: Cancelamentos Gerais */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Cancelamentos ({getMonthName(selectedMonth)})
                  </span>
                  <div className="p-2 bg-rose-50 text-rose-700 rounded-lg">
                    <UserMinus className="w-4 h-4" />
                  </div>
                </div>

                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900 tracking-tight">
                    {loading ? '...' : (indicadores?.totalCancelamentos || cancelamentos.length)}
                  </span>
                  <span className="text-xs font-semibold text-rose-600">
                    rescisões totais
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-600 truncate">
                  MRR Perdido: <strong className="text-rose-700">{formatCurrency(totalCanceladoMrr)}</strong>
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  Base ampla
                </span>
              </div>
            </div>

            {/* Card 3: Saldo Líquido do Mês (Instalação - Cancelados - Suspensos) */}
            {(() => {
              const saldo = (indicadores?.instalacoesSucesso || 0) - (indicadores?.totalCancelamentos || 0) - (indicadores?.totalSuspensos || 0);
              const isPos = saldo >= 0;
              return (
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Saldo Líquido ({getMonthName(selectedMonth)})
                      </span>
                      <div className={`p-2 rounded-lg ${isPos ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {isPos ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-baseline gap-2">
                      <span className={`text-2xl font-black tracking-tight ${isPos ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {loading ? '...' : `${isPos ? '+' : ''}${saldo}`}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {isPos ? 'adições líquidas' : 'retração líquida'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-600 text-[11px]">
                      Instalados − Canc. − Suspensos
                    </span>
                    <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                      isPos ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}>
                      {isPos ? 'Crescimento Líquido' : 'Retração Líquida'}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Card 4: Contratos Suspensos (Banco de Dados PostgreSQL) */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Ainda Suspensos
                  </span>
                  <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>

                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-amber-900 tracking-tight">
                    {loading ? '...' : (indicadores?.totalSuspensos || 0).toLocaleString('pt-BR')}
                  </span>
                  {indicadores?.percentualSuspensos !== undefined && indicadores.percentualSuspensos > 0 ? (
                    <span className="text-xs font-semibold text-amber-700">
                      ({indicadores.percentualSuspensos.toFixed(1)}%)
                    </span>
                  ) : null}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  {indicadores?.mrrSuspensos && indicadores.mrrSuspensos > 0
                    ? `${indicadores.mrrSuspensos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} inadimplentes`
                    : 'Coorte de suspensão'}
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 truncate text-[11px]">
                  Competência {getMonthName(selectedMonth)}
                </span>
                <span className="font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full text-[10px]">
                  Banco PostgreSQL
                </span>
              </div>
            </div>
          </div>

      {/* 4. Abas Analíticas e Auditoria das Tabelas no Banco */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* Barra de Navegação das Abas */}
        <div className="border-b border-slate-200 px-5 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex space-x-2 sm:space-x-4 text-xs overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('instalacoes')}
              className={`pb-3 border-b-2 font-bold flex items-center space-x-2 transition cursor-pointer select-none shrink-0 ${
                activeTab === 'instalacoes'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Instalações / Chamados ({instalacoes.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('cancelamentos')}
              className={`pb-3 border-b-2 font-bold flex items-center space-x-2 transition cursor-pointer select-none shrink-0 ${
                activeTab === 'cancelamentos'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserMinus className="w-4 h-4" />
              <span>Cancelamentos Gerais RBX ({cancelamentos.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('inadimplentes')}
              className={`pb-3 border-b-2 font-bold flex items-center space-x-2 transition cursor-pointer select-none shrink-0 ${
                activeTab === 'inadimplentes'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Inadimplentes Bloqueados ({inadimplentes.length})</span>
            </button>
          </div>

          {/* Controles da Direita: Alternador de Visualização e Busca */}
          <div className="pb-3 flex flex-wrap items-center gap-2.5">
            {activeTab === 'instalacoes' && (
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'cards'
                      ? 'bg-white text-slate-800 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Visualização ampla em cards: Solução e Assunto 100% legíveis sem cortes"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Cards Operacionais</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white text-slate-800 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Visualização em tabela compacta"
                >
                  <Table className="w-3.5 h-3.5 text-blue-600" />
                  <span>Tabela</span>
                </button>
              </div>
            )}

            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por cliente, OS, drop, ONT, técnico..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-slate-400"
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ABA 1: INSTALAÇÕES (ATENDIMENTOS RBX)                                     */}
        {/* ========================================================================= */}
        {activeTab === 'instalacoes' && (
          <div>
            {filteredInstalacoes.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">Nenhum atendimento de instalação encontrado no banco.</p>
                <p>Clique em <strong>"Sincronizar RBX"</strong> acima para consultar a API e carregar os dados de Janeiro.</p>
              </div>
            ) : viewMode === 'cards' ? (
              /* =================================================================== */
              /* MODO CARDS OPERACIONAIS: 100% LEGÍVEL, SOLUÇÃO EM DESTAQUE, SEM CORTES */
              /* =================================================================== */
              <div className="space-y-4 p-1">
                {paginatedInstalacoes.map((item) => {
                  const parsedAssunto = parseAssunto(item.assunto);
                  return (
                    <div 
                      key={item.numero}
                      className="bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition overflow-hidden"
                    >
                      {/* Top Bar do Card da OS */}
                      <div className="bg-slate-50/90 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                        {/* Lado Esquerdo: Nº OS, Protocolo e Status */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setSelectedOSModal(item)}
                            className="font-mono font-bold text-sm text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1 cursor-pointer bg-blue-50/80 hover:bg-blue-100/70 px-2 py-0.5 rounded border border-blue-200 transition"
                            title="Clique para ver todos os dados desta OS no modal"
                          >
                            #{item.numero}
                            <ExternalLink className="w-3 h-3 text-blue-500" />
                          </button>
                          <span className="font-mono text-slate-500 text-[11px] select-all">
                            Prot: {item.protocolo}
                          </span>
                          {item.instaladoComSucesso ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Instalação Concluída com Sucesso
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              Outro Status
                            </span>
                          )}
                        </div>

                        {/* Lado Direito: Datas e Ação de Tela Cheia */}
                        <div className="flex items-center gap-4 text-slate-500 text-[11px]">
                          <div>
                            <span className="text-slate-400">Abertura: </span>
                            <span className="font-medium text-slate-700">{formatDate(item.dataAbertura)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Encerramento: </span>
                            <span className="font-medium text-slate-700">{formatDate(item.dataEncerramento)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedOSModal(item)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition cursor-pointer border border-transparent hover:border-blue-200"
                            title="Abrir em tela cheia"
                          >
                            <Maximize2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Faixa Intermediária: Cliente, Contrato, Localidade e Tópico */}
                      <div className="px-4 py-2.5 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-bold text-slate-800 text-sm">
                            {item.nomeCliente || `Cliente #${item.codigoCliente}`}
                          </span>
                          {item.contrato && (
                            <span className="bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded font-semibold border border-slate-200 text-[11px]">
                              Contrato: {item.contrato}
                            </span>
                          )}
                          <span className="text-slate-500 font-mono text-[11px]">
                            Cód: #{item.codigoCliente}
                          </span>
                          {(item.cidade || item.bairro) && (
                            <span className="flex items-center gap-1 text-slate-600 text-[11px]">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {item.cidade}{item.bairro ? ` • ${item.bairro}` : ''}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-slate-400">Fluxo:</span>
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200/70 rounded font-medium max-w-[220px] truncate" title={item.topico}>
                            {item.topico || 'Não informado'}
                          </span>
                          <span className="text-slate-300">/</span>
                          <span className="px-2 py-0.5 bg-slate-50 text-slate-700 border border-slate-200 rounded font-medium max-w-[220px] truncate" title={item.causa}>
                            {item.causa || 'Sem causa'}
                          </span>
                        </div>
                      </div>

                      {/* Grid Principal: Solução Técnica (100% LEGÍVEL) e Assunto da OS */}
                      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Bloco 1: SOLUÇÃO TÉCNICA (DESTAQUE MÁXIMO PARA LEITURA FÁCIL) */}
                        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
                          <div>
                            <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2 mb-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
                                  <Wrench className="w-3.5 h-3.5" />
                                </div>
                                <span className="font-bold text-xs text-emerald-950 uppercase tracking-wide">
                                  Solução do Técnico / Materiais / Baixa
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(item.solucao, `sol-${item.numero}`)}
                                className="text-[11px] text-emerald-700 hover:text-emerald-900 flex items-center gap-1 font-medium bg-white/90 px-2 py-1 rounded border border-emerald-200 hover:bg-white transition cursor-pointer"
                              >
                                {copiedField === `sol-${item.numero}` ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="text-emerald-700 font-semibold">Copiado!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copiar Solução</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="text-xs text-slate-900 whitespace-pre-wrap font-sans leading-relaxed select-text font-normal max-h-64 overflow-y-auto pr-1">
                              {item.solucao ? item.solucao : <span className="text-slate-400 italic">Sem solução registrada na OS.</span>}
                            </div>
                          </div>
                        </div>

                        {/* Bloco 2: ASSUNTO / DESCRIÇÃO DA OS */}
                        <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
                          <div>
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center shadow-2xs">
                                  <FileText className="w-3.5 h-3.5" />
                                </div>
                                <span className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                                  Assunto / Descrição da OS
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(item.assunto, `ass-${item.numero}`)}
                                className="text-[11px] text-blue-700 hover:text-blue-900 flex items-center gap-1 font-medium bg-white px-2 py-1 rounded border border-slate-200 hover:border-slate-300 transition cursor-pointer"
                              >
                                {copiedField === `ass-${item.numero}` ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="text-emerald-700 font-semibold">Copiado!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copiar Assunto</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed select-text font-normal max-h-64 overflow-y-auto pr-1">
                              {parsedAssunto.main}
                            </div>
                          </div>
                          {parsedAssunto.metadata && (
                            <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
                              <span>Possui dados cadastrais/técnicos RBX</span>
                              <button
                                type="button"
                                onClick={() => setSelectedOSModal(item)}
                                className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
                              >
                                Ver completo no modal →
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* =================================================================== */
              /* MODO TABELA LIMPA: ESTILO LISTA PADRONIZADO (SEM CAIXAS COM SCROLL)*/
              /* =================================================================== */
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4 w-32 whitespace-nowrap">Nº OS / Prot.</th>
                      <th className="py-3 px-4 min-w-[220px]">Código / Cliente</th>
                      <th className="py-3 px-4 w-36 whitespace-nowrap">Período</th>
                      <th className="py-3 px-4 min-w-[170px]">Classificação</th>
                      <th className="py-3 px-4 min-w-[280px]">Solução / Materiais</th>
                      <th className="py-3 px-4 min-w-[170px]">Cidade / Região</th>
                      <th className="py-3 px-3 w-24 text-center">Status</th>
                      <th className="py-3 px-3 w-14 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedInstalacoes.map((item) => {
                      const parsedAssunto = parseAssunto(item.assunto);
                      return (
                        <tr 
                          key={item.numero} 
                          className="hover:bg-slate-50/70 transition group cursor-pointer"
                          onClick={() => setSelectedOSModal(item)}
                        >
                          {/* 1. OS & Protocolo */}
                          <td className="py-3 px-4 align-top font-mono font-bold text-slate-900 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-blue-700 font-bold text-xs">
                              <span>#{item.numero}</span>
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition shrink-0" />
                            </div>
                            <div className="text-[10px] text-slate-400 font-normal mt-0.5 select-all">
                              Prot. {item.protocolo}
                            </div>
                          </td>

                          {/* 2. Cliente / Contrato */}
                          <td className="py-3 px-4 align-top">
                            <div className="font-semibold text-slate-800 text-xs leading-snug">
                              {item.nomeCliente || `Cliente #${item.codigoCliente}`}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                              <span>Cód. #{item.codigoCliente}</span>
                              {item.contrato && (
                                <span className="text-slate-600 font-semibold">
                                  • Contrato: {item.contrato}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 3. Período */}
                          <td className="py-3 px-4 align-top text-slate-600 whitespace-nowrap">
                            <div className="text-[11px] text-slate-700 font-medium">
                              {formatDate(item.dataAbertura)}
                            </div>
                            {item.dataEncerramento && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Fim: {formatDate(item.dataEncerramento)}
                              </div>
                            )}
                          </td>

                          {/* 4. Classificação RBX */}
                          <td className="py-3 px-4 align-top">
                            <span 
                              className="inline-block px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200/70 rounded text-[11px] font-medium max-w-[190px] truncate"
                              title={`${item.topico || 'Sem tópico'} / ${item.causa || 'Sem causa'}`}
                            >
                              {item.topico || 'Instalação'}
                            </span>
                            {item.causa && (
                              <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[190px]" title={item.causa}>
                                {item.causa}
                              </div>
                            )}
                          </td>

                          {/* 5. Solução / Materiais (TEXTO LIMPO EM LINHA - PADRÃO LISTA SEM SCROLLBAR) */}
                          <td className="py-3 px-4 align-top text-slate-700 text-xs">
                            <div 
                              className="line-clamp-2 max-w-sm text-slate-800 leading-relaxed font-sans" 
                              title={item.solucao || parsedAssunto.main || 'Sem solução registrada'}
                            >
                              {item.solucao ? item.solucao : (parsedAssunto.main || '-')}
                            </div>
                          </td>

                          {/* 6. Cidade / Região */}
                          <td className="py-3 px-4 align-top text-slate-600">
                            <div className="flex items-center gap-1.5 text-xs text-slate-700">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[170px]" title={`${item.cidade || 'Não informada'}${item.bairro ? ` • ${item.bairro}` : ''}`}>
                                {item.cidade || 'Não informada'}
                              </span>
                            </div>
                            {item.bairro && (
                              <div className="text-[10px] text-slate-400 pl-5 truncate max-w-[170px]">
                                {item.bairro}
                              </div>
                            )}
                          </td>

                          {/* 7. Status */}
                          <td className="py-3 px-3 align-top text-center whitespace-nowrap">
                            {item.instaladoComSucesso ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Sucesso
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                Outro
                              </span>
                            )}
                          </td>

                          {/* 8. Botão Detalhes */}
                          <td className="py-3 px-3 align-top text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setSelectedOSModal(item)}
                              className="p-1.5 rounded-md hover:bg-blue-50 text-slate-400 hover:text-blue-700 border border-transparent hover:border-blue-200 transition cursor-pointer"
                              title="Ver detalhes completos no modal"
                            >
                              <Maximize2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {renderPagination(totalInstalacoes, validPageInstalacoes, totalPagesInstalacoes, startIdxInst, endIdxInst, 'instalações')}
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 2: CANCELAMENTOS GERAIS (BASE TOTAL RBX)                              */}
        {/* ========================================================================= */}
        {activeTab === 'cancelamentos' && (
          <div className="overflow-x-auto">
            {filteredCancelamentos.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">Nenhum contrato cancelado encontrado no banco.</p>
                <p>Clique em <strong>"Sincronizar RBX"</strong> para carregar todos os cancelamentos gerais de Janeiro.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Contrato</th>
                    <th className="py-3 px-4">Código / Cliente</th>
                    <th className="py-3 px-4">Data Cancelamento</th>
                    <th className="py-3 px-4">Motivo no RBX</th>
                    <th className="py-3 px-4">Plano</th>
                    <th className="py-3 px-4">Mensalidade</th>
                    <th className="py-3 px-4">Cidade / Região</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedCancelamentos.map((item) => (
                    <tr key={item.numeroContrato} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 align-top font-mono font-bold text-slate-900">
                        #{item.numeroContrato}
                      </td>
                      <td className="py-3 px-4 align-top">
                        <div className="font-semibold text-slate-800">{item.nomeCliente || 'Nome não sincronizado'}</div>
                        <div className="text-[10px] text-slate-400">Cód. #{item.codigoCliente}</div>
                      </td>
                      <td className="py-3 px-4 align-top text-slate-600 whitespace-nowrap">
                        {formatDate(item.dataCancelamento)}
                      </td>
                      <td className="py-3 px-4 align-top">
                        <span className="inline-block px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200/70 rounded text-[11px] font-semibold max-w-xs truncate" title={item.motivoCancelamento}>
                          {item.motivoCancelamento || 'Não especificado'}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-top text-slate-700">
                        {item.plano || '-'}
                      </td>
                      <td className="py-3 px-4 align-top font-semibold text-slate-900">
                        {formatCurrency(item.valorMensalidade)}
                      </td>
                      <td className="py-3 px-4 align-top text-slate-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{item.cidade || 'Não informada'}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {renderPagination(totalCancelamentos, validPageCancelamentos, totalPagesCancelamentos, startIdxCanc, endIdxCanc, 'cancelamentos')}
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 3: INADIMPLENTES BLOQUEADOS                                           */}
        {/* ========================================================================= */}
        {activeTab === 'inadimplentes' && (
          <div className="overflow-x-auto">
            {filteredInadimplentes.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">Nenhum cliente inadimplente bloqueado nesta competência.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Contrato</th>
                    <th className="py-3 px-4">Código / Cliente</th>
                    <th className="py-3 px-4">Situação RBX</th>
                    <th className="py-3 px-4">Mensalidade</th>
                    <th className="py-3 px-4">Dias em Atraso</th>
                    <th className="py-3 px-4">Plano</th>
                    <th className="py-3 px-4">Cidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedInadimplentes.map((item) => (
                    <tr key={item.contrato} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 align-top font-mono font-bold text-slate-900">
                        #{item.contrato}
                      </td>
                      <td className="py-3 px-4 align-top">
                        <div className="font-semibold text-slate-800">{item.nome || `Cliente #${item.codigoRbx}`}</div>
                        <div className="text-[10px] text-slate-400">Cód. #{item.codigoRbx}</div>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          {item.statusRbxDescricao || 'Bloqueado'}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-top font-semibold text-slate-900">
                        {formatCurrency(item.valorMensalidade)}
                      </td>
                      <td className="py-3 px-4 align-top text-slate-600">
                        {item.diasVencido > 0 ? `${item.diasVencido} dias` : 'No prazo'}
                      </td>
                      <td className="py-3 px-4 align-top text-slate-700 truncate max-w-xs">
                        {item.plano || '-'}
                      </td>
                      <td className="py-3 px-4 align-top text-slate-600">
                        {item.cidade || 'Não informada'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {renderPagination(totalInadimplentes, validPageInadimplentes, totalPagesInadimplentes, startIdxInad, endIdxInad, 'inadimplentes')}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL DETALHES COMPLETOS DA OS (ASSUNTO & SOLUÇÃO EM TELA CHEIA)           */}
      {/* ========================================================================= */}
      {selectedOSModal && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedOSModal(null)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                  OS
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">Atendimento #{selectedOSModal.numero}</h3>
                    <span className="text-xs font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      Prot: {selectedOSModal.protocolo}
                    </span>
                    {selectedOSModal.instaladoComSucesso ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Instalado com Sucesso
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Abertura: {formatDate(selectedOSModal.dataAbertura)} • Encerramento: {formatDate(selectedOSModal.dataEncerramento)}
                    {selectedOSModal.usuarioAbertura ? ` • Usuário: ${selectedOSModal.usuarioAbertura}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOSModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
                title="Fechar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Info Bar Cliente */}
            <div className="px-6 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center gap-6 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] font-medium">Cliente</span>
                <span className="font-semibold text-slate-800 text-sm">
                  {selectedOSModal.nomeCliente || `Cliente #${selectedOSModal.codigoCliente}`}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-medium">Código RBX</span>
                <span className="font-mono text-slate-700 font-semibold">#{selectedOSModal.codigoCliente}</span>
              </div>
              {selectedOSModal.contrato && (
                <div>
                  <span className="text-slate-400 block text-[10px] font-medium">Contrato</span>
                  <span className="font-mono text-slate-700 font-semibold">{selectedOSModal.contrato}</span>
                </div>
              )}
              {(selectedOSModal.cidade || selectedOSModal.bairro) && (
                <div>
                  <span className="text-slate-400 block text-[10px] font-medium">Cidade / Bairro</span>
                  <span className="text-slate-700 font-medium">
                    {selectedOSModal.cidade}{selectedOSModal.bairro ? ` • ${selectedOSModal.bairro}` : ''}
                  </span>
                </div>
              )}
              <div>
                <span className="text-slate-400 block text-[10px] font-medium">Tópico / Causa RBX</span>
                <span className="text-slate-700 font-medium">{selectedOSModal.topico} — {selectedOSModal.causa}</span>
              </div>
            </div>

            {/* Conteúdo: Assunto e Solução */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
              {/* Card 1: Assunto */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-4 py-3 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-700" />
                    <span className="font-bold text-xs text-blue-900 uppercase tracking-wide">
                      Assunto / Descrição Completa do Chamado
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedOSModal.assunto, 'assunto')}
                    className="text-[11px] text-blue-700 hover:text-blue-900 flex items-center gap-1.5 font-medium cursor-pointer bg-white/80 px-2 py-1 rounded border border-blue-200 hover:bg-white transition"
                  >
                    {copiedField === 'assunto' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-semibold">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Assunto</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-4">
                  <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed select-text font-normal max-h-72 overflow-y-auto">
                    {selectedOSModal.assunto || 'Nenhum assunto informado.'}
                  </pre>
                </div>
              </div>

              {/* Card 2: Solução */}
              <div className="bg-white rounded-xl border border-emerald-200 shadow-xs overflow-hidden">
                <div className="px-4 py-3 bg-emerald-50/80 border-b border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-emerald-700" />
                    <span className="font-bold text-xs text-emerald-900 uppercase tracking-wide">
                      Solução do Técnico / Materiais / Baixa
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedOSModal.solucao, 'solucao')}
                    className="text-[11px] text-emerald-700 hover:text-emerald-900 flex items-center gap-1.5 font-medium cursor-pointer bg-white/80 px-2 py-1 rounded border border-emerald-200 hover:bg-white transition"
                  >
                    {copiedField === 'solucao' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-semibold">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Solução</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-4">
                  <pre className="text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed select-text font-normal max-h-72 overflow-y-auto">
                    {selectedOSModal.solucao || 'Nenhuma solução informada.'}
                  </pre>
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedOSModal(null)}
                className="px-5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
