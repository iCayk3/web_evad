@echo off
chcp 65001 >nul
echo =====================================================================
echo  EVAD - Restaurando Ponto de Restauração v1.0.0 (Código + Banco)
echo =====================================================================
echo.

echo 1. Restaurando código-fonte para a tag de checkpoint...
git checkout v1.0.0-checkpoint
if %errorlevel% neq 0 (
    echo [AVISO] Tag v1.0.0-checkpoint não encontrada, mantendo arquivos locais.
)

echo.
echo 2. Garantindo execução do PostgreSQL no Docker...
docker compose up -d evad-postgres
timeout /t 3 /nobreak >nul

echo.
echo 3. Restaurando base de dados do PostgreSQL...
docker exec -i evad-postgres psql -U evad_user -d evad_db < backups\evad_db_checkpoint_20261027.sql

echo.
echo 4. Reconstruindo e reiniciando a aplicação Docker...
docker compose up -d --build

echo.
echo =====================================================================
echo  Restauração concluída com sucesso!
echo  Acesse em seu navegador: http://localhost
echo =====================================================================
pause
