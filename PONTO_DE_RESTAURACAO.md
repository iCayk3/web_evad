# Ponto de Restauração - EVAD (v1.1.0-checkpoint)

**Data do Ponto de Restauração:** 27 de Outubro de 2026  
**Identificador Git:** Tag `v1.1.0-checkpoint` | Branch `checkpoint-estavel-v1.1.0`  
**Arquivo de Dump do Banco:** `backups/evad_db_checkpoint_v1.1.0_20261027.sql` (~12.8 MB)

---

## 1. O que está consolidado e garantido neste ponto:

1. **Organização em Árvore Hierárquica por Bairro / Vila (Agrupado por Cidade):**
   - Agrupamento nativo e reativo: `Cidade -> Bairros / Vilas`.
   - Cabeçalho de Cidade com contagem de bairros, volume total de bloqueios, MRR bloqueado, taxa de recuperação com barra visual, churn e tempo médio de resolução.
   - Linhas filhas de bairros identadas (`↳`) com percentual de participação no volume da cidade.
   - Controles de interface: botão `[Recolher / Expandir Cidades]`, alternador entre `[Por Cidade (Árvore)]` e `[Lista Geral]`, filtro dropdown por cidade e busca textual rápida.

2. **Rotina de Sincronização Automática com RBX ISP (Estratégia Delta de Baixo Consumo):**
   - Disparo agendado nativo em background no backend Go para as **03:30** e **12:30** no fuso de Brasília/Belém (`America/Sao_Paulo`).
   - **Estratégia Delta Inteligente:** não reconsulta contratos já regularizados (`returned`), reduzindo as requisições ao RBX em quase 90% (de ~18.000 para ~1.800 contratos pendentes em ~23 segundos).
   - Enriquecimento cadastral automático de Bairros/Vilas via `ConsultaClientes` (serviço 44 do RBX) quando contratos novos forem inseridos sem endereço.
   - Novo botão dedicado no modal de configurações: **"Sincronizar Bairros"** com feedback em tempo real.

3. **Relatório Executivo para Impressão (PDF / A4):**
   - Estrutura profissional em **2 páginas balanceadas**, sem tabelas cortadas e sem textos fatiados.
   - **Página 1:** Cabeçalho, 6 KPIs, 3 Micro-gráficos vetoriais SVG, Tabela 1 (Régua por Vencimento) e Tabela 2 (Distribuição de Todos os Planos).
   - **Página 2:** Tabela 3 (Situação Cadastral no Provedor), Tabela 4 (Desempenho Regional por Cidade) e **Box de Diagnóstico e Recomendações Estratégicas para Cobrança fixado no final do documento**.
   - Regras de CSS de impressão com `break-inside: avoid !important` para impedir quebras indesejadas em tabelas, linhas e caixas de texto.

4. **Inteligência de Retenção & Regras de Negócio RBX:**
   - **Soberania do Boleto:** Cliente com fatura da coorte em aberto nunca é considerado recuperado.
   - **Débitos Herdados / Renegociados:** Distinção de inadimplência de ciclos anteriores isolada na Coorte Pura.
   - **Planos Mimo / SVA / TV:** Planos adicionais de R$ 0,00 vinculados ao contrato principal pagante e expurgados de duplicidade.
   - **Cancelamento "SEM USO" (Churn Real):** Contabilizados como Churn/Cancelamento, sem gerar datas fictícias de desbloqueio.

5. **Arquitetura & Docker Stack:**
   - **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4 + Nginx (porta 80 local).
   - **Backend:** Go 1.27 + Chi + Pgx pool (porta 8081).
   - **PostgreSQL:** Versão 16 isolada na porta 5433 (com volume e dump completo na pasta `backups/`).

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
1. **Restaurar código-fonte para o checkpoint:**
   ```bash
   git checkout v1.1.0-checkpoint
   ```

2. **Garantir que o PostgreSQL está rodando:**
   ```bash
   docker compose up -d evad-postgres
   ```

3. **Restaurar todos os dados do banco (PostgreSQL):**
   ```powershell
   Get-Content -Raw .\backups\evad_db_checkpoint_v1.1.0_20261027.sql | docker exec -i evad-postgres psql -U evad_user -d evad_db
   ```

4. **Reconstruir e subir a aplicação:**
   ```bash
   docker compose up -d --build
   ```

5. **Acessar o sistema no navegador:**
   - [http://localhost](http://localhost)
