import React, { useEffect, useState, useMemo } from 'react';
import {
  X,
  Users,
  Clock,
  Timer,
  Search,
  ArrowUpDown,
  TrendingUp,
  UserCheck,
  ChevronDown,
  Layers,
  Sparkles,
} from 'lucide-react';
import { AgentAttributionMetric } from '../types/omnichannel.types.ts';

interface AgentEfficiencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  attributions?: AgentAttributionMetric[];
  department?: string;
  overallAvgTotalTimeSeconds?: number;
  overallAvgTmaSeconds?: number;
  overallAvgTmeSeconds?: number;
}

type SortField = 'totalContacts' | 'avgTotalTimeSeconds' | 'avgTmaSeconds' | 'avgTmeSeconds' | 'agentName';

export const AgentEfficiencyModal: React.FC<AgentEfficiencyModalProps> = ({
  isOpen,
  onClose,
  attributions = [],
  department,
  overallAvgTotalTimeSeconds = 0,
  overallAvgTmaSeconds = 0,
  overallAvgTmeSeconds = 0,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('totalContacts');
  const [sortAsc, setSortAsc] = useState(false);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const formatSeconds = (sec?: number | null) => {
    if (!sec || sec <= 0) return '00:00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const filteredAndSorted = useMemo(() => {
    return attributions
      .filter((a) => {
        if (!searchTerm.trim()) return true;
        return a.agentName.toLowerCase().includes(searchTerm.toLowerCase());
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }

        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        return sortAsc ? numA - numB : numB - numA;
      });
  }, [attributions, searchTerm, sortField, sortAsc]);

  const totalDepartmentContacts = useMemo(() => {
    return attributions.reduce((acc, curr) => acc + curr.totalContacts, 0);
  }, [attributions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-slate-50 via-blue-50/20 to-indigo-50/20">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Tempo Médio Total por Atendente
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
                  <Layers className="w-3 h-3 text-blue-600" />
                  {department || 'Todos os Departamentos'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-700">
                  {attributions.length} atendentes
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Detalhamento do Tempo Total (Espera + Atendimento) consolidado por cada membro da equipe.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer shrink-0"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Summary KPI Bar */}
        <div className="px-6 py-3 bg-slate-50/70 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
              TMT Médio Geral
            </span>
            <span className="text-base font-bold font-mono text-slate-900">
              {formatSeconds(overallAvgTotalTimeSeconds)}
            </span>
            <span className="text-[10px] text-slate-400 block">Espera + Atendimento</span>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
              TMA Médio Geral
            </span>
            <span className="text-base font-bold font-mono text-blue-600">
              {formatSeconds(overallAvgTmaSeconds)}
            </span>
            <span className="text-[10px] text-slate-400 block">Tempo em atendimento</span>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
              TME Médio Geral
            </span>
            <span className="text-base font-bold font-mono text-amber-600">
              {formatSeconds(overallAvgTmeSeconds)}
            </span>
            <span className="text-[10px] text-slate-400 block">Espera na fila</span>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
              Total Atendimentos
            </span>
            <span className="text-base font-bold text-slate-900">
              {totalDepartmentContacts}
            </span>
            <span className="text-[10px] text-emerald-600 font-medium block">
              Volume atribuído
            </span>
          </div>
        </div>

        {/* Search & Actions toolbar */}
        <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between gap-3 bg-white">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar atendente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Exibindo <span className="font-bold text-slate-800">{filteredAndSorted.length}</span> atendentes
          </div>
        </div>

        {/* Attendants List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
          {filteredAndSorted.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition select-none"
                      onClick={() => handleSort('agentName')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Atendente</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition select-none text-right"
                      onClick={() => handleSort('totalContacts')}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Atendimentos</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition select-none text-right"
                      onClick={() => handleSort('avgTotalTimeSeconds')}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>TMT (Total)</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition select-none text-right"
                      onClick={() => handleSort('avgTmaSeconds')}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>TMA (Atend.)</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition select-none text-right"
                      onClick={() => handleSort('avgTmeSeconds')}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>TME (Espera)</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAndSorted.map((agent, index) => (
                    <tr
                      key={agent.agentName || index}
                      className="hover:bg-blue-50/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                            {agent.agentName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 block">
                              {agent.agentName}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {agent.percentage}% da carga do setor
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-bold text-slate-900">
                          {agent.totalContacts}
                        </span>
                        <div className="h-1.5 w-16 bg-slate-100 rounded-full ml-auto mt-1 overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${Math.min(100, agent.percentage)}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 font-semibold">
                          {formatSeconds(agent.avgTotalTimeSeconds)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-blue-700">
                        {formatSeconds(agent.avgTmaSeconds)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-amber-700">
                        {formatSeconds(agent.avgTmeSeconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <UserCheck className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-medium">Nenhum atendente encontrado para o filtro selecionado.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>* TMT = Tempo Médio de Espera + Tempo Médio de Atendimento</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-medium transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
