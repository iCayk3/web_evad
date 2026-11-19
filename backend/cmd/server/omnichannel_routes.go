package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"

	"evad-backend/internal/audit"
	"evad-backend/internal/omnichannel"
	"evad-backend/internal/rbx"
)

var defaultMatcher = omnichannel.NewIdentityMatcher()

func checkOmnichannelDB(w http.ResponseWriter) bool {
	if dbPool == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		w.Write([]byte(`{"error": "Banco de dados não disponível no momento. Reconectando automaticamente..."}`))
		return false
	}
	return true
}

func registerOmnichannelRoutes(r chi.Router) {
	// ----------------------------------------------------
	// 1. Importação & Pré-visualização do ISPCHAT
	// ----------------------------------------------------

	// POST /api/omnichannel/import/preview
	r.Post("/api/omnichannel/import/preview", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := r.ParseMultipartForm(50 << 20); err != nil {
			http.Error(w, `{"error": "Arquivo excede o limite máximo permitido de 50MB"}`, http.StatusBadRequest)
			return
		}

		file, header, err := r.FormFile("file")
		if err != nil {
			http.Error(w, `{"error": "Nenhum arquivo enviado no campo 'file'"}`, http.StatusBadRequest)
			return
		}
		defer file.Close()

		ext := strings.ToLower(filepath.Ext(header.Filename))
		if ext != ".xlsx" && ext != ".csv" {
			http.Error(w, `{"error": "Formato inválido. Envie um arquivo .xlsx ou .csv exportado do ISPCHAT"}`, http.StatusBadRequest)
			return
		}

		tmpFile, err := os.CreateTemp("", "preview_*"+ext)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao criar arquivo temporário: %v"}`, err), http.StatusInternalServerError)
			return
		}

		if _, err := io.Copy(tmpFile, file); err != nil {
			tmpFile.Close()
			_ = os.Remove(tmpFile.Name())
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao salvar upload: %v"}`, err), http.StatusInternalServerError)
			return
		}
		tmpPath := tmpFile.Name()
		tmpFile.Close()

		preview, err := omnichannel.PreviewFile(tmpPath, 50)
		if err != nil {
			_ = os.Remove(tmpPath)
			http.Error(w, fmt.Sprintf(`{"error": "%s"}`, err.Error()), http.StatusBadRequest)
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":      true,
			"preview":      preview,
			"tempFilePath": tmpPath,
			"fileName":     header.Filename,
		})
	})

	// POST /api/omnichannel/import
	r.Post("/api/omnichannel/import", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if !checkOmnichannelDB(w) {
			return
		}
		ctx := r.Context()
		username, role := getUserInfo(r)

		// 1. Suporte a payload JSON com arquivo previamente enviado no preview
		if strings.Contains(r.Header.Get("Content-Type"), "application/json") {
			var req struct {
				TempFilePath string `json:"tempFilePath"`
				FileName     string `json:"fileName"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, `{"error": "Payload JSON inválido"}`, http.StatusBadRequest)
				return
			}
			if req.TempFilePath == "" {
				http.Error(w, `{"error": "Caminho do arquivo temporário ausente"}`, http.StatusBadRequest)
				return
			}
			fi, err := os.Stat(req.TempFilePath)
			if err != nil {
				http.Error(w, `{"error": "Arquivo temporário não encontrado ou expirado"}`, http.StatusBadRequest)
				return
			}

			fName := req.FileName
			if fName == "" {
				fName = filepath.Base(req.TempFilePath)
			}

			fileHash, err := omnichannel.ComputeFileHash(req.TempFilePath)
			if err != nil {
				http.Error(w, fmt.Sprintf(`{"error": "Erro ao calcular hash do arquivo: %v"}`, err), http.StatusBadRequest)
				return
			}

			// Verifica duplicidade do arquivo
			var existingID string
			err = dbPool.QueryRow(ctx, "SELECT id FROM omnichannel_import_batches WHERE file_hash = $1 AND status = 'completed'", fileHash).Scan(&existingID)
			if err == nil && existingID != "" {
				_ = os.Remove(req.TempFilePath)
				http.Error(w, fmt.Sprintf(`{"error": "Este arquivo já foi importado com sucesso anteriormente (Lote %s)"}`, existingID), http.StatusBadRequest)
				return
			}

			batchID := "batch_" + uuid.New().String()
			now := time.Now()

			_, err = dbPool.Exec(ctx, `
				INSERT INTO omnichannel_import_batches (
					id, file_hash, file_name, file_size, total_rows, accepted_rows, rejected_rows, duplicate_rows,
					status, imported_by, created_at
				) VALUES ($1, $2, $3, $4, 0, 0, 0, 0, 'processing', $5, $6)
			`, batchID, fileHash, fName, fi.Size(), username, now)
			if err != nil {
				http.Error(w, fmt.Sprintf(`{"error": "Erro ao registrar lote: %v"}`, err), http.StatusInternalServerError)
				return
			}

			// Processa de forma assíncrona em segundo plano para arquivos com dezenas de milhares de linhas
			go func(bID, targetPath, fileName string, fSize int64, uName, uRole, remAddr, reqID string) {
				defer os.Remove(targetPath)
				bgCtx := context.Background()
				summary, err := omnichannel.ProcessBatchImportWithID(bgCtx, dbPool, defaultMatcher, bID, targetPath, fileName, fSize, uName)
				if err != nil {
					log.Printf("[Omnichannel Async Import ERROR] lote %s (%s): %v", bID, fileName, err)
					return
				}
				audit.Log(audit.Entry{
					Username:  uName,
					UserRole:  uRole,
					Action:    "omnichannel.import",
					Module:    "omnichannel",
					RecordID:  summary.ID,
					Details:   map[string]interface{}{"fileName": summary.FileName, "totalRows": summary.TotalRows, "accepted": summary.AcceptedRows},
					IPAddress: remAddr,
					RequestID: reqID,
				})
			}(batchID, req.TempFilePath, fName, fi.Size(), username, role, r.RemoteAddr, middleware.GetReqID(ctx))

			w.WriteHeader(http.StatusAccepted)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true,
				"batchId": batchID,
				"status":  "processing",
				"message": "Importação iniciada com sucesso em segundo plano",
			})
			return
		}

		// 2. Suporte a multipart/form-data upload direto
		if err := r.ParseMultipartForm(100 << 20); err != nil {
			http.Error(w, `{"error": "Arquivo excede o limite de 100MB"}`, http.StatusBadRequest)
			return
		}

		file, header, err := r.FormFile("file")
		if err != nil {
			http.Error(w, `{"error": "Arquivo não encontrado"}`, http.StatusBadRequest)
			return
		}
		defer file.Close()

		ext := strings.ToLower(filepath.Ext(header.Filename))
		if ext != ".xlsx" && ext != ".csv" {
			http.Error(w, `{"error": "Formato inválido. Use .xlsx ou .csv"}`, http.StatusBadRequest)
			return
		}

		tmpFile, err := os.CreateTemp("", "import_*"+ext)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao criar temporário: %v"}`, err), http.StatusInternalServerError)
			return
		}

		size, err := io.Copy(tmpFile, file)
		if err != nil {
			tmpFile.Close()
			_ = os.Remove(tmpFile.Name())
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao persistir upload: %v"}`, err), http.StatusInternalServerError)
			return
		}
		tmpPath := tmpFile.Name()
		tmpFile.Close()

		fileHash, err := omnichannel.ComputeFileHash(tmpPath)
		if err != nil {
			_ = os.Remove(tmpPath)
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao calcular hash do arquivo: %v"}`, err), http.StatusBadRequest)
			return
		}

		var existingID string
		err = dbPool.QueryRow(ctx, "SELECT id FROM omnichannel_import_batches WHERE file_hash = $1 AND status = 'completed'", fileHash).Scan(&existingID)
		if err == nil && existingID != "" {
			_ = os.Remove(tmpPath)
			http.Error(w, fmt.Sprintf(`{"error": "Este arquivo já foi importado com sucesso anteriormente (Lote %s)"}`, existingID), http.StatusBadRequest)
			return
		}

		batchID := "batch_" + uuid.New().String()
		now := time.Now()

		_, err = dbPool.Exec(ctx, `
			INSERT INTO omnichannel_import_batches (
				id, file_hash, file_name, file_size, total_rows, accepted_rows, rejected_rows, duplicate_rows,
				status, imported_by, created_at
			) VALUES ($1, $2, $3, $4, 0, 0, 0, 0, 'processing', $5, $6)
		`, batchID, fileHash, header.Filename, size, username, now)
		if err != nil {
			_ = os.Remove(tmpPath)
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao registrar lote: %v"}`, err), http.StatusInternalServerError)
			return
		}

		go func(bID, targetPath, fileName string, fSize int64, uName, uRole, remAddr, reqID string) {
			defer os.Remove(targetPath)
			bgCtx := context.Background()
			summary, err := omnichannel.ProcessBatchImportWithID(bgCtx, dbPool, defaultMatcher, bID, targetPath, fileName, fSize, uName)
			if err != nil {
				log.Printf("[Omnichannel Async Import ERROR] lote %s (%s): %v", bID, fileName, err)
				return
			}
			audit.Log(audit.Entry{
				Username:  uName,
				UserRole:  uRole,
				Action:    "omnichannel.import",
				Module:    "omnichannel",
				RecordID:  summary.ID,
				Details:   map[string]interface{}{"fileName": summary.FileName, "totalRows": summary.TotalRows, "accepted": summary.AcceptedRows},
				IPAddress: remAddr,
				RequestID: reqID,
			})
		}(batchID, tmpPath, header.Filename, size, username, role, r.RemoteAddr, middleware.GetReqID(ctx))

		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"batchId": batchID,
			"status":  "processing",
			"message": "Importação iniciada com sucesso em segundo plano",
		})
	})

	// GET /api/omnichannel/import/{batchId}/status
	r.Get("/api/omnichannel/import/{batchId}/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if !checkOmnichannelDB(w) {
			return
		}
		batchID := chi.URLParam(r, "batchId")
		batch, err := omnichannel.GetBatchDetails(r.Context(), dbPool, batchID)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%s"}`, err.Error()), http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"batch":   batch,
		})
	})

	// GET /api/omnichannel/batches
	r.Get("/api/omnichannel/batches", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if !checkOmnichannelDB(w) {
			return
		}
		batches, err := omnichannel.ListBatches(r.Context(), dbPool)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao listar lotes: %v"}`, err), http.StatusInternalServerError)
			return
		}
		if batches == nil {
			batches = []omnichannel.BatchSummary{}
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"total":   len(batches),
			"batches": batches,
		})
	})

	// GET /api/omnichannel/batches/{batchId}
	r.Get("/api/omnichannel/batches/{batchId}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if !checkOmnichannelDB(w) {
			return
		}
		batchID := chi.URLParam(r, "batchId")
		batch, err := omnichannel.GetBatchDetails(r.Context(), dbPool, batchID)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%s"}`, err.Error()), http.StatusNotFound)
			return
		}
		errors, _ := omnichannel.GetBatchErrors(r.Context(), dbPool, batchID)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"batch":   batch,
			"errors":  errors,
		})
	})

	// DELETE /api/omnichannel/batches/{batchId}
	r.Delete("/api/omnichannel/batches/{batchId}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if !checkOmnichannelDB(w) {
			return
		}
		batchID := chi.URLParam(r, "batchId")
		err := omnichannel.DeleteBatch(r.Context(), dbPool, batchID)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao excluir lote: %v"}`, err), http.StatusInternalServerError)
			return
		}

		username, role := getUserInfo(r)
		audit.Log(audit.Entry{
			Username:  username,
			UserRole:  role,
			Action:    "omnichannel.batch_delete",
			Module:    "omnichannel",
			RecordID:  batchID,
			IPAddress: r.RemoteAddr,
			RequestID: middleware.GetReqID(r.Context()),
		})

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": fmt.Sprintf("Lote %s e suas interações foram excluídos.", batchID),
		})
	})

	// ----------------------------------------------------
	// 2. Visão Geral & KPIs Omnichannel
	// ----------------------------------------------------

	// GET /api/omnichannel/overview
	r.Get("/api/omnichannel/overview", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if !checkOmnichannelDB(w) {
			return
		}
		q := r.URL.Query()

		filters := omnichannel.FilterOptions{
			BatchID:    q.Get("batchId"),
			Agent:      q.Get("agent"),
			StartDate:  q.Get("startDate"),
			EndDate:    q.Get("endDate"),
			Department: q.Get("department"),
			Status:     q.Get("status"),
		}

		metrics, err := omnichannel.GetOverviewMetrics(r.Context(), dbPool, filters)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}

		username, role := getUserInfo(r)
		audit.Log(audit.Entry{
			Username:  username,
			UserRole:  role,
			Action:    "omnichannel.overview",
			Module:    "omnichannel",
			Details:   map[string]interface{}{"batchId": filters.BatchID, "totalContacts": metrics.Volume.TotalContacts},
			IPAddress: r.RemoteAddr,
			RequestID: middleware.GetReqID(r.Context()),
		})

		json.NewEncoder(w).Encode(metrics)
	})

	// GET /api/omnichannel/recurrence
	r.Get("/api/omnichannel/recurrence", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if !checkOmnichannelDB(w) {
			return
		}
		q := r.URL.Query()

		threshold, _ := strconv.Atoi(q.Get("threshold"))
		limit, _ := strconv.Atoi(q.Get("limit"))
		offset, _ := strconv.Atoi(q.Get("offset"))

		opts := omnichannel.RecurrenceOptions{
			BatchID:    q.Get("batchId"),
			Agent:      q.Get("agent"),
			StartDate:  q.Get("startDate"),
			EndDate:    q.Get("endDate"),
			Department: q.Get("department"),
			Threshold:  threshold,
			Limit:      limit,
			Offset:     offset,
		}

		summary, err := omnichannel.GetRecurrenceSummary(r.Context(), dbPool, opts)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(summary)
	})

	// ----------------------------------------------------
	// 3. Termômetro de Saúde do Cliente (Risco de Churn)
	// ----------------------------------------------------

	// GET /api/omnichannel/customer-health
	r.Get("/api/omnichannel/customer-health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if !checkOmnichannelDB(w) {
			return
		}
		ctx := r.Context()
		q := r.URL.Query()

		now := time.Now()
		startStr := q.Get("start")
		endStr := q.Get("end")

		start := now.Add(-30 * 24 * time.Hour)
		end := now
		if s, err := time.Parse(time.RFC3339, startStr); err == nil {
			start = s
		} else if s, err := time.Parse("2006-01-02", startStr); err == nil {
			start = s
		}
		if e, err := time.Parse(time.RFC3339, endStr); err == nil {
			end = e
		} else if e, err := time.Parse("2006-01-02", endStr); err == nil {
			end = e
		}

		threshold, _ := strconv.Atoi(q.Get("threshold"))
		if threshold < 2 {
			threshold = 2
		}
		oldMonths, _ := strconv.Atoi(q.Get("oldMonths"))
		if oldMonths < 1 {
			oldMonths = 6
		}

		// 1. Carrega fatos de contatos da base local
		contactQuery := `
			SELECT f.id, f.conversation_id, f.rbx_client_id, f.match_status,
			       COALESCE(f.name_masked, 'Cliente'), f.started_at, f.ended_at,
			       COALESCE(f.status, ''), COALESCE(f.department, 'Sem setor'),
			       COALESCE(f.channel, 'Não informado'), COALESCE(f.classification, '[]'),
			       COALESCE(f.initiated_by, '')
			FROM omnichannel_contact_facts f
			JOIN omnichannel_import_batches b ON b.id = f.batch_id
			WHERE b.status = 'completed'
		`
		var cArgs []interface{}
		if bID := q.Get("batchId"); bID != "" {
			contactQuery += " AND f.batch_id = $1"
			cArgs = append(cArgs, bID)
		}
		contactQuery += " ORDER BY f.started_at DESC"

		rows, err := dbPool.Query(ctx, contactQuery, cArgs...)
		var contacts []omnichannel.HealthContact
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var id, convID, matchSt, name, st, dep, ch, classStr, initBy string
				var rbxID *string
				var startedAt time.Time
				var endedAt *time.Time

				if err := rows.Scan(&id, &convID, &rbxID, &matchSt, &name, &startedAt, &endedAt, &st, &dep, &ch, &classStr, &initBy); err == nil {
					var causes []string
					_ = json.Unmarshal([]byte(classStr), &causes)
					contacts = append(contacts, omnichannel.HealthContact{
						ID:             id,
						ConversationID: convID,
						ClientID:       rbxID,
						Confirmed:      matchSt == "confirmed",
						Name:           name,
						StartedAt:      startedAt,
						EndedAt:        endedAt,
						Status:         st,
						Department:     dep,
						Channel:        ch,
						Causes:         causes,
						InitiatedBy:    initBy,
					})
				}
			}
		}

		// 2. Carrega cadastros de clientes da tabela clientes local
		profileRows, err := dbPool.Query(ctx, `
			SELECT codigo_rbx, COALESCE(nome, ''), COALESCE(cidade, ''), COALESCE(plano, ''), criado_em
			FROM clientes
		`)
		var profiles []omnichannel.HealthProfile
		if err == nil {
			defer profileRows.Close()
			for profileRows.Next() {
				var code, name, city, plan string
				var regAt *time.Time
				if err := profileRows.Scan(&code, &name, &city, &plan, &regAt); err == nil {
					profiles = append(profiles, omnichannel.HealthProfile{
						ID:           code,
						Name:         name,
						City:         city,
						Plan:         plan,
						RegisteredAt: regAt,
					})
				}
			}
		}

		// 3. Carrega chamados do RBXSoft para cruzamento de saúde
		var tickets []omnichannel.HealthTicket
		client, rbxErr := getRbxClient(ctx)
		if rbxErr == nil && client != nil {
			rbxStart := start.Add(-7 * 24 * time.Hour).Format("2006-01-02")
			rbxFilter := fmt.Sprintf("Atendimentos.Data_AB >= '%s'", rbxStart)
			rawTickets, tErr := client.ConsultarAtendimentosComFiltro(ctx, rbxFilter)
			if tErr == nil {
				for _, t := range rawTickets {
					if t.ClientID > 0 {
						openedDate, _ := time.Parse("2006-01-02 15:04:05", t.CreatedAt)
						var concDate *time.Time
						if t.ConcludedAt != nil {
							if cd, ok := time.Parse("2006-01-02 15:04:05", *t.ConcludedAt); ok == nil {
								concDate = &cd
							}
						}
						var dueDate *time.Time
						if t.SlaDueAt != "" {
							if dd, ok := time.Parse("2006-01-02 15:04:05", t.SlaDueAt); ok == nil {
								dueDate = &dd
							}
						}

						tickets = append(tickets, omnichannel.HealthTicket{
							ID:          strconv.Itoa(t.ID),
							ClientID:    strconv.Itoa(t.ClientID),
							Protocol:    t.Protocol,
							OpenedAt:    openedDate,
							ConcludedAt: concDate,
							DueAt:       dueDate,
							Cause:       t.CauseName,
							Status:      t.Status,
						})
					}
				}
			}
		}

		opts := omnichannel.HealthOptions{
			Start:      start,
			End:        end,
			Threshold:  threshold,
			OldMonths:  oldMonths,
			Department: q.Get("department"),
			Channel:    q.Get("channel"),
			City:       q.Get("city"),
			Plan:       q.Get("plan"),
			PppoeLogin: q.Get("pppoeLogin"),
		}

		healthResp := omnichannel.BuildCustomerHealth(contacts, tickets, profiles, opts)

		username, role := getUserInfo(r)
		audit.Log(audit.Entry{
			Username:  username,
			UserRole:  role,
			Action:    "omnichannel.customer_health",
			Module:    "omnichannel",
			Details:   map[string]interface{}{"observedClients": healthResp.Summary.ObservedClients, "highPriority": healthResp.Summary.HighPriority},
			IPAddress: r.RemoteAddr,
			RequestID: middleware.GetReqID(ctx),
		})

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"health":  healthResp,
		})
	})

	// ----------------------------------------------------
	// 4. Cruzamento Omnichannel × RBX
	// ----------------------------------------------------

	// GET /api/omnichannel/cross-rbx
	r.Get("/api/omnichannel/cross-rbx", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if !checkOmnichannelDB(w) {
			return
		}
		ctx := r.Context()
		q := r.URL.Query()

		windowHours, _ := strconv.Atoi(q.Get("windowHours"))
		if windowHours <= 0 {
			windowHours = 24
		}
		limit, _ := strconv.Atoi(q.Get("limit"))
		if limit <= 0 {
			limit = 50
		}
		batchID := q.Get("batchId")

		// Consulta tickets no RBX
		var tickets []rbx.TicketDto
		client, err := getRbxClient(ctx)
		if err == nil && client != nil {
			defaultStart := time.Now().Add(-30 * 24 * time.Hour).Format("2006-01-02")
			rbxFilter := fmt.Sprintf("Atendimentos.Data_AB >= '%s'", defaultStart)
			tickets, _ = client.ConsultarAtendimentosComFiltro(ctx, rbxFilter)
		}

		resp, err := omnichannel.CorrelateOmnichannelWithRbx(ctx, dbPool, tickets, windowHours, batchID, limit)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(resp)
	})

	// ----------------------------------------------------
	// 5. Fila de Revisão e Decisões de Correspondência
	// ----------------------------------------------------

	// GET /api/omnichannel/contacts
	r.Get("/api/omnichannel/contacts", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if !checkOmnichannelDB(w) {
			return
		}
		q := r.URL.Query()
		limit, _ := strconv.Atoi(q.Get("limit"))
		offset, _ := strconv.Atoi(q.Get("offset"))

		opts := omnichannel.ContactFilterOptions{
			BatchID:        q.Get("batchId"),
			Agent:          q.Get("agent"),
			Department:     q.Get("department"),
			ClosureType:    q.Get("closureType"),
			Classification: q.Get("classification"),
			Search:         q.Get("search"),
			SortBy:         q.Get("sortBy"),
			SortDir:        q.Get("sortDir"),
			Limit:          limit,
			Offset:         offset,
		}

		contacts, totalCount, err := omnichannel.GetContacts(r.Context(), dbPool, opts)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}
		if contacts == nil {
			contacts = []omnichannel.ContactFactDto{}
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":    true,
			"contacts":   contacts,
			"totalCount": totalCount,
		})
	})

	// GET /api/omnichannel/client-interactions
	r.Get("/api/omnichannel/client-interactions", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if !checkOmnichannelDB(w) {
			return
		}
		q := r.URL.Query()

		opts := omnichannel.ClientInteractionsOptions{
			BatchID:     q.Get("batchId"),
			ClientKey:   q.Get("clientKey"),
			RbxClientID: q.Get("rbxClientId"),
			PhoneMasked: q.Get("phoneMasked"),
		}

		res, err := omnichannel.GetClientInteractions(r.Context(), dbPool, opts)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(res)
	})

	// GET /api/omnichannel/reviews
	r.Get("/api/omnichannel/reviews", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if !checkOmnichannelDB(w) {
			return
		}
		q := r.URL.Query()
		batchID := q.Get("batchId")
		limit, _ := strconv.Atoi(q.Get("limit"))
		offset, _ := strconv.Atoi(q.Get("offset"))

		items, total, totalSuggested, totalAmbiguous, err := omnichannel.GetReviewQueue(r.Context(), dbPool, batchID, limit, offset)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}
		if items == nil {
			items = []omnichannel.MatchReviewItem{}
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":        true,
			"total":          total,
			"totalSuggested": totalSuggested,
			"totalAmbiguous": totalAmbiguous,
			"limit":          limit,
			"offset":         offset,
			"items":          items,
		})
	})

	// POST /api/omnichannel/reviews/decision
	r.Post("/api/omnichannel/reviews/decision", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if !checkOmnichannelDB(w) {
			return
		}
		ctx := r.Context()

		var req struct {
			FactID              string `json:"factId"`
			NewStatus           string `json:"newStatus"` // 'confirmed' ou 'unmatched'
			SelectedRbxClientID string `json:"selectedRbxClientId"`
			Reason              string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error": "JSON inválido"}`, http.StatusBadRequest)
			return
		}

		if req.FactID == "" || (req.NewStatus != "confirmed" && req.NewStatus != "unmatched") {
			http.Error(w, `{"error": "Parâmetros factId e newStatus ('confirmed' ou 'unmatched') obrigatórios"}`, http.StatusBadRequest)
			return
		}

		username, role := getUserInfo(r)
		err := omnichannel.ApplyReviewDecision(ctx, dbPool, req.FactID, req.NewStatus, req.SelectedRbxClientID, req.Reason, username)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%s"}`, err.Error()), http.StatusBadRequest)
			return
		}

		audit.Log(audit.Entry{
			Username:  username,
			UserRole:  role,
			Action:    "omnichannel.match_review",
			Module:    "omnichannel",
			RecordID:  req.FactID,
			Details:   map[string]interface{}{"newStatus": req.NewStatus, "selectedClient": req.SelectedRbxClientID, "reason": req.Reason},
			IPAddress: r.RemoteAddr,
			RequestID: middleware.GetReqID(ctx),
		})

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Decisão de correspondência aplicada com sucesso.",
		})
	})

	// POST /api/omnichannel/reviews/batch-approve
	r.Post("/api/omnichannel/reviews/batch-approve", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if !checkOmnichannelDB(w) {
			return
		}
		ctx := r.Context()

		username, role := getUserInfo(r)
		count, err := omnichannel.BatchApprove(ctx, dbPool, username)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}

		audit.Log(audit.Entry{
			Username:  username,
			UserRole:  role,
			Action:    "omnichannel.batch_approve",
			Module:    "omnichannel",
			Details:   map[string]interface{}{"approvedCount": count},
			IPAddress: r.RemoteAddr,
			RequestID: middleware.GetReqID(ctx),
		})

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":  true,
			"approved": count,
			"message":  fmt.Sprintf("%d correspondências sugeridas foram aprovadas em lote.", count),
		})
	})
}
