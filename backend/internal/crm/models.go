package crm

// LeadStage representa a etapa no funil de vendas
type LeadStage string

const (
	LeadStageNew         LeadStage = "new"
	LeadStageQualified   LeadStage = "qualified"
	LeadStageProposal    LeadStage = "proposal"
	LeadStageNegotiation LeadStage = "negotiation"
	LeadStageWon         LeadStage = "won"
	LeadStageLost        LeadStage = "lost"
)

// SellerType classificação operacional de colaborador/vendedor
type SellerType string

const (
	SellerTypeActive     SellerType = "active"
	SellerTypeInactive   SellerType = "inactive"
	SellerTypeThirdParty SellerType = "third_party"
	SellerTypeUnassigned SellerType = "unassigned"
)

// LeadContactDto contato associado ao prospect/mercado
type LeadContactDto struct {
	ID       int    `json:"id"`
	LeadID   int    `json:"leadId"`
	Name     string `json:"name"`
	Phone    string `json:"phone"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	Type     string `json:"type"` // 'Principal', 'Financeiro', 'Técnico', 'Comercial'
	IsActive bool   `json:"isActive"`
}

// LeadDto DTO completo de um Lead (Mercado RBXSoft)
type LeadDto struct {
	ID            int       `json:"id"`
	Code          string    `json:"code"`
	Name          string    `json:"name"`
	PersonType    string    `json:"personType"` // 'F' ou 'J'
	CpfCnpj       string    `json:"cpfCnpj"`
	Email         string    `json:"email"`
	Phone         string    `json:"phone"`
	City          string    `json:"city"`
	State         string    `json:"state"`
	Neighborhood  string    `json:"neighborhood"`
	Address       string    `json:"address"`
	AddressNumber string    `json:"addressNumber"`
	Complement    string    `json:"complement,omitempty"`
	ZipCode       string    `json:"zipCode"`
	CreatedAt     string    `json:"createdAt"`
	CreatedByUser string    `json:"createdByUser"`
	Status        string    `json:"status"`
	Group         string    `json:"group"`

	// Metadados de CRM
	Stage                LeadStage `json:"stage"`
	Source               string    `json:"source"`
	Owner                string    `json:"owner"`
	NextActionAt         *string   `json:"nextActionAt"`
	IsNextActionOverdue  bool      `json:"isNextActionOverdue"`
	LossReason           string    `json:"lossReason,omitempty"`
	StageUpdatedAt       string    `json:"stageUpdatedAt"`
	EstimatedValue       float64   `json:"estimatedValue,omitempty"`
	ConvertedContractID  string    `json:"convertedContractId,omitempty"`
	ContactsCount        int       `json:"contactsCount"`
	OpenActivitiesCount  int       `json:"openActivitiesCount"`
}

// CommercialTopicDto tópico de atendimento comercial (Tipo = 'C')
type CommercialTopicDto struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Type     string `json:"type"` // 'C'
	IsActive bool   `json:"isActive"`
}

// CommercialOccurrenceDto ocorrência registrada no atendimento
type CommercialOccurrenceDto struct {
	ID        int    `json:"id"`
	CreatedAt string `json:"createdAt"`
	Author    string `json:"author"`
	Text      string `json:"text"`
}

// CommercialActivityDto atendimento comercial vinculado a Mercado ou Cliente
type CommercialActivityDto struct {
	ID           int                       `json:"id"`
	Protocol     string                    `json:"protocol"`
	ClientType   string                    `json:"clientType"` // 'M' = Mercado, 'C' = Cliente
	TargetID     int                       `json:"targetId"`
	TargetName   string                    `json:"targetName"`
	TopicID      int                       `json:"topicId"`
	TopicName    string                    `json:"topicName"`
	Responsible  string                    `json:"responsible"`
	Status       string                    `json:"status"` // 'Aberto', 'Em Andamento', 'Pendente', 'Concluído', 'Cancelado'
	CreatedAt    string                    `json:"createdAt"`
	SLAForecastAt *string                  `json:"slaForecastAt,omitempty"`
	ClosedAt     *string                   `json:"closedAt"`
	Description  string                    `json:"description"`
	Occurrences  []CommercialOccurrenceDto `json:"occurrences"`
}

// SalesContractDto contrato do RBXSoft para análise de vendas e cancelamentos
type SalesContractDto struct {
	Number             string  `json:"number"`
	ClientID           int     `json:"clientId"`
	ClientName         string  `json:"clientName"`
	PlanCode           string  `json:"planCode"`
	PlanDescription    string  `json:"planDescription"`
	StatusCode         string  `json:"statusCode"` // 'A', 'B', 'S', 'C', 'T', 'E'
	StatusDescription  string  `json:"statusDescription"`
	MonthlyValue       float64 `json:"monthlyValue"`
	GrossValue         float64 `json:"grossValue"`
	AdhesionValue      float64 `json:"adhesionValue"`
	SignDate           string  `json:"signDate"`
	StartDate          string  `json:"startDate"`
	LastOperationDate  string  `json:"lastOperationDate,omitempty"`
	Seller             string  `json:"seller"`
	City               string  `json:"city"`
	State              string  `json:"state"`
	Group              string  `json:"group"`
	Technology         string  `json:"technology"`
	CancelReason       string  `json:"cancelReason,omitempty"`
	CancelCompetitor   string  `json:"cancelCompetitor,omitempty"`
	OriginProspectId   int     `json:"originProspectId,omitempty"`
	SalesChannel       string  `json:"salesChannel,omitempty"`
}

// SalesKpiSummary resumo dos 8 cards principais de vendas
type SalesKpiSummary struct {
	NewLeadsCount                int                  `json:"newLeadsCount"`
	NewLeadsDiffPercent          float64              `json:"newLeadsDiffPercent"`
	LeadsByStage                 map[LeadStage]int    `json:"leadsByStage"`
	LeadsWithoutNextContactCount int                  `json:"leadsWithoutNextContactCount"`
	OpenActivitiesCount          int                  `json:"openActivitiesCount"`
	ClosedSalesCount             int                  `json:"closedSalesCount"`
	ClosedSalesDiffPercent       float64              `json:"closedSalesDiffPercent"`
	ConfirmedContractsCount      int                  `json:"confirmedContractsCount"`
	ConfirmedContractsDiffPercent float64             `json:"confirmedContractsDiffPercent"`
	TotalMonthlyValue            float64              `json:"totalMonthlyValue"`
	AverageTicketMonthly         float64              `json:"averageTicketMonthly"`
	AverageAdhesionValue         float64              `json:"averageAdhesionValue"`
	CancellationsCount           int                  `json:"cancellationsCount"`
	NetAdditions                 int                  `json:"netAdditions"`
	ChurnRatioPercent            float64              `json:"churnRatioPercent"`
	TraceableConversionsCount    int                  `json:"traceableConversionsCount"`
	ConversionRatePercent        float64              `json:"conversionRatePercent"`
	CoveragePercent              float64              `json:"coveragePercent"`
}

// SalesTimeSeriesPoint ponto da série temporal diária
type SalesTimeSeriesPoint struct {
	Date          string `json:"date"`
	Leads         int    `json:"leads"`
	Sales         int    `json:"sales"`
	Contracts     int    `json:"contracts"`
	Cancellations int    `json:"cancellations"`
}

// MonthlyGroupShare fatia de vendas por grupo de clientes no mês
type MonthlyGroupShare struct {
	Group        string  `json:"group"`
	Count        int     `json:"count"`
	Value        float64 `json:"value"`
	SharePercent float64 `json:"sharePercent"`
}

// MonthlyRegionShare fatia de vendas por região no mês
type MonthlyRegionShare struct {
	Region string  `json:"region"`
	Count  int     `json:"count"`
	Value  float64 `json:"value"`
}

// MonthlyRankingItem item de ranking mensal (planos ou vendedores)
type MonthlyRankingItem struct {
	Name         string  `json:"name"`
	Count        int     `json:"count"`
	Value        float64 `json:"value"`
	SharePercent float64 `json:"sharePercent"`
}

// MomComparison comparação mês a mês
type MomComparison struct {
	SalesDiffPercent         *float64 `json:"salesDiffPercent"`
	RevenueDiffPercent       *float64 `json:"revenueDiffPercent"`
	CancellationsDiffPercent *float64 `json:"cancellationsDiffPercent"`
	NetDiff                  *int     `json:"netDiff"`
}

// SalesMonthlyPoint ponto mensal (12 meses para o filtro 'year')
type SalesMonthlyPoint struct {
	Month              string               `json:"month"` // Ex: "2026-01"
	Label              string               `json:"label"` // Ex: "Jan"
	FullLabel          string               `json:"fullLabel"` // Ex: "Janeiro / 2026"
	MonthIndex         int                  `json:"monthIndex"` // 0 a 11
	Year               int                  `json:"year"`
	Leads              int                  `json:"leads"`
	Sales              int                  `json:"sales"`
	Contracts          int                  `json:"contracts"`
	Cancellations      int                  `json:"cancellations"`
	NetAdditions       int                  `json:"netAdditions"`
	Revenue            float64              `json:"revenue"`
	AvgTicket          float64              `json:"avgTicket"`
	CancellationsValue float64              `json:"cancellationsValue"`
	ChurnRatioPercent  float64              `json:"churnRatioPercent"`
	SalesByGroup       []MonthlyGroupShare  `json:"salesByGroup,omitempty"`
	SalesByRegion      []MonthlyRegionShare `json:"salesByRegion,omitempty"`
	TopSellers         []MonthlyRankingItem `json:"topSellers,omitempty"`
	TopPlans           []MonthlyRankingItem `json:"topPlans,omitempty"`
	MomComparison      *MomComparison       `json:"momComparison,omitempty"`
}

// SalesRankingItem item de ranking (planos, vendedores, etc.)
type SalesRankingItem struct {
	Name          string     `json:"name"`
	Count         int        `json:"count"`
	Value         float64    `json:"value"`
	TicketAverage float64    `json:"ticketAverage"`
	SharePercent  float64    `json:"sharePercent"`
	SellerType    SellerType `json:"sellerType,omitempty"`
}

// CancellationByCity perda de carteira por cidade
type CancellationByCity struct {
	City        string  `json:"city"`
	State       string  `json:"state"`
	Count       int     `json:"count"`
	Percentage  float64 `json:"percentage"`
	MonthlyLoss float64 `json:"monthlyLoss"`
}

// CommercialDashboardDto resposta do dashboard comercial
type CommercialDashboardDto struct {
	Period struct {
		Start string `json:"start"`
		End   string `json:"end"`
		Label string `json:"label"`
		Type  string `json:"type,omitempty"`
	} `json:"period"`
	LastUpdatedAt          string                                 `json:"lastUpdatedAt"`
	Kpis                   SalesKpiSummary                        `json:"kpis"`
	TimeSeries             []SalesTimeSeriesPoint                 `json:"timeSeries"`
	MonthlySeries          []SalesMonthlyPoint                    `json:"monthlySeries,omitempty"`
	Funnel                 []struct {
		Stage LeadStage `json:"stage"`
		Label string    `json:"label"`
		Count int       `json:"count"`
	} `json:"funnel"`
	TopPlans               []SalesRankingItem                     `json:"topPlans"`
	TopSellers             []SalesRankingItem                     `json:"topSellers"`
	SellersClassification map[string]SellerType                  `json:"sellersClassification,omitempty"`
	SalesByGroup           []struct {
		Group         string  `json:"group"`
		Count         int     `json:"count"`
		Value         float64 `json:"value"`
		TicketAverage float64 `json:"ticketAverage"`
		SharePercent  float64 `json:"sharePercent"`
	} `json:"salesByGroup,omitempty"`
	SalesByRegion          []struct {
		Region string  `json:"region"`
		Count  int     `json:"count"`
		Value  float64 `json:"value"`
	} `json:"salesByRegion"`
	SalesByCity            []struct {
		City  string  `json:"city"`
		Count int     `json:"count"`
		Value float64 `json:"value"`
	} `json:"salesByCity,omitempty"`
	SalesByTechnology      []struct {
		Technology string  `json:"technology"`
		Count      int     `json:"count"`
		Value      float64 `json:"value"`
	} `json:"salesByTechnology"`
	CancellationsByReason  []struct {
		Reason string `json:"reason"`
		Count  int    `json:"count"`
	} `json:"cancellationsByReason"`
	CancellationsByCity    []CancellationByCity                   `json:"cancellationsByCity,omitempty"`
	AllAvailablePlans      []struct {
		Name  string  `json:"name"`
		Count int     `json:"count"`
		Value float64 `json:"value"`
	} `json:"allAvailablePlans,omitempty"`
	AllAvailableReasons    []struct {
		Reason string `json:"reason"`
		Count  int    `json:"count"`
	} `json:"allAvailableReasons,omitempty"`
	AllAvailableGroups     []string                               `json:"allAvailableGroups,omitempty"`
	AllAvailableSellers    []struct {
		Name       string     `json:"name"`
		Count      int        `json:"count"`
		Value      float64    `json:"value"`
		SellerType SellerType `json:"sellerType"`
	} `json:"allAvailableSellers,omitempty"`
}

// GetLeadsFilter opções de filtro para listagem de leads
type GetLeadsFilter struct {
	Stage             string `json:"stage"`
	Owner             string `json:"owner"`
	Search            string `json:"search"`
	Source            string `json:"source"`
	OverdueOnly       bool   `json:"overdueOnly"`
	NoNextContactOnly bool   `json:"noNextContactOnly"`
	Period            string `json:"period"` // 'today', '7d', '30d', 'month', 'year', 'custom'
	StartDate         string `json:"startDate"`
	EndDate           string `json:"endDate"`
	Page              int    `json:"page"`
	Limit             int    `json:"limit"`
}

// GetLeadsResult resultado paginado de leads
type GetLeadsResult struct {
	Leads      []LeadDto `json:"leads"`
	Total      int       `json:"total"`
	Page       int       `json:"page"`
	TotalPages int       `json:"totalPages"`
}

// LeadDetailResult detalhe de lead com contatos e atividades
type LeadDetailResult struct {
	Lead       LeadDto                 `json:"lead"`
	Contacts   []LeadContactDto        `json:"contacts"`
	Activities []CommercialActivityDto `json:"activities"`
}

// CreateLeadInput dados para cadastro de lead
type CreateLeadInput struct {
	Name           string    `json:"name"`
	PersonType     string    `json:"personType"` // 'F' ou 'J'
	CpfCnpj        string    `json:"cpfCnpj,omitempty"`
	Email          string    `json:"email,omitempty"`
	Phone          string    `json:"phone,omitempty"`
	City           string    `json:"city,omitempty"`
	State          string    `json:"state,omitempty"`
	Neighborhood   string    `json:"neighborhood,omitempty"`
	Address        string    `json:"address,omitempty"`
	AddressNumber  string    `json:"addressNumber,omitempty"`
	Complement     string    `json:"complement,omitempty"`
	ZipCode        string    `json:"zipCode,omitempty"`
	Stage          LeadStage `json:"stage,omitempty"`
	Source         string    `json:"source,omitempty"`
	Owner          string    `json:"owner,omitempty"`
	NextActionAt   *string   `json:"nextActionAt,omitempty"`
	EstimatedValue float64   `json:"estimatedValue,omitempty"`
	ContactName    string    `json:"contactName,omitempty"`
	ContactPhone   string    `json:"contactPhone,omitempty"`
	ContactEmail   string    `json:"contactEmail,omitempty"`
	ContactRole    string    `json:"contactRole,omitempty"`
}

// UpdateLeadInput dados para alteração de lead
type UpdateLeadInput struct {
	Name           string    `json:"name,omitempty"`
	Phone          string    `json:"phone,omitempty"`
	Email          string    `json:"email,omitempty"`
	City           string    `json:"city,omitempty"`
	Stage          LeadStage `json:"stage,omitempty"`
	Owner          string    `json:"owner,omitempty"`
	NextActionAt   *string   `json:"nextActionAt,omitempty"`
	LossReason     string    `json:"lossReason,omitempty"`
	EstimatedValue float64   `json:"estimatedValue,omitempty"`
}

// CreateCommercialActivityInput abertura de atendimento comercial
type CreateCommercialActivityInput struct {
	TopicID          int    `json:"topicId"`
	Description      string `json:"description"`
	Responsible      string `json:"responsible,omitempty"`
	SLAForecastHours int    `json:"slaForecastHours,omitempty"`
}

// CreateAssistedContractInput emissão assistida de contrato
type CreateAssistedContractInput struct {
	OriginProspectId int     `json:"originProspectId"`
	ContractNumber   string  `json:"contractNumber,omitempty"`
	CustomerId       int     `json:"customerId"`
	CustomerName     string  `json:"customerName"`
	PlanCode         string  `json:"planCode"`
	PlanDescription  string  `json:"planDescription"`
	SellerName       string  `json:"sellerName"`
	MonthlyValue     float64 `json:"monthlyValue"`
	GrossValue       float64 `json:"grossValue,omitempty"`
	AdhesionValue    float64 `json:"adhesionValue,omitempty"`
	City             string  `json:"city,omitempty"`
	State            string  `json:"state,omitempty"`
	Group            string  `json:"group,omitempty"`
	Technology       string  `json:"technology,omitempty"`
	SalesChannel     string  `json:"salesChannel,omitempty"`
}

// AssistedContractResult retorno da emissão assistida
type AssistedContractResult struct {
	ContractNumber   string `json:"contractNumber"`
	OriginProspectId int    `json:"originProspectId"`
}

// CommercialFilter filtros do dashboard e drilldown
type CommercialFilter struct {
	Period                string   `json:"period"`
	StartDate             string   `json:"startDate"`
	EndDate               string   `json:"endDate"`
	Seller                string   `json:"seller"`
	Sellers               []string `json:"sellers"`
	City                  string   `json:"city"`
	Region                string   `json:"region"`
	Group                 string   `json:"group"`
	ExcludeReasons        []string `json:"excludeReasons"`
	Reasons               []string `json:"reasons"`
	ExcludePlans          []string `json:"excludePlans"`
	Plans                 []string `json:"plans"`
	HideInactiveSellers   bool     `json:"hideInactiveSellers"`
	HideThirdPartySellers bool     `json:"hideThirdPartySellers"`
	HideUnassignedSellers bool     `json:"hideUnassignedSellers"`
}

// DrilldownRecord registro detalhado para auditoria de métrica
type DrilldownRecord struct {
	ID              string  `json:"id"`
	Name            string  `json:"name"`
	Detail          string  `json:"detail"`
	Details         string  `json:"details"`
	Seller          string  `json:"seller"`
	Responsible     string  `json:"responsible"`
	Date            string  `json:"date"`
	Value           float64 `json:"value,omitempty"`
	MonthlyValue    float64 `json:"monthlyValue,omitempty"`
	AdhesionValue   float64 `json:"adhesionValue,omitempty"`
	PlanDescription string  `json:"planDescription,omitempty"`
	City            string  `json:"city,omitempty"`
	Technology      string  `json:"technology,omitempty"`
	SellerType      string  `json:"sellerType,omitempty"`
}

// DrilldownResponse resposta de detalhamento analítico
type DrilldownResponse struct {
	MetricID string            `json:"metricId"`
	Total    int               `json:"total"`
	Records  []DrilldownRecord `json:"records"`
}

// UserContext usuário autenticado que realizou a operação
type UserContext struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Role     string `json:"role"`
}
