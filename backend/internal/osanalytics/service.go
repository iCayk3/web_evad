package osanalytics

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"evad-backend/internal/rbx"
)

func parseDate(s string) (time.Time, bool) {
	s = strings.TrimSpace(s)
	if s == "" || strings.HasPrefix(s, "0000") {
		return time.Time{}, false
	}
	formats := []string{
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
		"2006-01-02",
		"02/01/2006 15:04:05",
		"02/01/2006",
		time.RFC3339,
	}
	for _, f := range formats {
		if t, err := time.Parse(f, s); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

// FormatDurationHours formata duração em horas em representação amigável (ex: '2h 15m' ou '45m')
func FormatDurationHours(hours float64) string {
	if hours <= 0 || math.IsNaN(hours) {
		return "0h"
	}
	totalMinutes := int(math.Round(hours * 60))
	h := totalMinutes / 60
	m := totalMinutes % 60
	if h == 0 {
		return fmt.Sprintf("%dm", m)
	}
	if m == 0 {
		return fmt.Sprintf("%dh", h)
	}
	return fmt.Sprintf("%dh %dm", h, m)
}

// ClassifyAbortedMotive classifica inteligentemente o motivo do cancelamento/abortamento de OS
func ClassifyAbortedMotive(text, solution string) string {
	combined := strings.ToLower(fmt.Sprintf("%s %s", text, solution))

	if strings.Contains(combined, "abert") &&
		(strings.Contains(combined, "incorret") || strings.Contains(combined, "erro") || strings.Contains(combined, "fluxo") || strings.Contains(combined, "indevid")) {
		return "Abertura Incorreta / Fluxo Indevido"
	}
	if strings.Contains(combined, "normaliz") ||
		strings.Contains(combined, "voltou a funcionar") ||
		strings.Contains(combined, "restabelec") ||
		strings.Contains(combined, "conectou") {
		return "Conexão Normalizada / Auto-resolvido"
	}
	if strings.Contains(combined, "ausente") ||
		strings.Contains(combined, "nao atendeu") ||
		strings.Contains(combined, "não atendeu") ||
		strings.Contains(combined, "nao estava") ||
		strings.Contains(combined, "não estava") ||
		strings.Contains(combined, "fechado") ||
		strings.Contains(combined, "local fechado") ||
		strings.Contains(combined, "sem resposta") ||
		strings.Contains(combined, "sem acesso") ||
		strings.Contains(combined, "ninguem no local") ||
		strings.Contains(combined, "ninguém no local") {
		return "Cliente Ausente / Sem Acesso"
	}
	if strings.Contains(combined, "inviabilidade") ||
		strings.Contains(combined, "saturad") ||
		strings.Contains(combined, "poste") ||
		strings.Contains(combined, "obstru") ||
		strings.Contains(combined, "sem porta") ||
		strings.Contains(combined, "distancia") ||
		strings.Contains(combined, "rompimento") {
		return "Inviabilidade Técnica / Infra"
	}
	if strings.Contains(combined, "a pedido do cliente") ||
		strings.Contains(combined, "cliente solicitou") ||
		strings.Contains(combined, "adiou") ||
		strings.Contains(combined, "desistiu") ||
		strings.Contains(combined, "desistência") ||
		strings.Contains(combined, "cliente cancelou") ||
		strings.Contains(combined, "nao autorizou") ||
		strings.Contains(combined, "não autorizou") {
		return "Cancelamento a Pedido do Cliente"
	}
	if strings.Contains(combined, "suporte") ||
		strings.Contains(combined, "remoto") ||
		strings.Contains(combined, "ajuda do suporte") ||
		strings.Contains(combined, "configura") {
		return "Resolvido pelo Suporte Remoto"
	}
	if strings.Contains(combined, "reagend") || strings.Contains(combined, "remarcar") {
		return "Reagendamento Solicitado"
	}
	return "Cancelamento Operacional / Outros"
}

// ResolvePeriods define os limites temporais atual e anterior
func ResolvePeriods(periodType, customStart, customEnd string) (curStart, curEnd, prevStart, prevEnd time.Time) {
	now := time.Now()
	if periodType == "" {
		periodType = "7d"
	}

	switch periodType {
	case "today":
		curStart = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		curEnd = now
	case "month":
		curStart = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		curEnd = now
	case "custom":
		if s, ok := parseDate(customStart); ok {
			curStart = s
		} else {
			curStart = now.Add(-7 * 24 * time.Hour)
		}
		if e, ok := parseDate(customEnd); ok {
			curEnd = e
		} else {
			curEnd = now
		}
	default: // "7d"
		curStart = now.Add(-7 * 24 * time.Hour)
		curEnd = now
	}

	duration := curEnd.Sub(curStart)
	if duration <= 0 {
		duration = 24 * time.Hour
	}
	prevEnd = curStart
	prevStart = curStart.Add(-duration)
	return
}

func calcChange(cur, prev float64) *float64 {
	if prev == 0 {
		if cur == 0 {
			val := 0.0
			return &val
		}
		val := 100.0
		return &val
	}
	val := math.Round(((cur-prev)/prev)*1000) / 10
	return &val
}

// CalculateOsOverview computa todos os indicadores de Ordem de Serviço
func CalculateOsOverview(
	allTickets []rbx.TicketDto,
	periodType string,
	curStart, curEnd, prevStart, prevEnd time.Time,
	params OsFilterParams,
	occurrencesByTicket map[int][]rbx.OcorrenciaDto,
) OsAnalyticsOverviewResponse {
	// Associa ocorrências aos chamados
	if occurrencesByTicket != nil {
		for i := range allTickets {
			if occs, ok := occurrencesByTicket[allTickets[i].ID]; ok {
				allTickets[i].Ocorrencias = occs
			}
		}
	}

	// 1. Filtra estritamente Ordens de Serviço Técnicas (Tipo == 'Técnico')
	var osTickets []rbx.TicketDto
	localitySet := make(map[string]bool)
	flowTypeSet := make(map[string]bool)

	for i := range allTickets {
		rbx.EnrichTicketWithFlows(&allTickets[i])
		if allTickets[i].Type == "Técnico" {
			osTickets = append(osTickets, allTickets[i])
			if allTickets[i].PrimaryLocality != "" {
				localitySet[allTickets[i].PrimaryLocality] = true
			}
			if allTickets[i].FlowCategory != "" {
				flowTypeSet[allTickets[i].FlowCategory] = true
			}
			for _, f := range allTickets[i].FinalizedFlows {
				if f.Locality != "" {
					localitySet[f.Locality] = true
				}
				if f.FlowType != "" {
					flowTypeSet[f.FlowType] = true
				}
			}
		}
	}

	var availableLocalities []string
	for loc := range localitySet {
		availableLocalities = append(availableLocalities, loc)
	}
	sort.Strings(availableLocalities)

	var availableFlowTypes []string
	for ft := range flowTypeSet {
		availableFlowTypes = append(availableFlowTypes, ft)
	}
	sort.Strings(availableFlowTypes)

	// 2. Extrai lista de técnicos disponíveis
	techMap := make(map[string]*AvailableTechnician)
	for _, t := range osTickets {
		name := strings.TrimSpace(t.TechnicianName)
		if name == "" {
			name = "Não atribuído"
		}
		if existing, ok := techMap[name]; ok {
			existing.Count++
		} else {
			techMap[name] = &AvailableTechnician{
				ID:    t.TechnicianID,
				Name:  name,
				Count: 1,
			}
		}
	}
	var availableTechnicians []AvailableTechnician
	for _, tech := range techMap {
		availableTechnicians = append(availableTechnicians, *tech)
	}
	sort.Slice(availableTechnicians, func(i, j int) bool {
		return availableTechnicians[i].Count > availableTechnicians[j].Count
	})

	// 3. Aplica Filtros do Usuário
	filteredOs := osTickets

	if len(params.Technicians) > 0 {
		techSet := make(map[string]bool)
		for _, name := range params.Technicians {
			techSet[strings.ToLower(strings.TrimSpace(name))] = true
		}
		var matched []rbx.TicketDto
		for _, t := range filteredOs {
			tName := strings.ToLower(strings.TrimSpace(t.TechnicianName))
			if tName == "" {
				tName = "não atribuído"
			}
			if techSet[tName] {
				matched = append(matched, t)
			}
		}
		filteredOs = matched
	} else if params.TechnicianID > 0 {
		var matched []rbx.TicketDto
		for _, t := range filteredOs {
			if t.TechnicianID == params.TechnicianID {
				matched = append(matched, t)
			}
		}
		filteredOs = matched
	}

	if params.Status != "" && params.Status != "all" {
		targetStatus := strings.ToLower(strings.TrimSpace(params.Status))
		var matched []rbx.TicketDto
		for _, t := range filteredOs {
			if strings.ToLower(strings.TrimSpace(t.Status)) == targetStatus {
				matched = append(matched, t)
			}
		}
		filteredOs = matched
	}

	if params.Search != "" {
		term := strings.ToLower(strings.TrimSpace(params.Search))
		var matched []rbx.TicketDto
		for _, t := range filteredOs {
			if strings.Contains(strings.ToLower(t.Protocol), term) ||
				strings.Contains(strings.ToLower(t.ClientName), term) ||
				strings.Contains(strings.ToLower(t.TechnicianName), term) ||
				strings.Contains(strings.ToLower(t.Description), term) ||
				strings.Contains(strings.ToLower(t.PrimaryLocality), term) ||
				strings.Contains(strings.ToLower(t.FlowCategory), term) {
				matched = append(matched, t)
			}
		}
		filteredOs = matched
	}

	if params.FlowType != "" && params.FlowType != "all" {
		targetFlow := strings.ToLower(strings.TrimSpace(params.FlowType))
		var matched []rbx.TicketDto
		for _, t := range filteredOs {
			hasMatch := strings.EqualFold(strings.TrimSpace(t.FlowCategory), targetFlow)
			if !hasMatch {
				for _, f := range t.FinalizedFlows {
					if strings.EqualFold(strings.TrimSpace(f.FlowType), targetFlow) {
						hasMatch = true
						break
					}
				}
			}
			if hasMatch {
				matched = append(matched, t)
			}
		}
		filteredOs = matched
	}

	if params.Locality != "" && params.Locality != "all" {
		targetLoc := strings.ToLower(strings.TrimSpace(params.Locality))
		var matched []rbx.TicketDto
		for _, t := range filteredOs {
			hasMatch := strings.Contains(strings.ToLower(t.PrimaryLocality), targetLoc)
			if !hasMatch {
				for _, f := range t.FinalizedFlows {
					if strings.Contains(strings.ToLower(f.Locality), targetLoc) {
						hasMatch = true
						break
					}
				}
			}
			if hasMatch {
				matched = append(matched, t)
			}
		}
		filteredOs = matched
	}

	curStartMs := curStart.UnixMilli()
	curEndMs := curEnd.UnixMilli()
	prevStartMs := prevStart.UnixMilli()
	prevEndMs := prevEnd.UnixMilli()

	// 4. Separação por Período Atual vs Anterior
	var osCreatedInCurrent, osCreatedInPrevious []rbx.TicketDto
	var osConcludedInCurrent, osConcludedInPrevious []rbx.TicketDto
	var osCancelledInCurrent, osCancelledInPrevious []rbx.TicketDto
	var osPendingCurrent, osOpenCurrent []rbx.TicketDto

	for _, t := range filteredOs {
		// Criadas
		if d, ok := parseDate(t.CreatedAt); ok {
			ms := d.UnixMilli()
			if ms >= curStartMs && ms <= curEndMs {
				osCreatedInCurrent = append(osCreatedInCurrent, t)
				if t.Status == "Pendente" {
					osPendingCurrent = append(osPendingCurrent, t)
				} else if t.Status == "Aberto" || t.Status == "Em Andamento" {
					osOpenCurrent = append(osOpenCurrent, t)
				}
			}
			if ms >= prevStartMs && ms <= prevEndMs {
				osCreatedInPrevious = append(osCreatedInPrevious, t)
			}
		}

		// Concluídas
		if t.Status == "Concluído" && t.ConcludedAt != nil {
			if d, ok := parseDate(*t.ConcludedAt); ok {
				ms := d.UnixMilli()
				if ms >= curStartMs && ms <= curEndMs {
					osConcludedInCurrent = append(osConcludedInCurrent, t)
				}
				if ms >= prevStartMs && ms <= prevEndMs {
					osConcludedInPrevious = append(osConcludedInPrevious, t)
				}
			}
		}

		// Canceladas
		if t.Status == "Cancelado" {
			targetDate := t.CreatedAt
			if t.ConcludedAt != nil {
				targetDate = *t.ConcludedAt
			}
			if d, ok := parseDate(targetDate); ok {
				ms := d.UnixMilli()
				if ms >= curStartMs && ms <= curEndMs {
					osCancelledInCurrent = append(osCancelledInCurrent, t)
				}
				if ms >= prevStartMs && ms <= prevEndMs {
					osCancelledInPrevious = append(osCancelledInPrevious, t)
				}
			}
		}
	}

	totalCurrentCount := intMax(1, len(osCreatedInCurrent))
	conclusionRate := math.Round((float64(len(osConcludedInCurrent))/float64(totalCurrentCount))*1000) / 10
	cancellationRate := math.Round((float64(len(osCancelledInCurrent))/float64(totalCurrentCount))*1000) / 10

	// TMA das concluídas
	totalResolutionHours := 0.0
	resolutionCount := 0
	for _, t := range osConcludedInCurrent {
		cDate, okC := parseDate(t.CreatedAt)
		eDate, okE := parseDate(*t.ConcludedAt)
		if okC && okE && eDate.After(cDate) {
			diffHours := eDate.Sub(cDate).Hours()
			totalResolutionHours += diffHours
			resolutionCount++
		}
	}
	avgResolutionTime := 0.0
	if resolutionCount > 0 {
		avgResolutionTime = math.Round((totalResolutionHours/float64(resolutionCount))*10) / 10
	}

	// Cumprimento de SLA
	measurableCount := 0
	withinSlaCount := 0
	for _, t := range osConcludedInCurrent {
		if t.ConcludedWithinSla != nil {
			measurableCount++
			if *t.ConcludedWithinSla {
				withinSlaCount++
			}
		}
	}
	slaComplianceRate := 100.0
	if measurableCount > 0 {
		slaComplianceRate = math.Round((float64(withinSlaCount)/float64(measurableCount))*1000) / 10
	}

	// Movimentações Totais (ocorrências)
	totalMovements := 0
	for _, t := range osCreatedInCurrent {
		totalMovements += len(t.Ocorrencias)
	}
	avgMovementsPerOs := 0.0
	if len(osCreatedInCurrent) > 0 {
		avgMovementsPerOs = math.Round((float64(totalMovements)/float64(len(osCreatedInCurrent)))*10) / 10
	}

	// Montagem dos Cards
	var cards OsKpiCards

	cards.TotalOs.Value = len(osCreatedInCurrent)
	cards.TotalOs.ChangePercent = calcChange(float64(len(osCreatedInCurrent)), float64(len(osCreatedInPrevious)))

	cards.ConcludedOs.Value = len(osConcludedInCurrent)
	cards.ConcludedOs.Rate = conclusionRate
	cards.ConcludedOs.ChangePercent = calcChange(float64(len(osConcludedInCurrent)), float64(len(osConcludedInPrevious)))

	cards.CancelledOs.Value = len(osCancelledInCurrent)
	cards.CancelledOs.Rate = cancellationRate
	cards.CancelledOs.ChangePercent = calcChange(float64(len(osCancelledInCurrent)), float64(len(osCancelledInPrevious)))

	cards.PendingOs.Value = len(osPendingCurrent)
	cards.PendingOs.Percentage = math.Round((float64(len(osPendingCurrent))/float64(totalCurrentCount))*1000) / 10

	cards.OpenOs.Value = len(osOpenCurrent)
	cards.OpenOs.Percentage = math.Round((float64(len(osOpenCurrent))/float64(totalCurrentCount))*1000) / 10

	cards.AvgResolutionTimeHours.Value = avgResolutionTime
	cards.AvgResolutionTimeHours.Formatted = FormatDurationHours(avgResolutionTime)

	cards.SlaComplianceRate.Value = slaComplianceRate
	cards.SlaComplianceRate.Formatted = fmt.Sprintf("%.1f%%", slaComplianceRate)

	cards.TotalMovements.Value = totalMovements
	cards.TotalMovements.AvgPerOs = avgMovementsPerOs

	// Métricas Operacionais de Fluxo Finalizado (Remoto vs Campo)
	remoteCount := 0
	fieldCount := 0
	totalFlows := 0
	for _, t := range osConcludedInCurrent {
		if t.HasRemoteSolution {
			remoteCount++
		}
		if t.HasFieldWork {
			fieldCount++
		}
	}
	for _, t := range osCreatedInCurrent {
		totalFlows += len(t.FinalizedFlows)
	}

	totalConcludedCount := intMax(1, len(osConcludedInCurrent))
	cards.RemoteResolutions.Value = remoteCount
	cards.RemoteResolutions.Rate = math.Round((float64(remoteCount)/float64(totalConcludedCount))*1000) / 10

	cards.FieldWork.Value = fieldCount
	cards.FieldWork.Rate = math.Round((float64(fieldCount)/float64(totalConcludedCount))*1000) / 10

	cards.TotalFlows.Value = totalFlows
	if len(osCreatedInCurrent) > 0 {
		cards.TotalFlows.AvgPerOs = math.Round((float64(totalFlows)/float64(len(osCreatedInCurrent)))*10) / 10
	}

	// 5. Evolução Diária (Abertas vs Concluídas vs Canceladas)
	evolutionMap := make(map[string]*OsDailyEvolutionPoint)
	dayCount := int(math.Min(31, math.Max(1, math.Round(curEnd.Sub(curStart).Hours()/24)+1)))
	var dateKeys []string

	for i := 0; i < dayCount; i++ {
		d := curStart.Add(time.Duration(i*24) * time.Hour)
		if d.After(curEnd) {
			break
		}
		key := d.Format("2006-01-02")
		label := d.Format("02/01")
		pt := &OsDailyEvolutionPoint{
			Date:  key,
			Label: label,
		}
		evolutionMap[key] = pt
		dateKeys = append(dateKeys, key)
	}

	for _, t := range osCreatedInCurrent {
		if len(t.CreatedAt) >= 10 {
			key := t.CreatedAt[:10]
			if pt, ok := evolutionMap[key]; ok {
				pt.Abertas++
			}
		}
	}
	for _, t := range osConcludedInCurrent {
		if t.ConcludedAt != nil && len(*t.ConcludedAt) >= 10 {
			key := (*t.ConcludedAt)[:10]
			if pt, ok := evolutionMap[key]; ok {
				pt.Concluidas++
			}
		}
	}
	for _, t := range osCancelledInCurrent {
		target := t.CreatedAt
		if t.ConcludedAt != nil {
			target = *t.ConcludedAt
		}
		if len(target) >= 10 {
			key := target[:10]
			if pt, ok := evolutionMap[key]; ok {
				pt.Canceladas++
			}
		}
	}

	var evolution []OsDailyEvolutionPoint
	for _, key := range dateKeys {
		evolution = append(evolution, *evolutionMap[key])
	}

	// 6. Distribuição por Status
	statusCounts := map[string]int{
		"Concluído":    len(osConcludedInCurrent),
		"Em Andamento": len(osOpenCurrent),
		"Pendente":     len(osPendingCurrent),
		"Cancelado":    len(osCancelledInCurrent),
	}
	statusColors := map[string]string{
		"Concluído":    "#10B981",
		"Em Andamento": "#3B82F6",
		"Pendente":     "#F59E0B",
		"Cancelado":    "#EF4444",
	}
	totalStatus := intMax(1, statusCounts["Concluído"]+statusCounts["Em Andamento"]+statusCounts["Pendente"]+statusCounts["Cancelado"])
	var statusDistribution []OsStatusDistributionItem
	for _, st := range []string{"Concluído", "Em Andamento", "Pendente", "Cancelado"} {
		cnt := statusCounts[st]
		statusDistribution = append(statusDistribution, OsStatusDistributionItem{
			Status:     st,
			Count:      cnt,
			Percentage: math.Round((float64(cnt)/float64(totalStatus))*1000) / 10,
			Color:      statusColors[st],
		})
	}

	// 7. Produtividade & Ranking por Técnico
	techAggMap := make(map[string]*OsTechnicianWorkload)
	for _, t := range osCreatedInCurrent {
		techKey := strings.TrimSpace(t.TechnicianName)
		if techKey == "" {
			techKey = "Não atribuído"
		}
		item, ok := techAggMap[techKey]
		if !ok {
			item = &OsTechnicianWorkload{
				ID:   t.TechnicianID,
				Name: techKey,
			}
			techAggMap[techKey] = item
		}
		item.Total++
		if t.Status == "Concluído" {
			item.Concluded++
		} else if t.Status == "Pendente" {
			item.Pending++
		} else if t.Status == "Cancelado" {
			item.Cancelled++
		} else {
			item.InProgress++
		}
	}

	// Resolução e SLA individual
	techResolutionMap := make(map[string]*struct {
		totalHours float64
		count      int
		inSla      int
	})
	for _, t := range osConcludedInCurrent {
		techKey := strings.TrimSpace(t.TechnicianName)
		if techKey == "" {
			techKey = "Não atribuído"
		}
		res, ok := techResolutionMap[techKey]
		if !ok {
			res = &struct {
				totalHours float64
				count      int
				inSla      int
			}{}
			techResolutionMap[techKey] = res
		}
		res.count++
		if t.ConcludedWithinSla != nil && *t.ConcludedWithinSla {
			res.inSla++
		}
		cDate, okC := parseDate(t.CreatedAt)
		eDate, okE := parseDate(*t.ConcludedAt)
		if okC && okE && eDate.After(cDate) {
			res.totalHours += eDate.Sub(cDate).Hours()
		}
	}

	var techniciansRanking []OsTechnicianWorkload
	for _, tech := range techAggMap {
		res := techResolutionMap[tech.Name]
		if tech.Total > 0 {
			tech.ConclusionRate = math.Round((float64(tech.Concluded)/float64(tech.Total))*1000) / 10
		}
		if res != nil && res.count > 0 {
			tech.AvgTimeHours = math.Round((res.totalHours/float64(res.count))*10) / 10
			tech.SlaRate = math.Round((float64(res.inSla)/float64(res.count))*1000) / 10
		} else {
			tech.SlaRate = 100.0
		}
		techniciansRanking = append(techniciansRanking, *tech)
	}
	sort.Slice(techniciansRanking, func(i, j int) bool {
		if techniciansRanking[i].Concluded != techniciansRanking[j].Concluded {
			return techniciansRanking[i].Concluded > techniciansRanking[j].Concluded
		}
		return techniciansRanking[i].Total > techniciansRanking[j].Total
	})

	// 8. Tópicos & Causas Inteligentes (Demandas Técnicas Reais e Resolução Apurada)
	topicMap := make(map[string]int)
	causeMap := make(map[string]int)
	for _, t := range osCreatedInCurrent {
		topic := strings.TrimSpace(t.RealTopic)
		if topic == "" || rbx.IsAdministrativeTopic(topic) {
			topic = strings.TrimSpace(t.TopicName)
		}
		if topic == "" || rbx.IsAdministrativeTopic(topic) {
			topic, _ = rbx.ResolveRealTopicAndCause(t)
		}
		if topic == "" {
			topic = "Outras Demandas Técnicas"
		}

		cause := strings.TrimSpace(t.RealCause)
		if cause == "" || rbx.IsAdministrativeCause(cause) {
			cause = strings.TrimSpace(t.CauseName)
		}
		if cause == "" || rbx.IsAdministrativeCause(cause) {
			_, cause = rbx.ResolveRealTopicAndCause(t)
		}
		if cause == "" {
			cause = "Em apuração"
		}
		topicMap[topic]++
		causeMap[cause]++
	}

	var topTopics []OsTopicCauseItem
	for name, count := range topicMap {
		topTopics = append(topTopics, OsTopicCauseItem{
			Name:       name,
			Count:      count,
			Percentage: math.Round((float64(count)/float64(totalCurrentCount))*1000) / 10,
		})
	}
	sort.Slice(topTopics, func(i, j int) bool { return topTopics[i].Count > topTopics[j].Count })
	if len(topTopics) > 8 {
		topTopics = topTopics[:8]
	}

	var topCauses []OsTopicCauseItem
	for name, count := range causeMap {
		topCauses = append(topCauses, OsTopicCauseItem{
			Name:       name,
			Count:      count,
			Percentage: math.Round((float64(count)/float64(totalCurrentCount))*1000) / 10,
		})
	}
	sort.Slice(topCauses, func(i, j int) bool { return topCauses[i].Count > topCauses[j].Count })
	if len(topCauses) > 8 {
		topCauses = topCauses[:8]
	}

	// 9. Análise Especializada de OS Abortadas
	var abortedRecords []OsAbortedTicketDetail
	abortedTechMap := make(map[string]int)
	abortedMotivesMap := make(map[string]int)
	totalAbortDurationHours := 0.0

	for _, t := range osCancelledInCurrent {
		var abortOcc *rbx.OcorrenciaDto
		// Procura ocorrência com menção de aborto/cancelamento de trás pra frente
		for i := len(t.Ocorrencias) - 1; i >= 0; i-- {
			lower := strings.ToLower(t.Ocorrencias[i].Texto)
			if strings.Contains(lower, "abort") || strings.Contains(lower, "cancel") {
				abortOcc = &t.Ocorrencias[i]
				break
			}
		}
		if abortOcc == nil && len(t.Ocorrencias) > 0 {
			abortOcc = &t.Ocorrencias[len(t.Ocorrencias)-1]
		}

		justificationText := strings.TrimSpace(t.Solution)
		if justificationText == "" && abortOcc != nil {
			justificationText = abortOcc.Texto
		}
		if justificationText == "" {
			justificationText = t.Description
		}
		if justificationText == "" {
			justificationText = "OS cancelada no sistema."
		}

		classifiedMotive := ClassifyAbortedMotive(justificationText, t.Solution)

		cDate, okC := parseDate(t.CreatedAt)
		targetDate := t.CreatedAt
		if t.ConcludedAt != nil {
			targetDate = *t.ConcludedAt
		} else if abortOcc != nil && abortOcc.Data != "" {
			targetDate = abortOcc.Data
		}
		eDate, okE := parseDate(targetDate)

		duration := 0.0
		if okC && okE && eDate.After(cDate) {
			duration = math.Round(eDate.Sub(cDate).Hours()*10) / 10
		}

		totalAbortDurationHours += duration
		abortedMotivesMap[classifiedMotive]++
		tech := strings.TrimSpace(t.TechnicianName)
		if tech == "" {
			tech = "Não atribuído"
		}
		abortedTechMap[tech]++

		justAuthor := "Sistema"
		if abortOcc != nil && abortOcc.Autor != "" {
			justAuthor = abortOcc.Autor
		} else if tech != "" {
			justAuthor = tech
		}

		flows := t.FinalizedFlows
		if flows == nil {
			flows = []rbx.OsFinalizedFlow{}
		}

		abortedRecords = append(abortedRecords, OsAbortedTicketDetail{
			ID:                  t.ID,
			Protocol:            t.Protocol,
			ClientID:            t.ClientID,
			ClientName:          t.ClientName,
			TechnicianName:      tech,
			TopicName:           t.TopicName,
			CauseName:           t.CauseName,
			CreatedAt:           t.CreatedAt,
			CancelledAt:         targetDate,
			DurationHours:       duration,
			ClassifiedMotive:    classifiedMotive,
			JustificationText:   justificationText,
			JustificationAuthor: justAuthor,
			Solution:            t.Solution,
			OccurrencesCount:    len(t.Ocorrencias),
			Occurrences:         t.Ocorrencias,
			FinalizedFlows:      flows,
			LastFlow:            t.LastFlow,
			FlowCategory:        t.FlowCategory,
			Locality:            t.PrimaryLocality,
		})
	}

	totalAbortedCount := len(osCancelledInCurrent)
	avgTimeUntilAbort := 0.0
	if totalAbortedCount > 0 {
		avgTimeUntilAbort = math.Round((totalAbortDurationHours/float64(totalAbortedCount))*10) / 10
	}

	var motivesSummary []OsAbortedMotiveSummary
	for motive, count := range abortedMotivesMap {
		pct := 0.0
		if totalAbortedCount > 0 {
			pct = math.Round((float64(count)/float64(totalAbortedCount))*1000) / 10
		}
		motivesSummary = append(motivesSummary, OsAbortedMotiveSummary{
			Motive:     motive,
			Count:      count,
			Percentage: pct,
		})
	}
	sort.Slice(motivesSummary, func(i, j int) bool { return motivesSummary[i].Count > motivesSummary[j].Count })

	var technicianAbortedRanking []TechnicianAbortedCount
	for name, count := range abortedTechMap {
		pct := 0.0
		if totalAbortedCount > 0 {
			pct = math.Round((float64(count)/float64(totalAbortedCount))*1000) / 10
		}
		technicianAbortedRanking = append(technicianAbortedRanking, TechnicianAbortedCount{
			Name:       name,
			Count:      count,
			Percentage: pct,
		})
	}
	sort.Slice(technicianAbortedRanking, func(i, j int) bool { return technicianAbortedRanking[i].Count > technicianAbortedRanking[j].Count })

	sort.Slice(abortedRecords, func(i, j int) bool {
		return abortedRecords[i].CancelledAt > abortedRecords[j].CancelledAt
	})

	abortedAnalysis := OsAbortedAnalysis{
		TotalAborted:             totalAbortedCount,
		AbortedRate:              cancellationRate,
		AvgTimeUntilAbortHours:   avgTimeUntilAbort,
		MotivesSummary:           motivesSummary,
		TechnicianAbortedRanking: technicianAbortedRanking,
		Records:                  abortedRecords,
	}

	// 10. Agrupamento Analítico de Tipos de Fluxo e Localidades
	flowTypeCounts := make(map[string]int)
	localityCounts := make(map[string]int)

	for _, t := range osCreatedInCurrent {
		if t.FlowCategory != "" {
			flowTypeCounts[t.FlowCategory]++
		}
		if t.PrimaryLocality != "" {
			localityCounts[t.PrimaryLocality]++
		}
	}

	var flowTypesDistribution []OsStatusDistributionItem
	flowColors := map[string]string{
		"Solução Remota":        "#0ea5e9", // sky
		"Presencial / Campo":    "#10b981", // emerald
		"Triagem / Roteamento":  "#6366f1", // indigo
		"Comercial / Apoio":     "#8b5cf6", // purple
		"Supervisão / Feedback": "#f59e0b", // amber
		"Outro":                 "#94a3b8", // slate
	}

	for ft, count := range flowTypeCounts {
		pct := 0.0
		if totalCurrentCount > 0 {
			pct = math.Round((float64(count)/float64(totalCurrentCount))*1000) / 10
		}
		col := flowColors[ft]
		if col == "" {
			col = "#64748b"
		}
		flowTypesDistribution = append(flowTypesDistribution, OsStatusDistributionItem{
			Status:     ft,
			Count:      count,
			Percentage: pct,
			Color:      col,
		})
	}
	sort.Slice(flowTypesDistribution, func(i, j int) bool {
		return flowTypesDistribution[i].Count > flowTypesDistribution[j].Count
	})

	var localitiesRanking []OsTopicCauseItem
	for loc, count := range localityCounts {
		pct := 0.0
		if totalCurrentCount > 0 {
			pct = math.Round((float64(count)/float64(totalCurrentCount))*1000) / 10
		}
		localitiesRanking = append(localitiesRanking, OsTopicCauseItem{
			Name:       loc,
			Count:      count,
			Percentage: pct,
		})
	}
	sort.Slice(localitiesRanking, func(i, j int) bool {
		return localitiesRanking[i].Count > localitiesRanking[j].Count
	})

	var resp OsAnalyticsOverviewResponse
	resp.Period.Type = periodType
	resp.Period.StartDate = curStart.Format(time.RFC3339)
	resp.Period.EndDate = curEnd.Format(time.RFC3339)
	resp.PreviousPeriod.StartDate = prevStart.Format(time.RFC3339)
	resp.PreviousPeriod.EndDate = prevEnd.Format(time.RFC3339)
	resp.UpdatedAt = time.Now().Format(time.RFC3339)
	resp.Cards = cards
	resp.Evolution = evolution
	resp.StatusDistribution = statusDistribution
	resp.TechniciansRanking = techniciansRanking
	resp.TopTopics = topTopics
	resp.TopCauses = topCauses
	resp.AvailableTechnicians = availableTechnicians
	resp.AbortedAnalysis = abortedAnalysis
	resp.FlowTypesDistribution = flowTypesDistribution
	resp.LocalitiesRanking = localitiesRanking
	resp.AvailableLocalities = availableLocalities
	resp.AvailableFlowTypes = availableFlowTypes

	return resp
}

// FilterTicketList retorna listagem paginada e filtrada de Ordens de Serviço
func FilterTicketList(tickets []rbx.TicketDto, params OsFilterParams, curStart, curEnd time.Time) OsTicketListResponse {
	// Filtra estritamente OS Técnicas
	var osTickets []rbx.TicketDto
	for _, t := range tickets {
		if t.Type == "Técnico" {
			osTickets = append(osTickets, t)
		}
	}

	curStartMs := curStart.UnixMilli()
	curEndMs := curEnd.UnixMilli()

	var filtered []rbx.TicketDto
	for _, t := range osTickets {
		rbx.EnrichTicketWithFlows(&t)

		if d, ok := parseDate(t.CreatedAt); ok {
			ms := d.UnixMilli()
			if ms < curStartMs || ms > curEndMs {
				continue
			}
		}

		if len(params.Technicians) > 0 {
			match := false
			for _, name := range params.Technicians {
				if strings.EqualFold(strings.TrimSpace(name), strings.TrimSpace(t.TechnicianName)) {
					match = true
					break
				}
			}
			if !match {
				continue
			}
		} else if params.TechnicianID > 0 && t.TechnicianID != params.TechnicianID {
			continue
		}

		if params.Status != "" && params.Status != "all" {
			if !strings.EqualFold(strings.TrimSpace(params.Status), strings.TrimSpace(t.Status)) {
				continue
			}
		}

		if params.FlowType != "" && params.FlowType != "all" {
			match := strings.EqualFold(strings.TrimSpace(params.FlowType), strings.TrimSpace(t.FlowCategory))
			if !match {
				for _, f := range t.FinalizedFlows {
					if strings.EqualFold(strings.TrimSpace(params.FlowType), strings.TrimSpace(f.FlowType)) {
						match = true
						break
					}
				}
			}
			if !match {
				continue
			}
		}

		if params.Locality != "" && params.Locality != "all" {
			targetLoc := strings.ToLower(strings.TrimSpace(params.Locality))
			match := strings.Contains(strings.ToLower(t.PrimaryLocality), targetLoc)
			if !match {
				for _, f := range t.FinalizedFlows {
					if strings.Contains(strings.ToLower(f.Locality), targetLoc) {
						match = true
						break
					}
				}
			}
			if !match {
				continue
			}
		}

		if params.Search != "" {
			term := strings.ToLower(strings.TrimSpace(params.Search))
			if !strings.Contains(strings.ToLower(t.Protocol), term) &&
				!strings.Contains(strings.ToLower(t.ClientName), term) &&
				!strings.Contains(strings.ToLower(t.TechnicianName), term) &&
				!strings.Contains(strings.ToLower(t.Description), term) &&
				!strings.Contains(strings.ToLower(t.PrimaryLocality), term) &&
				!strings.Contains(strings.ToLower(t.FlowCategory), term) {
				continue
			}
		}

		filtered = append(filtered, t)
	}

	total := len(filtered)
	page := params.Page
	if page < 1 {
		page = 1
	}
	limit := params.Limit
	if limit < 10 {
		limit = 25
	}
	if limit > 100 {
		limit = 100
	}

	startIndex := (page - 1) * limit
	var paginated []rbx.TicketDto
	if startIndex < total {
		endIndex := startIndex + limit
		if endIndex > total {
			endIndex = total
		}
		paginated = filtered[startIndex:endIndex]
	}

	return OsTicketListResponse{
		Tickets: paginated,
		Total:   total,
		Page:    page,
		Limit:   limit,
	}
}

func intMax(a, b int) int {
	if a > b {
		return a
	}
	return b
}
