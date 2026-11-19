package omnichannel

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// InitSchema cria as tabelas do módulo Omnichannel Analytics no PostgreSQL se não existirem
func InitSchema(ctx context.Context, db *pgxpool.Pool) error {
	if db == nil {
		return fmt.Errorf("banco de dados PostgreSQL não conectado")
	}

	ddl := `
	CREATE TABLE IF NOT EXISTS omnichannel_import_batches (
		id VARCHAR(100) PRIMARY KEY,
		file_hash VARCHAR(64) NOT NULL UNIQUE,
		file_name VARCHAR(255) NOT NULL,
		file_size BIGINT NOT NULL,
		mapping_profile_id VARCHAR(100),
		detected_period_start VARCHAR(50),
		detected_period_end VARCHAR(50),
		total_rows INTEGER NOT NULL DEFAULT 0,
		accepted_rows INTEGER NOT NULL DEFAULT 0,
		rejected_rows INTEGER NOT NULL DEFAULT 0,
		duplicate_rows INTEGER NOT NULL DEFAULT 0,
		match_confirmed INTEGER DEFAULT 0,
		match_name_suggested INTEGER DEFAULT 0,
		match_ambiguous INTEGER DEFAULT 0,
		match_unmatched INTEGER DEFAULT 0,
		status VARCHAR(50) NOT NULL DEFAULT 'queued',
		error_message TEXT,
		imported_by VARCHAR(100) NOT NULL DEFAULT 'sistema',
		created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
		completed_at TIMESTAMP WITH TIME ZONE
	);

	CREATE TABLE IF NOT EXISTS omnichannel_contact_facts (
		id VARCHAR(100) PRIMARY KEY,
		batch_id VARCHAR(100) NOT NULL REFERENCES omnichannel_import_batches(id) ON DELETE CASCADE,
		conversation_id VARCHAR(100) NOT NULL,
		phone_hmac VARCHAR(64) NOT NULL,
		phone_masked VARCHAR(50) NOT NULL,
		phone_encrypted TEXT,
		name_hmac VARCHAR(64),
		name_normalized VARCHAR(255),
		name_masked VARCHAR(255),
		rbx_client_id VARCHAR(50),
		match_status VARCHAR(50) NOT NULL DEFAULT 'pending',
		match_method VARCHAR(50),
		match_confidence NUMERIC(5,2),
		started_at TIMESTAMP WITH TIME ZONE NOT NULL,
		ended_at TIMESTAMP WITH TIME ZONE,
		status VARCHAR(50),
		channel VARCHAR(100),
		department VARCHAR(150),
		is_automation BOOLEAN NOT NULL DEFAULT FALSE,
		closure_type VARCHAR(150),
		classification TEXT,
		description TEXT,
		protocol_number VARCHAR(100),
		messages_received INTEGER DEFAULT 0,
		messages_sent INTEGER DEFAULT 0,
		messages_internal INTEGER DEFAULT 0,
		handle_time_seconds INTEGER,
		wait_time_seconds INTEGER,
		first_response_seconds INTEGER,
		avg_response_seconds INTEGER,
		satisfaction_status VARCHAR(50),
		initiated_by VARCHAR(50),
		quality_flags TEXT,
		CONSTRAINT uq_batch_conversation UNIQUE(batch_id, conversation_id)
	);

	-- Adiciona colunas complementares se a tabela já existia anteriormente
	ALTER TABLE omnichannel_contact_facts ADD COLUMN IF NOT EXISTS protocol_number VARCHAR(100);
	ALTER TABLE omnichannel_contact_facts ADD COLUMN IF NOT EXISTS description TEXT;
	ALTER TABLE omnichannel_contact_facts ADD COLUMN IF NOT EXISTS messages_received INTEGER DEFAULT 0;
	ALTER TABLE omnichannel_contact_facts ADD COLUMN IF NOT EXISTS messages_sent INTEGER DEFAULT 0;
	ALTER TABLE omnichannel_contact_facts ADD COLUMN IF NOT EXISTS messages_internal INTEGER DEFAULT 0;
	ALTER TABLE omnichannel_import_batches ADD COLUMN IF NOT EXISTS detected_period_start VARCHAR(50);
	ALTER TABLE omnichannel_import_batches ADD COLUMN IF NOT EXISTS detected_period_end VARCHAR(50);

	CREATE TABLE IF NOT EXISTS omnichannel_contact_assignments (
		id VARCHAR(100) PRIMARY KEY,
		fact_id VARCHAR(100) NOT NULL REFERENCES omnichannel_contact_facts(id) ON DELETE CASCADE,
		agent_name_hash VARCHAR(64) NOT NULL,
		agent_display VARCHAR(150) NOT NULL,
		position INTEGER NOT NULL,
		is_closer BOOLEAN NOT NULL DEFAULT FALSE
	);

	CREATE TABLE IF NOT EXISTS omnichannel_match_reviews (
		id VARCHAR(100) PRIMARY KEY,
		fact_id VARCHAR(100) NOT NULL REFERENCES omnichannel_contact_facts(id) ON DELETE CASCADE,
		phone_hmac VARCHAR(64) NOT NULL,
		previous_status VARCHAR(50) NOT NULL,
		new_status VARCHAR(50) NOT NULL,
		selected_rbx_client_id VARCHAR(50),
		reason TEXT NOT NULL,
		reviewed_by VARCHAR(100) NOT NULL,
		reviewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
		is_reverted BOOLEAN DEFAULT FALSE
	);

	CREATE TABLE IF NOT EXISTS omnichannel_import_errors (
		id VARCHAR(100) PRIMARY KEY,
		batch_id VARCHAR(100) NOT NULL REFERENCES omnichannel_import_batches(id) ON DELETE CASCADE,
		row_number INTEGER NOT NULL,
		field_name VARCHAR(100),
		error_code VARCHAR(100) NOT NULL,
		error_message TEXT NOT NULL,
		raw_value TEXT
	);

	CREATE TABLE IF NOT EXISTS omnichannel_known_mappings (
		id VARCHAR(100) PRIMARY KEY,
		phone_hmac VARCHAR(64) NOT NULL UNIQUE,
		phone_masked VARCHAR(50),
		rbx_client_id VARCHAR(50) NOT NULL,
		customer_name VARCHAR(255),
		created_by VARCHAR(100),
		created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_oib_hash ON omnichannel_import_batches(file_hash);
	CREATE INDEX IF NOT EXISTS idx_oib_status ON omnichannel_import_batches(status);
	CREATE INDEX IF NOT EXISTS idx_oib_created ON omnichannel_import_batches(created_at);
	CREATE INDEX IF NOT EXISTS idx_ocf_started ON omnichannel_contact_facts(started_at);
	CREATE INDEX IF NOT EXISTS idx_ocf_rbx_client ON omnichannel_contact_facts(rbx_client_id, started_at);
	CREATE INDEX IF NOT EXISTS idx_ocf_phone ON omnichannel_contact_facts(phone_hmac, started_at);
	CREATE INDEX IF NOT EXISTS idx_ocf_batch ON omnichannel_contact_facts(batch_id);
	CREATE INDEX IF NOT EXISTS idx_ocf_department ON omnichannel_contact_facts(department);
	CREATE INDEX IF NOT EXISTS idx_ocf_match_status ON omnichannel_contact_facts(match_status);
	CREATE INDEX IF NOT EXISTS idx_ocf_protocol ON omnichannel_contact_facts(protocol_number);
	CREATE INDEX IF NOT EXISTS idx_oca_agent ON omnichannel_contact_assignments(agent_name_hash, fact_id);
	CREATE INDEX IF NOT EXISTS idx_oca_fact ON omnichannel_contact_assignments(fact_id);
	CREATE INDEX IF NOT EXISTS idx_omr_fact ON omnichannel_match_reviews(fact_id);
	CREATE INDEX IF NOT EXISTS idx_omr_phone ON omnichannel_match_reviews(phone_hmac);
	CREATE INDEX IF NOT EXISTS idx_oie_batch ON omnichannel_import_errors(batch_id);
	CREATE INDEX IF NOT EXISTS idx_okm_phone ON omnichannel_known_mappings(phone_hmac);
	`

	_, err := db.Exec(ctx, ddl)
	return err
}
