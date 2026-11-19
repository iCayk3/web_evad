package analytics

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"evad-backend/internal/rbx"
)

// Helper para parsear datas tolerante a formatos do RBX
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

// ResolvePeriods calcula as janelas temporal atual e anterior comparável
func ResolvePeriods(periodType string, customStart, customEnd string) (current, previous AnalyticsPeriod, curStart, curEnd, prevStart, prevEnd time.Time) {
	now := time.Now()
	if periodType == "" {
		periodType = "7d"
	}

	switch periodType {
	case "today":
		curStart = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		curEnd = now
	case "30d":
		curStart = now.Add(-30 * 24 * time.Hour)
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
		periodType = "7d"
		curStart = now.Add(-7 * 24 * time.Hour)
		curEnd = now
	}

	duration := curEnd.Sub(curStart)
	if duration <= 0 {
		duration = 24 * time.Hour
	}
	prevEnd = curStart
	prevStart = curStart.Add(-duration)

	current = AnalyticsPeriod{
		Type:      periodType,
		StartDate: curStart.Format(time.RFC3339),
		EndDate:   curEnd.Format(time.RFC3339),
	}
	previous = AnalyticsPeriod{
		Type:      periodType,
		StartDate: prevStart.Format(time.RFC3339),
		EndDate:   prevEnd.Format(time.RFC3339),
	}
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

// FilterTickets aplica os filtros estruturados na listagem de tickets
func FilterTickets(tickets []rbx.TicketDto, filters FilterParams) []rbx.TicketDto {
	filtered := tickets

	if filters.Type != "" && filters.Type != "all" {
		targetType := strings.ToLower(strings.TrimSpace(filters.Type))
		var matched []rbx.TicketDto
		for _, t := range filtered {
			if strings.ToLower(strings.TrimSpace(t.Type)) == targetType {
				matched = append(matched, t)
			}
		}
		filtered = matched
	}

	if filters.TechnicianID > 0 {
		var matched []rbx.TicketDto
		for _, t := range filtered {
			if t.TechnicianID == filters.TechnicianID {
				matched = append(matched, t)
			}
		}
		filtered = matched
	}

	if len(filters.Topics) > 0 {
		set := make(map[string]bool)
		for _, top := range filters.Topics {
			set[strings.TrimSpace(top)] = true
		}
		var matched []rbx.TicketDto
		for _, t := range filtered {
			name := strings.TrimSpace(t.TopicName)
			if name == "" {
				name = "Geral"
			}
			if set[name] {
				matched = append(matched, t)
			}
		}
		filtered = matched
	} else if filters.Topic != "" && filters.Topic != "all" {
		target := strings.ToLower(strings.TrimSpace(filters.Topic))
		var matched []rbx.TicketDto
		for _, t := range filtered {
			tName := strings.ToLower(strings.TrimSpace(t.TopicName))
			if tName == target || strings.Contains(tName, target) {
				matched = append(matched, t)
			}
		}
		filtered = matched
	}

	if filters.CauseID > 0 {
		var matched []rbx.TicketDto
		for _, t := range filtered {
			if t.CauseID == filters.CauseID {
				matched = append(matched, t)
			}
		}
		filtered = matched
	}

	return filtered
}

// CalculateOverview computa todas as métricas, séries e tabelas gerenciais do dashboard
func CalculateOverview(allTickets []rbx.TicketDto, periodType string, curStart, curEnd, prevStart, prevEnd time.Time, filters FilterParams) OverviewAnalyticsResponse {
	// Extrai metadados disponíveis antes da filtragem restrita
	topicCountMap := make(map[string]int)
	typeCountMap := map[string]int{"Técnico": 0, "Comercial": 0, "Adm/Fin": 0}

	for _, t := range allTickets {
		name := strings.TrimSpace(t.TopicName)
		if name == "" {
			name = "Geral"
		}
		topicCountMap[name]++
		if t.Type != "" {
			typeCountMap[t.Type]++
		}
	}

	var availableTopics []AvailableTopic
	for name, count := range topicCountMap {
		availableTopics = append(availableTopics, AvailableTopic{Name: name, Count: count})
	}
	sort.Slice(availableTopics, func(i, j int) bool {
		return availableTopics[i].Count > availableTopics[j].Count
	})

	var availableTypes []AvailableType
	for tType, count := range typeCountMap {
		availableTypes = append(availableTypes, AvailableType{Type: tType, Count: count})
	}

	// Aplica filtros de pesquisa
	tickets := FilterTickets(allTickets, filters)

	// Separação em estoques e períodos
	var openTickets, openOverdue, openAtRisk []rbx.TicketDto
	var createdInCurrent, createdInPrevious []rbx.TicketDto
	var concludedInCurrent, concludedInPrevious []rbx.TicketDto

	curStartMs := curStart.UnixMilli()
	curEndMs := curEnd.UnixMilli()
	prevStartMs := prevStart.UnixMilli()
	prevEndMs := prevEnd.UnixMilli()

	for _, t := range tickets {
		// Estoque ativo atual
		isOpen := t.Status == "Aberto" || t.Status == "Em Andamento" || t.Status == "Pendente"
		if isOpen {
			openTickets = append(openTickets, t)
			if t.IsOverdue {
				openOverdue = append(openOverdue, t)
			}
			if t.IsAtRisk {
				openAtRisk = append(openAtRisk, t)
			}
		}

		// Entradas no período
		if d, ok := parseDate(t.CreatedAt); ok {
			ms := d.UnixMilli()
			if ms >= curStartMs && ms <= curEndMs {
				createdInCurrent = append(createdInCurrent, t)
			}
			if ms >= prevStartMs && ms <= prevEndMs {
				createdInPrevious = append(createdInPrevious, t)
			}
		}

		// Concluídos no período
		if t.Status == "Concluído" && t.ConcludedAt != nil {
			if d, ok := parseDate(*t.ConcludedAt); ok {
				ms := d.UnixMilli()
				if ms >= curStartMs && ms <= curEndMs {
					concludedInCurrent = append(concludedInCurrent, t)
				}
				if ms >= prevStartMs && ms <= prevEndMs {
					concludedInPrevious = append(concludedInPrevious, t)
				}
			}
		}
	}

	// 4. Taxa de Cumprimento de SLA das concluídas
	measurableCurrent := 0
	inSlaCurrent := 0
	for _, t := range concludedInCurrent {
		if t.ConcludedWithinSla != nil {
			measurableCurrent++
			if *t.ConcludedWithinSla {
				inSlaCurrent++
			}
		}
	}
	currentSlaRate := 100.0
	if measurableCurrent > 0 {
		currentSlaRate = math.Round((float64(inSlaCurrent)/float64(measurableCurrent))*1000) / 10
	}

	measurablePrev := 0
	inSlaPrev := 0
	for _, t := range concludedInPrevious {
		if t.ConcludedWithinSla != nil {
			measurablePrev++
			if *t.ConcludedWithinSla {
				inSlaPrev++
			}
		}
	}
	prevSlaRate := 100.0
	if measurablePrev > 0 {
		prevSlaRate = math.Round((float64(inSlaPrev)/float64(measurablePrev))*1000) / 10
	}

	// 5. Clientes com Recorrência no Período (>= 3 chamados)
	clientTicketCounts := make(map[int]int)
	for _, t := range createdInCurrent {
		if t.ClientID > 0 {
			clientTicketCounts[t.ClientID]++
		}
	}
	recurrentCount := 0
	for _, count := range clientTicketCounts {
		if count >= 3 {
			recurrentCount++
		}
	}

	// Montagem dos 7 Cards Oficiais do MVP
	cards := make(map[string]MetricCardResult)

	cards["atendimentos_abertos"] = MetricCardResult{
		ID:           "atendimentos_abertos",
		Name:         MetricsCatalog["atendimentos_abertos"].Name,
		Value:        len(openTickets),
		NumericValue: float64(len(openTickets)),
		Definition:   MetricsCatalog["atendimentos_abertos"].Formula,
		Coverage:     100,
		Status:       "ok",
		DrilldownID:  "atendimentos_abertos",
	}

	cards["sla_vencido"] = MetricCardResult{
		ID:           "sla_vencido",
		Name:         MetricsCatalog["sla_vencido"].Name,
		Value:        len(openOverdue),
		NumericValue: float64(len(openOverdue)),
		Definition:   MetricsCatalog["sla_vencido"].Formula,
		Coverage:     100,
		Status:       "ok",
		DrilldownID:  "sla_vencido",
	}

	cards["sla_em_risco"] = MetricCardResult{
		ID:           "sla_em_risco",
		Name:         MetricsCatalog["sla_em_risco"].Name,
		Value:        len(openAtRisk),
		NumericValue: float64(len(openAtRisk)),
		Definition:   MetricsCatalog["sla_em_risco"].Formula,
		Coverage:     100,
		Status:       "ok",
		DrilldownID:  "sla_em_risco",
	}

	prevCreated := float64(len(createdInPrevious))
	cards["entradas_periodo"] = MetricCardResult{
		ID:            "entradas_periodo",
		Name:          MetricsCatalog["entradas_periodo"].Name,
		Value:         len(createdInCurrent),
		NumericValue:  float64(len(createdInCurrent)),
		PreviousValue: &prevCreated,
		ChangePercent: calcChange(float64(len(createdInCurrent)), prevCreated),
		Definition:    MetricsCatalog["entradas_periodo"].Formula,
		Coverage:      100,
		Status:        "ok",
		DrilldownID:   "entradas_periodo",
	}

	prevConcluded := float64(len(concludedInPrevious))
	cards["concluidos_periodo"] = MetricCardResult{
		ID:            "concluidos_periodo",
		Name:          MetricsCatalog["concluidos_periodo"].Name,
		Value:         len(concludedInCurrent),
		NumericValue:  float64(len(concludedInCurrent)),
		PreviousValue: &prevConcluded,
		ChangePercent: calcChange(float64(len(concludedInCurrent)), prevConcluded),
		Definition:    MetricsCatalog["concluidos_periodo"].Formula,
		Coverage:      100,
		Status:        "ok",
		DrilldownID:   "concluidos_periodo",
	}

	slaChange := math.Round((currentSlaRate-prevSlaRate)*10) / 10
	slaCoverage := 100
	if len(concludedInCurrent) > 0 {
		slaCoverage = int(math.Round((float64(measurableCurrent) / float64(len(concludedInCurrent))) * 100))
	}
	cards["taxa_cumprimento_sla"] = MetricCardResult{
		ID:            "taxa_cumprimento_sla",
		Name:          MetricsCatalog["taxa_cumprimento_sla"].Name,
		Value:         fmt.Sprintf("%.1f%%", currentSlaRate),
		NumericValue:  currentSlaRate,
		PreviousValue: &prevSlaRate,
		ChangePercent: &slaChange,
		Definition:    MetricsCatalog["taxa_cumprimento_sla"].Formula,
		Coverage:      slaCoverage,
		Status:        "ok",
		DrilldownID:   "taxa_cumprimento_sla",
		Unit:          "%",
	}

	cards["clientes_com_recorrencia"] = MetricCardResult{
		ID:           "clientes_com_recorrencia",
		Name:         MetricsCatalog["clientes_com_recorrencia"].Name,
		Value:        recurrentCount,
		NumericValue: float64(recurrentCount),
		Definition:   MetricsCatalog["clientes_com_recorrencia"].Formula,
		Coverage:     100,
		Status:       "ok",
		DrilldownID:  "clientes_com_recorrencia",
	}

	// 6. Série Temporal (Últimos 7 dias)
	now := time.Now()
	var timeSeries []TimeSeriesPoint
	timeSeriesMap := make(map[string]*TimeSeriesPoint)
	var dateKeys []string

	for i := 6; i >= 0; i-- {
		d := now.Add(time.Duration(-i*24) * time.Hour)
		key := d.Format("2006-01-02")
		label := d.Format("02/01")
		pt := &TimeSeriesPoint{
			Date:  key,
			Label: label,
		}
		timeSeriesMap[key] = pt
		dateKeys = append(dateKeys, key)
	}

	for _, t := range tickets {
		if len(t.CreatedAt) >= 10 {
			cKey := t.CreatedAt[:10]
			if pt, ok := timeSeriesMap[cKey]; ok {
				pt.Entradas++
			}
		}
		if t.ConcludedAt != nil && len(*t.ConcludedAt) >= 10 {
			endKey := (*t.ConcludedAt)[:10]
			if pt, ok := timeSeriesMap[endKey]; ok {
				pt.Concluidos++
			}
		}
	}

	// Estoque aberto ativo em cada dia
	for _, key := range dateKeys {
		openCount := 0
		for _, t := range tickets {
			createdOnOrBefore := len(t.CreatedAt) >= 10 && t.CreatedAt[:10] <= key
			notConcludedOnDay := t.ConcludedAt == nil || (*t.ConcludedAt)[:10] > key
			if createdOnOrBefore && notConcludedOnDay {
				openCount++
			}
		}
		timeSeriesMap[key].EstoqueAberto = openCount
		timeSeries = append(timeSeries, *timeSeriesMap[key])
	}

	// 7. Distribuição da Fila
	statusCounts := make(map[string]int)
	slaCounts := map[string]int{"OK": 0, "RISK": 0, "OVERDUE": 0}

	for _, t := range openTickets {
		statusCounts[t.Status]++
		if t.SlaStatus == rbx.SlaStatusOverdue {
			slaCounts["OVERDUE"]++
		} else if t.SlaStatus == rbx.SlaStatusRisk {
			slaCounts["RISK"]++
		} else {
			slaCounts["OK"]++
		}
	}

	totalOpen := len(openTickets)
	var byStatus []StatusCount
	for st, count := range statusCounts {
		pct := 0
		if totalOpen > 0 {
			pct = int(math.Round((float64(count) / float64(totalOpen)) * 100))
		}
		byStatus = append(byStatus, StatusCount{Status: st, Count: count, Percentage: pct})
	}
	sort.Slice(byStatus, func(i, j int) bool { return byStatus[i].Count > byStatus[j].Count })

	bySla := []SlaCount{
		{
			SlaStatus:  "No Prazo",
			Count:      slaCounts["OK"],
			Percentage: int(math.Round((float64(slaCounts["OK"]) / float64(intMax(1, totalOpen))) * 100)),
		},
		{
			SlaStatus:  "Em Risco (< 60m)",
			Count:      slaCounts["RISK"],
			Percentage: int(math.Round((float64(slaCounts["RISK"]) / float64(intMax(1, totalOpen))) * 100)),
		},
		{
			SlaStatus:  "Vencido",
			Count:      slaCounts["OVERDUE"],
			Percentage: int(math.Round((float64(slaCounts["OVERDUE"]) / float64(intMax(1, totalOpen))) * 100)),
		},
	}

	// 8. Top Tópicos e Top Causas
	topicAgg := make(map[string]*TopTopicItem)
	causeAgg := make(map[string]*TopCauseItem)

	for _, t := range tickets {
		topKey := strings.TrimSpace(t.TopicName)
		if topKey == "" {
			topKey = "Geral"
		}
		if _, ok := topicAgg[topKey]; !ok {
			topicAgg[topKey] = &TopTopicItem{ID: topKey, Name: topKey}
		}
		topicAgg[topKey].Total++
		if t.IsOverdue {
			topicAgg[topKey].OverdueCount++
		}

		cauKey := strings.TrimSpace(t.CauseName)
		if cauKey == "" {
			cauKey = "Em apuração"
		}
		if _, ok := causeAgg[cauKey]; !ok {
			causeAgg[cauKey] = &TopCauseItem{ID: cauKey, Name: cauKey}
		}
		causeAgg[cauKey].Total++
		if t.IsOverdue {
			causeAgg[cauKey].OverdueCount++
		}
	}

	var topTopics []TopTopicItem
	for _, item := range topicAgg {
		if item.Total > 0 {
			item.OverduePercentage = int(math.Round((float64(item.OverdueCount) / float64(item.Total)) * 100))
		}
		topTopics = append(topTopics, *item)
	}
	sort.Slice(topTopics, func(i, j int) bool { return topTopics[i].Total > topTopics[j].Total })
	if len(topTopics) > 10 {
		topTopics = topTopics[:10]
	}

	var topCauses []TopCauseItem
	for _, item := range causeAgg {
		if item.Total > 0 {
			item.OverduePercentage = int(math.Round((float64(item.OverdueCount) / float64(item.Total)) * 100))
		}
		topCauses = append(topCauses, *item)
	}
	sort.Slice(topCauses, func(i, j int) bool { return topCauses[i].Total > topCauses[j].Total })
	if len(topCauses) > 10 {
		topCauses = topCauses[:10]
	}

	// 9. Carga por Técnico
	techAgg := make(map[string]*TechnicianWorkload)
	for _, t := range tickets {
		techName := strings.TrimSpace(t.TechnicianName)
		if techName == "" {
			techName = "Não atribuído"
		}
		if _, ok := techAgg[techName]; !ok {
			techAgg[techName] = &TechnicianWorkload{
				ID:   t.TechnicianID,
				Name: techName,
			}
		}
		if t.Status == "Aberto" || t.Status == "Em Andamento" {
			techAgg[techName].OpenAssigned++
		} else if t.Status == "Concluído" {
			techAgg[techName].Concluded++
		}
		if t.IsOverdue {
			techAgg[techName].Overdue++
		}
	}

	var technicianWorkload []TechnicianWorkload
	for _, item := range techAgg {
		technicianWorkload = append(technicianWorkload, *item)
	}
	sort.Slice(technicianWorkload, func(i, j int) bool {
		return technicianWorkload[i].OpenAssigned > technicianWorkload[j].OpenAssigned
	})

	// 10. Matriz de Cruzamento Tópico × Situação/SLA
	matrixColumns := []MatrixCol{
		{Key: "aberto_no_prazo", Label: "Aberto (No Prazo)"},
		{Key: "aberto_em_risco", Label: "Aberto (Em Risco)"},
		{Key: "aberto_vencido", Label: "Aberto (SLA Vencido)"},
		{Key: "concluido", Label: "Concluído"},
	}

	var matrixRows []MatrixRow
	maxRows := 8
	if len(topTopics) < maxRows {
		maxRows = len(topTopics)
	}
	for i := 0; i < maxRows; i++ {
		matrixRows = append(matrixRows, MatrixRow{ID: topTopics[i].Name, Label: topTopics[i].Name})
	}

	matrixCells := make(map[string]MatrixCell)
	for _, row := range matrixRows {
		for _, col := range matrixColumns {
			cellKey := fmt.Sprintf("%s__%s", row.ID, col.Key)
			var ticketIDs []int

			for _, t := range tickets {
				tTopic := strings.TrimSpace(t.TopicName)
				if tTopic == "" {
					tTopic = "Geral"
				}
				if tTopic != row.ID {
					continue
				}

				isOpen := t.Status == "Aberto" || t.Status == "Em Andamento"
				matches := false
				switch col.Key {
				case "aberto_no_prazo":
					matches = isOpen && t.SlaStatus == rbx.SlaStatusOk
				case "aberto_em_risco":
					matches = isOpen && t.IsAtRisk
				case "aberto_vencido":
					matches = isOpen && t.IsOverdue
				case "concluido":
					matches = t.Status == "Concluído"
				}

				if matches {
					ticketIDs = append(ticketIDs, t.ID)
				}
			}

			matrixCells[cellKey] = MatrixCell{
				Count:     len(ticketIDs),
				CellKey:   cellKey,
				TicketIDs: ticketIDs,
			}
		}
	}

	currentPeriod := AnalyticsPeriod{
		Type:      periodType,
		StartDate: curStart.Format(time.RFC3339),
		EndDate:   curEnd.Format(time.RFC3339),
	}
	previousPeriod := AnalyticsPeriod{
		Type:      periodType,
		StartDate: prevStart.Format(time.RFC3339),
		EndDate:   prevEnd.Format(time.RFC3339),
	}

	return OverviewAnalyticsResponse{
		Period:             currentPeriod,
		PreviousPeriod:     previousPeriod,
		UpdatedAt:          time.Now().Format(time.RFC3339),
		Timezone:           "America/Sao_Paulo",
		Cards:              cards,
		TimeSeries:         timeSeries,
		QueueDistribution:  QueueDistribution{ByStatus: byStatus, BySla: bySla},
		TopTopics:          topTopics,
		TopCauses:          topCauses,
		AvailableTopics:    availableTopics,
		AvailableTypes:     availableTypes,
		TechnicianWorkload: technicianWorkload,
		CrossMatrix: CrossMatrix{
			Rows:    matrixRows,
			Columns: matrixColumns,
			Cells:   matrixCells,
		},
	}
}

// FilterDrillDownTickets retorna os chamados exatos de uma métrica ou célula da matriz
func FilterDrillDownTickets(allTickets []rbx.TicketDto, metricID string, cellKey string, curStart, curEnd time.Time, filters FilterParams) []rbx.TicketDto {
	tickets := FilterTickets(allTickets, filters)

	if cellKey != "" {
		parts := strings.Split(cellKey, "__")
		if len(parts) == 2 {
			topicName := parts[0]
			colKey := parts[1]

			var matched []rbx.TicketDto
			for _, t := range tickets {
				tTopic := strings.TrimSpace(t.TopicName)
				if tTopic == "" {
					tTopic = "Geral"
				}
				if tTopic != topicName {
					continue
				}

				isOpen := t.Status == "Aberto" || t.Status == "Em Andamento" || t.Status == "Pendente"
				matches := false
				switch colKey {
				case "aberto_no_prazo":
					matches = isOpen && t.SlaStatus == rbx.SlaStatusOk
				case "aberto_em_risco":
					matches = isOpen && t.IsAtRisk
				case "aberto_vencido":
					matches = isOpen && t.IsOverdue
				case "concluido":
					matches = t.Status == "Concluído"
				}
				if matches {
					matched = append(matched, t)
				}
			}
			return matched
		}
	}

	curStartMs := curStart.UnixMilli()
	curEndMs := curEnd.UnixMilli()

	var result []rbx.TicketDto
	switch metricID {
	case "atendimentos_abertos":
		for _, t := range tickets {
			if t.Status == "Aberto" || t.Status == "Em Andamento" || t.Status == "Pendente" {
				result = append(result, t)
			}
		}
	case "sla_vencido":
		for _, t := range tickets {
			isOpen := t.Status == "Aberto" || t.Status == "Em Andamento" || t.Status == "Pendente"
			if isOpen && t.IsOverdue {
				result = append(result, t)
			}
		}
	case "sla_em_risco":
		for _, t := range tickets {
			isOpen := t.Status == "Aberto" || t.Status == "Em Andamento" || t.Status == "Pendente"
			if isOpen && t.IsAtRisk {
				result = append(result, t)
			}
		}
	case "entradas_periodo":
		for _, t := range tickets {
			if d, ok := parseDate(t.CreatedAt); ok {
				ms := d.UnixMilli()
				if ms >= curStartMs && ms <= curEndMs {
					result = append(result, t)
				}
			}
		}
	case "concluidos_periodo":
		for _, t := range tickets {
			if t.Status == "Concluído" && t.ConcludedAt != nil {
				if d, ok := parseDate(*t.ConcludedAt); ok {
					ms := d.UnixMilli()
					if ms >= curStartMs && ms <= curEndMs {
						result = append(result, t)
					}
				}
			}
		}
	case "taxa_cumprimento_sla":
		for _, t := range tickets {
			if t.Status == "Concluído" && t.ConcludedAt != nil {
				if d, ok := parseDate(*t.ConcludedAt); ok {
					ms := d.UnixMilli()
					if ms >= curStartMs && ms <= curEndMs && t.ConcludedWithinSla != nil && *t.ConcludedWithinSla {
						result = append(result, t)
					}
				}
			}
		}
	case "clientes_com_recorrencia":
		counts := make(map[int]int)
		for _, t := range tickets {
			if d, ok := parseDate(t.CreatedAt); ok {
				ms := d.UnixMilli()
				if ms >= curStartMs && ms <= curEndMs && t.ClientID > 0 {
					counts[t.ClientID]++
				}
			}
		}
		recurrentSet := make(map[int]bool)
		for cid, c := range counts {
			if c >= 3 {
				recurrentSet[cid] = true
			}
		}
		for _, t := range tickets {
			if recurrentSet[t.ClientID] {
				result = append(result, t)
			}
		}
	default:
		result = tickets
	}

	return result
}

// ExportCSV monta o arquivo CSV com governança e auditoria
func ExportCSV(tickets []rbx.TicketDto, metricID, cellKey, userFullName, username, role string) string {
	now := time.Now().Format("2006-01-02 15:04:05")

	var sb strings.Builder
	sb.WriteString("# EVAD ISP — Relatório de Extração Analítica RBX\n")
	sb.WriteString(fmt.Sprintf("# Gerado por: %s (%s) - Papel: %s\n", userFullName, username, role))
	sb.WriteString(fmt.Sprintf("# Data/Hora: %s\n", now))
	sb.WriteString(fmt.Sprintf("# Métrica / Recorte: %s %s\n", metricID, cellKey))
	sb.WriteString("# AVISO: USO INTERNO RESTRITO — RASTREADO PELA TRILHA DE AUDITORIA LGPD\n")
	sb.WriteString("\n")
	sb.WriteString("Protocolo,Cliente,Técnico,Tópico,Causa,Situação,SLA,Data Cadastro,Data Conclusão\n")

	for _, t := range tickets {
		conc := ""
		if t.ConcludedAt != nil {
			conc = *t.ConcludedAt
		}
		sb.WriteString(fmt.Sprintf(`"%s","%s","%s","%s","%s","%s","%s","%s","%s"`+"\n",
			escapeCSV(t.Protocol),
			escapeCSV(t.ClientName),
			escapeCSV(t.TechnicianName),
			escapeCSV(t.TopicName),
			escapeCSV(t.CauseName),
			escapeCSV(t.Status),
			escapeCSV(string(t.SlaStatus)),
			escapeCSV(t.CreatedAt),
			escapeCSV(conc),
		))
	}

	return sb.String()
}

func escapeCSV(s string) string {
	return strings.ReplaceAll(s, `"`, `""`)
}

func intMax(a, b int) int {
	if a > b {
		return a
	}
	return b
}
