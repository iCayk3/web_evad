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
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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
	_, _ = pool.Exec(ctx, `CREATE EXTENSION IF NOT EXISTS unaccent;`)

	migrationStatements := []string{
		`ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS eh_debito_herdado BOOLEAN DEFAULT false;`,
		`ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS vencimento_debito_original VARCHAR(20);`,
		`ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS rotulo_debito VARCHAR(100);`,
		`ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS plano VARCHAR(255);`,
		`ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS valor_mensalidade NUMERIC(10, 2) DEFAULT 0.00;`,
		`ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS eh_mimo BOOLEAN DEFAULT false;`,
		`ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS contrato_principal VARCHAR(50);`,
		`ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS mimos_vinculados TEXT;`,
		`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS bairro VARCHAR(100);`,
		`ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS bairro VARCHAR(100);`,
		`ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS cidade VARCHAR(100);`,
		`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS distrito VARCHAR(100);`,
		`ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS distrito VARCHAR(100);`,
		`CREATE INDEX IF NOT EXISTS idx_clientes_bairro ON clientes(bairro);`,
		`CREATE INDEX IF NOT EXISTS idx_bloqueio_bairro ON eventos_bloqueio(bairro);`,
		`CREATE INDEX IF NOT EXISTS idx_bloqueio_cidade ON eventos_bloqueio(cidade);`,
		`CREATE INDEX IF NOT EXISTS idx_clientes_distrito ON clientes(distrito);`,
		`CREATE INDEX IF NOT EXISTS idx_bloqueio_distrito ON eventos_bloqueio(distrito);`,
		`CREATE INDEX IF NOT EXISTS idx_bloqueio_eh_mimo ON eventos_bloqueio(eh_mimo);`,
		`CREATE INDEX IF NOT EXISTS idx_bloqueio_contrato_principal ON eventos_bloqueio(contrato_principal);`,
	}
	for _, stmt := range migrationStatements {
		if _, err := pool.Exec(ctx, stmt); err != nil {
			log.Printf("[DB MIGRATION NOTICE] %v", err)
		}
	}

	_, _ = pool.Exec(ctx, `
		-- Suporte a Gestão e Recuperação de Equipamentos (Atendimentos RBX)
		CREATE TABLE IF NOT EXISTS atendimentos_equipamentos (
			id VARCHAR(50) PRIMARY KEY,
			protocolo VARCHAR(50),
			codigo_cliente VARCHAR(50) NOT NULL,
			contrato VARCHAR(50),
			data_abertura TIMESTAMP WITH TIME ZONE,
			data_encerramento TIMESTAMP WITH TIME ZONE,
			mes_competencia VARCHAR(7),
			situacao_os VARCHAR(20),
			topico VARCHAR(255),
			assunto TEXT,
			solucao TEXT,
			causa VARCHAR(255),
			usuario_abertura VARCHAR(100),
			usuario_encerramento VARCHAR(100),
			status_recuperacao VARCHAR(50) NOT NULL DEFAULT 'pendente',
			equipamento_identificado TEXT,
			serial_mac VARCHAR(100),
			sincronizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_equip_competencia ON atendimentos_equipamentos(mes_competencia);
		CREATE INDEX IF NOT EXISTS idx_equip_cliente ON atendimentos_equipamentos(codigo_cliente);
		CREATE INDEX IF NOT EXISTS idx_equip_status ON atendimentos_equipamentos(status_recuperacao);

		-- Classificação e Auditoria Manual de Equipamentos (Recuperado, Tentando, Perdido, Voltou Ativo)
		CREATE TABLE IF NOT EXISTS auditoria_equipamentos_manual (
			registro_id VARCHAR(100) PRIMARY KEY,
			codigo_cliente VARCHAR(50) NOT NULL,
			status_manual VARCHAR(50) NOT NULL,
			observacao TEXT,
			atualizado_por VARCHAR(100) DEFAULT 'Operador',
			atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_auditoria_equip_reg ON auditoria_equipamentos_manual(registro_id);
		CREATE INDEX IF NOT EXISTS idx_auditoria_equip_cli ON auditoria_equipamentos_manual(codigo_cliente);

		-- Cancelamentos com motivo "SEM USO" são Churn real (cliente pagava sem usar o ponto de internet)
		UPDATE eventos_bloqueio
		SET status_desfecho = 'churned',
		    data_desbloqueio = NULL,
		    dias_para_resolver = NULL
		WHERE UPPER(motivo_cancelamento) LIKE '%SEM USO%'
		  AND status_rbx_codigo IN ('C', 'N')
		  AND status_desfecho != 'churned';

		-- Módulo Minha Empresa: Tabelas Operacionais do RBX
		CREATE TABLE IF NOT EXISTS rbx_atendimentos_instalacoes (
			numero VARCHAR(50) PRIMARY KEY,
			protocolo VARCHAR(50),
			codigo_cliente VARCHAR(50),
			nome_cliente VARCHAR(255),
			contrato VARCHAR(50),
			mes_competencia VARCHAR(7) NOT NULL,
			data_abertura TIMESTAMP WITH TIME ZONE,
			data_encerramento TIMESTAMP WITH TIME ZONE,
			situacao_os VARCHAR(50),
			topico VARCHAR(255),
			causa VARCHAR(255),
			assunto TEXT,
			solucao TEXT,
			usuario_abertura VARCHAR(100),
			instalado_com_sucesso BOOLEAN DEFAULT false,
			cidade VARCHAR(100),
			bairro VARCHAR(100),
			sincronizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_rbx_inst_competencia ON rbx_atendimentos_instalacoes(mes_competencia);
		CREATE INDEX IF NOT EXISTS idx_rbx_inst_sucesso ON rbx_atendimentos_instalacoes(instalado_com_sucesso);
		CREATE INDEX IF NOT EXISTS idx_rbx_inst_cliente ON rbx_atendimentos_instalacoes(codigo_cliente);

		CREATE TABLE IF NOT EXISTS rbx_contratos_cancelados (
			numero_contrato VARCHAR(50) PRIMARY KEY,
			codigo_cliente VARCHAR(50),
			nome_cliente VARCHAR(255),
			mes_competencia VARCHAR(7) NOT NULL,
			data_cancelamento TIMESTAMP WITH TIME ZONE,
			motivo_cancelamento TEXT,
			plano VARCHAR(150),
			valor_mensalidade NUMERIC(10, 2) DEFAULT 0.00,
			cidade VARCHAR(100),
			bairro VARCHAR(100),
			sincronizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_rbx_canc_competencia ON rbx_contratos_cancelados(mes_competencia);
		CREATE INDEX IF NOT EXISTS idx_rbx_canc_cliente ON rbx_contratos_cancelados(codigo_cliente);

		CREATE TABLE IF NOT EXISTS rbx_metricas_mensais (
			mes_competencia VARCHAR(7) PRIMARY KEY,
			total_instalacoes INT DEFAULT 0,
			instalacoes_sucesso INT DEFAULT 0,
			total_cancelamentos INT DEFAULT 0,
			total_bloqueados INT DEFAULT 0,
			total_suspensos INT DEFAULT 0,
			total_inadimplentes INT DEFAULT 0,
			atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);

		-- Módulo Auditoria de Autenticações & Base Histórica RBX
		CREATE TABLE IF NOT EXISTS rbx_autenticacoes (
			id_autenticacao VARCHAR(50) PRIMARY KEY,
			codigo_cliente VARCHAR(50),
			nome_cliente VARCHAR(255),
			numero_contrato VARCHAR(50),
			nas VARCHAR(100),
			porta VARCHAR(100),
			usuario VARCHAR(150),
			mac VARCHAR(50),
			observacao TEXT,
			eh_central_assinante BOOLEAN DEFAULT false,
			data_assinatura DATE,
			data_inicio DATE,
			situacao_codigo VARCHAR(10),
			situacao_descricao VARCHAR(50),
			data_ultima_operacao DATE,
			criado_ate_janeiro_2026 BOOLEAN DEFAULT false,
			sincronizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_contrato ON rbx_autenticacoes(numero_contrato);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_usuario ON rbx_autenticacoes(usuario);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_central ON rbx_autenticacoes(eh_central_assinante);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_jan ON rbx_autenticacoes(criado_ate_janeiro_2026);

		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS ativo_em_janeiro_2026 BOOLEAN DEFAULT false;
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS origem_upgrade BOOLEAN DEFAULT false;
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS contrato_anterior VARCHAR(50) DEFAULT '';
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS situacao_em_janeiro VARCHAR(100) DEFAULT '';
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS grupo_cliente VARCHAR(100) DEFAULT '';
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS eh_grupo_excluido BOOLEAN DEFAULT false;
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS criado_ate_fevereiro_2026 BOOLEAN DEFAULT false;
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS ativo_em_fevereiro_2026 BOOLEAN DEFAULT false;
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS situacao_em_fevereiro VARCHAR(100) DEFAULT '';
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS criado_ate_marco_2026 BOOLEAN DEFAULT false;
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS ativo_em_marco_2026 BOOLEAN DEFAULT false;
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS situacao_em_marco VARCHAR(100) DEFAULT '';
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS criado_ate_abril_2026 BOOLEAN DEFAULT false;
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS ativo_em_abril_2026 BOOLEAN DEFAULT false;
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS situacao_em_abril VARCHAR(100) DEFAULT '';
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS criado_ate_maio_2026 BOOLEAN DEFAULT false;
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS ativo_em_maio_2026 BOOLEAN DEFAULT false;
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS situacao_em_maio VARCHAR(100) DEFAULT '';
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS criado_ate_junho_2026 BOOLEAN DEFAULT false;
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS ativo_em_junho_2026 BOOLEAN DEFAULT false;
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS situacao_em_junho VARCHAR(100) DEFAULT '';
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS criado_ate_julho_2026 BOOLEAN DEFAULT false;
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS ativo_em_julho_2026 BOOLEAN DEFAULT false;
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS situacao_em_julho VARCHAR(100) DEFAULT '';
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS criado_ate_agosto_2026 BOOLEAN DEFAULT false;
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS ativo_em_agosto_2026 BOOLEAN DEFAULT false;
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS situacao_em_agosto VARCHAR(100) DEFAULT '';
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS criado_ate_setembro_2026 BOOLEAN DEFAULT false;
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS ativo_em_setembro_2026 BOOLEAN DEFAULT false;
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS situacao_em_setembro VARCHAR(100) DEFAULT '';
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS criado_ate_outubro_2026 BOOLEAN DEFAULT false;
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS ativo_em_outubro_2026 BOOLEAN DEFAULT false;
		ALTER TABLE rbx_autenticacoes ADD COLUMN IF NOT EXISTS situacao_em_outubro VARCHAR(100) DEFAULT '';
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_ativo_jan ON rbx_autenticacoes(ativo_em_janeiro_2026);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_upgrade ON rbx_autenticacoes(origem_upgrade);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_grp_excluido ON rbx_autenticacoes(eh_grupo_excluido);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_fev ON rbx_autenticacoes(criado_ate_fevereiro_2026);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_ativo_fev ON rbx_autenticacoes(ativo_em_fevereiro_2026);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_mar ON rbx_autenticacoes(criado_ate_marco_2026);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_ativo_mar ON rbx_autenticacoes(ativo_em_marco_2026);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_abr ON rbx_autenticacoes(criado_ate_abril_2026);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_ativo_abr ON rbx_autenticacoes(ativo_em_abril_2026);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_mai ON rbx_autenticacoes(criado_ate_maio_2026);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_ativo_mai ON rbx_autenticacoes(ativo_em_maio_2026);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_jun ON rbx_autenticacoes(criado_ate_junho_2026);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_ativo_jun ON rbx_autenticacoes(ativo_em_junho_2026);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_jul ON rbx_autenticacoes(criado_ate_julho_2026);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_ativo_jul ON rbx_autenticacoes(ativo_em_julho_2026);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_ago ON rbx_autenticacoes(criado_ate_agosto_2026);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_ativo_ago ON rbx_autenticacoes(ativo_em_agosto_2026);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_set ON rbx_autenticacoes(criado_ate_setembro_2026);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_ativo_set ON rbx_autenticacoes(ativo_em_setembro_2026);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_out ON rbx_autenticacoes(criado_ate_outubro_2026);
		CREATE INDEX IF NOT EXISTS idx_rbx_auth_ativo_out ON rbx_autenticacoes(ativo_em_outubro_2026);

		-- Remove contratos cancelados de TV (adicionais normalmente zerados) e motivos desconsiderados
		DELETE FROM rbx_contratos_cancelados
		WHERE motivo_cancelamento ILIKE '%MUD%TITULARIDADE%'
		   OR motivo_cancelamento ILIKE '%AJUSTE T%CNICO%'
		   OR motivo_cancelamento ILIKE '%CONTRATO TEMPOR%RIO%'
		   OR motivo_cancelamento ILIKE '%PEDIDO INSTALA%O CANCELADO%'
		   OR motivo_cancelamento ILIKE '%ERRO%GERA%O%CONTRATO%'
		   OR motivo_cancelamento ILIKE '%CANCELAMENTO%MIGRA%'
		   OR motivo_cancelamento ILIKE '%N%O PAGOU A TAXA%'
		   OR motivo_cancelamento ILIKE '%NAO PAGOU A TAXA%'
		   OR motivo_cancelamento ILIKE '%INVIA%'
		   OR plano ~* '(^|[^a-zA-Z0-9])TV([^a-zA-Z0-9]|$)'
		   OR plano ILIKE '%+ TV%'
		   OR plano ILIKE '%+TV%'
		   OR plano ILIKE '%TELEVIS%'
		   OR plano ILIKE '%IPTV%';

		-- Remove atendimentos de instalação gerados/abertos incorretamente (ex: suporte por lentidão ou reparo)
		DELETE FROM rbx_atendimentos_instalacoes
		WHERE solucao ILIKE '%aberto incorretamente%'
		   OR solucao ILIKE '%aberta incorretamente%'
		   OR solucao ILIKE '%aberto indevidamente%'
		   OR solucao ILIKE '%aberta indevidamente%'
		   OR solucao ILIKE '%abertura errada%'
		   OR solucao ILIKE '%abertura incorreta%'
		   OR solucao ILIKE '%abertura indevida%'
		   OR solucao ILIKE '%gerad%incorret%'
		   OR solucao ILIKE '%gerad%errad%'
		   OR solucao ILIKE '%gerad%indevid%'
		   OR solucao ILIKE '%como lentid%'
		   OR solucao ILIKE '%como reparo%'
		   OR solucao ILIKE '%como suporte%'
		   OR solucao ILIKE '%fluxo incorreto%'
		   OR solucao ILIKE '%n%o era instala%'
		   OR solucao ILIKE '%aberto errado%'
		   OR solucao ILIKE '%aberta errada%'
		   OR solucao ILIKE '%aberto por engano%'
		   OR solucao ILIKE '%aberta por engano%'
		   OR solucao ILIKE '%nao teve viabilida%'
		   OR solucao ILIKE '%não teve viabilida%'
		   OR solucao ILIKE '%sem viabilidade%'
		   OR solucao ILIKE '%cto muito longe%'
		   OR solucao ILIKE '%cto longe%'
		   OR solucao ILIKE '%inviabilidade técnica%'
		   OR solucao ILIKE '%inviabilidade tecnica%'
		   OR solucao ILIKE '%não foi possível instalar%'
		   OR solucao ILIKE '%nao foi possivel instalar%'
		   OR solucao ILIKE '%não foi instalad%'
		   OR solucao ILIKE '%nao foi instalad%'
		   OR solucao ILIKE '%não instalad%'
		   OR solucao ILIKE '%nao instalad%'
		   OR solucao ILIKE '%pós venda%'
		   OR solucao ILIKE '%pos venda%'
		   OR assunto ILIKE '%verificar com o cliente se ele esta%satisfeito%';

		-- Atualiza os totais consolidados de instalações, cancelamentos e suspensos em rbx_metricas_mensais
		UPDATE rbx_metricas_mensais m
		SET total_cancelamentos = COALESCE((
			SELECT COUNT(*) FROM rbx_contratos_cancelados c
			WHERE c.mes_competencia = m.mes_competencia
		), 0),
		total_instalacoes = COALESCE((
			SELECT COUNT(*) FROM rbx_atendimentos_instalacoes i
			WHERE i.mes_competencia = m.mes_competencia
		), 0),
		instalacoes_sucesso = COALESCE((
			SELECT COUNT(*) FROM rbx_atendimentos_instalacoes i
			WHERE i.mes_competencia = m.mes_competencia AND i.instalado_com_sucesso = true
		), 0),
		total_suspensos = COALESCE((
			SELECT COUNT(CASE WHEN e.status_desfecho = 'suspended' THEN 1 END)
			FROM eventos_bloqueio e
			WHERE e.mes_competencia = m.mes_competencia 
			  AND NOT e.eh_mimo 
			  AND e.status_desfecho IN ('returned', 'churned', 'suspended', 'blocked')
			  AND (e.eh_debito_herdado IS FALSE OR e.eh_debito_herdado IS NULL)
		), 0);
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

const operationalCitySQL = `
	CASE 
		WHEN LOWER(COALESCE(c.distrito, e.distrito, '')) LIKE '%boa%'
		  OR LOWER(COALESCE(c.cidade, e.cidade, '')) LIKE '%boa vista%'
		  OR (
		      LOWER(COALESCE(c.cidade, e.cidade, '')) LIKE '%quatipuru%'
		      AND LOWER(COALESCE(NULLIF(e.bairro, ''), c.bairro, '')) IN (
		          'jabuti', 'patchouli', 'patichoulin', 'castelo', 'novo humirinzal', 
		          'humirinzal', 'embauba', 'embaúba', 'abrejado', 'salgadinho', 
		          'sapolandia', 'sapolândia', 'guarazao', 'guarazão', 'arapiranga', 'santo antonio', 'santo antônio',
		          'canto do sabia', 'canto do sabiá', 'boa vista'
		      )
		  )
		THEN 'Boa Vista'
		ELSE COALESCE(NULLIF(INITCAP(TRIM(COALESCE(NULLIF(e.cidade, ''), c.cidade))), ''), 'Não Informado')
	END
`

func queryCohortFromDB(ctx context.Context, month string, viewMode string) ([]ClientRecord, error) {
	if dbPool == nil {
		return inMemoryClients, nil
	}

	whereClause := "e.mes_competencia = $1"
	if viewMode == "pure" {
		whereClause += " AND (e.eh_debito_herdado IS FALSE OR e.eh_debito_herdado IS NULL)"
	}

	query := `
		SELECT 
			e.id, c.codigo_rbx, COALESCE(e.contrato, ''), c.nome, 
			` + operationalCitySQL + ` as cidade, 
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
		WHERE ` + whereClause + `
		ORDER BY e.data_bloqueio DESC
	`

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

			// Rotina Automática em Produção: Sincronização operacional e base de autenticações
			currentMonth := time.Now().Format("2006-01")
			ctxOp, cancelOp := context.WithTimeout(context.Background(), 20*time.Minute)
			var rbxURL, rbxToken, rbxVersion string
			errCfg := dbPool.QueryRow(ctxOp, "SELECT rbx_url, rbx_token, rbx_version FROM configuracoes_rbx WHERE id = 1").Scan(&rbxURL, &rbxToken, &rbxVersion)
			if errCfg == nil && strings.TrimSpace(rbxURL) != "" && strings.TrimSpace(rbxToken) != "" {
				client := rbx.NewClient(rbx.Config{URL: rbxURL, Token: rbxToken, Version: rbxVersion})

				// 1. Sincroniza dados operacionais da empresa (Instalações, Cancelamentos, Bloqueados)
				resOp, errOp := syncRbxOperacionalEmpresa(ctxOp, client, currentMonth)
				if errOp != nil {
					log.Printf("[Scheduler ERROR] Falha na sincronização operacional (%s): %v", currentMonth, errOp)
				} else {
					log.Printf("[Scheduler SUCESSO] Dados operacionais de %s sincronizados automaticamente (%d inst, %d canc).",
						currentMonth, resOp["instalacoesSucesso"], resOp["totalCancelamentos"])
				}

				// Nos primeiros 5 dias do mês, reconcilia também o mês anterior para capturar OSs concluídas na virada
				if time.Now().Day() <= 5 {
					prevMonth := time.Now().AddDate(0, -1, 0).Format("2006-01")
					resPrev, errPrev := syncRbxOperacionalEmpresa(ctxOp, client, prevMonth)
					if errPrev == nil {
						log.Printf("[Scheduler SUCESSO] Reconciliação do mês anterior (%s) concluída (%d inst, %d canc).",
							prevMonth, resPrev["instalacoesSucesso"], resPrev["totalCancelamentos"])
					}
				}

				// 2. Sincroniza base de autenticações RBX (PPPoE / Grafana)
				resAuth, errAuth := syncRbxAutenticacoesBase(ctxOp, client)
				if errAuth != nil {
					log.Printf("[Scheduler ERROR] Falha na sincronização da base de autenticações: %v", errAuth)
				} else {
					log.Printf("[Scheduler SUCESSO] Base de autenticações RBX sincronizada automaticamente (%d total, %d PPPoE).",
						resAuth["totalAutenticacoes"], resAuth["pppoeTotal"])
				}

				// 3. Sincroniza atendimentos de retirada de equipamentos do RBX
				resEquip, errEquip := syncAtendimentosEquipamentos(ctxOp, client)
				if errEquip != nil {
					log.Printf("[Scheduler ERROR] Falha na sincronização de equipamentos: %v", errEquip)
				} else {
					log.Printf("[Scheduler SUCESSO] Atendimentos de equipamentos sincronizados automaticamente (%d registros atualizados).", resEquip)
				}
			}
			cancelOp()

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

	client := rbx.NewClient(rbx.Config{
		URL:     rbxURL,
		Token:   rbxToken,
		Version: rbxVersion,
	})

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
		_, _ = syncAddressesFromRbx(ctx, client, month)
		return &SyncResult{
			Success:    true,
			Message:    "Endereços e dados cadastrais sincronizados com o RBX com sucesso (todos os contratos já regularizados).",
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

			// Atualiza o evento com o plano, mensalidade, bairro, cidade e distrito específicos deste contrato
			_, _ = dbPool.Exec(ctx, `
				UPDATE eventos_bloqueio SET
					plano = CASE WHEN $1 != '' THEN $1 ELSE plano END,
					valor_mensalidade = $2,
					eh_mimo = $3,
					bairro = CASE WHEN $5 != '' THEN $5 ELSE bairro END,
					cidade = CASE WHEN $6 != '' THEN $6 ELSE cidade END,
					distrito = CASE WHEN $7 != '' THEN $7 ELSE distrito END
				WHERE REPLACE(REPLACE(contrato, '.', ''), ',', '') = $4
			`, res.Plan, res.MonthlyFee, isMimo, cleanNum, res.Neighborhood, res.City, res.District)

			// Atualiza dados do cliente no cadastro
			if res.MonthlyFee > 0 {
				_, _ = dbPool.Exec(ctx, `
					UPDATE clientes SET
						valor_mensalidade = $1,
						plano = CASE WHEN $2 != '' THEN $2 ELSE plano END,
						contrato = CASE WHEN $3 != '' THEN $3 ELSE contrato END,
						cidade = CASE WHEN $4 != '' THEN $4 ELSE cidade END,
						nome = CASE WHEN $5 != '' THEN $5 ELSE nome END,
						bairro = CASE WHEN $8 != '' THEN $8 ELSE bairro END,
						distrito = CASE WHEN $9 != '' THEN $9 ELSE distrito END
					WHERE (codigo_rbx = $6 OR REPLACE(REPLACE(contrato, '.', ''), ',', '') = $7)
				`, res.MonthlyFee, res.Plan, res.ContractCode, res.City, res.ClientName, cleanCli, cleanNum, res.Neighborhood, res.District)
			} else {
				_, _ = dbPool.Exec(ctx, `
					UPDATE clientes SET
						cidade = CASE WHEN (cidade IS NULL OR cidade = '') AND $1 != '' THEN $1 ELSE cidade END,
						nome = CASE WHEN (nome IS NULL OR nome = '') AND $2 != '' THEN $2 ELSE nome END,
						bairro = CASE WHEN (bairro IS NULL OR bairro = '') AND $5 != '' THEN $5 ELSE bairro END,
						distrito = CASE WHEN (distrito IS NULL OR distrito = '') AND $6 != '' THEN $6 ELSE distrito END
					WHERE (codigo_rbx = $3 OR REPLACE(REPLACE(contrato, '.', ''), ',', '') = $4)
				`, res.City, res.ClientName, cleanCli, cleanNum, res.Neighborhood, res.District)
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
	enrichMissingBairros(ctx, client, false)

	// Atualizar endereços (Cidade e Bairro) diretamente do RBX via ConsultaClientes (serviço 44)
	_, _ = syncAddressesFromRbx(ctx, client, month)

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

func syncAddressesFromRbx(ctx context.Context, client *rbx.Client, month string) (int, error) {
	if dbPool == nil || client == nil {
		return 0, nil
	}

	var queryClients string
	var queryArgs []interface{}
	if month != "" {
		queryClients = `SELECT DISTINCT REPLACE(REPLACE(codigo_rbx, '.', ''), ',', '') 
		                FROM eventos_bloqueio 
		                WHERE mes_competencia = $1 AND codigo_rbx IS NOT NULL AND codigo_rbx != ''`
		queryArgs = append(queryArgs, month)
	} else {
		queryClients = `SELECT DISTINCT REPLACE(REPLACE(codigo_rbx, '.', ''), ',', '') 
		                FROM eventos_bloqueio 
		                WHERE codigo_rbx IS NOT NULL AND codigo_rbx != ''`
	}

	mRows, mErr := dbPool.Query(ctx, queryClients, queryArgs...)
	if mErr != nil {
		return 0, mErr
	}
	defer mRows.Close()

	var cliCodes []string
	for mRows.Next() {
		var cod string
		if err := mRows.Scan(&cod); err == nil && cod != "" {
			cliCodes = append(cliCodes, cod)
		}
	}

	updatedCount := 0
	for i := 0; i < len(cliCodes); i += 100 {
		end := i + 100
		if end > len(cliCodes) {
			end = len(cliCodes)
		}
		chunk := cliCodes[i:end]
		addrMap, err := client.ConsultarClientes(ctx, chunk)
		if err == nil {
			for code, info := range addrMap {
				rawCity := strings.TrimSpace(info.City)
				rawBairro := strings.TrimSpace(info.Neighborhood)
				rawDistrito := strings.TrimSpace(info.District)
				if rawCity != "" || rawBairro != "" || rawDistrito != "" {
					_, _ = dbPool.Exec(ctx, `
						UPDATE clientes SET
							bairro = CASE WHEN $1 != '' THEN $1 ELSE bairro END,
							cidade = CASE WHEN $2 != '' THEN $2 ELSE cidade END,
							distrito = CASE WHEN $4 != '' THEN $4 ELSE distrito END
						WHERE REPLACE(REPLACE(codigo_rbx, '.', ''), ',', '') = $3
					`, rawBairro, rawCity, code, rawDistrito)
					updatedCount++
				}
			}
		}
	}

	// Propagar fielmente o que está cadastrado no RBX para eventos_bloqueio
	if month != "" {
		_, _ = dbPool.Exec(ctx, `
			UPDATE eventos_bloqueio e
			SET bairro = c.bairro,
			    cidade = c.cidade,
			    distrito = c.distrito
			FROM clientes c
			WHERE REPLACE(REPLACE(e.codigo_rbx, '.', ''), ',', '') = REPLACE(REPLACE(c.codigo_rbx, '.', ''), ',', '')
			  AND e.mes_competencia = $1
		`, month)
	} else {
		_, _ = dbPool.Exec(ctx, `
			UPDATE eventos_bloqueio e
			SET bairro = c.bairro,
			    cidade = c.cidade,
			    distrito = c.distrito
			FROM clientes c
			WHERE REPLACE(REPLACE(e.codigo_rbx, '.', ''), ',', '') = REPLACE(REPLACE(c.codigo_rbx, '.', ''), ',', '')
		`)
	}

	return updatedCount, nil
}

func enrichMissingBairros(ctx context.Context, client *rbx.Client, refreshAll bool) (int, int) {
	if dbPool == nil || client == nil {
		return 0, 0
	}

	whereClause := "WHERE (bairro IS NULL OR bairro = '' OR bairro = 'Não Informado') AND codigo_rbx IS NOT NULL AND codigo_rbx != ''"
	if refreshAll {
		whereClause = "WHERE codigo_rbx IS NOT NULL AND codigo_rbx != ''"
	}

	// 1. Obter clientes cadastrados
	rows, err := dbPool.Query(ctx, `
		SELECT DISTINCT REPLACE(REPLACE(codigo_rbx, '.', ''), ',', '') 
		FROM clientes 
	`+whereClause+`
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

	log.Printf("[RBX ENRICH BAIRROS] Enriquecendo %d clientes via ConsultaClientes (serviço 44)...", len(allCodes))

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
						cidade = CASE WHEN $2 != '' THEN $2 ELSE cidade END
					WHERE REPLACE(REPLACE(codigo_rbx, '.', ''), ',', '') = $3
				`, info.Neighborhood, info.City, code)
				if err == nil {
					updatedClients++
				}
			}
		}
	}

	// 2. Propagar bairros e cidades atualizados da tabela clientes para eventos_bloqueio
	cmdTag, err := dbPool.Exec(ctx, `
		UPDATE eventos_bloqueio e
		SET bairro = CASE WHEN c.bairro != '' AND c.bairro != 'Não Informado' THEN c.bairro ELSE e.bairro END,
		    cidade = CASE WHEN c.cidade != '' AND c.cidade != 'Não Informado' THEN c.cidade ELSE e.cidade END
		FROM clientes c
		WHERE REPLACE(REPLACE(e.codigo_rbx, '.', ''), ',', '') = REPLACE(REPLACE(c.codigo_rbx, '.', ''), ',', '')
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

type EquipamentoItem struct {
	ID                      string     `json:"id"`
	Protocolo               string     `json:"protocolo"`
	CodigoCliente           string     `json:"codigoCliente"`
	NomeCliente             string     `json:"nomeCliente"`
	Cidade                  string     `json:"cidade"`
	Bairro                  string     `json:"bairro"`
	Contrato                string     `json:"contrato"`
	Plano                   string     `json:"plano"`
	DataAbertura            *time.Time `json:"dataAbertura"`
	DataEncerramento        *time.Time `json:"dataEncerramento"`
	MesCompetencia          string     `json:"mesCompetencia"`
	SituacaoOS              string     `json:"situacaoOS"`
	Topico                  string     `json:"topico"`
	Assunto                 string     `json:"assunto"`
	Solucao                 string     `json:"solucao"`
	Causa                   string     `json:"causa"`
	UsuarioAbertura         string     `json:"usuarioAbertura"`
	StatusRecuperacao       string     `json:"statusRecuperacao"` // status automático RBX: 'recuperado', 'pendente', 'em_andamento', 'cancelamento_abortado', 'sem_os'
	StatusManual            string     `json:"statusManual"`      // 'recuperado', 'tentando', 'perdido', 'ativo_cobranca'
	ObservacaoManual        string     `json:"observacaoManual"`
	AtualizadoPor           string     `json:"atualizadoPor"`
	AtualizadoEm            *time.Time `json:"atualizadoEm"`
	StatusFinal             string     `json:"statusFinal"`       // status consolidado exibido
	StatusDesfecho          string     `json:"statusDesfecho"`    // 'churned', 'suspended', 'returned', 'other'
	EquipamentoIdentificado string     `json:"equipamentoIdentificado"`
	SerialMac               string     `json:"serialMac"`
	EhDuplicado             bool       `json:"ehDuplicado"`
}

type EquipamentoSummary struct {
	TotalOrders          int     `json:"totalOrders"`
	TotalNaoRetornados   int     `json:"totalNaoRetornados"`
	TotalRetornadosComOS int     `json:"totalRetornadosComOS"`
	TotalDuplicados      int     `json:"totalDuplicados"`
	Recuperados          int     `json:"recuperados"`
	Tentando             int     `json:"tentando"`
	Perdidos             int     `json:"perdidos"`
	AtivoCobranca        int     `json:"ativoCobranca"`
	SemOS                int     `json:"semOS"`
	Pendentes            int     `json:"pendentes"`
	EmAndamento          int     `json:"emAndamento"`
	CancelamentoAbortado int     `json:"cancelamentoAbortado"`
	TaxaRecuperacao      float64 `json:"taxaRecuperacao"`
	TaxaEfetividadeOS    float64 `json:"taxaEfetividadeOS"`
}

type EquipamentoCityStats struct {
	Cidade          string  `json:"cidade"`
	Total           int     `json:"total"`
	Recuperados     int     `json:"recuperados"`
	Pendentes       int     `json:"pendentes"`
	SemOS           int     `json:"semOS"`
	TaxaRecuperacao float64 `json:"taxaRecuperacao"`
}

type EquipamentoResponse struct {
	Summary         EquipamentoSummary     `json:"summary"`
	Orders          []EquipamentoItem      `json:"orders"`
	ByCity          []EquipamentoCityStats `json:"byCity"`
	AvailableMonths []string               `json:"availableMonths"`
	SelectedMonth   string                 `json:"selectedMonth"`
}

type EquipamentoAnnualMonthStats struct {
	MonthKey        string  `json:"monthKey"`
	MonthLabel      string  `json:"monthLabel"`
	Total           int     `json:"total"`
	Recuperados     int     `json:"recuperados"`
	Tentando        int     `json:"tentando"`
	SemOS           int     `json:"semOS"`
	Perdidos        int     `json:"perdidos"`
	AtivoCobranca   int     `json:"ativoCobranca"`
	TaxaRecuperacao float64 `json:"taxaRecuperacao"`
}

type EquipamentoAnnualCityStats struct {
	Cidade          string  `json:"cidade"`
	Total           int     `json:"total"`
	Recuperados     int     `json:"recuperados"`
	Tentando        int     `json:"tentando"`
	SemOS           int     `json:"semOS"`
	Perdidos        int     `json:"perdidos"`
	TaxaRecuperacao float64 `json:"taxaRecuperacao"`
}

type EquipamentoAnnualCauseStats struct {
	Motivo string `json:"motivo"`
	Total  int    `json:"total"`
}

type EquipamentoAnnualSummary struct {
	TotalOrders       int     `json:"totalOrders"`
	Recuperados       int     `json:"recuperados"`
	Tentando          int     `json:"tentando"`
	SemOS             int     `json:"semOS"`
	Perdidos          int     `json:"perdidos"`
	AtivoCobranca     int     `json:"ativoCobranca"`
	TaxaRecuperacao   float64 `json:"taxaRecuperacao"`
	TaxaEfetividadeOS float64 `json:"taxaEfetividadeOS"`
}

type EquipamentoAnnualResponse struct {
	Year           string                        `json:"year"`
	Summary        EquipamentoAnnualSummary      `json:"summary"`
	ByMonth        []EquipamentoAnnualMonthStats `json:"byMonth"`
	ByCity         []EquipamentoAnnualCityStats  `json:"byCity"`
	ByCause        []EquipamentoAnnualCauseStats `json:"byCause"`
	AvailableYears []string                      `json:"availableYears"`
}

var reComodato = regexp.MustCompile(`(?i)Equip:\s*([^/\r\n#]+)`)
var reSolEquip = regexp.MustCompile(`(?i)RETIRADA DE UMA?\s*([^,\r\n]+)`)
var reSerialMac = regexp.MustCompile(`(?i)(?:Ser|MAC|Serial):\s*([a-zA-Z0-9.:_-]+)`)

func extractEquipmentInfo(assunto, solucao string) (string, string) {
	text := assunto + "\n" + solucao
	var equips []string
	var serials []string

	for _, match := range reComodato.FindAllStringSubmatch(text, -1) {
		if len(match) > 1 {
			val := strings.TrimSpace(match[1])
			if val != "" {
				equips = append(equips, val)
			}
		}
	}

	for _, match := range reSolEquip.FindAllStringSubmatch(text, -1) {
		if len(match) > 1 {
			val := strings.TrimSpace(match[1])
			if val != "" {
				equips = append(equips, val)
			}
		}
	}

	for _, match := range reSerialMac.FindAllStringSubmatch(text, -1) {
		if len(match) > 1 {
			val := strings.TrimSpace(match[1])
			if val != "" {
				serials = append(serials, val)
			}
		}
	}

	uniqEquips := make(map[string]bool)
	var cleanEquips []string
	for _, e := range equips {
		if !uniqEquips[e] {
			uniqEquips[e] = true
			cleanEquips = append(cleanEquips, e)
		}
	}

	uniqSerials := make(map[string]bool)
	var cleanSerials []string
	for _, s := range serials {
		if !uniqSerials[s] {
			uniqSerials[s] = true
			cleanSerials = append(cleanSerials, s)
		}
	}

	equipStr := "Equipamento em Comodato"
	if len(cleanEquips) > 0 {
		equipStr = strings.Join(cleanEquips, ", ")
	}
	serialStr := strings.Join(cleanSerials, ", ")

	if len(equipStr) > 255 {
		equipStr = equipStr[:255]
	}
	if len(serialStr) > 100 {
		serialStr = serialStr[:100]
	}

	return equipStr, serialStr
}

func classifyRecuperacao(causa, solucao, situacaoOS string, encerramento *time.Time) string {
	c := strings.ToUpper(causa)
	s := strings.ToUpper(solucao)

	if strings.Contains(c, "DESISTIU") || strings.Contains(s, "DESISTIU") {
		return "cancelamento_abortado"
	}

	if strings.Contains(c, "INTERROMPIDO") ||
		strings.Contains(c, "ABORTADO") ||
		strings.Contains(s, "NINGUÉM") ||
		strings.Contains(s, "NINGUEM") ||
		strings.Contains(s, "NUNCA SE ENCONTRA") ||
		strings.Contains(s, "NÃO SE ENCONTRA") ||
		strings.Contains(s, "NAO SE ENCONTRA") ||
		strings.Contains(s, "RECUSOU") {
		return "pendente"
	}

	if strings.Contains(c, "RETIRADO") ||
		strings.Contains(c, "RECEBIDO") ||
		strings.Contains(c, "CONFERIDO") ||
		strings.Contains(c, "SUPERVISÃO OK") ||
		strings.Contains(c, "SUPERVISAO OK") ||
		strings.Contains(s, "RETIRADA DE UMA") ||
		strings.Contains(s, "RETIRADA DE UM") ||
		strings.Contains(s, "FOI FEITO A RETIRADA") ||
		strings.Contains(s, "EQUIPAMENTO RECOLHIDO") {
		return "recuperado"
	}

	if encerramento == nil {
		return "em_andamento"
	}

	if situacaoOS == "C" || situacaoOS == "F" {
		return "recuperado"
	}

	return "pendente"
}

func syncAtendimentosEquipamentos(ctx context.Context, client *rbx.Client) (int, error) {
	if dbPool == nil {
		return 0, fmt.Errorf("banco de dados não disponível")
	}

	atends, err := client.ConsultarAtendimentosRetirada(ctx)
	if err != nil {
		return 0, err
	}

	count := 0
	for _, at := range atends {
		mesComp := ""
		if at.EncerramentoDataHora != nil {
			mesComp = at.EncerramentoDataHora.Format("2006-01")
		} else if at.AberturaDataHora != nil {
			mesComp = at.AberturaDataHora.Format("2006-01")
		}

		statusRec := classifyRecuperacao(at.Causa, at.Solucao, at.SituacaoOS, at.EncerramentoDataHora)
		equip, serial := extractEquipmentInfo(at.Assunto, at.Solucao)

		_, err := dbPool.Exec(ctx, `
			INSERT INTO atendimentos_equipamentos (
				id, protocolo, codigo_cliente, data_abertura, data_encerramento,
				mes_competencia, situacao_os, topico, assunto, solucao,
				causa, usuario_abertura, status_recuperacao, equipamento_identificado, serial_mac, sincronizado_em
			) VALUES (
				$1, $2, $3, $4, $5,
				$6, $7, $8, $9, $10,
				$11, $12, $13, $14, $15, CURRENT_TIMESTAMP
			)
			ON CONFLICT (id) DO UPDATE SET
				protocolo = EXCLUDED.protocolo,
				codigo_cliente = EXCLUDED.codigo_cliente,
				data_abertura = EXCLUDED.data_abertura,
				data_encerramento = EXCLUDED.data_encerramento,
				mes_competencia = EXCLUDED.mes_competencia,
				situacao_os = EXCLUDED.situacao_os,
				topico = EXCLUDED.topico,
				assunto = EXCLUDED.assunto,
				solucao = EXCLUDED.solucao,
				causa = EXCLUDED.causa,
				usuario_abertura = EXCLUDED.usuario_abertura,
				status_recuperacao = EXCLUDED.status_recuperacao,
				equipamento_identificado = EXCLUDED.equipamento_identificado,
				serial_mac = EXCLUDED.serial_mac,
				sincronizado_em = CURRENT_TIMESTAMP
		`,
			at.Numero, at.Protocolo, at.CodigoCliente, at.AberturaDataHora, at.EncerramentoDataHora,
			mesComp, at.SituacaoOS, at.Topico, at.Assunto, at.Solucao,
			at.Causa, at.UsuarioAbertura, statusRec, equip, serial,
		)

		if err == nil {
			count++
		}
	}

	// Enriquecer e atualizar nomes, cidades e bairros dos clientes diretamente do RBX
	var cliCodesToRefresh []string
	cliCodesSet := make(map[string]bool)

	// 1. Clientes com chamados de retirada de equipamentos
	for _, at := range atends {
		cleanCod := strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(at.CodigoCliente, ".", ""), ",", ""))
		if cleanCod != "" && !cliCodesSet[cleanCod] {
			cliCodesSet[cleanCod] = true
			cliCodesToRefresh = append(cliCodesToRefresh, cleanCod)
		}
	}

	// 2. Clientes em atenção patrimonial (churn/suspensos) mesmo sem chamado de OS aberta ainda
	ebRows, ebErr := dbPool.Query(ctx, `
		SELECT DISTINCT REPLACE(REPLACE(codigo_rbx, '.', ''), ',', '')
		FROM eventos_bloqueio
		WHERE (status_desfecho IN ('churned', 'suspended') OR status_desfecho IS NULL)
		  AND codigo_rbx IS NOT NULL AND codigo_rbx != ''
	`)
	if ebErr == nil {
		for ebRows.Next() {
			var cod string
			if err := ebRows.Scan(&cod); err == nil {
				cod = strings.TrimSpace(cod)
				if cod != "" && !cliCodesSet[cod] {
					cliCodesSet[cod] = true
					cliCodesToRefresh = append(cliCodesToRefresh, cod)
				}
			}
		}
		ebRows.Close()
	}

	if len(cliCodesToRefresh) > 0 {
		cliBatchSize := 100
		for i := 0; i < len(cliCodesToRefresh); i += cliBatchSize {
			end := i + cliBatchSize
			if end > len(cliCodesToRefresh) {
				end = len(cliCodesToRefresh)
			}
			chunk := cliCodesToRefresh[i:end]
			addrMap, err := client.ConsultarClientes(ctx, chunk)
			if err == nil {
				for code, info := range addrMap {
					_, _ = dbPool.Exec(ctx, `
						INSERT INTO clientes (codigo_rbx, nome, cidade, bairro, status)
						VALUES ($1, $2, $3, $4, 'inativo')
						ON CONFLICT (codigo_rbx) DO UPDATE SET
							nome = CASE WHEN EXCLUDED.nome != '' THEN EXCLUDED.nome ELSE clientes.nome END,
							cidade = CASE WHEN EXCLUDED.cidade != '' THEN EXCLUDED.cidade ELSE clientes.cidade END,
							bairro = CASE WHEN EXCLUDED.bairro != '' THEN EXCLUDED.bairro ELSE clientes.bairro END
					`, code, info.Name, info.City, info.Neighborhood)
				}
			}
		}

		// Propagar imediatamente as cidades e bairros atualizados para a tabela de eventos
		_, _ = dbPool.Exec(ctx, `
			UPDATE eventos_bloqueio eb
			SET 
				cidade = CASE WHEN c.cidade != '' AND c.cidade != 'Não Informado' THEN c.cidade ELSE eb.cidade END,
				bairro = CASE WHEN c.bairro != '' AND c.bairro != 'Não Informado' THEN c.bairro ELSE eb.bairro END
			FROM clientes c
			WHERE REPLACE(REPLACE(eb.codigo_rbx, '.', ''), ',', '') = REPLACE(REPLACE(c.codigo_rbx, '.', ''), ',', '')
		`)
	}

	log.Printf("[RBX EQUIPAMENTOS SYNC] Sincronização concluída: %d atendimentos e %d cadastros de endereços atualizados.", count, len(cliCodesToRefresh))
	return count, nil
}

var reTvPlan = regexp.MustCompile(`(?i)(^|[^a-zA-Z0-9])TV([^a-zA-Z0-9]|$)|televis[aã]o|iptv`)

// ehContratoTvCancelado verifica se o contrato possui TV no nome do plano ou produto (SVA normalmente zerado)
func ehContratoTvCancelado(plano string) bool {
	if strings.TrimSpace(plano) == "" {
		return false
	}
	return reTvPlan.MatchString(plano)
}

// isExcludedContratoCancelamento verifica se o cancelamento deve ser desconsiderado na contagem geral
func isExcludedContratoCancelamento(motivo, plano string) bool {
	if isExcludedMotivoCancelamento(motivo) {
		return true
	}
	if ehContratoTvCancelado(plano) {
		return true
	}
	return false
}

// isExcludedMotivoCancelamento verifica se o motivo de cancelamento deve ser desconsiderado na contagem
func isExcludedMotivoCancelamento(motivo string) bool {
	m := strings.ToUpper(strings.TrimSpace(motivo))
	if strings.Contains(m, "MUD. DE TITULARIDADE") || strings.Contains(m, "MUDANÇA DE TITULARIDADE") || strings.Contains(m, "MUDANCA DE TITULARIDADE") ||
		strings.Contains(m, "AJUSTE TÉCNICO") || strings.Contains(m, "AJUSTE TECNICO") ||
		strings.Contains(m, "CONTRATO TEMPORÁRIO") || strings.Contains(m, "CONTRATO TEMPORARIO") ||
		strings.Contains(m, "PEDIDO INSTALAÇÃO CANCELADO") || strings.Contains(m, "PEDIDO INSTALACAO CANCELADO") ||
		strings.Contains(m, "ERRO NA GERAÇÃO DO CONTRATO") || strings.Contains(m, "ERRO NA GERACAO DO CONTRATO") ||
		strings.Contains(m, "CANCELAMENTO MIGRAÇÃO") || strings.Contains(m, "CANCELAMENTO MIGRACAO") ||
		strings.Contains(m, "NÃO PAGOU A TAXA") || strings.Contains(m, "NAO PAGOU A TAXA") ||
		strings.Contains(m, "INVIABILIDADE") || strings.Contains(m, "INVIANILIDADE") || strings.Contains(m, "INVIA") {
		return true
	}
	return false
}

// syncRbxOperacionalEmpresa sincroniza e persiste atendimentos de instalação, cancelamentos gerais e inadimplência do RBX
func syncRbxOperacionalEmpresa(ctx context.Context, client *rbx.Client, month string) (map[string]interface{}, error) {
	if dbPool == nil {
		return nil, fmt.Errorf("banco de dados não disponível")
	}
	if month == "" {
		month = "2026-01"
	}

	parts := strings.Split(month, "-")
	if len(parts) < 2 {
		parts = []string{"2026", "01"}
	}
	yearStr := parts[0]
	monthStr := parts[1]
	yearInt, _ := strconv.Atoi(yearStr)
	monthInt, _ := strconv.Atoi(monthStr)

	// Intervalo de datas da competência
	firstDay := time.Date(yearInt, time.Month(monthInt), 1, 0, 0, 0, 0, time.UTC)
	lastDay := firstDay.AddDate(0, 1, -1)
	startDate := firstDay.Format("2006-01-02")
	endDate := lastDay.Format("2006-01-02")

	// 1. Sincronizar Cancelamentos Gerais do RBX (Base Total via ConsultaContratos Situacao_Codigo = 'C')
	cancelados, err := client.ConsultarContratosCanceladosGerais(ctx, startDate, endDate)
	canceladosCount := 0
	if err == nil {
		for _, c := range cancelados {
			if isExcludedContratoCancelamento(c.CancellationReason, c.Plan) {
				continue
			}
			_, errIns := dbPool.Exec(ctx, `
				INSERT INTO rbx_contratos_cancelados (
					numero_contrato, codigo_cliente, nome_cliente, mes_competencia,
					data_cancelamento, motivo_cancelamento, plano, valor_mensalidade,
					cidade, bairro, sincronizado_em
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
				ON CONFLICT (numero_contrato) DO UPDATE SET
					codigo_cliente = EXCLUDED.codigo_cliente,
					nome_cliente = EXCLUDED.nome_cliente,
					data_cancelamento = EXCLUDED.data_cancelamento,
					motivo_cancelamento = EXCLUDED.motivo_cancelamento,
					plano = EXCLUDED.plano,
					valor_mensalidade = EXCLUDED.valor_mensalidade,
					cidade = EXCLUDED.cidade,
					bairro = EXCLUDED.bairro,
					sincronizado_em = CURRENT_TIMESTAMP
			`, c.ContractCode, c.ClientCode, c.ClientName, month,
				c.LastOperationDate, c.CancellationReason, c.Plan, c.MonthlyFee,
				c.City, c.Neighborhood)
			if errIns == nil {
				canceladosCount++
			}
		}

		// Garante a remoção de contratos com motivos desconsiderados ou TV existentes na competência
		_, _ = dbPool.Exec(ctx, `
			DELETE FROM rbx_contratos_cancelados
			WHERE mes_competencia = $1
			  AND (
				motivo_cancelamento ILIKE '%MUD%TITULARIDADE%'
				OR motivo_cancelamento ILIKE '%AJUSTE T%CNICO%'
				OR motivo_cancelamento ILIKE '%CONTRATO TEMPOR%RIO%'
				OR motivo_cancelamento ILIKE '%PEDIDO INSTALA%O CANCELADO%'
				OR motivo_cancelamento ILIKE '%ERRO%GERA%O%CONTRATO%'
				OR motivo_cancelamento ILIKE '%CANCELAMENTO%MIGRA%'
				OR motivo_cancelamento ILIKE '%N%O PAGOU A TAXA%'
				OR motivo_cancelamento ILIKE '%NAO PAGOU A TAXA%'
				OR motivo_cancelamento ILIKE '%INVIA%'
				OR plano ~* '(^|[^a-zA-Z0-9])TV([^a-zA-Z0-9]|$)'
				OR plano ILIKE '%+ TV%'
				OR plano ILIKE '%+TV%'
				OR plano ILIKE '%TELEVIS%'
				OR plano ILIKE '%IPTV%'
			  )
		`, month)
	} else {
		log.Printf("[RBX OPERACIONAL] Erro ao buscar cancelamentos gerais: %v", err)
	}

	// 2. Sincronizar Atendimentos de Instalação do RBX (Opção 1 + Trecho de Nova Instalação Concluída)
	// Para Janeiro de 2026, a faixa sequencial validada é 53000 a 56500
	minNum := 53000
	maxNum := 56500
	if month != "2026-01" {
		minNum = 50000
		maxNum = 120000

		// Faixa sequencial inteligente baseada nos atendimentos gravados
		var prevMax int64
		errPrev := dbPool.QueryRow(ctx, "SELECT COALESCE(MAX(numero::bigint), 0) FROM rbx_atendimentos_instalacoes WHERE mes_competencia < $1", month).Scan(&prevMax)
		if errPrev == nil && prevMax > 10000 {
			minNum = int(prevMax) - 500
		}
		var currMax int64
		errCurr := dbPool.QueryRow(ctx, "SELECT COALESCE(MAX(numero::bigint), 0) FROM rbx_atendimentos_instalacoes WHERE mes_competencia = $1", month).Scan(&currMax)
		if errCurr == nil && currMax > int64(minNum) {
			maxNum = int(currMax) + 20000
		} else {
			maxNum = minNum + 25000
		}
	}

	atends, err := client.ConsultarAtendimentosFaixa(ctx, minNum, maxNum)
	instalacoesTotal := 0
	instalacoesSucesso := 0
	if err == nil {
		reContrato := regexp.MustCompile(`(?i)Contrato:\s*(\d+)`)
		reTopicoInstalacao := regexp.MustCompile(`(?i)(?:t[oó]pico:\s*\([^\)]*instala[cç][aã]o[^\)]*\)|instala[cç][aã]o\s+[a-z]{2,4}\b)`)
		reCausaSucesso := regexp.MustCompile(`(?i)(?:instalado\s+com\s+sucesso|instala[cç][aã]o\s+conclu[ií]da)`)

		type itemInstalacao struct {
			at       rbx.AtendimentoRetiradaResult
			contrato string
			sucesso  bool
		}
		var matched []itemInstalacao
		var clientCodesToEnrich []string
		seenCodes := make(map[string]bool)

		for _, at := range atends {
			// Regra de negócio estrita: A competência do atendimento é definida pela DATA DE ABERTURA.
			// Atendimentos iniciados no mês (mesmo que concluídos no mês seguinte) são contabilizados.
			// Atendimentos iniciados em meses anteriores (ex: Dezembro) e concluídos no mês são descartados.
			isAbert := at.AberturaDataHora != nil && at.AberturaDataHora.Format("2006-01") == month
			if !isAbert {
				continue
			}

			fullTextLower := strings.ToLower(at.Assunto + " " + at.Solucao + " " + at.Topico + " " + at.Causa)

			// TRECHO 1:
			// /# Tópico:(Instalação) Instalação #/
			// /# Causa:(Instalação) Instalado com Sucesso #/
			hasT1_Topico := strings.Contains(fullTextLower, "(instalação) instalação") ||
				strings.Contains(fullTextLower, "(instalacao) instalacao") ||
				strings.Contains(fullTextLower, "tópico:(instalação)") ||
				strings.Contains(fullTextLower, "topico:(instalacao)") ||
				strings.Contains(fullTextLower, "tópico: (instalação)") ||
				strings.Contains(fullTextLower, "topico: (instalacao)")

			hasT1_Causa := strings.Contains(fullTextLower, "(instalação) instalado com sucesso") ||
				strings.Contains(fullTextLower, "(instalacao) instalado com sucesso") ||
				strings.Contains(fullTextLower, "instalado com sucesso")
			isTrecho1 := hasT1_Topico && hasT1_Causa

			// TRECHO 2 (Solicitado pelo usuário):
			// /# Tópico:(Nova instalação) Iniciar processo de instalação #/
			// /# Causa:(Instalação Concluida) Instalação Concluida #/
			hasT2_Topico := strings.Contains(fullTextLower, "(nova instalação) iniciar processo de instalação") ||
				strings.Contains(fullTextLower, "(nova instalacao) iniciar processo de instalacao") ||
				strings.Contains(fullTextLower, "nova instalação") ||
				strings.Contains(fullTextLower, "nova instalacao")

			hasT2_Causa := strings.Contains(fullTextLower, "(instalação concluida) instalação concluida") ||
				strings.Contains(fullTextLower, "(instalação concluída) instalação concluída") ||
				strings.Contains(fullTextLower, "instalação concluida") ||
				strings.Contains(fullTextLower, "instalação concluída") ||
				strings.Contains(fullTextLower, "instalacao concluida")
			isTrecho2 := hasT2_Topico && hasT2_Causa

			// TRECHO 3 (Atualização Outubro - Generalizado com siglas de cidades MGB, PMV, QT, SJP, etc.):
			// /# Tópico:(Instalação <SIGLA>) Instalação <SIGLA> #/
			// /# Causa:(Instalado Com Sucesso) Instalado com Sucesso #/
			hasT3_Topico := reTopicoInstalacao.MatchString(fullTextLower)
			hasT3_Causa := reCausaSucesso.MatchString(fullTextLower)
			isTrecho3 := hasT3_Topico && hasT3_Causa

			if !isTrecho1 && !isTrecho2 && !isTrecho3 {
				continue
			}

			// Ignorar chamados abertos incorretamente como instalação (ex: suporte por lentidão ou reparo aberto por engano no fluxo de instalação)
			solucaoLower := strings.ToLower(at.Solucao)
			if strings.Contains(solucaoLower, "aberto incorretamente") ||
				strings.Contains(solucaoLower, "aberta incorretamente") ||
				strings.Contains(solucaoLower, "aberto indevidamente") ||
				strings.Contains(solucaoLower, "aberta indevidamente") ||
				strings.Contains(solucaoLower, "abertura errada") ||
				strings.Contains(solucaoLower, "abertura incorreta") ||
				strings.Contains(solucaoLower, "abertura indevida") ||
				strings.Contains(solucaoLower, "fluxo incorreto") ||
				strings.Contains(solucaoLower, "não era instalação") ||
				strings.Contains(solucaoLower, "nao era instalacao") ||
				strings.Contains(solucaoLower, "não era instalacao") ||
				strings.Contains(solucaoLower, "nao era instalação") ||
				strings.Contains(solucaoLower, "aberto errado") ||
				strings.Contains(solucaoLower, "aberta errada") ||
				strings.Contains(solucaoLower, "aberto por engano") ||
				strings.Contains(solucaoLower, "aberta por engano") ||
				strings.Contains(solucaoLower, "gerado incorretamente") ||
				strings.Contains(solucaoLower, "gerada incorretamente") ||
				strings.Contains(solucaoLower, "gerado indevidamente") ||
				strings.Contains(solucaoLower, "gerada indevidamente") ||
				strings.Contains(solucaoLower, "gerado errado") ||
				strings.Contains(solucaoLower, "gerada errada") ||
				strings.Contains(solucaoLower, "como lentidão") ||
				strings.Contains(solucaoLower, "como lentidao") ||
				strings.Contains(solucaoLower, "como reparo") ||
				strings.Contains(solucaoLower, "como suporte") ||
				strings.Contains(solucaoLower, "nao teve viabilida") ||
				strings.Contains(solucaoLower, "não teve viabilida") ||
				strings.Contains(solucaoLower, "sem viabilidade") ||
				strings.Contains(solucaoLower, "cto muito longe") ||
				strings.Contains(solucaoLower, "cto longe") ||
				strings.Contains(solucaoLower, "inviabilidade técnica") ||
				strings.Contains(solucaoLower, "inviabilidade tecnica") ||
				strings.Contains(solucaoLower, "não foi possível instalar") ||
				strings.Contains(solucaoLower, "nao foi possivel instalar") ||
				strings.Contains(solucaoLower, "não foi instalad") ||
				strings.Contains(solucaoLower, "nao foi instalad") ||
				strings.Contains(solucaoLower, "não instalad") ||
				strings.Contains(solucaoLower, "nao instalad") ||
				strings.Contains(fullTextLower, "os gerada incorretamente") ||
				strings.Contains(fullTextLower, "atendimento gerado incorretamente") ||
				strings.Contains(fullTextLower, "atendimento aberto incorretamente") ||
				strings.Contains(fullTextLower, "os aberta incorretamente") ||
				strings.Contains(fullTextLower, "atendimento não era instalação") ||
				strings.Contains(fullTextLower, "atendimento nao era instalacao") ||
				strings.Contains(solucaoLower, "pós venda") ||
				strings.Contains(solucaoLower, "pos venda") ||
				strings.Contains(fullTextLower, "verificar com o cliente se ele estar satisfeito") ||
				strings.Contains(fullTextLower, "verificar com o cliente se ele esta satisfeito") {
				continue
			}

			// Ambos os trechos indicam instalação física/técnica concluída com sucesso
			sucesso := true

			contratoMatch := reContrato.FindStringSubmatch(at.Assunto)
			contrato := ""
			if len(contratoMatch) > 1 {
				contrato = contratoMatch[1]
			}

			matched = append(matched, itemInstalacao{
				at:       at,
				contrato: contrato,
				sucesso:  sucesso,
			})

			cliCodeTrim := strings.TrimSpace(at.CodigoCliente)
			if cliCodeTrim != "" && !seenCodes[cliCodeTrim] {
				seenCodes[cliCodeTrim] = true
				clientCodesToEnrich = append(clientCodesToEnrich, cliCodeTrim)
			}
		}

		// Enriquecer dados dos clientes (Nome, Cidade, Bairro) via RBX em lotes
		clientDetails := make(map[string]rbx.ClientAddressResult)
		if len(clientCodesToEnrich) > 0 {
			resMap, errCli := client.ConsultarClientes(ctx, clientCodesToEnrich)
			if errCli == nil && resMap != nil {
				clientDetails = resMap
			} else {
				log.Printf("[RBX OPERACIONAL] Erro ao consultar detalhes cadastrais dos clientes: %v", errCli)
			}
		}

		// Limpa registros anteriores da competência para evitar lixo residual
		_, _ = dbPool.Exec(ctx, "DELETE FROM rbx_atendimentos_instalacoes WHERE mes_competencia = $1", month)

		for _, item := range matched {
			at := item.at
			cleanCode := strings.ReplaceAll(strings.ReplaceAll(strings.TrimSpace(at.CodigoCliente), ".", ""), ",", "")
			nomeCliente := ""
			cidade := ""
			bairro := ""

			if details, ok := clientDetails[cleanCode]; ok {
				nomeCliente = details.Name
				cidade = details.City
				bairro = details.Neighborhood
			}

			// Se tivermos os dados cadastrais, grava também na tabela clientes para busca unificada
			if nomeCliente != "" && cleanCode != "" {
				_, _ = dbPool.Exec(ctx, `
					INSERT INTO clientes (codigo_rbx, nome, cidade, bairro, status)
					VALUES ($1, $2, $3, $4, 'ativo')
					ON CONFLICT (codigo_rbx) DO UPDATE SET
						nome = CASE WHEN EXCLUDED.nome != '' THEN EXCLUDED.nome ELSE clientes.nome END,
						cidade = CASE WHEN EXCLUDED.cidade != '' THEN EXCLUDED.cidade ELSE clientes.cidade END,
						bairro = CASE WHEN EXCLUDED.bairro != '' THEN EXCLUDED.bairro ELSE clientes.bairro END
				`, cleanCode, nomeCliente, cidade, bairro)
			}

			_, errIns := dbPool.Exec(ctx, `
				INSERT INTO rbx_atendimentos_instalacoes (
					numero, protocolo, codigo_cliente, nome_cliente, contrato, mes_competencia,
					data_abertura, data_encerramento, situacao_os,
					topico, causa, assunto, solucao, usuario_abertura,
					instalado_com_sucesso, cidade, bairro, sincronizado_em
				) VALUES (
					$1, $2, $3, $4, $5, $6,
					$7, $8, $9,
					$10, $11, $12, $13, $14,
					$15, $16, $17, CURRENT_TIMESTAMP
				)
				ON CONFLICT (numero) DO UPDATE SET
					protocolo = EXCLUDED.protocolo,
					codigo_cliente = EXCLUDED.codigo_cliente,
					nome_cliente = CASE WHEN EXCLUDED.nome_cliente != '' THEN EXCLUDED.nome_cliente ELSE rbx_atendimentos_instalacoes.nome_cliente END,
					contrato = EXCLUDED.contrato,
					data_abertura = EXCLUDED.data_abertura,
					data_encerramento = EXCLUDED.data_encerramento,
					situacao_os = EXCLUDED.situacao_os,
					topico = EXCLUDED.topico,
					causa = EXCLUDED.causa,
					assunto = EXCLUDED.assunto,
					solucao = EXCLUDED.solucao,
					usuario_abertura = EXCLUDED.usuario_abertura,
					instalado_com_sucesso = EXCLUDED.instalado_com_sucesso,
					cidade = CASE WHEN EXCLUDED.cidade != '' THEN EXCLUDED.cidade ELSE rbx_atendimentos_instalacoes.cidade END,
					bairro = CASE WHEN EXCLUDED.bairro != '' THEN EXCLUDED.bairro ELSE rbx_atendimentos_instalacoes.bairro END,
					sincronizado_em = CURRENT_TIMESTAMP
			`,
				at.Numero, at.Protocolo, at.CodigoCliente, nomeCliente, item.contrato, month,
				at.AberturaDataHora, at.EncerramentoDataHora, at.SituacaoOS,
				at.Topico, at.Causa, at.Assunto, at.Solucao, at.UsuarioAbertura,
				item.sucesso, cidade, bairro,
			)

			if errIns == nil {
				instalacoesTotal++
				if item.sucesso {
					instalacoesSucesso++
				}
			}
		}

		// Garante a remoção de atendimentos abertos incorretamente ou com fluxo inválido
		_, _ = dbPool.Exec(ctx, `
			DELETE FROM rbx_atendimentos_instalacoes
			WHERE mes_competencia = $1
			  AND (
				solucao ILIKE '%aberto incorretamente%'
				OR solucao ILIKE '%aberta incorretamente%'
				OR solucao ILIKE '%aberto indevidamente%'
				OR solucao ILIKE '%aberta indevidamente%'
				OR solucao ILIKE '%abertura errada%'
				OR solucao ILIKE '%abertura incorreta%'
				OR solucao ILIKE '%abertura indevida%'
				OR solucao ILIKE '%fluxo incorreto%'
				OR solucao ILIKE '%n%o era instala%'
				OR solucao ILIKE '%aberto errado%'
				OR solucao ILIKE '%aberta errada%'
				OR solucao ILIKE '%aberto por engano%'
				OR solucao ILIKE '%aberta por engano%'
				OR solucao ILIKE '%gerad%incorret%'
				OR solucao ILIKE '%gerad%errad%'
				OR solucao ILIKE '%gerad%indevid%'
				OR solucao ILIKE '%como lentid%'
				OR solucao ILIKE '%como reparo%'
				OR solucao ILIKE '%como suporte%'
				OR solucao ILIKE '%nao teve viabilida%'
				OR solucao ILIKE '%não teve viabilida%'
				OR solucao ILIKE '%sem viabilidade%'
				OR solucao ILIKE '%cto muito longe%'
				OR solucao ILIKE '%cto longe%'
				OR solucao ILIKE '%inviabilidade técnica%'
				OR solucao ILIKE '%inviabilidade tecnica%'
				OR solucao ILIKE '%não foi possível instalar%'
				OR solucao ILIKE '%nao foi possivel instalar%'
				OR solucao ILIKE '%não foi instalad%'
				OR solucao ILIKE '%nao foi instalad%'
				OR solucao ILIKE '%não instalad%'
				OR solucao ILIKE '%nao instalad%'
			  )
		`, month)
	} else {
		log.Printf("[RBX OPERACIONAL] Erro ao buscar atendimentos de instalação: %v", err)
	}

	// 3. Consolidar Inadimplentes (Apenas Bloqueados da base de competência; suspensos removidos da visualização)
	var bloqueadosAtivos, suspensos int
	_ = dbPool.QueryRow(ctx, `
		SELECT 
			COUNT(*) FILTER (WHERE (status_desfecho = 'blocked' OR status_rbx_codigo IN ('B', 'P')) AND status_rbx_codigo != 'S' AND status_desfecho != 'suspended'),
			COUNT(*) FILTER (WHERE status_desfecho = 'suspended' OR status_rbx_codigo = 'S')
		FROM eventos_bloqueio
		WHERE mes_competencia = $1 AND NOT eh_mimo
	`, month).Scan(&bloqueadosAtivos, &suspensos)

	totalInadimplentes := bloqueadosAtivos

	// 4. Salvar totais consolidados no banco de dados para evitar consultas desnecessárias
	_, _ = dbPool.Exec(ctx, `
		INSERT INTO rbx_metricas_mensais (
			mes_competencia, total_instalacoes, instalacoes_sucesso,
			total_cancelamentos, total_bloqueados, total_suspensos,
			total_inadimplentes, atualizado_em
		) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
		ON CONFLICT (mes_competencia) DO UPDATE SET
			total_instalacoes = EXCLUDED.total_instalacoes,
			instalacoes_sucesso = EXCLUDED.instalacoes_sucesso,
			total_cancelamentos = EXCLUDED.total_cancelamentos,
			total_bloqueados = EXCLUDED.total_bloqueados,
			total_suspensos = EXCLUDED.total_suspensos,
			total_inadimplentes = EXCLUDED.total_inadimplentes,
			atualizado_em = CURRENT_TIMESTAMP
	`, month, instalacoesTotal, instalacoesSucesso, canceladosCount, bloqueadosAtivos, 0, totalInadimplentes)

	return map[string]interface{}{
		"mesCompetencia":     month,
		"totalInstalacoes":   instalacoesTotal,
		"instalacoesSucesso": instalacoesSucesso,
		"totalCancelamentos": canceladosCount,
		"totalBloqueados":    bloqueadosAtivos,
		"totalSuspensos":     0,
		"totalInadimplentes": totalInadimplentes,
	}, nil
}

// syncRbxAutenticacoesBase sincroniza todas as autenticações do RBX e cruza com os contratos históricos até Fev/2026
func syncRbxAutenticacoesBase(ctx context.Context, client *rbx.Client) (map[string]interface{}, error) {
	if dbPool == nil {
		return nil, fmt.Errorf("banco de dados não disponível")
	}

	log.Printf("[RBX AUTENTICACOES] Iniciando sincronização da base de autenticações...")

	// 1. Consulta todas as autenticações no RBX
	auths, err := client.ConsultarAutenticacoes(ctx)
	if err != nil {
		return nil, fmt.Errorf("erro ao consultar autenticações no RBX: %v", err)
	}

	// 2. Consulta contratos criados até 31/10/2026 (indexados por número e por cliente, cobrindo Jan a Out)
	contratosHist, err := client.ConsultarContratosBaseHistorica(ctx, "2026-10-31")
	if err != nil {
		log.Printf("[RBX AUTENTICACOES] Aviso: erro ao consultar contratos históricos: %v", err)
		contratosHist = rbx.ContratosHistoricosResult{
			PorNumero:  make(map[string]rbx.ContratoBaseResult),
			PorCliente: make(map[string]rbx.ContratoBaseResult),
		}
	}

	totalAuths := len(auths)
	totalCentral := 0
	totalPPPoE := 0
	totalPPPoEJan := 0
	totalPPPoEFev := 0
	totalPPPoEMar := 0
	totalPPPoEAbr := 0
	totalPPPoEMai := 0
	totalPPPoEJun := 0
	totalPPPoEJul := 0
	totalPPPoEAgo := 0
	totalPPPoESet := 0
	totalPPPoEOut := 0
	totalConexoesGrafanaJan := 0
	totalConexoesGrafanaFev := 0
	totalConexoesGrafanaMar := 0
	totalConexoesGrafanaAbr := 0
	totalConexoesGrafanaMai := 0
	totalConexoesGrafanaJun := 0
	totalConexoesGrafanaJul := 0
	totalConexoesGrafanaAgo := 0
	totalConexoesGrafanaSet := 0
	totalConexoesGrafanaOut := 0
	totalUpgradesJan := 0
	totalUpgradesFev := 0
	totalUpgradesMar := 0
	totalUpgradesAbr := 0
	totalUpgradesMai := 0
	totalUpgradesJun := 0
	totalUpgradesJul := 0
	totalUpgradesAgo := 0
	totalUpgradesSet := 0
	totalUpgradesOut := 0
	totalExcluidosGrupo := 0

	statusCounts := map[string]int{
		"A": 0, "B": 0, "S": 0, "C": 0, "outros": 0,
	}

	limiteJan := time.Date(2026, 1, 31, 23, 59, 59, 0, time.UTC)
	limiteFev := time.Date(2026, 2, 28, 23, 59, 59, 0, time.UTC)
	limiteMar := time.Date(2026, 3, 31, 23, 59, 59, 0, time.UTC)
	limiteAbr := time.Date(2026, 4, 30, 23, 59, 59, 0, time.UTC)
	limiteMai := time.Date(2026, 5, 31, 23, 59, 59, 0, time.UTC)
	limiteJun := time.Date(2026, 6, 30, 23, 59, 59, 0, time.UTC)
	limiteJul := time.Date(2026, 7, 31, 23, 59, 59, 0, time.UTC)
	limiteAgo := time.Date(2026, 8, 31, 23, 59, 59, 0, time.UTC)
	limiteSet := time.Date(2026, 9, 30, 23, 59, 59, 0, time.UTC)
	limiteOut := time.Date(2026, 10, 31, 23, 59, 59, 0, time.UTC)

	batch := &pgx.Batch{}
	for _, a := range auths {
		ehCentral := a.EhCentralAssinante
		if ehCentral {
			totalCentral++
		} else {
			totalPPPoE++
		}

		c, hasContr := contratosHist.PorNumero[a.Contrato]
		cliCode := a.Cliente
		cliNome := ""
		grupoCliente := ""
		var dtAss, dtIni, dtUltOp *time.Time
		sitCod := ""
		sitDesc := ""
		criadoAteJan := false
		ativoEmJan := false
		situacaoEmJan := ""

		criadoAteFev := false
		ativoEmFev := false
		situacaoEmFev := ""

		criadoAteMar := false
		ativoEmMar := false
		situacaoEmMar := ""

		criadoAteAbr := false
		ativoEmAbr := false
		situacaoEmAbr := ""

		criadoAteMai := false
		ativoEmMai := false
		situacaoEmMai := ""

		criadoAteJun := false
		ativoEmJun := false
		situacaoEmJun := ""

		criadoAteJul := false
		ativoEmJul := false
		situacaoEmJul := ""

		criadoAteAgo := false
		ativoEmAgo := false
		situacaoEmAgo := ""

		criadoAteSet := false
		ativoEmSet := false
		situacaoEmSet := ""

		criadoAteOut := false
		ativoEmOut := false
		situacaoEmOut := ""

		origemUpgrade := false
		contratoAnterior := ""

		if hasContr {
			if c.ClienteCodigo != "" {
				cliCode = c.ClienteCodigo
			}
			cliNome = c.ClienteNome
			grupoCliente = c.ClienteGrupo
			dtAss = c.Assinatura
			dtIni = c.Inicio
			sitCod = c.SituacaoCodigo
			sitDesc = c.SituacaoDescricao
			dtUltOp = c.DataUltimaOperacao

			if a.Usuario == "mgb_escolaverjoaquimsilva" || a.Contrato == "20346" || c.Numero == "20346" {
				c.SituacaoCodigo = "C"
				c.SituacaoDescricao = "Cancelado"
				sitCod = "C"
				sitDesc = "Cancelado"
				dtUltOp = nil
			}

			criadoAteOut = true
			if (c.Assinatura != nil && !c.Assinatura.After(limiteSet)) || (c.Inicio != nil && !c.Inicio.After(limiteSet)) {
				criadoAteSet = true
			}
			if (c.Assinatura != nil && !c.Assinatura.After(limiteAgo)) || (c.Inicio != nil && !c.Inicio.After(limiteAgo)) {
				criadoAteAgo = true
			}
			if (c.Assinatura != nil && !c.Assinatura.After(limiteJul)) || (c.Inicio != nil && !c.Inicio.After(limiteJul)) {
				criadoAteJul = true
			}
			if (c.Assinatura != nil && !c.Assinatura.After(limiteJun)) || (c.Inicio != nil && !c.Inicio.After(limiteJun)) {
				criadoAteJun = true
			}
			if (c.Assinatura != nil && !c.Assinatura.After(limiteMai)) || (c.Inicio != nil && !c.Inicio.After(limiteMai)) {
				criadoAteMai = true
			}
			if (c.Assinatura != nil && !c.Assinatura.After(limiteAbr)) || (c.Inicio != nil && !c.Inicio.After(limiteAbr)) {
				criadoAteAbr = true
			}
			if (c.Assinatura != nil && !c.Assinatura.After(limiteMar)) || (c.Inicio != nil && !c.Inicio.After(limiteMar)) {
				criadoAteMar = true
			}
			if (c.Assinatura != nil && !c.Assinatura.After(limiteFev)) || (c.Inicio != nil && !c.Inicio.After(limiteFev)) {
				criadoAteFev = true
			}
			if (c.Assinatura != nil && !c.Assinatura.After(limiteJan)) || (c.Inicio != nil && !c.Inicio.After(limiteJan)) {
				criadoAteJan = true
			}

			if !ehCentral {
				// Avaliação para Janeiro
				if criadoAteJan {
					totalPPPoEJan++
					switch c.SituacaoCodigo {
					case "A":
						ativoEmJan = true
						situacaoEmJan = "Ativo (Contínuo)"
					case "B", "P":
						ativoEmJan = false
						situacaoEmJan = "Bloqueado (Conectado)"
					case "S":
						if c.DataUltimaOperacao != nil && c.DataUltimaOperacao.After(limiteJan) {
							ativoEmJan = true
							situacaoEmJan = "Suspenso pós-Jan"
						} else {
							ativoEmJan = false
							situacaoEmJan = "Suspenso"
						}
					case "C":
						if c.DataUltimaOperacao != nil && c.DataUltimaOperacao.After(limiteJan) {
							ativoEmJan = true
							situacaoEmJan = "Cancelado pós-Jan"
						} else {
							ativoEmJan = false
							situacaoEmJan = "Cancelado"
						}
					case "T":
						origemUpgrade = true
						situacaoEmJan = "Transferido"
					default:
						situacaoEmJan = c.SituacaoDescricao
					}
				} else {
					situacaoEmJan = "Novo pós-Jan"
				}

				// Avaliação para Fevereiro
				if criadoAteFev {
					totalPPPoEFev++
					switch c.SituacaoCodigo {
					case "A":
						ativoEmFev = true
						situacaoEmFev = "Ativo (Contínuo)"
					case "B", "P":
						ativoEmFev = false
						situacaoEmFev = "Bloqueado (Conectado)"
					case "S":
						if c.DataUltimaOperacao != nil && c.DataUltimaOperacao.After(limiteFev) {
							ativoEmFev = true
							situacaoEmFev = "Suspenso pós-Fev"
						} else {
							ativoEmFev = false
							situacaoEmFev = "Suspenso"
						}
					case "C":
						if c.DataUltimaOperacao != nil && c.DataUltimaOperacao.After(limiteFev) {
							ativoEmFev = true
							situacaoEmFev = "Cancelado pós-Fev"
						} else {
							ativoEmFev = false
							situacaoEmFev = "Cancelado"
						}
					case "T":
						origemUpgrade = true
						situacaoEmFev = "Transferido"
					default:
						situacaoEmFev = c.SituacaoDescricao
					}
				} else {
					situacaoEmFev = "Novo pós-Fev"
				}

				// Avaliação para Março
				if criadoAteMar {
					totalPPPoEMar++
					switch c.SituacaoCodigo {
					case "A":
						ativoEmMar = true
						situacaoEmMar = "Ativo (Contínuo)"
					case "B", "P":
						ativoEmMar = false
						situacaoEmMar = "Bloqueado (Conectado)"
					case "S":
						if c.DataUltimaOperacao != nil && c.DataUltimaOperacao.After(limiteMar) {
							ativoEmMar = true
							situacaoEmMar = "Suspenso pós-Mar"
						} else {
							ativoEmMar = false
							situacaoEmMar = "Suspenso"
						}
					case "C":
						if c.DataUltimaOperacao != nil && c.DataUltimaOperacao.After(limiteMar) {
							ativoEmMar = true
							situacaoEmMar = "Cancelado pós-Mar"
						} else {
							ativoEmMar = false
							situacaoEmMar = "Cancelado"
						}
					case "T":
						origemUpgrade = true
						situacaoEmMar = "Transferido"
					default:
						situacaoEmMar = c.SituacaoDescricao
					}
				} else {
					situacaoEmMar = "Novo pós-Mar"
				}

				// Avaliação para Abril
				if criadoAteAbr {
					totalPPPoEAbr++
					switch c.SituacaoCodigo {
					case "A":
						ativoEmAbr = true
						situacaoEmAbr = "Ativo (Contínuo)"
					case "B", "P":
						ativoEmAbr = false
						situacaoEmAbr = "Bloqueado (Conectado)"
					case "S":
						if c.DataUltimaOperacao != nil && c.DataUltimaOperacao.After(limiteAbr) {
							ativoEmAbr = true
							situacaoEmAbr = "Suspenso pós-Abr"
						} else {
							ativoEmAbr = false
							situacaoEmAbr = "Suspenso"
						}
					case "C":
						if c.DataUltimaOperacao != nil && c.DataUltimaOperacao.After(limiteAbr) {
							ativoEmAbr = true
							situacaoEmAbr = "Cancelado pós-Abr"
						} else {
							ativoEmAbr = false
							situacaoEmAbr = "Cancelado"
						}
					case "T":
						origemUpgrade = true
						situacaoEmAbr = "Transferido"
					default:
						situacaoEmAbr = c.SituacaoDescricao
					}
				} else {
					situacaoEmAbr = "Novo pós-Abr"
				}

				// Avaliação para Maio
				if criadoAteMai {
					totalPPPoEMai++
					switch c.SituacaoCodigo {
					case "A":
						ativoEmMai = true
						situacaoEmMai = "Ativo (Contínuo)"
					case "B", "P":
						ativoEmMai = false
						situacaoEmMai = "Bloqueado (Conectado)"
					case "S":
						if c.DataUltimaOperacao != nil && c.DataUltimaOperacao.After(limiteMai) {
							ativoEmMai = true
							situacaoEmMai = "Suspenso pós-Mai"
						} else {
							ativoEmMai = false
							situacaoEmMai = "Suspenso"
						}
					case "C":
						if c.DataUltimaOperacao != nil && c.DataUltimaOperacao.After(limiteMai) {
							ativoEmMai = true
							situacaoEmMai = "Cancelado pós-Mai"
						} else {
							ativoEmMai = false
							situacaoEmMai = "Cancelado"
						}
					case "T":
						origemUpgrade = true
						situacaoEmMai = "Transferido"
					default:
						situacaoEmMai = c.SituacaoDescricao
					}
				} else {
					situacaoEmMai = "Novo pós-Mai"
				}

				// Avaliação para Junho
				if criadoAteJun {
					totalPPPoEJun++
					switch c.SituacaoCodigo {
					case "A":
						ativoEmJun = true
						situacaoEmJun = "Ativo (Contínuo)"
					case "B", "P":
						ativoEmJun = false
						situacaoEmJun = "Bloqueado (Conectado)"
					case "S":
						if c.DataUltimaOperacao != nil && c.DataUltimaOperacao.After(limiteJun) {
							ativoEmJun = true
							situacaoEmJun = "Suspenso pós-Jun"
						} else {
							ativoEmJun = false
							situacaoEmJun = "Suspenso"
						}
					case "C":
						if c.DataUltimaOperacao != nil && c.DataUltimaOperacao.After(limiteJun) {
							ativoEmJun = true
							situacaoEmJun = "Cancelado pós-Jun"
						} else {
							ativoEmJun = false
							situacaoEmJun = "Cancelado"
						}
					case "T":
						origemUpgrade = true
						situacaoEmJun = "Transferido"
					default:
						situacaoEmJun = c.SituacaoDescricao
					}
				} else {
					situacaoEmJun = "Novo pós-Jun"
				}

				// Avaliação para Julho
				if criadoAteJul {
					totalPPPoEJul++
					switch c.SituacaoCodigo {
					case "A":
						ativoEmJul = true
						situacaoEmJul = "Ativo (Contínuo)"
					case "B", "P":
						ativoEmJul = false
						situacaoEmJul = "Bloqueado (Conectado)"
					case "S":
						if c.DataUltimaOperacao != nil && c.DataUltimaOperacao.After(limiteJul) {
							ativoEmJul = true
							situacaoEmJul = "Suspenso pós-Jul"
						} else {
							ativoEmJul = false
							situacaoEmJul = "Suspenso"
						}
					case "C":
						if c.DataUltimaOperacao != nil && c.DataUltimaOperacao.After(limiteJul) {
							ativoEmJul = true
							situacaoEmJul = "Cancelado pós-Jul"
						} else {
							ativoEmJul = false
							situacaoEmJul = "Cancelado"
						}
					case "T":
						origemUpgrade = true
						situacaoEmJul = "Transferido"
					default:
						situacaoEmJul = c.SituacaoDescricao
					}
				} else {
					situacaoEmJul = "Novo pós-Jul"
				}

				// Avaliação para Agosto
				if criadoAteAgo {
					totalPPPoEAgo++
					switch c.SituacaoCodigo {
					case "A":
						ativoEmAgo = true
						situacaoEmAgo = "Ativo (Contínuo)"
					case "B", "P":
						ativoEmAgo = false
						situacaoEmAgo = "Bloqueado (Conectado)"
					case "S":
						if c.DataUltimaOperacao != nil && c.DataUltimaOperacao.After(limiteAgo) {
							ativoEmAgo = true
							situacaoEmAgo = "Suspenso pós-Ago"
						} else {
							ativoEmAgo = false
							situacaoEmAgo = "Suspenso"
						}
					case "C":
						if c.DataUltimaOperacao != nil && c.DataUltimaOperacao.After(limiteAgo) {
							ativoEmAgo = true
							situacaoEmAgo = "Cancelado pós-Ago"
						} else {
							ativoEmAgo = false
							situacaoEmAgo = "Cancelado"
						}
					case "T":
						origemUpgrade = true
						situacaoEmAgo = "Transferido"
					default:
						situacaoEmAgo = c.SituacaoDescricao
					}
				} else {
					situacaoEmAgo = "Novo pós-Ago"
				}

				// Avaliação para Setembro
				if criadoAteSet {
					totalPPPoESet++
					switch c.SituacaoCodigo {
					case "A":
						ativoEmSet = true
						situacaoEmSet = "Ativo (Contínuo)"
					case "B", "P":
						ativoEmSet = false
						situacaoEmSet = "Bloqueado (Conectado)"
					case "S":
						if c.DataUltimaOperacao != nil && c.DataUltimaOperacao.After(limiteSet) {
							ativoEmSet = true
							situacaoEmSet = "Suspenso pós-Set"
						} else {
							ativoEmSet = false
							situacaoEmSet = "Suspenso"
						}
					case "C":
						if c.DataUltimaOperacao != nil && c.DataUltimaOperacao.After(limiteSet) {
							ativoEmSet = true
							situacaoEmSet = "Cancelado pós-Set"
						} else {
							ativoEmSet = false
							situacaoEmSet = "Cancelado"
						}
					case "T":
						origemUpgrade = true
						situacaoEmSet = "Transferido"
					default:
						situacaoEmSet = c.SituacaoDescricao
					}
				} else {
					situacaoEmSet = "Novo pós-Set"
				}

				// Avaliação para Outubro
				if criadoAteOut {
					totalPPPoEOut++
					switch c.SituacaoCodigo {
					case "A":
						ativoEmOut = true
						situacaoEmOut = "Ativo (Contínuo)"
					case "B", "P":
						ativoEmOut = false
						situacaoEmOut = "Bloqueado (Conectado)"
					case "S":
						ativoEmOut = false
						if c.DataUltimaOperacao != nil && c.DataUltimaOperacao.After(limiteOut) {
							situacaoEmOut = "Suspenso pós-Out"
						} else {
							situacaoEmOut = "Suspenso"
						}
					case "C":
						ativoEmOut = false
						if c.DataUltimaOperacao != nil && c.DataUltimaOperacao.After(limiteOut) {
							situacaoEmOut = "Cancelado pós-Out"
						} else {
							situacaoEmOut = "Cancelado"
						}
					case "T":
						origemUpgrade = true
						situacaoEmOut = "Transferido"
					default:
						situacaoEmOut = c.SituacaoDescricao
					}
				} else {
					situacaoEmOut = "Novo pós-Out"
				}
			}
		} else {
			// Contrato atual é pós-Outubro/2026. Verifica se o CLIENTE já existia antes:
			cOld, hasOldCli := contratosHist.PorCliente[a.Cliente]
			if hasOldCli && !ehCentral {
				origemUpgrade = true
				contratoAnterior = cOld.Numero
				cliNome = cOld.ClienteNome
				grupoCliente = cOld.ClienteGrupo
				if cOld.ClienteCodigo != "" {
					cliCode = cOld.ClienteCodigo
				}

				// Verificação Janeiro
				if (cOld.Assinatura != nil && !cOld.Assinatura.After(limiteJan)) || (cOld.Inicio != nil && !cOld.Inicio.After(limiteJan)) {
					if cOld.SituacaoCodigo == "A" || cOld.SituacaoCodigo == "T" || (cOld.DataUltimaOperacao != nil && cOld.DataUltimaOperacao.After(limiteJan)) {
						ativoEmJan = true
						situacaoEmJan = "Upgrade pós-Jan (Ativo em Jan)"
						totalUpgradesJan++
					} else {
						situacaoEmJan = "Cliente Antigo (Inativo em Jan)"
					}
				} else {
					situacaoEmJan = "Novo Cliente pós-Jan"
				}

				// Verificação Fevereiro
				if (cOld.Assinatura != nil && !cOld.Assinatura.After(limiteFev)) || (cOld.Inicio != nil && !cOld.Inicio.After(limiteFev)) {
					if cOld.SituacaoCodigo == "A" || cOld.SituacaoCodigo == "T" || (cOld.DataUltimaOperacao != nil && cOld.DataUltimaOperacao.After(limiteFev)) {
						ativoEmFev = true
						situacaoEmFev = "Upgrade pós-Fev (Ativo em Fev)"
						totalUpgradesFev++
					} else {
						situacaoEmFev = "Cliente Antigo (Inativo em Fev)"
					}
				} else {
					situacaoEmFev = "Novo Cliente pós-Fev"
				}

				// Verificação Março
				if (cOld.Assinatura != nil && !cOld.Assinatura.After(limiteMar)) || (cOld.Inicio != nil && !cOld.Inicio.After(limiteMar)) {
					if cOld.SituacaoCodigo == "A" || cOld.SituacaoCodigo == "T" || (cOld.DataUltimaOperacao != nil && cOld.DataUltimaOperacao.After(limiteMar)) {
						ativoEmMar = true
						situacaoEmMar = "Upgrade pós-Mar (Ativo em Mar)"
						totalUpgradesMar++
					} else {
						situacaoEmMar = "Cliente Antigo (Inativo em Mar)"
					}
				} else {
					situacaoEmMar = "Novo Cliente pós-Mar"
				}

				// Verificação Abril
				if (cOld.Assinatura != nil && !cOld.Assinatura.After(limiteAbr)) || (cOld.Inicio != nil && !cOld.Inicio.After(limiteAbr)) {
					if cOld.SituacaoCodigo == "A" || cOld.SituacaoCodigo == "T" || (cOld.DataUltimaOperacao != nil && cOld.DataUltimaOperacao.After(limiteAbr)) {
						ativoEmAbr = true
						situacaoEmAbr = "Upgrade pós-Abr (Ativo em Abr)"
						totalUpgradesAbr++
					} else {
						situacaoEmAbr = "Cliente Antigo (Inativo em Abr)"
					}
				} else {
					situacaoEmAbr = "Novo Cliente pós-Abr"
				}

				// Verificação Maio
				if (cOld.Assinatura != nil && !cOld.Assinatura.After(limiteMai)) || (cOld.Inicio != nil && !cOld.Inicio.After(limiteMai)) {
					if cOld.SituacaoCodigo == "A" || cOld.SituacaoCodigo == "T" || (cOld.DataUltimaOperacao != nil && cOld.DataUltimaOperacao.After(limiteMai)) {
						ativoEmMai = true
						situacaoEmMai = "Upgrade pós-Mai (Ativo em Mai)"
						totalUpgradesMai++
					} else {
						situacaoEmMai = "Cliente Antigo (Inativo em Mai)"
					}
				} else {
					situacaoEmMai = "Novo Cliente pós-Mai"
				}

				// Verificação Junho
				if (cOld.Assinatura != nil && !cOld.Assinatura.After(limiteJun)) || (cOld.Inicio != nil && !cOld.Inicio.After(limiteJun)) {
					if cOld.SituacaoCodigo == "A" || cOld.SituacaoCodigo == "T" || (cOld.DataUltimaOperacao != nil && cOld.DataUltimaOperacao.After(limiteJun)) {
						ativoEmJun = true
						situacaoEmJun = "Upgrade pós-Jun (Ativo em Jun)"
						totalUpgradesJun++
					} else {
						situacaoEmJun = "Cliente Antigo (Inativo em Jun)"
					}
				} else {
					situacaoEmJun = "Novo Cliente pós-Jun"
				}

				// Verificação Julho
				if (cOld.Assinatura != nil && !cOld.Assinatura.After(limiteJul)) || (cOld.Inicio != nil && !cOld.Inicio.After(limiteJul)) {
					if cOld.SituacaoCodigo == "A" || cOld.SituacaoCodigo == "T" || (cOld.DataUltimaOperacao != nil && cOld.DataUltimaOperacao.After(limiteJul)) {
						ativoEmJul = true
						situacaoEmJul = "Upgrade pós-Jul (Ativo em Jul)"
						totalUpgradesJul++
					} else {
						situacaoEmJul = "Cliente Antigo (Inativo em Jul)"
					}
				} else {
					situacaoEmJul = "Novo Cliente pós-Jul"
				}

				// Verificação Agosto
				if (cOld.Assinatura != nil && !cOld.Assinatura.After(limiteAgo)) || (cOld.Inicio != nil && !cOld.Inicio.After(limiteAgo)) {
					if cOld.SituacaoCodigo == "A" || cOld.SituacaoCodigo == "T" || (cOld.DataUltimaOperacao != nil && cOld.DataUltimaOperacao.After(limiteAgo)) {
						ativoEmAgo = true
						situacaoEmAgo = "Upgrade pós-Ago (Ativo em Ago)"
						totalUpgradesAgo++
					} else {
						situacaoEmAgo = "Cliente Antigo (Inativo em Ago)"
					}
				} else {
					situacaoEmAgo = "Novo Cliente pós-Ago"
				}

				// Verificação Setembro
				if (cOld.Assinatura != nil && !cOld.Assinatura.After(limiteSet)) || (cOld.Inicio != nil && !cOld.Inicio.After(limiteSet)) {
					if cOld.SituacaoCodigo == "A" || cOld.SituacaoCodigo == "T" || (cOld.DataUltimaOperacao != nil && cOld.DataUltimaOperacao.After(limiteSet)) {
						ativoEmSet = true
						situacaoEmSet = "Upgrade pós-Set (Ativo em Set)"
						totalUpgradesSet++
					} else {
						situacaoEmSet = "Cliente Antigo (Inativo em Set)"
					}
				} else {
					situacaoEmSet = "Novo Cliente pós-Set"
				}

				// Verificação Outubro
				if (cOld.Assinatura != nil && !cOld.Assinatura.After(limiteOut)) || (cOld.Inicio != nil && !cOld.Inicio.After(limiteOut)) {
					if cOld.SituacaoCodigo == "A" || cOld.SituacaoCodigo == "T" || (cOld.DataUltimaOperacao != nil && cOld.DataUltimaOperacao.After(limiteOut)) {
						ativoEmOut = true
						situacaoEmOut = "Upgrade pós-Out (Ativo em Out)"
						totalUpgradesOut++
					} else {
						situacaoEmOut = "Cliente Antigo (Inativo em Out)"
					}
				} else {
					situacaoEmOut = "Novo Cliente pós-Out"
				}
			} else if !ehCentral {
				situacaoEmJan = "Novo Cliente pós-Jan"
				situacaoEmFev = "Novo Cliente pós-Fev"
				situacaoEmMar = "Novo Cliente pós-Mar"
				situacaoEmAbr = "Novo Cliente pós-Abr"
				situacaoEmMai = "Novo Cliente pós-Mai"
				situacaoEmJun = "Novo Cliente pós-Jun"
				situacaoEmJul = "Novo Cliente pós-Jul"
				situacaoEmAgo = "Novo Cliente pós-Ago"
				situacaoEmSet = "Novo Cliente pós-Set"
				situacaoEmOut = "Novo Cliente pós-Out"
			}
		}

		if grupoCliente == "" {
			if cOld, ok := contratosHist.PorCliente[cliCode]; ok {
				grupoCliente = cOld.ClienteGrupo
			}
		}

		ehGrupoExcluido := rbx.EhGrupoExcluido(grupoCliente)
		if ehGrupoExcluido {
			ativoEmJan = false
			ativoEmFev = false
			ativoEmMar = false
			ativoEmAbr = false
			ativoEmMai = false
			ativoEmJun = false
			ativoEmJul = false
			ativoEmAgo = false
			ativoEmSet = false
			ativoEmOut = false
			totalExcluidosGrupo++
			if situacaoEmJan != "" {
				situacaoEmJan = "Grupo Excluído (" + grupoCliente + ")"
			}
			if situacaoEmFev != "" {
				situacaoEmFev = "Grupo Excluído (" + grupoCliente + ")"
			}
			if situacaoEmMar != "" {
				situacaoEmMar = "Grupo Excluído (" + grupoCliente + ")"
			}
			if situacaoEmAbr != "" {
				situacaoEmAbr = "Grupo Excluído (" + grupoCliente + ")"
			}
			if situacaoEmMai != "" {
				situacaoEmMai = "Grupo Excluído (" + grupoCliente + ")"
			}
			if situacaoEmJun != "" {
				situacaoEmJun = "Grupo Excluído (" + grupoCliente + ")"
			}
			if situacaoEmJul != "" {
				situacaoEmJul = "Grupo Excluído (" + grupoCliente + ")"
			}
			if situacaoEmAgo != "" {
				situacaoEmAgo = "Grupo Excluído (" + grupoCliente + ")"
			}
			if situacaoEmSet != "" {
				situacaoEmSet = "Grupo Excluído (" + grupoCliente + ")"
			}
			if situacaoEmOut != "" {
				situacaoEmOut = "Grupo Excluído (" + grupoCliente + ")"
			}
		}

		if ativoEmJan && !ehCentral && !ehGrupoExcluido {
			totalConexoesGrafanaJan++
		}
		if ativoEmFev && !ehCentral && !ehGrupoExcluido {
			totalConexoesGrafanaFev++
		}
		if ativoEmMar && !ehCentral && !ehGrupoExcluido {
			totalConexoesGrafanaMar++
		}
		if ativoEmAbr && !ehCentral && !ehGrupoExcluido {
			totalConexoesGrafanaAbr++
		}
		if ativoEmMai && !ehCentral && !ehGrupoExcluido {
			totalConexoesGrafanaMai++
		}
		if ativoEmJun && !ehCentral && !ehGrupoExcluido {
			totalConexoesGrafanaJun++
		}
		if ativoEmJul && !ehCentral && !ehGrupoExcluido {
			totalConexoesGrafanaJul++
		}
		if ativoEmAgo && !ehCentral && !ehGrupoExcluido {
			totalConexoesGrafanaAgo++
		}
		if ativoEmSet && !ehCentral && !ehGrupoExcluido {
			totalConexoesGrafanaSet++
		}
		if ativoEmOut && !ehCentral && !ehGrupoExcluido {
			totalConexoesGrafanaOut++
		}

		batch.Queue(`
			INSERT INTO rbx_autenticacoes (
				id_autenticacao, codigo_cliente, nome_cliente, numero_contrato,
				nas, porta, usuario, mac, observacao, eh_central_assinante,
				data_assinatura, data_inicio, situacao_codigo, situacao_descricao,
				data_ultima_operacao, criado_ate_janeiro_2026, ativo_em_janeiro_2026,
				origem_upgrade, contrato_anterior, situacao_em_janeiro,
				grupo_cliente, eh_grupo_excluido,
				criado_ate_fevereiro_2026, ativo_em_fevereiro_2026, situacao_em_fevereiro,
				criado_ate_marco_2026, ativo_em_marco_2026, situacao_em_marco,
				criado_ate_abril_2026, ativo_em_abril_2026, situacao_em_abril,
				criado_ate_maio_2026, ativo_em_maio_2026, situacao_em_maio,
				criado_ate_junho_2026, ativo_em_junho_2026, situacao_em_junho,
				criado_ate_julho_2026, ativo_em_julho_2026, situacao_em_julho,
				criado_ate_agosto_2026, ativo_em_agosto_2026, situacao_em_agosto,
				criado_ate_setembro_2026, ativo_em_setembro_2026, situacao_em_setembro,
				criado_ate_outubro_2026, ativo_em_outubro_2026, situacao_em_outubro,
				sincronizado_em
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, CURRENT_TIMESTAMP)
			ON CONFLICT (id_autenticacao) DO UPDATE SET
				codigo_cliente = EXCLUDED.codigo_cliente,
				nome_cliente = CASE WHEN EXCLUDED.nome_cliente != '' THEN EXCLUDED.nome_cliente ELSE rbx_autenticacoes.nome_cliente END,
				numero_contrato = EXCLUDED.numero_contrato,
				nas = EXCLUDED.nas,
				porta = EXCLUDED.porta,
				usuario = EXCLUDED.usuario,
				mac = EXCLUDED.mac,
				observacao = EXCLUDED.observacao,
				eh_central_assinante = EXCLUDED.eh_central_assinante,
				data_assinatura = EXCLUDED.data_assinatura,
				data_inicio = EXCLUDED.data_inicio,
				situacao_codigo = EXCLUDED.situacao_codigo,
				situacao_descricao = EXCLUDED.situacao_descricao,
				data_ultima_operacao = EXCLUDED.data_ultima_operacao,
				criado_ate_janeiro_2026 = EXCLUDED.criado_ate_janeiro_2026,
				ativo_em_janeiro_2026 = EXCLUDED.ativo_em_janeiro_2026,
				origem_upgrade = EXCLUDED.origem_upgrade,
				contrato_anterior = EXCLUDED.contrato_anterior,
				situacao_em_janeiro = EXCLUDED.situacao_em_janeiro,
				grupo_cliente = EXCLUDED.grupo_cliente,
				eh_grupo_excluido = EXCLUDED.eh_grupo_excluido,
				criado_ate_fevereiro_2026 = EXCLUDED.criado_ate_fevereiro_2026,
				ativo_em_fevereiro_2026 = EXCLUDED.ativo_em_fevereiro_2026,
				situacao_em_fevereiro = EXCLUDED.situacao_em_fevereiro,
				criado_ate_marco_2026 = EXCLUDED.criado_ate_marco_2026,
				ativo_em_marco_2026 = EXCLUDED.ativo_em_marco_2026,
				situacao_em_marco = EXCLUDED.situacao_em_marco,
				criado_ate_abril_2026 = EXCLUDED.criado_ate_abril_2026,
				ativo_em_abril_2026 = EXCLUDED.ativo_em_abril_2026,
				situacao_em_abril = EXCLUDED.situacao_em_abril,
				criado_ate_maio_2026 = EXCLUDED.criado_ate_maio_2026,
				ativo_em_maio_2026 = EXCLUDED.ativo_em_maio_2026,
				situacao_em_maio = EXCLUDED.situacao_em_maio,
				criado_ate_junho_2026 = EXCLUDED.criado_ate_junho_2026,
				ativo_em_junho_2026 = EXCLUDED.ativo_em_junho_2026,
				situacao_em_junho = EXCLUDED.situacao_em_junho,
				criado_ate_julho_2026 = EXCLUDED.criado_ate_julho_2026,
				ativo_em_julho_2026 = EXCLUDED.ativo_em_julho_2026,
				situacao_em_julho = EXCLUDED.situacao_em_julho,
				criado_ate_agosto_2026 = EXCLUDED.criado_ate_agosto_2026,
				ativo_em_agosto_2026 = EXCLUDED.ativo_em_agosto_2026,
				situacao_em_agosto = EXCLUDED.situacao_em_agosto,
				criado_ate_setembro_2026 = EXCLUDED.criado_ate_setembro_2026,
				ativo_em_setembro_2026 = EXCLUDED.ativo_em_setembro_2026,
				situacao_em_setembro = EXCLUDED.situacao_em_setembro,
				criado_ate_outubro_2026 = EXCLUDED.criado_ate_outubro_2026,
				ativo_em_outubro_2026 = EXCLUDED.ativo_em_outubro_2026,
				situacao_em_outubro = EXCLUDED.situacao_em_outubro,
				sincronizado_em = CURRENT_TIMESTAMP
		`, a.ID, cliCode, cliNome, a.Contrato,
			a.NAS, a.Porta, a.Usuario, a.MAC, a.Observacao, ehCentral,
			dtAss, dtIni, sitCod, sitDesc, dtUltOp, criadoAteJan,
			ativoEmJan, origemUpgrade, contratoAnterior, situacaoEmJan,
			grupoCliente, ehGrupoExcluido,
			criadoAteFev, ativoEmFev, situacaoEmFev,
			criadoAteMar, ativoEmMar, situacaoEmMar,
			criadoAteAbr, ativoEmAbr, situacaoEmAbr,
			criadoAteMai, ativoEmMai, situacaoEmMai,
			criadoAteJun, ativoEmJun, situacaoEmJun,
			criadoAteJul, ativoEmJul, situacaoEmJul,
			criadoAteAgo, ativoEmAgo, situacaoEmAgo,
			criadoAteSet, ativoEmSet, situacaoEmSet,
			criadoAteOut, ativoEmOut, situacaoEmOut)
	}

	br := dbPool.SendBatch(ctx, batch)
	for i := 0; i < len(auths); i++ {
		if _, err := br.Exec(); err != nil {
			log.Printf("[RBX AUTENTICACOES] Erro ao gravar lote item %d: %v", i, err)
			break
		}
	}
	br.Close()

	log.Printf("[RBX AUTENTICACOES] Sincronização concluída com sucesso: %d autenticações (%d PPPoE, %d até Jan, %d até Fev, %d até Mar, %d até Abr, %d até Mai, %d até Jun, %d até Jul, %d até Ago, %d até Set, %d até Out, %d grupos excluídos).",
		totalAuths, totalPPPoE, totalPPPoEJan, totalPPPoEFev, totalPPPoEMar, totalPPPoEAbr, totalPPPoEMai, totalPPPoEJun, totalPPPoEJul, totalPPPoEAgo, totalPPPoESet, totalPPPoEOut, totalExcluidosGrupo)

	return map[string]interface{}{
		"totalAutenticacoes": totalAuths,
		"centralAssinante":   totalCentral,
		"gruposExcluidos":    totalExcluidosGrupo,
		"pppoeTotal":         totalPPPoE,
		"pppoeAteJan2026":    totalPPPoEJan,
		"pppoeAteFev2026":    totalPPPoEFev,
		"pppoeAteMar2026":    totalPPPoEMar,
		"pppoeAteAbr2026":    totalPPPoEAbr,
		"pppoeAteMai2026":    totalPPPoEMai,
		"pppoeAteJun2026":    totalPPPoEJun,
		"pppoeAteJul2026":    totalPPPoEJul,
		"pppoeAteAgo2026":    totalPPPoEAgo,
		"pppoeAteSet2026":    totalPPPoESet,
		"pppoeAteOut2026":    totalPPPoEOut,
		"conexoesGrafanaJan": totalConexoesGrafanaJan,
		"conexoesGrafanaFev": totalConexoesGrafanaFev,
		"conexoesGrafanaMar": totalConexoesGrafanaMar,
		"conexoesGrafanaAbr": totalConexoesGrafanaAbr,
		"conexoesGrafanaMai": totalConexoesGrafanaMai,
		"conexoesGrafanaJun": totalConexoesGrafanaJun,
		"conexoesGrafanaJul": totalConexoesGrafanaJul,
		"conexoesGrafanaAgo": totalConexoesGrafanaAgo,
		"conexoesGrafanaSet": totalConexoesGrafanaSet,
		"conexoesGrafanaOut": totalConexoesGrafanaOut,
		"upgradesJan":        totalUpgradesJan,
		"upgradesFev":        totalUpgradesFev,
		"upgradesMar":        totalUpgradesMar,
		"upgradesAbr":        totalUpgradesAbr,
		"upgradesMai":        totalUpgradesMai,
		"upgradesJun":        totalUpgradesJun,
		"upgradesJul":        totalUpgradesJul,
		"upgradesAgo":        totalUpgradesAgo,
		"upgradesSet":        totalUpgradesSet,
		"upgradesOut":        totalUpgradesOut,
		"statusCounts":       statusCounts,
		"sincronizadoEm":     time.Now().Format(time.RFC3339),
	}, nil
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

		forceAll := r.URL.Query().Get("all") == "true"
		updatedClients, updatedEvents := enrichMissingBairros(ctx, client, forceAll)

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":        true,
			"updatedClients": updatedClients,
			"updatedEvents":  updatedEvents,
			"message":        fmt.Sprintf("Sincronização de Bairros/Vilas concluída com sucesso! %d clientes e %d eventos atualizados.", updatedClients, updatedEvents),
		})
	})

	r.Get("/api/equipamentos/retiradas", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if dbPool == nil {
			http.Error(w, `{"error": "Banco de dados não disponível"}`, http.StatusInternalServerError)
			return
		}

		ctx := r.Context()
		month := strings.TrimSpace(r.URL.Query().Get("month"))
		if month == "" {
			month = "2026-01"
		}

		// Se a tabela estiver vazia, sincroniza automaticamente do RBX na primeira consulta
		var totalTable int
		_ = dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM atendimentos_equipamentos").Scan(&totalTable)
		if totalTable == 0 {
			var rbxURL, rbxToken, rbxVersion string
			err := dbPool.QueryRow(ctx, "SELECT rbx_url, rbx_token, rbx_version FROM configuracoes_rbx WHERE id = 1").Scan(&rbxURL, &rbxToken, &rbxVersion)
			if err == nil && strings.TrimSpace(rbxToken) != "" {
				client := rbx.NewClient(rbx.Config{URL: rbxURL, Token: rbxToken, Version: rbxVersion})
				_, _ = syncAtendimentosEquipamentos(ctx, client)
			}
		}

		// Meses disponíveis na base (estritamente baseados nas planilhas importadas de competência)
		var availMonths []string
		mRows, err := dbPool.Query(ctx, `
			SELECT DISTINCT mes_competencia 
			FROM eventos_bloqueio 
			WHERE mes_competencia IS NOT NULL AND mes_competencia != ''
			ORDER BY mes_competencia DESC
		`)
		if err == nil {
			defer mRows.Close()
			for mRows.Next() {
				var m string
				if err := mRows.Scan(&m); err == nil && m != "" {
					availMonths = append(availMonths, m)
				}
			}
		}

		// Filtro Estrito: Apenas clientes que constavam na planilha Excel importada daquele mês ($1)
		// + Cruzamento com OSs de retirada abertas no RBX
		// + Identificação de pontos cegos (churn sem OS aberta no RBX)
		// + Deduplicação cadastral transparente
		equipQuery := `
			WITH excel_clients AS (
				SELECT DISTINCT 
					eb.codigo_rbx,
					REPLACE(REPLACE(eb.codigo_rbx, '.', ''), ',', '') as codigo_clean,
					eb.contrato,
					eb.plano,
					eb.bairro,
					eb.data_bloqueio,
					eb.status_desfecho,
					eb.motivo_cancelamento
				FROM eventos_bloqueio eb
				WHERE eb.mes_competencia = $1
				  AND (eb.eh_mimo IS FALSE OR eb.eh_mimo IS NULL)
			),
			raw_atends AS (
				SELECT 
					a.id, 
					COALESCE(a.protocolo, '') as protocolo, 
					ec.codigo_rbx as codigo_cliente, 
					COALESCE(c.nome, 'Cliente ' || ec.codigo_rbx) as nome_cliente,
					CASE 
						WHEN LOWER(COALESCE(c.distrito, '')) LIKE '%boa%'
						  OR LOWER(COALESCE(c.cidade, '')) LIKE '%boa vista%'
						  OR (
						      LOWER(COALESCE(c.cidade, '')) LIKE '%quatipuru%'
						      AND LOWER(COALESCE(NULLIF(c.bairro, ''), ec.bairro, '')) IN (
						          'jabuti', 'patchouli', 'patichoulin', 'castelo', 'novo humirinzal', 
						          'humirinzal', 'embauba', 'embaúba', 'abrejado', 'salgadinho', 
						          'sapolandia', 'sapolândia', 'guarazao', 'guarazão', 'arapiranga', 'santo antonio', 'santo antônio',
						          'canto do sabia', 'canto do sabiá', 'boa vista'
						      )
						  )
						THEN 'Boa Vista'
						ELSE COALESCE(NULLIF(INITCAP(TRIM(c.cidade)), ''), 'Não Informado')
					END as cidade,
					COALESCE(NULLIF(TRIM(COALESCE(NULLIF(c.bairro, ''), ec.bairro)), ''), 'Não Informado') as bairro,
					COALESCE(c.contrato, ec.contrato, a.contrato, '') as contrato,
					COALESCE(c.plano, ec.plano, '') as plano,
					a.data_abertura, 
					a.data_encerramento, 
					$1 as mes_competencia,
					COALESCE(a.situacao_os, '') as situacao_os, 
					COALESCE(a.topico, '') as topico, 
					COALESCE(a.assunto, '') as assunto, 
					COALESCE(a.solucao, '') as solucao, 
					COALESCE(a.causa, '') as causa,
					COALESCE(a.usuario_abertura, '') as usuario_abertura, 
					a.status_recuperacao, 
					COALESCE(a.equipamento_identificado, '') as equipamento_identificado, 
					COALESCE(a.serial_mac, '') as serial_mac,
					ec.status_desfecho,
					ROW_NUMBER() OVER (
						PARTITION BY a.id, ec.codigo_clean 
						ORDER BY CASE WHEN NULLIF(TRIM(c.bairro), '') IS NOT NULL AND c.bairro != 'Não Informado' THEN 0 ELSE 1 END, 
						         c.criado_em DESC
					) as dup_rank
				FROM atendimentos_equipamentos a
				JOIN excel_clients ec ON REPLACE(REPLACE(a.codigo_cliente, '.', ''), ',', '') = ec.codigo_clean
				LEFT JOIN clientes c ON REPLACE(REPLACE(c.codigo_rbx, '.', ''), ',', '') = ec.codigo_clean
				WHERE (a.mes_competencia = $1 OR a.data_abertura >= ec.data_bloqueio - interval '30 days')
			),
			atends AS (
				SELECT 
					id, protocolo, codigo_cliente, nome_cliente, cidade, bairro, contrato, plano,
					data_abertura, data_encerramento, mes_competencia, situacao_os, topico,
					assunto, solucao, causa, usuario_abertura, status_recuperacao,
					equipamento_identificado, serial_mac, status_desfecho,
					(dup_rank > 1) as eh_duplicado
				FROM raw_atends
			),
			raw_sem_os AS (
				SELECT DISTINCT ON (ec.codigo_clean)
					'SEM-OS-' || ec.codigo_rbx as id,
					'S/N' as protocolo,
					ec.codigo_rbx as codigo_cliente,
					COALESCE(c.nome, 'Cliente ' || ec.codigo_rbx) as nome_cliente,
					CASE 
						WHEN LOWER(COALESCE(c.distrito, '')) LIKE '%boa%'
						  OR LOWER(COALESCE(c.cidade, '')) LIKE '%boa vista%'
						  OR (
						      LOWER(COALESCE(c.cidade, '')) LIKE '%quatipuru%'
						      AND LOWER(COALESCE(NULLIF(c.bairro, ''), ec.bairro, '')) IN (
						          'jabuti', 'patchouli', 'patichoulin', 'castelo', 'novo humirinzal', 
						          'humirinzal', 'embauba', 'embaúba', 'abrejado', 'salgadinho', 
						          'sapolandia', 'sapolândia', 'guarazao', 'guarazão', 'arapiranga', 'santo antonio', 'santo antônio',
						          'canto do sabia', 'canto do sabiá', 'boa vista'
						      )
						  )
						THEN 'Boa Vista'
						ELSE COALESCE(NULLIF(INITCAP(TRIM(c.cidade)), ''), 'Não Informado')
					END as cidade,
					COALESCE(NULLIF(TRIM(COALESCE(NULLIF(ec.bairro, ''), c.bairro)), ''), 'Não Informado') as bairro,
					COALESCE(ec.contrato, c.contrato, '') as contrato,
					COALESCE(ec.plano, c.plano, '') as plano,
					ec.data_bloqueio as data_abertura,
					NULL::timestamp with time zone as data_encerramento,
					$1 as mes_competencia,
					'SEM OS' as situacao_os,
					'SEM ORDEM DE SERVIÇO' as topico,
					CASE 
						WHEN ec.status_desfecho = 'churned' THEN 'Cliente cancelado (' || COALESCE(ec.motivo_cancelamento, 'Inadimplência') || ') sem abertura de OS de retirada no RBX.'
						ELSE 'Cliente ainda suspenso por inadimplência sem abertura de OS de recolhimento no RBX.'
					END as assunto,
					'' as solucao,
					CASE 
						WHEN ec.status_desfecho = 'churned' THEN COALESCE(ec.motivo_cancelamento, 'Cancelamento sem chamado de recolhimento')
						ELSE 'Suspensão prolongada sem chamado de recolhimento'
					END as causa,
					'Auditoria Ponto Cego' as usuario_abertura,
					'sem_os' as status_recuperacao,
					'Equipamento em posse do cliente (Em Risco)' as equipamento_identificado,
					'-' as serial_mac,
					ec.status_desfecho,
					false as eh_duplicado
				FROM excel_clients ec
				LEFT JOIN clientes c ON REPLACE(REPLACE(c.codigo_rbx, '.', ''), ',', '') = ec.codigo_clean
				WHERE ec.status_desfecho IN ('churned', 'suspended')
				  AND NOT EXISTS (
					  SELECT 1 FROM atendimentos_equipamentos ae
					  WHERE REPLACE(REPLACE(ae.codigo_cliente, '.', ''), ',', '') = ec.codigo_clean
					    AND (ae.mes_competencia = $1 OR ae.data_abertura >= ec.data_bloqueio - interval '30 days')
				  )
				ORDER BY ec.codigo_clean, 
				         CASE WHEN NULLIF(TRIM(c.bairro), '') IS NOT NULL AND c.bairro != 'Não Informado' THEN 0 ELSE 1 END,
				         c.criado_em DESC NULLS LAST
			),
			sem_os AS (
				SELECT 
					id, protocolo, codigo_cliente, nome_cliente, cidade, bairro, contrato, plano,
					data_abertura, data_encerramento, mes_competencia, situacao_os, topico,
					assunto, solucao, causa, usuario_abertura, status_recuperacao,
					equipamento_identificado, serial_mac, status_desfecho,
					eh_duplicado
				FROM raw_sem_os
			)
			SELECT 
				u.*,
				COALESCE(aem.status_manual, '') as status_manual,
				COALESCE(aem.observacao, '') as observacao_manual,
				COALESCE(aem.atualizado_por, '') as atualizado_por,
				aem.atualizado_em
			FROM (
				SELECT * FROM atends
				UNION ALL
				SELECT * FROM sem_os
			) u
			LEFT JOIN (
				SELECT DISTINCT ON (COALESCE(NULLIF(registro_id, ''), codigo_cliente))
					registro_id, 
					REPLACE(REPLACE(codigo_cliente, '.', ''), ',', '') as codigo_clean,
					status_manual, observacao, atualizado_por, atualizado_em
				FROM auditoria_equipamentos_manual
				ORDER BY COALESCE(NULLIF(registro_id, ''), codigo_cliente), atualizado_em DESC
			) aem ON (
				aem.registro_id = u.id 
				OR aem.registro_id = 'SEM-OS-' || u.codigo_cliente
				OR (u.status_recuperacao = 'sem_os' AND aem.codigo_clean = REPLACE(REPLACE(u.codigo_cliente, '.', ''), ',', ''))
			)
			ORDER BY 
				CASE WHEN status_recuperacao = 'sem_os' AND (aem.status_manual IS NULL OR aem.status_manual = '') THEN 1 ELSE 0 END,
				eh_duplicado ASC,
				data_encerramento DESC NULLS LAST, 
				data_abertura DESC
		`
		rows, err := dbPool.Query(ctx, equipQuery, month)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao consultar atendimentos de equipamentos: %v"}`, err), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var orders []EquipamentoItem
		var summary EquipamentoSummary
		cityMap := make(map[string]*EquipamentoCityStats)

		for rows.Next() {
			var item EquipamentoItem
			err := rows.Scan(
				&item.ID, &item.Protocolo, &item.CodigoCliente,
				&item.NomeCliente, &item.Cidade, &item.Bairro,
				&item.Contrato, &item.Plano,
				&item.DataAbertura, &item.DataEncerramento, &item.MesCompetencia,
				&item.SituacaoOS, &item.Topico, &item.Assunto, &item.Solucao, &item.Causa,
				&item.UsuarioAbertura, &item.StatusRecuperacao, &item.EquipamentoIdentificado, &item.SerialMac,
				&item.StatusDesfecho, &item.EhDuplicado,
				&item.StatusManual, &item.ObservacaoManual, &item.AtualizadoPor, &item.AtualizadoEm,
			)
			if err != nil {
				continue
			}

			// Consolidação do Status Final (Manual do usuário tem soberania sobre detecção automática RBX)
			if item.StatusManual != "" {
				item.StatusFinal = item.StatusManual
			} else {
				switch item.StatusRecuperacao {
				case "recuperado":
					item.StatusFinal = "recuperado"
				case "cancelamento_abortado":
					item.StatusFinal = "ativo_cobranca"
				case "sem_os":
					item.StatusFinal = "sem_os"
				case "em_andamento", "pendente":
					item.StatusFinal = "tentando"
				default:
					item.StatusFinal = item.StatusRecuperacao
				}
			}

			if item.EhDuplicado {
				summary.TotalDuplicados++
			} else {
				summary.TotalOrders++
				if item.StatusDesfecho == "churned" || item.StatusDesfecho == "suspended" {
					summary.TotalNaoRetornados++
				} else if item.StatusDesfecho == "returned" {
					summary.TotalRetornadosComOS++
				}
				switch item.StatusFinal {
				case "recuperado":
					summary.Recuperados++
				case "tentando":
					summary.Tentando++
					summary.Pendentes++
				case "perdido":
					summary.Perdidos++
				case "ativo_cobranca":
					summary.AtivoCobranca++
					summary.CancelamentoAbortado++
				case "sem_os":
					summary.SemOS++
				}

				cidade := item.Cidade
				if cidade == "" {
					cidade = "Não Informado"
				}
				if _, ok := cityMap[cidade]; !ok {
					cityMap[cidade] = &EquipamentoCityStats{Cidade: cidade}
				}
				cityMap[cidade].Total++
				if item.StatusFinal == "recuperado" {
					cityMap[cidade].Recuperados++
				} else if item.StatusFinal == "tentando" {
					cityMap[cidade].Pendentes++
				} else if item.StatusFinal == "sem_os" {
					cityMap[cidade].SemOS++
				}
			}

			orders = append(orders, item)
		}

		if summary.TotalOrders > 0 {
			summary.TaxaRecuperacao = math.Round((float64(summary.Recuperados)/float64(summary.TotalOrders))*1000) / 10
		}
		if (summary.Recuperados + summary.Tentando + summary.Perdidos) > 0 {
			summary.TaxaEfetividadeOS = math.Round((float64(summary.Recuperados)/float64(summary.Recuperados+summary.Tentando+summary.Perdidos))*1000) / 10
		}

		var byCity []EquipamentoCityStats
		for _, cs := range cityMap {
			if cs.Total > 0 {
				cs.TaxaRecuperacao = math.Round((float64(cs.Recuperados)/float64(cs.Total))*1000) / 10
			}
			byCity = append(byCity, *cs)
		}
		sort.Slice(byCity, func(i, j int) bool {
			return byCity[i].Total > byCity[j].Total
		})

		json.NewEncoder(w).Encode(EquipamentoResponse{
			Summary:         summary,
			Orders:          orders,
			ByCity:          byCity,
			AvailableMonths: availMonths,
			SelectedMonth:   month,
		})
	})

	r.Get("/api/equipamentos/annual", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if dbPool == nil {
			http.Error(w, `{"error": "Banco de dados não disponível"}`, http.StatusInternalServerError)
			return
		}

		ctx := r.Context()
		year := strings.TrimSpace(r.URL.Query().Get("year"))
		if year == "" {
			year = "2026"
		}

		// Anos disponíveis na base
		var availYears []string
		yRows, err := dbPool.Query(ctx, `
			SELECT DISTINCT SUBSTRING(mes_competencia FROM 1 FOR 4) as ano
			FROM eventos_bloqueio
			WHERE mes_competencia IS NOT NULL AND mes_competencia != ''
			ORDER BY ano DESC
		`)
		if err == nil {
			defer yRows.Close()
			for yRows.Next() {
				var y string
				if err := yRows.Scan(&y); err == nil && y != "" {
					availYears = append(availYears, y)
				}
			}
		}
		if len(availYears) == 0 {
			availYears = []string{year}
		}

		filterYear := year + "-%"

		annualQuery := `
			WITH excel_clients AS (
				SELECT DISTINCT 
					eb.codigo_rbx,
					REPLACE(REPLACE(eb.codigo_rbx, '.', ''), ',', '') as codigo_clean,
					eb.mes_competencia,
					eb.contrato,
					eb.plano,
					eb.bairro,
					eb.data_bloqueio,
					eb.status_desfecho,
					eb.motivo_cancelamento
				FROM eventos_bloqueio eb
				WHERE eb.mes_competencia LIKE $1
				  AND (eb.eh_mimo IS FALSE OR eb.eh_mimo IS NULL)
			),
			raw_atends AS (
				SELECT 
					a.id, 
					ec.codigo_clean,
					ec.mes_competencia,
					a.status_recuperacao,
					ec.status_desfecho,
					CASE 
						WHEN LOWER(COALESCE(c.distrito, '')) LIKE '%boa%'
						  OR LOWER(COALESCE(c.cidade, '')) LIKE '%boa vista%'
						  OR (
						      LOWER(COALESCE(c.cidade, '')) LIKE '%quatipuru%'
						      AND LOWER(COALESCE(NULLIF(c.bairro, ''), ec.bairro, '')) IN (
						          'jabuti', 'patchouli', 'patichoulin', 'castelo', 'novo humirinzal', 
						          'humirinzal', 'embauba', 'embaúba', 'abrejado', 'salgadinho', 
						          'sapolandia', 'sapolândia', 'guarazao', 'guarazão', 'arapiranga', 'santo antonio', 'santo antônio',
						          'canto do sabia', 'canto do sabiá', 'boa vista'
						      )
						  )
						THEN 'Boa Vista'
						ELSE COALESCE(NULLIF(INITCAP(TRIM(c.cidade)), ''), 'Não Informado')
					END as cidade,
					ROW_NUMBER() OVER (
						PARTITION BY a.id, ec.codigo_clean, ec.mes_competencia
						ORDER BY c.criado_em DESC
					) as dup_rank
				FROM atendimentos_equipamentos a
				JOIN excel_clients ec ON REPLACE(REPLACE(a.codigo_cliente, '.', ''), ',', '') = ec.codigo_clean
				LEFT JOIN clientes c ON REPLACE(REPLACE(c.codigo_rbx, '.', ''), ',', '') = ec.codigo_clean
				WHERE (a.mes_competencia = ec.mes_competencia OR a.data_abertura >= ec.data_bloqueio - interval '30 days')
			),
			atends AS (
				SELECT id, codigo_clean, mes_competencia, status_recuperacao, status_desfecho, cidade
				FROM raw_atends
				WHERE dup_rank = 1
			),
			raw_sem_os AS (
				SELECT DISTINCT ON (ec.codigo_clean, ec.mes_competencia)
					'SEM-OS-' || ec.codigo_rbx as id,
					ec.codigo_clean,
					ec.mes_competencia,
					'sem_os' as status_recuperacao,
					ec.status_desfecho,
					CASE 
						WHEN LOWER(COALESCE(c.distrito, '')) LIKE '%boa%'
						  OR LOWER(COALESCE(c.cidade, '')) LIKE '%boa vista%'
						  OR (
						      LOWER(COALESCE(c.cidade, '')) LIKE '%quatipuru%'
						      AND LOWER(COALESCE(NULLIF(c.bairro, ''), ec.bairro, '')) IN (
						          'jabuti', 'patchouli', 'patichoulin', 'castelo', 'novo humirinzal', 
						          'humirinzal', 'embauba', 'embaúba', 'abrejado', 'salgadinho', 
						          'sapolandia', 'sapolândia', 'guarazao', 'guarazão', 'arapiranga', 'santo antonio', 'santo antônio',
						          'canto do sabia', 'canto do sabiá', 'boa vista'
						      )
						  )
						THEN 'Boa Vista'
						ELSE COALESCE(NULLIF(INITCAP(TRIM(c.cidade)), ''), 'Não Informado')
					END as cidade
				FROM excel_clients ec
				LEFT JOIN clientes c ON REPLACE(REPLACE(c.codigo_rbx, '.', ''), ',', '') = ec.codigo_clean
				WHERE ec.status_desfecho IN ('churned', 'suspended')
				  AND NOT EXISTS (
					  SELECT 1 FROM atendimentos_equipamentos ae
					  WHERE REPLACE(REPLACE(ae.codigo_cliente, '.', ''), ',', '') = ec.codigo_clean
					    AND (ae.mes_competencia = ec.mes_competencia OR ae.data_abertura >= ec.data_bloqueio - interval '30 days')
				  )
			),
			all_items AS (
				SELECT 
					u.id, u.mes_competencia, u.cidade, u.status_desfecho,
					CASE 
						WHEN aem.status_manual IS NOT NULL AND aem.status_manual != '' THEN aem.status_manual
						WHEN u.status_recuperacao = 'cancelamento_abortado' THEN 'ativo_cobranca'
						WHEN u.status_recuperacao IN ('em_andamento', 'pendente') THEN 'tentando'
						ELSE u.status_recuperacao
					END as status_final
				FROM (
					SELECT id, codigo_clean, mes_competencia, status_recuperacao, status_desfecho, cidade FROM atends
					UNION ALL
					SELECT id, codigo_clean, mes_competencia, status_recuperacao, status_desfecho, cidade FROM raw_sem_os
				) u
				LEFT JOIN (
					SELECT DISTINCT ON (COALESCE(NULLIF(registro_id, ''), codigo_cliente))
						registro_id, 
						REPLACE(REPLACE(codigo_cliente, '.', ''), ',', '') as codigo_clean,
						status_manual, observacao, atualizado_por, atualizado_em
					FROM auditoria_equipamentos_manual
					ORDER BY COALESCE(NULLIF(registro_id, ''), codigo_cliente), atualizado_em DESC
				) aem ON (
					aem.registro_id = u.id 
					OR aem.registro_id = 'SEM-OS-' || u.codigo_clean
					OR (u.status_recuperacao = 'sem_os' AND aem.codigo_clean = u.codigo_clean)
				)
			)
			SELECT mes_competencia, cidade, status_desfecho, status_final
			FROM all_items
		`

		rows, err := dbPool.Query(ctx, annualQuery, filterYear)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao consultar anual de equipamentos: %v"}`, err), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var summary EquipamentoAnnualSummary
		monthMap := make(map[string]*EquipamentoAnnualMonthStats)
		cityMap := make(map[string]*EquipamentoAnnualCityStats)

		for rows.Next() {
			var mesComp, cidade, statusDesfecho, statusFinal string
			if err := rows.Scan(&mesComp, &cidade, &statusDesfecho, &statusFinal); err != nil {
				continue
			}

			summary.TotalOrders++
			switch statusFinal {
			case "recuperado":
				summary.Recuperados++
			case "tentando":
				summary.Tentando++
			case "sem_os":
				summary.SemOS++
			case "perdido":
				summary.Perdidos++
			case "ativo_cobranca":
				summary.AtivoCobranca++
			}

			if _, ok := monthMap[mesComp]; !ok {
				monthMap[mesComp] = &EquipamentoAnnualMonthStats{
					MonthKey:   mesComp,
					MonthLabel: getMonthLabel(mesComp),
				}
			}
			mStat := monthMap[mesComp]
			mStat.Total++
			switch statusFinal {
			case "recuperado":
				mStat.Recuperados++
			case "tentando":
				mStat.Tentando++
			case "sem_os":
				mStat.SemOS++
			case "perdido":
				mStat.Perdidos++
			case "ativo_cobranca":
				mStat.AtivoCobranca++
			}

			if cidade == "" {
				cidade = "Não Informado"
			}
			if _, ok := cityMap[cidade]; !ok {
				cityMap[cidade] = &EquipamentoAnnualCityStats{
					Cidade: cidade,
				}
			}
			cStat := cityMap[cidade]
			cStat.Total++
			switch statusFinal {
			case "recuperado":
				cStat.Recuperados++
			case "tentando":
				cStat.Tentando++
			case "sem_os":
				cStat.SemOS++
			case "perdido":
				cStat.Perdidos++
			}
		}

		if summary.TotalOrders > 0 {
			summary.TaxaRecuperacao = math.Round((float64(summary.Recuperados)/float64(summary.TotalOrders))*1000) / 10
		}
		if (summary.Recuperados + summary.Tentando + summary.Perdidos) > 0 {
			summary.TaxaEfetividadeOS = math.Round((float64(summary.Recuperados)/float64(summary.Recuperados+summary.Tentando+summary.Perdidos))*1000) / 10
		}

		var byMonth []EquipamentoAnnualMonthStats
		for _, m := range monthMap {
			if m.Total > 0 {
				m.TaxaRecuperacao = math.Round((float64(m.Recuperados)/float64(m.Total))*1000) / 10
			}
			byMonth = append(byMonth, *m)
		}
		sort.Slice(byMonth, func(i, j int) bool {
			return byMonth[i].MonthKey < byMonth[j].MonthKey
		})

		var byCity []EquipamentoAnnualCityStats
		for _, c := range cityMap {
			if c.Total > 0 {
				c.TaxaRecuperacao = math.Round((float64(c.Recuperados)/float64(c.Total))*1000) / 10
			}
			byCity = append(byCity, *c)
		}
		sort.Slice(byCity, func(i, j int) bool {
			return byCity[i].Total > byCity[j].Total
		})

		var byCause []EquipamentoAnnualCauseStats
		cRows, err := dbPool.Query(ctx, `
			SELECT 
				COALESCE(NULLIF(solucao, ''), NULLIF(causa, ''), NULLIF(topico, ''), 'Sem Detalhe') as motivo,
				COUNT(*) as total
			FROM atendimentos_equipamentos
			WHERE mes_competencia LIKE $1
			GROUP BY 1
			ORDER BY total DESC
			LIMIT 8
		`, filterYear)
		if err == nil {
			defer cRows.Close()
			for cRows.Next() {
				var cs EquipamentoAnnualCauseStats
				if err := cRows.Scan(&cs.Motivo, &cs.Total); err == nil && cs.Motivo != "" {
					byCause = append(byCause, cs)
				}
			}
		}

		if byMonth == nil {
			byMonth = []EquipamentoAnnualMonthStats{}
		}
		if byCity == nil {
			byCity = []EquipamentoAnnualCityStats{}
		}
		if byCause == nil {
			byCause = []EquipamentoAnnualCauseStats{}
		}

		json.NewEncoder(w).Encode(EquipamentoAnnualResponse{
			Year:           year,
			Summary:        summary,
			ByMonth:        byMonth,
			ByCity:         byCity,
			ByCause:        byCause,
			AvailableYears: availYears,
		})
	})

	type ClassificarEquipamentoRequest struct {
		RegistroID    string `json:"registroId"`
		CodigoCliente string `json:"codigoCliente"`
		StatusManual  string `json:"statusManual"` // 'recuperado', 'tentando', 'perdido', 'ativo_cobranca', ''
		Observacao    string `json:"observacao"`
		AtualizadoPor string `json:"atualizadoPor"`
	}

	r.Post("/api/equipamentos/classificar", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if dbPool == nil {
			http.Error(w, `{"error": "Banco de dados não disponível"}`, http.StatusInternalServerError)
			return
		}

		var req ClassificarEquipamentoRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error": "JSON inválido"}`, http.StatusBadRequest)
			return
		}

		req.RegistroID = strings.TrimSpace(req.RegistroID)
		if req.RegistroID == "" {
			http.Error(w, `{"error": "registroId é obrigatório"}`, http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		if req.AtualizadoPor == "" {
			req.AtualizadoPor = "Operador"
		}

		if req.StatusManual == "" && strings.TrimSpace(req.Observacao) == "" {
			_, err := dbPool.Exec(ctx, "DELETE FROM auditoria_equipamentos_manual WHERE registro_id = $1", req.RegistroID)
			if err != nil {
				http.Error(w, fmt.Sprintf(`{"error": "Erro ao resetar classificação: %v"}`, err), http.StatusInternalServerError)
				return
			}
		} else {
			query := `
				INSERT INTO auditoria_equipamentos_manual (registro_id, codigo_cliente, status_manual, observacao, atualizado_por, atualizado_em)
				VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
				ON CONFLICT (registro_id) 
				DO UPDATE SET 
					status_manual = EXCLUDED.status_manual,
					observacao = EXCLUDED.observacao,
					atualizado_por = EXCLUDED.atualizado_por,
					atualizado_em = CURRENT_TIMESTAMP
			`
			_, err := dbPool.Exec(ctx, query, req.RegistroID, req.CodigoCliente, req.StatusManual, req.Observacao, req.AtualizadoPor)
			if err != nil {
				http.Error(w, fmt.Sprintf(`{"error": "Erro ao salvar classificação: %v"}`, err), http.StatusInternalServerError)
				return
			}
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Classificação do equipamento salva com sucesso!",
		})
	})

	r.Post("/api/equipamentos/sync", func(w http.ResponseWriter, r *http.Request) {
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

		client := rbx.NewClient(rbx.Config{URL: rbxURL, Token: rbxToken, Version: rbxVersion})
		count, err := syncAtendimentosEquipamentos(ctx, client)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao sincronizar equipamentos do RBX: %v"}`, err), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": fmt.Sprintf("Sincronização de equipamentos concluída! %d atendimentos de retirada atualizados.", count),
			"count":   count,
		})
	})

	// =========================================================================
	// ROTAS DO MÓDULO MINHA EMPRESA (Inteligência Operacional RBX)
	// =========================================================================

	r.Post("/api/empresa/sync", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if dbPool == nil {
			http.Error(w, `{"error": "Banco de dados não disponível"}`, http.StatusInternalServerError)
			return
		}

		month := r.URL.Query().Get("month")
		if month == "" {
			month = "2026-01"
		}

		ctx := r.Context()
		var rbxURL, rbxToken, rbxVersion string
		err := dbPool.QueryRow(ctx, "SELECT rbx_url, rbx_token, rbx_version FROM configuracoes_rbx WHERE id = 1").Scan(&rbxURL, &rbxToken, &rbxVersion)
		if err != nil || strings.TrimSpace(rbxURL) == "" || strings.TrimSpace(rbxToken) == "" {
			http.Error(w, `{"error": "Integração RBX não configurada. Configure a URL e chave nas opções."}`, http.StatusBadRequest)
			return
		}

		client := rbx.NewClient(rbx.Config{URL: rbxURL, Token: rbxToken, Version: rbxVersion})
		result, err := syncRbxOperacionalEmpresa(ctx, client, month)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao sincronizar dados operacionais do RBX: %v"}`, err), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Sincronização operacional do RBX concluída e persistida com sucesso no banco!",
			"data":    result,
		})
	})

	r.Get("/api/empresa/indicadores", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if dbPool == nil {
			http.Error(w, `{"error": "Banco de dados não disponível"}`, http.StatusInternalServerError)
			return
		}

		month := r.URL.Query().Get("month")
		if month == "" {
			month = "2026-10"
		}

		ctx := r.Context()
		var totalInstalacoes, instalacoesSucesso, totalCancelamentos, totalBloqueados, totalSuspensos, totalInadimplentes int
		var atualizadoEm *time.Time

		err := dbPool.QueryRow(ctx, `
			SELECT total_instalacoes, instalacoes_sucesso, total_cancelamentos,
			       total_bloqueados, total_suspensos, total_inadimplentes, atualizado_em
			FROM rbx_metricas_mensais
			WHERE mes_competencia = $1
		`, month).Scan(&totalInstalacoes, &instalacoesSucesso, &totalCancelamentos,
			&totalBloqueados, &totalSuspensos, &totalInadimplentes, &atualizadoEm)

		// Se ainda não tiver registro consolidado na tabela de métricas, busca contagem dinâmica
		if err != nil {
			_ = dbPool.QueryRow(ctx, `
				SELECT COUNT(*) FROM rbx_atendimentos_instalacoes 
				WHERE mes_competencia = $1 AND to_char(data_abertura, 'YYYY-MM') = $1
				  AND solucao NOT ILIKE '%gerad%incorret%'
				  AND solucao NOT ILIKE '%gerad%errad%'
				  AND solucao NOT ILIKE '%aberto incorretamente%'
				  AND solucao NOT ILIKE '%aberta incorretamente%'
				  AND solucao NOT ILIKE '%abertura errada%'
				  AND solucao NOT ILIKE '%fluxo incorreto%'
				  AND solucao NOT ILIKE '%n%o era instala%'
				  AND solucao NOT ILIKE '%nao teve viabilida%'
				  AND solucao NOT ILIKE '%não teve viabilida%'
				  AND solucao NOT ILIKE '%sem viabilidade%'
				  AND solucao NOT ILIKE '%cto muito longe%'
				  AND solucao NOT ILIKE '%cto longe%'
				  AND solucao NOT ILIKE '%inviabilidade técnica%'
				  AND solucao NOT ILIKE '%inviabilidade tecnica%'
				  AND solucao NOT ILIKE '%não foi possível instalar%'
				  AND solucao NOT ILIKE '%nao foi possivel instalar%'
				  AND solucao NOT ILIKE '%não foi instalad%'
				  AND solucao NOT ILIKE '%nao foi instalad%'
				  AND solucao NOT ILIKE '%não instalad%'
				  AND solucao NOT ILIKE '%nao instalad%'
				  AND solucao NOT ILIKE '%pós venda%'
				  AND solucao NOT ILIKE '%pos venda%'
				  AND assunto NOT ILIKE '%verificar com o cliente se ele esta%satisfeito%'
			`, month).Scan(&totalInstalacoes)
			_ = dbPool.QueryRow(ctx, `
				SELECT COUNT(*) FROM rbx_atendimentos_instalacoes 
				WHERE mes_competencia = $1 AND to_char(data_abertura, 'YYYY-MM') = $1 AND instalado_com_sucesso = true
				  AND solucao NOT ILIKE '%gerad%incorret%'
				  AND solucao NOT ILIKE '%gerad%errad%'
				  AND solucao NOT ILIKE '%aberto incorretamente%'
				  AND solucao NOT ILIKE '%aberta incorretamente%'
				  AND solucao NOT ILIKE '%abertura errada%'
				  AND solucao NOT ILIKE '%fluxo incorreto%'
				  AND solucao NOT ILIKE '%n%o era instala%'
				  AND solucao NOT ILIKE '%nao teve viabilida%'
				  AND solucao NOT ILIKE '%não teve viabilida%'
				  AND solucao NOT ILIKE '%sem viabilidade%'
				  AND solucao NOT ILIKE '%cto muito longe%'
				  AND solucao NOT ILIKE '%cto longe%'
				  AND solucao NOT ILIKE '%inviabilidade técnica%'
				  AND solucao NOT ILIKE '%inviabilidade tecnica%'
				  AND solucao NOT ILIKE '%não foi possível instalar%'
				  AND solucao NOT ILIKE '%nao foi possivel instalar%'
				  AND solucao NOT ILIKE '%não foi instalad%'
				  AND solucao NOT ILIKE '%nao foi instalad%'
				  AND solucao NOT ILIKE '%não instalad%'
				  AND solucao NOT ILIKE '%nao instalad%'
				  AND solucao NOT ILIKE '%pós venda%'
				  AND solucao NOT ILIKE '%pos venda%'
				  AND assunto NOT ILIKE '%verificar com o cliente se ele esta%satisfeito%'
			`, month).Scan(&instalacoesSucesso)
			_ = dbPool.QueryRow(ctx, `
				SELECT COUNT(*) FROM rbx_contratos_cancelados 
				WHERE mes_competencia = $1
				  AND motivo_cancelamento NOT ILIKE '%MUD%TITULARIDADE%'
				  AND motivo_cancelamento NOT ILIKE '%AJUSTE T%CNICO%'
				  AND motivo_cancelamento NOT ILIKE '%CONTRATO TEMPOR%RIO%'
				  AND motivo_cancelamento NOT ILIKE '%PEDIDO INSTALA%O CANCELADO%'
				  AND motivo_cancelamento NOT ILIKE '%ERRO%GERA%O%CONTRATO%'
				  AND motivo_cancelamento NOT ILIKE '%CANCELAMENTO%MIGRA%'
				  AND motivo_cancelamento NOT ILIKE '%N%O PAGOU A TAXA%'
				  AND motivo_cancelamento NOT ILIKE '%NAO PAGOU A TAXA%'
				  AND motivo_cancelamento NOT ILIKE '%INVIA%'
				  AND NOT (
				  	plano ~* '(^|[^a-zA-Z0-9])TV([^a-zA-Z0-9]|$)'
				  	OR plano ILIKE '%+ TV%'
				  	OR plano ILIKE '%+TV%'
				  	OR plano ILIKE '%TELEVIS%'
				  	OR plano ILIKE '%IPTV%'
				  )
			`, month).Scan(&totalCancelamentos)
			_ = dbPool.QueryRow(ctx, `
				SELECT 
					COALESCE(COUNT(*) FILTER (WHERE (status_desfecho = 'blocked' OR status_rbx_codigo IN ('B', 'P')) AND status_rbx_codigo != 'S' AND status_desfecho != 'suspended'), 0),
					0
				FROM eventos_bloqueio
				WHERE mes_competencia = $1 AND NOT eh_mimo
			`, month).Scan(&totalBloqueados, &totalSuspensos)
			totalInadimplentes = totalBloqueados
		}

		var mrrSuspensos float64
		var pctSuspensos float64

		// Busca o número exato de "Ainda Suspensos" da coorte do mês em eventos_bloqueio (idêntico ao card de Clientes Recuperados)
		_ = dbPool.QueryRow(ctx, `
			SELECT 
				COALESCE(COUNT(CASE WHEN e.status_desfecho = 'suspended' THEN 1 END), 0),
				COALESCE(SUM(CASE WHEN e.status_desfecho = 'suspended' THEN COALESCE(NULLIF(e.valor_mensalidade, 0), c.valor_mensalidade, 0) ELSE 0 END), 0),
				CASE WHEN COUNT(e.id) > 0 
					THEN ROUND((COUNT(CASE WHEN e.status_desfecho = 'suspended' THEN 1 END)::numeric / COUNT(e.id)) * 100, 1)
					ELSE 0 
				END
			FROM eventos_bloqueio e
			JOIN clientes c ON c.codigo_rbx = e.codigo_rbx
			WHERE e.mes_competencia = $1 
			  AND NOT e.eh_mimo 
			  AND e.status_desfecho IN ('returned', 'churned', 'suspended', 'blocked')
			  AND (e.eh_debito_herdado IS FALSE OR e.eh_debito_herdado IS NULL)
		`, month).Scan(&totalSuspensos, &mrrSuspensos, &pctSuspensos)

		json.NewEncoder(w).Encode(map[string]interface{}{
			"mesCompetencia":      month,
			"totalInstalacoes":    totalInstalacoes,
			"instalacoesSucesso":  instalacoesSucesso,
			"totalCancelamentos":  totalCancelamentos,
			"totalBloqueados":     totalBloqueados,
			"totalSuspensos":      totalSuspensos,
			"percentualSuspensos": pctSuspensos,
			"mrrSuspensos":        math.Round(mrrSuspensos*100) / 100,
			"totalInadimplentes":  totalBloqueados,
			"atualizadoEm":        atualizadoEm,
		})
	})

	// GET /api/empresa/visao-anual: Dados e KPIs anuais exclusivamente do PostgreSQL (sem chamadas à API)
	r.Get("/api/empresa/visao-anual", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if dbPool == nil {
			http.Error(w, `{"error": "Banco de dados não disponível"}`, http.StatusInternalServerError)
			return
		}

		ctx := r.Context()
		year := r.URL.Query().Get("year")
		if year == "" {
			year = "2026"
		}

		now := time.Now()
		currentYearStr := now.Format("2006")
		maxMonth := now.Format("2006-01")
		if year < currentYearStr {
			maxMonth = year + "-12"
		} else if year > currentYearStr {
			maxMonth = year + "-12"
		}

		// 1. Consulta métricas mensais consolidadas com suspensos da coorte
		rows, err := dbPool.Query(ctx, `
			SELECT 
				m.mes_competencia,
				m.total_instalacoes,
				m.instalacoes_sucesso,
				m.total_cancelamentos,
				(m.instalacoes_sucesso - m.total_cancelamentos - COALESCE(s.total_suspensos, 0)) AS saldo_liquido,
				COALESCE(s.total_suspensos, 0) AS total_suspensos,
				COALESCE(c.mrr_cancelado, 0) AS mrr_cancelado,
				COALESCE(s.mrr_suspensos, 0) AS mrr_suspensos
			FROM rbx_metricas_mensais m
			LEFT JOIN (
				SELECT 
					e.mes_competencia,
					COUNT(CASE WHEN e.status_desfecho = 'suspended' THEN 1 END) AS total_suspensos,
					COALESCE(SUM(CASE WHEN e.status_desfecho = 'suspended' THEN COALESCE(NULLIF(e.valor_mensalidade, 0), cl.valor_mensalidade, 0) ELSE 0 END), 0) AS mrr_suspensos
				FROM eventos_bloqueio e
				JOIN clientes cl ON cl.codigo_rbx = e.codigo_rbx
				WHERE NOT e.eh_mimo 
				  AND e.status_desfecho IN ('returned', 'churned', 'suspended', 'blocked')
				  AND (e.eh_debito_herdado IS FALSE OR e.eh_debito_herdado IS NULL)
				GROUP BY e.mes_competencia
			) s ON s.mes_competencia = m.mes_competencia
			LEFT JOIN (
				SELECT mes_competencia, SUM(valor_mensalidade) AS mrr_cancelado
				FROM rbx_contratos_cancelados
				WHERE motivo_cancelamento NOT ILIKE '%MUD%TITULARIDADE%'
					AND motivo_cancelamento NOT ILIKE '%AJUSTE T%CNICO%'
					AND motivo_cancelamento NOT ILIKE '%CONTRATO TEMPOR%RIO%'
					AND motivo_cancelamento NOT ILIKE '%PEDIDO INSTALA%O CANCELADO%'
					AND motivo_cancelamento NOT ILIKE '%ERRO%GERA%O%CONTRATO%'
					AND motivo_cancelamento NOT ILIKE '%CANCELAMENTO%MIGRA%'
					AND motivo_cancelamento NOT ILIKE '%N%O PAGOU A TAXA%'
					AND motivo_cancelamento NOT ILIKE '%NAO PAGOU A TAXA%'
					AND motivo_cancelamento NOT ILIKE '%INVIA%'
					AND NOT (
						plano ~* '(^|[^a-zA-Z0-9])TV([^a-zA-Z0-9]|$)'
						OR plano ILIKE '%+ TV%'
						OR plano ILIKE '%+TV%'
						OR plano ILIKE '%TELEVIS%'
						OR plano ILIKE '%IPTV%'
					)
				GROUP BY mes_competencia
			) c ON c.mes_competencia = m.mes_competencia
			WHERE m.mes_competencia LIKE $1 || '-%' AND m.mes_competencia <= $2
			ORDER BY m.mes_competencia ASC
		`, year, maxMonth)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao consultar dados anuais: %v"}`, err), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		baseAtivaMesMap := map[string]int{
			"2026-01": 7849,
			"2026-02": 7937,
			"2026-03": 8010,
			"2026-04": 8158,
			"2026-05": 8274,
			"2026-06": 8367,
			"2026-07": 8425,
			"2026-08": 8395,
			"2026-09": 8337,
			"2026-10": 8252,
		}

		mesesLabels := map[string]string{
			"01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr", "05": "Mai", "06": "Jun",
			"07": "Jul", "08": "Ago", "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
		}

		type MesStat struct {
			Mes                string  `json:"mes"`
			MesLabel           string  `json:"mesLabel"`
			TotalInstalacoes   int     `json:"totalInstalacoes"`
			InstalacoesSucesso int     `json:"instalacoesSucesso"`
			TotalCancelamentos int     `json:"totalCancelamentos"`
			SaldoLiquido       int     `json:"saldoLiquido"`
			TotalSuspensos     int     `json:"totalSuspensos"`
			BaseAtiva          int     `json:"baseAtiva"`
			ChurnRate          float64 `json:"churnRate"`
			MrrCancelado       float64 `json:"mrrCancelado"`
			MrrSuspensos       float64 `json:"mrrSuspensos"`
		}

		var meses []MesStat
		var totalInstAnual, totalSucessoAnual, totalCancAnual, saldoLiqAnual int
		var totalMrrCanceladoAnual float64
		var totalSuspensosAnual int
		var totalMrrSuspensosAnual float64
		var sumChurnRate float64
		lastBase := 7849

		for rows.Next() {
			var mesComp string
			var totInst, instSuc, totCanc, saldoLiq, totSusp int
			var mrrCanc, mrrSusp float64
			if err := rows.Scan(&mesComp, &totInst, &instSuc, &totCanc, &saldoLiq, &totSusp, &mrrCanc, &mrrSusp); err != nil {
				continue
			}

			baseAtiva, exists := baseAtivaMesMap[mesComp]
			if !exists || baseAtiva == 0 {
				baseAtiva = lastBase + saldoLiq
			}
			lastBase = baseAtiva

			churnRate := 0.0
			if baseAtiva > 0 {
				churnRate = (float64(totCanc) / float64(baseAtiva)) * 100.0
			}

			parts := strings.Split(mesComp, "-")
			label := mesComp
			if len(parts) == 2 {
				if l, ok := mesesLabels[parts[1]]; ok {
					label = fmt.Sprintf("%s/%s", l, parts[0][2:])
				}
			}

			meses = append(meses, MesStat{
				Mes:                mesComp,
				MesLabel:           label,
				TotalInstalacoes:   totInst,
				InstalacoesSucesso: instSuc,
				TotalCancelamentos: totCanc,
				SaldoLiquido:       saldoLiq,
				TotalSuspensos:     totSusp,
				BaseAtiva:          baseAtiva,
				ChurnRate:          math.Round(churnRate*100) / 100,
				MrrCancelado:       math.Round(mrrCanc*100) / 100,
				MrrSuspensos:       math.Round(mrrSusp*100) / 100,
			})

			totalInstAnual += totInst
			totalSucessoAnual += instSuc
			totalCancAnual += totCanc
			saldoLiqAnual += saldoLiq
			totalSuspensosAnual += totSusp
			totalMrrSuspensosAnual += mrrSusp
			totalMrrCanceladoAnual += mrrCanc
			sumChurnRate += churnRate
		}

		qtdMeses := len(meses)
		if qtdMeses == 0 {
			qtdMeses = 1
		}
		mediaMensalInstalacoes := math.Round((float64(totalSucessoAnual)/float64(qtdMeses))*10) / 10
		mediaMensalCancelamentos := math.Round((float64(totalCancAnual)/float64(qtdMeses))*10) / 10
		churnMedioAnual := math.Round((sumChurnRate/float64(qtdMeses))*100) / 100
		taxaRetencaoAnual := math.Round((100.0-churnMedioAnual)*100) / 100

		baseAtual := 8252
		clientesUnicosAtuais := 7850
		if len(meses) > 0 {
			last := meses[len(meses)-1]
			baseAtual = last.BaseAtiva
		}
		totalSuspensosAtual := totalSuspensosAnual // Soma geral de todas as coortes mensais de suspensos
		_ = dbPool.QueryRow(ctx, "SELECT COUNT(DISTINCT codigo_cliente) FROM rbx_autenticacoes WHERE NOT eh_central_assinante AND NOT eh_grupo_excluido AND ativo_em_outubro_2026").Scan(&clientesUnicosAtuais)

		// Top cidades em instalações
		type TopCidade struct {
			Cidade     string  `json:"cidade"`
			Total      int     `json:"total"`
			Percentual float64 `json:"percentual"`
		}
		var topCidades []TopCidade
		cityRows, errC := dbPool.Query(ctx, `
			SELECT COALESCE(NULLIF(cidade, ''), 'Não informada') as cid, count(*) as qty 
			FROM rbx_atendimentos_instalacoes 
			WHERE mes_competencia LIKE $1 || '-%' AND mes_competencia <= $2
			GROUP BY cid ORDER BY qty DESC LIMIT 6
		`, year, maxMonth)
		if errC == nil {
			defer cityRows.Close()
			for cityRows.Next() {
				var cid string
				var qty int
				if err := cityRows.Scan(&cid, &qty); err == nil {
					pct := 0.0
					if totalSucessoAnual > 0 {
						pct = math.Round((float64(qty)/float64(totalSucessoAnual))*1000) / 10
					}
					topCidades = append(topCidades, TopCidade{
						Cidade:     cid,
						Total:      qty,
						Percentual: pct,
					})
				}
			}
		}

		// Top cidades em suspensos
		var topCidadesSuspensos []TopCidade
		suspCityRows, errSC := dbPool.Query(ctx, `
			SELECT 
				COALESCE(NULLIF(e.cidade, ''), NULLIF(cl.cidade, ''), 'Não informada') as cid, 
				count(*) as qty 
			FROM eventos_bloqueio e 
			JOIN clientes cl ON cl.codigo_rbx = e.codigo_rbx 
			WHERE e.mes_competencia LIKE $1 || '-%' AND e.mes_competencia <= $2 
			  AND NOT e.eh_mimo 
			  AND e.status_desfecho = 'suspended' 
			  AND (e.eh_debito_herdado IS FALSE OR e.eh_debito_herdado IS NULL) 
			GROUP BY cid ORDER BY qty DESC LIMIT 6
		`, year, maxMonth)
		if errSC == nil {
			defer suspCityRows.Close()
			for suspCityRows.Next() {
				var cid string
				var qty int
				if err := suspCityRows.Scan(&cid, &qty); err == nil {
					pct := 0.0
					if totalSuspensosAnual > 0 {
						pct = math.Round((float64(qty)/float64(totalSuspensosAnual))*1000) / 10
					}
					topCidadesSuspensos = append(topCidadesSuspensos, TopCidade{
						Cidade:     cid,
						Total:      qty,
						Percentual: pct,
					})
				}
			}
		}

		// Top cidades em cancelamentos
		var topCidadesCancelamentos []TopCidade
		cancCityRows, errCC := dbPool.Query(ctx, `
			WITH canc AS (
				SELECT 
					c.numero_contrato,
					CASE 
						WHEN c.cidade ILIKE '%PIRABAS%' OR cl.cidade ILIKE '%PIRABAS%' OR a.grupo_cliente ILIKE '%PIRABAS%' OR a.grupo_cliente ILIKE '%SJP%' THEN 'São João de Pirabas'
						WHEN c.cidade ILIKE '%PRIMAVERA%' OR cl.cidade ILIKE '%PRIMAVERA%' OR a.grupo_cliente ILIKE '%PRIMAVERA%' OR a.grupo_cliente ILIKE '%PMV%' THEN 'Primavera'
						WHEN c.cidade ILIKE '%QUATIPURU%' OR cl.cidade ILIKE '%QUATIPURU%' OR a.grupo_cliente ILIKE '%QUATIPURU%' OR a.grupo_cliente ILIKE '%QT%' THEN 'Quatipuru'
						WHEN c.cidade ILIKE '%MAGALH%' OR cl.cidade ILIKE '%MAGALH%' OR a.grupo_cliente ILIKE '%MAGALH%' OR a.grupo_cliente ILIKE '%MB)%' THEN 'Magalhães Barata'
						WHEN c.cidade ILIKE '%SANTAR%' OR cl.cidade ILIKE '%SANTAR%' OR a.grupo_cliente ILIKE '%SANTAR%' OR a.grupo_cliente ILIKE '%STN%' THEN 'Santarém Novo'
						WHEN c.cidade ILIKE '%MARACAN%' OR cl.cidade ILIKE '%MARACAN%' OR a.grupo_cliente ILIKE '%MARACAN%' OR a.grupo_cliente ILIKE '%MRC%' THEN 'Maracanã'
						WHEN c.cidade ILIKE '%SALIN%' OR cl.cidade ILIKE '%SALIN%' OR a.grupo_cliente ILIKE '%SALIN%' OR a.grupo_cliente ILIKE '%SAL%' THEN 'Salinópolis'
						WHEN c.cidade ILIKE '%BOA VISTA%' OR cl.cidade ILIKE '%BOA VISTA%' OR a.grupo_cliente ILIKE '%BOA VISTA%' OR a.grupo_cliente ILIKE '%BV)%' THEN 'Boa Vista'
						WHEN c.cidade ILIKE '%MARAPANIM%' OR cl.cidade ILIKE '%MARAPANIM%' OR a.grupo_cliente ILIKE '%MARAPANIM%' OR a.grupo_cliente ILIKE '%MRP%' THEN 'Marapanim'
						WHEN COALESCE(NULLIF(c.cidade, ''), NULLIF(cl.cidade, ''), '') != '' THEN INITCAP(LOWER(COALESCE(NULLIF(c.cidade, ''), NULLIF(cl.cidade, ''))))
						ELSE 'Outras / Não informada'
					END as cid
				FROM rbx_contratos_cancelados c
				LEFT JOIN clientes cl ON cl.codigo_rbx = c.codigo_cliente
				LEFT JOIN (
					SELECT numero_contrato, (array_agg(grupo_cliente))[1] as grupo_cliente 
					FROM rbx_autenticacoes 
					GROUP BY numero_contrato
				) a ON a.numero_contrato = c.numero_contrato
				WHERE c.mes_competencia LIKE $1 || '-%' AND c.mes_competencia <= $2
				  AND c.motivo_cancelamento NOT ILIKE '%MUD%TITULARIDADE%'
				  AND c.motivo_cancelamento NOT ILIKE '%AJUSTE T%CNICO%'
				  AND c.motivo_cancelamento NOT ILIKE '%CONTRATO TEMPOR%RIO%'
				  AND c.motivo_cancelamento NOT ILIKE '%PEDIDO INSTALA%O CANCELADO%'
				  AND c.motivo_cancelamento NOT ILIKE '%ERRO%GERA%O%CONTRATO%'
				  AND c.motivo_cancelamento NOT ILIKE '%CANCELAMENTO%MIGRA%'
				  AND c.motivo_cancelamento NOT ILIKE '%N%O PAGOU A TAXA%'
				  AND c.motivo_cancelamento NOT ILIKE '%NAO PAGOU A TAXA%'
				  AND c.motivo_cancelamento NOT ILIKE '%INVIA%'
				  AND NOT (
					  c.plano ~* '(^|[^a-zA-Z0-9])TV([^a-zA-Z0-9]|$)'
					  OR c.plano ILIKE '%+ TV%'
					  OR c.plano ILIKE '%+TV%'
					  OR c.plano ILIKE '%TELEVIS%'
					  OR c.plano ILIKE '%IPTV%'
				  )
			)
			SELECT cid, count(*) as qty 
			FROM canc 
			GROUP BY cid 
			ORDER BY qty DESC LIMIT 6
		`, year, maxMonth)
		if errCC == nil {
			defer cancCityRows.Close()
			for cancCityRows.Next() {
				var cid string
				var qty int
				if err := cancCityRows.Scan(&cid, &qty); err == nil {
					pct := 0.0
					if totalCancAnual > 0 {
						pct = math.Round((float64(qty)/float64(totalCancAnual))*1000) / 10
					}
					topCidadesCancelamentos = append(topCidadesCancelamentos, TopCidade{
						Cidade:     cid,
						Total:      qty,
						Percentual: pct,
					})
				}
			}
		}

		if topCidades == nil {
			topCidades = []TopCidade{}
		}
		if topCidadesSuspensos == nil {
			topCidadesSuspensos = []TopCidade{}
		}
		if topCidadesCancelamentos == nil {
			topCidadesCancelamentos = []TopCidade{}
		}

		// Top motivos de cancelamento
		type TopMotivo struct {
			Motivo     string  `json:"motivo"`
			Total      int     `json:"total"`
			Percentual float64 `json:"percentual"`
		}
		var topMotivos []TopMotivo
		motRows, errM := dbPool.Query(ctx, `
			SELECT motivo_cancelamento as mot, count(*) as qty 
			FROM rbx_contratos_cancelados 
			WHERE mes_competencia LIKE $1 || '-%' AND mes_competencia <= $2
			  AND motivo_cancelamento NOT ILIKE '%MUD%TITULARIDADE%'
			  AND motivo_cancelamento NOT ILIKE '%AJUSTE T%CNICO%'
			  AND motivo_cancelamento NOT ILIKE '%CONTRATO TEMPOR%RIO%'
			  AND motivo_cancelamento NOT ILIKE '%PEDIDO INSTALA%O CANCELADO%'
			  AND motivo_cancelamento NOT ILIKE '%ERRO%GERA%O%CONTRATO%'
			  AND motivo_cancelamento NOT ILIKE '%CANCELAMENTO%MIGRA%'
			  AND motivo_cancelamento NOT ILIKE '%N%O PAGOU A TAXA%'
			  AND motivo_cancelamento NOT ILIKE '%NAO PAGOU A TAXA%'
			  AND motivo_cancelamento NOT ILIKE '%INVIA%'
			GROUP BY mot ORDER BY qty DESC LIMIT 6
		`, year, maxMonth)
		if errM == nil {
			defer motRows.Close()
			for motRows.Next() {
				var mot string
				var qty int
				if err := motRows.Scan(&mot, &qty); err == nil {
					pct := 0.0
					if totalCancAnual > 0 {
						pct = math.Round((float64(qty)/float64(totalCancAnual))*1000) / 10
					}
					cleanMot := strings.Trim(mot, "()")
					topMotivos = append(topMotivos, TopMotivo{
						Motivo:     cleanMot,
						Total:      qty,
						Percentual: pct,
					})
				}
			}
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"ano": year,
			"kpis": map[string]interface{}{
				"baseAtual":                baseAtual,
				"clientesUnicosAtuais":     clientesUnicosAtuais,
				"saldoLiquidoAnual":        saldoLiqAnual,
				"totalInstalacoesAnual":    totalSucessoAnual,
				"mediaMensalInstalacoes":   mediaMensalInstalacoes,
				"totalCancelamentosAnual":  totalCancAnual,
				"mediaMensalCancelamentos": mediaMensalCancelamentos,
				"churnMedioAnual":          churnMedioAnual,
				"totalSuspensosAtual":      totalSuspensosAtual,
				"totalSuspensosAnual":      totalSuspensosAnual,
				"mrrSuspensosTotal":        math.Round(totalMrrSuspensosAnual*100) / 100,
				"mrrCanceladoTotal":        math.Round(totalMrrCanceladoAnual*100) / 100,
				"taxaRetencaoAnual":        taxaRetencaoAnual,
			},
			"meses":                   meses,
			"topCidadesInstalacoes":   topCidades,
			"topCidadesSuspensos":     topCidadesSuspensos,
			"topCidadesCancelamentos": topCidadesCancelamentos,
			"topMotivosCancelamento":  topMotivos,
		})
	})

	r.Get("/api/empresa/instalacoes", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if dbPool == nil {
			http.Error(w, `{"error": "Banco de dados não disponível"}`, http.StatusInternalServerError)
			return
		}

		month := r.URL.Query().Get("month")
		if month == "" {
			month = "2026-01"
		}

		ctx := r.Context()
		rows, err := dbPool.Query(ctx, `
			SELECT a.numero, a.protocolo, a.codigo_cliente, 
			       COALESCE(NULLIF(a.nome_cliente, ''), c.nome, ''),
			       COALESCE(a.contrato, ''),
			       a.data_abertura, a.data_encerramento, COALESCE(a.situacao_os, ''),
			       COALESCE(a.topico, ''), COALESCE(a.causa, ''), COALESCE(a.assunto, ''),
			       COALESCE(a.solucao, ''), COALESCE(a.usuario_abertura, ''),
			       a.instalado_com_sucesso,
			       COALESCE(NULLIF(a.cidade, ''), c.cidade, ''),
			       COALESCE(NULLIF(a.bairro, ''), c.bairro, '')
			FROM rbx_atendimentos_instalacoes a
			LEFT JOIN LATERAL (
				SELECT c.nome, c.cidade, c.bairro 
				FROM clientes c 
				WHERE REPLACE(REPLACE(a.codigo_cliente, '.', ''), ',', '') = REPLACE(REPLACE(c.codigo_rbx, '.', ''), ',', '')
				ORDER BY c.criado_em DESC
				LIMIT 1
			) c ON true
			WHERE a.mes_competencia = $1 AND to_char(a.data_abertura, 'YYYY-MM') = $1
			  AND a.solucao NOT ILIKE '%gerad%incorret%'
			  AND a.solucao NOT ILIKE '%gerad%errad%'
			  AND a.solucao NOT ILIKE '%gerad%indevid%'
			  AND a.solucao NOT ILIKE '%aberto incorretamente%'
			  AND a.solucao NOT ILIKE '%aberta incorretamente%'
			  AND a.solucao NOT ILIKE '%abertura errada%'
			  AND a.solucao NOT ILIKE '%abertura incorreta%'
			  AND a.solucao NOT ILIKE '%fluxo incorreto%'
			  AND a.solucao NOT ILIKE '%n%o era instala%'
			  AND a.solucao NOT ILIKE '%como lentid%'
			  AND a.solucao NOT ILIKE '%como reparo%'
			  AND a.solucao NOT ILIKE '%como suporte%'
			  AND a.solucao NOT ILIKE '%nao teve viabilida%'
			  AND a.solucao NOT ILIKE '%não teve viabilida%'
			  AND a.solucao NOT ILIKE '%sem viabilidade%'
			  AND a.solucao NOT ILIKE '%cto muito longe%'
			  AND a.solucao NOT ILIKE '%cto longe%'
			  AND a.solucao NOT ILIKE '%inviabilidade técnica%'
			  AND a.solucao NOT ILIKE '%inviabilidade tecnica%'
			  AND a.solucao NOT ILIKE '%não foi possível instalar%'
			  AND a.solucao NOT ILIKE '%nao foi possivel instalar%'
			  AND a.solucao NOT ILIKE '%não foi instalad%'
			  AND a.solucao NOT ILIKE '%nao foi instalad%'
			  AND a.solucao NOT ILIKE '%não instalad%'
			  AND a.solucao NOT ILIKE '%nao instalad%'
			ORDER BY a.data_abertura DESC NULLS LAST
		`, month)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type InstalacaoItem struct {
			Numero              string     `json:"numero"`
			Protocolo           string     `json:"protocolo"`
			CodigoCliente       string     `json:"codigoCliente"`
			NomeCliente         string     `json:"nomeCliente"`
			Contrato            string     `json:"contrato"`
			DataAbertura        *time.Time `json:"dataAbertura"`
			DataEncerramento    *time.Time `json:"dataEncerramento"`
			SituacaoOS          string     `json:"situacaoOS"`
			Topico              string     `json:"topico"`
			Causa               string     `json:"causa"`
			Assunto             string     `json:"assunto"`
			Solucao             string     `json:"solucao"`
			UsuarioAbertura     string     `json:"usuarioAbertura"`
			InstaladoComSucesso bool       `json:"instaladoComSucesso"`
			Cidade              string     `json:"cidade"`
			Bairro              string     `json:"bairro"`
		}

		var items []InstalacaoItem
		for rows.Next() {
			var it InstalacaoItem
			if err := rows.Scan(
				&it.Numero, &it.Protocolo, &it.CodigoCliente, &it.NomeCliente, &it.Contrato,
				&it.DataAbertura, &it.DataEncerramento, &it.SituacaoOS,
				&it.Topico, &it.Causa, &it.Assunto,
				&it.Solucao, &it.UsuarioAbertura,
				&it.InstaladoComSucesso, &it.Cidade, &it.Bairro,
			); err == nil {
				items = append(items, it)
			}
		}

		if items == nil {
			items = []InstalacaoItem{}
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"mesCompetencia": month,
			"total":          len(items),
			"instalacoes":    items,
		})
	})

	r.Get("/api/empresa/cancelamentos", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if dbPool == nil {
			http.Error(w, `{"error": "Banco de dados não disponível"}`, http.StatusInternalServerError)
			return
		}

		month := r.URL.Query().Get("month")
		if month == "" {
			month = "2026-01"
		}

		ctx := r.Context()
		rows, err := dbPool.Query(ctx, `
			SELECT numero_contrato, codigo_cliente, COALESCE(nome_cliente, ''),
			       data_cancelamento, COALESCE(motivo_cancelamento, ''),
			       COALESCE(plano, ''), valor_mensalidade,
			       COALESCE(cidade, ''), COALESCE(bairro, '')
			FROM rbx_contratos_cancelados
			WHERE mes_competencia = $1
			  AND motivo_cancelamento NOT ILIKE '%MUD%TITULARIDADE%'
			  AND motivo_cancelamento NOT ILIKE '%AJUSTE T%CNICO%'
			  AND motivo_cancelamento NOT ILIKE '%CONTRATO TEMPOR%RIO%'
			  AND motivo_cancelamento NOT ILIKE '%PEDIDO INSTALA%O CANCELADO%'
			  AND motivo_cancelamento NOT ILIKE '%ERRO%GERA%O%CONTRATO%'
			  AND motivo_cancelamento NOT ILIKE '%CANCELAMENTO%MIGRA%'
			  AND motivo_cancelamento NOT ILIKE '%N%O PAGOU A TAXA%'
			  AND motivo_cancelamento NOT ILIKE '%NAO PAGOU A TAXA%'
			  AND motivo_cancelamento NOT ILIKE '%INVIA%'
			  AND NOT (
			  	plano ~* '(^|[^a-zA-Z0-9])TV([^a-zA-Z0-9]|$)'
			  	OR plano ILIKE '%+ TV%'
			  	OR plano ILIKE '%+TV%'
			  	OR plano ILIKE '%TELEVIS%'
			  	OR plano ILIKE '%IPTV%'
			  )
			ORDER BY data_cancelamento DESC NULLS LAST
		`, month)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type CanceladoItem struct {
			NumeroContrato     string     `json:"numeroContrato"`
			CodigoCliente      string     `json:"codigoCliente"`
			NomeCliente        string     `json:"nomeCliente"`
			DataCancelamento   *time.Time `json:"dataCancelamento"`
			MotivoCancelamento string     `json:"motivoCancelamento"`
			Plano              string     `json:"plano"`
			ValorMensalidade   float64    `json:"valorMensalidade"`
			Cidade             string     `json:"cidade"`
			Bairro             string     `json:"bairro"`
		}

		var items []CanceladoItem
		for rows.Next() {
			var it CanceladoItem
			if err := rows.Scan(
				&it.NumeroContrato, &it.CodigoCliente, &it.NomeCliente,
				&it.DataCancelamento, &it.MotivoCancelamento,
				&it.Plano, &it.ValorMensalidade,
				&it.Cidade, &it.Bairro,
			); err == nil {
				items = append(items, it)
			}
		}

		if items == nil {
			items = []CanceladoItem{}
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"mesCompetencia": month,
			"total":          len(items),
			"cancelamentos":  items,
		})
	})

	r.Get("/api/empresa/inadimplentes", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if dbPool == nil {
			http.Error(w, `{"error": "Banco de dados não disponível"}`, http.StatusInternalServerError)
			return
		}

		month := r.URL.Query().Get("month")
		if month == "" {
			month = "2026-01"
		}

		ctx := r.Context()
		rows, err := dbPool.Query(ctx, `
			SELECT eb.contrato, eb.codigo_rbx, COALESCE(c.nome, ''),
			       COALESCE(eb.cidade, ''), COALESCE(eb.bairro, ''),
			       COALESCE(eb.plano, ''), eb.valor_mensalidade,
			       eb.status_desfecho, COALESCE(eb.status_rbx_codigo, ''),
			       COALESCE(eb.status_rbx_descricao, ''), COALESCE(eb.dias_vencido, 0)
			FROM eventos_bloqueio eb
			LEFT JOIN LATERAL (
				SELECT c.nome 
				FROM clientes c 
				WHERE REPLACE(REPLACE(eb.codigo_rbx, '.', ''), ',', '') = REPLACE(REPLACE(c.codigo_rbx, '.', ''), ',', '')
				ORDER BY c.criado_em DESC
				LIMIT 1
			) c ON true
			WHERE eb.mes_competencia = $1 
			  AND NOT eb.eh_mimo
			  AND (eb.status_desfecho = 'blocked' OR eb.status_rbx_codigo IN ('B', 'P'))
			  AND eb.status_rbx_codigo != 'S'
			  AND eb.status_desfecho != 'suspended'
			ORDER BY eb.valor_mensalidade DESC
		`, month)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type InadimplenteItem struct {
			Contrato           string  `json:"contrato"`
			CodigoRbx          string  `json:"codigoRbx"`
			Nome               string  `json:"nome"`
			Cidade             string  `json:"cidade"`
			Bairro             string  `json:"bairro"`
			Plano              string  `json:"plano"`
			ValorMensalidade   float64 `json:"valorMensalidade"`
			StatusDesfecho     string  `json:"statusDesfecho"`
			StatusRbxCodigo    string  `json:"statusRbxCodigo"`
			StatusRbxDescricao string  `json:"statusRbxDescricao"`
			DiasVencido        int     `json:"diasVencido"`
		}

		var items []InadimplenteItem
		for rows.Next() {
			var it InadimplenteItem
			if err := rows.Scan(
				&it.Contrato, &it.CodigoRbx, &it.Nome,
				&it.Cidade, &it.Bairro,
				&it.Plano, &it.ValorMensalidade,
				&it.StatusDesfecho, &it.StatusRbxCodigo,
				&it.StatusRbxDescricao, &it.DiasVencido,
			); err == nil {
				items = append(items, it)
			}
		}

		if items == nil {
			items = []InadimplenteItem{}
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"mesCompetencia": month,
			"total":          len(items),
			"inadimplentes":  items,
		})
	})

	// ROTAS DO MÓDULO DE AUTENTICAÇÕES & BASE HISTÓRICA RBX
	r.Post("/api/rbx/autenticacoes/sync", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if dbPool == nil {
			http.Error(w, `{"error": "Banco de dados não disponível"}`, http.StatusInternalServerError)
			return
		}

		ctx := r.Context()
		var rbxURL, rbxToken, rbxVersion string
		err := dbPool.QueryRow(ctx, "SELECT rbx_url, rbx_token, rbx_version FROM configuracoes_rbx WHERE id = 1").Scan(&rbxURL, &rbxToken, &rbxVersion)
		if err != nil || strings.TrimSpace(rbxURL) == "" || strings.TrimSpace(rbxToken) == "" {
			http.Error(w, `{"error": "Integração RBX não configurada. Configure a URL e chave nas opções."}`, http.StatusBadRequest)
			return
		}

		client := rbx.NewClient(rbx.Config{URL: rbxURL, Token: rbxToken, Version: rbxVersion})
		result, err := syncRbxAutenticacoesBase(ctx, client)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Erro ao sincronizar autenticações do RBX: %v"}`, err), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"resumo":  result,
		})
	})

	r.Get("/api/rbx/autenticacoes/resumo", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if dbPool == nil {
			http.Error(w, `{"error": "Banco de dados não disponível"}`, http.StatusInternalServerError)
			return
		}

		month := r.URL.Query().Get("month")
		if month == "" {
			month = "2026-10"
		}

		ctx := r.Context()
		var total, central, gruposExcluidos, pppoeTotal, pppoeMes int
		var mesAtivos, mesBloqueados, mesSuspensos, mesCancelados, mesOutros int
		var grafanaTotal, grafanaAtivos, grafanaUpgrades, grafanaBloqueados int
		var contratosAtivos, clientesUnicos int
		var sincEm *time.Time

		criadoCol := "criado_ate_outubro_2026"
		ativoCol := "ativo_em_outubro_2026"
		if month == "2026-09" {
			criadoCol = "criado_ate_setembro_2026"
			ativoCol = "ativo_em_setembro_2026"
		} else if month == "2026-08" {
			criadoCol = "criado_ate_agosto_2026"
			ativoCol = "ativo_em_agosto_2026"
		} else if month == "2026-07" {
			criadoCol = "criado_ate_julho_2026"
			ativoCol = "ativo_em_julho_2026"
		} else if month == "2026-06" {
			criadoCol = "criado_ate_junho_2026"
			ativoCol = "ativo_em_junho_2026"
		} else if month == "2026-05" {
			criadoCol = "criado_ate_maio_2026"
			ativoCol = "ativo_em_maio_2026"
		} else if month == "2026-04" {
			criadoCol = "criado_ate_abril_2026"
			ativoCol = "ativo_em_abril_2026"
		} else if month == "2026-03" {
			criadoCol = "criado_ate_marco_2026"
			ativoCol = "ativo_em_marco_2026"
		} else if month == "2026-02" {
			criadoCol = "criado_ate_fevereiro_2026"
			ativoCol = "ativo_em_fevereiro_2026"
		} else if month == "2026-01" {
			criadoCol = "criado_ate_janeiro_2026"
			ativoCol = "ativo_em_janeiro_2026"
		}

		query := fmt.Sprintf(`
			SELECT 
				COALESCE(COUNT(*), 0),
				COALESCE(COUNT(*) FILTER (WHERE eh_central_assinante), 0),
				COALESCE(COUNT(*) FILTER (WHERE eh_grupo_excluido), 0),
				COALESCE(COUNT(*) FILTER (WHERE NOT eh_central_assinante AND NOT eh_grupo_excluido), 0),
				COALESCE(COUNT(*) FILTER (WHERE NOT eh_central_assinante AND NOT eh_grupo_excluido AND %s), 0),
				COALESCE(COUNT(*) FILTER (WHERE NOT eh_central_assinante AND NOT eh_grupo_excluido AND %s AND situacao_codigo = 'A'), 0),
				COALESCE(COUNT(*) FILTER (WHERE NOT eh_central_assinante AND NOT eh_grupo_excluido AND %s AND situacao_codigo IN ('B', 'P')), 0),
				COALESCE(COUNT(*) FILTER (WHERE NOT eh_central_assinante AND NOT eh_grupo_excluido AND %s AND situacao_codigo = 'S'), 0),
				COALESCE(COUNT(*) FILTER (WHERE NOT eh_central_assinante AND NOT eh_grupo_excluido AND %s AND situacao_codigo = 'C'), 0),
				COALESCE(COUNT(*) FILTER (WHERE NOT eh_central_assinante AND NOT eh_grupo_excluido AND %s AND situacao_codigo NOT IN ('A', 'B', 'P', 'S', 'C')), 0),
				COALESCE(COUNT(*) FILTER (WHERE NOT eh_central_assinante AND NOT eh_grupo_excluido AND %s), 0),
				COALESCE(COUNT(*) FILTER (WHERE NOT eh_central_assinante AND NOT eh_grupo_excluido AND %s AND NOT origem_upgrade AND situacao_codigo = 'A'), 0),
				COALESCE(COUNT(*) FILTER (WHERE NOT eh_central_assinante AND NOT eh_grupo_excluido AND %s AND origem_upgrade), 0),
				COALESCE(COUNT(*) FILTER (WHERE NOT eh_central_assinante AND NOT eh_grupo_excluido AND %s AND situacao_codigo IN ('B', 'P')), 0),
				COALESCE(COUNT(DISTINCT numero_contrato) FILTER (WHERE NOT eh_central_assinante AND NOT eh_grupo_excluido AND %s), 0),
				COALESCE(COUNT(DISTINCT codigo_cliente) FILTER (WHERE NOT eh_central_assinante AND NOT eh_grupo_excluido AND %s), 0),
				MAX(sincronizado_em)
			FROM rbx_autenticacoes
		`, criadoCol, criadoCol, criadoCol, criadoCol, criadoCol, criadoCol, ativoCol, ativoCol, ativoCol, ativoCol, ativoCol, ativoCol)

		_ = dbPool.QueryRow(ctx, query).Scan(&total, &central, &gruposExcluidos, &pppoeTotal, &pppoeMes,
			&mesAtivos, &mesBloqueados, &mesSuspensos, &mesCancelados, &mesOutros,
			&grafanaTotal, &grafanaAtivos, &grafanaUpgrades, &grafanaBloqueados,
			&contratosAtivos, &clientesUnicos, &sincEm)

		json.NewEncoder(w).Encode(map[string]interface{}{
			"mesCompetencia":         month,
			"totalAutenticacoes":     total,
			"centralAssinante":       central,
			"gruposExcluidos":        gruposExcluidos,
			"pppoeTotal":             pppoeTotal,
			"pppoeAteJan2026":        pppoeMes,
			"pppoeAteMes":            pppoeMes,
			"baseConexoesGrafanaJan": grafanaTotal,
			"baseConexoesGrafanaMes": grafanaTotal,
			"contratosAtivos":        contratosAtivos,
			"clientesUnicos":         clientesUnicos,
			"grafanaDetalhamento": map[string]int{
				"ativosContinuos":      grafanaAtivos,
				"upgradesPosteriores":  grafanaUpgrades,
				"bloqueadosConectados": grafanaBloqueados,
			},
			"statusJan": map[string]int{
				"ativos":     mesAtivos,
				"bloqueados": mesBloqueados,
				"suspensos":  mesSuspensos,
				"cancelados": mesCancelados,
				"outros":     mesOutros,
			},
			"sincronizadoEm": sincEm,
		})
	})

	r.Get("/api/rbx/autenticacoes", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if dbPool == nil {
			http.Error(w, `{"error": "Banco de dados não disponível"}`, http.StatusInternalServerError)
			return
		}

		month := r.URL.Query().Get("month")
		if month == "" {
			month = "2026-10"
		}
		criadoCol := "criado_ate_outubro_2026"
		ativoCol := "ativo_em_outubro_2026"
		situacaoCol := "situacao_em_outubro"
		if month == "2026-09" {
			criadoCol = "criado_ate_setembro_2026"
			ativoCol = "ativo_em_setembro_2026"
			situacaoCol = "situacao_em_setembro"
		} else if month == "2026-08" {
			criadoCol = "criado_ate_agosto_2026"
			ativoCol = "ativo_em_agosto_2026"
			situacaoCol = "situacao_em_agosto"
		} else if month == "2026-07" {
			criadoCol = "criado_ate_julho_2026"
			ativoCol = "ativo_em_julho_2026"
			situacaoCol = "situacao_em_julho"
		} else if month == "2026-06" {
			criadoCol = "criado_ate_junho_2026"
			ativoCol = "ativo_em_junho_2026"
			situacaoCol = "situacao_em_junho"
		} else if month == "2026-05" {
			criadoCol = "criado_ate_maio_2026"
			ativoCol = "ativo_em_maio_2026"
			situacaoCol = "situacao_em_maio"
		} else if month == "2026-04" {
			criadoCol = "criado_ate_abril_2026"
			ativoCol = "ativo_em_abril_2026"
			situacaoCol = "situacao_em_abril"
		} else if month == "2026-03" {
			criadoCol = "criado_ate_marco_2026"
			ativoCol = "ativo_em_marco_2026"
			situacaoCol = "situacao_em_marco"
		} else if month == "2026-02" {
			criadoCol = "criado_ate_fevereiro_2026"
			ativoCol = "ativo_em_fevereiro_2026"
			situacaoCol = "situacao_em_fevereiro"
		} else if month == "2026-01" {
			criadoCol = "criado_ate_janeiro_2026"
			ativoCol = "ativo_em_janeiro_2026"
			situacaoCol = "situacao_em_janeiro"
		}

		q := strings.TrimSpace(r.URL.Query().Get("q"))
		apenasPPPoE := r.URL.Query().Get("apenas_pppoe") != "false" // default true
		apenasJaneiro := r.URL.Query().Get("apenas_janeiro") == "true" || r.URL.Query().Get("apenas_mes") == "true"
		apenasAtivosJan := r.URL.Query().Get("apenas_ativos_jan") == "true" || r.URL.Query().Get("apenas_ativos_mes") == "true"
		apenasUpgrades := r.URL.Query().Get("apenas_upgrades") == "true"
		apenasGruposExcluidos := r.URL.Query().Get("apenas_grupos_excluidos") == "true"
		statusFilter := strings.TrimSpace(r.URL.Query().Get("status"))

		pageStr := r.URL.Query().Get("page")
		limitStr := r.URL.Query().Get("limit")

		page := 1
		limit := 20
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
		offset := (page - 1) * limit

		whereParts := []string{"1=1"}
		args := []interface{}{}
		argIdx := 1

		if apenasGruposExcluidos {
			whereParts = append(whereParts, "eh_grupo_excluido = true")
		} else if apenasPPPoE {
			whereParts = append(whereParts, "NOT eh_central_assinante AND NOT eh_grupo_excluido")
		}
		if apenasJaneiro {
			whereParts = append(whereParts, fmt.Sprintf("%s = true", criadoCol))
		}
		if apenasAtivosJan {
			whereParts = append(whereParts, fmt.Sprintf("%s = true", ativoCol))
		}
		if apenasUpgrades {
			whereParts = append(whereParts, "origem_upgrade = true")
		}
		if statusFilter != "" && statusFilter != "TODOS" {
			whereParts = append(whereParts, fmt.Sprintf("situacao_codigo = $%d", argIdx))
			args = append(args, statusFilter)
			argIdx++
		}
		if q != "" {
			likePattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf("(usuario ILIKE $%d OR nome_cliente ILIKE $%d OR codigo_cliente ILIKE $%d OR numero_contrato ILIKE $%d OR nas ILIKE $%d OR mac ILIKE $%d OR contrato_anterior ILIKE $%d OR situacao_em_janeiro ILIKE $%d OR situacao_em_fevereiro ILIKE $%d OR situacao_em_marco ILIKE $%d OR situacao_em_abril ILIKE $%d OR situacao_em_maio ILIKE $%d OR situacao_em_junho ILIKE $%d OR situacao_em_julho ILIKE $%d OR situacao_em_agosto ILIKE $%d OR situacao_em_setembro ILIKE $%d OR situacao_em_outubro ILIKE $%d OR grupo_cliente ILIKE $%d)", argIdx, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx))
			args = append(args, likePattern)
			argIdx++
		}

		whereClause := strings.Join(whereParts, " AND ")

		ctx := r.Context()
		var total int
		countQuery := fmt.Sprintf("SELECT COUNT(*) FROM rbx_autenticacoes WHERE %s", whereClause)
		_ = dbPool.QueryRow(ctx, countQuery, args...).Scan(&total)

		selectQuery := fmt.Sprintf(`
			SELECT id_autenticacao, codigo_cliente, COALESCE(nome_cliente, ''),
			       numero_contrato, nas, porta, usuario, mac, observacao,
			       eh_central_assinante, data_assinatura, data_inicio,
			       situacao_codigo, COALESCE(situacao_descricao, ''),
			       data_ultima_operacao, %s,
			       %s, origem_upgrade, COALESCE(contrato_anterior, ''),
			       COALESCE(%s, ''), COALESCE(grupo_cliente, ''),
			       eh_grupo_excluido, sincronizado_em
			FROM rbx_autenticacoes
			WHERE %s
			ORDER BY 
				CASE WHEN %s THEN 0 ELSE 1 END,
				CASE WHEN %s THEN 0 ELSE 1 END,
				CASE situacao_codigo WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'S' THEN 3 WHEN 'C' THEN 4 ELSE 5 END,
				id_autenticacao::bigint DESC
			LIMIT $%d OFFSET $%d
		`, criadoCol, ativoCol, situacaoCol, whereClause, ativoCol, criadoCol, argIdx, argIdx+1)

		args = append(args, limit, offset)

		rows, err := dbPool.Query(ctx, selectQuery, args...)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type AutenticacaoRow struct {
			ID                 string     `json:"id"`
			CodigoCliente      string     `json:"codigoCliente"`
			NomeCliente        string     `json:"nomeCliente"`
			NumeroContrato     string     `json:"numeroContrato"`
			NAS                string     `json:"nas"`
			Porta              string     `json:"porta"`
			Usuario            string     `json:"usuario"`
			MAC                string     `json:"mac"`
			Observacao         string     `json:"observacao"`
			EhCentralAssinante bool       `json:"ehCentralAssinante"`
			DataAssinatura     *time.Time `json:"dataAssinatura"`
			DataInicio         *time.Time `json:"dataInicio"`
			SituacaoCodigo     string     `json:"situacaoCodigo"`
			SituacaoDescricao  string     `json:"situacaoDescricao"`
			DataUltimaOperacao *time.Time `json:"dataUltimaOperacao"`
			CriadoAteJan2026   bool       `json:"criadoAteJaneiro2026"`
			AtivoEmJan2026     bool       `json:"ativoEmJaneiro2026"`
			OrigemUpgrade      bool       `json:"origemUpgrade"`
			ContratoAnterior   string     `json:"contratoAnterior"`
			SituacaoEmJan      string     `json:"situacaoEmJaneiro"`
			GrupoCliente       string     `json:"grupoCliente"`
			EhGrupoExcluido    bool       `json:"ehGrupoExcluido"`
			SincronizadoEm     *time.Time `json:"sincronizadoEm"`
		}

		var items []AutenticacaoRow
		for rows.Next() {
			var it AutenticacaoRow
			if err := rows.Scan(
				&it.ID, &it.CodigoCliente, &it.NomeCliente,
				&it.NumeroContrato, &it.NAS, &it.Porta, &it.Usuario, &it.MAC, &it.Observacao,
				&it.EhCentralAssinante, &it.DataAssinatura, &it.DataInicio,
				&it.SituacaoCodigo, &it.SituacaoDescricao,
				&it.DataUltimaOperacao, &it.CriadoAteJan2026,
				&it.AtivoEmJan2026, &it.OrigemUpgrade, &it.ContratoAnterior,
				&it.SituacaoEmJan, &it.GrupoCliente, &it.EhGrupoExcluido,
				&it.SincronizadoEm,
			); err == nil {
				items = append(items, it)
			}
		}

		if items == nil {
			items = []AutenticacaoRow{}
		}

		totalPages := (total + limit - 1) / limit
		if totalPages == 0 {
			totalPages = 1
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"total":      total,
			"page":       page,
			"limit":      limit,
			"totalPages": totalPages,
			"items":      items,
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
		cityDimension := operationalCitySQL
		neighborhoodDimension := "COALESCE(NULLIF(INITCAP(TRIM(COALESCE(NULLIF(e.bairro, ''), c.bairro))), ''), 'Não Informado')"
		cycleDimension := "e.ciclo_vencimento"
		cityExpr := operationalCitySQL

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
		cityDimension := operationalCitySQL
		neighborhoodDimension := "COALESCE(NULLIF(INITCAP(TRIM(COALESCE(NULLIF(e.bairro, ''), c.bairro))), ''), 'Não Informado')"
		cycleDimension := "e.ciclo_vencimento"
		cityExpr := operationalCitySQL

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
				`, c.RbxCode, c.Contract, c.Name, strings.TrimSpace(c.City), c.Plan, c.MonthlyFee, c.Status, c.Neighborhood, isMimoCandidate)
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
