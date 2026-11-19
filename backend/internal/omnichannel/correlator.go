package omnichannel

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"evad-backend/internal/rbx"
)

// CorrelatedItem contato correlacionado com ticket do RBX
type CorrelatedItem struct {
	FactID            string     `json:"factId"`
	ConversationID    string     `json:"conversationId"`
	ClientName        string     `json:"clientName"`
	PhoneDisplay      string     `json:"phoneDisplay"`
	RbxClientID       string     `json:"rbxClientId"`
	StartedAt         string     `json:"startedAt"`
	Department        string     `json:"department"`
	Channel           string     `json:"channel"`
	HasTicket         bool       `json:"hasTicket"`
	TicketProtocol    *string    `json:"ticketProtocol,omitempty"`
	TicketOpenedAt    *string    `json:"ticketOpenedAt,omitempty"`
	TicketConcludedAt *string    `json:"ticketConcludedAt,omitempty"`
	TicketTopic       *string    `json:"ticketTopic,omitempty"`
	TicketCause       *string    `json:"ticketCause,omitempty"`
	TicketStatus      *string    `json:"ticketStatus,omitempty"`
	TimeDiffMinutes   *int       `json:"timeDiffMinutes,omitempty"`
}

// CrossRbxResponse resposta consolidada do cruzamento Omnichannel × RBX
type CrossRbxResponse struct {
	WindowHours                     int              `json:"windowHours"`
	TotalLinkedContacts             int              `json:"totalLinkedContacts"`
	CorrelatedContactsCount         int              `json:"correlatedContactsCount"`
	CorrelationRate                 float64          `json:"correlationRate"`
	ContactsWithoutCorrelatedTicket int              `json:"contactsWithoutCorrelatedTicket"`
	TopCorrelatedTopics             []struct {
		Topic string `json:"topic"`
		Count int    `json:"count"`
	} `json:"topCorrelatedTopics"`
	TopCorrelatedCauses             []struct {
		Cause string `json:"cause"`
		Count int    `json:"count"`
	} `json:"topCorrelatedCauses"`
	HighRiskClients                 []HighRiskClient `json:"highRiskClients"`
	Items                           []CorrelatedItem `json:"items"`
}

// CorrelateOmnichannelWithRbx correlaciona conversas do ISPCHAT com tickets do RBXSoft dentro de uma janela de horas
func CorrelateOmnichannelWithRbx(
	ctx context.Context,
	db *pgxpool.Pool,
	tickets []rbx.TicketDto,
	windowHours int,
	batchID string,
	limit int,
) (*CrossRbxResponse, error) {
	if db == nil {
		return nil, fmt.Errorf("banco de dados não disponível")
	}

	if windowHours <= 0 {
		windowHours = 24
	}
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	// Indexa tickets por ClientID
	ticketClientMap := make(map[string][]rbx.TicketDto)
	for _, t := range tickets {
		if t.ClientID > 0 {
			cid := fmt.Sprintf("%d", t.ClientID)
			ticketClientMap[cid] = append(ticketClientMap[cid], t)
		}
	}

	// Busca contatos com rbx_client_id preenchido
	query := `
		SELECT id, conversation_id, COALESCE(name_masked, 'Cliente'), phone_masked,
		       rbx_client_id, started_at, COALESCE(department, ''), COALESCE(channel, '')
		FROM omnichannel_contact_facts
		WHERE rbx_client_id IS NOT NULL AND rbx_client_id != ''
	`
	var args []interface{}
	if batchID != "" {
		query += " AND batch_id = $1"
		args = append(args, batchID)
	}
	query += " ORDER BY started_at DESC LIMIT $1"
	if batchID != "" {
		query = "SELECT id, conversation_id, COALESCE(name_masked, 'Cliente'), phone_masked, rbx_client_id, started_at, COALESCE(department, ''), COALESCE(channel, '') FROM omnichannel_contact_facts WHERE rbx_client_id IS NOT NULL AND rbx_client_id != '' AND batch_id = $1 ORDER BY started_at DESC LIMIT $2"
		args = []interface{}{batchID, limit}
	} else {
		args = []interface{}{limit}
	}

	rows, err := db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("erro ao buscar contatos para correlação: %w", err)
	}
	defer rows.Close()

	var items []CorrelatedItem
	topicCounts := make(map[string]int)
	causeCounts := make(map[string]int)
	correlatedCount := 0

	windowDuration := time.Duration(windowHours) * time.Hour

	for rows.Next() {
		var id, convID, name, phone, rbxID, dep, ch string
		var startedAt time.Time

		if err := rows.Scan(&id, &convID, &name, &phone, &rbxID, &startedAt, &dep, &ch); err != nil {
			continue
		}

		cTickets := ticketClientMap[rbxID]
		var bestTicket *rbx.TicketDto
		var bestDiff time.Duration = 1000 * time.Hour

		for _, t := range cTickets {
			if tDate, ok := parseAnyDate(t.CreatedAt); ok {
				diff := startedAt.Sub(tDate)
				if diff < 0 {
					diff = -diff
				}
				if diff <= windowDuration && diff < bestDiff {
					bestDiff = diff
					tCopy := t
					bestTicket = &tCopy
				}
			}
		}

		hasTicket := bestTicket != nil
		var proto, openedAtStr, concludedAtStr, top, cau, st *string
		var diffMins *int

		if hasTicket {
			correlatedCount++
			proto = &bestTicket.Protocol
			openedAtStr = &bestTicket.CreatedAt
			if bestTicket.ConcludedAt != nil {
				concludedAtStr = bestTicket.ConcludedAt
			}
			top = &bestTicket.TopicName
			cau = &bestTicket.CauseName
			st = &bestTicket.Status
			mins := int(math.Round(bestDiff.Minutes()))
			diffMins = &mins

			if bestTicket.TopicName != "" {
				topicCounts[bestTicket.TopicName]++
			}
			if bestTicket.CauseName != "" {
				causeCounts[bestTicket.CauseName]++
			}
		}

		items = append(items, CorrelatedItem{
			FactID:            id,
			ConversationID:    convID,
			ClientName:        name,
			PhoneDisplay:      phone,
			RbxClientID:       rbxID,
			StartedAt:         startedAt.Format(time.RFC3339),
			Department:        dep,
			Channel:           ch,
			HasTicket:         hasTicket,
			TicketProtocol:    proto,
			TicketOpenedAt:    openedAtStr,
			TicketConcludedAt: concludedAtStr,
			TicketTopic:       top,
			TicketCause:       cau,
			TicketStatus:      st,
			TimeDiffMinutes:   diffMins,
		})
	}

	total := len(items)
	rate := 0.0
	if total > 0 {
		rate = math.Round((float64(correlatedCount)/float64(total))*1000) / 10
	}

	topTopics := []struct {
		Topic string `json:"topic"`
		Count int    `json:"count"`
	}{}
	for t, c := range topicCounts {
		topTopics = append(topTopics, struct {
			Topic string `json:"topic"`
			Count int    `json:"count"`
		}{Topic: t, Count: c})
	}
	sort.Slice(topTopics, func(i, j int) bool { return topTopics[i].Count > topTopics[j].Count })

	topCauses := []struct {
		Cause string `json:"cause"`
		Count int    `json:"count"`
	}{}
	for cau, c := range causeCounts {
		topCauses = append(topCauses, struct {
			Cause string `json:"cause"`
			Count int    `json:"count"`
		}{Cause: cau, Count: c})
	}
	sort.Slice(topCauses, func(i, j int) bool { return topCauses[i].Count > topCauses[j].Count })

	if items == nil {
		items = []CorrelatedItem{}
	}

	highRisk := []HighRiskClient{}
	// Agrupa clientes com múltiplos contatos e tickets
	clientMap := make(map[string]*HighRiskClient)
	for _, it := range items {
		if it.RbxClientID != "" {
			cid := it.RbxClientID
			entry, ok := clientMap[cid]
			if !ok {
				entry = &HighRiskClient{
					ClientID:   cid,
					ClientName: it.ClientName,
				}
				clientMap[cid] = entry
			}
			entry.ContactCount++
			if it.HasTicket {
				entry.TicketCount++
				if it.TicketProtocol != nil {
					entry.LastTicketProtocol = *it.TicketProtocol
				}
			}
		}
	}
	for _, entry := range clientMap {
		if entry.ContactCount > 1 || entry.TicketCount > 0 {
			highRisk = append(highRisk, *entry)
		}
	}
	sort.Slice(highRisk, func(i, j int) bool {
		return (highRisk[i].ContactCount + highRisk[i].TicketCount) > (highRisk[j].ContactCount + highRisk[j].TicketCount)
	})

	return &CrossRbxResponse{
		WindowHours:                     windowHours,
		TotalLinkedContacts:             total,
		CorrelatedContactsCount:         correlatedCount,
		CorrelationRate:                 rate,
		ContactsWithoutCorrelatedTicket: total - correlatedCount,
		TopCorrelatedTopics:             topTopics,
		TopCorrelatedCauses:             topCauses,
		HighRiskClients:                 highRisk,
		Items:                           items,
	}, nil
}
