import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Columns3,
  List,
  PhoneCall,
  Award,
  AlertTriangle,
  UserPlus,
  Search,
  Filter,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Loader2,
  Calendar,
  FileDown,
  FileSpreadsheet,
  CheckSquare,
  Square,
  MapPin,
  Building2,
  BarChart2,
  Table as TableIcon,
  Sparkles,
  Info,
  DollarSign,
  ArrowUpDown,
  X,
  ChevronDown,
  Check,
  User,
  Users,
  UserX,
  EyeOff,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { LeadDto, LeadStage, CommercialDashboardDto, CommercialPeriodType, SellerType } from './types.ts';
import { CommercialDashboardView } from './components/CommercialDashboardView.tsx';
import { ClosedSalesView } from './components/ClosedSalesView.tsx';
import { LeadsKanbanView } from './components/LeadsKanbanView.tsx';
import { LeadsTableView } from './components/LeadsTableView.tsx';
import { LeadDetailDrawer } from './components/LeadDetailDrawer.tsx';
import { CreateContractModal } from './components/CreateContractModal.tsx';
import { CreateLeadModal } from './components/CreateLeadModal.tsx';
import { AnalyticsDrilldownDrawer } from './components/AnalyticsDrilldownDrawer.tsx';
import { exportCancellationsToPdf } from './exportCancellationsPdf.ts';
import { exportExecutiveDashboardToPdf, exportLeadsToPdf } from './exportCommercialPdf.ts';
import { formatDateBR } from './utils.ts';
import { ContractDetailModal } from './components/ContractDetailModal.tsx';

type CommercialTab = 'visao_geral' | 'leads' | 'atividades' | 'vendas' | 'cancelamentos';

export const CommercialPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<CommercialTab>('visao_geral');
  const [leadsViewMode, setLeadsViewMode] = useState<'kanban' | 'table'>('kanban');

  // Filtros de Período
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const currentDay = now.toISOString().slice(0, 10);

  const [period, setPeriod] = useState<CommercialPeriodType>('30d');
  const [customStartDate, setCustomStartDate] = useState<string>(currentMonthStart);
  const [customEndDate, setCustomEndDate] = useState<string>(currentDay);

  // Rastreia se o usuário já selecionou/confirmou o período inicial
  const [hasSelectedPeriod, setHasSelectedPeriod] = useState<boolean>(false);

  // Dados
  const [dashboard, setDashboard] = useState<CommercialDashboardDto | null>(null);
  const [leads, setLeads] = useState<LeadDto[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Estados específicos de Cancelamentos
  const [cancellationRecords, setCancellationRecords] = useState<any[]>([]);
  const [cancellationsLoading, setCancellationsLoading] = useState<boolean>(false);
  const [cancellationSearch, setCancellationSearch] = useState<string>('');
  const [cancellationRegionFilter, setCancellationRegionFilter] = useState<string>('all');
  const [cancellationReasonFilter, setCancellationReasonFilter] = useState<string>('all');
  const [selectedCancellationIds, setSelectedCancellationIds] = useState<(string | number)[]>([]);
  const [cancellationsViewMode, setCancellationsViewMode] = useState<'chart' | 'table'>('chart');
  const [hoveredCancellationDay, setHoveredCancellationDay] = useState<any | null>(null);
  const [exportingCsv, setExportingCsv] = useState<boolean>(false);
  const [includeClientListInPdf, setIncludeClientListInPdf] = useState<boolean>(false);
  const [includeClientListInExecutivePdf, setIncludeClientListInExecutivePdf] = useState<boolean>(false);
  const [selectedContractForModal, setSelectedContractForModal] = useState<string | null>(null);
  const [excludedReasons, setExcludedReasons] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('rbxhub_cancellation_excluded_reasons');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [reasonFilterOpen, setReasonFilterOpen] = useState<boolean>(false);
  const [reasonSearchTerm, setReasonSearchTerm] = useState<string>('');

  useEffect(() => {
    try {
      localStorage.setItem('rbxhub_cancellation_excluded_reasons', JSON.stringify(excludedReasons));
    } catch {
      // Ignora erro de quota de localStorage
    }
  }, [excludedReasons]);

  // Filtros Globais da Barra Superior
  const [selectedGlobalSeller, setSelectedGlobalSeller] = useState<string>('all');
  const [selectedGlobalRegion, setSelectedGlobalRegion] = useState<string>('all');
  const [selectedGlobalGroup, setSelectedGlobalGroup] = useState<string>('all');
  const [excludedPlans, setExcludedPlans] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('rbxhub_commercial_excluded_plans');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [planFilterOpen, setPlanFilterOpen] = useState<boolean>(false);
  const [planSearchTerm, setPlanSearchTerm] = useState<string>('');

  // Filtros de Auditoria e Visibilidade de Colaboradores
  const [hideInactiveSellers, setHideInactiveSellers] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rbxhub_hide_inactive_sellers') === 'true';
    } catch {
      return false;
    }
  });
  const [hideThirdPartySellers, setHideThirdPartySellers] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rbxhub_hide_third_party_sellers') === 'true';
    } catch {
      return false;
    }
  });
  const [hideUnassignedSellers, setHideUnassignedSellers] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rbxhub_hide_unassigned_sellers') === 'true';
    } catch {
      return false;
    }
  });
  const [sellerFilterOpen, setSellerFilterOpen] = useState<boolean>(false);
  const [sellerSearchTerm, setSellerSearchTerm] = useState<string>('');

  useEffect(() => {
    try {
      localStorage.setItem('rbxhub_commercial_excluded_plans', JSON.stringify(excludedPlans));
    } catch {
      // Ignora erro de quota de localStorage
    }
  }, [excludedPlans]);

  useEffect(() => {
    try {
      localStorage.setItem('rbxhub_hide_inactive_sellers', String(hideInactiveSellers));
      localStorage.setItem('rbxhub_hide_third_party_sellers', String(hideThirdPartySellers));
      localStorage.setItem('rbxhub_hide_unassigned_sellers', String(hideUnassignedSellers));
    } catch {
      // Ignora erro de quota de localStorage
    }
  }, [hideInactiveSellers, hideThirdPartySellers, hideUnassignedSellers]);

  // Estados de Vendas Fechadas
  const [closedSalesRecords, setClosedSalesRecords] = useState<any[]>([]);
  const [closedSalesLoading, setClosedSalesLoading] = useState<boolean>(false);

  // Filtros de Carteira
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);

  // Modais e Drawers
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [leadForContract, setLeadForContract] = useState<LeadDto | null>(null);
  const [createLeadOpen, setCreateLeadOpen] = useState<boolean>(false);
  const [drilldownMetric, setDrilldownMetric] = useState<{ id: string; name: string } | null>(null);

  const getPeriodLabel = (p: CommercialPeriodType): string => {
    switch (p) {
      case 'today': return 'Hoje';
      case '7d': return 'Últimos 7 Dias';
      case '30d': return 'Últimos 30 Dias';
      case 'month': return 'Mês Atual';
      case 'year': return 'Ano Corrente';
      case 'custom': return 'Período Personalizado';
      default: return 'Período';
    }
  };

  const loadCancellationDetails = async (
    targetPeriod: CommercialPeriodType = period,
    targetStart: string = customStartDate,
    targetEnd: string = customEndDate,
    targetSeller: string = selectedGlobalSeller,
    targetHideInactive: boolean = hideInactiveSellers,
    targetHideThirdParty: boolean = hideThirdPartySellers,
    targetHideUnassigned: boolean = hideUnassignedSellers
  ) => {
    try {
      setCancellationsLoading(true);
      let queryParams = `metricId=cancelamentos_periodo&period=${targetPeriod}`;
      if (targetPeriod === 'custom' && targetStart && targetEnd) {
        queryParams += `&startDate=${targetStart}&endDate=${targetEnd}`;
      }
      if (targetSeller && targetSeller !== 'all') {
        queryParams += `&seller=${encodeURIComponent(targetSeller)}`;
      }
      if (targetHideInactive) {
        queryParams += `&hideInactiveSellers=true`;
      }
      if (targetHideThirdParty) {
        queryParams += `&hideThirdPartySellers=true`;
      }
      // Cancelamentos não são filtrados por vendedor 'Não Atribuído'
      const res = await apiFetch<{ records: any[] }>(`sales/insights/drilldown?${queryParams}`);
      setCancellationRecords(res.records || []);
    } catch (err) {
      console.error('Erro ao carregar lista detalhada de cancelamentos:', err);
    } finally {
      setCancellationsLoading(false);
    }
  };

  const loadClosedSalesDetails = async (
    targetPeriod: CommercialPeriodType = period,
    targetStart: string = customStartDate,
    targetEnd: string = customEndDate,
    targetSeller: string = selectedGlobalSeller,
    targetRegion: string = selectedGlobalRegion,
    targetGroup: string = selectedGlobalGroup,
    targetExcludedPlans: string[] = excludedPlans,
    targetHideInactive: boolean = hideInactiveSellers,
    targetHideThirdParty: boolean = hideThirdPartySellers,
    targetHideUnassigned: boolean = hideUnassignedSellers
  ) => {
    try {
      setClosedSalesLoading(true);
      let queryParams = `metricId=vendas_fechadas&period=${targetPeriod}`;
      if (targetPeriod === 'custom' && targetStart && targetEnd) {
        queryParams += `&startDate=${targetStart}&endDate=${targetEnd}`;
      }
      if (targetSeller && targetSeller !== 'all') {
        queryParams += `&seller=${encodeURIComponent(targetSeller)}`;
      }
      if (targetRegion && targetRegion !== 'all') {
        queryParams += `&region=${encodeURIComponent(targetRegion)}`;
      }
      if (targetGroup && targetGroup !== 'all') {
        queryParams += `&group=${encodeURIComponent(targetGroup)}`;
      }
      if (targetExcludedPlans && targetExcludedPlans.length > 0) {
        queryParams += `&excludePlans=${encodeURIComponent(targetExcludedPlans.join(','))}`;
      }
      if (targetHideInactive) {
        queryParams += `&hideInactiveSellers=true`;
      }
      if (targetHideThirdParty) {
        queryParams += `&hideThirdPartySellers=true`;
      }
      if (targetHideUnassigned) {
        queryParams += `&hideUnassignedSellers=true`;
      }
      const res = await apiFetch<{ records: any[] }>(`sales/insights/drilldown?${queryParams}`);
      setClosedSalesRecords(res.records || []);
    } catch (err) {
      console.error('Erro ao carregar lista detalhada de vendas fechadas:', err);
    } finally {
      setClosedSalesLoading(false);
    }
  };

  const loadAll = async (
    targetPeriod: CommercialPeriodType = period,
    targetStart: string = customStartDate,
    targetEnd: string = customEndDate,
    targetSeller: string = selectedGlobalSeller,
    targetRegion: string = selectedGlobalRegion,
    targetGroup: string = selectedGlobalGroup,
    targetExcludedPlans: string[] = excludedPlans,
    targetHideInactive: boolean = hideInactiveSellers,
    targetHideThirdParty: boolean = hideThirdPartySellers,
    targetHideUnassigned: boolean = hideUnassignedSellers,
    targetExcludedReasons: string[] = excludedReasons
  ) => {
    try {
      setRefreshing(true);
      setHasSelectedPeriod(true);
      let queryParams = `period=${targetPeriod}`;
      if (targetPeriod === 'custom' && targetStart && targetEnd) {
        queryParams += `&startDate=${targetStart}&endDate=${targetEnd}`;
      }
      if (targetSeller && targetSeller !== 'all') {
        queryParams += `&seller=${encodeURIComponent(targetSeller)}`;
      }
      if (targetRegion && targetRegion !== 'all') {
        queryParams += `&region=${encodeURIComponent(targetRegion)}`;
      }
      if (targetGroup && targetGroup !== 'all') {
        queryParams += `&group=${encodeURIComponent(targetGroup)}`;
      }
      if (targetExcludedPlans && targetExcludedPlans.length > 0) {
        queryParams += `&excludePlans=${encodeURIComponent(targetExcludedPlans.join(','))}`;
      }
      if (targetExcludedReasons && targetExcludedReasons.length > 0) {
        queryParams += `&excludeReasons=${encodeURIComponent(targetExcludedReasons.join(','))}`;
      }
      if (targetHideInactive) {
        queryParams += `&hideInactiveSellers=true`;
      }
      if (targetHideThirdParty) {
        queryParams += `&hideThirdPartySellers=true`;
      }
      if (targetHideUnassigned) {
        queryParams += `&hideUnassignedSellers=true`;
      }
      const [dashRes, leadsRes] = await Promise.all([
        apiFetch<CommercialDashboardDto>(`sales/insights?${queryParams}`),
        apiFetch<{ leads: LeadDto[] }>(`sales/leads?limit=100&${queryParams}`),
      ]);
      setDashboard(dashRes);
      setLeads(leadsRes.leads || []);
      loadCancellationDetails(targetPeriod, targetStart, targetEnd, targetSeller, targetHideInactive, targetHideThirdParty, targetHideUnassigned);
      loadClosedSalesDetails(targetPeriod, targetStart, targetEnd, targetSeller, targetRegion, targetGroup, targetExcludedPlans, targetHideInactive, targetHideThirdParty, targetHideUnassigned);
    } catch (err: any) {
      console.error('Erro ao carregar dados comerciais:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handlePeriodChange = (newPeriod: CommercialPeriodType) => {
    setPeriod(newPeriod);
    loadAll(newPeriod, customStartDate, customEndDate, selectedGlobalSeller, selectedGlobalRegion, selectedGlobalGroup, excludedPlans, hideInactiveSellers, hideThirdPartySellers, hideUnassignedSellers);
  };

  const handleApplyCustomDates = () => {
    if (customStartDate && customEndDate) {
      loadAll('custom', customStartDate, customEndDate, selectedGlobalSeller, selectedGlobalRegion, selectedGlobalGroup, excludedPlans, hideInactiveSellers, hideThirdPartySellers, hideUnassignedSellers);
    }
  };

  const handleSellerChange = (newSeller: string) => {
    setSelectedGlobalSeller(newSeller);
    loadAll(period, customStartDate, customEndDate, newSeller, selectedGlobalRegion, selectedGlobalGroup, excludedPlans, hideInactiveSellers, hideThirdPartySellers, hideUnassignedSellers);
  };

  const handleToggleHideInactive = () => {
    const next = !hideInactiveSellers;
    setHideInactiveSellers(next);
    loadAll(period, customStartDate, customEndDate, selectedGlobalSeller, selectedGlobalRegion, selectedGlobalGroup, excludedPlans, next, hideThirdPartySellers, hideUnassignedSellers);
  };

  const handleToggleHideThirdParty = () => {
    const next = !hideThirdPartySellers;
    setHideThirdPartySellers(next);
    loadAll(period, customStartDate, customEndDate, selectedGlobalSeller, selectedGlobalRegion, selectedGlobalGroup, excludedPlans, hideInactiveSellers, next, hideUnassignedSellers);
  };

  const handleToggleHideUnassigned = () => {
    const next = !hideUnassignedSellers;
    setHideUnassignedSellers(next);
    loadAll(period, customStartDate, customEndDate, selectedGlobalSeller, selectedGlobalRegion, selectedGlobalGroup, excludedPlans, hideInactiveSellers, hideThirdPartySellers, next);
  };

  const handleRegionChange = (newRegion: string) => {
    setSelectedGlobalRegion(newRegion);
    loadAll(period, customStartDate, customEndDate, selectedGlobalSeller, newRegion, selectedGlobalGroup, excludedPlans, hideInactiveSellers, hideThirdPartySellers, hideUnassignedSellers);
  };

  const handleGroupChange = (newGroup: string) => {
    setSelectedGlobalGroup(newGroup);
    loadAll(period, customStartDate, customEndDate, selectedGlobalSeller, selectedGlobalRegion, newGroup, excludedPlans, hideInactiveSellers, hideThirdPartySellers, hideUnassignedSellers);
  };

  const handleTogglePlan = (planName: string) => {
    const isExcluded = excludedPlans.includes(planName);
    const nextExcluded = isExcluded
      ? excludedPlans.filter((p) => p !== planName)
      : [...excludedPlans, planName];
    setExcludedPlans(nextExcluded);
    loadAll(period, customStartDate, customEndDate, selectedGlobalSeller, selectedGlobalRegion, selectedGlobalGroup, nextExcluded, hideInactiveSellers, hideThirdPartySellers, hideUnassignedSellers);
  };

  const handleSelectAllPlans = () => {
    setExcludedPlans([]);
    loadAll(period, customStartDate, customEndDate, selectedGlobalSeller, selectedGlobalRegion, selectedGlobalGroup, [], hideInactiveSellers, hideThirdPartySellers, hideUnassignedSellers);
  };

  const handleUnselectAllPlans = () => {
    const allNames = (dashboard?.allAvailablePlans || []).map((p) => p.name);
    setExcludedPlans(allNames);
    loadAll(period, customStartDate, customEndDate, selectedGlobalSeller, selectedGlobalRegion, selectedGlobalGroup, allNames, hideInactiveSellers, hideThirdPartySellers, hideUnassignedSellers);
  };

  // Efeito para carregar cancelamentos ou vendas ao alternar para a aba se já houver período
  useEffect(() => {
    if (activeTab === 'cancelamentos' && hasSelectedPeriod && cancellationRecords.length === 0) {
      loadCancellationDetails(period, customStartDate, customEndDate, selectedGlobalSeller, hideInactiveSellers, hideThirdPartySellers, hideUnassignedSellers);
    }
    if (activeTab === 'vendas' && hasSelectedPeriod && closedSalesRecords.length === 0) {
      loadClosedSalesDetails(period, customStartDate, customEndDate, selectedGlobalSeller, selectedGlobalRegion, selectedGlobalGroup, excludedPlans, hideInactiveSellers, hideThirdPartySellers, hideUnassignedSellers);
    }
  }, [activeTab]);

  const allAvailablePlans = useMemo(() => {
    return dashboard?.allAvailablePlans || [];
  }, [dashboard?.allAvailablePlans]);

  const filteredPlansList = useMemo(() => {
    if (!planSearchTerm.trim()) return allAvailablePlans;
    const term = planSearchTerm.toLowerCase();
    return allAvailablePlans.filter((p) => p.name.toLowerCase().includes(term));
  }, [allAvailablePlans, planSearchTerm]);

  const allAvailableSellers = useMemo(() => {
    if (dashboard?.allAvailableSellers && dashboard.allAvailableSellers.length > 0) {
      return dashboard.allAvailableSellers;
    }
    const map = new Map<string, { name: string; count: number; value: number; sellerType: SellerType }>();
    dashboard?.topSellers?.forEach((s) => {
      if (s.name) {
        map.set(s.name, {
          name: s.name,
          count: s.count || 0,
          value: s.value || 0,
          sellerType: s.sellerType || 'active',
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [dashboard?.allAvailableSellers, dashboard?.topSellers]);

  const filteredAvailableSellers = useMemo(() => {
    if (!sellerSearchTerm.trim()) return allAvailableSellers;
    const term = sellerSearchTerm.toLowerCase();
    return allAvailableSellers.filter((s) => s.name.toLowerCase().includes(term));
  }, [allAvailableSellers, sellerSearchTerm]);

  const availableSellers = useMemo(() => {
    const list = allAvailableSellers.map((s) => s.name);
    return Array.from(new Set(list)).sort();
  }, [allAvailableSellers]);

  const availableRegions = useMemo(() => {
    const set = new Set<string>();
    dashboard?.salesByRegion?.forEach((r) => {
      if (r.region) set.add(r.region);
    });
    dashboard?.salesByCity?.forEach((c) => {
      if (c.city) set.add(c.city);
    });
    return Array.from(set).sort();
  }, [dashboard?.salesByRegion, dashboard?.salesByCity]);

  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    dashboard?.allAvailableGroups?.forEach((g) => {
      if (g) set.add(g);
    });
    dashboard?.salesByGroup?.forEach((g) => {
      if (g.group) set.add(g.group);
    });
    return Array.from(set).sort();
  }, [dashboard?.allAvailableGroups, dashboard?.salesByGroup]);

  // Filtragem de Leads no client-side para resposta instantânea
  const filteredLeads = leads.filter((l) => {
    if (stageFilter !== 'all' && l.stage !== stageFilter) return false;
    if (ownerFilter !== 'all' && !(l.owner || '').toLowerCase().includes(ownerFilter.toLowerCase())) return false;
    if (overdueOnly && !l.isNextActionOverdue) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const match =
        (l.name || '').toLowerCase().includes(term) ||
        (l.city || '').toLowerCase().includes(term) ||
        String(l.code || '').includes(term) ||
        String(l.phone || '').includes(term);
      if (!match) return false;
    }
    return true;
  });

  const ownersList = Array.from(new Set(leads.map((l) => l.owner).filter(Boolean)));

  const handleAdvanceStage = async (leadId: number, nextStage: LeadStage) => {
    try {
      await apiFetch(`sales/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: nextStage }),
      });
      loadAll();
    } catch (err: any) {
      alert(`Erro ao avançar etapa: ${err.message}`);
    }
  };

  // Todos os motivos únicos presentes nos dados de cancelamento carregados
  const allAvailableReasons = useMemo(() => {
    if (dashboard?.allAvailableReasons && dashboard.allAvailableReasons.length > 0) {
      return dashboard.allAvailableReasons.map((r) => r.reason);
    }
    return Array.from(
      new Set(cancellationRecords.map((r) => r.reason || 'Não informado').filter(Boolean))
    ).sort();
  }, [dashboard?.allAvailableReasons, cancellationRecords]);

  // Contagem bruta de ocorrências de cada motivo (para exibir no dropdown e badges)
  const rawReasonCounts = useMemo(() => {
    if (dashboard?.allAvailableReasons && dashboard.allAvailableReasons.length > 0) {
      const map: Record<string, number> = {};
      for (const item of dashboard.allAvailableReasons) {
        map[item.reason] = item.count;
      }
      return map;
    }
    const map: Record<string, number> = {};
    for (const r of cancellationRecords) {
      const reason = r.reason || 'Não informado';
      map[reason] = (map[reason] || 0) + 1;
    }
    return map;
  }, [dashboard?.allAvailableReasons, cancellationRecords]);

  // Motivos filtrados para o dropdown de busca
  const filteredAvailableReasons = useMemo(() => {
    if (!reasonSearchTerm.trim()) return allAvailableReasons;
    const term = reasonSearchTerm.toLowerCase();
    return allAvailableReasons.filter((r) => r.toLowerCase().includes(term));
  }, [allAvailableReasons, reasonSearchTerm]);

  // Handlers para filtro de motivos
  const handleToggleReason = (reason: string) => {
    const isExcluded = excludedReasons.includes(reason);
    const nextExcluded = isExcluded
      ? excludedReasons.filter((r) => r !== reason)
      : [...excludedReasons, reason];
    setExcludedReasons(nextExcluded);
    loadAll(
      period,
      customStartDate,
      customEndDate,
      selectedGlobalSeller,
      selectedGlobalRegion,
      selectedGlobalGroup,
      excludedPlans,
      hideInactiveSellers,
      hideThirdPartySellers,
      hideUnassignedSellers,
      nextExcluded
    );
  };

  const handleSelectAllReasons = () => {
    setExcludedReasons([]);
    loadAll(
      period,
      customStartDate,
      customEndDate,
      selectedGlobalSeller,
      selectedGlobalRegion,
      selectedGlobalGroup,
      excludedPlans,
      hideInactiveSellers,
      hideThirdPartySellers,
      hideUnassignedSellers,
      []
    );
  };

  const handleDeselectAllReasons = () => {
    const allReasons = [...allAvailableReasons];
    setExcludedReasons(allReasons);
    loadAll(
      period,
      customStartDate,
      customEndDate,
      selectedGlobalSeller,
      selectedGlobalRegion,
      selectedGlobalGroup,
      excludedPlans,
      hideInactiveSellers,
      hideThirdPartySellers,
      hideUnassignedSellers,
      allReasons
    );
  };

  // Registros de cancelamento ATIVOS (considerando os motivos não excluídos)
  const activeCancellationRecords = useMemo(() => {
    if (excludedReasons.length === 0) return cancellationRecords;
    const excludedSet = new Set(excludedReasons.map((r) => r.toLowerCase()));
    return cancellationRecords.filter(
      (r) => !excludedSet.has((r.reason || 'Não informado').toLowerCase())
    );
  }, [cancellationRecords, excludedReasons]);

  // Total de cancelados e Evasão Mensal (MRR) recalculada reativamente
  const activeCancellationsCount = cancellationRecords.length > 0
    ? activeCancellationRecords.length
    : dashboard?.kpis?.cancellationsCount || 0;

  const activeCancellationMonthlyLoss = useMemo(() => {
    if (cancellationRecords.length > 0) {
      return activeCancellationRecords.reduce((acc, r) => acc + (Number(r.monthlyValue) || 0), 0);
    }
    return (dashboard?.cancellationsByCity || []).reduce(
      (acc, c) => acc + (c.monthlyLoss || 0),
      0
    );
  }, [activeCancellationRecords, cancellationRecords.length, dashboard?.cancellationsByCity]);

  // Motivos de cancelamento recalculados para o ranking
  const activeCancellationsByReason = useMemo(() => {
    if (cancellationRecords.length === 0) {
      return dashboard?.cancellationsByReason || [];
    }
    const map: Record<string, number> = {};
    for (const r of activeCancellationRecords) {
      const reason = r.reason || 'Não informado';
      map[reason] = (map[reason] || 0) + 1;
    }
    return Object.keys(map)
      .map((reason) => ({ reason, count: map[reason] }))
      .sort((a, b) => b.count - a.count);
  }, [activeCancellationRecords, cancellationRecords.length, dashboard?.cancellationsByReason]);

  const topActiveReason = activeCancellationsByReason[0] || null;

  // Regiões / Grupos recalculados para o ranking territorial
  const activeCancellationsByCity = useMemo(() => {
    if (cancellationRecords.length === 0) {
      return dashboard?.cancellationsByCity || [];
    }
    const map: Record<string, { city: string; state: string; count: number; monthlyLoss: number }> = {};
    for (const r of activeCancellationRecords) {
      const groupName = r.group && r.group !== 'Geral' && r.group !== 'Residencial' ? r.group : '';
      const cityName = r.city && r.city !== 'Não informada' && r.city !== 'São Paulo' ? r.city : '';
      const region = groupName || cityName || r.group || r.city || 'Região Geral';
      const state = r.state || 'SP';
      if (!map[region]) {
        map[region] = { city: region, state, count: 0, monthlyLoss: 0 };
      }
      map[region].count++;
      map[region].monthlyLoss += Number(r.monthlyValue) || 0;
    }
    const totalCount = activeCancellationsCount || 1;
    return Object.values(map)
      .map((item) => ({
        city: item.city,
        state: item.state,
        count: item.count,
        percentage: (item.count / totalCount) * 100,
        monthlyLoss: item.monthlyLoss,
      }))
      .sort((a, b) => b.count - a.count);
  }, [activeCancellationRecords, cancellationRecords.length, activeCancellationsCount, dashboard?.cancellationsByCity]);

  const topActiveRegion = activeCancellationsByCity[0] || null;

  // Série temporal diária recalculada
  const activeCancellationTimeSeries = useMemo(() => {
    if (cancellationRecords.length === 0) {
      return dashboard?.timeSeries || [];
    }
    const dateMap: Record<string, number> = {};
    if (dashboard?.timeSeries) {
      for (const pt of dashboard.timeSeries) {
        dateMap[pt.date] = 0;
      }
    }
    for (const r of activeCancellationRecords) {
      if (r.date) {
        const day = r.date.slice(0, 10);
        dateMap[day] = (dateMap[day] || 0) + 1;
      }
    }
    return Object.keys(dateMap)
      .sort()
      .map((date) => ({
        date,
        cancellations: dateMap[date] || 0,
      }));
  }, [dashboard?.timeSeries, activeCancellationRecords, cancellationRecords.length]);

  const maxActiveCancellationDaily = useMemo(() => {
    return Math.max(...activeCancellationTimeSeries.map((t) => t.cancellations), 3);
  }, [activeCancellationTimeSeries]);

  // Filtragem de cancelamentos na tabela individual
  const filteredCancellations = useMemo(() => {
    return activeCancellationRecords.filter((r) => {
      if (cancellationRegionFilter !== 'all') {
        const target = cancellationRegionFilter.toLowerCase();
        const matchRegion =
          (r.group && r.group.toLowerCase() === target) || (r.city && r.city.toLowerCase() === target);
        if (!matchRegion) return false;
      }
      if (
        cancellationReasonFilter !== 'all' &&
        (r.reason || 'Não informado').toLowerCase() !== cancellationReasonFilter.toLowerCase()
      ) {
        return false;
      }
      if (cancellationSearch) {
        const term = cancellationSearch.toLowerCase().trim();
        const match =
          (r.name && r.name.toLowerCase().includes(term)) ||
          (r.id && String(r.id).toLowerCase().includes(term)) ||
          (r.clientId && String(r.clientId).toLowerCase().includes(term)) ||
          (r.group && r.group.toLowerCase().includes(term)) ||
          (r.city && r.city.toLowerCase().includes(term)) ||
          (r.reason && r.reason.toLowerCase().includes(term)) ||
          (r.competitor && r.competitor.toLowerCase().includes(term)) ||
          (r.seller && r.seller.toLowerCase().includes(term)) ||
          (r.plan && r.plan.toLowerCase().includes(term));
        if (!match) return false;
      }
      return true;
    });
  }, [activeCancellationRecords, cancellationRegionFilter, cancellationReasonFilter, cancellationSearch]);

  const uniqueCancellationRegions = Array.from(
    new Set(activeCancellationRecords.map((r) => r.group || r.city).filter(Boolean))
  ).sort();
  const uniqueCancellationReasons = Array.from(
    new Set(activeCancellationRecords.map((r) => r.reason).filter(Boolean))
  ).sort();

  const handleSelectAllCancellations = () => {
    if (selectedCancellationIds.length === filteredCancellations.length) {
      setSelectedCancellationIds([]);
    } else {
      setSelectedCancellationIds(filteredCancellations.map((r) => r.id));
    }
  };

  const handleToggleSelectCancellation = (id: string | number) => {
    setSelectedCancellationIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExportPdf = (onlySelected = false) => {
    let recordsToExport = filteredCancellations;
    if (onlySelected && selectedCancellationIds.length > 0) {
      const selectedSet = new Set(selectedCancellationIds);
      recordsToExport = activeCancellationRecords.filter((r) => selectedSet.has(r.id));
    }
    if (recordsToExport.length === 0) {
      alert('Nenhum contrato cancelado selecionado para exportação.');
      return;
    }
    exportCancellationsToPdf({
      records: recordsToExport,
      user,
      periodLabel: getPeriodLabel(period),
      filters: {
        search: cancellationSearch || undefined,
        city: cancellationRegionFilter !== 'all' ? cancellationRegionFilter : undefined,
        reason: cancellationReasonFilter !== 'all' ? cancellationReasonFilter : undefined,
        excludedReasons: excludedReasons.length > 0 ? excludedReasons : undefined,
        seller: selectedGlobalSeller !== 'all' ? selectedGlobalSeller : undefined,
        hideInactive: hideInactiveSellers,
        hideThirdParty: hideThirdPartySellers,
      },
      timeSeries: activeCancellationTimeSeries,
      includeClientList: includeClientListInPdf || onlySelected,
    });
  };

  const handleExportCsv = async (onlySelected = false) => {
    let recordsToExport = filteredCancellations;
    if (onlySelected && selectedCancellationIds.length > 0) {
      const selectedSet = new Set(selectedCancellationIds);
      recordsToExport = activeCancellationRecords.filter((r) => selectedSet.has(r.id));
    }
    if (recordsToExport.length === 0) {
      alert('Nenhum contrato cancelado para exportação CSV.');
      return;
    }

    setExportingCsv(true);
    try {
      const headers = [
        'Contrato',
        'Cod_Cliente',
        'Assinante',
        'Regiao_Grupo',
        'UF',
        'Plano',
        'Valor_Mensal',
        'Data_Cancelamento',
        'Motivo_Cancelamento',
        'Concorrencia',
        'Vendedor',
      ];
      const rows = recordsToExport.map((r) => [
        r.id || '',
        r.clientId || '',
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${(r.group || r.city || '').replace(/"/g, '""')}"`,
        r.state || '',
        `"${(r.plan || '').replace(/"/g, '""')}"`,
        (r.monthlyValue || 0).toFixed(2),
        r.date || '',
        `"${(r.reason || '').replace(/"/g, '""')}"`,
        `"${(r.competitor || '').replace(/"/g, '""')}"`,
        `"${(r.seller || '').replace(/"/g, '""')}"`,
      ]);
      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `rbxhub_cancelamentos_${period}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(`Erro ao exportar CSV: ${err.message}`);
    } finally {
      setExportingCsv(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Topo da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">CRM Comercial</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestão de leads, funil de conversão, esteira assistida de vendas e métricas contratuais
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadAll(period, customStartDate, customEndDate)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-xs disabled:opacity-50 cursor-pointer"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setCreateLeadOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-[#002f9f] shadow-md flex items-center gap-2 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Novo Lead
          </button>
        </div>
      </div>

      {/* Barra de Filtros de Período Global (Estilo Painel de Gestão) */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border shadow-2xs transition-all duration-300 ${
          !hasSelectedPeriod
            ? 'border-brand-primary ring-2 ring-brand-primary/50 shadow-md shadow-brand-primary/10'
            : 'border-slate-200/90'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 pl-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Período:</span>
            {!hasSelectedPeriod && (
              <span className="px-2.5 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary text-[10px] font-bold animate-pulse flex items-center gap-1 border border-brand-primary/20">
                <Sparkles className="w-3 h-3" />
                Selecione para buscar
              </span>
            )}
          </div>
          {/* Seletor de Período em Pílula */}
          <div
            className={`inline-flex bg-slate-100/90 p-1 rounded-full border border-slate-200/70 text-xs font-medium shadow-2xs transition-opacity duration-200 ${
              refreshing ? 'opacity-85' : ''
            }`}
          >
            {(
              [
                { id: 'today', label: 'Hoje' },
                { id: '7d', label: '7 Dias' },
                { id: '30d', label: '30 Dias' },
                { id: 'month', label: 'Mês Atual' },
                { id: 'year', label: 'Ano' },
                { id: 'custom', label: 'Personalizado' },
              ] as const
            ).map((item) => {
              const isActive = period === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={refreshing}
                  onClick={() => handlePeriodChange(item.id)}
                  className={`px-3.5 py-1 rounded-full transition-all duration-150 flex items-center gap-1.5 ${
                    refreshing ? 'cursor-wait' : 'cursor-pointer'
                  } ${
                    isActive
                      ? 'bg-white text-brand-primary shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 disabled:hover:text-slate-600'
                  }`}
                >
                  {isActive && refreshing && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-ping shrink-0" />
                  )}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Inputs de Data do Filtro Personalizado */}
          {period === 'custom' && (
            <div
              className={`flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl text-xs shadow-2xs animate-in fade-in zoom-in-95 transition-opacity duration-200 ${
                refreshing ? 'opacity-80' : ''
              }`}
            >
              <span className="text-slate-500 font-medium">De:</span>
              <input
                type="date"
                disabled={refreshing}
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:cursor-wait disabled:opacity-75"
              />
              <span className="text-slate-500 font-medium">Até:</span>
              <input
                type="date"
                disabled={refreshing}
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:cursor-wait disabled:opacity-75"
              />
              <button
                type="button"
                disabled={refreshing}
                onClick={handleApplyCustomDates}
                className={`px-3 py-1 rounded-lg bg-brand-primary text-white font-semibold text-[11px] hover:bg-[#002f9f] transition shadow-2xs flex items-center gap-1.5 ${
                  refreshing ? 'cursor-wait opacity-80' : 'cursor-pointer'
                }`}
              >
                {refreshing && <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
                <span>Filtrar</span>
              </button>
            </div>
          )}
        </div>

        {/* Indicador do Período Ativo */}
        <div className="text-xs text-slate-500 flex items-center gap-1.5 pr-1">
          <Calendar className="w-3.5 h-3.5 text-brand-primary" />
          <span className="font-semibold text-slate-700">
            {hasSelectedPeriod
              ? dashboard?.period?.label || 'Carregando período...'
              : 'Nenhum período consultado'}
          </span>
        </div>
      </div>

      {/* Barra de Filtros Corporativos Globais (Atendente, Região e Planos) */}
      {hasSelectedPeriod && (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">
              Filtros:
            </span>

            {/* Seletor de Vendedor/Atendente */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl text-xs">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedGlobalSeller}
                disabled={refreshing}
                onChange={(e) => handleSellerChange(e.target.value)}
                className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer max-w-[180px] sm:max-w-[220px] truncate"
              >
                <option value="all">Todos os Atendentes</option>
                {allAvailableSellers.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} {s.sellerType === 'inactive' ? '(Ex-colaborador)' : s.sellerType === 'third_party' ? '(Terceiro)' : s.sellerType === 'unassigned' ? '(Não atribuído)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Seletor de Região/Cidade */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl text-xs">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedGlobalRegion}
                disabled={refreshing}
                onChange={(e) => handleRegionChange(e.target.value)}
                className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">Todas as Regiões/Cidades</option>
                {availableRegions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Seletor de Grupo de Clientes */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl text-xs">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedGlobalGroup}
                disabled={refreshing}
                onChange={(e) => handleGroupChange(e.target.value)}
                className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer"
                title="Filtrar por Grupo de Clientes do RBXSoft"
              >
                <option value="all">Todos os Grupos de Clientes</option>
                {availableGroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Seletor Popover Interativo de Planos */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setPlanFilterOpen(!planFilterOpen)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition flex items-center gap-2 border shadow-2xs cursor-pointer ${
                  excludedPlans.length > 0
                    ? 'bg-blue-50 text-brand-primary border-blue-300 ring-2 ring-blue-300/40 hover:bg-blue-100'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
                title="Filtrar quais planos comerciais devem fazer parte da análise"
              >
                <Filter className={`w-3.5 h-3.5 ${excludedPlans.length > 0 ? 'text-brand-primary' : 'text-slate-400'}`} />
                <span>Filtrar Planos</span>
                {allAvailablePlans.length > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full font-mono text-[10px] ${
                      excludedPlans.length > 0
                        ? 'bg-brand-primary text-white font-bold'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {allAvailablePlans.length - excludedPlans.length}/{allAvailablePlans.length} ativos
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${planFilterOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Popover Flutuante de Seleção de Planos */}
              {planFilterOpen && (
                <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5 text-brand-primary" />
                        <span>Planos no Relatório</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Desmarque os planos que deseja retirar da análise
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPlanFilterOpen(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Busca de Planos */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      placeholder="Buscar plano..."
                      value={planSearchTerm}
                      onChange={(e) => setPlanSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                  </div>

                  {/* Ações Rápidas: Marcar Todos / Desmarcar Todos */}
                  <div className="flex items-center justify-between text-[11px] px-1">
                    <span className="text-slate-500 font-medium">
                      {allAvailablePlans.length - excludedPlans.length} de {allAvailablePlans.length} ativos
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllPlans}
                        className="text-brand-primary hover:underline font-semibold cursor-pointer"
                      >
                        Marcar Todos
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={handleUnselectAllPlans}
                        className="text-slate-500 hover:underline cursor-pointer"
                      >
                        Desmarcar Todos
                      </button>
                    </div>
                  </div>

                  {/* Lista com Rolagem de Planos */}
                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1 divide-y divide-slate-50">
                    {filteredPlansList.length === 0 ? (
                      <div className="text-xs text-slate-400 py-4 text-center">
                        Nenhum plano encontrado.
                      </div>
                    ) : (
                      filteredPlansList.map((plan) => {
                        const isExcluded = excludedPlans.includes(plan.name);
                        return (
                          <label
                            key={plan.name}
                            className="flex items-center justify-between gap-2.5 py-1.5 px-2 rounded-xl hover:bg-slate-50 cursor-pointer transition text-xs select-none"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={!isExcluded}
                                onChange={() => handleTogglePlan(plan.name)}
                                className="rounded text-brand-primary focus:ring-brand-primary/20 w-3.5 h-3.5"
                              />
                              <span
                                className={`truncate font-medium ${
                                  isExcluded ? 'text-slate-400 line-through' : 'text-slate-800'
                                }`}
                              >
                                {plan.name}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono shrink-0">
                              {plan.count} {plan.count === 1 ? 'venda' : 'vendas'}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Seletor Popover Interativo de Motivos de Cancelamento */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setReasonFilterOpen(!reasonFilterOpen)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition flex items-center gap-2 border shadow-2xs cursor-pointer ${
                  excludedReasons.length > 0
                    ? 'bg-amber-50 text-amber-900 border-amber-300 ring-2 ring-amber-300/40 hover:bg-amber-100'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
                title="Filtrar quais motivos de cancelamento devem fazer parte da análise"
              >
                <Filter className={`w-3.5 h-3.5 ${excludedReasons.length > 0 ? 'text-amber-700' : 'text-slate-400'}`} />
                <span>Filtrar Motivos</span>
                {allAvailableReasons.length > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full font-mono text-[10px] ${
                      excludedReasons.length > 0
                        ? 'bg-amber-200 text-amber-900 font-bold'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {allAvailableReasons.length - excludedReasons.length}/{allAvailableReasons.length} ativos
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${reasonFilterOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Popover Flutuante de Seleção de Motivos */}
              {reasonFilterOpen && (
                <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5 text-brand-primary" />
                        <span>Motivos de Cancelamento</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Desmarque motivos para excluí-los da análise comercial
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReasonFilterOpen(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Busca de Motivos */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      placeholder="Buscar motivo..."
                      value={reasonSearchTerm}
                      onChange={(e) => setReasonSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary bg-slate-50"
                    />
                  </div>

                  {/* Ações Rápidas: Marcar Todos / Desmarcar Todos */}
                  <div className="flex items-center justify-between text-[11px] px-1">
                    <span className="text-slate-500 font-medium">
                      {allAvailableReasons.length - excludedReasons.length} de {allAvailableReasons.length} ativos
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllReasons}
                        className="text-brand-primary hover:underline font-semibold cursor-pointer"
                      >
                        Marcar Todos
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={handleDeselectAllReasons}
                        className="text-slate-500 hover:underline cursor-pointer"
                      >
                        Desmarcar Todos
                      </button>
                    </div>
                  </div>

                  {/* Lista com Rolagem de Motivos */}
                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1 divide-y divide-slate-50">
                    {filteredAvailableReasons.length === 0 ? (
                      <div className="text-xs text-slate-400 py-4 text-center">
                        Nenhum motivo encontrado.
                      </div>
                    ) : (
                      filteredAvailableReasons.map((reason) => {
                        const isExcluded = excludedReasons.includes(reason);
                        const count = rawReasonCounts[reason] || 0;
                        return (
                          <label
                            key={reason}
                            className="flex items-center justify-between gap-2.5 py-1.5 px-2 rounded-xl hover:bg-slate-50 cursor-pointer transition text-xs select-none"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={!isExcluded}
                                onChange={() => handleToggleReason(reason)}
                                className="rounded text-brand-primary focus:ring-brand-primary/20 w-3.5 h-3.5"
                              />
                              <span
                                className={`truncate font-medium ${
                                  isExcluded ? 'text-slate-400 line-through' : 'text-slate-800'
                                }`}
                              >
                                {reason}
                              </span>
                            </div>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ml-2 ${
                                isExcluded
                                  ? 'bg-slate-200 text-slate-500'
                                  : 'bg-rose-50 text-rose-700 font-bold'
                              }`}
                            >
                              {count} {count === 1 ? 'contrato' : 'contratos'}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      {allAvailableReasons.length - excludedReasons.length} de {allAvailableReasons.length} motivos ativos
                    </span>
                    <button
                      type="button"
                      onClick={() => setReasonFilterOpen(false)}
                      className="px-2.5 py-1 rounded-lg bg-brand-primary text-white font-semibold hover:bg-[#002f9f] transition cursor-pointer"
                    >
                      Concluído
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Divisor vertical sutil */}
            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            {/* Ações de Ocultação / Auditoria de Equipe */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Ocultar Não Atribuído */}
              <button
                type="button"
                onClick={handleToggleHideUnassigned}
                disabled={refreshing}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border shadow-2xs cursor-pointer select-none ${
                  hideUnassignedSellers
                    ? 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-300/40 hover:bg-rose-100 font-bold'
                    : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                }`}
                title="Ocultar vendas com atendente marcado como 'Não atribuído' ou sem vendedor em todas as métricas e relatórios"
              >
                <EyeOff className={`w-3.5 h-3.5 ${hideUnassignedSellers ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>Ocultar Não Atribuído</span>
                {hideUnassignedSellers && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
                )}
              </button>

              {/* Ocultar Ex-colaboradores */}
              <button
                type="button"
                onClick={handleToggleHideInactive}
                disabled={refreshing}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border shadow-2xs cursor-pointer select-none ${
                  hideInactiveSellers
                    ? 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-300/40 hover:bg-amber-100 font-bold'
                    : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                }`}
                title="Ocultar dados de atendentes identificados como inativos/ex-colaboradores no RBX em todas as métricas e relatórios"
              >
                <UserX className={`w-3.5 h-3.5 ${hideInactiveSellers ? 'text-amber-600' : 'text-slate-400'}`} />
                <span>Ocultar Ex-colaboradores</span>
                {hideInactiveSellers && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
                )}
              </button>

              {/* Ocultar Terceiros */}
              <button
                type="button"
                onClick={handleToggleHideThirdParty}
                disabled={refreshing}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border shadow-2xs cursor-pointer select-none ${
                  hideThirdPartySellers
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300 ring-1 ring-indigo-300/40 hover:bg-indigo-100 font-bold'
                    : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                }`}
                title="Ocultar dados de terceiros e parceiros externos em todas as métricas e relatórios"
              >
                <Users className={`w-3.5 h-3.5 ${hideThirdPartySellers ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>Ocultar Terceiros</span>
                {hideThirdPartySellers && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
                )}
              </button>
            </div>
          </div>

          {/* Botão de Limpar Filtros quando houver algum ativo */}
          {(selectedGlobalSeller !== 'all' || selectedGlobalRegion !== 'all' || selectedGlobalGroup !== 'all' || excludedPlans.length > 0 || excludedReasons.length > 0 || hideInactiveSellers || hideThirdPartySellers || hideUnassignedSellers) && (
            <button
              type="button"
              onClick={() => {
                setSelectedGlobalSeller('all');
                setSelectedGlobalRegion('all');
                setSelectedGlobalGroup('all');
                setExcludedPlans([]);
                setExcludedReasons([]);
                setHideInactiveSellers(false);
                setHideThirdPartySellers(false);
                setHideUnassignedSellers(false);
                loadAll(period, customStartDate, customEndDate, 'all', 'all', 'all', [], false, false, false, []);
              }}
              className="text-xs text-brand-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>
      )}

      {/* Navegação por Sub-abas */}
      <div className="border-b border-slate-200 flex items-center justify-between gap-4 overflow-x-auto">
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('visao_geral')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'visao_geral'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Visão Geral & Insights
          </button>

          <button
            onClick={() => setActiveTab('leads')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'leads'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Columns3 className="w-4 h-4" />
            Funil & Carteira de Leads ({leads.length})
          </button>

          <button
            onClick={() => setActiveTab('vendas')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'vendas'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Award className="w-4 h-4" />
            Vendas Fechadas ({dashboard?.kpis?.closedSalesCount ?? 0})
          </button>

          <button
            onClick={() => setActiveTab('cancelamentos')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'cancelamentos'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Cancelamentos ({dashboard?.kpis?.cancellationsCount ?? 0})
          </button>
        </div>

        {/* Toggle de visualização (apenas na aba de leads) */}
        {activeTab === 'leads' && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl mb-2 shrink-0">
            <button
              onClick={() => setLeadsViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                leadsViewMode === 'kanban'
                  ? 'bg-white shadow-xs text-brand-primary font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
              Kanban
            </button>
            <button
              onClick={() => setLeadsViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                leadsViewMode === 'table'
                  ? 'bg-white shadow-xs text-brand-primary font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Lista
            </button>
          </div>
        )}
      </div>

      {/* Conteúdo Principal */}
      {!hasSelectedPeriod && !dashboard ? (
        <div className="bg-gradient-to-b from-white to-blue-50/40 border border-blue-100/90 rounded-3xl p-8 sm:p-12 shadow-sm text-center max-w-3xl mx-auto my-6 space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center mx-auto shadow-inner border border-blue-200/60">
            <Calendar className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100/80 text-brand-primary text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Otimização de Desempenho RBXSoft</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Selecione o Período para Iniciar a Consulta Comercial
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Para evitar requisições pesadas e garantir máxima velocidade na sincronização com os servidores do RBXSoft, escolha o período desejado abaixo antes de iniciar a busca de dados.
            </p>
          </div>

          {/* Atalhos Rápidos de Período */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            {[
              { id: 'today', label: 'Hoje', desc: 'Dados de hoje' },
              { id: '7d', label: '7 Dias', desc: 'Última semana' },
              { id: '30d', label: '30 Dias', desc: 'Padrão mensal' },
              { id: 'month', label: 'Mês Atual', desc: 'Mês corrente' },
              { id: 'year', label: 'Ano Corrente', desc: 'Visão anual' },
            ].map((pItem) => (
              <button
                key={pItem.id}
                type="button"
                onClick={() => {
                  setPeriod(pItem.id as CommercialPeriodType);
                  loadAll(pItem.id as CommercialPeriodType, customStartDate, customEndDate);
                }}
                className="px-4 py-3 rounded-2xl bg-white border border-slate-200 hover:border-brand-primary hover:bg-blue-50/50 text-slate-700 hover:text-brand-primary transition-all text-xs font-semibold shadow-2xs hover:shadow-sm cursor-pointer flex flex-col items-center gap-1 min-w-[110px] group"
              >
                <span className="font-bold group-hover:scale-105 transition-transform">{pItem.label}</span>
                <span className="text-[10px] text-slate-400 font-normal">{pItem.desc}</span>
              </button>
            ))}
          </div>

          <div className="pt-2 flex items-center justify-center">
            <button
              type="button"
              onClick={() => loadAll(period, customStartDate, customEndDate)}
              className="px-6 py-3 rounded-2xl bg-brand-primary text-white text-xs font-bold hover:bg-[#002f9f] transition shadow-md shadow-brand-primary/20 flex items-center gap-2 cursor-pointer"
            >
              <TrendingUp className="w-4 h-4" />
              <span>Consultar Dados para "{getPeriodLabel(period)}"</span>
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center h-80 text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
          <p className="text-sm font-medium">Carregando dados comerciais oficiais do RBXSoft...</p>
        </div>
      ) : (
        <div className="relative min-h-[420px]">
          {/* Overlay Elegante em Glassmorphism ao Recarregar Filtros */}
          {refreshing && (
            <div className="absolute inset-0 z-20 flex items-start justify-center pt-28 bg-slate-900/[0.03] backdrop-blur-[2px] rounded-3xl animate-in fade-in duration-200 pointer-events-auto">
              <div className="bg-white/85 backdrop-blur-md border border-white/80 shadow-2xl rounded-2xl px-6 py-4 flex items-center gap-4 animate-in zoom-in-95 duration-200 border-slate-100/60 ring-1 ring-slate-900/5">
                <div className="relative flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                  <span className="absolute w-2 h-2 rounded-full bg-brand-primary/30 animate-ping" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>Atualizando CRM</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sincronizando dados para <span className="font-semibold text-slate-700">{getPeriodLabel(period)}</span>...
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Área de Conteúdo Ativo (com transição e opacidade suave durante o refresh) */}
          <div className={`transition-opacity duration-300 ${refreshing ? 'opacity-65 pointer-events-none' : 'opacity-100'}`}>
            {activeTab === 'visao_geral' && dashboard ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Visão Geral & Inteligência Comercial</h3>
                    <p className="text-xs text-slate-500">Métricas analíticas consolidadas, rankings e séries temporais do RBXSoft</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl cursor-pointer transition select-none">
                      <input
                        type="checkbox"
                        checked={includeClientListInExecutivePdf}
                        onChange={(e) => setIncludeClientListInExecutivePdf(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary/20 accent-[#0038b8] cursor-pointer"
                      />
                      <span>Incluir lista completa de clientes</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        exportExecutiveDashboardToPdf({
                          dashboard,
                          user,
                          periodLabel: getPeriodLabel(period),
                          activeFilters: {
                            seller: selectedGlobalSeller !== 'all' ? selectedGlobalSeller : undefined,
                            city: selectedGlobalRegion !== 'all' ? selectedGlobalRegion : undefined,
                            group: selectedGlobalGroup !== 'all' ? selectedGlobalGroup : undefined,
                            excludedPlansCount: excludedPlans.length,
                            totalPlansCount: allAvailablePlans.length,
                            excludedPlans: excludedPlans.length > 0 ? excludedPlans : undefined,
                            excludedReasonsCount: excludedReasons.length,
                            totalReasonsCount: allAvailableReasons.length,
                            excludedReasons: excludedReasons.length > 0 ? excludedReasons : undefined,
                            hideInactiveSellers,
                            hideThirdPartySellers,
                            hideUnassignedSellers,
                          },
                          includeClientDetails: includeClientListInExecutivePdf,
                          clientRecords: closedSalesRecords,
                        });
                      }}
                      className="px-3.5 py-2 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:bg-[#002f9f] transition shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <FileDown className="w-4 h-4" />
                      <span>Exportar Relatório PDF</span>
                    </button>
                  </div>
                </div>
                <CommercialDashboardView
                  dashboard={dashboard}
                  onOpenDrilldown={(id, name) => setDrilldownMetric({ id, name })}
                />
              </div>
      ) : activeTab === 'leads' ? (
        <div className="space-y-4">
          {/* Barra de Filtros da Carteira */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por lead, cidade, código ou telefone..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>

              <div className="flex items-center gap-2 text-xs">
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none"
                >
                  <option value="all">Todas as Etapas</option>
                  <option value="new">Novo Lead</option>
                  <option value="qualified">Qualificado</option>
                  <option value="proposal">Proposta Enviada</option>
                  <option value="negotiation">Em Negociação</option>
                  <option value="won">Ganho (Venda Fechada)</option>
                  <option value="lost">Perdido</option>
                </select>

                <select
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none"
                >
                  <option value="all">Todos os Responsáveis</option>
                  {ownersList.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>

                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    checked={overdueOnly}
                    onChange={(e) => setOverdueOnly(e.target.checked)}
                    className="rounded text-brand-primary"
                  />
                  <span>Apenas Ações Vencidas</span>
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                exportLeadsToPdf({
                  leads: filteredLeads,
                  user,
                  periodLabel: getPeriodLabel(period),
                });
              }}
              className="px-3.5 py-2 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:bg-[#002f9f] transition shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <FileDown className="w-4 h-4" />
              <span>Exportar Carteira PDF</span>
            </button>
          </div>

          {/* Renderização da Visão Kanban ou Tabela */}
          {leadsViewMode === 'kanban' ? (
            <LeadsKanbanView
              leads={filteredLeads}
              onSelectLead={(id) => setSelectedLeadId(id)}
              onOpenCreateContract={(lead) => setLeadForContract(lead)}
              onAdvanceStage={handleAdvanceStage}
            />
          ) : (
            <LeadsTableView
              leads={filteredLeads}
              onSelectLead={(id) => setSelectedLeadId(id)}
              onOpenCreateContract={(lead) => setLeadForContract(lead)}
            />
          )}
        </div>
      ) : activeTab === 'vendas' && dashboard ? (
        <ClosedSalesView
          dashboard={dashboard}
          salesRecords={closedSalesRecords}
          loadingRecords={closedSalesLoading}
          periodLabel={getPeriodLabel(period)}
          onRefresh={() => loadClosedSalesDetails(period, customStartDate, customEndDate, selectedGlobalSeller, selectedGlobalRegion, selectedGlobalGroup, excludedPlans, hideInactiveSellers, hideThirdPartySellers, hideUnassignedSellers)}
          hideInactive={hideInactiveSellers}
          hideThirdParty={hideThirdPartySellers}
          hideUnassigned={hideUnassignedSellers}
        />
      ) : activeTab === 'cancelamentos' ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* 1. Cabeçalho da Aba com Ações Rápidas de Exportação */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
                  <AlertTriangle className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Análise de Cancelamentos & Churn</h3>
                  <p className="text-xs text-slate-500">
                    Contratos cancelados no período ({getPeriodLabel(period)}) com análise territorial, motivos e concorrência
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 relative">
              <button
                type="button"
                onClick={() => handleExportPdf(false)}
                disabled={filteredCancellations.length === 0}
                className="px-3.5 py-2 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:bg-[#002f9f] transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                title="Exportar relatório executivo em PDF"
              >
                <FileDown className="w-4 h-4" />
                <span>Exportar PDF</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportCsv(false)}
                disabled={exportingCsv || filteredCancellations.length === 0}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 border border-slate-200 shadow-2xs disabled:opacity-50 cursor-pointer"
                title="Exportar dados tabulares em CSV"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>{exportingCsv ? 'Exportando...' : 'Exportar CSV'}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setDrilldownMetric({ id: 'cancelamentos_periodo', name: 'Cancelamentos Contratuais' })
                }
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Info className="w-4 h-4" />
                <span>Auditoria da Métrica</span>
              </button>
            </div>
          </div>

          {/* Banner de Cálculo Personalizado (Quando há motivos excluídos) */}
          {excludedReasons.length > 0 && (
            <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-2xs animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Cálculo Personalizado Ativo</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-800 text-[10px] font-bold">
                      {excludedReasons.length} {excludedReasons.length === 1 ? 'motivo desconsiderado' : 'motivos desconsiderados'}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-0.5">
                    Desconsiderando: <span className="font-semibold text-amber-900">{excludedReasons.join(', ')}</span>.{' '}
                    Exibindo <strong className="text-slate-900">{activeCancellationsCount}</strong> de{' '}
                    <strong className="text-slate-900">{cancellationRecords.length}</strong> cancelamentos (
                    {((activeCancellationsCount / (cancellationRecords.length || 1)) * 100).toFixed(1)}% do total).
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSelectAllReasons}
                className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-amber-100 text-amber-900 font-bold border border-amber-300 transition text-xs shrink-0 cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Voltar a considerar todos os motivos nos cálculos"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
                <span>Restaurar Todos os Motivos</span>
              </button>
            </div>
          )}

          {/* 2. Quadro de Indicadores Chave de Cancelamento (Recalculados) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Total Cancelados</span>
                <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                  <AlertTriangle className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-rose-600">
                  {activeCancellationsCount}
                </span>
                <span className="text-xs text-slate-400">contratos</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {excludedReasons.length > 0
                  ? `Evasão calculada (${cancellationRecords.length - activeCancellationsCount} desconsiderados)`
                  : 'Evasão total no período'}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Evasão Mensal (MRR)</span>
                <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  R$ {activeCancellationMonthlyLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {excludedReasons.length > 0 ? 'Receita recorrente evadida (filtrada)' : 'Receita recorrente evadida'}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Principal Motivo</span>
                <span className="p-1.5 rounded-lg bg-blue-50 text-brand-primary">
                  <BarChart2 className="w-4 h-4" />
                </span>
              </div>
              <div className="truncate font-bold text-slate-900 text-sm" title={topActiveReason?.reason || 'N/A'}>
                {topActiveReason?.reason || 'N/A'}
              </div>
              <p className="text-[11px] text-slate-400">
                {topActiveReason
                  ? `${topActiveReason.count} contratos (${(
                      (topActiveReason.count / (activeCancellationsCount || 1)) *
                      100
                    ).toFixed(1)}%)`
                  : 'Nenhum motivo ativo'}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Maior Volume Regional / Grupo</span>
                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <MapPin className="w-4 h-4" />
                </span>
              </div>
              <div className="truncate font-bold text-slate-900 text-sm">
                {topActiveRegion ? topActiveRegion.city : 'N/A'}
              </div>
              <p className="text-[11px] text-slate-400">
                {topActiveRegion
                  ? `${topActiveRegion.count} contratos (${topActiveRegion.percentage.toFixed(1)}%)`
                  : 'Sem dados territoriais'}
              </p>
            </div>
          </div>

          {/* 3. Gráfico de Barras Diário de Cancelamentos */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2 tracking-tight">
                  <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                    <TrendingDown className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <span>Evolução Diária de Cancelamentos ({dashboard?.period?.label || 'Período'})</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Distribuição diária de contratos cancelados para identificação de picos anômalos de churn
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCancellationsViewMode(cancellationsViewMode === 'chart' ? 'table' : 'chart')}
                  className="w-8 h-8 rounded-xl bg-slate-100/90 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors border border-slate-200/80 shadow-2xs cursor-pointer"
                  title={cancellationsViewMode === 'chart' ? 'Visualizar em tabela' : 'Visualizar em gráfico'}
                  aria-label="Alternar gráfico e tabela"
                >
                  {cancellationsViewMode === 'chart' ? (
                    <TableIcon className="w-4 h-4" />
                  ) : (
                    <BarChart2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Conteúdo do Gráfico ou Tabela Diária */}
            {cancellationsViewMode === 'chart' ? (
              <div className="relative pt-2">
                {hoveredCancellationDay && (
                  <div className="absolute top-0 right-2 z-20 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl p-3.5 shadow-xl text-xs space-y-1.5 animate-in fade-in zoom-in-95 duration-150 min-w-[200px]">
                    <div className="font-bold text-slate-900 pb-1.5 border-b border-slate-100 flex items-center justify-between gap-4">
                      <span>Data: {formatDateBR(hoveredCancellationDay.date)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-rose-600 font-semibold">
                      <span>Cancelamentos:</span>
                      <span className="font-mono font-bold">{hoveredCancellationDay.cancellations}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-slate-500 text-[11px] pt-1 border-t border-slate-100">
                      <span>Participação no período:</span>
                      <span className="font-mono font-semibold text-slate-700">
                        {activeCancellationsCount
                          ? ((hoveredCancellationDay.cancellations / activeCancellationsCount) * 100).toFixed(1)
                          : '0'}%
                      </span>
                    </div>
                  </div>
                )}

                {activeCancellationTimeSeries.length === 0 ? (
                  <div className="h-44 flex items-center justify-center text-xs text-slate-400">
                    Nenhum cancelamento registrado no período.
                  </div>
                ) : (
                  <div className="h-48 flex items-end gap-1.5 sm:gap-2 px-2 pb-2 pt-8 overflow-x-auto">
                    {activeCancellationTimeSeries.map((point) => {
                      const count = point.cancellations;
                      const heightPercent = maxActiveCancellationDaily > 0 ? (count / maxActiveCancellationDaily) * 100 : 0;
                      const isHovered = hoveredCancellationDay?.date === point.date;

                      return (
                        <div
                          key={point.date}
                          onMouseEnter={() => setHoveredCancellationDay(point)}
                          onMouseLeave={() => setHoveredCancellationDay(null)}
                          className="flex-1 min-w-[22px] max-w-[48px] h-full flex flex-col justify-end items-center group cursor-pointer relative"
                        >
                          {count > 0 && (
                            <span className="text-[10px] font-bold text-rose-600 font-mono mb-1 transition group-hover:scale-110">
                              {count}
                            </span>
                          )}

                          <div className="w-full bg-slate-100/80 rounded-t-lg h-full flex items-end overflow-hidden">
                            <div
                              style={{ height: `${count > 0 ? Math.max(heightPercent, 10) : 0}%` }}
                              className={`w-full rounded-t-md transition-all duration-300 ${
                                count > 0
                                  ? isHovered
                                    ? 'bg-rose-600 shadow-md shadow-rose-200'
                                    : 'bg-rose-500 hover:bg-rose-600'
                                  : 'bg-transparent'
                              }`}
                            />
                          </div>

                          <span className="text-[9px] text-slate-400 font-mono mt-1.5 truncate">
                            {point.date.slice(8, 10)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200/80">
                    <tr>
                      <th className="p-3">Data</th>
                      <th className="p-3 text-right">Cancelamentos</th>
                      <th className="p-3 text-right">Participação no Período</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeCancellationTimeSeries.map((pt) => (
                      <tr key={pt.date} className="hover:bg-slate-50/70">
                        <td className="p-3 font-mono font-medium text-slate-700">{formatDateBR(pt.date)}</td>
                        <td className="p-3 text-right font-mono font-bold text-rose-600">
                          {pt.cancellations}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-500">
                          {activeCancellationsCount
                            ? ((pt.cancellations / activeCancellationsCount) * 100).toFixed(1)
                            : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 4. Duas Colunas: Ranking por Cidade & Análise por Motivo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Coluna 1: Ranking por Cidade */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-brand-primary" />
                    <span>Ranking de Cancelamentos por Região / Grupo</span>
                  </h4>
                  <p className="text-xs text-slate-500">Distribuição territorial por grupo cadastrado no RBX e impacto em MRR</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {activeCancellationsByCity.length} regiões/grupos
                </span>
              </div>

              <div className="space-y-3">
                {activeCancellationsByCity.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    Nenhum cancelamento registrado por região/grupo.
                  </p>
                ) : (
                  activeCancellationsByCity.map((cityItem, idx) => {
                    const isTop1 = idx === 0;
                    const isTop2 = idx === 1;
                    const isTop3 = idx === 2;

                    return (
                      <div
                        key={cityItem.city}
                        className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                                isTop1
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : isTop2
                                  ? 'bg-slate-200 text-slate-700'
                                  : isTop3
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-white text-slate-500 border border-slate-200'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <span className="font-bold text-slate-800">{cityItem.city}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-slate-500 border border-slate-200 font-mono">
                              {cityItem.state}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 font-mono">
                            <span className="font-bold text-rose-600">{cityItem.count} cancelamentos</span>
                            <span className="text-slate-400">({cityItem.percentage.toFixed(1)}%)</span>
                          </div>
                        </div>

                        {/* Barra de Progresso Proporcional */}
                        <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-rose-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(cityItem.percentage, 3)}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                          <span>Evasão mensal estimada:</span>
                          <span className="font-mono font-semibold text-slate-700">
                            R$ {cityItem.monthlyLoss.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Coluna 2: Análise por Motivo & Concorrência */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-rose-600" />
                    <span>Motivos de Cancelamento (API RBXSoft)</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Clique na caixa de seleção para incluir/desconsiderar do relatório
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {excludedReasons.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllReasons}
                      className="text-[11px] text-amber-700 hover:underline font-bold cursor-pointer"
                    >
                      Restaurar Todos
                    </button>
                  )}
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">
                    {allAvailableReasons.length - excludedReasons.length} de {allAvailableReasons.length} ativos
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {allAvailableReasons.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    Nenhum motivo de cancelamento catalogado.
                  </p>
                ) : (
                  allAvailableReasons.map((reasonName) => {
                    const isExcluded = excludedReasons.includes(reasonName);
                    const rawCount = rawReasonCounts[reasonName] || 0;
                    const activeItem = activeCancellationsByReason.find((r) => r.reason === reasonName);
                    const activeCount = activeItem ? activeItem.count : 0;
                    const percent =
                      activeCancellationsCount > 0 && !isExcluded
                        ? ((activeCount / activeCancellationsCount) * 100).toFixed(1)
                        : '0';
                    const isTableFiltered = cancellationReasonFilter === reasonName;

                    return (
                      <div
                        key={reasonName}
                        onClick={() => {
                          if (!isExcluded) {
                            setCancellationReasonFilter(isTableFiltered ? 'all' : reasonName);
                          }
                        }}
                        className={`p-3 rounded-xl border transition flex items-center justify-between text-xs ${
                          isExcluded
                            ? 'bg-slate-50/70 border-dashed border-slate-300 opacity-70 hover:opacity-100'
                            : isTableFiltered
                            ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-300 cursor-pointer'
                            : 'bg-white border-slate-200/80 hover:bg-slate-50 cursor-pointer'
                        }`}
                        title={
                          isExcluded
                            ? 'Motivo desconsiderado do relatório. Clique no checkbox para reativar.'
                            : 'Clique para filtrar a tabela abaixo por este motivo'
                        }
                      >
                        <div className="flex items-center gap-2.5 truncate mr-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleReason(reasonName);
                            }}
                            className="text-brand-primary hover:scale-110 transition p-0.5 cursor-pointer shrink-0"
                            title={
                              isExcluded
                                ? 'Clique para incluir este motivo nos números do relatório'
                                : 'Clique para desconsiderar este motivo do relatório'
                            }
                          >
                            {!isExcluded ? (
                              <CheckSquare className="w-4 h-4 text-brand-primary" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                            )}
                          </button>
                          <span
                            className={`font-semibold truncate ${
                              isExcluded ? 'line-through text-slate-400' : 'text-slate-800'
                            }`}
                          >
                            {reasonName}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 font-mono shrink-0">
                          {isExcluded ? (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-600 font-sans font-medium">
                              Desconsiderado ({rawCount})
                            </span>
                          ) : (
                            <>
                              <span className="text-slate-500">{percent}%</span>
                              <span className="font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                                {activeCount} {activeCount === 1 ? 'contrato' : 'contratos'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* 5. Tabela Detalhada de Clientes Cancelados com Barra de Ações */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <List className="w-4 h-4 text-brand-primary" />
                  <span>Listagem Individual de Clientes Cancelados</span>
                </h4>
                <p className="text-xs text-slate-500">
                  {filteredCancellations.length} contratos localizados • Selecione para exportar em lote
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl cursor-pointer transition select-none">
                  <input
                    type="checkbox"
                    checked={includeClientListInPdf}
                    onChange={(e) => setIncludeClientListInPdf(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary/20 accent-[#0038b8] cursor-pointer"
                  />
                  <span>Incluir lista completa de clientes</span>
                </label>

                <button
                  type="button"
                  onClick={() => handleExportPdf(selectedCancellationIds.length > 0)}
                  disabled={filteredCancellations.length === 0}
                  className="px-3.5 py-1.5 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:bg-[#002f9f] transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Exportar PDF {selectedCancellationIds.length > 0 ? `(${selectedCancellationIds.length})` : ''}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportCsv(selectedCancellationIds.length > 0)}
                  disabled={exportingCsv || filteredCancellations.length === 0}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 border border-slate-200 shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Exportar CSV</span>
                </button>
              </div>
            </div>

            {/* Barra de Filtros da Listagem */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={cancellationSearch}
                  onChange={(e) => setCancellationSearch(e.target.value)}
                  placeholder="Buscar por cliente, contrato, região, grupo, plano, responsável ou motivo..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary/20 bg-slate-50/50"
                />
              </div>

              <select
                value={cancellationRegionFilter}
                onChange={(e) => setCancellationRegionFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-none"
              >
                <option value="all">Todas as Regiões / Grupos</option>
                {uniqueCancellationRegions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={cancellationReasonFilter}
                onChange={(e) => setCancellationReasonFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-none"
              >
                <option value="all">Todos os Motivos</option>
                {uniqueCancellationReasons.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              {(cancellationSearch || cancellationRegionFilter !== 'all' || cancellationReasonFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setCancellationSearch('');
                    setCancellationRegionFilter('all');
                    setCancellationReasonFilter('all');
                  }}
                  className="text-xs text-rose-600 hover:underline font-semibold"
                >
                  Limpar Filtros
                </button>
              )}
            </div>

            {/* Barra Dinâmica de Seleção em Lote (idêntica ao modelo de atendimentos) */}
            {selectedCancellationIds.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-800 animate-in fade-in slide-in-from-top-2 duration-150 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white">
                      {selectedCancellationIds.length}{' '}
                      {selectedCancellationIds.length === 1 ? 'cliente selecionado' : 'clientes selecionados'}
                    </span>{' '}
                    <span className="text-slate-400 font-normal">de {filteredCancellations.length} exibidos</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportPdf(true)}
                    className="px-3 py-1.5 rounded-xl bg-brand-primary hover:bg-[#002f9f] text-white font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>Exportar Selecionados (PDF)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportCsv(true)}
                    disabled={exportingCsv}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition flex items-center gap-1.5 border border-slate-700 shadow-2xs disabled:opacity-50 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span>Exportar Selecionados (CSV)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCancellationIds([])}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer ml-1"
                    title="Desmarcar todos"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Tabela de Contratos Cancelados */}
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredCancellations.length > 0 &&
                          selectedCancellationIds.length === filteredCancellations.length
                        }
                        onChange={handleSelectAllCancellations}
                        className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary cursor-pointer"
                        title="Selecionar todos os contratos exibidos"
                      />
                    </th>
                    <th className="p-3">Contrato</th>
                    <th className="p-3">Assinante / Código</th>
                    <th className="p-3">Região / Grupo</th>
                    <th className="p-3">Plano Cancelado</th>
                    <th className="p-3 text-right">Mensalidade</th>
                    <th className="p-3 text-center">Data Canc.</th>
                    <th className="p-3">Motivo do Cancelamento</th>
                    <th className="p-3">Concorrência</th>
                    <th className="p-3">Responsável</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cancellationsLoading ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
                          <span>Carregando contratos cancelados...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredCancellations.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        Nenhum contrato cancelado encontrado com os filtros informados.
                      </td>
                    </tr>
                  ) : (
                    filteredCancellations.map((c) => {
                      const isSelected = selectedCancellationIds.includes(c.id);
                      return (
                        <tr
                          key={c.id}
                          className={`transition-colors ${
                            isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectCancellation(c.id)}
                              className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary cursor-pointer"
                            />
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => setSelectedContractForModal(String(c.id))}
                              className="font-mono font-bold text-brand-primary hover:text-blue-700 hover:underline inline-flex items-center gap-1 group cursor-pointer transition text-xs"
                              title="Clique para ver a ficha completa do contrato no RBXSoft"
                            >
                              <span>#{c.id}</span>
                              <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-brand-primary opacity-60 group-hover:opacity-100 transition-opacity" />
                            </button>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-slate-800">{c.name}</div>
                            {c.clientId && (
                              <div className="text-[10px] text-slate-400 font-mono">#{c.clientId}</div>
                            )}
                          </td>
                          <td className="p-3 font-medium text-slate-700">
                            {c.group || c.city || 'Geral'}
                          </td>
                          <td className="p-3 text-slate-700 font-medium">{c.plan || 'Plano Fibra'}</td>
                          <td className="p-3 text-right font-mono font-semibold text-slate-900">
                            R$ {(Number(c.monthlyValue) || 0).toFixed(2)}
                          </td>
                          <td className="p-3 text-center font-mono text-slate-600">
                            {c.date ? formatDateBR(c.date) : '—'}
                          </td>
                          <td className="p-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/60">
                              {c.reason || 'Não informado no RBX'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500">
                            {c.competitor && c.competitor !== 'N/A' && c.competitor !== '—' ? (
                              <span className="font-semibold text-slate-700">{c.competitor}</span>
                            ) : (
                              <span className="text-slate-400 italic">Não apurada</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-600 font-medium">
                            {c.seller || 'Não atribuído'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  </div>
)}

      {/* Modais e Drawers Integrados */}
      {selectedLeadId && (
        <LeadDetailDrawer
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
          onOpenCreateContract={(lead) => {
            setSelectedLeadId(null);
            setLeadForContract(lead);
          }}
          onLeadUpdated={loadAll}
        />
      )}

      {leadForContract && (
        <CreateContractModal
          lead={leadForContract}
          onClose={() => setLeadForContract(null)}
          onSuccess={() => {
            loadAll();
          }}
        />
      )}

      {createLeadOpen && (
        <CreateLeadModal
          onClose={() => setCreateLeadOpen(false)}
          onSuccess={(newLead) => {
            setCreateLeadOpen(false);
            loadAll();
            setSelectedLeadId(newLead.id);
          }}
        />
      )}

      {drilldownMetric && (
        <AnalyticsDrilldownDrawer
          metricId={drilldownMetric.id}
          metricName={drilldownMetric.name}
          period={period}
          startDate={period === 'custom' ? customStartDate : undefined}
          endDate={period === 'custom' ? customEndDate : undefined}
          seller={selectedGlobalSeller !== 'all' ? selectedGlobalSeller : undefined}
          region={selectedGlobalRegion !== 'all' ? selectedGlobalRegion : undefined}
          group={selectedGlobalGroup !== 'all' ? selectedGlobalGroup : undefined}
          excludePlans={excludedPlans.length > 0 ? excludedPlans : undefined}
          excludeReasons={excludedReasons.length > 0 ? excludedReasons : undefined}
          hideInactiveSellers={hideInactiveSellers}
          hideThirdPartySellers={hideThirdPartySellers}
          hideUnassignedSellers={hideUnassignedSellers}
          onClose={() => setDrilldownMetric(null)}
        />
      )}

      {selectedContractForModal && (
        <ContractDetailModal
          contractNumber={selectedContractForModal}
          onClose={() => setSelectedContractForModal(null)}
        />
      )}
    </div>
  );
};
