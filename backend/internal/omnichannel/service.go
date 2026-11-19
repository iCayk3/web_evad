package omnichannel

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ListBatches lista todos os lotes de importação do ISPCHAT ordenados por data
func ListBatches(ctx context.Context, db *pgxpool.Pool) ([]BatchSummary, error) {
	if db == nil {
		return nil, fmt.Errorf("banco de dados não disponível")
	}

	rows, err := db.Query(ctx, `
		SELECT id, file_hash, file_name, file_size, total_rows, accepted_rows, rejected_rows, duplicate_rows,
		       match_confirmed, match_name_suggested, match_ambiguous, match_unmatched, status,
		       error_message, imported_by, created_at, completed_at,
		       detected_period_start, detected_period_end
		FROM omnichannel_import_batches
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	batches := make([]BatchSummary, 0)
	for rows.Next() {
		var b BatchSummary
		if err := rows.Scan(
			&b.ID, &b.FileHash, &b.FileName, &b.FileSize, &b.TotalRows, &b.AcceptedRows, &b.RejectedRows, &b.DuplicateRows,
			&b.MatchConfirmed, &b.MatchNameSuggested, &b.MatchAmbiguous, &b.MatchUnmatched, &b.Status,
			&b.ErrorMessage, &b.ImportedBy, &b.CreatedAt, &b.CompletedAt,
			&b.DetectedPeriodStart, &b.DetectedPeriodEnd,
		); err == nil {
			batches = append(batches, b)
		}
	}
	return batches, nil
}

// GetBatchDetails busca detalhes de um lote específico
func GetBatchDetails(ctx context.Context, db *pgxpool.Pool, batchID string) (*BatchSummary, error) {
	if db == nil {
		return nil, fmt.Errorf("banco de dados não disponível")
	}

	var b BatchSummary
	err := db.QueryRow(ctx, `
		SELECT id, file_hash, file_name, file_size, total_rows, accepted_rows, rejected_rows, duplicate_rows,
		       match_confirmed, match_name_suggested, match_ambiguous, match_unmatched, status,
		       error_message, imported_by, created_at, completed_at,
		       detected_period_start, detected_period_end
		FROM omnichannel_import_batches
		WHERE id = $1
	`, batchID).Scan(
		&b.ID, &b.FileHash, &b.FileName, &b.FileSize, &b.TotalRows, &b.AcceptedRows, &b.RejectedRows, &b.DuplicateRows,
		&b.MatchConfirmed, &b.MatchNameSuggested, &b.MatchAmbiguous, &b.MatchUnmatched, &b.Status,
		&b.ErrorMessage, &b.ImportedBy, &b.CreatedAt, &b.CompletedAt,
		&b.DetectedPeriodStart, &b.DetectedPeriodEnd,
	)
	if err != nil {
		return nil, fmt.Errorf("lote %s não encontrado: %w", batchID, err)
	}
	return &b, nil
}

// BatchErrorDto detalhes de erro de importação de uma linha
type BatchErrorDto struct {
	RowNumber    int     `json:"row_number"`
	FieldName    string  `json:"field_name"`
	ErrorCode    string  `json:"error_code"`
	ErrorMessage string  `json:"error_message"`
	RawValue     *string `json:"raw_value"`
}

// GetBatchErrors busca as linhas rejeitadas e erros de um lote
func GetBatchErrors(ctx context.Context, db *pgxpool.Pool, batchID string) ([]BatchErrorDto, error) {
	if db == nil {
		return nil, fmt.Errorf("banco de dados não disponível")
	}
	rows, err := db.Query(ctx, `
		SELECT row_number, COALESCE(field_name, ''), error_code, error_message, raw_value
		FROM omnichannel_import_errors
		WHERE batch_id = $1
		ORDER BY row_number ASC
	`, batchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var errors []BatchErrorDto
	for rows.Next() {
		var e BatchErrorDto
		if err := rows.Scan(&e.RowNumber, &e.FieldName, &e.ErrorCode, &e.ErrorMessage, &e.RawValue); err == nil {
			errors = append(errors, e)
		}
	}
	if errors == nil {
		errors = []BatchErrorDto{}
	}
	return errors, nil
}

// DeleteBatch remove um lote e todos os seus registros em cascata
func DeleteBatch(ctx context.Context, db *pgxpool.Pool, batchID string) error {
	if db == nil {
		return fmt.Errorf("banco de dados não disponível")
	}
	_, err := db.Exec(ctx, "DELETE FROM omnichannel_import_batches WHERE id = $1", batchID)
	return err
}

// GetReviewQueue lista atendimentos com match pendente de validação humana (name_suggested ou ambiguous)
func GetReviewQueue(ctx context.Context, db *pgxpool.Pool, batchID string, limit, offset int) ([]MatchReviewItem, int, int, int, error) {
	if db == nil {
		return nil, 0, 0, 0, fmt.Errorf("banco de dados não disponível")
	}

	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	whereClause := "WHERE match_status IN ('name_suggested', 'ambiguous')"
	var args []interface{}
	idx := 1
	if batchID != "" {
		whereClause += fmt.Sprintf(" AND batch_id = $%d", idx)
		args = append(args, batchID)
		idx++
	}

	var total, totalSuggested, totalAmbiguous int
	countQuery := fmt.Sprintf(`
		SELECT 
			COUNT(*),
			COALESCE(COUNT(*) FILTER (WHERE match_status = 'name_suggested'), 0),
			COALESCE(COUNT(*) FILTER (WHERE match_status = 'ambiguous'), 0)
		FROM omnichannel_contact_facts 
		%s
	`, whereClause)
	_ = db.QueryRow(ctx, countQuery, args...).Scan(&total, &totalSuggested, &totalAmbiguous)

	query := fmt.Sprintf(`
		SELECT id, batch_id, conversation_id, phone_masked, COALESCE(name_masked, 'Cliente'),
		       name_normalized, match_status, match_method, match_confidence, rbx_client_id,
		       started_at, COALESCE(department, '')
		FROM omnichannel_contact_facts
		%s
		ORDER BY match_status ASC, started_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, idx, idx+1)

	fullArgs := append(args, limit, offset)
	rows, err := db.Query(ctx, query, fullArgs...)
	if err != nil {
		return nil, 0, 0, 0, err
	}
	defer rows.Close()

	items := make([]MatchReviewItem, 0)
	for rows.Next() {
		var id, bID, convID, phone, name, st, dep string
		var nameNorm, matchMeth, rbxID *string
		var conf *float64
		var startedAt time.Time

		if err := rows.Scan(&id, &bID, &convID, &phone, &name, &nameNorm, &st, &matchMeth, &conf, &rbxID, &startedAt, &dep); err == nil {
			items = append(items, MatchReviewItem{
				ID:              id,
				FactID:          id,
				BatchID:         bID,
				ConversationID:  convID,
				PhoneMasked:     phone,
				NameMasked:      name,
				NameNormalized:  nameNorm,
				MatchStatus:     st,
				MatchMethod:     matchMeth,
				MatchConfidence: conf,
				RbxClientID:     rbxID,
				CurrentClientID: rbxID,
				StartedAt:       startedAt.Format(time.RFC3339),
				Department:      dep,
			})
		}
	}

	return items, total, totalSuggested, totalAmbiguous, nil
}

// ApplyReviewDecision aplica decisão de revisão individual
func ApplyReviewDecision(
	ctx context.Context,
	db *pgxpool.Pool,
	factID, newStatus, selectedRbxClientID, reason, reviewedBy string,
) error {
	if db == nil {
		return fmt.Errorf("banco de dados não disponível")
	}

	var batchID, phoneHMAC, previousStatus string
	var currentClientID *string

	err := db.QueryRow(ctx, `
		SELECT batch_id, phone_hmac, match_status, rbx_client_id 
		FROM omnichannel_contact_facts WHERE id = $1
	`, factID).Scan(&batchID, &phoneHMAC, &previousStatus, &currentClientID)
	if err != nil {
		return fmt.Errorf("atendimento %s não encontrado: %w", factID, err)
	}

	finalClientID := selectedRbxClientID
	if finalClientID == "" && currentClientID != nil {
		finalClientID = *currentClientID
	}
	if newStatus == "unmatched" {
		finalClientID = ""
	}

	reviewID := "rev_" + uuid.New().String()
	now := time.Now()

	// 1. Registra auditoria da decisão na tabela de revisões
	_, err = db.Exec(ctx, `
		INSERT INTO omnichannel_match_reviews (
			id, fact_id, phone_hmac, previous_status, new_status, selected_rbx_client_id, reason, reviewed_by, reviewed_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, reviewID, factID, phoneHMAC, previousStatus, newStatus, finalClientID, reason, reviewedBy, now)
	if err != nil {
		return fmt.Errorf("erro ao registrar revisão: %w", err)
	}

	// 2. Atualiza o fato
	var clientIDParam *string
	if finalClientID != "" {
		clientIDParam = &finalClientID
	}
	_, err = db.Exec(ctx, `
		UPDATE omnichannel_contact_facts
		SET match_status = $1, rbx_client_id = $2, match_method = 'manual'
		WHERE id = $3
	`, newStatus, clientIDParam, factID)
	if err != nil {
		return fmt.Errorf("erro ao atualizar fato: %w", err)
	}

	// 3. Salva no mapeamento conhecido se confirmado
	if newStatus == "confirmed" && finalClientID != "" && phoneHMAC != "" {
		mapID := "map_" + uuid.New().String()
		_, _ = db.Exec(ctx, `
			INSERT INTO omnichannel_known_mappings (id, phone_hmac, rbx_client_id, created_by, created_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (phone_hmac) DO UPDATE SET rbx_client_id = $3
		`, mapID, phoneHMAC, finalClientID, reviewedBy, now)
	}

	return nil
}

// BatchApprove aprova em massa todos os atendimentos com status 'name_suggested'
func BatchApprove(ctx context.Context, db *pgxpool.Pool, reviewedBy string) (int, error) {
	if db == nil {
		return 0, fmt.Errorf("banco de dados não disponível")
	}

	res, err := db.Exec(ctx, `
		UPDATE omnichannel_contact_facts
		SET match_status = 'confirmed', match_method = 'batch_approved'
		WHERE match_status = 'name_suggested' AND rbx_client_id IS NOT NULL AND rbx_client_id != ''
	`)
	if err != nil {
		return 0, err
	}
	return int(res.RowsAffected()), nil
}

// GetContacts busca atendimentos paginados com filtros detalhados
func GetContacts(ctx context.Context, db *pgxpool.Pool, opts ContactFilterOptions) ([]ContactFactDto, int, error) {
	if db == nil {
		return nil, 0, fmt.Errorf("banco de dados não disponível")
	}

	limit := opts.Limit
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	offset := opts.Offset
	if offset < 0 {
		offset = 0
	}

	var clauses []string
	var args []interface{}
	idx := 1

	if opts.BatchID != "" {
		ids := strings.Split(opts.BatchID, ",")
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

	if opts.Agent != "" {
		agents := strings.Split(opts.Agent, ",")
		var agentList []string
		for _, s := range agents {
			s = strings.TrimSpace(s)
			if s != "" {
				agentList = append(agentList, s)
			}
		}
		if len(agentList) == 1 {
			clauses = append(clauses, fmt.Sprintf("EXISTS (SELECT 1 FROM omnichannel_contact_assignments _a WHERE _a.fact_id = f.id AND _a.agent_display = $%d)", idx))
			args = append(args, agentList[0])
			idx++
		} else if len(agentList) > 1 {
			placeholders := make([]string, len(agentList))
			for i, ag := range agentList {
				placeholders[i] = fmt.Sprintf("$%d", idx)
				args = append(args, ag)
				idx++
			}
			clauses = append(clauses, fmt.Sprintf("EXISTS (SELECT 1 FROM omnichannel_contact_assignments _a WHERE _a.fact_id = f.id AND _a.agent_display IN (%s))", strings.Join(placeholders, ", ")))
		}
	}

	if opts.Department != "" {
		if opts.Department == "Automação / Sem Setor" {
			clauses = append(clauses, fmt.Sprintf("(f.department IS NULL OR f.department = $%d)", idx))
		} else {
			clauses = append(clauses, fmt.Sprintf("f.department = $%d", idx))
		}
		args = append(args, opts.Department)
		idx++
	}

	if opts.ClosureType != "" {
		clauses = append(clauses, fmt.Sprintf("f.closure_type = $%d", idx))
		args = append(args, opts.ClosureType)
		idx++
	}

	if opts.Classification != "" {
		clauses = append(clauses, fmt.Sprintf("f.classification ILIKE $%d", idx))
		args = append(args, "%"+opts.Classification+"%")
		idx++
	}

	if opts.Search != "" {
		pattern := "%" + opts.Search + "%"
		clauses = append(clauses, fmt.Sprintf("(f.phone_masked ILIKE $%d OR f.name_normalized ILIKE $%d OR f.name_masked ILIKE $%d OR f.conversation_id ILIKE $%d OR f.protocol_number ILIKE $%d)", idx, idx, idx, idx, idx))
		args = append(args, pattern)
		idx++
	}

	whereClause := "1=1"
	if len(clauses) > 0 {
		whereClause = strings.Join(clauses, " AND ")
	}

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM omnichannel_contact_facts f WHERE %s", whereClause)
	var totalCount int
	_ = db.QueryRow(ctx, countQuery, args...).Scan(&totalCount)

	orderCol := "f.started_at"
	sortDir := "DESC"
	if strings.ToLower(opts.SortDir) == "asc" {
		sortDir = "ASC"
	}

	allowedSort := map[string]string{
		"started_at":          "f.started_at",
		"conversation_id":     "f.conversation_id",
		"protocol_number":     "f.protocol_number",
		"name_normalized":     "f.name_normalized",
		"department":          "f.department",
		"closure_type":        "f.closure_type",
		"classification":      "f.classification",
		"handle_time_seconds": "f.handle_time_seconds",
		"wait_time_seconds":   "f.wait_time_seconds",
		"match_status":        "f.match_status",
	}
	if col, ok := allowedSort[opts.SortBy]; ok {
		orderCol = col
	}

	query := fmt.Sprintf(`
		SELECT f.id, f.batch_id, f.conversation_id, f.protocol_number, f.phone_masked, f.name_masked, f.name_normalized,
		       f.rbx_client_id, f.match_status, f.match_method, f.match_confidence, f.started_at,
		       f.department, f.handle_time_seconds, f.wait_time_seconds, f.status, f.closure_type,
		       f.first_response_seconds, f.is_automation, f.classification, f.description,
		       COALESCE(f.messages_received, 0), COALESCE(f.messages_sent, 0), COALESCE(f.messages_internal, 0),
		       (SELECT agent_display FROM omnichannel_contact_assignments WHERE fact_id = f.id LIMIT 1) as agent_display
		FROM omnichannel_contact_facts f
		WHERE %s
		ORDER BY %s %s
		LIMIT $%d OFFSET $%d
	`, whereClause, orderCol, sortDir, idx, idx+1)

	args = append(args, limit, offset)

	rows, err := db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	contacts := make([]ContactFactDto, 0)
	for rows.Next() {
		var c ContactFactDto
		var startedAt time.Time
		if err := rows.Scan(
			&c.ID, &c.BatchID, &c.ConversationID, &c.ProtocolNumber, &c.PhoneMasked, &c.NameMasked, &c.NameNormalized,
			&c.RbxClientID, &c.MatchStatus, &c.MatchMethod, &c.MatchConfidence, &startedAt,
			&c.Department, &c.HandleTimeSeconds, &c.WaitTimeSeconds, &c.Status, &c.ClosureType,
			&c.FirstResponseSeconds, &c.IsAutomation, &c.Classification, &c.Description,
			&c.MessagesReceived, &c.MessagesSent, &c.MessagesInternal,
			&c.AgentDisplay,
		); err == nil {
			c.StartedAt = startedAt.Format(time.RFC3339)
			contacts = append(contacts, c)
		}
	}

	return contacts, totalCount, nil
}

// GetClientInteractions busca histórico detalhado de conversas e tickets de um cliente
func GetClientInteractions(ctx context.Context, db *pgxpool.Pool, opts ClientInteractionsOptions) (*ClientInteractionsResponse, error) {
	if db == nil {
		return nil, fmt.Errorf("banco de dados não disponível")
	}

	var clauses []string
	var args []interface{}
	idx := 1

	if opts.RbxClientID != "" {
		clauses = append(clauses, fmt.Sprintf("(f.rbx_client_id = $%d OR f.id = $%d)", idx, idx))
		args = append(args, opts.RbxClientID)
		idx++
	} else if opts.ClientKey != "" {
		clauses = append(clauses, fmt.Sprintf("(f.rbx_client_id = $%d OR f.phone_hmac = $%d OR f.id = $%d)", idx, idx, idx))
		args = append(args, opts.ClientKey)
		idx++
	} else if opts.PhoneMasked != "" {
		clauses = append(clauses, fmt.Sprintf("f.phone_masked = $%d", idx))
		args = append(args, opts.PhoneMasked)
		idx++
	}

	whereClause := "1=1"
	if len(clauses) > 0 {
		whereClause = strings.Join(clauses, " AND ")
	}

	query := fmt.Sprintf(`
		SELECT f.id, f.batch_id, f.conversation_id, f.phone_masked, COALESCE(f.name_normalized, f.name_masked, 'Cliente'),
		       f.rbx_client_id, f.match_status, COALESCE(f.match_method, ''), COALESCE(f.match_confidence, 0),
		       f.started_at, f.department, f.status, f.closure_type, f.classification,
		       f.handle_time_seconds, f.wait_time_seconds, f.first_response_seconds, f.satisfaction_status,
		       f.is_automation
		FROM omnichannel_contact_facts f
		WHERE %s
		ORDER BY f.started_at DESC
		LIMIT 100
	`, whereClause)

	rows, err := db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	contacts := make([]ClientInteractionContact, 0)
	var resolvedRbxID string
	if opts.RbxClientID != "" {
		resolvedRbxID = opts.RbxClientID
	}

	for rows.Next() {
		var c ClientInteractionContact
		var startedAt time.Time
		if err := rows.Scan(
			&c.ID, &c.BatchID, &c.ConversationID, &c.PhoneDisplay, &c.CustomerName,
			&c.RbxClientID, &c.MatchStatus, &c.MatchMethod, &c.MatchConfidence,
			&startedAt, &c.Department, &c.Status, &c.ClosureType, &c.Classification,
			&c.HandleTimeSeconds, &c.WaitTimeSeconds, &c.FirstResponseSeconds, &c.SatisfactionStatus,
			&c.IsAutomation,
		); err == nil {
			c.StartedAt = startedAt.Format(time.RFC3339)
			contacts = append(contacts, c)
			if resolvedRbxID == "" && c.RbxClientID != nil && *c.RbxClientID != "" {
				resolvedRbxID = *c.RbxClientID
			}
		}
	}

	rbxTickets := make([]ClientRbxTicket, 0)
	if resolvedRbxID != "" {
		tRows, err := db.Query(ctx, `
			SELECT COALESCE(protocolo, ''), COALESCE(data_cadastro::text, ''), COALESCE(data_conclusao::text, ''),
			       COALESCE(nome_topico, 'Geral'), COALESCE(nome_causa, 'Não informada'), COALESCE(situacao, 'Concluído')
			FROM rbx_atendimentos_cache
			WHERE id_cliente = $1
			ORDER BY data_cadastro DESC
			LIMIT 50
		`, resolvedRbxID)
		if err == nil {
			defer tRows.Close()
			for tRows.Next() {
				var proto, opAt, concAt, topic, cause, st string
				if err := tRows.Scan(&proto, &opAt, &concAt, &topic, &cause, &st); err == nil {
					var concPtr *string
					if concAt != "" {
						concPtr = &concAt
					}
					rbxTickets = append(rbxTickets, ClientRbxTicket{
						ID:          proto,
						Protocol:    proto,
						OpenedAt:    opAt,
						ConcludedAt: concPtr,
						Topic:       topic,
						Cause:       cause,
						Status:      st,
						Type:        "Técnico",
					})
				}
			}
		}
	}

	return &ClientInteractionsResponse{
		Success:    true,
		Contacts:   contacts,
		RbxTickets: rbxTickets,
	}, nil
}
