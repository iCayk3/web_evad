package crm

import (
	"context"
	"strings"
	"testing"
	"time"

	"evad-backend/internal/rbx"
)

func TestGetLeads_PaginationAndCRMEnrichment(t *testing.T) {
	ctx := context.Background()
	res, err := GetLeads(ctx, GetLeadsFilter{Page: 1, Limit: 10})
	if err != nil {
		t.Fatalf("Erro inesperado ao listar leads: %v", err)
	}

	if len(res.Leads) == 0 {
		t.Fatalf("Deve retornar ao menos um lead mock")
	}
	if res.Total < len(res.Leads) {
		t.Errorf("Total (%d) deve ser >= quantidade retornada (%d)", res.Total, len(res.Leads))
	}
	if res.Page != 1 {
		t.Errorf("Página esperada 1, recebida %d", res.Page)
	}

	first := res.Leads[0]
	if first.ID <= 0 {
		t.Errorf("Lead deve ter ID numérico válido, recebido %d", first.ID)
	}
	if first.Name == "" {
		t.Errorf("Lead deve ter nome preenchido")
	}

	validStages := map[LeadStage]bool{
		LeadStageNew:         true,
		LeadStageQualified:   true,
		LeadStageProposal:    true,
		LeadStageNegotiation: true,
		LeadStageWon:         true,
		LeadStageLost:        true,
	}
	if !validStages[first.Stage] {
		t.Errorf("Etapa inválida: %s", first.Stage)
	}
}

func TestGetLeads_PortfolioFilters(t *testing.T) {
	ctx := context.Background()

	// 1. Filtro por etapa
	proposalRes, err := GetLeads(ctx, GetLeadsFilter{Stage: "proposal"})
	if err != nil {
		t.Fatalf("Erro ao filtrar por etapa: %v", err)
	}
	for _, l := range proposalRes.Leads {
		if l.Stage != LeadStageProposal {
			t.Errorf("Lead com etapa diferente de 'proposal': %s", l.Stage)
		}
	}

	// 2. Filtro de próximos contatos vencidos
	overdueRes, err := GetLeads(ctx, GetLeadsFilter{OverdueOnly: true})
	if err != nil {
		t.Fatalf("Erro ao filtrar por overdue: %v", err)
	}
	for _, l := range overdueRes.Leads {
		if !l.IsNextActionOverdue {
			t.Errorf("Lead ID %d deveria ter isNextActionOverdue true", l.ID)
		}
	}

	// 3. Filtro de leads sem próximo contato
	noNextRes, err := GetLeads(ctx, GetLeadsFilter{NoNextContactOnly: true})
	if err != nil {
		t.Fatalf("Erro ao filtrar por noNextContactOnly: %v", err)
	}
	for _, l := range noNextRes.Leads {
		if l.NextActionAt != nil && *l.NextActionAt != "" {
			t.Errorf("Lead ID %d não deveria ter nextActionAt", l.ID)
		}
	}
}

func TestCreateLeadAndUpdateLead_StageTransitionWithAudit(t *testing.T) {
	ctx := context.Background()
	user := UserContext{ID: "u1", Username: "carlos.vendedor", Role: "supervisor"}

	tomorrow := time.Now().Add(24 * time.Hour).Format("2006-01-02 15:04:05")
	created, err := CreateLead(ctx, CreateLeadInput{
		Name:         "Empresa Teste Automação Ltda",
		PersonType:   "J",
		Phone:        "(11) 99999-8888",
		City:         "São Paulo",
		Stage:        LeadStageNew,
		Source:       "Site / Inbound",
		Owner:        "carlos.vendedor",
		NextActionAt: &tomorrow,
	}, user)
	if err != nil {
		t.Fatalf("Erro ao cadastrar lead: %v", err)
	}

	if created.ID <= 0 {
		t.Errorf("ID gerado inválido: %d", created.ID)
	}
	if created.Name != "Empresa Teste Automação Ltda" {
		t.Errorf("Nome incorreto: %s", created.Name)
	}
	if created.Stage != LeadStageNew {
		t.Errorf("Etapa inicial esperada 'new', recebido '%s'", created.Stage)
	}

	// Transição de etapa
	updated, err := UpdateLead(ctx, created.ID, UpdateLeadInput{
		Stage: LeadStageQualified,
	}, user)
	if err != nil {
		t.Fatalf("Erro ao atualizar lead: %v", err)
	}

	if updated.Stage != LeadStageQualified {
		t.Errorf("Etapa atualizada esperada 'qualified', recebido '%s'", updated.Stage)
	}
}

func TestCreateAssistedContract_LinksOriginProspectIdAndMovesToWon(t *testing.T) {
	ctx := context.Background()
	user := UserContext{ID: "u1", Username: "carlos.vendedor", Role: "supervisor"}

	lead, err := CreateLead(ctx, CreateLeadInput{
		Name:       "Cliente Para Conversão",
		PersonType: "F",
		Stage:      LeadStageNegotiation,
	}, user)
	if err != nil {
		t.Fatalf("Erro ao cadastrar lead para conversão: %v", err)
	}

	contractRes, err := CreateAssistedContract(ctx, CreateAssistedContractInput{
		OriginProspectId: lead.ID,
		CustomerId:       102,
		CustomerName:     "Cliente Para Conversão",
		PlanCode:         "PL-600",
		PlanDescription:  "Fibra Residencial 600MB",
		SellerName:       "carlos.vendedor",
		MonthlyValue:     129.90,
		AdhesionValue:    0,
	}, user)
	if err != nil {
		t.Fatalf("Erro ao emitir contrato assistido: %v", err)
	}

	if !strings.HasPrefix(contractRes.ContractNumber, "CTR-") {
		t.Errorf("Número do contrato deveria iniciar com 'CTR-', recebido '%s'", contractRes.ContractNumber)
	}
	if contractRes.OriginProspectId != lead.ID {
		t.Errorf("OriginProspectId esperado %d, recebido %d", lead.ID, contractRes.OriginProspectId)
	}

	// Verifica que o lead agora está como 'won'
	detail, err := GetLeadById(ctx, lead.ID)
	if err != nil || detail == nil {
		t.Fatalf("Erro ao buscar detalhe do lead convertido: %v", err)
	}
	if detail.Lead.Stage != LeadStageWon {
		t.Errorf("Etapa do lead convertido esperada 'won', recebido '%s'", detail.Lead.Stage)
	}
	if detail.Lead.ConvertedContractID == "" {
		t.Errorf("Lead convertido deveria ter ConvertedContractID preenchido")
	}
}

func TestCommercialDashboard_ComputesCardsAndRankings(t *testing.T) {
	ctx := context.Background()
	dashboard, err := GetCommercialDashboard(ctx, CommercialFilter{
		StartDate: "2026-08-01",
		EndDate:   "2026-09-30",
	})
	if err != nil {
		t.Fatalf("Erro ao computar dashboard comercial: %v", err)
	}

	if dashboard.Kpis.NewLeadsCount < 0 {
		t.Errorf("Novos leads deve ser número positivo: %d", dashboard.Kpis.NewLeadsCount)
	}
	if dashboard.Kpis.ClosedSalesCount <= 0 {
		t.Errorf("Deve conter vendas fechadas no período: %d", dashboard.Kpis.ClosedSalesCount)
	}
	if dashboard.Kpis.ConfirmedContractsCount < dashboard.Kpis.ClosedSalesCount {
		t.Errorf("Contratos confirmados (%d) deve ser >= vendas fechadas (%d)", dashboard.Kpis.ConfirmedContractsCount, dashboard.Kpis.ClosedSalesCount)
	}
	if dashboard.Kpis.AverageTicketMonthly <= 0 {
		t.Errorf("Ticket médio mensal deve ser > 0: %.2f", dashboard.Kpis.AverageTicketMonthly)
	}
	if dashboard.Kpis.CancellationsCount < 0 {
		t.Errorf("Cancelamentos calculados devem ser >= 0: %d", dashboard.Kpis.CancellationsCount)
	}
	expectedNet := dashboard.Kpis.ClosedSalesCount - dashboard.Kpis.CancellationsCount
	if dashboard.Kpis.NetAdditions != expectedNet {
		t.Errorf("NetAdditions esperado %d, recebido %d", expectedNet, dashboard.Kpis.NetAdditions)
	}
	if dashboard.Kpis.TraceableConversionsCount <= 0 {
		t.Errorf("Conversões com CRM_ORIGIN_PROSPECT_ID computadas devem ser > 0: %d", dashboard.Kpis.TraceableConversionsCount)
	}
	if dashboard.Kpis.ConversionRatePercent < 0 {
		t.Errorf("Taxa de conversão deve ser >= 0: %.2f", dashboard.Kpis.ConversionRatePercent)
	}

	if len(dashboard.Funnel) != 6 {
		t.Errorf("Funil deve ter exatamente 6 etapas, recebido %d", len(dashboard.Funnel))
	}
	if len(dashboard.TopPlans) == 0 {
		t.Errorf("Top planos deve ter registros")
	}
	if len(dashboard.TopSellers) == 0 {
		t.Errorf("Top vendedores deve ter registros")
	}
	if len(dashboard.TimeSeries) == 0 {
		t.Errorf("Deve conter pontos de série temporal diária")
	}

	if len(dashboard.CancellationsByCity) > 0 {
		c := dashboard.CancellationsByCity[0]
		if c.City == "" {
			t.Errorf("Cidade do cancelamento deve estar preenchida")
		}
		if c.Count <= 0 {
			t.Errorf("Contagem de cancelamentos por cidade deve ser > 0")
		}
	}
}

func TestDrilldownAndExport(t *testing.T) {
	ctx := context.Background()
	user := UserContext{ID: "u1", Username: "admin", Role: "admin"}

	drillSales, err := GetAnalyticsDrilldown(ctx, "vendas_fechadas", CommercialFilter{})
	if err != nil {
		t.Fatalf("Erro no drilldown de vendas_fechadas: %v", err)
	}
	if drillSales.Total <= 0 || len(drillSales.Records) == 0 {
		t.Errorf("Drilldown vendas_fechadas deveria ter registros")
	}

	drillContracts, err := GetAnalyticsDrilldown(ctx, "contratos_confirmados", CommercialFilter{})
	if err != nil {
		t.Fatalf("Erro no drilldown de contratos_confirmados: %v", err)
	}
	if drillContracts.Total < drillSales.Total {
		t.Errorf("Contratos confirmados (%d) deve ser >= vendas fechadas (%d)", drillContracts.Total, drillSales.Total)
	}

	csvBytes, err := ExportAnalyticsCsv(ctx, "contratos_confirmados", CommercialFilter{}, user)
	if err != nil {
		t.Fatalf("Erro na exportação CSV: %v", err)
	}
	csvStr := string(csvBytes)
	if !strings.Contains(csvStr, "ID/Numero,Nome,Detalhes,Responsavel/Vendedor,Data") {
		t.Errorf("Cabeçalho CSV canônico ausente. Conteúdo: %s", csvStr[:min(len(csvStr), 200)])
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func TestSupportForYearAnd12MonthsSeries(t *testing.T) {
	ctx := context.Background()
	dashYear, err := GetCommercialDashboard(ctx, CommercialFilter{Period: "year"})
	if err != nil {
		t.Fatalf("Erro ao gerar dashboard anual: %v", err)
	}

	if dashYear.Period.Type != "year" {
		t.Errorf("Period.Type esperado 'year', recebido '%s'", dashYear.Period.Type)
	}
	if dashYear.Period.Label != "Ano Corrente" {
		t.Errorf("Period.Label esperado 'Ano Corrente', recebido '%s'", dashYear.Period.Label)
	}

	if len(dashYear.MonthlySeries) != 12 {
		t.Fatalf("MonthlySeries deve conter exatamente 12 meses, recebido %d", len(dashYear.MonthlySeries))
	}

	if dashYear.MonthlySeries[0].Label != "Jan" {
		t.Errorf("Primeiro mês deveria ser 'Jan', recebido '%s'", dashYear.MonthlySeries[0].Label)
	}
	if dashYear.MonthlySeries[11].Label != "Dez" {
		t.Errorf("Último mês deveria ser 'Dez', recebido '%s'", dashYear.MonthlySeries[11].Label)
	}
}

func TestMonthFilterAndRegion(t *testing.T) {
	ctx := context.Background()
	dashMonth, err := GetCommercialDashboard(ctx, CommercialFilter{Period: "month"})
	if err != nil {
		t.Fatalf("Erro ao gerar dashboard mensal: %v", err)
	}

	if dashMonth.Period.Type != "month" {
		t.Errorf("Period.Type esperado 'month', recebido '%s'", dashMonth.Period.Type)
	}
	if dashMonth.Period.Label != "Mês Atual" {
		t.Errorf("Period.Label esperado 'Mês Atual', recebido '%s'", dashMonth.Period.Label)
	}
}

func TestIsClosedSaleContract_AdhesionAndPromotions(t *testing.T) {
	// 1. Contrato com taxa de adesão padrão
	if !IsClosedSaleContract(SalesContractDto{AdhesionValue: 150, PlanDescription: "Plano Padrão"}) {
		t.Errorf("Deve reconhecer venda com taxa de adesão > 0")
	}

	// 2. Contrato rastreável a Lead do CRM
	if !IsClosedSaleContract(SalesContractDto{AdhesionValue: 0, OriginProspectId: 991, PlanDescription: "Plano Padrão"}) {
		t.Errorf("Deve reconhecer venda originada de Lead do CRM mesmo sem taxa")
	}

	// 3. Plano com Adesão Insenta (grafia exata reportada da base RBXSoft)
	if !IsClosedSaleContract(SalesContractDto{
		AdhesionValue:   0,
		PlanDescription: "SUPER 250 MEGAS-ADESÃO INSENTA",
	}) {
		t.Errorf("Deve reconhecer SUPER 250 MEGAS-ADESÃO INSENTA com adesão 0,00")
	}

	// 4. Variações comuns de isenção de adesão
	if !IsClosedSaleContract(SalesContractDto{AdhesionValue: 0, PlanDescription: "SUPER 250 MEGAS-ADESAO ISENTA"}) {
		t.Errorf("Deve reconhecer variação ADESAO ISENTA")
	}
	if !IsClosedSaleContract(SalesContractDto{AdhesionValue: 0, PlanDescription: "Fibra 400 Mega - Adesão Zero"}) {
		t.Errorf("Deve reconhecer variação Adesão Zero")
	}
	if !IsClosedSaleContract(SalesContractDto{AdhesionValue: 0, PlanDescription: "Fibra 600M Isenção de Adesão"}) {
		t.Errorf("Deve reconhecer variação Isenção de Adesão")
	}

	// 5. Contrato sem adesão e sem indicação de isenção (mantém integridade de contratos sem venda nova)
	if IsClosedSaleContract(SalesContractDto{AdhesionValue: 0, PlanDescription: "Fibra Residencial 600MB"}) {
		t.Errorf("Contrato padrão sem adesão e sem prospect não deve ser falsamente computado")
	}
}

func TestConsultaMercados_LeadMappingAndInclusaoFiltering(t *testing.T) {
	ctx := context.Background()

	// 1. Validação do DTO de mercado convertido
	lead := MercadoToLeadDto(rbx.MercadoDto{
		Codigo:         178,
		Tipo:           "F",
		CpfCnpj:        "123.456.789-00",
		Nome:           "EVERTON DOS SANTOS CUNHA",
		Cidade:         "Magalhães Barata",
		UF:             "PA",
		TelCelular:     "(91) 98888-7777",
		Inclusao:       "2026-11-06",
		Usuario:        "yarlei",
		Grupo:          "Comercial PME",
	})

	if lead.ID != 178 || lead.Name != "EVERTON DOS SANTOS CUNHA" {
		t.Errorf("Mapeamento de ID ou Nome incorreto: %v", lead)
	}
	if lead.CreatedAt != "2026-11-06" || lead.CreatedByUser != "yarlei" || lead.Owner != "yarlei" {
		t.Errorf("Data de inclusao ou responsavel incorreto: %v", lead)
	}

	// 2. Validação do filtro de data por Inclusao
	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	todayEnd := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, now.Location())
	todayStr := todayStart.Format("2006-01-02")

	if !isLeadInDateRange(todayStr, todayStart, todayEnd) {
		t.Errorf("isLeadInDateRange deveria retornar true para a data de hoje %s", todayStr)
	}

	yesterdayStart := todayStart.AddDate(0, 0, -1)
	yesterdayEnd := todayEnd.AddDate(0, 0, -1)
	if isLeadInDateRange(todayStr, yesterdayStart, yesterdayEnd) {
		t.Errorf("isLeadInDateRange deveria retornar false para a data de hoje contra o intervalo de ontem")
	}

	// 3. Validação dos novos aliases de Drilldown
	drillLeads, err := GetAnalyticsDrilldown(ctx, "novos_leads_periodo", CommercialFilter{Period: "30d"})
	if err != nil || drillLeads == nil {
		t.Fatalf("Erro ao chamar drilldown novos_leads_periodo: %v", err)
	}

	drillCanc, err := GetAnalyticsDrilldown(ctx, "cancelamentos_periodo", CommercialFilter{Period: "30d"})
	if err != nil || drillCanc == nil {
		t.Fatalf("Erro ao chamar drilldown cancelamentos_periodo: %v", err)
	}

	drillConv, err := GetAnalyticsDrilldown(ctx, "conversao_rastreavel", CommercialFilter{Period: "30d"})
	if err != nil || drillConv == nil {
		t.Fatalf("Erro ao chamar drilldown conversao_rastreavel: %v", err)
	}
}
