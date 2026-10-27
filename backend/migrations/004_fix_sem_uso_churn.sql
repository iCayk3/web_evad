-- Migration 004: Reclassificação do motivo 'SEM USO' para Churn Real
-- O comercial confirmou que 'SEM USO' refere-se ao cliente que pagava sem utilizar o ponto de internet e cancelou.
UPDATE eventos_bloqueio
SET status_desfecho = 'churned',
    data_desbloqueio = NULL,
    dias_para_resolver = NULL
WHERE UPPER(motivo_cancelamento) LIKE '%SEM USO%'
  AND status_rbx_codigo IN ('C', 'N');
