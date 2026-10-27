-- Migration 006: Suporte a Gestão e Recuperação de Equipamentos (Atendimentos RBX)
CREATE TABLE IF NOT EXISTS atendimentos_equipamentos (
    id VARCHAR(50) PRIMARY KEY, -- Número do atendimento no RBX
    protocolo VARCHAR(50),
    codigo_cliente VARCHAR(50) NOT NULL,
    contrato VARCHAR(50),
    data_abertura TIMESTAMP WITH TIME ZONE,
    data_encerramento TIMESTAMP WITH TIME ZONE,
    mes_competencia VARCHAR(7), -- YYYY-MM da competência (baseado no encerramento ou abertura)
    situacao_os VARCHAR(20),
    topico VARCHAR(255),
    assunto TEXT,
    solucao TEXT,
    causa VARCHAR(255),
    usuario_abertura VARCHAR(100),
    usuario_encerramento VARCHAR(100),
    status_recuperacao VARCHAR(50) NOT NULL DEFAULT 'pendente', -- 'recuperado', 'pendente', 'em_andamento', 'cancelamento_abortado', 'outro'
    equipamento_identificado TEXT,
    serial_mac VARCHAR(100),
    sincronizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_equip_competencia ON atendimentos_equipamentos(mes_competencia);
CREATE INDEX IF NOT EXISTS idx_equip_cliente ON atendimentos_equipamentos(codigo_cliente);
CREATE INDEX IF NOT EXISTS idx_equip_status ON atendimentos_equipamentos(status_recuperacao);
