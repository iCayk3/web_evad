package main

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"

	"evad-backend/internal/rbx"
)

type ClientRecord struct {
	ID                 string  `json:"id"`
	RbxCode            string  `json:"rbxCode"`
	Contract           string  `json:"contract"`
	Name               string  `json:"name"`
	City               string  `json:"city"`
	Plan               string  `json:"plan"`
	MonthlyFee         float64 `json:"monthlyFee"`
	BillingCycle       string  `json:"billingCycle"`    // e.g. "Ciclo 30 (Venc. Dia 30)"
	CompetenceMonth    string  `json:"competenceMonth"` // e.g. "2026-01"
	BlockDate          string  `json:"blockDate"`
	UnblockDate        *string `json:"unblockDate"`
	DaysToResolve      *int    `json:"daysToResolve"`
	Status             string  `json:"status"` // 'returned', 'blocked', 'churned', 'suspended', 'other'
	Operation          string  `json:"operation"`
	UserRBX            string  `json:"userRbx"`
	CancellationDate   *string `json:"cancellationDate"`
	RbxStatusCode      string  `json:"rbxStatusCode"`    // e.g. "A", "B", "C", "S", "D", "E", "I", "T"
	RbxStatusText      string  `json:"rbxStatusText"`    // e.g. "Ativo", "Bloqueado", "Cancelado", etc.
	CancellationReason string  `json:"cancellationReason"`
	DaysOverdue        *int    `json:"daysOverdue"`
	LastRbxSyncAt       *string `json:"lastRbxSyncAt"`
	LastOperationRbx    *string `json:"lastOperationRbx"`
	IsInheritedDebt     bool    `json:"isInheritedDebt"`
	OriginalDebtDueDate string  `json:"originalDebtDueDate"`
	DebtLabel           string  `json:"debtLabel"`
	IsMimo              bool    `json:"isMimo"`
	PrimaryContract     string  `json:"primaryContract"`
	LinkedMimos         string  `json:"linkedMimos"`
	Neighborhood        string  `json:"neighborhood"` // Bairro / Vila
}

type MonthlyCohortSummary struct {
	MonthKey           string         `json:"monthKey"`
	MonthLabel         string         `json:"monthLabel"`
	TotalBlocked       int            `json:"totalBlocked"`
	TotalMrrBlocked    float64        `json:"totalMrrBlocked"`
	ReturnedCount      int            `json:"returnedCount"`
	ReturnedMrr        float64        `json:"returnedMrr"`
	ReturnedRate       float64        `json:"returnedRate"`
	ChurnedCount       int            `json:"churnedCount"`
	ChurnedMrr         float64        `json:"churnedMrr"`
	ChurnRate          float64        `json:"churnRate"`
	SuspendedCount     int            `json:"suspendedCount"`
	SuspendedMrr       float64        `json:"suspendedMrr"`
	SuspendedRate      float64        `json:"suspendedRate"`
	StillBlockedCount  int            `json:"stillBlockedCount"`
	StillBlockedMrr    float64        `json:"stillBlockedMrr"`
	StillBlockedRate   float64        `json:"stillBlockedRate"`
	AvgDaysToReturn    float64        `json:"avgDaysToReturn"`
	Returned0to7Days   int            `json:"returned0to7Days"`
	Returned8to15Days  int            `json:"returned8to15Days"`
	Returned16to30Days int            `json:"returned16to30Days"`
	ReturnedOver30Days int            `json:"returnedOver30Days"`
	InheritedCount     int            `json:"inheritedCount"`
	InheritedMrr       float64        `json:"inheritedMrr"`
	PureTotalBlocked   int            `json:"pureTotalBlocked"`
	PureTotalMrr       float64        `json:"pureTotalMrr"`
	OtherCount         int            `json:"otherCount"`
	OtherMrr           float64        `json:"otherMrr"`
	MimoCount          int            `json:"mimoCount"`
	Clients            []ClientRecord `json:"clients"`
}

type BreakdownItem struct {
	Name              string  `json:"name"`
	City              string  `json:"city,omitempty"`
	TotalBlocked      int     `json:"totalBlocked"`
	TotalMrr          float64 `json:"totalMrr"`
	ReturnedCount     int     `json:"returnedCount"`
	ReturnedMrr       float64 `json:"returnedMrr"`
	ReturnedRate      float64 `json:"returnedRate"`
	ChurnedCount      int     `json:"churnedCount"`
	ChurnedMrr        float64 `json:"churnedMrr"`
	ChurnRate         float64 `json:"churnRate"`
	SuspendedCount    int     `json:"suspendedCount"`
	SuspendedMrr      float64 `json:"suspendedMrr"`
	StillBlockedCount int     `json:"stillBlockedCount"`
	StillBlockedMrr   float64 `json:"stillBlockedMrr"`
	StillBlockedRate  float64 `json:"stillBlockedRate"`
	AvgDaysToReturn   float64 `json:"avgDaysToReturn"`
}

type MonthlyAnalyticsResponse struct {
	MonthKey        string               `json:"monthKey"`
	MonthLabel      string               `json:"monthLabel"`
	Summary         MonthlyCohortSummary `json:"summary"`
	ByPlan          []BreakdownItem      `json:"byPlan"`
	ByCity          []BreakdownItem      `json:"byCity"`
	ByNeighborhood  []BreakdownItem      `json:"byNeighborhood"`
	ByCycle         []BreakdownItem      `json:"byCycle"`
	AvailableMonths []string             `json:"availableMonths"`
}

type MonthSummaryItem struct {
	MonthKey          string  `json:"monthKey"`
	MonthLabel        string  `json:"monthLabel"`
	HasData           bool    `json:"hasData"`
	TotalBlocked      int     `json:"totalBlocked"`
	TotalMrrBlocked   float64 `json:"totalMrrBlocked"`
	ReturnedCount     int     `json:"returnedCount"`
	ReturnedMrr       float64 `json:"returnedMrr"`
	ReturnedRate      float64 `json:"returnedRate"`
	ChurnedCount      int     `json:"churnedCount"`
	ChurnedMrr        float64 `json:"churnedMrr"`
	ChurnRate         float64 `json:"churnRate"`
	SuspendedCount    int     `json:"suspendedCount"`
	SuspendedMrr      float64 `json:"suspendedMrr"`
	SuspendedRate     float64 `json:"suspendedRate"`
	StillBlockedCount int     `json:"stillBlockedCount"`
	StillBlockedMrr   float64 `json:"stillBlockedMrr"`
	StillBlockedRate  float64 `json:"stillBlockedRate"`
	AvgDaysToReturn   float64 `json:"avgDaysToReturn"`
}

type AnnualAnalyticsResponse struct {
	Year             string               `json:"year"`
	Summary          MonthlyCohortSummary `json:"summary"`
	MonthlyEvolution []MonthSummaryItem   `json:"monthlyEvolution"`
	ByPlan           []BreakdownItem      `json:"byPlan"`
	ByCity           []BreakdownItem      `json:"byCity"`
	ByNeighborhood   []BreakdownItem      `json:"byNeighborhood"`
	ByCycle          []BreakdownItem      `json:"byCycle"`
	AvailableYears   []string             `json:"availableYears"`
}

var dbPool *pgxpool.Pool

func initDB() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://evad_user:evad_password@localhost:5433/evad_db?sslmode=disable"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Printf("[PostgreSQL] Erro ao conectar: %v", err)
		return
	}

	if err := pool.Ping(ctx); err != nil {
		log.Printf("[PostgreSQL] Ping falhou: %v", err)
		pool.Close()
		return
	}

	dbPool = pool
	log.Println("[PostgreSQL] Conectado com sucesso ao banco evad_db na porta 5433!")

	// Auto-migrations para garantir todas as colunas necessárias
	_, _ = pool.Exec(ctx, `
		ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS eh_debito_herdado BOOLEAN DEFAULT false;
		ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS vencimento_debito_original VARCHAR(20);
		ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS rotulo_debito VARCHAR(100);
		ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS plano VARCHAR(255);
		ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS valor_mensalidade NUMERIC(10, 2) DEFAULT 0.00;
		ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS eh_mimo BOOLEAN DEFAULT false;
		ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS contrato_principal VARCHAR(50);
		ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS mimos_vinculados TEXT;
		ALTER TABLE clientes ADD COLUMN IF NOT EXISTS bairro VARCHAR(100);
		ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS bairro VARCHAR(100);
		CREATE INDEX IF NOT EXISTS idx_clientes_bairro ON clientes(bairro);
		CREATE INDEX IF NOT EXISTS idx_bloqueio_bairro ON eventos_bloqueio(bairro);
		CREATE INDEX IF NOT EXISTS idx_bloqueio_eh_mimo ON eventos_bloqueio(eh_mimo);
		CREATE INDEX IF NOT EXISTS idx_bloqueio_contrato_principal ON eventos_bloqueio(contrato_principal);

		-- Cancelamentos com motivo "SEM USO" são Churn real (cliente pagava sem usar o ponto de internet)
		UPDATE eventos_bloqueio
		SET status_desfecho = 'churned',
		    data_desbloqueio = NULL,
		    dias_para_resolver = NULL
		WHERE UPPER(motivo_cancelamento) LIKE '%SEM USO%'
		  AND status_rbx_codigo IN ('C', 'N')
		  AND status_desfecho != 'churned';
	`)
}

var inMemoryClients = make([]ClientRecord, 0)

func normalizeHeader(h string) string {
	s := strings.ToLower(strings.TrimSpace(h))
	s = strings.ReplaceAll(s, "ã", "a")
	s = strings.ReplaceAll(s, "á", "a")
	s = strings.ReplaceAll(s, "é", "e")
	s = strings.ReplaceAll(s, "í", "i")
	s = strings.ReplaceAll(s, "ó", "o")
	s = strings.ReplaceAll(s, "ú", "u")
	s = strings.ReplaceAll(s, "ç", "c")
	s = strings.ReplaceAll(s, "/", " ")
	s = strings.ReplaceAll(s, "_", " ")
	s = strings.ReplaceAll(s, "-", " ")
	return s
}

func parseDateTimeFlexible(val string) (time.Time, bool) {
	val = strings.TrimSpace(val)
	if val == "" || val == "NULL" || val == "-" {
		return time.Time{}, false
	}

	formats := []string{
		"02/01/2006 15:04:05",
		"02/01/2006 15:04",
		"02/01/2006",
		"2006-01-02 15:04:05",
		"2006-01-02",
		"02-01-2006 15:04:05",
		"02-01-2006",
	}

	for _, f := range formats {
		if t, err := time.Parse(f, val); err == nil {
			return t, true
		}
	}

	if f, err := strconv.ParseFloat(val, 64); err == nil && f > 20000 && f < 80000 {
		excelEpoch := time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC)
		totalSecs := int64(f * 86400)
		return excelEpoch.Add(time.Duration(totalSecs) * time.Second), true
	}

	return time.Time{}, false
}

// Regra de Negócio de Bloqueios no Provedor:
// - Vencimento Dia 10: Bloqueio dias 16 a 19 do mesmo mês (M) -> Competência = M
// - Vencimento Dia 20: Bloqueio dias 26 a 29 do mesmo mês (M) -> Competência = M
// - Vencimento Dia 30: Bloqueio dias 06 a 09 do mês seguinte (M+1) -> Competência = M-1 (Mês Anterior)
func determineBillingCycle(blockTime time.Time) (competenceMonth string, cicloName string) {
	day := blockTime.Day()

	if day >= 6 && day <= 12 {
		// Bloqueio do dia 30 do mês anterior
		prevDate := blockTime.AddDate(0, -1, 0)
		return prevDate.Format("2006-01"), "Ciclo 30 (Venc. Dia 30)"
	} else if day >= 13 && day <= 22 {
		// Bloqueio do dia 10 do mesmo mês
		return blockTime.Format("2006-01"), "Ciclo 10 (Venc. Dia 10)"
	} else if day >= 23 && day <= 31 {
		// Bloqueio do dia 20 do mesmo mês
		return blockTime.Format("2006-01"), "Ciclo 20 (Venc. Dia 20)"
	} else {
		// Primeiros dias (1 a 5) associados ao ciclo 30 anterior
		prevDate := blockTime.AddDate(0, -1, 0)
		return prevDate.Format("2006-01"), "Ciclo 30 (Venc. Dia 30)"
	}
}

func getMonthLabel(key string) string {
	parts := strings.Split(key, "-")
	if len(parts) != 2 {
		return key
	}
	mNames := map[string]string{
		"01": "Janeiro",
		"02": "Fevereiro",
		"03": "Março",
		"04": "Abril",
		"05": "Maio",
		"06": "Junho",
		"07": "Julho",
		"08": "Agosto",
		"09": "Setembro",
		"10": "Outubro",
		"11": "Novembro",
		"12": "Dezembro",
	}
	name := mNames[parts[1]]
	if name == "" {
		name = parts[1]
	}
	return fmt.Sprintf("%s / %s", name, parts[0])
}

func calculateSummary(monthKey string, clients []ClientRecord) MonthlyCohortSummary {
	label := getMonthLabel(monthKey)

	summary := MonthlyCohortSummary{
		MonthKey:   monthKey,
		MonthLabel: label,
		Clients:    clients,
	}

	totalDays := 0
	daysCount := 0

	for _, c := range clients {
		// Contratos sem desfecho válido de bloqueio/coorte (ex: Transferidos 'T')
		// são retirados da coorte de retenção para não distorcer os KPIs da imagem
		if c.Status == "other" {
			summary.OtherCount++
			summary.OtherMrr += c.MonthlyFee
			continue
		}

		// Contratos mimos / SVA (ex: TV, GloboPlay, gratuitos R$ 0,00)
		// são excluídos de TODAS as contagens de KPIs e Dashboards
		if c.IsMimo {
			summary.MimoCount++
			continue
		}

		summary.TotalBlocked++
		summary.TotalMrrBlocked += c.MonthlyFee

		if c.IsInheritedDebt {
			summary.InheritedCount++
			summary.InheritedMrr += c.MonthlyFee
		} else {
			summary.PureTotalBlocked++
			summary.PureTotalMrr += c.MonthlyFee
		}

		switch c.Status {
		case "returned":
			summary.ReturnedCount++
			summary.ReturnedMrr += c.MonthlyFee
			if c.DaysToResolve != nil {
				d := *c.DaysToResolve
				totalDays += d
				daysCount++
				if d <= 7 {
					summary.Returned0to7Days++
				} else if d <= 15 {
					summary.Returned8to15Days++
				} else if d <= 30 {
					summary.Returned16to30Days++
				} else {
					summary.ReturnedOver30Days++
				}
			}
		case "churned":
			summary.ChurnedCount++
			summary.ChurnedMrr += c.MonthlyFee
		case "suspended":
			summary.SuspendedCount++
			summary.SuspendedMrr += c.MonthlyFee
		case "blocked":
			summary.StillBlockedCount++
			summary.StillBlockedMrr += c.MonthlyFee
		}
	}

	if summary.TotalBlocked > 0 {
		summary.ReturnedRate = math.Round((float64(summary.ReturnedCount)/float64(summary.TotalBlocked))*1000) / 10
		summary.ChurnRate = math.Round((float64(summary.ChurnedCount)/float64(summary.TotalBlocked))*1000) / 10
		summary.SuspendedRate = math.Round((float64(summary.SuspendedCount)/float64(summary.TotalBlocked))*1000) / 10
		summary.StillBlockedRate = math.Round((float64(summary.StillBlockedCount)/float64(summary.TotalBlocked))*1000) / 10
	}

	if daysCount > 0 {
		summary.AvgDaysToReturn = math.Round((float64(totalDays)/float64(daysCount))*10) / 10
	}

	return summary
}

func queryCohortFromDB(ctx context.Context, month string, viewMode string) ([]ClientRecord, error) {
	if dbPool == nil {
		return inMemoryClients, nil
	}

	whereClause := "e.mes_competencia = $1"
	if viewMode == "pure" {
		whereClause += " AND (e.eh_debito_herdado IS FALSE OR e.eh_debito_herdado IS NULL)"
	}

	query := fmt.Sprintf(`
		SELECT 
			e.id, c.codigo_rbx, COALESCE(e.contrato, ''), c.nome, 
			COALESCE(c.cidade, ''), 
			COALESCE(NULLIF(e.plano, ''), c.plano, ''), 
			CASE WHEN e.eh_mimo IS TRUE THEN 0.00 ELSE COALESCE(NULLIF(e.valor_mensalidade, 0), c.valor_mensalidade, 0) END,
			e.ciclo_vencimento, e.mes_competencia,
			TO_CHAR(e.data_bloqueio, 'DD/MM/YYYY HH24:MI:SS') as data_bloqueio,
			TO_CHAR(e.data_desbloqueio, 'DD/MM/YYYY HH24:MI:SS') as data_desbloqueio,
			e.dias_para_resolver,
			e.status_desfecho,
			COALESCE(e.operacao, 'Bloqueio'),
			COALESCE(e.usuario_rbx, 'routerbox'),
			COALESCE(e.status_rbx_codigo, 'B'),
			COALESCE(e.status_rbx_descricao, 'Bloqueado'),
			COALESCE(e.motivo_cancelamento, ''),
			e.dias_vencido,
			TO_CHAR(e.sincronizado_em, 'DD/MM/YYYY HH24:MI:SS') as sincronizado_em,
			TO_CHAR(e.ultima_operacao_rbx, 'DD/MM/YYYY') as ultima_operacao_rbx,
			COALESCE(e.eh_debito_herdado, FALSE) as eh_debito_herdado,
			COALESCE(e.vencimento_debito_original, '') as vencimento_debito_original,
			COALESCE(e.rotulo_debito, '') as rotulo_debito,
			COALESCE(e.eh_mimo, FALSE) as eh_mimo,
			COALESCE(e.contrato_principal, '') as contrato_principal,
			COALESCE(e.mimos_vinculados, '') as mimos_vinculados,
			COALESCE(NULLIF(e.bairro, ''), c.bairro, '') as bairro
		FROM eventos_bloqueio e
		JOIN clientes c ON c.codigo_rbx = e.codigo_rbx
		WHERE %s
		ORDER BY e.data_bloqueio DESC
	`, whereClause)

	rows, err := dbPool.Query(ctx, query, month)
	if err != nil {
		log.Printf("[DB ERROR queryCohortFromDB] %v", err)
		return nil, err
	}
	defer rows.Close()

	var list []ClientRecord
	for rows.Next() {
		var cr ClientRecord
		var unblockDate *string
		var days *int
		var daysOverdue *int
		var syncAt *string
		var lastOp *string
		if err := rows.Scan(
			&cr.ID, &cr.RbxCode, &cr.Contract, &cr.Name,
			&cr.City, &cr.Plan, &cr.MonthlyFee,
			&cr.BillingCycle, &cr.CompetenceMonth,
			&cr.BlockDate, &unblockDate, &days,
			&cr.Status, &cr.Operation, &cr.UserRBX,
			&cr.RbxStatusCode, &cr.RbxStatusText, &cr.CancellationReason,
			&daysOverdue, &syncAt, &lastOp,
			&cr.IsInheritedDebt, &cr.OriginalDebtDueDate, &cr.DebtLabel,
			&cr.IsMimo, &cr.PrimaryContract, &cr.LinkedMimos,
			&cr.Neighborhood,
		); err != nil {
			log.Printf("[DB ERROR scan] %v", err)
			continue
		}
		cr.UnblockDate = unblockDate
		cr.DaysToResolve = days
		cr.DaysOverdue = daysOverdue
		cr.LastRbxSyncAt = syncAt
		cr.LastOperationRbx = lastOp
		list = append(list, cr)
	}

	return list, nil
}

func queryBreakdown(ctx context.Context, dimensionExpr string, cityExpr string, filterCondition string, filterArg string, viewMode string) ([]BreakdownItem, error) {
	if dbPool == nil {
		return nil, nil
	}

	whereClause := filterCondition
	if viewMode == "pure" {
		whereClause += " AND (e.eh_debito_herdado IS FALSE OR e.eh_debito_herdado IS NULL)"
	}
	whereClause += " AND e.status_desfecho IN ('returned', 'churned', 'suspended', 'blocked')"
	whereClause += " AND (e.eh_mimo IS FALSE OR e.eh_mimo IS NULL)"

	feeExpr := "CASE WHEN e.eh_mimo IS TRUE THEN 0 ELSE COALESCE(NULLIF(e.valor_mensalidade, 0), c.valor_mensalidade, 0) END"

	var selectCity, groupByClause string
	if cityExpr != "" {
		selectCity = fmt.Sprintf(", %s AS city_name", cityExpr)
		groupByClause = "GROUP BY item_name, city_name"
	} else {
		selectCity = ", '' AS city_name"
		groupByClause = "GROUP BY item_name"
	}

	query := fmt.Sprintf(`
		SELECT 
			%s AS item_name%s,
			COUNT(e.id) AS total_blocked,
			COALESCE(SUM(%s), 0) AS total_mrr,
			COUNT(CASE WHEN e.status_desfecho = 'returned' THEN 1 END) AS returned_count,
			COALESCE(SUM(CASE WHEN e.status_desfecho = 'returned' THEN (%s) ELSE 0 END), 0) AS returned_mrr,
			COUNT(CASE WHEN e.status_desfecho = 'churned' THEN 1 END) AS churned_count,
			COALESCE(SUM(CASE WHEN e.status_desfecho = 'churned' THEN (%s) ELSE 0 END), 0) AS churned_mrr,
			COUNT(CASE WHEN e.status_desfecho = 'suspended' THEN 1 END) AS suspended_count,
			COALESCE(SUM(CASE WHEN e.status_desfecho = 'suspended' THEN (%s) ELSE 0 END), 0) AS suspended_mrr,
			COUNT(CASE WHEN e.status_desfecho = 'blocked' THEN 1 END) AS blocked_count,
			COALESCE(SUM(CASE WHEN e.status_desfecho = 'blocked' THEN (%s) ELSE 0 END), 0) AS blocked_mrr,
			COALESCE(AVG(CASE WHEN e.status_desfecho = 'returned' AND e.dias_para_resolver IS NOT NULL THEN e.dias_para_resolver END), 0) AS avg_days
		FROM eventos_bloqueio e
		JOIN clientes c ON c.codigo_rbx = e.codigo_rbx
		WHERE %s
		%s
		ORDER BY total_blocked DESC
	`, dimensionExpr, selectCity, feeExpr, feeExpr, feeExpr, feeExpr, feeExpr, whereClause, groupByClause)

	rows, err := dbPool.Query(ctx, query, filterArg)
	if err != nil {
		log.Printf("[DB ERROR breakdown] %v", err)
		return nil, err
	}
	defer rows.Close()

	var items []BreakdownItem
	for rows.Next() {
		var bi BreakdownItem
		var avgDays float64
		if err := rows.Scan(
			&bi.Name, &bi.City, &bi.TotalBlocked, &bi.TotalMrr,
			&bi.ReturnedCount, &bi.ReturnedMrr,
			&bi.ChurnedCount, &bi.ChurnedMrr,
			&bi.SuspendedCount, &bi.SuspendedMrr,
			&bi.StillBlockedCount, &bi.StillBlockedMrr,
			&avgDays,
		); err != nil {
			log.Printf("[DB ERROR breakdown scan] %v", err)
			continue
		}

		if bi.TotalBlocked > 0 {
			bi.ReturnedRate = math.Round((float64(bi.ReturnedCount)/float64(bi.TotalBlocked))*1000) / 10
			bi.ChurnRate = math.Round((float64(bi.ChurnedCount)/float64(bi.TotalBlocked))*1000) / 10
			bi.StillBlockedRate = math.Round((float64(bi.StillBlockedCount)/float64(bi.TotalBlocked))*1000) / 10
		}
		bi.AvgDaysToReturn = math.Round(avgDays*10) / 10
		items = append(items, bi)
	}

	return items, nil
}

func queryAvailableMonths(ctx context.Context) []string {
	if dbPool == nil {
		return []string{"2026-01"}
	}
	rows, err := dbPool.Query(ctx, `SELECT DISTINCT mes_competencia FROM eventos_bloqueio ORDER BY mes_competencia DESC`)
	if err != nil {
		return []string{"2026-01"}
	}
	defer rows.Close()
	var months []string
	for rows.Next() {
		var m string
		if err := rows.Scan(&m); err == nil && m != "" {
			months = append(months, m)
		}
	}
	if len(months) == 0 {
		return []string{"2026-01"}
	}
	return months
}

func queryAvailableYears(ctx context.Context) []string {
	yearSet := make(map[string]bool)
	curY := time.Now().Year()
	yearSet[fmt.Sprintf("%d", curY)] = true
	yearSet[fmt.Sprintf("%d", curY-1)] = true
	yearSet[fmt.Sprintf("%d", curY+1)] = true

	if dbPool != nil {
		rows, err := dbPool.Query(ctx, `SELECT DISTINCT SUBSTRING(mes_competencia FROM 1 FOR 4) FROM eventos_bloqueio WHERE mes_competencia IS NOT NULL AND mes_competencia != '' ORDER BY 1 DESC`)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var y string
				if err := rows.Scan(&y); err == nil && y != "" {
					yearSet[y] = true
				}
			}
		}
	}

	var years []string
	for y := range yearSet {
		years = append(years, y)
	}
	sort.Sort(sort.Reverse(sort.StringSlice(years)))
	return years
}

type SyncResult struct {
	Success    bool           `json:"success"`
	Message    string         `json:"message"`
	LastSyncAt string         `json:"lastSyncAt"`
	Stats      map[string]int `json:"stats"`
	Strategy   string         `json:"strategy"`
	Duration   string         `json:"duration"`
	Error      string         `json:"error,omitempty"`
}

func getNextSyncTime() time.Time {
	now := time.Now()
	// Horários programados: 03:30 e 12:30
	today330 := time.Date(now.Year(), now.Month(), now.Day(), 3, 30, 0, 0, now.Location())
	today1230 := time.Date(now.Year(), now.Month(), now.Day(), 12, 30, 0, 0, now.Location())
	tomorrow330 := today330.AddDate(0, 0, 1)

	if now.Before(today330) {
		return today330
	} else if now.Before(today1230) {
		return today1230
	} else {
		return tomorrow330
	}
}

func startBackgroundSyncScheduler() {
	go func() {
		log.Println("[Scheduler] Agendador RBX iniciado. Horários de execução diária: 03:30 e 12:30 (Estratégia Delta de Baixo Consumo).")
		for {
			now := time.Now()
			nextRun := getNextSyncTime()
			duration := nextRun.Sub(now)

			log.Printf("[Scheduler] Próxima sincronização automática programada para: %s (daqui a %v)",
				nextRun.Format("02/01/2006 15:04:05"), duration.Round(time.Second))

			time.Sleep(duration)

			if dbPool != nil {
				var autoSync bool
				err := dbPool.QueryRow(context.Background(), "SELECT auto_sync FROM configuracoes_rbx WHERE id = 1").Scan(&autoSync)
				if err == nil && !autoSync {
					log.Println("[Scheduler] Sincronização automática desativada nas configurações. Aguardando próximo ciclo.")
					time.Sleep(1 * time.Minute)
					continue
				}
			}

			log.Printf("[Scheduler] Executando rotina delta programada das %s...", time.Now().Format("15:04"))
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
			res, err := executeRbxSync(ctx, "", true /* deltaOnly */)
			cancel()

			if err != nil {
				log.Printf("[Scheduler ERROR] Falha na sincronização programada: %v", err)
			} else {
				log.Printf("[Scheduler SUCESSO] %s", res.Message)
			}

			time.Sleep(1 * time.Minute)
		}
	}()
}

func executeRbxSync(ctx context.Context, month string, deltaOnly bool) (*SyncResult, error) {
	if dbPool == nil {
		return nil, fmt.Errorf("banco de dados não disponível")
	}

	start := time.Now()

	// 1. Obter credenciais do RBX
	var rbxURL, rbxToken, rbxVersion string
	err := dbPool.QueryRow(ctx, "SELECT rbx_url, rbx_token, rbx_version FROM configuracoes_rbx WHERE id = 1").Scan(&rbxURL, &rbxToken, &rbxVersion)
	if err != nil || strings.TrimSpace(rbxURL) == "" || strings.TrimSpace(rbxToken) == "" {
		return nil, fmt.Errorf("integração RBX não configurada. Configure a URL e a Chave de Integração do RBX antes de sincronizar")
	}

	// 2. Buscar eventos de bloqueio a sincronizar
	type EventSyncInfo struct {
		ID              string
		Contract        string
		CodigoRbx       string
		Competencia     string
		BlockDate       time.Time
		DataDesbloqueio *time.Time
	}

	var eventRows []EventSyncInfo
	var query string
	var args []interface{}

	strategy := "completa"
	if deltaOnly {
		strategy = "delta_inteligente"
	}

	if month != "" {
		if deltaOnly {
			query = `SELECT id, contrato, codigo_rbx, mes_competencia, data_bloqueio, data_desbloqueio 
			         FROM eventos_bloqueio 
			         WHERE mes_competencia = $1 
			           AND (status_desfecho IN ('blocked', 'suspended', 'other') OR status_desfecho IS NULL)`
			args = append(args, month)
		} else {
			query = `SELECT id, contrato, codigo_rbx, mes_competencia, data_bloqueio, data_desbloqueio 
			         FROM eventos_bloqueio 
			         WHERE mes_competencia = $1`
			args = append(args, month)
		}
	} else {
		if deltaOnly {
			query = `SELECT id, contrato, codigo_rbx, mes_competencia, data_bloqueio, data_desbloqueio 
			         FROM eventos_bloqueio 
			         WHERE status_desfecho IN ('blocked', 'suspended', 'other') OR status_desfecho IS NULL`
		} else {
			query = `SELECT id, contrato, codigo_rbx, mes_competencia, data_bloqueio, data_desbloqueio 
			         FROM eventos_bloqueio`
		}
	}

	rows, err := dbPool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("erro ao consultar contratos: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id, c, cod, comp string
		var bDate time.Time
		var uDate *time.Time
		if err := rows.Scan(&id, &c, &cod, &comp, &bDate, &uDate); err == nil && strings.TrimSpace(c) != "" {
			eventRows = append(eventRows, EventSyncInfo{
				ID:              id,
				Contract:        strings.TrimSpace(c),
				CodigoRbx:       strings.TrimSpace(cod),
				Competencia:     strings.TrimSpace(comp),
				BlockDate:       bDate,
				DataDesbloqueio: uDate,
			})
		}
	}

	now := time.Now()
	nowStr := now.Format("02/01/2006 15:04:05")

	if len(eventRows) == 0 {
		return &SyncResult{
			Success:    true,
			Message:    "Nenhum contrato pendente na base para sincronizar (todos já regularizados ou consolidados).",
			LastSyncAt: nowStr,
			Strategy:   strategy,
			Duration:   time.Since(start).Round(time.Millisecond).String(),
			Stats:      map[string]int{"total": 0},
		}, nil
	}

	// Extrai códigos únicos de contratos (removendo pontos e vírgulas) e indexa eventos por contrato
	uniqueContractsMap := make(map[string]bool)
	uniqueContracts := make([]string, 0, len(eventRows))
	eventsByContract := make(map[string][]EventSyncInfo)

	for _, ev := range eventRows {
		clean := strings.ReplaceAll(ev.Contract, ".", "")
		clean = strings.ReplaceAll(clean, ",", "")
		clean = strings.TrimSpace(clean)
		if clean != "" {
			eventsByContract[clean] = append(eventsByContract[clean], ev)
			if !uniqueContractsMap[clean] {
				uniqueContractsMap[clean] = true
				uniqueContracts = append(uniqueContracts, clean)
			}
		}
	}

	client := rbx.NewClient(rbx.Config{
		URL:     rbxURL,
		Token:   rbxToken,
		Version: rbxVersion,
	})

	// 2.1 Consulta antecipada de faturas abertas no RBX para a "Regra da Soberania do Boleto" (Opção 1)
	type openDocInfo struct {
		DueDate string
		Value   float64
	}
	openInvoicesByContract := make(map[string][]openDocInfo)
	openInvoicesByClient := make(map[string][]openDocInfo)

	openDocs, errOpen := client.ConsultarDocumentosAbertos(ctx, "Origem = 'FAT'")
	if errOpen != nil {
		log.Printf("[RBX SYNC WARN] Não foi possível consultar documentos abertos: %v", errOpen)
	} else {
		for _, doc := range openDocs {
			d := openDocInfo{DueDate: doc.DueDate, Value: doc.Value}
			if doc.ContractCode != "" {
				openInvoicesByContract[doc.ContractCode] = append(openInvoicesByContract[doc.ContractCode], d)
			}
			if doc.ClientCode != "" {
				openInvoicesByClient[doc.ClientCode] = append(openInvoicesByClient[doc.ClientCode], d)
			}
		}
		log.Printf("[RBX SYNC] %d documentos abertos indexados para verificação da Soberania do Boleto", len(openDocs))
	}

	// 3. Consulta em lotes (batch) de 50 contratos
	batchSize := 50
	syncStats := map[string]int{
		"total":       0,
		"active":      0,
		"blocked":     0,
		"churned":     0,
		"suspended":   0,
		"tempUnblock": 0,
		"other":       0,
	}

	var lastError error
	for i := 0; i < len(uniqueContracts); i += batchSize {
		end := i + batchSize
		if end > len(uniqueContracts) {
			end = len(uniqueContracts)
		}
		chunk := uniqueContracts[i:end]

		results, err := client.ConsultarContratos(ctx, chunk)
		if err != nil {
			lastError = err
			log.Printf("[RBX SYNC ERROR lote %d-%d] %v", i, end, err)
			if strings.Contains(err.Error(), "Invalid service") || strings.Contains(err.Error(), "98") {
				break
			}
			continue
		}

		// Atualiza cada contrato no banco de dados com refinamento temporal e soberania do boleto
		for _, res := range results {
			cleanNum := strings.ReplaceAll(strings.ReplaceAll(res.ContractCode, ".", ""), ",", "")
			cleanNum = strings.TrimSpace(cleanNum)
			cleanCli := strings.ReplaceAll(strings.ReplaceAll(res.ClientCode, ".", ""), ",", "")
			cleanCli = strings.TrimSpace(cleanCli)

			isMimo := (res.MonthlyFee <= 0.01)

			// Atualiza o evento com o plano, mensalidade e bairro específicos deste contrato
			_, _ = dbPool.Exec(ctx, `
				UPDATE eventos_bloqueio SET
					plano = CASE WHEN $1 != '' THEN $1 ELSE plano END,
					valor_mensalidade = $2,
					eh_mimo = $3,
					bairro = CASE WHEN $5 != '' THEN $5 ELSE bairro END
				WHERE REPLACE(REPLACE(contrato, '.', ''), ',', '') = $4
			`, res.Plan, res.MonthlyFee, isMimo, cleanNum, res.Neighborhood)

			// Atualiza dados do cliente no cadastro
			if res.MonthlyFee > 0 {
				_, _ = dbPool.Exec(ctx, `
					UPDATE clientes SET
						valor_mensalidade = $1,
						plano = CASE WHEN $2 != '' THEN $2 ELSE plano END,
						contrato = CASE WHEN $3 != '' THEN $3 ELSE contrato END,
						cidade = CASE WHEN $4 != '' THEN $4 ELSE cidade END,
						nome = CASE WHEN $5 != '' THEN $5 ELSE nome END,
						bairro = CASE WHEN $8 != '' THEN $8 ELSE bairro END
					WHERE (codigo_rbx = $6 OR REPLACE(REPLACE(contrato, '.', ''), ',', '') = $7)
				`, res.MonthlyFee, res.Plan, res.ContractCode, res.City, res.ClientName, cleanCli, cleanNum, res.Neighborhood)
			} else {
				_, _ = dbPool.Exec(ctx, `
					UPDATE clientes SET
						cidade = CASE WHEN (cidade IS NULL OR cidade = '') AND $1 != '' THEN $1 ELSE cidade END,
						nome = CASE WHEN (nome IS NULL OR nome = '') AND $2 != '' THEN $2 ELSE nome END,
						bairro = CASE WHEN (bairro IS NULL OR bairro = '') AND $5 != '' THEN $5 ELSE bairro END
					WHERE (codigo_rbx = $3 OR REPLACE(REPLACE(contrato, '.', ''), ',', '') = $4)
				`, res.City, res.ClientName, cleanCli, cleanNum, res.Neighborhood)
			}

			var lastOpDate *time.Time = res.LastOperationDate

			for _, ev := range eventsByContract[cleanNum] {
				bDate := ev.BlockDate

				hasOpenCohortInvoice := false
				isInheritedDebt := false
				origDueDate := ""
				debtLabel := ""

				if !bDate.IsZero() {
					maxDueDate := bDate.AddDate(0, 0, 15).Format("2006-01-02")
					minDueDate := bDate.AddDate(0, 0, -90).Format("2006-01-02")
					cohortMonthStart := ev.Competencia + "-01"
					hasCurrentOrFutureInvoice := false
					var oldestDueDate string

					var docs []openDocInfo
					if d, ok := openInvoicesByContract[cleanNum]; ok {
						docs = append(docs, d...)
					}
					if d, ok := openInvoicesByClient[cleanCli]; ok {
						docs = append(docs, d...)
					}
					for _, d := range docs {
						if d.DueDate >= minDueDate && d.DueDate <= maxDueDate {
							hasOpenCohortInvoice = true
							if oldestDueDate == "" || d.DueDate < oldestDueDate {
								oldestDueDate = d.DueDate
							}
							if d.DueDate >= cohortMonthStart {
								hasCurrentOrFutureInvoice = true
							}
						}
					}

					if hasOpenCohortInvoice && !hasCurrentOrFutureInvoice && oldestDueDate != "" {
						isInheritedDebt = true
						origDueDate = oldestDueDate
						parts := strings.Split(oldestDueDate, "-")
						displayDate := oldestDueDate
						if len(parts) == 3 {
							displayDate = parts[2] + "/" + parts[1] + "/" + parts[0]
						}
						debtLabel = fmt.Sprintf("Inadimplência de Renegociação Anterior (Débito Original Venc. %s)", displayDate)
					}
				}

				syncStats["total"]++

				var evadStatus string
				isSemUso := strings.Contains(strings.ToUpper(res.CancellationReason), "SEM USO")

				if hasOpenCohortInvoice {
					if res.StatusCode == "C" || res.StatusCode == "N" {
						evadStatus = "churned"
						syncStats["churned"]++
					} else if res.StatusCode == "S" {
						evadStatus = "suspended"
						syncStats["suspended"]++
					} else {
						evadStatus = "blocked"
						syncStats["blocked"]++
					}

					_, _ = dbPool.Exec(ctx, `
						UPDATE eventos_bloqueio SET
							status_rbx_codigo = $1,
							status_rbx_descricao = $2,
							motivo_cancelamento = $3,
							dias_vencido = $4,
							status_desfecho = $5,
							data_desbloqueio = NULL,
							dias_para_resolver = NULL,
							ultima_operacao_rbx = $6,
							sincronizado_em = $7,
							eh_debito_herdado = $8,
							vencimento_debito_original = $9,
							rotulo_debito = $10
						WHERE id = $11
					`, res.StatusCode, res.StatusText, res.CancellationReason, res.DaysOverdue, evadStatus, lastOpDate, now, isInheritedDebt, origDueDate, debtLabel, ev.ID)
					continue
				}

				if res.StatusCode == "A" {
					evadStatus = "returned"
					syncStats["active"]++
				} else if res.StatusCode == "B" {
					evadStatus = "blocked"
					syncStats["blocked"]++
				} else if res.StatusCode == "C" || res.StatusCode == "N" {
					evadStatus = "churned"
					syncStats["churned"]++
				} else if res.StatusCode == "S" {
					evadStatus = "suspended"
					syncStats["suspended"]++
				} else if res.StatusCode == "D" {
					evadStatus = "returned"
					syncStats["tempUnblock"]++
				} else {
					evadStatus = "other"
					syncStats["other"]++
				}

				if isSemUso && (res.StatusCode == "C" || res.StatusCode == "N") {
					evadStatus = "churned"
					_, _ = dbPool.Exec(ctx, `
						UPDATE eventos_bloqueio SET
							status_rbx_codigo = $1,
							status_rbx_descricao = $2,
							motivo_cancelamento = $3,
							dias_vencido = $4,
							status_desfecho = 'churned',
							data_desbloqueio = NULL,
							dias_para_resolver = NULL,
							ultima_operacao_rbx = $5,
							sincronizado_em = $6,
							eh_debito_herdado = $7,
							vencimento_debito_original = $8,
							rotulo_debito = $9
						WHERE id = $10
					`, res.StatusCode, res.StatusText, res.CancellationReason, res.DaysOverdue, lastOpDate, now, isInheritedDebt, origDueDate, debtLabel, ev.ID)
					continue
				}

				if evadStatus == "returned" && ev.DataDesbloqueio == nil && lastOpDate != nil {
					calcUnblock := *lastOpDate
					days := int(calcUnblock.Sub(ev.BlockDate).Hours() / 24)
					if days < 0 {
						days = 0
					}

					var bucket string
					if days <= 7 {
						bucket = "0-7"
					} else if days <= 15 {
						bucket = "8-15"
					} else if days <= 30 {
						bucket = "16-30"
					} else {
						bucket = ">30"
					}

					_, _ = dbPool.Exec(ctx, `
						UPDATE eventos_bloqueio SET
							status_rbx_codigo = $1,
							status_rbx_descricao = $2,
							motivo_cancelamento = $3,
							dias_vencido = $4,
							status_desfecho = $5,
							data_desbloqueio = $6,
							dias_para_resolver = $7,
							faixa_tempo = $8,
							ultima_operacao_rbx = $9,
							sincronizado_em = $10,
							eh_debito_herdado = $11,
							vencimento_debito_original = $12,
							rotulo_debito = $13
						WHERE id = $14
					`, res.StatusCode, res.StatusText, res.CancellationReason, res.DaysOverdue, evadStatus, calcUnblock, days, bucket, lastOpDate, now, isInheritedDebt, origDueDate, debtLabel, ev.ID)
				} else if evadStatus == "churned" {
					_, _ = dbPool.Exec(ctx, `
						UPDATE eventos_bloqueio SET
							status_rbx_codigo = $1,
							status_rbx_descricao = $2,
							motivo_cancelamento = $3,
							dias_vencido = $4,
							status_desfecho = 'churned',
							faixa_tempo = 'cancelado',
							data_desbloqueio = NULL,
							dias_para_resolver = NULL,
							ultima_operacao_rbx = $5,
							sincronizado_em = $6,
							eh_debito_herdado = $7,
							vencimento_debito_original = $8,
							rotulo_debito = $9
						WHERE id = $10
					`, res.StatusCode, res.StatusText, res.CancellationReason, res.DaysOverdue, lastOpDate, now, isInheritedDebt, origDueDate, debtLabel, ev.ID)
				} else {
					_, _ = dbPool.Exec(ctx, `
						UPDATE eventos_bloqueio SET
							status_rbx_codigo = $1,
							status_rbx_descricao = $2,
							motivo_cancelamento = $3,
							dias_vencido = $4,
							status_desfecho = $5,
							ultima_operacao_rbx = $6,
							sincronizado_em = $7,
							eh_debito_herdado = $8,
							vencimento_debito_original = $9,
							rotulo_debito = $10
						WHERE id = $11
					`, res.StatusCode, res.StatusText, res.CancellationReason, res.DaysOverdue, evadStatus, lastOpDate, now, isInheritedDebt, origDueDate, debtLabel, ev.ID)
				}
			}
		}
	}

	// Vinculação pós-sincronização de Mimos aos Contratos Principais:
	_, _ = dbPool.Exec(ctx, `
		UPDATE eventos_bloqueio m
		SET contrato_principal = p.contrato
		FROM (
			SELECT DISTINCT ON (codigo_rbx, mes_competencia) codigo_rbx, mes_competencia, contrato
			FROM eventos_bloqueio
			WHERE (eh_mimo IS FALSE OR eh_mimo IS NULL) AND valor_mensalidade > 0
			ORDER BY codigo_rbx, mes_competencia, valor_mensalidade DESC
		) p
		WHERE m.eh_mimo IS TRUE 
		  AND m.codigo_rbx = p.codigo_rbx 
		  AND m.mes_competencia = p.mes_competencia
	`)

	_, _ = dbPool.Exec(ctx, `
		UPDATE eventos_bloqueio p
		SET mimos_vinculados = m.nomes_mimos
		FROM (
			SELECT codigo_rbx, mes_competencia, STRING_AGG(DISTINCT plano, ', ') as nomes_mimos
			FROM eventos_bloqueio
			WHERE eh_mimo IS TRUE AND plano IS NOT NULL AND plano != ''
			GROUP BY codigo_rbx, mes_competencia
		) m
		WHERE (p.eh_mimo IS FALSE OR p.eh_mimo IS NULL)
		  AND p.codigo_rbx = m.codigo_rbx 
		  AND p.mes_competencia = m.mes_competencia
	`)

	// Propagar bairros/vilas para qualquer evento que ainda não tenha
	_, _ = dbPool.Exec(ctx, `
		UPDATE eventos_bloqueio e
		SET bairro = c.bairro
		FROM clientes c
		WHERE REPLACE(REPLACE(e.codigo_rbx, '.', ''), ',', '') = REPLACE(REPLACE(c.codigo_rbx, '.', ''), ',', '')
		  AND (e.bairro IS NULL OR e.bairro = '')
		  AND c.bairro IS NOT NULL AND c.bairro != ''
	`)

	// Enriquecer automaticamente Bairros/Vilas cadastrais (ConsultaClientes serviço 44) caso existam clientes sem bairro
	enrichMissingBairros(ctx, client)

	if syncStats["total"] == 0 && lastError != nil {
		errMessage := lastError.Error()
		_, _ = dbPool.Exec(ctx, `
			UPDATE configuracoes_rbx SET 
				status_conexao = 'erro', 
				ultimo_erro = $1,
				atualizado_em = CURRENT_TIMESTAMP 
			WHERE id = 1
		`, errMessage)
		return nil, lastError
	}

	// Atualiza timestamp da última sincronização
	_, _ = dbPool.Exec(ctx, `
		UPDATE configuracoes_rbx SET 
			last_sync_at = $1, 
			status_conexao = 'conectado', 
			ultimo_erro = '',
			atualizado_em = CURRENT_TIMESTAMP 
		WHERE id = 1
	`, now)

	durationStr := time.Since(start).Round(time.Millisecond).String()
	msg := fmt.Sprintf("Sincronização RBX (%s) concluída: %d contratos consultados em %s!", strategy, syncStats["total"], durationStr)
	if deltaOnly {
		msg = fmt.Sprintf("Sincronização Delta concluída: %d contratos pendentes verificados em %s (economia de chamadas ao RBX).", syncStats["total"], durationStr)
	}

	return &SyncResult{
		Success:    true,
		Message:    msg,
		LastSyncAt: nowStr,
		Stats:      syncStats,
		Strategy:   strategy,
		Duration:   durationStr,
	}, nil
}

func enrichMissingBairros(ctx context.Context, client *rbx.Client) (int, int) {
	if dbPool == nil || client == nil {
		return 0, 0
	}

	// 1. Obter clientes cadastrados com bairro nulo, vazio ou 'Não Informado'
	rows, err := dbPool.Query(ctx, `
		SELECT DISTINCT REPLACE(REPLACE(codigo_rbx, '.', ''), ',', '') 
		FROM clientes 
		WHERE (bairro IS NULL OR bairro = '' OR bairro = 'Não Informado')
		  AND codigo_rbx IS NOT NULL AND codigo_rbx != '' 
		ORDER BY 1
	`)
	if err != nil {
		log.Printf("[RBX ENRICH BAIRROS] Erro ao consultar clientes sem bairro: %v", err)
		return 0, 0
	}
	defer rows.Close()

	var allCodes []string
	for rows.Next() {
		var cod string
		if err := rows.Scan(&cod); err == nil && strings.TrimSpace(cod) != "" {
			allCodes = append(allCodes, strings.TrimSpace(cod))
		}
	}
	rows.Close()

	if len(allCodes) == 0 {
		return 0, 0
	}

	log.Printf("[RBX ENRICH BAIRROS] Enriquecendo %d clientes sem bairro cadastrado via ConsultaClientes (serviço 44)...", len(allCodes))

	updatedClients := 0
	batchSize := 100
	for i := 0; i < len(allCodes); i += batchSize {
		end := i + batchSize
		if end > len(allCodes) {
			end = len(allCodes)
		}
		chunk := allCodes[i:end]

		addrMap, err := client.ConsultarClientes(ctx, chunk)
		if err != nil {
			log.Printf("[RBX ENRICH BAIRROS] Erro no lote %d-%d: %v", i, end, err)
			continue
		}

		for code, info := range addrMap {
			if info.Neighborhood != "" || info.City != "" {
				_, err := dbPool.Exec(ctx, `
					UPDATE clientes SET
						bairro = CASE WHEN $1 != '' THEN $1 ELSE bairro END,
						cidade = CASE WHEN (cidade IS NULL OR cidade = '' OR cidade = 'Não Informado') AND $2 != '' THEN $2 ELSE cidade END
					WHERE REPLACE(REPLACE(codigo_rbx, '.', ''), ',', '') = $3
				`, info.Neighborhood, info.City, code)
				if err == nil {
					updatedClients++
				}
			}
		}
	}

	// 2. Propagar bairros atualizados da tabela clientes para eventos_bloqueio
	cmdTag, err := dbPool.Exec(ctx, `
		UPDATE eventos_bloqueio e
		SET bairro = c.bairro
		FROM clientes c
		WHERE REPLACE(REPLACE(e.codigo_rbx, '.', ''), ',', '') = REPLACE(REPLACE(c.codigo_rbx, '.', ''), ',', '')
		  AND (e.bairro IS NULL OR e.bairro = '' OR e.bairro = 'Não Informado')
		  AND c.bairro IS NOT NULL AND c.bairro != '' AND c.bairro != 'Não Informado'
	`)
	updatedEvents := int64(0)
	if err == nil {
		updatedEvents = cmdTag.RowsAffected()
	}

	// 3. Fallback adicional via ConsultaContratos para contratos restantes sem bairro
	var remainingContracts []string
	cRows, err := dbPool.Query(ctx, `
		SELECT DISTINCT REPLACE(REPLACE(contrato, '.', ''), ',', '')
		FROM eventos_bloqueio
		WHERE (bairro IS NULL OR bairro = '' OR bairro = 'Não Informado') AND contrato IS NOT NULL AND contrato != ''
		LIMIT 500
	`)
	if err == nil {
		defer cRows.Close()
		for cRows.Next() {
			var ct string
			if err := cRows.Scan(&ct); err == nil && ct != "" {
				remainingContracts = append(remainingContracts, ct)
			}
		}
	}

	if len(remainingContracts) > 0 {
		cBatchSize := 50
		for i := 0; i < len(remainingContracts); i += cBatchSize {
			end := i + cBatchSize
			if end > len(remainingContracts) {
				end = len(remainingContracts)
			}
			cChunk := remainingContracts[i:end]
			cResults, cErr := client.ConsultarContratos(ctx, cChunk)
			if cErr == nil {
				for _, cr := range cResults {
					if cr.Neighborhood != "" {
						cleanCt := strings.ReplaceAll(strings.ReplaceAll(cr.ContractCode, ".", ""), ",", "")
						_, _ = dbPool.Exec(ctx, `
							UPDATE eventos_bloqueio SET bairro = $1 WHERE REPLACE(REPLACE(contrato, '.', ''), ',', '') = $2
						`, cr.Neighborhood, cleanCt)
						_, _ = dbPool.Exec(ctx, `
							UPDATE clientes SET bairro = $1 WHERE REPLACE(REPLACE(contrato, '.', ''), ',', '') = $2 AND (bairro IS NULL OR bairro = '' OR bairro = 'Não Informado')
						`, cr.Neighborhood, cleanCt)
					}
				}
			}
		}
	}

	log.Printf("[RBX ENRICH BAIRROS] Concluído! %d clientes e %d eventos atualizados com bairro/vila.", updatedClients, updatedEvents)
	return updatedClients, int(updatedEvents)
}

func main() {
	initDB()
	startBackgroundSyncScheduler()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:3000", "*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		dbStatus := "connected"
		if dbPool == nil {
			dbStatus = "memory_fallback"
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":   "ok",
			"database": dbStatus,
			"port":     port,
			"time":     time.Now().Format(time.RFC3339),
		})
	})

	r.Get("/api/competencias", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		type MonthInfo struct {
			Month string `json:"month"`
			Count int    `json:"count"`
		}

		var monthsWithData []MonthInfo
		yearSet := make(map[string]bool)

		curY := time.Now().Year()
		yearSet[fmt.Sprintf("%d", curY)] = true
		yearSet[fmt.Sprintf("%d", curY-1)] = true
		yearSet[fmt.Sprintf("%d", curY+1)] = true

		if dbPool != nil {
			ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
			defer cancel()

			rows, err := dbPool.Query(ctx, `
				SELECT mes_competencia, COUNT(id) 
				FROM eventos_bloqueio 
				WHERE mes_competencia IS NOT NULL AND mes_competencia != ''
				  AND status_desfecho IN ('returned', 'churned', 'suspended', 'blocked')
				GROUP BY mes_competencia 
				ORDER BY mes_competencia DESC
			`)
			if err == nil {
				defer rows.Close()
				for rows.Next() {
					var m string
					var cnt int
					if err := rows.Scan(&m, &cnt); err == nil && m != "" {
						monthsWithData = append(monthsWithData, MonthInfo{
							Month: m,
							Count: cnt,
						})
						parts := strings.Split(m, "-")
						if len(parts) == 2 {
							yearSet[parts[0]] = true
						}
					}
				}
			}
		}

		if len(monthsWithData) == 0 {
			monthsWithData = []MonthInfo{
				{Month: "2026-01", Count: 0},
			}
		}

		var availableYears []string
		for y := range yearSet {
			availableYears = append(availableYears, y)
		}
		sort.Sort(sort.Reverse(sort.StringSlice(availableYears)))

		json.NewEncoder(w).Encode(map[string]interface{}{
			"availableMonths": monthsWithData,
			"availableYears":  availableYears,
			"latestMonth":     monthsWithData[0].Month,
		})
	})

	// RBX API Integration Endpoints
	r.Get("/api/config/rbx", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if dbPool == nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"url":           "",
				"tokenMasked":   "",
				"hasToken":      false,
				"version":       "v2",
				"statusConexao": "desconectado",
			})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		var url, token, version, statusConexao string
		var ultimoErro *string
		var lastSync *time.Time
		var autoSync bool

		err := dbPool.QueryRow(ctx, `
			SELECT rbx_url, rbx_token, rbx_version, auto_sync, last_sync_at, status_conexao, ultimo_erro
			FROM configuracoes_rbx WHERE id = 1
		`).Scan(&url, &token, &version, &autoSync, &lastSync, &statusConexao, &ultimoErro)

		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"url":           "",
				"tokenMasked":   "",
				"hasToken":      false,
				"version":       "v2",
				"statusConexao": "desconectado",
			})
			return
		}

		lastSyncStr := ""
		if lastSync != nil {
			lastSyncStr = lastSync.Format("02/01/2006 15:04:05")
		}

		erroStr := ""
		if ultimoErro != nil {
			erroStr = *ultimoErro
		}

		nextSync := getNextSyncTime()
		json.NewEncoder(w).Encode(map[string]interface{}{
			"url":           url,
			"tokenMasked":   rbx.MaskToken(token),
			"hasToken":      len(strings.TrimSpace(token)) > 0,
			"version":       version,
			"autoSync":      autoSync,
			"lastSyncAt":    lastSyncStr,
			"nextSyncAt":    nextSync.Format("02/01/2006 15:04:05"),
			"syncSchedules": []string{"03:30", "12:30"},
			"strategy":      "delta_inteligente",
			"statusConexao": statusConexao,
			"ultimoErro":    erroStr,
		})
	})

	r.Post("/api/config/rbx", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var body struct {
			URL      string `json:"url"`
			Token    string `json:"token"`
			Version  string `json:"version"`
			AutoSync bool   `json:"autoSync"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error": "Payload inválido"}`, http.StatusBadRequest)
			return
		}

		if body.Version == "" {
			body.Version = "v2"
		}

		cleanURL := strings.TrimSpace(body.URL)
		cleanToken := strings.TrimSpace(body.Token)

		if dbPool != nil {
			ctx := r.Context()
			if cleanToken != "" {
				_, err := dbPool.Exec(ctx, `
					INSERT INTO configuracoes_rbx (id, rbx_url, rbx_token, rbx_version, auto_sync, atualizado_em)
					VALUES (1, $1, $2, $3, $4, CURRENT_TIMESTAMP)
					ON CONFLICT (id) DO UPDATE SET
						rbx_url = EXCLUDED.rbx_url,
						rbx_token = EXCLUDED.rbx_token,
						rbx_version = EXCLUDED.rbx_version,
						auto_sync = EXCLUDED.auto_sync,
						atualizado_em = CURRENT_TIMESTAMP
				`, cleanURL, cleanToken, body.Version, body.AutoSync)
				if err != nil {
					http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
					return
				}
			} else {
				_, err := dbPool.Exec(ctx, `
					INSERT INTO configuracoes_rbx (id, rbx_url, rbx_version, auto_sync, atualizado_em)
					VALUES (1, $1, $2, $3, CURRENT_TIMESTAMP)
					ON CONFLICT (id) DO UPDATE SET
						rbx_url = EXCLUDED.rbx_url,
						rbx_version = EXCLUDED.rbx_version,
						auto_sync = EXCLUDED.auto_sync,
						atualizado_em = CURRENT_TIMESTAMP
				`, cleanURL, body.Version, body.AutoSync)
				if err != nil {
					http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
					return
				}
			}
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Configurações do RBX salvas com sucesso!",
		})
	})

	r.Post("/api/config/rbx/test", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var body struct {
			URL     string `json:"url"`
			Token   string `json:"token"`
			Version string `json:"version"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)

		url := strings.TrimSpace(body.URL)
		token := strings.TrimSpace(body.Token)
		version := strings.TrimSpace(body.Version)

		if token == "" && dbPool != nil {
			_ = dbPool.QueryRow(r.Context(), "SELECT rbx_token FROM configuracoes_rbx WHERE id = 1").Scan(&token)
		}
		if url == "" && dbPool != nil {
			_ = dbPool.QueryRow(r.Context(), "SELECT rbx_url FROM configuracoes_rbx WHERE id = 1").Scan(&url)
		}
		if version == "" && dbPool != nil {
			_ = dbPool.QueryRow(r.Context(), "SELECT rbx_version FROM configuracoes_rbx WHERE id = 1").Scan(&version)
		}

		client := rbx.NewClient(rbx.Config{
			URL:     url,
			Token:   token,
			Version: version,
		})

		result := client.TestConnection(r.Context())

		if dbPool != nil {
			status := "desconectado"
			var errStr *string
			if result.Success {
				status = "conectado"
			} else {
				status = "erro"
				errStr = &result.Message
			}
			_, _ = dbPool.Exec(r.Context(), `
				UPDATE configuracoes_rbx SET status_conexao = $1, ultimo_erro = $2, atualizado_em = CURRENT_TIMESTAMP WHERE id = 1
			`, status, errStr)
		}

		json.NewEncoder(w).Encode(result)
	})

	r.Get("/api/rbx/statuses", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(rbx.RbxStatusCatalog())
	})

	r.Post("/api/sync/rbx", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if dbPool == nil {
			http.Error(w, `{"error": "Banco de dados não disponível"}`, http.StatusInternalServerError)
			return
		}

		var body struct {
			Month     string `json:"month"`
			ForceAll  bool   `json:"forceAll"`
			DeltaOnly *bool  `json:"deltaOnly"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)

		deltaOnly := true
		if body.ForceAll {
			deltaOnly = false
		} else if body.DeltaOnly != nil {
			deltaOnly = *body.DeltaOnly
		}

		res, err := executeRbxSync(r.Context(), body.Month, deltaOnly)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   err.Error(),
			})
			return
		}

		json.NewEncoder(w).Encode(res)
	})

	r.Post("/api/rbx/sync-bairros", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if dbPool == nil {
			http.Error(w, `{"error": "Banco de dados não disponível"}`, http.StatusInternalServerError)
			return
		}

		ctx := r.Context()

		var rbxURL, rbxToken, rbxVersion string
		err := dbPool.QueryRow(ctx, "SELECT rbx_url, rbx_token, rbx_version FROM configuracoes_rbx WHERE id = 1").Scan(&rbxURL, &rbxToken, &rbxVersion)
		if err != nil || strings.TrimSpace(rbxURL) == "" || strings.TrimSpace(rbxToken) == "" {
			http.Error(w, `{"error": "Integração RBX não configurada."}`, http.StatusBadRequest)
			return
		}

		client := rbx.NewClient(rbx.Config{
			URL:     rbxURL,
			Token:   rbxToken,
			Version: rbxVersion,
		})

		updatedClients, updatedEvents := enrichMissingBairros(ctx, client)

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":        true,
			"updatedClients": updatedClients,
			"updatedEvents":  updatedEvents,
			"message":        fmt.Sprintf("Sincronização de Bairros/Vilas concluída com sucesso! %d clientes e %d eventos atualizados.", updatedClients, updatedEvents),
		})
	})

	r.Get("/api/analytics/cohort", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		month := r.URL.Query().Get("month")
		viewMode := r.URL.Query().Get("view")
		if month == "" {
			month = "2026-01"
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		clients, err := queryCohortFromDB(ctx, month, viewMode)
		if err != nil {
			clients = inMemoryClients
		}

		summary := calculateSummary(month, clients)
		json.NewEncoder(w).Encode(summary)
	})

	r.Get("/api/analytics/monthly", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		month := r.URL.Query().Get("month")
		viewMode := r.URL.Query().Get("view")

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		availableMonths := queryAvailableMonths(ctx)
		if month == "" && len(availableMonths) > 0 {
			month = availableMonths[0]
		}
		if month == "" {
			month = "2026-01"
		}

		clients, err := queryCohortFromDB(ctx, month, viewMode)
		if err != nil {
			clients = inMemoryClients
		}

		summary := calculateSummary(month, clients)

		planDimension := "COALESCE(NULLIF(TRIM(COALESCE(NULLIF(e.plano, ''), c.plano)), ''), 'Não Informado')"
		cityDimension := "COALESCE(NULLIF(INITCAP(TRIM(c.cidade)), ''), 'Não Informado')"
		neighborhoodDimension := "COALESCE(NULLIF(INITCAP(TRIM(COALESCE(NULLIF(e.bairro, ''), c.bairro))), ''), 'Não Informado')"
		cycleDimension := "e.ciclo_vencimento"
		cityExpr := "COALESCE(NULLIF(INITCAP(TRIM(c.cidade)), ''), '')"

		byPlan, _ := queryBreakdown(ctx, planDimension, "", "e.mes_competencia = $1", month, viewMode)
		byCity, _ := queryBreakdown(ctx, cityDimension, "", "e.mes_competencia = $1", month, viewMode)
		byNeighborhood, _ := queryBreakdown(ctx, neighborhoodDimension, cityExpr, "e.mes_competencia = $1", month, viewMode)
		byCycle, _ := queryBreakdown(ctx, cycleDimension, "", "e.mes_competencia = $1", month, viewMode)

		if byPlan == nil {
			byPlan = []BreakdownItem{}
		}
		if byCity == nil {
			byCity = []BreakdownItem{}
		}
		if byNeighborhood == nil {
			byNeighborhood = []BreakdownItem{}
		}
		if byCycle == nil {
			byCycle = []BreakdownItem{}
		}

		resp := MonthlyAnalyticsResponse{
			MonthKey:        month,
			MonthLabel:      getMonthLabel(month),
			Summary:         summary,
			ByPlan:          byPlan,
			ByCity:          byCity,
			ByNeighborhood:  byNeighborhood,
			ByCycle:         byCycle,
			AvailableMonths: availableMonths,
		}

		json.NewEncoder(w).Encode(resp)
	})

	r.Get("/api/analytics/annual", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		year := r.URL.Query().Get("year")
		viewMode := r.URL.Query().Get("view")

		ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
		defer cancel()

		availableYears := queryAvailableYears(ctx)
		if year == "" && len(availableYears) > 0 {
			year = availableYears[0]
		}
		if year == "" {
			year = "2026"
		}

		filterYear := year + "-%"

		// 1. Quebras consolidadas do ano todo
		planDimension := "COALESCE(NULLIF(TRIM(COALESCE(NULLIF(e.plano, ''), c.plano)), ''), 'Não Informado')"
		cityDimension := "COALESCE(NULLIF(INITCAP(TRIM(c.cidade)), ''), 'Não Informado')"
		neighborhoodDimension := "COALESCE(NULLIF(INITCAP(TRIM(COALESCE(NULLIF(e.bairro, ''), c.bairro))), ''), 'Não Informado')"
		cycleDimension := "e.ciclo_vencimento"
		cityExpr := "COALESCE(NULLIF(INITCAP(TRIM(c.cidade)), ''), '')"

		byPlan, _ := queryBreakdown(ctx, planDimension, "", "e.mes_competencia LIKE $1", filterYear, viewMode)
		byCity, _ := queryBreakdown(ctx, cityDimension, "", "e.mes_competencia LIKE $1", filterYear, viewMode)
		byNeighborhood, _ := queryBreakdown(ctx, neighborhoodDimension, cityExpr, "e.mes_competencia LIKE $1", filterYear, viewMode)
		byCycle, _ := queryBreakdown(ctx, cycleDimension, "", "e.mes_competencia LIKE $1", filterYear, viewMode)

		if byPlan == nil {
			byPlan = []BreakdownItem{}
		}
		if byCity == nil {
			byCity = []BreakdownItem{}
		}
		if byNeighborhood == nil {
			byNeighborhood = []BreakdownItem{}
		}
		if byCycle == nil {
			byCycle = []BreakdownItem{}
		}

		// 2. Consulta evolução mensal (Jan a Dez)
		mEvolutionWhere := "e.mes_competencia LIKE $1 AND e.status_desfecho IN ('returned', 'churned', 'suspended', 'blocked') AND (e.eh_mimo IS FALSE OR e.eh_mimo IS NULL)"
		if viewMode == "pure" {
			mEvolutionWhere += " AND (e.eh_debito_herdado IS FALSE OR e.eh_debito_herdado IS NULL)"
		}
		feeExpr := "CASE WHEN e.eh_mimo IS TRUE THEN 0 ELSE COALESCE(NULLIF(e.valor_mensalidade, 0), c.valor_mensalidade, 0) END"
		mEvolutionQuery := fmt.Sprintf(`
			SELECT 
				e.mes_competencia AS month_key,
				COUNT(e.id) AS total_blocked,
				COALESCE(SUM(%s), 0) AS total_mrr,
				COUNT(CASE WHEN e.status_desfecho = 'returned' THEN 1 END) AS returned_count,
				COALESCE(SUM(CASE WHEN e.status_desfecho = 'returned' THEN (%s) ELSE 0 END), 0) AS returned_mrr,
				COUNT(CASE WHEN e.status_desfecho = 'churned' THEN 1 END) AS churned_count,
				COALESCE(SUM(CASE WHEN e.status_desfecho = 'churned' THEN (%s) ELSE 0 END), 0) AS churned_mrr,
				COUNT(CASE WHEN e.status_desfecho = 'suspended' THEN 1 END) AS suspended_count,
				COALESCE(SUM(CASE WHEN e.status_desfecho = 'suspended' THEN (%s) ELSE 0 END), 0) AS suspended_mrr,
				COUNT(CASE WHEN e.status_desfecho = 'blocked' THEN 1 END) AS blocked_count,
				COALESCE(SUM(CASE WHEN e.status_desfecho = 'blocked' THEN (%s) ELSE 0 END), 0) AS blocked_mrr,
				COALESCE(AVG(CASE WHEN e.status_desfecho = 'returned' AND e.dias_para_resolver IS NOT NULL THEN e.dias_para_resolver END), 0) AS avg_days
			FROM eventos_bloqueio e
			JOIN clientes c ON c.codigo_rbx = e.codigo_rbx
			WHERE %s
			GROUP BY e.mes_competencia
			ORDER BY e.mes_competencia ASC
		`, feeExpr, feeExpr, feeExpr, feeExpr, feeExpr, mEvolutionWhere)

		monthsMap := make(map[string]MonthSummaryItem)
		if dbPool != nil {
			rows, err := dbPool.Query(ctx, mEvolutionQuery, filterYear)
			if err == nil {
				defer rows.Close()
				for rows.Next() {
					var mi MonthSummaryItem
					var avgDays float64
					if err := rows.Scan(
						&mi.MonthKey, &mi.TotalBlocked, &mi.TotalMrrBlocked,
						&mi.ReturnedCount, &mi.ReturnedMrr,
						&mi.ChurnedCount, &mi.ChurnedMrr,
						&mi.SuspendedCount, &mi.SuspendedMrr,
						&mi.StillBlockedCount, &mi.StillBlockedMrr,
						&avgDays,
					); err == nil {
						mi.HasData = true
						mi.MonthLabel = getMonthLabel(mi.MonthKey)
						if mi.TotalBlocked > 0 {
							mi.ReturnedRate = math.Round((float64(mi.ReturnedCount)/float64(mi.TotalBlocked))*1000) / 10
							mi.ChurnRate = math.Round((float64(mi.ChurnedCount)/float64(mi.TotalBlocked))*1000) / 10
							mi.SuspendedRate = math.Round((float64(mi.SuspendedCount)/float64(mi.TotalBlocked))*1000) / 10
							mi.StillBlockedRate = math.Round((float64(mi.StillBlockedCount)/float64(mi.TotalBlocked))*1000) / 10
						}
						mi.AvgDaysToReturn = math.Round(avgDays*10) / 10
						monthsMap[mi.MonthKey] = mi
					}
				}
			}
		}

		// Prepara lista ordenada de 12 meses (01 a 12)
		monthNamesShort := []string{
			"Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
			"Jul", "Ago", "Set", "Out", "Nov", "Dez",
		}

		var evolution []MonthSummaryItem
		var totalYearBlocked, totalYearReturned, totalYearChurned, totalYearSuspended, totalYearStillBlocked int
		var totalYearMrr, totalYearReturnedMrr, totalYearChurnedMrr, totalYearSuspendedMrr, totalYearStillBlockedMrr float64
		var totalDaysSum float64
		var totalDaysCount int

		for i := 1; i <= 12; i++ {
			mKey := fmt.Sprintf("%s-%02d", year, i)
			mLabel := fmt.Sprintf("%s/%s", monthNamesShort[i-1], year)
			if item, exists := monthsMap[mKey]; exists {
				evolution = append(evolution, item)
				totalYearBlocked += item.TotalBlocked
				totalYearMrr += item.TotalMrrBlocked
				totalYearReturned += item.ReturnedCount
				totalYearReturnedMrr += item.ReturnedMrr
				totalYearChurned += item.ChurnedCount
				totalYearChurnedMrr += item.ChurnedMrr
				totalYearSuspended += item.SuspendedCount
				totalYearSuspendedMrr += item.SuspendedMrr
				totalYearStillBlocked += item.StillBlockedCount
				totalYearStillBlockedMrr += item.StillBlockedMrr
				if item.AvgDaysToReturn > 0 {
					totalDaysSum += item.AvgDaysToReturn * float64(item.ReturnedCount)
					totalDaysCount += item.ReturnedCount
				}
			} else {
				evolution = append(evolution, MonthSummaryItem{
					MonthKey:   mKey,
					MonthLabel: mLabel,
					HasData:    false,
				})
			}
		}

		annualSummary := MonthlyCohortSummary{
			MonthKey:          year,
			MonthLabel:        fmt.Sprintf("Consolidado Anual %s", year),
			TotalBlocked:      totalYearBlocked,
			TotalMrrBlocked:   math.Round(totalYearMrr*100) / 100,
			ReturnedCount:     totalYearReturned,
			ReturnedMrr:       math.Round(totalYearReturnedMrr*100) / 100,
			ChurnedCount:      totalYearChurned,
			ChurnedMrr:        math.Round(totalYearChurnedMrr*100) / 100,
			SuspendedCount:    totalYearSuspended,
			SuspendedMrr:      math.Round(totalYearSuspendedMrr*100) / 100,
			StillBlockedCount: totalYearStillBlocked,
			StillBlockedMrr:   math.Round(totalYearStillBlockedMrr*100) / 100,
		}
		if totalYearBlocked > 0 {
			annualSummary.ReturnedRate = math.Round((float64(totalYearReturned)/float64(totalYearBlocked))*1000) / 10
			annualSummary.ChurnRate = math.Round((float64(totalYearChurned)/float64(totalYearBlocked))*1000) / 10
			annualSummary.SuspendedRate = math.Round((float64(totalYearSuspended)/float64(totalYearBlocked))*1000) / 10
			annualSummary.StillBlockedRate = math.Round((float64(totalYearStillBlocked)/float64(totalYearBlocked))*1000) / 10
		}
		if totalDaysCount > 0 {
			annualSummary.AvgDaysToReturn = math.Round((totalDaysSum/float64(totalDaysCount))*10) / 10
		}

		resp := AnnualAnalyticsResponse{
			Year:             year,
			Summary:          annualSummary,
			MonthlyEvolution: evolution,
			ByPlan:           byPlan,
			ByCity:           byCity,
			ByNeighborhood:   byNeighborhood,
			ByCycle:          byCycle,
			AvailableYears:   availableYears,
		}

		json.NewEncoder(w).Encode(resp)
	})

	r.Post("/api/reset", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if dbPool != nil {
			ctx := context.Background()
			_, err := dbPool.Exec(ctx, "TRUNCATE TABLE eventos_bloqueio, clientes, importacoes_log CASCADE")
			if err != nil {
				log.Printf("[DB ERROR reset] %v", err)
			}
		}
		inMemoryClients = make([]ClientRecord, 0)
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "cleared"})
	})

	r.Post("/api/upload", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if err := r.ParseMultipartForm(50 << 20); err != nil {
			http.Error(w, `{"error": "Erro ao receber arquivo multipart"}`, http.StatusBadRequest)
			return
		}

		file, header, err := r.FormFile("file")
		if err != nil {
			http.Error(w, `{"error": "Arquivo não fornecido"}`, http.StatusBadRequest)
			return
		}
		defer file.Close()

		filename := strings.ToLower(header.Filename)
		var rows [][]string

		if strings.HasSuffix(filename, ".xlsx") || strings.HasSuffix(filename, ".xls") {
			xlFile, err := excelize.OpenReader(file)
			if err != nil {
				http.Error(w, fmt.Sprintf(`{"error": "Erro ao abrir planilha Excel: %v"}`, err), http.StatusBadRequest)
				return
			}
			defer xlFile.Close()

			sheets := xlFile.GetSheetList()
			if len(sheets) == 0 {
				http.Error(w, `{"error": "Planilha sem abas válidas"}`, http.StatusBadRequest)
				return
			}
			sRows, err := xlFile.GetRows(sheets[0])
			if err != nil {
				http.Error(w, fmt.Sprintf(`{"error": "Erro ao ler linhas: %v"}`, err), http.StatusBadRequest)
				return
			}
			rows = sRows
		} else if strings.HasSuffix(filename, ".csv") {
			content, err := io.ReadAll(file)
			if err != nil {
				http.Error(w, fmt.Sprintf(`{"error": "Erro ao ler arquivo CSV: %v"}`, err), http.StatusBadRequest)
				return
			}
			rawStr := string(content)
			lines := strings.Split(rawStr, "\n")
			delimiter := ','
			if len(lines) > 0 {
				firstLine := lines[0]
				if strings.Contains(firstLine, "\t") {
					delimiter = '\t'
				} else if strings.Contains(firstLine, ";") {
					delimiter = ';'
				}
			}

			reader := csv.NewReader(strings.NewReader(rawStr))
			reader.Comma = delimiter
			reader.LazyQuotes = true
			reader.FieldsPerRecord = -1
			cRows, err := reader.ReadAll()
			if err != nil {
				http.Error(w, fmt.Sprintf(`{"error": "Erro ao processar linhas CSV: %v"}`, err), http.StatusBadRequest)
				return
			}
			rows = cRows
		} else {
			http.Error(w, `{"error": "Formato inválido. Envie um arquivo .xlsx ou .csv"}`, http.StatusBadRequest)
			return
		}

		if len(rows) < 2 {
			http.Error(w, `{"error": "Planilha vazia ou sem linhas de dados"}`, http.StatusBadRequest)
			return
		}

		headerRow := rows[0]
		colDateTime := -1
		colClient := -1
		colName := -1
		colContract := -1
		colPlan := -1
		colUser := -1
		colOperation := -1
		colCity := -1
		colNeighborhood := -1

		for i, h := range headerRow {
			norm := normalizeHeader(h)
			if colDateTime == -1 && (strings.Contains(norm, "data") || strings.Contains(norm, "hora")) {
				colDateTime = i
			} else if colClient == -1 && strings.Contains(norm, "cliente") {
				colClient = i
			} else if colName == -1 && strings.Contains(norm, "nome") {
				colName = i
			} else if colContract == -1 && strings.Contains(norm, "contrato") {
				colContract = i
			} else if colPlan == -1 && strings.Contains(norm, "plano") {
				colPlan = i
			} else if colUser == -1 && strings.Contains(norm, "usuari") {
				colUser = i
			} else if colOperation == -1 && strings.Contains(norm, "operac") {
				colOperation = i
			} else if colCity == -1 && strings.Contains(norm, "cidade") {
				colCity = i
			} else if colNeighborhood == -1 && (strings.Contains(norm, "bairro") || strings.Contains(norm, "vila")) {
				colNeighborhood = i
			}
		}

		if colDateTime == -1 && len(headerRow) > 0 { colDateTime = 0 }
		if colClient == -1 && len(headerRow) > 1 { colClient = 1 }
		if colName == -1 && len(headerRow) > 2 { colName = 2 }
		if colContract == -1 && len(headerRow) > 3 { colContract = 3 }
		if colPlan == -1 && len(headerRow) > 4 { colPlan = 4 }
		if colUser == -1 && len(headerRow) > 5 { colUser = 5 }
		if colOperation == -1 && len(headerRow) > 6 { colOperation = 6 }
		if colCity == -1 && len(headerRow) > 7 { colCity = 7 }

		type RawEvent struct {
			DateTime     time.Time
			Client       string
			Name         string
			Contract     string
			Plan         string
			User         string
			Operation    string
			City         string
			Neighborhood string
		}

		events := make([]RawEvent, 0)
		detectedCompetenceMap := make(map[string]int)
		seenRows := make(map[string]bool)

		for rIdx := 1; rIdx < len(rows); rIdx++ {
			rData := rows[rIdx]
			if len(rData) == 0 {
				continue
			}

			getVal := func(idx int) string {
				if idx >= 0 && idx < len(rData) {
					return strings.TrimSpace(rData[idx])
				}
				return ""
			}

			dtStr := getVal(colDateTime)
			clientStr := strings.ReplaceAll(strings.ReplaceAll(getVal(colClient), ".", ""), ",", "")
			nameStr := getVal(colName)
			contractStr := strings.ReplaceAll(strings.ReplaceAll(getVal(colContract), ".", ""), ",", "")
			planStr := getVal(colPlan)
			userStr := getVal(colUser)
			opStr := getVal(colOperation)
			cityStr := getVal(colCity)
			neighborhoodStr := getVal(colNeighborhood)

			if nameStr == "" && clientStr == "" {
				continue
			}

			dt, ok := parseDateTimeFlexible(dtStr)
			if !ok {
				dt = time.Now()
			}

			// Deduplicate exact duplicate rows
			rowKey := fmt.Sprintf("%s|%s|%s|%s", clientStr, contractStr, dt.Format("2006-01-02 15:04:05"), strings.ToLower(opStr))
			if seenRows[rowKey] {
				continue
			}
			seenRows[rowKey] = true

			// Apply business rule to find billing competence
			compMonth, _ := determineBillingCycle(dt)
			detectedCompetenceMap[compMonth]++

			events = append(events, RawEvent{
				DateTime:     dt,
				Client:       clientStr,
				Name:         nameStr,
				Contract:     contractStr,
				Plan:         planStr,
				User:         userStr,
				Operation:    opStr,
				City:         cityStr,
				Neighborhood: neighborhoodStr,
			})
		}

		// Find dominant competence month
		dominantCompetence := "2026-01"
		maxCount := 0
		for m, c := range detectedCompetenceMap {
			if c > maxCount {
				maxCount = c
				dominantCompetence = m
			}
		}

		// Group events by Contract
		type ContractHistory struct {
			Client        string
			Name          string
			Contract      string
			Plan          string
			City          string
			Neighborhood  string
			User          string
			BlockEvents   []RawEvent
			UnblockEvents []RawEvent
			CancelEvents  []RawEvent
		}

		historyMap := make(map[string]*ContractHistory)

		for _, ev := range events {
			key := ev.Contract
			if key == "" {
				key = ev.Client
			}
			if key == "" {
				key = ev.Name
			}

			ch, exists := historyMap[key]
			if !exists {
				ch = &ContractHistory{
					Client:       ev.Client,
					Name:         ev.Name,
					Contract:     ev.Contract,
					Plan:         ev.Plan,
					City:         ev.City,
					Neighborhood: ev.Neighborhood,
					User:         ev.User,
				}
				historyMap[key] = ch
			}

			opNorm := normalizeHeader(ev.Operation)
			if strings.Contains(opNorm, "desbloq") || strings.Contains(opNorm, "reativ") || strings.Contains(opNorm, "ativ") {
				ch.UnblockEvents = append(ch.UnblockEvents, ev)
			} else if strings.Contains(opNorm, "cancel") || strings.Contains(opNorm, "rescis") {
				ch.CancelEvents = append(ch.CancelEvents, ev)
			} else {
				ch.BlockEvents = append(ch.BlockEvents, ev)
			}
		}

		parsedClients := make([]ClientRecord, 0)

		for _, ch := range historyMap {
			sort.Slice(ch.BlockEvents, func(i, j int) bool {
				return ch.BlockEvents[i].DateTime.Before(ch.BlockEvents[j].DateTime)
			})
			sort.Slice(ch.UnblockEvents, func(i, j int) bool {
				return ch.UnblockEvents[i].DateTime.Before(ch.UnblockEvents[j].DateTime)
			})
			sort.Slice(ch.CancelEvents, func(i, j int) bool {
				return ch.CancelEvents[i].DateTime.Before(ch.CancelEvents[j].DateTime)
			})

			var blockEv RawEvent
			if len(ch.BlockEvents) > 0 {
				blockEv = ch.BlockEvents[0]
			} else if len(ch.UnblockEvents) > 0 {
				blockEv = ch.UnblockEvents[0]
			} else {
				continue
			}

			blockStr := blockEv.DateTime.Format("02/01/2006 15:04:05")
			status := "blocked"
			var unblockPtr *string
			var daysToResolve *int
			var cancelPtr *string

			for _, ub := range ch.UnblockEvents {
				if ub.DateTime.After(blockEv.DateTime) || ub.DateTime.Equal(blockEv.DateTime) {
					status = "returned"
					uStr := ub.DateTime.Format("02/01/2006 15:04:05")
					unblockPtr = &uStr
					days := int(ub.DateTime.Sub(blockEv.DateTime).Hours() / 24)
					if days < 0 {
						days = 0
					}
					daysToResolve = &days
					break
				}
			}

			for _, cb := range ch.CancelEvents {
				if cb.DateTime.After(blockEv.DateTime) || cb.DateTime.Equal(blockEv.DateTime) {
					status = "churned"
					cStr := cb.DateTime.Format("02/01/2006 15:04:05")
					cancelPtr = &cStr
					unblockPtr = nil
					daysToResolve = nil
					break
				}
			}

			compMonth, cicloName := determineBillingCycle(blockEv.DateTime)

			rbxCode := "B"
			rbxText := "Bloqueado"
			if status == "returned" {
				rbxCode = "A"
				rbxText = "Ativo"
			} else if status == "churned" {
				rbxCode = "C"
				rbxText = "Cancelado"
			}

			parsedClients = append(parsedClients, ClientRecord{
				ID:                 uuid.New().String(),
				RbxCode:            ch.Client,
				Contract:           ch.Contract,
				Name:               ch.Name,
				City:               ch.City,
				Neighborhood:       ch.Neighborhood,
				Plan:               ch.Plan,
				MonthlyFee:         99.90,
				BillingCycle:       cicloName,
				CompetenceMonth:    compMonth,
				BlockDate:          blockStr,
				UnblockDate:        unblockPtr,
				DaysToResolve:      daysToResolve,
				Status:             status,
				Operation:          blockEv.Operation,
				UserRBX:            blockEv.User,
				CancellationDate:   cancelPtr,
				RbxStatusCode:      rbxCode,
				RbxStatusText:      rbxText,
				CancellationReason: "",
			})
		}

		sort.Slice(parsedClients, func(i, j int) bool {
			return parsedClients[i].BlockDate > parsedClients[j].BlockDate
		})

		// Save to PostgreSQL with full transaction handling
		if dbPool != nil {
			ctx := context.Background()
			tx, err := dbPool.Begin(ctx)
			if err != nil {
				log.Printf("[DB ERROR tx.Begin] %v", err)
				http.Error(w, fmt.Sprintf(`{"error": "Erro ao iniciar transação: %v"}`, err), http.StatusInternalServerError)
				return
			}

			for _, c := range parsedClients {
				bTime, _ := parseDateTimeFlexible(c.BlockDate)
				var uTime *time.Time
				if c.UnblockDate != nil {
					if t, ok := parseDateTimeFlexible(*c.UnblockDate); ok {
						uTime = &t
					}
				}

				var bucket string
				if c.DaysToResolve != nil {
					d := *c.DaysToResolve
					if d <= 7 {
						bucket = "0-7"
					} else if d <= 15 {
						bucket = "8-15"
					} else if d <= 30 {
						bucket = "16-30"
					} else {
						bucket = ">30"
					}
				} else if c.Status == "churned" {
					bucket = "cancelado"
				} else {
					bucket = "pendente"
				}

				// Checa se o plano da planilha indica serviço mimo/TV/streaming
				pNorm := strings.ToLower(c.Plan)
				isMimoCandidate := strings.Contains(pNorm, "globo") || strings.Contains(pNorm, "play") || strings.Contains(pNorm, "paramount") || strings.Contains(pNorm, "sva") || (strings.Contains(pNorm, "tv") && !strings.Contains(pNorm, "mega") && !strings.Contains(pNorm, "giga"))

				// Upsert client using codigo_rbx as primary key (sem deixar mimo sobrescrever o plano principal)
				_, err := tx.Exec(ctx, `
					INSERT INTO clientes (codigo_rbx, contrato, nome, cidade, plano, valor_mensalidade, status, bairro)
					VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
					ON CONFLICT (codigo_rbx) DO UPDATE SET
						contrato = CASE WHEN NOT $9 THEN EXCLUDED.contrato ELSE clientes.contrato END,
						nome = EXCLUDED.nome,
						cidade = EXCLUDED.cidade,
						plano = CASE WHEN NOT $9 THEN EXCLUDED.plano ELSE clientes.plano END,
						bairro = CASE WHEN EXCLUDED.bairro != '' THEN EXCLUDED.bairro ELSE clientes.bairro END
				`, c.RbxCode, c.Contract, c.Name, c.City, c.Plan, c.MonthlyFee, c.Status, c.Neighborhood, isMimoCandidate)
				if err != nil {
					log.Printf("[DB ERROR insert cliente %s] %v", c.RbxCode, err)
					_ = tx.Rollback(ctx)
					http.Error(w, fmt.Sprintf(`{"error": "Erro ao gravar cliente %s: %v"}`, c.RbxCode, err), http.StatusInternalServerError)
					return
				}

				// Upsert event using unique constraint (contrato, data_bloqueio)
				_, err = tx.Exec(ctx, `
					INSERT INTO eventos_bloqueio (
						id, codigo_rbx, contrato, mes_competencia, ciclo_vencimento, 
						data_bloqueio, data_desbloqueio, dias_para_resolver, status_desfecho, 
						faixa_tempo, operacao, usuario_rbx, status_rbx_codigo, status_rbx_descricao,
						plano, eh_mimo, bairro
					)
					VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
					ON CONFLICT (contrato, data_bloqueio) DO UPDATE SET
						mes_competencia = EXCLUDED.mes_competencia,
						ciclo_vencimento = EXCLUDED.ciclo_vencimento,
						data_desbloqueio = EXCLUDED.data_desbloqueio,
						dias_para_resolver = EXCLUDED.dias_para_resolver,
						status_desfecho = EXCLUDED.status_desfecho,
						faixa_tempo = EXCLUDED.faixa_tempo,
						operacao = EXCLUDED.operacao,
						usuario_rbx = EXCLUDED.usuario_rbx,
						status_rbx_codigo = COALESCE(eventos_bloqueio.status_rbx_codigo, EXCLUDED.status_rbx_codigo),
						status_rbx_descricao = COALESCE(eventos_bloqueio.status_rbx_descricao, EXCLUDED.status_rbx_descricao),
						plano = COALESCE(NULLIF(eventos_bloqueio.plano, ''), EXCLUDED.plano),
						eh_mimo = COALESCE(eventos_bloqueio.eh_mimo, EXCLUDED.eh_mimo),
						bairro = CASE WHEN EXCLUDED.bairro != '' THEN EXCLUDED.bairro ELSE eventos_bloqueio.bairro END
				`, uuid.New().String(), c.RbxCode, c.Contract, c.CompetenceMonth, c.BillingCycle, bTime, uTime, c.DaysToResolve, c.Status, bucket, c.Operation, c.UserRBX, c.RbxStatusCode, c.RbxStatusText, c.Plan, isMimoCandidate, c.Neighborhood)
				if err != nil {
					log.Printf("[DB ERROR insert evento contrato %s] %v", c.Contract, err)
					_ = tx.Rollback(ctx)
					http.Error(w, fmt.Sprintf(`{"error": "Erro ao gravar evento do contrato %s: %v"}`, c.Contract, err), http.StatusInternalServerError)
					return
				}
			}

			_, _ = tx.Exec(ctx, `
				INSERT INTO importacoes_log (id, nome_arquivo, total_linhas, status)
				VALUES ($1, $2, $3, $4)
			`, uuid.New().String(), header.Filename, len(parsedClients), "concluido")

			if err := tx.Commit(ctx); err != nil {
				log.Printf("[DB ERROR commit] %v", err)
				http.Error(w, fmt.Sprintf(`{"error": "Erro ao confirmar gravação: %v"}`, err), http.StatusInternalServerError)
				return
			}
			log.Printf("[PostgreSQL] GRAVAÇÃO CONFIRMADA: %d contratos gravados com sucesso para competência %s!", len(parsedClients), dominantCompetence)
		}

		inMemoryClients = parsedClients
		summary := calculateSummary(dominantCompetence, parsedClients)

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"count":   len(parsedClients),
			"summary": summary,
		})
	})

	fmt.Printf("[EVAD Backend] Servidor Go rodando na porta :%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
