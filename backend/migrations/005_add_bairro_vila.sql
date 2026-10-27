-- Migration 005: Suporte a Bairro / Vila (Localidade Geográfica Detalhada)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS bairro VARCHAR(100);
ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS bairro VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_clientes_bairro ON clientes(bairro);
CREATE INDEX IF NOT EXISTS idx_bloqueio_bairro ON eventos_bloqueio(bairro);
