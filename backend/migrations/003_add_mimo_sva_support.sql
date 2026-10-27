-- Migration 003: Suporte a Mimos e Serviços de Valor Adicionado (SVA / TV)
ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS plano VARCHAR(255);
ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS valor_mensalidade NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS eh_mimo BOOLEAN DEFAULT false;
ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS contrato_principal VARCHAR(50);
ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS mimos_vinculados TEXT;

CREATE INDEX IF NOT EXISTS idx_bloqueio_eh_mimo ON eventos_bloqueio(eh_mimo);
CREATE INDEX IF NOT EXISTS idx_bloqueio_contrato_principal ON eventos_bloqueio(contrato_principal);
