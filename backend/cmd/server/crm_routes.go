package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"evad-backend/internal/crm"
)

func registerSalesRoutes(r chi.Router) {
	// ----------------------------------------------------
	// 1. Carteira de Leads
	// ----------------------------------------------------

	// GET /api/sales/leads
	r.Get("/api/sales/leads", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		q := r.URL.Query()

		page, _ := strconv.Atoi(q.Get("page"))
		limit, _ := strconv.Atoi(q.Get("limit"))

		filter := crm.GetLeadsFilter{
			Stage:             q.Get("stage"),
			Owner:             q.Get("owner"),
			Search:            q.Get("search"),
			Source:            q.Get("source"),
			OverdueOnly:       q.Get("overdueOnly") == "true",
			NoNextContactOnly: q.Get("noNextContactOnly") == "true",
			Period:            q.Get("period"),
			StartDate:         q.Get("startDate"),
			EndDate:           q.Get("endDate"),
			Page:              page,
			Limit:             limit,
		}

		rbxClient, _ := getRbxClient(r.Context())
		res, err := crm.GetLeads(r.Context(), filter, rbxClient)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao listar leads: %v"}`, err), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(res)
	})

	// GET /api/sales/leads/{id}
	r.Get("/api/sales/leads/{id}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		id, err := strconv.Atoi(chi.URLParam(r, "id"))
		if err != nil || id <= 0 {
			http.Error(w, `{"error": "ID do lead inválido"}`, http.StatusBadRequest)
			return
		}

		rbxClient, _ := getRbxClient(r.Context())
		res, err := crm.GetLeadById(r.Context(), id, rbxClient)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}
		if res == nil {
			http.Error(w, `{"error": "Lead não encontrado"}`, http.StatusNotFound)
			return
		}

		json.NewEncoder(w).Encode(res)
	})

	// POST /api/sales/leads
	r.Post("/api/sales/leads", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var input crm.CreateLeadInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, `{"error": "JSON inválido"}`, http.StatusBadRequest)
			return
		}

		if strings.TrimSpace(input.Name) == "" {
			http.Error(w, `{"error": "Nome do lead é obrigatório"}`, http.StatusBadRequest)
			return
		}

		username, role := getUserInfo(r)
		user := crm.UserContext{
			Username: username,
			Role:     role,
		}

		lead, err := crm.CreateLead(r.Context(), input, user)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(lead)
	})

	// PATCH /api/sales/leads/{id}
	r.Patch("/api/sales/leads/{id}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		id, err := strconv.Atoi(chi.URLParam(r, "id"))
		if err != nil || id <= 0 {
			http.Error(w, `{"error": "ID inválido"}`, http.StatusBadRequest)
			return
		}

		var input crm.UpdateLeadInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, `{"error": "JSON inválido"}`, http.StatusBadRequest)
			return
		}

		username, role := getUserInfo(r)
		user := crm.UserContext{
			Username: username,
			Role:     role,
		}

		lead, err := crm.UpdateLead(r.Context(), id, input, user)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(lead)
	})

	// ----------------------------------------------------
	// 2. Oportunidades & Atividades Comerciais
	// ----------------------------------------------------

	// GET /api/sales/leads/{id}/activities
	r.Get("/api/sales/leads/{id}/activities", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		id, err := strconv.Atoi(chi.URLParam(r, "id"))
		if err != nil || id <= 0 {
			http.Error(w, `{"error": "ID inválido"}`, http.StatusBadRequest)
			return
		}

		rbxClient, _ := getRbxClient(r.Context())
		detail, err := crm.GetLeadById(r.Context(), id, rbxClient)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}
		if detail == nil {
			http.Error(w, `{"error": "Lead não encontrado"}`, http.StatusNotFound)
			return
		}

		json.NewEncoder(w).Encode(detail.Activities)
	})

	// POST /api/sales/leads/{id}/activities
	r.Post("/api/sales/leads/{id}/activities", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		id, err := strconv.Atoi(chi.URLParam(r, "id"))
		if err != nil || id <= 0 {
			http.Error(w, `{"error": "ID inválido"}`, http.StatusBadRequest)
			return
		}

		var input crm.CreateCommercialActivityInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, `{"error": "JSON inválido"}`, http.StatusBadRequest)
			return
		}

		if input.TopicID <= 0 || strings.TrimSpace(input.Description) == "" {
			http.Error(w, `{"error": "Tópico e descrição são obrigatórios"}`, http.StatusBadRequest)
			return
		}

		username, role := getUserInfo(r)
		user := crm.UserContext{
			Username: username,
			Role:     role,
		}

		act, err := crm.CreateLeadActivity(r.Context(), id, input, user)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(act)
	})

	// POST /api/sales/activities/{id}/occurrences
	r.Post("/api/sales/activities/{id}/occurrences", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		id, err := strconv.Atoi(chi.URLParam(r, "id"))
		if err != nil || id <= 0 {
			http.Error(w, `{"error": "ID inválido"}`, http.StatusBadRequest)
			return
		}

		var body struct {
			Text string `json:"text"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Text) == "" {
			http.Error(w, `{"error": "Texto da ocorrência é obrigatório"}`, http.StatusBadRequest)
			return
		}

		username, role := getUserInfo(r)
		user := crm.UserContext{
			Username: username,
			Role:     role,
		}

		if err := crm.AddActivityOccurrence(r.Context(), id, body.Text, user); err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Ocorrência registrada com sucesso.",
		})
	})

	// POST /api/sales/activities/{id}/finish
	r.Post("/api/sales/activities/{id}/finish", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		id, err := strconv.Atoi(chi.URLParam(r, "id"))
		if err != nil || id <= 0 {
			http.Error(w, `{"error": "ID inválido"}`, http.StatusBadRequest)
			return
		}

		username, role := getUserInfo(r)
		user := crm.UserContext{
			Username: username,
			Role:     role,
		}

		if err := crm.FinishActivity(r.Context(), id, user); err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Atendimento comercial encerrado com sucesso.",
		})
	})

	// GET /api/sales/topics
	r.Get("/api/sales/topics", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		topics, err := crm.GetCommercialTopics(r.Context())
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(topics)
	})

	// ----------------------------------------------------
	// 3. Emissão Assistida de Contrato
	// ----------------------------------------------------

	// POST /api/sales/contracts
	r.Post("/api/sales/contracts", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var input crm.CreateAssistedContractInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, `{"error": "JSON inválido"}`, http.StatusBadRequest)
			return
		}

		if input.OriginProspectId <= 0 {
			http.Error(w, `{"error": "ID do lead de origem é obrigatório"}`, http.StatusBadRequest)
			return
		}

		username, role := getUserInfo(r)
		user := crm.UserContext{
			Username: username,
			Role:     role,
		}

		result, err := crm.CreateAssistedContract(r.Context(), input, user)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusBadRequest)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(result)
	})

	// ----------------------------------------------------
	// 4. Painel Comercial (Insights & Rankings)
	// ----------------------------------------------------

	// GET /api/sales/insights
	r.Get("/api/sales/insights", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		q := r.URL.Query()

		filter := crm.CommercialFilter{
			Period:                q.Get("period"),
			StartDate:             q.Get("startDate"),
			EndDate:               q.Get("endDate"),
			Seller:                q.Get("seller"),
			Sellers:               q["sellers"],
			City:                  q.Get("city"),
			Region:                q.Get("region"),
			Group:                 q.Get("group"),
			ExcludeReasons:        q["excludeReasons"],
			Reasons:               q["reasons"],
			ExcludePlans:          q["excludePlans"],
			Plans:                 q["plans"],
			HideInactiveSellers:   q.Get("hideInactiveSellers") == "true",
			HideThirdPartySellers: q.Get("hideThirdPartySellers") == "true",
			HideUnassignedSellers: q.Get("hideUnassignedSellers") == "true",
		}

		rbxClient, _ := getRbxClient(r.Context())
		dashboard, err := crm.GetCommercialDashboard(r.Context(), filter, rbxClient, dbPool)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(dashboard)
	})

	// GET /api/sales/insights/drilldown
	r.Get("/api/sales/insights/drilldown", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		q := r.URL.Query()

		metricId := q.Get("metricId")
		if metricId == "" {
			metricId = "vendas_fechadas"
		}

		filter := crm.CommercialFilter{
			Period:                q.Get("period"),
			StartDate:             q.Get("startDate"),
			EndDate:               q.Get("endDate"),
			Seller:                q.Get("seller"),
			Sellers:               q["sellers"],
			City:                  q.Get("city"),
			Region:                q.Get("region"),
			Group:                 q.Get("group"),
			ExcludeReasons:        q["excludeReasons"],
			Reasons:               q["reasons"],
			ExcludePlans:          q["excludePlans"],
			Plans:                 q["plans"],
			HideInactiveSellers:   q.Get("hideInactiveSellers") == "true",
			HideThirdPartySellers: q.Get("hideThirdPartySellers") == "true",
			HideUnassignedSellers: q.Get("hideUnassignedSellers") == "true",
		}

		rbxClient, _ := getRbxClient(r.Context())
		drilldown, err := crm.GetAnalyticsDrilldown(r.Context(), metricId, filter, rbxClient, dbPool)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusBadRequest)
			return
		}

		json.NewEncoder(w).Encode(drilldown)
	})

	// POST /api/sales/insights/export
	r.Post("/api/sales/insights/export", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			MetricID              string   `json:"metricId"`
			Period                string   `json:"period"`
			StartDate             string   `json:"startDate"`
			EndDate               string   `json:"endDate"`
			Seller                string   `json:"seller"`
			Sellers               []string `json:"sellers"`
			City                  string   `json:"city"`
			Region                string   `json:"region"`
			Group                 string   `json:"group"`
			ExcludeReasons        []string `json:"excludeReasons"`
			Reasons               []string `json:"reasons"`
			ExcludePlans          []string `json:"excludePlans"`
			Plans                 []string `json:"plans"`
			HideInactiveSellers   bool     `json:"hideInactiveSellers"`
			HideThirdPartySellers bool     `json:"hideThirdPartySellers"`
			HideUnassignedSellers bool     `json:"hideUnassignedSellers"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)

		metricId := body.MetricID
		if metricId == "" {
			metricId = "vendas_fechadas"
		}

		filter := crm.CommercialFilter{
			Period:                body.Period,
			StartDate:             body.StartDate,
			EndDate:               body.EndDate,
			Seller:                body.Seller,
			Sellers:               body.Sellers,
			City:                  body.City,
			Region:                body.Region,
			Group:                 body.Group,
			ExcludeReasons:        body.ExcludeReasons,
			Reasons:               body.Reasons,
			ExcludePlans:          body.ExcludePlans,
			Plans:                 body.Plans,
			HideInactiveSellers:   body.HideInactiveSellers,
			HideThirdPartySellers: body.HideThirdPartySellers,
			HideUnassignedSellers: body.HideUnassignedSellers,
		}

		username, role := getUserInfo(r)
		user := crm.UserContext{
			Username: username,
			Role:     role,
		}

		rbxClient, _ := getRbxClient(r.Context())
		csvBytes, err := crm.ExportAnalyticsCsv(r.Context(), metricId, filter, user, rbxClient, dbPool)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="rbx_crm_%s_%d.csv"`, metricId, time.Now().Unix()))
		w.Write(csvBytes)
	})

	// GET /api/sales/contracts/{number}
	r.Get("/api/sales/contracts/{number}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		number := chi.URLParam(r, "number")
		contract, err := crm.GetContractDetails(r.Context(), number, dbPool)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}
		if contract == nil {
			http.Error(w, fmt.Sprintf(`{"error": "Contrato #%s não localizado no RBXSoft"}`, number), http.StatusNotFound)
			return
		}

		json.NewEncoder(w).Encode(contract)
	})
}
