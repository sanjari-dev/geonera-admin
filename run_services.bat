@echo off
title Geonera Cockpit Services Runner
echo ==========================================
echo Starting Geonera Admin Dashboard Cockpit
echo ==========================================
echo.

:: Start Backend Daemon (Bun + Hono)
echo [1/2] Launching Backend Daemon in a new window...
start "Geonera Backend" cmd /k "cd /d %~dp0backend && echo Starting Bun Backend... && bun run dev"

:: Start Frontend (React + Vite)
echo [2/2] Launching Frontend Dashboard in a new window...
start "Geonera Frontend" cmd /k "cd /d %~dp0frontend && echo Starting Vite Frontend... && npm run dev"

echo.
echo ==========================================
echo Both services are spinning up!
echo Backend window: Geonera Backend
echo Frontend window: Geonera Frontend
echo ==========================================
pause
