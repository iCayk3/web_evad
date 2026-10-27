import React from 'react';
import type { MonthlyCohortData } from '../types';

interface KPICardsProps {
  data: MonthlyCohortData;
}

export const KPICards: React.FC<KPICardsProps> = ({ data }) => {
  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const suspendedCount =
    data.suspendedCount !== undefined
      ? data.suspendedCount
      : data.clients?.filter((c) => c.status === 'suspended').length || 0;

  const suspendedMrr =
    data.suspendedMrr !== undefined
      ? data.suspendedMrr
      : data.clients
          ?.filter((c) => c.status === 'suspended')
          .reduce((acc, c) => acc + c.monthlyFee, 0) || 0;

  const suspendedRate =
    data.suspendedRate !== undefined
      ? data.suspendedRate
      : data.totalBlocked > 0
      ? (suspendedCount / data.totalBlocked) * 100
      : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
      {/* 1. Total Bloqueados */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Clientes Bloqueados
        </div>
        <div className="mt-2 text-2xl font-bold text-slate-900">
          {data.totalBlocked}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {formatCurrency(data.totalMrrBlocked)} faturamento
        </div>
        {data.otherCount !== undefined && data.otherCount > 0 && (
          <div className="mt-1 text-[10px] text-slate-400" title="Contratos transferidos desconsiderados da coorte de retenção">
            {data.otherCount} transferidos fora dos KPIs
          </div>
        )}
        {data.mimoCount !== undefined && data.mimoCount > 0 && (
          <div className="mt-0.5 text-[10px] text-purple-600 font-medium" title="Contratos mimos/TV adicionais (R$ 0,00) excluídos dos KPIs">
            {data.mimoCount} mimos/TV desconsiderados
          </div>
        )}
      </div>

      {/* 2. Voltaram para a Base */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Voltaram para a Base
        </div>
        <div className="mt-2 flex items-baseline space-x-1.5">
          <span className="text-2xl font-bold text-slate-900">{data.returnedCount}</span>
          <span className="text-xs font-semibold text-emerald-700">
            ({data.returnedRate.toFixed(1)}%)
          </span>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {formatCurrency(data.returnedMrr)} recuperado
        </div>
      </div>

      {/* 3. Não Voltaram (Cancelados / Churn) */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Cancelaram (Churn)
        </div>
        <div className="mt-2 flex items-baseline space-x-1.5">
          <span className="text-2xl font-bold text-slate-900">{data.churnedCount}</span>
          <span className="text-xs font-semibold text-rose-700">
            ({data.churnRate.toFixed(1)}%)
          </span>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {formatCurrency(data.churnedMrr)} perdido
        </div>
      </div>

      {/* 4. Realmente Suspensos (Inadimplência da Coorte) */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Ainda Suspensos
        </div>
        <div className="mt-2 flex items-baseline space-x-1.5">
          <span className="text-2xl font-bold text-slate-900">{suspendedCount}</span>
          <span className="text-xs font-semibold text-amber-700">
            ({suspendedRate.toFixed(1)}%)
          </span>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {formatCurrency(suspendedMrr)} inadimplentes
        </div>
      </div>

      {/* 5. Ainda Bloqueados (Pendentes) */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Ainda Bloqueados
        </div>
        <div className="mt-2 flex items-baseline space-x-1.5">
          <span className="text-2xl font-bold text-slate-900">{data.stillBlockedCount}</span>
          <span className="text-xs font-semibold text-slate-600">
            ({data.stillBlockedRate.toFixed(1)}%)
          </span>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {formatCurrency(data.stillBlockedMrr)} em negociação
        </div>
      </div>

      {/* 6. Tempo Médio */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Tempo Médio Retorno
        </div>
        <div className="mt-2 text-2xl font-bold text-slate-900">
          {data.avgDaysToReturn > 0 ? `${data.avgDaysToReturn.toFixed(1)} dias` : '—'}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {data.returned0to7Days > 0 ? `${data.returned0to7Days} voltaram em até 7 dias` : 'Aguardando dados'}
        </div>
      </div>
    </div>
  );
};
