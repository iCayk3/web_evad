import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Clock,
  User,
  Wrench,
  AlertCircle,
  CheckCircle2,
  Calendar,
  FileText,
  CheckSquare,
  History,
  ShieldCheck,
  Ban,
  RotateCw,
  AlertTriangle,
  Package,
  ArrowRightLeft,
  Activity,
  Search,
  MapPin,
  Laptop,
  Briefcase,
  PhoneCall,
  Layers,
  ChevronDown,
  ChevronUp,
  Cpu,
  FileSpreadsheet,
} from 'lucide-react';
import { OsTicketDto, OsTicketOccurrence, OsFinalizedFlow } from '../types.ts';
import { apiFetch } from '../../../lib/api.ts';

interface OsDetailModalProps {
  ticket: OsTicketDto | null;
  onClose: () => void;
}

export const OsDetailModal: React.FC<OsDetailModalProps> = ({ ticket, onClose }) => {
  // 1-4. Estados do componente (executados incondicionalmente no topo)
  const [occurrences, setOccurrences] = useState<OsTicketOccurrence[]>([]);
  const [loadingOccurrences, setLoadingOccurrences] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'manual' | 'status' | 'material'>('all');
  const [occurrenceSearch, setOccurrenceSearch] = useState('');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // 5. Efeito para sincronização e consulta de ocorrências
  useEffect(() => {
    if (!ticket) {
      setOccurrences([]);
      setFilterType('all');
      setOccurrenceSearch('');
      setShowTechnicalDetails(false);
      return;
    }

    if (ticket.ocorrencias && ticket.ocorrencias.length > 0) {
      setOccurrences(ticket.ocorrencias);
    } else {
      fetchOccurrences(ticket.id);
    }
  }, [ticket]);

  // 6. Memo para extração/parse dos fluxos finalizados (com fallback seguro no cliente)
  const finalizedFlows: OsFinalizedFlow[] = useMemo(() => {
    if (!ticket) return [];
    if (ticket.finalizedFlows && ticket.finalizedFlows.length > 0) {
      return ticket.finalizedFlows;
    }

    const text = `${ticket.description || ''}\n${ticket.solution || ''}`;
    if (!text.includes('Fluxo finalizado')) return [];

    // Fallback de parse no frontend
    const flowHeaderRegex = /\/#\s*###\s*Fluxo finalizado:[^#\r\n]*#?\s*###?/gi;
    const matches: { index: number; text: string }[] = [];
    let match: RegExpExecArray | null;

    while ((match = flowHeaderRegex.exec(text)) !== null) {
      matches.push({ index: match.index, text: match[0] });
    }

    if (matches.length === 0) return [];

    const result: OsFinalizedFlow[] = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      let end = i + 1 < matches.length ? matches[i + 1].index : text.length;
      for (const stopTag of ['/# ### AUTENTICAÇÕES', '/# ### CONTRATOS', '/# ### EQUIPAMENTOS', '/# PROTOCOLO:']) {
        const stopIdx = text.indexOf(stopTag, start);
        if (stopIdx !== -1 && stopIdx < end) {
          end = stopIdx;
        }
      }

      const block = text.slice(start, end);
      const getVal = (pattern: RegExp) => {
        const m = pattern.exec(block);
        return m ? m[1].trim() : '';
      };

      const topicRaw = getVal(/\/#\s*Tópico\s*:\s*(.*?)\s*#/i);
      const causeRaw = getVal(/\/#\s*Causa\s*:\s*(.*?)\s*#/i);
      const durationRaw = getVal(/\/#\s*Duração\s*:\s*(.*?)\s*#/i);
      const openedAt = getVal(/\/#\s*Data\/Hora Abertura\s*:\s*([0-9\/:\s]+)\s*#/i);
      const closedAt = getVal(/\/#\s*Data\/Hora Encerramento\s*:\s*([0-9\/:\s]+)\s*#/i);
      const user = getVal(/\/#\s*Usuário\s*:\s*(.*?)\s*#/i);
      const sector = getVal(/\/#\s*Setor\/Grupo\s*:\s*(.*?)\s*#/i);

      if (!topicRaw && !causeRaw && !user) continue;

      const parseParenthesis = (val: string) => {
        const pMatch = /^\s*\((.*?)\)\s*(.*)$/.exec(val);
        if (pMatch) {
          return { prefix: pMatch[1].trim(), name: pMatch[2].trim() || pMatch[1].trim() };
        }
        return { prefix: '', name: val.trim() };
      };

      const topicP = parseParenthesis(topicRaw);
      const causeP = parseParenthesis(causeRaw);

      let locality = '';
      const combUpper = `${topicRaw} ${causeRaw}`.toUpperCase();
      if (combUpper.includes('PIRABAS') || combUpper.includes('SJP')) locality = 'São José dos Pinhais (SJP)';
      else if (combUpper.includes('QUATIPURU') || combUpper.includes('QT')) locality = 'Quatipuru (QT)';
      else if (combUpper.includes('BOA VISTA') || combUpper.includes('BV')) locality = 'Boa Vista (BV)';
      else if (combUpper.includes('MAGALHÃES BARATA') || combUpper.includes('MGB')) locality = 'Magalhães Barata (MGB)';
      else if (combUpper.includes('PRIMAVERA') || combUpper.includes('PMV')) locality = 'Primavera (PMV)';
      else if (combUpper.includes('MARACANÃ')) locality = 'Maracanã';

      let flowType = 'Outro';
      const cUpper = `${topicRaw} ${causeRaw} ${sector} ${user}`.toUpperCase();
      if (cUpper.includes('FEEDBACK') || cUpper.includes('SUPERVISÃO')) flowType = 'Supervisão / Feedback';
      else if (cUpper.includes('SOLUÇÃO REMOTA') || cUpper.includes('REMOTAMENTE') || cUpper.includes('TROCA DE SENHA')) flowType = 'Solução Remota';
      else if (cUpper.includes('LOCALIDADE') && cUpper.includes('SERVIÇOS')) flowType = 'Triagem / Roteamento';
      else if (cUpper.includes('TÉCNICO') || cUpper.includes('REPARO') || cUpper.includes('FUSÃO') || cUpper.includes('DROP') || cUpper.includes('CONECTOR') || cUpper.includes('GOL.')) flowType = 'Presencial / Campo';
      else if (cUpper.includes('COMERCIAL') || cUpper.includes('ESTOQUE') || cUpper.includes('VENDAS')) flowType = 'Comercial / Apoio';

      // Action note
      let actionNote = '';
      const sectorIdx = block.indexOf('Setor/Grupo:');
      if (sectorIdx !== -1) {
        const afterSector = block.slice(sectorIdx);
        const closeTagIdx = afterSector.indexOf('#/');
        if (closeTagIdx !== -1) {
          const rawNote = afterSector.slice(closeTagIdx + 2).trim();
          const cleanLines = rawNote.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('/#'));
          if (cleanLines.length > 0) actionNote = cleanLines.join('\n');
        }
      }

      result.push({
        index: i + 1,
        topicRaw,
        topicPrefix: topicP.prefix,
        topicName: topicP.name,
        causeRaw,
        causePrefix: causeP.prefix,
        causeName: causeP.name,
        durationRaw,
        openedAt,
        closedAt,
        durationMinutes: 0,
        durationFormatted: durationRaw || '-',
        user,
        sector,
        actionNote,
        flowType,
        locality,
      });
    }

    return result;
  }, [ticket]);

  // 7. Memo para extrair a demanda pura e metadados de autenticação/contrato/equipamentos
  const parsedTechnicalData = useMemo(() => {
    if (!ticket?.description) return null;
    const text = ticket.description;

    // Demanda do cliente (texto limpo antes de blocos /#)
    const firstTagIdx = text.indexOf('/#');
    const cleanDemand = firstTagIdx !== -1 ? text.slice(0, firstTagIdx).trim() : text.trim();

    // Autenticações
    let authInfo: { login?: string; nas?: string; porta?: string; mac?: string } | null = null;
    const loginMatch = /\/#\s*Login:\s*([^\s#]+)/i.exec(text);
    const nasMatch = /\/#\s*NAS:\s*([^#]+)/i.exec(text);
    const macMatch = /\/#\s*MAC:\s*([^\s#]+)/i.exec(text);
    if (loginMatch || nasMatch || macMatch) {
      authInfo = {
        login: loginMatch ? loginMatch[1].trim() : undefined,
        nas: nasMatch ? nasMatch[1].trim() : undefined,
        mac: macMatch ? macMatch[1].trim() : undefined,
      };
    }

    // Contrato & Plano
    let planInfo: { contract?: string; plan?: string; date?: string } | null = null;
    const contMatch = /\/#\s*Contrato:\s*([^\s#]+)/i.exec(text);
    const planMatch = /\/#\s*Plano:\s*([^#]+)/i.exec(text);
    if (contMatch || planMatch) {
      planInfo = {
        contract: contMatch ? contMatch[1].trim() : undefined,
        plan: planMatch ? planMatch[1].trim() : undefined,
      };
    }

    // Equipamentos
    const equipments: string[] = [];
    const equipRegex = /\/#\s*Ori:\s*Comodato\s*Equip:\s*([^#]+)#\//gi;
    let eqMatch: RegExpExecArray | null;
    while ((eqMatch = equipRegex.exec(text)) !== null) {
      equipments.push(eqMatch[1].trim());
    }

    return {
      cleanDemand,
      authInfo,
      planInfo,
      equipments,
      hasTechSpecs: Boolean(authInfo || planInfo || equipments.length > 0),
    };
  }, [ticket?.description]);

  // 8. Memo para filtragem e busca de ocorrências
  const filteredOccurrences = useMemo(() => {
    let list = occurrences;

    if (filterType === 'manual') {
      list = list.filter((o) => o.modo === 'M');
    } else if (filterType === 'status') {
      list = list.filter(
        (o) =>
          o.texto.toLowerCase().includes('situa') ||
          o.texto.toLowerCase().includes('designa') ||
          o.texto.toLowerCase().includes('fila') ||
          o.texto.toLowerCase().includes('caminho') ||
          o.texto.toLowerCase().includes('abort') ||
          o.texto.toLowerCase().includes('encerr')
      );
    } else if (filterType === 'material') {
      list = list.filter(
        (o) =>
          o.texto.toLowerCase().includes('faturamento') ||
          o.texto.toLowerCase().includes('comodato') ||
          o.texto.toLowerCase().includes('equipamento')
      );
    }

    if (occurrenceSearch.trim() !== '') {
      const term = occurrenceSearch.toLowerCase().trim();
      list = list.filter(
        (o) =>
          o.texto.toLowerCase().includes(term) ||
          o.autor.toLowerCase().includes(term) ||
          o.data.includes(term)
      );
    }

    return list;
  }, [occurrences, filterType, occurrenceSearch]);

  // 9. Memo para contadores das pílulas
  const counts = useMemo(() => {
    let manual = 0;
    let status = 0;
    let material = 0;
    for (const o of occurrences) {
      const txt = o.texto.toLowerCase();
      if (o.modo === 'M') manual++;
      if (
        txt.includes('situa') ||
        txt.includes('designa') ||
        txt.includes('fila') ||
        txt.includes('caminho') ||
        txt.includes('abort') ||
        txt.includes('encerr')
      ) {
        status++;
      }
      if (txt.includes('faturamento') || txt.includes('comodato') || txt.includes('equipamento')) {
        material++;
      }
    }
    return { all: occurrences.length, manual, status, material };
  }, [occurrences]);

  const fetchOccurrences = async (ticketId: number) => {
    setLoadingOccurrences(true);
    try {
      const res = await apiFetch<{ occurrences: OsTicketOccurrence[] }>(
        `/api/os-analytics/tickets/${ticketId}/occurrences`
      );
      if (res && Array.isArray(res.occurrences)) {
        setOccurrences(res.occurrences);
      }
    } catch (err) {
      console.warn('Falha ao carregar ocorrências via API:', err);
    } finally {
      setLoadingOccurrences(false);
    }
  };

  // Se não houver ticket selecionado, retorna nulo APÓS todos os hooks
  if (!ticket) return null;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr.replace(' ', 'T'));
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Concluído':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Concluído
          </span>
        );
      case 'Em Andamento':
      case 'Aberto':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      case 'Pendente':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertCircle className="w-3.5 h-3.5" />
            Pendente
          </span>
        );
      case 'Cancelado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <Ban className="w-3.5 h-3.5" />
            Abortada
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const getFlowTypeBadge = (flowType: string) => {
    switch (flowType) {
      case 'Solução Remota':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <Laptop className="w-3 h-3 text-sky-600" />
            Solução Remota
          </span>
        );
      case 'Presencial / Campo':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Wrench className="w-3 h-3 text-emerald-600" />
            Presencial / Campo
          </span>
        );
      case 'Triagem / Roteamento':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <ArrowRightLeft className="w-3 h-3 text-indigo-600" />
            Triagem / Roteamento
          </span>
        );
      case 'Comercial / Apoio':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Briefcase className="w-3 h-3 text-purple-600" />
            Comercial / Apoio
          </span>
        );
      case 'Supervisão / Feedback':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <PhoneCall className="w-3 h-3 text-amber-600" />
            Supervisão / Feedback
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <Layers className="w-3 h-3 text-slate-500" />
            {flowType || 'Etapa'}
          </span>
        );
    }
  };

  const getOccurrenceBadge = (occ: OsTicketOccurrence) => {
    const text = (occ.texto || '').toLowerCase();
    if (text.includes('abort') || text.includes('cancel')) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <Ban className="w-2.5 h-2.5" />
          Abortamento
        </span>
      );
    }
    if (text.includes('item de faturamento') || text.includes('comodato') || text.includes('equipamento')) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          <Package className="w-2.5 h-2.5" />
          Material / Equipamento
        </span>
      );
    }
    if (text.includes('designado') || text.includes('designa')) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <ArrowRightLeft className="w-2.5 h-2.5" />
          Designação
        </span>
      );
    }
    if (text.includes('situação') || text.includes('situacao')) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
          <Activity className="w-2.5 h-2.5" />
          Status
        </span>
      );
    }
    if (text.includes('encerrad') || text.includes('conclu')) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-2.5 h-2.5" />
          Encerramento
        </span>
      );
    }
    if (occ.modo === 'M') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <User className="w-2.5 h-2.5" />
          Nota Manual
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        <History className="w-2.5 h-2.5" />
        Sistema
      </span>
    );
  };

  const renderOccurrenceContent = (rawText: string) => {
    if (!rawText) return null;

    const lines = rawText
      .replace(/<br\s*[\/]?>/gi, '\n')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    return (
      <div className="space-y-1">
        {lines.map((line, idx) => {
          const parts = line.split(/(<b>.*?<\/b>)/gi);
          return (
            <div key={idx} className="leading-relaxed">
              {parts.map((part, pIdx) => {
                if (part.toLowerCase().startsWith('<b>') && part.toLowerCase().endsWith('</b>')) {
                  const inner = part.replace(/<\/?b>/gi, '').trim();
                  return (
                    <strong key={pIdx} className="font-semibold text-slate-900 mx-0.5">
                      {inner}
                    </strong>
                  );
                }
                return <span key={pIdx}>{part}</span>;
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const isAborted = ticket.status === 'Cancelado';
  const lastOccurrence = occurrences.length > 0 ? occurrences[occurrences.length - 1] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Cabeçalho Enxuto */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-brand-primary flex items-center justify-center shrink-0">
              <Wrench className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-slate-900 tracking-tight font-mono">
                  {ticket.protocol}
                </span>
                {getStatusBadge(ticket.status)}
                {ticket.concludedWithinSla !== null && !isAborted && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                      ticket.concludedWithinSla
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    <ShieldCheck className="w-3 h-3" />
                    {ticket.concludedWithinSla ? 'No SLA' : 'Fora do SLA'}
                  </span>
                )}
                {ticket.primaryLocality && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    <MapPin className="w-3 h-3 text-slate-500" />
                    {ticket.primaryLocality}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                <strong className="text-slate-800 font-semibold">{ticket.clientName}</strong>
                {ticket.clientId > 0 && <span className="font-mono text-slate-400 ml-1.5">(Cód. RBX: {ticket.clientId})</span>}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo com rolagem */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* Alerta Destacado para OS Abortada com Justificativa Real */}
          {isAborted && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200/80 space-y-2">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Ordem de Serviço Abortada / Cancelada</span>
              </div>
              <div className="text-xs text-rose-950 leading-relaxed bg-white/70 p-3 rounded-lg border border-rose-200/60">
                <div className="font-semibold text-rose-900 mb-1">Motivo / Justificativa Registrada:</div>
                <div className="font-medium text-slate-900">
                  {renderOccurrenceContent(
                    ticket.solution || lastOccurrence?.texto || ticket.description || 'Baixa realizada sem solução técnica executada.'
                  )}
                </div>
              </div>
              {lastOccurrence && (
                <div className="text-[11px] text-rose-700/90 flex flex-wrap items-center gap-3 pt-1 border-t border-rose-200/60">
                  <span>Autor da baixa: <strong className="font-semibold">{lastOccurrence.autor}</strong></span>
                  <span>Data da ocorrência: <strong className="font-semibold">{formatDate(lastOccurrence.data)}</strong></span>
                </div>
              )}
            </div>
          )}

          {/* Grid de Metadados Principais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/90 p-4 rounded-xl border border-slate-200/60">
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Técnico Designado</div>
              <div className="font-semibold text-slate-900 truncate mt-0.5">{ticket.technicianName}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Tópico Inicial</div>
              <div className="font-semibold text-slate-900 truncate mt-0.5">{ticket.topicName}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Causa / Diagnóstico</div>
              <div className="font-semibold text-slate-900 truncate mt-0.5">{ticket.causeName}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Categoria de Resolução</div>
              <div className="font-semibold text-slate-900 truncate mt-0.5">
                {ticket.flowCategory || (ticket.hasRemoteSolution ? 'Solução Remota' : ticket.hasFieldWork ? 'Presencial / Campo' : 'Padrão')}
              </div>
            </div>
          </div>

          {/* Linha de Datas e Prazos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-white border border-slate-200/70">
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-semibold uppercase">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                Abertura
              </div>
              <div className="font-medium text-slate-900 mt-1">{formatDate(ticket.createdAt)}</div>
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200/70">
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-semibold uppercase">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                Limite SLA
              </div>
              <div className="font-medium text-slate-900 mt-1">{formatDate(ticket.slaDueAt)}</div>
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200/70 col-span-2 sm:col-span-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-semibold uppercase">
                {isAborted ? (
                  <Ban className="w-3.5 h-3.5 text-rose-500" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                )}
                {isAborted ? 'Cancelamento' : 'Encerramento'}
              </div>
              <div className="font-medium text-slate-900 mt-1">{formatDate(ticket.concludedAt)}</div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* NOVO BLOCO ENRIQUECIDO: Histórico & Ciclo de Vida dos Fluxos (RBX)       */}
          {/* ========================================================================= */}
          {finalizedFlows.length > 0 && (
            <div className="space-y-3 p-4 rounded-xl bg-linear-to-br from-slate-50 via-blue-50/20 to-slate-50 border border-blue-200/60 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/70">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 tracking-tight flex items-center gap-2">
                      Ciclo de Vida & Fluxos da OS
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-100 text-blue-800">
                        {finalizedFlows.length} {finalizedFlows.length === 1 ? 'etapa' : 'etapas'}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Rastreabilidade dos fluxos executados no atendimento
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {ticket.hasRemoteSolution && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-sky-100 text-sky-800 border border-sky-300">
                      <Laptop className="w-3 h-3" />
                      Solução Remota
                    </span>
                  )}
                  {ticket.hasFieldWork && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <Wrench className="w-3 h-3" />
                      Atendimento em Campo
                    </span>
                  )}
                </div>
              </div>

              {/* Lista Vertical de Fluxos Finalizados */}
              <div className="space-y-3 pt-1">
                {finalizedFlows.map((flow) => (
                  <div
                    key={flow.index}
                    className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:border-blue-300 transition-all space-y-2.5"
                  >
                    {/* Linha 1: Metadados do Fluxo */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                          {flow.index}
                        </span>
                        {getFlowTypeBadge(flow.flowType)}
                        {flow.sector && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {flow.sector}
                          </span>
                        )}
                        {flow.locality && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <MapPin className="w-3 h-3 text-blue-500" />
                            {flow.locality}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        {flow.user && (
                          <span className="flex items-center gap-1 font-medium text-slate-700">
                            <User className="w-3 h-3 text-slate-400" />
                            {flow.user}
                          </span>
                        )}
                        {flow.durationFormatted && flow.durationFormatted !== '-' && (
                          <span className="flex items-center gap-1 font-mono font-semibold text-brand-primary bg-blue-50/80 px-2 py-0.5 rounded border border-blue-100">
                            <Clock className="w-3 h-3" />
                            {flow.durationFormatted}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Linha 2: Tópico & Causa com Destaques */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/60">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                          Tópico do Fluxo
                        </div>
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                          {flow.topicPrefix && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-200 text-slate-800">
                              {flow.topicPrefix}
                            </span>
                          )}
                          <span>{flow.topicName || flow.topicRaw}</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/60">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                          Causa / Ação Executada
                        </div>
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                          {flow.causePrefix && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-900">
                              {flow.causePrefix}
                            </span>
                          )}
                          <span>{flow.causeName || flow.causeRaw}</span>
                        </div>
                      </div>
                    </div>

                    {/* Linha 3: Datas de Execução */}
                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <div>
                        Abertura: <strong className="text-slate-800 font-mono">{flow.openedAt || '-'}</strong>
                      </div>
                      <div>
                        Encerramento: <strong className="text-slate-800 font-mono">{flow.closedAt || '-'}</strong>
                      </div>
                    </div>

                    {/* Linha 4: Instrução / Próxima Ação do Fluxo (se houver) */}
                    {flow.actionNote && (
                      <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-200/70 text-[11px] text-amber-900 space-y-0.5">
                        <div className="font-semibold text-[10px] uppercase tracking-wider text-amber-800">
                          Instruções / Ações do Fluxo:
                        </div>
                        <div className="whitespace-pre-line leading-relaxed font-medium">
                          {flow.actionNote}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Demanda do Chamado (Texto limpo) */}
          {parsedTechnicalData?.cleanDemand && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                Descrição da Demanda
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 leading-relaxed text-slate-800 whitespace-pre-wrap">
                {parsedTechnicalData.cleanDemand}
              </div>
            </div>
          )}

          {/* Metadados Técnicos Estruturados (Autenticações, Contratos e Equipamentos) */}
          {parsedTechnicalData?.hasTechSpecs && (
            <div className="border border-slate-200/70 rounded-xl overflow-hidden bg-slate-50/50">
              <button
                type="button"
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-800 hover:bg-slate-100/70 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-brand-primary" />
                  <span>Dados Técnicos do Circuito & Equipamentos (RBX)</span>
                  {parsedTechnicalData.equipments.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-100 text-purple-700">
                      {parsedTechnicalData.equipments.length} equipamento(s)
                    </span>
                  )}
                </div>
                {showTechnicalDetails ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>

              {showTechnicalDetails && (
                <div className="p-4 pt-1 space-y-3 border-t border-slate-200/70 bg-white">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Autenticações */}
                    {parsedTechnicalData.authInfo && (
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 space-y-1">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Parâmetros de Conexão / NAS
                        </div>
                        {parsedTechnicalData.authInfo.login && (
                          <div>Login: <strong className="font-mono text-slate-900">{parsedTechnicalData.authInfo.login}</strong></div>
                        )}
                        {parsedTechnicalData.authInfo.nas && (
                          <div>NAS: <strong className="font-mono text-slate-900">{parsedTechnicalData.authInfo.nas}</strong></div>
                        )}
                        {parsedTechnicalData.authInfo.mac && (
                          <div>MAC: <strong className="font-mono text-slate-900">{parsedTechnicalData.authInfo.mac}</strong></div>
                        )}
                      </div>
                    )}

                    {/* Contrato */}
                    {parsedTechnicalData.planInfo && (
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 space-y-1">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Contrato & Plano
                        </div>
                        {parsedTechnicalData.planInfo.contract && (
                          <div>Contrato: <strong className="font-mono text-slate-900">{parsedTechnicalData.planInfo.contract}</strong></div>
                        )}
                        {parsedTechnicalData.planInfo.plan && (
                          <div>Plano: <strong className="text-slate-900">{parsedTechnicalData.planInfo.plan}</strong></div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Equipamentos em comodato */}
                  {parsedTechnicalData.equipments.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Equipamentos em Comodato / Estrutura
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {parsedTechnicalData.equipments.map((eq, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-purple-50 text-purple-800 border border-purple-200"
                          >
                            <Package className="w-3 h-3 text-purple-600 shrink-0" />
                            {eq}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Solução Técnica Homologada (quando cadastrada na OS) */}
          {ticket.solution && !isAborted && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Parecer Técnico / Solução Homologada
              </div>
              <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200/70 leading-relaxed text-emerald-950 font-medium whitespace-pre-wrap">
                {ticket.solution}
              </div>
            </div>
          )}

          {/* Checklist Operacional */}
          {ticket.checklist && ticket.checklist.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                Checklist de Execução
              </div>
              <div className="space-y-1.5">
                {ticket.checklist.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50/80 border border-slate-200/50"
                  >
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                        item.concluido ? 'bg-emerald-500 text-white' : 'border border-slate-300'
                      }`}
                    >
                      {item.concluido && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                    <span className={item.concluido ? 'text-slate-800' : 'text-slate-500'}>
                      {item.item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linha do Tempo de Ocorrências / Movimentações via API */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-brand-primary" />
                <span className="text-xs font-bold text-slate-900">
                  Movimentações & Ocorrências da API
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200/70">
                  {occurrences.length} evento(s)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3 h-3 absolute left-2 top-2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filtrar eventos..."
                    value={occurrenceSearch}
                    onChange={(e) => setOccurrenceSearch(e.target.value)}
                    className="pl-7 pr-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-primary w-36"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fetchOccurrences(ticket.id)}
                  disabled={loadingOccurrences}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors border border-slate-200/80"
                  title="Atualizar ocorrências da API"
                >
                  <RotateCw className={`w-3 h-3 ${loadingOccurrences ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Pílulas de Filtro Rápido */}
            {occurrences.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                    filterType === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todas ({counts.all})
                </button>
                {counts.status > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterType('status')}
                    className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                      filterType === 'status'
                        ? 'bg-sky-600 text-white'
                        : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                    }`}
                  >
                    Status & Despacho ({counts.status})
                  </button>
                )}
                {counts.material > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterType('material')}
                    className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                      filterType === 'material'
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                    }`}
                  >
                    Materiais ({counts.material})
                  </button>
                )}
                {counts.manual > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterType('manual')}
                    className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                      filterType === 'manual'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    Notas Manuais ({counts.manual})
                  </button>
                )}
              </div>
            )}

            {loadingOccurrences ? (
              <div className="p-6 rounded-xl bg-slate-50 border border-slate-100 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                <RotateCw className="w-4 h-4 animate-spin text-brand-primary" />
                <span>Consultando histórico de movimentações na API oficial...</span>
              </div>
            ) : filteredOccurrences.length > 0 ? (
              <div className="space-y-2.5 border-l-2 border-blue-200/80 ml-2 pl-4 py-1">
                {filteredOccurrences.map((occ) => {
                  const isAbortEvent =
                    occ.texto.toLowerCase().includes('abort') ||
                    occ.texto.toLowerCase().includes('cancel');
                  const isMaterialEvent =
                    occ.texto.toLowerCase().includes('item de faturamento') ||
                    occ.texto.toLowerCase().includes('comodato');

                  return (
                    <div key={occ.id} className="relative group">
                      <div
                        className={`absolute -left-[21px] top-2.5 w-2.5 h-2.5 rounded-full ring-4 ring-white ${
                          isAbortEvent
                            ? 'bg-rose-500'
                            : isMaterialEvent
                            ? 'bg-purple-500'
                            : 'bg-blue-500'
                        }`}
                      />
                      <div
                        className={`p-3 rounded-xl border text-xs transition-colors ${
                          isAbortEvent
                            ? 'bg-rose-50/70 border-rose-200'
                            : isMaterialEvent
                            ? 'bg-purple-50/50 border-purple-200/70'
                            : 'bg-slate-50/90 border-slate-200/70 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" />
                              {occ.autor || 'Sistema'}
                            </span>
                            {getOccurrenceBadge(occ)}
                          </div>
                          <span className="text-slate-500 font-mono text-[11px]">
                            {formatDate(occ.data)}
                          </span>
                        </div>
                        <div className="text-slate-800 font-normal leading-relaxed text-xs">
                          {renderOccurrenceContent(occ.texto)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : occurrences.length > 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-slate-500 text-xs">
                Nenhum evento corresponde ao filtro ou busca selecionada.
              </div>
            ) : (
              <div className="p-5 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-slate-400 text-xs">
                Nenhuma ocorrência registrada nesta Ordem de Serviço na API do RBXSoft.
              </div>
            )}
          </div>
        </div>

        {/* Rodapé Enxuto */}
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-end bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
