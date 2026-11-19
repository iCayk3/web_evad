export type Priority = 'critical' | 'high' | 'attention' | 'insufficient';
export interface HealthContact {
    id: string;
    conversationId: string;
    startedAt: string;
    endedAt: string | null;
    department: string;
    channel: string;
    causes: string[];
    status: string;
    initiatedBy: string;
}
export interface HealthTicket {
    id: string;
    protocol: string;
    openedAt: string;
    concludedAt: string | null;
    dueAt: string | null;
    cause: string;
    status: string;
    number?: string;
    subject?: string;
    topic?: string;
    reason?: string;
    type?: string;
    department?: string;
    responsible?: string;
    description?: string;
    solution?: string;
}
export interface HealthClient {
    id: string;
    name: string;
    priority: Priority;
    recurrent: boolean;
    recentContacts: number;
    recentTickets: number;
    totalContacts: number;
    firstContactAt: string;
    lastContactAt: string;
    isOld: boolean | null;
    registeredAt: string | null;
    city: string;
    plan: string;
    pppoeLogin: string | null;
    overdueTickets: number;
    observedOpenTickets: number;
    returnAfterConclusion: boolean;
    reasons: string[];
    recommendation: string;
    sentiment: string;
    partial: boolean;
    contacts: HealthContact[];
    tickets: HealthTicket[];
}
export interface CustomerHealth {
    clients: HealthClient[];
    causes: {
        name: string;
        clients: number;
        contacts: number;
        previousClients: number;
        change: number | null;
    }[];
    daily: {
        day: string;
        contacts: number;
    }[];
    summary: {
        observedClients: number;
        contacts: number;
        tickets: number;
        recurrent: number;
        highPriority: number;
        oldClients: number;
        returns: number;
        unconfirmedContacts: number;
        unknownInitiator: number;
        insufficient: number;
    };
    options: {
        start: string;
        end: string;
        threshold: number;
        oldMonths: number;
    };
    ruleVersion: string;
    generatedAt: string;
    quality: {
        importedContacts: number;
        contactPeriod: { start: string; end: string } | null;
        ticketPeriod: { start: string; end: string } | null;
        duplicateRows: number;
        invalidDates: number;
        mock: boolean;
        clientsAvailable: boolean;
        ticketsAvailable: boolean;
        historyComplete: boolean;
        authenticationAvailable: boolean;
        lastImportAt: string | null;
        warnings: string[];
    };
    filters: {
        departments: string[];
        channels: string[];
        cities: string[];
        plans: string[];
    };
}
