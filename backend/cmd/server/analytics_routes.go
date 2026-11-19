package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"evad-backend/internal/analytics"
	"evad-backend/internal/audit"
	"evad-backend/internal/osanalytics"
	"evad-backend/internal/rbx"
)

// getRbxClient instancia o client oficial do RBXSoft a partir das credenciais no PostgreSQL
func getRbxClient(ctx context.Context) (*rbx.Client, error) {
	if dbPool == nil {
		return nil, fmt.Errorf("banco de dados PostgreSQL não conectado")
	}

	var rbxURL, rbxToken, rbxVersion string
	err := dbPool.QueryRow(ctx, "SELECT rbx_url, rbx_token, rbx_version FROM configuracoes_rbx WHERE id = 1").Scan(&rbxURL, &rbxToken, &rbxVersion)
	if err != nil || strings.TrimSpace(rbxURL) == "" || strings.TrimSpace(rbxToken) == "" {
		return nil, fmt.Errorf("integração RBXSoft não configurada no painel. Configure a URL e Chave de Integração")
	}

	return rbx.NewClient(rbx.Config{
		URL:     rbxURL,
		Token:   rbxToken,
		Version: rbxVersion,
	}), nil
}

func getUserInfo(r *http.Request) (username, role string) {
	username = r.Header.Get("X-User-Name")
	if username == "" {
		username = "operador"
	}
	role = r.Header.Get("X-User-Role")
	if role == "" {
		role = "admin"
	}
	return
}

func registerPhase2Routes(r chi.Router) {
	// ----------------------------------------------------
	// 1. Operational Management & SLA Analytics
	// ----------------------------------------------------

	// GET /api/analytics/overview
	r.Get("/api/analytics/overview", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		ctx := r.Context()

		period := r.URL.Query().Get("period")
		startDate := r.URL.Query().Get("startDate")
		endDate := r.URL.Query().Get("endDate")
		technicianID, _ := strconv.Atoi(r.URL.Query().Get("technicianId"))
		causeID, _ := strconv.Atoi(r.URL.Query().Get("causeId"))
		ticketType := r.URL.Query().Get("type")
		topic := r.URL.Query().Get("topic")
		if topic == "" {
			topic = r.URL.Query().Get("topicId")
		}

		var topics []string
		if tStr := r.URL.Query().Get("topics"); tStr != "" {
			for _, item := range strings.Split(tStr, ",") {
				if trimmed := strings.TrimSpace(item); trimmed != "" {
					topics = append(topics, trimmed)
				}
			}
		}

		client, err := getRbxClient(ctx)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%s"}`, err.Error()), http.StatusBadRequest)
			return
		}

		_, _, curStart, curEnd, prevStart, prevEnd := analytics.ResolvePeriods(period, startDate, endDate)
		filterStartStr := prevStart.Format("2006-01-02")
		rbxFilter := fmt.Sprintf("Atendimentos.Data_AB >= '%s'", filterStartStr)

		rawTickets, err := client.ConsultarAtendimentosComFiltro(ctx, rbxFilter)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao consultar atendimentos no RBXSoft: %v"}`, err), http.StatusBadGateway)
			return
		}

		// Enriquece com nomes reais
		rbx.EnrichTicketsWithClientNames(ctx, rawTickets, dbPool, client)

		filters := analytics.FilterParams{
			TechnicianID: technicianID,
			Topic:        topic,
			Topics:       topics,
			Type:         ticketType,
			CauseID:      causeID,
		}

		data := analytics.CalculateOverview(rawTickets, period, curStart, curEnd, prevStart, prevEnd, filters)

		username, role := getUserInfo(r)
		audit.Log(audit.Entry{
			Username:  username,
			UserRole:  role,
			Action:    "analytics.view",
			Module:    "analytics",
			Details:   map[string]interface{}{"period": period, "technicianId": technicianID, "type": ticketType},
			IPAddress: r.RemoteAddr,
			RequestID: middleware.GetReqID(ctx),
		})

		json.NewEncoder(w).Encode(data)
	})

	// GET /api/analytics/catalog
	r.Get("/api/analytics/catalog", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(analytics.MetricsCatalog)
	})

	// Handler compartilhado para Drill-down
	handleDrilldown := func(w http.ResponseWriter, r *http.Request, metricID, cellKey, period, startDate, endDate, ticketType string, topics []string) {
		w.Header().Set("Content-Type", "application/json")
		ctx := r.Context()

		if metricID == "" {
			http.Error(w, `{"error": "Parâmetro metricId obrigatório"}`, http.StatusBadRequest)
			return
		}

		client, err := getRbxClient(ctx)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%s"}`, err.Error()), http.StatusBadRequest)
			return
		}

		_, _, curStart, curEnd, prevStart, _ := analytics.ResolvePeriods(period, startDate, endDate)
		filterStartStr := prevStart.Format("2006-01-02")
		rbxFilter := fmt.Sprintf("Atendimentos.Data_AB >= '%s'", filterStartStr)

		rawTickets, err := client.ConsultarAtendimentosComFiltro(ctx, rbxFilter)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao consultar atendimentos no RBX: %v"}`, err), http.StatusBadGateway)
			return
		}

		rbx.EnrichTicketsWithClientNames(ctx, rawTickets, dbPool, client)

		filters := analytics.FilterParams{
			Type:   ticketType,
			Topics: topics,
		}

		matched := analytics.FilterDrillDownTickets(rawTickets, metricID, cellKey, curStart, curEnd, filters)

		username, role := getUserInfo(r)
		audit.Log(audit.Entry{
			Username:  username,
			UserRole:  role,
			Action:    "analytics.drilldown",
			Module:    "analytics",
			Details:   map[string]interface{}{"metricId": metricID, "cellKey": cellKey, "total": len(matched)},
			IPAddress: r.RemoteAddr,
			RequestID: middleware.GetReqID(ctx),
		})

		json.NewEncoder(w).Encode(analytics.DrillDownResponse{
			MetricID: metricID,
			CellKey:  cellKey,
			Total:    len(matched),
			Tickets:  matched,
		})
	}

	// POST /api/analytics/drilldown
	r.Post("/api/analytics/drilldown", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			MetricID  string   `json:"metricId"`
			CellKey   string   `json:"cellKey"`
			Period    string   `json:"period"`
			StartDate string   `json:"startDate"`
			EndDate   string   `json:"endDate"`
			Type      string   `json:"type"`
			Topics    []string `json:"topics"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		handleDrilldown(w, r, req.MetricID, req.CellKey, req.Period, req.StartDate, req.EndDate, req.Type, req.Topics)
	})

	// GET /api/analytics/drilldown
	r.Get("/api/analytics/drilldown", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		var topics []string
		if tStr := q.Get("topics"); tStr != "" {
			topics = strings.Split(tStr, ",")
		}
		handleDrilldown(w, r, q.Get("metricId"), q.Get("cellKey"), q.Get("period"), q.Get("startDate"), q.Get("endDate"), q.Get("type"), topics)
	})

	// POST /api/analytics/export
	r.Post("/api/analytics/export", func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		var req struct {
			MetricID  string   `json:"metricId"`
			CellKey   string   `json:"cellKey"`
			Period    string   `json:"period"`
			StartDate string   `json:"startDate"`
			EndDate   string   `json:"endDate"`
			Type      string   `json:"type"`
			Topics    []string `json:"topics"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req.Period == "" {
			req.Period = "7d"
		}

		client, err := getRbxClient(ctx)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%s"}`, err.Error()), http.StatusBadRequest)
			return
		}

		_, _, curStart, curEnd, prevStart, _ := analytics.ResolvePeriods(req.Period, req.StartDate, req.EndDate)
		filterStartStr := prevStart.Format("2006-01-02")
		rbxFilter := fmt.Sprintf("Atendimentos.Data_AB >= '%s'", filterStartStr)

		rawTickets, err := client.ConsultarAtendimentosComFiltro(ctx, rbxFilter)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao consultar atendimentos no RBX: %v"}`, err), http.StatusBadGateway)
			return
		}

		rbx.EnrichTicketsWithClientNames(ctx, rawTickets, dbPool, client)
		matched := analytics.FilterDrillDownTickets(rawTickets, req.MetricID, req.CellKey, curStart, curEnd, analytics.FilterParams{
			Type:   req.Type,
			Topics: req.Topics,
		})

		username, role := getUserInfo(r)
		csvContent := analytics.ExportCSV(matched, req.MetricID, req.CellKey, username, username, role)

		audit.Log(audit.Entry{
			Username:  username,
			UserRole:  role,
			Action:    "analytics.export",
			Module:    "analytics",
			Details:   map[string]interface{}{"metricId": req.MetricID, "recordsExported": len(matched)},
			IPAddress: r.RemoteAddr,
			RequestID: middleware.GetReqID(ctx),
		})

		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="rbxhub_export_%s_%d.csv"`, req.MetricID, time.Now().Unix()))
		w.Write([]byte(csvContent))
	})

	// ----------------------------------------------------
	// 2. Deep Work Order (OS) Analytics
	// ----------------------------------------------------

	// GET /api/os-analytics/overview
	r.Get("/api/os-analytics/overview", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		ctx := r.Context()
		q := r.URL.Query()

		period := q.Get("period")
		startDate := q.Get("startDate")
		endDate := q.Get("endDate")
		technicianID, _ := strconv.Atoi(q.Get("technicianId"))
		status := q.Get("status")
		search := q.Get("search")
		flowType := q.Get("flowType")
		locality := q.Get("locality")

		var technicians []string
		if tStr := q.Get("technicians"); tStr != "" {
			for _, item := range strings.Split(tStr, ",") {
				if trimmed := strings.TrimSpace(item); trimmed != "" {
					technicians = append(technicians, trimmed)
				}
			}
		} else if tech := q.Get("technician"); tech != "" && tech != "all" {
			technicians = []string{tech}
		}

		client, err := getRbxClient(ctx)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%s"}`, err.Error()), http.StatusBadRequest)
			return
		}

		curStart, curEnd, prevStart, prevEnd := osanalytics.ResolvePeriods(period, startDate, endDate)
		filterStartStr := prevStart.Format("2006-01-02")
		rbxFilter := fmt.Sprintf("Atendimentos.Data_AB >= '%s'", filterStartStr)

		rawTickets, err := client.ConsultarAtendimentosComFiltro(ctx, rbxFilter)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao consultar OS no RBX: %v"}`, err), http.StatusBadGateway)
			return
		}

		// Consulta ocorrências agregadas do período
		occsMap, _ := client.ConsultarOcorrenciasPeriodo(ctx, fmt.Sprintf("Data >= '%s'", filterStartStr))

		rbx.EnrichTicketsWithClientNames(ctx, rawTickets, dbPool, client)

		params := osanalytics.OsFilterParams{
			Period:       period,
			StartDate:    startDate,
			EndDate:      endDate,
			Technicians:  technicians,
			TechnicianID: technicianID,
			Status:       status,
			Search:       search,
			FlowType:     flowType,
			Locality:     locality,
		}

		resp := osanalytics.CalculateOsOverview(rawTickets, period, curStart, curEnd, prevStart, prevEnd, params, occsMap)

		username, role := getUserInfo(r)
		audit.Log(audit.Entry{
			Username:  username,
			UserRole:  role,
			Action:    "os-analytics.view",
			Module:    "os-analytics",
			Details:   map[string]interface{}{"period": period, "technicianId": technicianID, "totalOs": resp.Cards.TotalOs.Value},
			IPAddress: r.RemoteAddr,
			RequestID: middleware.GetReqID(ctx),
		})

		json.NewEncoder(w).Encode(resp)
	})

	// GET /api/os-analytics/technicians
	r.Get("/api/os-analytics/technicians", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		ctx := r.Context()
		q := r.URL.Query()

		client, err := getRbxClient(ctx)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%s"}`, err.Error()), http.StatusBadRequest)
			return
		}

		curStart, curEnd, prevStart, prevEnd := osanalytics.ResolvePeriods(q.Get("period"), q.Get("startDate"), q.Get("endDate"))
		filterStartStr := prevStart.Format("2006-01-02")
		rbxFilter := fmt.Sprintf("Atendimentos.Data_AB >= '%s'", filterStartStr)

		rawTickets, err := client.ConsultarAtendimentosComFiltro(ctx, rbxFilter)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao consultar OS: %v"}`, err), http.StatusBadGateway)
			return
		}

		resp := osanalytics.CalculateOsOverview(rawTickets, q.Get("period"), curStart, curEnd, prevStart, prevEnd, osanalytics.OsFilterParams{}, nil)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"technicians": resp.AvailableTechnicians,
		})
	})

	// GET /api/os-analytics/list
	r.Get("/api/os-analytics/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		ctx := r.Context()
		q := r.URL.Query()

		period := q.Get("period")
		startDate := q.Get("startDate")
		endDate := q.Get("endDate")
		technicianID, _ := strconv.Atoi(q.Get("technicianId"))
		status := q.Get("status")
		search := q.Get("search")
		flowType := q.Get("flowType")
		locality := q.Get("locality")
		page, _ := strconv.Atoi(q.Get("page"))
		limit, _ := strconv.Atoi(q.Get("limit"))

		var technicians []string
		if tStr := q.Get("technicians"); tStr != "" {
			for _, item := range strings.Split(tStr, ",") {
				if trimmed := strings.TrimSpace(item); trimmed != "" {
					technicians = append(technicians, trimmed)
				}
			}
		} else if tech := q.Get("technician"); tech != "" && tech != "all" {
			technicians = []string{tech}
		}

		client, err := getRbxClient(ctx)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%s"}`, err.Error()), http.StatusBadRequest)
			return
		}

		curStart, curEnd, _, _ := osanalytics.ResolvePeriods(period, startDate, endDate)
		filterStartStr := curStart.Format("2006-01-02")
		rbxFilter := fmt.Sprintf("Atendimentos.Data_AB >= '%s'", filterStartStr)

		rawTickets, err := client.ConsultarAtendimentosComFiltro(ctx, rbxFilter)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao consultar atendimentos: %v"}`, err), http.StatusBadGateway)
			return
		}

		rbx.EnrichTicketsWithClientNames(ctx, rawTickets, dbPool, client)

		params := osanalytics.OsFilterParams{
			Period:       period,
			StartDate:    startDate,
			EndDate:      endDate,
			Technicians:  technicians,
			TechnicianID: technicianID,
			Status:       status,
			Search:       search,
			FlowType:     flowType,
			Locality:     locality,
			Page:         page,
			Limit:        limit,
		}

		listResp := osanalytics.FilterTicketList(rawTickets, params, curStart, curEnd)

		// Enriquece ocorrências para os itens da página atual
		for i := range listResp.Tickets {
			if len(listResp.Tickets[i].Ocorrencias) == 0 {
				occs, _ := client.ConsultarOcorrenciasAtendimento(ctx, listResp.Tickets[i].ID)
				if len(occs) > 0 {
					listResp.Tickets[i].Ocorrencias = occs
				}
			}
		}

		json.NewEncoder(w).Encode(listResp)
	})

	// GET /api/os-analytics/aborted
	r.Get("/api/os-analytics/aborted", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		ctx := r.Context()
		q := r.URL.Query()

		period := q.Get("period")
		startDate := q.Get("startDate")
		endDate := q.Get("endDate")
		technicianID, _ := strconv.Atoi(q.Get("technicianId"))
		search := q.Get("search")

		var technicians []string
		if tStr := q.Get("technicians"); tStr != "" {
			for _, item := range strings.Split(tStr, ",") {
				if trimmed := strings.TrimSpace(item); trimmed != "" {
					technicians = append(technicians, trimmed)
				}
			}
		} else if tech := q.Get("technician"); tech != "" && tech != "all" {
			technicians = []string{tech}
		}

		client, err := getRbxClient(ctx)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%s"}`, err.Error()), http.StatusBadRequest)
			return
		}

		curStart, curEnd, prevStart, prevEnd := osanalytics.ResolvePeriods(period, startDate, endDate)
		filterStartStr := prevStart.Format("2006-01-02")
		rbxFilter := fmt.Sprintf("Atendimentos.Data_AB >= '%s'", filterStartStr)

		rawTickets, err := client.ConsultarAtendimentosComFiltro(ctx, rbxFilter)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao consultar OS: %v"}`, err), http.StatusBadGateway)
			return
		}

		occsMap, _ := client.ConsultarOcorrenciasPeriodo(ctx, fmt.Sprintf("Data >= '%s'", filterStartStr))
		rbx.EnrichTicketsWithClientNames(ctx, rawTickets, dbPool, client)

		params := osanalytics.OsFilterParams{
			Period:       period,
			StartDate:    startDate,
			EndDate:      endDate,
			Technicians:  technicians,
			TechnicianID: technicianID,
			Search:       search,
		}

		resp := osanalytics.CalculateOsOverview(rawTickets, period, curStart, curEnd, prevStart, prevEnd, params, occsMap)
		json.NewEncoder(w).Encode(resp.AbortedAnalysis)
	})

	// GET /api/os-analytics/tickets/{id}/occurrences
	r.Get("/api/os-analytics/tickets/{id}/occurrences", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		ctx := r.Context()
		ticketID, err := strconv.Atoi(chi.URLParam(r, "id"))
		if err != nil || ticketID <= 0 {
			http.Error(w, `{"error": "ID de atendimento inválido"}`, http.StatusBadRequest)
			return
		}

		client, err := getRbxClient(ctx)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%s"}`, err.Error()), http.StatusBadRequest)
			return
		}

		occs, err := client.ConsultarOcorrenciasAtendimento(ctx, ticketID)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao consultar ocorrências da OS #%d: %v"}`, ticketID, err), http.StatusBadGateway)
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"ticketId":    ticketID,
			"total":       len(occs),
			"occurrences": occs,
		})
	})

	// ----------------------------------------------------
	// 3. Atendimentos Core & Queue Endpoints
	// ----------------------------------------------------

	// GET /api/atendimentos/meta
	r.Get("/api/atendimentos/meta", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		ctx := r.Context()

		client, err := getRbxClient(ctx)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%s"}`, err.Error()), http.StatusBadRequest)
			return
		}

		topicos, _ := client.ConsultarTopicos(ctx)
		causas, _ := client.ConsultarCausas(ctx)
		fluxos, _ := client.ConsultarFluxos(ctx)
		gruposSla, _ := client.ConsultarGruposSLA(ctx)

		tecnicos := []map[string]interface{}{
			{"id": 1, "nome": "Carlos Silva", "especialidade": "Rede Externa / Fusão"},
			{"id": 2, "nome": "Mariana Ramos", "especialidade": "Suporte Corporativo N2"},
			{"id": 3, "nome": "Roberto Dias", "especialidade": "Instalação FTTH"},
			{"id": 4, "nome": "Lucas Oliveira", "especialidade": "Configurações Wi-Fi / CPE"},
			{"id": 5, "nome": "Patricia Mendes", "especialidade": "Diagnóstico OLT / GPON"},
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"topicos":   topicos,
			"causas":    causas,
			"fluxos":    fluxos,
			"gruposSla": gruposSla,
			"tecnicos":  tecnicos,
		})
	})

	// GET /api/atendimentos
	r.Get("/api/atendimentos", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		ctx := r.Context()
		q := r.URL.Query()

		clientID, _ := strconv.Atoi(q.Get("clientId"))
		search := strings.ToLower(strings.TrimSpace(q.Get("search")))
		slaFilter := q.Get("slaFilter") // 'overdue', 'risk', 'ok'
		ticketType := q.Get("type")

		var selectedTopics []string
		if tStr := q.Get("topics"); tStr != "" {
			for _, item := range strings.Split(tStr, ",") {
				if trimmed := strings.TrimSpace(item); trimmed != "" {
					selectedTopics = append(selectedTopics, trimmed)
				}
			}
		} else if top := q.Get("topic"); top != "" {
			selectedTopics = []string{top}
		}

		var statuses []string
		if sStr := q.Get("status"); sStr != "" {
			statuses = strings.Split(sStr, ",")
		}

		client, err := getRbxClient(ctx)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%s"}`, err.Error()), http.StatusBadRequest)
			return
		}

		var rbxFilter string
		if clientID > 0 {
			rbxFilter = fmt.Sprintf("Atendimentos.Cliente = '%d'", clientID)
		} else {
			defaultStart := time.Now().Add(-30 * 24 * time.Hour).Format("2006-01-02")
			rbxFilter = fmt.Sprintf("Atendimentos.Data_AB >= '%s'", defaultStart)
		}

		rawTickets, err := client.ConsultarAtendimentosComFiltro(ctx, rbxFilter)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao consultar atendimentos no RBX: %v"}`, err), http.StatusBadGateway)
			return
		}

		rbx.EnrichTicketsWithClientNames(ctx, rawTickets, dbPool, client)

		// Extrai contagem de tópicos
		topicCountMap := make(map[string]int)
		for _, t := range rawTickets {
			name := strings.TrimSpace(t.TopicName)
			if name == "" {
				name = "Geral"
			}
			topicCountMap[name]++
		}
		var availableTopics []analytics.AvailableTopic
		for name, count := range topicCountMap {
			availableTopics = append(availableTopics, analytics.AvailableTopic{Name: name, Count: count})
		}

		// Filtros em memória
		var filtered []rbx.TicketDto
		for _, t := range rawTickets {
			if ticketType != "" && ticketType != "all" && !strings.EqualFold(t.Type, ticketType) {
				continue
			}

			if len(selectedTopics) > 0 {
				matchedTopic := false
				for _, st := range selectedTopics {
					if strings.EqualFold(strings.TrimSpace(t.TopicName), strings.TrimSpace(st)) {
						matchedTopic = true
						break
					}
				}
				if !matchedTopic {
					continue
				}
			}

			if len(statuses) > 0 {
				matchedStatus := false
				for _, s := range statuses {
					if strings.EqualFold(strings.TrimSpace(t.Status), strings.TrimSpace(s)) {
						matchedStatus = true
						break
					}
				}
				if !matchedStatus {
					continue
				}
			}

			if search != "" {
				if !strings.Contains(strings.ToLower(t.Protocol), search) &&
					!strings.Contains(strings.ToLower(t.ClientName), search) &&
					!strings.Contains(strings.ToLower(t.TechnicianName), search) &&
					!strings.Contains(strings.ToLower(t.Description), search) {
					continue
				}
			}

			if slaFilter == "overdue" && !t.IsOverdue {
				continue
			} else if slaFilter == "risk" && !t.IsAtRisk {
				continue
			} else if slaFilter == "ok" && t.SlaStatus != rbx.SlaStatusOk {
				continue
			}

			filtered = append(filtered, t)
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"total":           len(filtered),
			"tickets":         filtered,
			"availableTopics": availableTopics,
		})
	})

	// GET /api/atendimentos/{id}
	r.Get("/api/atendimentos/{id}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		ctx := r.Context()
		ticketID, err := strconv.Atoi(chi.URLParam(r, "id"))
		if err != nil || ticketID <= 0 {
			http.Error(w, `{"error": "ID de atendimento inválido"}`, http.StatusBadRequest)
			return
		}

		client, err := getRbxClient(ctx)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%s"}`, err.Error()), http.StatusBadRequest)
			return
		}

		filter := fmt.Sprintf("Atendimentos.Numero = '%d'", ticketID)
		tickets, err := client.ConsultarAtendimentosComFiltro(ctx, filter)
		if err != nil || len(tickets) == 0 {
			http.Error(w, `{"error": "Atendimento não encontrado no RBXSoft"}`, http.StatusNotFound)
			return
		}

		ticket := tickets[0]
		rbx.EnrichTicketsWithClientNames(ctx, []rbx.TicketDto{ticket}, dbPool, client)

		// Consulta ocorrências detalhadas
		occs, _ := client.ConsultarOcorrenciasAtendimento(ctx, ticketID)
		if len(occs) > 0 {
			ticket.Ocorrencias = occs
		}

		username, role := getUserInfo(r)
		audit.Log(audit.Entry{
			Username:  username,
			UserRole:  role,
			Action:    "atendimento.view",
			Module:    "atendimentos",
			RecordID:  strconv.Itoa(ticketID),
			Details:   map[string]interface{}{"protocol": ticket.Protocol},
			IPAddress: r.RemoteAddr,
			RequestID: middleware.GetReqID(ctx),
		})

		json.NewEncoder(w).Encode(ticket)
	})

	// POST /api/atendimentos
	r.Post("/api/atendimentos", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		ctx := r.Context()

		var payload map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, `{"error": "JSON inválido"}`, http.StatusBadRequest)
			return
		}

		client, err := getRbxClient(ctx)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%s"}`, err.Error()), http.StatusBadRequest)
			return
		}

		result, err := client.CadastrarAtendimento(ctx, payload)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao cadastrar atendimento: %v"}`, err), http.StatusInternalServerError)
			return
		}

		username, role := getUserInfo(r)
		audit.Log(audit.Entry{
			Username:  username,
			UserRole:  role,
			Action:    "atendimento.create",
			Module:    "atendimentos",
			Details:   payload,
			IPAddress: r.RemoteAddr,
			RequestID: middleware.GetReqID(ctx),
		})

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(result)
	})
}
