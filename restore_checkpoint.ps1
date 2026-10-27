# Script de Restauração Automatizada - EVAD v1.0.0
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host " EVAD - Restaurando Ponto de Restauração v1.0.0 (Código + Banco)" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Restaurando código-fonte no Git para v1.0.0-checkpoint..." -ForegroundColor Yellow
git checkout v1.0.0-checkpoint

Write-Host ""
Write-Host "2. Garantindo execução do container PostgreSQL..." -ForegroundColor Yellow
docker compose up -d evad-postgres
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "3. Restaurando banco de dados completo do PostgreSQL..." -ForegroundColor Yellow
Get-Content -Raw .\backups\evad_db_checkpoint_20261027.sql | docker exec -i evad-postgres psql -U evad_user -d evad_db

Write-Host ""
Write-Host "4. Reconstruindo e reiniciando a aplicação Docker..." -ForegroundColor Yellow
docker compose up -d --build

Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host " Restauração concluída com sucesso!" -ForegroundColor Green
Write-Host " Acesse no seu navegador: http://localhost" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
