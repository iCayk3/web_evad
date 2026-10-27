import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PackageCheck,
  PackageX,
  RotateCcw,
  Clock,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  MapPin,
  HardDrive,
  FileText,
  Calendar,
  Layers,
  Building2,
} from 'lucide-react';
import { API_BASE } from '../config/api';
import type { EquipamentoResponse } from '../types';

export const EquipmentRecoveryDashboard: React.FC = () => {
  const [data, setData] = useState<EquipamentoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('2026-01');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [cityFilter, setCityFilter] = useState<string>('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const fetchData = useCallback(async (month: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/equipamentos/retiradas?month=${month}`);
      if (res.ok) {
        const json: EquipamentoResponse = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Erro ao carregar atendimentos de equipamentos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(selectedMonth);
  }, [selectedMonth, fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/equipamentos/sync`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setSyncMessage({ text: json.message || 'Sincronização concluída!', isError: false });
        await fetchData(selectedMonth);
      } else {
        setSyncMessage({ text: json.error || 'Erro ao sincronizar', isError: true });
      }
    } catch (err: any) {
      setSyncMessage({ text: `Falha na requisição: ${err.message}`, isError: true });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 6000);
    }
  };

  const citiesList = useMemo(() => {
    if (!data?.orders) return [];
    const set = new Set<string>();
    data.orders.forEach((o) => {
      if (o.cidade && o.cidade !== 'Não Informado') set.add(o.cidade);
    });
    return Array.from(set).sort();
  }, [data?.orders]);

  const filteredOrders = useMemo(() => {
    if (!data?.orders) return [];
    return data.orders.filter((order) => {
      // Status Filter
      if (statusFilter !== 'todos' && order.statusRecuperacao !== statusFilter) {
        return false;
      }
      // City Filter
      if (cityFilter !== 'todas' && order.cidade !== cityFilter) {
        return false;
      }
      // Search Term
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchName = order.nomeCliente.toLowerCase().includes(term);
        const matchCode = order.codigoCliente.toLowerCase().includes(term);
        const matchProtocol = order.protocolo.toLowerCase().includes(term);
        const matchId = order.id.toLowerCase().includes(term);
        const matchEquip = order.equipamentoIdentificado.toLowerCase().includes(term);
        const matchSerial = order.serialMac.toLowerCase().includes(term);
        const matchCity = order.cidade.toLowerCase().includes(term);
        const matchBairro = order.bairro.toLowerCase().includes(term);
        const matchSolution = order.solucao.toLowerCase().includes(term);
        if (
          !matchName &&
          !matchCode &&
          !matchProtocol &&
          !matchId &&
          !matchEquip &&
          !matchSerial &&
          !matchCity &&
          !matchBairro &&
          !matchSolution
        ) {
          return false;
        }
      }
      return true;
    });
  }, [data?.orders, statusFilter, cityFilter, searchTerm]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'recuperado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Recuperado
          </span>
        );
      case 'pendente':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <PackageX className="w-3.5 h-3.5 text-rose-600" />
            Não Recuperado / Pendente
          </span>
        );
      case 'em_andamento':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Em Andamento
          </span>
        );
      case 'cancelamento_abortado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
            Desistiu / Retido
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const summary = data?.summary || {
    totalOrders: 0,
    recuperados: 0,
    pendentes: 0,
    emAndamento: 0,
    cancelamentoAbortado: 0,
    taxaRecuperacao: 0,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner / Controls */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Recuperação de Equipamentos
                <span className="text-[11px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  Gestão de Hardware
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Auditoria de ordens de serviço de retirada, verificação de ONT/Roteador em comodato e motivos de insucesso
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de Mês */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Mês:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent font-bold text-slate-900 border-none outline-none cursor-pointer pr-1"
            >
              {data?.availableMonths && data.availableMonths.length > 0 ? (
                data.availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m === '2026-01' ? 'Janeiro / 2026 (Base Teste)' : m}
                  </option>
                ))
              ) : (
                <option value="2026-01">Janeiro / 2026 (Base Teste)</option>
              )}
            </select>
          </div>

          {/* Botão Sincronizar RBX */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Sincronizando RBX...' : 'Sincronizar Atendimentos'}</span>
          </button>
        </div>
      </div>

      {/* Sync feedback message */}
      {syncMessage && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center space-x-2 animate-fade-in ${
            syncMessage.isError
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {syncMessage.isError ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          )}
          <span>{syncMessage.text}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* Card 1: Total */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Ordens de Retirada</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {loading ? '...' : summary.totalOrders}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Chamados abertos/tratados no mês</p>
        </div>

        {/* Card 2: Recuperados */}
        <div className="bg-white border border-emerald-200/80 rounded-xl p-4 shadow-xs bg-emerald-50/20">
          <div className="flex items-center justify-between text-emerald-800 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Recuperados</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-700">
            {loading ? '...' : summary.recuperados}
          </div>
          <p className="text-[11px] text-emerald-600/80 mt-0.5">Equipamentos recolhidos</p>
        </div>

        {/* Card 3: Taxa de Recuperação */}
        <div className="bg-white border border-blue-200/80 rounded-xl p-4 shadow-xs bg-blue-50/20">
          <div className="flex items-center justify-between text-blue-900 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Taxa de Sucesso</span>
            <span className="text-xs font-bold text-blue-700">{summary.taxaRecuperacao}%</span>
          </div>
          <div className="text-2xl font-extrabold text-blue-700">
            {loading ? '...' : `${summary.taxaRecuperacao}%`}
          </div>
          {/* Visual progress bar */}
          <div className="w-full bg-blue-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(summary.taxaRecuperacao, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Card 4: Pendentes / Insucesso */}
        <div className="bg-white border border-rose-200/80 rounded-xl p-4 shadow-xs bg-rose-50/20">
          <div className="flex items-center justify-between text-rose-800 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Não Recuperados</span>
            <PackageX className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-extrabold text-rose-700">
            {loading ? '...' : summary.pendentes}
          </div>
          <p className="text-[11px] text-rose-600/80 mt-0.5">Ninguém no local / Insucesso</p>
        </div>

        {/* Card 5: Desistiu / Retido */}
        <div className="bg-white border border-purple-200/80 rounded-xl p-4 shadow-xs bg-purple-50/20 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-purple-800 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Desistiu / Retido</span>
            <RotateCcw className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold text-purple-700">
            {loading ? '...' : summary.cancelamentoAbortado}
          </div>
          <p className="text-[11px] text-purple-600/80 mt-0.5">Cancelamento abortado</p>
        </div>
      </div>

      {/* Regional Summary Badges */}
      {data?.byCity && data.byCity.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 px-4 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span>Desempenho por Cidade no Mês</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.byCity.map((c) => (
              <button
                key={c.cidade}
                onClick={() => setCityFilter(cityFilter === c.cidade ? 'todas' : c.cidade)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition flex items-center gap-2 cursor-pointer ${
                  cityFilter === c.cidade
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span className="font-semibold">{c.cidade}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${cityFilter === c.cidade ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-800'}`}>
                  {c.total}
                </span>
                <span className={`text-[10px] font-bold ${c.taxaRecuperacao >= 60 ? 'text-emerald-600' : 'text-amber-600'} ${cityFilter === c.cidade ? 'text-emerald-300' : ''}`}>
                  {c.taxaRecuperacao}% recup.
                </span>
              </button>
            ))}
            {cityFilter !== 'todas' && (
              <button
                onClick={() => setCityFilter('todas')}
                className="text-xs px-2.5 py-1 text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                Limpar filtro de cidade
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 px-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input & City Dropdown */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, código, protocolo, serial, parecer..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>

          {citiesList.length > 0 && (
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium shrink-0">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="bg-transparent text-slate-800 border-none outline-none cursor-pointer pr-1"
              >
                <option value="todas">Todas as Cidades ({data?.orders.length || 0})</option>
                {citiesList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {[
            { id: 'todos', label: 'Todos', count: summary.totalOrders },
            { id: 'recuperado', label: 'Recuperados', count: summary.recuperados },
            { id: 'pendente', label: 'Não Recuperados', count: summary.pendentes },
            { id: 'em_andamento', label: 'Em Aberto', count: summary.emAndamento },
            { id: 'cancelamento_abortado', label: 'Desistiram', count: summary.cancelamentoAbortado },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`text-xs px-3 py-1 rounded-md font-medium transition cursor-pointer select-none flex items-center gap-1.5 ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white font-semibold shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1 rounded ${statusFilter === tab.id ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">
              Relação de Ordens de Retirada ({filteredOrders.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">
            Clique na linha para expandir e ler o parecer técnico completo
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
            <span>Carregando dados de equipamentos...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Nenhuma ordem de retirada encontrada para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider select-none">
                  <th className="py-2.5 px-3 w-8"></th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Localidade</th>
                  <th className="py-2.5 px-3">Nº Atendimento / Data</th>
                  <th className="py-2.5 px-3">Equipamento / Serial</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3">Parecer Técnico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => {
                  const isExpanded = expandedId === order.id;
                  return (
                    <React.Fragment key={order.id}>
                      <tr
                        onClick={() => toggleExpand(order.id)}
                        className={`hover:bg-blue-50/40 transition cursor-pointer ${
                          isExpanded ? 'bg-blue-50/60' : ''
                        }`}
                      >
                        {/* Expand Icon */}
                        <td className="py-3 px-3 text-center text-slate-400">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-blue-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </td>

                        {/* Cliente */}
                        <td className="py-3 px-3 font-medium text-slate-900">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{order.nomeCliente}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Cód: {order.codigoCliente} {order.contrato ? `• Contrato: ${order.contrato}` : ''}
                          </div>
                        </td>

                        {/* Localidade */}
                        <td className="py-3 px-3 text-slate-700">
                          <div className="font-semibold text-slate-800">{order.cidade}</div>
                          <div className="text-[11px] text-slate-500">{order.bairro}</div>
                        </td>

                        {/* Atendimento & Data */}
                        <td className="py-3 px-3 text-slate-700">
                          <div className="font-mono font-semibold text-slate-800">
                            #{order.id}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {formatDate(order.dataEncerramento || order.dataAbertura)}
                          </div>
                        </td>

                        {/* Equipamento */}
                        <td className="py-3 px-3 text-slate-800">
                          <div className="font-medium text-slate-900 line-clamp-1 max-w-xs">
                            {order.equipamentoIdentificado || 'Equipamento em Comodato'}
                          </div>
                          {order.serialMac && (
                            <div className="text-[10px] font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded inline-block mt-0.5">
                              {order.serialMac}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 text-center">
                          {getStatusBadge(order.statusRecuperacao)}
                        </td>

                        {/* Parecer Técnico */}
                        <td className="py-3 px-3 text-slate-600 max-w-xs">
                          <div className="line-clamp-2 text-[11px] italic text-slate-700">
                            {order.solucao ? `"${order.solucao}"` : order.causa || 'Sem parecer registrado'}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80 border-b border-slate-200">
                          <td colSpan={7} className="p-4 px-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                              {/* Left Column: Solution & Cause */}
                              <div className="space-y-2 bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                                <div className="flex items-center gap-1.5 text-slate-800 font-bold border-b border-slate-100 pb-1.5">
                                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Parecer do Técnico na Baixa (Solução)</span>
                                </div>
                                <div className="text-slate-700 whitespace-pre-line bg-slate-50 p-2.5 rounded border border-slate-200/60 font-mono text-[11px] leading-relaxed">
                                  {order.solucao || 'Nenhum texto de solução cadastrado no chamado.'}
                                </div>
                                <div className="text-[11px] text-slate-500 pt-1 flex items-center justify-between">
                                  <span>Causa registrada: <strong>{order.causa || 'Não informada'}</strong></span>
                                  <span>Tópico: <strong>{order.topico}</strong></span>
                                </div>
                              </div>

                              {/* Right Column: Assunto / Comodato Equipments */}
                              <div className="space-y-2 bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                                <div className="flex items-center gap-1.5 text-slate-800 font-bold border-b border-slate-100 pb-1.5">
                                  <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Histórico & Equipamentos em Comodato (Assunto)</span>
                                </div>
                                <div className="text-slate-700 whitespace-pre-line bg-slate-50 p-2.5 rounded border border-slate-200/60 text-[11px] leading-relaxed max-h-48 overflow-y-auto font-mono">
                                  {order.assunto || 'Sem detalhes no assunto.'}
                                </div>
                                <div className="text-[11px] text-slate-500 pt-1 flex items-center justify-between">
                                  <span>Abertura por: <strong>{order.usuarioAbertura || 'Sistema'}</strong></span>
                                  <span>Protocolo: <strong className="font-mono">{order.protocolo}</strong></span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
