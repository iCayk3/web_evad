package omnichannel

import (
	"testing"
	"time"
)

func TestBuildCustomerHealth_CriticalAndRecurrent(t *testing.T) {
	now := time.Now()
	start := now.Add(-30 * 24 * time.Hour)
	end := now

	cid1 := "1001"
	cid2 := "1002"

	contacts := []HealthContact{
		{
			ID:             "c1",
			ConversationID: "conv_1",
			ClientID:       &cid1,
			Confirmed:      true,
			Name:           "Cliente Alpha",
			StartedAt:      now.Add(-2 * 24 * time.Hour),
			InitiatedBy:    "cliente",
			Causes:         []string{"Sem Conexão"},
		},
		{
			ID:             "c2",
			ConversationID: "conv_2",
			ClientID:       &cid1,
			Confirmed:      true,
			Name:           "Cliente Alpha",
			StartedAt:      now.Add(-1 * 24 * time.Hour),
			InitiatedBy:    "cliente",
			Causes:         []string{"Sem Conexão"},
		},
		{
			ID:             "c3",
			ConversationID: "conv_3",
			ClientID:       &cid2,
			Confirmed:      true,
			Name:           "Cliente Beta",
			StartedAt:      now.Add(-10 * 24 * time.Hour),
			InitiatedBy:    "cliente",
			Causes:         []string{"Lentidão"},
		},
	}

	dueAtPast := now.Add(-12 * time.Hour)
	tickets := []HealthTicket{
		{
			ID:       "t1",
			ClientID: cid1,
			Protocol: "ATD-1",
			OpenedAt: now.Add(-24 * time.Hour),
			DueAt:    &dueAtPast,
			Cause:    "Sem Conexão",
			Status:   "Aberto",
		},
	}

	regAt := now.Add(-365 * 24 * time.Hour)
	profiles := []HealthProfile{
		{
			ID:           cid1,
			Name:         "Cliente Alpha",
			RegisteredAt: &regAt,
			City:         "São João de Pirabas",
			Plan:         "Fibra 500M",
		},
		{
			ID:           cid2,
			Name:         "Cliente Beta",
			RegisteredAt: &regAt,
			City:         "Quatipuru",
			Plan:         "Fibra 300M",
		},
	}

	opts := HealthOptions{
		Start:     start,
		End:       end,
		Threshold: 2,
		OldMonths: 6,
	}

	resp := BuildCustomerHealth(contacts, tickets, profiles, opts)

	if len(resp.Clients) != 2 {
		t.Fatalf("esperado 2 clientes avaliados, obtido: %d", len(resp.Clients))
	}

	// Cliente Alpha deve ser CRÍTICO (recorrente com 2 contatos e ticket vencido da mesma causa "Sem Conexão")
	alpha := resp.Clients[0]
	if alpha.ID != cid1 {
		t.Fatalf("primeiro cliente esperado: Alpha, obtido: %s", alpha.ID)
	}
	if alpha.Priority != PriorityCritical {
		t.Errorf("prioridade esperada para Alpha: critical, obtido: %s", alpha.Priority)
	}
	if !alpha.Recurrent {
		t.Errorf("esperado recorrente = true para Alpha")
	}

	// Beta deve ser insuficiente ou neutro (1 contato fora da janela de 7 dias)
	beta := resp.Clients[1]
	if beta.Priority != PriorityInsufficient {
		t.Errorf("prioridade esperada para Beta: insufficient, obtido: %s", beta.Priority)
	}

	if resp.Summary.ObservedClients != 2 {
		t.Errorf("resumo observado incorreto: %d", resp.Summary.ObservedClients)
	}
	if resp.Summary.HighPriority < 1 {
		t.Errorf("esperado pelo menos 1 cliente em alta prioridade")
	}
}
