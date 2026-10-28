export interface RbxStatusDefinition {
  code: string;
  name: string;
  description: string;
  category: string;
  color: string;
}

export interface ClientRecord {
  id: string;
  rbxCode: string;
  contract: string;
  name: string;
  city: string;
  plan: string;
  monthlyFee: number;
  billingCycle: string;
  competenceMonth: string;
  blockDate: string;
  unblockDate: string | null;
  daysToResolve: number | null;
  status: 'returned' | 'blocked' | 'churned' | 'suspended' | 'other';
  operation: string;
  userRbx: string;
  cancellationDate: string | null;
  rbxStatusCode?: string;
  rbxStatusText?: string;
  cancellationReason?: string;
  daysOverdue?: number | null;
  lastRbxSyncAt?: string | null;
  lastOperationRbx?: string | null;
  isInheritedDebt?: boolean;
  originalDebtDueDate?: string;
  debtLabel?: string;
  isMimo?: boolean;
  primaryContract?: string;
  linkedMimos?: string;
  neighborhood?: string;
}

export interface MonthlyCohortData {
  monthKey: string;
  monthLabel: string;
  totalBlocked: number;
  totalMrrBlocked: number;
  returnedCount: number;
  returnedMrr: number;
  returnedRate: number;
  churnedCount: number;
  churnedMrr: number;
  churnRate: number;
  suspendedCount?: number;
  suspendedMrr?: number;
  suspendedRate?: number;
  stillBlockedCount: number;
  stillBlockedMrr: number;
  stillBlockedRate: number;
  avgDaysToReturn: number;
  returned0to7Days: number;
  returned8to15Days: number;
  returned16to30Days: number;
  returnedOver30Days: number;
  inheritedCount?: number;
  inheritedMrr?: number;
  pureTotalBlocked?: number;
  pureTotalMrr?: number;
  otherCount?: number;
  otherMrr?: number;
  mimoCount?: number;
  clients: ClientRecord[];
}

export interface BreakdownItem {
  name: string;
  city?: string; // Praça / Cidade associada
  totalBlocked: number;
  totalMrr: number;
  returnedCount: number;
  returnedMrr: number;
  returnedRate: number;
  churnedCount: number;
  churnedMrr: number;
  churnRate: number;
  suspendedCount: number;
  suspendedMrr: number;
  stillBlockedCount: number;
  stillBlockedMrr: number;
  stillBlockedRate: number;
  avgDaysToReturn: number;
}

export interface MonthlyAnalyticsData {
  monthKey: string;
  monthLabel: string;
  summary: MonthlyCohortData;
  byPlan: BreakdownItem[];
  byCity: BreakdownItem[];
  byNeighborhood?: BreakdownItem[];
  byCycle: BreakdownItem[];
  availableMonths: string[];
}

export interface MonthSummaryItem {
  monthKey: string;
  monthLabel: string;
  hasData: boolean;
  totalBlocked: number;
  totalMrrBlocked: number;
  returnedCount: number;
  returnedMrr: number;
  returnedRate: number;
  churnedCount: number;
  churnedMrr: number;
  churnRate: number;
  suspendedCount?: number;
  suspendedMrr?: number;
  suspendedRate?: number;
  stillBlockedCount: number;
  stillBlockedMrr: number;
  stillBlockedRate: number;
  avgDaysToReturn: number;
}

export interface AnnualAnalyticsData {
  year: string;
  summary: MonthlyCohortData;
  monthlyEvolution: MonthSummaryItem[];
  byPlan: BreakdownItem[];
  byCity: BreakdownItem[];
  byNeighborhood?: BreakdownItem[];
  byCycle: BreakdownItem[];
  availableYears: string[];
}

export interface MonthWithData {
  month: string;
  count: number;
}

export interface CompetenciasResponse {
  availableMonths: MonthWithData[];
  availableYears: string[];
  latestMonth: string;
}

export interface EquipamentoItem {
  id: string;
  protocolo: string;
  codigoCliente: string;
  nomeCliente: string;
  cidade: string;
  bairro: string;
  contrato: string;
  plano: string;
  dataAbertura: string | null;
  dataEncerramento: string | null;
  mesCompetencia: string;
  situacaoOS: string;
  topico: string;
  assunto: string;
  solucao: string;
  causa: string;
  usuarioAbertura: string;
  statusRecuperacao: 'recuperado' | 'pendente' | 'em_andamento' | 'cancelamento_abortado' | 'sem_os' | 'outro';
  statusManual?: 'recuperado' | 'tentando' | 'perdido' | 'ativo_cobranca' | '';
  observacaoManual?: string;
  atualizadoPor?: string;
  atualizadoEm?: string | null;
  statusFinal?: 'recuperado' | 'tentando' | 'perdido' | 'ativo_cobranca' | 'sem_os' | 'outro';
  statusDesfecho?: 'churned' | 'suspended' | 'returned' | 'other' | string;
  equipamentoIdentificado: string;
  serialMac: string;
  ehDuplicado: boolean;
}

export interface EquipamentoSummary {
  totalOrders: number;
  totalNaoRetornados?: number;
  totalRetornadosComOS?: number;
  totalDuplicados: number;
  recuperados: number;
  tentando: number;
  perdidos: number;
  ativoCobranca: number;
  semOS: number;
  pendentes: number;
  emAndamento: number;
  cancelamentoAbortado: number;
  taxaRecuperacao: number;
  taxaEfetividadeOS?: number;
}

export interface EquipamentoCityStats {
  cidade: string;
  total: number;
  recuperados: number;
  pendentes: number;
  semOS: number;
  taxaRecuperacao: number;
}

export interface EquipamentoResponse {
  summary: EquipamentoSummary;
  orders: EquipamentoItem[];
  byCity: EquipamentoCityStats[];
  availableMonths: string[];
  selectedMonth: string;
}
