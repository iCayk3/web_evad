import React, { useEffect, useState } from 'react';
import { X, Download, AlertTriangle, Clock, CheckCircle, FileText, ArrowRight, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { Badge } from '../../components/common/Badge.tsx';
import { PillButton } from '../../components/common/PillButton.tsx';

interface DrillDownDrawerProps {
  isOpen: boolean;
  metricId: string | null;
  cellKey: string | null;
  period?: 'today' | '7d' | '30d';
  type?: string;
  topics?: string[];
  onClose: () => void;
  onSelectTicket: (ticketId: number) => void;
}

export const DrillDownDrawer: React.FC<DrillDownDrawerProps> = ({
  isOpen,
  metricId,
  cellKey,
  period,
  type,
  topics,
  onClose,
  onSelectTicket,
}) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (isOpen && (metricId || cellKey)) {
      fetchDrillDownData();
    } else {
      setTickets([]);
    }
  }, [isOpen, metricId, cellKey, period, type, JSON.stringify(topics)]);

  const fetchDrillDownData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ tickets: any[] }>('/api/analytics/drilldown', {
        method: 'POST',
        body: JSON.stringify({
          metricId: metricId || 'geral',
          cellKey: cellKey || undefined,
          period: period || '7d',
          type: type || undefined,
          topics: topics && topics.length > 0 ? topics : undefined,
        }),
      });
      setTickets(res.tickets);
    } catch (e) {
      console.error('Erro ao carregar dados de drill-down:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const csvText = await apiFetch<string>('/api/analytics/export', {
        method: 'POST',
        body: JSON.stringify({
          metricId: metricId || 'geral',
          cellKey: cellKey || undefined,
          period: period || '7d',
          type: type || undefined,
          topics: topics && topics.length > 0 ? topics : undefined,
        }),
      });

      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `rbxhub_${metricId || 'analise'}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Falha ao exportar relatório. Verifique suas permissões RBAC.');
    } finally {
      setExporting(false);
    }
  };

  const getMetricLabel = (id: string | null) => {
    switch (id) {
      case 'atendimentos_abertos': return 'Chamados Abertos em Fila';
      case 'sla_vencido': return 'Chamados com Prazo Vencido';
      case 'sla_em_risco': return 'Chamados com Prazo em Risco (< 60 min)';
      case 'entradas_periodo': return 'Novos Chamados Recebidos no Período';
      case 'concluidos_periodo': return 'Chamados Concluídos no Período';
      case 'taxa_cumprimento_sla': return 'Chamados com Prazo Concluído';
      case 'clientes_com_recorrencia': return 'Clientes com Múltiplos Chamados (Recorrentes)';
      default: return id || 'Todos os Chamados';
    }
  };

  if (!isOpen) return null;

  const canExport = ['admin', 'gestor', 'supervisor'].includes(user?.role || '');

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-white h-full shadow-signature flex flex-col justify-between border-l border-slate-200/80 rounded-l-3xl overflow-hidden animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-modal="true"
        aria-label="Lista de Chamados Detalhados"
      >
        {/* Cabeçalho do Painel Lateral */}
        <div className="p-6 border-b border-slate-100 bg-white flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-primary">
              Detalhamento de Chamados
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1">
              {getMetricLabel(metricId)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Chamados reais registrados no RBXSoft {cellKey ? `[Cruzamento: ${cellKey}]` : ''}
            </p>

            {/* Indicadores de Filtros Ativos em Pílula */}
            {(period || type || (topics && topics.length > 0)) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5 text-xs">
                {period && (
                  <Badge variant="neutral" className="text-[10px] py-0.5 px-2">
                    {period === 'today' ? 'Hoje' : period === '30d' ? '30 Dias' : 'Últimos 7 Dias'}
                  </Badge>
                )}
                {type && (
                  <Badge variant="primary" className="text-[10px] py-0.5 px-2">
                    Setor: {type}
                  </Badge>
                )}
                {topics && topics.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] py-0.5 px-2 truncate max-w-[260px]">
                    {topics.length === 1 ? topics[0] : `${topics.length} tópicos`}
                  </Badge>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
            aria-label="Fechar painel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de Registros */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-[#F4F6F9]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
              <span className="text-xs font-semibold">Carregando registros do RBXSoft...</span>
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-100 text-slate-500 text-xs shadow-sm">
              <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              Nenhum chamado encontrado para este critério e filtros selecionados.
            </div>
          ) : (
            tickets.map((t) => (
              <div
                key={t.id}
                onClick={() => {
                  onSelectTicket(t.id);
                  onClose();
                }}
                className="p-4 rounded-2xl bg-white border border-slate-100 hover:border-brand-primary/40 hover:shadow-premium-hover transition-all duration-200 cursor-pointer text-xs space-y-2.5 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-brand-primary font-bold text-xs">
                        {t.protocol || `#${t.id}`}
                      </span>
                      {t.clientId ? (
                        <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                          #{t.clientId}
                        </span>
                      ) : null}
                    </div>
                    <div
                      className="font-semibold text-slate-900 truncate mt-0.5 text-xs"
                      title={t.clientName || 'Cliente'}
                    >
                      {t.clientName || (t.clientId ? `Cliente #${t.clientId}` : 'Cliente')}
                    </div>
                  </div>

                  {/* Badge de Status em Pílula */}
                  {t.isOverdue || t.slaStatus === 'OVERDUE' || t.slaStatus === 'vencido' ? (
                    <Badge variant="overdue" pulse className="text-[10px] shrink-0">
                      SLA Vencido
                    </Badge>
                  ) : t.isAtRisk || t.slaStatus === 'RISK' || t.slaStatus === 'risco' ? (
                    <Badge variant="risk" pulse className="text-[10px] shrink-0">
                      SLA em Risco
                    </Badge>
                  ) : t.status === 'Concluído' ? (
                    <Badge variant="neutral" className="text-[10px] shrink-0">
                      Concluído
                    </Badge>
                  ) : (
                    <Badge variant="ok" className="text-[10px] shrink-0">
                      No Prazo
                    </Badge>
                  )}
                </div>

                <div className="text-slate-600 line-clamp-2 leading-relaxed">
                  {t.description || t.subject || 'Sem assunto informado'}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-600">
                      {t.topicName || 'Geral'}
                    </span>
                    {(t.technicianName || t.assignedTechnicianName) && (
                      <span className="text-slate-400 truncate max-w-[160px]">
                        • {t.technicianName || t.assignedTechnicianName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-brand-primary font-semibold group-hover:translate-x-0.5 transition-transform shrink-0">
                    <span>Ver chamado</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Rodapé com Ações e Exportação */}
        <div className="p-5 border-t border-slate-100 bg-white flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            Total exibido: <strong>{tickets.length}</strong> chamados
          </span>

          <div className="flex items-center gap-2.5">
            {canExport && (
              <PillButton
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={exporting || tickets.length === 0}
                icon={Download}
              >
                {exporting ? 'Exportando...' : 'Exportar CSV'}
              </PillButton>
            )}
            <PillButton
              variant="secondary"
              size="sm"
              onClick={onClose}
            >
              Fechar
            </PillButton>
          </div>
        </div>
      </div>
    </div>
  );
};
