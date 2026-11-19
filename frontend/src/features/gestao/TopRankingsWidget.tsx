import React from 'react';
import { Tag, AlertTriangle, UserCheck } from 'lucide-react';
import { Badge } from '../../components/common/Badge.tsx';

interface TopRankingsProps {
  topTopics: Array<{ id: string | number; name: string; total: number; overdueCount: number; overduePercentage: number }>;
  topCauses: Array<{ id: string | number; name: string; total: number; overdueCount: number; overduePercentage: number }>;
  technicianWorkload: Array<{
    id: number;
    name: string;
    openAssigned: number;
    concluded: number;
    overdue: number;
  }>;
}

export const TopRankingsWidget: React.FC<TopRankingsProps> = ({
  topTopics,
  topCauses,
  technicianWorkload,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 1. Top Tópicos */}
      <div className="bg-white border border-slate-100/90 rounded-2xl p-6 shadow-premium-card">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-brand-primary-light text-brand-primary flex items-center justify-center">
            <Tag className="w-4 h-4" strokeWidth={2} />
          </div>
          <div>
            <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
              Principais Motivos de Contato
            </h3>
            <span className="text-[11px] text-slate-400">Demandas com maior volume</span>
          </div>
        </div>
        <div className="space-y-2.5">
          {topTopics.slice(0, 5).map((topic, idx) => (
            <div
              key={topic.id}
              className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center justify-between text-xs hover:bg-slate-100/70 transition-colors"
            >
              <div className="truncate pr-2">
                <div className="font-semibold text-slate-800 truncate flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-200/80 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0 font-mono">
                    {idx + 1}
                  </span>
                  <span className="truncate">{topic.name}</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2 pl-6">
                  <span>{topic.total} chamados</span>
                  {topic.overdueCount > 0 && (
                    <span className="text-rose-600 font-semibold">
                      • {topic.overduePercentage}% fora do SLA
                    </span>
                  )}
                </div>
              </div>
              <span className="font-bold text-slate-900 bg-white px-2.5 py-1 rounded-full border border-slate-200 text-xs shrink-0 shadow-2xs font-mono">
                {topic.total}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Top Causas */}
      <div className="bg-white border border-slate-100/90 rounded-2xl p-6 shadow-premium-card">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" strokeWidth={2} />
          </div>
          <div>
            <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
              Principais Causas de Problema
            </h3>
            <span className="text-[11px] text-slate-400">Origens recorrentes apuradas</span>
          </div>
        </div>
        <div className="space-y-2.5">
          {topCauses.slice(0, 5).map((cause, idx) => (
            <div
              key={cause.id}
              className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center justify-between text-xs hover:bg-slate-100/70 transition-colors"
            >
              <div className="truncate pr-2">
                <div className="font-semibold text-slate-800 truncate flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center justify-center shrink-0 font-mono">
                    {idx + 1}
                  </span>
                  <span className="truncate">{cause.name}</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2 pl-6">
                  <span>{cause.total} ocorrências</span>
                  {cause.overdueCount > 0 && (
                    <span className="text-rose-600 font-semibold">
                      • {cause.overduePercentage}% fora do SLA
                    </span>
                  )}
                </div>
              </div>
              <span className="font-bold text-slate-900 bg-white px-2.5 py-1 rounded-full border border-slate-200 text-xs shrink-0 shadow-2xs font-mono">
                {cause.total}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Distribuição por Técnico */}
      <div className="bg-white border border-slate-100/90 rounded-2xl p-6 shadow-premium-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" strokeWidth={2} />
            </div>
            <div>
              <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                Carga por Técnico
              </h3>
              <span className="text-[11px] text-slate-400">{technicianWorkload.length} técnicos ativos</span>
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          {technicianWorkload.slice(0, 5).map((tech, idx) => (
            <div
              key={tech.id || tech.name}
              className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 space-y-2 transition-colors hover:bg-slate-100/70"
            >
              {/* Linha 1: Nome do Técnico e Total */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center shrink-0 font-mono">
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-slate-900 text-xs truncate" title={tech.name}>
                    {tech.name}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono font-medium shrink-0">
                  {tech.openAssigned + tech.concluded} total
                </span>
              </div>

              {/* Linha 2: Indicadores estruturados com alta legibilidade e cantos menos arredondados */}
              <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
                <div className="px-2 py-1.5 rounded-lg bg-blue-50/80 border border-blue-100/90 flex flex-col items-center justify-center">
                  <span className="text-xs font-bold font-mono text-brand-primary leading-none">
                    {tech.openAssigned}
                  </span>
                  <span className="text-[10px] text-blue-700 font-medium mt-1">
                    abertos
                  </span>
                </div>

                <div className="px-2 py-1.5 rounded-lg bg-emerald-50/80 border border-emerald-100/90 flex flex-col items-center justify-center">
                  <span className="text-xs font-bold font-mono text-emerald-700 leading-none">
                    {tech.concluded}
                  </span>
                  <span className="text-[10px] text-emerald-800 font-medium mt-1">
                    concluídos
                  </span>
                </div>

                <div
                  className={`px-2 py-1.5 rounded-lg border flex flex-col items-center justify-center ${
                    tech.overdue > 0
                      ? 'bg-rose-50/80 border-rose-200/80'
                      : 'bg-slate-100/70 border-slate-200/60'
                  }`}
                >
                  <span
                    className={`text-xs font-bold font-mono leading-none ${
                      tech.overdue > 0 ? 'text-rose-700' : 'text-slate-600'
                    }`}
                  >
                    {tech.overdue}
                  </span>
                  <span
                    className={`text-[10px] font-medium mt-1 ${
                      tech.overdue > 0 ? 'text-rose-700' : 'text-slate-500'
                    }`}
                  >
                    vencidos
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
