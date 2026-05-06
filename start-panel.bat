@echo off
title Panel Test Runner
cd /d "%~dp0"

echo.
echo  ==========================================
echo    Panel Test Runner - Uruchamianie...
echo  ==========================================
echo.

REM --- Sprawdz czy Docker Engine odpowiada ---
docker info >nul 2>&1
if not errorlevel 1 goto docker_ok

echo  [1/4] Uruchamianie Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

:czekaj_docker
timeout /t 5 /nobreak >nul
docker info >nul 2>&1
if errorlevel 1 (
    echo       Czekam na Docker...
    goto czekaj_docker
)

:docker_ok
echo  [1/4] Docker gotowy.

REM --- Pobierz najnowsze zmiany ---
echo  [2/4] Pobieranie aktualizacji (git pull)...
git pull --quiet

REM --- Uruchom kontener (detached) ---
echo  [3/4] Uruchamianie kontenera...
docker-compose up -d

REM --- Czekaj az API odpowie ---
echo  [4/4] Czekam az aplikacja bedzie gotowa...
:czekaj_app
timeout /t 3 /nobreak >nul
powershell -Command "try{Invoke-WebRequest -Uri 'http://localhost:8080/api/tests' -UseBasicParsing -TimeoutSec 2|Out-Null;exit 0}catch{exit 1}" >nul 2>&1
if errorlevel 1 goto czekaj_app

REM --- Otwórz przeglądarkę ---
echo.
echo  Aplikacja gotowa! Otwieram przegladarke...
start "" http://localhost:8080
echo.
echo  Aplikacja dziala na: http://localhost:8080
echo  noVNC (podglad):     http://localhost:7900
echo.
echo  Nacisnij dowolny klawisz aby ZATRZYMAC kontener...
pause >nul

docker-compose down
echo  Kontener zatrzymany. Do zobaczenia!
timeout /t 2 /nobreak >nul
