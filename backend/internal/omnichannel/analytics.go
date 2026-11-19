package omnichannel

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// FilterOptions filtros para consultas analíticas omnichannel
type FilterOptions struct {
	BatchID      string
	Agent        string
	StartDate    string
	EndDate      string
	Department   string
	Status       string
	IsAutomation *bool
}

// RecurrenceOptions opções para o relatório de reincidência
type RecurrenceOptions struct {
	BatchID    string
	Agent      string
	StartDate  string
	EndDate    string
	Department string
	Threshold  int
	Limit      int
	Offset     int
}

// GetOverviewMetrics consolida os KPIs gerais da operação omnichannel
func GetOverviewMetrics(ctx context.Context, db *pgxpool.Pool, filters FilterOptions) (*OmnichannelOverviewResponse, error) {
	if db == nil {
		return nil, fmt.Errorf("banco de dados não disponível")
	}

	whereClause, args := buildWhere(filters)

	query := fmt.Sprintf(`
		SELECT 
			COUNT(*) as total_contacts,
			COUNT(DISTINCT rbx_client_id) FILTER (WHERE rbx_client_id IS NOT NULL AND rbx_client_id != '') as distinct_clients,
			COUNT(DISTINCT phone_hmac) as distinct_phones,
			COUNT(*) FILTER (WHERE match_status = 'confirmed') as confirmed,
			COUNT(*) FILTER (WHERE match_status = 'name_suggested') as suggested,
			COUNT(*) FILTER (WHERE match_status = 'ambiguous') as ambiguous,
			COUNT(*) FILTER (WHERE match_status = 'unmatched') as unmatched,
			COALESCE(AVG(handle_time_seconds) FILTER (WHERE handle_time_seconds > 0), 0) as avg_tma,
			COALESCE(AVG(wait_time_seconds) FILTER (WHERE wait_time_seconds > 0), 0) as avg_tme,
			COALESCE(AVG(first_response_seconds) FILTER (WHERE first_response_seconds > 0), 0) as avg_tmr1,
			COUNT(*) FILTER (WHERE wait_time_seconds > 300) as high_wait_count,
			COALESCE(AVG(handle_time_seconds) FILTER (WHERE is_automation = false AND handle_time_seconds > 0), 0) as human_avg_tma,
			COALESCE(AVG(handle_time_seconds) FILTER (WHERE is_automation = true AND handle_time_seconds > 0), 0) as auto_avg_tma
		FROM omnichannel_contact_facts f
		WHERE %s
	`, whereClause)

	var totalContacts, distinctClients, distinctPhones int
	var confirmed, suggested, ambiguous, unmatched int
	var avgTma, avgTme, avgTmr1, humanAvgTma, autoAvgTma float64
	var highWaitCount int

	err := db.QueryRow(ctx, query, args...).Scan(
		&totalContacts, &distinctClients, &distinctPhones,
		&confirmed, &suggested, &ambiguous, &unmatched,
		&avgTma, &avgTme, &avgTmr1, &highWaitCount,
		&humanAvgTma, &autoAvgTma,
	)
	if err != nil {
		return nil, fmt.Errorf("erro ao calcular métricas omnichannel: %w", err)
	}

	matchCoverageRate := 0.0
	if totalContacts > 0 {
		matchCoverageRate = math.Round((float64(confirmed)/float64(totalContacts))*1000) / 10
	}
	highWaitRate := 0.0
	if totalContacts > 0 {
		highWaitRate = math.Round((float64(highWaitCount)/float64(totalContacts))*1000) / 10
	}

	resp := &OmnichannelOverviewResponse{}
	resp.Departments = make([]struct {
		Name          string  `json:"name"`
		Total         int     `json:"total"`
		Percentage    float64 `json:"percentage"`
		AvgTmaSeconds float64 `json:"avgTmaSeconds"`
		AvgTmeSeconds float64 `json:"avgTmeSeconds"`
	}, 0)
	resp.AvailableDepartments = make([]struct {
		Name  string `json:"name"`
		Total int    `json:"total"`
	}, 0)
	resp.AvailableAgents = make([]struct {
		Name  string `json:"name"`
		Total int    `json:"total"`
	}, 0)
	resp.Attributions = make([]struct {
		AgentName     string  `json:"agentName"`
		TotalContacts int     `json:"totalContacts"`
		Percentage    float64 `json:"percentage"`
		AvgTmaSeconds float64 `json:"avgTmaSeconds"`
		AvgTmeSeconds float64 `json:"avgTmeSeconds"`
	}, 0)
	resp.Closures = make([]struct {
		Type       string  `json:"type"`
		Total      int     `json:"total"`
		Percentage float64 `json:"percentage"`
	}, 0)
	resp.Classifications = make([]struct {
		Name          string  `json:"name"`
		Count         int     `json:"count"`
		Percentage    float64 `json:"percentage"`
		AvgTmaSeconds float64 `json:"avgTmaSeconds"`
	}, 0)

	resp.Volume.TotalContacts = totalContacts
	resp.Volume.DistinctClients = distinctClients
	resp.Volume.DistinctPhones = distinctPhones
	resp.Volume.ConfirmedMatches = confirmed
	resp.Volume.SuggestedMatches = suggested
	resp.Volume.AmbiguousMatches = ambiguous
	resp.Volume.UnmatchedContacts = unmatched
	resp.Volume.MatchCoverageRate = matchCoverageRate

	resp.Efficiency.OverallAvgTmaSeconds = math.Round(avgTma*10) / 10
	resp.Efficiency.OverallAvgTmeSeconds = math.Round(avgTme*10) / 10
	resp.Efficiency.OverallAvgTmrFirstSeconds = math.Round(avgTmr1*10) / 10
	resp.Efficiency.ContactsWithHighWaitTime = highWaitCount
	resp.Efficiency.HighWaitTimeRate = highWaitRate
	resp.Efficiency.HumanAvgTmaSeconds = math.Round(humanAvgTma*10) / 10
	resp.Efficiency.AutomationAvgTmaSeconds = math.Round(autoAvgTma*10) / 10
	resp.Efficiency.OverallAvgTotalTimeSeconds = math.Round((avgTma+avgTme)*10) / 10

	// 2. Departamentos
	depQuery := fmt.Sprintf(`
		SELECT COALESCE(department, 'Sem Departamento') as dep_name, COUNT(*) as cnt,
		       COALESCE(AVG(handle_time_seconds) FILTER (WHERE handle_time_seconds > 0), 0) as dep_tma,
		       COALESCE(AVG(wait_time_seconds) FILTER (WHERE wait_time_seconds > 0), 0) as dep_tme
		FROM omnichannel_contact_facts f
		WHERE %s
		GROUP BY 1 ORDER BY cnt DESC
	`, whereClause)

	depRows, err := db.Query(ctx, depQuery, args...)
	if err == nil {
		defer depRows.Close()
		for depRows.Next() {
			var name string
			var cnt int
			var dTma, dTme float64
			if err := depRows.Scan(&name, &cnt, &dTma, &dTme); err == nil {
				pct := 0.0
				if totalContacts > 0 {
					pct = math.Round((float64(cnt)/float64(totalContacts))*1000) / 10
				}
				resp.Departments = append(resp.Departments, struct {
					Name          string  `json:"name"`
					Total         int     `json:"total"`
					Percentage    float64 `json:"percentage"`
					AvgTmaSeconds float64 `json:"avgTmaSeconds"`
					AvgTmeSeconds float64 `json:"avgTmeSeconds"`
				}{
					Name:          name,
					Total:         cnt,
					Percentage:    pct,
					AvgTmaSeconds: math.Round(dTma*10) / 10,
					AvgTmeSeconds: math.Round(dTme*10) / 10,
				})
				resp.AvailableDepartments = append(resp.AvailableDepartments, struct {
					Name  string `json:"name"`
					Total int    `json:"total"`
				}{Name: name, Total: cnt})
			}
		}
	}

	// 3. Atribuições / Atendentes
	agentQuery := fmt.Sprintf(`
		SELECT a.agent_display, COUNT(*) as cnt,
		       COALESCE(AVG(f.handle_time_seconds) FILTER (WHERE f.handle_time_seconds > 0), 0) as a_tma,
		       COALESCE(AVG(f.wait_time_seconds) FILTER (WHERE f.wait_time_seconds > 0), 0) as a_tme
		FROM omnichannel_contact_assignments a
		JOIN omnichannel_contact_facts f ON f.id = a.fact_id
		WHERE %s
		GROUP BY a.agent_display ORDER BY cnt DESC LIMIT 20
	`, whereClause)

	agentRows, err := db.Query(ctx, agentQuery, args...)
	if err == nil {
		defer agentRows.Close()
		for agentRows.Next() {
			var aName string
			var cnt int
			var aTma, aTme float64
			if err := agentRows.Scan(&aName, &cnt, &aTma, &aTme); err == nil {
				pct := 0.0
				if totalContacts > 0 {
					pct = math.Round((float64(cnt)/float64(totalContacts))*1000) / 10
				}
				resp.Attributions = append(resp.Attributions, struct {
					AgentName     string  `json:"agentName"`
					TotalContacts int     `json:"totalContacts"`
					Percentage    float64 `json:"percentage"`
					AvgTmaSeconds float64 `json:"avgTmaSeconds"`
					AvgTmeSeconds float64 `json:"avgTmeSeconds"`
				}{
					AgentName:     aName,
					TotalContacts: cnt,
					Percentage:    pct,
					AvgTmaSeconds: math.Round(aTma*10) / 10,
					AvgTmeSeconds: math.Round(aTme*10) / 10,
				})
				resp.AvailableAgents = append(resp.AvailableAgents, struct {
					Name  string `json:"name"`
					Total int    `json:"total"`
				}{Name: aName, Total: cnt})
			}
		}
	}

	// 4. Tipos de Encerramento
	closureQuery := fmt.Sprintf(`
		SELECT COALESCE(closure_type, 'Normal') as c_type, COUNT(*) as cnt
		FROM omnichannel_contact_facts f
		WHERE %s
		GROUP BY 1 ORDER BY cnt DESC
	`, whereClause)
	cRows, err := db.Query(ctx, closureQuery, args...)
	if err == nil {
		defer cRows.Close()
		for cRows.Next() {
			var cType string
			var cnt int
			if err := cRows.Scan(&cType, &cnt); err == nil {
				pct := 0.0
				if totalContacts > 0 {
					pct = math.Round((float64(cnt)/float64(totalContacts))*1000) / 10
				}
				resp.Closures = append(resp.Closures, struct {
					Type       string  `json:"type"`
					Total      int     `json:"total"`
					Percentage float64 `json:"percentage"`
				}{Type: cType, Total: cnt, Percentage: pct})
			}
		}
	}

	// 5. Pesquisa de Satisfação
	satQuery := fmt.Sprintf(`
		SELECT 
			COUNT(*) FILTER (WHERE satisfaction_status ILIKE '%%respondi%%') as answered,
			COUNT(*) FILTER (WHERE satisfaction_status ILIKE '%%não enviad%%' OR satisfaction_status ILIKE '%%nao enviad%%') as not_sent,
			COUNT(*) FILTER (WHERE satisfaction_status ILIKE '%%expirad%%') as expired
		FROM omnichannel_contact_facts f
		WHERE %s
	`, whereClause)
	var satAnswered, satNotSent, satExpired int
	_ = db.QueryRow(ctx, satQuery, args...).Scan(&satAnswered, &satNotSent, &satExpired)
	resp.Satisfaction.Answered = satAnswered
	resp.Satisfaction.NotSent = satNotSent
	resp.Satisfaction.Expired = satExpired
	if satAnswered+satExpired > 0 {
		resp.Satisfaction.ResponseRate = math.Round((float64(satAnswered)/float64(satAnswered+satExpired))*1000) / 10
	}

	// 6. Classificações / Tags
	classQuery := fmt.Sprintf(`
		SELECT tag, COUNT(*) as cnt,
		       COALESCE(AVG(handle_time_seconds) FILTER (WHERE handle_time_seconds > 0), 0) as avg_tma
		FROM (
			SELECT jsonb_array_elements_text(
				CASE 
					WHEN classification IS NULL OR classification = '' OR classification = '[]' THEN '[]'::jsonb
					WHEN classification LIKE '[%%' THEN classification::jsonb
					ELSE jsonb_build_array(classification)
				END
			) as tag, handle_time_seconds
			FROM omnichannel_contact_facts f
			WHERE %s
		) sub
		WHERE tag != ''
		GROUP BY tag
		ORDER BY cnt DESC
		LIMIT 30
	`, whereClause)
	classRows, err := db.Query(ctx, classQuery, args...)
	if err == nil {
		defer classRows.Close()
		for classRows.Next() {
			var tagName string
			var cnt int
			var avgTmaSec float64
			if err := classRows.Scan(&tagName, &cnt, &avgTmaSec); err == nil {
				pct := 0.0
				if totalContacts > 0 {
					pct = math.Round((float64(cnt)/float64(totalContacts))*1000) / 10
				}
				resp.Classifications = append(resp.Classifications, struct {
					Name          string  `json:"name"`
					Count         int     `json:"count"`
					Percentage    float64 `json:"percentage"`
					AvgTmaSeconds float64 `json:"avgTmaSeconds"`
				}{
					Name:          tagName,
					Count:         cnt,
					Percentage:    pct,
					AvgTmaSeconds: math.Round(avgTmaSec*10) / 10,
				})
			}
		}
	}

	return resp, nil
}

// GetRecurrenceSummary gera ranking de clientes com contatos múltiplos/reincidentes
func GetRecurrenceSummary(ctx context.Context, db *pgxpool.Pool, opts RecurrenceOptions) (*RecurrenceSummaryResponse, error) {
	if db == nil {
		return nil, fmt.Errorf("banco de dados não disponível")
	}

	threshold := opts.Threshold
	if threshold < 2 {
		threshold = 2
	}
	limit := opts.Limit
	if limit < 1 || limit > 100 {
		limit = 25
	}
	offset := opts.Offset
	if offset < 0 {
		offset = 0
	}

	filterOpts := FilterOptions{
		BatchID:    opts.BatchID,
		Agent:      opts.Agent,
		StartDate:  opts.StartDate,
		EndDate:    opts.EndDate,
		Department: opts.Department,
	}
	whereClause, args := buildWhere(filterOpts)
	idx := len(args) + 1

	query := fmt.Sprintf(`
		SELECT 
			COALESCE(f.rbx_client_id, f.phone_hmac) as client_key,
			f.rbx_client_id,
			MAX(COALESCE(f.name_masked, 'Cliente')) as customer_name,
			MAX(f.phone_masked) as phone_masked,
			MAX(f.match_status) as match_status,
			COUNT(*) as total_contacts,
			COUNT(DISTINCT DATE(f.started_at)) as distinct_days,
			MIN(f.started_at) as first_contact,
			MAX(f.started_at) as last_contact
		FROM omnichannel_contact_facts f
		WHERE %s
		GROUP BY 1, 2
		HAVING COUNT(*) >= $%d
		ORDER BY total_contacts DESC, last_contact DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, idx, idx+1, idx+2)

	fullArgs := append(args, threshold, limit, offset)

	rows, err := db.Query(ctx, query, fullArgs...)
	if err != nil {
		return nil, fmt.Errorf("erro na consulta de reincidência: %w", err)
	}
	defer rows.Close()

	items := make([]RecurrenceClientItem, 0)
	for rows.Next() {
		var key string
		var rbxID *string
		var name, phone, matchSt string
		var total, days int
		var first, last time.Time

		if err := rows.Scan(&key, &rbxID, &name, &phone, &matchSt, &total, &days, &first, &last); err == nil {
			items = append(items, RecurrenceClientItem{
				Key:            key,
				RbxClientID:    rbxID,
				CustomerName:   name,
				PhoneDisplay:   phone,
				TotalContacts:  total,
				DistinctDays:   days,
				MatchStatus:    matchSt,
				FirstContactAt: first.Format(time.RFC3339),
				LastContactAt:  last.Format(time.RFC3339),
			})
		}
	}

	// Contadores agregados
	countQuery := fmt.Sprintf(`
		SELECT 
			COUNT(*) FILTER (WHERE cnt >= 2) as two_plus,
			COUNT(*) FILTER (WHERE cnt >= 3) as three_plus,
			COALESCE(MAX(cnt), 0) as max_contacts
		FROM (
			SELECT COUNT(*) as cnt
			FROM omnichannel_contact_facts f
			WHERE %s
			GROUP BY COALESCE(f.rbx_client_id, f.phone_hmac)
		) sub
	`, whereClause)

	var twoPlus, threePlus, maxContacts int
	_ = db.QueryRow(ctx, countQuery, args...).Scan(&twoPlus, &threePlus, &maxContacts)

	return &RecurrenceSummaryResponse{
		ClientsWithTwoPlus:        twoPlus,
		ClientsWithThreePlus:      threePlus,
		MaxContactsBySingleClient: maxContacts,
		TopClients:                items,
		TotalRecords:              twoPlus,
	}, nil
}

func buildWhere(f FilterOptions) (string, []interface{}) {
	var clauses []string
	var args []interface{}
	idx := 1

	if f.BatchID != "" {
		ids := strings.Split(f.BatchID, ",")
		var batchIds []string
		for _, s := range ids {
			s = strings.TrimSpace(s)
			if s != "" {
				batchIds = append(batchIds, s)
			}
		}
		if len(batchIds) == 1 {
			clauses = append(clauses, fmt.Sprintf("f.batch_id = $%d", idx))
			args = append(args, batchIds[0])
			idx++
		} else if len(batchIds) > 1 {
			placeholders := make([]string, len(batchIds))
			for i, bid := range batchIds {
				placeholders[i] = fmt.Sprintf("$%d", idx)
				args = append(args, bid)
				idx++
			}
			clauses = append(clauses, fmt.Sprintf("f.batch_id IN (%s)", strings.Join(placeholders, ", ")))
		}
	}
	if f.StartDate != "" {
		clauses = append(clauses, fmt.Sprintf("f.started_at >= $%d", idx))
		args = append(args, f.StartDate)
		idx++
	}
	if f.EndDate != "" {
		clauses = append(clauses, fmt.Sprintf("f.started_at <= $%d", idx))
		args = append(args, f.EndDate)
		idx++
	}
	if f.Department != "" {
		clauses = append(clauses, fmt.Sprintf("f.department = $%d", idx))
		args = append(args, f.Department)
		idx++
	}
	if f.Status != "" {
		clauses = append(clauses, fmt.Sprintf("f.status = $%d", idx))
		args = append(args, f.Status)
		idx++
	}
	if f.IsAutomation != nil {
		clauses = append(clauses, fmt.Sprintf("f.is_automation = $%d", idx))
		args = append(args, *f.IsAutomation)
		idx++
	}
	if f.Agent != "" {
		agents := strings.Split(f.Agent, ",")
		var agentList []string
		for _, s := range agents {
			s = strings.TrimSpace(s)
			if s != "" {
				agentList = append(agentList, s)
			}
		}
		if len(agentList) == 1 {
			clauses = append(clauses, fmt.Sprintf(`EXISTS (
				SELECT 1 FROM omnichannel_contact_assignments _a 
				WHERE _a.fact_id = f.id AND _a.agent_display = $%d
			)`, idx))
			args = append(args, agentList[0])
			idx++
		} else if len(agentList) > 1 {
			placeholders := make([]string, len(agentList))
			for i, ag := range agentList {
				placeholders[i] = fmt.Sprintf("$%d", idx)
				args = append(args, ag)
				idx++
			}
			clauses = append(clauses, fmt.Sprintf(`EXISTS (
				SELECT 1 FROM omnichannel_contact_assignments _a 
				WHERE _a.fact_id = f.id AND _a.agent_display IN (%s)
			)`, strings.Join(placeholders, ", ")))
		}
	}

	if len(clauses) == 0 {
		return "1=1", nil
	}
	return strings.Join(clauses, " AND "), args
}
