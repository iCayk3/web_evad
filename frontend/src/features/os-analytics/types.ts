export type OsPeriodType = 'today' | '7d' | 'month' | 'custom';

export interface OsFinalizedFlow {
  index: number;
  topicRaw: string;
  topicPrefix: string;
  topicName: string;
  causeRaw: string;
  causePrefix: string;
  causeName: string;
  durationRaw?: string;
  openedAt: string;
  closedAt: string;
  durationMinutes: number;
  durationFormatted: string;
  user: string;
  sector: string;
  actionNote?: string;
  flowType: string;
  locality?: string;
}

export interface OsKpiCards {
  totalOs: { value: number; changePercent: number | null };
  concludedOs: { value: number; rate: number; changePercent: number | null };
  cancelledOs: { value: number; rate: number; changePercent: number | null };
  pendingOs: { value: number; percentage: number };
  openOs: { value: number; percentage: number };
  avgResolutionTimeHours: { value: number; formatted: string };
  slaComplianceRate: { value: number; formatted: string };
  totalMovements: { value: number; avgPerOs: number };
  remoteResolutions?: { value: number; rate: number };
  fieldWork?: { value: number; rate: number };
  totalFlows?: { value: number; avgPerOs: number };
}

export interface OsDailyEvolutionPoint {
  date: string;
  label: string;
  abertas: number;
  concluidas: number;
  canceladas: number;
}

export interface OsStatusDistributionItem {
  status: string;
  count: number;
  percentage: number;
  color: string;
}

export interface OsTechnicianWorkload {
  id: number;
  name: string;
  total: number;
  concluded: number;
  pending: number;
  cancelled: number;
  inProgress: number;
  conclusionRate: number;
  avgTimeHours: number;
  slaRate: number;
}

export interface OsTopicCauseItem {
  name: string;
  count: number;
  percentage: number;
}

export interface OsAbortedTicketDetail {
  id: number;
  protocol: string;
  clientId: number;
  clientName: string;
  technicianName: string;
  topicName: string;
  causeName: string;
  createdAt: string;
  cancelledAt: string;
  durationHours: number;
  classifiedMotive: string;
  justificationText: string;
  justificationAuthor: string;
  solution?: string;
  occurrencesCount: number;
  occurrences: OsTicketOccurrence[];
  finalizedFlows?: OsFinalizedFlow[];
  lastFlow?: OsFinalizedFlow;
  flowCategory?: string;
  locality?: string;
}

export interface OsAbortedMotiveSummary {
  motive: string;
  count: number;
  percentage: number;
}

export interface OsAbortedAnalysis {
  totalAborted: number;
  abortedRate: number;
  avgTimeUntilAbortHours: number;
  motivesSummary: OsAbortedMotiveSummary[];
  technicianAbortedRanking: Array<{ name: string; count: number; percentage: number }>;
  records: OsAbortedTicketDetail[];
}

export interface OsAnalyticsOverviewDto {
  period: {
    type: OsPeriodType;
    startDate: string;
    endDate: string;
  };
  previousPeriod: {
    startDate: string;
    endDate: string;
  };
  updatedAt: string;
  cards: OsKpiCards;
  evolution: OsDailyEvolutionPoint[];
  statusDistribution: OsStatusDistributionItem[];
  techniciansRanking: OsTechnicianWorkload[];
  topTopics: OsTopicCauseItem[];
  topCauses: OsTopicCauseItem[];
  availableTechnicians: Array<{ id: number; name: string; count: number }>;
  abortedAnalysis: OsAbortedAnalysis;
  flowTypesDistribution?: OsStatusDistributionItem[];
  localitiesRanking?: OsTopicCauseItem[];
  availableLocalities?: string[];
  availableFlowTypes?: string[];
}

export interface OsTicketOccurrence {
  id: number;
  data: string;
  autor: string;
  texto: string;
  modo?: string;
}

export interface OsTicketChecklistItem {
  item: string;
  concluido: boolean;
}

export interface OsTicketDto {
  id: number;
  protocol: string;
  clientId: number;
  clientName: string;
  technicianId: number;
  technicianName: string;
  topicId: number;
  topicName: string;
  causeId: number;
  causeName: string;
  flowId: number;
  flowName: string;
  status: 'Aberto' | 'Em Andamento' | 'Pendente' | 'Concluído' | 'Cancelado';
  type: 'Técnico' | 'Comercial' | 'Adm/Fin';
  createdAt: string;
  slaDueAt: string;
  concludedAt: string | null;
  slaStatus: 'OK' | 'RISK' | 'OVERDUE' | 'NOT_APPLICABLE';
  isOverdue: boolean;
  concludedWithinSla: boolean | null;
  description: string;
  solution?: string;
  checklist?: OsTicketChecklistItem[];
  ocorrencias?: OsTicketOccurrence[];
  finalizedFlows?: OsFinalizedFlow[];
  lastFlow?: OsFinalizedFlow;
  flowCount?: number;
  hasRemoteSolution?: boolean;
  hasFieldWork?: boolean;
  primaryLocality?: string;
  flowCategory?: string;
}
