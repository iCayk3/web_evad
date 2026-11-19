import React from 'react';
import { Grid, HelpCircle } from 'lucide-react';

interface CrossMatrixProps {
  matrix: {
    rows: Array<{ id: number; label: string }>;
    columns: Array<{ key: string; label: string }>;
    cells: Record<string, { count: number; cellKey: string; ticketIds: number[] }>;
  };
  onCellClick: (cellKey: string) => void;
}

export const CrossMatrixWidget: React.FC<CrossMatrixProps> = ({ matrix, onCellClick }) => {
  // Encontra valor máximo para gradiente térmico
  const maxCellCount = Math.max(
    ...Object.values(matrix.cells).map((c) => c.count),
    1
  );

  const getHeatBg = (count: number, colKey: string) => {
    if (count === 0) return 'text-slate-300 hover:bg-slate-50';

    if (colKey === 'aberto_vencido') {
      const intensity = Math.min(count / maxCellCount, 1);
      return intensity > 0.5
        ? 'bg-rose-500 text-white font-bold shadow-2xs'
        : 'bg-rose-50 text-rose-700 font-semibold border border-rose-200/60';
    }

    if (colKey === 'aberto_em_risco') {
      return 'bg-amber-50 text-amber-800 font-semibold border border-amber-200/60';
    }

    if (colKey === 'concluido') {
      return 'bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200/60';
    }

    return 'bg-blue-50 text-brand-primary font-semibold border border-blue-200/60';
  };

  return (
    <div className="bg-white border border-slate-100/90 rounded-2xl p-6 shadow-premium-card space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 tracking-tight">
            <div className="w-8 h-8 rounded-xl bg-brand-primary-light text-brand-primary flex items-center justify-center">
              <Grid className="w-4 h-4" strokeWidth={2} />
            </div>
            <span>Concentração de Chamados: Assunto × Criticidade</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Mapeamento de gargalos e cruzamento de SLA por assunto. Clique na célula para inspecionar.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">Células coloridas indicam risco operacional</span>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-100 rounded-xl">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/90 text-slate-700 font-bold border-b border-slate-200/70">
              <th scope="col" className="py-3 px-4 w-1/3">
                Tópico / Demanda Principal
              </th>
              {matrix.columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className="py-3 px-3 text-center border-l border-slate-200/50"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {matrix.rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="py-3 px-4 font-semibold text-slate-800">
                  {row.label}
                </td>
                {matrix.columns.map((col) => {
                  const cellKey = `${row.id}__${col.key}`;
                  const cell = matrix.cells[cellKey] || { count: 0, cellKey, ticketIds: [] };
                  const heatClass = getHeatBg(cell.count, col.key);

                  return (
                    <td
                      key={col.key}
                      onClick={() => cell.count > 0 && onCellClick(cellKey)}
                      className="py-2.5 px-3 text-center border-l border-slate-100/80 cursor-pointer"
                      title={cell.count > 0 ? `${cell.count} chamados. Clique para abrir detalhamento.` : 'Nenhum chamado'}
                    >
                      <div
                        className={`inline-flex items-center justify-center min-w-[2.25rem] h-7 px-2 rounded-lg font-mono text-xs transition-transform hover:scale-105 ${heatClass}`}
                      >
                        {cell.count}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
