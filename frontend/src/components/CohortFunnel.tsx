import React from 'react';
import type { MonthlyCohortData } from '../types';

interface CohortFunnelProps {
  data: MonthlyCohortData;
}

export const CohortFunnel: React.FC<CohortFunnelProps> = ({ data }) => {
  if (data.totalBlocked === 0) {
    return null;
  }

  const pct = (val: number) => ((val / data.totalBlocked) * 100).toFixed(1);
  const suspendedCount =
    data.suspendedCount !== undefined
      ? data.suspendedCount
      : data.clients?.filter((c) => c.status === 'suspended').length || 0;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Desfecho da Coorte ({data.monthLabel})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Distribuição dos {data.totalBlocked} clientes bloqueados no período
          </p>
        </div>

        <div className="flex items-center space-x-4 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
            <span className="text-slate-600">Voltaram: <strong className="text-slate-900">{data.returnedCount} ({pct(data.returnedCount)}%)</strong></span>
          </div>
          {suspendedCount > 0 && (
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              <span className="text-slate-600">Suspensos: <strong className="text-slate-900">{suspendedCount} ({pct(suspendedCount)}%)</strong></span>
            </div>
          )}
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
            <span className="text-slate-600">Pendentes: <strong className="text-slate-900">{data.stillBlockedCount} ({pct(data.stillBlockedCount)}%)</strong></span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" />
            <span className="text-slate-600">Cancelados: <strong className="text-slate-900">{data.churnedCount} ({pct(data.churnedCount)}%)</strong></span>
          </div>
        </div>
      </div>

      {/* Proportional Bar */}
      <div className="mt-4">
        <div className="flex h-3 w-full rounded-md overflow-hidden bg-slate-100">
          {data.returnedCount > 0 && (
            <div
              style={{ width: `${pct(data.returnedCount)}%` }}
              className="bg-emerald-600"
              title={`Voltaram: ${data.returnedCount}`}
            />
          )}
          {suspendedCount > 0 && (
            <div
              style={{ width: `${pct(suspendedCount)}%` }}
              className="bg-amber-500"
              title={`Suspensos: ${suspendedCount}`}
            />
          )}
          {data.stillBlockedCount > 0 && (
            <div
              style={{ width: `${pct(data.stillBlockedCount)}%` }}
              className="bg-slate-400"
              title={`Ainda Bloqueados: ${data.stillBlockedCount}`}
            />
          )}
          {data.churnedCount > 0 && (
            <div
              style={{ width: `${pct(data.churnedCount)}%` }}
              className="bg-rose-600"
              title={`Cancelados: ${data.churnedCount}`}
            />
          )}
        </div>
      </div>

      {/* Breakdown by Speed */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-100 text-xs">
        <div>
          <span className="text-slate-500 block">Até 7 dias:</span>
          <span className="font-semibold text-slate-800">{data.returned0to7Days} clientes ({pct(data.returned0to7Days)}%)</span>
        </div>
        <div>
          <span className="text-slate-500 block">8 a 15 dias:</span>
          <span className="font-semibold text-slate-800">{data.returned8to15Days} clientes ({pct(data.returned8to15Days)}%)</span>
        </div>
        <div>
          <span className="text-slate-500 block">16 a 30 dias:</span>
          <span className="font-semibold text-slate-800">{data.returned16to30Days} clientes ({pct(data.returned16to30Days)}%)</span>
        </div>
        <div>
          <span className="text-slate-500 block">Mais de 30 dias:</span>
          <span className="font-semibold text-slate-800">{data.returnedOver30Days} clientes ({pct(data.returnedOver30Days)}%)</span>
        </div>
      </div>
    </div>
  );
};
