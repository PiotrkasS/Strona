@echo off
title Panel Test Runner
chcp 65001 >nul
cd /d "%~dp0"
cls

powershell -NoProfile -Command ^
  "Write-Host ''; ^
   Write-Host '  ===========================================' -ForegroundColor DarkCyan; ^
   Write-Host '     Panel Test Runner' -ForegroundColor White; ^
   Write-Host '     Playwright  .  PHP  .  React' -ForegroundColor Gray; ^
   Write-Host '  ===========================================' -ForegroundColor DarkCyan; ^
   Write-Host ''"

REM ── Krok 1: Docker ──────────────────────────────────────────────────────────
powershell -NoProfile -Command "Write-Host '  [1/4] Sprawdzanie Docker...' -ForegroundColor Cyan"

docker info >nul 2>&1
if not errorlevel 1 goto docker_ok

powershell -NoProfile -Command "Write-Host '        Uruchamianie Docker Desktop...' -ForegroundColor Yellow"
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

:czekaj_docker
timeout /t 4 /nobreak >nul
docker info >nul 2>&1
if errorlevel 1 (
    powershell -NoProfile -Command "Write-Host '        Czekam na Docker...' -ForegroundColor DarkYellow"
    goto czekaj_docker
)

:docker_ok
powershell -NoProfile -Command "Write-Host '  [1/4] Docker gotowy.' -ForegroundColor Green"

REM ── Krok 2: git pull ────────────────────────────────────────────────────────
powershell -NoProfile -Command "Write-Host '  [2/4] Pobieranie aktualizacji (git pull)...' -ForegroundColor Cyan"
git pull --quiet
powershell -NoProfile -Command "Write-Host '  [2/4] Aktualizacja pobrana.' -ForegroundColor Green"

REM ── Krok 3: docker-compose up ───────────────────────────────────────────────
powershell -NoProfile -Command "Write-Host '  [3/4] Uruchamianie kontenera...' -ForegroundColor Cyan"
docker-compose up -d
powershell -NoProfile -Command "Write-Host '  [3/4] Kontener uruchomiony.' -ForegroundColor Green"

REM ── Krok 4: czekaj na API ───────────────────────────────────────────────────
powershell -NoProfile -Command "Write-Host '  [4/4] Czekam az aplikacja bedzie gotowa...' -ForegroundColor Cyan"

:czekaj_app
timeout /t 3 /nobreak >nul
powershell -NoProfile -Command ^
  "try { Invoke-WebRequest -Uri 'http://localhost:8080/api/tests' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 goto czekaj_app

powershell -NoProfile -Command "Write-Host '  [4/4] Aplikacja gotowa!' -ForegroundColor Green"

REM ── Gotowe ───────────────────────────────────────────────────────────────────
powershell -NoProfile -Command ^
  "Write-Host ''; ^
   Write-Host '  ===========================================' -ForegroundColor DarkCyan; ^
   Write-Host '   Aplikacja dziala!' -ForegroundColor Green; ^
   Write-Host '   http://localhost:8080' -ForegroundColor White; ^
   Write-Host '   noVNC:  http://localhost:7900' -ForegroundColor Gray; ^
   Write-Host '  ===========================================' -ForegroundColor DarkCyan; ^
   Write-Host ''"

start "" http://localhost:8080

powershell -NoProfile -Command "Write-Host '  Nacisnij dowolny klawisz aby ZATRZYMAC...' -ForegroundColor DarkGray"
pause >nul

powershell -NoProfile -Command "Write-Host '  Zatrzymywanie kontenera...' -ForegroundColor Yellow"
docker-compose down
powershell -NoProfile -Command "Write-Host '  Gotowe. Do zobaczenia!' -ForegroundColor Green"
timeout /t 2 /nobreak >nul
