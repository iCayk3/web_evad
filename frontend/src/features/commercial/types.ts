export type LeadStage = 'new' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

export interface LeadContactDto {
  id: number;
  leadId: number;
  name: string;
  phone: string;
  email: string;
  role: string;
  type: 'Principal' | 'Financeiro' | 'Técnico' | 'Comercial';
  isActive: boolean;
}

export interface LeadDto {
  id: number;
  code: string;
  name: string;
  personType: 'F' | 'J';
  cpfCnpj: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  neighborhood: string;
  address: string;
  addressNumber: string;
  complement?: string;
  zipCode: string;
  createdAt: string;
  createdByUser: string;
  status: string;
  group: string;
  
  // Metadados CRM
  stage: LeadStage;
  source: string;
  owner: string;
  nextActionAt: string | null;
  isNextActionOverdue: boolean;
  lossReason?: string;
  stageUpdatedAt: string;
  estimatedValue?: number;
  convertedContractId?: string;
  contactsCount: number;
  openActivitiesCount: number;
}

export interface CommercialOccurrenceDto {
  id: number;
  createdAt: string;
  author: string;
  text: string;
}

export interface CommercialActivityDto {
  id: number;
  protocol: string;
  clientType: 'M' | 'C';
  targetId: number;
  targetName: string;
  topicId: number;
  topicName: string;
  responsible: string;
  status: 'Aberto' | 'Em Andamento' | 'Pendente' | 'Concluído' | 'Cancelado';
  createdAt: string;
  slaForecastAt?: string;
  closedAt: string | null;
  description: string;
  occurrences: CommercialOccurrenceDto[];
}

export interface CommercialTopicDto {
  id: number;
  name: string;
  type: string;
  isActive: boolean;
}

export type SellerType = 'active' | 'inactive' | 'third_party' | 'unassigned';

export interface SalesRankingItem {
  name: string;
  count: number;
  value: number;
  ticketAverage: number;
  sharePercent: number;
  sellerType?: SellerType;
}

export interface SalesKpiSummary {
  newLeadsCount: number;
  newLeadsDiffPercent: number;
  leadsByStage: Record<LeadStage, number>;
  leadsWithoutNextContactCount: number;
  openActivitiesCount: number;
  closedSalesCount: number;
  closedSalesDiffPercent: number;
  confirmedContractsCount: number;
  confirmedContractsDiffPercent: number;
  totalMonthlyValue: number;
  averageTicketMonthly: number;
  averageAdhesionValue: number;
  cancellationsCount: number;
  netAdditions?: number;
  churnRatioPercent?: number;
  traceableConversionsCount: number;
  conversionRatePercent: number;
  coveragePercent: number;
}

export interface SalesTimeSeriesPoint {
  date: string;
  leads: number;
  sales: number;
  contracts: number;
  cancellations: number;
}

export interface MonthlyGroupShare {
  group: string;
  count: number;
  value: number;
  sharePercent: number;
}

export interface MonthlyRegionShare {
  region: string;
  count: number;
  value: number;
}

export interface MonthlyRankingItem {
  name: string;
  count: number;
  value: number;
  sharePercent: number;
}

export interface SalesMonthlyPoint {
  month: string; // Ex: "2026-01"
  label: string; // Ex: "Jan", "Fev"
  fullLabel: string; // Ex: "Janeiro / 2026"
  monthIndex: number; // 0 a 11
  year: number;
  leads: number;
  sales: number;
  contracts: number;
  cancellations: number;
  netAdditions: number; // contracts - cancellations
  revenue?: number;
  avgTicket?: number;
  cancellationsValue?: number;
  churnRatioPercent?: number;
  salesByGroup?: MonthlyGroupShare[];
  salesByRegion?: MonthlyRegionShare[];
  topSellers?: MonthlyRankingItem[];
  topPlans?: MonthlyRankingItem[];
  momComparison?: {
    salesDiffPercent: number | null;
    revenueDiffPercent: number | null;
    cancellationsDiffPercent: number | null;
    netDiff: number | null;
  };
}

export type CommercialPeriodType = 'today' | '7d' | '30d' | 'month' | 'year' | 'custom';

export interface CommercialDashboardDto {
  period: {
    start: string;
    end: string;
    label: string;
    type?: CommercialPeriodType;
  };
  lastUpdatedAt: string;
  kpis: SalesKpiSummary;
  timeSeries: SalesTimeSeriesPoint[];
  monthlySeries?: SalesMonthlyPoint[];
  funnel: Array<{ stage: LeadStage; label: string; count: number }>;
  topPlans: SalesRankingItem[];
  topSellers: SalesRankingItem[];
  sellersClassification?: Record<string, SellerType>;
  salesByGroup?: Array<{
    group: string;
    count: number;
    value: number;
    ticketAverage: number;
    sharePercent: number;
  }>;
  salesByRegion: Array<{ region: string; count: number; value: number }>;
  salesByCity?: Array<{ city: string; count: number; value: number }>;
  salesByTechnology: Array<{ technology: string; count: number; value: number }>;
  cancellationsByReason: Array<{ reason: string; count: number }>;
  cancellationsByCity?: Array<{
    city: string;
    region?: string;
    state: string;
    count: number;
    percentage: number;
    monthlyLoss: number;
  }>;
  allAvailablePlans?: Array<{ name: string; count: number; value: number }>;
  allAvailableReasons?: Array<{ reason: string; count: number }>;
  allAvailableGroups?: string[];
  allAvailableSellers?: Array<{ name: string; count: number; value: number; sellerType: SellerType }>;
}

export interface SalesDrilldownDto {
  metricId: string;
  formula: string;
  coverage: string;
  total: number;
  records: Array<{
    id: string;
    name: string;
    detail: string;
    seller: string;
    sellerType?: SellerType;
    date: string;
    clientId?: number;
    originProspectId?: number;
    reason?: string;
    competitor?: string;
    city?: string;
    group?: string;
    region?: string;
    state?: string;
    plan?: string;
    planDescription?: string;
    monthlyValue?: number;
    adhesionValue?: number;
    salesChannel?: string;
  }>;
}
