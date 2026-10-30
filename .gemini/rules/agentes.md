# Regra de Ouro do Projeto: Preservação e Zero Regressão

Tudo o que já foi desenvolvido no projeto EVAD tem que estar e permanecer em perfeitas condições. 
É expressamente proibido quebrar, desconfigurar ou remover qualquer funcionalidade existente ao adicionar novidades.

Consulte o arquivo oficial na raiz do projeto: `agentes.md`.

### Pontos Inegociáveis:
1. Módulo "Clientes Recuperados" (Coortes, Dashboard Mensal, Consolidado Anual, Recuperação de Equipamentos Mensal e Anual) 100% preservado e operacional.
2. Não utilizar extensões de Postgres opcionais no SQL de produção (sem dependência de `unaccent`).
3. Auditoria manual sempre tem soberania sobre o RBX.
4. Relatórios de impressão em PDF (A4) intocados (`print:hidden` em menus e botões).
5. Todo código novo deve passar em `go vet ./...` no backend e `npm run build` no frontend.
