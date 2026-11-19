package osanalytics

import (
	"testing"
	"time"

	"evad-backend/internal/rbx"
)

func TestClassifyAbortedMotive(t *testing.T) {
	cases := []struct {
		text     string
		solution string
		expected string
	}{
		{"Cliente ausente no local, ninguém atendeu", "", "Cliente Ausente / Sem Acesso"},
		{"Local fechado e portão trancado", "", "Cliente Ausente / Sem Acesso"},
		{"Inviabilidade técnica, CTO saturada e sem porta", "", "Inviabilidade Técnica / Infra"},
		{"Cliente desistiu da instalação e pediu cancelamento", "", "Cancelamento a Pedido do Cliente"},
		{"Resolvido pelo suporte remoto via telefone", "", "Resolvido pelo Suporte Remoto"},
		{"Cliente pediu para reagendar para sábado", "", "Reagendamento Solicitado"},
		{"Conexão normalizou após reboot da ONU", "", "Conexão Normalizada / Auto-resolvido"},
		{"Abertura incorreta de chamado, fluxo indevido", "", "Abertura Incorreta / Fluxo Indevido"},
		{"Cancelado por motivo diverso da chefia", "", "Cancelamento Operacional / Outros"},
	}

	for _, c := range cases {
		got := ClassifyAbortedMotive(c.text, c.solution)
		if got != c.expected {
			t.Errorf("ClassifyAbortedMotive(%q, %q) = %q, esperado %q", c.text, c.solution, got, c.expected)
		}
	}
}

func TestResolvePeriods(t *testing.T) {
	curStart, curEnd, prevStart, prevEnd := ResolvePeriods("7d", "", "")
	if curEnd.Before(curStart) {
		t.Fatalf("curEnd antes de curStart")
	}
	if !prevEnd.Equal(curStart) {
		t.Fatalf("prevEnd deve ser igual a curStart")
	}
	if prevEnd.Before(prevStart) {
		t.Fatalf("prevEnd antes de prevStart")
	}

	mStart, _, _, _ := ResolvePeriods("month", "", "")
	if mStart.Day() != 1 {
		t.Fatalf("esperado dia 1 para início do mês, obtido: %d", mStart.Day())
	}
}

func TestCalculateOsOverview(t *testing.T) {
	now := time.Now()
	nowStr := now.Format("2006-01-02 15:04:05")
	concludedStr := now.Add(-1 * time.Hour).Format("2006-01-02 15:04:05")
	withinSla := true

	tickets := []rbx.TicketDto{
		{
			ID:                 501,
			Protocol:           "OS-501",
			ClientID:           10,
			ClientName:         "Supermercado Estrela",
			TechnicianID:       1,
			TechnicianName:     "Carlos Silva",
			TopicName:          "Instalação Fibra",
			CauseName:          "Nova Conexão",
			Type:               "Técnico",
			Status:             "Concluído",
			CreatedAt:          now.Add(-3 * time.Hour).Format("2006-01-02 15:04:05"),
			ConcludedAt:        &concludedStr,
			ConcludedWithinSla: &withinSla,
		},
		{
			ID:             502,
			Protocol:       "OS-502",
			ClientID:       20,
			ClientName:     "Padaria Central",
			TechnicianID:   1,
			TechnicianName: "Carlos Silva",
			TopicName:      "Sem Conexão",
			CauseName:      "Rompimento",
			Type:           "Técnico",
			Status:         "Cancelado",
			CreatedAt:      now.Add(-2 * time.Hour).Format("2006-01-02 15:04:05"),
			Description:    "Cliente ausente no endereço",
		},
		{
			ID:             503,
			Protocol:       "OS-503",
			ClientID:       30,
			ClientName:     "Auto Peças Norte",
			TechnicianID:   2,
			TechnicianName: "Mariana Ramos",
			TopicName:      "Troca de Roteador",
			CauseName:      "Upgrade",
			Type:           "Técnico",
			Status:         "Em Andamento",
			CreatedAt:      nowStr,
		},
	}

	occsMap := map[int][]rbx.OcorrenciaDto{
		502: {
			{
				ID:    1,
				Data:  now.Format("2006-01-02 15:04:05"),
				Autor: "Carlos Silva",
				Texto: "Cliente ausente e portão trancado, ninguém respondeu",
			},
		},
	}

	curStart := now.Add(-24 * time.Hour)
	curEnd := now
	prevStart := now.Add(-48 * time.Hour)
	prevEnd := now.Add(-24 * time.Hour)

	overview := CalculateOsOverview(tickets, "today", curStart, curEnd, prevStart, prevEnd, OsFilterParams{}, occsMap)

	if overview.Cards.TotalOs.Value != 3 {
		t.Fatalf("esperado 3 OS criadas, obtido: %d", overview.Cards.TotalOs.Value)
	}
	if overview.Cards.ConcludedOs.Value != 1 {
		t.Fatalf("esperado 1 OS concluída, obtido: %d", overview.Cards.ConcludedOs.Value)
	}
	if overview.Cards.CancelledOs.Value != 1 {
		t.Fatalf("esperado 1 OS cancelada, obtido: %d", overview.Cards.CancelledOs.Value)
	}
	if overview.AbortedAnalysis.TotalAborted != 1 {
		t.Fatalf("esperado 1 OS abortada na análise, obtido: %d", overview.AbortedAnalysis.TotalAborted)
	}
	if len(overview.AbortedAnalysis.Records) != 1 || overview.AbortedAnalysis.Records[0].ClassifiedMotive != "Cliente Ausente / Sem Acesso" {
		t.Fatalf("motivo classificado incorreto: %v", overview.AbortedAnalysis.Records)
	}
	if len(overview.TechniciansRanking) == 0 {
		t.Fatalf("ranking de técnicos não deve estar vazio")
	}
}

func TestFilterTicketList(t *testing.T) {
	now := time.Now()
	tickets := []rbx.TicketDto{
		{
			ID:             1,
			Protocol:       "OS-001",
			Type:           "Técnico",
			Status:         "Concluído",
			TechnicianName: "Carlos Silva",
			CreatedAt:      now.Format("2006-01-02 15:04:05"),
		},
		{
			ID:             2,
			Protocol:       "OS-002",
			Type:           "Comercial", // deve ser ignorado em OS
			Status:         "Concluído",
			TechnicianName: "Carlos Silva",
			CreatedAt:      now.Format("2006-01-02 15:04:05"),
		},
	}

	curStart := now.Add(-24 * time.Hour)
	curEnd := now

	res := FilterTicketList(tickets, OsFilterParams{Page: 1, Limit: 10}, curStart, curEnd)
	if res.Total != 1 || len(res.Tickets) != 1 {
		t.Fatalf("esperado apenas 1 ticket técnico na listagem, obtido: %d", res.Total)
	}
}

func TestCalculateOsOverview_WithFinalizedFlows(t *testing.T) {
	now := time.Now()
	nowStr := now.Format("2006-01-02 15:04:05")

	flowTextRemote := `
/# ### Fluxo finalizado: # ###/ 
/# Tópico:(LOCALIDADE) SERVIÇOS #/
/# Causa:(SOLUÇÃO REMOTA) SOLUÇÃO REALIZADA REMOTAMENTE #/
/# Data/Hora Abertura: 02/11/2026 18:30:07 #/
/# Data/Hora Encerramento: 02/11/2026 18:31:12 #/
/# Usuário: tiago #/
/# Setor/Grupo: Suporte tecnico #/
`

	flowTextField := `
/# ### Fluxo finalizado: # ###/ 
/# Tópico:(LOCALIDADE) SERVIÇOS #/
/# Causa:(MAGALHÃES BARATA) FILIAIS #/
/# Data/Hora Abertura: 03/11/2026 11:48:02 #/
/# Data/Hora Encerramento: 03/11/2026 12:00:00 #/
/# Usuário: gigliane #/
/# Setor/Grupo: Comercial #/

/# ### Fluxo finalizado: # ###/ 
/# Tópico:(SEM INTERNET) SEM INTERNET #/
/# Causa:(Reparo.) Reparo concluido com uso de material #/
/# Data/Hora Abertura: 03/11/2026 12:00:00 #/
/# Data/Hora Encerramento: 03/11/2026 14:00:00 #/
/# Usuário: gol.sb #/
/# Setor/Grupo: Técnico #/
`

	tickets := []rbx.TicketDto{
		{
			ID:          601,
			Protocol:    "OS-601",
			Type:        "Técnico",
			Status:      "Concluído",
			CreatedAt:   now.Add(-2 * time.Hour).Format("2006-01-02 15:04:05"),
			ConcludedAt: &nowStr,
			Description: flowTextRemote,
		},
		{
			ID:          602,
			Protocol:    "OS-602",
			Type:        "Técnico",
			Status:      "Concluído",
			CreatedAt:   now.Add(-1 * time.Hour).Format("2006-01-02 15:04:05"),
			ConcludedAt: &nowStr,
			Description: flowTextField,
		},
	}

	curStart := now.Add(-24 * time.Hour)
	curEnd := now
	prevStart := now.Add(-48 * time.Hour)
	prevEnd := now.Add(-24 * time.Hour)

	overview := CalculateOsOverview(tickets, "today", curStart, curEnd, prevStart, prevEnd, OsFilterParams{}, nil)

	if overview.Cards.TotalOs.Value != 2 {
		t.Fatalf("esperado 2 OS, obtido: %d", overview.Cards.TotalOs.Value)
	}
	if overview.Cards.RemoteResolutions.Value != 1 {
		t.Fatalf("esperado 1 OS com solução remota, obtido: %d", overview.Cards.RemoteResolutions.Value)
	}
	if overview.Cards.FieldWork.Value != 1 {
		t.Fatalf("esperado 1 OS com atendimento em campo, obtido: %d", overview.Cards.FieldWork.Value)
	}
	if overview.Cards.TotalFlows.Value != 3 {
		t.Fatalf("esperado 3 fluxos no total, obtido: %d", overview.Cards.TotalFlows.Value)
	}

	// Filtra por Solução Remota
	resRemote := FilterTicketList(tickets, OsFilterParams{FlowType: "Solução Remota", Page: 1, Limit: 10}, curStart, curEnd)
	if resRemote.Total != 1 || resRemote.Tickets[0].ID != 601 {
		t.Fatalf("esperado apenas ticket 601 para filtro de Solução Remota, obtido: %d", resRemote.Total)
	}

	// Filtra por Localidade Magalhães Barata
	resLoc := FilterTicketList(tickets, OsFilterParams{Locality: "Magalhães Barata", Page: 1, Limit: 10}, curStart, curEnd)
	if resLoc.Total != 1 || resLoc.Tickets[0].ID != 602 {
		t.Fatalf("esperado apenas ticket 602 para filtro de Localidade, obtido: %d", resLoc.Total)
	}

	// Valida que os cards de TopTopics e TopCauses refletem demandas técnicas reais
	hasSemInternet := false
	for _, top := range overview.TopTopics {
		if top.Name == "Sem Internet / Conexão" {
			hasSemInternet = true
		}
		if top.Name == "(SUPERVISÃO TÉCNICA) SUPERVISÃO DE ATENDIMENTO" || top.Name == "(FEEDBACK C/ CLIENTE) FEEDBACK" {
			t.Errorf("Card de Tópicos contém etapa administrativa vazada: %q", top.Name)
		}
	}
	if !hasSemInternet {
		t.Errorf("TopTopics deveria conter 'Sem Internet / Conexão', obtido: %v", overview.TopTopics)
	}

	hasReparoMaterial := false
	hasSolucaoRemota := false
	for _, cause := range overview.TopCauses {
		if cause.Name == "Reparo com uso de material" {
			hasReparoMaterial = true
		}
		if cause.Name == "Solução Remota Realizada" {
			hasSolucaoRemota = true
		}
		if cause.Name == "(Supervisão OK ) Supervisão realizada" || cause.Name == "(Feedback Realizado Com Sucesso) Feedback" {
			t.Errorf("Card de Causas contém etapa administrativa vazada: %q", cause.Name)
		}
	}
	if !hasReparoMaterial {
		t.Errorf("TopCauses deveria conter 'Reparo com uso de material', obtido: %v", overview.TopCauses)
	}
	if !hasSolucaoRemota {
		t.Errorf("TopCauses deveria conter 'Solução Remota Realizada', obtido: %v", overview.TopCauses)
	}
}
