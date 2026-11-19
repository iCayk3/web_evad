package osanalytics

import "evad-backend/internal/rbx"

// OsFilterParams parâmetros de filtro para os endpoints analíticos de OS
type OsFilterParams struct {
	Period       string   `json:"period"` // 'today', '7d', 'month', 'custom'
	StartDate    string   `json:"startDate"`
	EndDate      string   `json:"endDate"`
	Technicians  []string `json:"technicians"`
	TechnicianID int      `json:"technicianId"`
	Status       string   `json:"status"`
	Search       string   `json:"search"`
	FlowType     string   `json:"flowType"` // e.g. "Solução Remota", "Presencial / Campo", "Comercial / Apoio"
	Locality     string   `json:"locality"` // e.g. "São José dos Pinhais (SJP)", "Magalhães Barata (MGB)", etc.
	Page         int      `json:"page"`
	Limit        int      `json:"limit"`
}

// OsKpiCards coleção de cartões KPI operacionais
type OsKpiCards struct {
	TotalOs struct {
		Value         int      `json:"value"`
		ChangePercent *float64 `json:"changePercent"`
	} `json:"totalOs"`
	ConcludedOs struct {
		Value         int      `json:"value"`
		Rate          float64  `json:"rate"`
		ChangePercent *float64 `json:"changePercent"`
	} `json:"concludedOs"`
	CancelledOs struct {
		Value         int      `json:"value"`
		Rate          float64  `json:"rate"`
		ChangePercent *float64 `json:"changePercent"`
	} `json:"cancelledOs"`
	PendingOs struct {
		Value      int     `json:"value"`
		Percentage float64 `json:"percentage"`
	} `json:"pendingOs"`
	OpenOs struct {
		Value      int     `json:"value"`
		Percentage float64 `json:"percentage"`
	} `json:"openOs"`
	AvgResolutionTimeHours struct {
		Value     float64 `json:"value"`
		Formatted string  `json:"formatted"`
	} `json:"avgResolutionTimeHours"`
	SlaComplianceRate struct {
		Value     float64 `json:"value"`
		Formatted string  `json:"formatted"`
	} `json:"slaComplianceRate"`
	TotalMovements struct {
		Value    int     `json:"value"`
		AvgPerOs float64 `json:"avgPerOs"`
	} `json:"totalMovements"`
	RemoteResolutions struct {
		Value int     `json:"value"`
		Rate  float64 `json:"rate"`
	} `json:"remoteResolutions"`
	FieldWork struct {
		Value int     `json:"value"`
		Rate  float64 `json:"rate"`
	} `json:"fieldWork"`
	TotalFlows struct {
		Value    int     `json:"value"`
		AvgPerOs float64 `json:"avgPerOs"`
	} `json:"totalFlows"`
}

// OsDailyEvolutionPoint ponto da evolução diária temporal
type OsDailyEvolutionPoint struct {
	Date       string `json:"date"`
	Label      string `json:"label"` // 'DD/MM'
	Abertas    int    `json:"abertas"`
	Concluidas int    `json:"concluidas"`
	Canceladas int    `json:"canceladas"`
}

// OsStatusDistributionItem contagem e fatia visual por status
type OsStatusDistributionItem struct {
	Status     string  `json:"status"`
	Count      int     `json:"count"`
	Percentage float64 `json:"percentage"`
	Color      string  `json:"color"`
}

// OsTechnicianWorkload produtividade e eficiência por técnico
type OsTechnicianWorkload struct {
	ID             int     `json:"id"`
	Name           string  `json:"name"`
	Total          int     `json:"total"`
	Concluded      int     `json:"concluded"`
	Pending        int     `json:"pending"`
	Cancelled      int     `json:"cancelled"`
	InProgress     int     `json:"inProgress"`
	ConclusionRate float64 `json:"conclusionRate"`
	AvgTimeHours   float64 `json:"avgTimeHours"`
	SlaRate        float64 `json:"slaRate"`
}

// OsTopicCauseItem ranking de tópicos ou causas
type OsTopicCauseItem struct {
	Name       string  `json:"name"`
	Count      int     `json:"count"`
	Percentage float64 `json:"percentage"`
}

// OsAbortedTicketDetail detalhe com histórico e ocorrências de uma OS abortada
type OsAbortedTicketDetail struct {
	ID                  int                 `json:"id"`
	Protocol            string              `json:"protocol"`
	ClientID            int                 `json:"clientId"`
	ClientName          string              `json:"clientName"`
	TechnicianName      string              `json:"technicianName"`
	TopicName           string              `json:"topicName"`
	CauseName           string              `json:"causeName"`
	CreatedAt           string              `json:"createdAt"`
	CancelledAt         string              `json:"cancelledAt"`
	DurationHours       float64             `json:"durationHours"`
	ClassifiedMotive    string              `json:"classifiedMotive"`
	JustificationText   string              `json:"justificationText"`
	JustificationAuthor string              `json:"justificationAuthor"`
	Solution            string                `json:"solution,omitempty"`
	OccurrencesCount    int                   `json:"occurrencesCount"`
	Occurrences         []rbx.OcorrenciaDto   `json:"occurrences"`
	FinalizedFlows      []rbx.OsFinalizedFlow `json:"finalizedFlows"`
	LastFlow            *rbx.OsFinalizedFlow  `json:"lastFlow,omitempty"`
	FlowCategory        string                `json:"flowCategory,omitempty"`
	Locality            string                `json:"locality,omitempty"`
}

// OsAbortedMotiveSummary agregação de motivos classificados
type OsAbortedMotiveSummary struct {
	Motive     string  `json:"motive"`
	Count      int     `json:"count"`
	Percentage float64 `json:"percentage"`
}

// TechnicianAbortedCount contagem de cancelamentos por técnico
type TechnicianAbortedCount struct {
	Name       string  `json:"name"`
	Count      int     `json:"count"`
	Percentage float64 `json:"percentage"`
}

// OsAbortedAnalysis conjunto de inteligência de abortamento de OS
type OsAbortedAnalysis struct {
	TotalAborted             int                      `json:"totalAborted"`
	AbortedRate              float64                  `json:"abortedRate"`
	AvgTimeUntilAbortHours   float64                  `json:"avgTimeUntilAbortHours"`
	MotivesSummary           []OsAbortedMotiveSummary `json:"motivesSummary"`
	TechnicianAbortedRanking []TechnicianAbortedCount `json:"technicianAbortedRanking"`
	Records                  []OsAbortedTicketDetail  `json:"records"`
}

// AvailableTechnician técnico disponível na base para seletores
type AvailableTechnician struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// OsAnalyticsOverviewResponse resposta completa do dashboard de OS
type OsAnalyticsOverviewResponse struct {
	Period struct {
		Type      string `json:"type"`
		StartDate string `json:"startDate"`
		EndDate   string `json:"endDate"`
	} `json:"period"`
	PreviousPeriod struct {
		StartDate string `json:"startDate"`
		EndDate   string `json:"endDate"`
	} `json:"previousPeriod"`
	UpdatedAt            string                     `json:"updatedAt"`
	Cards                OsKpiCards                 `json:"cards"`
	Evolution            []OsDailyEvolutionPoint    `json:"evolution"`
	StatusDistribution   []OsStatusDistributionItem `json:"statusDistribution"`
	TechniciansRanking   []OsTechnicianWorkload     `json:"techniciansRanking"`
	TopTopics            []OsTopicCauseItem         `json:"topTopics"`
	TopCauses              []OsTopicCauseItem         `json:"topCauses"`
	AvailableTechnicians   []AvailableTechnician      `json:"availableTechnicians"`
	AbortedAnalysis        OsAbortedAnalysis          `json:"abortedAnalysis"`
	FlowTypesDistribution []OsStatusDistributionItem `json:"flowTypesDistribution"`
	LocalitiesRanking      []OsTopicCauseItem         `json:"localitiesRanking"`
	AvailableLocalities    []string                   `json:"availableLocalities"`
	AvailableFlowTypes     []string                   `json:"availableFlowTypes"`
}

// OsTicketListResponse listagem paginada para o drill-down
type OsTicketListResponse struct {
	Tickets []rbx.TicketDto `json:"tickets"`
	Total   int             `json:"total"`
	Page    int             `json:"page"`
	Limit   int             `json:"limit"`
}
