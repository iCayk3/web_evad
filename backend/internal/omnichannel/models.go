package omnichannel

import (
	"encoding/json"
	"time"
)

// Priority níveis de risco do termômetro de saúde do cliente
type Priority string

const (
	PriorityCritical     Priority = "critical"     // Risco Crítico de Churn
	PriorityHigh         Priority = "high"         // Alto Risco
	PriorityAttention    Priority = "attention"    // Atenção / Alerta Precoce
	PriorityInsufficient Priority = "insufficient" // Dados insuficientes / Neutro
)

// BatchSummary sumário de lote de importação do ISPCHAT
type BatchSummary struct {
	ID                  string     `json:"id"`
	FileHash            string     `json:"fileHash"`
	FileName            string     `json:"fileName"`
	FileSize            int64      `json:"fileSize"`
	TotalRows           int        `json:"totalRows"`
	AcceptedRows        int        `json:"acceptedRows"`
	RejectedRows        int        `json:"rejectedRows"`
	DuplicateRows       int        `json:"duplicateRows"`
	MatchConfirmed      int        `json:"matchConfirmed"`
	MatchNameSuggested  int        `json:"matchNameSuggested"`
	MatchAmbiguous      int        `json:"matchAmbiguous"`
	MatchUnmatched      int        `json:"matchUnmatched"`
	DetectedPeriodStart *string    `json:"detectedPeriodStart,omitempty"`
	DetectedPeriodEnd   *string    `json:"detectedPeriodEnd,omitempty"`
	Status              string     `json:"status"` // 'queued', 'processing', 'completed', 'failed'
	ErrorMessage        *string    `json:"errorMessage,omitempty"`
	ImportedBy          string     `json:"importedBy"`
	CreatedAt           time.Time  `json:"createdAt"`
	CompletedAt         *time.Time `json:"completedAt,omitempty"`
}

func (b BatchSummary) MarshalJSON() ([]byte, error) {
	type Alias BatchSummary
	return json.Marshal(&struct {
		Alias
		FileHashSnake            string     `json:"file_hash"`
		FileNameSnake            string     `json:"file_name"`
		FileSizeSnake            int64      `json:"file_size"`
		TotalRowsSnake           int        `json:"total_rows"`
		AcceptedRowsSnake        int        `json:"accepted_rows"`
		RejectedRowsSnake        int        `json:"rejected_rows"`
		DuplicateRowsSnake       int        `json:"duplicate_rows"`
		MatchConfirmedSnake      int        `json:"match_confirmed"`
		MatchNameSuggestedSnake  int        `json:"match_name_suggested"`
		MatchAmbiguousSnake      int        `json:"match_ambiguous"`
		MatchUnmatchedSnake      int        `json:"match_unmatched"`
		DetectedPeriodStartSnake *string    `json:"detected_period_start,omitempty"`
		DetectedPeriodEndSnake   *string    `json:"detected_period_end,omitempty"`
		ErrorMessageSnake        *string    `json:"error_message,omitempty"`
		ImportedBySnake          string     `json:"imported_by"`
		CreatedAtSnake           time.Time  `json:"created_at"`
		CompletedAtSnake         *time.Time `json:"completed_at,omitempty"`
	}{
		Alias:                    Alias(b),
		FileHashSnake:            b.FileHash,
		FileNameSnake:            b.FileName,
		FileSizeSnake:            b.FileSize,
		TotalRowsSnake:           b.TotalRows,
		AcceptedRowsSnake:        b.AcceptedRows,
		RejectedRowsSnake:        b.RejectedRows,
		DuplicateRowsSnake:       b.DuplicateRows,
		MatchConfirmedSnake:      b.MatchConfirmed,
		MatchNameSuggestedSnake:  b.MatchNameSuggested,
		MatchAmbiguousSnake:      b.MatchAmbiguous,
		MatchUnmatchedSnake:      b.MatchUnmatched,
		DetectedPeriodStartSnake: b.DetectedPeriodStart,
		DetectedPeriodEndSnake:   b.DetectedPeriodEnd,
		ErrorMessageSnake:        b.ErrorMessage,
		ImportedBySnake:          b.ImportedBy,
		CreatedAtSnake:           b.CreatedAt,
		CompletedAtSnake:         b.CompletedAt,
	})
}

// ContactFact representação de um atendimento/conversa na base analítica
type ContactFact struct {
	ID                   string     `json:"id"`
	BatchID              string     `json:"batchId"`
	ConversationID       string     `json:"conversationId"`
	ProtocolNumber       *string    `json:"protocolNumber,omitempty"`
	PhoneHmac            string     `json:"phoneHmac"`
	PhoneMasked          string     `json:"phoneMasked"`
	NameNormalized       string     `json:"nameNormalized"`
	NameMasked           string     `json:"nameMasked"`
	RbxClientID          *string    `json:"rbxClientId,omitempty"`
	MatchStatus          string     `json:"matchStatus"` // 'confirmed', 'name_suggested', 'ambiguous', 'unmatched', 'pending'
	MatchMethod          *string    `json:"matchMethod,omitempty"`
	MatchConfidence      float64    `json:"matchConfidence"`
	StartedAt            time.Time  `json:"startedAt"`
	EndedAt              *time.Time `json:"endedAt,omitempty"`
	Status               string     `json:"status"`
	Channel              string     `json:"channel"`
	Department           string     `json:"department"`
	IsAutomation         bool       `json:"isAutomation"`
	ClosureType          string     `json:"closureType"`
	Classification       []string   `json:"classification"`
	Description          *string    `json:"description,omitempty"`
	MessagesReceived     int        `json:"messagesReceived"`
	MessagesSent         int        `json:"messagesSent"`
	MessagesInternal     int        `json:"messagesInternal"`
	HandleTimeSeconds    int        `json:"handleTimeSeconds"`
	WaitTimeSeconds      int        `json:"waitTimeSeconds"`
	FirstResponseSeconds int        `json:"firstResponseSeconds"`
	AvgResponseSeconds   int        `json:"avgResponseSeconds"`
	SatisfactionStatus   string     `json:"satisfactionStatus"`
	InitiatedBy          string     `json:"initiatedBy"`
}

// HealthContact interação tratada para o algoritmo de saúde
type HealthContact struct {
	ID             string     `json:"id"`
	ConversationID string     `json:"conversationId"`
	ClientID       *string    `json:"clientId"`
	Confirmed      bool       `json:"confirmed"`
	Name           string     `json:"name"`
	StartedAt      time.Time  `json:"startedAt"`
	EndedAt        *time.Time `json:"endedAt,omitempty"`
	Status         string     `json:"status"`
	Department     string     `json:"department"`
	Channel        string     `json:"channel"`
	Causes         []string   `json:"causes"`
	InitiatedBy    string     `json:"initiatedBy"`
}

// HealthTicket representação normalizada de chamado/OS no termômetro
type HealthTicket struct {
	ID          string     `json:"id"`
	ClientID    string     `json:"clientId"`
	Protocol    string     `json:"protocol"`
	OpenedAt    time.Time  `json:"openedAt"`
	ConcludedAt *time.Time `json:"concludedAt,omitempty"`
	DueAt       *time.Time `json:"dueAt,omitempty"`
	Cause       string     `json:"cause"`
	Status      string     `json:"status"`
}

// HealthProfile cadastro do cliente para segmentação
type HealthProfile struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	RegisteredAt *time.Time `json:"registeredAt,omitempty"`
	City         string     `json:"city"`
	Plan         string     `json:"plan"`
	PppoeLogin   string     `json:"pppoeLogin,omitempty"`
}

// HealthClientItem cliente com avaliação de saúde, causas e motivos de risco
type HealthClientItem struct {
	ID                     string          `json:"id"`
	Name                   string          `json:"name"`
	Priority               Priority        `json:"priority"`
	Recurrent              bool            `json:"recurrent"`
	RecentContacts         int             `json:"recentContacts"`
	RecentTickets          int             `json:"recentTickets"`
	TotalContacts          int             `json:"totalContacts"`
	FirstContactAt         string          `json:"firstContactAt"`
	LastContactAt          string          `json:"lastContactAt"`
	IsOld                  *bool           `json:"isOld"`
	RegisteredAt           *string         `json:"registeredAt"`
	City                   string          `json:"city"`
	Plan                   string          `json:"plan"`
	PppoeLogin             string          `json:"pppoeLogin,omitempty"`
	OverdueTickets         int             `json:"overdueTickets"`
	ObservedOpenTickets    int             `json:"observedOpenTickets"`
	ReturnAfterConclusion  bool            `json:"returnAfterConclusion"`
	Reasons                []string        `json:"reasons"`
	Recommendation         string          `json:"recommendation"`
	Sentiment              string          `json:"sentiment"`
	Partial                bool            `json:"partial"`
	Contacts               []HealthContact `json:"contacts"`
	Tickets                []HealthTicket  `json:"tickets"`
}

// HealthCauseSummary agregação de causas no termômetro
type HealthCauseSummary struct {
	Name            string   `json:"name"`
	Clients         int      `json:"clients"`
	Contacts        int      `json:"contacts"`
	PreviousClients int      `json:"previousClients"`
	Change          *float64 `json:"change"`
}

// DailyContactCount ponto diário de interações
type DailyContactCount struct {
	Day      string `json:"day"`
	Contacts int    `json:"contacts"`
}

type DatePeriod struct {
	Start string `json:"start"`
	End   string `json:"end"`
}

// CustomerHealthResponse resposta completa do termômetro de saúde do cliente
type CustomerHealthResponse struct {
	Clients     []HealthClientItem   `json:"clients"`
	Causes      []HealthCauseSummary `json:"causes"`
	Daily       []DailyContactCount  `json:"daily"`
	RuleVersion string               `json:"ruleVersion"`
	GeneratedAt string               `json:"generatedAt"`
	Options     struct {
		Start     string `json:"start"`
		End       string `json:"end"`
		Threshold int    `json:"threshold"`
		OldMonths int    `json:"oldMonths"`
	} `json:"options"`
	Quality struct {
		ImportedContacts        int         `json:"importedContacts"`
		ContactPeriod           *DatePeriod `json:"contactPeriod"`
		TicketPeriod            *DatePeriod `json:"ticketPeriod"`
		DuplicateRows           int         `json:"duplicateRows"`
		InvalidDates            int         `json:"invalidDates"`
		Mock                    bool        `json:"mock"`
		ClientsAvailable        bool        `json:"clientsAvailable"`
		TicketsAvailable        bool        `json:"ticketsAvailable"`
		HistoryComplete         bool        `json:"historyComplete"`
		AuthenticationAvailable bool        `json:"authenticationAvailable"`
		LastImportAt            *string     `json:"lastImportAt"`
		Warnings                []string    `json:"warnings"`
	} `json:"quality"`
	Summary struct {
		ObservedClients     int `json:"observedClients"`
		Contacts            int `json:"contacts"`
		Tickets             int `json:"tickets"`
		Recurrent           int `json:"recurrent"`
		HighPriority        int `json:"highPriority"`
		OldClients          int `json:"oldClients"`
		Returns             int `json:"returns"`
		UnconfirmedContacts int `json:"unconfirmedContacts"`
		UnknownInitiator    int `json:"unknownInitiator"`
		Insufficient        int `json:"insufficient"`
	} `json:"summary"`
	Filters struct {
		Departments []string `json:"departments"`
		Channels    []string `json:"channels"`
		Cities      []string `json:"cities"`
		Plans       []string `json:"plans"`
	} `json:"filters"`
}

// OmnichannelOverviewResponse KPIs consolidados da operação omnichannel
type OmnichannelOverviewResponse struct {
	Volume struct {
		TotalContacts     int     `json:"totalContacts"`
		DistinctClients   int     `json:"distinctClients"`
		DistinctPhones    int     `json:"distinctPhones"`
		ConfirmedMatches  int     `json:"confirmedMatches"`
		SuggestedMatches  int     `json:"suggestedMatches"`
		AmbiguousMatches  int     `json:"ambiguousMatches"`
		UnmatchedContacts int     `json:"unmatchedContacts"`
		MatchCoverageRate float64 `json:"matchCoverageRate"`
	} `json:"volume"`
	Efficiency struct {
		OverallAvgTmaSeconds       float64 `json:"overallAvgTmaSeconds"`
		OverallAvgTmeSeconds       float64 `json:"overallAvgTmeSeconds"`
		OverallAvgTmrFirstSeconds  float64 `json:"overallAvgTmrFirstSeconds"`
		ContactsWithHighWaitTime   int     `json:"contactsWithHighWaitTime"`
		HighWaitTimeRate           float64 `json:"highWaitTimeRate"`
		HumanAvgTmaSeconds         float64 `json:"humanAvgTmaSeconds"`
		AutomationAvgTmaSeconds    float64 `json:"automationAvgTmaSeconds"`
		OverallAvgTotalTimeSeconds float64 `json:"overallAvgTotalTimeSeconds"`
	} `json:"efficiency"`
	Departments []struct {
		Name          string  `json:"name"`
		Total         int     `json:"total"`
		Percentage    float64 `json:"percentage"`
		AvgTmaSeconds float64 `json:"avgTmaSeconds"`
		AvgTmeSeconds float64 `json:"avgTmeSeconds"`
	} `json:"departments"`
	AvailableDepartments []struct {
		Name  string `json:"name"`
		Total int    `json:"total"`
	} `json:"availableDepartments"`
	AvailableAgents []struct {
		Name  string `json:"name"`
		Total int    `json:"total"`
	} `json:"availableAgents"`
	Attributions []struct {
		AgentName     string  `json:"agentName"`
		TotalContacts int     `json:"totalContacts"`
		Percentage    float64 `json:"percentage"`
		AvgTmaSeconds float64 `json:"avgTmaSeconds"`
		AvgTmeSeconds float64 `json:"avgTmeSeconds"`
	} `json:"attributions"`
	Closures []struct {
		Type       string  `json:"type"`
		Total      int     `json:"total"`
		Percentage float64 `json:"percentage"`
	} `json:"closures"`
	Satisfaction struct {
		Answered     int     `json:"answered"`
		NotSent      int     `json:"notSent"`
		Expired      int     `json:"expired"`
		ResponseRate float64 `json:"responseRate"`
	} `json:"satisfaction"`
	Classifications []struct {
		Name          string  `json:"name"`
		Count         int     `json:"count"`
		Percentage    float64 `json:"percentage"`
		AvgTmaSeconds float64 `json:"avgTmaSeconds"`
	} `json:"classifications"`
}

// RecurrenceClientItem item no ranking de reincidência
type RecurrenceClientItem struct {
	Key            string   `json:"key"`
	RbxClientID    *string  `json:"rbxClientId"`
	CustomerName   string   `json:"customerName"`
	PhoneDisplay   string   `json:"phoneDisplay"`
	TotalContacts  int      `json:"totalContacts"`
	DistinctDays   int      `json:"distinctDays"`
	MatchStatus    string   `json:"matchStatus"`
	FirstContactAt string   `json:"firstContactAt"`
	LastContactAt  string   `json:"lastContactAt"`
	Departments    []string `json:"departments"`
}

// RecurrenceSummaryResponse resposta do endpoint de reincidência
type RecurrenceSummaryResponse struct {
	ClientsWithTwoPlus        int                    `json:"clientsWithTwoPlus"`
	ClientsWithThreePlus      int                    `json:"clientsWithThreePlus"`
	MaxContactsBySingleClient int                    `json:"maxContactsBySingleClient"`
	TopClients                []RecurrenceClientItem `json:"topClients"`
	TotalRecords              int                    `json:"totalRecords"`
}

// MatchReviewItem item da fila de revisão humana de correspondências
type MatchReviewItem struct {
	ID               string   `json:"id"`
	FactID           string   `json:"factId"`
	BatchID          string   `json:"batch_id"`
	ConversationID   string   `json:"conversation_id"`
	PhoneMasked      string   `json:"phone_masked"`
	NameMasked       string   `json:"name_masked"`
	NameNormalized   *string  `json:"name_normalized"`
	MatchStatus      string   `json:"match_status"`
	MatchMethod      *string  `json:"match_method"`
	MatchConfidence  *float64 `json:"match_confidence"`
	RbxClientID      *string  `json:"rbx_client_id"`
	CurrentClientID  *string  `json:"currentClientId"`
	SuggestedClients []string `json:"suggestedClients"`
	StartedAt        string   `json:"started_at"`
	Department       string   `json:"department"`
}

// ContactFactDto representação de um atendimento individual para tabela detalhada
type ContactFactDto struct {
	ID                   string   `json:"id"`
	BatchID              string   `json:"batch_id"`
	ConversationID       string   `json:"conversation_id"`
	ProtocolNumber       *string  `json:"protocol_number"`
	PhoneMasked          string   `json:"phone_masked"`
	NameMasked           string   `json:"name_masked"`
	NameNormalized       *string  `json:"name_normalized"`
	RbxClientID          *string  `json:"rbx_client_id"`
	MatchStatus          string   `json:"match_status"`
	MatchMethod          *string  `json:"match_method"`
	MatchConfidence      *float64 `json:"match_confidence"`
	StartedAt            string   `json:"started_at"`
	Department           *string  `json:"department"`
	HandleTimeSeconds    *int     `json:"handle_time_seconds"`
	WaitTimeSeconds      *int     `json:"wait_time_seconds"`
	Status               *string  `json:"status"`
	ClosureType          *string  `json:"closure_type"`
	FirstResponseSeconds *int     `json:"first_response_seconds"`
	IsAutomation         bool     `json:"is_automation"`
	AgentDisplay         *string  `json:"agent_display"`
	Classification       *string  `json:"classification"`
	Description          *string  `json:"description"`
	MessagesReceived     int      `json:"messages_received"`
	MessagesSent         int      `json:"messages_sent"`
	MessagesInternal     int      `json:"messages_internal"`
}

func (c ContactFactDto) MarshalJSON() ([]byte, error) {
	type Alias ContactFactDto
	return json.Marshal(&struct {
		Alias
		BatchIDCamel              string   `json:"batchId"`
		ConversationIDCamel       string   `json:"conversationId"`
		ProtocolNumberCamel       *string  `json:"protocolNumber"`
		PhoneMaskedCamel          string   `json:"phoneMasked"`
		NameMaskedCamel           string   `json:"nameMasked"`
		NameNormalizedCamel       *string  `json:"nameNormalized"`
		RbxClientIDCamel          *string  `json:"rbxClientId"`
		MatchStatusCamel          string   `json:"matchStatus"`
		MatchMethodCamel          *string  `json:"matchMethod"`
		MatchConfidenceCamel      *float64 `json:"matchConfidence"`
		StartedAtCamel            string   `json:"startedAt"`
		HandleTimeSecondsCamel    *int     `json:"handleTimeSeconds"`
		WaitTimeSecondsCamel      *int     `json:"waitTimeSeconds"`
		ClosureTypeCamel          *string  `json:"closureType"`
		FirstResponseSecondsCamel *int     `json:"firstResponseSeconds"`
		IsAutomationCamel         bool     `json:"isAutomation"`
		AgentDisplayCamel         *string  `json:"agentDisplay"`
		MessagesReceivedCamel     int      `json:"messagesReceived"`
		MessagesSentCamel         int      `json:"messagesSent"`
		MessagesInternalCamel     int      `json:"messagesInternal"`
	}{
		Alias:                     Alias(c),
		BatchIDCamel:              c.BatchID,
		ConversationIDCamel:       c.ConversationID,
		ProtocolNumberCamel:       c.ProtocolNumber,
		PhoneMaskedCamel:          c.PhoneMasked,
		NameMaskedCamel:           c.NameMasked,
		NameNormalizedCamel:       c.NameNormalized,
		RbxClientIDCamel:          c.RbxClientID,
		MatchStatusCamel:          c.MatchStatus,
		MatchMethodCamel:          c.MatchMethod,
		MatchConfidenceCamel:      c.MatchConfidence,
		StartedAtCamel:            c.StartedAt,
		HandleTimeSecondsCamel:    c.HandleTimeSeconds,
		WaitTimeSecondsCamel:      c.WaitTimeSeconds,
		ClosureTypeCamel:          c.ClosureType,
		FirstResponseSecondsCamel: c.FirstResponseSeconds,
		IsAutomationCamel:         c.IsAutomation,
		AgentDisplayCamel:         c.AgentDisplay,
		MessagesReceivedCamel:     c.MessagesReceived,
		MessagesSentCamel:         c.MessagesSent,
		MessagesInternalCamel:     c.MessagesInternal,
	})
}

// ContactFilterOptions opções de filtro para listagem de atendimentos
type ContactFilterOptions struct {
	BatchID        string
	Agent          string
	Department     string
	ClosureType    string
	Classification string
	Search         string
	SortBy         string
	SortDir        string
	Limit          int
	Offset         int
}

// ClientInteractionsOptions opções para buscar histórico e atendimentos de um cliente
type ClientInteractionsOptions struct {
	BatchID     string
	ClientKey   string
	RbxClientID string
	PhoneMasked string
}

// ClientInteractionContact contato para visualização no modal de histórico
type ClientInteractionContact struct {
	ID                   string   `json:"id"`
	BatchID              string   `json:"batchId"`
	ConversationID       string   `json:"conversationId"`
	PhoneDisplay         string   `json:"phoneDisplay"`
	CustomerName         string   `json:"customerName"`
	RbxClientID          *string  `json:"rbxClientId"`
	MatchStatus          string   `json:"matchStatus"`
	MatchMethod          string   `json:"matchMethod"`
	MatchConfidence      float64  `json:"matchConfidence"`
	StartedAt            string   `json:"startedAt"`
	Department           *string  `json:"department"`
	Status               *string  `json:"status"`
	ClosureType          *string  `json:"closureType"`
	Classification       *string  `json:"classification"`
	HandleTimeSeconds    *int     `json:"handleTimeSeconds"`
	WaitTimeSeconds      *int     `json:"waitTimeSeconds"`
	FirstResponseSeconds *int     `json:"firstResponseSeconds"`
	SatisfactionStatus   *string  `json:"satisfactionStatus"`
	IsAutomation         bool     `json:"isAutomation"`
}

// ClientRbxTicket ticket/OS correlacionado no RBX
type ClientRbxTicket struct {
	ID          string  `json:"id"`
	Protocol    string  `json:"protocol"`
	OpenedAt    string  `json:"openedAt"`
	ConcludedAt *string `json:"concludedAt"`
	Topic       string  `json:"topic"`
	Cause       string  `json:"cause"`
	Status      string  `json:"status"`
	Type        string  `json:"type"`
}

// ClientInteractionsResponse resposta completa para modal de interações
type ClientInteractionsResponse struct {
	Success    bool                       `json:"success"`
	Contacts   []ClientInteractionContact `json:"contacts"`
	RbxTickets []ClientRbxTicket          `json:"rbxTickets"`
}

// HighRiskClient cliente com alto volume de contatos e OSs
type HighRiskClient struct {
	ClientID           string `json:"clientId"`
	ClientName         string `json:"clientName"`
	ContactCount       int    `json:"contactCount"`
	TicketCount        int    `json:"ticketCount"`
	LastTicketProtocol string `json:"lastTicketProtocol,omitempty"`
}
