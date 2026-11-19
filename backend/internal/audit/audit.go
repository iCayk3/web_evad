package audit

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Entry representa um evento imutável da trilha de auditoria
type Entry struct {
	ID        string                 `json:"id"`
	Timestamp time.Time              `json:"timestamp"`
	UserID    string                 `json:"userId,omitempty"`
	Username  string                 `json:"username"`
	UserRole  string                 `json:"userRole"`
	Action    string                 `json:"action"` // ex: "auth.login", "cliente.view", "os.view", "export"
	Module    string                 `json:"module"` // ex: "auth", "clientes", "atendimentos", "analytics", "crm"
	RecordID  string                 `json:"recordId,omitempty"`
	Details   map[string]interface{} `json:"details,omitempty"`
	IPAddress string                 `json:"ipAddress,omitempty"`
	RequestID string                 `json:"requestId,omitempty"`
}

var (
	pool           *pgxpool.Pool
	logChan        chan Entry
	once           sync.Once
	forbiddenKeys  = []string{"password", "senha", "token", "cpf", "cnpj", "telefone", "celular", "phone", "fone", "mobile", "email", "rg", "chave", "chaveintegracao", "secret"}
)

// Init inicializa a tabela de auditoria e sobe a goroutine de persistência assíncrona
func Init(db *pgxpool.Pool) {
	once.Do(func() {
		pool = db
		logChan = make(chan Entry, 2000)

		if err := ensureSchema(); err != nil {
			log.Printf("[AUDIT ERROR] Falha ao criar schema de auditoria: %v", err)
		}

		go worker()
		log.Println("[AUDIT] Motor de governança e auditoria assíncrona iniciado com sucesso.")
	})
}

// ensureSchema cria a tabela e os índices no PostgreSQL
func ensureSchema() error {
	if pool == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	query := `
		CREATE TABLE IF NOT EXISTS audit_logs (
			id VARCHAR(64) PRIMARY KEY,
			timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
			user_id VARCHAR(64),
			username VARCHAR(100) NOT NULL,
			user_role VARCHAR(50) NOT NULL,
			action VARCHAR(100) NOT NULL,
			module VARCHAR(50) NOT NULL,
			record_id VARCHAR(100),
			details_json JSONB,
			ip_address VARCHAR(50),
			request_id VARCHAR(64)
		);
		CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
		CREATE INDEX IF NOT EXISTS idx_audit_module ON audit_logs(module);
		CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
		CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(username);
	`
	_, err := pool.Exec(ctx, query)
	return err
}

// worker consome entradas de log do canal assíncrono e grava no banco em lotes
func worker() {
	buffer := make([]Entry, 0, 50)
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	flush := func() {
		if len(buffer) == 0 || pool == nil {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		for _, e := range buffer {
			var detailsJSON []byte
			if e.Details != nil {
				detailsJSON, _ = json.Marshal(e.Details)
			}

			_, _ = pool.Exec(ctx, `
				INSERT INTO audit_logs (
					id, timestamp, user_id, username, user_role,
					action, module, record_id, details_json, ip_address, request_id
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			`, e.ID, e.Timestamp, e.UserID, e.Username, e.UserRole,
				e.Action, e.Module, e.RecordID, detailsJSON, e.IPAddress, e.RequestID)
		}

		buffer = buffer[:0]
	}

	for {
		select {
		case entry, ok := <-logChan:
			if !ok {
				flush()
				return
			}
			buffer = append(buffer, entry)
			if len(buffer) >= 50 {
				flush()
			}
		case <-ticker.C:
			flush()
		}
	}
}

// SanitizeDetails remove quaisquer chaves potencialmente sensíveis (LGPD) dos detalhes
func SanitizeDetails(details map[string]interface{}) map[string]interface{} {
	if details == nil {
		return nil
	}
	clean := make(map[string]interface{})
	for k, v := range details {
		lowerK := strings.ToLower(k)
		isForbidden := false
		for _, f := range forbiddenKeys {
			if strings.Contains(lowerK, f) {
				isForbidden = true
				break
			}
		}
		if !isForbidden {
			clean[k] = v
		}
	}
	return clean
}

// Log enfileira uma ação de auditoria de forma não bloqueante
func Log(entry Entry) {
	if logChan == nil {
		return
	}

	if entry.ID == "" {
		entry.ID = "aud_" + uuid.New().String()
	}
	if entry.Timestamp.IsZero() {
		entry.Timestamp = time.Now()
	}
	if entry.Username == "" {
		entry.Username = "sistema"
	}
	if entry.UserRole == "" {
		entry.UserRole = "operador"
	}

	entry.Details = SanitizeDetails(entry.Details)

	select {
	case logChan <- entry:
	default:
		// Se o buffer estiver cheio, não trava a requisição HTTP do usuário
		log.Printf("[AUDIT WARN] Canal de auditoria cheio. Registro descartado: %s %s", entry.Module, entry.Action)
	}
}

// LogQueryFilter parâmetros para consulta da trilha de auditoria
type LogQueryFilter struct {
	Module    string    `json:"module"`
	Action    string    `json:"action"`
	Username  string    `json:"username"`
	StartDate time.Time `json:"startDate"`
	EndDate   time.Time `json:"endDate"`
	Limit     int       `json:"limit"`
	Offset    int       `json:"offset"`
}

// QueryLogs consulta logs de auditoria com filtros e paginação
func QueryLogs(ctx context.Context, filter LogQueryFilter) ([]Entry, int, error) {
	if pool == nil {
		return nil, 0, nil
	}

	if filter.Limit <= 0 {
		filter.Limit = 50
	}
	if filter.Limit > 200 {
		filter.Limit = 200
	}

	var conditions []string
	var args []interface{}
	argIdx := 1

	if filter.Module != "" {
		conditions = append(conditions, fmt.Sprintf("module = $%d", argIdx))
		args = append(args, filter.Module)
		argIdx++
	}
	if filter.Action != "" {
		conditions = append(conditions, fmt.Sprintf("action = $%d", argIdx))
		args = append(args, filter.Action)
		argIdx++
	}
	if filter.Username != "" {
		conditions = append(conditions, fmt.Sprintf("username = $%d", argIdx))
		args = append(args, filter.Username)
		argIdx++
	}
	if !filter.StartDate.IsZero() {
		conditions = append(conditions, fmt.Sprintf("timestamp >= $%d", argIdx))
		args = append(args, filter.StartDate)
		argIdx++
	}
	if !filter.EndDate.IsZero() {
		conditions = append(conditions, fmt.Sprintf("timestamp <= $%d", argIdx))
		args = append(args, filter.EndDate)
		argIdx++
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM audit_logs %s", whereClause)
	_ = pool.QueryRow(ctx, countQuery, args...).Scan(&total)

	dataQuery := fmt.Sprintf(`
		SELECT id, timestamp, COALESCE(user_id, ''), username, user_role,
		       action, module, COALESCE(record_id, ''), details_json,
		       COALESCE(ip_address, ''), COALESCE(request_id, '')
		FROM audit_logs
		%s
		ORDER BY timestamp DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	queryArgs := append(args, filter.Limit, filter.Offset)
	rows, err := pool.Query(ctx, dataQuery, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var logs []Entry
	for rows.Next() {
		var e Entry
		var detailsJSON []byte
		if err := rows.Scan(
			&e.ID, &e.Timestamp, &e.UserID, &e.Username, &e.UserRole,
			&e.Action, &e.Module, &e.RecordID, &detailsJSON,
			&e.IPAddress, &e.RequestID,
		); err == nil {
			if len(detailsJSON) > 0 {
				_ = json.Unmarshal(detailsJSON, &e.Details)
			}
			logs = append(logs, e)
		}
	}

	return logs, total, nil
}
