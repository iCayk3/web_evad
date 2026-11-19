import React, { useState, useEffect } from 'react';
import { X, Download, ShieldCheck, Database, FileText, Loader2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../../lib/api.ts';
import { SalesDrilldownDto } from '../types.ts';
import { formatDateBR } from '../utils.ts';

interface AnalyticsDrilldownDrawerProps {
  metricId: string | null;
  metricName: string;
  period?: string;
  startDate?: string;
  endDate?: string;
  seller?: string;
  region?: string;
  group?: string;
  excludePlans?: string[];
  excludeReasons?: string[];
  hideInactiveSellers?: boolean;
  hideThirdPartySellers?: boolean;
  hideUnassignedSellers?: boolean;
  onClose: () => void;
}

export const AnalyticsDrilldownDrawer: React.FC<AnalyticsDrilldownDrawerProps> = ({
  metricId,
  metricName,
  period,
  startDate,
  endDate,
  seller,
  region,
  group,
  excludePlans,
  excludeReasons,
  hideInactiveSellers,
  hideThirdPartySellers,
  hideUnassignedSellers,
  onClose,
}) => {
  const [data, setData] = useState<SalesDrilldownDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!metricId) return;
    setLoading(true);
    setError(null);

    let url = `sales/insights/drilldown?metricId=${metricId}`;
    if (period) url += `&period=${period}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    if (seller && seller !== 'all') url += `&seller=${encodeURIComponent(seller)}`;
    if (region && region !== 'all') url += `&region=${encodeURIComponent(region)}`;
    if (group && group !== 'all') url += `&group=${encodeURIComponent(group)}`;
    if (excludePlans && excludePlans.length > 0) url += `&excludePlans=${encodeURIComponent(excludePlans.join(','))}`;
    if (excludeReasons && excludeReasons.length > 0) url += `&excludeReasons=${encodeURIComponent(excludeReasons.join(','))}`;
    if (hideInactiveSellers) url += `&hideInactiveSellers=true`;
    if (hideThirdPartySellers) url += `&hideThirdPartySellers=true`;
    if (hideUnassignedSellers) url += `&hideUnassignedSellers=true`;

    apiFetch<SalesDrilldownDto>(url)
      .then((res) => setData(res))
      .catch((err) => setError(err.message || 'Erro ao carregar detalhes analíticos.'))
      .finally(() => setLoading(false));
  }, [metricId, period, startDate, endDate, seller, region, group, excludePlans, excludeReasons, hideInactiveSellers, hideThirdPartySellers, hideUnassignedSellers]);

  const isZeroPlan = (detailStr: string) => {
    if (!detailStr) return false;
    const clean = detailStr.toLowerCase();
    return (
      clean.includes('r$ 0.00') ||
      clean.includes('r$ 0,00') ||
      clean.includes('r$ 0/mês') ||
      clean.includes('r$ 0,0/mês') ||
      clean.includes('r$ 0.0/mês') ||
      clean.includes('r$ 0.00/mes') ||
      clean.includes('r$ 0,00/mes')
    );
  };

  const filteredRecords = React.useMemo(() => {
    if (!data?.records) return [];
    if (metricId === 'vendas_fechadas' || metricId === 'contratos_confirmados') {
      return data.records.filter((r) => !isZeroPlan(r.detail || (r as any).details || ''));
    }
    return data.records;
  }, [data?.records, metricId]);

  if (!metricId) return null;

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const csvText = await apiFetch<string>('sales/insights/export', {
        method: 'POST',
        body: JSON.stringify({
          metricId,
          period,
          startDate,
          endDate,
          seller: seller && seller !== 'all' ? seller : undefined,
          region: region && region !== 'all' ? region : undefined,
          group: group && group !== 'all' ? group : undefined,
          excludePlans: excludePlans && excludePlans.length > 0 ? excludePlans : undefined,
          excludeReasons: excludeReasons && excludeReasons.length > 0 ? excludeReasons : undefined,
          hideInactiveSellers,
          hideThirdPartySellers,
          hideUnassignedSellers,
        }),
      });

      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `rbx_crm_${metricId}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(`Falha na exportação: ${err.message || 'Erro de permissão'}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white shadow-2xl h-full flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
        {/* Cabeçalho */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-brand-primary uppercase tracking-wider">
              <Database className="w-3.5 h-3.5" />
              Detalhamento Analítico Auditado
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">{metricName}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200/80 flex items-center justify-center text-slate-500 hover:text-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metadados e Governança da Métrica */}
        <div className="p-6 bg-slate-50 border-b border-slate-200/70 space-y-3 text-xs">
          <div className="flex items-start gap-2 text-slate-700">
            <FileText className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-900">Fórmula de Cálculo: </span>
              <code className="bg-slate-200/80 px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-800">
                {data?.formula || 'Calculando...'}
              </code>
            </div>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{data?.coverage || 'Auditado via RBXSoft'}</span>
            </div>
            <div className="font-semibold text-slate-900">
              Total de Registros: <span className="text-brand-primary font-bold">{filteredRecords.length}</span>
            </div>
          </div>
        </div>

        {/* Conteúdo / Tabela */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
              <p className="text-sm font-medium">Buscando registros oficiais no RBXSoft...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
              <p className="text-sm">{error}</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              Nenhum registro individual encontrado para os filtros selecionados.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Identificador</th>
                    <th className="py-2.5 px-3">Nome / Razão</th>
                    <th className="py-2.5 px-3">Detalhes</th>
                    <th className="py-2.5 px-3">Responsável</th>
                    <th className="py-2.5 px-3 text-right">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {filteredRecords.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-mono font-medium text-brand-primary">{r.id}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 max-w-[140px] truncate" title={r.name}>
                        {r.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{r.detail || (r as any).details}</td>
                      <td className="py-2.5 px-3">{r.seller || (r as any).responsible}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">{formatDateBR(r.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            Exportação protegida por perfil com auditoria de integridade.
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
            >
              Fechar
            </button>
            <button
              onClick={handleExportCsv}
              disabled={exporting || loading || !data?.records?.length}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-brand-primary hover:bg-[#002f9f] disabled:opacity-50 flex items-center gap-2 shadow-sm transition"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Exportar CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
