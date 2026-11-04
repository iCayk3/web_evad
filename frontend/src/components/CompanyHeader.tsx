import React, { useMemo } from 'react';
import { RefreshCw, Link2, ChevronLeft, ChevronRight } from 'lucide-react';

interface CompanyHeaderProps {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  onOpenRbxConfig?: () => void;
  rbxStatus: string;
  onSyncRbx: () => void;
  isSyncing: boolean;
  availableYears?: string[];
}

const MONTHS = [
  { num: '01', name: 'Janeiro' },
  { num: '02', name: 'Fevereiro' },
  { num: '03', name: 'Março' },
  { num: '04', name: 'Abril' },
  { num: '05', name: 'Maio' },
  { num: '06', name: 'Junho' },
  { num: '07', name: 'Julho' },
  { num: '08', name: 'Agosto' },
  { num: '09', name: 'Setembro' },
  { num: '10', name: 'Outubro' },
  { num: '11', name: 'Novembro' },
  { num: '12', name: 'Dezembro' },
];

export const CompanyHeader: React.FC<CompanyHeaderProps> = ({
  selectedMonth,
  onMonthChange,
  onOpenRbxConfig,
  rbxStatus,
  onSyncRbx,
  isSyncing,
  availableYears = ['2027', '2026', '2025'],
}) => {
  const [selectedYear, selectedMonthNum] = useMemo(() => {
    const parts = (selectedMonth || '2026-10').split('-');
    return [parts[0] || '2026', parts[1] || '10'];
  }, [selectedMonth]);

  const yearsList = useMemo(() => {
    const yearSet = new Set<string>();
    const curY = new Date().getFullYear();
    yearSet.add(String(curY));
    yearSet.add(String(curY - 1));
    yearSet.add(String(curY + 1));
    if (selectedYear) yearSet.add(selectedYear);
    if (availableYears) {
      availableYears.forEach((y) => yearSet.add(y));
    }
    return Array.from(yearSet).sort((a, b) => b.localeCompare(a));
  }, [availableYears, selectedYear]);

  const handlePrevMonth = () => {
    const y = parseInt(selectedYear, 10);
    const m = parseInt(selectedMonthNum, 10);
    if (m === 1) {
      onMonthChange(`${y - 1}-12`);
    } else {
      onMonthChange(`${y}-${String(m - 1).padStart(2, '0')}`);
    }
  };

  const handleNextMonth = () => {
    const y = parseInt(selectedYear, 10);
    const m = parseInt(selectedMonthNum, 10);
    if (m === 12) {
      onMonthChange(`${y + 1}-01`);
    } else {
      onMonthChange(`${y}-${String(m + 1).padStart(2, '0')}`);
    }
  };

  const handleYearChange = (newYear: string) => {
    onMonthChange(`${newYear}-${selectedMonthNum}`);
  };

  const handleMonthNumChange = (newMonthNum: string) => {
    onMonthChange(`${selectedYear}-${newMonthNum}`);
  };

  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3.5 no-print">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Title */}
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-base font-bold text-slate-900 tracking-tight">EVAD</h1>
            <span className="text-slate-300">|</span>
            <span className="text-sm font-medium text-slate-600">Minha Empresa</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Inteligência operacional RBX, chamados de instalação, cancelamentos e saúde anual
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2.5">
          {/* Dynamic Month & Year Competence Navigator */}
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-medium text-slate-500 hidden sm:inline">
              Competência:
            </span>
            <div className="inline-flex items-center bg-white border border-slate-300 rounded-md shadow-2xs">
              {/* Prev Month */}
              <button
                type="button"
                onClick={handlePrevMonth}
                title="Competência anterior"
                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-l-md transition cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              {/* Month Select */}
              <select
                aria-label="Selecionar mês"
                value={selectedMonthNum}
                onChange={(e) => handleMonthNumChange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 py-1.5 pl-1.5 pr-0.5 focus:outline-none cursor-pointer border-r border-slate-200"
              >
                {MONTHS.map((m) => (
                  <option key={m.num} value={m.num}>
                    ● {m.name}
                  </option>
                ))}
              </select>

              {/* Year Select */}
              <select
                aria-label="Selecionar ano"
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 py-1.5 pl-1 pr-1.5 focus:outline-none cursor-pointer border-r border-slate-200"
              >
                {yearsList.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              {/* Next Month */}
              <button
                type="button"
                onClick={handleNextMonth}
                title="Próxima competência"
                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-r-md transition cursor-pointer"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* RBX API Integration Button */}
          <button
            type="button"
            onClick={onOpenRbxConfig}
            title="Configurar URL e Chave de Integração RBX"
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-300 hover:bg-slate-50 rounded-md transition cursor-pointer"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                rbxStatus === 'conectado'
                  ? 'bg-emerald-600'
                  : rbxStatus === 'erro'
                  ? 'bg-rose-600'
                  : 'bg-slate-400'
              }`}
            />
            <Link2 className="h-3.5 w-3.5 text-slate-500" />
            <span>{rbxStatus === 'conectado' ? 'RBX Conectado' : 'Conectar RBX API'}</span>
          </button>

          {/* Sincronizar RBX Button */}
          <button
            type="button"
            onClick={onSyncRbx}
            disabled={isSyncing}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 rounded-md shadow-xs transition cursor-pointer"
            title="Sincronizar dados do mês com o RBX e gravar no banco"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar RBX'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
