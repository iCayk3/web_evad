export interface OmnichannelOverviewMetrics {
  volume: {
    totalContacts: number;
    distinctClients: number;
    distinctPhones: number;
    confirmedMatches: number;
    suggestedMatches: number;
    ambiguousMatches: number;
    unmatchedContacts: number;
    matchCoverageRate: number;
  };
  efficiency: {
    overallAvgTmaSeconds: number;
    overallMedianTmaSeconds: number;
    overallAvgTmeSeconds: number;
    overallMedianTmeSeconds: number;
    overallAvgTmrFirstSeconds: number;
    contactsWithHighWaitTime: number;
    highWaitTimeRate: number;
    humanAvgTmaSeconds: number;
    automationAvgTmaSeconds: number;
    overallAvgTotalTimeSeconds?: number;
  };
  departments: Array<{
    name: string;
    total: number;
    percentage: number;
    avgTmaSeconds: number;
    avgTmeSeconds: number;
  }>;
  availableDepartments?: Array<{
    name: string;
    total: number;
  }>;
  availableAgents?: Array<{
    name: string;
    total: number;
  }>;
  attributions?: AgentAttributionMetric[];
  closures: Array<{
    type: string;
    total: number;
    percentage: number;
  }>;
  satisfaction: {
    answered: number;
    notSent: number;
    expired: number;
    responseRate: number;
  };
  classifications: Array<{
    name: string;
    count: number;
    avgTmaSeconds: number;
    percentage?: number;
  }>;
}

export interface AgentAttributionMetric {
  agentName: string;
  totalContacts: number;
  percentage: number;
  avgTmaSeconds: number;
  avgTmeSeconds: number;
  avgTotalTimeSeconds: number;
}

export interface RecurrenceClientItem {
  key: string;
  rbxClientId: string | null;
  customerName: string;
  phoneDisplay: string;
  totalContacts: number;
  distinctDays: number;
  matchStatus: string;
  firstContactAt: string;
  lastContactAt: string;
  departments: string[];
}

export interface RecurrenceSummary {
  clientsWithTwoPlus: number;
  clientsWithThreePlus: number;
  maxContactsBySingleClient: number;
  topClients: RecurrenceClientItem[];
  totalRecords: number;
}

export interface RbxCorrelatedTicketSummary {
  protocol: string | null;
  number: string | null;
  openedAt: string | null;
  concludedAt: string | null;
  isConcluded: boolean;
  topic: string | null;
  cause: string | null;
  status: string | null;
  type: string | null;
}

export interface RbxCorrelatedItem {
  factId: string;
  conversationId: string;
  clientName: string;
  phoneDisplay: string;
  rbxClientId: string;
  startedAt: string;
  endedAt?: string | null;
  department: string | null;
  status?: string | null;
  isProtocolConcluded?: boolean;
  closureType?: string | null;
  classification?: string[];
  handleTimeSeconds?: number | null;
  waitTimeSeconds?: number | null;
  firstResponseSeconds?: number | null;
  satisfactionStatus?: string | null;
  channel?: string | null;
  isAutomation?: boolean;
  agents?: string[];
  closerAgent?: string | null;
  hasTicket: boolean;
  ticketProtocol: string | null;
  ticketNumber: string | null;
  ticketOpenedAt: string | null;
  ticketConcludedAt: string | null;
  isTicketConcluded?: boolean;
  ticketTopic: string | null;
  ticketCause: string | null;
  ticketStatus: string | null;
  ticketType: string | null;
  timeDiffMinutes: number | null;
  clientTickets?: RbxCorrelatedTicketSummary[];
}

export interface RbxCorrelationResult {
  windowHours: number;
  totalLinkedContacts: number;
  correlatedContactsCount: number;
  correlationRate: number;
  contactsWithoutCorrelatedTicket: number;
  topCorrelatedTopics: Array<{ topic: string; count: number }>;
  topCorrelatedCauses: Array<{ cause: string; count: number }>;
  highRiskClients: Array<{
    clientId: string;
    clientName: string;
    contactCount: number;
    ticketCount: number;
    lastTicketProtocol?: string;
  }>;
  detailedList?: RbxCorrelatedItem[];
}

export interface ImportBatch {
  id: string;
  file_hash: string;
  fileHash?: string;
  file_name: string;
  fileName?: string;
  file_size: number;
  fileSize?: number;
  total_rows: number;
  totalRows?: number;
  accepted_rows: number;
  acceptedRows?: number;
  rejected_rows: number;
  rejectedRows?: number;
  duplicate_rows: number;
  duplicateRows?: number;
  match_confirmed: number;
  matchConfirmed?: number;
  match_name_suggested: number;
  matchNameSuggested?: number;
  match_ambiguous: number;
  matchAmbiguous?: number;
  match_unmatched: number;
  matchUnmatched?: number;
  detected_period_start: string | null;
  detectedPeriodStart?: string | null;
  detected_period_end: string | null;
  detectedPeriodEnd?: string | null;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  errorMessage?: string | null;
  imported_by: string;
  importedBy?: string;
  imported_by_name?: string;
  created_at: string;
  createdAt?: string;
  completed_at: string | null;
  completedAt?: string | null;
}

export interface BatchError {
  row_number: number;
  field_name: string;
  error_code: string;
  error_message: string;
  raw_value: string | null;
}

export interface ReviewItem {
  id: string;
  batch_id: string;
  conversation_id: string;
  phone_masked: string;
  name_masked: string;
  name_normalized: string | null;
  rbx_client_id: string | null;
  match_status: 'name_suggested' | 'ambiguous';
  match_method: string | null;
  match_confidence: number | null;
  started_at: string;
  department: string | null;
}

export interface PreviewData {
  fileHash: string;
  totalRowsEstimated: number;
  detectedColumnsCount: number;
  detectedColumns: Record<number, string>;
  unmappedHeaders: string[];
  previewRows: Array<{
    rowNumber: number;
    rawValues: Record<string, any>;
    canonicalData: any;
    validation: {
      isValid: boolean;
      errors: Array<{ field: string; code: string; message: string }>;
      qualityFlags: string[];
    };
  }>;
}

export interface ContactFact {
  id: string;
  batch_id: string;
  conversation_id: string;
  protocol_number?: string | null;
  phone_masked: string;
  name_masked: string;
  name_normalized: string | null;
  rbx_client_id: string | null;
  match_status: string;
  match_method: string | null;
  match_confidence: number | null;
  started_at: string;
  department: string | null;
  handle_time_seconds: number | null;
  wait_time_seconds: number | null;
  status?: string | null;
  closure_type?: string | null;
  first_response_seconds?: number | null;
  is_automation?: boolean;
  agent_display?: string | null;
  classification?: string | null;
  description?: string | null;
  messages_received?: number | null;
  messages_sent?: number | null;
  messages_internal?: number | null;
}

export interface ClientInteractionContact {
  id: string;
  batchId: string;
  conversationId: string;
  phoneDisplay: string;
  customerName: string;
  rbxClientId: string | null;
  matchStatus: string;
  matchMethod: string;
  matchConfidence: number;
  startedAt: string;
  department: string | null;
  status: string | null;
  closureType: string | null;
  classification: string | null;
  handleTimeSeconds: number | null;
  waitTimeSeconds: number | null;
  firstResponseSeconds: number | null;
  satisfactionStatus: string | null;
  isAutomation: boolean;
}

export interface ClientRbxTicket {
  id: string;
  protocol: string;
  openedAt: string;
  concludedAt: string | null;
  topic: string;
  cause: string;
  status: string;
  type: string;
}

export interface ClientInteractionsResponse {
  success: boolean;
  contacts: ClientInteractionContact[];
  rbxTickets: ClientRbxTicket[];
}
