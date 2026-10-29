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
  AlertTriangle,
  MapPin,
  HardDrive,
  FileText,
  Calendar,
  Layers,
  Building2,
  Eye,
  EyeOff,
  GitBranch,
  Sparkles,
  ShieldAlert,
  Printer,
  X,
  BarChart3,
  TrendingUp,
  DollarSign,
  Settings,
} from 'lucide-react';
import { API_BASE } from '../config/api';
import type { EquipamentoResponse, EquipamentoItem } from '../types';
import { EquipmentPrintReport } from './EquipmentPrintReport';

const formatMonthLabel = (monthKey: string) => {
  if (!monthKey) return '';
  const [year, month] = monthKey.split('-');
  const monthNames: Record<string, string> = {
    '01': 'Janeiro',
    '02': 'Fevereiro',
    '03': 'Março',
    '04': 'Abril',
    '05': 'Maio',
    '06': 'Junho',
    '07': 'Julho',
    '08': 'Agosto',
    '09': 'Setembro',
    '10': 'Outubro',
    '11': 'Novembro',
    '12': 'Dezembro',
  };
  const name = monthNames[month] || month;
  return `${name} / ${year}`;
};

interface ParsedFlow {
  topico: string;
  causa: string;
  abertura: string;
  encerramento: string;
  usuario: string;
  setor: string;
  detalhes: string;
}

const parseFlows = (assunto: string): ParsedFlow[] => {
  if (!assunto || !assunto.includes('Fluxo finalizado')) return [];
  const parts = assunto.split(/#\s*###\s*Fluxo finalizado:\s*#\s*###\//i);
  const flows: ParsedFlow[] = [];

  for (let i = 1; i < parts.length; i++) {
    const text = parts[i];
    const topicoMatch = text.match(/#\s*Tópico:\s*([^#/]+)#/i);
    const causaMatch = text.match(/#\s*Causa:\s*([^#/]+)#/i);
    const abertMatch = text.match(/#\s*Data\/Hora Abertura:\s*([^#/]+)#/i);
    const encMatch = text.match(/#\s*Data\/Hora Encerramento:\s*([^#/]+)#/i);
    const userMatch = text.match(/#\s*Usuário:\s*([^#/]+)#/i);
    const setorMatch = text.match(/#\s*Setor\/Grupo:\s*([^#/]+)#/i);

    const detalhes = text
      .replace(/#\s*[^#]+#\//g, '')
      .replace(/#\s*[^#]+#/g, '')
      .trim();

    flows.push({
      topico: topicoMatch ? topicoMatch[1].trim() : 'Fluxo Concluído',
      causa: causaMatch ? causaMatch[1].trim() : '',
      abertura: abertMatch ? abertMatch[1].trim() : '',
      encerramento: encMatch ? encMatch[1].trim() : '',
      usuario: userMatch ? userMatch[1].trim() : '',
      setor: setorMatch ? setorMatch[1].trim() : '',
      detalhes,
    });
  }
  return flows;
};

interface EquipmentRecoveryDashboardProps {
  selectedMonth?: string;
  onMonthChange?: (month: string) => void;
  onSwitchToAnnual?: () => void;
}

export const EquipmentRecoveryDashboard: React.FC<EquipmentRecoveryDashboardProps> = ({
  selectedMonth: propMonth,
  onMonthChange,
  onSwitchToAnnual,
}) => {
  const [data, setData] = useState<EquipamentoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(propMonth || '2026-01');
  const [cohortFilter, setCohortFilter] = useState<'nao_retornados' | 'retornados' | 'todos'>('nao_retornados');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [viewMode, setViewMode] = useState<'operacional' | 'executivo'>('operacional');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Sincroniza com a competência global caso o usuário navegue no cabeçalho superior
  useEffect(() => {
    if (propMonth && propMonth !== selectedMonth) {
      setSelectedMonth(propMonth);
    }
  }, [propMonth]);

  const handleMonthSelect = (newMonth: string) => {
    setSelectedMonth(newMonth);
    if (onMonthChange) {
      onMonthChange(newMonth);
    }
  };
  const [cityFilter, setCityFilter] = useState<string>('todas');
  const [showDuplicates, setShowDuplicates] = useState(false); // Preferivelmente manter oculto por padrão
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Valor unitário de referência do hardware (ONU / Roteador comodatado) com persistência local
  const [hardwareUnitPrice, setHardwareUnitPrice] = useState<number>(() => {
    const saved = localStorage.getItem('evad_hardware_unit_price');
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 220; // Padrão R$ 220,00 por aparelho comodatado
  });
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [tempPriceInput, setTempPriceInput] = useState<string>(() => hardwareUnitPrice.toString());

  const handleSavePrice = (newVal: number) => {
    if (isNaN(newVal) || newVal <= 0) return;
    setHardwareUnitPrice(newVal);
    localStorage.setItem('evad_hardware_unit_price', newVal.toString());
    setIsPriceModalOpen(false);
    setSyncMessage({
      text: `Valor unitário do equipamento atualizado para R$ ${newVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}! Indicadores e relatórios recalculados.`,
      isError: false,
    });
    setTimeout(() => setSyncMessage(null), 4000);
  };

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

  const handleStatusChange = async (order: EquipamentoItem, newStatus: string, obs?: string) => {
    // Atualização otimista imediata na UI
    setData((prevData) => {
      if (!prevData) return prevData;
      const updatedOrders = prevData.orders.map((o) => {
        if (o.id === order.id) {
          return {
            ...o,
            statusManual: (newStatus || '') as any,
            statusFinal: (newStatus || o.statusRecuperacao) as any,
            observacaoManual: obs !== undefined ? obs : o.observacaoManual,
            atualizadoEm: new Date().toISOString(),
            atualizadoPor: 'Operador',
          };
        }
        return o;
      });

      // Recalcula resumo de métricas
      let rec = 0, tent = 0, perd = 0, ativ = 0, sem = 0;
      updatedOrders.forEach((o) => {
        if (o.ehDuplicado) return;
        const s = o.statusFinal || o.statusManual || o.statusRecuperacao;
        if (s === 'recuperado') rec++;
        else if (s === 'tentando' || s === 'pendente' || s === 'em_andamento') tent++;
        else if (s === 'perdido') perd++;
        else if (s === 'ativo_cobranca' || s === 'cancelamento_abortado') ativ++;
        else if (s === 'sem_os') sem++;
      });

      const newSummary = {
        ...prevData.summary,
        recuperados: rec,
        tentando: tent,
        perdidos: perd,
        ativoCobranca: ativ,
        semOS: sem,
        taxaRecuperacao: prevData.summary.totalOrders > 0
          ? Math.round((rec / prevData.summary.totalOrders) * 1000) / 10
          : 0,
      };

      return {
        ...prevData,
        orders: updatedOrders,
        summary: newSummary,
      };
    });

    try {
      const res = await fetch(`${API_BASE}/api/equipamentos/classificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registroId: order.id,
          codigoCliente: order.codigoCliente,
          statusManual: newStatus,
          observacao: obs !== undefined ? obs : (order.observacaoManual || ''),
          atualizadoPor: 'Operador',
        }),
      });
      if (res.ok) {
        setSyncMessage({ text: 'Situação do equipamento salva com sucesso!', isError: false });
        setTimeout(() => setSyncMessage(null), 3000);
      }
    } catch (err) {
      console.error('Falha ao enviar classificação manual:', err);
    }
  };

  const cohortCounts = useMemo(() => {
    if (!data?.orders) return { naoRetornados: 0, retornados: 0, todos: 0 };
    let naoRet = 0, ret = 0, tod = 0;
    data.orders.forEach((o) => {
      if (o.ehDuplicado) return;
      tod++;
      if (o.statusDesfecho === 'churned' || o.statusDesfecho === 'suspended') {
        naoRet++;
      } else if (o.statusDesfecho === 'returned') {
        ret++;
      }
    });
    return { naoRetornados: naoRet, retornados: ret, todos: tod };
  }, [data?.orders]);

  const summary = useMemo(() => {
    if (!data?.orders) {
      return (
        data?.summary || {
          totalOrders: 0,
          totalDuplicados: 0,
          recuperados: 0,
          tentando: 0,
          perdidos: 0,
          ativoCobranca: 0,
          pendentes: 0,
          emAndamento: 0,
          cancelamentoAbortado: 0,
          semOS: 0,
          taxaRecuperacao: 0,
          taxaEfetividadeOS: 0,
        }
      );
    }

    let total = 0, rec = 0, tent = 0, perd = 0, ativ = 0, sem = 0;
    data.orders.forEach((o) => {
      if (o.ehDuplicado) return;
      if (cohortFilter === 'nao_retornados' && o.statusDesfecho !== 'churned' && o.statusDesfecho !== 'suspended') {
        return;
      }
      if (cohortFilter === 'retornados' && o.statusDesfecho !== 'returned') {
        return;
      }

      total++;
      const s = o.statusFinal || o.statusManual || o.statusRecuperacao;
      if (s === 'recuperado') rec++;
      else if (s === 'tentando' || s === 'pendente' || s === 'em_andamento') tent++;
      else if (s === 'perdido') perd++;
      else if (s === 'ativo_cobranca' || s === 'cancelamento_abortado') ativ++;
      else if (s === 'sem_os') sem++;
    });

    const taxaRec = total > 0 ? Math.round((rec / total) * 1000) / 10 : 0;
    const taxaEfet = (rec + tent + perd) > 0 ? Math.round((rec / (rec + tent + perd)) * 1000) / 10 : 0;

    return {
      totalOrders: total,
      totalDuplicados: data.summary?.totalDuplicados || 0,
      recuperados: rec,
      tentando: tent,
      perdidos: perd,
      ativoCobranca: ativ,
      pendentes: tent,
      emAndamento: 0,
      cancelamentoAbortado: ativ,
      semOS: sem,
      taxaRecuperacao: taxaRec,
      taxaEfetividadeOS: taxaEfet,
    };
  }, [data?.orders, data?.summary, cohortFilter]);

  const citiesList = useMemo(() => {
    if (!data?.orders) return [];
    const set = new Set<string>();
    data.orders.forEach((o) => {
      if (cohortFilter === 'nao_retornados' && o.statusDesfecho !== 'churned' && o.statusDesfecho !== 'suspended') return;
      if (cohortFilter === 'retornados' && o.statusDesfecho !== 'returned') return;
      if (o.cidade && o.cidade !== 'Não Informado') set.add(o.cidade);
    });
    return Array.from(set).sort();
  }, [data?.orders, cohortFilter]);

  const filteredOrders = useMemo(() => {
    if (!data?.orders) return [];
    return data.orders.filter((order) => {
      // Filtro de Foco da Coorte
      if (cohortFilter === 'nao_retornados' && order.statusDesfecho !== 'churned' && order.statusDesfecho !== 'suspended') {
        return false;
      }
      if (cohortFilter === 'retornados' && order.statusDesfecho !== 'returned') {
        return false;
      }

      // Filtro de duplicados (preferivelmente manter oculto por padrão)
      if (!showDuplicates && order.ehDuplicado) {
        return false;
      }
      // Status Filter consolidando statusFinal / statusManual / statusRecuperacao
      if (statusFilter !== 'todos') {
        const itemStatus = order.statusFinal || order.statusManual || order.statusRecuperacao;
        if (statusFilter === 'recuperado' && itemStatus !== 'recuperado') {
          return false;
        }
        if (statusFilter === 'tentando' && itemStatus !== 'tentando' && itemStatus !== 'pendente' && itemStatus !== 'em_andamento') {
          return false;
        }
        if (statusFilter === 'perdido' && itemStatus !== 'perdido') {
          return false;
        }
        if (statusFilter === 'ativo_cobranca' && itemStatus !== 'ativo_cobranca' && itemStatus !== 'cancelamento_abortado') {
          return false;
        }
        if (statusFilter === 'sem_os' && itemStatus !== 'sem_os') {
          return false;
        }
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
  }, [data?.orders, cohortFilter, showDuplicates, statusFilter, cityFilter, searchTerm]);

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

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const financialStats = useMemo(() => {
    const totalRisk = (summary.totalOrders || 0) * hardwareUnitPrice;
    const recovered = (summary.recuperados || 0) * hardwareUnitPrice;
    const withoutOS = (summary.semOS || 0) * hardwareUnitPrice;
    const lost = (summary.perdidos || 0) * hardwareUnitPrice;
    const active = (summary.ativoCobranca || 0) * hardwareUnitPrice;
    const osEffectiveness =
      (summary.recuperados + (summary.tentando || 0) + (summary.perdidos || 0)) > 0
        ? ((summary.recuperados / (summary.recuperados + (summary.tentando || 0) + (summary.perdidos || 0))) * 100)
        : 0;

    return {
      totalRisk,
      recovered,
      withoutOS,
      lost,
      active,
      osEffectiveness: Math.round(osEffectiveness * 10) / 10,
    };
  }, [summary, hardwareUnitPrice]);

  return (
    <div>
      {/* 1. Folha Executiva Exclusiva para Impressão A4 (Renderiza APENAS no Print) */}
      <div className="hidden print:block">
        {data && (
          <EquipmentPrintReport
            orders={data.orders}
            summary={summary}
            selectedMonth={selectedMonth}
            hardwareUnitValue={hardwareUnitPrice}
          />
        )}
      </div>

      {/* 2. Conteúdo em Tela (Ocultado no Print) */}
      <div className="space-y-6 print:hidden animate-fade-in">
        {/* Top Banner / Controls */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-lg shrink-0">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                <span>Recuperação de Equipamentos</span>
                <span className="text-[10px] sm:text-[11px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full whitespace-nowrap">
                  Gestão de Hardware
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Auditoria estrita dos clientes da planilha de <strong>{formatMonthLabel(selectedMonth)}</strong> cruzados com as ordens de retirada do RBX
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full xl:w-auto xl:justify-end">
            {/* Seletor de Mês */}
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium shrink-0">
              <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="hidden sm:inline">Mês:</span>
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthSelect(e.target.value)}
                className="bg-transparent font-bold text-slate-900 border-none outline-none cursor-pointer pr-1 text-xs"
              >
                {data?.availableMonths && data.availableMonths.length > 0 ? (
                  data.availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthLabel(m)}
                    </option>
                  ))
                ) : (
                  <option value={selectedMonth}>{formatMonthLabel(selectedMonth)}</option>
                )}
              </select>
            </div>

            {/* Botão/Pill Valor Unitário do Equipamento */}
            <button
              onClick={() => {
                setTempPriceInput(hardwareUnitPrice.toString());
                setIsPriceModalOpen(true);
              }}
              className="flex items-center space-x-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium transition cursor-pointer shrink-0 shadow-2xs group"
              title="Clique para definir o valor unitário estimado de cada equipamento"
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform shrink-0" />
              <span className="hidden sm:inline text-slate-500">Valor Unit:</span>
              <span className="font-bold text-slate-900">
                {formatCurrency(hardwareUnitPrice)}
              </span>
              <span className="text-[10px] bg-slate-200/80 group-hover:bg-slate-300 text-slate-700 px-1 py-0.2 rounded font-semibold ml-0.5">
                Definir
              </span>
            </button>

            {/* Botão Sincronizar RBX */}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncing ? 'Sincronizando RBX...' : 'Sincronizar Atendimentos'}</span>
              <span className="sm:hidden">Sincronizar</span>
            </button>

            {/* Botão Prévia Executiva */}
            <button
              onClick={() => setIsPreviewOpen(true)}
              className="flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer shrink-0"
              title="Visualizar a folha A4 executiva do relatório de equipamentos"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="hidden sm:inline">Prévia Executiva</span>
              <span className="sm:hidden">Prévia</span>
            </button>

            {/* Botão Ver Ano Inteiro */}
            {onSwitchToAnnual && (
              <button
                type="button"
                onClick={onSwitchToAnnual}
                className="flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer shrink-0"
                title="Visualizar a consolidação e KPIs anuais de todos os meses do ano"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="hidden sm:inline">Ver Ano Inteiro (2026)</span>
                <span className="sm:hidden">Ano Todo</span>
              </button>
            )}

            {/* Botão Imprimir / Exportar PDF */}
            <button
              onClick={() => window.print()}
              className="flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer shrink-0"
              title="Imprimir ou Salvar em PDF o Relatório Executivo A4 de Equipamentos"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Imprimir Relatório (PDF)</span>
              <span className="sm:hidden">PDF</span>
            </button>
          </div>
        </div>

        {/* Seletor de Modo de Visualização: Operacional vs Executivo */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('operacional')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                viewMode === 'operacional'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Relação Operacional & Auditoria</span>
            </button>

            <button
              onClick={() => setViewMode('executivo')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                viewMode === 'executivo'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Dashboard Executivo & KPIs</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>KPIs sincronizados em tempo real com as alterações da auditoria</span>
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

      {/* KPI Cards Grid - Responsivo: 2 cols mobile, 3 cols tablet/notebook, 6 cols desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-3.5">
        {/* Card 1: Total */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider truncate">
              {cohortFilter === 'nao_retornados' ? 'Não Retornaram' : cohortFilter === 'retornados' ? 'Retornaram com OS' : 'Total em Atenção'}
            </span>
            <Layers className="w-4 h-4 text-slate-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900">
            {loading ? '...' : summary.totalOrders}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
            {cohortFilter === 'nao_retornados' ? 'Contratos Churn + Suspensos' : cohortFilter === 'retornados' ? 'Reativados na base' : 'Clientes da competência'}
          </p>
        </div>

        {/* Card 2: Recuperados */}
        <div className="bg-white border border-emerald-200/80 rounded-xl p-3.5 sm:p-4 shadow-xs bg-emerald-50/20">
          <div className="flex items-center justify-between text-emerald-800 mb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider truncate">Recuperados</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-700">
            {loading ? '...' : summary.recuperados}
          </div>
          <p className="text-[10px] sm:text-[11px] text-emerald-600/80 mt-0.5 truncate">Equipamentos recolhidos</p>
        </div>

        {/* Card 3: Taxa de Recuperação Global */}
        <div className="bg-white border border-blue-200/80 rounded-xl p-3.5 sm:p-4 shadow-xs bg-blue-50/20">
          <div className="flex items-center justify-between text-blue-900 mb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider truncate">Taxa Global</span>
            <span className="text-xs font-bold text-blue-700">{summary.taxaRecuperacao}%</span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-blue-700">
            {loading ? '...' : `${summary.taxaRecuperacao}%`}
          </div>
          {/* Visual progress bar */}
          <div className="w-full bg-blue-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(summary.taxaRecuperacao, 100)}%` }}
            ></div>
          </div>
          <p className="text-[10px] text-blue-600 font-medium mt-1 truncate">
            Eficácia OS: {summary.taxaEfetividadeOS ?? 0}%
          </p>
        </div>

        {/* Card 4: Tentando Recuperação */}
        <div className="bg-white border border-amber-200/80 rounded-xl p-3.5 sm:p-4 shadow-xs bg-amber-50/20">
          <div className="flex items-center justify-between text-amber-900 mb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider truncate">Tentando Recuperar</span>
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-amber-700">
            {loading ? '...' : (summary.tentando || summary.pendentes)}
          </div>
          <p className="text-[10px] sm:text-[11px] text-amber-700/80 mt-0.5 truncate">Em campo / Tentativa</p>
        </div>

        {/* Card 5: Perdidos / Insucesso */}
        <div className="bg-white border border-rose-200/80 rounded-xl p-3.5 sm:p-4 shadow-xs bg-rose-50/20">
          <div className="flex items-center justify-between text-rose-800 mb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider truncate">Perdidos</span>
            <PackageX className="w-4 h-4 text-rose-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-rose-700">
            {loading ? '...' : summary.perdidos}
          </div>
          <p className="text-[10px] sm:text-[11px] text-rose-600/80 mt-0.5 truncate">Mudou / Extraviado</p>
        </div>

        {/* Card 6: Voltou Ativo (Cobrança) */}
        <div className="bg-white border border-purple-200/80 rounded-xl p-3.5 sm:p-4 shadow-xs bg-purple-50/20">
          <div className="flex items-center justify-between text-purple-800 mb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider truncate">Voltou Ativo (Cobrança)</span>
            <RotateCcw className="w-4 h-4 text-purple-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-purple-700">
            {loading ? '...' : (summary.ativoCobranca || summary.cancelamentoAbortado)}
          </div>
          <p className="text-[10px] sm:text-[11px] text-purple-600/80 mt-0.5 truncate">Revertido cobrança / Reativou</p>
        </div>
      </div>

      {/* Seletor de Foco da Auditoria: Não Retornados (68) vs Voltaram à Base com OS (17) vs Todos */}
      <div className="bg-slate-100/90 border border-slate-200/90 rounded-xl p-1.5 flex flex-wrap sm:flex-nowrap items-center gap-1.5 shadow-2xs">
        <button
          onClick={() => {
            setCohortFilter('nao_retornados');
            setStatusFilter('todos');
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
            cohortFilter === 'nao_retornados'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <ShieldAlert className={`w-4 h-4 ${cohortFilter === 'nao_retornados' ? 'text-amber-400' : 'text-amber-600'}`} />
          <span>Não Retornaram / Em Risco</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            cohortFilter === 'nao_retornados' ? 'bg-amber-400 text-slate-950 font-extrabold' : 'bg-slate-200 text-slate-700'
          }`}>
            {cohortCounts.naoRetornados}
          </span>
        </button>

        <button
          onClick={() => {
            setCohortFilter('retornados');
            setStatusFilter('todos');
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
            cohortFilter === 'retornados'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <RotateCcw className={`w-4 h-4 ${cohortFilter === 'retornados' ? 'text-emerald-400' : 'text-emerald-600'}`} />
          <span>Voltaram à Base com OS</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            cohortFilter === 'retornados' ? 'bg-emerald-400 text-slate-950 font-extrabold' : 'bg-slate-200 text-slate-700'
          }`}>
            {cohortCounts.retornados}
          </span>
        </button>

        <button
          onClick={() => {
            setCohortFilter('todos');
            setStatusFilter('todos');
          }}
          className={`sm:flex-initial flex items-center justify-center gap-2 py-2 px-3.5 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
            cohortFilter === 'todos'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Layers className={`w-4 h-4 ${cohortFilter === 'todos' ? 'text-blue-400' : 'text-slate-500'}`} />
          <span>Todos da Planilha</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            cohortFilter === 'todos' ? 'bg-blue-400 text-slate-950 font-extrabold' : 'bg-slate-200 text-slate-700'
          }`}>
            {cohortCounts.todos}
          </span>
        </button>
      </div>

      {viewMode === 'executivo' ? (
        /* ========================================================================= */
        /* MODO DASHBOARD EXECUTIVO & KPIS                                          */
        /* ========================================================================= */
        <div className="space-y-5 animate-fade-in">
          {/* Barra de Parâmetro e Definição do Custo do Equipamento */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 sm:p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-2.5">
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg shrink-0">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                    Parâmetro de Cálculo do Patrimônio em Comodato
                  </h4>
                  <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    Personalizável
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Valor base por aparelho (ONU / Roteador Wi-Fi) utilizado para mensurar o patrimônio sob risco, salvo ou extraviado.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <span className="text-xs font-semibold text-slate-600">Custo / Unidade:</span>
              <div className="flex items-center bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 focus-within:bg-white transition">
                <span className="text-xs font-bold text-slate-500 mr-1">R$</span>
                <input
                  type="number"
                  min="1"
                  step="5"
                  value={hardwareUnitPrice}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val > 0) {
                      setHardwareUnitPrice(val);
                      localStorage.setItem('evad_hardware_unit_price', val.toString());
                    }
                  }}
                  className="w-20 text-xs font-extrabold text-slate-900 bg-transparent border-none outline-none"
                />
              </div>
              <button
                onClick={() => {
                  setTempPriceInput(hardwareUnitPrice.toString());
                  setIsPriceModalOpen(true);
                }}
                className="text-xs px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5"
                title="Configurar valor ou escolher modelos padrão de mercado"
              >
                <Settings className="w-3.5 h-3.5 text-slate-500" />
                <span>Modelos Sugeridos</span>
              </button>
            </div>
          </div>

          {/* 1. Painel Financeiro de Patrimônio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-xl shadow-xs border border-slate-700">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Patrimônio em Risco</span>
                <DollarSign className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-white mt-1">
                {formatCurrency(financialStats.totalRisk)}
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                {summary.totalOrders} aparelhos × {formatCurrency(hardwareUnitPrice)} sob risco
              </p>
            </div>

            <div className="bg-gradient-to-br from-emerald-950 to-emerald-900 text-white p-4 rounded-xl shadow-xs border border-emerald-800">
              <div className="flex items-center justify-between text-emerald-300 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Patrimônio Salvo</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-100 mt-1">
                {formatCurrency(financialStats.recovered)}
              </div>
              <p className="text-[11px] text-emerald-300 mt-1">
                {summary.recuperados} aparelhos recolhidos com sucesso
              </p>
            </div>

            <div className="bg-gradient-to-br from-amber-950 to-amber-900 text-white p-4 rounded-xl shadow-xs border border-amber-800">
              <div className="flex items-center justify-between text-amber-300 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Ponto Cego (Sem OS)</span>
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-100 mt-1">
                {formatCurrency(financialStats.withoutOS)}
              </div>
              <p className="text-[11px] text-amber-300 mt-1">
                {summary.semOS} residências sem chamado aberto no RBX
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-950 to-blue-900 text-white p-4 rounded-xl shadow-xs border border-blue-800">
              <div className="flex items-center justify-between text-blue-300 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Eficácia das Visitas</span>
                <TrendingUp className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-black text-blue-100 mt-1">
                {financialStats.osEffectiveness}%
              </div>
              <p className="text-[11px] text-blue-300 mt-1">
                Taxa de êxito quando técnico visita o endereço
              </p>
            </div>
          </div>

          {/* 2. Gráficos Analíticos em Duas Colunas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Funil de Efetividade da Operação */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-slate-700" />
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-tight">
                    Funil Operacional de Recolhimento
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">Eficiência de Campo</span>
              </div>

              <div className="space-y-3.5">
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-800 mb-1">
                    <span>1. Inadimplentes Não Retornados (Base Total)</span>
                    <span>{summary.totalOrders} aparelhos (100%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden">
                    <div className="bg-slate-800 h-3.5 rounded-full" style={{ width: '100%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-blue-900 mb-1">
                    <span>2. Ordens de Retirada Abertas no RBX</span>
                    <span>
                      {summary.recuperados + (summary.tentando || 0) + (summary.perdidos || 0)} (
                      {summary.totalOrders > 0
                        ? (((summary.recuperados + (summary.tentando || 0) + (summary.perdidos || 0)) / summary.totalOrders) * 100).toFixed(1)
                        : 0}
                      %)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-3.5 rounded-full"
                      style={{
                        width: `${summary.totalOrders > 0 ? (((summary.recuperados + (summary.tentando || 0) + (summary.perdidos || 0)) / summary.totalOrders) * 100) : 0}%`,
                      }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-emerald-900 mb-1">
                    <span>3. Equipamentos Recolhidos com Sucesso</span>
                    <span>
                      {summary.recuperados} ({summary.taxaRecuperacao}% do total • {financialStats.osEffectiveness}% das OS)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-3.5 rounded-full"
                      style={{ width: `${Math.min(summary.taxaRecuperacao, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mt-4 text-xs text-slate-600 leading-relaxed">
                <strong>Diagnóstico de Eficiência:</strong> A equipe de campo tem êxito em{' '}
                <strong>{financialStats.osEffectiveness}%</strong> das ordens abertas. A maior barreira de recuperação
                não é técnica, mas operacional: <strong>{summary.semOS} clientes</strong> ainda não têm chamado no RBX.
              </div>
            </div>

            {/* Donut de Destino do Hardware */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-slate-700" />
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-tight">
                    Destino do Hardware em Risco
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">Distribuição do Lote</span>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-2">
                <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                  <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={38} stroke="#f1f5f9" strokeWidth="14" fill="transparent" />
                    <circle
                      cx="50"
                      cy="50"
                      r={38}
                      stroke="#f59e0b"
                      strokeWidth="14"
                      strokeDasharray={238.76}
                      strokeDashoffset={0}
                      fill="transparent"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r={38}
                      stroke="#10b981"
                      strokeWidth="14"
                      strokeDasharray={238.76}
                      strokeDashoffset={238.76 - (summary.taxaRecuperacao / 100) * 238.76}
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-base font-black text-slate-900 leading-none">
                      {summary.taxaRecuperacao}%
                    </span>
                    <span className="text-[9px] font-bold text-emerald-700 uppercase mt-0.5">Recuperado</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs font-semibold text-slate-700 w-full sm:w-auto">
                  <div className="flex items-center justify-between gap-3 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                    <span className="flex items-center gap-1.5 text-emerald-900">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      Recuperados:
                    </span>
                    <strong className="text-emerald-800">{summary.recuperados} ({summary.taxaRecuperacao}%)</strong>
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                    <span className="flex items-center gap-1.5 text-amber-900">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      Sem OS Aberta:
                    </span>
                    <strong className="text-amber-800">{summary.semOS}</strong>
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-200">
                    <span className="flex items-center gap-1.5 text-blue-900">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                      Tentando / Em Campo:
                    </span>
                    <strong className="text-blue-800">{summary.tentando || summary.pendentes}</strong>
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200">
                    <span className="flex items-center gap-1.5 text-rose-900">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                      Extraviados / Perdidos:
                    </span>
                    <strong className="text-rose-800">{summary.perdidos}</strong>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 flex justify-between text-xs text-slate-500">
                <span>Total de aparelhos no lote: <strong>{summary.totalOrders}</strong></span>
                <button
                  onClick={() => setViewMode('operacional')}
                  className="text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer text-xs"
                >
                  Abrir tabela operacional ➔
                </button>
              </div>
            </div>
          </div>

          {/* 3. Matriz Executiva de Praças / Cidades */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-600" />
                  <span>Exposição Patrimonial e Eficácia por Praça / Cidade</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Clique em qualquer praça para filtrar automaticamente e auditar os clientes
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {data?.byCity?.length || 0} praças atendidas
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data?.byCity?.map((c) => (
                <div
                  key={c.cidade}
                  onClick={() => {
                    setCityFilter(c.cidade);
                    setViewMode('operacional');
                  }}
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-100/70 transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between font-bold text-slate-900 text-xs mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="group-hover:text-blue-600 transition">{c.cidade}</span>
                      {c.cidade.toLowerCase().includes('boa vista') && (
                        <span className="text-[9px] bg-sky-50 text-sky-800 border border-sky-200 px-1 py-0.2 rounded font-medium">
                          Distrito
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      c.taxaRecuperacao >= 50
                        ? 'bg-emerald-100 text-emerald-800'
                        : c.taxaRecuperacao > 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {c.taxaRecuperacao}% recuperado
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(c.taxaRecuperacao, 100)}%` }}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span>Em risco: <strong>{c.total}</strong> <span className="text-[10px] text-slate-400">({formatCurrency(c.total * hardwareUnitPrice)})</span></span>
                    <span className="text-emerald-700 font-semibold">{c.recuperados} recolhidos</span>
                    {c.semOS > 0 && (
                      <span className="text-amber-700 font-bold">{c.semOS} sem OS</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Recomendações Estratégicas para Gestão de Ativos */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h4 className="text-sm font-black uppercase tracking-wider text-white">
                Recomendações Prioritárias para Diretoria & Gestão Técnica
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs text-slate-200 leading-relaxed">
              <div className="bg-white/10 p-3 rounded-lg border border-white/10">
                <strong className="block text-amber-300 font-bold mb-1">
                  1. Abertura Imediata em Lote
                </strong>
                Gerar ordens de serviço no RBX para os <strong>{summary.semOS} clientes</strong> que permanecem com aparelhos sem chamado aberto. Isso destrava <strong>{formatCurrency(financialStats.withoutOS)}</strong> em ativos para a operação.
              </div>
              <div className="bg-white/10 p-3 rounded-lg border border-white/10">
                <strong className="block text-emerald-300 font-bold mb-1">
                  2. Escalar Rotas Técnicas
                </strong>
                Como a taxa de sucesso de campo é de <strong>{financialStats.osEffectiveness}%</strong>, o gargalo não é recusa do cliente, mas agendamento. Concentrar rotas diárias garante retorno acelerado ao estoque.
              </div>
              <div className="bg-white/10 p-3 rounded-lg border border-white/10">
                <strong className="block text-blue-300 font-bold mb-1">
                  3. Exportar Relatório Executivo
                </strong>
                Utilize o botão <strong>"Imprimir Relatório (PDF)"</strong> acima para emitir a folha A4 executiva e apresentar o balanço patrimonial para a diretoria da Sol Telecom.
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* MODO OPERACIONAL: BUSCA, FILTROS & TABELA DE AUDITORIA                   */
        /* ========================================================================= */
        <div className="space-y-5 animate-fade-in">
          {/* Regional Summary Badges */}
          {data?.byCity && data.byCity.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Desempenho por Cidade no Mês</span>
              </div>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {data.byCity.map((c) => (
                  <button
                    key={c.cidade}
                    onClick={() => setCityFilter(cityFilter === c.cidade ? 'todas' : c.cidade)}
                    className={`text-[11px] sm:text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border transition flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
                      cityFilter === c.cidade
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span className="font-semibold">{c.cidade}</span>
                    {c.cidade.toLowerCase().includes('boa vista') && (
                      <span className="text-[9px] bg-sky-100 text-sky-800 border border-sky-200 px-1 py-0.2 rounded font-medium">
                        Distrito
                      </span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${cityFilter === c.cidade ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-800'}`}>
                      {c.total}
                    </span>
                    <span className={`text-[10px] font-bold ${c.taxaRecuperacao >= 60 ? 'text-emerald-600' : 'text-amber-600'} ${cityFilter === c.cidade ? 'text-emerald-300' : ''}`}>
                      {c.taxaRecuperacao}%
                    </span>
                    {c.semOS > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${cityFilter === c.cidade ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
                        {c.semOS} sem OS
                      </span>
                    )}
                  </button>
                ))}
                {cityFilter !== 'todas' && (
                  <button
                    onClick={() => setCityFilter('todas')}
                    className="text-xs px-2.5 py-1 text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Limpar filtro
                  </button>
                )}
              </div>
            </div>
          )}

      {/* Search & Filter Bar - 2-tier robust responsive layout */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-3.5 sm:p-4 space-y-3">
        {/* Tier 1: Search Input & Controls (Cidades + Toggle Duplicados) */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          {/* Search Input - Amplo e flexível */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, código, protocolo, serial, parecer..."
              className="w-full pl-9 pr-8 py-2 sm:py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm px-1"
                title="Limpar busca"
              >
                ×
              </button>
            )}
          </div>

          {/* Controls: Seletor de Cidades e Toggle de Duplicados */}
          <div className="flex items-center gap-2 shrink-0">
            {citiesList.length > 0 && (
              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium shrink-0 flex-1 sm:flex-initial">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  className="bg-transparent text-slate-800 border-none outline-none cursor-pointer pr-1 w-full sm:w-auto text-xs"
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

            {/* Toggle para exibir ou manter oculto os cadastros duplicados (por padrão oculto) */}
            {summary.totalDuplicados > 0 && (
              <button
                onClick={() => setShowDuplicates((prev) => !prev)}
                className={`flex items-center justify-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer select-none shrink-0 ${
                  showDuplicates
                    ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs hover:bg-amber-200'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                }`}
                title={showDuplicates ? 'Clique para ocultar duplicados' : 'Clique para exibir cadastros duplicados'}
              >
                {showDuplicates ? (
                  <>
                    <Eye className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span className="hidden sm:inline">Exibindo Duplicados</span>
                    <span className="sm:hidden">Duplicados</span>
                    <span className="bg-amber-200/80 text-amber-900 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                      {summary.totalDuplicados}
                    </span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="hidden sm:inline">Ocultando Duplicados</span>
                    <span className="sm:hidden">Ocultos</span>
                    <span className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                      {summary.totalDuplicados}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Tier 2: Filter Pills Row - Scroll horizontal suave em telas menores / alinhamento perfeito em desktop */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 w-full">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 mr-1 hidden md:inline">
              Filtrar Status:
            </span>
            {[
              { id: 'todos', label: 'Todos', count: summary.totalOrders },
              { id: 'recuperado', label: 'Recuperados', count: summary.recuperados },
              { id: 'tentando', label: 'Tentando Recuperação', count: summary.tentando || summary.pendentes },
              { id: 'perdido', label: 'Perdidos', count: summary.perdidos },
              { id: 'ativo_cobranca', label: 'Voltou Ativo (Cobrança)', count: summary.ativoCobranca || summary.cancelamentoAbortado },
              { id: 'sem_os', label: 'Sem OS (Em Risco)', count: summary.semOS },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`text-xs px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition cursor-pointer select-none flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-slate-900 text-white font-semibold shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    statusFilter === tab.id
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-slate-500 shrink-0" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
              Relação de Ordens de Retirada ({filteredOrders.length})
            </h3>
          </div>
          <span className="text-[10px] sm:text-[11px] text-slate-500">
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
            <table className="w-full text-left border-collapse text-xs min-w-[780px]">
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
                        className={`transition cursor-pointer ${
                          order.statusRecuperacao === 'sem_os'
                            ? isExpanded
                              ? 'bg-amber-100/70 border-l-4 border-l-amber-500'
                              : 'bg-amber-50/40 hover:bg-amber-100/50 border-l-4 border-l-amber-400'
                            : isExpanded
                            ? 'bg-blue-50/60'
                            : 'hover:bg-blue-50/40'
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
                          <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span>{order.nomeCliente}</span>
                            {order.statusDesfecho === 'churned' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                                CANCELADO (CHURN)
                              </span>
                            )}
                            {order.statusDesfecho === 'suspended' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                                SUSPENSO
                              </span>
                            )}
                            {order.statusDesfecho === 'returned' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                VOLTOU ATIVO
                              </span>
                            )}
                            {order.ehDuplicado && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300 inline-flex items-center gap-0.5">
                                <AlertCircle className="w-3 h-3 text-slate-500" />
                                Duplicata RBX
                              </span>
                            )}
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
                          {order.statusRecuperacao === 'sem_os' ? (
                            <>
                              <div className="font-mono font-bold text-amber-700 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>Sem OS Aberta</span>
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Bloqueio/Canc: {formatDate(order.dataAbertura)}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="font-mono font-semibold text-slate-800">
                                #{order.id}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {formatDate(order.dataEncerramento || order.dataAbertura)}
                              </div>
                            </>
                          )}
                        </td>

                        {/* Equipamento */}
                        <td className="py-3 px-3 text-slate-800">
                          <div className="font-medium text-slate-900 line-clamp-1 max-w-xs">
                            {order.equipamentoIdentificado || 'Equipamento em Comodato'}
                          </div>
                          {order.serialMac && order.serialMac !== '-' && (
                            <div className="text-[10px] font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded inline-block mt-0.5">
                              {order.serialMac}
                            </div>
                          )}
                        </td>

                        {/* Status Interativo */}
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="relative inline-flex flex-col items-center">
                            <div className="relative inline-flex items-center">
                              <select
                                value={order.statusManual || order.statusFinal || order.statusRecuperacao}
                                onChange={(e) => handleStatusChange(order, e.target.value)}
                                className={`appearance-none cursor-pointer pl-3 pr-6 py-1 rounded-full text-[11px] font-bold border transition shadow-2xs outline-none focus:ring-2 focus:ring-blue-500/20 text-center ${
                                  (order.statusFinal || order.statusManual || order.statusRecuperacao) === 'recuperado'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                    : (order.statusFinal || order.statusManual || order.statusRecuperacao) === 'tentando' ||
                                      (order.statusFinal || order.statusManual || order.statusRecuperacao) === 'pendente' ||
                                      (order.statusFinal || order.statusManual || order.statusRecuperacao) === 'em_andamento'
                                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                    : (order.statusFinal || order.statusManual || order.statusRecuperacao) === 'perdido'
                                    ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                                    : (order.statusFinal || order.statusManual || order.statusRecuperacao) === 'ativo_cobranca' ||
                                      (order.statusFinal || order.statusManual || order.statusRecuperacao) === 'cancelamento_abortado'
                                    ? 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100'
                                    : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                                }`}
                                title="Clique para alterar a situação do equipamento"
                              >
                                <option value="recuperado">✓ Recuperado</option>
                                <option value="tentando">⏳ Tentando Recuperação</option>
                                <option value="perdido">✕ Perdido</option>
                                <option value="ativo_cobranca">↺ Voltou Ativo (Cobrança)</option>
                                {order.statusRecuperacao === 'sem_os' && <option value="sem_os">⚠️ Sem OS (Em Risco)</option>}
                              </select>
                              <ChevronDown className="w-3 h-3 absolute right-2 pointer-events-none opacity-60" />
                            </div>
                            {order.statusManual && (
                              <span className="text-[9px] text-indigo-700 font-bold mt-0.5 flex items-center gap-0.5" title={`Auditado por ${order.atualizadoPor || 'Operador'}`}>
                                <Sparkles className="w-2.5 h-2.5 text-indigo-500" />
                                Auditado
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Parecer Técnico */}
                        <td className="py-3 px-3 text-slate-600 max-w-xs">
                          {order.statusRecuperacao === 'sem_os' ? (
                            <div className="line-clamp-2 text-[11px] font-medium text-amber-800">
                              Cancelou ({order.causa || 'Inadimplência'}) - Nenhuma OS de retirada aberta
                            </div>
                          ) : (
                            <div className="line-clamp-2 text-[11px] italic text-slate-700">
                              {order.solucao ? `"${order.solucao}"` : order.causa || 'Sem parecer registrado'}
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80 border-b border-slate-200">
                          <td colSpan={7} className="p-4 px-6 space-y-4">
                            {/* Bloco de Auditoria & Classificação Manual da Equipe */}
                            <div className="bg-white border-2 border-indigo-100 rounded-xl p-4 shadow-2xs space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg shrink-0">
                                    <Sparkles className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold text-slate-900">Auditoria & Situação Real do Equipamento</h4>
                                    <p className="text-[11px] text-slate-500">
                                      Informe a situação real caso o cliente tenha reativado pela cobrança, mudado de endereço ou o aparelho tenha sido recolhido
                                    </p>
                                  </div>
                                </div>
                                {order.statusManual && (
                                  <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-200 self-start sm:self-auto flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    Auditado Manualmente
                                  </span>
                                )}
                              </div>

                              {/* Botões Rápidos */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(order, 'recuperado')}
                                  className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer select-none ${
                                    (order.statusManual || order.statusFinal) === 'recuperado'
                                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                      : 'bg-emerald-50/50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                                  }`}
                                >
                                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                                  <span>Recuperado</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(order, 'tentando')}
                                  className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer select-none ${
                                    (order.statusManual || order.statusFinal) === 'tentando'
                                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                      : 'bg-amber-50/50 hover:bg-amber-100 text-amber-800 border-amber-200'
                                  }`}
                                >
                                  <Clock className="w-4 h-4 shrink-0" />
                                  <span>Tentando Recuperação</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(order, 'perdido')}
                                  className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer select-none ${
                                    (order.statusManual || order.statusFinal) === 'perdido'
                                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                      : 'bg-rose-50/50 hover:bg-rose-100 text-rose-800 border-rose-200'
                                  }`}
                                >
                                  <PackageX className="w-4 h-4 shrink-0" />
                                  <span>Perdido</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(order, 'ativo_cobranca')}
                                  className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer select-none ${
                                    (order.statusManual || order.statusFinal) === 'ativo_cobranca'
                                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                      : 'bg-purple-50/50 hover:bg-purple-100 text-purple-800 border-purple-200'
                                  }`}
                                >
                                  <RotateCcw className="w-4 h-4 shrink-0" />
                                  <span>Voltou Ativo (Cobrança)</span>
                                </button>
                              </div>

                              {/* Linha de Anotação Interna */}
                              <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <input
                                  type="text"
                                  defaultValue={order.observacaoManual || ''}
                                  id={`obs-${order.id}`}
                                  placeholder="Observação da auditoria (ex: cliente solicitou boleto para reativar, casa vazia)..."
                                  className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const input = document.getElementById(`obs-${order.id}`) as HTMLInputElement;
                                    const note = input ? input.value : '';
                                    handleStatusChange(order, order.statusManual || order.statusFinal || order.statusRecuperacao, note);
                                  }}
                                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition shadow-2xs"
                                >
                                  Salvar Nota
                                </button>
                                {order.statusManual && (
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(order, '')}
                                    className="text-[11px] text-slate-400 hover:text-slate-600 underline cursor-pointer shrink-0"
                                    title="Restaurar para a detecção automática do chamado no RBX"
                                  >
                                    Restaurar automático
                                  </button>
                                )}
                              </div>
                              {order.atualizadoEm && (
                                <div className="text-[10px] text-slate-400 italic">
                                  Última alteração em {formatDate(order.atualizadoEm)} por {order.atualizadoPor || 'Operador'}
                                  {order.observacaoManual ? ` • Nota: "${order.observacaoManual}"` : ''}
                                </div>
                              )}
                            </div>

                            {order.statusRecuperacao === 'sem_os' ? (
                              <div className="space-y-3 bg-amber-50/90 border border-amber-300 rounded-lg p-4 shadow-2xs">
                                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                                  <AlertTriangle className="w-4.5 h-4.5 text-amber-600 shrink-0" />
                                  <span>Ponto Cego Identificado: Cancelamento de Contrato sem Ordem de Recolhimento</span>
                                </div>
                                <p className="text-slate-700 text-xs leading-relaxed">
                                  Este cliente sofreu cancelamento de contrato (motivo: <strong>{order.causa || 'Inadimplência'}</strong>) no período de competência, porém <strong>nenhuma OS de retirada de equipamento foi aberta no RBX</strong>. O aparelho (ONT/Roteador em comodato) permanece com o cliente sem qualquer chamado de busca agendado para o time de campo.
                                </p>
                                <div className="flex flex-wrap items-center gap-2.5 pt-2 text-[11px] text-amber-950 font-medium">
                                  <span className="bg-white px-2.5 py-1 rounded border border-amber-200 shadow-2xs">
                                    Código Cliente RBX: <strong className="font-mono">{order.codigoCliente}</strong>
                                  </span>
                                  <span className="bg-white px-2.5 py-1 rounded border border-amber-200 shadow-2xs">
                                    Contrato: <strong className="font-mono">{order.contrato || 'N/I'}</strong>
                                  </span>
                                  <span className="bg-white px-2.5 py-1 rounded border border-amber-200 shadow-2xs">
                                    Data de Bloqueio/Cancelamento: <strong>{formatDate(order.dataAbertura)}</strong>
                                  </span>
                                  <span className="bg-white px-2.5 py-1 rounded border border-amber-200 shadow-2xs text-amber-800">
                                    Ação recomendada: <strong>Abrir chamado de Retirada de Equipamento no RBX</strong>
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {order.ehDuplicado && (
                                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span>
                                      <strong>Cadastro Duplo Identificado no RBX:</strong> Este cliente possui variações de formatação de código no sistema (com e sem pontuação). Por padrão, o sistema mantém as duplicatas <strong>ocultas</strong> para não duplicar OSs nem distorcer as taxas operacionais.
                                    </span>
                                  </div>
                                )}

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

                                {/* Flows Timeline (if ticket has multiple flows in RBX) */}
                                {(() => {
                                  const flows = parseFlows(order.assunto);
                                  if (flows.length === 0) return null;
                                  return (
                                    <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                                      <div className="flex items-center gap-1.5 text-slate-800 font-bold border-b border-slate-100 pb-1.5 mb-2.5">
                                        <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
                                        <span>Histórico de Fluxos e Tramitações no RBX ({flows.length} etapas registradas)</span>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                        {flows.map((flow, idx) => (
                                          <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 text-xs space-y-1">
                                            <div className="flex items-center justify-between font-semibold text-slate-900 pb-1 border-b border-slate-200/60">
                                              <span className="flex items-center gap-1.5">
                                                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center text-[10px] font-bold">
                                                  {idx + 1}
                                                </span>
                                                {flow.topico}
                                              </span>
                                              <span className="text-[10px] text-slate-500 font-normal">
                                                {flow.abertura} {flow.encerramento ? `➔ ${flow.encerramento}` : ''}
                                              </span>
                                            </div>
                                            {flow.causa && (
                                              <div className="text-[11px] text-slate-700">
                                                Desfecho: <strong>{flow.causa}</strong> {flow.usuario ? `• Operador: ${flow.usuario}` : ''}
                                              </div>
                                            )}
                                            {flow.detalhes && (
                                              <div className="text-[10px] text-slate-600 font-mono bg-white p-1.5 rounded border border-slate-200/60 leading-relaxed">
                                                {flow.detalhes}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
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
  )}
</div>

  {/* Modal de Prévia Executiva A4 */}
  {isPreviewOpen && (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto no-print">
      <div className="bg-slate-100 rounded-xl max-w-4xl w-full max-h-[95vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden">
        {/* Modal Header */}
        <div className="bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <span className="font-bold text-sm text-slate-800">
              Prévia do Relatório Executivo de Equipamentos (Folha A4)
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir Agora (PDF)</span>
            </button>
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded transition cursor-pointer"
              title="Fechar prévia"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        {/* Modal Body: A4 Sheet Preview */}
        <div className="p-4 sm:p-6 overflow-y-auto flex justify-center bg-slate-200/70">
          <div className="bg-white shadow-2xl rounded-sm max-w-[780px] w-full border border-slate-300">
            <EquipmentPrintReport
              orders={data?.orders || []}
              summary={summary}
              selectedMonth={selectedMonth}
              hardwareUnitValue={hardwareUnitPrice}
            />
          </div>
        </div>
      </div>
    </div>
  )}

  {/* Modal de Definição do Custo do Equipamento */}
  {isPriceModalOpen && (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 no-print animate-fade-in">
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-blue-500/20 rounded-lg text-blue-400">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                Definir Valor do Equipamento
              </h3>
              <p className="text-[11px] text-slate-400">
                Cálculo da exposição patrimonial em comodato
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsPriceModalOpen(false)}
            className="p-1 text-slate-400 hover:text-white rounded transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Informe o valor médio de reposição por aparelho comodatado (ONU / Roteador Wi-Fi). Todos os indicadores de <strong>Patrimônio em Risco</strong>, <strong>Patrimônio Salvo</strong> e o <strong>Relatório Executivo de Impressão</strong> serão recalculados instantaneamente com este valor.
          </p>

          {/* Input Customizado */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Valor Unitário Estimado (R$)
            </label>
            <div className="flex items-center bg-slate-50 border-2 border-slate-300 focus-within:border-blue-600 focus-within:bg-white rounded-lg px-3 py-2 transition shadow-inner">
              <span className="text-sm font-bold text-slate-500 mr-2">R$</span>
              <input
                type="number"
                min="1"
                step="5"
                value={tempPriceInput}
                onChange={(e) => setTempPriceInput(e.target.value)}
                placeholder="Ex: 220,00"
                className="w-full text-base font-extrabold text-slate-900 bg-transparent outline-none border-none"
                autoFocus
              />
            </div>
          </div>

          {/* Sugestões Rápidas de Modelos de Mercado */}
          <div>
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Modelos e Valores Típicos de Provedores:
            </span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'ONU Básica / Bridge', value: 150 },
                { label: 'ONU Wi-Fi AC Dual Band (Padrão)', value: 220 },
                { label: 'ONU Wi-Fi 6 AX Gigabit', value: 280 },
                { label: 'Roteador Mesh Especial', value: 350 },
              ].map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setTempPriceInput(preset.value.toString())}
                  className={`text-left p-2.5 rounded-lg border text-xs transition cursor-pointer ${
                    parseFloat(tempPriceInput) === preset.value
                      ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold ring-1 ring-blue-500'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="font-bold text-slate-900">R$ {preset.value},00</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{preset.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Totalizador de Simulação em Tempo Real */}
          {(() => {
            const simPrice = parseFloat(tempPriceInput) || 0;
            const totalSim = (summary.totalOrders || 0) * simPrice;
            return (
              <div className="bg-slate-100/80 rounded-lg p-3 border border-slate-200 flex justify-between items-center text-xs">
                <span className="text-slate-600 font-medium">
                  Simulação ({summary.totalOrders} aparelhos):
                </span>
                <strong className="text-slate-900 font-extrabold text-sm">
                  {formatCurrency(totalSim)}
                </strong>
              </div>
            );
          })()}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={() => setIsPriceModalOpen(false)}
            className="px-3.5 py-1.5 border border-slate-300 hover:bg-white text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => handleSavePrice(parseFloat(tempPriceInput) || 220)}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
          >
            Salvar e Recalcular Indicadores
          </button>
        </div>
      </div>
    </div>
  )}
</div>
  );
};
