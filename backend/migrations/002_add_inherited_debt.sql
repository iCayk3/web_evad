-- Migration 002: Suporte a Débitos Herdados / Renegociados (Modelo B)
ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS eh_debito_herdado BOOLEAN DEFAULT false;
ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS vencimento_debito_original VARCHAR(20);
ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS rotulo_debito VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_bloqueio_debito_herdado ON eventos_bloqueio(eh_debito_herdado);
