# Ponto de Restauração - EVAD (v1.0.0-checkpoint)

**Data do Ponto de Restauração:** 27 de Outubro de 2026  
**Identificador Git:** Tag `v1.0.0-checkpoint` | Branch `checkpoint-estavel-v1.0.0`  
**Arquivo de Dump do Banco:** `backups/evad_db_checkpoint_20261027.sql` (~6 MB)

---

## 1. O que está consolidado e garantido neste ponto:

1. **Relatório Executivo para Impressão (PDF / A4):**
   - Estrutura profissional em **2 páginas balanceadas**, sem tabelas cortadas e sem textos fatiados.
   - **Página 1:** Cabeçalho, 6 KPIs, 3 Micro-gráficos vetoriais SVG, Tabela 1 (Régua por Vencimento) e Tabela 2 (Distribuição de Todos os Planos).
   - **Página 2:** Tabela 3 (Situação Cadastral no Provedor), Tabela 4 (Desempenho Regional por Cidade) e **Box de Diagnóstico e Recomendações Estratégicas para Cobrança fixado no final do documento**.
   - Regras de CSS de impressão com `break-inside: avoid !important` para impedir quebras indesejadas em tabelas, linhas e caixas de texto.

2. **Inteligência de Retenção & Regras de Negócio RBX:**
   - **Soberania do Boleto (Opção 1):** Cliente com fatura da coorte em aberto nunca é considerado recuperado.
   - **Débitos Herdados / Renegociados (Modelo B):** Distinção clara de inadimplência herdada sem cobrança no mês.
   - **Planos Mimo / SVA / TV (Opção A):** Planos de R$ 0,00 (TV, GloboPlay, Paramount) são identificados como mimos e vinculados ao contrato principal pagante, sendo excluídos das contagens de bloqueios e KPIs.
   - **Cancelamento "SEM USO" (Churn Real):** Conforme confirmação do comercial, cancelamentos por falta de uso do ponto são contabilizados rigorosamente como **Churn / Cancelamento**, sem gerar datas fictícias de desbloqueio.

3. **Arquitetura & Docker Stack:**
   - **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4 + Nginx (porta 80).
   - **Backend:** Go 1.27 + Chi + Pgx pool (porta 8081).
   - **PostgreSQL:** Versão 16 isolada na porta 5433 (para não conflitar com outros bancos locais).
   - Configurações do RBX salvas com segurança no banco relacional.

---

## 2. Como Restaurar Rapidamente

### Opção 1: Restauração Automática em 1 Clique (Windows)
Basta dar um duplo clique no arquivo:
```cmd
restore_checkpoint.bat
```
*(Ou executar pelo terminal: `.\restore_checkpoint.bat`)*

### Opção 2: Restauração via PowerShell
Abra o PowerShell na pasta do projeto e execute:
```powershell
.\restore_checkpoint.ps1
```

### Opção 3: Restauração Manual (Passo a Passo)
Se preferir executar comando por comando:

1. **Restaurar código-fonte para o checkpoint:**
   ```bash
   git checkout v1.0.0-checkpoint
   ```

2. **Garantir que o PostgreSQL está rodando:**
   ```bash
   docker compose up -d evad-postgres
   ```

3. **Restaurar todos os dados do banco (PostgreSQL):**
   ```bash
   Get-Content -Raw .\backups\evad_db_checkpoint_20261027.sql | docker exec -i evad-postgres psql -U evad_user -d evad_db
   ```

4. **Reconstruir e subir a aplicação:**
   ```bash
   docker compose up -d --build
   ```

5. **Acessar o sistema no navegador:**
   - [http://localhost](http://localhost)
