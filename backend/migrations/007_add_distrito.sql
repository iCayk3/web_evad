-- Adiciona suporte a Distrito e índices
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS distrito VARCHAR(100);
ALTER TABLE eventos_bloqueio ADD COLUMN IF NOT EXISTS distrito VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_clientes_distrito ON clientes(distrito);
CREATE INDEX IF NOT EXISTS idx_bloqueio_distrito ON eventos_bloqueio(distrito);
