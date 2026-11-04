-- Migration 008: Tabelas operacionais consolidadas do RBX para a tela Minha Empresa
-- Armazena histórico consultado via API para evitar consultas desnecessárias no RBX

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
