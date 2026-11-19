import React, { useState } from 'react';
import { TrendingUp, Table as TableIcon, BarChart2 } from 'lucide-react';
import { AccessibleTable, Column } from '../../components/common/AccessibleTable.tsx';

interface TimeSeriesItem {
  date: string;
  label: string;
  entradas: number;
  concluidos: number;
  estoqueAberto: number;
}

interface TimeSeriesWidgetProps {
  data: TimeSeriesItem[];
}

export const TimeSeriesWidget: React.FC<TimeSeriesWidgetProps> = ({ data }) => {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [hoveredDay, setHoveredDay] = useState<TimeSeriesItem | null>(null);

  // Determina valor máximo para escala visual proporcional
  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.entradas, d.concluidos, d.estoqueAberto)),
    5
  );

  const columns: Column<TimeSeriesItem>[] = [
    { key: 'label', header: 'Dia / Data', sortable: true },
    {
      key: 'entradas',
      header: 'Entradas (Demanda)',
      sortable: true,
      align: 'right',
      render: (item) => <span className="font-semibold text-brand-primary">+{item.entradas}</span>,
    },
    {
      key: 'concluidos',
      header: 'Concluídos (Vazão)',
      sortable: true,
      align: 'right',
      render: (item) => <span className="font-semibold text-emerald-600">{item.concluidos}</span>,
    },
    {
      key: 'estoqueAberto',
      header: 'Chamados em Aberto',
      sortable: true,
      align: 'right',
      render: (item) => <span className="font-semibold text-slate-700">{item.estoqueAberto}</span>,
    },
  ];

  return (
    <div className="bg-white border border-slate-100/90 rounded-2xl p-6 shadow-premium-card relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 tracking-tight">
            <div className="w-8 h-8 rounded-xl bg-brand-primary-light text-brand-primary flex items-center justify-center">
              <TrendingUp className="w-4 h-4" strokeWidth={2} />
            </div>
            <span>Evolução Diária de Chamados</span>
          </h3>
        </div>

        <button
          type="button"
          onClick={() => setViewMode(viewMode === 'chart' ? 'table' : 'chart')}
          className="w-8 h-8 rounded-lg bg-slate-100/90 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors border border-slate-200/80 shadow-2xs self-start sm:self-auto"
          title={viewMode === 'chart' ? 'Visualizar em tabela' : 'Visualizar em gráfico'}
          aria-label={viewMode === 'chart' ? 'Visualizar em tabela' : 'Visualizar em gráfico'}
        >
          {viewMode === 'chart' ? (
            <TableIcon className="w-4 h-4" />
          ) : (
            <BarChart2 className="w-4 h-4" />
          )}
        </button>
      </div>

      {viewMode === 'chart' ? (
        <div className="pt-2 space-y-4">
          {/* Legenda em pílula limpa */}
          <div className="flex flex-wrap items-center justify-end gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-primary" />
              <span className="text-slate-600 font-medium">Entradas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-600 font-medium">Concluídos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              <span className="text-slate-600 font-medium">Fila Ativa</span>
            </div>
          </div>

          {/* Gráfico de Barras com Tooltip Flutuante Estilo Cashflow */}
          <div className="relative">
            {hoveredDay && (
              <div className="absolute top-0 right-4 z-20 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl p-3 shadow-xl text-xs space-y-1 animate-in fade-in zoom-in-95 duration-150">
                <div className="font-bold text-slate-800 pb-1 border-b border-slate-100">
                  {hoveredDay.label}
                </div>
                <div className="flex items-center justify-between gap-4 text-brand-primary font-semibold">
                  <span>Novas Entradas:</span>
                  <span className="font-mono">+{hoveredDay.entradas}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-emerald-600 font-semibold">
                  <span>Concluídos:</span>
                  <span className="font-mono">{hoveredDay.concluidos}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-slate-600 font-semibold">
                  <span>Em Aberto:</span>
                  <span className="font-mono">{hoveredDay.estoqueAberto}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-7 gap-3 items-end h-48 pt-8 pb-3 border-b border-slate-100">
              {data.map((item) => {
                const hEntradas = Math.max((item.entradas / maxVal) * 100, 6);
                const hConcluidos = Math.max((item.concluidos / maxVal) * 100, 6);
                const hEstoque = Math.max((item.estoqueAberto / maxVal) * 100, 6);

                return (
                  <div
                    key={item.date}
                    onMouseEnter={() => setHoveredDay(item)}
                    onMouseLeave={() => setHoveredDay(null)}
                    className="flex flex-col items-center h-full justify-end group cursor-pointer"
                  >
                    <div className="w-full flex items-end justify-center gap-1.5 h-full">
                      {/* Barra Entradas */}
                      <div
                        style={{ height: `${hEntradas}%` }}
                        className="w-3.5 bg-brand-primary rounded-t-lg rounded-b-xs transition-all duration-200 group-hover:bg-brand-primary-hover group-hover:brightness-110"
                      />
                      {/* Barra Concluídos */}
                      <div
                        style={{ height: `${hConcluidos}%` }}
                        className="w-3.5 bg-emerald-500 rounded-t-lg rounded-b-xs transition-all duration-200 group-hover:bg-emerald-600 group-hover:brightness-110"
                      />
                      {/* Barra Chamados em Aberto */}
                      <div
                        style={{ height: `${hEstoque}%` }}
                        className="w-2.5 bg-slate-200 rounded-t-lg rounded-b-xs transition-all duration-200 group-hover:bg-slate-300"
                      />
                    </div>
                    <span className="text-[11px] text-slate-500 font-semibold mt-2.5 group-hover:text-brand-primary transition-colors">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <AccessibleTable
          columns={columns}
          data={data}
          caption="Série temporal de entradas, concluídos e chamados em aberto por dia"
          keyExtractor={(item) => item.date}
        />
      )}
    </div>
  );
};
