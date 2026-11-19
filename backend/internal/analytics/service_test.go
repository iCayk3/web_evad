package analytics

import (
	"strings"
	"testing"
	"time"

	"evad-backend/internal/rbx"
)

func TestResolvePeriods(t *testing.T) {
	cur, prev, curStart, curEnd, prevStart, prevEnd := ResolvePeriods("7d", "", "")

	if curEnd.Before(curStart) {
		t.Fatalf("curEnd (%v) deve ser posterior a curStart (%v)", curEnd, curStart)
	}
	if prevEnd.Before(prevStart) {
		t.Fatalf("prevEnd (%v) deve ser posterior a prevStart (%v)", prevEnd, prevStart)
	}
	if !prevEnd.Equal(curStart) {
		t.Fatalf("prevEnd (%v) deve ser igual a curStart (%v)", prevEnd, curStart)
	}
	if cur.Type != "7d" || prev.Type != "7d" {
		t.Fatalf("tipos de período incorretos: %s, %s", cur.Type, prev.Type)
	}
}

func TestCalculateOverview(t *testing.T) {
	now := time.Now()
	nowStr := now.Format("2006-01-02 15:04:05")
	concludedStr := now.Add(-1 * time.Hour).Format("2006-01-02 15:04:05")
	withinSla := true

	tickets := []rbx.TicketDto{
		{
			ID:                 101,
			Protocol:           "ATD-101",
			ClientID:           1,
			ClientName:         "Cliente Alpha",
			TechnicianID:       1,
			TechnicianName:     "Carlos Silva",
			TopicName:          "Sem Conexão",
			CauseName:          "Fibra Rompida",
			Type:               "Técnico",
			Status:             "Aberto",
			CreatedAt:          nowStr,
			SlaStatus:          rbx.SlaStatusOk,
			IsOverdue:          false,
			IsAtRisk:           false,
		},
		{
			ID:                 102,
			Protocol:           "ATD-102",
			ClientID:           1,
			ClientName:         "Cliente Alpha",
			TechnicianID:       1,
			TechnicianName:     "Carlos Silva",
			TopicName:          "Sem Conexão",
			CauseName:          "Fibra Rompida",
			Type:               "Técnico",
			Status:             "Aberto",
			CreatedAt:          nowStr,
			SlaStatus:          rbx.SlaStatusOverdue,
			IsOverdue:          true,
			IsAtRisk:           false,
		},
		{
			ID:                 103,
			Protocol:           "ATD-103",
			ClientID:           1,
			ClientName:         "Cliente Alpha",
			TechnicianID:       2,
			TechnicianName:     "Mariana Ramos",
			TopicName:          "Lentidão",
			CauseName:          "Atenuação Alta",
			Type:               "Técnico",
			Status:             "Aberto",
			CreatedAt:          nowStr,
			SlaStatus:          rbx.SlaStatusRisk,
			IsOverdue:          false,
			IsAtRisk:           true,
		},
		{
			ID:                 104,
			Protocol:           "ATD-104",
			ClientID:           2,
			ClientName:         "Cliente Beta",
			TechnicianID:       1,
			TechnicianName:     "Carlos Silva",
			TopicName:          "Sem Conexão",
			CauseName:          "Fibra Rompida",
			Type:               "Técnico",
			Status:             "Concluído",
			CreatedAt:          now.Add(-2 * time.Hour).Format("2006-01-02 15:04:05"),
			ConcludedAt:        &concludedStr,
			ConcludedWithinSla: &withinSla,
			SlaStatus:          rbx.SlaStatusOk,
			IsOverdue:          false,
		},
	}

	curStart := now.Add(-24 * time.Hour)
	curEnd := now
	prevStart := now.Add(-48 * time.Hour)
	prevEnd := now.Add(-24 * time.Hour)

	overview := CalculateOverview(tickets, "today", curStart, curEnd, prevStart, prevEnd, FilterParams{})

	// Validação dos 7 cards
	if card, ok := overview.Cards["atendimentos_abertos"]; !ok || card.NumericValue != 3 {
		t.Fatalf("esperado 3 atendimentos abertos, obtido: %v", card.NumericValue)
	}
	if card, ok := overview.Cards["sla_vencido"]; !ok || card.NumericValue != 1 {
		t.Fatalf("esperado 1 sla vencido, obtido: %v", card.NumericValue)
	}
	if card, ok := overview.Cards["sla_em_risco"]; !ok || card.NumericValue != 1 {
		t.Fatalf("esperado 1 sla em risco, obtido: %v", card.NumericValue)
	}
	if card, ok := overview.Cards["entradas_periodo"]; !ok || card.NumericValue != 4 {
		t.Fatalf("esperado 4 entradas no período, obtido: %v", card.NumericValue)
	}
	if card, ok := overview.Cards["concluidos_periodo"]; !ok || card.NumericValue != 1 {
		t.Fatalf("esperado 1 concluído no período, obtido: %v", card.NumericValue)
	}
	if card, ok := overview.Cards["taxa_cumprimento_sla"]; !ok || card.NumericValue != 100 {
		t.Fatalf("esperado taxa de sla 100%%, obtido: %v", card.NumericValue)
	}
	if card, ok := overview.Cards["clientes_com_recorrencia"]; !ok || card.NumericValue != 1 {
		t.Fatalf("esperado 1 cliente com recorrência (Alpha tem 3 chamados), obtido: %v", card.NumericValue)
	}

	// Validação de séries temporais
	if len(overview.TimeSeries) != 7 {
		t.Fatalf("esperado 7 pontos de série temporal, obtido: %d", len(overview.TimeSeries))
	}

	// Validação de tópicos e causas
	if len(overview.TopTopics) == 0 || overview.TopTopics[0].Name != "Sem Conexão" {
		t.Fatalf("tópico principal incorreto: %v", overview.TopTopics)
	}

	// Validação da matriz cruzada
	if len(overview.CrossMatrix.Rows) == 0 {
		t.Fatalf("linhas da matriz não deveriam estar vazias")
	}
}

func TestDrillDownAndExport(t *testing.T) {
	now := time.Now()
	nowStr := now.Format("2006-01-02 15:04:05")

	tickets := []rbx.TicketDto{
		{
			ID:             201,
			Protocol:       "ATD-201",
			ClientID:       10,
			ClientName:     "Supermercado Estrela",
			TechnicianName: "Roberto Dias",
			TopicName:      "Sem Conexão",
			CauseName:      "ONU Queimada",
			Status:         "Aberto",
			CreatedAt:      nowStr,
			IsOverdue:      true,
			SlaStatus:      rbx.SlaStatusOverdue,
		},
	}

	curStart := now.Add(-24 * time.Hour)
	curEnd := now

	drilldown := FilterDrillDownTickets(tickets, "sla_vencido", "", curStart, curEnd, FilterParams{})
	if len(drilldown) != 1 || drilldown[0].ID != 201 {
		t.Fatalf("drilldown incorreto: %v", drilldown)
	}

	csv := ExportCSV(drilldown, "sla_vencido", "", "Admin Master", "admin", "admin")
	if !strings.Contains(csv, "Supermercado Estrela") || !strings.Contains(csv, "ATD-201") {
		t.Fatalf("CSV não contém os dados esperados: %s", csv)
	}
}
