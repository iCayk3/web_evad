import React, { useState } from 'react';
import { PieChart, Table as TableIcon } from 'lucide-react';
import { AccessibleTable, Column } from '../../components/common/AccessibleTable.tsx';

interface QueueDistributionProps {
  distribution: {
    byStatus: Array<{ status: string; count: number; percentage: number }>;
    bySla: Array<{ slaStatus: string; count: number; percentage: number }>;
  };
}

export const QueueDistributionWidget: React.FC<QueueDistributionProps> = ({ distribution }) => {
  const [viewMode, setViewMode] = useState<'visual' | 'table'>('visual');

  const statusColumns: Column<{ status: string; count: number; percentage: number }>[] = [
    { key: 'status', header: 'Situação da Fila', sortable: true },
    { key: 'count', header: 'Quantidade', sortable: true, align: 'right' },
    {
      key: 'percentage',
      header: 'Participação',
      sortable: true,
      align: 'right',
      render: (i) => `${i.percentage}%`,
    },
  ];

  const slaColumns: Column<{ slaStatus: string; count: number; percentage: number }>[] = [
    { key: 'slaStatus', header: 'Criticidade do SLA', sortable: true },
    { key: 'count', header: 'Quantidade', sortable: true, align: 'right' },
    {
      key: 'percentage',
      header: 'Participação',
      sortable: true,
      align: 'right',
      render: (i) => `${i.percentage}%`,
    },
  ];

  return (
    <div className="bg-white border border-slate-100/90 rounded-2xl p-6 shadow-premium-card space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 tracking-tight">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <PieChart className="w-4 h-4" strokeWidth={2} />
            </div>
            <span>Distribuição da Fila & Criticidade SLA</span>
          </h3>
        </div>

        <button
          type="button"
          onClick={() => setViewMode(viewMode === 'visual' ? 'table' : 'visual')}
          className="w-8 h-8 rounded-lg bg-slate-100/90 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors border border-slate-200/80 shadow-2xs self-start sm:self-auto"
          title={viewMode === 'visual' ? 'Visualizar em tabela' : 'Visualizar em gráfico'}
          aria-label={viewMode === 'visual' ? 'Visualizar em tabela' : 'Visualizar em gráfico'}
        >
          {viewMode === 'visual' ? (
            <TableIcon className="w-4 h-4" />
          ) : (
            <PieChart className="w-4 h-4" />
          )}
        </button>
      </div>

      {viewMode === 'visual' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
          {/* Distribuição por Situação */}
          <div className="p-4 rounded-xl bg-slate-50/60 border border-slate-100">
            <div className="text-xs font-bold text-slate-800 mb-3.5 flex items-center justify-between">
              <span>Por Situação Operacional</span>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Demanda</span>
            </div>
            <div className="space-y-3">
              {distribution.byStatus.map((item) => (
                <div key={item.status} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-700 font-medium truncate">{item.status}</span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      <strong>{item.count}</strong> <span className="text-slate-400">({item.percentage}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-200/60 h-2.5 rounded-full overflow-hidden p-0.5">
                    <div
                      className="bg-brand-primary h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Distribuição por Criticidade de SLA */}
          <div className="p-4 rounded-xl bg-slate-50/60 border border-slate-100">
            <div className="text-xs font-bold text-slate-800 mb-3.5 flex items-center justify-between">
              <span>Por Criticidade do Prazo SLA</span>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Urgência</span>
            </div>
            <div className="space-y-3">
              {distribution.bySla.map((item) => {
                const barColor =
                  item.slaStatus === 'Vencido'
                    ? 'bg-rose-500'
                    : item.slaStatus.includes('Risco')
                    ? 'bg-amber-500'
                    : 'bg-emerald-500';

                return (
                  <div key={item.slaStatus} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-700 font-medium truncate">{item.slaStatus}</span>
                      <span className="text-slate-500 font-mono text-[11px]">
                        <strong>{item.count}</strong> <span className="text-slate-400">({item.percentage}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-200/60 h-2.5 rounded-full overflow-hidden p-0.5">
                      <div
                        className={`${barColor} h-full rounded-full transition-all duration-500 ease-out`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AccessibleTable
            columns={statusColumns}
            data={distribution.byStatus}
            caption="Tabela de distribuição por situação"
            keyExtractor={(i) => i.status}
          />
          <AccessibleTable
            columns={slaColumns}
            data={distribution.bySla}
            caption="Tabela de distribuição por SLA"
            keyExtractor={(i) => i.slaStatus}
          />
        </div>
      )}
    </div>
  );
};
