package analytics

import (
	"evad-backend/internal/rbx"
)

// AnalyticsPeriod representa um período delimitado de datas analíticas
type AnalyticsPeriod struct {
	Type      string `json:"type"`      // 'today', '7d', '30d', 'custom'
	StartDate string `json:"startDate"` // ISO-8601
	EndDate   string `json:"endDate"`   // ISO-8601
}

// MetricCardResult representa um cartão de KPI com comparativo e rastreabilidade
type MetricCardResult struct {
	ID            string      `json:"id"`
	Name          string      `json:"name"`
	Value         interface{} `json:"value"`
	NumericValue  float64     `json:"numericValue"`
	PreviousValue *float64    `json:"previousValue"`
	ChangePercent *float64    `json:"changePercent"`
	Definition    string      `json:"definition"`
	Coverage      int         `json:"coverage"`
	Status        string      `json:"status"` // 'ok', 'partial', 'insufficient_data'
	DrilldownID   string      `json:"drilldownId"`
	Unit          string      `json:"unit,omitempty"`
}

// TimeSeriesPoint ponto de evolução temporal da fila de atendimento
type TimeSeriesPoint struct {
	Date          string `json:"date"`
	Label         string `json:"label"` // 'DD/MM'
	Entradas      int    `json:"entradas"`
	Concluidos    int    `json:"concluidos"`
	EstoqueAberto int    `json:"estoqueAberto"`
}

// StatusCount contagem e percentual por status
type StatusCount struct {
	Status     string `json:"status"`
	Count      int    `json:"count"`
	Percentage int    `json:"percentage"`
}

// SlaCount contagem e percentual por faixa de SLA
type SlaCount struct {
	SlaStatus  string `json:"slaStatus"`
	Count      int    `json:"count"`
	Percentage int    `json:"percentage"`
}

// QueueDistribution distribuição agregada da fila ativa
type QueueDistribution struct {
	ByStatus []StatusCount `json:"byStatus"`
	BySla    []SlaCount    `json:"bySla"`
}

// TopTopicItem item do ranking de tópicos de demanda
type TopTopicItem struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	Total             int    `json:"total"`
	OverdueCount      int    `json:"overdueCount"`
	OverduePercentage int    `json:"overduePercentage"`
}

// TopCauseItem item do ranking de causas raiz
type TopCauseItem struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	Total             int    `json:"total"`
	OverdueCount      int    `json:"overdueCount"`
	OverduePercentage int    `json:"overduePercentage"`
}

// AvailableTopic metadado de tópicos presentes para filtros de UI
type AvailableTopic struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// AvailableType metadado de tipos de chamados presentes para filtros de UI
type AvailableType struct {
	Type  string `json:"type"`
	Count int    `json:"count"`
}

// TechnicianWorkload distribuição de chamados por técnico
type TechnicianWorkload struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	OpenAssigned int    `json:"openAssigned"`
	Concluded    int    `json:"concluded"`
	Overdue      int    `json:"overdue"`
}

// MatrixRow linha da matriz de cruzamento
type MatrixRow struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

// MatrixCol coluna da matriz de cruzamento
type MatrixCol struct {
	Key   string `json:"key"`
	Label string `json:"label"`
}

// MatrixCell célula da matriz com contagem e IDs para drill-down imediato
type MatrixCell struct {
	Count     int    `json:"count"`
	CellKey   string `json:"cellKey"`
	TicketIDs []int  `json:"ticketIds"`
}

// CrossMatrix matriz bidimensional Tópico × Situação/SLA
type CrossMatrix struct {
	Rows    []MatrixRow           `json:"rows"`
	Columns []MatrixCol           `json:"columns"`
	Cells   map[string]MatrixCell `json:"cells"`
}

// OverviewAnalyticsResponse resposta consolidada do endpoint GET /api/analytics/overview
type OverviewAnalyticsResponse struct {
	Period             AnalyticsPeriod             `json:"period"`
	PreviousPeriod     AnalyticsPeriod             `json:"previousPeriod"`
	UpdatedAt          string                      `json:"updatedAt"`
	Timezone           string                      `json:"timezone"`
	Cards              map[string]MetricCardResult `json:"cards"`
	TimeSeries         []TimeSeriesPoint           `json:"timeSeries"`
	QueueDistribution  QueueDistribution           `json:"queueDistribution"`
	TopTopics          []TopTopicItem              `json:"topTopics"`
	TopCauses          []TopCauseItem              `json:"topCauses"`
	AvailableTopics    []AvailableTopic            `json:"availableTopics"`
	AvailableTypes     []AvailableType             `json:"availableTypes"`
	TechnicianWorkload []TechnicianWorkload        `json:"technicianWorkload"`
	CrossMatrix        CrossMatrix                 `json:"crossMatrix"`
}

// FilterParams parâmetros de filtro aplicáveis à visão analítica
type FilterParams struct {
	TechnicianID int
	Topic        string
	Topics       []string
	Type         string
	CauseID      int
}

// DrillDownResponse resposta estruturada de drill-down
type DrillDownResponse struct {
	MetricID string          `json:"metricId"`
	CellKey  string          `json:"cellKey,omitempty"`
	Total    int             `json:"total"`
	Tickets  []rbx.TicketDto `json:"tickets"`
}

// MetricDefinition especificação do catálogo de métricas
type MetricDefinition struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	Version          string   `json:"version"`
	DecisionSupported string   `json:"decisionSupported"`
	BusinessQuestion string   `json:"businessQuestion"`
	Formula          string   `json:"formula"`
	SourceService    string   `json:"sourceService"`
	SourceFields     []string `json:"sourceFields"`
	MissingDataRule  string   `json:"missingDataRule"`
	Limitations      string   `json:"limitations"`
}

// MetricsCatalog catálogo oficial versionado
var MetricsCatalog = map[string]MetricDefinition{
	"atendimentos_abertos": {
		ID:               "atendimentos_abertos",
		Name:             "Atendimentos Abertos",
		Version:          "1.0.0",
		BusinessQuestion: "Quantos atendimentos demandam ação da equipe neste momento?",
		DecisionSupported: "Dimensionamento da equipe de campo e priorização imediata da fila.",
		Formula:          `COUNT(atendimentos WHERE situacao IN ("Aberto", "Em Andamento", "Pendente"))`,
		SourceService:    "ConsultaAtendimentos",
		SourceFields:     []string{"id_atendimento", "situacao"},
		MissingDataRule:  "Se situação não for informada, o registro não é contabilizado no estoque ativo.",
		Limitations:      "Não reflete histórico fechado; representa o snapshot pontual da fila.",
	},
	"sla_vencido": {
		ID:               "sla_vencido",
		Name:             "Atendimentos com SLA Vencido",
		Version:          "1.0.0",
		BusinessQuestion: "Onde o compromisso contratual com o cliente já foi violado?",
		DecisionSupported: "Escalonamento urgente para supervisão e prioridade máxima de despacho.",
		Formula:          `COUNT(atendimentos WHERE situacao IN ("Aberto", "Em Andamento", "Pendente") AND NOW() > data_previsao_sla)`,
		SourceService:    "ConsultaAtendimentos",
		SourceFields:     []string{"situacao", "data_previsao_sla"},
		MissingDataRule:  "Registros sem data_previsao_sla são marcados como não mensuráveis e não entram na contagem.",
		Limitations:      "Depende da precisão do cadastro do grupo de SLA e fuso horário operacional.",
	},
	"sla_em_risco": {
		ID:               "sla_em_risco",
		Name:             "Atendimentos com SLA em Risco",
		Version:          "1.0.0",
		BusinessQuestion: "Quais chamados estão a menos de 60 minutos de estourar o prazo?",
		DecisionSupported: "Atuação preventiva antes do descumprimento do acordo de nível de serviço.",
		Formula:          `COUNT(atendimentos WHERE situacao IN ("Aberto", "Em Andamento", "Pendente") AND NOW() <= data_previsao_sla AND (data_previsao_sla - NOW()) <= SLA_RISK_WINDOW_MINUTES)`,
		SourceService:    "ConsultaAtendimentos",
		SourceFields:     []string{"situacao", "data_previsao_sla"},
		MissingDataRule:  "Requer data de previsão válida.",
		Limitations:      "Janela configurável (padrão 60 min). Não prevê imprevistos de trânsito ou clima.",
	},
	"entradas_periodo": {
		ID:               "entradas_periodo",
		Name:             "Entradas de Atendimentos no Período",
		Version:          "1.0.0",
		BusinessQuestion: "Qual o volume de novas demandas abertas pelos clientes no período filtrado?",
		DecisionSupported: "Medição da pressão de demanda sobre o ISP e capacidade de atendimento.",
		Formula:          "COUNT(atendimentos WHERE data_cadastro >= inicio_periodo AND data_cadastro <= fim_periodo)",
		SourceService:    "ConsultaAtendimentos",
		SourceFields:     []string{"data_cadastro"},
		MissingDataRule:  "Ignora registros sem data de abertura válida.",
		Limitations:      "Não distingue atendimento único de reabertura sem a causa raiz informada.",
	},
	"concluidos_periodo": {
		ID:               "concluidos_periodo",
		Name:             "Atendimentos Concluídos no Período",
		Version:          "1.0.0",
		BusinessQuestion: "Quantos chamados a equipe conseguiu finalizar e entregar com sucesso?",
		DecisionSupported: "Avaliação da vazão operacional e produtividade das equipes.",
		Formula:          `COUNT(atendimentos WHERE situacao = "Concluído" AND data_conclusao >= inicio_periodo AND data_conclusao <= fim_periodo)`,
		SourceService:    "ConsultaAtendimentos",
		SourceFields:     []string{"situacao", "data_conclusao"},
		MissingDataRule:  "Atendimentos concluídos sem data de conclusão usam data da última ocorrência ou são marcados como incompletos.",
		Limitations:      "Não avalia satisfação pós-atendimento (NPS/CSAT), apenas a conclusão técnica.",
	},
	"taxa_cumprimento_sla": {
		ID:               "taxa_cumprimento_sla",
		Name:             "Taxa de Cumprimento de SLA",
		Version:          "1.0.0",
		BusinessQuestion: "Qual o percentual de chamados finalizados dentro do prazo acordado?",
		DecisionSupported: "Avaliação do nível de serviço global da operação e qualidade do suporte.",
		Formula:          "(COUNT(concluidos WHERE concluido_no_sla = true) / COUNT(concluidos WHERE sla_mensuravel = true)) * 100",
		SourceService:    "ConsultaAtendimentos",
		SourceFields:     []string{"data_conclusao", "data_previsao_sla", "concluido_no_sla"},
		MissingDataRule:  "Chamados sem prazo contratual mensurável são excluídos do denominador.",
		Limitations:      "Exige consistência no fechamento de chamado pelo técnico em campo.",
	},
	"clientes_com_recorrencia": {
		ID:               "clientes_com_recorrencia",
		Name:             "Clientes com Recorrência no Período",
		Version:          "1.0.0",
		BusinessQuestion: "Quantos clientes abriram 3 ou mais atendimentos no período analisado?",
		DecisionSupported: "Detecção precoce de churn e instabilidade crônica de acesso (FTTH/Rádio).",
		Formula:          "COUNT(DISTINCT cliente_id WHERE total_atendimentos_periodo >= RECURRENCE_THRESHOLD)",
		SourceService:    "ConsultaAtendimentos",
		SourceFields:     []string{"id_cliente", "data_cadastro"},
		MissingDataRule:  "Clientes não identificados são desconsiderados do indicador de reincidência.",
		Limitations:      "Threshold configurável (padrão >= 3). Não analisa sentimento de chat.",
	},
}
