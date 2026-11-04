import { useState, useEffect, useCallback } from 'react';
import { Sidebar, type MainMenuOption } from './components/Sidebar';
import { CompanyHeader } from './components/CompanyHeader';
import { CompanyDashboard } from './components/CompanyDashboard';
import { CompanyAnnualDashboard } from './components/CompanyAnnualDashboard';
import { AutenticacoesDashboard } from './components/AutenticacoesDashboard';
import { ExecutiveHeader } from './components/ExecutiveHeader';
import { KPICards } from './components/KPICards';
import { CohortFunnel } from './components/CohortFunnel';
import { ExecutiveDecisionCharts } from './components/ExecutiveDecisionCharts';
import { ClientsTable } from './components/ClientsTable';
import { ImportModal } from './components/ImportModal';
import { RbxConfigModal } from './components/RbxConfigModal';
import { MonthlyDashboard } from './components/MonthlyDashboard';
import { AnnualDashboard } from './components/AnnualDashboard';
import { EquipmentRecoveryDashboard } from './components/EquipmentRecoveryDashboard';
import { EquipmentAnnualDashboard } from './components/EquipmentAnnualDashboard';
import { ZEROED_DATA } from './data/mockData';
import { API_BASE } from './config/api';
import type { MonthlyCohortData, MonthWithData } from './types';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Loader2, 
  KeyRound, 
  Users, 
  BarChart3, 
  TrendingUp, 
  PackageCheck, 
  Layers,
  Menu,
  CheckCircle2,
  XCircle
} from 'lucide-react';

export function App() {
  // Menu Lateral: 'empresa' (1ª opção) ou 'recuperados' (2ª opção)
  const [mainMenu, setMainMenu] = useState<MainMenuOption>('empresa');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Módulo Minha Empresa (Sub-abas, competência e sincronização)
  const [companyMonth, setCompanyMonth] = useState('2026-10');
  const [companyView, setCompanyView] = useState<'operacional' | 'visao_anual'>('visao_anual');
  const [isCompanySyncing, setIsCompanySyncing] = useState(false);
  const [companySyncMessage, setCompanySyncMessage] = useState<string | null>(null);
  const [companySyncTrigger, setCompanySyncTrigger] = useState(0);

  const handleSyncCompany = async () => {
    setIsCompanySyncing(true);
    setCompanySyncMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/empresa/sync?month=${companyMonth}`, {
        method: 'POST',
      });
      if (res.ok) {
        setCompanySyncMessage('Sincronização com o RBX concluída com sucesso! Dados gravados no banco.');
        setCompanySyncTrigger((prev) => prev + 1);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setCompanySyncMessage(`Erro ao sincronizar: ${errJson.error || 'Falha na comunicação com o RBX'}`);
      }
    } catch (err: any) {
      setCompanySyncMessage(`Erro na requisição: ${err.message || 'Falha de rede'}`);
    } finally {
      setIsCompanySyncing(false);
      setTimeout(() => setCompanySyncMessage(null), 8000);
    }
  };

  const handleSelectMainMenu = (menu: MainMenuOption) => {
    setMainMenu(menu);
    if (menu === 'empresa') {
      setCompanyView('visao_anual');
    }
  };

  // Módulo de Clientes Recuperados (Sub-abas e filtros)
  const [selectedMonth, setSelectedMonth] = useState('2026-01');
  const [activeView, setActiveView] = useState<'cohort' | 'monthly' | 'annual' | 'equipamentos' | 'equipamentos_anual'>('cohort');
  const [viewMode, setViewMode] = useState<'pure' | 'all'>('pure');
  const [cohortData, setCohortData] = useState<MonthlyCohortData>(ZEROED_DATA);
  const [competencias, setCompetencias] = useState<{
    availableMonths: MonthWithData[];
    availableYears: string[];
  }>({
    availableMonths: [],
    availableYears: ['2027', '2026', '2025'],
  });
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isRbxConfigOpen, setIsRbxConfigOpen] = useState(false);
  const [rbxStatus, setRbxStatus] = useState('desconectado');
  const [loading, setLoading] = useState(true);
  const [uploadingDirect, setUploadingDirect] = useState(false);

  // Fetch real data from Go backend
  const loadData = useCallback(async (month: string, mode: 'pure' | 'all' = viewMode) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/analytics/cohort?month=${month}&view=${mode}`);
      if (res.ok) {
        const data = await res.json();
        setCohortData(data);
      } else {
        setCohortData({ ...ZEROED_DATA, monthKey: month });
      }
    } catch {
      setCohortData({ ...ZEROED_DATA, monthKey: month });
    } finally {
      setLoading(false);
    }
  }, [viewMode]);

  // Load available competencies metadata
  const loadCompetencias = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/competencias`);
      if (res.ok) {
        const data = await res.json();
        setCompetencias({
          availableMonths: data.availableMonths || [],
          availableYears: data.availableYears || [],
        });
      }
    } catch (err) {
      console.error('Erro ao carregar lista de competências:', err);
    }
  }, []);

  // Check RBX connection status
  const checkRbxStatus = useCallback(() => {
    fetch(`${API_BASE}/api/config/rbx`)
      .then((res) => res.json())
      .then((data) => {
        setRbxStatus(data.statusConexao || 'desconectado');
      })
      .catch(() => setRbxStatus('desconectado'));
  }, []);

  useEffect(() => {
    loadData(selectedMonth, viewMode);
    checkRbxStatus();
  }, [selectedMonth, viewMode, checkRbxStatus, loadData]);

  useEffect(() => {
    loadCompetencias();
  }, [loadCompetencias]);

  const handleReset = async () => {
    if (!window.confirm('Deseja realmente zerar todos os dados importados?')) return;
    try {
      await fetch(`${API_BASE}/api/reset`, { method: 'POST' });
      setCohortData({ ...ZEROED_DATA, monthKey: selectedMonth });
      loadCompetencias();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDirectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setUploadingDirect(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const json = await res.json();
        if (json.summary) {
          setCohortData(json.summary);
          if (json.summary.monthKey) {
            setSelectedMonth(json.summary.monthKey);
          }
        }
        loadCompetencias();
      }
    } catch (err) {
      console.error('Erro no upload', err);
    } finally {
      setUploadingDirect(false);
      e.target.value = '';
    }
  };

  const hasData = cohortData.totalBlocked > 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-row font-sans">
      {/* 1. Menu Lateral (Sidebar) */}
      <Sidebar
        currentMenu={mainMenu}
        onSelectMenu={handleSelectMainMenu}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        rbxStatus={rbxStatus}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* 2. Área Principal de Conteúdo */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Barra Superior Mobile (permite abrir o menu em telas pequenas) */}
        <div className="lg:hidden bg-white text-slate-800 px-4 py-3 flex items-center justify-between no-print border-b border-slate-200">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            title="Abrir Menu Lateral"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-sm tracking-tight text-slate-900">EVAD</span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold text-slate-600">
              {mainMenu === 'empresa' ? 'Minha Empresa' : 'Clientes Recuperados'}
            </span>
          </div>
          <span className="text-[10px] font-bold bg-slate-900 px-2 py-0.5 rounded text-white uppercase">
            ISP
          </span>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* MÓDULO 1: MINHA EMPRESA (Tela corporativa & operacional)      */}
        {/* ------------------------------------------------------------- */}
        {mainMenu === 'empresa' && (
          <div className="flex-1 flex flex-col">
            {/* Header Corporativo Minha Empresa - Idêntico ao ExecutiveHeader */}
            <CompanyHeader
              selectedMonth={companyMonth}
              onMonthChange={setCompanyMonth}
              onOpenRbxConfig={() => setIsRbxConfigOpen(true)}
              rbxStatus={rbxStatus}
              onSyncRbx={handleSyncCompany}
              isSyncing={isCompanySyncing}
              availableYears={competencias.availableYears}
            />

            {/* View Switcher Tabs (Navigation de Minha Empresa) - Idêntico ao menu de Clientes Recuperados */}
            <nav className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 no-print">
              <div className="max-w-7xl mx-auto flex space-x-2 sm:space-x-6 text-xs overflow-x-auto no-scrollbar whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => setCompanyView('visao_anual')}
                  className={`py-3 border-b-2 font-medium flex items-center space-x-2 transition cursor-pointer select-none shrink-0 ${
                    companyView === 'visao_anual'
                      ? 'border-slate-900 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <span>Consolidado & Visão Anual (Saúde da Empresa)</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.2 rounded-full font-black ml-1">
                    2026
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCompanyView('operacional')}
                  className={`py-3 border-b-2 font-medium flex items-center space-x-2 transition cursor-pointer select-none shrink-0 ${
                    companyView === 'operacional'
                      ? 'border-slate-900 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                  <span>Operacional Mensal (Instalações, Cancelados & Suspensos)</span>
                </button>
              </div>
            </nav>

            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">
              {companySyncMessage && (
                <div className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 transition animate-fade-in ${
                  companySyncMessage.includes('Erro')
                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}>
                  {companySyncMessage.includes('Erro') ? (
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <span>{companySyncMessage}</span>
                </div>
              )}

              {companyView === 'operacional' && (
                <CompanyDashboard
                  selectedMonth={companyMonth}
                  syncTrigger={companySyncTrigger}
                  rbxStatus={rbxStatus}
                  onNavigateToRecuperados={() => setMainMenu('recuperados')}
                />
              )}

              {companyView === 'visao_anual' && (
                <CompanyAnnualDashboard initialYear={companyMonth.split('-')[0] || '2026'} />
              )}
            </main>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MÓDULO 2: BASE & AUTENTICAÇÕES RBX (Batimento Zabbix & Churn) */}
        {/* ------------------------------------------------------------- */}
        {mainMenu === 'autenticacoes' && (
          <div className="flex-1 flex flex-col">
            <header className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3.5 no-print">
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2.5">
                    <h1 className="text-base font-bold text-slate-900 tracking-tight">EVAD</h1>
                    <span className="text-slate-300">|</span>
                    <span className="text-sm font-medium text-slate-600">Base & Autenticações RBX</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Auditoria de credenciais PPPoE e contratos para batimento com o Zabbix e cálculo de Churn
                  </p>
                </div>
              </div>
            </header>

            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">
              <AutenticacoesDashboard />
            </main>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MÓDULO 3: CLIENTES RECUPERADOS (Auditoria, KPIs & Hardware)   */}
        {/* ------------------------------------------------------------- */}
        {mainMenu === 'recuperados' && (
          <div className="flex-1 flex flex-col">
            {/* Header Executivo da Auditoria */}
            <ExecutiveHeader
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              onOpenImport={() => setIsImportOpen(true)}
              onOpenRbxConfig={() => setIsRbxConfigOpen(true)}
              onReset={handleReset}
              hasData={hasData}
              rbxStatus={rbxStatus}
              availableMonthsWithData={competencias.availableMonths}
              availableYears={competencias.availableYears}
            />

            {/* View Switcher Tabs (Navigation de Clientes Recuperados) */}
            <nav className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 no-print">
              <div className="max-w-7xl mx-auto flex space-x-2 sm:space-x-6 text-xs overflow-x-auto no-scrollbar whitespace-nowrap">
                <button
                  onClick={() => setActiveView('cohort')}
                  className={`py-3 border-b-2 font-medium flex items-center space-x-2 transition cursor-pointer select-none shrink-0 ${
                    activeView === 'cohort'
                      ? 'border-slate-900 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Users className="h-4 w-4" />
                  <span>Coortes & Clientes</span>
                </button>

                <button
                  onClick={() => setActiveView('monthly')}
                  className={`py-3 border-b-2 font-medium flex items-center space-x-2 transition cursor-pointer select-none shrink-0 ${
                    activeView === 'monthly'
                      ? 'border-slate-900 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Dashboard Mensal (Planos, Cidades & Ciclos)</span>
                </button>

                <button
                  onClick={() => setActiveView('annual')}
                  className={`py-3 border-b-2 font-medium flex items-center space-x-2 transition cursor-pointer select-none shrink-0 ${
                    activeView === 'annual'
                      ? 'border-slate-900 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <TrendingUp className="h-4 w-4" />
                  <span>Consolidado & Evolução Anual</span>
                </button>

                <button
                  onClick={() => setActiveView('equipamentos')}
                  className={`py-3 border-b-2 font-medium flex items-center space-x-2 transition cursor-pointer select-none shrink-0 ${
                    activeView === 'equipamentos'
                      ? 'border-slate-900 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <PackageCheck className="h-4 w-4 text-blue-600" />
                  <span>Recuperação de Equipamentos</span>
                </button>

                <button
                  onClick={() => setActiveView('equipamentos_anual')}
                  className={`py-3 border-b-2 font-medium flex items-center space-x-2 transition cursor-pointer select-none shrink-0 ${
                    activeView === 'equipamentos_anual'
                      ? 'border-slate-900 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Layers className="h-4 w-4 text-emerald-600" />
                  <span>Equipamentos (Ano Inteiro)</span>
                </button>
              </div>
            </nav>

            {/* Conteúdo Principal de Clientes Recuperados */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">
              {activeView === 'cohort' && (
                <>
                  {/* Cohort View Mode Selector */}
                  {hasData && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white border border-slate-200/90 rounded-xl p-3 px-4 shadow-xs gap-3">
                      <div className="flex items-center space-x-2.5">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Modo de Análise:</span>
                        <span className="text-xs text-slate-500 hidden md:inline">
                          Alterne entre a base líquida da competência ou a auditoria total exportada do RBX
                        </span>
                      </div>
                      <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs">
                        <button
                          onClick={() => setViewMode('pure')}
                          className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-md font-semibold transition cursor-pointer select-none ${
                            viewMode === 'pure'
                              ? 'bg-white text-emerald-800 shadow-xs border border-emerald-200 font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span>Coorte Pura ({cohortData.pureTotalBlocked || cohortData.totalBlocked})</span>
                        </button>
                        <button
                          onClick={() => setViewMode('all')}
                          className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-md font-semibold transition cursor-pointer select-none ${
                            viewMode === 'all'
                              ? 'bg-white text-amber-800 shadow-xs border border-amber-200 font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          <span>Total Exportado RBX ({cohortData.totalBlocked + (viewMode === 'pure' ? (cohortData.inheritedCount || 0) : 0)})</span>
                          {((cohortData.inheritedCount ?? 0) > 0 || viewMode === 'all') && (
                            <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700 font-bold border border-purple-200">
                              +{cohortData.inheritedCount || 2} herdados
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* KPI Cards */}
                  <KPICards data={cohortData} />

                  {/* Empty State with Options */}
                  {!hasData && !loading && (
                    <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
                      <div className="max-w-md mx-auto">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-500">
                          <FileSpreadsheet className="h-6 w-6" />
                        </div>
                        <h2 className="text-base font-semibold text-slate-900">
                          Base zerada para {cohortData.monthLabel}
                        </h2>
                        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                          Você pode carregar a planilha exportada do RBX ou configurar a chave da API para buscar os contratos diretamente.
                        </p>

                        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                          <input
                            type="file"
                            id="direct-upload"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleDirectFile}
                            className="hidden"
                          />
                          <label
                            htmlFor="direct-upload"
                            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold cursor-pointer shadow-xs transition"
                          >
                            {uploadingDirect ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Processando Planilha...</span>
                              </>
                            ) : (
                              <>
                                <UploadCloud className="h-4 w-4" />
                                <span>Subir Planilha do RBX</span>
                              </>
                            )}
                          </label>

                          <button
                            onClick={() => setIsRbxConfigOpen(true)}
                            className="inline-flex items-center space-x-1.5 px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-medium transition shadow-xs"
                          >
                            <KeyRound className="h-4 w-4 text-slate-500" />
                            <span>Configurar Conexão RBX API</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* When data exists */}
                  {hasData && (
                    <>
                      {/* Visual Resolution Bar */}
                      <CohortFunnel data={cohortData} />

                      {/* Executive Decision Charts */}
                      <ExecutiveDecisionCharts data={cohortData} />

                      {/* Client Details Table */}
                      <ClientsTable
                        clients={cohortData.clients || []}
                        monthLabel={cohortData.monthLabel}
                        selectedMonth={selectedMonth}
                        onSyncSuccess={() => loadData(selectedMonth)}
                      />
                    </>
                  )}
                </>
              )}

              {activeView === 'monthly' && (
                <MonthlyDashboard
                  initialMonth={selectedMonth}
                  onMonthChange={(m) => {
                    setSelectedMonth(m);
                    loadData(m);
                  }}
                />
              )}

              {activeView === 'annual' && (
                <AnnualDashboard initialYear={selectedMonth.split('-')[0]} />
              )}

              {activeView === 'equipamentos' && (
                <EquipmentRecoveryDashboard
                  selectedMonth={selectedMonth}
                  onMonthChange={(m) => {
                    setSelectedMonth(m);
                    loadData(m);
                  }}
                  onSwitchToAnnual={() => setActiveView('equipamentos_anual')}
                />
              )}

              {activeView === 'equipamentos_anual' && (
                <EquipmentAnnualDashboard
                  initialYear={selectedMonth.split('-')[0]}
                  onNavigateToMonth={(m) => {
                    setSelectedMonth(m);
                    loadData(m);
                    setActiveView('equipamentos');
                  }}
                  onSwitchToMonthly={() => setActiveView('equipamentos')}
                />
              )}
            </main>
          </div>
        )}

        {/* Rodapé Global */}
        <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-400 no-print mt-auto">
          EVAD • Sistema de Retenção e Indicadores RBX
        </footer>
      </div>

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={(data) => {
          setCohortData(data);
          if (data.monthKey) setSelectedMonth(data.monthKey);
          loadCompetencias();
        }}
      />

      {/* RBX Integration Config Modal */}
      <RbxConfigModal
        isOpen={isRbxConfigOpen}
        onClose={() => setIsRbxConfigOpen(false)}
        onSaved={() => {
          checkRbxStatus();
          loadData(selectedMonth);
        }}
      />
    </div>
  );
}

export default App;
