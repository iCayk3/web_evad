# Regras e Diretrizes para Agentes de Desenvolvimento (agentes.md)

Este documento estabelece as **regras mandatórias** de arquitetura, qualidade e integridade de código que todo agente de IA ou desenvolvedor deve seguir rigorosamente neste repositório.

---

## 🛡️ Regra Fundamental de Ouro: Zero Regressão & Preservação Absoluta

> **"Tudo o que já foi desenvolvido tem que estar e permanecer em perfeitas condições. Não se pode derrubar, regredir, quebrar ou desconfigurar absolutamente nada que já esteja funcionando."**

Qualquer nova funcionalidade, refatoração ou tela deve ser construída de forma **aditiva, isolada e retrocompatível**, sem impactar os módulos já consolidados e aprovados em produção.

---

## 📋 Módulos Atuais e Proteções Específicas

### 1. Módulo "Clientes Recuperados" (Intocável e Permanente)
O módulo de Clientes Recuperados engloba o núcleo operacional já validado e deve permanecer 100% íntegro:
1. **Coortes & Clientes:**
   - Filtro de Coorte Pura vs. Total Exportado RBX.
   - Cálculo e exibição de Bloqueados, Retornados, Churn, Suspensos e Ticket Médio.
   - Tabela analítica completa com paginação, busca e filtros por cidade, plano e ciclo.
2. **Dashboard Mensal:**
   - Gráficos comparativos por ciclo de faturamento, velocidade de plano e praça de operação.
   - Segmentação e métricas por cidade e bairro.
3. **Consolidado & Evolução Anual:**
   - Visão histórica mês a mês e indicadores anuais consolidados.
4. **Recuperação de Equipamentos (Auditoria Mensal):**
   - Cruzamento estrito de clientes da competência com OSs de retirada abertas no RBX.
   - Identificação de **Pontos Cegos** (contratos cancelados ou suspensos sem chamado de OS).
   - Classificação manual soberana (*Recuperado*, *Tentando Recuperação*, *Perdido*, *Voltou Ativo*).
   - Definição do valor patrimonial unitário (modal e persistência de preço).
5. **Equipamentos (Ano Inteiro):**
   - Tabela e KPIs anuais de hardware em risco, resgatados e patrimônio pendente.
   - Sincronização e soberania da auditoria manual pelo código limpo do cliente (`codigo_clean`).

### 2. Módulo "Minha Empresa" (Módulo em Expansão)
- Novas telas, cadastros e recursos solicitados pelo usuário para a tela "Minha Empresa" devem ser adicionados sem alterar as rotas e estados internos de Clientes Recuperados.

---

## ⚙️ Regras Técnicas de Banco de Dados e Backend (Go + PostgreSQL)

1. **Portabilidade Universal de SQL:**
   - Nunca utilizar funções que dependam de extensões opcionais do PostgreSQL (ex: `unaccent`), salvo se explicitamente garantido.
   - Sempre utilizar consultas SQL compatíveis com qualquer PostgreSQL padrão (`LOWER()`, listagens explícitas com e sem acentuação).
2. **Auto-migrações Blindadas:**
   - Todo comando de migração (`ALTER TABLE`, `CREATE INDEX`) no `initDB()` deve rodar com tratamento de erro isolado para que uma falha nunca aborte a execução das demais migrações.
3. **Soberania da Auditoria Manual:**
   - A tabela `auditoria_equipamentos_manual` sempre tem prioridade sobre os dados automáticos do RBX.
   - O cruzamento cadastral deve sempre utilizar o código limpo (`codigo_clean`), removendo pontos e vírgulas para evitar divergências.

---

## 🎨 Regras de Frontend e Interface (React + Tailwind CSS)

1. **Blindagem de Layout Flex/Grid:**
   - Sempre usar proteções de largura (`shrink-0`, limites mínimos/máximos) em títulos e botões para impedir colapso vertical ou textos quebrando letra a letra.
   - Manter os botões organizados com `flex-wrap` e quebras responsivas.
2. **Proteção Total da Folha de Impressão (PDF / A4):**
   - Todo elemento de navegação na tela (Menu Lateral, abas, botões de ação na tela) deve conter a classe `print:hidden` ou `no-print`.
   - As folhas e relatórios de impressão (`ExecutivePrintReport`, `EquipmentPrintReport`) não podem sofrer interferência de layout da tela.
3. **Menu Lateral (Sidebar):**
   - O menu lateral deve continuar com seus 2 módulos principais: **Minha Empresa** e **Clientes Recuperados**.
   - O botão de colapsar (`w-64` / `w-20`) e o modo gaveta para dispositivos móveis devem ser mantidos operacionais.

---

## ✅ Checklist Obrigatório Pré-Entrega / Pré-Commit

Antes de concluir qualquer tarefa e enviar para produção (`origin/main`), o agente deve executar e validar:
1. `cd backend && go vet ./...` ➔ 0 erros no backend Go.
2. `npm --prefix frontend run build` ➔ 0 erros de compilação TypeScript e Vite no frontend.
3. Teste funcional dos endpoints da API (`/api/analytics/cohort`, `/api/analytics/monthly`, `/api/analytics/annual`, `/api/equipamentos/retiradas`, `/api/equipamentos/annual`).
4. Verificação de que nenhuma tela existente parou de renderizar ou perdeu dados.
