-- Schema do EVAD (Painel de Inadimplência e Retorno de Bloqueios RBX)

CREATE TABLE IF NOT EXISTS clientes (
    codigo_rbx VARCHAR(50) PRIMARY KEY,
    contrato VARCHAR(50),
    nome VARCHAR(255) NOT NULL,
    cidade VARCHAR(100),
    plano VARCHAR(100),
    valor_mensalidade NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'ativo',
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS eventos_bloqueio (
    id VARCHAR(36) PRIMARY KEY,
    codigo_rbx VARCHAR(50) NOT NULL REFERENCES clientes(codigo_rbx) ON DELETE CASCADE,
    contrato VARCHAR(50) NOT NULL,
    mes_competencia VARCHAR(7) NOT NULL, -- Ex: '2026-01'
    ciclo_vencimento VARCHAR(50) NOT NULL, -- 'Ciclo 10', 'Ciclo 20', 'Ciclo 30'
    data_bloqueio TIMESTAMP WITH TIME ZONE NOT NULL,
    data_desbloqueio TIMESTAMP WITH TIME ZONE,
    dias_para_resolver INT,
    status_desfecho VARCHAR(50) NOT NULL, -- 'returned', 'blocked', 'churned'
    faixa_tempo VARCHAR(50), -- '0-7', '8-15', '16-30', '>30', 'pendente', 'cancelado'
    operacao VARCHAR(100) DEFAULT 'Bloqueio',
    usuario_rbx VARCHAR(100) DEFAULT 'routerbox',
    motivo VARCHAR(255) DEFAULT 'Inadimplência',
    status_rbx_codigo VARCHAR(20),
    status_rbx_descricao VARCHAR(100),
    motivo_cancelamento VARCHAR(255),
    dias_vencido INT,
    ultima_operacao_rbx TIMESTAMP WITH TIME ZONE,
    sincronizado_em TIMESTAMP WITH TIME ZONE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bloqueio_contrato_data ON eventos_bloqueio(contrato, data_bloqueio);
CREATE INDEX IF NOT EXISTS idx_bloqueio_competencia ON eventos_bloqueio(mes_competencia);
CREATE INDEX IF NOT EXISTS idx_bloqueio_ciclo ON eventos_bloqueio(ciclo_vencimento);

CREATE TABLE IF NOT EXISTS importacoes_log (
    id VARCHAR(36) PRIMARY KEY,
    nome_arquivo VARCHAR(255) NOT NULL,
    total_linhas INT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'concluido',
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS configuracoes_rbx (
    id INT PRIMARY KEY DEFAULT 1,
    rbx_url TEXT NOT NULL DEFAULT '',
    rbx_token TEXT NOT NULL DEFAULT '',
    rbx_version VARCHAR(20) NOT NULL DEFAULT 'v2',
    auto_sync BOOLEAN NOT NULL DEFAULT true,
    sync_interval_hours INT NOT NULL DEFAULT 6,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    status_conexao VARCHAR(50) NOT NULL DEFAULT 'desconectado',
    ultimo_erro TEXT,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
