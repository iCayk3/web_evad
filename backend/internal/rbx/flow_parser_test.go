package rbx

import (
	"testing"
)

func TestParseFinalizedFlows_UserSample(t *testing.T) {
	sample := `
/# ### Fluxo finalizado: # ###/ 
/# Tópico:(LOCALIDADE) SERVIÇOS #/
/# Causa:(SOLUÇÃO REMOTA) SOLUÇÃO REALIZADA REMOTAMENTE #/
/# Data/Hora Abertura: 02/11/2026 18:30:07 #/
/# Data/Hora Encerramento: 02/11/2026 18:31:12 #/
/# Usuário: tiago #/
/# Setor/Grupo: Suporte tecnico #/
Entrar em contato c/ cliente
`
	flows := ParseFinalizedFlows(sample)
	if len(flows) != 1 {
		t.Fatalf("Esperado 1 fluxo, obtido %d", len(flows))
	}

	f := flows[0]
	if f.TopicRaw != "(LOCALIDADE) SERVIÇOS" {
		t.Errorf("TopicRaw inesperado: %q", f.TopicRaw)
	}
	if f.TopicPrefix != "LOCALIDADE" || f.TopicName != "SERVIÇOS" {
		t.Errorf("TopicPrefix/TopicName incorreto: %q / %q", f.TopicPrefix, f.TopicName)
	}
	if f.CauseRaw != "(SOLUÇÃO REMOTA) SOLUÇÃO REALIZADA REMOTAMENTE" {
		t.Errorf("CauseRaw inesperado: %q", f.CauseRaw)
	}
	if f.CausePrefix != "SOLUÇÃO REMOTA" || f.CauseName != "SOLUÇÃO REALIZADA REMOTAMENTE" {
		t.Errorf("CausePrefix/CauseName incorreto: %q / %q", f.CausePrefix, f.CauseName)
	}
	if f.User != "tiago" {
		t.Errorf("Usuário incorreto: %q", f.User)
	}
	if f.Sector != "Suporte tecnico" {
		t.Errorf("Setor incorreto: %q", f.Sector)
	}
	if f.FlowType != "Solução Remota" {
		t.Errorf("FlowType incorreto: %q, esperado 'Solução Remota'", f.FlowType)
	}
	if f.DurationFormatted != "1m 5s" && f.DurationFormatted != "1m" {
		t.Errorf("DurationFormatted inesperado: %q", f.DurationFormatted)
	}
	if f.ActionNote != "Entrar em contato c/ cliente" {
		t.Errorf("ActionNote inesperado: %q", f.ActionNote)
	}
}

func TestParseFinalizedFlows_MultiStage(t *testing.T) {
	raw := `
/# ### Fluxo finalizado: # ###/ 
/# Tópico:(LOCALIDADE) SERVIÇOS #/
/# Causa:(PIRABAS - SJP) MATRIZ #/
/# Data/Hora Abertura: 03/11/2026 07:43:48 #/
/# Data/Hora Encerramento: 03/11/2026 07:45:32 #/
/# Usuário: caua #/
/# Setor/Grupo: Suporte tecnico #/

/# ###  Fluxo finalizado: # ###/ 
/#  Tópico: (SEM INTERNET) SEM INTERNET #/
/#  Causa: (Reparo.) Reparo concluido sem uso de material #/
/#  Data/Hora Abertura: 03/11/2026 07:45:32 #/
/#  Data/Hora Encerramento: 03/11/2026 12:37:28 #/
/#  Usuário: gol.sb #/
/# Setor/Grupo: Técnico #/

/# ### Fluxo finalizado: # ###/ 
/# Tópico:(FEEDBACK C/ CLIENTE) FEEDBACK #/
/# Causa:(Feedback Realizado Com Sucesso) Feedback #/
/# Data/Hora Abertura: 03/11/2026 12:37:28 #/
/# Data/Hora Encerramento: 05/11/2026 09:37:49 #/
/# Usuário: caua #/
/# Setor/Grupo: Suporte tecnico #/
`
	flows := ParseFinalizedFlows(raw)
	if len(flows) != 3 {
		t.Fatalf("Esperado 3 fluxos, obtido %d", len(flows))
	}

	// Fluxo 1: Triagem / Roteamento com localidade SJP
	if flows[0].Locality != "São José dos Pinhais (SJP)" {
		t.Errorf("Locality fluxo 1 incorreto: %q", flows[0].Locality)
	}
	if flows[0].FlowType != "Triagem / Roteamento" {
		t.Errorf("FlowType fluxo 1 incorreto: %q", flows[0].FlowType)
	}

	// Fluxo 2: Atendimento de campo presencial
	if flows[1].FlowType != "Presencial / Campo" {
		t.Errorf("FlowType fluxo 2 incorreto: %q", flows[1].FlowType)
	}
	if flows[1].User != "gol.sb" {
		t.Errorf("Usuário fluxo 2 incorreto: %q", flows[1].User)
	}

	// Fluxo 3: Feedback
	if flows[2].FlowType != "Supervisão / Feedback" {
		t.Errorf("FlowType fluxo 3 incorreto: %q", flows[2].FlowType)
	}

	// Teste de enriquecimento do TicketDto
	ticket := &TicketDto{
		Description: raw,
		Status:      "Concluído",
	}
	EnrichTicketWithFlows(ticket)

	if len(ticket.FinalizedFlows) != 3 {
		t.Errorf("FinalizedFlows len incorreto: %d", len(ticket.FinalizedFlows))
	}
	if !ticket.HasFieldWork {
		t.Errorf("HasFieldWork esperado true")
	}
	if ticket.PrimaryLocality != "São José dos Pinhais (SJP)" {
		t.Errorf("PrimaryLocality inesperado: %q", ticket.PrimaryLocality)
	}
	if ticket.RealTopic != "Sem Internet / Conexão" {
		t.Errorf("RealTopic inesperado: %q, esperado 'Sem Internet / Conexão'", ticket.RealTopic)
	}
	if ticket.RealCause != "Reparo sem uso de material" {
		t.Errorf("RealCause inesperado: %q, esperado 'Reparo sem uso de material'", ticket.RealCause)
	}
	if ticket.TopicName != "Sem Internet / Conexão" {
		t.Errorf("TopicName substituído incorreto: %q", ticket.TopicName)
	}
	if ticket.CauseName != "Reparo sem uso de material" {
		t.Errorf("CauseName substituído incorreto: %q", ticket.CauseName)
	}
}

func TestResolveRealTopicAndCause_AdministrativeBypass(t *testing.T) {
	// Chamado onde o RBX gravou o rótulo da supervisão e feedback
	ticket := TicketDto{
		TopicName: "(SUPERVISÃO TÉCNICA) SUPERVISÃO DE ATENDIMENTO",
		CauseName: "(Supervisão OK ) Supervisão realizada",
		Status:    "Concluído",
		Description: `Cliente relatou lentidão nos horários de pico
/# ### Fluxo finalizado: # ###/ 
/# Tópico:(LOCALIDADE) SERVIÇOS #/
/# Causa:(SOLUÇÃO REMOTA) SOLUÇÃO REALIZADA REMOTAMENTE #/
/# Data/Hora Abertura: 02/11/2026 18:30:07 #/
/# Data/Hora Encerramento: 02/11/2026 18:31:12 #/
/# Usuário: tiago #/
/# Setor/Grupo: Suporte tecnico #/
/# ### Fluxo finalizado: # ###/ 
/# Tópico:(FEEDBACK C/ CLIENTE) FEEDBACK #/
/# Causa:(Feedback Realizado Com Sucesso) Feedback #/
/# Data/Hora Abertura: 02/11/2026 18:31:12 #/
/# Data/Hora Encerramento: 04/11/2026 14:11:07 #/
/# Usuário: tiago #/
/# Setor/Grupo: Suporte tecnico #/
`,
		Solution: "Mudei o MTU e canais de Wi-Fi para 5GHz. Conexão normalizada.",
	}

	EnrichTicketWithFlows(&ticket)

	if ticket.RealTopic != "Lentidão na Navegação" {
		t.Errorf("RealTopic esperado 'Lentidão na Navegação', obtido: %q", ticket.RealTopic)
	}
	if ticket.RealCause != "Solução Remota Realizada" {
		t.Errorf("RealCause esperado 'Solução Remota Realizada', obtido: %q", ticket.RealCause)
	}
	if ticket.TopicName != "Lentidão na Navegação" {
		t.Errorf("TopicName esperado 'Lentidão na Navegação', obtido: %q", ticket.TopicName)
	}
	if ticket.CauseName != "Solução Remota Realizada" {
		t.Errorf("CauseName esperado 'Solução Remota Realizada', obtido: %q", ticket.CauseName)
	}
}
