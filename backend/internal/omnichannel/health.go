package omnichannel

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"
)

// HealthOptions opções de filtro para o cálculo do termômetro de saúde do cliente
type HealthOptions struct {
	Start      time.Time
	End        time.Time
	Threshold  int
	OldMonths  int
	Department string
	Channel    string
	City       string
	Plan       string
	PppoeLogin string
}

func isEligibleInitiator(initiatedBy string) bool {
	norm := NormalizeName(initiatedBy)
	return norm == "CLIENTE"
}

// BuildCustomerHealth executa a regra de negócio do termômetro de saúde e risco de churn
func BuildCustomerHealth(
	contacts []HealthContact,
	tickets []HealthTicket,
	profiles []HealthProfile,
	opts HealthOptions,
) CustomerHealthResponse {
	if opts.Threshold < 2 {
		opts.Threshold = 2
	}
	if opts.OldMonths < 1 {
		opts.OldMonths = 6
	}

	profileMap := make(map[string]HealthProfile)
	for _, p := range profiles {
		profileMap[p.ID] = p
	}

	recentStart := opts.End.Add(-7 * 24 * time.Hour)
	thirtyDaysAgo := opts.End.Add(-30 * 24 * time.Hour)

	// 1. Filtra contatos conforme critérios
	var filteredContacts []HealthContact
	for _, c := range contacts {
		if c.StartedAt.After(opts.End) {
			continue
		}
		if opts.Department != "" && c.Department != opts.Department {
			continue
		}
		if opts.Channel != "" && c.Channel != opts.Channel {
			continue
		}

		prof := profileMap[ptrToStr(c.ClientID)]
		if opts.City != "" && prof.City != opts.City {
			continue
		}
		if opts.Plan != "" && prof.Plan != opts.Plan {
			continue
		}
		if opts.PppoeLogin != "" && !strings.Contains(strings.ToLower(prof.PppoeLogin), strings.ToLower(opts.PppoeLogin)) {
			continue
		}

		filteredContacts = append(filteredContacts, c)
	}

	// 2. Mapeia contatos no período principal
	observedClients := make(map[string]bool)
	var periodContacts []HealthContact
	for _, c := range filteredContacts {
		if !c.StartedAt.Before(opts.Start) {
			periodContacts = append(periodContacts, c)
			if c.Confirmed && c.ClientID != nil && *c.ClientID != "" {
				observedClients[*c.ClientID] = true
			}
		}
	}

	// 3. Mapeia tickets de clientes observados ou no período
	ticketMap := make(map[string][]HealthTicket)
	for _, t := range tickets {
		if t.ClientID == "" || t.OpenedAt.After(opts.End) {
			continue
		}
		prof := profileMap[t.ClientID]
		if opts.City != "" && prof.City != opts.City {
			continue
		}
		if opts.Plan != "" && prof.Plan != opts.Plan {
			continue
		}
		if opts.PppoeLogin != "" && !strings.Contains(strings.ToLower(prof.PppoeLogin), strings.ToLower(opts.PppoeLogin)) {
			continue
		}
		if (opts.Department != "" || opts.Channel != "") && !observedClients[t.ClientID] {
			continue
		}

		ticketMap[t.ClientID] = append(ticketMap[t.ClientID], t)
		if !t.OpenedAt.Before(opts.Start) {
			observedClients[t.ClientID] = true
		}
	}

	// 4. Agrupa histórico por cliente
	clientContactsMap := make(map[string][]HealthContact)
	for cid := range observedClients {
		clientContactsMap[cid] = []HealthContact{}
	}
	for _, c := range filteredContacts {
		if c.Confirmed && c.ClientID != nil && observedClients[*c.ClientID] {
			clientContactsMap[*c.ClientID] = append(clientContactsMap[*c.ClientID], c)
		}
	}

	// 5. Avalia cada cliente individualmente
	var healthClients []HealthClientItem
	for cid, history := range clientContactsMap {
		sort.Slice(history, func(i, j int) bool {
			return history[i].StartedAt.Before(history[j].StartedAt)
		})

		var recentContacts []HealthContact
		for _, c := range history {
			if isEligibleInitiator(c.InitiatedBy) && c.StartedAt.After(recentStart) {
				recentContacts = append(recentContacts, c)
			}
		}

		cTickets := ticketMap[cid]
		var recentTickets []HealthTicket
		var openTickets []HealthTicket
		var overdueTickets []HealthTicket

		for _, t := range cTickets {
			if t.OpenedAt.After(recentStart) {
				recentTickets = append(recentTickets, t)
			}
			isOpen := t.ConcludedAt == nil && (strings.EqualFold(t.Status, "Aberto") ||
				strings.EqualFold(t.Status, "Em Andamento") || strings.EqualFold(t.Status, "Pendente"))
			if isOpen {
				openTickets = append(openTickets, t)
				if t.DueAt != nil && t.DueAt.Before(opts.End) {
					overdueTickets = append(overdueTickets, t)
				}
			}
		}

		// Reincidência de mesma causa após conclusão em até 7 dias
		returnAfterConclusion := false
		for _, c := range history {
			if isEligibleInitiator(c.InitiatedBy) && c.StartedAt.After(thirtyDaysAgo) {
				for _, t := range cTickets {
					if t.ConcludedAt != nil && t.Cause != "" {
						diff := c.StartedAt.Sub(*t.ConcludedAt)
						if diff > 0 && diff <= 7*24*time.Hour {
							for _, cause := range c.Causes {
								if NormalizeName(cause) == NormalizeName(t.Cause) {
									returnAfterConclusion = true
									break
								}
							}
						}
					}
					if returnAfterConclusion {
						break
					}
				}
			}
			if returnAfterConclusion {
				break
			}
		}

		// Reabertura de ticket da mesma causa em até 7 dias
		if !returnAfterConclusion {
			for _, current := range cTickets {
				if current.OpenedAt.After(thirtyDaysAgo) {
					for _, prev := range cTickets {
						if prev.ID != current.ID && prev.ConcludedAt != nil && prev.Cause != "" && current.Cause != "" {
							if NormalizeName(prev.Cause) == NormalizeName(current.Cause) {
								diff := current.OpenedAt.Sub(*prev.ConcludedAt)
								if diff > 0 && diff <= 7*24*time.Hour {
									returnAfterConclusion = true
									break
								}
							}
						}
					}
				}
				if returnAfterConclusion {
					break
				}
			}
		}

		// Ticket vencido da mesma causa que os contatos recentes
		sameCauseOverdue := false
		for _, od := range overdueTickets {
			if od.Cause != "" {
				odNorm := NormalizeName(od.Cause)
				for _, rc := range recentContacts {
					for _, cause := range rc.Causes {
						if NormalizeName(cause) == odNorm {
							sameCauseOverdue = true
							break
						}
					}
					if sameCauseOverdue {
						break
					}
				}
				if sameCauseOverdue {
					break
				}
				for _, rt := range recentTickets {
					if rt.ID != od.ID && rt.Cause != "" && NormalizeName(rt.Cause) == odNorm {
						sameCauseOverdue = true
						break
					}
				}
			}
			if sameCauseOverdue {
				break
			}
		}

		isRecurrent := len(recentContacts) >= opts.Threshold || len(recentTickets) >= opts.Threshold

		var reasons []string
		if len(recentContacts) >= opts.Threshold {
			reasons = append(reasons, fmt.Sprintf("%d contatos iniciados pelo cliente em 7 dias", len(recentContacts)))
		}
		if len(recentTickets) >= opts.Threshold {
			reasons = append(reasons, fmt.Sprintf("%d protocolos RBX distintos abertos em 7 dias", len(recentTickets)))
		}
		if returnAfterConclusion {
			reasons = append(reasons, "Retorno da mesma classificação até 7 dias após conclusão no RBX")
		}
		if len(overdueTickets) > 0 {
			reasons = append(reasons, fmt.Sprintf("%d protocolo(s) com SLA vencido", len(overdueTickets)))
		}

		// Nível de Prioridade / Risco
		priority := PriorityInsufficient
		if isRecurrent || len(overdueTickets) > 0 {
			priority = PriorityAttention
		}
		maxRecent := len(recentContacts)
		if len(recentTickets) > maxRecent {
			maxRecent = len(recentTickets)
		}
		if returnAfterConclusion || maxRecent >= intMax(3, opts.Threshold+1) {
			priority = PriorityHigh
		}
		if isRecurrent && sameCauseOverdue {
			priority = PriorityCritical
		}

		// Recomendação Operacional
		recommendation := "Completar o histórico e conferir protocolos antes de concluir a avaliação."
		if returnAfterConclusion {
			recommendation = "Revisar a solução técnica registrada e auditar a estabilidade da porta/CPE."
		} else if isRecurrent {
			recommendation = "Investigar motivos dos contatos repetidos e despachar acompanhamento proativo."
		} else if len(overdueTickets) > 0 {
			recommendation = "Escalonar protocolo com prazo vencido imediatamente para supervisão de campo."
		}

		// Antiguidade do cliente
		prof := profileMap[cid]
		var isOld *bool
		if prof.RegisteredAt != nil {
			anniversary := opts.End.AddDate(0, -opts.OldMonths, 0)
			val := prof.RegisteredAt.Before(anniversary)
			isOld = &val
		}

		clientName := fmt.Sprintf("Cliente RBX #%s", cid)
		if prof.Name != "" {
			clientName = prof.Name
		} else if len(history) > 0 && history[len(history)-1].Name != "" {
			clientName = history[len(history)-1].Name
		}

		var activityDates []time.Time
		for _, c := range history {
			activityDates = append(activityDates, c.StartedAt)
		}
		for _, t := range cTickets {
			activityDates = append(activityDates, t.OpenedAt)
		}
		sort.Slice(activityDates, func(i, j int) bool {
			return activityDates[i].Before(activityDates[j])
		})

		firstContactStr := ""
		lastContactStr := ""
		if len(activityDates) > 0 {
			firstContactStr = activityDates[0].Format(time.RFC3339)
			lastContactStr = activityDates[len(activityDates)-1].Format(time.RFC3339)
		}

		var totalPeriodContacts int
		for _, c := range history {
			if !c.StartedAt.Before(opts.Start) {
				totalPeriodContacts++
			}
		}

		var regAtStr *string
		if prof.RegisteredAt != nil {
			s := prof.RegisteredAt.Format(time.RFC3339)
			regAtStr = &s
		}

		if reasons == nil {
			reasons = make([]string, 0)
		}
		if history == nil {
			history = make([]HealthContact, 0)
		}
		if cTickets == nil {
			cTickets = make([]HealthTicket, 0)
		}

		healthClients = append(healthClients, HealthClientItem{
			ID:                    cid,
			Name:                  clientName,
			Priority:              priority,
			Recurrent:             isRecurrent,
			RecentContacts:        len(recentContacts),
			RecentTickets:         len(recentTickets),
			TotalContacts:         totalPeriodContacts,
			FirstContactAt:        firstContactStr,
			LastContactAt:         lastContactStr,
			IsOld:                 isOld,
			RegisteredAt:          regAtStr,
			City:                  prof.City,
			Plan:                  prof.Plan,
			PppoeLogin:            prof.PppoeLogin,
			OverdueTickets:        len(overdueTickets),
			ObservedOpenTickets:   len(openTickets),
			ReturnAfterConclusion: returnAfterConclusion,
			Reasons:               reasons,
			Recommendation:        recommendation,
			Sentiment:             "Não avaliado",
			Partial:               true,
			Contacts:              history,
			Tickets:               cTickets,
		})
	}

	// Ordena clientes por Prioridade (Crítico -> Alto -> Atenção -> Insuficiente) e depois última atividade
	priorityWeight := map[Priority]int{
		PriorityCritical:     0,
		PriorityHigh:         1,
		PriorityAttention:    2,
		PriorityInsufficient: 3,
	}
	sort.Slice(healthClients, func(i, j int) bool {
		wI := priorityWeight[healthClients[i].Priority]
		wJ := priorityWeight[healthClients[j].Priority]
		if wI != wJ {
			return wI < wJ
		}
		return healthClients[i].LastContactAt > healthClients[j].LastContactAt
	})

	// 6. Agrupamento e ranking de Causas
	type causeItem struct {
		clients  map[string]bool
		contacts int
		prev     map[string]bool
	}
	causeMap := make(map[string]*causeItem)
	prevStart := opts.Start.Add(-opts.End.Sub(opts.Start))

	for _, c := range filteredContacts {
		if !c.Confirmed || c.ClientID == nil || c.StartedAt.Before(prevStart) {
			continue
		}
		causes := c.Causes
		if len(causes) == 0 {
			causes = []string{"Não classificado"}
		}
		for _, cause := range causes {
			item, ok := causeMap[cause]
			if !ok {
				item = &causeItem{clients: make(map[string]bool), prev: make(map[string]bool)}
				causeMap[cause] = item
			}
			if !c.StartedAt.Before(opts.Start) {
				item.clients[*c.ClientID] = true
				item.contacts++
			} else {
				item.prev[*c.ClientID] = true
			}
		}
	}

	var causeSummaries []HealthCauseSummary
	for cause, item := range causeMap {
		curClients := len(item.clients)
		prevClients := len(item.prev)
		var change *float64
		if prevClients > 0 {
			ch := math.Round((float64(curClients)/float64(prevClients)-1)*1000) / 10
			change = &ch
		}
		causeSummaries = append(causeSummaries, HealthCauseSummary{
			Name:            cause,
			Clients:         curClients,
			Contacts:        item.contacts,
			PreviousClients: prevClients,
			Change:          change,
		})
	}
	sort.Slice(causeSummaries, func(i, j int) bool {
		return causeSummaries[i].Clients > causeSummaries[j].Clients
	})

	// 7. Série Diária
	dailyMap := make(map[string]int)
	for _, c := range periodContacts {
		day := c.StartedAt.Format("2006-01-02")
		dailyMap[day]++
	}
	var dailyCounts []DailyContactCount
	for day, cnt := range dailyMap {
		dailyCounts = append(dailyCounts, DailyContactCount{Day: day, Contacts: cnt})
	}
	sort.Slice(dailyCounts, func(i, j int) bool {
		return dailyCounts[i].Day < dailyCounts[j].Day
	})

	// 8. Resumo e contadores
	var resp CustomerHealthResponse

	resp.Options.Start = opts.Start.Format(time.RFC3339)
	resp.Options.End = opts.End.Format(time.RFC3339)
	resp.Options.Threshold = opts.Threshold
	resp.Options.OldMonths = opts.OldMonths

	resp.Quality.ClientsAvailable = true
	resp.Quality.TicketsAvailable = true
	resp.Quality.HistoryComplete = true
	resp.Quality.AuthenticationAvailable = false
	resp.Quality.Warnings = make([]string, 0)
	resp.Quality.ImportedContacts = len(contacts)

	if len(contacts) > 0 {
		startStr := contacts[0].StartedAt.Format(time.RFC3339)
		endStr := contacts[len(contacts)-1].StartedAt.Format(time.RFC3339)
		resp.Quality.ContactPeriod = &DatePeriod{
			Start: startStr,
			End:   endStr,
		}
	}

	if causeSummaries == nil {
		causeSummaries = make([]HealthCauseSummary, 0)
	}
	resp.Causes = causeSummaries

	if dailyCounts == nil {
		dailyCounts = make([]DailyContactCount, 0)
	}
	resp.Daily = dailyCounts

	if healthClients == nil {
		healthClients = make([]HealthClientItem, 0)
	}
	resp.Clients = healthClients
	resp.RuleVersion = "health-v2-native"
	resp.GeneratedAt = time.Now().Format(time.RFC3339)

	resp.Summary.ObservedClients = len(healthClients)
	resp.Summary.Contacts = len(periodContacts)

	totalTickets := 0
	for _, list := range ticketMap {
		for _, t := range list {
			if !t.OpenedAt.Before(opts.Start) {
				totalTickets++
			}
		}
	}
	resp.Summary.Tickets = totalTickets

	for _, c := range healthClients {
		if c.Recurrent {
			resp.Summary.Recurrent++
		}
		if c.Priority == PriorityCritical || c.Priority == PriorityHigh {
			resp.Summary.HighPriority++
		}
		if c.IsOld != nil && *c.IsOld {
			resp.Summary.OldClients++
		}
		if c.ReturnAfterConclusion {
			resp.Summary.Returns++
		}
		if c.Priority == PriorityInsufficient {
			resp.Summary.Insufficient++
		}
	}

	for _, c := range periodContacts {
		if !c.Confirmed || c.ClientID == nil || *c.ClientID == "" {
			resp.Summary.UnconfirmedContacts++
		}
		if c.InitiatedBy == "" {
			resp.Summary.UnknownInitiator++
		}
	}

	// Metadados de Filtros
	depSet := make(map[string]bool)
	chanSet := make(map[string]bool)
	for _, c := range filteredContacts {
		if c.Department != "" {
			depSet[c.Department] = true
		}
		if c.Channel != "" {
			chanSet[c.Channel] = true
		}
	}
	for d := range depSet {
		resp.Filters.Departments = append(resp.Filters.Departments, d)
	}
	sort.Strings(resp.Filters.Departments)

	for ch := range chanSet {
		resp.Filters.Channels = append(resp.Filters.Channels, ch)
	}
	sort.Strings(resp.Filters.Channels)

	if resp.Filters.Departments == nil {
		resp.Filters.Departments = make([]string, 0)
	}
	if resp.Filters.Channels == nil {
		resp.Filters.Channels = make([]string, 0)
	}
	if resp.Filters.Cities == nil {
		resp.Filters.Cities = make([]string, 0)
	}
	if resp.Filters.Plans == nil {
		resp.Filters.Plans = make([]string, 0)
	}

	return resp
}

func ptrToStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func intMax(a, b int) int {
	if a > b {
		return a
	}
	return b
}
