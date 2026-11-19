package rbx

import (
	"strings"
	"testing"
)

func TestFilterBuilder_AntiSqlInjection(t *testing.T) {
	fb := DefaultFilterBuilder

	maliciousStrings := []string{
		"admin'; DROP TABLE usuarios; --",
		"1 UNION SELECT * FROM atendimentos",
		"' OR 1=1 --",
		"normal/*comment*/text",
		"test; SELECT * FROM clientes",
		"' OR 'a'='a",
		"teste OR true",
	}

	for _, mal := range maliciousStrings {
		_, err := fb.SanitizeString(mal, 100)
		if err == nil {
			t.Errorf("Esperava erro de segurança para payload malicioso: %s, mas passou!", mal)
		}
	}
}

func TestFilterBuilder_BuildTicketFilter(t *testing.T) {
	fb := DefaultFilterBuilder

	filters := TicketFilters{
		Period: &struct {
			Start string `json:"start"`
			End   string `json:"end"`
			Field string `json:"field,omitempty"`
		}{
			Start: "2026-11-01",
			End:   "2026-11-06 23:59:59",
			Field: "data_conclusao",
		},
		Statuses:      []string{"Aberto", "Em Andamento"},
		TechnicianIDs: []int{10, 25},
		TopicIDs:      []int{5, 135},
	}

	clause, err := fb.BuildTicketFilter(filters)
	if err != nil {
		t.Fatalf("Erro inesperado ao gerar cláusula: %v", err)
	}

	expectedParts := []string{
		"data_conclusao >= '2026-11-01 00:00:00' AND data_conclusao <= '2026-11-06 23:59:59'",
		"situacao IN ('Aberto', 'Em Andamento')",
		"id_tecnico IN (10, 25)",
		"id_topico IN (5, 135)",
	}

	for _, part := range expectedParts {
		if !strings.Contains(clause, part) {
			t.Errorf("Cláusula gerada não contém a parte esperada: %s\nGerado: %s", part, clause)
		}
	}
}

func TestFilterBuilder_InvalidStatus(t *testing.T) {
	fb := DefaultFilterBuilder

	filters := TicketFilters{
		Statuses: []string{"HACKED_STATUS"},
	}

	_, err := fb.BuildTicketFilter(filters)
	if err == nil {
		t.Error("Esperava erro para status não permitido, mas retornou sucesso!")
	}
}
